gsap.registerPlugin(CustomEase, ScrollTrigger, Draggable, InertiaPlugin, ScrambleTextPlugin)
CustomEase.create("energy", "M0,0 C0.32,0.72 0,1 1,1");
CustomEase.create("osmo-ease", "0.625, 0.05, 0, 1")

// Scramble is een flinke hoeveelheid beweging; live checken, want de
// voorkeur kan tijdens de sessie wijzigen.
const REDUCED_MOTION = window.matchMedia("(prefers-reduced-motion: reduce)");

// Tekens waar de scramble doorheen ratelt. Geen letters of cijfers: die lezen
// als woorden en dat leidt af van de tekst die eronder tevoorschijn komt.
const SCRAMBLE_CHARS = "!<>-_\\/[]{}=+*^?#%&@~";

// Scramblet een element naar zijn eigen tekst. Het origineel wordt de eerste
// keer vastgelegd: zonder dat zou een tweede scramble tijdens een lopende de
// gescramblede tekst als "origineel" nemen en blijft de rommel staan.
// Webflow wikkelt tekst bijna altijd in een <a> met daarin een <span> die de
// opmaak draagt. ScrambleText schrijft platte tekst, dus we moeten dat
// binnenste element raken — scramble je de wrapper, dan sloop je de link en
// de font-size mee. Afdalen zolang er precies één kind is; bij meer kinderen
// stoppen, want dan weten we niet welke de tekst is.
const textLeaf = (el) => (el.children.length === 1 ? textLeaf(el.children[0]) : el);

function scrambleTo(target, duration = 0.6, text) {
  if (!target || REDUCED_MOTION.matches) return;
  const el = textLeaf(target);
  if (!el.dataset.scrambleLabel) el.dataset.scrambleLabel = el.textContent;

  gsap.to(el, {
    // "auto" en niet true: true kill élke tween op dit element, dus ook de
    // autoAlpha/xPercent fade-in uit de nav-timeline. "auto" raakt alleen
    // een andere lopende scramble.
    overwrite: "auto",
    duration,
    // Zonder text-argument scramblet hij naar zijn eigen tekst terug.
    scrambleText: { text: text ?? el.dataset.scrambleLabel, chars: SCRAMBLE_CHARS, speed: 0.6 }
  });
}


// Initialize Fixed Underlay Navigation
document.addEventListener("DOMContentLoaded", () => {
  // Lenis (with GSAP Scroltrigger)
  const lenis = new Lenis();
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((time) => { lenis.raf(time * 1000); });
  gsap.ticker.lagSmoothing(0);

  initBootLoader();
  initFixedUnderlayNavigation();
  initCursorCoordinates();
  initStackingCardsParallax();
  initProjectStackingCards();
  initCircleReveal();
  initSliders()
  initFooterParallax()
});

function initBootLoader() {
  /* ------------------------------------------------------ instellingen */

  // Fases waar de status doorheen scramblet. Laatste blijft staan tot het
  // eind, dus zet daar je merknaam neer.
  const PHASES = ["GEOMETRIE", "MATERIALEN", "BELICHTING", "GUUS3D"];

  const COUNT_DURATION = 2.2;  // sec van 000 naar 100
  const BAR_LENGTH     = 20;   // aantal tekens in de balk
  // Blokjes vallen terug op ASCII als je mono font ze niet heeft: ["#", "-"]
  const BAR_FILLED     = "█";
  const BAR_EMPTY      = "░";

  /* ------------------------------------------------------------ elementen */

  const wrap = document.querySelector("[data-loader]");
  if (!wrap) return;

  const bg      = wrap.querySelector("[data-loader-bg]");
  const corners = wrap.querySelectorAll("[data-loader-corner]");
  const readout = wrap.querySelector("[data-loader-readout]");
  const barEl   = wrap.querySelector("[data-loader-bar]");
  const countEl = wrap.querySelector("[data-loader-count]");
  const statusEl= wrap.querySelector("[data-loader-status]");
  const reveal  = document.querySelectorAll("[data-loader-reveal]");

  const done = () => {
    wrap.remove();
    // De auto cachet zijn slotposities. De hero heeft net bewogen, dus even
    // opnieuw laten meten, anders staat hij naast zijn vak.
    window.dispatchEvent(new Event("resize"));
  };

  // Geen animaties gewenst? Dan geen loader — meteen de site laten zien.
  if (REDUCED_MOTION.matches) {
    gsap.set(reveal, { autoAlpha: 1 });
    done();
    return;
  }

  /* -------------------------------------------------------------- opbouw */

  gsap.set(wrap, { autoAlpha: 1 });
  gsap.set(corners, { scale: 0.4, autoAlpha: 0 });
  gsap.set(readout, { autoAlpha: 0, y: 8 });

  const progress = { value: 0 };

  const tl = gsap.timeline({ onComplete: done });

  // Hoeken spannen de viewport op
  tl.to(corners, {
    scale: 1,
    autoAlpha: 1,
    duration: 0.5,
    stagger: 0.06,
    ease: "back.out(2)"
  }, 0);

  tl.to(readout, { autoAlpha: 1, y: 0, duration: 0.4 }, 0.2);

  // Teller en tekstbalk lopen van hetzelfde getal
  tl.to(progress, {
    value: 100,
    duration: COUNT_DURATION,
    ease: "power1.inOut",
    onUpdate() {
      const p = Math.round(progress.value);
      if (countEl) countEl.textContent = String(p).padStart(3, "0");
      if (barEl) {
        const filled = Math.round((p / 100) * BAR_LENGTH);
        barEl.textContent =
          BAR_FILLED.repeat(filled) + BAR_EMPTY.repeat(BAR_LENGTH - filled);
      }
    }
  }, 0.3);

  // Status scramblet door de fases, verdeeld over de looptijd van de teller
  PHASES.forEach((phase, i) => {
    tl.call(
      () => scrambleTo(statusEl, 0.4, phase),
      null,
      0.3 + (i * COUNT_DURATION) / PHASES.length
    );
  });

  /* --------------------------------------------------------------- afscheid */

  tl.to(corners, {
    scale: 1.6,
    autoAlpha: 0,
    duration: 0.5,
    stagger: 0.04,
    ease: "power3.in"
  }, ">-0.1");

  tl.to(readout, { autoAlpha: 0, y: -8, duration: 0.35 }, "<");

  // Achtergrond wipet omhoog weg en legt de site bloot
  tl.to(bg, { yPercent: -101, duration: 0.9, ease: "osmo-ease" }, "<0.2");

  if (reveal.length) {
    tl.fromTo(reveal,
      { autoAlpha: 0, y: 40 },
      { autoAlpha: 1, y: 0, duration: 0.9, ease: "osmo-ease" },
      "<0.1");
  }
}

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

  // De 3D-auto zit op een eigen fixed laag op <body>, dus buiten <main>.
  // Zonder deze toevoeging blijft hij staan terwijl de rest naar links gaat.
  // filter(Boolean): op pagina's zonder auto is de laag er simpelweg niet.
  const slideEls = [mainEl, overlayEl, document.querySelector("[data-car-layer]")]
    .filter(Boolean);

  // inert alleen als de toggle er niet zelf in zit, anders sluit je jezelf buiten.
  const CAN_INERT_MAIN = !mainEl.contains(toggleBtn);

  const FOCUSABLE =
    'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

  let isOpen = false;
  let tl = null;
  let lastFocused = null;
  let resizeTimer;

  // Startstatus expliciet zetten, anders bestaat het attribuut pas nadat je
  // het menu voor het eerst hebt gesloten.
  document.body.setAttribute("data-menu-status", "closed");

  const getMenuOffset = () => -menuEl.offsetWidth;

  /* ---------------------------------------------------------------- state */

  function resetState() {
    gsap.set(overlayEl, { visibility: "hidden", pointerEvents: "none" });
    gsap.set(darkEl, { autoAlpha: 0 });
    gsap.set(slideEls, { x: 0 });
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
        onReverseComplete: hideOverlay,
      })
      .to(slideEls, { x: getMenuOffset, duration: 0.5 }, 0)
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
          easeReverse: "power3.out",
        },
        0,
      )
      .to(
        toggleBars[1],
        {
          y: "-0.25em",
          rotation: -45,
          duration: 0.3,
          ease: "back.out(1.2)",
          easeReverse: "power3.out",
        },
        0,
      )
      .fromTo(
        largeItems,
        { autoAlpha: 0, xPercent: 18 },
        { autoAlpha: 1, xPercent: 0, duration: 0.45, stagger: 0.04 },
        0.05,
      )
      .fromTo(
        smallItems,
        { autoAlpha: 0, yPercent: 60 },
        {
          autoAlpha: 1,
          yPercent: 0,
          duration: 0.4,
          stagger: 0.03,
          ease: "power3.out",
        },
        0.15,
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
        onReverseComplete: hideOverlay,
      })
      .set(slideEls, { x: getMenuOffset }, 0)
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
        0,
      );
  }

  gsap.matchMedia().add(
    {
      full: "(prefers-reduced-motion: no-preference)",
      reduced: "(prefers-reduced-motion: reduce)",
    },
    (ctx) => {
      tl = ctx.conditions.full ? buildFull() : buildReduced();

      // Voorkeur gewijzigd terwijl het menu openstond: state behouden.
      if (isOpen) {
        showOverlay();
        tl.progress(1);
      }
    },
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

      // Los van de timeline: die draait bij sluiten achteruit, en een
      // omgekeerde scramble ziet er raar uit. Delay volgt de stagger
      // waarmee de items binnenkomen.
      largeItems.forEach((el, i) => {
        gsap.delayedCall(0.05 + i * 0.04, scrambleTo, [el]);
      });

      const first = menuEl.querySelector(FOCUSABLE);
      if (first) first.focus({ preventScroll: true });
    } else {
      document.body.setAttribute("data-menu-status", "closed");
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
      gsap.set(slideEls, { x: getMenuOffset() });
    }

    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      if (!isOpen && tl) tl.invalidate();
    }, 150);
  });
}

function initCursorCoordinates() {
  const xEl = document.querySelector('[data-coordinates-x]');
  const yEl = document.querySelector('[data-coordinates-y]');

  if (!xEl || !yEl) return;

  document.addEventListener('mousemove', (event) => {
    xEl.textContent = Math.round(event.pageX);
    yEl.textContent = Math.round(event.pageY);
  });
}

function initStackingCardsParallax() {
  const cards = document.querySelectorAll("[data-stacking-cards-item]");

  if (cards.length < 2) return;
  cards.forEach((card, i) => {
    // Sla de eerste card over
    if (i === 0) return;

    // Als de huidige card in beeld komt, animeer de VORIGE
    const previousCard = cards[i - 1];
    if (!previousCard) return;

    let tl = gsap.timeline({
      defaults: {
        ease: "none",
        duration: 1
      },
      scrollTrigger: {
        trigger: card,
        start: "top bottom",
        end: "top top",
        scrub: true,
        invalidateOnRefresh: true
      }
    });

    tl.fromTo(previousCard, { yPercent: 0 }, { yPercent: 50 })
      .fromTo(previousCard, { scale: 1 }, { scale: 0.92, transformOrigin: "center top" }, "<");
  });
}

function initProjectStackingCards() {
  const cards = document.querySelectorAll("[data-stacking-cards-item-project]");

  if (cards.length < 2) return;

  cards.forEach((card, i) => {
    // Skip over the first section
    if (i === 0) return;

    // When current section is in view, target the PREVIOUS one
    const previousCard = cards[i - 1]
    if (!previousCard) return;

    // Find any element inside the previous card
    const previousCardImage = previousCard.querySelector("[data-stacking-cards-img]")

    let tl = gsap.timeline({
      defaults: {
        ease: "none",
        duration: 1
      },
      scrollTrigger: {
        trigger: card,
        start: "top bottom",
        end: "top top",
        scrub: true,
        invalidateOnRefresh: true
      }
    })

    tl.fromTo(previousCard, { yPercent: 0 }, { yPercent: 50 })
      .fromTo(previousCardImage, { yPercent: 0, scale: 1 }, { yPercent: -25, scale: 0.75 }, "<")
  });
}

function initCircleReveal() {
  const REVEAL_SCROLL = 2.2;   // schermen scroll voor de hele reveal
  const CIRCLE_SCALE = 2.4;   // eindgrootte cirkel (1 = 100vmax breed)

  const section = document.querySelector("[data-reveal]");
  if (!section) return;

  const circle = section.querySelector("[data-reveal-circle]");
  const texts = section.querySelectorAll("[data-reveal-text]");
  const logos = section.querySelectorAll("[data-reveal-logo]");
  const stickers = section.querySelectorAll("[data-reveal-sticker]");
  if (!circle) return;

  const angleOf = (el) => parseFloat(el.dataset.stickerRotate) || 0;

  /* ---------------------------------------------------- startposities */

  // CSS-centrering overnemen in GSAP, anders sloopt de scale-tween 'm
  // Centrering doet de wrapper — GSAP hoeft alleen te schalen
  gsap.set(circle, { scale: 0, transformOrigin: "50% 50%" }); gsap.set(texts, { autoAlpha: 0, y: 40 });
  gsap.set(logos, { autoAlpha: 0, y: 24 });
  stickers.forEach((s) => {
    gsap.set(s, { autoAlpha: 0, scale: 0, rotate: angleOf(s) - 30 });
  });

  /* -------------------------------------------------------- timeline */

  const tl = gsap.timeline({
    defaults: { ease: "none", duration: 1, immediateRender: false },
    scrollTrigger: {
      trigger: section,
      start: "top top",
      end: () => "+=" + window.innerHeight * REVEAL_SCROLL,
      pin: true,
      // De nav zet een transform op <main>, waardoor position:fixed niet
      // werkt. Met pinType "transform" heeft dat geen effect meer.
      pinType: "transform",
      pinSpacing: true,
      scrub: true,
      invalidateOnRefresh: true
    }
  });

  // De cirkel groeit vanuit het midden van het zwarte blok tot beeldvullend
  tl.fromTo(circle,
    { scale: 0 },
    { scale: CIRCLE_SCALE, duration: 1.4 },
    0);

  // Tekst komt op als de cirkel ongeveer een derde is
  tl.fromTo(texts,
    { autoAlpha: 0, y: 40 },
    { autoAlpha: 1, y: 0, duration: 0.5, ease: "power2.out" },
    0.45);

  // Klantlogo's volgen met een stagger
  tl.fromTo(logos,
    { autoAlpha: 0, y: 24 },
    { autoAlpha: 1, y: 0, duration: 0.5, stagger: 0.06, ease: "power2.out" },
    0.6);

  // Stickers poppen op hun plek in, elk naar zijn eigen rusthoek
  stickers.forEach((s, i) => {
    const a = angleOf(s);
    tl.fromTo(s,
      { autoAlpha: 0, scale: 0, rotate: a - 30 },
      { autoAlpha: 1, scale: 1, rotate: a, duration: 0.6, ease: "back.out(1.7)" },
      0.9 + i * 0.1);
  });

  /* ------------------------------------------------------- draggable */

  // Draggable schrijft x/y, de timeline autoAlpha/scale/rotate. x/y raakt de
  // timeline nooit aan, dus een sticker die je versleept animeert bij de
  // volgende scrub gewoon verder vanaf de plek waar je 'm neerzet.
  // Alleen desktop: op touch zou een drag het scrollen in de pin blokkeren.
  gsap.matchMedia().add("(min-width: 768px) and (pointer: fine)", () => {
    const instances = Array.from(stickers, (s) => {
      // Rusthoek van deze sticker: waar de timeline 'm neerzet, en dus waar
      // we bij release naar terug moeten.
      const rest = angleOf(s);

      return Draggable.create(s, {
        bounds: section,
        dragResistance: 0.1,
        cursor: "grab",
        activeCursor: "grabbing",
        // scale en rotate zijn eigenlijk van de timeline. We lenen ze even:
        // tijdens het slepen scrollt er niets, dus de scrub schrijft toch
        // niet. Bij release gaan ze terug naar de timeline-waarde.
        onPress() {
          gsap.to(this.target, {
            scale: 1.15,
            rotate: rest + gsap.utils.random(-20, 20),
            filter: "drop-shadow(0px 10px 8px rgba(0,0,0,0.3))",
            duration: 0.15
          });
        },
        onRelease() {
          gsap.to(this.target, {
            scale: 1,
            rotate: rest,
            filter: "drop-shadow(0px 0px 0px rgba(0,0,0,0))",
            duration: 0.3,
            ease: "back.out(3)"
          });
        }
      })[0];
    });

    return () => instances.forEach((d) => d.kill());
  });
}

function initSliders() {
  const sliderWrappers = gsap.utils.toArray(document.querySelectorAll('[data-centered-slider="wrapper"]'));

  sliderWrappers.forEach((sliderWrapper) => {
    const slides = gsap.utils.toArray(sliderWrapper.querySelectorAll('[data-centered-slider="slide"]'));
    const bullets = gsap.utils.toArray(sliderWrapper.querySelectorAll('[data-centered-slider="bullet"]'));
    const prevButton = sliderWrapper.querySelector('[data-centered-slider="prev-button"]');
    const nextButton = sliderWrapper.querySelector('[data-centered-slider="next-button"]');

    let activeElement;
    let activeBullet;
    let currentIndex = 0;
    let autoplay;

    // Autoplay is now enabled/disabled via a boolean attribute.
    const autoplayEnabled = sliderWrapper.getAttribute('data-slider-autoplay') === 'true';
    
    // If enabled, get the autoplay duration (in seconds) from the separate attribute.
    const autoplayDuration = autoplayEnabled ? parseFloat(sliderWrapper.getAttribute('data-slider-autoplay-duration')) || 0 : 0;

    // Dynamically assign unique IDs to slides
    slides.forEach((slide, i) => {
      slide.setAttribute("id", `slide-${i}`);
    });
    
    // Set ARIA attributes on bullets if they exist
    if (bullets && bullets.length > 0) {
      bullets.forEach((bullet, i) => {
        bullet.setAttribute("aria-controls", `slide-${i}`);
        bullet.setAttribute("aria-selected", i === currentIndex ? "true" : "false");
      });
    }

    const loop = horizontalLoop(slides, {
      paused: true,
      draggable: true,
      center: true,
      onChange: (element, index) => {
        currentIndex = index;
        
        if (activeElement) activeElement.classList.remove("active");
        element.classList.add("active");
        activeElement = element;

        if (bullets && bullets.length > 0) {
          if (activeBullet) activeBullet.classList.remove("active");
          if (bullets[index]) {
            bullets[index].classList.add("active");
            activeBullet = bullets[index];
          }
          bullets.forEach((bullet, i) => {
            bullet.setAttribute("aria-selected", i === index ? "true" : "false");
          });
        }

        // Titel van de nieuwe actieve slide laten decoderen. Geen
        // [data-slider-title] in de slide? Dan gebeurt er niets.
        scrambleTo(element.querySelector("[data-slider-title]"), 0.5);
      }
    });
    
    // On initialization, center the slider
    loop.toIndex(2, { duration: 0.01 });

    function startAutoplay() {
      if (autoplayDuration > 0 && !autoplay) {
        const repeat = () => {
          loop.next({ ease: "osmo-ease", duration: 0.725 });
          autoplay = gsap.delayedCall(autoplayDuration, repeat);
        };
        autoplay = gsap.delayedCall(autoplayDuration, repeat);
      }
    }

    function stopAutoplay() {
      if (autoplay) {
        autoplay.kill();
        autoplay = null;
      }
    }

    // Start/stop autoplay based on viewport visibility via ScrollTrigger
    ScrollTrigger.create({
      trigger: sliderWrapper,
      start: "top bottom",
      end: "bottom top",
      onEnter: startAutoplay,
      onLeave: stopAutoplay,
      onEnterBack: startAutoplay,
      onLeaveBack: stopAutoplay
    });

    // Pause autoplay on mouse hover over the slider
    sliderWrapper.addEventListener("mouseenter", stopAutoplay);
    sliderWrapper.addEventListener("mouseleave", () => {
      if (ScrollTrigger.isInViewport(sliderWrapper)) startAutoplay();
    });

    // Slide click event for direct navigation
    slides.forEach((slide, i) => {
      slide.addEventListener("click", () => {
        loop.toIndex(i, { ease: "osmo-ease", duration: 0.725 });
      });
    });

    // Bullets click event for direct navigation (if available)
    if (bullets && bullets.length > 0) {
      bullets.forEach((bullet, i) => {
        bullet.addEventListener("click", () => {
          loop.toIndex(i, { ease: "osmo-ease", duration: 0.725 });
          if (activeBullet) activeBullet.classList.remove("active");
          bullet.classList.add("active");
          activeBullet = bullet;
          bullets.forEach((b, j) => {
            b.setAttribute("aria-selected", j === i ? "true" : "false");
          });
        });
      });
    }

    // Prev/Next button listeners (if the buttons exist)
    if (prevButton) {
      prevButton.addEventListener("click", () => {
        let newIndex = currentIndex - 1;
        if (newIndex < 0) newIndex = slides.length - 1;
        loop.toIndex(newIndex, { ease: "osmo-ease", duration: 0.725 });
      });
    }

    if (nextButton) {
      nextButton.addEventListener("click", () => {
        let newIndex = currentIndex + 1;
        if (newIndex >= slides.length) newIndex = 0;
        loop.toIndex(newIndex, { ease: "osmo-ease", duration: 0.725 });
      });
    }
    
  });
}

// GSAP Helper function to create a looping slider
// Read more: https://gsap.com/docs/v3/HelperFunctions/helpers/seamlessLoop
function horizontalLoop(items, config) {
  let timeline;
  items = gsap.utils.toArray(items);
  config = config || {};
  gsap.context(() => { 
    let onChange = config.onChange,
      lastIndex = 0,
      tl = gsap.timeline({repeat: config.repeat, onUpdate: onChange && function() {
          let i = tl.closestIndex();
          if (lastIndex !== i) {
            lastIndex = i;
            onChange(items[i], i);
          }
        }, paused: config.paused, defaults: {ease: "none"}, onReverseComplete: () => tl.totalTime(tl.rawTime() + tl.duration() * 100)}),
      length = items.length,
      startX = items[0].offsetLeft,
      times = [],
      widths = [],
      spaceBefore = [],
      xPercents = [],
      curIndex = 0,
      indexIsDirty = false,
      center = config.center,
      pixelsPerSecond = (config.speed || 1) * 100,
      snap = config.snap === false ? v => v : gsap.utils.snap(config.snap || 1),
      timeOffset = 0,
      container = center === true ? items[0].parentNode : gsap.utils.toArray(center)[0] || items[0].parentNode,
      totalWidth,
      getTotalWidth = () => items[length-1].offsetLeft + xPercents[length-1] / 100 * widths[length-1] - startX + spaceBefore[0] + items[length-1].offsetWidth * gsap.getProperty(items[length-1], "scaleX") + (parseFloat(config.paddingRight) || 0),
      populateWidths = () => {
        let b1 = container.getBoundingClientRect(), b2;
        items.forEach((el, i) => {
          widths[i] = parseFloat(gsap.getProperty(el, "width", "px"));
          xPercents[i] = snap(parseFloat(gsap.getProperty(el, "x", "px")) / widths[i] * 100 + gsap.getProperty(el, "xPercent"));
          b2 = el.getBoundingClientRect();
          spaceBefore[i] = b2.left - (i ? b1.right : b1.left);
          b1 = b2;
        });
        gsap.set(items, {
          xPercent: i => xPercents[i]
        });
        totalWidth = getTotalWidth();
      },
      timeWrap,
      populateOffsets = () => {
        timeOffset = center ? tl.duration() * (container.offsetWidth / 2) / totalWidth : 0;
        center && times.forEach((t, i) => {
          times[i] = timeWrap(tl.labels["label" + i] + tl.duration() * widths[i] / 2 / totalWidth - timeOffset);
        });
      },
      getClosest = (values, value, wrap) => {
        let i = values.length,
          closest = 1e10,
          index = 0, d;
        while (i--) {
          d = Math.abs(values[i] - value);
          if (d > wrap / 2) {
            d = wrap - d;
          }
          if (d < closest) {
            closest = d;
            index = i;
          }
        }
        return index;
      },
      populateTimeline = () => {
        let i, item, curX, distanceToStart, distanceToLoop;
        tl.clear();
        for (i = 0; i < length; i++) {
          item = items[i];
          curX = xPercents[i] / 100 * widths[i];
          distanceToStart = item.offsetLeft + curX - startX + spaceBefore[0];
          distanceToLoop = distanceToStart + widths[i] * gsap.getProperty(item, "scaleX");
          tl.to(item, {xPercent: snap((curX - distanceToLoop) / widths[i] * 100), duration: distanceToLoop / pixelsPerSecond}, 0)
            .fromTo(item, {xPercent: snap((curX - distanceToLoop + totalWidth) / widths[i] * 100)}, {xPercent: xPercents[i], duration: (curX - distanceToLoop + totalWidth - curX) / pixelsPerSecond, immediateRender: false}, distanceToLoop / pixelsPerSecond)
            .add("label" + i, distanceToStart / pixelsPerSecond);
          times[i] = distanceToStart / pixelsPerSecond;
        }
        timeWrap = gsap.utils.wrap(0, tl.duration());
      },
      refresh = (deep) => {
        let progress = tl.progress();
        tl.progress(0, true);
        populateWidths();
        deep && populateTimeline();
        populateOffsets();
        deep && tl.draggable ? tl.time(times[curIndex], true) : tl.progress(progress, true);
      },
      onResize = () => refresh(true),
      proxy;
    gsap.set(items, {x: 0});
    populateWidths();
    populateTimeline();
    populateOffsets();
    window.addEventListener("resize", onResize);
    function toIndex(index, vars) {
      vars = vars || {};
      (Math.abs(index - curIndex) > length / 2) && (index += index > curIndex ? -length : length); // always go in the shortest direction
      let newIndex = gsap.utils.wrap(0, length, index),
        time = times[newIndex];
      if (time > tl.time() !== index > curIndex && index !== curIndex) { // if we're wrapping the timeline's playhead, make the proper adjustments
        time += tl.duration() * (index > curIndex ? 1 : -1);
      }
      if (time < 0 || time > tl.duration()) {
        vars.modifiers = {time: timeWrap};
      }
      curIndex = newIndex;
      vars.overwrite = true;
      gsap.killTweensOf(proxy);    
      return vars.duration === 0 ? tl.time(timeWrap(time)) : tl.tweenTo(time, vars);
    }
    tl.toIndex = (index, vars) => toIndex(index, vars);
    tl.closestIndex = setCurrent => {
      let index = getClosest(times, tl.time(), tl.duration());
      if (setCurrent) {
        curIndex = index;
        indexIsDirty = false;
      }
      return index;
    };
    tl.current = () => indexIsDirty ? tl.closestIndex(true) : curIndex;
    tl.next = vars => toIndex(tl.current()+1, vars);
    tl.previous = vars => toIndex(tl.current()-1, vars);
    tl.times = times;
    tl.progress(1, true).progress(0, true); // pre-render for performance
    if (config.reversed) {
      tl.vars.onReverseComplete();
      tl.reverse();
    }
    if (config.draggable && typeof(Draggable) === "function") {
      proxy = document.createElement("div")
      let wrap = gsap.utils.wrap(0, 1),
        ratio, startProgress, draggable, dragSnap, lastSnap, initChangeX, wasPlaying,
        align = () => tl.progress(wrap(startProgress + (draggable.startX - draggable.x) * ratio)),
        syncIndex = () => tl.closestIndex(true);
      typeof(InertiaPlugin) === "undefined" && console.warn("InertiaPlugin required for momentum-based scrolling and snapping. https://greensock.com/club");
      draggable = Draggable.create(proxy, {
        trigger: items[0].parentNode,
        type: "x",
        onPressInit() {
          let x = this.x;
          gsap.killTweensOf(tl);
          wasPlaying = !tl.paused();
          tl.pause();
          startProgress = tl.progress();
          refresh();
          ratio = 1 / totalWidth;
          initChangeX = (startProgress / -ratio) - x;
          gsap.set(proxy, {x: startProgress / -ratio});
        },
        onDrag: align,
        onThrowUpdate: align,
        overshootTolerance: 0,
        inertia: true,
        snap(value) {
          if (Math.abs(startProgress / -ratio - this.x) < 10) {
            return lastSnap + initChangeX
          }
          let time = -(value * ratio) * tl.duration(),
            wrappedTime = timeWrap(time),
            snapTime = times[getClosest(times, wrappedTime, tl.duration())],
            dif = snapTime - wrappedTime;
          Math.abs(dif) > tl.duration() / 2 && (dif += dif < 0 ? tl.duration() : -tl.duration());
          lastSnap = (time + dif) / tl.duration() / -ratio;
          return lastSnap;
        },
        onRelease() {
          syncIndex();
          draggable.isThrowing && (indexIsDirty = true);
        },
        onThrowComplete: () => {
          syncIndex();
          wasPlaying && tl.play();
        }
      })[0];
      tl.draggable = draggable;
    }
    tl.closestIndex(true);
    lastIndex = curIndex;
    onChange && onChange(items[curIndex], curIndex);
    timeline = tl;
    return () => window.removeEventListener("resize", onResize); 
  });
  return timeline;
  
}

function initFooterParallax(){
  document.querySelectorAll('[data-footer-parallax]').forEach(el => {
    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: el,
        start: 'clamp(top bottom)',
        end: 'clamp(top top)',
        scrub: true
      }
    });
  
    const inner = el.querySelector('[data-footer-parallax-inner]');
    const dark  = el.querySelector('[data-footer-parallax-dark]');
  
    if (inner) {
      tl.from(inner, {
        yPercent: -25,
        ease: 'linear'
      });
    }
  
    if (dark) {
      tl.from(dark, {
        opacity: 0.5,
        ease: 'linear'
      }, '<');
    }
  });
}