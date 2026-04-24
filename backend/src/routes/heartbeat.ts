/**
 * heartbeat — client pings this every ~60s while the app tab is open.
 * Updates `allowed_users.last_seen_at` + `last_seen_ip` so the admin
 * dashboard can show an accurate "live now" count.
 */

import { Router } from "express"
import { query } from "../db"
import { AuthRequest } from "../middleware/auth"
import { getClientIp } from "../services/activityLogger"

export const heartbeatRouter = Router()

heartbeatRouter.post("/", async (req, res, next) => {
  try {
    const email = (req as AuthRequest).email
    if (!email) return res.status(401).json({ success: false })

    const ip = getClientIp(req) ?? null

    await query(
      `UPDATE allowed_users
          SET last_seen_at = NOW(),
              last_seen_ip = COALESCE($2, last_seen_ip)
        WHERE email = $1`,
      [email.toLowerCase().trim(), ip],
    )

    res.json({ success: true, at: new Date().toISOString() })
  } catch (err) { next(err) }
})
