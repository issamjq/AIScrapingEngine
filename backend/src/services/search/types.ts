// ─────────────────────────────────────────────────────────────────────────────
// Shared types for the product search pipeline
// ─────────────────────────────────────────────────────────────────────────────

export type ProductCategory =
  | "vehicles"
  | "electronics"
  | "furniture"
  | "appliances"
  | "fashion"
  | "general"

export type SourceType = "marketplace" | "retail" | "ecommerce"

export type CandidateType = "detail_candidate" | "list_candidate" | "reject_candidate"

export type RejectionReason =
  | "not_product_page"
  | "list_page_only"
  | "category_page"
  | "search_results_page"
  | "article_page"
  | "duplicate"
  | "low_match"
  | "missing_price_or_image"

// ── Intent: what the user is looking for ─────────────────────────────────────

export interface ProductIntent {
  product_type: string
  category:     ProductCategory
  brand:        string | null
  model:        string | null
  attributes:   string[]
  price_range:  { min: number | null; max: number | null; currency?: string }
  condition:    "new" | "used" | "any"
  location:     string | null   // human-readable e.g. "Lebanon"
  country:      string | null   // ISO-2 e.g. "LB"
  keywords:     string[]
}

// ── Source definition ─────────────────────────────────────────────────────────

export interface Source {
  id:             string
  name:           string
  domain:         string       // e.g. "olx.com.lb"
  country:        string       // ISO-2
  categories:     ProductCategory[]
  type:           SourceType
  priority:       Partial<Record<ProductCategory | "general", number>>
  searchUrl:      (query: string) => string
  detailPatterns: RegExp[]     // URL patterns that indicate a product detail page
  listPatterns:   RegExp[]     // URL patterns that indicate a list/category/search page
}

// ── Source plan ───────────────────────────────────────────────────────────────

export interface SourcePlanEntry {
  source:   Source
  target:   number   // how many results to aim for from this source
  fallback: boolean  // true = only used if primary sources don't have enough results
}

// ── Candidate URL discovered from a search page ───────────────────────────────

export interface Candidate {
  url:        string
  title:      string
  sourceId:   string
  sourceName: string
  type:       CandidateType
}

// ── Final search result ───────────────────────────────────────────────────────

export interface SearchResult {
  title:          string
  price:          number | null
  original_price: number | null
  currency:       string
  image:          string | null
  condition:      string
  location:       string | null
  seller:         string
  availability:   string
  url:            string
  source:         string
  sourceId:       string
  details:        string | null
  score:          number
}

// ── Pipeline response ─────────────────────────────────────────────────────────

export interface SearchResponse {
  query:   string
  intent:  ProductIntent
  results: SearchResult[]
  cached:  boolean
}
