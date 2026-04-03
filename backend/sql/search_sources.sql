-- ═══════════════════════════════════════════════════════════════════════════
-- search_sources + search_source_configs
-- Powers the B2C product search pipeline.
-- B2C users never see these tables — they are backend-only.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Table: search_sources ────────────────────────────────────────────────────
-- One row per searchable marketplace / retailer site.

CREATE TABLE IF NOT EXISTS search_sources (
  id           SERIAL PRIMARY KEY,
  source_id    VARCHAR(50)  NOT NULL UNIQUE,   -- e.g. "amazon_ae", "olx_lb"
  name         VARCHAR(100) NOT NULL,          -- e.g. "Amazon UAE"
  domain       VARCHAR(100) NOT NULL,          -- e.g. "amazon.ae"
  country      CHAR(2)      NOT NULL,          -- ISO-2: AE, LB, SA …
  categories   JSONB        NOT NULL DEFAULT '[]',  -- ["electronics","general"]
  source_type  VARCHAR(20)  NOT NULL DEFAULT 'marketplace',  -- marketplace|retail|ecommerce
  priority     JSONB        NOT NULL DEFAULT '{}',  -- {"vehicles":10,"general":9}
  is_active    BOOLEAN      NOT NULL DEFAULT true,
  notes        TEXT,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_search_sources_country    ON search_sources(country);
CREATE INDEX IF NOT EXISTS idx_search_sources_is_active  ON search_sources(is_active);
CREATE INDEX IF NOT EXISTS idx_search_sources_source_id  ON search_sources(source_id);

-- ── Table: search_source_configs ─────────────────────────────────────────────
-- One row per source — search URL template + URL classification patterns.

CREATE TABLE IF NOT EXISTS search_source_configs (
  id                  SERIAL PRIMARY KEY,
  source_id           INTEGER NOT NULL REFERENCES search_sources(id) ON DELETE CASCADE,
  search_url_template VARCHAR(500) NOT NULL,   -- e.g. "https://www.amazon.ae/s?k={query}"
  detail_patterns     JSONB NOT NULL DEFAULT '[]',  -- ["\\/dp\\/", "\\/gp\\/product\\/"]
  list_patterns       JSONB NOT NULL DEFAULT '[]',  -- ["\\/s\\?", "\\/b\\?"]
  notes               TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_search_source_configs_source UNIQUE (source_id)
);

CREATE INDEX IF NOT EXISTS idx_search_source_configs_source_id ON search_source_configs(source_id);

-- ═══════════════════════════════════════════════════════════════════════════
-- SEED — UAE sources (primary market)
-- ═══════════════════════════════════════════════════════════════════════════

INSERT INTO search_sources (source_id, name, domain, country, categories, source_type, priority, notes)
VALUES
  -- E-commerce
  ('amazon_ae',   'Amazon UAE',   'amazon.ae',     'AE', '["electronics","general"]',                      'ecommerce',   '{"electronics":10,"general":7}',          'Amazon UAE — broad electronics & general'),
  ('noon_ae',     'Noon UAE',     'noon.com',       'AE', '["electronics","general"]',                      'ecommerce',   '{"electronics":9,"general":7}',           'Noon.com UAE'),
  ('sharafdg_ae', 'Sharaf DG',   'sharafdg.com',   'AE', '["electronics"]',                                'retail',      '{"electronics":9}',                       'Sharaf DG — electronics retail UAE'),
  -- Marketplaces / vehicles
  ('dubizzle_ae', 'Dubizzle UAE', 'dubizzle.com',  'AE', '["vehicles","general"]',                         'marketplace', '{"vehicles":10,"general":8}',             'Dubizzle UAE classifieds'),
  ('yallamotor',  'YallaMotor',   'yallamotor.com','AE', '["vehicles"]',                                   'marketplace', '{"vehicles":9}',                          'YallaMotor — UAE & MENA cars'),
  -- Furniture / general
  ('ikea_ae',     'IKEA UAE',     'ikea.com',      'AE', '["furniture","general"]',                        'retail',      '{"furniture":10}',                        'IKEA UAE'),
  ('noon_fashion','Namshi',       'namshi.com',    'AE', '["fashion"]',                                    'ecommerce',   '{"fashion":10}',                          'Namshi — fashion UAE')
ON CONFLICT (source_id) DO NOTHING;

-- ═══════════════════════════════════════════════════════════════════════════
-- SEED — Lebanon sources (testing + first non-UAE market)
-- ═══════════════════════════════════════════════════════════════════════════

INSERT INTO search_sources (source_id, name, domain, country, categories, source_type, priority, notes)
VALUES
  -- Classifieds / vehicles
  ('olx_lb',       'OLX Lebanon',        'olx.com.lb',        'LB', '["vehicles","electronics","furniture","general"]', 'marketplace', '{"vehicles":10,"furniture":8,"electronics":7,"general":9}', 'OLX Lebanon — largest classifieds'),
  ('autobeeb_lb',  'AutoBeeb Lebanon',   'autobeeb.com',      'LB', '["vehicles"]',                                     'marketplace', '{"vehicles":9}',                                            'AutoBeeb — cars Lebanon'),
  ('opensooq_lb',  'OpenSooq Lebanon',   'lb.opensooq.com',   'LB', '["vehicles","electronics","furniture"]',           'marketplace', '{"vehicles":8,"electronics":6,"furniture":7}',             'OpenSooq Lebanon'),
  -- Electronics retail
  ('ayoub_lb',     'Ayoub Computers',    'ayoub.com.lb',      'LB', '["electronics"]',                                  'retail',      '{"electronics":10}',                                        'Ayoub Computers Beirut'),
  ('pcandparts_lb','PC and Parts',       'pcandparts.com.lb', 'LB', '["electronics"]',                                  'retail',      '{"electronics":9}',                                         'PC and Parts Lebanon'),
  ('khoury_lb',    'Khoury Home',        'khouryhome.com',    'LB', '["electronics","appliances"]',                     'retail',      '{"appliances":10,"electronics":8}',                        'Khoury Home Lebanon')
ON CONFLICT (source_id) DO NOTHING;

-- ═══════════════════════════════════════════════════════════════════════════
-- SEED — Configs (search URL + URL classification patterns)
-- ═══════════════════════════════════════════════════════════════════════════

-- Amazon UAE
INSERT INTO search_source_configs (source_id, search_url_template, detail_patterns, list_patterns, notes)
SELECT id, 'https://www.amazon.ae/s?k={query}',
  '["\\/dp\\/", "\\/gp\\/product\\/"]'::jsonb,
  '["\\/s\\\\?", "\\/s\\/", "\\/b\\\\?"]'::jsonb,
  'Amazon AE — /dp/ = product detail'
FROM search_sources WHERE source_id = 'amazon_ae'
ON CONFLICT (source_id) DO NOTHING;

-- Noon UAE
INSERT INTO search_source_configs (source_id, search_url_template, detail_patterns, list_patterns, notes)
SELECT id, 'https://www.noon.com/uae-en/search/?q={query}',
  '["\\/p\\/", "\\/pdp\\/"]'::jsonb,
  '["\\/search\\/", "\\/c\\/", "\\/category\\/"]'::jsonb,
  'Noon — /p/ = product detail'
FROM search_sources WHERE source_id = 'noon_ae'
ON CONFLICT (source_id) DO NOTHING;

-- Sharaf DG
INSERT INTO search_source_configs (source_id, search_url_template, detail_patterns, list_patterns, notes)
SELECT id, 'https://www.sharafdg.com/catalogsearch/result/?q={query}',
  '["\\.html$", "\\/product\\/"]'::jsonb,
  '["\\/catalogsearch\\/", "\\/category\\/"]'::jsonb,
  'Sharaf DG — Magento, .html = product'
FROM search_sources WHERE source_id = 'sharafdg_ae'
ON CONFLICT (source_id) DO NOTHING;

-- Dubizzle UAE
INSERT INTO search_source_configs (source_id, search_url_template, detail_patterns, list_patterns, notes)
SELECT id, 'https://uae.dubizzle.com/search/?q={query}',
  '["\\/listing\\/", "\\/l\\/"]'::jsonb,
  '["\\/search\\/", "\\/for-sale\\/", "\\/category\\/"]'::jsonb,
  'Dubizzle — /listing/ = single ad'
FROM search_sources WHERE source_id = 'dubizzle_ae'
ON CONFLICT (source_id) DO NOTHING;

-- YallaMotor
INSERT INTO search_source_configs (source_id, search_url_template, detail_patterns, list_patterns, notes)
SELECT id, 'https://www.yallamotor.com/used-cars?q={query}',
  '["\\/used-cars\\/[^/]+\\/[^/]+\\/$", "\\/new-cars\\/[^/]+\\/[^/]+\\/$"]'::jsonb,
  '["\\/used-cars\\?", "\\/new-cars\\?", "\\/search"]'::jsonb,
  'YallaMotor — car model page = detail'
FROM search_sources WHERE source_id = 'yallamotor'
ON CONFLICT (source_id) DO NOTHING;

-- IKEA UAE
INSERT INTO search_source_configs (source_id, search_url_template, detail_patterns, list_patterns, notes)
SELECT id, 'https://www.ikea.com/ae/en/search/?q={query}',
  '["\\/p\\/"]'::jsonb,
  '["\\/search\\/", "\\/cat\\/"]'::jsonb,
  'IKEA — /p/ = product'
FROM search_sources WHERE source_id = 'ikea_ae'
ON CONFLICT (source_id) DO NOTHING;

-- Namshi
INSERT INTO search_source_configs (source_id, search_url_template, detail_patterns, list_patterns, notes)
SELECT id, 'https://www.namshi.com/uae-en/search/?q={query}',
  '["\\/p\\/", "\\/product\\/"]'::jsonb,
  '["\\/search\\/", "\\/catalog\\/"]'::jsonb,
  'Namshi — fashion UAE'
FROM search_sources WHERE source_id = 'noon_fashion'
ON CONFLICT (source_id) DO NOTHING;

-- OLX Lebanon
INSERT INTO search_source_configs (source_id, search_url_template, detail_patterns, list_patterns, notes)
SELECT id, 'https://www.olx.com.lb/en/results/?q={query}',
  '["\\/en\\/item\\/", "\\/ad\\/"]'::jsonb,
  '["\\/results\\/", "\\/en\\/ads\\/", "\\/category\\/"]'::jsonb,
  'OLX LB — /en/item/ = single listing'
FROM search_sources WHERE source_id = 'olx_lb'
ON CONFLICT (source_id) DO NOTHING;

-- AutoBeeb Lebanon
INSERT INTO search_source_configs (source_id, search_url_template, detail_patterns, list_patterns, notes)
SELECT id, 'https://www.autobeeb.com/search?q={query}&country=lb',
  '["\\/car\\/\\d+", "\\/listing\\/\\d+"]'::jsonb,
  '["\\/search", "\\/buy-", "\\/used-cars"]'::jsonb,
  'AutoBeeb — numeric ID in path = car detail'
FROM search_sources WHERE source_id = 'autobeeb_lb'
ON CONFLICT (source_id) DO NOTHING;

-- OpenSooq Lebanon
INSERT INTO search_source_configs (source_id, search_url_template, detail_patterns, list_patterns, notes)
SELECT id, 'https://lb.opensooq.com/en/search?search_text={query}',
  '["\\/post\\/"]'::jsonb,
  '["\\/search", "\\/category\\/"]'::jsonb,
  'OpenSooq — /post/ = single listing'
FROM search_sources WHERE source_id = 'opensooq_lb'
ON CONFLICT (source_id) DO NOTHING;

-- Ayoub Computers
INSERT INTO search_source_configs (source_id, search_url_template, detail_patterns, list_patterns, notes)
SELECT id, 'https://www.ayoub.com.lb/catalogsearch/result/?q={query}',
  '["\\.html$", "\\/product\\/"]'::jsonb,
  '["\\/catalogsearch\\/", "\\/category\\/"]'::jsonb,
  'Ayoub — Magento, .html = product'
FROM search_sources WHERE source_id = 'ayoub_lb'
ON CONFLICT (source_id) DO NOTHING;

-- PC and Parts
INSERT INTO search_source_configs (source_id, search_url_template, detail_patterns, list_patterns, notes)
SELECT id, 'https://pcandparts.com.lb/catalogsearch/result/?q={query}',
  '["\\.html$", "\\/product\\/"]'::jsonb,
  '["\\/catalogsearch\\/", "\\/category\\/", "\\/search"]'::jsonb,
  'PC and Parts Lebanon — Magento'
FROM search_sources WHERE source_id = 'pcandparts_lb'
ON CONFLICT (source_id) DO NOTHING;

-- Khoury Home
INSERT INTO search_source_configs (source_id, search_url_template, detail_patterns, list_patterns, notes)
SELECT id, 'https://www.khouryhome.com/catalogsearch/result/?q={query}',
  '["\\.html$", "\\/product\\/"]'::jsonb,
  '["\\/catalogsearch\\/", "\\/category\\/"]'::jsonb,
  'Khoury Home Lebanon — Magento'
FROM search_sources WHERE source_id = 'khoury_lb'
ON CONFLICT (source_id) DO NOTHING;
