/* Suite detail page: rendered from VM.data.suites using ?id=. Runs BEFORE layout/motion so the
   injected sections are picked up by the rail's section index and the scroll animations. */
(() => {
  const { data, render, esc } = VM;
  const main = document.getElementById("main");
  const id = VM.qs().id;
  const suite = data.suites.find((s) => s.id === id);

  if (!suite) {
    document.title = "Suite not found — Villa Maré";
    main.innerHTML = `<section class="section center" data-section="Not found" style="min-height:70vh;display:grid;align-content:center">
      <div class="wrap stack"><span class="eyebrow">Suite not found</span><h1>We couldn't find that suite</h1>
      <p class="lead">It may have been renamed. Browse all four suites instead.</p><a class="btn" href="suites.html">View suites</a></div></section>`;
    document.body.dataset.header = "solid";
    return;
  }

  document.title = `${suite.name} — Villa Maré`;
  document.querySelector('meta[name="description"]').content = suite.blurb;

  const plan = render.plan(suite.id, `Floor plan of the villa with ${suite.name} highlighted`);

  const others = data.suites.filter((s) => s.id !== suite.id).map(render.suiteCard).join("");
  const ratios = ["ratio-32", "ratio-32", "ratio-45"];

  main.innerHTML = `
    <section class="hero page-hero" data-section="Top">
      <div class="hero__media">${render.img(suite.images[0], suite.name, 'fetchpriority="high"')}</div>
      <div class="hero__content wrap"><span class="eyebrow">${esc(suite.tag)} · ${esc(suite.floor)} level</span><h1 data-split>${esc(suite.name)}</h1></div>
    </section>

    <section class="section" data-section="Overview">
      <div class="wrap">
        <div class="spec-grid" data-stagger>
          <div><b>${esc(suite.bed)}</b><span>Bed</span></div><div><b>${suite.sleeps}</b><span>Sleeps</span></div>
          <div><b>${suite.size} m²</b><span>Size</span></div><div><b>${esc(suite.tag.split(" ")[0])}</b><span>View</span></div>
        </div>
        <div class="grid-2" style="margin-top:4rem;align-items:start">
          <div class="stack"><span class="eyebrow" data-reveal>The room</span><h2 data-split>${esc(suite.blurb)}</h2></div>
          <div class="stack"><p class="lead" data-reveal>${esc(suite.long)}</p>
            <ul class="feature-list" data-stagger>${suite.features.map((f) => `<li>${esc(f)}</li>`).join("")}</ul></div>
        </div>
      </div>
    </section>

    <section class="section section--sand" data-section="Gallery">
      <div class="wrap"><div class="masonry">
        ${suite.images.map((n, i) => `<figure class="${ratios[i] || "ratio-32"}" data-cat="suite"><img src="assets/img/${n}.jpg" alt="${esc(suite.name)} — view ${i + 1}" loading="lazy" /><figcaption>${esc(suite.name)}</figcaption></figure>`).join("")}
      </div></div>
    </section>

    <section class="section" data-section="Floor plan">
      <div class="wrap grid-2">
        <div class="stack"><span class="eyebrow" data-reveal>Where it sits</span><h2 data-split>Find your way around</h2>
          <p class="lead" data-reveal>${esc(suite.name)} is highlighted. Every suite opens to the pool terrace; the beach is twelve steps from the water's edge.</p>
          <a class="btn btn--solid" href="rates.html" data-reveal>Check availability</a></div>
        <div class="plan" data-reveal>${plan}</div>
      </div>
    </section>

    <section class="section section--sand" data-section="Other suites">
      <div class="wrap"><div class="stack" style="margin-bottom:3rem"><span class="eyebrow" data-reveal>Also in the villa</span><h2 data-split>The other suites</h2></div>
        <div class="mini-suites">${others}</div></div>
    </section>

    <section class="section cta" data-section="Reserve">
      <div class="cta__bg">${render.img("aerial-coast", "", 'loading="lazy"')}</div>
      <div class="wrap"><span class="eyebrow" data-reveal>Reserve</span><h2 data-split>Stay in ${esc(suite.name.replace(" Suite", ""))}</h2>
        <a class="btn btn--light" href="checkout.html" data-reveal>Book the villa</a></div>
    </section>`;

  /* structured data */
  const ld = document.createElement("script");
  ld.type = "application/ld+json";
  ld.textContent = JSON.stringify({ "@context": "https://schema.org", "@type": "HotelRoom", name: suite.name, description: suite.long, bed: { "@type": "BedDetails", typeOfBed: suite.bed }, occupancy: { "@type": "QuantitativeValue", maxValue: suite.sleeps }, floorSize: { "@type": "QuantitativeValue", value: suite.size, unitCode: "MTK" } });
  document.head.append(ld);
})();
