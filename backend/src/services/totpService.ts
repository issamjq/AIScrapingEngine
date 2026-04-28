/**
 * totpService — Google Authenticator (RFC 6238 TOTP) for privileged accounts.
 *
 * Storage model:
 * - allowed_users.totp_secret holds the BASE32 secret AES-256-GCM encrypted
 *   (so a DB leak doesn't burn 2FA). The encryption key lives in env
 *   (TOTP_ENCRYPTION_KEY). If that key rotates, every enrolled secret must
 *   be re-keyed — keep the key sticky in production.
 * - allowed_users.totp_required: true for any role admins should never
 *   bypass (dev / owner / admin). Other users have it false; for them this
 *   service is a no-op.
 * - totp_backup_codes: 8 single-use SHA-256 hashed recovery codes per user.
 *
 * Session model:
 * - After successful TOTP verify we return a HMAC-signed JSON token (no DB
 *   lookup) the frontend stores in sessionStorage and ships back as
 *   X-Totp-Session on every API call. Tokens expire after TOTP_SESSION_TTL_MS.
 */

import crypto from "crypto"
import { generateSecret, generateURI, verifySync } from "otplib"
import QRCode from "qrcode"
import { query } from "../db"

// ─── env / constants ──────────────────────────────────────────────────────────

const TOTP_ENCRYPTION_KEY = process.env.TOTP_ENCRYPTION_KEY ?? ""
const TOTP_SESSION_SECRET = process.env.TOTP_SESSION_SECRET ?? ""
const ISSUER              = "Spark AI"
export const TOTP_SESSION_TTL_MS = 30 * 60_000  // 30 min rolling

if (!TOTP_ENCRYPTION_KEY || !TOTP_SESSION_SECRET) {
  // Don't crash — but log loudly. Routes will refuse enrollment if these are missing.
  // eslint-disable-next-line no-console
  console.warn("[TOTP] WARNING: TOTP_ENCRYPTION_KEY or TOTP_SESSION_SECRET not set — admin 2FA disabled")
}

// Allow ±30s clock skew (Google Authenticator rotates every 30s).
const EPOCH_TOLERANCE_SECONDS = 30

// ─── AES-256-GCM encryption for the base32 secret ─────────────────────────────

function getKey(): Buffer {
  return Buffer.from(TOTP_ENCRYPTION_KEY, "base64")
}

export function encryptSecret(plain: string): string {
  const iv = crypto.randomBytes(12)
  const c  = crypto.createCipheriv("aes-256-gcm", getKey(), iv)
  const ct = Buffer.concat([c.update(plain, "utf8"), c.final()])
  const tag = c.getAuthTag()
  // [iv (12B)][tag (16B)][ciphertext]
  return Buffer.concat([iv, tag, ct]).toString("base64")
}

export function decryptSecret(blob: string): string {
  const buf = Buffer.from(blob, "base64")
  const iv  = buf.subarray(0, 12)
  const tag = buf.subarray(12, 28)
  const ct  = buf.subarray(28)
  const d   = crypto.createDecipheriv("aes-256-gcm", getKey(), iv)
  d.setAuthTag(tag)
  return Buffer.concat([d.update(ct), d.final()]).toString("utf8")
}

// ─── secret + QR generation ───────────────────────────────────────────────────

export interface EnrollmentBundle {
  secretEncrypted: string                     // store in allowed_users.totp_secret
  otpauthUrl:      string                     // raw URL for fallback
  qrDataUrl:       string                     // PNG data: URI for the frontend
  backupCodes:     string[]                   // 8 plaintext codes — show ONCE
  backupHashes:    string[]                   // SHA-256 hashes — store
}

export async function generateEnrollment(email: string): Promise<EnrollmentBundle> {
  const secret      = generateSecret()
  const otpauthUrl  = generateURI({ issuer: ISSUER, label: email, secret })
  const qrDataUrl   = await QRCode.toDataURL(otpauthUrl, { errorCorrectionLevel: "M", margin: 1, width: 240 })
  const backupCodes = Array.from({ length: 8 }, () => crypto.randomBytes(5).toString("hex").toUpperCase())
  const backupHashes = backupCodes.map(c => crypto.createHash("sha256").update(c).digest("hex"))
  return {
    secretEncrypted: encryptSecret(secret),
    otpauthUrl,
    qrDataUrl,
    backupCodes,
    backupHashes,
  }
}

// ─── verification ─────────────────────────────────────────────────────────────

/** Verify a 6-digit TOTP code against the user's stored encrypted secret. */
export async function verifyTotp(email: string, code: string): Promise<boolean> {
  if (!/^\d{6}$/.test(code)) return false
  const { rows } = await query(
    `SELECT totp_secret FROM allowed_users WHERE email = $1 LIMIT 1`,
    [email],
  )
  const blob = rows[0]?.totp_secret
  if (!blob) return false
  try {
    const secret = decryptSecret(blob)
    const result = verifySync({ token: code, secret, epochTolerance: EPOCH_TOLERANCE_SECONDS })
    return result.valid === true
  } catch { return false }
}

/** Consume a single-use backup code; returns true if valid + marks used. */
export async function consumeBackupCode(email: string, code: string): Promise<boolean> {
  if (!code || code.length < 8) return false
  const hash = crypto.createHash("sha256").update(code.trim().toUpperCase()).digest("hex")
  const { rows } = await query(
    `UPDATE totp_backup_codes
        SET used_at = NOW()
      WHERE user_email = $1
        AND code_hash  = $2
        AND used_at IS NULL
      RETURNING id`,
    [email, hash],
  )
  return rows.length > 0
}

// ─── signed session token (no DB lookup needed to verify) ─────────────────────

interface TotpSessionPayload { email: string; exp: number }

export function issueSessionToken(email: string): string {
  const payload: TotpSessionPayload = { email, exp: Date.now() + TOTP_SESSION_TTL_MS }
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url")
  const sig  = crypto.createHmac("sha256", TOTP_SESSION_SECRET).update(body).digest("base64url")
  return `${body}.${sig}`
}

export function verifySessionToken(token: string | undefined, expectedEmail: string): boolean {
  if (!token || typeof token !== "string") return false
  const [body, sig] = token.split(".")
  if (!body || !sig) return false
  const expected = crypto.createHmac("sha256", TOTP_SESSION_SECRET).update(body).digest("base64url")
  // constant-time compare to defeat timing attacks
  if (sig.length !== expected.length) return false
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return false
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as TotpSessionPayload
    if (payload.exp < Date.now())               return false
    if (payload.email !== expectedEmail)        return false
    return true
  } catch { return false }
}

// ─── status helpers ───────────────────────────────────────────────────────────

export interface TotpStatus {
  required:    boolean
  enrolled:    boolean
  enrolled_at: string | null
}

export async function getStatus(email: string): Promise<TotpStatus> {
  const { rows } = await query(
    `SELECT totp_required, totp_enrolled_at, totp_secret IS NOT NULL AS has_secret
       FROM allowed_users
      WHERE email = $1
      LIMIT 1`,
    [email],
  )
  const r = rows[0]
  if (!r) return { required: false, enrolled: false, enrolled_at: null }
  return {
    required:    !!r.totp_required,
    enrolled:    !!r.has_secret && !!r.totp_enrolled_at,
    enrolled_at: r.totp_enrolled_at ?? null,
  }
}
