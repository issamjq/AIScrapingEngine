import { query } from "../db"

export async function getAll({ includeInactive = false } = {}) {
  const sql = `
    SELECT c.*,
           cc.price_selectors,
           cc.title_selectors,
           cc.availability_selectors,
           cc.wait_for_selector,
           (SELECT COUNT(*) FROM product_company_urls pcu
            WHERE pcu.company_id = c.id AND pcu.is_active = true) AS url_count
    FROM   companies c
    LEFT JOIN company_configs cc ON cc.company_id = c.id
    ${includeInactive ? "" : "WHERE c.is_active = true"}
    ORDER BY c.name ASC
  `
  const { rows } = await query(sql)
  return rows
}

export async function getById(id: number) {
  const { rows } = await query(
    `SELECT c.*,
            cc.price_selectors,
            cc.title_selectors,
            cc.availability_selectors,
            cc.wait_for_selector,
            cc.page_options,
            cc.notes AS config_notes
     FROM   companies c
     LEFT JOIN company_configs cc ON cc.company_id = c.id
     WHERE  c.id = $1`,
    [id]
  )
  return rows[0] || null
}

export async function getBySlug(slug: string) {
  const { rows } = await query(
    `SELECT c.*,
            cc.price_selectors,
            cc.title_selectors,
            cc.availability_selectors,
            cc.wait_for_selector,
            cc.page_options
     FROM   companies c
     LEFT JOIN company_configs cc ON cc.company_id = c.id
     WHERE  c.slug = $1`,
    [slug]
  )
  return rows[0] || null
}

export async function create(body: any) {
  const { name, slug, base_url, logo_url, is_active = true } = body
  const { rows } = await query(
    `INSERT INTO companies (name, slug, base_url, logo_url, is_active)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [name, slug, base_url || null, logo_url || null, is_active]
  )
  return rows[0]
}

export async function update(id: number, fields: any) {
  const allowed = ["name", "slug", "base_url", "logo_url", "is_active"]
  const keys    = Object.keys(fields).filter((k) => allowed.includes(k))
  if (!keys.length) return getById(id)

  const sets   = keys.map((k, i) => `${k} = $${i + 2}`).join(", ")
  const values = keys.map((k) => fields[k])
  const { rows } = await query(
    `UPDATE companies SET ${sets} WHERE id = $1 RETURNING *`,
    [id, ...values]
  )
  return rows[0] || null
}

export async function remove(id: number) {
  const { rowCount } = await query("DELETE FROM companies WHERE id = $1", [id])
  return (rowCount ?? 0) > 0
}

export async function upsertConfig(companyId: number, body: any) {
  const {
    price_selectors        = [],
    title_selectors        = [],
    availability_selectors = [],
    wait_for_selector      = null,
    page_options           = {},
    notes                  = null,
  } = body
  const { rows } = await query(
    `INSERT INTO company_configs
       (company_id, price_selectors, title_selectors, availability_selectors,
        wait_for_selector, page_options, notes)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (company_id) DO UPDATE SET
       price_selectors        = EXCLUDED.price_selectors,
       title_selectors        = EXCLUDED.title_selectors,
       availability_selectors = EXCLUDED.availability_selectors,
       wait_for_selector      = EXCLUDED.wait_for_selector,
       page_options           = EXCLUDED.page_options,
       notes                  = EXCLUDED.notes,
       updated_at             = NOW()
     RETURNING *`,
    [
      companyId,
      JSON.stringify(price_selectors),
      JSON.stringify(title_selectors),
      JSON.stringify(availability_selectors),
      wait_for_selector,
      JSON.stringify(page_options),
      notes,
    ]
  )
  return rows[0]
}
