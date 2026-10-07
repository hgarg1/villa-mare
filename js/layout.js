/* Shared chrome: curtain, header (bar ⇄ right-edge rail morph), menu panel, footer, mobile book bar.
   Plain script so it works over file://. Depends on core.js; uses GSAP + Flip when present. */
(() => {
  const VM = (window.VM = window.VM || {});
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const reduceMq = matchMedia("(prefers-reduced-motion: reduce)");
  const deskMq = matchMedia("(min-width: 1024px)");
  const hoverMq = matchMedia("(hover: hover) and (pointer: fine)");
  if (window.gsap && window.Flip) gsap.registerPlugin(window.Flip);

  /* ---------------- navigation model ---------------- */
  const PAGE = location.pathname.split("/").pop() || "index.html";
  const GROUP_OF = { "suite.html": "suites.html", "article.html": "journal.html" };
  const current = GROUP_OF[PAGE] || PAGE;
  const NAV = [
    { href: "index.html", label: "Home" },
    {
      label: "The Villa",
      items: [
        { href: "villa.html", label: "Overview", sub: "Spaces & amenities" },
        { href: "suites.html", label: "Suites", sub: "Four ocean & garden suites" },
        { href: "gallery.html", label: "Gallery", sub: "Light, sand & stone" },
        { href: "team.html", label: "The team", sub: "Chef, captain & concierge" },
      ],
    },
    { href: "experiences.html", label: "Experiences" },
    { href: "rates.html", label: "Rates" },
    { href: "journal.html", label: "Journal" },
    { href: "contact.html", label: "Contact" },
  ];
  const flat = NAV.flatMap((n) => n.items || [n]);
  const isCurrent = (href) => href === current;
  const link = (n) => `<a href="${n.href}"${isCurrent(n.href) ? ' aria-current="page"' : ""}>${n.label}</a>`;

  const navHTML = NAV.map((n, i) =>
    n.items
      ? `<div class="nav__group">
           <button type="button" class="nav__trigger${n.items.some((x) => isCurrent(x.href)) ? " is-current" : ""}" aria-expanded="false" aria-controls="mega-${i}">${n.label}<svg viewBox="0 0 12 12" width="9" height="9" aria-hidden="true"><path d="m2 4 4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.3"/></svg></button>
           <div class="mega" id="mega-${i}">${n.items.map((x) => `<a href="${x.href}"${isCurrent(x.href) ? ' aria-current="page"' : ""}><b>${x.label}</b><span>${x.sub}</span></a>`).join("")}</div>
         </div>`
      : link(n)
  ).join("");

  const fromPrice = (() => {
    try { return VM.money.fmt(Math.min(...VM.data.seasons.map((s) => s.nightly))); } catch (e) { return "$1,800"; }
  })();

  /* ---------------- markup ---------------- */
  const header = `
    <a class="skip-link" href="#main">Skip to content</a>
    <header class="site-header" id="site-header" data-state="bar">
      <a class="logo" href="index.html" aria-label="Villa Maré, home">
        <span class="logo__full">Villa Maré<small>Private Beachfront</small></span>
        <span class="logo__mark" aria-hidden="true">M</span>
      </a>
      <nav class="nav" id="site-nav" aria-label="Main">
        ${navHTML}
        <a class="btn btn--light nav__cta-mobile" href="checkout.html">Book now</a>
      </nav>
      <a class="btn btn--light header__cta" href="checkout.html"><span>Book now</span></a>
      <div class="rail__dots" role="list" aria-label="Sections on this page"></div>
      <button class="rail__menu" type="button" aria-label="Open menu" aria-expanded="false" aria-controls="rail-panel"><span></span><span></span><span></span></button>
      <button class="burger" aria-label="Menu" aria-expanded="false" aria-controls="site-nav"><span></span><span></span></button>
    </header>
    <aside class="rail-panel" id="rail-panel" aria-label="Site menu" inert>
      <div class="rail-panel__inner" data-lenis-prevent>
        <p class="rail-panel__label">Menu</p>
        <nav class="rail-panel__nav" aria-label="Pages">${flat.map(link).join("")}</nav>
        <p class="rail-panel__label">On this page</p>
        <ol class="rail-panel__sections"></ol>
        <div class="rail-panel__foot">
          <a class="btn btn--light" href="checkout.html">Book your stay</a>
          <p>${VM.data ? VM.esc(VM.data.villa.email) : "stay@villamare.example"}<br />${VM.data ? VM.esc(VM.data.villa.phone) : "+00 000 000 000"}</p>
        </div>
      </div>
      <button type="button" class="rail-panel__more" aria-label="Scroll for more links" tabindex="-1"><span>Scroll for more</span><svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true"><path d="m2 4 4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.3"/></svg></button>
    </aside>`;

  const footer = `
    <footer class="site-footer">
      <div class="wrap">
        <div class="footer__top">
          <div class="stack">
            <a class="logo" href="index.html">Villa Maré</a>
            <p style="max-width:22rem;opacity:.75">A private beachfront villa for slow mornings, long dinners and nothing on the calendar.</p>
            <form class="newsletter" id="newsletter" novalidate>
              <label for="nl-email" class="sr-only">Email address</label>
              <input id="nl-email" type="email" placeholder="Your email for the occasional letter" autocomplete="email" data-format="email" />
              <button type="submit" aria-label="Subscribe">→</button>
              <span class="err" role="alert"></span>
            </form>
          </div>
          <div><h4>Explore</h4><ul>
            <li><a href="villa.html">The Villa</a></li>
            <li><a href="suites.html">Suites</a></li>
            <li><a href="experiences.html">Experiences</a></li>
            <li><a href="gallery.html">Gallery</a></li>
            <li><a href="team.html">The team</a></li>
            <li><a href="journal.html">Journal</a></li></ul></div>
          <div><h4>Stay</h4><ul>
            <li><a href="rates.html">Rates &amp; availability</a></li>
            <li><a href="checkout.html">Book now</a></li>
            <li><a href="booking.html">Manage booking</a></li>
            <li><a href="contact.html">Enquire</a></li>
            <li><a href="policies.html">Policies</a></li></ul></div>
          <div><h4>Contact</h4><ul>
            <li><a href="mailto:stay@villamare.example">stay@villamare.example</a></li>
            <li>+00 000 000 000</li>
            <li>Maré Bay · 45 min from the airport</li></ul></div>
        </div>
        <div class="footer__bottom"><span>© <span id="yr"></span> Villa Maré. Placeholder brand &amp; copy · demo booking, no real payments.</span><span><a href="policies.html#terms">Terms</a> · <a href="policies.html#privacy">Privacy</a> · Imagery generated with AI.</span></div>
      </div>
    </footer>`;

  const bookbar = `
    <div class="bookbar" id="bookbar">
      <p><small>From</small> <b>${fromPrice}</b> <span>/ night</span></p>
      <a class="btn btn--solid" href="checkout.html">Reserve</a>
    </div>`;

  document.body.insertAdjacentHTML("afterbegin", header);
  document.body.insertAdjacentHTML("beforeend", footer);
  if (!document.body.hasAttribute("data-nobookbar")) document.body.insertAdjacentHTML("beforeend", bookbar);
  if (!document.body.hasAttribute("data-nocurtain")) {
    document.body.insertAdjacentHTML("beforeend", '<div class="curtain" id="curtain" aria-hidden="true"><span>Villa Maré</span></div>');
    setTimeout(() => $("#curtain")?.remove(), 5000); // never trap the page if the animation library fails
  }
  $("#yr").textContent = new Date().getFullYear();

  /* responsive images: lazy images get an 800w variant for small screens (heroes stay as-is to avoid a double fetch) */
  const SIZES = [
    [".strip", "(max-width: 860px) 34vw, 17vw"],
    [".masonry", "(max-width: 560px) 100vw, (max-width: 960px) 50vw, 33vw"],
    [".suite-strip", "(max-width: 560px) 100vw, (max-width: 1100px) 50vw, 25vw"],
    [".post-grid, .cards, .suite-grid, .mini-suites", "(max-width: 960px) 100vw, 33vw"],
    [".cta__bg, .article-cover", "100vw"],
  ];
  const addSrcset = () =>
    $$('img[loading="lazy"][src^="assets/img/"]').forEach((img) => {
      const m = img.getAttribute("src").match(/^(assets\/img\/[\w-]+)\.jpg$/);
      if (!m || img.srcset) return;
      img.srcset = `${m[1]}-800.jpg 800w, ${m[1]}.jpg 1536w`;
      img.sizes = (SIZES.find(([sel]) => img.closest(sel)) || [0, "(max-width: 900px) 100vw, 50vw"])[1];
    });
  // run after every synchronous page script (home.js, rates.js, …) has injected its images
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", addSrcset);
  else addSrcset();

  /* newsletter (demo) */
  $("#newsletter").addEventListener("submit", (e) => {
    e.preventDefault();
    const input = $("#nl-email"), err = $("#newsletter .err");
    if (!/^\S+@\S+\.\S+$/.test(input.value)) { err.textContent = "Please enter a valid email."; input.focus(); return; }
    err.textContent = "";
    input.value = "";
    (VM.toast || alert)("Thank you — you're on the list (demo: nothing was sent).", { type: "success" });
  });

  /* ---------------- elements ---------------- */
  const el = $("#site-header");
  const logo = $(".logo", el);
  const cta = $(".header__cta", el);
  const burger = $(".burger", el);
  const railMenu = $(".rail__menu", el);
  const dotsEl = $(".rail__dots", el);
  const panel = $("#rail-panel");
  const panelSections = $(".rail-panel__sections", panel);
  const panelScroll = $(".rail-panel__inner", panel);
  const moreCue = $(".rail-panel__more", panel);
  const bookbarEl = $("#bookbar");
  const solidAlways = document.body.dataset.header === "solid";
  const lenis = (fn) => window.__lenis && window.__lenis[fn]();

  const scrollToEl = (target) => {
    if (window.__lenis) window.__lenis.scrollTo(target, { offset: -24, duration: 1.3 });
    else target.scrollIntoView({ behavior: reduceMq.matches ? "auto" : "smooth" });
  };

  /* ---------------- page sections → dots + panel index ---------------- */
  const sections = $$("main > section").map((s, i) => {
    const label = s.dataset.section || (s.classList.contains("hero") && i === 0 ? "Top" : s.querySelector(".eyebrow")?.textContent.trim() || s.querySelector("h1, h2")?.textContent.trim() || "Section");
    return { el: s, label: label.replace(/\s+/g, " ").slice(0, 32) };
  });
  dotsEl.innerHTML = sections.map((s, i) => `<button type="button" role="listitem" class="rail__dot" data-i="${i}" aria-label="Go to: ${VM.esc ? VM.esc(s.label) : s.label}"><i></i><span>${VM.esc ? VM.esc(s.label) : s.label}</span></button>`).join("");
  panelSections.innerHTML = sections.map((s, i) => `<li><button type="button" data-i="${i}">${VM.esc ? VM.esc(s.label) : s.label}</button></li>`).join("");
  let activeSection = -1;
  const setActiveSection = (i) => {
    if (i === activeSection) return;
    activeSection = i;
    $$(".rail__dot", el).forEach((d, n) => d.classList.toggle("is-active", n === i));
    $$("button", panelSections).forEach((b, n) => { b.classList.toggle("is-active", n === i); n === i ? b.setAttribute("aria-current", "true") : b.removeAttribute("aria-current"); });
  };
  const go = (e) => {
    const b = e.target.closest("[data-i]");
    if (!b) return;
    scrollToEl(sections[+b.dataset.i].el);
    if (panelOpen) closePanel(false);
  };
  dotsEl.addEventListener("click", go);
  panelSections.addEventListener("click", go);
  if ("IntersectionObserver" in window && sections.length) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => { if (en.isIntersecting) setActiveSection(sections.findIndex((s) => s.el === en.target)); });
    }, { rootMargin: "-45% 0px -50% 0px" });
    sections.forEach((s) => io.observe(s.el));
  }

  /* ---------------- state machine: bar ⇄ rail ---------------- */
  let state = "bar";
  let animating = false;
  let panelOpen = false;

  const barSolid = () => solidAlways || scrollY > 80;

  function applyState(next) {
    state = next;
    el.dataset.state = next;
    el.classList.toggle("is-rail", next === "rail");
    el.classList.toggle("is-solid", next === "bar" && barSolid());
    document.body.classList.toggle("has-rail", next === "rail");
  }

  function morph(next) {
    if (next === state || animating) return;
    const useFlip = window.Flip && window.gsap && !reduceMq.matches;
    if (!useFlip) { applyState(next); return; }
    const fs = Flip.getState([el, logo, cta], { props: "borderRadius,backgroundColor,boxShadow" });
    el.classList.add("is-morphing"); // pause CSS transitions so they don't fight Flip
    applyState(next);
    animating = true;
    Flip.from(fs, {
      duration: 0.85, ease: "power3.inOut", scale: false,
      onComplete: () => { animating = false; el.classList.remove("is-morphing"); onScroll(); },
    });
    const incoming = next === "rail" ? [dotsEl, railMenu] : [$(".nav", el)];
    gsap.fromTo(incoming, { opacity: 0 }, { opacity: 1, duration: 0.45, delay: 0.4, ease: "power2.out", clearProps: "opacity" });
  }

  let lastY = scrollY;
  function onScroll() {
    const y = scrollY;
    if (deskMq.matches) {
      if (state === "bar" && y > innerHeight * 0.6) morph("rail");
      else if (state === "rail" && y < 120 && !panelOpen) morph("bar");
      if (state === "bar" && !animating) el.classList.toggle("is-solid", barSolid());
      el.classList.remove("is-hidden");
    } else {
      el.classList.toggle("is-solid", barSolid());
      if (!el.classList.contains("menu-open")) el.classList.toggle("is-hidden", y > lastY && y > 400);
    }
    bookbarEl?.classList.toggle("is-visible", !deskMq.matches && y > innerHeight * 0.55);
    lastY = y;
  }
  addEventListener("scroll", onScroll, { passive: true });
  deskMq.addEventListener?.("change", () => {
    closePanel(false);
    applyState("bar");
    el.classList.remove("is-hidden", "menu-open");
    onScroll();
  });
  // restore position after reload: jump straight into the right state, no morph
  applyState("bar");
  if (deskMq.matches && scrollY > innerHeight * 0.6) applyState("rail");
  onScroll();

  /* ---------------- rail panel (expanded) ---------------- */
  // no visible scrollbar: a "Scroll for more" cue shows only while there is content below the fold
  const updateMore = () => panel.classList.toggle("has-more", panelScroll.scrollHeight - panelScroll.scrollTop - panelScroll.clientHeight > 8);
  panelScroll.addEventListener("scroll", updateMore, { passive: true });
  addEventListener("resize", updateMore);
  moreCue.addEventListener("click", () => panelScroll.scrollBy({ top: Math.max(120, panelScroll.clientHeight * 0.7), behavior: reduceMq.matches ? "auto" : "smooth" }));
  let hoverTimer, leaveTimer;
  function openPanel(focus = true) {
    if (panelOpen || state !== "rail") return;
    panelOpen = true;
    panel.removeAttribute("inert");
    panel.classList.add("is-open");
    railMenu.setAttribute("aria-expanded", "true");
    railMenu.setAttribute("aria-label", "Close menu");
    el.classList.add("is-expanded");
    updateMore();
    if (focus) $("a", panel)?.focus();
  }
  function closePanel(returnFocus = true) {
    if (!panelOpen) return;
    panelOpen = false;
    panel.classList.remove("is-open");
    panel.setAttribute("inert", "");
    railMenu.setAttribute("aria-expanded", "false");
    railMenu.setAttribute("aria-label", "Open menu");
    el.classList.remove("is-expanded");
    if (returnFocus) railMenu.focus();
    onScroll();
  }
  railMenu.addEventListener("click", () => (panelOpen ? closePanel() : openPanel()));
  addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      if (panelOpen) closePanel();
      closeMega();
      setMobileMenu(false);
    }
  });
  document.addEventListener("pointerdown", (e) => {
    if (panelOpen && !panel.contains(e.target) && !el.contains(e.target)) closePanel(false);
  });
  // hover-intent open/close for mouse users
  const hoverTargets = [el, panel];
  hoverTargets.forEach((t) => {
    t.addEventListener("pointerenter", (e) => {
      if (!hoverMq.matches || state !== "rail" || e.pointerType !== "mouse") return;
      clearTimeout(leaveTimer);
      if (!panelOpen) hoverTimer = setTimeout(() => openPanel(false), 220);
    });
    t.addEventListener("pointerleave", (e) => {
      if (!hoverMq.matches || e.pointerType !== "mouse") return;
      clearTimeout(hoverTimer);
      leaveTimer = setTimeout(() => panelOpen && closePanel(false), 320);
    });
  });
  panel.addEventListener("click", (e) => { if (e.target.closest("a")) closePanel(false); });

  /* ---------------- mega menu (bar state) ---------------- */
  const trigger = $(".nav__trigger", el);
  const group = $(".nav__group", el);
  const closeMega = () => {
    group?.classList.remove("is-open");
    trigger?.setAttribute("aria-expanded", "false");
  };
  const openMega = () => {
    if (state !== "bar" || !deskMq.matches) return;
    group.classList.add("is-open");
    trigger.setAttribute("aria-expanded", "true");
  };
  if (trigger) {
    trigger.addEventListener("click", () => (group.classList.contains("is-open") ? closeMega() : openMega()));
    let megaTimer;
    group.addEventListener("pointerenter", (e) => { if (e.pointerType === "mouse") { clearTimeout(megaTimer); openMega(); } });
    group.addEventListener("pointerleave", (e) => { if (e.pointerType === "mouse") megaTimer = setTimeout(closeMega, 200); });
    group.addEventListener("focusout", (e) => { if (!group.contains(e.relatedTarget)) closeMega(); });
    document.addEventListener("pointerdown", (e) => { if (!group.contains(e.target)) closeMega(); });
  }

  /* ---------------- mobile menu (below 1024px) ---------------- */
  function setMobileMenu(open) {
    if (deskMq.matches) return;
    el.classList.toggle("menu-open", open);
    burger.setAttribute("aria-expanded", String(open));
    lenis(open ? "stop" : "start");
    if (!window.__lenis) document.documentElement.style.overflow = open ? "hidden" : "";
  }
  burger.addEventListener("click", () => setMobileMenu(!el.classList.contains("menu-open")));
  $$(".nav a", el).forEach((a) => a.addEventListener("click", () => setMobileMenu(false)));

  VM.header = { get state() { return state; }, openPanel, closePanel, solidAlways };
})();
