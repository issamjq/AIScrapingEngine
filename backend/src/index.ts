import "dotenv/config"
import express from "express"
import cors from "cors"
import helmet from "helmet"
import morgan from "morgan"
import { authRouter } from "./routes/auth"
import { usersRouter } from "./routes/users"
import { scrapingRouter } from "./routes/scraping"
import { contentRouter } from "./routes/content"

const app = express()
const PORT = process.env.PORT ?? 8080

// Middleware
app.use(helmet())
app.use(cors({
  origin: process.env.FRONTEND_URL ?? "http://localhost:3000",
  credentials: true,
}))
app.use(morgan("dev"))
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// Health check
app.get("/health", (_req, res) => {
  res.json({ status: "ok", version: "1.0.1", timestamp: new Date().toISOString() })
})

// Routes
app.use("/api/auth", authRouter)
app.use("/api/users", usersRouter)
app.use("/api/scraping", scrapingRouter)
app.use("/api/content", contentRouter)

// 404
app.use((_req, res) => {
  res.status(404).json({ error: "Not found" })
})

// Global error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err.stack)
  res.status(500).json({ error: "Internal server error" })
})

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`)
})

export default app
