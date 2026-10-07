/* Card helpers for the DEMO checkout: Luhn, brand detection, formatting, expiry. DOM-free. */
(() => {
  const VM = (window.VM = window.VM || {});
  const digits = (s) => String(s || "").replace(/\D/g, "");

  const BRANDS = [
    { id: "amex", name: "American Express", re: /^3[47]/, len: [15], cvc: 4, gaps: [4, 10] },
    { id: "visa", name: "Visa", re: /^4/, len: [13, 16, 19], cvc: 3, gaps: [4, 8, 12] },
    { id: "mastercard", name: "Mastercard", re: /^(5[1-5]|2(2[2-9]|[3-6]\d|7[01]|720))/, len: [16], cvc: 3, gaps: [4, 8, 12] },
    { id: "discover", name: "Discover", re: /^(6011|65|64[4-9])/, len: [16, 19], cvc: 3, gaps: [4, 8, 12] },
  ];
  const brand = (num) => BRANDS.find((b) => b.re.test(digits(num))) || null;

  function luhn(num) {
    const d = digits(num);
    if (d.length < 12) return false;
    let sum = 0, alt = false;
    for (let i = d.length - 1; i >= 0; i--) {
      let n = +d[i];
      if (alt) { n *= 2; if (n > 9) n -= 9; }
      sum += n; alt = !alt;
    }
    return sum % 10 === 0;
  }

  function format(num) {
    const d = digits(num), b = brand(d), gaps = b ? b.gaps : [4, 8, 12];
    let out = "";
    for (let i = 0; i < d.length; i++) out += (gaps.includes(i) ? " " : "") + d[i];
    return out.slice(0, 23);
  }

  /** "MM/YY" or "MMYY" → { ok, message } using last day of the expiry month */
  function expiry(text, now = new Date()) {
    const d = digits(text);
    if (d.length < 4) return { ok: false, message: "Enter the expiry as MM/YY." };
    const mm = +d.slice(0, 2), yy = 2000 + +d.slice(2, 4);
    if (mm < 1 || mm > 12) return { ok: false, message: "Month must be 01–12." };
    const end = new Date(yy, mm, 0, 23, 59, 59);
    if (end < now) return { ok: false, message: "This card has expired." };
    return { ok: true, message: "" };
  }
  const formatExpiry = (text) => {
    const d = digits(text).slice(0, 4);
    return d.length > 2 ? d.slice(0, 2) + "/" + d.slice(2) : d;
  };

  function validate({ number, exp, cvc, name }) {
    const errors = {};
    const b = brand(number);
    const n = digits(number);
    if (!n) errors.number = "Enter your card number.";
    else if (!luhn(n) || (b && !b.len.includes(n.length))) errors.number = "That card number doesn't look right.";
    const e = expiry(exp);
    if (!e.ok) errors.exp = e.message;
    const want = b ? b.cvc : 3;
    if (digits(cvc).length !== want) errors.cvc = `Enter the ${want}-digit security code.`;
    if (String(name || "").trim().length < 2) errors.name = "Enter the name on the card.";
    return { ok: Object.keys(errors).length === 0, errors, brand: b };
  }

  /** Simulated processor outcome from the published demo numbers. */
  const outcome = (num) => {
    const d = digits(num);
    if (d === "4000000000000002") return "declined";
    if (d === "4000002760003184") return "secure";
    return "success";
  };

  VM.cards = { digits, brand, luhn, format, expiry, formatExpiry, validate, outcome, BRANDS };
})();
