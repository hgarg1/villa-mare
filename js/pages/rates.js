/* Rates page: season table, 12-month availability calendar, live price estimator. */
(() => {
  const { $, $$, date, data, pricing, availability, money, render } = VM;
  const today = date.today();

  /* ---- seasons table + legend + timeline + faq ---- */
  $("#seasons-body").innerHTML = data.seasons
    .map((s) => `<tr class="s-${s.id}"><td><span class="chip-dot"></span>${s.name}<small>${s.note}</small></td><td>${render.seasonDates(s)}</td><td class="price">${money.fmt(s.nightly)}</td><td>${s.minNights} nights</td></tr>`)
    .join("");
  $("#cal-legend").innerHTML =
    data.seasons.map((s) => `<span class="s-${s.id}"><i class="chip-dot"></i>${s.name} · ${money.fmt(s.nightly)}</span>`).join("") +
    '<span><i class="chip-dot" style="background:repeating-linear-gradient(135deg,#f1ece2 0 3px,#d9d2c3 3px 4px)"></i>Booked</span>';
  $("#timeline").innerHTML = data.cancellation.map((t) => `<div class="timeline__seg"><b>${t.label}</b><span>${t.text}</span></div>`).join("");
  $("#faq").innerHTML = data.faq.filter((f) => /deposit|cancel|include|change/i.test(f.q)).map((f) => `<details><summary>${f.q}</summary><p>${f.a}</p></details>`).join("");

  /* ---- estimator state ---- */
  const form = $("#estimator");
  const dr = form._dr;
  const out = $("#est-out");
  const cta = $("#est-cta");
  const promoInput = $("#promo");
  const promoMsg = $("#promo-msg");
  let promo = ""; // only a *validated* code is kept

  const qs = () => {
    const sel = dr.get();
    return { arrive: sel.arrive, depart: sel.depart, adults: form.elements.adults.value, children: form.elements.children.value, promo };
  };

  function recompute() {
    const input = qs();
    const q = pricing.quote(input);
    paintCalendar(input);
    if (!input.arrive || !input.depart) {
      out.innerHTML = `<p class="est__empty">Choose your arrival and departure to see a full price. From <b>${money.fmt(Math.min(...data.seasons.map((s) => s.nightly)))}</b> per night.</p>`;
      setCta(false);
      return;
    }
    let html = "";
    if (q.errors.length) html += `<p class="est__err" role="alert">${q.errors.join(" ")}</p>`;
    if (q.nights && !q.errors.length) html += render.breakdown(q);
    out.innerHTML = html;
    setCta(q.ready, input);
    // a validated promo can become invalid when dates change
    if (promo && !pricing.checkPromo(promo, { nights: q.nights, daysOut: date.diff(today, date.isValidIso(input.arrive) ? date.parse(input.arrive) : today) }).ok) {
      promo = "";
      setPromoMsg("Promo no longer applies to these dates.", "bad");
      recompute();
    }
  }

  function setCta(ready, input) {
    cta.setAttribute("aria-disabled", String(!ready));
    cta.tabIndex = ready ? 0 : -1;
    if (ready) {
      const p = new URLSearchParams({ arrive: input.arrive, depart: input.depart, adults: input.adults, children: input.children });
      if (input.promo) p.set("promo", input.promo);
      cta.href = "checkout.html?" + p;
    } else cta.href = "checkout.html";
  }

  const setPromoMsg = (text, kind) => {
    promoMsg.textContent = text;
    promoMsg.className = "promo-msg" + (kind ? " is-" + kind : "");
  };

  $("#promo-apply").addEventListener("click", () => {
    const code = promoInput.value.trim().toUpperCase();
    if (!code) { promo = ""; setPromoMsg("", ""); return recompute(); }
    const sel = dr.get();
    const nights = sel.arrive && sel.depart ? date.diff(date.parse(sel.arrive), date.parse(sel.depart)) : 0;
    const daysOut = sel.arrive ? date.diff(today, date.parse(sel.arrive)) : 0;
    const r = pricing.checkPromo(code, { nights, daysOut });
    promo = r.ok ? r.code : "";
    setPromoMsg(r.message, r.ok ? "ok" : "bad");
    recompute();
  });
  promoInput.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); $("#promo-apply").click(); } });
  form.addEventListener("change", recompute);
  form.addEventListener("submit", (e) => e.preventDefault());

  /* ---- availability calendar (click to choose dates) ---- */
  const cal = $("#cal");
  const dow = ["M", "T", "W", "T", "F", "S", "S"];
  const mine = null;
  let html = "";
  for (let i = 0; i < 12; i++) {
    const first = date.day(today.getFullYear(), today.getMonth() + i, 1);
    const lead = (first.getDay() + 6) % 7;
    const dim = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
    let cells = '<span class="cal__pad"></span>'.repeat(lead);
    for (let n = 1; n <= dim; n++) {
      const d = date.day(first.getFullYear(), first.getMonth(), n);
      const s = pricing.seasonFor(d);
      const past = d < today;
      const blocked = !past && availability.isBlocked(d);
      const label = `${date.fmt(d)} · ${past ? "past" : blocked ? "booked" : money.fmt(s.nightly) + " / night"}`;
      cells += `<button type="button" class="cal__d s-${s.id}${past ? " is-past" : ""}${blocked ? " is-blocked" : ""}${date.same(d, today) ? " is-today" : ""}" data-date="${date.iso(d)}" title="${label}" aria-label="${label}"${past || blocked ? " disabled" : ""}>${n}</button>`;
    }
    html += `<div class="cal__month"><h3>${new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric" }).format(first)}</h3><div class="cal__dow">${dow.map((x) => `<span>${x}</span>`).join("")}</div><div class="cal__grid">${cells}</div></div>`;
  }
  cal.innerHTML = html;

  function paintCalendar({ arrive, depart }) {
    $$(".cal__d", cal).forEach((b) => {
      const d = b.dataset.date;
      b.classList.toggle("is-sel", d === arrive || d === depart);
      b.classList.toggle("is-range", !!(arrive && depart && d > arrive && d < depart));
    });
  }

  cal.addEventListener("click", (e) => {
    const b = e.target.closest(".cal__d");
    if (!b || b.disabled) return;
    const { arrive, depart } = dr.get();
    const d = b.dataset.date;
    if (!arrive || depart || d <= arrive) dr.set(d, "");
    else dr.set(arrive, d);
    $("#estimator").scrollIntoView?.({ block: "nearest" });
  });

  recompute();
})();
