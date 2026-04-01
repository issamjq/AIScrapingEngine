import { query } from "../db"
import { parsePagination } from "../utils/helpers"

export async function getAll(q: Record<string, any> = {}, userEmail: string) {
  const { limit, offset } = parsePagination(q)
  const filters: string[] = ["p.user_email = $1"]
  const params: any[]     = [userEmail]

  if (q.is_active !== undefined) {
    params.push(q.is_active === "true" || q.is_active === true)
    filters.push(`p.is_active = $${params.length}`)
  }
  if (q.category) { params.push(q.category); filters.push(`p.category = $${params.length}`) }
  if (q.brand)    { params.push(q.brand);    filters.push(`p.brand = $${params.length}`) }
  if (q.search) {
    params.push(`%${q.search}%`)
    filters.push(`(p.internal_name ILIKE $${params.length} OR p.internal_sku ILIKE $${params.length} OR p.barcode ILIKE $${params.length} OR p.brand ILIKE $${params.length})`)
  }

  const where = `WHERE ${filters.join(" AND ")}`
  const { rows: countRows } = await query(`SELECT COUNT(*) FROM products p ${where}`, params)

  params.push(limit, offset)
  const { rows } = await query(
    `SELECT p.*,
            COUNT(pcu.id) FILTER (WHERE pcu.is_active = true) AS url_count
     FROM   products p
     LEFT JOIN product_company_urls pcu ON pcu.product_id = p.id
     ${where}
     GROUP BY p.id
     ORDER BY p.internal_name ASC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  )
  return { data: rows, total: parseInt(countRows[0].count, 10), limit, offset }
}

export async function getById(id: number) {
  const { rows } = await query(
    `SELECT p.*,
            json_agg(
              json_build_object(
                'id',          pcu.id,
                'company_id',  pcu.company_id,
                'company_name',c.name,
                'company_slug',c.slug,
                'product_url', pcu.product_url,
                'last_status', pcu.last_status,
                'last_checked_at', pcu.last_checked_at,
                'is_active',   pcu.is_active
              )
            ) FILTER (WHERE pcu.id IS NOT NULL) AS urls
     FROM   products p
     LEFT JOIN product_company_urls pcu ON pcu.product_id = p.id
     LEFT JOIN companies c ON c.id = pcu.company_id
     WHERE  p.id = $1
     GROUP BY p.id`,
    [id]
  )
  return rows[0] || null
}

export async function create(body: any, userEmail: string) {
  const { internal_name, internal_sku, barcode, brand, category, image_url, initial_rsp, notes, is_active = true } = body
  const { rows } = await query(
    `INSERT INTO products (internal_name, internal_sku, barcode, brand, category, image_url, initial_rsp, notes, is_active, user_email)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING *`,
    [internal_name, internal_sku || null, barcode || null, brand || null,
     category || null, image_url || null,
     initial_rsp != null ? Number(initial_rsp) : null,
     notes || null, is_active, userEmail]
  )
  return rows[0]
}

export async function update(id: number, fields: any, userEmail: string) {
  const allowed = ["internal_name", "internal_sku", "barcode", "brand", "category", "image_url", "initial_rsp", "notes", "is_active"]
  const keys    = Object.keys(fields).filter((k) => allowed.includes(k))
  if (!keys.length) return getById(id)

  const sets   = keys.map((k, i) => `${k} = $${i + 3}`).join(", ")
  const values = keys.map((k) => fields[k])
  const { rows } = await query(
    `UPDATE products SET ${sets} WHERE id = $1 AND user_email = $2 RETURNING *`,
    [id, userEmail, ...values]
  )
  return rows[0] || null
}

export async function remove(id: number, userEmail: string) {
  const { rowCount } = await query(
    "DELETE FROM products WHERE id = $1 AND user_email = $2",
    [id, userEmail]
  )
  return (rowCount ?? 0) > 0
}

export async function bulkImport(items: any[], userEmail: string) {
  let inserted = 0, updated = 0, skipped = 0
  for (const item of items) {
    if (!item.internal_name || !item.internal_sku) { skipped++; continue }
    const rsp = item.initial_rsp != null && item.initial_rsp !== "" ? Number(item.initial_rsp) : null
    const { rows } = await query(
      `INSERT INTO products (internal_name, internal_sku, barcode, brand, image_url, initial_rsp, is_active, user_email)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (internal_sku, user_email) WHERE internal_sku IS NOT NULL AND user_email IS NOT NULL DO UPDATE SET
         internal_name = EXCLUDED.internal_name,
         barcode       = EXCLUDED.barcode,
         brand         = EXCLUDED.brand,
         image_url     = EXCLUDED.image_url,
         initial_rsp   = EXCLUDED.initial_rsp,
         is_active     = EXCLUDED.is_active,
         updated_at    = NOW()
       WHERE (
         products.internal_name  IS DISTINCT FROM EXCLUDED.internal_name  OR
         products.barcode        IS DISTINCT FROM EXCLUDED.barcode        OR
         products.brand          IS DISTINCT FROM EXCLUDED.brand          OR
         products.image_url      IS DISTINCT FROM EXCLUDED.image_url      OR
         products.initial_rsp    IS DISTINCT FROM EXCLUDED.initial_rsp    OR
         products.is_active      IS DISTINCT FROM EXCLUDED.is_active
       )
       RETURNING (xmax = 0) AS inserted`,
      [item.internal_name, String(item.internal_sku),
       item.barcode || null, item.brand || null,
       item.image_url || null, rsp, item.is_active ?? true, userEmail]
    )
    if (rows.length === 0) skipped++
    else if (rows[0].inserted) inserted++
    else updated++
  }
  return { inserted, updated, skipped, total: inserted + updated + skipped }
}
