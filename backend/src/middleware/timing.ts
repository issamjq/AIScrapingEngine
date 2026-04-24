/**
 * timing — records every API request's duration + status into endpoint_timings
 * so the admin dashboard can surface p50/p95/p99 per route.
 *
 * Non-blocking: the insert is fire-and-forget after the response is sent.
 * Skips static and admin endpoints to keep the table small.
 */

import { Request, Response, NextFunction } from "express"
import { query } from "../db"

// Routes we don't want to spam into endpoint_timings
const SKIP_PREFIXES = ["/health", "/api/admin/stats", "/api/heartbeat"]

export function timingMiddleware(req: Request, res: Response, next: NextFunction) {
  if (SKIP_PREFIXES.some(p => req.path.startsWith(p))) return next()

  const start = Date.now()
  res.on("finish", () => {
    const duration = Date.now() - start
    const route = (req.route && req.baseUrl)
      ? `${req.baseUrl}${req.route.path}`
      : req.path
    const email = (req as any).email as string | undefined

    // fire-and-forget — don't block anything
    query(
      `INSERT INTO endpoint_timings (method, route, duration_ms, status, user_email)
       VALUES ($1, $2, $3, $4, $5)`,
      [req.method, String(route).slice(0, 200), duration, res.statusCode, email ?? null],
    ).catch(() => {})
  })

  next()
}
