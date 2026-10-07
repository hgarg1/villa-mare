/* Availability: deterministic "pre-existing" bookings seeded per calendar month (so the
   demo never goes stale and every visitor sees the same calendar) PLUS any bookings the
   visitor completes in checkout. DOM-free. */
(() => {
  const VM = (window.VM = window.VM || {});
  const { date } = VM;

  // mulberry32 PRNG
  const rng = (seed) => () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const seededCache = new Map(); // monthKey → Set of ISO nights
  function seededMonth(y, m) {
    const key = y * 12 + m;
    if (seededCache.has(key)) return seededCache.get(key);
    const set = new Set();
    const r = rng(key * 7919 + 13);
    const dim = new Date(y, m + 1, 0).getDate();
    let cursor = 1 + Math.floor(r() * 6);
    while (cursor <= dim) {
      if (r() < 0.55) {
        const len = 3 + Math.floor(r() * 7);
        for (let i = 0; i < len; i++) set.add(date.iso(date.day(y, m, cursor + i)));
        cursor += len + 2 + Math.floor(r() * 8);
      } else cursor += 3 + Math.floor(r() * 5);
    }
    seededCache.set(key, set);
    return set;
  }

  // keep the next two weeks open so a first-time visitor can always try the flow
  const openFrom = () => date.addDays(date.today(), 14);

  function bookedNights() {
    const set = new Set();
    VM.bookings?.all().forEach((b) => {
      if (b.status === "cancelled") return;
      for (let d = date.parse(b.arrive); d < date.parse(b.depart); d = date.addDays(d, 1)) set.add(date.iso(d));
    });
    return set;
  }

  /** true when the *night* starting on `d` is unavailable (past, seeded, or booked here) */
  function isBlocked(d, mine = bookedNights()) {
    if (d < date.today()) return true;
    const iso = date.iso(d);
    if (mine.has(iso)) return true;
    if (d < openFrom()) return false;
    return seededMonth(d.getFullYear(), d.getMonth()).has(iso) || (d.getDate() <= 10 && seededMonth(...prevMonth(d)).has(iso));
  }
  const prevMonth = (d) => {
    const p = new Date(d.getFullYear(), d.getMonth() - 1, 1);
    return [p.getFullYear(), p.getMonth()];
  };

  /** first blocked night on/after `from` (Date) within a year, or null */
  function nextBlocked(from, horizon = 400) {
    const mine = bookedNights();
    for (let i = 0; i < horizon; i++) {
      const d = date.addDays(from, i);
      if (isBlocked(d, mine)) return d;
    }
    return null;
  }

  /** every night in [arrive, depart) is free */
  function isRangeFree(a, d) {
    const mine = bookedNights();
    for (let x = a; x < d; x = date.addDays(x, 1)) if (isBlocked(x, mine)) return false;
    return true;
  }

  VM.availability = {
    isBlocked: (d) => isBlocked(d),
    nextBlocked,
    isRangeFree,
    /** latest allowed departure for an arrival (the first blocked night is a valid check-out day) */
    maxDeparture(arrive) {
      const nb = nextBlocked(arrive, 120);
      return nb || date.addDays(arrive, 120);
    },
    /** earliest available arrival from today, handy for demos/tests */
    firstFree(minNights = 3) {
      for (let i = 0; i < 400; i++) {
        const a = date.addDays(date.today(), i);
        if (isRangeFree(a, date.addDays(a, minNights))) return a;
      }
      return null;
    },
  };
})();
