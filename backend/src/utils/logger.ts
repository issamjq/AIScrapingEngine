type Level = "error" | "warn" | "info" | "debug"

const levels: Record<Level, number> = { error: 0, warn: 1, info: 2, debug: 3 }
const currentLevel: Level = (process.env.LOG_LEVEL as Level) ||
  (process.env.NODE_ENV === "production" ? "info" : "debug")

function log(level: Level, message: string, meta: Record<string, any> = {}) {
  if (levels[level] > levels[currentLevel]) return
  const entry = {
    ts:      new Date().toISOString(),
    level,
    message,
    ...(Object.keys(meta).length ? { meta } : {}),
  }
  const output = JSON.stringify(entry)
  if (level === "error") console.error(output)
  else console.log(output)
}

export const logger = {
  error: (msg: string, meta?: Record<string, any>) => log("error", msg, meta),
  warn:  (msg: string, meta?: Record<string, any>) => log("warn",  msg, meta),
  info:  (msg: string, meta?: Record<string, any>) => log("info",  msg, meta),
  debug: (msg: string, meta?: Record<string, any>) => log("debug", msg, meta),
}
