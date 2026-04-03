// ─────────────────────────────────────────────────────────────────────────────
// Source registry — all searchable marketplaces / retailers
//
// searchUrl:      builds the search URL for a given query string
// detailPatterns: URL regex that confirms a page is a single product listing
// listPatterns:   URL regex that confirms a page is a list/search/category page
// ─────────────────────────────────────────────────────────────────────────────

import { Source } from "./types"

export const SOURCES: Source[] = [

  // ── Lebanon ─────────────────────────────────────────────────────────────────

  {
    id:         "olx_lb",
    name:       "OLX Lebanon",
    domain:     "olx.com.lb",
    country:    "LB",
    categories: ["vehicles", "electronics", "furniture", "general"],
    type:       "marketplace",
    priority:   { vehicles: 10, furniture: 8, electronics: 7, general: 9 },
    searchUrl:  (q) => `https://www.olx.com.lb/en/results/?q=${encodeURIComponent(q)}`,
    detailPatterns: [/\/en\/item\//i, /\/ad\//i],
    listPatterns:   [/\/results\//i, /\/en\/ads\//i, /\/category\//i],
  },

  {
    id:         "autobeeb_lb",
    name:       "AutoBeeb Lebanon",
    domain:     "autobeeb.com",
    country:    "LB",
    categories: ["vehicles"],
    type:       "marketplace",
    priority:   { vehicles: 9 },
    searchUrl:  (q) => `https://www.autobeeb.com/search?q=${encodeURIComponent(q)}&country=lb`,
    detailPatterns: [/\/car\/\d+/i, /\/listing\/\d+/i, /\/vehicle\/\d+/i],
    listPatterns:   [/\/search/i, /\/buy-/i, /\/cars-for-sale/i, /\/used-cars/i],
  },

  {
    id:         "opensooq_lb",
    name:       "OpenSooq Lebanon",
    domain:     "lb.opensooq.com",
    country:    "LB",
    categories: ["vehicles", "electronics", "furniture"],
    type:       "marketplace",
    priority:   { vehicles: 8, electronics: 6, furniture: 7, general: 8 },
    searchUrl:  (q) => `https://lb.opensooq.com/en/search?search_text=${encodeURIComponent(q)}`,
    detailPatterns: [/\/post\//i],
    listPatterns:   [/\/search/i, /\/category\//i],
  },

  {
    id:         "ayoub_lb",
    name:       "Ayoub Computers",
    domain:     "ayoub.com.lb",
    country:    "LB",
    categories: ["electronics"],
    type:       "retail",
    priority:   { electronics: 10 },
    searchUrl:  (q) => `https://www.ayoub.com.lb/catalogsearch/result/?q=${encodeURIComponent(q)}`,
    detailPatterns: [/\.html$/i, /\/product\//i],
    listPatterns:   [/\/catalogsearch\//i, /\/category\//i, /\?cat=/i],
  },

  {
    id:         "pcandparts_lb",
    name:       "PC and Parts",
    domain:     "pcandparts.com.lb",
    country:    "LB",
    categories: ["electronics"],
    type:       "retail",
    priority:   { electronics: 9 },
    searchUrl:  (q) => `https://pcandparts.com.lb/catalogsearch/result/?q=${encodeURIComponent(q)}`,
    detailPatterns: [/\.html$/i, /\/product\//i],
    listPatterns:   [/\/catalogsearch\//i, /\/category\//i, /\/search/i],
  },

  {
    id:         "khoury_lb",
    name:       "Khoury Home",
    domain:     "khouryhome.com",
    country:    "LB",
    categories: ["electronics", "appliances"],
    type:       "retail",
    priority:   { appliances: 10, electronics: 8 },
    searchUrl:  (q) => `https://www.khouryhome.com/catalogsearch/result/?q=${encodeURIComponent(q)}`,
    detailPatterns: [/\.html$/i, /\/product\//i],
    listPatterns:   [/\/catalogsearch\//i, /\/category\//i],
  },

  // ── UAE ──────────────────────────────────────────────────────────────────────

  {
    id:         "dubizzle_ae",
    name:       "Dubizzle UAE",
    domain:     "dubizzle.com",
    country:    "AE",
    categories: ["vehicles", "general"],
    type:       "marketplace",
    priority:   { vehicles: 10, general: 8 },
    searchUrl:  (q) => `https://uae.dubizzle.com/search/?q=${encodeURIComponent(q)}`,
    detailPatterns: [/\/listing\//i, /\/l\//i],
    listPatterns:   [/\/search\//i, /\/for-sale\//i, /\/category\//i, /\/motors\//i],
  },

  {
    id:         "amazon_ae",
    name:       "Amazon UAE",
    domain:     "amazon.ae",
    country:    "AE",
    categories: ["electronics", "general"],
    type:       "ecommerce",
    priority:   { electronics: 10, general: 7 },
    searchUrl:  (q) => `https://www.amazon.ae/s?k=${encodeURIComponent(q)}`,
    detailPatterns: [/\/dp\//i, /\/gp\/product\//i],
    listPatterns:   [/\/s\?/i, /\/s\//i, /\/b\?/i, /\/b\//i],
  },

  {
    id:         "noon_ae",
    name:       "Noon UAE",
    domain:     "noon.com",
    country:    "AE",
    categories: ["electronics", "general"],
    type:       "ecommerce",
    priority:   { electronics: 9, general: 7 },
    searchUrl:  (q) => `https://www.noon.com/uae-en/search/?q=${encodeURIComponent(q)}`,
    detailPatterns: [/\/p\//i, /\/pdp\//i],
    listPatterns:   [/\/search\//i, /\/c\//i, /\/category\//i],
  },

  {
    id:         "sharafdg_ae",
    name:       "Sharaf DG",
    domain:     "sharafdg.com",
    country:    "AE",
    categories: ["electronics"],
    type:       "retail",
    priority:   { electronics: 9 },
    searchUrl:  (q) => `https://www.sharafdg.com/catalogsearch/result/?q=${encodeURIComponent(q)}`,
    detailPatterns: [/\.html$/i, /\/product\//i],
    listPatterns:   [/\/catalogsearch\//i, /\/category\//i],
  },
]

export function getSourceById(id: string): Source | undefined {
  return SOURCES.find(s => s.id === id)
}
