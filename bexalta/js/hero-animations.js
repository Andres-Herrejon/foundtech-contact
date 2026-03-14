/* ==========================================================================
   hero-animations.js — Hero Section Animations (T1.2)
   Bexalta V2 | Foundtech

   Widgets:
     1. bx-logo-svg   — Particle morph into Bexalta SVG logo (BxParticleCore)
     2. bx-animated-counter — Count-up on visibility (GSAP)
     3. bx-stagger-tags — Sequential tag reveal + cycling highlight (GSAP)

   Deps: Three.js r128, BxParticleCore, Widget Observer, GSAP 3.12.5, ScrollTrigger
   ========================================================================== */

window.BxHeroAnimations = (function () {
  'use strict';

  var _particleInst = null;
  var _logoState = null;
  var HERO_TARGET_PCT = 0.38;
  var HERO_LOGO_ASPECT = 296.2 / 106.5;

  function getLogoMetrics(wrapper) {
    var canvas = wrapper ? wrapper.querySelector('canvas') : null;
    if (!canvas) return null;

    var parentRect = canvas.parentElement.getBoundingClientRect();
    var parentW = parentRect.width;
    var parentH = parentRect.height;
    if (parentW < 1 || parentH < 1) return null;

    var baseWidth = 390;
    var fovRad = (55 / 2) * Math.PI / 180;
    var camZ = 9 * Math.pow(baseWidth / Math.max(parentW, baseWidth), 0.5);
    camZ = Math.max(camZ, 6);

    var visibleWidth = 2 * camZ * Math.tan(fovRad);
    var visibleHeight = visibleWidth * (parentH / parentW);
    var scale = Math.min(3.8, visibleWidth * 0.7);
    var offY = visibleHeight * 0.5 * 0.35;

    if (window.innerWidth >= 768) {
      scale = HERO_TARGET_PCT * visibleWidth;

      var heading = document.querySelector('#hero .hero__heading');
      var headingTopPx = heading ? heading.getBoundingClientRect().top - parentRect.top : parentH * 0.22;
      var logoWidthPx = parentW * (scale / visibleWidth);
      var logoHeightPx = logoWidthPx / HERO_LOGO_ASPECT;
      var gapPx = window.innerWidth >= 1440 ? 36 : window.innerWidth >= 1024 ? 28 : 24;
      var minTop = window.innerHeight <= 900 ? 32 : 12;
      var logoTopPx = Math.max(minTop, headingTopPx - gapPx - logoHeightPx);
      var logoCenterPx = logoTopPx + (logoHeightPx * 0.5);

      // THREE.js PerspectiveCamera uses vertical FOV, so the true frustum
      // height is 2*camZ*tan(fov/2) — which equals `visibleWidth` above.
      // Using `visibleHeight` (which multiplies by parentH/parentW) inflates
      // offY on portrait viewports (e.g. iPad Mini 768x1024) and pushes the
      // logo above the visible frustum.
      var frustumH = 2 * camZ * Math.tan(fovRad);
      offY = ((parentH * 0.5) - logoCenterPx) * (frustumH / parentH);
    }

    return {
      camZ: camZ,
      scale: scale,
      offY: offY
    };
  }

  function offsetChaos(count, radius, offY) {
    var points = BxParticleCore.generateChaos(count, radius);
    for (var i = 0; i < points.length; i++) {
      points[i].y += offY;
    }
    return points;
  }

  function fillPointArray(targetArr, points, count) {
    for (var i = 0; i < count; i++) {
      var point = points[i % points.length];
      targetArr[i * 3] = point.x;
      targetArr[i * 3 + 1] = point.y;
      targetArr[i * 3 + 2] = point.z;
    }
  }

  async function rebuildLogoTargets(state, chaosRadius) {
    if (!state || !state.inst || !state.bexaltaSvgText) return;

    var metrics = getLogoMetrics(state.wrapper);
    if (!metrics) return;

    state.metrics = metrics;
    if (state.inst.camera) {
      state.inst.camera.position.z = metrics.camZ;
    }

    var buildToken = (state.buildToken || 0) + 1;
    state.buildToken = buildToken;

    try {
      var bexaltaPoints = await BxParticleCore.parseSVGToPoints(state.bexaltaSvgText, state.n, metrics.scale, 0, metrics.offY);
      if (!state.inst || state.buildToken !== buildToken) return;

      var foundtechPoints = state.foundtechSvgText
        ? await BxParticleCore.parseSVGToPoints(state.foundtechSvgText, state.n, metrics.scale, 0, metrics.offY)
        : bexaltaPoints;
      if (!state.inst || state.buildToken !== buildToken) return;

      var chaosPoints = offsetChaos(state.n, chaosRadius || 3.0, metrics.offY);

      fillPointArray(state.bexArr, bexaltaPoints, state.n);
      fillPointArray(state.chaosArr, chaosPoints, state.n);
      fillPointArray(state.ftArr, foundtechPoints, state.n);

      state.svgDataReady = true;
      state.applyMorph(state.proxy.morph);

      if (typeof ScrollTrigger !== 'undefined') {
        ScrollTrigger.refresh();
      }
    } catch (err) {
      console.warn('[BxHero] Logo target rebuild failed:', err);
      state.svgDataReady = true;
    }
  }

  /* ── 1. bx-logo-svg ── */
  function initLogoSVG() {
    var wrapper = document.querySelector('#hero .bx-logo-svg');
    if (!wrapper) return;
    var canvas = wrapper.querySelector('canvas');
    if (!canvas || !window.BxParticleCore) return;

    var n = 25000;
    var metrics = getLogoMetrics(wrapper);
    if (!metrics) return;

    var inst = BxParticleCore.create(canvas, { count: n, camZ: metrics.camZ });
    if (!inst) return;
    _particleInst = inst;

    var initialChaos = offsetChaos(n, 2.5, metrics.offY);
    inst.setTarget(initialChaos);
    inst.setColor(BxParticleCore.COLORS.white, BxParticleCore.COLORS.primary, 0.15);

    var bexArr = new Float32Array(n * 3);
    var chaosArr = new Float32Array(n * 3);
    var ftArr = new Float32Array(n * 3);
    fillPointArray(bexArr, initialChaos, n);
    fillPointArray(chaosArr, initialChaos, n);
    fillPointArray(ftArr, initialChaos, n);

    var proxy = { morph: 0, hold: 0 };
    var posArr = inst.geo.attributes.position.array;
    var state = {
      wrapper: wrapper,
      n: n,
      inst: inst,
      metrics: metrics,
      bexArr: bexArr,
      chaosArr: chaosArr,
      ftArr: ftArr,
      posArr: posArr,
      proxy: proxy,
      svgDataReady: false,
      bexaltaSvgText: null,
      foundtechSvgText: null,
      buildToken: 0,
      applyMorph: null,
      timeline: null
    };
    _logoState = state;

    var bexColor = BxParticleCore.COLORS.white;
    var bexAccent = BxParticleCore.COLORS.primary;
    var ftColor = BxParticleCore.COLORS.primary;
    var ftAccent = BxParticleCore.COLORS.white;

    state.applyMorph = function (m) {
      if (!state.svgDataReady) return;

      var morph = typeof m === 'number' ? m : 0;
      var tgtArr = state.inst.tgt;

      if (morph <= 0.5) {
        var t = morph / 0.5;
        for (var i = 0; i < state.n * 3; i++) {
          var bexToChaos = state.bexArr[i] + (state.chaosArr[i] - state.bexArr[i]) * t;
          tgtArr[i] = bexToChaos;
          state.posArr[i] = bexToChaos;
        }
      } else {
        var t = (morph - 0.5) / 0.5;
        for (var i = 0; i < state.n * 3; i++) {
          var chaosToFt = state.chaosArr[i] + (state.ftArr[i] - state.chaosArr[i]) * t;
          tgtArr[i] = chaosToFt;
          state.posArr[i] = chaosToFt;
        }
      }

      state.inst.geo.attributes.position.needsUpdate = true;

      var turb = 1.0 - Math.abs(morph - 0.5) * 2;
      state.inst.mat.uniforms.uMorphProgress.value = 0.3 + turb * 0.6;

      if (morph < 0.4) {
        state.inst.setColor(bexColor, bexAccent, 0.15);
      } else if (morph > 0.6) {
        state.inst.setColor(ftColor, ftAccent, 0.3);
      }
    };

    state.timeline = gsap.timeline({
      scrollTrigger: {
        trigger: '#hero',
        start: 'top top',
        end: '+=400%',
        pin: true,
        scrub: 0.5,
        pinSpacing: true,
        anticipatePin: 1,
        invalidateOnRefresh: true
      }
    })
    .to(proxy, {
      hold: 0.15,
      duration: 0.15,
      onUpdate: function () { state.applyMorph(0); }
    })
    .to(proxy, {
      morph: 1,
      duration: 0.60,
      ease: 'none',
      onUpdate: function () {
        state.applyMorph(proxy.morph);
      }
    })
    .to(proxy, {
      hold: 1,
      duration: 0.25,
      onUpdate: function () {
        state.applyMorph(1);
      }
    });

    (async function loadSVG() {
      /* Use pre-loaded SVGs from preloader if available (faster + more reliable) */
      var preloaded = window.__bxPreloadedSVGs;

      try {
        if (preloaded && preloaded['assets/logo_bexalta_white.svg']) {
          state.bexaltaSvgText = preloaded['assets/logo_bexalta_white.svg'];
        } else {
          var bexaltaResponse = await fetch('assets/logo_bexalta_white.svg');
          state.bexaltaSvgText = await bexaltaResponse.text();
        }
      } catch (err) {
        console.warn('[BxHero] Bexalta SVG load failed:', err);
        state.svgDataReady = true;
        return;
      }

      try {
        if (preloaded && preloaded['assets/logo_foundtech_whitegreen.svg']) {
          state.foundtechSvgText = preloaded['assets/logo_foundtech_whitegreen.svg'];
        } else {
          var foundtechResponse = await fetch('assets/logo_foundtech_whitegreen.svg');
          state.foundtechSvgText = await foundtechResponse.text();
        }
      } catch (err) {
        console.warn('[BxHero] Foundtech SVG load failed:', err);
      }

      await rebuildLogoTargets(state, 3.0);
    })();

    if (window.__bxObserveWidget) {
      window.__bxObserveWidget(wrapper, inst);
    } else {
      inst.startAnim();
    }
  }

  /* ── 2. bx-animated-counter ── */
  function initCounters() {
    var container = document.querySelector('#hero .bx-animated-counter');
    if (!container) return;

    // The hero counter values are static text like "137 km²" and "+300".
    // We need to extract the numeric targets and animate them.
    var counterEls = container.querySelectorAll('.hero__counter');
    if (!counterEls.length) return;

    // Counter config: target value, prefix, suffix, and the value element
    var counters = [
      { el: counterEls[0], target: 137, prefix: '', suffix: ' km<sup>2</sup>', label: 'Rentables' },
      { el: counterEls[1], target: 300, prefix: '+', suffix: '', label: 'Unidades' }
    ];

    counters.forEach(function (cfg) {
      var valueEl = cfg.el.querySelector('.hero__counter-value');
      if (!valueEl) return;

      // Set initial state to 0
      valueEl.innerHTML = cfg.prefix + '0' + cfg.suffix;

      var obs = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting && !valueEl.dataset.animated) {
            valueEl.dataset.animated = '1';
            gsap.to({ val: 0 }, {
              val: cfg.target,
              duration: 2,
              ease: 'power2.out',
              onUpdate: function () {
                valueEl.innerHTML = cfg.prefix + Math.round(this.targets()[0].val) + cfg.suffix;
              }
            });
            obs.disconnect();
          }
        });
      }, { threshold: 0.5 });

      obs.observe(valueEl);
    });
  }

  /* ── 3. bx-stagger-tags ── */
  function initStaggerTags() {
    var wrapper = document.querySelector('#hero .bx-stagger-tags');
    if (!wrapper) return;

    var tags = wrapper.querySelectorAll('.hero__tag');
    if (!tags.length) return;

    gsap.registerPlugin(ScrollTrigger);

    // Set initial hidden state
    gsap.set(tags, { opacity: 0, y: 12, willChange: 'transform, opacity' });

    var tl = gsap.timeline({
      scrollTrigger: {
        trigger: wrapper,
        start: 'top 90%',
        toggleActions: 'play none none reverse',
        invalidateOnRefresh: true
      }
    });

    // Stagger entrance
    tl.to(tags, {
      opacity: 1,
      y: 0,
      stagger: 0.15,
      duration: 1.0,
      ease: 'power3.out',
      onComplete: function () {
        var tgts = this.targets();
        for (var i = 0; i < tgts.length; i++) tgts[i].style.willChange = 'auto';
      }
    });

    // After entrance, start cycling highlight (tied to Widget Observer lifecycle)
    var tagIntervalId = null;
    var tagIdx = 0;

    function startTagCycle() {
      if (tagIntervalId) return;
      tagIntervalId = setInterval(function () {
        tags.forEach(function (t) {
          t.style.color = '';
          t.style.fontWeight = '';
          t.style.textShadow = 'none';
          t.classList.remove('hero__tag--active');
        });
        tags[tagIdx].style.color = '#a2c62e';
        tags[tagIdx].style.fontWeight = '500';
        tags[tagIdx].style.textShadow = '0 0 20px rgba(162,198,46,.35)';
        tags[tagIdx].classList.add('hero__tag--active');
        tagIdx = (tagIdx + 1) % tags.length;
      }, 1200);
    }

    function stopTagCycle() {
      if (tagIntervalId) {
        clearInterval(tagIntervalId);
        tagIntervalId = null;
      }
    }

    tl.add(function () {
      startTagCycle();
    });

    // Register with Widget Observer so cycling stops when hero leaves viewport
    if (window.__bxObserveWidget) {
      window.__bxObserveWidget(wrapper, { startAnim: startTagCycle, stopAnim: stopTagCycle });
    }
  }

  /* ── 4. Subtext reveal (T2.3) ── */
  function initSubtextReveal() {
    var subtext = document.querySelector('#hero .hero__subtext');
    if (!subtext) return;
    gsap.set(subtext, { opacity: 0, y: 24 });
    gsap.to(subtext, {
      opacity: 1, y: 0,
      duration: 1.2, delay: 0.3, ease: 'power2.out',
      scrollTrigger: {
        trigger: subtext,
        start: 'top 85%',
        toggleActions: 'play none none reverse',
        invalidateOnRefresh: true
      }
    });
  }

  /* ── 5. Scroll indicator (T1.6, T2.2) ── */
  function initScrollIndicator() {
    var indicator = document.querySelector('.hero__scroll-indicator');
    var dot = document.querySelector('.hero__scroll-dot');
    if (!dot || !indicator) return;

    // T2.2: Delayed entrance — don't compete with hero content
    gsap.to(indicator, {
      opacity: 1,
      duration: 1.0,
      delay: 2.5, // Appear after hero animations settle
      ease: 'power2.out'
    });

    // T2.2: Gentler bounce — slower, smaller travel
    gsap.to(dot, {
      y: 14, opacity: 0.3,  // was y:18, opacity:0 — less aggressive
      duration: 2.0,         // was 1.5 — slower
      ease: 'sine.inOut',    // was power2.inOut — smoother
      repeat: -1, yoyo: true
    });

    // Fade out on scroll (unchanged)
    gsap.to(indicator, {
      opacity: 0,
      scrollTrigger: { trigger: '#hero', start: 'top top', end: '+=200', scrub: true, invalidateOnRefresh: true }
    });
  }

  /* ── Public init ── */
  function init() {
    initLogoSVG();
    initCounters();
    initStaggerTags();
    initSubtextReveal();
    initScrollIndicator();
    console.log('[BxHero] Hero animations initialized');
  }

  function resize() {
    if (!_particleInst || !_logoState) return;
    if (_particleInst.resize) _particleInst.resize();

    var metrics = getLogoMetrics(_logoState.wrapper);
    if (!metrics) return;

    _logoState.metrics = metrics;
    if (_particleInst.camera) {
      _particleInst.camera.position.z = metrics.camZ;
    }

    if (_logoState.bexaltaSvgText) {
      rebuildLogoTargets(_logoState, 3.0);
    } else {
      var initialChaos = offsetChaos(_logoState.n, 2.5, metrics.offY);
      _particleInst.setTarget(initialChaos);
      fillPointArray(_logoState.bexArr, initialChaos, _logoState.n);
      fillPointArray(_logoState.chaosArr, initialChaos, _logoState.n);
      fillPointArray(_logoState.ftArr, initialChaos, _logoState.n);
    }
  }

  return { init: init, resize: resize };
})();
