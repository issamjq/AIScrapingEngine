import { query } from "../db"
import * as pcuService from "./productCompanyUrlService"
import { scrapeAndSave } from "./scrapingService"
import { ScraperEngine } from "../scraper/engine"
import { pLimit } from "../utils/helpers"
import { logger } from "../utils/logger"

// ── Sync Run CRUD ─────────────────────────────────────────────────

export async function createRun(body: { company_id?: number | null; run_type: string; triggered_by?: string; meta?: any }) {
  const { company_id = null, run_type, triggered_by = "manual", meta = {} } = body
  const { rows } = await query(
    `INSERT INTO sync_runs (company_id, run_type, status, triggered_by, meta)
     VALUES ($1, $2, 'running', $3, $4)
     RETURNING *`,
    [company_id || null, run_type, triggered_by, JSON.stringify(meta)]
  )
  return rows[0]
}

export async function updateRun(id: number, body: any) {
  const { status, finished_at, total_checked, success_count, fail_count, error_message } = body
  const { rows } = await query(
    `UPDATE sync_runs
     SET status        = COALESCE($2, status),
         finished_at   = COALESCE($3, finished_at),
         total_checked = COALESCE($4, total_checked),
         success_count = COALESCE($5, success_count),
         fail_count    = COALESCE($6, fail_count),
         error_message = COALESCE($7, error_message)
     WHERE id = $1
     RETURNING *`,
    [id, status, finished_at || null, total_checked, success_count, fail_count, error_message || null]
  )
  return rows[0]
}

export async function getAll(q: Record<string, any> = {}) {
  const limit  = Math.min(100, parseInt(q.limit) || 20)
  const offset = Math.max(0, parseInt(q.offset) || 0)
  const filters: string[] = []
  const params: any[]     = []

  if (q.status)     { params.push(q.status);             filters.push(`status = $${params.length}`) }
  if (q.run_type)   { params.push(q.run_type);            filters.push(`run_type = $${params.length}`) }
  if (q.company_id) { params.push(parseInt(q.company_id)); filters.push(`company_id = $${params.length}`) }

  const where = filters.length ? `WHERE ${filters.join(" AND ")}` : ""
  params.push(limit, offset)
  const { rows } = await query(
    `SELECT sr.*, c.name AS company_name
     FROM   sync_runs sr
     LEFT JOIN companies c ON c.id = sr.company_id
     ${where}
     ORDER BY sr.started_at DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  )
  return rows
}

export async function getById(id: number) {
  const { rows } = await query(
    `SELECT sr.*, c.name AS company_name
     FROM   sync_runs sr
     LEFT JOIN companies c ON c.id = sr.company_id
     WHERE  sr.id = $1`,
    [id]
  )
  return rows[0] || null
}

// ── Sync Execution ─────────────────────────────────────────────────

export async function runOne(urlId: number) {
  const { rows } = await query(
    `SELECT pcu.*, c.slug AS company_slug
     FROM   product_company_urls pcu
     JOIN   companies c ON c.id = pcu.company_id
     WHERE  pcu.id = $1`,
    [urlId]
  )
  const urlRecord = rows[0]
  if (!urlRecord) throw new Error(`URL record not found: ${urlId}`)

  const run = await createRun({
    company_id:  urlRecord.company_id,
    run_type:    "single_url",
    triggered_by:"api",
    meta:        { url_id: urlId, url: urlRecord.product_url },
  })

  const engine = new ScraperEngine()
  let success = 0, fail = 0

  try {
    await engine.launch()
    const { scrapeResult } = await scrapeAndSave(urlRecord, engine)
    if (scrapeResult.scrapeStatus === "success") success = 1
    else fail = 1
  } catch (err: any) {
    fail = 1
    logger.error("[SyncService] runOne error", { urlId, error: err.message })
    await updateRun(run.id, { status: "failed", finished_at: new Date(), total_checked: 1, success_count: 0, fail_count: 1, error_message: err.message })
    await engine.close()
    throw err
  }

  await engine.close()
  return updateRun(run.id, {
    status:        fail > 0 ? "partial" : "completed",
    finished_at:   new Date(),
    total_checked: 1,
    success_count: success,
    fail_count:    fail,
  })
}

export async function runCompany(companyId: number) {
  const urls = await pcuService.getActiveUrls(companyId)
  if (!urls.length) throw new Error(`No active URLs found for company ${companyId}`)
  const run = await createRun({ company_id: companyId, run_type: "company_batch", triggered_by: "api", meta: { company_id: companyId, url_count: urls.length } })
  return _executeBatch(run, urls)
}

export async function startMany(urlIds: number[]) {
  if (!urlIds || !urlIds.length) throw new Error("url_ids array is required")
  const allUrls = await pcuService.getActiveUrls()
  const urls = allUrls.filter((u: any) => urlIds.includes(u.id))
  if (!urls.length) throw new Error("No active URLs found for the given IDs")
  const run = await createRun({ run_type: "selected_batch", triggered_by: "api", meta: { url_ids: urlIds, url_count: urls.length } })
  _executeBatch(run, urls).catch((err: any) => {
    logger.error("[SyncService] startMany background error", { runId: run.id, error: err.message })
  })
  return run
}

export async function startAll() {
  const urls = await pcuService.getActiveUrls()
  if (!urls.length) throw new Error("No active URLs found")
  const run = await createRun({ run_type: "full_batch", triggered_by: "api", meta: { url_count: urls.length } })
  _executeBatch(run, urls).catch((err: any) => {
    logger.error("[SyncService] startAll background error", { runId: run.id, error: err.message })
  })
  return run
}

async function _executeBatch(run: any, urls: any[]) {
  const concurrency = parseInt(process.env.SCRAPER_CONCURRENCY || "3") || 3
  const engine = new ScraperEngine()
  let success = 0, fail = 0

  try {
    await engine.launch()
    await pLimit(urls, concurrency, async (urlRecord: any) => {
      try {
        const { scrapeResult } = await scrapeAndSave(urlRecord, engine)
        if (scrapeResult.scrapeStatus === "success") success++
        else fail++
      } catch (err: any) {
        fail++
        logger.error("[SyncService] batch item error", { id: urlRecord.id, error: err.message })
      }
      query(
        "UPDATE sync_runs SET success_count=$2, fail_count=$3, total_checked=$4 WHERE id=$1",
        [run.id, success, fail, success + fail]
      ).catch(() => {})
    })
  } catch (err: any) {
    logger.error("[SyncService] batch fatal error", { runId: run.id, error: err.message })
    await updateRun(run.id, { status: "failed", finished_at: new Date(), total_checked: success + fail, success_count: success, fail_count: fail, error_message: err.message })
    await engine.close()
    throw err
  }

  await engine.close()
  const finalStatus = fail === 0 ? "completed" : (success === 0 ? "failed" : "partial")
  const finalRun = await updateRun(run.id, {
    status:        finalStatus,
    finished_at:   new Date(),
    total_checked: success + fail,
    success_count: success,
    fail_count:    fail,
  })
  logger.info("[SyncService] Batch done", { runId: run.id, total: success + fail, success, fail, status: finalStatus })
  return finalRun
}
