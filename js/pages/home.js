/* Home page: quick booking bar, suites, offers, reviews carousel, area list, journal teaser, FAQ.
   Runs before layout/motion so injected markup joins the rail index and scroll animations. */
(() => {
  const { $, $$, data, render, esc, date, money } = VM;

  /* ---- suites strip ---- */
  $("#home-suites").innerHTML = data.suites.map(render.suiteCard).join("");

  /* ---- offers ---- */
  const offerFor = { WELCOME10: "Welcome offer", EARLY15: "Book early", LONGSTAY: "Stay longer" };
  $("#offers").innerHTML = Object.entries(data.promos)
    .map(([code, p]) => `<article class="offer"><span class="eyebrow">${offerFor[code]}</span><h3>${esc(p.label)}</h3><p>${esc(p.desc)}</p>
        <div class="offer__code"><code>${code}</code><button type="button" class="link" data-copy="${code}">Copy code</button></div></article>`)
    .join("");
  $("#offers").addEventListener("click", async (e) => {
    const b = e.target.closest("[data-copy]");
    if (!b) return;
    try { await navigator.clipboard.writeText(b.dataset.copy); VM.toast(`${b.dataset.copy} copied — apply it at checkout.`, { type: "success" }); }
    catch (err) { VM.toast(`Your code is ${b.dataset.copy}.`); }
  });

  /* ---- journal teaser + faq ---- */
  const latest = [...data.journal].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 3);
  $("#home-posts").innerHTML = latest
    .map((p) => `<a class="post-card" href="article.html?slug=${p.slug}" data-reveal><div class="img-mask ratio-32">${render.img(p.cover, p.title, 'loading="lazy"')}</div>
        <div class="post-meta" style="margin-top:.9rem"><b>${esc(p.cat)}</b><span>${p.mins} min read</span></div><h3>${esc(p.title)}</h3><p>${esc(p.excerpt)}</p></a>`)
    .join("");
  $("#home-faq").innerHTML = data.faq.slice(0, 5).map((f) => `<details><summary>${esc(f.q)}</summary><p>${esc(f.a)}</p></details>`).join("");

  /* ---- area list ⇄ map highlighting ---- */
  $("#places").innerHTML = data.places.map((p) => `<li data-id="${p.id}" tabindex="0"><b>${esc(p.name)}</b><span>${esc(p.time)}</span></li>`).join("");
  const mark = (id, on) => $$(`.mk[data-id="${id}"]`).forEach((m) => m.classList.toggle("is-on", on));
  $$("#places li").forEach((li) => {
    ["pointerenter", "focus"].forEach((ev) => li.addEventListener(ev, () => mark(li.dataset.id, true)));
    ["pointerleave", "blur"].forEach((ev) => li.addEventListener(ev, () => mark(li.dataset.id, false)));
  });
  mark("villa", true);

  /* ---- reviews carousel: native scroll-snap + buttons, dots and arrow keys ---- */
  const track = $("#reviews-track"), dots = $("#reviews-dots");
  track.innerHTML = data.reviews.map((r, i) => `<figure class="review" role="group" aria-roledescription="slide" aria-label="${i + 1} of ${data.reviews.length}"><blockquote>“${esc(r.q)}”</blockquote><figcaption><b>${esc(r.who)}</b><span>${esc(r.meta)}</span></figcaption></figure>`).join("");
  dots.innerHTML = data.reviews.map((_, i) => `<button type="button" role="tab" aria-label="Review ${i + 1}" aria-selected="${i === 0}"></button>`).join("");
  const slides = $$(".review", track);
  let active = 0;
  const goTo = (i) => {
    active = (i + slides.length) % slides.length;
    track.scrollTo({ left: slides[active].offsetLeft - track.offsetLeft, behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  };
  const markDot = (i) => $$("button", dots).forEach((d, n) => d.setAttribute("aria-selected", String(n === i)));
  let raf;
  track.addEventListener("scroll", () => {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => {
      const i = Math.round(track.scrollLeft / track.clientWidth);
      if (i !== active) active = i;
      markDot(Math.min(Math.max(i, 0), slides.length - 1));
    });
  }, { passive: true });
  $("#reviews").addEventListener("click", (e) => {
    const nav = e.target.closest("[data-dir]");
    if (nav) goTo(active + Number(nav.dataset.dir));
    const d = e.target.closest('[role="tab"]');
    if (d) goTo($$("button", dots).indexOf(d));
  });
  track.addEventListener("keydown", (e) => {
    if (e.key === "ArrowRight") { e.preventDefault(); goTo(active + 1); }
    if (e.key === "ArrowLeft") { e.preventDefault(); goTo(active - 1); }
  });

  /* ---- quick booking bar → checkout (dates in the query are not personal data) ---- */
  const form = $("#quick");
  const dr = form._dr;
  const err = $("#quick-err");
  form.addEventListener("change", () => (err.textContent = ""));
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const { arrive, depart } = dr.get();
    if (!arrive || !depart) {
      err.textContent = !arrive ? "Choose your arrival date." : "Choose your departure date.";
      dr.open(!arrive ? "arrive" : "depart");
      return;
    }
    const q = VM.pricing.quote({ arrive, depart, adults: form.elements.guests.value, children: 0 });
    if (!q.ready) { err.textContent = q.errors.join(" "); return; }
    const p = new URLSearchParams({ arrive, depart, adults: form.elements.guests.value, children: 0 });
    location.href = "checkout.html?" + p;
  });
})();
