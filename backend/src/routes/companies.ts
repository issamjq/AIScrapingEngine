import { Router } from "express"
import * as svc from "../services/companyService"
import { requireBody, validateId, createError } from "../middleware/validate"

export const companiesRouter = Router()

companiesRouter.get("/", async (req, res, next) => {
  try {
    const data = await svc.getAll({ includeInactive: req.query.include_inactive === "true" })
    res.json({ success: true, data })
  } catch (err) { next(err) }
})

companiesRouter.post("/", requireBody(["name", "slug"]), async (req, res, next) => {
  try {
    const data = await svc.create(req.body)
    res.status(201).json({ success: true, data })
  } catch (err: any) {
    if (err.code === "23505") return next(createError("Company slug already exists", 409, "DUPLICATE"))
    next(err)
  }
})

companiesRouter.get("/:id", validateId, async (req, res, next) => {
  try {
    const data = await svc.getById(Number(req.params.id))
    if (!data) return next(createError("Company not found", 404, "NOT_FOUND"))
    res.json({ success: true, data })
  } catch (err) { next(err) }
})

companiesRouter.put("/:id", validateId, async (req, res, next) => {
  try {
    const data = await svc.update(Number(req.params.id), req.body)
    if (!data) return next(createError("Company not found", 404, "NOT_FOUND"))
    res.json({ success: true, data })
  } catch (err) { next(err) }
})

companiesRouter.delete("/:id", validateId, async (req, res, next) => {
  try {
    const ok = await svc.remove(Number(req.params.id))
    if (!ok) return next(createError("Company not found", 404, "NOT_FOUND"))
    res.json({ success: true, message: "Company deleted" })
  } catch (err) { next(err) }
})

companiesRouter.put("/:id/config", validateId, async (req, res, next) => {
  try {
    const data = await svc.upsertConfig(Number(req.params.id), req.body)
    res.json({ success: true, data })
  } catch (err) { next(err) }
})
