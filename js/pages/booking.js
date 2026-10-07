/* Manage booking: lookup by reference + email, view, calendar, print, cancel (with refund tier). */
(() => {
  const { $, date, data, money, esc, ui } = VM;
  const form = $("#lookup");
  const view = $("#view");
  const lookupSection = $("#lookup-section");
  const err = $("#lookup-error");

  const prefill = VM.qs().ref;
  if (prefill) form.elements.ref.value = VM.format.ref(prefill);

  /* bookings stored on this device, as shortcuts to the reference field */
  const recent = VM.bookings.all().slice().reverse();
  $("#recent").innerHTML = recent.length
    ? `<h2 style="font-size:1.5rem;margin-bottom:.8rem">Bookings on this device</h2><ul class="recent">${recent.map((b) => `<li><button type="button" class="link" data-ref="${esc(b.ref)}">${esc(b.ref)}</button> <span>${esc(date.fmt(date.parse(b.arrive), { day: "numeric", month: "short" }))} → ${esc(date.fmt(date.parse(b.depart), { day: "numeric", month: "short", year: "numeric" }))}${b.status === "cancelled" ? " · cancelled" : ""}</span></li>`).join("")}</ul>`
    : "";
  $("#recent").addEventListener("click", (e) => {
    const b = e.target.closest("[data-ref]");
    if (!b) return;
    form.elements.ref.value = b.dataset.ref;
    form.elements.email.focus();
  });

  const setErr = (name, msg) => {
    const input = form.elements[name];
    input.setAttribute("aria-invalid", msg ? "true" : "false");
    input.closest(".field").querySelector(".err").textContent = msg || "";
  };

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    err.innerHTML = "";
    const ref = form.elements.ref.value.trim(), email = form.elements.email.value.trim();
    setErr("ref", ref ? "" : "Enter your booking reference.");
    setErr("email", /^\S+@\S+\.\S+$/.test(email) ? "" : "Enter the email you booked with.");
    if (!ref || !/^\S+@\S+\.\S+$/.test(email)) return;
    const b = VM.bookings.find(ref, email);
    if (!b) {
      err.innerHTML = '<p class="est__err">We couldn\'t find a booking with those details on this device. Check the reference and email, or make a booking first.</p>';
      return;
    }
    show(b.ref);
  });

  function show(ref) {
    const b = VM.bookings.all().find((x) => x.ref === ref);
    lookupSection.hidden = true;
    view.hidden = false;
    const cancelled = b.status === "cancelled";
    const awaiting = b.payment.status === "awaiting";
    const r = VM.booking.refund(b);
    const fmt = (iso) => date.fmt(date.parse(iso), { weekday: "short", day: "numeric", month: "long", year: "numeric" });
    const past = date.parse(b.depart) < date.today();

    view.innerHTML = `
      <div class="booking-view">
        <div><span class="badge ${cancelled ? "badge--cancelled" : awaiting ? "badge--wait" : ""}">${cancelled ? "Cancelled" : awaiting ? "Awaiting transfer" : "Confirmed"}</span></div>
        <h2 class="step-title" tabindex="-1">${esc(b.ref)}</h2>
        <p class="lead" style="margin-bottom:0">${fmt(b.arrive)} → ${fmt(b.depart)} · ${b.nights} night${b.nights === 1 ? "" : "s"} · ${b.adults + b.children} guest${b.adults + b.children === 1 ? "" : "s"}</p>
        <div class="confirm__actions" style="justify-content:flex-start;margin:.4rem 0">
          ${cancelled ? "" : '<button type="button" class="btn btn--solid" id="cal">Add to calendar</button>'}
          <button type="button" class="btn" id="print">Print receipt</button>
          <button type="button" class="btn" id="back">Look up another</button>
        </div>
        ${cancelled ? `<p class="est__err" role="status" style="background:#f3d5cf">This booking was cancelled${b.refund ? ` on ${esc(b.refund.at.slice(0, 10))}. Refund of ${money.fmt(b.refund.cents)} (${Math.round(b.refund.pct * 100)}% — ${esc(b.refund.label)}) is on its way (demo).` : "."}</p>` : `<h3 class="confirm__h" style="margin-top:1.4rem">Your itinerary</h3>${VM.booking.itinerary(b)}`}
        <h3 class="confirm__h">Receipt</h3>${VM.booking.receipt(b)}
        ${cancelled || past ? "" : `
        <div class="cancel-box">
          <h3>Need to cancel?</h3>
          <p>${awaiting ? "No payment has been received yet, so nothing needs refunding." : `If you cancel today (${r.days} day${r.days === 1 ? "" : "s"} before arrival) you'd receive <b>${money.fmt(r.refund)}</b> — ${esc(r.tier.text.toLowerCase())}.`}</p>
          <ul class="mini-policy">${data.cancellation.map((t) => `<li class="${t === r.tier ? "is-now" : ""}"><b>${esc(t.label)}</b><span>${esc(t.text)}</span></li>`).join("")}</ul>
          <button type="button" class="btn" id="cancel">Cancel this booking</button>
        </div>`}
      </div>`;
    $(".step-title", view).focus();

    $("#print").addEventListener("click", () => window.print());
    $("#back").addEventListener("click", () => { view.hidden = true; lookupSection.hidden = false; form.elements.ref.focus(); });
    $("#cal")?.addEventListener("click", () => VM.booking.download(`villa-mare-${b.ref}.ics`, VM.booking.ics(b), "text/calendar"));
    $("#cancel")?.addEventListener("click", async () => {
      const refund = VM.booking.refund(b);
      const ok = await ui.dialog({
        title: "Cancel this booking?",
        body: `<p>${awaiting ? "No payment has been taken, so there is nothing to refund." : `You'll be refunded <b>${money.fmt(refund.refund)}</b> (${Math.round(refund.pct * 100)}% — ${esc(refund.tier.label)}).`}</p><p>This frees your dates for other guests and can't be undone.</p>`,
        actions: [{ label: "Keep my booking", value: false }, { label: "Yes, cancel", value: true, primary: true }],
      });
      if (!ok) return;
      VM.bookings.update(b.ref, { status: "cancelled", refund: { cents: refund.refund, pct: refund.pct, label: refund.tier.label, at: new Date().toISOString() } });
      VM.toast(`Booking ${b.ref} cancelled.`, { type: "success" });
      show(b.ref);
    });
  }

  // arriving from checkout with a reference: stay on the lookup (email required) — never put personal data in the URL
})();
