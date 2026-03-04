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

  /* ── 1. bx-logo-svg ── */
  function initLogoSVG() {
    var wrapper = document.querySelector('#hero .bx-logo-svg');
    if (!wrapper) return;
    var canvas = wrapper.querySelector('canvas');
    if (!canvas || !window.BxParticleCore) return;

    var n = 25000;
    var scale = 3.8; // Scaled down to fit within camera frustum visible width (~4.33 world units at FOV=55, camZ=9)
    var offY = 3.5; // C1+C2 fix: with full-bleed canvas (844px), offset logo upward to match Figma top:60px position
    var svgUrl = 'assets/logo_bexalta_white.svg';

    var inst = BxParticleCore.create(canvas, { count: n });
    if (!inst) return;

    // Start with chaos while SVG loads — offset to logo Y position
    var initialChaos = BxParticleCore.generateChaos(n, 2.5);
    for (var ic = 0; ic < initialChaos.length; ic++) { initialChaos[ic].y += offY; }
    inst.setTarget(initialChaos);
    inst.setColor(BxParticleCore.COLORS.white, BxParticleCore.COLORS.primary, 0.15);

    // ── Synchronous ScrollTrigger setup ──
    // Pin must register NOW so other ScrollTriggers calculate correct offsets.
    // SVG data fills in asynchronously; applyMorph is a no-op until ready.

    // Pre-allocate flat arrays — filled with initial chaos as placeholder
    var bexArr = new Float32Array(n * 3);
    var chaosArr = new Float32Array(n * 3);
    var ftArr = new Float32Array(n * 3);
    for (var i = 0; i < n; i++) {
      var cp = initialChaos[i % initialChaos.length];
      bexArr[i*3] = cp.x; bexArr[i*3+1] = cp.y; bexArr[i*3+2] = cp.z;
      chaosArr[i*3] = cp.x; chaosArr[i*3+1] = cp.y; chaosArr[i*3+2] = cp.z;
      ftArr[i*3] = cp.x; ftArr[i*3+1] = cp.y; ftArr[i*3+2] = cp.z;
    }

    var svgDataReady = false;

    // Scroll-driven proxy: morph progress 0→1 maps to full sequence
    // 0.0 = Bexalta, 0.5 = chaos (scattered), 1.0 = Foundtech
    var proxy = { morph: 0, hold: 0 };

    // Colors for each phase
    var bexColor = BxParticleCore.COLORS.white;
    var bexAccent = BxParticleCore.COLORS.primary;
    var ftColor = BxParticleCore.COLORS.primary;
    var ftAccent = BxParticleCore.COLORS.white;

    // Direct position interpolation on each scroll update
    // Writes to BOTH tgt (for render-loop lerp) AND posArr (immediate snap)
    var posArr = inst.geo.attributes.position.array;

    function applyMorph(m) {
      if (!svgDataReady) return; // no-op until SVG data populates arrays
      var tgtArr = inst.tgt;
      if (m <= 0.5) {
        // Bexalta → Chaos: t goes 0→1 as m goes 0→0.5
        var t = m / 0.5;
        for (var i = 0; i < n * 3; i++) {
          var v = bexArr[i] + (chaosArr[i] - bexArr[i]) * t;
          tgtArr[i] = v;
          posArr[i] = v;
        }
      } else {
        // Chaos → Foundtech: t goes 0→1 as m goes 0.5→1
        var t = (m - 0.5) / 0.5;
        for (var i = 0; i < n * 3; i++) {
          var v = chaosArr[i] + (ftArr[i] - chaosArr[i]) * t;
          tgtArr[i] = v;
          posArr[i] = v;
        }
      }
      inst.geo.attributes.position.needsUpdate = true;

      // Update turbulence: high during scatter, low at endpoints
      var turb = 1.0 - Math.abs(m - 0.5) * 2; // peaks at m=0.5
      inst.mat.uniforms.uMorphProgress.value = 0.3 + turb * 0.6;

      // Blend colors based on phase
      if (m < 0.4) {
        inst.setColor(bexColor, bexAccent, 0.15);
      } else if (m > 0.6) {
        inst.setColor(ftColor, ftAccent, 0.3);
      }
    }

    // Create pinned timeline SYNCHRONOUSLY — this is the critical fix.
    // applyMorph() is safe to call before data loads (returns early).
    gsap.timeline({
      scrollTrigger: {
        trigger: '#hero',
        start: 'top top',
        end: '+=400%',
        pin: true,
        scrub: 0.5,
        pinSpacing: true,
        anticipatePin: 1
      }
    })
    // 0–15%: Bexalta logo stays formed (visible pause)
    // Tween a dummy property so GSAP scrub fires onUpdate reliably
    .to(proxy, {
      hold: 0.15,
      duration: 0.15,
      onUpdate: function () { applyMorph(0); }
    })
    // 15–75%: Bexalta → scatter → Foundtech (full morph sequence)
    .to(proxy, {
      morph: 1,
      duration: 0.60,
      ease: 'none',
      onUpdate: function () {
        applyMorph(proxy.morph);
      }
    })
    // 75–100%: Foundtech stays visible — tween hold property for reliable onUpdate
    .to(proxy, {
      hold: 1,
      duration: 0.25,
      onUpdate: function () {
        applyMorph(1);
      }
    });

    // ── Async SVG loading — populates arrays, does NOT create ScrollTrigger ──
    (async function loadSVG() {
      try {
        var r = await fetch(svgUrl);
        var svgText = await r.text();
        var bexaltaPoints = await BxParticleCore.parseSVGToPoints(svgText, n, scale, 0, offY);
        inst.setTarget(bexaltaPoints);
        inst.setColor(BxParticleCore.COLORS.white, BxParticleCore.COLORS.primary, 0.15);

        // T2.1: Load Foundtech SVG for morph target
        var foundtechSvgUrl = 'assets/logo_foundtech_whitegreen.svg';
        fetch(foundtechSvgUrl).then(function (r) { return r.text(); }).then(function (ftSvgText) {
          console.log('[BxHero DEBUG] Foundtech SVG loaded, length:', ftSvgText.length);
          BxParticleCore.parseSVGToPoints(ftSvgText, n, scale, 0, offY).then(function (foundtechPts) {
            // Both logos use same scale + offY via parseSVGToPoints.
            // No post-processing needed — each keeps its natural aspect ratio.
            // Max X span = scale = 3.8, fits within visible frustum width (~4.33).
            // offY = 3.5 positions both at the same vertical zone.
            console.log('[BxHero] Foundtech points generated: scale=' + scale + ', offY=' + offY);

            // Pre-generate chaos points once — offset to logo Y position
            var chaosPoints = BxParticleCore.generateChaos(n, 3.0);
            for (var ic = 0; ic < chaosPoints.length; ic++) { chaosPoints[ic].y += offY; }

            // Populate the pre-allocated flat arrays with real SVG data
            for (var i = 0; i < n; i++) {
              var bp = bexaltaPoints[i % bexaltaPoints.length];
              bexArr[i*3] = bp.x; bexArr[i*3+1] = bp.y; bexArr[i*3+2] = bp.z;
              var cp = chaosPoints[i % chaosPoints.length];
              chaosArr[i*3] = cp.x; chaosArr[i*3+1] = cp.y; chaosArr[i*3+2] = cp.z;
              var fp = foundtechPts[i % foundtechPts.length];
              ftArr[i*3] = fp.x; ftArr[i*3+1] = fp.y; ftArr[i*3+2] = fp.z;
            }

            // Flip the flag — applyMorph() now uses real data on next scroll frame
            svgDataReady = true;
            console.log('[BxHero] SVG data ready, morph arrays populated');

            // Recalculate all ScrollTrigger positions now that content is final
            ScrollTrigger.refresh();
          }).catch(function (err) {
            console.warn('[BxHero] Foundtech SVG parse failed:', err);
            svgDataReady = true; // unblock ScrollTrigger even without Foundtech morph
          });
        }).catch(function (err) {
          console.warn('[BxHero] Foundtech SVG load failed:', err);
          svgDataReady = true; // unblock ScrollTrigger even without Foundtech logo
        });
      } catch (e) {
        console.warn('[BxHero] bx-logo-svg: could not load', svgUrl, e);
        svgDataReady = true; // unblock ScrollTrigger — hero renders without particle morph
      }
    })();

    // Register with Widget Observer for lazy start/stop
    if (window.__bxObserveWidget) {
      window.__bxObserveWidget(wrapper, inst);
    } else {
      inst.startAnim();
    }

    // Resize handler for particle canvas
    window.addEventListener('resize', function () {
      if (inst && inst.resize) inst.resize();
    });
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
        toggleActions: 'play none none reverse'
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
        toggleActions: 'play none none reverse'
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
      scrollTrigger: { trigger: '#hero', start: 'top top', end: '+=200', scrub: true }
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

  return { init: init };
})();
