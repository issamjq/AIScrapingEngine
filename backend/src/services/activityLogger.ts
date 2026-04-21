/**
 * activityLogger — fire-and-forget activity log writer.
 * Call logActivity() anywhere in the backend after a significant user action.
 * Never throws — logging failures are silently swallowed so they never break a request.
 */

import { query } from "../db"
import { logger } from "../utils/logger"

export type ActivityAction =
  // B2C
  | "b2c_search"
  | "b2c_unlock"
  // B2B
  | "b2b_ai_search"
  | "b2b_catalog_discovery"
  | "b2b_confirm_mappings"
  // Catalog
  | "product_add"
  | "product_import"
  | "product_delete"
  | "store_add"
  | "store_edit"
  | "store_delete"
  // Creator Intel
  | "scrape_amazon"
  | "scrape_aliexpress"
  | "scrape_tiktok"
  | "scrape_ebay"
  // Account
  | "signup"
  | "account_update"
  | "account_delete"
  // Credits
  | "credits_deducted"
  | "price_sync"

export async function logActivity(opts: {
  user_email: string
  role?:      string
  action:     ActivityAction
  details?:   Record<string, any>
  ip?:        string
}): Promise<void> {
  try {
    await query(
      `INSERT INTO activity_log (user_email, role, action, details, ip)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        opts.user_email,
        opts.role   ?? null,
        opts.action,
        JSON.stringify(opts.details ?? {}),
        opts.ip     ?? null,
      ],
    )
  } catch (err: any) {
    // Never break the caller — just log a warning
    logger.warn("[ActivityLogger] Failed to write log", { action: opts.action, error: err.message })
  }
}

/** Extract real client IP from request headers */
export function getClientIp(req: any): string | undefined {
  const raw = (req.headers?.["x-forwarded-for"] as string)?.split(",")[0]?.trim()
              || req.socket?.remoteAddress
  return raw?.replace("::ffff:", "") || undefined
}
