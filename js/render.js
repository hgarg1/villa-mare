/* Small HTML render helpers shared by the data-driven pages. */
(() => {
  const VM = (window.VM = window.VM || {});
  const { money, date, esc } = VM;

  const mdLabel = (md) => {
    const [m, d] = md.split("-").map(Number);
    return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" }).format(new Date(2001, m - 1, d));
  };

  VM.render = {
    mdLabel,
    seasonDates: (s) => s.ranges.map(([a, b]) => `${mdLabel(a)} – ${mdLabel(b)}`).join(" · "),

    /* above-the-fold images (fetchpriority=high) ship a srcset in the markup itself so phones never fetch the 1536w file first */
    img: (name, alt = "", attrs = "") => `<img src="assets/img/${name}.jpg"${/fetchpriority="high"/.test(attrs) ? ` srcset="assets/img/${name}-800.jpg 800w, assets/img/${name}.jpg 1536w" sizes="100vw"` : ""} alt="${esc(alt)}" ${attrs}>`,

    /** price breakdown <dl> for a pricing.quote() result */
    breakdown(q) {
      const bands = [];
      q.nightly.forEach((n) => {
        const last = bands[bands.length - 1];
        if (last && last.cents === n.cents) last.n++;
        else bands.push({ n: 1, cents: n.cents, season: n.season });
      });
      const seasonName = (id) => VM.data.seasons.find((s) => s.id === id).name;
      const row = (label, value, cls = "") => `<div class="bd__row ${cls}"><dt>${label}</dt><dd>${value}</dd></div>`;
      let html = '<dl class="bd">';
      bands.forEach((b) => (html += row(`${b.n} night${b.n > 1 ? "s" : ""} × ${money.fmt(b.cents)} <small>${seasonName(b.season)}</small>`, money.fmt(b.n * b.cents))));
      if (q.discount) html += row(`Promo <small>${esc(q.promo)}</small>`, "−" + money.fmt(q.discount), "bd__row--good");
      q.extras.forEach((x) => (html += row(`${esc(x.name)}${x.qty > 1 ? ` × ${x.qty}` : ""}`, money.fmt(x.cents))));
      html += row("Cleaning fee", money.fmt(q.cleaning));
      html += row(`Service charge <small>${Math.round(VM.data.fees.serviceRate * 100)}%</small>`, money.fmt(q.service));
      html += row(`Taxes <small>${Math.round(VM.data.fees.taxRate * 100)}%</small>`, money.fmt(q.tax));
      html += row("Total", money.fmt(q.total), "bd__row--total");
      if (q.balance) {
        html += row(`Due now <small>30% deposit</small>`, money.fmt(q.payNow), "bd__row--now");
        html += row(`Balance <small>due ${date.fmt(date.parse(q.balanceDue), { day: "numeric", month: "short", year: "numeric" })}</small>`, money.fmt(q.balance));
      } else {
        html += row("Due now <small>paid in full</small>", money.fmt(q.payNow), "bd__row--now");
      }
      return html + "</dl>";
    },

    /** SVG floor plan of the whole villa; `highlightId` fills one suite (omit for none) */
    plan(highlightId, label = "Floor plan of the villa") {
      const rooms = VM.data.suites.map((s) => {
        const p = s.plan, on = s.id === highlightId;
        return `<rect class="room${on ? " is-on" : ""}" x="${p.x}" y="${p.y}" width="${p.w}" height="${p.h}" rx="2"/><text x="${p.x + p.w / 2}" y="${p.y + p.h / 2 + 2}">${esc(s.name.replace(" Suite", ""))}</text>`;
      }).join("");
      return `<svg viewBox="0 0 240 172" role="img" aria-label="${esc(label)}">
        <rect class="sea" x="0" y="0" width="240" height="9"/><text class="label-muted" x="120" y="6.5">SEA ↑</text>
        ${rooms}
        <rect class="room" x="94" y="14" width="52" height="62" rx="2"/><text x="120" y="47">Living &amp;</text><text x="120" y="56">dining</text>
        <rect class="pool" x="12" y="82" width="216" height="20" rx="10"/><text class="label-muted" x="120" y="94">Infinity pool &amp; terrace</text>
      </svg>`;
    },

    suiteCard(s) {
      return `<a class="suite-card" href="suite.html?id=${s.id}" data-bed="${s.bed.toLowerCase()}" data-view="${s.tag.toLowerCase().split(" ")[0]}" data-reveal>
        <div class="img-mask ratio-32">${VM.render.img(s.images[0], s.name, 'loading="lazy"')}</div>
        <div class="suite-card__body">
          <span class="eyebrow">${esc(s.tag)}</span>
          <h3>${esc(s.name)}</h3>
          <p>${esc(s.blurb)}</p>
          <ul class="specs"><li>${esc(s.bed)} bed</li><li>Sleeps ${s.sleeps}</li><li>${s.size} m²</li></ul>
        </div></a>`;
    },
  };
})();
