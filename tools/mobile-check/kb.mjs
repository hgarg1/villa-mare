/* scratch: keyboard-aware chrome on checkout */
import { chromium, devices } from "playwright";
const b = await chromium.launch({ channel: "chrome", headless: true });
const { defaultBrowserType, ...cfg } = devices["iPhone 15"];
const p = await (await b.newContext(cfg)).newPage();
const errs = []; p.on("pageerror", (e) => errs.push(String(e)));
await p.goto("http://localhost:8080/checkout.html?arrive=2027-02-10&depart=2027-02-14&adults=2&children=0"); await p.waitForTimeout(3000);
await p.evaluate(() => { location.hash = "#details"; }); await p.waitForTimeout(800);
console.log("hash:", await p.evaluate(() => location.hash));
const el = p.locator("#first, #promo, input[type=text]").first();
await el.tap(); await p.waitForTimeout(700);
console.log("has-kb:", await p.evaluate(() => document.body.classList.contains("has-kb")), "| enterkeyhint:", await el.getAttribute("enterkeyhint"));
console.log("summary hidden:", await p.evaluate(() => { const s = document.querySelector(".summary"); return !s || getComputedStyle(s).display === "none"; }));
await p.evaluate(() => document.activeElement.blur()); await p.waitForTimeout(500);
console.log("has-kb cleared:", !(await p.evaluate(() => document.body.classList.contains("has-kb"))));
console.log("errors:", errs);
await b.close();
