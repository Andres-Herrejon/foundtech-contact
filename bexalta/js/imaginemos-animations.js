/**
 * Imaginemos Section — Animation Controller (V2 Rewrite)
 * Task T3.1 | Owner: imaginemos-animations.js
 *
 * Single pinned section with ScrollTrigger (+=300%).
 * 2 BxParticleCore instances (1 text-morph + 1 city-grid = 50k particles).
 * Text-morph cycles through 3 texts at scroll progress 0/0.33/0.66.
 * City grid rotates continuously.
 */
window.BxImaginemosAnimations = (function () {
  'use strict';

  var _instances = [];
  var PARTICLE_COUNT = 25000;
  var GRAY = new THREE.Color('#C7C6C6');
  var GREEN = new THREE.Color('#a2c62e');  // --bx-primary

  /* ── helpers ─────────────────────────────────────────── */

  function parseTexts(container) {
    try {
      return JSON.parse(container.dataset.texts);
    } catch (e) {
      return ['VISUALIZAR\nTUS\nACTIVOS', 'AL\nMISMO\nTIEMPO', 'EN\nTIEMPO\nREAL'];
    }
  }

  function initTextMorph(container, texts) {
    var canvas = container.querySelector('canvas');
    if (!canvas) return null;

    // RC#3 FIX: Graduated camZ for text morph — closer camera = bigger particles
    var parentW = container.getBoundingClientRect().width;
    var camZ;
    if (parentW >= 1440) {
      camZ = 7.5;   // +20% bigger than baseline
    } else if (parentW >= 768) {
      camZ = 6.4;   // +40% bigger than baseline
    } else {
      camZ = 9;     // baseline mobile
    }

    var inst = BxParticleCore.create(canvas, {
      count: PARTICLE_COUNT,
      size: 0.3,
      camZ: camZ,
      rotate: false
    });
    if (!inst) return null;

    // Set initial text shape and gray color
    inst.setTarget(BxParticleCore.generateTextShape(PARTICLE_COUNT, texts[0], 7));
    inst.setColor(GRAY, GRAY, 1.0);

    return inst;
  }

  function initCityGrid(container) {
    var canvas = container.querySelector('canvas');
    if (!canvas) return null;

    // RC#3 FIX: Graduated camZ for city grid — closer camera = bigger particles
    var parentW = container.getBoundingClientRect().width;
    var camZ;
    if (parentW >= 1440) {
      camZ = 10;    // +20% bigger than baseline
    } else if (parentW >= 768) {
      camZ = 8.6;   // +40% bigger than baseline
    } else {
      camZ = 12;    // baseline mobile
    }

    var inst = BxParticleCore.create(canvas, {
      count: PARTICLE_COUNT,
      rotate: true,
      camZ: camZ
    });
    if (!inst) return null;
    inst.setTarget(BxParticleCore.generateCityGrid(PARTICLE_COUNT));
    inst.setColor(GREEN, GREEN, 1.0);

    return inst;
  }

  function initScrollReveal(section) {
    var reveals = section.querySelectorAll('.bx-scroll-reveal');
    if (!reveals.length) return;
    if (typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined') return;

    gsap.registerPlugin(ScrollTrigger);
    reveals.forEach(function (el) {
      gsap.set(el, { opacity: 0, willChange: 'opacity' });
      gsap.to(el, {
        opacity: 1,
        stagger: 0.1,
        duration: 0.8,
        ease: 'power3.out',
        scrollTrigger: {
          trigger: el,
          start: 'top 82%',
          toggleActions: 'play none none reverse',
          invalidateOnRefresh: true
        },
        onComplete: function () { el.style.willChange = 'auto'; }
      });
    });
  }

  function initFixedHeaderFade(section, header) {
    if (!header) return;
    if (typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined') return;
    gsap.registerPlugin(ScrollTrigger);

    var label = header.querySelector('.imag-label');
    var heading = header.querySelector('.imag-heading');

    // Initial state: everything hidden
    gsap.set(header, { opacity: 0, willChange: 'opacity' });
    if (label) gsap.set(label, { opacity: 0, willChange: 'opacity' });
    if (heading) gsap.set(heading, { opacity: 0, y: 20, willChange: 'opacity, transform' });

    function staggerIn() {
      // Container visible immediately
      gsap.to(header, { opacity: 1, duration: 0.2, ease: 'power1.out' });
      // Label fades in first
      if (label) gsap.to(label, { opacity: 1, duration: 0.2, ease: 'power1.out' });
      // Heading slides up + fades in after 150ms delay
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

    // Header appears when section pins (top top) and stays visible
    // through the entire 300% pinned scroll (+=300%).
    // It fades out only when the pin ends (section unpins / adios-riesgos takes over).
    ScrollTrigger.create({
      trigger: section,
      start: 'top top',
      end: '+=300%',
      invalidateOnRefresh: true,
      onEnter: staggerIn,
      onLeave: fadeOut,
      onEnterBack: staggerIn,
      onLeaveBack: resetHidden
    });
  }

  /* ── Scroll-driven text cycling ─────────────────────── */

  function initPinnedScroll(section, morphInst, texts) {
    if (typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined') return;
    gsap.registerPlugin(ScrollTrigger);

    var currentIdx = 0;
    var transitioning = false;

    function morphToText(idx) {
      if (idx === currentIdx || idx < 0 || idx >= texts.length) return;
      if (transitioning) return;
      transitioning = true;

      var targetPoints = BxParticleCore.generateTextShape(PARTICLE_COUNT, texts[idx], 7);

      // Scatter outward, then reform into new text
      morphInst.scatter(15, 0.5).then(function () {
        morphInst.setTarget(targetPoints);
        currentIdx = idx;
        transitioning = false;
      }).catch(function (err) { console.warn('[BxImaginemos] scatter failed:', err); transitioning = false; });
    }

    // Pin the section for 300% of viewport height
    ScrollTrigger.create({
      trigger: section,
      start: 'top top',
      end: '+=300%',
      pin: true,
      pinSpacing: true,
      scrub: false,
      invalidateOnRefresh: true,
      onUpdate: function (self) {
        var p = self.progress; // 0 → 1

        // Determine which text index we should be showing
        var targetIdx;
        if (p < 0.33) {
          targetIdx = 0;
        } else if (p < 0.66) {
          targetIdx = 1;
        } else {
          targetIdx = 2;
        }

        if (targetIdx !== currentIdx) {
          morphToText(targetIdx);
        }
      }
    });
  }

  /* ── init ─────────────────────────────────────────────── */

  function init() {
    var section = document.getElementById('imaginemos');
    if (!section) return;

    // 1. Parse text targets from data attribute
    var morphContainer = section.querySelector('.bx-text-morph');
    var texts = morphContainer ? parseTexts(morphContainer) : [];

    // 2. Text-morph instance — store at module scope for resize
    var morphInst = null;
    if (morphContainer && texts.length > 0) {
      morphInst = initTextMorph(morphContainer, texts);
      if (morphInst) {
        _instances.push(morphInst);
        if (window.__bxObserveWidget) {
          window.__bxObserveWidget(morphContainer, morphInst);
        } else {
          morphInst.startAnim();
        }
      }
    }

    // 3. City-grid instance
    var gridInst = null;
    var gridContainer = section.querySelector('.bx-city-grid');
    if (gridContainer) {
      gridInst = initCityGrid(gridContainer);
      if (gridInst) {
        _instances.push(gridInst);
        if (window.__bxObserveWidget) {
          window.__bxObserveWidget(gridContainer, gridInst);
        } else {
          gridInst.startAnim();
        }
      }
    }

    // 4. Fixed header fade (opacity-only, no vertical travel)
    var imagHeader = section.querySelector('.imag-header');
    initFixedHeaderFade(section, imagHeader);

    // 5. Pinned scroll with text cycling
    if (morphInst && texts.length > 1) {
      initPinnedScroll(section, morphInst, texts);
    }

  }

  function resize() {
    for (var i = 0; i < _instances.length; i++) {
      if (_instances[i] && _instances[i].resize) _instances[i].resize();
    }
  }

  return { init: init, resize: resize };
})();
