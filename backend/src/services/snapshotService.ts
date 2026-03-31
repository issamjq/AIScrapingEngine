import { query } from "../db"
import { parsePagination } from "../utils/helpers"

export async function create(body: any) {
  const {
    product_id, company_id, product_company_url_id,
    title_found, price, original_price, currency, availability,
    raw_price_text, raw_availability_text,
    scrape_status, error_message, checked_at,
  } = body
  const { rows } = await query(
    `INSERT INTO price_snapshots
       (product_id, company_id, product_company_url_id,
        title_found, price, original_price, currency, availability,
        raw_price_text, raw_availability_text,
        scrape_status, error_message, checked_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
     RETURNING *`,
    [
      product_id, company_id, product_company_url_id,
      title_found    || null,
      price          !== undefined ? price : null,
      original_price !== undefined ? original_price : null,
      currency       || "AED",
      availability   || "unknown",
      raw_price_text        || null,
      raw_availability_text || null,
      scrape_status  || "success",
      error_message  || null,
      checked_at     || new Date(),
    ]
  )
  return rows[0]
}

export async function getAll(q: Record<string, any> = {}) {
  const { limit, offset } = parsePagination(q)
  const filters: string[] = []
  const params: any[]     = []

  if (q.product_id)             { params.push(parseInt(q.product_id));             filters.push(`ps.product_id = $${params.length}`) }
  if (q.company_id)             { params.push(parseInt(q.company_id));             filters.push(`ps.company_id = $${params.length}`) }
  if (q.product_company_url_id) { params.push(parseInt(q.product_company_url_id)); filters.push(`ps.product_company_url_id = $${params.length}`) }
  if (q.scrape_status)          { params.push(q.scrape_status);                    filters.push(`ps.scrape_status = $${params.length}`) }
  if (q.from) { params.push(q.from); filters.push(`ps.checked_at >= $${params.length}`) }
  if (q.to)   { params.push(q.to);   filters.push(`ps.checked_at <= $${params.length}`) }

  const where = filters.length ? `WHERE ${filters.join(" AND ")}` : ""
  const { rows: countRows } = await query(`SELECT COUNT(*) FROM price_snapshots ps ${where}`, params)

  params.push(limit, offset)
  const { rows } = await query(
    `SELECT ps.*,
            p.internal_name,
            c.name AS company_name,
            pcu.image_url,
            pcu.product_url
     FROM   price_snapshots ps
     JOIN   products p   ON p.id  = ps.product_id
     JOIN   companies c  ON c.id  = ps.company_id
     LEFT JOIN product_company_urls pcu ON pcu.id = ps.product_company_url_id
     ${where}
     ORDER  BY ps.checked_at DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  )
  return { data: rows, total: parseInt(countRows[0].count, 10), limit, offset }
}

export async function getLatestPrices(q: Record<string, any> = {}) {
  const filters = ["ps.scrape_status = 'success'"]
  const params: any[] = []
  if (q.product_id) { params.push(parseInt(q.product_id)); filters.push(`ps.product_id = $${params.length}`) }
  if (q.company_id) { params.push(parseInt(q.company_id)); filters.push(`ps.company_id = $${params.length}`) }

  const { rows } = await query(
    `SELECT DISTINCT ON (ps.product_id, ps.company_id)
            ps.*,
            p.internal_name, p.internal_sku, p.brand, p.category,
            c.name AS company_name,
            c.slug AS company_slug,
            pcu.image_url,
            pcu.product_url
     FROM   price_snapshots ps
     JOIN   products p   ON p.id  = ps.product_id
     JOIN   companies c  ON c.id  = ps.company_id
     LEFT JOIN product_company_urls pcu ON pcu.id = ps.product_company_url_id
     WHERE  ${filters.join(" AND ")}
     ORDER  BY ps.product_id, ps.company_id, ps.checked_at DESC`,
    params
  )
  return rows
}

export async function getPriceHistory(productId: number, companyId: number, days = 30) {
  const { rows } = await query(
    `SELECT price, currency, availability, checked_at, scrape_status
     FROM   price_snapshots
     WHERE  product_id  = $1
       AND  company_id  = $2
       AND  scrape_status = 'success'
       AND  checked_at >= NOW() - INTERVAL '${parseInt(String(days))} days'
     ORDER  BY checked_at ASC`,
    [productId, companyId]
  )
  return rows
}

export async function remove(id: number) {
  const { rows } = await query(
    `DELETE FROM price_snapshots WHERE id = $1 RETURNING id`,
    [id]
  )
  return rows[0] || null
}
