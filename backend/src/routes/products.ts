import { Router } from "express"
import * as svc from "../services/productService"
import { requireBody, validateId, createError } from "../middleware/validate"
import { AuthRequest } from "../middleware/auth"

export const productsRouter = Router()

productsRouter.get("/", async (req, res, next) => {
  try {
    const email  = (req as AuthRequest).email!
    const result = await svc.getAll(req.query as any, email)
    res.json({ success: true, ...result })
  } catch (err) { next(err) }
})

productsRouter.post("/import", async (req, res, next) => {
  try {
    const email = (req as AuthRequest).email!
    const { products } = req.body
    if (!Array.isArray(products) || products.length === 0) {
      return next(createError("products array required", 400, "VALIDATION"))
    }
    const data = await svc.bulkImport(products, email)
    res.json({ success: true, data })
  } catch (err) { next(err) }
})

productsRouter.post("/", requireBody(["internal_name"]), async (req, res, next) => {
  try {
    const email = (req as AuthRequest).email!
    const data  = await svc.create(req.body, email)
    res.status(201).json({ success: true, data })
  } catch (err: any) {
    if (err.code === "23505") return next(createError("SKU already exists", 409, "DUPLICATE"))
    next(err)
  }
})

productsRouter.get("/:id", validateId, async (req, res, next) => {
  try {
    const data = await svc.getById(Number(req.params.id))
    if (!data) return next(createError("Product not found", 404, "NOT_FOUND"))
    res.json({ success: true, data })
  } catch (err) { next(err) }
})

productsRouter.put("/:id", validateId, async (req, res, next) => {
  try {
    const email = (req as AuthRequest).email!
    const data  = await svc.update(Number(req.params.id), req.body, email)
    if (!data) return next(createError("Product not found", 404, "NOT_FOUND"))
    res.json({ success: true, data })
  } catch (err) { next(err) }
})

productsRouter.delete("/:id", validateId, async (req, res, next) => {
  try {
    const email = (req as AuthRequest).email!
    const ok    = await svc.remove(Number(req.params.id), email)
    if (!ok) return next(createError("Product not found", 404, "NOT_FOUND"))
    res.json({ success: true, message: "Product deleted" })
  } catch (err) { next(err) }
})
