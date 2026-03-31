import { Pool, PoolClient, QueryResult } from "pg"

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production"
    ? { rejectUnauthorized: true }
    : { rejectUnauthorized: false },
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
})

pool.on("error", (err) => {
  console.error("[DB] Unexpected pool error:", err.message)
})

export async function query(text: string, params?: any[]): Promise<QueryResult> {
  const start = Date.now()
  try {
    const result = await pool.query(text, params)
    const duration = Date.now() - start
    if (process.env.NODE_ENV === "development") {
      console.log(`[DB] query (${duration}ms) rows=${result.rowCount}`, text.slice(0, 80))
    }
    return result
  } catch (err: any) {
    console.error("[DB] Query error:", err.message, "\nSQL:", text.slice(0, 200))
    throw err
  }
}

export async function getClient(): Promise<PoolClient> {
  return pool.connect()
}

export async function withTransaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect()
  try {
    await client.query("BEGIN")
    const result = await callback(client)
    await client.query("COMMIT")
    return result
  } catch (err) {
    await client.query("ROLLBACK")
    throw err
  } finally {
    client.release()
  }
}

export { pool }
