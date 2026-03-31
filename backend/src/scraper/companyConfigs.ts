export interface CompanyConfig {
  priceSelectors:        string[]
  titleSelectors:        string[]
  availabilitySelectors: string[]
  waitForSelector:       string | null
  pageOptions:           Record<string, any>
  currency:              string
  blockResources:        string[]
  preferSelectors?:      boolean
}

const configs: Record<string, CompanyConfig> = {
  "amazon-ae": {
    priceSelectors: [
      ".a-price .a-offscreen",
      ".a-price-whole",
      "#priceblock_ourprice",
      "#priceblock_dealprice",
      "span[data-a-color=\"price\"] .a-offscreen",
      ".apexPriceToPay .a-offscreen",
    ],
    titleSelectors: [
      "#productTitle",
      "h1.product-title-word-break",
      "h1#title span",
    ],
    availabilitySelectors: [
      "#availability span",
      "#availability .a-color-success",
      "#availability .a-color-price",
      "#outOfStock",
    ],
    waitForSelector: "#productTitle",
    pageOptions:     { waitUntil: "domcontentloaded" },
    currency:        "AED",
    blockResources:  ["image", "font", "media"],
  },

  noon: {
    priceSelectors: [
      "[data-qa=\"price-amount\"]",
      "[class*=\"priceNow\"]",
      "[class*=\"sellingPrice\"]",
      "[class*=\"price_\"] span",
      "[data-testid=\"price\"]",
      ".sc-bwzfXH .price",
    ],
    titleSelectors: [
      "h1[data-qa=\"pdp-name\"]",
      "[data-qa=\"pdp-product-name\"]",
      "h1[class*=\"name\"]",
      ".product-title h1",
    ],
    availabilitySelectors: [
      "[data-qa=\"add-to-cart\"]",
      "[class*=\"availability\"]",
      "[class*=\"stock-status\"]",
      "[class*=\"outOfStock\"]",
    ],
    waitForSelector: "h1",
    pageOptions:     { waitUntil: "networkidle" },
    currency:        "AED",
    blockResources:  ["image", "font", "media"],
  },

  "carrefour-uae": {
    priceSelectors:        ["div.items-baseline.force-ltr"],
    titleSelectors:        ["h1 span", "h1"],
    availabilitySelectors: [".text-red-500", ".text-c4red-500"],
    waitForSelector:       "h1",
    pageOptions:           { waitUntil: "load", timeout: 60000 },
    currency:              "AED",
    blockResources:        ["font"],
  },

  spinneys: {
    priceSelectors: [
      "meta[property=\"product:price:amount\"]",
      "[itemprop=\"price\"]",
      ".product-info-main [data-price-type=\"finalPrice\"]",
      ".product-info-main [data-price-amount]",
      ".price-box .price",
      ".regular-price .price",
    ],
    titleSelectors: [
      "h1.page-title span",
      "h1.product-name",
      ".product-info-main h1",
    ],
    availabilitySelectors: [
      "[title*=\"stock\"]",
      ".stock.available span",
      ".stock.unavailable span",
      "[class*=\"availability\"]",
    ],
    waitForSelector: ".wee-price, .price-box .price, [data-price-amount]",
    pageOptions:     { waitUntil: "networkidle" },
    currency:        "AED",
    blockResources:  ["font", "media"],
    preferSelectors: true,
  },

  lulu: {
    priceSelectors: [
      "[data-price-type=\"finalPrice\"] .price",
      ".price-box .price",
      ".regular-price .price",
      ".product-info-price .price",
    ],
    titleSelectors:        ["h1.page-title span", "h1.product-name", ".product-info-main h1"],
    availabilitySelectors: ["[title=\"Availability\"]", ".stock.available span", ".stock.unavailable span"],
    waitForSelector:       "h1",
    pageOptions:           { waitUntil: "domcontentloaded" },
    currency:              "AED",
    blockResources:        ["image", "font", "media"],
  },

  _default: {
    priceSelectors:        ["[class*=\"price\"]", "[id*=\"price\"]", "[data-price]", "[itemprop=\"price\"]", "meta[itemprop=\"price\"]"],
    titleSelectors:        ["h1", "[itemprop=\"name\"]", "[class*=\"product-name\"]", "[class*=\"product-title\"]"],
    availabilitySelectors: ["[itemprop=\"availability\"]", "[class*=\"stock\"]", "[class*=\"availability\"]"],
    waitForSelector:       null,
    pageOptions:           { waitUntil: "domcontentloaded" },
    currency:              "AED",
    blockResources:        ["image", "font", "media"],
  },
}

export function getConfig(slug: string): CompanyConfig {
  return configs[slug] || configs._default
}
