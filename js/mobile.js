/* Touch-device helpers: keyboard-aware chrome, sensible Enter-key labels, focused field kept in view.
   Plain script; does nothing on fine-pointer devices except the Enter-key hints (harmless). Loads after ui.js. */
(() => {
  const coarse = matchMedia("(pointer: coarse)");
  const FIELD = 'input:not([type=hidden]):not([type=checkbox]):not([type=radio]):not([type=button]):not([type=submit]), textarea';
  const isText = (el) => el && el.matches && el.matches(FIELD);

  /* Enter key label: "next" through a form, "go"/"done" on the last field. Set before focus so the keyboard picks it up. */
  const hint = (el) => {
    if (!isText(el) || el.enterKeyHint) return;
    if (el.tagName === "TEXTAREA") { el.enterKeyHint = "enter"; return; }
    const form = el.form || el.closest("form");
    const fields = form ? [...form.querySelectorAll(FIELD)].filter((f) => f.offsetParent !== null && f.tagName !== "TEXTAREA") : [el];
    const last = fields[fields.length - 1] === el;
    el.enterKeyHint = last ? (form && form.querySelector('[type="submit"]') ? "go" : "done") : "next";
  };
  document.addEventListener("pointerdown", (e) => hint(e.target.closest && e.target.closest(FIELD)), true);
  document.addEventListener("focusin", (e) => hint(e.target));

  /* While the on-screen keyboard is up, fixed bars (order summary drawer, book bar) get out of the way and the
     focused field is scrolled into the middle of what is left. */
  let kbTimer;
  document.addEventListener("focusin", (e) => {
    if (!coarse.matches || !isText(e.target)) return;
    clearTimeout(kbTimer);
    document.body.classList.add("has-kb");
    setTimeout(() => {
      if (document.activeElement === e.target) e.target.scrollIntoView({ block: "center", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
    }, 280);
  });
  document.addEventListener("focusout", () => {
    clearTimeout(kbTimer);
    kbTimer = setTimeout(() => { if (!isText(document.activeElement)) document.body.classList.remove("has-kb"); }, 120);
  });
})();
