/**
 * Hola Eficiencia Section — Animation Controller (V2 Rewrite)
 * Task T5.1 | Owner: hola-eficiencia-animations.js
 *
 * Single pinned section with ScrollTrigger (+=300%).
 * 3 metric blocks each with .bx-hscroll — all tracks sync to the same
 * scroll progress so titles stay fixed while body text transitions.
 * Ambient shell from Phase 4.4 bleeds through via mix-blend-mode: screen.
 *
 * Deps: GSAP 3.12.5, ScrollTrigger
 */
window.BxHolaEficienciaAnimations = (function () {
  'use strict';

  /* ── Scroll-Reveal on header ───────────────────────────────────────── */
  function initScrollReveal(section) {
    var header = section.querySelector('.bx-scroll-reveal');
    if (!header) return;

    gsap.set(header, { opacity: 0, willChange: 'opacity' });
    gsap.to(header, {
      opacity: 1,
      duration: 0.8,
      ease: 'power3.out',
      scrollTrigger: {
        trigger: header,
        start: 'top 82%',
        toggleActions: 'play none none reverse',
        invalidateOnRefresh: true
      },
      onComplete: function () { header.style.willChange = 'auto'; }
    });
  }

  /* ── Staggered fade-up on metric blocks ────────────────────────────── */
  function initMetricFadeUp(section) {
    var metrics = section.querySelectorAll('.he-metric');
    if (!metrics.length) return;

    metrics.forEach(function (m) {
      gsap.set(m, { opacity: 0, y: 30, willChange: 'transform, opacity' });
    });

    var content = section.querySelector('.he-content');
    gsap.to(metrics, {
      opacity: 1,
      y: 0,
      duration: 1,
      ease: 'power3.out',
      stagger: 0.15,
      scrollTrigger: {
        trigger: content || section,
        start: 'top 78%',
        toggleActions: 'play none none reverse',
        invalidateOnRefresh: true
      },
      onComplete: function () {
        var tgts = this.targets();
        for (var i = 0; i < tgts.length; i++) tgts[i].style.willChange = 'auto';
      }
    });
  }

  /* ── Subtle parallax float on dot decorations ──────────────────────── */
  function initDotParallax(section) {
    var dots = section.querySelectorAll('.he-dot');
    if (!dots.length) return;

    dots.forEach(function (dot, i) {
      var yOffset = (i % 2 === 0) ? -12 : 12;
      var xOffset = (i % 3 === 0) ? 4 : (i % 3 === 1) ? -3 : 0;

      gsap.to(dot, {
        y: yOffset,
        x: xOffset,
        ease: 'none',
        scrollTrigger: {
          trigger: section,
          start: 'top bottom',
          end: 'bottom top',
          scrub: 1.2,
          invalidateOnRefresh: true
        }
      });
    });
  }

  /* ── Pinned scroll with opacity crossfade (replaces horizontal tracks) ─ */
  function initPinnedScroll(section) {
    var scrollContainers = section.querySelectorAll('.he-metric__scroll');
    if (!scrollContainers.length) return;

    // Collect page sets from each metric block
    var pageSets = [];
    scrollContainers.forEach(function (container) {
      var pages = container.querySelectorAll('.bx-hscroll__page');
      if (pages.length < 2) return;
      pageSets.push(pages);
      // Initial state: first page visible, rest hidden
      for (var i = 0; i < pages.length; i++) {
        gsap.set(pages[i], { opacity: i === 0 ? 1 : 0 });
      }
    });

    if (!pageSets.length) return;

    // Transition zone: 10% of total scroll progress for crossfade overlap
    var tz = 0.10;
    var b1 = 1 / 3; // boundary between page 0 and 1
    var b2 = 2 / 3; // boundary between page 1 and 2

    ScrollTrigger.create({
      trigger: section,
      start: 'top top',
      end: '+=300%',
      pin: true,
      invalidateOnRefresh: true,
      onUpdate: function (self) {
        var p = self.progress;
        var o0, o1, o2;

        if (p <= b1 - tz / 2) {
          o0 = 1; o1 = 0; o2 = 0;
        } else if (p <= b1 + tz / 2) {
          var t = (p - (b1 - tz / 2)) / tz;
          o0 = 1 - t; o1 = t; o2 = 0;
        } else if (p <= b2 - tz / 2) {
          o0 = 0; o1 = 1; o2 = 0;
        } else if (p <= b2 + tz / 2) {
          var t2 = (p - (b2 - tz / 2)) / tz;
          o0 = 0; o1 = 1 - t2; o2 = t2;
        } else {
          o0 = 0; o1 = 0; o2 = 1;
        }

        pageSets.forEach(function (pages) {
          gsap.set(pages[0], { opacity: o0 });
          gsap.set(pages[1], { opacity: o1 });
          if (pages[2]) gsap.set(pages[2], { opacity: o2 });
        });
      }
    });
  }

  /* ── Fixed header fade (matches adios-riesgos pattern) ──────────── */
  function initFixedHeaderFade(section, header) {
    if (!header) return;
    if (typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined') return;
    gsap.registerPlugin(ScrollTrigger);

    var label = header.querySelector('.he-label');
    var heading = header.querySelector('.he-heading');

    // Initial state: everything hidden
    gsap.set(header, { opacity: 0, willChange: 'opacity' });
    if (label) gsap.set(label, { opacity: 0, willChange: 'opacity' });
    if (heading) gsap.set(heading, { opacity: 0, y: 20, willChange: 'opacity, transform' });

    function staggerIn() {
      gsap.to(header, { opacity: 1, duration: 0.2, ease: 'power1.out' });
      if (label) gsap.to(label, { opacity: 1, duration: 0.2, ease: 'power1.out' });
      if (heading) gsap.to(heading, {
        opacity: 1, y: 0, duration: 0.2, delay: 0.15,
        ease: 'power2.out',
        onComplete: function () { heading.style.willChange = 'auto'; }
      });
    }

    function fadeOut() {
      gsap.to(header, { opacity: 0, duration: 0.2, ease: 'power1.in' });
      if (label) gsap.to(label, { opacity: 0, duration: 0.2, ease: 'power1.in' });
      if (heading) gsap.to(heading, { opacity: 0, y: 20, duration: 0.2, ease: 'power1.in' });
    }

    function resetHidden() {
      gsap.set(header, { opacity: 0 });
      if (label) gsap.set(label, { opacity: 0 });
      if (heading) gsap.set(heading, { opacity: 0, y: 20 });
    }

    // Header appears when section pins and stays through entire pin duration.
    ScrollTrigger.create({
      trigger: section,
      start: 'top top',
      end: '+=300%',       // matches the section's pin duration
      invalidateOnRefresh: true,
      onEnter: staggerIn,
      onLeave: fadeOut,
      onEnterBack: staggerIn,
      onLeaveBack: resetHidden
    });
  }

  /* ── Public init ───────────────────────────────────────────────────── */
  function init() {
    if (typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined') return;
    gsap.registerPlugin(ScrollTrigger);

    var section = document.getElementById('hola-eficiencia');
    if (!section) return;

    initMetricFadeUp(section);
    initDotParallax(section);
    initPinnedScroll(section);

    // Fixed header fade (replaces BxStickyHeaders)
    var heHeader = section.querySelector('.he-header');
    initFixedHeaderFade(section, heHeader);
  }

  function resize() { /* no canvas — no-op */ }

  return { init: init, resize: resize };
})();
