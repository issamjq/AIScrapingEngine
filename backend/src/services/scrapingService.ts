import { query } from "../db"
import { getConfig } from "../scraper/companyConfigs"
import * as snapshotService from "./snapshotService"
import * as pcuService from "./productCompanyUrlService"
import { ScraperEngine } from "../scraper/engine"
import { logger } from "../utils/logger"

async function resolveSelectors(urlRecord: any) {
  const { company_slug } = urlRecord

  const priceList = urlRecord.price_selectors || (urlRecord.selector_price ? [urlRecord.selector_price] : null)
  const titleList = urlRecord.title_selectors  || (urlRecord.selector_title ? [urlRecord.selector_title] : null)
  const availList = urlRecord.availability_selectors || (urlRecord.selector_availability ? [urlRecord.selector_availability] : null)

  let dbConfig: any = null
  if (!priceList || !titleList || !availList) {
    const { rows } = await query(
      `SELECT cc.*
       FROM   company_configs cc
       JOIN   companies c ON c.id = cc.company_id
       WHERE  c.slug = $1`,
      [company_slug]
    )
    dbConfig = rows[0] || null
  }

  const fallback = getConfig(company_slug)

  return {
    price:          priceList || dbConfig?.price_selectors || fallback.priceSelectors,
    title:          titleList || dbConfig?.title_selectors || fallback.titleSelectors,
    availability:   availList || dbConfig?.availability_selectors || fallback.availabilitySelectors,
    waitFor:        dbConfig?.wait_for_selector || fallback.waitForSelector || null,
    pageOptions:    dbConfig?.page_options     || fallback.pageOptions     || {},
    blockResources: fallback.blockResources    || ["image", "font", "media"],
    currency:       urlRecord.currency         || fallback.currency        || "AED",
    preferSelectors: fallback.preferSelectors  || false,
  }
}

export async function scrapeAndSave(urlRecord: any, engine: ScraperEngine) {
  const selectors = await resolveSelectors(urlRecord)

  logger.info("[ScrapeService] Scraping", { id: urlRecord.id, url: urlRecord.product_url })

  const result = await engine.scrape(
    urlRecord.product_url,
    selectors,
    {
      timeout:        parseInt(process.env.SCRAPER_TIMEOUT_MS || "30000") || 30000,
      currency:       selectors.currency,
      pageOptions:    selectors.pageOptions,
      blockResources: selectors.blockResources,
    }
  )

  const snapshot = await snapshotService.create({
    product_id:             urlRecord.product_id,
    company_id:             urlRecord.company_id,
    product_company_url_id: urlRecord.id,
    title_found:            result.title,
    price:                  result.price,
    original_price:         result.originalPrice,
    currency:               result.currency,
    availability:           result.availability,
    raw_price_text:         result.rawPriceText,
    raw_availability_text:  result.rawAvailabilityText,
    scrape_status:          result.scrapeStatus,
    error_message:          result.errorMessage,
    checked_at:             new Date(),
  })

  await pcuService.update(urlRecord.id, {
    last_status:     result.scrapeStatus,
    last_checked_at: new Date(),
    ...(result.title    && !urlRecord.external_title ? { external_title: result.title    } : {}),
    ...(result.imageUrl ? { image_url: result.imageUrl } : {}),
  })

  return { snapshot, scrapeResult: result }
}
