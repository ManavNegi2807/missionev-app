import { chromium } from "playwright-core";
import { existsSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

/** Where the app under test is running. `npm run dev` listens on 3000; point BASE at the live site to test that instead. */
export const BASE = (process.env.BASE ?? "http://localhost:3000").replace(/\/$/, "");

/** Screenshots go to e2e/.artifacts/<name>/ (git-ignored). Returns the folder with a trailing slash. */
export function artifactsDir(name) {
  const dir = fileURLToPath(new URL(`./.artifacts/${name}/`, import.meta.url));
  mkdirSync(dir, { recursive: true });
  return dir;
}

const KNOWN_BROWSERS = [
  process.env.BROWSER_PATH,
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
  "/usr/bin/google-chrome",
  "/usr/bin/google-chrome-stable",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
  "/usr/bin/microsoft-edge",
];

/**
 * Starts a Chromium-based browser that is already installed (Chrome or Edge), so nothing is downloaded. Set BROWSER_PATH to
 * use a different one, and HEADED=1 to watch the test run.
 */
export async function launch() {
  const headless = process.env.HEADED !== "1";
  const executablePath = KNOWN_BROWSERS.find((p) => p && existsSync(p));
  if (executablePath) return chromium.launch({ executablePath, headless });
  for (const channel of ["chrome", "msedge"]) {
    try {
      return await chromium.launch({ channel, headless });
    } catch {
      /* try the next channel */
    }
  }
  throw new Error("No Chrome or Edge found. Install one, or set BROWSER_PATH to a Chromium-based browser's executable.");
}
