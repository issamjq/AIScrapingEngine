import rateLimit from "express-rate-limit"
import { AuthRequest } from "./auth"
import { Request } from "express"

/**
 * Key by authenticated user email when available, fall back to IP.
 * This ensures limits are per-user, not per-IP (which breaks NAT/shared offices).
 */
const keyByUser = (req: Request): string => {
  const email = (req as AuthRequest).email
  return email ?? req.ip ?? "unknown"
}

/**
 * Global baseline — all /api/* routes.
 * 300 requests per 15 minutes per user. Catches script abuse.
 */
export const globalLimiter = rateLimit({
  windowMs:        15 * 60 * 1000,  // 15 minutes
  limit:           300,
  keyGenerator:    keyByUser,
  standardHeaders: "draft-7",
  legacyHeaders:   false,
  message:         { success: false, error: { message: "Too many requests — slow down.", code: "RATE_LIMITED" } },
})

/**
 * B2C search — most expensive endpoint (Playwright + Claude Vision + AI web search).
 * 20 searches per hour per user. Even a pro user with 150 credits won't hit this normally.
 */
export const b2cSearchLimiter = rateLimit({
  windowMs:        60 * 60 * 1000,  // 1 hour
  limit:           20,
  keyGenerator:    keyByUser,
  standardHeaders: "draft-7",
  legacyHeaders:   false,
  message:         { success: false, error: { message: "Too many searches — you can do up to 20 per hour.", code: "RATE_LIMITED" } },
})

/**
 * Unlock endpoint — protects against someone trying to unlock-spam if credits go wrong.
 * 50 unlocks per hour per user.
 */
export const unlockLimiter = rateLimit({
  windowMs:        60 * 60 * 1000,
  limit:           50,
  keyGenerator:    keyByUser,
  standardHeaders: "draft-7",
  legacyHeaders:   false,
  message:         { success: false, error: { message: "Too many unlock requests.", code: "RATE_LIMITED" } },
})

/**
 * Signup — one attempt per 10 minutes per IP.
 * Prevents signup flooding / trial farming scripts.
 */
export const signupLimiter = rateLimit({
  windowMs:        10 * 60 * 1000,  // 10 minutes
  limit:           5,
  keyGenerator:    (req) => req.ip ?? "unknown",  // IP-based (no auth yet at signup)
  standardHeaders: "draft-7",
  legacyHeaders:   false,
  message:         { success: false, error: { message: "Too many signup attempts — try again later.", code: "RATE_LIMITED" } },
})

/**
 * Wallet add — admin-only, but still limit to prevent accidents.
 * 30 per hour per user.
 */
export const walletAddLimiter = rateLimit({
  windowMs:        60 * 60 * 1000,
  limit:           30,
  keyGenerator:    keyByUser,
  standardHeaders: "draft-7",
  legacyHeaders:   false,
  message:         { success: false, error: { message: "Too many wallet operations.", code: "RATE_LIMITED" } },
})
