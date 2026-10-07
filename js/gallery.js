/* Gallery: category filter + lightbox. PhotoSwipe 5 (pinch-zoom, swipe, drag-down-to-close) when its script loaded;
   otherwise the built-in keyboard-accessible lightbox below. */
(() => {
  const figures = [...document.querySelectorAll(".masonry figure")];
  const buttons = [...document.querySelectorAll(".filters button")];
  if (!figures.length) return;

  buttons.forEach((btn) =>
    btn.addEventListener("click", () => {
      buttons.forEach((b) => b.setAttribute("aria-pressed", String(b === btn)));
      const cat = btn.dataset.filter;
      figures.forEach((f) => (f.hidden = cat !== "all" && f.dataset.cat !== cat));
      document.dispatchEvent(new CustomEvent("gallery:filtered"));
    })
  );

  const box = document.createElement("div");
  box.className = "lightbox";
  box.setAttribute("role", "dialog");
  box.setAttribute("aria-modal", "true");
  box.setAttribute("aria-label", "Image viewer");
  box.innerHTML = `
    <button class="lb-close" aria-label="Close">×</button>
    <button class="lb-prev" aria-label="Previous">‹</button>
    <img alt="" />
    <button class="lb-next" aria-label="Next">›</button>
    <p></p>`;
  document.body.append(box);
  const img = box.querySelector("img");
  const cap = box.querySelector("p");

  let idx = 0;
  let opener = null;
  const visible = () => figures.filter((f) => !f.hidden);

  const show = (i) => {
    const list = visible();
    idx = (i + list.length) % list.length;
    const src = list[idx].querySelector("img");
    img.src = src.currentSrc || src.src;
    img.alt = src.alt;
    cap.textContent = `${idx + 1} / ${list.length} — ${src.alt}`;
  };
  /* ---- PhotoSwipe path ---- */
  const PS = window.PhotoSwipe && window.PhotoSwipeLightbox ? new window.PhotoSwipeLightbox({
    pswpModule: window.PhotoSwipe, bgOpacity: 1, wheelToZoom: true, closeOnVerticalDrag: true, showHideAnimationType: "fade", paddingFix: true, imageClickAction: "zoom-or-close",
  }) : null;
  if (PS) {
    PS.on("uiRegister", () => {
      PS.pswp.ui.registerElement({
        name: "caption", order: 9, isButton: false, appendTo: "root", html: "",
        onInit: (el, pswp) => { el.className = "pswp__caption"; pswp.on("change", () => { el.textContent = pswp.currSlide.data.alt || ""; }); },
      });
    });
    PS.on("beforeOpen", () => window.__lenis?.stop());
    PS.on("destroy", () => window.__lenis?.start());
    PS.init();
  }
  const slideData = (list) => list.map((f) => {
    const im = f.querySelector("img");
    const w = im.naturalWidth || 3, h = im.naturalHeight || 2; // aspect from the thumbnail; the full file is 1536px wide
    return { src: im.src, msrc: im.currentSrc || im.src, width: 1536, height: Math.round(1536 * h / w), alt: im.alt, element: im };
  });

  const open = (fig) => {
    if (PS) { const list = visible(); PS.loadAndOpen(list.indexOf(fig), slideData(list)); return; }
    opener = fig;
    show(visible().indexOf(fig));
    box.classList.add("is-open");
    window.__lenis?.stop();
    box.querySelector(".lb-close").focus();
  };
  const close = () => {
    box.classList.remove("is-open");
    window.__lenis?.start();
    opener?.focus();
  };

  figures.forEach((f) => {
    f.tabIndex = 0;
    f.setAttribute("role", "button");
    f.addEventListener("click", () => open(f));
    f.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(f); }
    });
  });

  box.querySelector(".lb-close").addEventListener("click", close);
  box.querySelector(".lb-prev").addEventListener("click", () => show(idx - 1));
  box.querySelector(".lb-next").addEventListener("click", () => show(idx + 1));
  box.addEventListener("click", (e) => e.target === box && close());
  addEventListener("keydown", (e) => {
    if (!box.classList.contains("is-open")) return;
    if (e.key === "Escape") close();
    if (e.key === "ArrowLeft") show(idx - 1);
    if (e.key === "ArrowRight") show(idx + 1);
  });
})();
