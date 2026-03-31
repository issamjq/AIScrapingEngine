import { Router } from "express"
import { PrismaClient } from "@prisma/client"
import { requireAuth, AuthRequest } from "../middleware/auth"

const router = Router()
const prisma = new PrismaClient()

/**
 * POST /api/auth/sync
 * Called after Firebase sign-in to create or update the user record in Neon.
 */
router.post("/sync", requireAuth, async (req: AuthRequest, res) => {
  const { name, avatar } = req.body

  try {
    const user = await prisma.user.upsert({
      where: { firebaseUid: req.uid! },
      update: {
        name: name ?? undefined,
        avatar: avatar ?? undefined,
        email: req.email!,
      },
      create: {
        firebaseUid: req.uid!,
        email: req.email!,
        name: name ?? null,
        avatar: avatar ?? null,
      },
    })

    res.json({ user })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: "Failed to sync user" })
  }
})

/**
 * GET /api/auth/me
 * Returns the current authenticated user.
 */
router.get("/me", requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { firebaseUid: req.uid! },
    })

    if (!user) return res.status(404).json({ error: "User not found" })
    res.json({ user })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: "Failed to fetch user" })
  }
})

export { router as authRouter }
