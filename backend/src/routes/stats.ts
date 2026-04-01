import { Router } from "express"
import { query } from "../db"
import { AuthRequest } from "../middleware/auth"

export const statsRouter = Router()

statsRouter.get("/", async (req, res, next) => {
  try {
    const email = (req as AuthRequest).email!
    const { rows } = await query(`
      SELECT
        (SELECT COUNT(*) FROM companies
         WHERE is_active = true AND (user_email = $1 OR user_email IS NULL))::int AS companies,
        (SELECT COUNT(*) FROM products
         WHERE is_active = true AND user_email = $1)::int AS products,
        (SELECT COUNT(*) FROM product_company_urls pcu
         JOIN products p ON p.id = pcu.product_id
         WHERE pcu.is_active = true AND p.user_email = $1)::int AS tracked_urls,
        (SELECT total_checked FROM sync_runs ORDER BY started_at DESC LIMIT 1) AS last_sync_total,
        (SELECT success_count FROM sync_runs ORDER BY started_at DESC LIMIT 1) AS last_sync_succeeded
    `, [email])
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
