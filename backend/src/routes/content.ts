import { Router } from "express"
import { PrismaClient } from "@prisma/client"
import { requireAuth, AuthRequest } from "../middleware/auth"

const router = Router()
const prisma = new PrismaClient()

/** GET /api/content — list content items */
router.get("/", requireAuth, async (req: AuthRequest, res) => {
  const { type, platform, page = "1", limit = "20" } = req.query
  try {
    const dbUser = await prisma.user.findUnique({ where: { firebaseUid: req.uid! } })
    if (!dbUser) return res.status(404).json({ error: "User not found" })

    const items = await prisma.contentItem.findMany({
      where: {
        userId: dbUser.id,
        ...(type ? { type: String(type) } : {}),
        ...(platform ? { platform: String(platform) } : {}),
      },
      orderBy: { createdAt: "desc" },
      skip: (Number(page) - 1) * Number(limit),
      take: Number(limit),
    })
    res.json({ items })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: "Failed to fetch content" })
  }
})

/** POST /api/content — save a new content item */
router.post("/", requireAuth, async (req: AuthRequest, res) => {
  const { type, title, content, url, aiModel, tags, platform } = req.body
  if (!type || !title) return res.status(400).json({ error: "type and title are required" })

  try {
    const dbUser = await prisma.user.findUnique({ where: { firebaseUid: req.uid! } })
    if (!dbUser) return res.status(404).json({ error: "User not found" })

    const item = await prisma.contentItem.create({
      data: {
        userId: dbUser.id,
        type,
        title,
        content: content ?? null,
        url: url ?? null,
        aiModel: aiModel ?? null,
        tags: tags ?? [],
        platform: platform ?? null,
      },
    })
    res.status(201).json({ item })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: "Failed to create content item" })
  }
})

/** DELETE /api/content/:id */
router.delete("/:id", requireAuth, async (req: AuthRequest, res) => {
  try {
    const dbUser = await prisma.user.findUnique({ where: { firebaseUid: req.uid! } })
    if (!dbUser) return res.status(404).json({ error: "User not found" })

    await prisma.contentItem.deleteMany({
      where: { id: req.params.id, userId: dbUser.id },
    })
    res.json({ success: true })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: "Failed to delete content" })
  }
})

export { router as contentRouter }
