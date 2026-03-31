import { Router } from "express"
import { PrismaClient } from "@prisma/client"
import { requireAuth, AuthRequest } from "../middleware/auth"

const router = Router()
const prisma = new PrismaClient()

/** GET /api/users/profile */
router.get("/profile", requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { firebaseUid: req.uid! },
      include: {
        integrations: true,
        _count: { select: { posts: true, campaigns: true, contentItems: true } },
      },
    })
    if (!user) return res.status(404).json({ error: "User not found" })
    res.json({ user })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: "Failed to fetch profile" })
  }
})

/** PATCH /api/users/profile */
router.patch("/profile", requireAuth, async (req: AuthRequest, res) => {
  const { name, avatar } = req.body
  try {
    const user = await prisma.user.update({
      where: { firebaseUid: req.uid! },
      data: { name, avatar },
    })
    res.json({ user })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: "Failed to update profile" })
  }
})

/** GET /api/users/usage */
router.get("/usage", requireAuth, async (req: AuthRequest, res) => {
  try {
    const dbUser = await prisma.user.findUnique({ where: { firebaseUid: req.uid! } })
    if (!dbUser) return res.status(404).json({ error: "User not found" })

    const usage = await prisma.aIUsage.groupBy({
      by: ["type"],
      where: { userId: dbUser.id },
      _sum: { credits: true },
    })
    res.json({ usage })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: "Failed to fetch usage" })
  }
})

export { router as usersRouter }
