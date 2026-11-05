import { privateKeyToAccount, generatePrivateKey } from "viem/accounts";
import { BASE, artifactsDir, launch } from "./browser.mjs";

// The flag-gated "Testnet Demo Trip" path, end to end, in a real browser, against the LOCAL in-memory chain with the real
// contract (`npm run dev:chain`). It is NOT a test against Portal V3 and NOT a test of the MetaMask extension: the wallet is a
// scriptable EIP-1193 stand-in that signs with a throwaway key and forwards JSON-RPC to the local chain.
//
//   npm run dev:chain      -> prints the contract address and a throwaway oracle key
//   npm run dev            -> started with that contract/RPC/key and DEMO_SIGNING=true NEXT_PUBLIC_DEMO_SIGNING=true
//   node e2e/demo-run.mjs
const OUT = artifactsDir("demo-run");
const RPC = process.env.DEV_CHAIN_RPC ?? "http://127.0.0.1:8545";
const PORTAL_HEX = "0x" + (420420777).toString(16);
const account = privateKeyToAccount(generatePrivateKey()); // a throwaway test wallet, never funded anywhere real

const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  — " + detail : ""}`);
};
const text = (page) => page.evaluate(() => document.body.innerText);

const rpc = async (method, params) => {
  const res = await fetch(RPC, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) });
  const j = await res.json();
  if (j.error) throw Object.assign(new Error(j.error.message), { code: j.error.code });
  return j.result;
};

const installWallet = ({ A, PORTAL_HEX }) => {
  const K = "__mm";
  const st = JSON.parse(sessionStorage.getItem(K) ?? "null") ?? { authorized: false };
  const save = () => sessionStorage.setItem(K, JSON.stringify(st));
  window.ethereum = {
    isMetaMask: true,
    on() {},
    removeListener() {},
    async request({ method, params = [] }) {
      if (method === "eth_requestAccounts") { st.authorized = true; save(); return [A]; }
      if (method === "eth_accounts") return st.authorized ? [A] : [];
      if (method === "eth_chainId") return PORTAL_HEX;
      if (method === "personal_sign") return window.__sign(params[0]);
      if (method === "wallet_switchEthereumChain" || method === "wallet_addEthereumChain") return null;
      return window.__rpc(method, params);
    },
  };
};

const launchPage = async (viewport = { width: 1280, height: 900 }) => {
  const browser = await launch();
  const ctx = await browser.newContext({ viewport });
  await ctx.exposeFunction("__rpc", (method, params) => rpc(method, params));
  await ctx.exposeFunction("__sign", async (hexMessage) => {
    const hex = hexMessage.slice(2);
    const message = Buffer.from(hex, "hex").toString("utf8");
    return account.signMessage({ message });
  });
  await ctx.addInitScript(installWallet, { A: account.address, PORTAL_HEX });
  const page = await ctx.newPage();
  const errors = [];
  page.on("console", (m) => m.type() === "error" && !/hydrat|caret-color|DevTools|favicon|Failed to load resource/i.test(m.text()) && errors.push(m.text().slice(0, 200)));
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message.slice(0, 200)}`));
  return { browser, ctx, page, errors };
};

const status = await fetch(`${BASE}/api/status`).then((r) => r.json());
check("the app under test is LIVE with demo signing on (local chain, throwaway oracle key)", status.mode === "LIVE" && status.demoSigning === true, JSON.stringify({ mode: status.mode, demoSigning: status.demoSigning }));

/* ---------- A. a demo account (no wallet) is never offered the demo run ---------- */
{
  const { browser, page } = await launchPage();
  await page.addInitScript(() => { delete window.ethereum; });
  await page.goto(`${BASE}/register`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Explore with a demo account" }).click();
  await page.getByText("Signed in with a demo account").first().waitFor();
  await page.getByRole("checkbox", { name: /^Metro/ }).first().click();
  await page.getByRole("button", { name: /Save transport profile/ }).click();
  await page.getByText("Saved", { exact: true }).first().waitFor();
  await page.goto(`${BASE}/capture-trip`, { waitUntil: "networkidle" });
  const t = await text(page);
  check("demo account (no wallet): no Demo run card and no demo banner", !/Demo run \(1 km\+\)/.test(t) && (await page.locator("[data-demo-run-card]").count()) === 0 && !/TESTNET DEMO TRIP/.test(t));
  await browser.close();
}

/* ---------- B. a wallet: the full demo run ---------- */
const { browser, page, errors } = await launchPage();
await page.goto(`${BASE}/register`, { waitUntil: "networkidle" });
await page.getByRole("button", { name: "Connect MetaMask" }).click();
await page.getByText("Signed in with MetaMask").first().waitFor();
await page.getByRole("checkbox", { name: /^Metro/ }).first().click();
await page.getByRole("button", { name: /Save transport profile/ }).click();
await page.getByText("Saved", { exact: true }).first().waitFor();
await page.goto(`${BASE}/capture-trip`, { waitUntil: "networkidle" });

const card = page.locator("[data-demo-run-card]");
await card.waitFor({ timeout: 15000 });
let t = await text(page);
check("wallet connected + flags on: the Demo run (1 km+) card is offered and says it is not real travel", /Demo run \(1 km\+\)/i.test(t) && /Not real travel/i.test(t) && /The transaction is real; the trip is not/i.test(t));
check("no demo banner before a demo run has started", !/TESTNET DEMO TRIP\s*\n?\s*Synthetic distance/.test(await page.locator("[data-demo-banner]").allInnerTexts().then((a) => a.join(""))));
await page.screenshot({ path: `${OUT}01-card.png`, fullPage: true });

const t0 = Date.now();
await page.getByRole("button", { name: "Demo run (1 km+)" }).click();
await page.locator("[data-demo-banner]").first().waitFor({ timeout: 5000 });
check("the persistent TESTNET DEMO TRIP banner appears as soon as the run starts", /Synthetic distance, not GPS-verified\. The transaction is real; the trip is not\./.test(await page.locator("[data-demo-banner]").first().innerText()));

await page.getByRole("button", { name: /Sign & record on-chain \(testnet demo\)/ }).waitFor({ timeout: 40000 });
const tVerified = (Date.now() - t0) / 1000;
t = await text(page);
check("the run stopped itself, verified itself and is now VERIFIED", /VERIFIED/.test(t));
const km = Number(/(\d+\.\d+) km/.exec(await page.locator("dl").filter({ hasText: "Trip ID" }).first().innerText())?.[1] ?? 0);
check("the synthetic trip is at least 1 km", km >= 1, `${km} km`);
check("the summary labels the source as a synthetic testnet demo trip, never GPS", /Synthetic \(testnet demo trip\)/.test(t) && !/Browser GPS/.test(await page.locator("dl").filter({ hasText: "Trip ID" }).first().innerText()));
check("the ledger says TESTNET DEMO, not LIVE", /Testnet demo/i.test(await page.locator("#ledger-title").locator("xpath=ancestor::section").innerText()));
check(`reaches the record step in about 30 s (took ${tVerified.toFixed(1)} s, includes the staged verification)`, tVerified < 40);
await page.screenshot({ path: `${OUT}02-verified.png`, fullPage: true });

await page.getByRole("button", { name: /Sign & record on-chain \(testnet demo\)/ }).click();
await page.getByText(/CONFIRMED ON PORTAL/).waitFor({ timeout: 30000 });
t = await text(page);
check("the transaction confirmed and was read back from the contract, labelled as a demo trip, not real travel", /CONFIRMED ON PORTAL · READ BACK FROM THE CONTRACT · TESTNET DEMO TRIP, NOT REAL TRAVEL/.test(t));
check(`end to end in ${((Date.now() - t0) / 1000).toFixed(1)} s with two clicks after the mode pick`, true);
await page.screenshot({ path: `${OUT}03-confirmed.png`, fullPage: true });
const history = await page.locator("#history-title").locator("xpath=ancestor::section").innerText();
check("trip history shows the distinct DEMO · ON-CHAIN badge, not the GPS 'On-chain' one", /DEMO · ON-CHAIN/.test(history) && !/\bOn-chain\b/.test(history.replace(/DEMO · ON-CHAIN/g, "")));

/* ---------- C. the chain, not the page, is the proof ---------- */
const act = await fetch(`${BASE}/api/activity`).then((r) => r.json());
const mine = (act.events ?? []).filter((e) => e.commuter.toLowerCase() === account.address.toLowerCase());
check("/api/activity reads exactly one recordCommute from the chain logs for this wallet, METRO", act.verdict === "ok" && mine.length === 1 && mine[0].modeName === "METRO", JSON.stringify(mine[0] ?? act).slice(0, 160));
check("the row has an exact minted amount and a link", Boolean(mine[0]?.mintedWei) && BigInt(mine[0].mintedWei) > BigInt(0) && /^https?:/.test(mine[0].url));

/* ---------- D. the landing page shows it ---------- */
await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
await page.locator("[data-recent-activity]").scrollIntoViewIfNeeded();
await page.locator("[data-recent-activity][data-state=ok]").waitFor({ timeout: 15000 });
t = await page.locator("[data-recent-activity]").innerText();
check("the landing 'Recent on-chain activity' panel lists the transaction without a wallet", /Recent on-chain activity/.test(t) && /Metro/.test(t) && /\$MEV/.test(t));
check("the landing badge says the contract is live, not the app", /Contract live on Portal V3 testnet/i.test(await text(page)));
await page.screenshot({ path: `${OUT}04-landing.png`, fullPage: false });

/* ---------- E. the same wallet on a phone-width screen ---------- */
await page.setViewportSize({ width: 375, height: 800 });
await page.goto(`${BASE}/capture-trip`, { waitUntil: "networkidle" });
const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
check("375 px wide: no horizontal scroll on the capture screen", overflow <= 1, `overflow ${overflow}px`);
await page.setViewportSize({ width: 375, height: 800 });
await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
await page.locator("[data-recent-activity]").scrollIntoViewIfNeeded();
await page.waitForTimeout(1500);
check("375 px wide: no horizontal scroll on the landing page with the activity panel", (await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)) <= 1);
await page.screenshot({ path: `${OUT}05-phone.png`, fullPage: false });

check("no console or page errors", errors.length === 0, errors.join(" | "));
await browser.close();

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
