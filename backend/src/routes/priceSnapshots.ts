import { Router } from "express"
import * as svc from "../services/snapshotService"
import { createError } from "../middleware/validate"

export const priceSnapshotsRouter = Router()

priceSnapshotsRouter.get("/", async (req, res, next) => {
  try {
    const result = await svc.getAll(req.query as any)
    res.json({ success: true, ...result })
  } catch (err) { next(err) }
})

priceSnapshotsRouter.get("/latest", async (req, res, next) => {
  try {
    const data = await svc.getLatestPrices(req.query as any)
    res.json({ success: true, data })
  } catch (err) { next(err) }
})

priceSnapshotsRouter.get("/history", async (req, res, next) => {
  try {
    const { product_id, company_id, days } = req.query as any
    if (!product_id || !company_id) {
      return next(createError("product_id and company_id are required", 400, "VALIDATION"))
    }
    const data = await svc.getPriceHistory(parseInt(product_id), parseInt(company_id), parseInt(days) || 30)
    res.json({ success: true, data })
  } catch (err) { next(err) }
})

priceSnapshotsRouter.delete("/:id", async (req, res, next) => {
  try {
    const data = await svc.remove(parseInt(req.params.id))
    if (!data) return next(createError("Snapshot not found", 404, "NOT_FOUND"))
    res.json({ success: true })
  } catch (err) { next(err) }
})
