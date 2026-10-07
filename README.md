# Villa Maré

A premium private-beachfront-villa website: **plain HTML, CSS and JavaScript**, no build step. Libraries load from CDNs (GSAP + ScrollTrigger + Flip for animation, Lenis for smooth scroll). All photography was generated with the **Codex CLI**.

> **Everything is a demo.** The brand, copy, prices, policies and "payments" are placeholders. The checkout never contacts a server and no card number is ever stored.

## Live

**https://villa.harshit-garg.com** — served by GitHub Pages from `main` (the `CNAME` file holds the domain). Pushing to `main` redeploys.

## Run

Open `index.html`, or serve the folder with any static server:

```powershell
npx http-server . -p 8080 -c-1
```

Unit tests (pricing, availability, cards): open `/tests.html` — the tab title reads `PASS n/n`.

## Pages

| Page | What it does |
|---|---|
| `index.html` | Hero, **quick booking bar**, suites, offers, reviews carousel, area map, journal teaser, FAQ |
| `villa.html` · `suites.html` · `suite.html?id=` | Overview, floor plan, day timeline · suite list with filters · suite detail (gallery, floor plan) |
| `experiences.html` | Experiences with **“Add to your stay”** (writes into the checkout draft) |
| `rates.html` | Season table, 12-month **availability calendar**, live **price estimator** |
| `checkout.html` | Simulated 5-step booking: stay → extras → details → payment → confirmed |
| `booking.html` | Manage a booking: lookup, itinerary, `.ics`, print, **cancel with refund tier** |
| `journal.html` · `article.html?slug=` | Stories with category chips + search · article with reading-progress bar |
| `team.html`, `gallery.html`, `contact.html`, `policies.html`, `404.html` | Supporting pages |

### Header: bar ⇄ rail
At the top the header is a normal bar (with a “The Villa” mega-menu). Scroll past ~60 % of the viewport (desktop) and it **morphs (GSAP Flip) into a slim glass rail on the right edge** with a monogram, section dots for the current page and a vertical *Book now*. Hover/click the menu button to expand a full side panel (links + page section index). Scroll back to the top and it morphs back. Below 1024 px it is a burger menu plus a sticky bottom *Reserve* bar. Respects `prefers-reduced-motion`.

## The booking model

All money is **integer cents**.

- `js/data.js` — single source of truth: seasons, fees, extras, promo codes, suites, staff, journal, FAQ, policies, demo cards.
- `js/pricing.js` — `VM.pricing.quote(...)`: per-night season pricing, minimum stays by season, promo codes, extras (clamped by nights/guests), service charge, tax, **30 % deposit / balance 30 days before** (full payment inside 30 days), cancellation tiers.
- `js/availability.js` — deterministic “already booked” nights seeded per calendar month (never goes stale) **plus** any booking you complete in the checkout, so dates really become unavailable.
- `js/cards.js` — Luhn, brand detection, formatting, expiry/CVC validation, simulated processor outcomes.

Promo codes: `WELCOME10` (10 %), `EARLY15` (arrival ≥ 90 days away), `LONGSTAY` (7+ nights → one night free).

### Demo checkout test cards

| Number | Result |
|---|---|
| `4242 4242 4242 4242` | Succeeds |
| `4000 0000 0000 0002` | Declined |
| `4000 0027 6000 3184` | Needs 3-D Secure — code `123456` (3 attempts) |

Any future expiry and any 3-digit code. Handy flags: `checkout.html?hold=10` (10-second date hold, to see expiry) and `?fail=network` (first payment attempt times out).

Behaviour covered: hash routing with guards, draft saved in `localStorage` and resumed on refresh, 15-minute date hold with extend/restart, dates taken mid-flow recovery, double-submit/idempotency, back button after confirmation, bank-transfer path (reserved, awaiting payment), `.ics` download, printable receipt.

## Custom UI components (`js/ui.js`)

No native `<select>` or `<input type="date">`: listbox **select** (typeahead), **date-range picker** (one shared popover, blocked nights, minimum stays, nightly prices, bottom sheet on phones), **steppers** with shared caps, **dialogs** with focus traps, **toasts**. Values live in hidden inputs and dispatch `change`.

## Mobile

`css/mobile.css` (loaded last) holds the phone layer: 44px tap targets, 16px inputs (no iOS focus-zoom), safe-area insets (`viewport-fit=cover`), `dvh` units, the numbered phone menu, the swipe strip for suites, the accordion footer and the date-sheet grab handle. `js/mobile.js` adds keyboard-aware chrome (fixed bars hide while typing) and Enter-key labels. The gallery lightbox is **PhotoSwipe 5** (pinch-zoom, swipe, drag-to-close) with the built-in lightbox as fallback if the CDN script fails.

**Mobile check** (dev-only, never deployed): `tools/` holds a Playwright harness that drives your installed Chrome with phone/tablet emulation.

```powershell
cd tools; npm install
npm run mobile:quick     # 7 key pages x 3 phones, ~5 min
npm run mobile           # every page x 5 devices, ~40 min
```

It checks horizontal overflow, tap targets (<24px is a hard fail, <44px a warning), input font size, axe (WCAG 2.2 AA), console/HTTP errors and layout shift, and writes `tools/mobile-check/out/report.md` plus a screenshot contact sheet (`index.html`). Lighthouse is a devDependency too: serve with `npx http-server . -p 8081 --gzip` and run `node node_modules/lighthouse/cli/index.js http://localhost:8081/index.html`. Emulation is not real Safari, so do a quick check on a physical phone after deploys.

## Images (Codex CLI)

```powershell
# generate anything missing from scripts/images.json into assets/originals/
powershell -File scripts/generate-images.ps1 -Parallel 3
powershell -File scripts/generate-images.ps1 -Group suites,team          # only some groups
powershell -File scripts/generate-images.ps1 -Only hero-dusk -Force      # redo one
# convert originals → assets/img/<name>.jpg and <name>-800.jpg
powershell -File scripts/optimize-images.ps1
```

Edit `scripts/images.json` to change the shared style line or any prompt. Per-image Codex output is logged in `scripts/logs/`. Lazy images get an `800w` `srcset` at runtime (`js/layout.js`).

## Structure

```
css/style.css      design tokens + base components     css/pages.css   page-specific styles, checkout, print
js/core.js         VM namespace, dates, money          js/store.js     versioned localStorage + bookings
js/data.js         content & rates                     js/pricing.js   quote engine
js/availability.js js/cards.js js/booking.js js/render.js
js/layout.js       header (bar⇄rail), panel, footer, book bar
js/ui.js           custom controls                     js/motion.js    Lenis + GSAP choreography (data-* hooks)
js/checkout.js     the 5-step flow                     js/pages/*.js   per-page scripts
scripts/           image generation + optimisation     tests.html + js/tests/  unit tests
```

`js/motion.js` hooks: `data-split` · `data-reveal` · `data-stagger` · `data-mask` · `data-parallax` · `data-drift="px"` · `data-count="n"` · `data-marquee` · `data-hscroll`. Page-level: `data-section="Label"` (rail dots), `data-header="solid"`, `data-nobookbar`, `data-nocurtain`.

## Placeholders to replace

Search for “Villa Maré”, `villamare.example` (placeholder email addresses), and the prices in `js/data.js`. Imagery is AI-generated.
