/* ══════════════════════════════════════════════════════════════
   app.js — Master initializer
   Bexalta V2 | T7.1
   ══════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  /* ── Mouse glow (desktop only) ── */
  function initMouseGlow() {
    if ('ontouchstart' in window) return;

    var glow = document.createElement('div');
    glow.className = 'bx-mouse-glow';
    glow.style.cssText =
      'position:fixed;width:400px;height:400px;border-radius:50%;' +
      'background:radial-gradient(circle,rgba(162,198,46,.06),transparent 70%);' +
      'pointer-events:none;transform:translate(-50%,-50%);' +
      'display:none;will-change:transform;z-index:9999;top:0;left:0;';
    document.body.appendChild(glow);

    document.addEventListener('mousemove', function (e) {
      glow.style.display = 'block';
      glow.style.left = e.clientX + 'px';
      glow.style.top = e.clientY + 'px';
    });

    document.addEventListener('mouseleave', function () {
      glow.style.display = 'none';
    });

    console.log('[Bexalta] Mouse glow initialized');
  }

  /* ── Section animation modules ── */
  var modules = [
    'BxHeroAnimations',
    'BxImaginemosAnimations',
    'BxAdiosRiesgosAnimations',
    'BxHolaEficienciaAnimations',
    'BxUpgradeAdentroAnimations',
    'BxUpgradeAfueraAnimations',
    'BxCredencialesAnimations',
    'BxCtaAnimations',
  ];

  function initSectionAnimations() {
    modules.forEach(function (name) {
      if (window[name] && typeof window[name].init === 'function') {
        try {
          window[name].init();
          console.log('[Bexalta] ' + name + ' initialized');
        } catch (err) {
          console.error('[Bexalta] Failed to init ' + name + ':', err);
        }
      } else {
        console.warn('[Bexalta] Module not found: ' + name);
      }
    });

    // Recalculate all ScrollTrigger positions after all modules initialized
    if (typeof ScrollTrigger !== 'undefined') {
      ScrollTrigger.refresh();
    }

    // Safety net — refresh again after short delay to catch any async inits
    setTimeout(function () {
      if (typeof ScrollTrigger !== 'undefined') {
        ScrollTrigger.refresh();
      }
    }, 1500);
  }

  /* ── Section group transitions — route-change-style reveals ── */
  function initSectionGroupTransitions() {
    if (BxMotionPrefs.isReduced()) return;

    // Major section group boundaries
    var groupStarts = document.querySelectorAll(
      '#imaginemos, #adios-riesgos, #hola-eficiencia, ' +
      '#upgrade-adentro-1, #upgrade-afuera-1, #credenciales, #cta'
    );

    groupStarts.forEach(function (section) {
      // Other content: keep existing Y slide-up behavior
      var others = section.querySelectorAll('.bx-canvas-area, .bx-text-morph, .bx-city-grid');

      if (!others.length) return;
      gsap.set(others, { opacity: 0, y: 24 });

      ScrollTrigger.create({
        trigger: section,
        start: 'top 80%',
        once: true,
        invalidateOnRefresh: true,
        onEnter: function () {
          gsap.to(others, {
            opacity: 1, y: 0,
            duration: 0.8,
            stagger: 0.12,
            ease: 'power4.out'
          });
        }
      });
    });

    console.log('[Bexalta] Section group transitions initialized');
  }

  /* ── Core init (called after preloader completes) ── */
  function initEverything() {
    /* Reduced-motion: show all content at final state, skip animations */
    if (window.BxMotionPrefs && BxMotionPrefs.isReduced()) {
      document.querySelectorAll('.bx-scroll-reveal').forEach(function (el) {
        el.style.opacity = '1';
        el.style.transform = 'translateY(0)';
      });
      console.log('[Bexalta] Reduced motion — animations skipped');
      if (window.__bxDismissPreloader) window.__bxDismissPreloader();
      return;
    }

    /* 1. Smooth scroll (Lenis + GSAP ticker) */
    if (window.BxSmoothScroll) {
      window.BxSmoothScroll.init();
    }

    /* 2. Mouse glow (desktop ambient effect) */
    initMouseGlow();

    /* 3. Sticky headers (must init before section animations call register()) */
    if (window.BxStickyHeaders) {
      BxStickyHeaders.init();
    }

    /* 4. All section animations */
    initSectionAnimations();

    /* 5. Route-change-style reveals between section groups */
    initSectionGroupTransitions();

    /* 6. Global resize → recalculate ScrollTrigger + canvas dimensions (debounced) */
    function handleGlobalResize() {
      /* Resize all section module canvases first (before ScrollTrigger recalculates) */
      modules.forEach(function (name) {
        if (window[name] && typeof window[name].resize === 'function') {
          try {
            window[name].resize();
          } catch (err) {
            console.warn('[Bexalta] Resize error in ' + name + ':', err);
          }
        }
      });

      /* Refresh ScrollTrigger positions (most important for responsive) */
      if (typeof ScrollTrigger !== 'undefined') {
        ScrollTrigger.refresh();
      }

      /* Tell Lenis to remeasure page dimensions */
      if (window.BxSmoothScroll) {
        var lenis = BxSmoothScroll.getInstance();
        if (lenis && typeof lenis.resize === 'function') {
          lenis.resize();
        }
      }
    }

    var resizeTimer;
    window.addEventListener('resize', function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(handleGlobalResize, 200);
    });

    /* 7. Orientation change → refresh after layout settles */
    window.addEventListener('orientationchange', function () {
      setTimeout(handleGlobalResize, 200);
    });

    /* 8. Dismiss preloader overlay */
    if (window.__bxDismissPreloader) {
      window.__bxDismissPreloader();
    }

    console.log('[Bexalta] All systems initialized');
  }

  /* ── Master init on DOMContentLoaded ── */
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  window.scrollTo(0, 0);

  document.addEventListener('DOMContentLoaded', function () {
    window.scrollTo(0, 0);

    /* Wait for preloader to finish loading assets, then init everything */
    if (window.__bxPreloaderReady) {
      window.__bxPreloaderReady.then(initEverything);
    } else {
      /* Fallback: no preloader present, init immediately */
      initEverything();
    }
  });
})();
