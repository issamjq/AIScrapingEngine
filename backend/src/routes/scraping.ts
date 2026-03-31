import { Router } from "express"
import { PrismaClient } from "@prisma/client"
import { requireAuth, AuthRequest } from "../middleware/auth"

const router = Router()
const prisma = new PrismaClient()

/** GET /api/scraping/jobs — list scraping jobs for the user */
router.get("/jobs", requireAuth, async (req: AuthRequest, res) => {
  try {
    const dbUser = await prisma.user.findUnique({ where: { firebaseUid: req.uid! } })
    if (!dbUser) return res.status(404).json({ error: "User not found" })

    const jobs = await prisma.scrapingJob.findMany({
      where: { userId: dbUser.id },
      orderBy: { createdAt: "desc" },
      take: 50,
    })
    res.json({ jobs })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: "Failed to fetch jobs" })
  }
})

/** POST /api/scraping/jobs — create a new scraping job */
router.post("/jobs", requireAuth, async (req: AuthRequest, res) => {
  const { url, options } = req.body
  if (!url) return res.status(400).json({ error: "URL is required" })

  try {
    const dbUser = await prisma.user.findUnique({ where: { firebaseUid: req.uid! } })
    if (!dbUser) return res.status(404).json({ error: "User not found" })

    const job = await prisma.scrapingJob.create({
      data: {
        userId: dbUser.id,
        url,
        status: "pending",
        options: options ?? {},
      },
    })

    // TODO: enqueue actual scraping task here
    res.status(201).json({ job })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: "Failed to create job" })
  }
})

/** GET /api/scraping/jobs/:id */
router.get("/jobs/:id", requireAuth, async (req: AuthRequest, res) => {
  try {
    const dbUser = await prisma.user.findUnique({ where: { firebaseUid: req.uid! } })
    if (!dbUser) return res.status(404).json({ error: "User not found" })

    const job = await prisma.scrapingJob.findFirst({
      where: { id: req.params.id, userId: dbUser.id },
    })
    if (!job) return res.status(404).json({ error: "Job not found" })
    res.json({ job })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: "Failed to fetch job" })
  }
})

export { router as scrapingRouter }
