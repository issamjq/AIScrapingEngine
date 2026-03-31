import { query } from "../db"
import { parsePagination } from "../utils/helpers"

export async function getAll(q: Record<string, any> = {}) {
  const { limit, offset } = parsePagination(q)
  const filters: string[] = []
  const params: any[]     = []

  if (q.product_id) { params.push(parseInt(q.product_id)); filters.push(`pcu.product_id = $${params.length}`) }
  if (q.company_id) { params.push(parseInt(q.company_id)); filters.push(`pcu.company_id = $${params.length}`) }
  if (q.is_active !== undefined) {
    params.push(q.is_active === "true" || q.is_active === true)
    filters.push(`pcu.is_active = $${params.length}`)
  }
  if (q.last_status) { params.push(q.last_status); filters.push(`pcu.last_status = $${params.length}`) }

  const where = filters.length ? `WHERE ${filters.join(" AND ")}` : ""
  const { rows: countRows } = await query(
    `SELECT COUNT(*) FROM product_company_urls pcu ${where}`, params
  )

  params.push(limit, offset)
  const { rows } = await query(
    `SELECT pcu.*,
            p.internal_name,
            p.internal_sku,
            c.name  AS company_name,
            c.slug  AS company_slug
     FROM   product_company_urls pcu
     JOIN   products p  ON p.id  = pcu.product_id
     JOIN   companies c ON c.id  = pcu.company_id
     ${where}
     ORDER  BY p.internal_name ASC, c.name ASC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  )
  return { data: rows, total: parseInt(countRows[0].count, 10), limit, offset }
}

export async function getById(id: number) {
  const { rows } = await query(
    `SELECT pcu.*,
            p.internal_name, p.internal_sku, p.brand, p.category,
            c.name  AS company_name,
            c.slug  AS company_slug,
            c.base_url
     FROM   product_company_urls pcu
     JOIN   products p  ON p.id  = pcu.product_id
     JOIN   companies c ON c.id  = pcu.company_id
     WHERE  pcu.id = $1`,
    [id]
  )
  return rows[0] || null
}

export async function getActiveUrls(companyId: number | null = null) {
  const params: any[]     = []
  const filters: string[] = ["pcu.is_active = true", "c.is_active = true", "p.is_active = true"]
  if (companyId) {
    params.push(companyId)
    filters.push(`pcu.company_id = $${params.length}`)
  }
  const { rows } = await query(
    `SELECT pcu.*,
            c.slug  AS company_slug,
            c.name  AS company_name,
            p.internal_name
     FROM   product_company_urls pcu
     JOIN   companies c ON c.id  = pcu.company_id
     JOIN   products p  ON p.id  = pcu.product_id
     WHERE  ${filters.join(" AND ")}
     ORDER  BY pcu.id ASC`,
    params
  )
  return rows
}

export async function create(body: any) {
  const {
    product_id, company_id, product_url,
    external_title, external_sku, external_barcode,
    selector_price, selector_title, selector_availability,
    price_selectors, title_selectors, availability_selectors,
    currency = "AED", is_active = true,
  } = body
  const { rows } = await query(
    `INSERT INTO product_company_urls
       (product_id, company_id, product_url,
        external_title, external_sku, external_barcode,
        selector_price, selector_title, selector_availability,
        price_selectors, title_selectors, availability_selectors,
        currency, is_active)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
     RETURNING *`,
    [
      product_id, company_id, product_url,
      external_title || null, external_sku || null, external_barcode || null,
      selector_price || null, selector_title || null, selector_availability || null,
      price_selectors        ? JSON.stringify(price_selectors)        : null,
      title_selectors        ? JSON.stringify(title_selectors)        : null,
      availability_selectors ? JSON.stringify(availability_selectors) : null,
      currency, is_active,
    ]
  )
  return rows[0]
}

export async function update(id: number, fields: any) {
  const allowed = [
    "product_id", "product_url", "external_title", "external_sku", "external_barcode",
    "selector_price", "selector_title", "selector_availability",
    "price_selectors", "title_selectors", "availability_selectors",
    "currency", "is_active", "last_status", "last_checked_at", "image_url",
  ]
  const keys = Object.keys(fields).filter((k) => allowed.includes(k))
  if (!keys.length) return getById(id)

  const sets   = keys.map((k, i) => `${k} = $${i + 2}`).join(", ")
  const values = keys.map((k) => {
    if (["price_selectors", "title_selectors", "availability_selectors"].includes(k)) {
      return fields[k] ? JSON.stringify(fields[k]) : null
    }
    return fields[k]
  })

  const { rows } = await query(
    `UPDATE product_company_urls SET ${sets} WHERE id = $1 RETURNING *`,
    [id, ...values]
  )
  return rows[0] || null
}

export async function remove(id: number) {
  const { rowCount } = await query("DELETE FROM product_company_urls WHERE id = $1", [id])
  return (rowCount ?? 0) > 0
}
