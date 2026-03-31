export async function pLimit<T>(
  items: T[],
  concurrency: number,
  taskFn: (item: T) => Promise<any>
): Promise<any[]> {
  const results: any[] = new Array(items.length)
  let index = 0

  async function worker() {
    while (index < items.length) {
      const current = index++
      try {
        results[current] = await taskFn(items[current])
      } catch (err: any) {
        results[current] = { error: err.message }
      }
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, items.length) }, worker)
  await Promise.all(workers)
  return results
}

export function slugify(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
}

export function toInt(val: any, fallback = 0): number {
  const n = parseInt(val, 10)
  return isNaN(n) ? fallback : n
}

export function parsePagination(query: Record<string, any>) {
  const page   = Math.max(1, toInt(query.page, 1))
  const limit  = Math.min(200, Math.max(1, toInt(query.limit, 50)))
  const offset = (page - 1) * limit
  return { page, limit, offset }
}
