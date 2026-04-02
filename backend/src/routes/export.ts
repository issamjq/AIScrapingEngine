import { Router } from "express"
import { Response, NextFunction } from "express"
import { AuthRequest } from "../middleware/auth"
import { query } from "../db"
import PDFDocument from "pdfkit"

export const exportRouter = Router()

// ── helpers ──────────────────────────────────────────────────────

function toCSV(rows: Record<string, unknown>[]): string {
  if (!rows.length) return ""
  const headers = Object.keys(rows[0])
  const escape  = (v: unknown) => {
    const s = v == null ? "" : String(v).replace(/"/g, '""')
    return /[",\n\r]/.test(s) ? `"${s}"` : s
  }
  return [
    headers.map(escape).join(","),
    ...rows.map(r => headers.map(h => escape(r[h])).join(",")),
  ].join("\n")
}

interface ExportData {
  user:         Record<string, unknown>
  tracked_urls: Record<string, unknown>[]
  products?:    Record<string, unknown>[]
  stores?:      Record<string, unknown>[]
}

function buildPDF(data: ExportData, res: Response) {
  const doc = new PDFDocument({ margin: 50, size: "A4" })
  res.setHeader("Content-Type", "application/pdf")
  doc.pipe(res)

  const W       = doc.page.width - 100
  const primary = "#030213"
  const muted   = "#717182"
  const line    = "#e5e7eb"

  // ── Header ──
  doc.rect(0, 0, doc.page.width, 70).fill("#030213")
  doc.fillColor("#ffffff").fontSize(18).font("Helvetica-Bold")
     .text("AI Scraping Engine", 50, 22)
  doc.fillColor("#aaaacc").fontSize(9).font("Helvetica")
     .text("Data Export", 50, 45)

  doc.moveDown(3)

  // ── User info ──
  const u = data.user
  doc.fillColor(primary).fontSize(13).font("Helvetica-Bold").text("Account", 50)
  doc.moveTo(50, doc.y + 4).lineTo(50 + W, doc.y + 4).strokeColor(line).lineWidth(1).stroke()
  doc.moveDown(0.5)

  const userFields: [string, unknown][] = [
    ["Name",         u.name],
    ["Email",        u.email],
    ["Role",         u.role],
    ["Plan",         u.subscription],
    ["Member since", u.member_since ? new Date(u.member_since as string).toLocaleDateString() : "—"],
    ["Exported at",  new Date(data.user.exported_at as string || Date.now()).toLocaleString()],
  ]

  doc.fontSize(9).font("Helvetica")
  for (const [label, value] of userFields) {
    const y = doc.y
    doc.fillColor(muted).text(label, 50, y, { width: 120, continued: false })
    doc.fillColor(primary).text(String(value ?? "—"), 180, y)
    doc.moveDown(0.3)
  }

  // ── Section helper ──
  function section(title: string, rows: Record<string, unknown>[], cols: string[], labels?: string[]) {
    if (!rows.length) return
    doc.moveDown(1.2)
    doc.fillColor(primary).fontSize(13).font("Helvetica-Bold").text(title, 50)
    doc.moveTo(50, doc.y + 4).lineTo(50 + W, doc.y + 4).strokeColor(line).lineWidth(1).stroke()
    doc.moveDown(0.6)

    const colW    = Math.floor(W / cols.length)
    const hdrs    = labels ?? cols

    // Header row
    doc.fontSize(8).font("Helvetica-Bold").fillColor(muted)
    hdrs.forEach((h, i) => doc.text(h.toUpperCase(), 50 + i * colW, doc.y, { width: colW, continued: i < cols.length - 1 }))
    doc.moveDown(0.4)
    doc.moveTo(50, doc.y).lineTo(50 + W, doc.y).strokeColor(line).lineWidth(0.5).stroke()
    doc.moveDown(0.3)

    // Data rows
    doc.font("Helvetica").fontSize(8).fillColor(primary)
    for (const row of rows) {
      if (doc.y > doc.page.height - 80) doc.addPage()
      const rowY = doc.y
      cols.forEach((c, i) => {
        const val = row[c]
        doc.fillColor(primary).text(String(val ?? "—"), 50 + i * colW, rowY, { width: colW - 4, continued: i < cols.length - 1 })
      })
      doc.moveDown(0.4)
    }
  }

  if (data.products?.length)    section("Products",     data.products,    ["internal_name","internal_sku","brand","rsp"],  ["Name","SKU","Brand","RSP"])
  if (data.stores?.length)      section("Stores",       data.stores,      ["name","base_url","is_active"],                 ["Store","URL","Active"])
  if (data.tracked_urls.length) section("Tracked URLs", data.tracked_urls, ["product_name","store_name","product_url"],    ["Product","Store","URL"])

  doc.end()
}

// ── Route ─────────────────────────────────────────────────────────
exportRouter.get("/", async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const email  = req.email!
    const format = (req.query.format as string) || "json"

    const { rows: [user] } = await query(
      `SELECT email, name, company_name, role, subscription, trial_ends_at, created_at
       FROM allowed_users WHERE email = $1`,
      [email]
    )

    const isB2C = user?.role === "b2c"

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

    const exportData: ExportData = {
      user: {
        email:        user?.email,
        name:         user?.name,
        role:         user?.role,
        subscription: user?.subscription,
        member_since: user?.created_at,
        exported_at:  new Date().toISOString(),
      },
      tracked_urls: trackedUrls,
    }

    if (!isB2C) {
      const { rows: products } = await query(
        `SELECT internal_name, internal_sku, brand, rsp, is_active, created_at
         FROM products WHERE user_email = $1 ORDER BY created_at DESC`,
        [email]
      )
      const { rows: stores } = await query(
        `SELECT name, slug, base_url, is_active FROM companies WHERE user_email = $1 ORDER BY name`,
        [email]
      )
      exportData.products = products
      exportData.stores   = stores
    }

    const slug = email.split("@")[0]
    const ts   = Date.now()

    if (format === "csv") {
      const sections: string[] = [`# AI Scraping Engine Export — ${new Date().toISOString()}\n`]
      if (exportData.products?.length)    sections.push(`## Products\n${toCSV(exportData.products)}\n`)
      if (exportData.stores?.length)      sections.push(`## Stores\n${toCSV(exportData.stores)}\n`)
      if (exportData.tracked_urls.length) sections.push(`## Tracked URLs\n${toCSV(exportData.tracked_urls)}\n`)
      res.setHeader("Content-Type", "text/csv")
      res.setHeader("Content-Disposition", `attachment; filename="aise-export-${slug}-${ts}.csv"`)
      return res.send(sections.join("\n"))
    }

    if (format === "pdf") {
      res.setHeader("Content-Disposition", `attachment; filename="aise-export-${slug}-${ts}.pdf"`)
      return buildPDF(exportData, res)
    }

    // Default: JSON
    res.setHeader("Content-Type", "application/json")
    res.setHeader("Content-Disposition", `attachment; filename="aise-export-${slug}-${ts}.json"`)
    return res.json(exportData)

  } catch (err) { next(err) }
})
