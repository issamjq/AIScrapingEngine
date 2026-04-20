/**
 * Quick snapshot test — opens AliExpress Super Deals, scrolls, saves screenshot.
 * Run: npx tsx snapshot-test.ts
 * Output: aliexpress-snapshot.jpg in the backend folder
 */

import { chromium } from "playwright"
import * as fs from "fs"
import * as path from "path"

const URL = "https://www.aliexpress.com/ssr/300002660/Deals-HomePage?disableNav=YES&pha_manifest=ssr&_immersiveMode=true"

;(async () => {
  console.log("Launching browser...")
  const browser = await chromium.launch({ headless: false }) // headless: false so you can watch
  const context = await browser.newContext({
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    locale:    "en-US",
    viewport:  { width: 1440, height: 900 },
    extraHTTPHeaders: { "Accept-Language": "en-US,en;q=0.9" },
  })
  await context.addCookies([
    { name: "aep_usuc_f", value: "site=glo&c_tp=USD&region=US&b_locale=en_US", domain: ".aliexpress.com", path: "/" },
    { name: "xman_us_f",  value: "x_locale=en_US&acs_rt=",                     domain: ".aliexpress.com", path: "/" },
  ])

  const page = await context.newPage()
  console.log("Navigating to Super Deals page...")
  await page.goto(URL, { waitUntil: "domcontentloaded", timeout: 40_000 })
  await page.waitForTimeout(4000)

  console.log("Scrolling to load all products...")
  for (let i = 0; i < 8; i++) {
    await page.evaluate(() => window.scrollBy(0, 1200))
    await page.waitForTimeout(600)
  }
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.waitForTimeout(2000)

  // Save full-page snapshot
  const snapPath = path.join(__dirname, "aliexpress-snapshot.jpg")
  const screenshot = await page.screenshot({ type: "jpeg", quality: 85, fullPage: false })
  fs.writeFileSync(snapPath, screenshot)
  console.log(`\n✅ Snapshot saved: ${snapPath}`)
  console.log(`   Size: ${(screenshot.length / 1024).toFixed(1)} KB`)

  // Also save viewport-only snapshot
  const vpPath = path.join(__dirname, "aliexpress-viewport.jpg")
  const vpShot = await page.screenshot({ type: "jpeg", quality: 85, fullPage: false })
  fs.writeFileSync(vpPath, vpShot)
  console.log(`✅ Viewport saved: ${vpPath}`)

  await browser.close()
  console.log("\nDone. Open the .jpg files to see what Playwright captured.")
})()
