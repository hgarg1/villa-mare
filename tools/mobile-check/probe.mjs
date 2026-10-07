/* scratch probe: where does a tap stall? usage: node mobile-check/probe.mjs [page] */
import { chromium, devices } from "playwright";
const page = process.argv[2] || "gallery.html";
const b = await chromium.launch({ channel: "chrome", headless: true });
const { defaultBrowserType, ...cfg } = devices["iPhone SE"];
const ctx = await b.newContext(cfg);
const p = await ctx.newPage();
const t0 = Date.now();
const lap = (m) => console.log(((Date.now() - t0) / 1000).toFixed(1) + "s", m);
await p.goto("http://localhost:8080/" + page, { waitUntil: "domcontentloaded" });
await p.waitForTimeout(2000);
const burger = p.locator(".burger");
const tryTap = async (label) => {
  try { await burger.tap({ timeout: 5000 }); lap(label + " ok"); }
  catch (e) { lap(label + " FAILED: " + String(e).split("\n").slice(0, 8).join(" | ")); }
};
await tryTap("open");
await p.waitForTimeout(1100);
await tryTap("close");
await b.close();
