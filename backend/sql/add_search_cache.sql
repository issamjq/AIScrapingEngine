-- Run this once in the Neon SQL editor to enable product search caching
-- Table: search_cache
-- TTL: 6 hours (enforced in application code via WHERE created_at > NOW() - INTERVAL '6 hours')

CREATE TABLE IF NOT EXISTS search_cache (
  cache_key   TEXT PRIMARY KEY,               -- SHA-256 of normalized query
  query_text  TEXT        NOT NULL,           -- original query for debugging
  results     JSONB       NOT NULL,           -- SearchResult[] JSON array
  hit_count   INT         NOT NULL DEFAULT 1, -- how many times this cache entry was read
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_search_cache_created ON search_cache (created_at);
