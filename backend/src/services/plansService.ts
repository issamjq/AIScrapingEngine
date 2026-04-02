import { query } from "../db"

export async function getAllPlans() {
  const { rows } = await query(
    `SELECT * FROM plans WHERE is_active = true ORDER BY sort_order ASC`
  )
  return rows
}

export async function getPlanByKey(key: string) {
  const { rows } = await query(
    `SELECT * FROM plans WHERE key = $1 AND is_active = true LIMIT 1`,
    [key]
  )
  return rows[0] || null
}
