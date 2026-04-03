// Re-exports the modular search pipeline.
// The route (backend/src/routes/search.ts) imports from here — do not rename.
export type { SearchResult, SearchResponse } from "./search/types"
export { productSearch } from "./search/pipeline"
