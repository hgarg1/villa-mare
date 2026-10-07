/* Enquiry form: client-side validation. No backend — on success it shows a
   confirmation and offers a prefilled mailto: link.
   Date/select/stepper controls live in ui.js and write to hidden inputs. */
(() => {
  const form = document.getElementById("enquiry");
  if (!form) return;
  const f = form.elements; // NB: form.name would be the form's own name attribute
  const success = document.getElementById("enquiry-success");

  // The element a user can see/focus for a given field (custom controls use a trigger button).
  const control = (input) =>
    input.type === "hidden" ? input.parentElement.querySelector(".picker-trigger") || input : input;

  const setError = (input, msg) => {
    control(input).setAttribute("aria-invalid", msg ? "true" : "false");
    const err = input.parentElement.querySelector(".err");
    if (err) err.textContent = msg;
    return !msg;
  };

  const rules = {
    name: (v) => (v.trim().length < 2 ? "Please enter your name." : ""),
    email: (v) => (/^\S+@\S+\.\S+$/.test(v) ? "" : "Please enter a valid email."),
    arrive: (v) => (!v ? "Choose an arrival date." : ""),
    depart: (v) => (!v ? "Choose a departure date." : ""),
  };

  Object.keys(rules).forEach((k) => {
    const input = f[k];
    // text inputs validate on blur; custom controls emit "change" when their value is set
    input.addEventListener(input.type === "hidden" ? "change" : "blur", () => setError(input, rules[k](input.value)));
  });

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const ok = Object.keys(rules).map((k) => setError(f[k], rules[k](f[k].value))).every(Boolean);
    if (!ok) {
      form.querySelector('[aria-invalid="true"]')?.focus();
      return;
    }
    const d = new FormData(form);
    const extras = d.getAll("extras").join(", ") || "none";
    const body = [
      `Name: ${d.get("name")}`,
      `Arrive: ${d.get("arrive")}`,
      `Depart: ${d.get("depart")}`,
      `Guests: ${d.get("adults")} adults, ${d.get("children")} children`,
      `Occasion: ${d.get("occasion")}`,
      `Extras: ${extras}`,
      "",
      d.get("message") || "",
    ].join("\n");
    document.getElementById("mailto").href =
      `mailto:stay@villamare.example?subject=${encodeURIComponent("Villa Maré enquiry — " + d.get("name"))}&body=${encodeURIComponent(body)}`;
    form.style.display = "none";
    success.classList.add("is-visible");
    window.gsap?.from(success, { y: 30, opacity: 0, duration: 1, ease: "power3.out" });
  });
})();
