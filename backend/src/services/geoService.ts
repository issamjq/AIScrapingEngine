/**
 * geoService — resolve IPs → { country, countryCode, city } using ip-api.com.
 * - Free tier: 45 req/min per IP. Uses batch endpoint (up to 100 IPs per call).
 * - In-process cache so repeated lookups don't hit the API.
 * - Never throws — on any failure returns null and the caller moves on.
 */

import { logger } from "../utils/logger"

export interface GeoResult {
  country:     string | null
  countryCode: string | null
  city:        string | null
}

const cache = new Map<string, GeoResult>()

function isPrivateOrLocal(ip: string): boolean {
  if (!ip) return true
  if (ip === "127.0.0.1" || ip === "::1" || ip === "unknown") return true
  if (ip.startsWith("10.") || ip.startsWith("192.168.")) return true
  if (ip.startsWith("172.")) {
    const second = parseInt(ip.split(".")[1] ?? "0", 10)
    if (second >= 16 && second <= 31) return true
  }
  if (ip.startsWith("::ffff:")) return isPrivateOrLocal(ip.replace("::ffff:", ""))
  return false
}

/** Resolve a single IP to country/city. Cached in-process. */
export async function lookupIp(ip: string | null | undefined): Promise<GeoResult | null> {
  if (!ip || isPrivateOrLocal(ip)) return null
  if (cache.has(ip)) return cache.get(ip)!

  try {
    const r = await fetch(
      `http://ip-api.com/json/${ip}?fields=status,country,countryCode,city`,
      { signal: AbortSignal.timeout(3500) },
    )
    const j: any = await r.json()
    if (j?.status !== "success") {
      cache.set(ip, { country: null, countryCode: null, city: null })
      return null
    }
    const result: GeoResult = {
      country:     j.country     ?? null,
      countryCode: j.countryCode ?? null,
      city:        j.city        ?? null,
    }
    cache.set(ip, result)
    return result
  } catch (err: any) {
    logger.warn("[GeoService] lookup failed", { ip, error: err.message })
    return null
  }
}

/** Resolve many IPs at once. Uses ip-api.com /batch endpoint (100 max per call). */
export async function lookupBatch(ips: string[]): Promise<Map<string, GeoResult>> {
  const out = new Map<string, GeoResult>()
  const toFetch: string[] = []

  for (const ip of ips) {
    if (!ip || isPrivateOrLocal(ip)) continue
    if (cache.has(ip)) { out.set(ip, cache.get(ip)!); continue }
    if (!toFetch.includes(ip)) toFetch.push(ip)
  }

  // Batch in chunks of 100
  for (let i = 0; i < toFetch.length; i += 100) {
    const chunk = toFetch.slice(i, i + 100)
    try {
      const r = await fetch(
        "http://ip-api.com/batch?fields=status,query,country,countryCode,city",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify(chunk),
          signal:  AbortSignal.timeout(6000),
        },
      )
      const arr: any[] = await r.json()
      for (const row of arr) {
        const ip = row?.query
        if (!ip) continue
        if (row.status !== "success") {
          const empty = { country: null, countryCode: null, city: null }
          cache.set(ip, empty)
          out.set(ip, empty)
          continue
        }
        const res: GeoResult = {
          country:     row.country     ?? null,
          countryCode: row.countryCode ?? null,
          city:        row.city        ?? null,
        }
        cache.set(ip, res)
        out.set(ip, res)
      }
    } catch (err: any) {
      logger.warn("[GeoService] batch lookup failed", { size: chunk.length, error: err.message })
    }
  }

  return out
}
