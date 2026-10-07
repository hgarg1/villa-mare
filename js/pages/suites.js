/* Suites list: render cards + chip filters. */
(() => {
  const { $, $$, data, render } = VM;
  const grid = $("#suite-grid");
  grid.innerHTML = data.suites.map(render.suiteCard).join("");

  const buttons = $$("#suite-filters button");
  buttons.forEach((btn) =>
    btn.addEventListener("click", () => {
      buttons.forEach((b) => b.setAttribute("aria-pressed", String(b === btn)));
      const { key, value } = btn.dataset;
      $$(".suite-card", grid).forEach((c) => (c.hidden = !!key && c.dataset[key] !== value));
      window.ScrollTrigger?.refresh();
    })
  );
})();
