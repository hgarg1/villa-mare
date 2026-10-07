/* Custom UI components (no native select / date inputs):
     VM.ui.select(root)        listbox select, values kept in a hidden input
     VM.ui.steppers(root)      +/- counters with optional shared cap
     VM.ui.dateRange(root,opts) range picker (one shared popover, many instances)
     VM.ui.dialog(opts)        accessible modal → Promise
     VM.toast(msg, opts)       polite toast
   Controls dispatch a bubbling "change" event on their hidden input. */
(() => {
  const VM = (window.VM = window.VM || {});
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const clamp = (n, a, b) => Math.min(Math.max(n, a), b);
  const emit = (input) => input.dispatchEvent(new Event("change", { bubbles: true }));
  const lenis = (fn) => window.__lenis && window.__lenis[fn]();
  const ui = (VM.ui = VM.ui || {});

  /* ======================================================================
     Toast
     ====================================================================== */
  let toastHost;
  VM.toast = (msg, { type = "info", ms = 4200 } = {}) => {
    if (!toastHost) {
      toastHost = document.createElement("div");
      toastHost.className = "toasts";
      toastHost.setAttribute("role", "status");
      toastHost.setAttribute("aria-live", "polite");
      document.body.append(toastHost);
    }
    const t = document.createElement("div");
    t.className = `toast toast--${type}`;
    t.textContent = msg;
    toastHost.append(t);
    requestAnimationFrame(() => t.classList.add("is-in"));
    setTimeout(() => {
      t.classList.remove("is-in");
      setTimeout(() => t.remove(), 500);
    }, ms);
  };

  /* ======================================================================
     Dialog (modal) — focus trap, Esc, restores focus. Resolves with the action value.
     ====================================================================== */
  ui.dialog = ({ title, body = "", actions = [{ label: "OK", value: true, primary: true }], dismissible = true, className = "" }) =>
    new Promise((resolve) => {
      const opener = document.activeElement;
      const wrap = document.createElement("div");
      wrap.className = `modal ${className}`;
      const id = "dlg-" + Math.random().toString(36).slice(2, 7);
      wrap.innerHTML = `
        <div class="modal__scrim"></div>
        <div class="modal__box" role="dialog" aria-modal="true" aria-labelledby="${id}-t" tabindex="-1">
          <h2 id="${id}-t" class="modal__title">${title}</h2>
          <div class="modal__body"></div>
          <div class="modal__actions"></div>
        </div>`;
      const box = $(".modal__box", wrap);
      const bodyEl = $(".modal__body", wrap);
      typeof body === "string" ? (bodyEl.innerHTML = body) : bodyEl.append(body);
      const actionsEl = $(".modal__actions", wrap);
      actions.forEach((a) => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = a.primary ? "btn btn--solid" : "btn";
        b.textContent = a.label;
        b.addEventListener("click", () => close(a.value, a));
        actionsEl.append(b);
      });
      let done = false;
      const close = (value) => {
        if (done) return;
        done = true;
        document.removeEventListener("keydown", onKey, true);
        wrap.classList.remove("is-open");
        lenis("start");
        setTimeout(() => wrap.remove(), 350);
        opener?.focus?.();
        resolve(value);
      };
      const onKey = (e) => {
        if (e.key === "Escape" && dismissible) { e.preventDefault(); e.stopPropagation(); close(undefined); }
        if (e.key === "Tab") {
          const f = $$("button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])", box).filter((x) => !x.disabled && x.offsetParent !== null);
          if (!f.length) return;
          const first = f[0], last = f[f.length - 1];
          if (e.shiftKey && (document.activeElement === first || document.activeElement === box)) { e.preventDefault(); last.focus(); }
          else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
        }
      };
      document.addEventListener("keydown", onKey, true);
      if (dismissible) $(".modal__scrim", wrap).addEventListener("click", () => close(undefined));
      document.body.append(wrap);
      lenis("stop");
      requestAnimationFrame(() => {
        wrap.classList.add("is-open");
        (box.querySelector("[data-autofocus]") || box.querySelector("input, .btn--solid, button") || box).focus();
      });
      wrap.close = close;
      wrap.box = box;
      ui._lastDialog = wrap;
    });

  /* ======================================================================
     Select (listbox)
     ====================================================================== */
  function initSelect(root) {
    if (root._select) return root._select;
    const btn = $(".picker-trigger", root);
    const list = $(".select__list", root);
    const input = $('input[type="hidden"]', root);
    const label = $(".picker-value", btn);
    const opts = $$('[role="option"]', list);
    let selected = Math.max(0, opts.findIndex((o) => o.dataset.value === input.value));
    let active = selected;
    let typed = "", typedTimer;

    opts.forEach((o, i) => (o.id = `${btn.id}-opt-${i}`));
    list.id = list.id || `${btn.id}-list`;
    btn.setAttribute("aria-controls", list.id);

    const paint = () => {
      opts.forEach((o, i) => {
        o.setAttribute("aria-selected", String(i === selected));
        o.classList.toggle("is-active", i === active);
      });
      label.textContent = opts[selected].dataset.label || opts[selected].textContent;
      label.classList.remove("is-placeholder");
      btn.setAttribute("aria-activedescendant", root.classList.contains("is-open") ? opts[active].id : "");
    };
    const reveal = () => {
      const o = opts[active];
      if (o.offsetTop < list.scrollTop) list.scrollTop = o.offsetTop;
      else if (o.offsetTop + o.offsetHeight > list.scrollTop + list.clientHeight) list.scrollTop = o.offsetTop + o.offsetHeight - list.clientHeight;
    };
    const setActive = (i) => { active = clamp(i, 0, opts.length - 1); paint(); reveal(); };
    const choose = (i) => {
      const changed = i !== selected;
      selected = active = i;
      input.value = opts[i].dataset.value;
      paint();
      if (changed) emit(input);
    };
    const open = () => {
      if (root.classList.contains("is-open")) return;
      root.classList.remove("is-up");
      root.classList.add("is-open");
      btn.setAttribute("aria-expanded", "true");
      const r = list.getBoundingClientRect();
      if (r.bottom > innerHeight - 12 && btn.getBoundingClientRect().top > r.height + 24) root.classList.add("is-up");
      active = selected;
      paint(); reveal();
    };
    const close = () => {
      root.classList.remove("is-open");
      btn.setAttribute("aria-expanded", "false");
      paint();
    };

    btn.addEventListener("click", () => (root.classList.contains("is-open") ? close() : open()));
    btn.addEventListener("blur", close);
    list.addEventListener("mousedown", (e) => e.preventDefault());
    list.addEventListener("click", (e) => {
      const o = e.target.closest('[role="option"]');
      if (!o) return;
      choose(opts.indexOf(o));
      close();
    });
    list.addEventListener("mousemove", (e) => {
      const o = e.target.closest('[role="option"]');
      if (o && opts.indexOf(o) !== active) { active = opts.indexOf(o); paint(); }
    });

    const matches = (o, q) => {
      const t = (o.dataset.search || o.textContent).trim().toLowerCase();
      return t.startsWith(q) || t.split(/[\s,()+-]+/).some((w) => w && w.startsWith(q));
    };
    btn.addEventListener("keydown", (e) => {
      const isOpen = root.classList.contains("is-open");
      switch (e.key) {
        case "ArrowDown": e.preventDefault(); isOpen ? setActive(active + 1) : open(); break;
        case "ArrowUp": e.preventDefault(); isOpen ? setActive(active - 1) : open(); break;
        case "Home": if (isOpen) { e.preventDefault(); setActive(0); } break;
        case "End": if (isOpen) { e.preventDefault(); setActive(opts.length - 1); } break;
        case "Enter":
        case " ":
          if (isOpen) { e.preventDefault(); choose(active); close(); }
          break;
        case "Escape": if (isOpen) { e.preventDefault(); e.stopPropagation(); close(); } break;
        case "Tab": if (isOpen) { choose(active); close(); } break;
        default:
          if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
            typed += e.key.toLowerCase();
            clearTimeout(typedTimer);
            typedTimer = setTimeout(() => (typed = ""), 700);
            const hit = opts.findIndex((o) => matches(o, typed));
            if (hit > -1) { open(); setActive(hit); }
          }
      }
    });

    paint();
    root._select = {
      get: () => input.value,
      set(v, silent) {
        const i = opts.findIndex((o) => o.dataset.value === v);
        if (i < 0) return;
        const changed = i !== selected;
        selected = active = i; input.value = v; paint();
        if (changed && !silent) emit(input);
      },
    };
    return root._select;
  }
  ui.select = initSelect;

  /* ======================================================================
     Steppers
     ====================================================================== */
  ui.steppers = (scope = document) => {
    const steppers = $$("[data-stepper]", scope);
    const groups = {};
    steppers.forEach((s) => (groups[s.dataset.group || s.id] ||= []).push(s));

    const update = () => {
      Object.values(groups).forEach((members) => {
        const cap = Number(members[0].dataset.cap) || Infinity;
        const total = members.reduce((n, s) => n + Number($('input[type="hidden"]', s).value), 0);
        members.forEach((s) => {
          const v = Number($('input[type="hidden"]', s).value);
          const max = s._max ? s._max() : Number(s.dataset.max || 99);
          $('[data-step="-1"]', s).disabled = v <= Number(s.dataset.min || 0);
          $('[data-step="1"]', s).disabled = v >= max || total >= cap;
        });
      });
    };

    steppers.forEach((s) => {
      if (s._init) return;
      s._init = true;
      const input = $('input[type="hidden"]', s);
      const out = $("output", s);
      const noun = s.dataset.noun || "";
      const show = () => (out.textContent = input.value + (noun ? ` ${noun}` : ""));
      s._refresh = () => { show(); update(); };
      s.addEventListener("click", (e) => {
        const b = e.target.closest("[data-step]");
        if (!b || b.disabled) return;
        const max = s._max ? s._max() : Number(s.dataset.max || 99);
        input.value = clamp(Number(input.value) + Number(b.dataset.step), Number(s.dataset.min || 0), max);
        show(); update(); emit(input);
        out.classList.remove("bump"); void out.offsetWidth; out.classList.add("bump");
      });
      show();
    });
    update();
  };

  /* ======================================================================
     Date-range picker
       VM.ui.dateRange(root, {
         isDisabled(d) → bool         night unavailable (blocked)
         minNights(arrive) → n
         maxDeparture(arrive) → Date  latest check-out
         showPrices                   nightly price under each day
         onChange({arrive, depart})
       })
     root contains: [data-dr-btn="arrive|depart"] triggers + input[name=arrive|depart] hidden inputs.
     Auto-init: [data-daterange] (+ data-rules="availability" for blocked/min-stay/prices).
     ====================================================================== */
  const date = VM.date;
  const pad = date.pad, iso = date.iso, parse = date.parse, day = date.day, addDays = date.addDays, same = date.same;
  const today = date.today();

  const monthFmt = new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric" });
  const longFmt = new Intl.DateTimeFormat(undefined, { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const shortFmt = new Intl.DateTimeFormat(undefined, { weekday: "short", day: "numeric", month: "short" });
  const valueFmt = new Intl.DateTimeFormat(undefined, { weekday: "short", day: "numeric", month: "short", year: "numeric" });
  const monday = new Date(2024, 0, 1);
  const weekdays = Array.from({ length: 7 }, (_, i) => ({
    narrow: new Intl.DateTimeFormat(undefined, { weekday: "narrow" }).format(addDays(monday, i)),
    long: new Intl.DateTimeFormat(undefined, { weekday: "long" }).format(addDays(monday, i)),
  }));
  const priceLabel = (cents) => "$" + (cents / 100000).toFixed(1).replace(".0", "") + "k";

  // shared popover + currently-open instance
  let dp, monthsEl, hintEl, summaryEl, prevBtn, nextBtn, cur = null, hoverDate = null;
  const sheet = () => matchMedia("(max-width: 640px)").matches;
  const monthCount = () => (matchMedia("(min-width: 760px)").matches ? 2 : 1);
  const isOpen = () => !!dp && dp.classList.contains("is-open");

  function buildPopover() {
    if (dp) return;
    dp = document.createElement("div");
    dp.className = "dp";
    dp.setAttribute("role", "dialog");
    dp.setAttribute("aria-label", "Choose your dates");
    dp.innerHTML = `
      <div class="dp__head">
        <button type="button" class="dp__nav" data-nav="-1" aria-label="Previous month"><svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true"><path d="M8 2 4 6l4 4" fill="none" stroke="currentColor" stroke-width="1.2"/></svg></button>
        <p class="dp__hint" aria-live="polite"></p>
        <button type="button" class="dp__nav" data-nav="1" aria-label="Next month"><svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true"><path d="m4 2 4 4-4 4" fill="none" stroke="currentColor" stroke-width="1.2"/></svg></button>
      </div>
      <div class="dp__months"></div>
      <div class="dp__legend" hidden><span><i class="lg lg--blocked"></i>Unavailable</span><span><i class="lg lg--sel"></i>Your stay</span></div>
      <div class="dp__foot"><span class="dp__summary"></span><span class="dp__actions"><button type="button" class="dp__clear">Clear</button><button type="button" class="dp__done">Done</button></span></div>`;
    document.body.append(dp);
    monthsEl = $(".dp__months", dp);
    hintEl = $(".dp__hint", dp);
    summaryEl = $(".dp__summary", dp);
    prevBtn = $('[data-nav="-1"]', dp);
    nextBtn = $('[data-nav="1"]', dp);

    monthsEl.addEventListener("click", (e) => {
      const b = e.target.closest(".dp__day");
      if (b && b.getAttribute("aria-disabled") !== "true") cur.pick(parse(b.dataset.date));
    });
    monthsEl.addEventListener("pointerover", (e) => {
      const b = e.target.closest(".dp__day");
      if (b && b.getAttribute("aria-disabled") !== "true" && cur.mode === "depart" && cur.start && !cur.end) cur.paint(parse(b.dataset.date));
    });
    monthsEl.addEventListener("pointerleave", () => cur && cur.paint());
    monthsEl.addEventListener("focusin", (e) => {
      const b = e.target.closest(".dp__day");
      if (!b || !cur) return;
      cur.focusDate = parse(b.dataset.date);
      $$(".dp__day[tabindex='0']", dp).forEach((x) => (x.tabIndex = -1));
      b.tabIndex = 0;
      if (cur.mode === "depart" && !cur.end && b.getAttribute("aria-disabled") !== "true") cur.paint(cur.focusDate);
    });

    dp.addEventListener("click", (e) => {
      if (!cur) return;
      const nav = e.target.closest("[data-nav]");
      if (nav && !nav.disabled) {
        cur.view = day(cur.view.getFullYear(), cur.view.getMonth() + Number(nav.dataset.nav), 1);
        const last = day(cur.view.getFullYear(), cur.view.getMonth() + monthCount(), 0);
        cur.focusDate = new Date(clamp(+cur.focusDate, +cur.view, +last));
        if (cur.focusDate < today) cur.focusDate = today;
        cur.render();
      }
      if (e.target.closest(".dp__clear")) cur.clear();
      if (e.target.closest(".dp__done")) cur.close();
    });

    dp.addEventListener("keydown", (e) => {
      if (!cur) return;
      if (e.key === "Escape") { e.preventDefault(); cur.close(); return; }
      if (e.key === "Tab") {
        const f = $$("button:not(:disabled):not([tabindex='-1'])", dp);
        const first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
        return;
      }
      const btn = e.target.closest(".dp__day");
      if (!btn) return;
      const d = parse(btn.dataset.date);
      const dow = (d.getDay() + 6) % 7;
      const moves = {
        ArrowLeft: addDays(d, -1), ArrowRight: addDays(d, 1), ArrowUp: addDays(d, -7), ArrowDown: addDays(d, 7),
        Home: addDays(d, -dow), End: addDays(d, 6 - dow),
        PageUp: day(d.getFullYear() + (e.shiftKey ? -1 : 0), d.getMonth() + (e.shiftKey ? 0 : -1), d.getDate()),
        PageDown: day(d.getFullYear() + (e.shiftKey ? 1 : 0), d.getMonth() + (e.shiftKey ? 0 : 1), d.getDate()),
      };
      if (!moves[e.key]) return;
      e.preventDefault();
      cur.focusDate = moves[e.key] < today ? today : moves[e.key];
      cur.ensureVisible(cur.focusDate);
      cur.render();
      cur.focusDay();
    });

    document.addEventListener("pointerdown", (e) => {
      if (!isOpen() || !cur) return;
      if (dp.contains(e.target) || cur.trig.arrive.contains(e.target) || cur.trig.depart.contains(e.target)) return;
      cur.close(false);
    });
    addEventListener("resize", () => { if (isOpen() && cur) { cur.render(); cur.position(); } });
  }

  ui.dateRange = (root, opts = {}) => {
    if (root._dr) return root._dr;
    buildPopover();
    const I = {
      opts,
      trig: { arrive: $('[data-dr-btn="arrive"]', root), depart: $('[data-dr-btn="depart"]', root) },
      inp: { arrive: $('input[name="arrive"]', root), depart: $('input[name="depart"]', root) },
      start: null, end: null, mode: "arrive", view: day(today.getFullYear(), today.getMonth(), 1), focusDate: today,
    };
    I.anchor = opts.anchor || I.trig.arrive.closest(".field") || I.trig.arrive;
    if (date.isValidIso(I.inp.arrive.value)) I.start = parse(I.inp.arrive.value);
    if (date.isValidIso(I.inp.depart.value)) I.end = parse(I.inp.depart.value);

    const off = (d) => d < today || (opts.isDisabled ? opts.isDisabled(d) : false);
    const minN = (a) => (opts.minNights ? opts.minNights(a) : 1);
    const maxDep = (a) => (opts.maxDeparture ? opts.maxDeparture(a) : null);

    /** can `d` be clicked right now, and as what? */
    const status = (d) => {
      if (d < today) return { ok: false, past: true };
      if (I.mode === "arrive" || !I.start || d <= I.start) return off(d) ? { ok: false, blocked: true } : { ok: true, as: "arrive" };
      const min = minN(I.start);
      if (date.diff(I.start, d) < min) return { ok: false, short: true, min };
      const mx = maxDep(I.start);
      if (mx && d > mx) return { ok: false, limit: true };
      return { ok: true, as: "depart" };
    };

    const syncFields = () => {
      [["arrive", I.start], ["depart", I.end]].forEach(([k, d]) => {
        I.inp[k].value = d ? iso(d) : "";
        const v = $(".picker-value", I.trig[k]);
        v.textContent = d ? valueFmt.format(d) : "Select date";
        v.classList.toggle("is-placeholder", !d);
      });
      opts.onChange && opts.onChange({ arrive: I.start ? iso(I.start) : "", depart: I.end ? iso(I.end) : "" });
    };
    const markActive = () => {
      I.trig.arrive.classList.toggle("is-active", isOpen() && cur === I && I.mode === "arrive");
      I.trig.depart.classList.toggle("is-active", isOpen() && cur === I && I.mode === "depart");
    };

    const monthHTML = (first, idx) => {
      const y = first.getFullYear(), m = first.getMonth();
      const lead = (first.getDay() + 6) % 7;
      const count = new Date(y, m + 1, 0).getDate();
      let cells = "";
      for (let i = 0; i < lead; i++) cells += '<span class="dp__cell is-pad"></span>';
      for (let n = 1; n <= count; n++) {
        const d = day(y, m, n);
        const s = status(d);
        const blockedDay = d >= today && off(d);
        const cls = ["dp__day", same(d, today) ? "is-today" : "", blockedDay ? "is-blocked" : "", !s.ok && !blockedDay && !s.past ? "is-limit" : ""].filter(Boolean).join(" ");
        let label = longFmt.format(d);
        if (blockedDay) label += ", unavailable";
        else if (s.short) label += `, minimum stay ${s.min} nights`;
        const price = opts.showPrices && !blockedDay && !s.past ? `<small class="dp__price">${priceLabel(VM.pricing.nightlyFor(d))}</small>` : "";
        cells += `<span class="dp__cell" data-t="${+d}" role="gridcell"><button type="button" class="${cls}" data-date="${iso(d)}" tabindex="-1" aria-label="${label}" aria-disabled="${!s.ok}"${s.short ? ` title="Minimum stay ${s.min} nights"` : ""}><span>${n}</span>${price}</button></span>`;
      }
      return `<div class="dp__month"><h3 class="dp__title" id="dp-title-${idx}">${monthFmt.format(first)}</h3>
        <div class="dp__grid" role="grid" aria-labelledby="dp-title-${idx}">
          <div class="dp__dow" role="row">${weekdays.map((w) => `<span role="columnheader" aria-label="${w.long}">${w.narrow}</span>`).join("")}</div>
          <div class="dp__days">${cells}</div></div></div>`;
    };

    I.paint = (hover) => {
      const e2 = I.end || (I.mode === "depart" && I.start && hover && hover > I.start ? hover : null);
      $$(".dp__cell[data-t]", dp).forEach((c) => {
        const d = new Date(Number(c.dataset.t));
        const isS = same(d, I.start), isE = same(d, e2);
        c.classList.toggle("is-start", !!isS);
        c.classList.toggle("is-end", !!isE);
        c.classList.toggle("is-range", !!(I.start && e2 && d > I.start && d < e2));
        c.classList.toggle("has-range", !!(I.start && e2));
        c.classList.toggle("is-preview", !I.end && !!e2);
        c.firstElementChild.setAttribute("aria-pressed", String(!!(isS || isE)));
      });
    };

    const updateText = () => {
      if (I.mode === "depart" && I.start && minN(I.start) > 1) hintEl.textContent = `Select departure · min. ${minN(I.start)} nights`;
      else hintEl.textContent = I.mode === "arrive" ? "Select your arrival date" : "Now select your departure date";
      if (I.start && I.end) {
        const n = date.diff(I.start, I.end);
        summaryEl.textContent = `${shortFmt.format(I.start)} → ${shortFmt.format(I.end)} · ${n} night${n === 1 ? "" : "s"}`;
      } else summaryEl.textContent = I.start ? `Arriving ${shortFmt.format(I.start)}` : "";
      $(".dp__legend", dp).hidden = !opts.isDisabled;
    };

    I.render = () => {
      const n = monthCount();
      monthsEl.innerHTML = Array.from({ length: n }, (_, i) => monthHTML(day(I.view.getFullYear(), I.view.getMonth() + i, 1), i)).join("");
      dp.dataset.months = n;
      dp.classList.toggle("dp--prices", !!opts.showPrices);
      prevBtn.disabled = I.view <= day(today.getFullYear(), today.getMonth(), 1);
      I.paint();
      updateText();
      markActive();
      const t = $(`[data-date="${iso(I.focusDate)}"]`, dp);
      if (t) t.tabIndex = 0;
      else { const f = $(".dp__day:not([aria-disabled='true'])", monthsEl) || $(".dp__day", monthsEl); if (f) f.tabIndex = 0; }
    };

    I.focusDay = () => ($(`[data-date="${iso(I.focusDate)}"]`, dp) || $(".dp__day[tabindex='0']", dp))?.focus({ preventScroll: true });

    I.ensureVisible = (d) => {
      const first = day(I.view.getFullYear(), I.view.getMonth(), 1);
      const last = day(I.view.getFullYear(), I.view.getMonth() + monthCount() - 1, 1);
      const m = day(d.getFullYear(), d.getMonth(), 1);
      if (m < first) I.view = m;
      else if (m > last) I.view = day(m.getFullYear(), m.getMonth() - (monthCount() - 1), 1);
    };

    I.position = () => {
      if (sheet()) { dp.style.top = dp.style.left = ""; return; }
      const a = I.anchor.getBoundingClientRect();
      const w = dp.offsetWidth, h = dp.offsetHeight;
      const left = clamp(a.left + scrollX, 16 + scrollX, scrollX + innerWidth - w - 16);
      let top = a.bottom + scrollY + 10;
      if (a.bottom + 10 + h > innerHeight && a.top > h + 20) top = a.top + scrollY - h - 10;
      dp.style.left = `${left}px`;
      dp.style.top = `${top}px`;
    };

    I.open = (which) => {
      if (cur && cur !== I) cur.close(false);
      cur = I;
      I.openedBy = I.trig[which];
      I.mode = which === "depart" && I.start ? "depart" : "arrive";
      let f = I.mode === "depart" ? I.end || addDays(I.start, minN(I.start)) : I.start || today;
      if (I.mode === "arrive" && !I.start && opts.firstFree) f = opts.firstFree();
      I.focusDate = f < today ? today : f;
      I.view = day(I.focusDate.getFullYear(), I.focusDate.getMonth(), 1);
      if (I.mode === "depart" && monthCount() === 2 && I.start) I.view = day(I.start.getFullYear(), I.start.getMonth(), 1);
      I.render();
      dp.classList.add("is-open");
      Object.values(I.trig).forEach((t) => t.setAttribute("aria-expanded", "true"));
      markActive();
      I.position();
      if (sheet()) { document.body.classList.add("dp-sheet-open"); lenis("stop"); }
      requestAnimationFrame(() => { I.position(); I.focusDay(); });
    };

    I.close = (returnFocus = true) => {
      if (!isOpen() || cur !== I) return;
      dp.classList.remove("is-open");
      Object.values(I.trig).forEach((t) => t.setAttribute("aria-expanded", "false"));
      document.body.classList.remove("dp-sheet-open");
      lenis("start");
      markActive();
      if (returnFocus) (I.openedBy || I.trig.arrive).focus();
    };

    I.pick = (d) => {
      const s = status(d);
      if (!s.ok) return;
      if (s.as === "arrive") {
        const hadEnd = !!I.end;
        I.start = d; I.end = null; I.mode = "depart";
        I.focusDate = addDays(d, minN(d));
        syncFields(); emit(I.inp.arrive);
        if (hadEnd) emit(I.inp.depart);
        else { const err = I.inp.depart.parentElement.querySelector(".err"); if (err) err.textContent = ""; }
        I.render(); I.focusDay();
      } else {
        I.end = d;
        syncFields(); emit(I.inp.depart);
        I.render();
        I.close();
        I.trig.depart.focus();
      }
    };

    I.clear = () => {
      I.start = I.end = null; I.mode = "arrive";
      syncFields(); emit(I.inp.arrive); emit(I.inp.depart);
      if (isOpen() && cur === I) I.render();
    };

    Object.entries(I.trig).forEach(([k, t]) => {
      t.addEventListener("click", () => (isOpen() && cur === I && I.openedBy === t ? I.close(false) : I.open(k)));
      t.addEventListener("keydown", (e) => { if (e.key === "ArrowDown") { e.preventDefault(); I.open(k); } });
    });

    syncFields();
    root._dr = {
      get: () => ({ arrive: I.start ? iso(I.start) : "", depart: I.end ? iso(I.end) : "" }),
      set(a, d, silent) {
        I.start = date.isValidIso(a) ? parse(a) : null;
        I.end = I.start && date.isValidIso(d) ? parse(d) : null;
        I.mode = "arrive";
        syncFields();
        if (!silent) { emit(I.inp.arrive); emit(I.inp.depart); }
      },
      clear: () => I.clear(),
      open: (w) => I.open(w || "arrive"),
    };
    return root._dr;
  };

  /* ---- availability-aware preset used by [data-rules="availability"] ---- */
  ui.availabilityRules = (extra = {}) => ({
    isDisabled: (d) => VM.availability.isBlocked(d),
    minNights: (a) => VM.pricing.minNightsFor(a),
    maxDeparture: (a) => VM.availability.maxDeparture(a),
    firstFree: () => VM.availability.firstFree(3),
    showPrices: true,
    ...extra,
  });

  /* ---- auto-init ---- */
  $$("[data-select]").forEach(initSelect);
  ui.steppers();
  $$("[data-daterange]").forEach((r) => ui.dateRange(r, r.dataset.rules === "availability" && VM.availability ? ui.availabilityRules() : {}));
})();
