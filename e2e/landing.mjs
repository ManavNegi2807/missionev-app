import { BASE, artifactsDir, launch } from "./browser.mjs";

// Drives the landing page in a real browser: content, links, every mouse effect, the calculator, reduced motion, touch
// devices, themes and layout at several widths.
const OUT = artifactsDir("landing");

const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  — " + detail : ""}`);
};
const errors = [];
const watch = (page) => {
  page.on("console", (m) => m.type() === "error" && !/favicon|DevTools|Failed to load resource/i.test(m.text()) && errors.push(m.text().slice(0, 240)));
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message.slice(0, 240)}`));
};
const text = (page) => page.evaluate(() => document.body.innerText);
const browser = await launch();

/* =============== A. desktop, mouse =============== */
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, permissions: ["clipboard-read", "clipboard-write"] });
const page = await ctx.newPage();
watch(page);
await page.goto(`${BASE}/`, { waitUntil: "networkidle" });

check("home page is the landing page, not a redirect", new URL(page.url()).pathname === "/" && (await page.title()) === "MissionEV · A Strava for carbon", await page.title());
let t = await text(page);
check("headline and promise are on screen", /A Strava\s+for carbon\./.test(t) && /Reward the journey you chose, not the car you own/.test(t));
check("no OTP / phone-sign-in / diagram jargon anywhere on the page", !/\bOTP\b|one-time password|mobile number|Process \d\.\d|\bD[1-4]\b|Data flow|Level [12]\b/i.test(t));
check("a fine pointer is detected (so the mouse effects are live in this test)", await page.evaluate(() => matchMedia("(hover: hover) and (pointer: fine)").matches));

// every in-page link has a target, every external link is safe
const anchors = await page.evaluate(() => [...document.querySelectorAll('a[href^="#"]')].map((a) => a.getAttribute("href")).filter((h) => h.length > 1));
const missing = await page.evaluate((hs) => hs.filter((h) => !document.querySelector(h)), anchors);
check("every #anchor on the page points at a real section", anchors.length >= 5 && missing.length === 0, `${anchors.length} anchors, missing: ${missing.join(",") || "none"}`);
const unsafe = await page.evaluate(() => [...document.querySelectorAll('a[target="_blank"]')].filter((a) => !/noopener/.test(a.rel) || !/noreferrer/.test(a.rel)).map((a) => a.href));
check("every external link opens safely (noopener noreferrer)", unsafe.length === 0, unsafe.join(" | "));
const exts = await page.evaluate(() => [...document.querySelectorAll('a[target="_blank"]')].map((a) => a.href));
check("external links point at the project repo, docs and deploy proof only", exts.length >= 5 && exts.every((h) => /github\.com\/ManavNegi2807\/missionev-app|portalindex-98f0\.onrender\.com/.test(h)), exts.join(" | "));

// --- hero pointer effects ---
const heroVars = () => page.evaluate(() => {
  const el = document.querySelector(".lp-hero");
  const s = el.style;
  const card = document.querySelector("[data-hero-card]");
  return { mx: parseFloat(s.getPropertyValue("--mx")), my: parseFloat(s.getPropertyValue("--my")), px: parseFloat(s.getPropertyValue("--px")), py: parseFloat(s.getPropertyValue("--py")), card: getComputedStyle(card).transform };
});
await page.mouse.move(220, 240, { steps: 14 });
await page.waitForTimeout(900);
const a = await heroVars();
await page.mouse.move(1260, 640, { steps: 14 });
await page.waitForTimeout(900);
const b = await heroVars();
check("moving the mouse moves the cursor spotlight (--mx/--my follow it)", Math.abs(a.mx - 220) < 25 && Math.abs(b.mx - 1260) < 25 && Math.abs(b.my - 640) < 25, `a=${a.mx.toFixed(0)},${a.my.toFixed(0)} b=${b.mx.toFixed(0)},${b.my.toFixed(0)}`);
check("the offset variables swing from left/top to right/bottom", a.px < -0.4 && b.px > 0.4 && b.py > 0.1 && a.py < 0, `px ${a.px.toFixed(2)} -> ${b.px.toFixed(2)}, py ${a.py.toFixed(2)} -> ${b.py.toFixed(2)}`);
check("the trip card tilts differently for the two cursor positions", a.card !== b.card && a.card !== "none" && b.card !== "none", `${a.card.slice(0, 30)}… vs ${b.card.slice(0, 30)}…`);
await page.mouse.move(700, 450, { steps: 6 });
await page.mouse.move(700, 1000, { steps: 4 }); // leaves the hero
await page.waitForTimeout(1100);
const rest = await heroVars();
check("leaving the hero eases the tilt back to rest", Math.abs(rest.px) < 0.05 && Math.abs(rest.py) < 0.05, `px ${rest.px.toFixed(3)} py ${rest.py.toFixed(3)}`);

// floating chips parallax by different amounts, in different directions
const chipShift = async (x, y) => {
  await page.mouse.move(x, y, { steps: 8 });
  await page.waitForTimeout(800);
  return page.evaluate(() => [...document.querySelectorAll(".lp-hero .lp-layer")].map((e) => new DOMMatrix(getComputedStyle(e).transform).m41));
};
await page.evaluate(() => window.scrollTo(0, 0));
const l = await chipShift(200, 300);
const r = await chipShift(1300, 300);
const moved = l.filter((v, i) => Math.abs(v - r[i]) > 4).length;
check("the floating chips and the card parallax at different depths", moved >= 4 && new Set(l.map((v) => v.toFixed(1))).size > 2, `${moved}/${l.length} layers moved`);
const dirs = l.map((v, i) => Math.sign(r[i] - v)).filter(Boolean);
check("some layers drift with the cursor and some against it (real depth)", dirs.includes(1) && dirs.includes(-1), dirs.join(","));

// --- canvas ---
const canvasInfo = () => page.evaluate(() => {
  const c = document.querySelector("[data-network-canvas]");
  const ctx2 = c.getContext("2d");
  const d = ctx2.getImageData(0, 0, c.width, c.height).data;
  let lit = 0;
  for (let i = 3; i < d.length; i += 4 * 7) if (d[i] > 20) lit++;
  return { w: c.width, h: c.height, lit };
});
const c1 = await canvasInfo();
check("the network canvas is drawing and fills the hero", c1.lit > 150 && c1.w >= 1440 && c1.h >= 700, JSON.stringify(c1));
const sample = () => page.evaluate(() => {
  const c = document.querySelector("[data-network-canvas]");
  return c.toDataURL().length + ":" + c.toDataURL().slice(-80);
});
const s1 = await sample();
await page.waitForTimeout(500);
const s2 = await sample();
check("the canvas is animated (frames differ over time)", s1 !== s2);
// pixels near the cursor light up
const nearCursor = async (x, y) =>
  page.evaluate(([cx, cy]) => {
    const c = document.querySelector("[data-network-canvas]");
    const rect = c.getBoundingClientRect();
    const dpr = c.width / rect.width;
    const px = Math.round((cx - rect.left) * dpr), py = Math.round((cy - rect.top) * dpr);
    const R = Math.round(40 * dpr);
    const d = c.getContext("2d").getImageData(Math.max(0, px - R), Math.max(0, py - R), R * 2, R * 2).data;
    let s = 0;
    for (let i = 3; i < d.length; i += 4) s += d[i];
    return s;
  }, [x, y]);
await page.mouse.move(900, 780, { steps: 6 });
await page.waitForTimeout(300);
const calm = await nearCursor(1100, 760);
await page.mouse.move(1100, 760, { steps: 10 });
await page.waitForTimeout(400);
const glow = await nearCursor(1100, 760);
check("the canvas lights up around the cursor (glow + links to nearby nodes)", glow > calm * 1.5, `ink near cursor ${calm} -> ${glow}`);

// --- magnetic CTA ---
await page.evaluate(() => window.scrollTo(0, 0));
const cta = page.locator('.lp-hero a[data-launch]').first();
const box = await cta.boundingBox();
await page.mouse.move(box.x + box.width + 70, box.y + box.height / 2, { steps: 10 });
await page.waitForTimeout(500);
const pulled = await page.evaluate(() => new DOMMatrix(getComputedStyle(document.querySelector(".lp-hero a[data-launch]").parentElement).transform).m41);
await page.mouse.move(box.x + box.width + 600, box.y + 300, { steps: 6 });
await page.waitForTimeout(500);
const released = await page.evaluate(() => new DOMMatrix(getComputedStyle(document.querySelector(".lp-hero a[data-launch]").parentElement).transform).m41);
check("the main button leans a few pixels toward a nearby cursor (capped, so it never overlaps its neighbour) and lets go", pulled > 2 && pulled <= 7 && Math.abs(released) < 1, `pulled ${pulled.toFixed(1)}px, released ${released.toFixed(1)}px`);

// --- glowing cards ---
await page.evaluate(() => document.getElementById("how").scrollIntoView());
await page.waitForTimeout(900);
const card = page.locator("#how .lp-card").nth(1);
const cb = await card.boundingBox();
await page.mouse.move(cb.x + cb.width * 0.25, cb.y + cb.height * 0.6, { steps: 8 });
await page.waitForTimeout(300);
const glowVars = await card.evaluate((e) => ({ cx: parseFloat(e.style.getPropertyValue("--cx")), cy: parseFloat(e.style.getPropertyValue("--cy")), op: getComputedStyle(e, "::after").opacity, lift: getComputedStyle(e).transform }));
check("a hovered card's glow follows the cursor and the card lifts", Math.abs(glowVars.cx - cb.width * 0.25) < 8 && Math.abs(glowVars.cy - cb.height * 0.6) < 8 && Number(glowVars.op) > 0.9 && glowVars.lift !== "none", JSON.stringify(glowVars));

// --- nav: frosted bar, progress, theme ---
const nav = await page.evaluate(() => { const n = document.querySelector(".lp-nav"); return { scrolled: n.dataset.scrolled, sp: parseFloat(n.style.getPropertyValue("--sp")) }; });
check("scrolling frosts the nav bar and advances the progress line", nav.scrolled === "true" && nav.sp > 0.05, JSON.stringify(nav));
const before = await page.evaluate(() => document.documentElement.dataset.theme ?? "light");
await page.getByRole("button", { name: /Switch to (dark|light) theme/ }).click();
const after = await page.evaluate(() => document.documentElement.dataset.theme);
check("the theme toggle switches light and dark", before !== after, `${before} -> ${after}`);
await page.getByRole("button", { name: /Switch to (dark|light) theme/ }).click();

// --- count-up ends on the right numbers ---
await page.evaluate(() => document.getElementById("portal").scrollIntoView());
await page.waitForTimeout(2600);
const stats = await page.evaluate(() => [...document.querySelectorAll("#portal .lp-card p.text-3xl, #portal .lp-card p.sm\\:text-4xl")].map((p) => p.textContent.trim()));
check("the Portal V3 counters finish on 9, 20 MEV, 3× and 100+", ["9", "20 MEV", "3×", "100+"].every((v) => stats.includes(v)), stats.join(" | "));
// copy button
await page.getByRole("button", { name: "Copy contract address" }).click();
const clip = await page.evaluate(() => navigator.clipboard.readText());
check("the copy button puts the contract address on the clipboard", clip === "0x0904244017324dc1bf7c611fe1236936ee65fc82", clip);

// --- calculator ---
await page.evaluate(() => document.getElementById("try").scrollIntoView());
await page.waitForTimeout(900);
const read = async () => {
  await page.waitForTimeout(450);
  return page.evaluate(() => {
    const res = document.querySelector("[data-calc-result]").innerText;
    const grams = Number(res.match(/CO₂ AVOIDED\s*\n?\s*([\d,]+)/i)?.[1].replace(/,/g, ""));
    const mev = Number(res.match(/\$MEV PREVIEW\s*\n?\s*([\d.]+)/i)?.[1]);
    return { res, grams, mev };
  });
};
const metro = await read();
check("calculator starts on a 12 km metro journey with a real reward", metro.grams > 100 && Math.abs(metro.mev - ((metro.grams * 20) / 1000 + 10)) < 0.06, `${metro.grams} g, ${metro.mev} MEV`);
await page.getByRole("radio", { name: /Petrol car/ }).check({ force: true });
const petrol = await read();
check("petrol car: measured, not rewarded, $MEV preview is 0", /Measured, not rewarded/.test(petrol.res) && petrol.mev === 0, `${petrol.mev}`);
await page.getByRole("radio", { name: /Walk or cycle/ }).check({ force: true });
const walk = await read();
check("walking earns the larger bonus and more than metro", walk.mev > metro.mev && walk.grams > metro.grams, `${walk.mev} vs ${metro.mev}`);
await page.getByRole("radio", { name: /Electric car/ }).check({ force: true });
const ev = await read();
check("an electric car is not zero-emission (it saves less than walking)", ev.grams < walk.grams && ev.grams > 0, `${ev.grams} g`);
await page.getByRole("radio", { name: /Metro/ }).check({ force: true });
await page.getByRole("radio", { name: /Day 20/ }).check({ force: true });
const d20 = await read();
check("a 20-day streak triples the base reward (3×) but not the bonus", Math.abs(d20.mev - (((metro.grams * 20) / 1000) * 3 + 10)) < 0.1, `${d20.mev} vs ${(((metro.grams * 20) / 1000) * 3 + 10).toFixed(2)}`);
await page.getByRole("radio", { name: /^Day 1[^0-9]/ }).check({ force: true });
const slider = page.getByRole("slider", { name: /How far|km/i }).or(page.locator('input[type="range"]'));
await slider.focus();
for (let i = 0; i < 10; i++) await page.keyboard.press("ArrowRight");
const far = await read();
check("the slider works from the keyboard and a longer trip avoids more", far.grams > metro.grams && /17 km/.test(far.res + (await page.locator("output").first().innerText())), `${far.grams} g`);
check("calculator figures are whole grams (no stray decimals)", !/\d+\.\d{3}\s*g/.test(far.res), far.res.replace(/\n/g, " ").slice(0, 120));
await page.screenshot({ path: `${OUT}t-calculator.png` });

// --- launch ---
await page.evaluate(() => window.scrollTo(0, 0));
await page.waitForTimeout(300);
const href = await page.locator(".lp-hero a[data-launch]").getAttribute("href");
check("signed out, the main button leads to the sign-in screen", href === "/register" && (await page.locator(".lp-hero a[data-launch]").innerText()).toLowerCase().includes("launch the app"));
await page.locator(".lp-hero a[data-launch]").click();
await page.waitForURL("**/register");
await page.getByRole("button", { name: "Connect MetaMask" }).waitFor();
check("the button lands on the app, where Connect MetaMask is the main action", true);
await page.goBack({ waitUntil: "networkidle" });

// signed in: the same button becomes "Open dashboard"
await page.evaluate(() => sessionStorage.setItem("missionev:d1:registration", JSON.stringify({ userId: "usr_land0001", account: { method: "demo", signedInAt: Date.now() }, transport: null, wallet: { address: "0xde000000000000000000000000000000de0001", chainId: 420420777, mode: "demo" }, isDemoData: true, registeredAt: Date.now() })));
await page.reload({ waitUntil: "networkidle" });
await page.waitForFunction(() => document.querySelector(".lp-hero a[data-launch]")?.dataset.launch === "dashboard");
check("already signed in: the button says Open dashboard and goes to the dashboard", (await page.locator(".lp-hero a[data-launch]").getAttribute("href")) === "/capture-trip" && /open dashboard/i.test(await page.locator(".lp-hero a[data-launch]").innerText()));
await page.evaluate(() => sessionStorage.clear());

// --- keyboard ---
await page.reload({ waitUntil: "networkidle" });
await page.keyboard.press("Tab");
const first = await page.evaluate(() => document.activeElement?.textContent?.trim());
check("the first Tab stop is the skip link", /Skip to content/.test(first ?? ""), first);
check("every control has an accessible name", (await page.evaluate(() => [...document.querySelectorAll("button, a, input")].filter((e) => !(e.getAttribute("aria-label") || e.textContent.trim() || (e.labels && e.labels.length) || e.title)).length)) === 0);

await ctx.close();

/* =============== A2. the live chain panel ("Ask the chain, right now") =============== */
// Every state is fed from a fixture, so it is checked whatever the public RPC is doing; the real endpoint is checked once below.
const LIVE_STATUS = {
  verdict: "live",
  message: "Portal V3 answered just now: the chain is moving and the contract is where the deployment record says it is.",
  checkedAt: Date.now(),
  rpc: "https://test-evm-rpc-v3.portaldot.dev",
  chainId: 420420777,
  expectedChainId: 420420777,
  head: { number: 321552, ageSeconds: 3 },
  contract: {
    address: "0x0904244017324dc1bf7c611fe1236936ee65fc82",
    codeBytes: 5088,
    name: "MissionEV Carbon Reward",
    symbol: "MEV",
    totalSupplyWei: "0",
    oracleSigner: "0x2aD67FaC8dB8fF3255bA650639049020420160De",
    owner: "0x184Ef822438f5D64C9dD41F570af794b347CE84e",
    domainSeparatorOk: true,
    matchesDeploymentRecord: true,
  },
};
async function chainPanel(fixture, { fail = false, width = 1280 } = {}) {
  const c = await browser.newContext({ viewport: { width, height: 900 } });
  const p = await c.newPage();
  watch(p);
  await p.route("**/api/chain", (r) => (fail ? r.fulfill({ status: 500, body: "x" }) : r.fulfill({ json: fixture })));
  await p.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await p.evaluate(() => document.querySelector("[data-live-chain]").scrollIntoView({ block: "center" }));
  await p.waitForFunction(() => document.querySelector("[data-live-chain]").dataset.state !== "loading", null, { timeout: 20000 });
  const panel = p.locator("[data-live-chain]");
  const out = { state: await panel.getAttribute("data-state"), text: await panel.innerText(), overflow: await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth) };
  await c.close();
  return out;
}
{
  const live = await chainPanel(LIVE_STATUS);
  check("chain panel, live: block, chain id, code size, token, oracle, owner and the EIP-712 check are on screen", live.state === "live" && ["#321,552", "420420777", "5,088 bytes", "MissionEV Carbon Reward", "0x2aD6...160De", "0x184E...CE84e", "Matches"].every((s) => live.text.includes(s)), live.text.slice(0, 80).replace(/\n/g, " "));
  check("chain panel is honest that nothing has been minted yet, and that it is read-only and EVM-only", /No journey has been recorded on-chain yet/.test(live.text) && /no wallet, no key, nothing is sent/i.test(live.text) && /EVM layer only/.test(live.text));
  const minted = await chainPanel({ ...LIVE_STATUS, contract: { ...LIVE_STATUS.contract, totalSupplyWei: "10720000000000000000" } });
  check("chain panel shows real minted supply once there is some (10.72 $MEV)", /10\.72/.test(minted.text) && !/No journey has been recorded/.test(minted.text));
  const stale = await chainPanel({ ...LIVE_STATUS, verdict: "stale", message: "The newest block is 2.5 h old, so the endpoint may be lagging and the figures below could be out of date.", head: { number: 265334, ageSeconds: 9000 } });
  check("chain panel, stale: says Lagging and shows how old the block is", stale.state === "stale" && /Lagging/i.test(stale.text) && /2\.5 h/.test(stale.text));
  const down = await chainPanel({ ...LIVE_STATUS, verdict: "unreachable", message: "The Portal V3 RPC did not answer in time. It is the public testnet endpoint, so try again in a moment.", chainId: null, head: null, contract: null });
  check("chain panel, RPC down: says so plainly and shows no made-up figures", down.state === "unreachable" && /did not answer/.test(down.text) && !/Latest block|bytes/.test(down.text));
  const broken = await chainPanel(null, { fail: true });
  check("chain panel, the site's own endpoint failing: shows a plain message and a way to verify by hand", broken.state === "failed" && /Couldn't ask the chain/.test(broken.text) && /contract:verify/.test(broken.text));
  const phone = await chainPanel(LIVE_STATUS, { width: 360 });
  check("chain panel at 360px: no horizontal scroll", phone.overflow <= 0, `overflow ${phone.overflow}`);

  // the real endpoint, once: the shape is checked always; the content only when the public RPC is answering
  const api = await browser.newContext();
  const res = await api.request.get(`${BASE}/api/chain`, { timeout: 45000 });
  const real = await res.json();
  const shaped = res.status() === 200 && ["live", "stale", "wrong-chain", "no-contract", "unreachable"].includes(real.verdict) && real.expectedChainId === 420420777 && typeof real.message === "string" && !JSON.stringify(real).match(/ECONN|stack|at .*\(/);
  check("/api/chain answers with a well-formed status and leaks no internals", shaped, `verdict ${real.verdict}`);
  if (real.verdict === "live" || real.verdict === "stale") {
    check("the real Portal V3 chain: right chain id, deployed code, domain separator and deployment record all match", real.chainId === 420420777 && real.contract?.codeBytes > 1000 && real.contract?.domainSeparatorOk === true && real.contract?.matchesDeploymentRecord === true, `block #${real.head?.number}, ${real.head?.ageSeconds}s old`);
  } else {
    console.log(`NOTE  the public Portal V3 RPC reported "${real.verdict}" during this run; the live-content check was skipped, not passed`);
  }
  await api.close();
}

/* =============== B. reduced motion =============== */
{
  const c = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" });
  const p = await c.newPage();
  watch(p);
  await p.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await p.mouse.move(1200, 600, { steps: 10 });
  await p.waitForTimeout(700);
  const v = await p.evaluate(() => ({ px: document.querySelector(".lp-hero").style.getPropertyValue("--px"), card: getComputedStyle(document.querySelector("[data-hero-card]")).transform, armed: document.querySelectorAll("[data-armed]").length }));
  check("reduced motion: the mouse does not tilt or parallax anything", v.px === "" && v.card === "none", JSON.stringify(v));
  check("reduced motion: nothing is hidden waiting for a scroll reveal", v.armed === 0);
  const cv = await p.evaluate(() => { const cn = document.querySelector("[data-network-canvas]"); const d = cn.getContext("2d").getImageData(0, 0, cn.width, cn.height).data; let n = 0; for (let i = 3; i < d.length; i += 28) if (d[i] > 20) n++; return n; });
  check("reduced motion: the network is drawn once, as a still image", cv > 100, `${cv}`);
  const a1 = await p.evaluate(() => document.querySelector("[data-network-canvas]").toDataURL().length);
  await p.waitForTimeout(500);
  check("reduced motion: the still image does not animate", a1 === (await p.evaluate(() => document.querySelector("[data-network-canvas]").toDataURL().length)));
  await c.close();
}

/* =============== C. touch phone =============== */
for (const [w, h] of [[390, 844], [360, 740]]) {
  const c = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  const p = await c.newPage();
  watch(p);
  await p.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await p.waitForTimeout(400);
  const o1 = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  const ctaW = await p.evaluate(() => document.querySelector(".lp-hero a[data-launch]").getBoundingClientRect().width / innerWidth);
  const ptr = await p.evaluate(() => document.querySelector(".lp-hero").style.getPropertyValue("--px"));
  check(`${w}px phone: no horizontal scroll`, o1 <= 0, `overflow ${o1}`);
  check(`${w}px phone: the main button spans the width and no mouse effect is attached`, ctaW > 0.85 && ptr === "", `width ${(ctaW * 100).toFixed(0)}%`);
  for (const id of ["how", "try", "portal", "honest"]) { await p.evaluate((i) => document.getElementById(i).scrollIntoView(), id); await p.waitForTimeout(500); }
  const o2 = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  check(`${w}px phone: still no horizontal scroll after every section`, o2 <= 0, `overflow ${o2}`);
  if (w === 390) {
    await p.evaluate(() => document.getElementById("try").scrollIntoView());
    await p.waitForTimeout(700);
    await p.screenshot({ path: `${OUT}m-calculator.png` });
    await p.evaluate(() => window.scrollTo(0, 0));
    await p.waitForTimeout(500);
    await p.screenshot({ path: `${OUT}m-hero-2.png` });
  }
  await c.close();
}

/* =============== D. widths =============== */
for (const w of [1920, 1280, 1024, 768]) {
  const c = await browser.newContext({ viewport: { width: w, height: 900 } });
  const p = await c.newPage();
  watch(p);
  await p.goto(`${BASE}/`, { waitUntil: "networkidle" });
  for (const id of ["how", "try", "portal", "honest"]) { await p.evaluate((i) => document.getElementById(i).scrollIntoView(), id); await p.waitForTimeout(300); }
  const o = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  const cut = await p.evaluate(() => [...document.querySelectorAll("h1, h2, h3, .lp-card p")].filter((e) => e.scrollWidth > e.clientWidth + 2).map((e) => e.textContent.slice(0, 30)));
  check(`${w}px wide: no horizontal scroll and no clipped headings or card text`, o <= 0 && cut.length === 0, `overflow ${o}; clipped: ${cut.join(" | ") || "none"}`);
  await c.close();
}

check("no unexpected console or page errors", errors.length === 0, errors.slice(0, 3).join(" | "));
await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
