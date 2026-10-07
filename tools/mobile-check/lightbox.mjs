/* scratch: open the gallery lightbox on a phone and swipe */
import { chromium, devices } from "playwright";
const [dn = "iPhone 15", pg = "gallery.html"] = process.argv.slice(2);
const b = await chromium.launch({ channel: "chrome", headless: true });
const { defaultBrowserType, ...cfg } = devices[dn];
const ctx = await b.newContext(cfg); const p = await ctx.newPage();
const errs = []; p.on("pageerror", (e) => errs.push(String(e))); p.on("console", (m) => m.type() === "error" && errs.push(m.text()));
await p.goto("http://localhost:8080/" + pg); await p.waitForTimeout(2500);
console.log("PhotoSwipe loaded:", await p.evaluate(() => !!(window.PhotoSwipe && window.PhotoSwipeLightbox)));
const fig = p.locator(".masonry figure").first();
await fig.scrollIntoViewIfNeeded(); await fig.tap(); await p.waitForTimeout(1500);
console.log("pswp open:", await p.locator(".pswp--open").count(), "| caption:", await p.locator(".pswp__caption").first().textContent());
await p.screenshot({ path: "mobile-check/review/lightbox-open.png" });
const box = (await p.viewportSize());
await p.mouse.move(box.width * 0.8, box.height * 0.5); await p.mouse.down(); await p.mouse.move(box.width * 0.2, box.height * 0.5, { steps: 8 }); await p.mouse.up(); await p.waitForTimeout(900);
console.log("after swipe caption:", await p.locator(".pswp__caption").first().textContent(), "| counter:", await p.locator(".pswp__counter").first().textContent());
await p.keyboard.press("Escape"); await p.waitForTimeout(800);
console.log("closed:", (await p.locator(".pswp--open").count()) === 0, "| errors:", errs);
await b.close();
