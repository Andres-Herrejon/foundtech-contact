/* ══════════════════════════════════════════════════════════════
   smooth-scroll.js — Lenis + GSAP ticker sync
   Bexalta V2 | T7.1
   ══════════════════════════════════════════════════════════════ */

window.BxSmoothScroll = (function () {
  'use strict';

  var lenis = null;

  function init() {
    /* ── Lenis instance ── */
    lenis = new Lenis({
      duration: 1.0,
      easing: function (t) {
        return Math.min(1, 1.001 - Math.pow(2, -10 * t));
      },
      smooth: true,
      smoothTouch: false,
    });

    /* ── Sync Lenis scroll events with ScrollTrigger ── */
    lenis.on('scroll', ScrollTrigger.update);

    /* ── GSAP ticker drives Lenis raf ── */
    gsap.ticker.add(function (time) {
      lenis.raf(time * 1000);
    });
    gsap.ticker.lagSmoothing(0);

    // Force ScrollTrigger to recalculate after Lenis measures the page
    requestAnimationFrame(function() {
      ScrollTrigger.refresh();
    });

    console.log('[Bexalta] Smooth scroll initialized');
  }

  function getInstance() {
    return lenis;
  }

  return { init: init, getInstance: getInstance };
})();
