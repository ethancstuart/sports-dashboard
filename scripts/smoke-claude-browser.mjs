#!/usr/bin/env node
/**
 * Real headless-browser smoke test for the /claude freeform handicapper.
 *
 * Beyond what scripts/smoke-claude-freeform.mjs covers (HTTP/proxy), this
 * actually renders the page in Chromium, clicks the toggle, fills the
 * form, submits, and verifies the response renders. Catches React state
 * bugs, hydration issues, broken event handlers, missing form fields,
 * etc — things a curl test can't see.
 *
 * Run from sports-dashboard root:
 *   AUTH_PASSWORD=<password> node scripts/smoke-claude-browser.mjs
 */

import { chromium } from "playwright";

const BASE = process.env.SMOKE_BASE_URL || "https://sports-dashboard-ten.vercel.app";
const PASSWORD = process.env.AUTH_PASSWORD;
if (!PASSWORD) {
  console.error("AUTH_PASSWORD env var required");
  process.exit(2);
}

function fail(msg) {
  console.error(`✗ FAIL: ${msg}`);
  process.exit(1);
}
function ok(msg) {
  console.log(`✓ ${msg}`);
}

(async () => {
  console.log(`Browser smoke against ${BASE}`);
  const browser = await chromium.launch({ headless: true });
  // Vercel's cert is fine — but Node's revocation check is unreliable on Windows
  const context = await browser.newContext({ ignoreHTTPSErrors: true });
  const page = await context.newPage();

  // 1. Land on /claude → middleware redirects to /login
  await page.goto(`${BASE}/claude`, { waitUntil: "networkidle" });
  if (!page.url().includes("/login")) {
    fail(`/claude did not redirect to /login (got ${page.url()})`);
  }
  ok(`unauthenticated /claude redirects to /login`);

  // 2. Submit login form
  await page.fill('input[type="password"]', PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE}/`, { timeout: 15_000 });
  ok(`login submit → home`);

  // 3. Navigate to /claude (now authenticated)
  await page.goto(`${BASE}/claude`, { waitUntil: "networkidle" });
  if (!page.url().endsWith("/claude")) {
    fail(`expected /claude but got ${page.url()}`);
  }
  ok(`authenticated /claude loads`);

  // 4. Verify the freeform mode toggle is visible and is the default
  await page.waitForSelector("text=Freeform", { timeout: 10_000 });
  await page.waitForSelector("text=From Slate", { timeout: 5_000 });
  await page.waitForSelector("text=Type any matchup", { timeout: 5_000 });
  ok(`freeform-mode UI markers render (toggle + header)`);

  // 5. Fill the freeform form
  await page.fill('input[placeholder*="LAL"]', "NYY");
  await page.fill('input[placeholder*="BOS"]', "BOS");
  await page.fill('input[placeholder*="-6.5"]', ""); // line blank for ML
  await page.fill('input[placeholder*="-110 or"]', "-110");
  ok(`form fields fillable`);

  // 6. Click "Get recommendation" — wait for response
  // Set a long timeout because the backend calls Anthropic API
  const responsePromise = page.waitForResponse(
    (r) => r.url().includes("/api/claude_pick_freeform") && r.request().method() === "POST",
    { timeout: 90_000 }
  );
  await page.click('button:has-text("Get recommendation")');
  const response = await responsePromise;
  if (!response.ok()) {
    const body = await response.text().catch(() => "");
    fail(`/api/claude_pick_freeform returned ${response.status()}: ${body.slice(0, 300)}`);
  }
  const pick = await response.json();
  ok(`POST /api/claude_pick_freeform returned 200 (id=${pick.pick_id}, ${pick.bet_side}/${pick.confidence})`);

  // 7. Wait for the result card to render in the DOM
  await page.waitForSelector("text=Reasoning", { timeout: 10_000 });
  await page.waitForSelector("text=Key factors", { timeout: 5_000 });
  ok(`result card renders with Reasoning + Key factors sections`);

  // 8. Verify the bet_side badge matches the API response
  const badge = await page.locator('span:has-text("' + pick.bet_side.toUpperCase() + '")').first().isVisible();
  if (!badge) {
    fail(`bet_side badge "${pick.bet_side.toUpperCase()}" not visible in result`);
  }
  ok(`bet_side badge matches API response`);

  // 9. Toggle to "From Slate" mode and verify the form changes
  await page.click('button:has-text("From Slate")');
  await page.waitForSelector('input[placeholder*="824203"]', { timeout: 5_000 });
  ok(`toggle to slate mode swaps form fields (Game ID input visible)`);

  // 10. Toggle back to Freeform
  await page.click('button:has-text("Freeform")');
  await page.waitForSelector('input[placeholder*="LAL"]', { timeout: 5_000 });
  ok(`toggle back to freeform restores team inputs`);

  await browser.close();
  console.log("\nALL BROWSER CHECKS PASSED");
})().catch((err) => {
  console.error("Browser smoke error:", err.stack || err);
  process.exit(1);
});
