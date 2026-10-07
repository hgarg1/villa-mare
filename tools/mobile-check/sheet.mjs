/* scratch: open the date sheet on a phone, drag it down to dismiss, and check it re-opens */
import { chromium, devices } from "playwright";
const b = await chromium.launch({ channel: "chrome", headless: true });
const { defaultBrowserType, ...cfg } = devices["iPhone 15"];
const p = await (await b.newContext(cfg)).newPage();
const errs = []; p.on("pageerror", (e) => errs.push(String(e)));
await p.goto("http://localhost:8080/rates.html"); await p.waitForTimeout(2500);
const open = () => p.locator(".dp").evaluate((n) => n.classList.contains("is-open"));
await p.locator("[data-dr-btn]").first().scrollIntoViewIfNeeded();
await p.locator("[data-dr-btn]").first().tap(); await p.waitForTimeout(900);
console.log("open after tap:", await open());
await p.screenshot({ path: "mobile-check/review/sheet-open.png" });
const g = await p.locator(".dp__grab").boundingBox();
// slow short drag: should snap back
await p.mouse.move(g.x + g.width / 2, g.y + 8); await p.mouse.down(); await p.mouse.move(g.x + g.width / 2, g.y + 70, { steps: 10 }); await p.waitForTimeout(500); await p.mouse.up(); await p.waitForTimeout(900);
console.log("still open after short slow drag:", await open());
// long drag: should dismiss
const g2 = await p.locator(".dp__grab").boundingBox();
await p.mouse.move(g2.x + g2.width / 2, g2.y + 8); await p.mouse.down(); await p.mouse.move(g2.x + g2.width / 2, g2.y + 360, { steps: 12 }); await p.mouse.up(); await p.waitForTimeout(1000);
console.log("open after long drag (expect false):", await open());
await p.locator("[data-dr-btn]").first().tap(); await p.waitForTimeout(900);
console.log("re-opens:", await open(), "| transform cleared:", await p.locator(".dp").evaluate((n) => n.style.transform === ""));
console.log("errors:", errs);
await b.close();
