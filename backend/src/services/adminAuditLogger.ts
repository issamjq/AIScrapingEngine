/**
 * adminAuditLogger — records every privileged action by dev/owner/admin.
 * Fire-and-forget; never throws so it can't break the calling request.
 */

import { query } from "../db"
import { logger } from "../utils/logger"

export type AdminAction =
  | "credit_adjust"
  | "user_role_change"
  | "user_subscription_change"
  | "user_delete"
  | "user_ban"
  | "plan_change"
  | "scrape_trigger"
  | "broadcast_create"
  | "broadcast_deactivate"
  | "backfill_geo"
  | "refund"

export interface AdminAuditOpts {
  actor_email:   string
  action:        AdminAction
  target_email?: string | null
  details?:      Record<string, any>
  ip?:           string | null
}

export async function logAdminAction(opts: AdminAuditOpts): Promise<void> {
  try {
    await query(
      `INSERT INTO admin_audit_log (actor_email, action, target_email, details, ip)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        opts.actor_email,
        opts.action,
        opts.target_email ?? null,
        JSON.stringify(opts.details ?? {}),
        opts.ip ?? null,
      ],
    )
  } catch (err: any) {
    logger.warn("[AdminAudit] write failed", { action: opts.action, error: err.message })
  }
}
