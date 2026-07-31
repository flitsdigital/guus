gsap.registerPlugin(CustomEase);
CustomEase.create("energy", "M0,0 C0.32,0.72 0,1 1,1");


// Initialize Fixed Underlay Navigation
document.addEventListener("DOMContentLoaded", () => {
    initFixedUnderlayNavigation();
  });

  function initFixedUnderlayNavigation() {
    const toggleBtn = document.querySelector("[data-underlay-nav-toggle]");
    const toggleLabels = document.querySelectorAll(".underlay-nav__toggle-label");
    const toggleBars = document.querySelectorAll(".underlay-nav__toggle-bar");
    const menuEl = document.querySelector("[data-underlay-nav-menu]");
    const largeItems = document.querySelectorAll("[data-reveal-l]");
    const smallItems = document.querySelectorAll("[data-reveal-s]");
    const menuBorder = document.querySelector(".underlay-nav__bottom-border");
    const mainEl = document.querySelector("[data-main]");
    const overlayEl = document.querySelector("[data-underlay-nav-overlay]");
    const darkEl = document.querySelector(".underlay-nav__dark");
    const corners = document.querySelectorAll(".underlay-nav__corner");
    const overlayBorders = document.querySelectorAll(".underlay-nav__border-row");
  
    if (!toggleBtn || !menuEl || !mainEl || !overlayEl) return;
  
    // Sluiten mag sneller dan openen: zelfde curve, hogere snelheid.
    const CLOSE_SPEED = 1.35;
  
    // inert alleen als de toggle er niet zelf in zit, anders sluit je jezelf buiten.
    const CAN_INERT_MAIN = !mainEl.contains(toggleBtn);
  
    const FOCUSABLE =
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
  
    let isOpen = false;
    let tl = null;
    let lastFocused = null;
    let resizeTimer;
  
    const getMenuOffset = () => -menuEl.offsetWidth;
  
    /* ---------------------------------------------------------------- state */
  
    function resetState() {
      gsap.set(overlayEl, { visibility: "hidden", pointerEvents: "none" });
      gsap.set(darkEl, { autoAlpha: 0 });
      gsap.set(mainEl, { x: 0 });
      gsap.set(toggleLabels, { yPercent: 0 });
      gsap.set(toggleBars, { y: 0, rotation: 0 });
      gsap.set(menuBorder, { scaleX: 0 });
      gsap.set(overlayBorders[0], { yPercent: -100 });
      gsap.set(overlayBorders[1], { yPercent: 100 });
      // Niet vanuit scale 0: dingen verschijnen niet uit het niets.
      gsap.set(corners, { scale: 0.9, autoAlpha: 0 });
    }
  
    function hideOverlay() {
      gsap.set(overlayEl, { visibility: "hidden", pointerEvents: "none" });
    }
  
    function showOverlay() {
      gsap.set(overlayEl, { visibility: "visible", pointerEvents: "auto" });
    }
  
    /* ------------------------------------------------------------ timelines */
  
    function buildFull() {
      resetState();
  
      // Alleen de open-kleur is nodig: de reverse herstelt de dichte kleur zelf.
      const openColor = getComputedStyle(menuEl).color;
  
      return gsap
        .timeline({
          paused: true,
          defaults: { ease: "energy", easeReverse: "power2.inOut" },
          onReverseComplete: hideOverlay
        })
        .to([mainEl, overlayEl], { x: getMenuOffset, duration: 0.5 }, 0)
        .to(darkEl, { autoAlpha: 1, duration: 0.4 }, 0)
        .to(corners, { scale: 1, autoAlpha: 1, duration: 0.4 }, 0)
        .to(overlayBorders, { yPercent: 0, duration: 0.4 }, 0)
        .to(toggleLabels, { yPercent: -100, duration: 0.3 }, 0)
        .to(toggleBtn, { color: openColor, duration: 0.3 }, 0)
        .to(
          toggleBars[0],
          {
            y: "0.25em",
            rotation: 45,
            duration: 0.3,
            ease: "back.out(1.2)",
            easeReverse: "power3.out"
          },
          0
        )
        .to(
          toggleBars[1],
          {
            y: "-0.25em",
            rotation: -45,
            duration: 0.3,
            ease: "back.out(1.2)",
            easeReverse: "power3.out"
          },
          0
        )
        .fromTo(
          largeItems,
          { autoAlpha: 0, xPercent: 18 },
          { autoAlpha: 1, xPercent: 0, duration: 0.45, stagger: 0.04 },
          0.05
        )
        .fromTo(
          smallItems,
          { autoAlpha: 0, yPercent: 60 },
          {
            autoAlpha: 1,
            yPercent: 0,
            duration: 0.4,
            stagger: 0.03,
            ease: "power3.out"
          },
          0.15
        )
        .to(menuBorder, { scaleX: 1, duration: 0.4 }, 0.15);
    }
  
    function buildReduced() {
      resetState();
  
      const openColor = getComputedStyle(menuEl).color;
  
      // Positie is structureel (het menu ligt eronder), dus die zetten we
      // direct. Alleen opacity en kleur animeren nog.
      return gsap
        .timeline({
          paused: true,
          defaults: { ease: "power2.out", duration: 0.2 },
          onReverseComplete: hideOverlay
        })
        .set([mainEl, overlayEl], { x: getMenuOffset }, 0)
        .set(overlayBorders, { yPercent: 0 }, 0)
        .set(toggleLabels, { yPercent: -100 }, 0)
        .set(toggleBars[0], { y: "0.25em", rotation: 45 }, 0)
        .set(toggleBars[1], { y: "-0.25em", rotation: -45 }, 0)
        .set(menuBorder, { scaleX: 1 }, 0)
        .to(darkEl, { autoAlpha: 1 }, 0)
        .to(corners, { scale: 1, autoAlpha: 1 }, 0)
        .to(toggleBtn, { color: openColor }, 0)
        .fromTo(
          [largeItems, smallItems],
          { autoAlpha: 0 },
          { autoAlpha: 1, xPercent: 0, yPercent: 0 },
          0
        );
    }
  
    gsap.matchMedia().add(
      {
        full: "(prefers-reduced-motion: no-preference)",
        reduced: "(prefers-reduced-motion: reduce)"
      },
      (ctx) => {
        tl = ctx.conditions.full ? buildFull() : buildReduced();
  
        // Voorkeur gewijzigd terwijl het menu openstond: state behouden.
        if (isOpen) {
          showOverlay();
          tl.progress(1);
        }
      }
    );
  
    /* ---------------------------------------------------------- scroll lock */
  
    function lockScroll() {
      document.documentElement.style.overflow = "hidden";
    }
  
    function unlockScroll() {
      document.documentElement.style.overflow = "";
    }
  
    /* --------------------------------------------------------------- toggle */
  
    function setOpen(next) {
      if (!tl || next === isOpen) return;
      isOpen = next;
  
      toggleBtn.setAttribute("aria-expanded", String(isOpen));
      toggleBtn.setAttribute("aria-label", isOpen ? "Sluit menu" : "Open menu");
  
      if (isOpen) {
        lastFocused = document.activeElement;
        document.body.setAttribute("data-menu-status", "open");
        if (CAN_INERT_MAIN) mainEl.setAttribute("inert", "");
        lockScroll();
        showOverlay();
  
        // Alleen opnieuw meten als we echt vanaf dicht beginnen. Invalidate
        // halverwege zou de opgenomen startwaarden wissen en dus springen.
        if (tl.progress() === 0) tl.invalidate();
        tl.timeScale(1).play();
  
        const first = menuEl.querySelector(FOCUSABLE);
        if (first) first.focus({ preventScroll: true });
      } else {
        document.body.removeAttribute("data-menu-status");
        if (CAN_INERT_MAIN) mainEl.removeAttribute("inert");
        unlockScroll();
  
        tl.timeScale(CLOSE_SPEED).reverse();
  
        const target =
          lastFocused && document.contains(lastFocused) ? lastFocused : toggleBtn;
        target.focus({ preventScroll: true });
      }
    }
  
    /* --------------------------------------------------------------- events */
  
    toggleBtn.addEventListener("click", () => setOpen(!isOpen));
  
    overlayEl.addEventListener("click", () => setOpen(false));
  
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && isOpen) setOpen(false);
    });
  
    window.addEventListener("resize", () => {
      // Bij een open menu direct meebewegen, niet pas na de debounce.
      if (isOpen && tl && tl.progress() === 1) {
        gsap.set([mainEl, overlayEl], { x: getMenuOffset() });
      }
  
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        if (!isOpen && tl) tl.invalidate();
      }, 150);
    });
  }