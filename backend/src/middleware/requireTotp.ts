/**
 * requireTotp — gate API routes behind a valid TOTP session token.
 *
 * Behavior:
 * - If the caller's role doesn't require TOTP → pass through.
 * - If TOTP required but not enrolled → 403 with TOTP_NOT_ENROLLED so the
 *   frontend can route them to the enrollment screen.
 * - If TOTP required + enrolled but no/expired session token → 403
 *   TOTP_REQUIRED so the frontend can prompt for a 6-digit code.
 * - Otherwise pass through.
 *
 * Mounted globally on /api/* AFTER requireAuth in index.ts. Public routes
 * (auth signup, broadcasts/active, totp/* themselves) bypass via SKIP_PATHS.
 */

import { Response, NextFunction } from "express"
import { AuthRequest } from "./auth"
import { query } from "../db"
import { verifySessionToken } from "../services/totpService"

// Routes that must work BEFORE TOTP is satisfied (otherwise users can't enroll).
const SKIP_PREFIXES = [
  "/api/auth/totp",          // enroll / verify / use-backup
  "/api/heartbeat",          // tab-presence ping (cheap, harmless)
  "/api/broadcasts/active",  // public anyway; included for safety
  "/api/allowed-users/me",   // role lookup that determines whether TOTP applies
]

export async function requireTotp(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const email = req.email
    if (!email) return next()                                      // not authenticated → let auth deal with it

    // Skip whitelisted paths
    if (SKIP_PREFIXES.some(p => req.path.startsWith(p))) return next()

    const { rows } = await query(
      `SELECT totp_required, totp_enrolled_at, totp_secret IS NOT NULL AS has_secret
         FROM allowed_users
        WHERE email = $1
        LIMIT 1`,
      [email],
    )
    const u = rows[0]
    if (!u || !u.totp_required) return next()                      // not a privileged account

    const enrolled = !!u.has_secret && !!u.totp_enrolled_at
    if (!enrolled) {
      return res.status(403).json({
        success: false,
        error: { message: "Two-factor authentication required. Enroll Google Authenticator first.", code: "TOTP_NOT_ENROLLED" },
      })
    }

    const token = req.header("x-totp-session") ?? ""
    if (!verifySessionToken(token, email)) {
      return res.status(403).json({
        success: false,
        error: { message: "Two-factor authentication required.", code: "TOTP_REQUIRED" },
      })
    }

    next()
  } catch (err) { next(err) }
}
