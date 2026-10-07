/* usage: node mobile-check/shot.mjs <device> <page> <out> [menu|scroll=N|click=<sel>] ... */
import { chromium, devices } from "playwright";
const [dn, pg, out, ...acts] = process.argv.slice(2);
const b = await chromium.launch({ channel: "chrome", headless: true });
const { defaultBrowserType, ...cfg } = devices[dn];
const ctx = await b.newContext({ ...cfg });
const p = await ctx.newPage();
const errs = []; p.on("console", (m) => m.type() === "error" && errs.push(m.text())); p.on("pageerror", (e) => errs.push(String(e)));
await p.goto("http://localhost:8080/" + pg); await p.waitForTimeout(2600);
for (const a of acts) {
  if (a === "menu") { await p.locator(".burger").tap(); await p.waitForTimeout(1800); }
  else if (a.startsWith("scroll=")) { await p.evaluate((y) => { window.__lenis ? window.__lenis.scrollTo(y, { immediate: true }) : scrollTo(0, y); }, +a.slice(7)); await p.waitForTimeout(1600); }
  else if (a.startsWith("to=")) { await p.evaluate((q) => { const y = document.querySelector(q).getBoundingClientRect().top + scrollY - 40; window.__lenis ? window.__lenis.scrollTo(y, { immediate: true }) : scrollTo(0, y); }, a.slice(3)); await p.waitForTimeout(2000); }
  else if (a.startsWith("click=")) { await p.locator(a.slice(6)).first().tap(); await p.waitForTimeout(1200); }
  else if (a.startsWith("wait=")) await p.waitForTimeout(+a.slice(5));
}
await p.screenshot({ path: out, fullPage: false });
if (errs.length) console.log("errors:", errs);
await b.close();
