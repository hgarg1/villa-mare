/* Lenis smooth scroll + GSAP/ScrollTrigger choreography.
   Pages stay declarative via data attributes:
     data-split            word-by-word headline reveal (on scroll, or on load inside .hero)
     data-reveal           fade/rise on enter
     data-stagger          children fade/rise in sequence
     data-mask             image curtain reveal (use on .img-mask)
     data-parallax         image drifts inside its .img-mask
     data-drift="40"       element drifts vertically while scrolling (px)
     data-count="12"       number counts up
     data-marquee          endless horizontal ticker
*/
(() => {
  const root = document.documentElement;
  const curtain = document.getElementById("curtain");
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (!window.gsap || !window.ScrollTrigger || reduce) {
    root.classList.add("reduced-motion");
    curtain?.remove();
    document.querySelectorAll("[data-count]").forEach((n) => (n.textContent = n.dataset.count));
    return;
  }

  const { gsap, ScrollTrigger } = window;
  gsap.registerPlugin(ScrollTrigger);

  /* ---------- Smooth scroll ---------- */
  if (window.Lenis) {
    const lenis = new Lenis({ lerp: 0.09, wheelMultiplier: 0.9 });
    window.__lenis = lenis;
    lenis.on("scroll", ScrollTrigger.update);
    gsap.ticker.add((t) => lenis.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
  }

  /* ---------- Split text into masked words ---------- */
  const splitWords = (el) => {
    const walk = (node) => {
      [...node.childNodes].forEach((child) => {
        if (child.nodeType === 3) {
          const frag = document.createDocumentFragment();
          child.textContent.split(/(\s+)/).forEach((part) => {
            if (!part) return;
            if (/^\s+$/.test(part)) return frag.append(" ");
            const w = document.createElement("span");
            w.className = "word";
            w.innerHTML = `<span class="word__inner">${part}</span>`;
            frag.append(w);
          });
          child.replaceWith(frag);
        } else if (child.nodeType === 1 && child.tagName !== "BR") {
          walk(child);
        }
      });
    };
    el.setAttribute("aria-label", el.textContent.trim());
    walk(el);
    el.querySelectorAll(".word").forEach((w) => w.setAttribute("aria-hidden", "true"));
    return el.querySelectorAll(".word__inner");
  };

  const splits = new Map();
  document.querySelectorAll("[data-split]").forEach((el) => splits.set(el, splitWords(el)));
  splits.forEach((words) => gsap.set(words, { yPercent: 115 }));

  /* ---------- Intro (curtain lift + hero) ---------- */
  const intro = gsap.timeline({ defaults: { ease: "power4.out" } });
  if (curtain) {
    intro
      .from(curtain.firstElementChild, { y: 20, opacity: 0, duration: 0.7 })
      .to(curtain, { yPercent: -100, duration: 1, ease: "power4.inOut", delay: 0.15 })
      .set(curtain, { display: "none" });
  }
  const heroSplit = document.querySelector(".hero [data-split]");
  if (heroSplit) {
    intro
      .to(splits.get(heroSplit), { yPercent: 0, duration: 1.4, stagger: 0.06 }, curtain ? "-=0.55" : 0)
      .from(".hero .eyebrow, .hero__sub, .hero .btn, .scroll-cue", { y: 24, opacity: 0, duration: 1, stagger: 0.12 }, "-=1.0");
    splits.delete(heroSplit);
  }

  /* ---------- Hero parallax ---------- */
  document.querySelectorAll(".hero__media img, .cta__bg img").forEach((img) => {
    const pct = img.matches(".cta__bg img") ? -16 : -13;
    gsap.fromTo(
      img,
      { yPercent: pct },
      {
        yPercent: 0,
        ease: "none",
        scrollTrigger: { trigger: img.parentElement.parentElement, start: "top bottom", end: "bottom top", scrub: true },
      }
    );
  });

  /* ---------- Scroll reveals ---------- */
  splits.forEach((words, el) => {
    gsap.to(words, {
      yPercent: 0, duration: 1.3, ease: "power4.out", stagger: 0.05,
      scrollTrigger: { trigger: el, start: "top 88%", once: true },
    });
  });

  gsap.utils.toArray("[data-reveal]").forEach((el) => {
    gsap.from(el, {
      y: 44, opacity: 0, duration: 1.2, ease: "power3.out",
      scrollTrigger: { trigger: el, start: "top 90%", once: true },
    });
  });

  gsap.utils.toArray("[data-stagger]").forEach((el) => {
    gsap.from(el.children, {
      y: 40, opacity: 0, duration: 1.1, ease: "power3.out", stagger: 0.12,
      scrollTrigger: { trigger: el, start: "top 85%", once: true },
    });
  });

  gsap.utils.toArray("[data-mask]").forEach((el) => {
    const img = el.querySelector("img");
    const tl = gsap.timeline({ scrollTrigger: { trigger: el, start: "top 88%", once: true } });
    tl.from(el, { clipPath: "inset(100% 0% 0% 0%)", duration: 1.5, ease: "power4.inOut" });
    if (img && !img.closest("[data-parallax]")) tl.from(img, { scale: 1.3, duration: 1.8, ease: "power3.out" }, 0);
  });

  gsap.utils.toArray("[data-parallax]").forEach((el) => {
    const img = el.querySelector("img");
    if (!img) return;
    gsap.fromTo(
      img,
      { yPercent: -6 },
      { yPercent: 6, ease: "none", scrollTrigger: { trigger: el, start: "top bottom", end: "bottom top", scrub: true } }
    );
  });

  gsap.utils.toArray("[data-drift]").forEach((el) => {
    const d = parseFloat(el.dataset.drift) || 40;
    gsap.fromTo(
      el,
      { y: d },
      { y: -d, ease: "none", scrollTrigger: { trigger: el, start: "top bottom", end: "bottom top", scrub: true } }
    );
  });

  /* ---------- Counters ---------- */
  gsap.utils.toArray("[data-count]").forEach((el) => {
    const end = parseFloat(el.dataset.count);
    const state = { v: 0 };
    el.textContent = "0";
    gsap.to(state, {
      v: end, duration: 2.2, ease: "power2.out",
      onUpdate: () => (el.textContent = Math.round(state.v)),
      scrollTrigger: { trigger: el, start: "top 90%", once: true },
    });
  });

  /* ---------- Marquee (speeds up with scroll velocity) ---------- */
  gsap.utils.toArray("[data-marquee]").forEach((track) => {
    track.innerHTML += track.innerHTML;
    const tween = gsap.to(track, { xPercent: -50, ease: "none", duration: 40, repeat: -1 });
    ScrollTrigger.create({
      trigger: track, start: "top bottom", end: "bottom top",
      onUpdate: (self) => {
        const boost = 1 + Math.min(Math.abs(self.getVelocity()) / 400, 5);
        gsap.to(tween, { timeScale: boost * self.direction, duration: 0.3, overwrite: true });
        gsap.to(tween, { timeScale: 1, duration: 1.2, delay: 0.3, overwrite: false });
      },
    });
  });

  /* ---------- Horizontal pinned scroller (desktop only) ---------- */
  const mm = gsap.matchMedia();
  mm.add("(min-width: 861px)", () => {
    document.querySelectorAll("[data-hscroll]").forEach((section) => {
      const track = section.querySelector(".hscroll__track");
      const dist = () => track.scrollWidth - innerWidth + parseFloat(getComputedStyle(track).paddingInlineEnd);
      gsap.to(track, {
        x: () => -dist(), ease: "none",
        scrollTrigger: {
          trigger: section, pin: true, scrub: 1, start: "top top",
          end: () => "+=" + dist(), invalidateOnRefresh: true,
        },
      });
    });
  });

  /* ---------- Gallery items (re-run after filtering via event) ---------- */
  const batchGallery = () => {
    ScrollTrigger.batch(".masonry figure:not([hidden])", {
      start: "top 92%", once: true,
      onEnter: (els) => gsap.fromTo(els, { y: 50, opacity: 0 }, { y: 0, opacity: 1, duration: 1, stagger: 0.1, ease: "power3.out", overwrite: true }),
    });
  };
  if (document.querySelector(".masonry")) {
    batchGallery();
    document.addEventListener("gallery:filtered", () => {
      gsap.fromTo(".masonry figure:not([hidden])", { y: 30, opacity: 0 }, { y: 0, opacity: 1, duration: 0.8, stagger: 0.05, ease: "power3.out", overwrite: true });
      ScrollTrigger.refresh();
    });
  }

  /* ---------- Page transitions ---------- */
  document.addEventListener("click", (e) => {
    const a = e.target.closest("a[href]");
    if (!a || e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || a.target) return;
    const url = new URL(a.href, location.href);
    if (url.origin !== location.origin && url.protocol !== "file:") return;
    if (!/\.html?$/.test(url.pathname) || url.pathname === location.pathname) return;
    e.preventDefault();
    const c = document.getElementById("curtain") || (() => {
      const n = document.createElement("div");
      n.className = "curtain"; n.id = "curtain"; n.innerHTML = "<span>Villa Maré</span>";
      document.body.append(n);
      return n;
    })();
    gsap.set(c, { display: "grid" });
    gsap.fromTo(c, { yPercent: 100 }, { yPercent: 0, duration: 0.8, ease: "power4.inOut", onComplete: () => (location.href = url.href) });
  });
  addEventListener("pageshow", (e) => {
    if (e.persisted) {
      const c = document.getElementById("curtain");
      if (c) gsap.set(c, { display: "none" });
    }
  });

  // Images change layout height as they decode; keep trigger positions honest.
  addEventListener("load", () => ScrollTrigger.refresh());
})();
