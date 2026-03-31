import { Router } from "express"
import * as svc from "../services/syncService"
import { validateId, createError } from "../middleware/validate"

export const syncRunsRouter = Router()

syncRunsRouter.get("/", async (req, res, next) => {
  try {
    const data = await svc.getAll(req.query as any)
    res.json({ success: true, data })
  } catch (err) { next(err) }
})

syncRunsRouter.get("/:id", validateId, async (req, res, next) => {
  try {
    const data = await svc.getById(Number(req.params.id))
    if (!data) return next(createError("Sync run not found", 404, "NOT_FOUND"))
    res.json({ success: true, data })
  } catch (err) { next(err) }
})
