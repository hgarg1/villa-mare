/* Mobile adherence check. Dev-only: drives the installed Chrome with phone emulation.
   usage: node mobile-check/run.mjs [--quick] [--device "iPhone 13"] [--page rates.html]
   Pages come from ../sitemap.xml (paths only, always loaded from localhost) + a fixed extra list.
   Writes out/report.json, out/report.md and screenshots; exit code 1 if any hard rule fails. */
import { chromium, devices } from "playwright";
import AxeBuilder from "@axe-core/playwright";
import { spawn } from "node:child_process";
import { mkdir, readFile, writeFile, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../..");
const out = path.join(here, "out");
const PORT = 8080;
const BASE = `http://localhost:${PORT}`;

const argv = process.argv.slice(2);
const flag = (n) => argv.includes(`--${n}`);
const opt = (n) => (argv.includes(`--${n}`) ? argv[argv.indexOf(`--${n}`) + 1] : null);

const DEVICES = ["iPhone SE", "iPhone 15", "iPhone 15 Pro Max", "Pixel 7", "iPad Mini"];
const EXTRA = ["checkout.html", "booking.html", "404.html"];

async function serverUp() { try { return (await fetch(BASE + "/")).ok; } catch { return false; } }
async function ensureServer() {
  if (await serverUp()) return null;
  const p = spawn("npx", ["--yes", "http-server", root, "-p", String(PORT), "-c-1", "-s"], { shell: true, stdio: "ignore" });
  for (let i = 0; i < 40; i++) { if (await serverUp()) return p; await new Promise((r) => setTimeout(r, 500)); }
  throw new Error("dev server did not start");
}

async function pages() {
  const xml = await readFile(path.join(root, "sitemap.xml"), "utf8");
  const fromMap = [...xml.matchAll(/<loc>https?:\/\/[^/]+\/([^<]*)<\/loc>/g)].map((m) => m[1] || "index.html");
  let list = [...new Set([...fromMap, ...EXTRA])];
  if (flag("quick")) list = ["index.html", "rates.html", "checkout.html", "gallery.html", "suite.html?id=master", "article.html?slug=when-it-rains", "contact.html"];
  if (opt("page")) list = list.filter((p) => p.includes(opt("page")));
  return list;
}

/* runs inside the page: measurements only, no mutation */
function measure() {
  const vw = innerWidth;
  const sel = (el) => {
    let s = el.tagName.toLowerCase();
    if (el.id) return s + "#" + el.id;
    const c = [...el.classList].filter((x) => !/^(is-|has-)/.test(x)).slice(0, 2).join(".");
    if (c) s += "." + c;
    const t = (el.getAttribute("aria-label") || el.textContent || "").trim().replace(/\s+/g, " ").slice(0, 24);
    return t ? `${s} "${t}"` : s;
  };
  const visible = (el) => {
    const cs = getComputedStyle(el);
    if (cs.display === "none" || cs.visibility === "hidden" || +cs.opacity === 0) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };
  const clippedByScroller = (el) => {
    for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
      const o = getComputedStyle(p).overflowX;
      if (o === "auto" || o === "scroll" || o === "hidden" || o === "clip") {
        const r = p.getBoundingClientRect();
        if (r.right <= vw + 1 && r.left >= -1) return true;
      }
    }
    return false;
  };

  const res = { overflow: [], tap: [], inputFont: [], smallText: [], meta: {} };
  const root = document.documentElement;
  res.scrollW = root.scrollWidth; res.vw = vw;
  if (root.scrollWidth > vw + 1) {
    for (const el of document.querySelectorAll("body *")) {
      if (!visible(el) || clippedByScroller(el)) continue;
      const r = el.getBoundingClientRect();
      if (r.right > vw + 1 || r.left < -1) res.overflow.push(`${sel(el)} [${Math.round(r.left)}→${Math.round(r.right)}]`);
      if (res.overflow.length >= 8) break;
    }
  }

  const TAP = 'a[href], button, input:not([type=hidden]), select, textarea, summary, [role=button], [role=option], [role=tab], [tabindex]:not([tabindex="-1"])';
  for (const el of document.querySelectorAll(TAP)) {
    if (!visible(el) || el.closest(".sr-only, .skip, .rail, .rail-panel")) continue;
    if (el.disabled || el.getAttribute("aria-disabled") === "true" || el.matches(".sr-only") || (el.type === "checkbox" || el.type === "radio") && el.closest("label")) continue;
    const r = el.getBoundingClientRect();
    if (r.bottom < 0 || r.top > document.documentElement.scrollHeight) continue;
    /* inline text links inside running copy are exempt (WCAG 2.5.8 inline exception) */
    const inline = el.tagName === "A" && getComputedStyle(el).display === "inline" && el.closest("p, li, dd, figcaption, blockquote, small");
    if (inline) continue;
    const w = Math.round(r.width), h = Math.round(r.height);
    /* dense date-grid cells cannot reach 44px at 320px wide; WCAG 2.5.8 floor (24px) still applies */
    const min = el.matches(".dp__day, .cal__d") ? 36 : 44;
    if (w < min || h < min) res.tap.push({ s: sel(el), w, h, hard: w < 24 || h < 24 });
  }

  for (const el of document.querySelectorAll("input:not([type=hidden]):not([type=checkbox]):not([type=radio]), select, textarea")) {
    if (!visible(el)) continue;
    const fs = parseFloat(getComputedStyle(el).fontSize);
    if (fs < 16) res.inputFont.push(`${sel(el)} ${fs}px`);
  }

  const seen = new Map();
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n; (n = walker.nextNode()); ) {
    if (!n.textContent.trim()) continue;
    const el = n.parentElement;
    if (!el || el.closest("script, style, noscript, .sr-only") || !visible(el)) continue;
    const fs = parseFloat(getComputedStyle(el).fontSize);
    if (fs < 12) seen.set(sel(el), fs);
  }
  res.smallText = [...seen].slice(0, 12).map(([s, f]) => `${s} ${f.toFixed(1)}px`);

  const vp = document.querySelector('meta[name="viewport"]')?.content || "";
  res.meta = { viewportFitCover: /viewport-fit=cover/.test(vp), themeColor: !!document.querySelector('meta[name="theme-color"]') };
  return res;
}

async function settle(page) {
  await page.waitForLoadState("load").catch(() => {});
  await page.waitForTimeout(flag("quick") ? 1600 : 2400); /* curtain + hero intro */
  /* walk the page so scroll-triggered reveals, lazy images and the book bar all happen */
  await page.evaluate(async () => {
    const h = document.documentElement.scrollHeight;
    for (let y = 0; y < h; y += innerHeight * 0.8) { scrollTo(0, y); await new Promise((r) => setTimeout(r, 90)); }
    scrollTo(0, 0);
  });
  await page.waitForTimeout(1500); /* let reveal tweens finish so axe does not read half-faded text */
}

async function scanState(page, label, rec, shotBase) {
  const m = await page.evaluate(measure);
  rec.states[label] = m;
  if (label === "page") {
    const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag22aa"]).analyze().catch((e) => ({ violations: [], error: String(e) }));
    rec.axe = axe.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => `${v.id} (${v.nodes.length}) ${v.nodes[0]?.target?.join(" ")}`);
  }
  if (shotBase) await page.screenshot({ path: `${shotBase}-${label}.png` }).catch(() => {});
}

async function run() {
  await rm(out, { recursive: true, force: true });
  await mkdir(path.join(out, "shots"), { recursive: true });
  const server = await ensureServer();
  const list = await pages();
  const devs = opt("device") ? [opt("device")] : flag("quick") ? ["iPhone SE", "iPhone 15", "Pixel 7"] : DEVICES;
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const results = [];

  for (const dn of devs) {
    const { defaultBrowserType, ...cfg } = devices[dn];
    const ctx = await browser.newContext({ ...cfg, reducedMotion: "no-preference" });
    for (const p of list) {
      const rec = { device: dn, page: p, states: {}, console: [], failed: [], axe: [], cls: 0 };
      const page = await ctx.newPage();
      page.on("console", (m) => { if (m.type() === "error") rec.console.push(m.text().slice(0, 160)); });
      page.on("pageerror", (e) => rec.console.push("pageerror: " + String(e).slice(0, 160)));
      page.on("response", (r) => { if (r.status() >= 400 && !/favicon/.test(r.url())) rec.failed.push(`${r.status()} ${r.url().replace(BASE, "")}`); });
      await page.addInitScript(() => {
        window.__cls = 0;
        try { new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value; }).observe({ type: "layout-shift", buffered: true }); } catch {}
      });
      const shot = path.join(out, "shots", `${dn.replace(/\W+/g, "_")}__${p.replace(/\W+/g, "_")}`);
      try {
        const resp = await page.goto(`${BASE}/${p}`, { waitUntil: "domcontentloaded" });
        if (!resp.ok() && p !== "404.html") rec.failed.push(`${resp.status()} ${p}`);
        await settle(page);
        rec.cls = await page.evaluate(() => window.__cls || 0);
        await scanState(page, "page", rec, shot);
        if (!flag("quick") || dn === "iPhone SE") {
          await page.screenshot({ path: `${shot}-full.png`, fullPage: true }).catch(() => {});
        }
        /* open menu state (below 1024px the burger overlay) */
        const burger = page.locator(".burger");
        if (await burger.isVisible().catch(() => false)) {
          await burger.tap().catch(() => burger.click().catch(() => {}));
          await page.waitForTimeout(1100);
          await scanState(page, "menu", rec, shot);
          await burger.tap().catch(() => burger.click().catch(() => {}));
          await page.waitForTimeout(700);
        }
        /* date sheet state on pages with a date range */
        const dr = page.locator("[data-dr-btn]").first();
        if (await dr.isVisible().catch(() => false)) {
          await dr.scrollIntoViewIfNeeded().catch(() => {});
          await dr.tap().catch(() => dr.click().catch(() => {}));
          await page.waitForTimeout(700);
          await scanState(page, "datepicker", rec, shot);
        }
      } catch (e) { rec.console.push("run-error: " + String(e).slice(0, 200)); }
      await page.close();
      results.push(rec);
      process.stdout.write(`${dn.padEnd(18)} ${p.padEnd(44)} ${summaryLine(rec)}\n`);
    }
    await ctx.close();
  }
  await browser.close();
  server?.kill();

  await writeFile(path.join(out, "report.json"), JSON.stringify(results, null, 2));
  await writeFile(path.join(out, "report.md"), markdown(results));
  await writeFile(path.join(out, "index.html"), contactSheet(results));
  const hard = results.filter((r) => failures(r).hard.length);
  console.log(`\n${results.length} runs · ${hard.length} with hard failures · report: tools/mobile-check/out/report.md`);
  process.exitCode = hard.length ? 1 : 0;
}

/* ---- scoring ---- */
function failures(r) {
  const hard = [], soft = [];
  for (const [st, m] of Object.entries(r.states)) {
    if (m.overflow.length || m.scrollW > m.vw + 1) hard.push(`overflow[${st}] ${m.scrollW}>${m.vw} ${m.overflow[0] || ""}`);
    const tap = m.tap; if (tap.filter((t) => t.hard).length) hard.push(`tap<24[${st}] ${tap.filter((t) => t.hard).length}`);
    if (tap.length) soft.push(`tap<44[${st}] ${tap.length}`);
    if (m.inputFont.length) hard.push(`input<16px[${st}] ${m.inputFont.length}`);
    if (m.smallText.length) soft.push(`text<12px[${st}] ${m.smallText.length}`);
  }
  if (r.axe.length) hard.push(`axe ${r.axe.length}`);
  if (r.console.length) hard.push(`console ${r.console.length}`);
  if (r.failed.length) hard.push(`http ${r.failed.length}`);
  if (r.cls > 0.1) hard.push(`CLS ${r.cls.toFixed(2)}`);
  const pg = r.states.page; if (pg && !pg.meta.viewportFitCover) soft.push("meta:no-viewport-fit");
  if (pg && !pg.meta.themeColor) soft.push("meta:no-theme-color");
  return { hard, soft };
}
const summaryLine = (r) => { const f = failures(r); return f.hard.length ? "FAIL " + f.hard.slice(0, 3).join("; ") : f.soft.length ? "warn " + f.soft.slice(0, 2).join("; ") : "ok"; };

function markdown(results) {
  const tally = {};
  for (const r of results) for (const x of [...failures(r).hard, ...failures(r).soft]) { const k = x.replace(/\[.*?\]|\s.*$/g, ""); (tally[k] ||= new Set()).add(r.page + "@" + r.device); }
  let md = `# Mobile check\n\n${results.length} runs (${[...new Set(results.map((r) => r.device))].join(", ")})\n\n## Rule tally (page@device combos affected)\n\n| rule | combos |\n|---|---|\n`;
  for (const [k, v] of Object.entries(tally).sort((a, b) => b[1].size - a[1].size)) md += `| ${k} | ${v.size} |\n`;
  md += `\n## Per run\n\n`;
  for (const r of results) {
    const f = failures(r);
    md += `### ${r.device} · ${r.page} — ${f.hard.length ? "FAIL" : f.soft.length ? "warn" : "ok"}\n`;
    f.hard.forEach((x) => (md += `- ❌ ${x}\n`)); f.soft.forEach((x) => (md += `- ⚠️ ${x}\n`));
    for (const [st, m] of Object.entries(r.states)) {
      m.overflow.slice(0, 3).forEach((o) => (md += `  - overflow[${st}]: ${o}\n`));
      [...m.tap].sort((a, b) => b.hard - a.hard).slice(0, 6).forEach((t) => (md += `  - tap[${st}]: ${t.s} ${t.w}×${t.h}\n`));
      m.inputFont.slice(0, 3).forEach((o) => (md += `  - input[${st}]: ${o}\n`));
    }
    r.axe.forEach((a) => (md += `  - axe: ${a}\n`)); r.console.slice(0, 3).forEach((c) => (md += `  - console: ${c}\n`)); r.failed.slice(0, 3).forEach((c) => (md += `  - http: ${c}\n`));
    md += "\n";
  }
  return md;
}

function contactSheet(results) {
  const byDev = {};
  for (const r of results) (byDev[r.device] ||= []).push(r);
  const cell = (r) => `<figure><img loading="lazy" src="shots/${r.device.replace(/\W+/g, "_")}__${r.page.replace(/\W+/g, "_")}-page.png"><figcaption>${r.page}<br><small>${summaryLine(r)}</small></figcaption></figure>`;
  return `<!doctype html><meta charset=utf-8><title>Mobile contact sheet</title><style>body{font:13px system-ui;margin:1rem;background:#111;color:#eee}h2{margin:2rem 0 .5rem}.row{display:flex;gap:12px;overflow-x:auto;padding-bottom:1rem}figure{margin:0;flex:none;width:220px}img{width:220px;border-radius:8px;border:1px solid #333}small{color:#9ab}</style>${Object.entries(byDev).map(([d, rs]) => `<h2>${d}</h2><div class=row>${rs.map(cell).join("")}</div>`).join("")}`;
}

run().catch((e) => { console.error(e); process.exit(2); });
