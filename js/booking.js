/* Booking utilities shared by checkout, confirmation and "manage booking":
   reference generator, .ics file, printable receipt, refund calculation. */
(() => {
  const VM = (window.VM = window.VM || {});
  const { date, money, esc } = VM;

  const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ"; // no 0/O/1/I/L
  const rand = (n) => (window.crypto || window.msCrypto).getRandomValues(new Uint32Array(n));

  const makeRef = () => {
    let s = "";
    rand(4).forEach((x) => (s += ALPHABET[x % ALPHABET.length]));
    return `VM-${s}-${10 + (rand(1)[0] % 90)}`;
  };
  const uuid = () => Array.from(rand(4), (x) => x.toString(16).padStart(8, "0")).join("-");

  /* ---------- calendar file ---------- */
  const icsEsc = (s) => String(s).replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
  const ymd = (iso) => iso.replace(/-/g, "");
  function ics(b) {
    const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
    const v = VM.data.villa;
    const lines = [
      "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Villa Mare//Demo Booking//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
      "BEGIN:VEVENT",
      `UID:${b.ref}@villamare.example`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${ymd(b.arrive)}`,
      `DTEND;VALUE=DATE:${ymd(b.depart)}`, // exclusive end date = check-out day
      `SUMMARY:${icsEsc(`Stay at ${v.name} (${b.ref})`)}`,
      `LOCATION:${icsEsc("Maré Bay (beachfront)")}`,
      `DESCRIPTION:${icsEsc(`Check-in from ${v.checkIn}, check-out by ${v.checkOut}.\nGuests: ${b.adults} adults, ${b.children} children.\nBalance: ${money.fmt(b.totals.balance)}${b.totals.balanceDue ? " due " + b.totals.balanceDue : ""}.\nDemo booking: no real reservation.`)}`,
      "TRANSP:OPAQUE",
      "END:VEVENT", "END:VCALENDAR",
    ];
    return lines.join("\r\n") + "\r\n";
  }

  function download(filename, text, type = "text/plain") {
    const url = URL.createObjectURL(new Blob([text], { type }));
    const a = document.createElement("a");
    a.href = url; a.download = filename;
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }

  /* ---------- itinerary ---------- */
  function itinerary(b) {
    const fmt = (iso) => date.fmt(date.parse(iso), { weekday: "short", day: "numeric", month: "short", year: "numeric" });
    const steps = [
      { d: b.createdAt.slice(0, 10), t: "Booking confirmed", s: b.payment.status === "awaiting" ? `Awaiting bank transfer of ${money.fmt(b.totals.payNow)}` : `${money.fmt(b.payment.paid)} paid${b.payment.last4 ? ` · ${b.payment.brand} ••••${b.payment.last4}` : ""}` },
    ];
    if (b.totals.balance) steps.push({ d: b.totals.balanceDue, t: "Balance due", s: money.fmt(b.totals.balance) });
    steps.push({ d: b.arrive, t: "Arrival", s: `Check-in from ${VM.data.villa.checkIn} · private transfer if booked` });
    steps.push({ d: b.depart, t: "Departure", s: `Check-out by ${VM.data.villa.checkOut}` });
    return `<ol class="itin">${steps.map((x) => `<li><time>${esc(fmt(x.d))}</time><b>${esc(x.t)}</b><span>${esc(x.s)}</span></li>`).join("")}</ol>`;
  }

  /* ---------- receipt (also the print layout) ---------- */
  function receipt(b) {
    const guest = `${esc(b.guest.first)} ${esc(b.guest.last)}`;
    const fmt = (iso) => date.fmt(date.parse(iso), { weekday: "short", day: "numeric", month: "long", year: "numeric" });
    const pay = b.payment.method === "bank" ? "Bank transfer" : `${esc(b.payment.brand || "Card")} ending ${esc(b.payment.last4)}`;
    return `<div class="receipt">
      <header class="receipt__head"><div><b class="receipt__brand">Villa Maré</b><span>Private beachfront villa · Maré Bay</span></div>
        <div><span>Reference</span><b>${esc(b.ref)}</b></div></header>
      <dl class="receipt__meta">
        <div><dt>Guest</dt><dd>${guest}<br>${esc(b.guest.email)}</dd></div>
        <div><dt>Stay</dt><dd>${fmt(b.arrive)} →<br>${fmt(b.depart)} · ${b.nights} night${b.nights === 1 ? "" : "s"}</dd></div>
        <div><dt>Guests</dt><dd>${b.adults} adult${b.adults === 1 ? "" : "s"}${b.children ? `, ${b.children} child${b.children === 1 ? "" : "ren"}` : ""}</dd></div>
        <div><dt>Payment</dt><dd>${pay}<br>${b.status === "cancelled" ? "Cancelled" : b.payment.status === "awaiting" ? "Awaiting transfer" : "Paid " + money.fmt(b.payment.paid)}</dd></div>
      </dl>
      ${VM.render.breakdown(b.quote)}
      ${b.refund ? `<p class="receipt__note">Cancelled on ${esc(b.refund.at.slice(0, 10))}. Refund: ${money.fmt(b.refund.cents)} (${Math.round(b.refund.pct * 100)}% — ${esc(b.refund.label)}).</p>` : ""}
      <p class="receipt__note">Demonstration receipt. No real payment was taken and no reservation exists.</p>
    </div>`;
  }

  /** what a cancellation would refund today */
  const refund = (b, on = date.today()) => VM.pricing.cancellation(b.arrive, b.payment.status === "awaiting" ? 0 : b.payment.paid, on);

  VM.booking = { makeRef, uuid, ics, download, itinerary, receipt, refund };
})();
