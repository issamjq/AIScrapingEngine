-- =============================================================
-- AI Scraping Engine — RSP Tables Schema
-- Run this on your Neon database to add the price-monitoring tables.
-- Safe to re-run (uses IF NOT EXISTS / CREATE OR REPLACE).
-- =============================================================

-- Auto-update updated_at trigger function
CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =============================================================
-- TABLE: companies
-- =============================================================
CREATE TABLE IF NOT EXISTS companies (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(255) NOT NULL,
  slug        VARCHAR(100) NOT NULL UNIQUE,
  base_url    VARCHAR(500),
  logo_url    VARCHAR(500),
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_companies_slug      ON companies(slug);
CREATE INDEX IF NOT EXISTS idx_companies_is_active ON companies(is_active);

CREATE OR REPLACE TRIGGER set_companies_updated_at
  BEFORE UPDATE ON companies
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- =============================================================
-- TABLE: products
-- =============================================================
CREATE TABLE IF NOT EXISTS products (
  id            SERIAL PRIMARY KEY,
  internal_name VARCHAR(255) NOT NULL,
  internal_sku  VARCHAR(100) UNIQUE,
  barcode       VARCHAR(100),
  brand         VARCHAR(100),
  category      VARCHAR(100),
  image_url     VARCHAR(500),
  initial_rsp   NUMERIC(10,2),
  notes         TEXT,
  is_active     BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE products ADD COLUMN IF NOT EXISTS initial_rsp NUMERIC(10,2);

CREATE INDEX IF NOT EXISTS idx_products_sku       ON products(internal_sku);
CREATE INDEX IF NOT EXISTS idx_products_barcode   ON products(barcode);
CREATE INDEX IF NOT EXISTS idx_products_brand     ON products(brand);
CREATE INDEX IF NOT EXISTS idx_products_category  ON products(category);
CREATE INDEX IF NOT EXISTS idx_products_is_active ON products(is_active);

CREATE OR REPLACE TRIGGER set_products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- =============================================================
-- TABLE: company_configs
-- =============================================================
CREATE TABLE IF NOT EXISTS company_configs (
  id                     SERIAL PRIMARY KEY,
  company_id             INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  price_selectors        JSONB NOT NULL DEFAULT '[]',
  title_selectors        JSONB NOT NULL DEFAULT '[]',
  availability_selectors JSONB NOT NULL DEFAULT '[]',
  wait_for_selector      VARCHAR(500),
  page_options           JSONB NOT NULL DEFAULT '{}',
  notes                  TEXT,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_company_configs_company UNIQUE (company_id)
);

CREATE INDEX IF NOT EXISTS idx_company_configs_company_id ON company_configs(company_id);

CREATE OR REPLACE TRIGGER set_company_configs_updated_at
  BEFORE UPDATE ON company_configs
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- =============================================================
-- TABLE: product_company_urls
-- =============================================================
CREATE TABLE IF NOT EXISTS product_company_urls (
  id                     SERIAL PRIMARY KEY,
  product_id             INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  company_id             INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  product_url            TEXT NOT NULL,
  external_title         VARCHAR(500),
  external_sku           VARCHAR(100),
  external_barcode       VARCHAR(100),
  selector_price         TEXT,
  selector_title         TEXT,
  selector_availability  TEXT,
  price_selectors        JSONB,
  title_selectors        JSONB,
  availability_selectors JSONB,
  currency               VARCHAR(10) NOT NULL DEFAULT 'AED',
  is_active              BOOLEAN NOT NULL DEFAULT true,
  last_status            VARCHAR(50),
  last_checked_at        TIMESTAMPTZ,
  image_url              VARCHAR(500),
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_product_company UNIQUE (product_id, company_id)
);

CREATE INDEX IF NOT EXISTS idx_pcu_product_id  ON product_company_urls(product_id);
CREATE INDEX IF NOT EXISTS idx_pcu_company_id  ON product_company_urls(company_id);
CREATE INDEX IF NOT EXISTS idx_pcu_is_active   ON product_company_urls(is_active);
CREATE INDEX IF NOT EXISTS idx_pcu_last_status ON product_company_urls(last_status);

CREATE OR REPLACE TRIGGER set_pcu_updated_at
  BEFORE UPDATE ON product_company_urls
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- =============================================================
-- TABLE: price_snapshots
-- =============================================================
CREATE TABLE IF NOT EXISTS price_snapshots (
  id                     SERIAL PRIMARY KEY,
  product_id             INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  company_id             INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  product_company_url_id INTEGER REFERENCES product_company_urls(id) ON DELETE SET NULL,
  title_found            VARCHAR(500),
  price                  NUMERIC(12, 2),
  original_price         NUMERIC(12, 2),
  currency               VARCHAR(10) DEFAULT 'AED',
  availability           VARCHAR(100),
  raw_price_text         TEXT,
  raw_availability_text  TEXT,
  scrape_status          VARCHAR(50) NOT NULL DEFAULT 'success',
  error_message          TEXT,
  checked_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_snapshots_product_id    ON price_snapshots(product_id);
CREATE INDEX IF NOT EXISTS idx_snapshots_company_id    ON price_snapshots(company_id);
CREATE INDEX IF NOT EXISTS idx_snapshots_pcu_id        ON price_snapshots(product_company_url_id);
CREATE INDEX IF NOT EXISTS idx_snapshots_checked_at    ON price_snapshots(checked_at DESC);
CREATE INDEX IF NOT EXISTS idx_snapshots_scrape_status ON price_snapshots(scrape_status);
CREATE INDEX IF NOT EXISTS idx_snapshots_product_company_checked
  ON price_snapshots(product_id, company_id, checked_at DESC);

-- =============================================================
-- TABLE: sync_runs
-- =============================================================
CREATE TABLE IF NOT EXISTS sync_runs (
  id            SERIAL PRIMARY KEY,
  company_id    INTEGER REFERENCES companies(id) ON DELETE SET NULL,
  run_type      VARCHAR(50) NOT NULL,
  status        VARCHAR(50) NOT NULL DEFAULT 'running',
  triggered_by  VARCHAR(100) DEFAULT 'manual',
  started_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at   TIMESTAMPTZ,
  total_checked INTEGER NOT NULL DEFAULT 0,
  success_count INTEGER NOT NULL DEFAULT 0,
  fail_count    INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  meta          JSONB NOT NULL DEFAULT '{}',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sync_runs_company_id ON sync_runs(company_id);
CREATE INDEX IF NOT EXISTS idx_sync_runs_status     ON sync_runs(status);
CREATE INDEX IF NOT EXISTS idx_sync_runs_started_at ON sync_runs(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_sync_runs_run_type   ON sync_runs(run_type);

-- =============================================================
-- TABLE: allowed_users
-- Controls who can access the application after Google sign-in.
-- Roles: 001=Dev, 003=SuperAdmin, 004=Admin, 008=User
-- =============================================================
CREATE TABLE IF NOT EXISTS allowed_users (
  id         SERIAL PRIMARY KEY,
  email      VARCHAR(255) NOT NULL UNIQUE,
  name       VARCHAR(255),
  role       VARCHAR(10) NOT NULL DEFAULT '008',
  is_active  BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_allowed_users_email     ON allowed_users(email);
CREATE INDEX IF NOT EXISTS idx_allowed_users_is_active ON allowed_users(is_active);

CREATE OR REPLACE TRIGGER set_allowed_users_updated_at
  BEFORE UPDATE ON allowed_users
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- =============================================================
-- SEED: Default UAE retailers
-- Safe to re-run (ON CONFLICT DO NOTHING)
-- =============================================================
INSERT INTO companies (name, slug, base_url, is_active) VALUES
  ('Amazon AE',     'amazon-ae',     'https://www.amazon.ae',        true),
  ('Noon',          'noon',          'https://www.noon.com',         true),
  ('Noon Minutes',  'noon-minutes',  'https://www.noonminutes.com',  true),
  ('Carrefour UAE', 'carrefour-uae', 'https://www.carrefouruae.com', true),
  ('Talabat',       'talabat',       'https://www.talabat.com',      true),
  ('Spinneys',      'spinneys',      'https://www.spinneys.com',     true),
  ('Dubizzle',      'dubizzle',      'https://www.dubizzle.com',     true),
  ('OLX Lebanon',   'olx-lb',        'https://www.olx.com.lb',       true)
ON CONFLICT (slug) DO NOTHING;
