/**
 * errorLogger — persists backend exceptions to the error_log table so admins
 * can see failures surface in the dashboard instead of digging through Render
 * logs. Fire-and-forget; swallows own errors.
 */

import { query } from "../db"

export interface ErrorLogOpts {
  level?:      "error" | "warn" | "fatal"
  source?:     string
  message:     string
  stack?:      string | null
  path?:       string | null
  status?:     number | null
  user_email?: string | null
  ip?:         string | null
}

export async function logError(opts: ErrorLogOpts): Promise<void> {
  try {
    await query(
      `INSERT INTO error_log (level, source, message, stack, path, status, user_email, ip)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        opts.level   ?? "error",
        opts.source  ?? null,
        String(opts.message ?? "").slice(0, 2000),
        opts.stack   ? String(opts.stack).slice(0, 8000) : null,
        opts.path    ?? null,
        opts.status  ?? null,
        opts.user_email ?? null,
        opts.ip      ?? null,
      ],
    )
  } catch {
    // never propagate — logging must not break the caller
  }
}
