#!/usr/bin/env node
/**
 * End-to-end smoke test for the Claude freeform handicapper UI.
 *
 * What it covers:
 *  1. Authenticates against the deployed dashboard with AUTH_PASSWORD
 *  2. Calls /api/claude_pick_freeform via the Next.js proxy (NOT direct
 *     to Fly) — proves the proxy route + auth + Fly backend all wire up
 *  3. Asserts the response shape matches what the React UI consumes
 *  4. Asserts the pre-rendered /claude HTML contains the expected
 *     freeform-mode UI markers ("Freeform", "From Slate (game_id)",
 *     "Type any matchup")
 *
 * Run from sports-dashboard root:
 *   AUTH_PASSWORD=<password> node scripts/smoke-claude-freeform.mjs
 *
 * Or after `vercel env pull .env.vercel.tmp --environment production`:
 *   AUTH_PASSWORD=$(grep AUTH_PASSWORD .env.vercel.tmp | cut -d= -f2) \
 *     node scripts/smoke-claude-freeform.mjs
 *
 * Exits non-zero on any failure so it can be wired into CI.
 */

const BASE = process.env.SMOKE_BASE_URL || "https://sports-dashboard-ten.vercel.app";
const PASSWORD = process.env.AUTH_PASSWORD;
if (!PASSWORD) {
  console.error("AUTH_PASSWORD env var required");
  process.exit(2);
}

// Disable cert revocation check on Windows curl-equivalent — Vercel certs
// are valid but Node's built-in fetch sometimes flags revocation timeouts.
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

let cookieJar = "";
function captureCookies(res) {
  const setCookie = res.headers.getSetCookie?.() || [];
  for (const c of setCookie) {
    const head = c.split(";")[0];
    cookieJar = cookieJar ? cookieJar + "; " + head : head;
  }
}

function fail(msg) {
  console.error(`✗ FAIL: ${msg}`);
  process.exit(1);
}
function ok(msg) {
  console.log(`✓ ${msg}`);
}

async function step1_csrf() {
  const r = await fetch(`${BASE}/api/auth/csrf`, { redirect: "manual" });
  captureCookies(r);
  if (!r.ok) fail(`csrf fetch ${r.status}`);
  const { csrfToken } = await r.json();
  if (!csrfToken) fail("no csrfToken in response");
  ok(`got csrf token (${csrfToken.length} chars)`);
  return csrfToken;
}

async function step2_login(csrfToken) {
  const r = await fetch(`${BASE}/api/auth/callback/credentials`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Cookie: cookieJar,
    },
    body: new URLSearchParams({
      csrfToken,
      password: PASSWORD,
      json: "true",
      redirect: "false",
    }),
    redirect: "manual",
  });
  captureCookies(r);
  if (r.status >= 400) fail(`login ${r.status}`);
  // next-auth credentials returns either 200 with {url:"..."} or a 302
  if (!cookieJar.includes("next-auth.session-token") &&
      !cookieJar.includes("__Secure-next-auth.session-token")) {
    fail(`no session-token cookie after login (jar: ${cookieJar.slice(0, 200)})`);
  }
  ok(`authenticated; session-token captured`);
}

async function step3_freeform_post() {
  const body = {
    sport: "mlb",
    away_team: "NYY",
    home_team: "BOS",
    market: "ml",
    odds: -110,
    effort: "low",
  };
  // Retry once on 502/503 — Fly.io redeploy windows are typically <30s
  // and surface as a 502 from the Next.js proxy. A successful smoke
  // post-redeploy is what we want to verify, not the deploy gap itself.
  let r;
  for (let attempt = 1; attempt <= 2; attempt++) {
    r = await fetch(`${BASE}/api/claude_pick_freeform`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookieJar },
      body: JSON.stringify(body),
    });
    if (r.ok || (r.status !== 502 && r.status !== 503)) break;
    if (attempt === 1) {
      console.log(`  retry: got ${r.status}, waiting 20s for backend...`);
      await new Promise((res) => setTimeout(res, 20_000));
    }
  }
  if (!r.ok) {
    const text = await r.text().catch(() => "");
    fail(`freeform proxy ${r.status}: ${text.slice(0, 300)}`);
  }
  const json = await r.json();
  // Required fields the React UI consumes:
  for (const key of [
    "pick_id", "is_freeform", "matched_existing_game", "freeform_away",
    "freeform_home", "bet_side", "confidence", "estimated_edge_pct",
    "reasoning", "key_factors", "risk_flags", "model", "prompt_version",
  ]) {
    if (!(key in json)) fail(`response missing key '${key}'`);
  }
  if (json.is_freeform !== true) fail(`is_freeform should be true, got ${json.is_freeform}`);
  if (!Array.isArray(json.key_factors)) fail("key_factors should be array");
  if (!Array.isArray(json.risk_flags)) fail("risk_flags should be array");
  ok(`freeform endpoint returned valid pick (id=${json.pick_id}, ${json.bet_side}/${json.confidence}, edge=${json.estimated_edge_pct.toFixed(2)}%)`);
  return json;
}

async function step4_get_claude_html() {
  const r = await fetch(`${BASE}/claude`, {
    headers: { Cookie: cookieJar },
    redirect: "manual",
  });
  if (r.status === 307 || r.status === 302) {
    fail(`/claude redirected (${r.status}) — auth cookie didn't stick to /claude`);
  }
  if (!r.ok) fail(`/claude ${r.status}`);
  const html = await r.text();
  // Markers inserted by the new freeform-mode page
  for (const marker of ["Freeform", "From Slate", "Type any matchup"]) {
    if (!html.includes(marker)) fail(`/claude HTML missing marker: '${marker}'`);
  }
  ok(`/claude HTML contains all freeform UI markers`);
}

async function step5_validation_400s() {
  // The proxy should reject missing required fields with 400, not bubble
  // up a 500 from the backend. Validates the React form's contract.
  const r = await fetch(`${BASE}/api/claude_pick_freeform`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookieJar },
    body: JSON.stringify({ sport: "mlb" }),  // missing home/away/market
  });
  if (r.status !== 400) {
    const text = await r.text().catch(() => "");
    fail(`bad-input expected 400, got ${r.status}: ${text.slice(0, 200)}`);
  }
  ok(`proxy validates required fields (400 on missing input)`);
}

(async () => {
  console.log(`Smoke test against ${BASE}`);
  const csrf = await step1_csrf();
  await step2_login(csrf);
  await step3_freeform_post();
  await step4_get_claude_html();
  await step5_validation_400s();
  console.log("\nALL CHECKS PASSED");
})().catch((e) => {
  console.error("Unexpected error:", e);
  process.exit(1);
});
