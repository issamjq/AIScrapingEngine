import { Request, Response, NextFunction } from "express"

export function createError(message: string, status = 400, code = "BAD_REQUEST"): Error & { status: number; code: string } {
  const err = new Error(message) as Error & { status: number; code: string }
  err.status = status
  err.code   = code
  return err
}

export function requireBody(fields: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const missing = fields.filter(
      (f) => req.body[f] === undefined || req.body[f] === null || req.body[f] === ""
    )
    if (missing.length) {
      return next(createError(`Missing required fields: ${missing.join(", ")}`, 400, "VALIDATION_ERROR"))
    }
    next()
  }
}

export function validateId(req: Request, res: Response, next: NextFunction) {
  const id = parseInt(req.params.id, 10)
  if (isNaN(id) || id < 1) {
    return next(createError("Invalid ID parameter", 400, "INVALID_ID"))
  }
  ;(req.params as any).id = id
  next()
}
