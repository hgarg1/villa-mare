/* Journal list: featured post, category chips, search, newsletter. */
(() => {
  const { $, $$, data, render, esc, date } = VM;
  const posts = [...data.journal].sort((a, b) => b.date.localeCompare(a.date));
  const fmt = (iso) => date.fmt(date.parse(iso), { day: "numeric", month: "long", year: "numeric" });
  const meta = (p) => `<div class="post-meta"><b>${esc(p.cat)}</b><span>${fmt(p.date)}</span><span>${p.mins} min read</span></div>`;

  const [first, ...rest] = posts;
  $("#feature").innerHTML = `
    <a class="img-mask ratio-32" href="article.html?slug=${first.slug}" data-mask aria-label="${esc(first.title)}">${render.img(first.cover, first.title, 'fetchpriority="low"')}</a>
    <div>${meta(first)}<h2 data-split>${esc(first.title)}</h2><p>${esc(first.excerpt)}</p><a class="link-arrow" href="article.html?slug=${first.slug}">Read the story <span>→</span></a></div>`;

  $("#post-grid").innerHTML = rest
    .map((p) => `<a class="post-card" href="article.html?slug=${p.slug}" data-cat="${esc(p.cat)}" data-text="${esc((p.title + " " + p.excerpt).toLowerCase())}" data-reveal>
        <div class="img-mask ratio-32">${render.img(p.cover, p.title, 'loading="lazy"')}</div>${meta(p)}<h3>${esc(p.title)}</h3><p>${esc(p.excerpt)}</p></a>`)
    .join("");

  /* filters */
  const filters = $("#post-filters");
  filters.innerHTML = ["All", ...new Set(rest.map((p) => p.cat))].map((c, i) => `<button type="button" data-cat="${esc(c)}" aria-pressed="${i === 0}">${esc(c)}</button>`).join("");
  let cat = "All", q = "";
  const apply = () => {
    let shown = 0;
    $$(".post-card").forEach((c) => {
      const ok = (cat === "All" || c.dataset.cat === cat) && (!q || c.dataset.text.includes(q));
      c.hidden = !ok;
      if (ok) shown++;
    });
    $("#no-results").hidden = shown > 0;
    window.ScrollTrigger?.refresh();
  };
  filters.addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    cat = b.dataset.cat;
    $$("button", filters).forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
    apply();
  });
  $("#post-search").addEventListener("input", (e) => { q = e.target.value.trim().toLowerCase(); apply(); });

  /* newsletter (demo) */
  $("#journal-news").addEventListener("submit", (e) => {
    e.preventDefault();
    const input = $("#jn-email"), err = $("#journal-news .err");
    if (!/^\S+@\S+\.\S+$/.test(input.value)) { err.textContent = "Please enter a valid email."; input.focus(); return; }
    err.textContent = ""; input.value = "";
    VM.toast("Thank you — you're on the list (demo: nothing was sent).", { type: "success" });
  });
})();
