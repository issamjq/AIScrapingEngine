import { Router } from "express"
import { Response, NextFunction } from "express"
import { AuthRequest } from "../middleware/auth"
import { query } from "../db"

export const exportRouter = Router()

// GET /api/export — download all user data as JSON
exportRouter.get("/", async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const email = req.email!

    const { rows: [user] } = await query(
      `SELECT email, name, company_name, role, subscription, trial_ends_at, created_at
       FROM allowed_users WHERE email = $1`,
      [email]
    )

    const isB2C = user?.role === "b2c"

    // Tracked URLs always included
    const { rows: trackedUrls } = await query(`
      SELECT pcu.product_url, pcu.is_active, pcu.last_status, pcu.last_checked_at,
             p.internal_name AS product_name, p.internal_sku  AS product_sku,
             c.name           AS store_name,  c.base_url       AS store_url
      FROM product_company_urls pcu
      JOIN products p ON p.id = pcu.product_id
      JOIN companies c ON c.id = pcu.company_id
      WHERE p.user_email = $1
      ORDER BY pcu.created_at DESC
    `, [email])

    const exportData: Record<string, unknown> = {
      exported_at: new Date().toISOString(),
      user: {
        email:         user?.email,
        name:          user?.name,
        role:          user?.role,
        subscription:  user?.subscription,
        member_since:  user?.created_at,
      },
      tracked_urls: trackedUrls,
    }

    // B2B also gets products + stores
    if (!isB2C) {
      const { rows: products } = await query(
        `SELECT internal_name, internal_sku, brand, rsp, is_active, created_at
         FROM products WHERE user_email = $1 ORDER BY created_at DESC`,
        [email]
      )
      const { rows: stores } = await query(
        `SELECT name, slug, base_url, is_active
         FROM companies WHERE user_email = $1 ORDER BY name`,
        [email]
      )
      exportData.products = products
      exportData.stores   = stores
    }

    const filename = `aise-export-${email.split("@")[0]}-${Date.now()}.json`
    res.setHeader("Content-Type", "application/json")
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`)
    res.json(exportData)
  } catch (err) { next(err) }
})
