/* Experiences: "Add to your stay" writes the extra into the checkout draft (no dates needed yet). */
(() => {
  const { $$, store, data } = VM;

  const inDraft = (id) => !!(store.get("draft") || {}).extras?.[id];
  const paint = (btn) => {
    const on = inDraft(btn.dataset.add);
    btn.setAttribute("aria-pressed", String(on));
    btn.textContent = on ? "Added to your stay ✓" : "Add to your stay";
  };

  $$("[data-add]").forEach((btn) => {
    paint(btn);
    btn.addEventListener("click", () => {
      const id = btn.dataset.add;
      const d = store.get("draft") || {};
      d.extras = { ...(d.extras || {}) };
      if (d.extras[id]) delete d.extras[id];
      else d.extras[id] = 1;
      store.set("draft", d);
      paint(btn);
      const name = data.extras.find((e) => e.id === id).name;
      VM.toast(d.extras[id] ? `${name} added — choose your dates at checkout.` : `${name} removed.`, { type: d.extras[id] ? "success" : "info" });
    });
  });
})();
