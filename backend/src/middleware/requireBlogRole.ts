/**
 * requireBlogRole — gate blog admin routes by blog_role.
 *
 * Hierarchy (least → most privileged):
 *   none    → can only read published posts (handled by public routes; this
 *             middleware rejects them outright)
 *   author  → may create posts and edit / delete their OWN posts
 *   editor  → may edit and delete ANY post
 *   owner / dev (account role) → implicit editor; bypass all checks
 *
 * Usage:
 *   router.post   ("/", requireBlogRole("author"), handler)   // create
 *   router.patch  ("/:id", requireBlogRole("author"), handler)// owner check inside handler
 *   router.delete ("/:id", requireBlogRole("editor"), handler)// editor only
 */

import { Response, NextFunction } from "express"
import { AuthRequest } from "./auth"
import { query } from "../db"

export type BlogLevel = "author" | "editor"

const ACCOUNT_ROLES_WITH_FULL_ACCESS = new Set(["owner", "dev"])

export function requireBlogRole(min: BlogLevel) {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const email = req.email
      if (!email) return res.status(401).json({ success: false, error: { message: "Unauthenticated" } })

      const { rows } = await query(
        `SELECT role, blog_role FROM allowed_users WHERE email = $1 LIMIT 1`,
        [email],
      )
      const u = rows[0]
      if (!u) return res.status(403).json({ success: false, error: { message: "Forbidden" } })

      // Account-level dev/owner always pass
      if (ACCOUNT_ROLES_WITH_FULL_ACCESS.has(u.role)) {
        ;(req as any).blogRole = "editor"
        return next()
      }

      const r = (u.blog_role ?? "none") as "none" | "author" | "editor"

      if (min === "author") {
        if (r === "author" || r === "editor") {
          ;(req as any).blogRole = r
          return next()
        }
      } else if (min === "editor") {
        if (r === "editor") {
          ;(req as any).blogRole = r
          return next()
        }
      }

      return res.status(403).json({
        success: false,
        error: { message: "You don't have permission for this blog action.", code: "BLOG_FORBIDDEN" },
      })
    } catch (err) { next(err) }
  }
}

/** Helper for handlers that need to know the caller's effective blog role. */
export function getBlogRole(req: AuthRequest): "author" | "editor" {
  return ((req as any).blogRole ?? "author") as "author" | "editor"
}
