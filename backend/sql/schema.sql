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

-- Subscription / usage limit columns (added v1.0.21)
-- subscription: 'trial' | 'free' | 'paid'
-- Roles: 001=Dev, 002=Owner (unlimited), 010=B2B, 020=B2C
ALTER TABLE allowed_users ADD COLUMN IF NOT EXISTS subscription        VARCHAR(20)  NOT NULL DEFAULT 'free';
ALTER TABLE allowed_users ADD COLUMN IF NOT EXISTS trial_ends_at       TIMESTAMPTZ;
ALTER TABLE allowed_users ADD COLUMN IF NOT EXISTS daily_searches_used INTEGER      NOT NULL DEFAULT 0;
ALTER TABLE allowed_users ADD COLUMN IF NOT EXISTS last_reset_at       TIMESTAMPTZ;

-- Multi-tenant: per-user data isolation (added v1.0.30)
-- products.user_email  — owner of the product; only that user sees/edits it
-- companies.user_email — NULL = global seed retailer (visible to all); email = user-created store
-- internal_sku uniqueness is now scoped per user (drop old global unique constraint)
ALTER TABLE products  ADD COLUMN IF NOT EXISTS user_email VARCHAR(255);
ALTER TABLE companies ADD COLUMN IF NOT EXISTS user_email VARCHAR(255);

ALTER TABLE products DROP CONSTRAINT IF EXISTS products_internal_sku_key;
CREATE UNIQUE INDEX IF NOT EXISTS idx_products_sku_user
  ON products(internal_sku, user_email)
  WHERE internal_sku IS NOT NULL AND user_email IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_products_user_email  ON products(user_email);
CREATE INDEX IF NOT EXISTS idx_companies_user_email ON companies(user_email);

-- companies.slug uniqueness is per-user (not global) so each user can have amazon-ae, noon, etc.
ALTER TABLE companies DROP CONSTRAINT IF EXISTS companies_slug_key;
CREATE UNIQUE INDEX IF NOT EXISTS idx_companies_slug_user ON companies(slug, user_email) WHERE user_email IS NOT NULL;

-- Trial abuse prevention columns (added v1.0.28)
-- firebase_uid: unique Google account identifier — prevents same Google account re-registering
-- signup_ip:    IP at time of signup — blocks multiple trial accounts from same IP
ALTER TABLE allowed_users ADD COLUMN IF NOT EXISTS firebase_uid VARCHAR(128);
ALTER TABLE allowed_users ADD COLUMN IF NOT EXISTS signup_ip    VARCHAR(45);

CREATE UNIQUE INDEX IF NOT EXISTS idx_allowed_users_firebase_uid ON allowed_users(firebase_uid) WHERE firebase_uid IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_allowed_users_email     ON allowed_users(email);
CREATE INDEX IF NOT EXISTS idx_allowed_users_is_active ON allowed_users(is_active);
CREATE INDEX IF NOT EXISTS idx_allowed_users_signup_ip ON allowed_users(signup_ip);

CREATE OR REPLACE TRIGGER set_allowed_users_updated_at
  BEFORE UPDATE ON allowed_users
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- Cleanup: drop legacy tables from old social media platform (v1.0.31)
DROP TABLE IF EXISTS ai_usage      CASCADE;
DROP TABLE IF EXISTS campaigns     CASCADE;
DROP TABLE IF EXISTS content_items CASCADE;
DROP TABLE IF EXISTS integrations  CASCADE;
DROP TABLE IF EXISTS posts         CASCADE;
DROP TABLE IF EXISTS scraping_jobs CASCADE;
DROP TABLE IF EXISTS users         CASCADE;
ALTER TABLE allowed_users DROP COLUMN IF EXISTS tier;

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

-- =============================================================
-- TABLE: plans
-- All plan definitions served from DB — frontend never hardcodes plans.
-- =============================================================
CREATE TABLE IF NOT EXISTS plans (
  id            SERIAL PRIMARY KEY,
  key           VARCHAR(50)  NOT NULL UNIQUE,   -- 'trial' | 'free' | 'pro' | 'enterprise'
  name          VARCHAR(100) NOT NULL,
  tagline       TEXT,
  price_usd_b2b  NUMERIC(10,2) NOT NULL DEFAULT 0,  -- B2B price in USD
  price_usd_b2c  NUMERIC(10,2) NOT NULL DEFAULT 0,  -- B2C price in USD
  price_note_b2b VARCHAR(100),                       -- 'forever' | 'per month' | etc.
  price_note_b2c VARCHAR(100),
  trial_days_b2b INTEGER,                        -- null = not applicable
  trial_days_b2c INTEGER,
  credits_b2b   INTEGER,                         -- credits granted on this plan for b2b
  credits_b2c   INTEGER,                         -- credits granted on this plan for b2c
  features_b2b  JSONB NOT NULL DEFAULT '[]',     -- [{text, included}]
  features_b2c  JSONB NOT NULL DEFAULT '[]',
  is_active     BOOLEAN NOT NULL DEFAULT true,
  is_coming_soon BOOLEAN NOT NULL DEFAULT false,
  sort_order    INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE TRIGGER set_plans_updated_at
  BEFORE UPDATE ON plans
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- =============================================================
-- TABLE: user_wallet
-- One row per user — tracks credit balance.
-- =============================================================
CREATE TABLE IF NOT EXISTS user_wallet (
  id            SERIAL PRIMARY KEY,
  user_email    VARCHAR(255) NOT NULL UNIQUE REFERENCES allowed_users(email) ON DELETE CASCADE,
  balance       INTEGER NOT NULL DEFAULT 0,  -- current credits available
  total_added   INTEGER NOT NULL DEFAULT 0,  -- lifetime credits added
  total_used    INTEGER NOT NULL DEFAULT 0,  -- lifetime credits spent
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_wallet_email ON user_wallet(user_email);

CREATE OR REPLACE TRIGGER set_user_wallet_updated_at
  BEFORE UPDATE ON user_wallet
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- =============================================================
-- TABLE: wallet_transactions
-- Immutable log of every credit change.
-- =============================================================
CREATE TABLE IF NOT EXISTS wallet_transactions (
  id            SERIAL PRIMARY KEY,
  user_email    VARCHAR(255) NOT NULL REFERENCES allowed_users(email) ON DELETE CASCADE,
  amount        INTEGER NOT NULL,             -- positive = credit, negative = debit
  balance_after INTEGER NOT NULL,
  type          VARCHAR(50) NOT NULL,         -- 'signup_bonus' | 'usage' | 'purchase' | 'adjustment'
  description   TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wallet_tx_email      ON wallet_transactions(user_email);
CREATE INDEX IF NOT EXISTS idx_wallet_tx_created_at ON wallet_transactions(created_at DESC);

-- =============================================================
-- TABLE: currency_rates
-- Exchange rates used for price display (USD base).
-- =============================================================
CREATE TABLE IF NOT EXISTS currency_rates (
  id            SERIAL PRIMARY KEY,
  from_currency VARCHAR(10) NOT NULL,
  to_currency   VARCHAR(10) NOT NULL,
  rate          NUMERIC(12,6) NOT NULL,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(from_currency, to_currency)
);

INSERT INTO currency_rates (from_currency, to_currency, rate)
VALUES ('USD', 'AED', 3.65)
ON CONFLICT (from_currency, to_currency) DO UPDATE SET rate = EXCLUDED.rate, updated_at = NOW();

-- =============================================================
-- SEED: Plans
-- =============================================================
INSERT INTO plans (key, name, tagline, price_usd_b2b, price_usd_b2c, price_note, trial_days_b2b, trial_days_b2c, credits_b2b, credits_b2c, features_b2b, features_b2c, is_active, is_coming_soon, sort_order)
VALUES
  (
    'trial', 'Trial', 'Full access, no restrictions', 0, 0, NULL, 14, 7, 20, 30,
    '[{"text":"20 credits included","included":true},{"text":"All results unlocked — no blur","included":true},{"text":"Search web + your product catalog","included":true},{"text":"Auto-match results to your products","included":true},{"text":"Live price tracking across retailers","included":true},{"text":"Export data (CSV)","included":true},{"text":"Priority Support","included":false}]',
    '[{"text":"30 credits included","included":true},{"text":"All results unlocked — no blur","included":true},{"text":"Search any product across the web","included":true},{"text":"Auto-match results to best price","included":true},{"text":"Live price tracking across stores","included":true},{"text":"Price drop alerts","included":true},{"text":"Priority Support","included":false}]',
    true, false, 1
  ),
  (
    'free', 'Free', 'Basic access, forever free', 0, 0, 'forever', NULL, NULL, 10, 15,
    '[{"text":"10 credits per month","included":true},{"text":"3 results shown (rest blurred)","included":true},{"text":"Search web + your product catalog","included":true},{"text":"Auto-match results to your products","included":true},{"text":"Live price tracking across retailers","included":true},{"text":"All results unlocked","included":false},{"text":"Export data (CSV)","included":false},{"text":"Priority Support","included":false}]',
    '[{"text":"15 credits per month","included":true},{"text":"3 results shown (rest blurred)","included":true},{"text":"Search any product across the web","included":true},{"text":"Auto-match results to best price","included":true},{"text":"Live price tracking across stores","included":true},{"text":"All results unlocked","included":false},{"text":"Price drop alerts","included":false},{"text":"Priority Support","included":false}]',
    true, false, 2
  ),
  (
    'pro', 'Pro', 'For professionals & growing teams', 20, 20, 'per month', NULL, NULL, 50, 150,
    '[{"text":"50 credits per month","included":true},{"text":"All results unlocked — no blur","included":true},{"text":"Search web + your product catalog","included":true},{"text":"Auto-match results to your products","included":true},{"text":"Live price tracking across retailers","included":true},{"text":"Export data (CSV)","included":true},{"text":"Price drop alerts","included":true},{"text":"Priority Support","included":true}]',
    '[{"text":"150 credits per month","included":true},{"text":"All results unlocked — no blur","included":true},{"text":"Search any product across the web","included":true},{"text":"Auto-match results to best price","included":true},{"text":"Live price tracking across stores","included":true},{"text":"Price drop alerts","included":true},{"text":"Priority Support","included":true},{"text":"Export data (CSV)","included":false}]',
    true, true, 3
  ),
  (
    'enterprise', 'Enterprise', 'Custom solutions for large teams', 0, 0, 'contact us', NULL, NULL, NULL, NULL,
    '[{"text":"Unlimited credits","included":true},{"text":"All results unlocked — no blur","included":true},{"text":"Search web + your product catalog","included":true},{"text":"Auto-match results to your products","included":true},{"text":"Live price tracking across retailers","included":true},{"text":"Export data (CSV)","included":true},{"text":"Price drop alerts","included":true},{"text":"Dedicated Account Manager","included":true},{"text":"Custom Integrations","included":true},{"text":"Priority Support","included":true}]',
    '[{"text":"Unlimited credits","included":true},{"text":"All results unlocked — no blur","included":true},{"text":"Search any product across the web","included":true},{"text":"Auto-match results to best price","included":true},{"text":"Live price tracking across stores","included":true},{"text":"Price drop alerts","included":true},{"text":"Dedicated Account Manager","included":true},{"text":"Custom Integrations","included":true},{"text":"Priority Support","included":true}]',
    true, true, 4
  )
ON CONFLICT (key) DO NOTHING;

-- =============================================================
-- B2C Search History
-- =============================================================
CREATE TABLE IF NOT EXISTS b2c_search_history (
  id           BIGSERIAL PRIMARY KEY,
  user_email   TEXT        NOT NULL,
  query        TEXT        NOT NULL,
  country_hint TEXT        NOT NULL DEFAULT '',
  results      JSONB       NOT NULL DEFAULT '[]',
  result_count INTEGER     NOT NULL DEFAULT 0,
  searched_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_b2c_history_user_email ON b2c_search_history (user_email, searched_at DESC);
