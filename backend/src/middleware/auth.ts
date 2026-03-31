import { Request, Response, NextFunction } from "express"
import admin from "firebase-admin"

// Initialize Firebase Admin (once)
// Supports FIREBASE_SERVICE_ACCOUNT (full JSON string) or individual vars
if (!admin.apps.length) {
  let credential: admin.credential.Credential

  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
    credential = admin.credential.cert(serviceAccount)
  } else {
    credential = admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    })
  }

  admin.initializeApp({ credential })
}

export interface AuthRequest extends Request {
  uid?: string
  email?: string
}

/**
 * Verifies the Firebase ID token from the Authorization header.
 * Enforces Gmail-only: rejects tokens from non-@gmail.com accounts.
 */
export async function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing or invalid Authorization header" })
  }

  const token = authHeader.split("Bearer ")[1]
  try {
    const decoded = await admin.auth().verifyIdToken(token)

    if (!decoded.email?.endsWith("@gmail.com")) {
      return res.status(403).json({ error: "Only Gmail accounts are allowed" })
    }

    req.uid = decoded.uid
    req.email = decoded.email
    next()
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" })
  }
}
