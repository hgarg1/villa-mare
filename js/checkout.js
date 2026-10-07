/* Simulated checkout — five hash-routed steps: stay → extras → details → payment → confirmed.
   DEMO ONLY: no network calls, no real payment. Card numbers never touch storage (only brand + last4
   on a confirmed booking). State persists in localStorage ("vm:draft") so a refresh resumes. */
(() => {
  const { $, $$, date, data, pricing, money, esc, store, cards, render, ui } = VM;
  const h = esc;
  const root = $("#step-root");
  const stepsEl = $("#steps");
  const summaryBody = $("#summary-body");
  const holdEl = $("#hold");
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const params = new URLSearchParams(location.search);
  const HOLD_MS = (Number(params.get("hold")) || 15 * 60) * 1000;
  const flags = { failNetwork: params.get("fail") === "network" };

  const STEPS = [
    { id: "stay", label: "Stay" },
    { id: "extras", label: "Extras" },
    { id: "details", label: "Details" },
    { id: "payment", label: "Payment" },
    { id: "confirmed", label: "Confirmed" },
  ];
  const idx = (id) => STEPS.findIndex((s) => s.id === id);
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  const CAL = '<svg class="picker-icon" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><rect x="2" y="3" width="12" height="11" rx="1.5" fill="none" stroke="currentColor"/><path d="M2 6.5h12M5.5 1.5v3M10.5 1.5v3" fill="none" stroke="currentColor"/></svg>';
  const CHEV = '<svg class="picker-icon" viewBox="0 0 12 12" width="12" height="12" aria-hidden="true"><path d="m2 4 4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.2"/></svg>';

  /* =====================================================================
     Draft state
     ===================================================================== */
  const blank = () => ({
    stay: { arrive: "", depart: "", adults: 2, children: 0, promo: "" },
    extras: {},
    guest: { first: "", last: "", email: "", phoneCode: "+1", phone: "", arrival: "afternoon", bed: "standard", diet: [], purpose: "Holiday", notes: "" },
    pay: { method: "card", payFull: false, country: "US", zip: "", terms: false },
    holdExpires: 0,
    idemKey: VM.booking.uuid(),
  });
  const merge = (base, saved) => {
    const out = { ...base, ...saved };
    ["stay", "guest", "pay"].forEach((k) => (out[k] = { ...base[k], ...(saved && saved[k]) }));
    out.extras = { ...(saved && saved.extras) };
    return out;
  };

  const stored = store.get("draft");
  let draft = merge(blank(), stored);
  let prefilled = false;
  const hadDraft = !!stored;
  const save = () => store.set("draft", draft);

  // prefill from the rates page / home booking bar / experiences (?arrive=…&depart=…&adults=…&promo=…&extras=chef:2)
  // Dates/guests/promo come from the link, but extras picked earlier (e.g. "Add to your stay") and any
  // guest details already entered are carried over instead of being thrown away.
  if (params.has("arrive") || params.has("depart") || params.has("extras")) {
    prefilled = true;
    const d = blank();
    d.extras = { ...(stored && stored.extras) };
    d.guest = { ...d.guest, ...(stored && stored.guest) };
    if (date.isValidIso(params.get("arrive"))) d.stay.arrive = params.get("arrive");
    if (date.isValidIso(params.get("depart")) && d.stay.arrive) d.stay.depart = params.get("depart");
    d.stay.adults = VM.clamp(parseInt(params.get("adults"), 10) || 2, 1, 8);
    d.stay.children = VM.clamp(parseInt(params.get("children"), 10) || 0, 0, 6);
    d.stay.promo = (params.get("promo") || "").toUpperCase().slice(0, 20);
    (params.get("extras") || "").split(",").forEach((pair) => {
      const [id, qty] = pair.split(":");
      if (data.extras.some((e) => e.id === id)) d.extras[id] = Math.max(1, parseInt(qty, 10) || 1);
    });
    draft = d;
    save();
    history.replaceState(null, "", location.pathname + "#stay"); // keep the URL clean
  }

  /* =====================================================================
     Quote + validation
     ===================================================================== */
  const quote = () =>
    pricing.quote({ ...draft.stay, extras: Object.entries(draft.extras).map(([id, qty]) => ({ id, qty })), payFull: draft.pay.payFull });

  function normalizeExtras() {
    const q = quote();
    if (!q.nights) return; // extras can be pre-selected (e.g. from the Experiences page) before dates exist
    const ctx = { nights: q.nights, adults: +draft.stay.adults, children: +draft.stay.children };
    Object.keys(draft.extras).forEach((id) => {
      const ex = data.extras.find((e) => e.id === id);
      const max = ex && q.nights ? pricing.extraMax(ex, ctx) : 0;
      const v = Math.min(draft.extras[id], max);
      if (v > 0) draft.extras[id] = v;
      else delete draft.extras[id];
    });
  }

  function validateDetails(g = draft.guest) {
    const e = {};
    if (!g.first.trim()) e.first = "Please enter your first name.";
    if (!g.last.trim()) e.last = "Please enter your last name.";
    if (!/^\S+@\S+\.\S+$/.test(g.email.trim())) e.email = "Please enter a valid email address.";
    if (!VM.format.phoneValid(g.phoneCode, g.phone)) { const ph = VM.format.phoneCfg(g.phoneCode).ph; e.phone = ph ? `Enter a valid ${g.phoneCode} number, e.g. ${ph}.` : "Enter a phone number we can reach you on."; }
    return { ok: !Object.keys(e).length, errors: e };
  }

  const stayValid = () => quote().ready;

  /* =====================================================================
     Routing + guards
     ===================================================================== */
  let current = "stay";
  let busy = false;
  let renderedOnce = false;

  const lastBooking = () => {
    const ref = store.get("lastRef");
    return ref ? VM.bookings.all().find((b) => b.ref === ref) : null;
  };

  function allowed(id) {
    if (id === "confirmed") return !!lastBooking();
    const i = idx(id);
    if (i === 0) return true;
    if (!stayValid()) return false;
    if (i >= 3 && !validateDetails().ok) return false;
    return true;
  }
  function fallback(id) {
    if (!stayValid()) return "stay";
    if (idx(id) >= 3 && !validateDetails().ok) return "details";
    return "stay";
  }

  const go = (id) => {
    if (location.hash === "#" + id) route();
    else location.hash = id;
  };

  function route() {
    let id = (location.hash || "#stay").slice(1);
    if (!STEPS.some((s) => s.id === id)) id = "stay";
    if (busy) { location.replace("#" + current); return; }
    if (!allowed(id)) {
      const fb = fallback(id);
      if (location.hash !== "#" + fb) { location.replace("#" + fb); return; }
      id = fb;
    }
    show(id);
  }
  addEventListener("hashchange", route);

  /* =====================================================================
     Rendering shell: steps bar, summary, hold timer
     ===================================================================== */
  function renderSteps() {
    stepsEl.innerHTML = STEPS.map((s, i) => {
      const state = i < idx(current) ? "done" : i === idx(current) ? "current" : "todo";
      const clickable = state === "done" && current !== "confirmed" && allowed(s.id);
      return `<li class="steps__item is-${state}">${clickable ? `<button type="button" data-go="${s.id}">` : '<span class="steps__static"' + (state === "current" ? ' aria-current="step"' : "") + ">"}<i>${state === "done" ? "✓" : i + 1}</i><em>${s.label}</em>${clickable ? "</button>" : "</span>"}</li>`;
    }).join("");
  }
  stepsEl.addEventListener("click", (e) => {
    const b = e.target.closest("[data-go]");
    if (b) go(b.dataset.go);
  });

  let lastTotal = 0;
  const tweenText = (el, from, to) => {
    if (!el || from === to || !window.gsap || reduceMotion) { if (el) el.textContent = money.fmt(to); return; }
    const o = { v: from };
    gsap.to(o, { v: to, duration: 0.7, ease: "power2.out", onUpdate: () => (el.textContent = money.fmt(Math.round(o.v))) });
  };

  function renderSummary() {
    const q = quote();
    const st = draft.stay;
    const mini = $("#summary-total-mini");
    if (!q.nights) {
      summaryBody.innerHTML = `<h2 class="summary__title">Your stay</h2><p class="summary__empty">Choose your dates to see a full price. From <b>${money.fmt(Math.min(...data.seasons.map((s) => s.nightly)))}</b> per night.</p>
        <ul class="summary__facts"><li>Whole villa · up to 8 guests</li><li>Free cancellation up to 60 days before</li><li>30% deposit to confirm</li></ul>`;
      mini.textContent = "—";
      lastTotal = 0;
      return;
    }
    const guests = +st.adults + +st.children;
    const suffix = q.errors.length ? `<p class="est__err" role="alert">${h(q.errors.join(" "))}</p>` : "";
    summaryBody.innerHTML = `
      <h2 class="summary__title">Your stay</h2>
      <div class="summary__trip"><img src="assets/img/hero-dusk.jpg" alt="" /><div>
        <b>Villa Maré</b><span>${date.fmt(date.parse(st.arrive), { day: "numeric", month: "short" })} → ${date.fmt(date.parse(st.depart), { day: "numeric", month: "short", year: "numeric" })}</span>
        <span>${q.nights} night${q.nights === 1 ? "" : "s"} · ${guests} guest${guests === 1 ? "" : "s"}</span></div></div>
      ${suffix}${q.errors.length ? "" : render.breakdown(q)}
      ${q.ready ? '<p class="summary__note">Free cancellation up to 60 days before arrival.</p>' : ""}`;
    const totalEl = $(".bd__row--total dd", summaryBody);
    if (totalEl) tweenText(totalEl, lastTotal || q.total, q.total);
    tweenText(mini, lastTotal || q.total, q.total);
    lastTotal = q.total;
  }
  $("#summary-toggle").addEventListener("click", () => {
    const s = $("#summary");
    const open = s.classList.toggle("is-open");
    $("#summary-toggle").setAttribute("aria-expanded", String(open));
  });

  /* ---- hold timer ---- */
  let expiredShown = false;
  function startHold() {
    if (!draft.holdExpires) { draft.holdExpires = Date.now() + HOLD_MS; save(); }
  }
  function tickHold() {
    const showFor = ["extras", "details", "payment"].includes(current) && draft.holdExpires;
    holdEl.hidden = !showFor;
    if (!showFor) return;
    if (busy) { draft.holdExpires += 1000; return; } // pause while a payment is processing
    const left = Math.max(0, draft.holdExpires - Date.now());
    const mm = String(Math.floor(left / 60000)).padStart(2, "0"), ss = String(Math.floor((left % 60000) / 1000)).padStart(2, "0");
    $("#hold-time").textContent = `${mm}:${ss}`;
    holdEl.classList.toggle("is-low", left < 120000);
    const secs = Math.ceil(left / 1000);
    if (secs === 300 || secs === 60) $("#hold-live").textContent = `${secs / 60} minute${secs === 60 ? "" : "s"} left on your date hold.`;
    if (left <= 0 && !expiredShown) onHoldExpired();
  }
  setInterval(tickHold, 1000);

  async function onHoldExpired() {
    expiredShown = true;
    const choice = await ui.dialog({
      title: "Your hold has expired",
      body: "<p>We held these dates for you for a while, but time ran out. We can check they're still free and give you another window, or you can start again.</p>",
      actions: [{ label: "Start over", value: "reset" }, { label: "Extend my hold", value: "extend", primary: true }],
      dismissible: false,
    });
    expiredShown = false;
    if (choice === "extend" && quote().ready) {
      draft.holdExpires = Date.now() + HOLD_MS;
      save();
      VM.toast("Dates are still available — hold extended.", { type: "success" });
    } else {
      if (choice === "extend") VM.toast("Sorry — those dates were taken in the meantime.", { type: "error" });
      startOver();
    }
  }

  function startOver() {
    store.remove("draft");
    draft = blank();
    lastTotal = 0;
    go("stay"); // renders directly when already on #stay, otherwise via hashchange
  }

  /* =====================================================================
     Step: STAY
     ===================================================================== */
  const pickerField = (which, label) => `
    <div class="field"><label for="${which}-btn">${label}</label>
      <button type="button" class="picker-trigger" id="${which}-btn" data-dr-btn="${which}" aria-haspopup="dialog" aria-expanded="false"><span class="picker-value is-placeholder">Select date</span>${CAL}</button>
      <input type="hidden" name="${which}" value="${h(draft.stay[which])}" /><span class="err" role="alert"></span></div>`;

  const stepper = (name, label, v, min, max, group, noun = "") => `
    <div class="field"><span class="field-label" id="${name}-l">${label}</span>
      <div class="stepper" data-stepper ${group ? `data-group="${group}" data-cap="8"` : ""} data-min="${min}" data-max="${max}" data-noun="${noun}" role="group" aria-labelledby="${name}-l">
        <button type="button" class="stepper__btn" data-step="-1" aria-label="Fewer ${label.toLowerCase()}">−</button><output class="stepper__val" aria-live="polite"></output><button type="button" class="stepper__btn" data-step="1" aria-label="More ${label.toLowerCase()}">+</button>
        <input type="hidden" name="${name}" value="${v}" /></div></div>`;

  const selectHTML = ({ id, name, label, value, options, full = true }) => `
    <div class="field${full ? " field--full" : ""} select" data-select>
      <label id="${id}-l" for="${id}-btn">${label}</label>
      <button type="button" class="picker-trigger" id="${id}-btn" role="combobox" aria-haspopup="listbox" aria-expanded="false" aria-labelledby="${id}-l ${id}-btn"><span class="picker-value"></span>${CHEV}</button>
      <ul class="select__list" role="listbox" aria-labelledby="${id}-l">${options.map((o) => `<li role="option" data-value="${h(o.value)}"${o.label ? ` data-label="${h(o.label)}"` : ""}${o.search ? ` data-search="${h(o.search)}"` : ""}>${h(o.text)}</li>`).join("")}</ul>
      <input type="hidden" name="${name}" value="${h(value)}" /><span class="err" role="alert"></span></div>`;

  const steps = {
    stay: {
      title: "When would you like to stay?",
      html() {
        return `
          <h2 class="step-title" tabindex="-1">When would you like to stay?</h2>
          <p class="lead">Choose your dates and guests. The whole villa is yours, up to eight guests.</p>
          ${hadDraft && !prefilled && draft.stay.arrive && !renderedOnce ?'<p class="resume">We saved your booking in progress. <button type="button" class="link" id="start-over">Start over</button></p>' : ""}
          ${!store.available ? '<p class="est__err" role="alert">Your browser is blocking storage, so progress won\'t survive a refresh.</p>' : ""}
          <form class="form" id="f-stay" data-daterange data-rules="availability" novalidate>
            ${pickerField("arrive", "Arrival")}${pickerField("depart", "Departure")}
            ${stepper("adults", "Adults", draft.stay.adults, 1, 8, "guests")}${stepper("children", "Children", draft.stay.children, 0, 6, "guests")}
            <div class="field field--full"><div class="est__promo"><div class="field"><label for="promo">Promo code</label><input id="promo" name="promo" value="${h(draft.stay.promo)}" autocomplete="off" placeholder="e.g. WELCOME10" data-format="promo" /></div>
              <button type="button" class="est__apply" id="promo-apply">Apply</button></div><p class="promo-msg" id="promo-msg" role="status"></p></div>
            <div class="field--full" id="stay-errors" aria-live="polite"></div>
            <div class="field--full step-actions"><button class="btn btn--solid" type="submit">Continue to extras</button></div>
          </form>`;
      },
      bind() {
        const form = $("#f-stay");
        const dr = ui.dateRange(form, ui.availabilityRules());
        dr.set(draft.stay.arrive, draft.stay.depart, true);
        ui.steppers(form);
        const errs = $("#stay-errors");
        const msg = $("#promo-msg");
        const setMsg = (t, k) => { msg.textContent = t; msg.className = "promo-msg" + (k ? " is-" + k : ""); };

        const sync = () => {
          const s = dr.get();
          draft.stay.arrive = s.arrive; draft.stay.depart = s.depart;
          draft.stay.adults = +form.elements.adults.value; draft.stay.children = +form.elements.children.value;
          normalizeExtras();
          const q = quote();
          // a validated promo may stop applying when dates change
          if (draft.stay.promo && !q.promo && q.nights) { setMsg(`${draft.stay.promo} doesn't apply to these dates.`, "bad"); draft.stay.promo = ""; }
          save(); renderSummary();
          errs.innerHTML = q.nights && q.errors.length ? `<p class="est__err" role="alert">${h(q.errors.join(" "))}</p>` : "";
        };
        form.addEventListener("change", sync);

        const applyPromo = () => {
          const code = $("#promo").value.trim().toUpperCase();
          if (!code) { draft.stay.promo = ""; setMsg("", ""); save(); renderSummary(); return; }
          const s = dr.get();
          const nights = s.arrive && s.depart ? date.diff(date.parse(s.arrive), date.parse(s.depart)) : 0;
          const r = pricing.checkPromo(code, { nights, daysOut: s.arrive ? date.diff(date.today(), date.parse(s.arrive)) : 0 });
          draft.stay.promo = r.ok ? r.code : "";
          setMsg(r.message, r.ok ? "ok" : "bad");
          save(); renderSummary();
        };
        $("#promo-apply").addEventListener("click", applyPromo);
        $("#promo").addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); applyPromo(); } });
        if (draft.stay.promo) setMsg(`${draft.stay.promo} applied.`, "ok");
        $("#start-over")?.addEventListener("click", startOver);

        form.addEventListener("submit", (e) => {
          e.preventDefault();
          sync();
          const q = quote();
          if (!q.ready) {
            if (!draft.stay.arrive) $("#arrive-btn").setAttribute("aria-invalid", "true");
            errs.innerHTML = `<p class="est__err" role="alert">${h(q.errors.join(" ") || "Please choose your arrival and departure dates.")}</p>`;
            (!draft.stay.arrive ? $("#arrive-btn") : !draft.stay.depart ? $("#depart-btn") : errs).focus?.();
            return;
          }
          startHold();
          go("extras");
        });
      },
    },

    /* ---------------------------------------------------------------- */
    extras: {
      html() {
        const q = quote();
        const ctx = { nights: q.nights, adults: +draft.stay.adults, children: +draft.stay.children };
        return `
          <h2 class="step-title" tabindex="-1">Make it yours</h2>
          <p class="lead">Add anything you like — all optional, and you can change it later with the concierge.</p>
          <div class="extras">${data.extras.map((ex) => {
            const max = pricing.extraMax(ex, ctx);
            const v = Math.min(draft.extras[ex.id] || 0, max);
            const disabled = max < 1;
            return `<article class="extra" data-id="${ex.id}">
              <div class="img-mask ratio-32">${render.img(ex.img, ex.name, 'loading="lazy"')}</div>
              <div class="extra__body"><h3>${h(ex.name)}</h3><p>${h(ex.blurb)}</p>
                <div class="extra__row"><span class="extra__price">${money.fmt(ex.price)} <small>${h(ex.unitLabel)}</small></span>
                ${disabled ? '<span class="extra__na">Not available for this stay</span>' : ex.unit === "stay"
                  ? `<button type="button" class="btn extra__toggle" data-toggle="${ex.id}" aria-pressed="${v > 0}">${v > 0 ? "Added ✓" : "Add"}</button>`
                  : `<div class="stepper stepper--sm" data-stepper data-min="0" data-max="${max}" role="group" aria-label="${h(ex.name)} quantity"><button type="button" class="stepper__btn" data-step="-1" aria-label="Remove one ${h(ex.name)}">−</button><output class="stepper__val" aria-live="polite"></output><button type="button" class="stepper__btn" data-step="1" aria-label="Add one ${h(ex.name)}">+</button><input type="hidden" data-extra="${ex.id}" value="${v}" /></div>`}
                </div></div></article>`;
          }).join("")}</div>
          <div class="step-actions"><button class="btn" type="button" data-go="stay">Back</button><button class="btn btn--solid" type="button" id="next">Continue to details</button></div>`;
      },
      bind() {
        ui.steppers(root);
        root.addEventListener("change", onExtraChange);
        root.addEventListener("click", onExtraClick);
        $("#next").addEventListener("click", () => go("details"));
        $('[data-go="stay"]', root).addEventListener("click", () => go("stay"));
      },
    },

    /* ---------------------------------------------------------------- */
    details: {
      html() {
        const g = draft.guest;
        const codes = [["+1", "United States / Canada"], ["+44", "United Kingdom"], ["+33", "France"], ["+49", "Germany"], ["+34", "Spain"], ["+39", "Italy"], ["+31", "Netherlands"], ["+61", "Australia"], ["+65", "Singapore"], ["+81", "Japan"], ["+971", "United Arab Emirates"], ["+55", "Brazil"], ["+27", "South Africa"]];
        const diets = ["Vegetarian", "Vegan", "Gluten-free", "Nut allergy", "Shellfish allergy", "Halal", "Kosher"];
        const beds = [["standard", "As designed", "King beds, twins in Garden Suite II"], ["twins-joined", "Join the twins", "Garden Suite II made up as a king"], ["cot", "Add a child's cot", "Cot and high chair for little ones"]];
        return `
          <h2 class="step-title" tabindex="-1">Who's travelling?</h2>
          <p class="lead">Lead guest details. The team uses these to prepare your arrival.</p>
          <form class="form" id="f-details" novalidate>
            <div class="field"><label for="first">First name</label><input id="first" name="first" autocomplete="given-name" data-format="name" value="${h(g.first)}" /><span class="err" role="alert"></span></div>
            <div class="field"><label for="last">Last name</label><input id="last" name="last" autocomplete="family-name" data-format="name" value="${h(g.last)}" /><span class="err" role="alert"></span></div>
            <div class="field field--full"><label for="email">Email</label><input id="email" name="email" type="email" autocomplete="email" data-format="email" value="${h(g.email)}" /><span class="err" role="alert"></span></div>
            <div class="phone-row field--full">
              ${selectHTML({ id: "phonecode", name: "phoneCode", label: "Code", value: g.phoneCode, full: false, options: codes.map(([v, n]) => ({ value: v, text: `${v}  ${n}`, label: v, search: `${v} ${n}` })) })}
              <div class="field"><label for="phone">Phone</label><input id="phone" name="phone" type="tel" inputmode="tel" autocomplete="tel-national" data-format="phone" value="${h(g.phone)}" /><span class="err" role="alert"></span></div>
            </div>
            ${selectHTML({ id: "arrival", name: "arrival", label: "Estimated arrival time", value: g.arrival, options: [{ value: "morning", text: "Morning — before noon" }, { value: "afternoon", text: "Afternoon — 3 pm to 6 pm" }, { value: "evening", text: "Evening — after 6 pm" }, { value: "unsure", text: "Not sure yet" }] })}
            <fieldset class="choice field--full"><legend class="field-label">Bed arrangement</legend><div class="choice__grid">${beds.map(([v, t, s]) => `<label class="choice__card"><input type="radio" name="bed" value="${v}" ${g.bed === v ? "checked" : ""} /><span><b>${t}</b><small>${s}</small></span></label>`).join("")}</div></fieldset>
            <fieldset class="chips field--full"><legend class="field-label">Dietary needs</legend><div class="chips__row">${diets.map((d) => `<label class="chip"><input type="checkbox" name="diet" value="${d}" ${g.diet.includes(d) ? "checked" : ""} /><span>${d}</span></label>`).join("")}</div></fieldset>
            ${selectHTML({ id: "purpose", name: "purpose", label: "Purpose of your trip", value: g.purpose, options: ["Holiday", "Honeymoon", "Family gathering", "Wedding or celebration", "Wellness retreat", "Corporate retreat", "Something else"].map((v) => ({ value: v, text: v })) })}
            <div class="field field--full"><label for="notes">Anything else we should know?</label><textarea id="notes" name="notes" placeholder="Celebrations, allergies, favourite flowers…">${h(g.notes)}</textarea></div>
            <div class="field--full step-actions"><button class="btn" type="button" data-go="extras">Back</button><button class="btn btn--solid" type="submit">Continue to payment</button></div>
          </form>`;
      },
      bind() {
        const form = $("#f-details");
        $$("[data-select]", form).forEach((s) => ui.select(s));
        const codeSel = $("[data-select]", form);
        const pf = VM.format.bindPhone(form.elements.phone, () => form.elements.phoneCode.value, (code) => codeSel._select.set(code));
        form.elements.phoneCode.addEventListener("change", () => { pf.refresh(); if (form.elements.phone.value) setErr("phone", validateDetails({ ...draft.guest, phoneCode: form.elements.phoneCode.value, phone: form.elements.phone.value }).errors.phone); });
        const read = () => {
          const d = new FormData(form);
          draft.guest = { first: d.get("first"), last: d.get("last"), email: d.get("email"), phoneCode: d.get("phoneCode"), phone: d.get("phone"), arrival: d.get("arrival"), bed: d.get("bed"), diet: d.getAll("diet"), purpose: d.get("purpose"), notes: d.get("notes") };
          save();
        };
        const FIELDS = ["first", "last", "email", "phone"];
        const setErr = (k, msg) => {
          const input = form.elements[k];
          input.setAttribute("aria-invalid", msg ? "true" : "false");
          input.closest(".field").querySelector(".err").textContent = msg || "";
        };
        const showErr = (errors, focus) => {
          FIELDS.forEach((k) => setErr(k, errors[k]));
          if (focus) { const k = FIELDS.find((x) => errors[x]); if (k) form.elements[k].focus(); }
        };
        form.addEventListener("input", read);
        form.addEventListener("change", read);
        FIELDS.forEach((k) => form.elements[k].addEventListener("blur", () => { read(); setErr(k, validateDetails().errors[k]); }));
        form.addEventListener("submit", (e) => {
          e.preventDefault(); read();
          const v = validateDetails();
          showErr(v.errors, true);
          if (v.ok) go("payment");
        });
        $('[data-go="extras"]', form).addEventListener("click", () => { read(); go("extras"); });
      },
    },

    /* ---------------------------------------------------------------- */
    payment: {
      html() {
        const q = quote();
        const pay = draft.pay;
        const countries = [["US", "United States"], ["GB", "United Kingdom"], ["CA", "Canada"], ["FR", "France"], ["DE", "Germany"], ["ES", "Spain"], ["IT", "Italy"], ["AU", "Australia"], ["SG", "Singapore"], ["AE", "United Arab Emirates"], ["BR", "Brazil"], ["JP", "Japan"]];
        const schedule = q.fullOnly
          ? `<p class="note">Your stay is within 30 days, so the full amount of <b>${money.fmt(q.total)}</b> is due now.</p>`
          : `<fieldset class="choice"><legend class="field-label">When would you like to pay?</legend><div class="choice__grid">
              <label class="choice__card"><input type="radio" name="sched" value="deposit" ${!pay.payFull ? "checked" : ""} /><span><b>Pay a 30% deposit</b><small>${money.fmt(Math.round(q.total * 0.3))} now · balance due ${date.fmt(date.addDays(date.parse(draft.stay.arrive), -30), { day: "numeric", month: "short" })}</small></span></label>
              <label class="choice__card"><input type="radio" name="sched" value="full" ${pay.payFull ? "checked" : ""} /><span><b>Pay in full</b><small>${money.fmt(q.total)} now · nothing more to pay</small></span></label></div></fieldset>`;
        return `
          <h2 class="step-title" tabindex="-1">Payment</h2>
          <div class="demo-banner" role="note"><b>Demo checkout — nothing is charged.</b> Use a test card:
            <ul>${data.demoCards.map((c) => `<li><button type="button" class="link" data-fill="${c.number}">${c.number}</button> <span>${h(c.outcome)}</span></li>`).join("")}</ul>Any future expiry and any 3-digit code.</div>
          <div id="pay-error" class="est__err" role="alert" hidden tabindex="-1"></div>
          ${schedule}
          <div class="tabs" role="tablist" aria-label="Payment method">
            <button type="button" role="tab" id="tab-card" aria-controls="panel-card" aria-selected="${pay.method === "card"}" tabindex="${pay.method === "card" ? 0 : -1}">Card</button>
            <button type="button" role="tab" id="tab-bank" aria-controls="panel-bank" aria-selected="${pay.method === "bank"}" tabindex="${pay.method === "bank" ? 0 : -1}">Bank transfer</button>
          </div>
          <form class="form" id="f-pay" novalidate>
            <div role="tabpanel" id="panel-card" aria-labelledby="tab-card" class="form tabpanel" ${pay.method === "card" ? "" : "hidden"}>
              <div class="field field--full"><label for="cc-name">Name on card</label><input id="cc-name" name="ccname" autocomplete="cc-name" data-format="name" /><span class="err" role="alert"></span></div>
              <div class="field field--full"><label for="cc-number">Card number</label><div class="cc-wrap"><input id="cc-number" name="ccnumber" inputmode="numeric" autocomplete="cc-number" placeholder="1234 1234 1234 1234" /><span class="cc-brand" id="cc-brand" aria-hidden="true"></span></div><span class="err" role="alert"></span></div>
              <div class="field"><label for="cc-exp">Expiry</label><input id="cc-exp" name="ccexp" inputmode="numeric" autocomplete="cc-exp" placeholder="MM/YY" maxlength="5" /><span class="err" role="alert"></span></div>
              <div class="field"><label for="cc-cvc">Security code</label><input id="cc-cvc" name="cccvc" inputmode="numeric" autocomplete="cc-csc" placeholder="123" maxlength="4" /><span class="err" role="alert"></span></div>
              ${selectHTML({ id: "country", name: "country", label: "Billing country", value: pay.country, full: false, options: countries.map(([v, t]) => ({ value: v, text: t })) })}
              <div class="field"><label for="zip" id="zip-label">Postal code</label><input id="zip" name="zip" autocomplete="postal-code" value="${h(pay.zip)}" /><span class="err" role="alert"></span></div>
            </div>
            <div role="tabpanel" id="panel-bank" aria-labelledby="tab-bank" class="tabpanel bank" ${pay.method === "bank" ? "" : "hidden"}>
              <p>Confirm now and send <b>${money.fmt(q.payNow)}</b> by bank transfer within 3 days to hold your booking.</p>
              <dl class="bank__details"><div><dt>Account name</dt><dd>Villa Maré Holdings (demo)</dd></div><div><dt>IBAN</dt><dd>GB00 DEMO 0000 0000 0000 00</dd></div><div><dt>Reference</dt><dd>Issued after confirmation</dd></div></dl>
            </div>
            <label class="check field--full"><input type="checkbox" name="terms" ${pay.terms ? "checked" : ""} /><span class="check__box" aria-hidden="true"></span><span>I agree to the <a href="policies.html#terms" target="_blank" rel="noopener">terms</a>, <a href="policies.html#cancellation" target="_blank" rel="noopener">cancellation policy</a> and house rules.</span></label>
            <span class="err field--full" id="terms-err" role="alert"></span>
            <p class="note field--full">A refundable security hold of ${money.fmt(data.fees.securityHold)} is requested on arrival, not today.</p>
            <div class="field--full step-actions"><button class="btn" type="button" data-go="details">Back</button><button class="btn btn--solid" type="submit" id="pay-btn"><span class="pay-label"></span></button></div>
          </form>`;
      },
      bind() {
        const form = $("#f-pay");
        ui.select($("[data-select]", form));
        const pz = VM.format.bindPostal($("#zip"), () => form.elements.country.value, $("#zip-label"));
        form.elements.country.addEventListener("change", () => pz.refresh());
        const q0 = () => quote();
        const payLabel = () => { $(".pay-label", form).textContent = draft.pay.method === "bank" ? "Confirm booking" : `Pay ${money.fmt(q0().payNow)}`; };
        payLabel();

        /* schedule radios */
        $$('input[name="sched"]', root).forEach((r) => r.addEventListener("change", () => { draft.pay.payFull = r.value === "full"; save(); renderSummary(); payLabel(); }));

        /* tabs (roving tabindex, arrow keys) */
        const tabs = $$('[role="tab"]', root);
        const selectTab = (tab, focus) => {
          tabs.forEach((t) => { const on = t === tab; t.setAttribute("aria-selected", String(on)); t.tabIndex = on ? 0 : -1; $("#" + t.getAttribute("aria-controls")).hidden = !on; });
          draft.pay.method = tab.id === "tab-bank" ? "bank" : "card"; save(); payLabel();
          if (focus) tab.focus();
        };
        tabs.forEach((t, i) => {
          t.addEventListener("click", () => selectTab(t));
          t.addEventListener("keydown", (e) => {
            const k = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
            if (k) { e.preventDefault(); selectTab(tabs[(i + k + tabs.length) % tabs.length], true); }
            if (e.key === "Home") { e.preventDefault(); selectTab(tabs[0], true); }
            if (e.key === "End") { e.preventDefault(); selectTab(tabs[tabs.length - 1], true); }
          });
        });

        /* card input formatting */
        const num = $("#cc-number"), exp = $("#cc-exp"), cvc = $("#cc-cvc"), brandEl = $("#cc-brand");
        num.addEventListener("input", () => {
          num.value = cards.format(num.value);
          const b = cards.brand(num.value);
          brandEl.textContent = b ? b.name : "";
          cvc.maxLength = b ? b.cvc : 4;
        });
        exp.addEventListener("input", () => (exp.value = cards.formatExpiry(exp.value)));
        cvc.addEventListener("input", () => (cvc.value = cards.digits(cvc.value)));

        /* test-card quick fill (bound to the banner so handlers never accumulate across renders) */
        $(".demo-banner", root).addEventListener("click", (e) => {
          const b = e.target.closest("[data-fill]");
          if (!b) return;
          num.value = cards.format(b.dataset.fill); num.dispatchEvent(new Event("input"));
          exp.value = "12/34"; cvc.value = "123";
          const nm = $("#cc-name"); if (!nm.value) nm.value = `${draft.guest.first} ${draft.guest.last}`.trim() || "Test Guest";
          if (!$("#zip").value) $("#zip").value = "10001";
          num.focus();
        });

        form.addEventListener("change", (e) => {
          if (e.target.name === "terms") { draft.pay.terms = e.target.checked; save(); if (e.target.checked) $("#terms-err").textContent = ""; }
          if (e.target.name === "country") { draft.pay.country = e.target.value; save(); }
        });
        $("#zip").addEventListener("input", (e) => { draft.pay.zip = e.target.value; save(); });
        $('[data-go="details"]', form).addEventListener("click", () => go("details"));
        form.addEventListener("submit", (e) => { e.preventDefault(); pay(form); });
      },
    },

    /* ---------------------------------------------------------------- */
    confirmed: {
      html() {
        const b = lastBooking();
        const awaiting = b.payment.status === "awaiting";
        return `
          <div class="confirm">
            <div class="confirm__badge${awaiting ? " is-wait" : ""}" aria-hidden="true">${awaiting ? "…" : "✓"}</div>
            <p class="eyebrow">${awaiting ? "Booking reserved" : "Booking confirmed"}</p>
            <h2 class="step-title" tabindex="-1">Thank you, ${h(b.guest.first)}. ${awaiting ? "Your stay is reserved." : "You're booked."}</h2>
            <p class="lead">A confirmation was sent to <b>${h(b.guest.email)}</b> <small>(demo: no email is really sent)</small>.${awaiting ? ` Please transfer ${money.fmt(b.totals.payNow)} within 3 days.` : ""}</p>
            <div class="refbox"><span>Your reference</span><b id="ref">${h(b.ref)}</b><button type="button" class="link" id="copy-ref">Copy</button></div>
            <div class="confirm__actions">
              <button type="button" class="btn btn--solid" id="add-cal">Add to calendar</button>
              <button type="button" class="btn" id="print">Print receipt</button>
              <a class="btn" href="booking.html?ref=${encodeURIComponent(b.ref)}">Manage booking</a>
            </div>
            <h3 class="confirm__h">Your itinerary</h3>${VM.booking.itinerary(b)}
            <h3 class="confirm__h">What happens next</h3>
            <ul class="next-list"><li>Amara, your concierge, will message you within a day to plan your arrival.</li><li>Tell us about dietary needs, celebrations or transfers any time.</li><li>Your balance is due ${b.totals.balanceDue ? date.fmt(date.parse(b.totals.balanceDue), { day: "numeric", month: "long", year: "numeric" }) : "— nothing more to pay"}.</li></ul>
            <h3 class="confirm__h">Receipt</h3>${VM.booking.receipt(b)}
          </div>`;
      },
      bind() {
        const b = lastBooking();
        $("#add-cal").addEventListener("click", () => VM.booking.download(`villa-mare-${b.ref}.ics`, VM.booking.ics(b), "text/calendar"));
        $("#print").addEventListener("click", () => window.print());
        $("#copy-ref").addEventListener("click", async () => {
          try { await navigator.clipboard.writeText(b.ref); VM.toast("Reference copied.", { type: "success" }); } catch (e) { VM.toast("Select the reference and copy it manually.", { type: "error" }); }
        });
      },
    },
  };

  /* ---- extras handlers (delegated; bound once per render) ---- */
  function onExtraChange(e) {
    const el = e.target.closest("[data-extra]");
    if (!el) return;
    draft.extras[el.dataset.extra] = +el.value;
    if (!+el.value) delete draft.extras[el.dataset.extra];
    save(); renderSummary();
  }
  function onExtraClick(e) {
    const t = e.target.closest("[data-toggle]");
    if (!t) return;
    const id = t.dataset.toggle;
    if (draft.extras[id]) delete draft.extras[id]; else draft.extras[id] = 1;
    t.setAttribute("aria-pressed", String(!!draft.extras[id]));
    t.textContent = draft.extras[id] ? "Added ✓" : "Add";
    save(); renderSummary();
  }

  /* =====================================================================
     Payment processing (simulated)
     ===================================================================== */
  const showPayError = (msg) => {
    const el = $("#pay-error");
    if (!el) return;
    el.textContent = msg;
    el.hidden = !msg;
    if (msg) el.focus();
  };

  function readCard() {
    const f = $("#f-pay").elements;
    const v = cards.validate({ number: f.ccnumber.value, exp: f.ccexp.value, cvc: f.cccvc.value, name: f.ccname.value });
    const errors = { ...v.errors };
    if (!VM.format.postalValid(f.country.value, f.zip.value)) { const c = VM.format.postalCfg(f.country.value); errors.zip = `Enter a valid ${c.label.toLowerCase()}${c.hint ? " (" + c.hint + ")" : ""}.`; }
    return { ok: !Object.keys(errors).length, errors, number: f.ccnumber.value, brand: v.brand };
  }
  const showCardErrors = (errors) => {
    const map = { ccname: "name", ccnumber: "number", ccexp: "exp", cccvc: "cvc", zip: "zip" };
    const f = $("#f-pay").elements;
    let first = null;
    Object.entries(map).forEach(([field, key]) => {
      const el = f[field];
      el.setAttribute("aria-invalid", errors[key] ? "true" : "false");
      el.closest(".field").querySelector(".err").textContent = errors[key] || "";
      if (errors[key] && !first) first = el;
    });
    first?.focus();
  };

  const processing = () => {
    ui.dialog({
      title: "Processing your payment",
      body: '<div class="spinner" aria-hidden="true"></div><p>Please don\'t close this window.</p>',
      actions: [], dismissible: false, className: "modal--processing",
    });
    return ui._lastDialog;
  };

  async function secureCheck() {
    return new Promise((resolve) => {
      let attempts = 3;
      const body = document.createElement("div");
      body.innerHTML = `<p>Your bank needs to verify this payment. Enter the 6-digit code from your banking app. <small>(Demo code: ${data.demoSecureCode})</small></p>
        <div class="otp field"><label class="sr-only" for="otp">6-digit code</label><input id="otp" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="••••••" data-autofocus /><span class="err" role="alert"></span></div>
        <div class="modal__actions"><button type="button" class="btn" data-cancel>Cancel</button><button type="button" class="btn btn--solid" data-verify>Verify</button></div>`;
      ui.dialog({ title: "Verify with your bank", body, actions: [], dismissible: false });
      const w = ui._lastDialog;
      const input = $("#otp", body), err = $(".err", body);
      const verify = () => {
        if (input.value === data.demoSecureCode) { w.close(true); resolve(true); return; }
        attempts--;
        input.value = "";
        if (attempts <= 0) { w.close(false); resolve(false); return; }
        err.textContent = `That code isn't right. ${attempts} attempt${attempts === 1 ? "" : "s"} left.`;
        input.focus();
      };
      $("[data-verify]", body).addEventListener("click", verify);
      $("[data-cancel]", body).addEventListener("click", () => { w.close(false); resolve(false); });
      input.addEventListener("input", () => (input.value = cards.digits(input.value)));
      input.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); verify(); } });
    });
  }

  function finalize(method, card) {
    const existing = VM.bookings.byKey(draft.idemKey); // idempotency: never create a second booking
    if (existing) { store.set("lastRef", existing.ref); return existing; }
    const q = quote();
    if (!q.ready) throw { kind: "unavailable", errors: q.errors };
    const g = draft.guest;
    const b = {
      ref: VM.booking.makeRef(), idemKey: draft.idemKey, createdAt: new Date().toISOString(), status: "confirmed",
      arrive: draft.stay.arrive, depart: draft.stay.depart, nights: q.nights, adults: +draft.stay.adults, children: +draft.stay.children,
      guest: { ...g, phone: `${g.phoneCode} ${g.phone}` },
      extras: q.extras, promo: q.promo,
      totals: { subtotal: q.subtotal, discount: q.discount, extrasTotal: q.extrasTotal, cleaning: q.cleaning, service: q.service, tax: q.tax, total: q.total, payNow: q.payNow, balance: q.balance, balanceDue: q.balanceDue },
      payment: method === "bank" ? { method, paid: 0, due: q.payNow, status: "awaiting" } : { method, brand: card.brand ? card.brand.name : "Card", last4: cards.digits(card.number).slice(-4), paid: q.payNow, status: "paid" },
      quote: q,
    };
    VM.bookings.add(b);
    store.set("lastRef", b.ref);
    store.remove("draft");
    return b;
  }

  async function pay(form) {
    if (busy) return;
    showPayError("");
    const method = draft.pay.method;
    let card = null;
    if (method === "card") {
      const c = readCard();
      if (!c.ok) { showCardErrors(c.errors); return; }
      card = c;
    }
    if (!draft.pay.terms) { $("#terms-err").textContent = "Please accept the terms to continue."; $('input[name="terms"]', form).focus(); return; }
    const q = quote();
    if (!q.ready) return unavailable(q.errors);

    busy = true;
    const btn = $("#pay-btn");
    btn.disabled = true;
    let dlg = processing();
    try {
      await sleep(1500 + Math.random() * 900);
      if (flags.failNetwork) { flags.failNetwork = false; throw { kind: "network" }; }
      const outcome = method === "bank" ? "success" : cards.outcome(card.number);
      if (outcome === "declined") throw { kind: "declined" };
      if (outcome === "secure") {
        dlg.close();
        const ok = await secureCheck();
        if (!ok) throw { kind: "secure" };
        dlg = processing();
        await sleep(900);
      }
      const booking = finalize(method, card);
      dlg.close();
      draft = blank();
      // wipe card fields from the DOM before leaving the step
      ["ccnumber", "ccexp", "cccvc", "ccname"].forEach((n) => { if (form.elements[n]) form.elements[n].value = ""; });
      busy = false;
      holdEl.hidden = true;
      VM.toast(`Confirmation ${booking.ref} sent to ${booking.guest.email}.`, { type: "success", ms: 6000 });
      go("confirmed");
    } catch (e) {
      dlg.close();
      busy = false;
      btn.disabled = false;
      if (e.kind === "declined") showPayError("Your card was declined (demo: insufficient funds). Please try a different card.");
      else if (e.kind === "secure") showPayError("We couldn't verify this payment with your bank. You haven't been charged — please try again or use another card.");
      else if (e.kind === "network") showPayError("The connection timed out. You haven't been charged — please try again.");
      else if (e.kind === "unavailable") unavailable(e.errors);
      else { console.error(e); showPayError("Something went wrong. You haven't been charged — please try again."); }
    }
  }

  async function unavailable(errors) {
    await ui.dialog({ title: "Those dates just changed", body: `<p>${h((errors || []).join(" ") || "Your dates are no longer available.")}</p><p>Please choose new dates — nothing has been charged.</p>`, actions: [{ label: "Choose new dates", value: true, primary: true }] });
    draft.holdExpires = 0; save();
    go("stay");
  }

  /* =====================================================================
     show(): render a step
     ===================================================================== */
  function show(id) {
    current = id;
    const step = steps[id];
    root.removeEventListener("change", onExtraChange);
    root.removeEventListener("click", onExtraClick);
    root.innerHTML = step.html();
    VM.format.bind(root);
    $(".checkout").classList.toggle("is-done", id === "confirmed");
    document.title = `${STEPS[idx(id)].label} — Book your stay — Villa Maré`;
    renderSteps();
    renderSummary();
    step.bind();
    tickHold();
    if (window.gsap && !reduceMotion) gsap.fromTo(root.children, { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.55, ease: "power3.out", stagger: 0.05, clearProps: "opacity,transform" });
    if (renderedOnce) { $(".step-title", root)?.focus({ preventScroll: true }); scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" }); }
    renderedOnce = true;
  }

  // leaving an in-progress booking mid-way: confirm on unload only while a payment is processing
  addEventListener("beforeunload", (e) => { if (busy) { e.preventDefault(); e.returnValue = ""; } });

  route();
})();
