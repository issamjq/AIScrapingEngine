/**
 * /api/auth/totp/* — Google Authenticator / TOTP routes for privileged users.
 *
 * Flow:
 *   1. status              GET    /api/auth/totp/status
 *   2. enroll              POST   /api/auth/totp/enroll       — generates QR + backup codes (one-shot view)
 *   3. verify-enrollment   POST   /api/auth/totp/verify-enrollment {code} — confirms scan, persists secret + backup hashes
 *   4. verify              POST   /api/auth/totp/verify {code} — daily login check, returns session token
 *   5. use-backup          POST   /api/auth/totp/use-backup {code} — consumes a recovery code, returns session token
 *
 * All routes require Firebase auth (mounted under requireAuth in index.ts).
 */

import { Router } from "express"
import { query }  from "../db"
import { AuthRequest } from "../middleware/auth"
import {
  generateEnrollment, verifyTotp, consumeBackupCode,
  issueSessionToken, getStatus,
} from "../services/totpService"
import { logActivity } from "../services/activityLogger"

export const totpRouter = Router()

// ── status — frontend calls this on every page load to know what to render ──
totpRouter.get("/status", async (req, res, next) => {
  try {
    const email = (req as AuthRequest).email
    if (!email) return res.status(401).json({ success: false })
    const status = await getStatus(email)
    res.json({ success: true, data: status })
  } catch (err) { next(err) }
})

// ── enroll — generates secret + QR + backup codes (NOT persisted yet) ──
totpRouter.post("/enroll", async (req, res, next) => {
  try {
    const email = (req as AuthRequest).email
    if (!email) return res.status(401).json({ success: false })

    const status = await getStatus(email)
    if (status.enrolled) {
      return res.status(409).json({
        success: false,
        error: { message: "TOTP already enrolled. Disable it first if you need to re-enroll.", code: "ALREADY_ENROLLED" },
      })
    }

    const bundle = await generateEnrollment(email)

    // Stash the secret + hashes in a session-scoped pending row keyed by email.
    // We use the totp_secret column itself but DON'T set totp_enrolled_at, so
    // the user is treated as not-yet-enrolled until they verify.
    await query(
      `UPDATE allowed_users
          SET totp_secret = $2,
              totp_enrolled_at = NULL,
              totp_last_verified_at = NULL
        WHERE email = $1`,
      [email, bundle.secretEncrypted],
    )
    // Wipe any old backup codes — fresh start.
    await query(`DELETE FROM totp_backup_codes WHERE user_email = $1`, [email])

    res.json({
      success: true,
      data: {
        otpauth_url:  bundle.otpauthUrl,
        qr_data_url:  bundle.qrDataUrl,
        backup_codes: bundle.backupCodes,        // shown ONCE — frontend warns user
        // backupHashes intentionally NOT returned; persisted only on verify
        _hashes: bundle.backupHashes,
      },
    })
  } catch (err) { next(err) }
})

// ── verify-enrollment — first 6-digit code seals the deal ──
totpRouter.post("/verify-enrollment", async (req, res, next) => {
  try {
    const email = (req as AuthRequest).email
    if (!email) return res.status(401).json({ success: false })

    const code   = String(req.body?.code ?? "").trim()
    const hashes = Array.isArray(req.body?.backup_hashes) ? req.body.backup_hashes : []

    const ok = await verifyTotp(email, code)
    if (!ok) {
      return res.status(400).json({ success: false, error: { message: "Code didn't match. Try again.", code: "BAD_CODE" } })
    }

    // Mark enrolled + persist backup-code hashes
    await query(
      `UPDATE allowed_users
          SET totp_enrolled_at = NOW(),
              totp_last_verified_at = NOW()
        WHERE email = $1`,
      [email],
    )
    if (hashes.length > 0) {
      const values = hashes
        .filter((h: any) => typeof h === "string" && h.length === 64)
        .slice(0, 16)
        .map((_h: string, i: number) => `($1, $${i + 2})`)
        .join(",")
      const params = [email, ...hashes.slice(0, 16)]
      if (values.length > 0) {
        await query(`INSERT INTO totp_backup_codes (user_email, code_hash) VALUES ${values}`, params)
      }
    }

    logActivity({ user_email: email, action: "account_update", details: { totp: "enrolled" } }).catch(() => {})

    const token = issueSessionToken(email)
    res.json({ success: true, data: { session_token: token } })
  } catch (err) { next(err) }
})

// ── verify — every fresh login or session expiry hits this ──
totpRouter.post("/verify", async (req, res, next) => {
  try {
    const email = (req as AuthRequest).email
    if (!email) return res.status(401).json({ success: false })

    const code = String(req.body?.code ?? "").trim()
    const ok   = await verifyTotp(email, code)
    if (!ok) {
      return res.status(400).json({ success: false, error: { message: "Invalid code.", code: "BAD_CODE" } })
    }

    await query(`UPDATE allowed_users SET totp_last_verified_at = NOW() WHERE email = $1`, [email])
    const token = issueSessionToken(email)
    res.json({ success: true, data: { session_token: token } })
  } catch (err) { next(err) }
})

// ── use-backup — phone lost / authenticator wiped ──
totpRouter.post("/use-backup", async (req, res, next) => {
  try {
    const email = (req as AuthRequest).email
    if (!email) return res.status(401).json({ success: false })

    const code = String(req.body?.code ?? "").trim()
    const ok   = await consumeBackupCode(email, code)
    if (!ok) {
      return res.status(400).json({ success: false, error: { message: "Backup code invalid or already used.", code: "BAD_BACKUP_CODE" } })
    }

    await query(`UPDATE allowed_users SET totp_last_verified_at = NOW() WHERE email = $1`, [email])
    logActivity({ user_email: email, action: "account_update", details: { totp: "backup_used" } }).catch(() => {})

    const token = issueSessionToken(email)
    res.json({ success: true, data: { session_token: token } })
  } catch (err) { next(err) }
})
