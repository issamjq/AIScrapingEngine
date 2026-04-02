import { Router } from "express"
import { query } from "../db"

export const currencyRatesRouter = Router()

// GET /api/currency-rates — returns all exchange rates (USD base)
currencyRatesRouter.get("/", async (_req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT from_currency, to_currency, rate, updated_at FROM currency_rates ORDER BY to_currency`
    )
    res.json({ success: true, data: rows })
  } catch (err) { next(err) }
})
