import { BASE, artifactsDir, launch } from "./browser.mjs";

// Drives "Sign in with MetaMask" in a real browser against a scriptable EIP-1193 wallet whose state survives reloads
// (it lives in sessionStorage), so connect / reject / wrong chain / add network / account switch / lock / reload / sign out are all real.
const OUT = artifactsDir("wallet");

const PORTAL_HEX = "0x" + (420420777).toString(16);
const A1 = "0xa1b2c3d4e5f60718293a4b5c6d7e8f9012345678";
const A2 = "0x9f8e7d6c5b4a39281706f5e4d3c2b1a098765432";
const short = (a) => `${a.slice(0, 6)}...${a.slice(-5)}`;
const SIGNED_IN = /Signed in with (MetaMask|a demo account)/;

const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  — " + detail : ""}`);
};

const browser = await launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, permissions: ["geolocation"], geolocation: { latitude: 28.6139, longitude: 77.209 } });
const installMock = ({ A1, PORTAL_HEX, withWallet }) => {
  if (!withWallet) return;
  const K = "__mm";
  const load = () => { try { return JSON.parse(sessionStorage.getItem(K)) ?? null; } catch { return null; } };
  const st = load() ?? { authorized: false, account: A1, chainId: "0x1", hasPortal: false, rejectNext: false, calls: [], added: null };
  const save = () => sessionStorage.setItem(K, JSON.stringify(st));
  save();
  const listeners = {};
  const emit = (ev, arg) => (listeners[ev] ?? []).forEach((h) => h(arg));
  window.__mm = {
    get: () => JSON.parse(JSON.stringify(st)),
    set: (patch) => { Object.assign(st, patch); save(); },
    switchAccount: (a) => { st.account = a; save(); emit("accountsChanged", [a]); },
    lock: () => { st.authorized = false; save(); emit("accountsChanged", []); },
  };
  window.ethereum = {
    isMetaMask: true,
    on: (ev, h) => { (listeners[ev] ??= []).push(h); },
    removeListener: (ev, h) => { listeners[ev] = (listeners[ev] ?? []).filter((x) => x !== h); },
    async request({ method, params = [] }) {
      st.calls.push(method); save();
      if (method === "eth_requestAccounts") {
        await new Promise((r) => setTimeout(r, 60));
        if (st.rejectNext) { st.rejectNext = false; save(); throw Object.assign(new Error("User rejected the request."), { code: 4001 }); }
        st.authorized = true; save(); return [st.account];
      }
      if (method === "eth_accounts") return st.authorized ? [st.account] : [];
      if (method === "eth_chainId") return st.chainId;
      if (method === "wallet_switchEthereumChain") {
        if (params[0].chainId === PORTAL_HEX && st.hasPortal) { st.chainId = PORTAL_HEX; save(); emit("chainChanged", PORTAL_HEX); return null; }
        throw Object.assign(new Error("Unrecognized chain ID"), { code: 4902 });
      }
      if (method === "wallet_addEthereumChain") {
        st.hasPortal = true; st.added = params[0]; st.chainId = params[0].chainId; save(); emit("chainChanged", st.chainId); return null;
      }
      if (method === "wallet_revokePermissions") { st.authorized = false; save(); return null; }
      throw Object.assign(new Error(`${method} not supported by the test wallet`), { code: -32601 });
    },
  };
};

const errors = [];
const watch = (page) => {
  page.on("console", (m) => m.type() === "error" && !/hydrat|caret-color|Download the React DevTools|favicon|Failed to load resource/i.test(m.text()) && errors.push(m.text().slice(0, 200)));
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message.slice(0, 200)}`));
};
const text = (page) => page.evaluate(() => document.body.innerText);
const mm = (page) => page.evaluate(() => window.__mm.get());
const shot = (page, n) => page.screenshot({ path: `${OUT}${n}.png`, fullPage: true });
const JARGON = /\bOTP\b|one-time password|mobile number|\+91 ••|Process \d\.\d|\bD[1-4]\b|Data flow|Level [12]\b/i;

/* =============== A. a browser WITHOUT a wallet =============== */
{
  const c = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await c.addInitScript(installMock, { A1, PORTAL_HEX, withWallet: false });
  const page = await c.newPage();
  watch(page);
  await page.goto(`${BASE}/capture-trip`, { waitUntil: "networkidle" });
  let t = await text(page);
  check("signed out: the trip page asks you to connect MetaMask (no phone/OTP wording)", /Sign-in required/.test(t) && /Connect MetaMask on Screen 01/.test(t) && !JARGON.test(t));
  check("signed out: the top bar offers Connect wallet", (await page.getByRole("link", { name: "Connect wallet" }).count()) === 1);
  await page.goto(`${BASE}/register`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Connect MetaMask" }).click();
  await page.getByText("MetaMask not detected").waitFor();
  t = await text(page);
  check("no wallet installed: clear message plus an Install MetaMask link", /MetaMask not detected/.test(t) && (await page.getByRole("link", { name: /Install MetaMask/ }).getAttribute("href")) === "https://metamask.io/download/");
  check("still signed out after the failed attempt", !SIGNED_IN.test(t) && (await page.getByRole("button", { name: "Continue to capture trip" }).isDisabled()));
  await shot(page, "w01-no-wallet");
  await page.getByRole("button", { name: "Explore with a demo account" }).click();
  await page.getByText("Signed in with a demo account").first().waitFor();
  t = await text(page);
  check("demo account works without any wallet and is labelled", /DEMO ACCOUNT — NOTHING IS ON-CHAIN/.test(t) && /Demo account/.test(t) && !JARGON.test(t));
  await c.close();
}

/* =============== B. a browser WITH MetaMask =============== */
const page = await ctx.newPage();
await ctx.addInitScript(installMock, { A1, PORTAL_HEX, withWallet: true });
watch(page);
await page.goto(`${BASE}/register`, { waitUntil: "networkidle" });
let t = await text(page);
check("register screen: Connect MetaMask is the primary action, no OTP/phone anywhere", /Connect MetaMask/.test(t) && !JARGON.test(t));
check("the screen says what connecting shares (public address only)", /only your public address/i.test(t) && /seed phrase/i.test(t));

// rejected first
await page.evaluate(() => window.__mm.set({ rejectNext: true }));
await page.getByRole("button", { name: "Connect MetaMask" }).click();
await page.getByText("Connection rejected").waitFor();
t = await text(page);
check("rejecting in MetaMask shows 'Connection rejected' and signs nobody in", !SIGNED_IN.test(t) && /Approve it in your wallet/.test(t));
await shot(page, "w02-rejected");

// approve, but the wallet sits on Ethereum Mainnet
await page.getByRole("button", { name: "Connect MetaMask" }).click();
await page.getByText("Signed in with MetaMask").first().waitFor();
t = await text(page);
check("approving signs in with the wallet address as the account", t.includes(short(A1)) && /MetaMask wallet/.test(t) && /usr_[0-9a-f]{8}/.test(t));
check("wrong network is called out with a Switch button", /Switch to Portal V3/.test(t) && /Ethereum Mainnet/.test(t));
check("the error from the earlier rejection is gone", !/Connection rejected/.test(t));
const user1 = t.match(/usr_[0-9a-f]{8}/)[0];
await shot(page, "w03-wrong-chain");

// switch -> network missing -> add it
await page.getByRole("button", { name: /^Switch to Portal V3$/ }).first().click();
await page.getByText(/Portal V3 · 420420777/).first().waitFor();
const s1 = await mm(page);
check("the app asked MetaMask to switch, then to ADD Portal V3 with the official RPC and tPOT", s1.calls.includes("wallet_switchEthereumChain") && s1.calls.includes("wallet_addEthereumChain") && s1.added?.chainId === PORTAL_HEX && s1.added?.rpcUrls?.[0] === "https://test-evm-rpc-v3.portaldot.dev" && s1.added?.nativeCurrency?.symbol === "tPOT" && s1.added?.blockExplorerUrls === undefined, JSON.stringify(s1.added));
t = await text(page);
check("after the switch the warning is gone and the network reads Portal V3 · 420420777", !/Your wallet is on/.test(t));
check("top bar shows WALLET CONNECTED on Portal V3", /WALLET CONNECTED|PORTAL V3 · 420420777/i.test(t));
await shot(page, "w04-connected");

// profile on the wallet account
await page.getByRole("checkbox", { name: /^Metro/ }).first().click();
await page.getByRole("button", { name: /Save transport profile/ }).click();
await page.getByText("Saved", { exact: true }).first().waitFor();
check("transport profile saves on the wallet account", true);

// account menu
await page.getByRole("button", { name: "Account menu" }).click();
t = await text(page);
check("account menu shows the wallet address (no phone), network and copy action", t.includes(short(A1)) && /Connected on/.test(t) && /Copy address/.test(t) && !JARGON.test(t));
await shot(page, "w05-menu");
await page.keyboard.press("Escape");

// switch account in MetaMask (with an UNSAVED edit pending, which must not follow to the other account)
await page.getByRole("checkbox", { name: /^Walking/ }).first().click();
await page.evaluate((a) => window.__mm.switchAccount(a), A2);
await page.waitForFunction((s) => document.body.innerText.includes(s), short(A2), { timeout: 10000 });
t = await text(page);
const user2 = t.match(/usr_[0-9a-f]{8}/)?.[0];
check("switching account in MetaMask switches the signed-in account", t.includes(short(A2)) && user2 && user2 !== user1, `${user1} -> ${user2}`);
check("the other account's transport profile does not leak across (saved status reset, Metro unticked)", /not set/i.test(t) && !(await page.getByRole("checkbox", { name: /^Metro/ }).first().isChecked()) && !(await page.getByRole("checkbox", { name: /^Walking/ }).first().isChecked()));
await page.evaluate((a) => window.__mm.switchAccount(a), A1);
await page.waitForFunction((s) => document.body.innerText.includes(s), short(A1), { timeout: 10000 });
check("switching back returns to the first account's id", (await text(page)).includes(user1));

// lock the wallet
await page.evaluate(() => window.__mm.lock());
await page.getByRole("button", { name: "Reconnect" }).first().waitFor();
t = await text(page);
check("locking MetaMask keeps you signed in but says the wallet is not connected, with Reconnect", /Wallet not connected/.test(t) && /Signed in with MetaMask/.test(t) && /WALLET NOT CONNECTED|WALLET OFFLINE/i.test(t));
await shot(page, "w06-locked");
await page.getByRole("button", { name: "Reconnect" }).first().click();
await page.waitForFunction(() => !/Wallet not connected/.test(document.body.innerText), null, { timeout: 10000 });
check("Reconnect restores the connection", /Portal V3 · 420420777/.test(await text(page)));

// reload restores silently
await page.reload({ waitUntil: "networkidle" });
await page.getByText("Signed in with MetaMask").first().waitFor();
await page.waitForTimeout(1500);
t = await text(page);
const s2 = await mm(page);
check("reload: still signed in, wallet re-attached silently (no prompt)", /Signed in with MetaMask/.test(t) && !/Wallet not connected/.test(t) && /Portal V3 · 420420777/.test(t) && s2.calls.filter((c) => c === "eth_requestAccounts").length === 3);

// every page, signed in with the wallet
for (const [path, must] of [["/", /MissionEV|Strava/i], ["/capture-trip", /Every journey/], ["/rewards", /Impact has its rewards/], ["/analytics", /Analytics|Reference journey/i]]) {
  await page.goto(`${BASE}${path}`, { waitUntil: "networkidle" });
  await page.waitForFunction((n) => document.body.innerText.length > n, 300, { timeout: 30000 });
  t = await text(page);
  check(`${path}: renders for a wallet account with no OTP/phone/diagram jargon`, must.test(t) && !JARGON.test(t), (t.match(JARGON) ?? [""])[0]);
}
await page.goto(`${BASE}/rewards`, { waitUntil: "networkidle" });
t = await text(page);
check("rewards: the wallet strip shows the connected wallet, not 'optional'", t.includes(short(A1)) && !/Optional wallet|No wallet needed/.test(t));
await shot(page, "w07-rewards");

// a simulated journey as the wallet account
await page.goto(`${BASE}/capture-trip`, { waitUntil: "networkidle" });
await page.getByRole("radio", { name: "Metro", exact: true }).click();
await page.getByRole("radio", { name: /Simulated/ }).click();
await page.getByRole("button", { name: "START TRIP" }).click();
await page.getByRole("button", { name: "VERIFY TRIP" }).waitFor({ timeout: 180000 });
await page.getByRole("button", { name: "VERIFY TRIP" }).click();
await page.waitForFunction(() => /estimated avoided emissions|no calculation/i.test(document.body.innerText), null, { timeout: 60000 });
t = await text(page);
check("wallet account: a simulated metro trip verifies and calculates", /VERIFIED/.test(t) && /Estimated avoided emissions/i.test(t) && !JARGON.test(t));
check("a simulated trip is still never presented as on-chain", /Simulated trips are demo data and are never signed|not on-chain/i.test(t));
await shot(page, "w08-trip");

// sign out
await page.goto(`${BASE}/register`, { waitUntil: "networkidle" });
await page.getByRole("button", { name: "Account menu" }).click();
await page.getByRole("menuitem", { name: "Sign out" }).click();
await page.getByRole("button", { name: "Connect MetaMask" }).waitFor();
const s3 = await mm(page);
check("sign out: back to the sign-in panel and MetaMask permission revoked", s3.calls.includes("wallet_revokePermissions") && s3.authorized === false && !SIGNED_IN.test(await text(page)));
await page.reload({ waitUntil: "networkidle" });
await page.getByRole("button", { name: "Connect MetaMask" }).waitFor();
check("after sign out + reload you stay signed out (no silent re-login)", !SIGNED_IN.test(await text(page)));

// demo account upgraded by connecting a wallet from the account menu
await page.getByRole("button", { name: "Explore with a demo account" }).click();
await page.getByText("Signed in with a demo account").first().waitFor();
await page.getByRole("checkbox", { name: /^Metro/ }).first().click();
await page.getByRole("button", { name: /Save transport profile/ }).click();
await page.getByText("Saved", { exact: true }).first().waitFor();
await page.getByRole("button", { name: "Account menu" }).click();
await page.getByRole("button", { name: "Connect MetaMask" }).click();
await page.getByText("Signed in with MetaMask").first().waitFor({ timeout: 10000 });
t = await text(page);
check("demo account + Connect MetaMask from the menu upgrades to a wallet account and keeps the profile", /Signed in with MetaMask/.test(t) && /Metro|1 selected/.test(t) && !/DEMO ACCOUNT — NOTHING IS ON-CHAIN/.test(t));
await shot(page, "w09-upgrade");

/* =============== C. phone-width layout =============== */
{
  const c = await browser.newContext({ viewport: { width: 375, height: 800 } });
  await c.addInitScript(installMock, { A1, PORTAL_HEX, withWallet: true });
  const p = await c.newPage();
  watch(p);
  await p.goto(`${BASE}/register`, { waitUntil: "networkidle" });
  const over1 = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  await p.getByRole("button", { name: "Connect MetaMask" }).click();
  await p.getByText("Signed in with MetaMask").first().waitFor();
  const over2 = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  await p.screenshot({ path: `${OUT}w10-phone.png`, fullPage: true });
  check("375px phone: sign-in and signed-in views have no horizontal scroll", over1 <= 0 && over2 <= 0, `overflow ${over1}/${over2}`);
  await c.close();
}

/* =============== D. a phone with no extension =============== */
{
  const c = await browser.newContext({ viewport: { width: 390, height: 800 }, userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1" });
  const p = await c.newPage();
  watch(p);
  await p.goto(`${BASE}/register`, { waitUntil: "networkidle" });
  await p.getByRole("button", { name: "Connect MetaMask" }).click();
  const link = p.getByRole("link", { name: /Open in MetaMask app/ });
  await link.waitFor();
  const href = await link.getAttribute("href");
  check("phone without a wallet: offers to open the page in the MetaMask app", href === `https://metamask.app.link/dapp/${new URL(BASE).host}/register`, href);
  await c.close();
}

check("no unexpected console/page errors", errors.length === 0, errors.slice(0, 3).join(" | "));
await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
