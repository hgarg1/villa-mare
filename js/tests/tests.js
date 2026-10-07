/* Minimal assertion harness + tests for pricing, availability and card helpers. */
(() => {
  const { pricing, availability, cards, date, data } = VM;
  const out = document.getElementById("out");
  let pass = 0, fail = 0;

  const test = (name, fn) => {
    const li = document.createElement("li");
    try { fn(); pass++; li.className = "ok"; li.textContent = "✓ " + name; }
    catch (e) { fail++; li.className = "bad"; li.textContent = "✗ " + name + " — " + e.message; }
    out.append(li);
  };
  const eq = (a, b, msg = "") => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${msg} expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`); };
  const ok = (v, msg = "assertion failed") => { if (!v) throw new Error(msg); };

  // Price maths must not depend on the seeded calendar, so stub availability while quoting.
  const realAvail = VM.availability;
  const free = () => (VM.availability = { isRangeFree: () => true });
  const restore = () => (VM.availability = realAvail);
  const nextYear = new Date().getFullYear() + 1;
  const iso = (md) => `${nextYear}-${md}`;

  /* ---- seasons ---- */
  test("season boundaries", () => {
    eq(pricing.seasonFor(date.parse(iso("12-20"))).id, "peak");
    eq(pricing.seasonFor(date.parse(iso("01-05"))).id, "peak", "Jan 5");
    eq(pricing.seasonFor(date.parse(iso("01-06"))).id, "high");
    eq(pricing.seasonFor(date.parse(iso("04-16"))).id, "shoulder");
    eq(pricing.seasonFor(date.parse(iso("07-01"))).id, "low");
    eq(pricing.seasonFor(date.parse(iso("10-16"))).id, "shoulder");
    eq(pricing.seasonFor(date.parse(iso("12-01"))).id, "high");
  });

  /* ---- quote maths ---- */
  test("simple low-season quote adds up", () => {
    free();
    const q = pricing.quote({ arrive: iso("07-10"), depart: iso("07-14"), adults: 2, children: 0 });
    restore();
    eq(q.nights, 4);
    eq(q.subtotal, 4 * 180000);
    eq(q.cleaning, 35000);
    eq(q.service, Math.round(q.subtotal * 0.1));
    eq(q.tax, Math.round((q.subtotal + q.service + q.cleaning) * 0.12));
    eq(q.total, q.subtotal + q.service + q.cleaning + q.tax);
    ok(q.ready, "should be ready: " + q.errors.join(","));
  });

  test("stay crossing seasons prices each night by its own season", () => {
    free();
    const q = pricing.quote({ arrive: iso("04-14"), depart: iso("04-18"), adults: 2 });
    restore();
    eq(q.nightly.map((n) => n.season), ["high", "high", "shoulder", "shoulder"]);
    eq(q.subtotal, 2 * 320000 + 2 * 240000);
  });

  test("minimum nights enforced (peak = 7)", () => {
    free();
    const short = pricing.quote({ arrive: iso("12-26"), depart: iso("12-30"), adults: 2 });
    const long = pricing.quote({ arrive: iso("12-26"), depart: iso("01-02").replace(String(nextYear), String(nextYear + 1)), adults: 2 });
    restore();
    ok(!short.ready && short.errors.some((e) => /minimum/i.test(e)), "short peak stay rejected");
    ok(long.ready, "7-night peak stay accepted: " + long.errors.join(","));
  });

  test("guest capacity", () => {
    free();
    const q = pricing.quote({ arrive: iso("07-10"), depart: iso("07-14"), adults: 6, children: 3 });
    restore();
    ok(q.errors.some((e) => /sleeps 8/.test(e)));
  });

  test("past arrival is rejected", () => {
    const q = pricing.quote({ arrive: "2020-01-01", depart: "2020-01-05", adults: 2 });
    ok(!q.ready && q.errors.length);
  });

  /* ---- promos ---- */
  test("WELCOME10 takes 10% off nights only", () => {
    free();
    const base = pricing.quote({ arrive: iso("07-10"), depart: iso("07-14"), adults: 2 });
    const q = pricing.quote({ arrive: iso("07-10"), depart: iso("07-14"), adults: 2, promo: "welcome10" });
    restore();
    eq(q.discount, Math.round(base.subtotal * 0.1));
    ok(q.total < base.total);
  });

  test("LONGSTAY refunds the cheapest night, needs 7+", () => {
    free();
    const six = pricing.quote({ arrive: iso("07-10"), depart: iso("07-16"), adults: 2, promo: "LONGSTAY" });
    const seven = pricing.quote({ arrive: iso("07-10"), depart: iso("07-17"), adults: 2, promo: "LONGSTAY" });
    restore();
    eq(six.discount, 0);
    eq(seven.discount, 180000);
  });

  test("EARLY15 needs 90 days", () => {
    const soon = VM.pricing.checkPromo("EARLY15", { nights: 4, daysOut: 20 });
    const early = VM.pricing.checkPromo("EARLY15", { nights: 4, daysOut: 120 });
    ok(!soon.ok && early.ok);
  });

  test("unknown promo is invalid with a message", () => {
    const r = pricing.checkPromo("NOPE", { nights: 4, daysOut: 120 });
    ok(!r.ok && r.message.length > 0);
  });

  /* ---- extras ---- */
  test("extras clamp to their maximum and add to the total", () => {
    free();
    const q = pricing.quote({ arrive: iso("07-10"), depart: iso("07-14"), adults: 2, extras: [{ id: "chef", qty: 99 }, { id: "celebration", qty: 5 }] });
    restore();
    eq(q.extras.find((e) => e.id === "chef").qty, 4, "chef capped at nights");
    eq(q.extras.find((e) => e.id === "celebration").qty, 1);
    eq(q.extrasTotal, 4 * 45000 + 60000);
  });

  /* ---- payment schedule ---- */
  test("deposit 30% + balance 30 days before; full payment inside 30 days", () => {
    free();
    const far = pricing.quote({ arrive: iso("07-10"), depart: iso("07-14"), adults: 2 });
    restore();
    eq(far.payNow, Math.round(far.total * 0.3));
    eq(far.payNow + far.balance, far.total);
    eq(far.balanceDue, date.iso(date.addDays(date.parse(iso("07-10")), -30)));

    free();
    const arrive = date.addDays(date.today(), 10);
    const soon = pricing.quote({ arrive: date.iso(arrive), depart: date.iso(date.addDays(arrive, 4)), adults: 2 });
    restore();
    ok(soon.fullOnly);
    eq(soon.payNow, soon.total);
    eq(soon.balance, 0);
  });

  test("payFull option collapses the schedule", () => {
    free();
    const q = pricing.quote({ arrive: iso("07-10"), depart: iso("07-14"), adults: 2, payFull: true });
    restore();
    eq(q.payNow, q.total);
  });

  /* ---- cancellation ---- */
  test("cancellation tiers", () => {
    const today = date.today();
    const arrive = (n) => date.iso(date.addDays(today, n));
    eq(pricing.cancellation(arrive(90), 100000).pct, 1);
    eq(pricing.cancellation(arrive(60), 100000).pct, 1, "60 days boundary");
    eq(pricing.cancellation(arrive(59), 100000).pct, 0.5);
    eq(pricing.cancellation(arrive(30), 100000).pct, 0.5, "30 days boundary");
    eq(pricing.cancellation(arrive(29), 100000).pct, 0);
    eq(pricing.cancellation(arrive(90), 100000).refund, 100000);
  });

  /* ---- availability ---- */
  test("past dates are blocked; firstFree is bookable", () => {
    ok(availability.isBlocked(date.addDays(date.today(), -1)));
    const a = availability.firstFree(3);
    ok(a, "found a free arrival");
    ok(availability.isRangeFree(a, date.addDays(a, 3)));
  });

  test("availability is deterministic across calls", () => {
    const d = date.addDays(date.today(), 90);
    eq(availability.isBlocked(d), availability.isBlocked(d));
    const share = (() => { let b = 0; for (let i = 20; i < 380; i++) if (availability.isBlocked(date.addDays(date.today(), i))) b++; return b / 360; })();
    ok(share > 0.2 && share < 0.65, `blocked share ${share.toFixed(2)} should be between 20% and 65%`);
  });

  test("maxDeparture stops at the first blocked night", () => {
    const a = availability.firstFree(1);
    const max = availability.maxDeparture(a);
    ok(max > a);
    ok(availability.isRangeFree(a, max));
  });

  test("a confirmed booking blocks its nights; cancelled does not", () => {
    const a = availability.firstFree(3);
    const b = { ref: "T-1", arrive: date.iso(a), depart: date.iso(date.addDays(a, 3)), status: "confirmed", guest: { email: "t@t.t" } };
    const before = VM.store.get("bookings", []);
    VM.store.set("bookings", [b]);
    ok(!availability.isRangeFree(a, date.addDays(a, 3)), "blocked when confirmed");
    VM.store.set("bookings", [{ ...b, status: "cancelled" }]);
    ok(availability.isRangeFree(a, date.addDays(a, 3)), "free when cancelled");
    VM.store.set("bookings", before);
  });

  /* ---- cards ---- */
  test("Luhn accepts demo numbers and rejects typos", () => {
    data.demoCards.forEach((c) => ok(cards.luhn(c.number), c.number));
    ok(!cards.luhn("4242 4242 4242 4241"));
  });

  test("brand detection and formatting", () => {
    eq(cards.brand("4242").id, "visa");
    eq(cards.brand("5555").id, "mastercard");
    eq(cards.brand("3782").id, "amex");
    eq(cards.format("4242424242424242"), "4242 4242 4242 4242");
    eq(cards.format("378282246310005"), "3782 822463 10005");
  });

  test("expiry validation", () => {
    ok(!cards.expiry("1/2").ok);
    ok(!cards.expiry("13/30").ok);
    ok(!cards.expiry("01/20").ok);
    ok(cards.expiry("12/99").ok);
    eq(cards.formatExpiry("1230"), "12/30");
  });

  test("validate() flags every bad field and honours Amex CVC length", () => {
    const bad = cards.validate({ number: "1234", exp: "", cvc: "1", name: "" });
    ok(!bad.ok && Object.keys(bad.errors).length === 4);
    ok(cards.validate({ number: "4242 4242 4242 4242", exp: "12/99", cvc: "123", name: "Ada Lovelace" }).ok);
    ok(!cards.validate({ number: "3782 822463 10005", exp: "12/99", cvc: "123", name: "Ada" }).ok, "amex needs 4");
  });

  test("simulated processor outcomes", () => {
    eq(cards.outcome("4242 4242 4242 4242"), "success");
    eq(cards.outcome("4000 0000 0000 0002"), "declined");
    eq(cards.outcome("4000 0027 6000 3184"), "secure");
  });

  /* ---- input formatting ---- */
  const F = VM.format;
  test("US phone formats as you type, without dangling punctuation", () => {
    eq(F.phone("+1", "5"), "(5");
    eq(F.phone("+1", "555"), "(555");
    eq(F.phone("+1", "5550"), "(555) 0");
    eq(F.phone("+1", "5550100100"), "(555) 010-0100");
    eq(F.phone("+1", "(555) 010-0100999"), "(555) 010-0100", "capped at 10 digits");
    eq(F.phone("+1", "1 555 010 0100"), "(555) 010-0100", "leading country 1 dropped");
  });
  test("international phones drop the trunk 0 and group correctly", () => {
    eq(F.phone("+44", "07700 900123"), "7700 900123");
    eq(F.phone("+44", "02079460000"), "20 7946 0000");
    eq(F.phone("+33", "0612345678"), "6 12 34 56 78");
    eq(F.phone("+39", "0612345678"), "061 234 5678", "Italy keeps its leading 0");
    eq(F.phone("+55", "11912345678"), "(11) 91234-5678");
  });
  test("phone validity depends on the country", () => {
    ok(F.phoneValid("+1", "(555) 010-0100"));
    ok(!F.phoneValid("+1", "555 010"));
    ok(F.phoneValid("+44", "07700 900123"));
    ok(!F.phoneValid("+65", "9123 456"));
  });
  test("pasted international numbers are split into code + national part", () => {
    eq(F.parseInternational("+44 7700 900123"), { code: "+44", rest: "7700900123" });
    eq(F.parseInternational("0044 7700 900123"), { code: "+44", rest: "7700900123" });
    eq(F.parseInternational("+971 50 123 4567"), { code: "+971", rest: "501234567" });
    eq(F.parseInternational("07700 900123"), null);
  });
  test("postal codes format and validate per country", () => {
    eq(F.postal("US", "100019999"), "10001-9999");
    ok(F.postalValid("US", "10001") && !F.postalValid("US", "1000"));
    eq(F.postal("GB", "sw1a1aa"), "SW1A 1AA");
    ok(F.postalValid("GB", "sw1a1aa") && !F.postalValid("GB", "ABC"));
    eq(F.postal("CA", "k1a0b1"), "K1A 0B1");
    eq(F.postal("BR", "01310100"), "01310-100");
    eq(F.postal("JP", "1000001"), "100-0001");
    ok(F.postalValid("AE", ""), "UAE has no postcodes");
  });
  test("booking reference, promo, name and email normalisers", () => {
    eq(F.ref("vmsct911"), "VM-SCT9-11");
    eq(F.ref("sct911"), "VM-SCT9-11");
    eq(F.ref("VM-SCT9-11"), "VM-SCT9-11");
    eq(F.ref("v"), "v".toUpperCase());
    eq(F.promo(" welcome 10!"), "WELCOME10");
    eq(F.name("ada  lovelace"), "Ada Lovelace");
    eq(F.name("o'brien"), "O'Brien");
    eq(F.name("Ada de la Cruz"), "Ada de la Cruz", "mixed case left alone");
    eq(F.email("  Ada@Example.COM "), "ada@example.com");
  });

  document.getElementById("summary").textContent = fail ? `— ${fail} FAILED, ${pass} passed` : `— ALL ${pass} PASSED`;
  document.getElementById("summary").className = fail ? "bad" : "ok";
  document.title = (fail ? "FAIL " : "PASS ") + pass + "/" + (pass + fail);
})();
