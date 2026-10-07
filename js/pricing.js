/* Pricing engine. Pure functions over VM.data; integer cents throughout. */
(() => {
  const VM = (window.VM = window.VM || {});
  const { date, money } = VM;
  const D = () => VM.data;

  /* ---- seasons ---- */
  const inRange = (md, [a, b]) => (a <= b ? md >= a && md <= b : md >= a || md <= b);
  function seasonFor(d) {
    const md = date.md(d);
    return D().seasons.find((s) => s.ranges.some((r) => inRange(md, r))) || D().seasons[D().seasons.length - 1];
  }

  /* ---- extras ---- */
  function extraMax(ex, ctx) {
    switch (ex.unit) {
      case "stay": return 1;
      case "night": return Math.max(ctx.nights, 0);
      case "person": return ex.id === "kids" ? Math.max(ctx.children, 0) * Math.max(ctx.nights, 1) : Math.max(ctx.adults + ctx.children, 0);
      default: return ex.max || 1;
    }
  }

  /* ---- promos ---- */
  function checkPromo(code, ctx) {
    const c = String(code || "").trim().toUpperCase();
    if (!c) return { ok: false, empty: true, message: "" };
    if (!D().promos[c]) return { ok: false, message: "That code isn't valid." };
    if (!ctx.nights) return { ok: false, message: "Choose your dates first, then apply the code." };
    if (c === "WELCOME10" && ctx.nights < 3) return { ok: false, message: "WELCOME10 applies to stays of 3 nights or more." };
    if (c === "EARLY15" && ctx.daysOut < 90) return { ok: false, message: "EARLY15 needs an arrival at least 90 days from today." };
    if (c === "LONGSTAY" && ctx.nights < 7) return { ok: false, message: "LONGSTAY applies to stays of 7 nights or more." };
    return { ok: true, code: c, message: `${c} applied — ${D().promos[c].label}.` };
  }
  function promoDiscount(code, subtotal, nightly) {
    if (code === "WELCOME10") return money.round(subtotal * 0.1);
    if (code === "EARLY15") return money.round(subtotal * 0.15);
    if (code === "LONGSTAY") return Math.min(...nightly.map((n) => n.cents));
    return 0;
  }

  /* ---- cancellation ---- */
  function cancellation(arriveIso, paidCents, onDate = date.today()) {
    const days = date.diff(onDate, date.parse(arriveIso));
    const tier = D().cancellation.find((t) => days >= t.minDays) || D().cancellation[D().cancellation.length - 1];
    return { days, tier, pct: tier.pct, refund: money.round(paidCents * tier.pct) };
  }

  /**
   * quote({ arrive, depart, adults, children, extras: [{id, qty}], promo, payFull })
   * → { ready, errors[], nights, nightly[], subtotal, extras[], extrasTotal, discount, promo, cleaning,
   *     service, tax, total, payNow, balance, balanceDue, fullOnly, minNights, season }
   */
  function quote(inp = {}) {
    const f = D().fees;
    const out = {
      ready: false, errors: [], nights: 0, nightly: [], subtotal: 0, extras: [], extrasTotal: 0, discount: 0, promo: null,
      cleaning: 0, service: 0, tax: 0, total: 0, payNow: 0, balance: 0, balanceDue: null, fullOnly: false, minNights: 0, season: null,
    };
    const adults = Math.max(0, parseInt(inp.adults ?? 2, 10) || 0);
    const children = Math.max(0, parseInt(inp.children ?? 0, 10) || 0);

    if (adults < 1) out.errors.push("At least one adult is required.");
    if (adults + children > D().villa.maxGuests) out.errors.push(`The villa sleeps ${D().villa.maxGuests} guests at most.`);

    if (!date.isValidIso(inp.arrive) || !date.isValidIso(inp.depart)) return out; // dates not chosen yet
    const arrive = date.parse(inp.arrive), depart = date.parse(inp.depart);
    const nights = date.diff(arrive, depart);
    if (nights <= 0) { out.errors.push("Departure must be after arrival."); return out; }
    if (arrive < date.today()) { out.errors.push("Arrival can't be in the past."); return out; }

    out.nights = nights;
    out.season = seasonFor(arrive);
    out.minNights = out.season.minNights;
    if (nights < out.minNights) out.errors.push(`${out.season.name} requires a minimum of ${out.minNights} nights.`);
    if (VM.availability && !VM.availability.isRangeFree(arrive, depart)) out.errors.push("Some of these dates aren't available.");

    for (let i = 0; i < nights; i++) {
      const d = date.addDays(arrive, i);
      const s = seasonFor(d);
      out.nightly.push({ date: date.iso(d), season: s.id, cents: s.nightly });
    }
    out.subtotal = out.nightly.reduce((n, x) => n + x.cents, 0);

    const ctx = { nights, adults, children, daysOut: date.diff(date.today(), arrive) };
    (inp.extras || []).forEach(({ id, qty }) => {
      const ex = D().extras.find((e) => e.id === id);
      if (!ex) return;
      const q = VM.clamp(parseInt(qty, 10) || 0, 0, extraMax(ex, ctx));
      if (q > 0) out.extras.push({ id, name: ex.name, qty: q, unitCents: ex.price, cents: ex.price * q });
    });
    out.extrasTotal = out.extras.reduce((n, x) => n + x.cents, 0);

    const pc = checkPromo(inp.promo, ctx);
    if (pc.ok) {
      out.promo = pc.code;
      out.discount = promoDiscount(pc.code, out.subtotal, out.nightly);
    }

    out.cleaning = f.cleaning;
    const preFee = out.subtotal - out.discount + out.extrasTotal;
    out.service = money.round(preFee * f.serviceRate);
    const taxBase = preFee + out.service + out.cleaning;
    out.tax = money.round(taxBase * f.taxRate);
    out.total = taxBase + out.tax;

    out.fullOnly = ctx.daysOut < f.balanceDaysBefore;
    if (out.fullOnly || inp.payFull) {
      out.payNow = out.total; out.balance = 0; out.balanceDue = null;
    } else {
      out.payNow = money.round(out.total * f.depositRate);
      out.balance = out.total - out.payNow;
      out.balanceDue = date.iso(date.addDays(arrive, -f.balanceDaysBefore));
    }
    out.ready = out.errors.length === 0;
    return out;
  }

  VM.pricing = { seasonFor, quote, checkPromo, cancellation, extraMax, minNightsFor: (d) => seasonFor(d).minNights, nightlyFor: (d) => seasonFor(d).nightly };
})();
