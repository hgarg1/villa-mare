/* Article page: rendered from VM.data.journal using ?slug=. Runs before layout/motion. */
(() => {
  const { $, data, render, esc, date } = VM;
  const main = $("#main");
  const posts = [...data.journal].sort((a, b) => b.date.localeCompare(a.date));
  const idx = posts.findIndex((p) => p.slug === VM.qs().slug);
  const post = posts[idx];
  const fmt = (iso) => date.fmt(date.parse(iso), { day: "numeric", month: "long", year: "numeric" });

  if (!post) {
    document.title = "Story not found — Villa Maré";
    main.innerHTML = `<section class="section center" data-section="Not found" style="min-height:70vh;display:grid;align-content:center">
      <div class="wrap stack"><span class="eyebrow">Story not found</span><h1>That story has drifted away</h1>
      <p class="lead">Try the journal for everything else.</p><a class="btn" href="journal.html">Back to the journal</a></div></section>`;
    $(".read-progress")?.remove();
    return;
  }

  document.title = `${post.title} — Villa Maré`;
  document.querySelector('meta[name="description"]').content = post.excerpt;

  const body = post.body
    .map((b) => {
      if (b.t === "h2") return `<h2>${esc(b.text)}</h2>`;
      if (b.t === "quote") return `<blockquote data-reveal>${esc(b.text)}</blockquote>`;
      if (b.t === "img") return `<figure data-reveal>${render.img(b.src, b.alt, 'loading="lazy"')}<figcaption>${esc(b.cap)}</figcaption></figure>`;
      return `<p>${esc(b.text)}</p>`;
    })
    .join("");

  const related = posts
    .filter((p) => p.slug !== post.slug)
    .sort((a, b) => (b.cat === post.cat) - (a.cat === post.cat))
    .slice(0, 3)
    .map((p) => `<a class="post-card" href="article.html?slug=${p.slug}" data-reveal><div class="img-mask ratio-32">${render.img(p.cover, p.title, 'loading="lazy"')}</div>
        <div class="post-meta" style="margin-top:.9rem"><b>${esc(p.cat)}</b><span>${p.mins} min read</span></div><h3>${esc(p.title)}</h3></a>`)
    .join("");

  const prev = posts[idx + 1], next = posts[idx - 1]; // list is newest-first
  const pn = (p, label) => (p ? `<a href="article.html?slug=${p.slug}"><small>${label}</small><b>${esc(p.title)}</b></a>` : "<span></span>");

  main.innerHTML = `
    <section class="section" data-section="Story" style="padding-top:0">
      <header class="article-head wrap">
        <div class="post-meta"><b>${esc(post.cat)}</b><span>${fmt(post.date)}</span><span>${post.mins} min read</span></div>
        <h1 data-split>${esc(post.title)}</h1>
        <p class="lead" style="margin-inline:auto">${esc(post.excerpt)}</p>
      </header>
      <div class="article-cover wrap"><div class="img-mask ratio-169" data-mask data-parallax>${render.img(post.cover, post.title, 'fetchpriority="high"')}</div></div>
      <div class="wrap" style="margin-top:4rem"><div class="article" id="article-body">${body}</div>
        <div class="article-foot">
          <div class="share" aria-label="Share this story"><button type="button" id="copy-link">Copy link</button><a href="mailto:?subject=${encodeURIComponent(post.title)}&body=${encodeURIComponent(location.href)}">Email</a></div>
          <a class="link-arrow" href="journal.html">All stories <span>→</span></a>
        </div>
        <nav class="pn" aria-label="More stories" style="max-width:40rem;margin-inline:auto">${pn(prev, "Previous")}${pn(next, "Next")}</nav>
      </div>
    </section>

    <section class="section section--sand" data-section="Keep reading">
      <div class="wrap"><div class="stack" style="margin-bottom:3rem"><span class="eyebrow" data-reveal>Keep reading</span><h2 data-split>More from the journal</h2></div>
        <div class="post-grid">${related}</div></div>
    </section>

    <section class="section cta" data-section="Reserve">
      <div class="cta__bg">${render.img("sunset-dinner", "", 'loading="lazy"')}</div>
      <div class="wrap"><span class="eyebrow" data-reveal>Stay with us</span><h2 data-split>Come and write your own</h2>
        <a class="btn btn--light" href="rates.html" data-reveal>Check availability</a></div>
    </section>`;

  /* reading progress (cheap rAF-throttled scroll listener) */
  const bar = $("#read-bar"), art = $("#article-body");
  let ticking = false;
  const update = () => {
    const r = art.getBoundingClientRect();
    const total = r.height - innerHeight * 0.6;
    bar.style.transform = `scaleX(${Math.min(Math.max(-r.top / Math.max(total, 1), 0), 1)})`;
    ticking = false;
  };
  addEventListener("scroll", () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
  update();

  $("#copy-link").addEventListener("click", async () => {
    try { await navigator.clipboard.writeText(location.href); VM.toast("Link copied.", { type: "success" }); }
    catch (e) { VM.toast("Couldn't copy — select the address bar instead.", { type: "error" }); }
  });

  const ld = document.createElement("script");
  ld.type = "application/ld+json";
  ld.textContent = JSON.stringify({ "@context": "https://schema.org", "@type": "Article", headline: post.title, datePublished: post.date, articleSection: post.cat, description: post.excerpt, image: `assets/img/${post.cover}.jpg` });
  document.head.append(ld);
})();
