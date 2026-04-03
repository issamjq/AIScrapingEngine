// ─────────────────────────────────────────────────────────────────────────────
// Stage 3 + 4 — Source Routing & Plan Generation
//
// Routing rules (highest priority first):
//   vehicles in LB  → olx_lb → autobeeb_lb → opensooq_lb  [fallback: dubizzle_ae]
//   electronics in LB → ayoub_lb → pcandparts_lb → khoury_lb [fallback: amazon_ae → noon_ae → sharafdg_ae]
//   furniture in LB  → olx_lb → opensooq_lb  [fallback: dubizzle_ae]
//   vehicles in AE   → dubizzle_ae  [no LB sources]
//   electronics in AE → amazon_ae → noon_ae → sharafdg_ae
//   generic / unknown → country-first sorting by priority
//
// Fallback sources are only scraped if primary sources return fewer than
// MIN_RESULTS_BEFORE_FALLBACK results.
// ─────────────────────────────────────────────────────────────────────────────

import { ProductIntent, Source, SourcePlanEntry, ProductCategory } from "./types"
import { loadSources } from "./sourceService"

const MAX_PER_SOURCE          = 5   // hard cap per source (enforced in ranker)
const PRIMARY_TARGET_PER_SRC  = 5
const FALLBACK_TARGET_PER_SRC = 5
const MIN_RESULTS_BEFORE_FALLBACK = 3  // skip fallbacks if primaries already found this many

// Explicit routing tables — override generic priority sorting for key combinations
type RoutingTable = { primary: string[]; fallback: string[] }

const ROUTING: Partial<Record<ProductCategory, Partial<Record<string, RoutingTable>>>> = {
  vehicles: {
    LB: {
      primary:  ["olx_lb", "autobeeb_lb", "opensooq_lb"],
      fallback: ["dubizzle_ae"],
    },
    AE: {
      primary:  ["dubizzle_ae"],
      fallback: [],
    },
  },
  electronics: {
    LB: {
      primary:  ["ayoub_lb", "pcandparts_lb", "khoury_lb"],
      fallback: ["amazon_ae", "noon_ae", "sharafdg_ae"],
    },
    AE: {
      primary:  ["amazon_ae", "noon_ae", "sharafdg_ae"],
      fallback: [],
    },
  },
  appliances: {
    LB: {
      primary:  ["khoury_lb"],
      fallback: ["amazon_ae", "noon_ae"],
    },
    AE: {
      primary:  ["amazon_ae", "noon_ae"],
      fallback: [],
    },
  },
  furniture: {
    LB: {
      primary:  ["olx_lb", "opensooq_lb"],
      fallback: ["dubizzle_ae"],
    },
    AE: {
      primary:  ["dubizzle_ae"],
      fallback: [],
    },
  },
  fashion: {
    LB: {
      primary:  ["olx_lb"],
      fallback: ["amazon_ae", "noon_ae"],
    },
    AE: {
      primary:  ["amazon_ae", "noon_ae"],
      fallback: [],
    },
  },
  general: {
    LB: {
      primary:  ["olx_lb", "opensooq_lb"],
      fallback: ["amazon_ae", "dubizzle_ae"],
    },
    AE: {
      primary:  ["amazon_ae", "dubizzle_ae", "noon_ae"],
      fallback: [],
    },
  },
}


function genericSort(sources: Source[], category: ProductCategory): Source[] {
  return [...sources].sort((a, b) => {
    const pa = a.priority[category] ?? a.priority["general"] ?? 0
    const pb = b.priority[category] ?? b.priority["general"] ?? 0
    return pb - pa
  })
}

export async function buildSourcePlan(intent: ProductIntent): Promise<SourcePlanEntry[]> {
  const allSources = await loadSources()
  const { category, country } = intent

  const countryKey = country ?? "AE"

  // Helper: find a loaded source by source_id string
  const byId = (id: string) => allSources.find(s => s.id === id)

  // Try explicit routing table first
  const categoryRouting = ROUTING[category]
  const explicit        = categoryRouting?.[countryKey]
                       ?? categoryRouting?.["AE"]

  let primarySources:  Source[]
  let fallbackSources: Source[]

  if (explicit) {
    primarySources  = explicit.primary.map(byId).filter(Boolean)  as Source[]
    fallbackSources = explicit.fallback.map(byId).filter(Boolean) as Source[]
  } else {
    // Generic: sort all matching sources by priority, split by country
    const matching   = allSources.filter(s =>
      s.categories.includes(category) || s.categories.includes("general" as ProductCategory)
    )
    const inCountry  = genericSort(matching.filter(s => s.country === countryKey), category)
    const outCountry = genericSort(matching.filter(s => s.country !== countryKey), category)
    primarySources   = inCountry.slice(0, 4)
    fallbackSources  = outCountry.slice(0, 3)
  }

  return [
    ...primarySources.map(source  => ({ source, target: PRIMARY_TARGET_PER_SRC,  fallback: false })),
    ...fallbackSources.map(source => ({ source, target: FALLBACK_TARGET_PER_SRC, fallback: true  })),
  ]
}

export { MIN_RESULTS_BEFORE_FALLBACK, MAX_PER_SOURCE }
