/* Namespace + tiny shared helpers (dates, money, DOM). DOM-free except VM.$ helpers. */
(() => {
  const VM = (window.VM = window.VM || {});
  const pad = (n) => String(n).padStart(2, "0");

  /* ---- dates: always local-midnight Dates or ISO "YYYY-MM-DD" strings ---- */
  const day = (y, m, d) => new Date(y, m, d);
  VM.date = {
    day,
    pad,
    iso: (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    parse: (s) => {
      const [y, m, d] = String(s).split("-").map(Number);
      return day(y, m - 1, d);
    },
    isValidIso: (s) => /^\d{4}-\d{2}-\d{2}$/.test(s || "") && !isNaN(VM.date.parse(s)),
    addDays: (d, n) => day(d.getFullYear(), d.getMonth(), d.getDate() + n),
    today: () => {
      const n = new Date();
      return day(n.getFullYear(), n.getMonth(), n.getDate());
    },
    /** whole days from a to b (DST-safe) */
    diff: (a, b) => Math.round((Date.UTC(b.getFullYear(), b.getMonth(), b.getDate()) - Date.UTC(a.getFullYear(), a.getMonth(), a.getDate())) / 864e5),
    same: (a, b) => !!a && !!b && +a === +b,
    md: (d) => `${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    fmt: (d, opts = { weekday: "short", day: "numeric", month: "short", year: "numeric" }) => new Intl.DateTimeFormat(undefined, opts).format(d),
  };

  /* ---- money: integer cents everywhere, formatted only for display ---- */
  const usd0 = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
  const usd2 = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
  VM.money = {
    fmt: (cents) => (cents % 100 === 0 ? usd0 : usd2).format(cents / 100),
    fmt2: (cents) => usd2.format(cents / 100),
    round: (n) => Math.round(n),
  };

  /* ---- DOM helpers ---- */
  VM.$ = (s, r = document) => r.querySelector(s);
  VM.$$ = (s, r = document) => [...r.querySelectorAll(s)];
  VM.esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  VM.clamp = (n, a, b) => Math.min(Math.max(n, a), b);
  VM.qs = () => Object.fromEntries(new URLSearchParams(location.search));
})();
