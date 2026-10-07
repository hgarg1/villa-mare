/* Team page: people rows rendered from VM.data.staff. */
(() => {
  const { data, render, esc } = VM;
  document.getElementById("people").innerHTML = data.staff
    .map(
      (p) => `<article class="person" id="${p.id}">
        <div class="person__media img-mask ratio-32" data-mask data-parallax>${render.img(p.img, `${p.name}, ${p.role}`, 'loading="lazy"')}</div>
        <div class="stack" data-drift="24">
          <span class="person__role">${esc(p.role)}</span>
          <h2 data-split>${esc(p.name)}</h2>
          <blockquote>“${esc(p.quote)}”</blockquote>
          <p class="lead">${esc(p.bio)}</p>
          <ul class="ask" aria-label="Ask ${esc(p.name)} about">${p.ask.map((a) => `<li>${esc(a)}</li>`).join("")}</ul>
        </div></article>`
    )
    .join("");
})();
