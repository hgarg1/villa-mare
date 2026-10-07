/* scratch: which elements cause layout shift?  usage: node mobile-check/cls.mjs <device> <page> */
import { chromium, devices } from "playwright";
const [dn = "iPhone SE", pg = "checkout.html"] = process.argv.slice(2);
const b = await chromium.launch({ channel: "chrome", headless: true });
const { defaultBrowserType, ...cfg } = devices[dn];
const p = await (await b.newContext(cfg)).newPage();
await p.addInitScript(() => {
  window.__shifts = [];
  new PerformanceObserver((l) => {
    for (const e of l.getEntries()) {
      if (e.hadRecentInput) continue;
      window.__shifts.push({ t: Math.round(e.startTime), v: +e.value.toFixed(3), src: e.sources.map((s) => (s.node && (s.node.id ? "#" + s.node.id : s.node.className ? "." + String(s.node.className).split(" ")[0] : s.node.nodeName)) + " " + JSON.stringify(s.previousRect) + "→" + JSON.stringify(s.currentRect)) });
    }
  }).observe({ type: "layout-shift", buffered: true });
});
await p.goto("http://localhost:8080/" + pg, { waitUntil: "domcontentloaded" });
await p.waitForTimeout(3500);
await p.evaluate(async () => { const h = document.documentElement.scrollHeight; for (let y = 0; y < h; y += innerHeight * .8) { scrollTo(0, y); await new Promise((r) => setTimeout(r, 90)); } scrollTo(0, 0); });
await p.waitForTimeout(1500);
console.log(JSON.stringify(await p.evaluate(() => window.__shifts), null, 1));
await b.close();
