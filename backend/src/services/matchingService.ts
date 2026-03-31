function normalize(str: string): string {
  if (!str) return ""
  return str
    .toLowerCase()
    .replace(/(\d+(?:\.\d+)?)\s*(ml|mL|ML|g|kg|oz)\b/g, (_, n, unit) => `${n}${unit.toLowerCase()}`)
    .replace(/[,.'!?:;]/g, "")
    .replace(/\s+/g, " ")
    .trim()
}

function extractSize(str: string): string | null {
  const norm  = normalize(str)
  const match = norm.match(/\d+(?:\.\d+)?\s*(?:ml|g|kg|oz)\b/)
  if (!match) return null
  return match[0].replace(/\s+/g, "")
}

function tokenScore(a: string, b: string): number {
  const tokensA = new Set(normalize(a).split(" ").filter(Boolean))
  const tokensB = new Set(normalize(b).split(" ").filter(Boolean))
  if (tokensA.size === 0 && tokensB.size === 0) return 1
  if (tokensA.size === 0 || tokensB.size === 0) return 0
  let intersection = 0
  for (const t of tokensA) { if (tokensB.has(t)) intersection++ }
  const union = tokensA.size + tokensB.size - intersection
  return union === 0 ? 0 : intersection / union
}

export function fuzzyMatch(
  candidateName: string,
  catalog: Array<{ id: number; internal_name: string }>
): { product: any; confidence: number } | null {
  const candidateSize = extractSize(candidateName)
  let best: any = null, bestScore = 0

  for (const product of catalog) {
    let score = tokenScore(candidateName, product.internal_name)
    if (candidateSize !== null) {
      const productSize = extractSize(product.internal_name)
      if (productSize !== null && productSize !== candidateSize) {
        score = Math.min(score, 0.55)
      }
    }
    if (score > bestScore) { bestScore = score; best = product }
  }

  if (bestScore >= 0.45 && best) return { product: best, confidence: bestScore }
  return null
}
