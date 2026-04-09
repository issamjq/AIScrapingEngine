import { Router, Response, NextFunction } from "express"
import { AuthRequest } from "../middleware/auth"
import { getSuggestions } from "../services/suggestionsService"

export const suggestionsRouter = Router()

// GET /api/suggestions?q=iphone
suggestionsRouter.get("/", async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const q = ((req.query.q as string) || "").trim()
    if (!q || q.length < 1) return res.json({ success: true, data: [] })

    const suggestions = await getSuggestions(q, 8)
    res.json({ success: true, data: suggestions })
  } catch (err) { next(err) }
})
