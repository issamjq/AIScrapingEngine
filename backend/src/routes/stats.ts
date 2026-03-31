import { Router } from "express"
import { query } from "../db"

export const statsRouter = Router()

statsRouter.get("/", async (_req, res, next) => {
  try {
    const { rows } = await query(`
      SELECT
        (SELECT COUNT(*) FROM companies WHERE is_active = true)::int AS companies,
        (SELECT COUNT(*) FROM products WHERE is_active = true)::int AS products,
        (SELECT COUNT(*) FROM product_company_urls WHERE is_active = true)::int AS tracked_urls,
        (SELECT total_checked FROM sync_runs ORDER BY started_at DESC LIMIT 1) AS last_sync_total,
        (SELECT success_count FROM sync_runs ORDER BY started_at DESC LIMIT 1) AS last_sync_succeeded
    `)
    const row = rows[0] || {}
    const total     = Number(row.last_sync_total)     || 0
    const succeeded = Number(row.last_sync_succeeded) || 0
    res.json({
      success: true,
      data: {
        companies:           row.companies    || 0,
        products:            row.products     || 0,
        tracked_urls:        row.tracked_urls || 0,
        last_sync_total:     total,
        last_sync_succeeded: succeeded,
        last_sync_rate:      total > 0 ? Math.round((succeeded / total) * 100) : 0,
      },
    })
  } catch (err) { next(err) }
})
