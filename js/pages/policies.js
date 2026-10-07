/* Policies: ARIA tabs, deep-linkable via #terms / #privacy / #cancellation / #houserules. */
(() => {
  const { $, $$, data, esc } = VM;
  const list = (items) => `<ul class="rules">${items.map((t) => `<li>${esc(t)}</li>`).join("")}</ul>`;
  const panels = {
    terms: ["Terms of use", list(data.policies.terms)],
    privacy: ["Privacy", list(data.policies.privacy)],
    cancellation: ["Cancellation policy", `<p class="lead">Plans change. Here is what you get back, depending on how far ahead you tell us.</p><div class="timeline" style="margin-top:1.6rem">${data.cancellation.map((t) => `<div class="timeline__seg"><b>${esc(t.label)}</b><span>${esc(t.text)}</span></div>`).join("")}</div><p class="note" style="margin-top:1.6rem">Refunds go back to the original payment method. Bank-transfer bookings with no payment received have nothing to refund.</p>`],
    houserules: ["House rules", list(data.policies.houserules)],
  };
  $("#ppanels").innerHTML = Object.entries(panels)
    .map(([k, [title, html]]) => `<div class="policy-panel" role="tabpanel" id="p-${k}" aria-labelledby="t-${k}" hidden><h2 style="font-size:2.4rem;margin-bottom:1.2rem">${esc(title)}</h2>${html}</div>`)
    .join("");

  const tabs = $$('[role="tab"]', $("#ptabs"));
  function select(key, { focus = false, updateHash = true } = {}) {
    if (!panels[key]) key = "terms";
    tabs.forEach((t) => {
      const on = t.dataset.key === key;
      t.setAttribute("aria-selected", String(on));
      t.tabIndex = on ? 0 : -1;
      if (on && focus) t.focus();
    });
    $$(".policy-panel").forEach((p) => (p.hidden = p.id !== "p-" + key));
    if (updateHash) history.replaceState(null, "", "#" + key);
  }
  tabs.forEach((t, i) => {
    t.addEventListener("click", () => select(t.dataset.key));
    t.addEventListener("keydown", (e) => {
      const step = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
      if (step) { e.preventDefault(); select(tabs[(i + step + tabs.length) % tabs.length].dataset.key, { focus: true }); }
      if (e.key === "Home") { e.preventDefault(); select(tabs[0].dataset.key, { focus: true }); }
      if (e.key === "End") { e.preventDefault(); select(tabs[tabs.length - 1].dataset.key, { focus: true }); }
    });
  });
  addEventListener("hashchange", () => select(location.hash.slice(1), { updateHash: false }));
  select(location.hash.slice(1), { updateHash: false });
})();
