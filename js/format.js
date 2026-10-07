/* Input formatting: phone (by country code), postal codes (by country), booking reference,
   promo codes, names and email. DOM-free formatters + caret-safe live binding.
   Declarative: add data-format="email|name|ref|promo" to any input; call VM.format.bind(scope)
   for markup inserted later. Phone/postal need context, so pages bind them explicitly. */
(() => {
  const VM = (window.VM = window.VM || {});
  const digits = (s) => String(s || "").replace(/\D/g, "");

  /* ---------------- phone ---------------- */
  // tpl: '#' = digit. Literals are only emitted once a further digit exists, so typing and deleting feel natural.
  const PHONE = {
    "+1": { min: 10, max: 10, tpl: "(###) ###-####", ph: "(555) 010-0100", keepZero: false },
    "+44": { min: 10, max: 10, tpl: (d) => (d[0] === "2" ? "## #### ####" : "#### ######"), ph: "7700 900123" },
    "+33": { min: 9, max: 9, tpl: "# ## ## ## ##", ph: "6 12 34 56 78" },
    "+49": { min: 10, max: 11, tpl: "### ########", ph: "151 12345678" },
    "+34": { min: 9, max: 9, tpl: "### ### ###", ph: "612 345 678" },
    "+39": { min: 9, max: 10, tpl: "### ### ####", ph: "312 345 6789", keepZero: true },
    "+31": { min: 9, max: 9, tpl: "# #### ####", ph: "6 1234 5678" },
    "+61": { min: 9, max: 9, tpl: "### ### ###", ph: "412 345 678" },
    "+65": { min: 8, max: 8, tpl: "#### ####", ph: "9123 4567" },
    "+81": { min: 10, max: 10, tpl: "## #### ####", ph: "90 1234 5678" },
    "+971": { min: 9, max: 9, tpl: "## ### ####", ph: "50 123 4567" },
    "+55": { min: 10, max: 11, tpl: "(##) #####-####", ph: "(11) 91234-5678" },
    "+27": { min: 9, max: 9, tpl: "## ### ####", ph: "82 123 4567" },
  };
  const phoneCfg = (code) => PHONE[code] || { min: 6, max: 15, tpl: "### ### ### ###", ph: "" };

  function applyTemplate(d, tpl) {
    let out = "", i = 0;
    for (let t = 0; t < tpl.length; t++) {
      if (tpl[t] === "#") { if (i >= d.length) break; out += d[i++]; }
      else if (i < d.length) out += tpl[t]; // literal only if more digits follow
    }
    return out;
  }
  /** national significant digits for a country code: strips trunk "0" (except US/Italy) and caps length */
  function nationalDigits(code, raw) {
    const c = phoneCfg(code);
    let d = digits(raw);
    if (code === "+1" && d.length === 11 && d[0] === "1") d = d.slice(1);
    if (code !== "+1" && !c.keepZero && d[0] === "0") d = d.slice(1);
    return d.slice(0, c.max);
  }
  const phone = (code, raw) => {
    const c = phoneCfg(code), d = nationalDigits(code, raw);
    return applyTemplate(d, typeof c.tpl === "function" ? c.tpl(d) : c.tpl);
  };
  const phoneValid = (code, raw) => {
    const n = nationalDigits(code, raw).length, c = phoneCfg(code);
    return n >= c.min && n <= c.max;
  };
  /** "+44 7700 900123" / "0044…" → { code, rest } using the longest known code, else null */
  function parseInternational(raw) {
    let s = String(raw).trim();
    if (s.startsWith("00")) s = "+" + s.slice(2);
    if (!s.startsWith("+")) return null;
    const d = digits(s);
    const code = Object.keys(PHONE).map((k) => k.slice(1)).sort((a, b) => b.length - a.length).find((k) => d.startsWith(k));
    return code ? { code: "+" + code, rest: d.slice(code.length) } : null;
  }

  /* ---------------- postal codes ---------------- */
  const POSTAL = {
    US: { label: "ZIP code", ph: "10001", fmt: (v) => { const d = digits(v).slice(0, 9); return d.length > 5 ? d.slice(0, 5) + "-" + d.slice(5) : d; }, ok: (v) => /^\d{5}(-\d{4})?$/.test(v), hint: "5 digits, e.g. 10001" },
    GB: { label: "Postcode", ph: "SW1A 1AA", fmt: (v) => { const a = v.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 7); return a.length > 3 ? a.slice(0, -3) + " " + a.slice(-3) : a; }, ok: (v) => /^[A-Z]{1,2}\d[A-Z\d]? \d[A-Z]{2}$/.test(v), hint: "e.g. SW1A 1AA" },
    CA: { label: "Postal code", ph: "K1A 0B1", fmt: (v) => { const a = v.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6); return a.length > 3 ? a.slice(0, 3) + " " + a.slice(3) : a; }, ok: (v) => /^[A-Z]\d[A-Z] \d[A-Z]\d$/.test(v), hint: "e.g. K1A 0B1" },
    FR: { label: "Postal code", ph: "75001", fmt: (v) => digits(v).slice(0, 5), ok: (v) => /^\d{5}$/.test(v), hint: "5 digits" },
    DE: { label: "Postleitzahl", ph: "10115", fmt: (v) => digits(v).slice(0, 5), ok: (v) => /^\d{5}$/.test(v), hint: "5 digits" },
    ES: { label: "Código postal", ph: "28001", fmt: (v) => digits(v).slice(0, 5), ok: (v) => /^\d{5}$/.test(v), hint: "5 digits" },
    IT: { label: "CAP", ph: "00184", fmt: (v) => digits(v).slice(0, 5), ok: (v) => /^\d{5}$/.test(v), hint: "5 digits" },
    AU: { label: "Postcode", ph: "2000", fmt: (v) => digits(v).slice(0, 4), ok: (v) => /^\d{4}$/.test(v), hint: "4 digits" },
    SG: { label: "Postal code", ph: "018956", fmt: (v) => digits(v).slice(0, 6), ok: (v) => /^\d{6}$/.test(v), hint: "6 digits" },
    BR: { label: "CEP", ph: "01310-100", fmt: (v) => { const d = digits(v).slice(0, 8); return d.length > 5 ? d.slice(0, 5) + "-" + d.slice(5) : d; }, ok: (v) => /^\d{5}-\d{3}$/.test(v), hint: "8 digits" },
    JP: { label: "Postal code", ph: "100-0001", fmt: (v) => { const d = digits(v).slice(0, 7); return d.length > 3 ? d.slice(0, 3) + "-" + d.slice(3) : d; }, ok: (v) => /^\d{3}-\d{4}$/.test(v), hint: "7 digits" },
    AE: { label: "Postal code (optional)", ph: "", fmt: (v) => v.slice(0, 12), ok: () => true, optional: true, hint: "" },
  };
  const postalCfg = (c) => POSTAL[c] || { label: "Postal code", ph: "", fmt: (v) => v.slice(0, 12), ok: (v) => v.trim().length >= 3, hint: "" };
  const postal = (country, raw) => postalCfg(country).fmt(String(raw || ""));
  const postalValid = (country, raw) => postalCfg(country).ok(postal(country, raw));

  /* ---------------- misc formatters ---------------- */
  const ref = (raw) => {
    let a = String(raw || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (a === "V" || a === "") return a;
    if (a.startsWith("VM")) a = a.slice(2);
    a = a.slice(0, 6);
    return "VM-" + a.slice(0, 4) + (a.length > 4 ? "-" + a.slice(4) : "");
  };
  const promo = (raw) => String(raw || "").toUpperCase().replace(/[^A-Z0-9_-]/g, "").slice(0, 20);
  const email = (raw) => String(raw || "").trim().toLowerCase();
  const name = (raw) => {
    const s = String(raw || "").replace(/\s+/g, " ").trim();
    // only fix obviously-unstyled input (all lower or all upper); leave "McDonald", "de la Cruz" alone
    return s && (s === s.toLowerCase() || s === s.toUpperCase()) ? s.toLowerCase().replace(/(^|[\s'-])(\p{L})/gu, (m, a, b) => a + b.toUpperCase()) : s;
  };

  /* ---------------- caret-safe live binding ---------------- */
  const isSig = (ch) => /[0-9A-Za-z]/.test(ch || "");
  const countSig = (s) => [...s].filter(isSig).length;

  /** Re-formats on every input and keeps the caret next to the same character, even after separators are inserted. */
  function live(input, fn) {
    input.addEventListener("input", () => {
      const v = input.value, pos = input.selectionStart ?? v.length, atEnd = pos >= v.length;
      const out = fn(v);
      if (out === v) return;
      const sig = countSig(v.slice(0, pos));
      input.value = out;
      if (atEnd) return input.setSelectionRange(out.length, out.length);
      let n = 0, i = 0;
      while (i < out.length && n < sig) if (isSig(out[i++])) n++;
      input.setSelectionRange(i, i);
    });
    // Backspace over a separator would be re-added immediately — hop over it so a digit is deleted instead.
    input.addEventListener("keydown", (e) => {
      if (e.key !== "Backspace" || input.selectionStart !== input.selectionEnd) return;
      let p = input.selectionStart;
      while (p > 0 && !isSig(input.value[p - 1])) p--;
      if (p > 0 && p !== input.selectionStart) input.setSelectionRange(p, p);
    });
  }

  /** phone input bound to a country-code source. onCode(code) is called if a pasted number carries its own code. */
  function bindPhone(input, getCode, onCode) {
    const refresh = () => {
      const code = getCode();
      input.placeholder = phoneCfg(code).ph;
      input.value = phone(code, input.value);
    };
    input.addEventListener("input", () => { // pasted "+44 7700 900123" switches the country code
      const intl = parseInternational(input.value);
      if (intl) { input.value = intl.rest; onCode && onCode(intl.code); }
    }, true);
    live(input, (v) => phone(getCode(), v));
    input.setAttribute("inputmode", "tel");
    refresh();
    return { refresh };
  }

  /** postal input bound to a country source; `labelEl` (optional) receives the localised label */
  function bindPostal(input, getCountry, labelEl) {
    const refresh = () => {
      const c = postalCfg(getCountry());
      input.placeholder = c.ph;
      if (labelEl) labelEl.textContent = c.label;
      input.value = postal(getCountry(), input.value);
      input.autocapitalize = "characters";
    };
    live(input, (v) => postal(getCountry(), v));
    refresh();
    return { refresh };
  }

  /** declarative bindings: data-format="email|name|ref|promo" */
  function bind(scope = document) {
    scope.querySelectorAll("[data-format]").forEach((input) => {
      if (input._fmt) return;
      input._fmt = true;
      const kind = input.dataset.format;
      if (kind === "ref") { live(input, ref); input.maxLength = 12; }
      else if (kind === "promo") live(input, promo);
      else if (kind === "email") input.addEventListener("blur", () => { input.value = email(input.value); });
      else if (kind === "name") input.addEventListener("blur", () => { input.value = name(input.value); input.dispatchEvent(new Event("change", { bubbles: true })); });
    });
  }
  document.addEventListener("DOMContentLoaded", () => bind());

  VM.format = { digits, phone, phoneValid, phoneCfg, nationalDigits, parseInternational, postal, postalValid, postalCfg, ref, promo, email, name, live, bindPhone, bindPostal, bind, PHONE, POSTAL };
})();
