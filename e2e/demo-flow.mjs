import { BASE, artifactsDir, launch } from "./browser.mjs";
const OUT = artifactsDir("demo");

const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  — " + detail : ""}`);
};

const browser = await launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, permissions: ["geolocation"], geolocation: { latitude: 28.6139, longitude: 77.209 } });
const page = await ctx.newPage();
const errors = [];
page.on("console", (m) => m.type() === "error" && !/hydrat|caret-color|Download the React DevTools|favicon/i.test(m.text()) && errors.push(m.text().slice(0, 200)));
page.on("pageerror", (e) => errors.push(`pageerror: ${e.message.slice(0, 200)}`));

const shot = (n) => page.screenshot({ path: `${OUT}${n}.png`, fullPage: true });
const text = () => page.evaluate(() => document.body.innerText);

/* ---------------- 1. sign in ---------------- */
await page.goto(`${BASE}/register`, { waitUntil: "networkidle" });
const t1 = await text();
check("sign-in offers MetaMask first and a demo account second", /Connect MetaMask/i.test(t1) && /Explore with a demo account/i.test(t1));
check("no phone number or OTP anywhere on the sign-in screen", !/mobile number|one-time password|send otp|\bOTP\b/i.test(t1));
await page.getByRole("button", { name: "Explore with a demo account" }).click();
await page.getByText("Signed in with a demo account").first().waitFor();
check("signed in as a clearly labelled demo account", /DEMO ACCOUNT — NOTHING IS ON-CHAIN/.test(await text()));

/* ---------------- 2. transport profile ---------------- */
const t2 = await text();
check("registration asks 'How do you usually commute?'", /how do you usually commute\?/i.test(t2) && /You can choose a different mode for every journey/.test(t2));
check("the old ownership question is gone", !/Do you (own|have) an? (electric )?(car|vehicle)/i.test(t2) && !/I have a car or two-wheeler/.test(t2));
for (const m of ["Private electric car", "Private electric two-wheeler", "Private petrol car", "Private diesel car", "Private petrol two-wheeler", "Ola / Uber / Rapido", "Metro", "Electric bus", "Walking / cycling", "Other or unsupported transport"]) {
  check(`mode offered: ${m}`, (await page.getByRole("checkbox", { name: new RegExp(m.replace(/[/()]/g, "\\$&")) }).count()) > 0);
}
const mode = (n) => page.getByRole("checkbox", { name: new RegExp(n.replace(/[/()]/g, "\\$&")) }).first();

// EV with battery + range
await mode("Private electric car").click();
await page.getByRole("button", { name: "Add vehicle" }).first().click();
await page.getByLabel("Manufacturer").fill("Tata");
await page.getByLabel(/^Model\*?$/).fill("Nexon EV");
await page.getByLabel(/Usable battery capacity/).fill("40.5");
await page.getByLabel(/Real-world range/).fill("325");
const ev = await text();
check("EV form uses kWh (no km/l field)", !/Vehicle mileage \(km\/l\)/i.test(ev) && /Usable battery capacity/i.test(ev));
check("EV derived intensity shown: 0.1246 kWh/km, 12.46 kWh/100 km", /0\.1246/.test(ev) && /12\.46/.test(ev));
await shot("01-ev-form");
await page.getByRole("button", { name: "Save vehicle" }).click();
check("EV saved with confidence label", /medium confidence/i.test(await text()));

// Petrol car with mileage
await mode("Private petrol car").click();
await page.getByRole("button", { name: "Add vehicle" }).last().click();
await page.getByLabel("Manufacturer").fill("Maruti Suzuki");
await page.getByLabel(/^Model\*?$/).fill("Swift");
const petrolForm = await text();
check("ICE form asks mileage in km/l and offers the unknown path", /Vehicle mileage \(km\/l\)/i.test(petrolForm) && /Don't know your mileage\?/i.test(petrolForm));
await page.getByLabel("Vehicle mileage (km/l)").fill("180");
await page.getByRole("button", { name: "Save vehicle" }).click();
check("implausible mileage is rejected", /Expected 5–40 km\/l/.test(await text()));
await page.getByLabel("Vehicle mileage (km/l)").fill("18");
await page.getByRole("button", { name: "Save vehicle" }).click();

// Diesel with "Don't know your mileage?"
await mode("Private diesel car").click();
await page.getByRole("button", { name: "Add vehicle" }).last().click();
await page.getByLabel("Manufacturer").fill("Mahindra");
await page.getByLabel(/^Model\*?$/).fill("XUV700");
await page.getByRole("button", { name: "Don't know your mileage?" }).click();
const unk = await text();
check("unknown mileage: model list has no figure and says it won't invent one", /won't|never makes up|has no sourced efficiency/.test(unk));
await page.getByRole("radio", { name: /category default/i }).click();
check("category default is labelled as not the vehicle's own figure", /not your car's own figure|category default is not/i.test(await text()));
await page.getByRole("button", { name: "Save vehicle" }).click();
check("default-based vehicle saved as low confidence", /low confidence/i.test(await text()));

for (const m of ["Ola / Uber / Rapido", "Metro", "Electric bus", "Walking / cycling"]) await mode(m).click();
await shot("02-profile");
await page.getByRole("button", { name: /Save transport profile/ }).click();
await page.getByText("Saved", { exact: true }).first().waitFor();
check("transport profile saved", true);

/* ---------------- 3. journey flow helpers ---------------- */
async function runTrip(tile, { assertOnForm, label } = {}) {
  await page.goto(`${BASE}/capture-trip`, { waitUntil: "networkidle" });
  await page.getByRole("radio", { name: tile, exact: true }).click();
  await page.getByRole("radio", { name: /Simulated/ }).click();
  if (assertOnForm) await assertOnForm();
  await page.getByRole("button", { name: "START TRIP" }).click();
  await page.getByRole("button", { name: "VERIFY TRIP" }).waitFor({ timeout: 180000 });
  await page.getByRole("button", { name: "VERIFY TRIP" }).click();
  await page.waitForFunction(() => /estimated avoided emissions|no calculation/i.test(document.body.innerText), null, { timeout: 60000 });
  await shot(`trip-${label}`);
  return text();
}

/* ---------------- 4. Metro: no vehicle needed ---------------- */
let t = await runTrip("Metro", { label: "metro" });
check("metro trip verified without any vehicle", /VERIFIED/.test(t) && /Metro/.test(t));
check("trust is shown as an evidence tier (Gold, Silver or Bronze), never a workflow-stage number like 4.0", /(GOLD|SILVER|BRONZE) TIER/.test(t) && /\d+% evidence/.test(t) && !/TRUST LEVEL 4\.0|Trust 4\.0/.test(t));
check("no diagram wording on the trip screen: stage numbers, 'state machine', 'Portal Layer 0'", !/3\.5 \/|CHECK 3\.\d|state machine|Portal Layer 0/i.test(t), (t.match(/3\.5 \/|CHECK 3\.\d|state machine|Portal Layer 0/i) ?? [""])[0]);
check("the four checks are numbered 1 to 4", ["CHECK 1", "CHECK 2", "CHECK 3", "CHECK 4"].every((c) => t.includes(c)));
check("carbon comparison shows reference journey and avoided emissions", /Reference journey/i.test(t) && /Estimated avoided emissions/i.test(t));
check("DEMO label, never 'on-chain', before credit", /Demo journey — not on-chain/.test(t));
const dist = (await page.locator('[data-kpi="Distance travelled"]').innerText()).match(/[\d.]+/)?.[0];
await page.getByText("How did MissionEV calculate my carbon savings?").click();
const calc = await text();
check("expandable calculation shows formula, source, year, confidence", /CEA/.test(calc) && /FY 20\d\d-\d\d/.test(calc) && /confidence/i.test(calc) && /Accounting boundary/i.test(calc));
await page.getByRole("button", { name: /Credit demo reward — not on-chain/ }).click();
check("demo credit is labelled as not minted", /No transaction exists and nothing was minted/.test(await text()));
await shot("03-metro-calc");

/* ---------------- 5. Private EV vs petrol car vs diesel ---------------- */
t = await runTrip("Private EV", { label: "ev", assertOnForm: async () => check("EV journey lists the saved EV", /Nexon EV/.test(await text())) });
check("EV trip: energy efficiency panel and positive avoided grams", /EV ENERGY EFFICIENCY/.test(t) && /kWh\/100 km/.test(t));
check("EV trip: charging emissions are not zero", !/Estimated emissions \(yours\)\s*0\s*g/.test(t));
t = await runTrip("Petrol car", { label: "petrol" });
check("petrol trip: measured but 'NO $MEV'", /NO \$MEV FOR THIS JOURNEY/.test(t) && /not rewarded/.test(t));
check("petrol trip offers nothing to record", /Nothing to record/.test(t));

/* ---------------- 6. Ride-hail ---------------- */
await page.goto(`${BASE}/capture-trip`, { waitUntil: "networkidle" });
await page.getByRole("radio", { name: "Ola / Uber / Rapido", exact: true }).click();
await page.getByRole("radio", { name: /Simulated/ }).click();
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
await page.locator('input[type="file"]').setInputFiles({ name: "receipt.png", mimeType: "image/png", buffer: png });
await page.getByText("Couldn't read the receipt").waitFor({ timeout: 120000 });
check("OCR on an image with no text: says so and falls back to manual (no fake extraction)", /Couldn't read the receipt/.test(await text()) && !/azure|microsoft/i.test(await text()));
await page.getByLabel("Ride provider").selectOption("Ola");
await page.getByLabel(/Distance on receipt/).fill(dist ?? "5");
await page.getByLabel("Vehicle model").fill("Dzire");
await page.getByLabel("Vehicle type").selectOption("Car");
await page.getByLabel(/Fuel \(confirm\)/).selectOption("Petrol");
await page.getByRole("button", { name: "START TRIP" }).click();
check("cannot start until the ride is confirmed", /Confirm the ride details/.test(await text()));
await page.getByRole("checkbox", { name: /These details are right/ }).check();
await page.getByRole("button", { name: "START TRIP" }).click();
await page.getByRole("button", { name: "VERIFY TRIP" }).waitFor({ timeout: 180000 });
await page.getByRole("button", { name: "VERIFY TRIP" }).click();
await page.waitForFunction(() => /estimated avoided emissions|no calculation/i.test(document.body.innerText), null, { timeout: 60000 });
t = await text();
check("petrol cab: calculated from the cab, no reward — even though an EV is saved in the profile", /NO \$MEV FOR THIS JOURNEY/.test(t) && /Ola/.test(t) === true || /NO \$MEV/.test(t));
await shot("04-ridehail-petrol");

await page.goto(`${BASE}/capture-trip`, { waitUntil: "networkidle" });
await page.getByRole("radio", { name: "Ola / Uber / Rapido", exact: true }).click();
await page.getByRole("radio", { name: /Simulated/ }).click();
await page.getByLabel("Ride provider").selectOption("Uber");
await page.getByLabel(/Distance on receipt/).fill(dist ?? "5");
await page.getByLabel("Vehicle model").fill("Tigor EV");
await page.getByLabel("Vehicle type").selectOption("Car");
await page.getByLabel(/Fuel \(confirm\)/).selectOption("Electric");
await page.getByRole("checkbox", { name: /These details are right/ }).check();
await page.getByRole("button", { name: "START TRIP" }).click();
await page.getByRole("button", { name: "VERIFY TRIP" }).waitFor({ timeout: 180000 });
await page.getByRole("button", { name: "VERIFY TRIP" }).click();
await page.waitForFunction(() => /estimated avoided emissions|no calculation/i.test(document.body.innerText), null, { timeout: 60000 });
t = await text();
check("electric cab: eligible and mapped to EV_CAR", /ILLUSTRATIVE \$MEV REWARD PREVIEW/.test(t) && /EV_CAR/.test(t));
check("simulated cab trip is never signed (DEMO only)", /Simulated trips are demo data and are never signed/.test(t));
await shot("05-ridehail-ev");

/* ---------------- 7. Rewards & analytics still work ---------------- */
await page.goto(`${BASE}/rewards`, { waitUntil: "networkidle" });
t = await text();
check("rewards: demo balance is labelled, redemptions are simulated", /Demo balance — not a live token balance/i.test(t));
await shot("06-rewards");
await page.goto(`${BASE}/analytics`, { waitUntil: "networkidle" });
await page.waitForFunction(() => document.body.innerText.length > 800, null, { timeout: 30000 });
await shot("07-analytics");
check("analytics renders", /Analytics|ESG|Reference journey/i.test(await text()));

check("no unexpected console/page errors", errors.length === 0, errors.slice(0, 3).join(" | "));
await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
