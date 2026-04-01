import { Router } from "express"
import * as svc from "../services/productCompanyUrlService"
import { requireBody, validateId, createError } from "../middleware/validate"
import { AuthRequest } from "../middleware/auth"

export const productCompanyUrlsRouter = Router()

productCompanyUrlsRouter.get("/", async (req, res, next) => {
  try {
    const email  = (req as AuthRequest).email!
    const result = await svc.getAll(req.query as any, email)
    res.json({ success: true, ...result })
  } catch (err) { next(err) }
})

productCompanyUrlsRouter.post("/", requireBody(["product_id", "company_id", "product_url"]), async (req, res, next) => {
  try {
    const data = await svc.create(req.body)
    res.status(201).json({ success: true, data })
  } catch (err: any) {
    if (err.code === "23505") return next(createError("URL already mapped for this product+company", 409, "DUPLICATE"))
    next(err)
  }
})

productCompanyUrlsRouter.get("/:id", validateId, async (req, res, next) => {
  try {
    const data = await svc.getById(Number(req.params.id))
    if (!data) return next(createError("URL record not found", 404, "NOT_FOUND"))
    res.json({ success: true, data })
  } catch (err) { next(err) }
})

productCompanyUrlsRouter.put("/:id", validateId, async (req, res, next) => {
  try {
    const data = await svc.update(Number(req.params.id), req.body)
    if (!data) return next(createError("URL record not found", 404, "NOT_FOUND"))
    res.json({ success: true, data })
  } catch (err) { next(err) }
})

productCompanyUrlsRouter.delete("/:id", validateId, async (req, res, next) => {
  try {
    const ok = await svc.remove(Number(req.params.id))
    if (!ok) return next(createError("URL record not found", 404, "NOT_FOUND"))
    res.json({ success: true, message: "URL record deleted" })
  } catch (err) { next(err) }
})
