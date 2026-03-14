/**
 * cta-animations.js — CTA Section Animations (Screen 21)
 * Task T6.4 | Bexalta V2 | Foundtech
 *
 * bx-cta-sparkles: Aceternity-style Canvas 2D sparkle system + GSAP entrance
 *   - 60 ambient background sparkles (full section)
 *   - 180 dense field sparkles (sparkles area)
 *   - 3 CSS gradient glow lines (Foundtech green)
 *   - ScrollTrigger-driven staggered slide+fade entrance with replay
 *   - Sequential section reveals: label → heading lines → HOY → glow lines → button → logo
 *   - Widget Observer lazy start/stop for particle system
 *
 * Deps: GSAP 3.12.5 + ScrollTrigger, widget-observer.js
 */
window.BxCtaAnimations = (function () {

  var _resizeFn = null;

  function init() {
    var section = document.getElementById('cta');
    if (!section) return;

    var ctaWrap      = section.querySelector('.cta');
    var sparklesArea = section.querySelector('.cta__sparkles');
    var label        = section.querySelector('.cta__label');
    var lines        = section.querySelectorAll('.cta__line');
    var hoy          = section.querySelector('.cta__hoy');
    var btn          = section.querySelector('.cta__button');
    var logo         = section.querySelector('.cta__logo');

    if (!ctaWrap || !sparklesArea) return;

    /* ═══════════════════════════════════════════════════════════════
       1. Inject canvases & glow lines dynamically (no HTML edits)
       ═══════════════════════════════════════════════════════════════ */

    /* Ambient background canvas — covers entire .cta wrapper */
    var bgCanvas = document.createElement('canvas');
    bgCanvas.style.cssText =
      'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:0';
    ctaWrap.insertBefore(bgCanvas, ctaWrap.firstChild);

    /* Dense field canvas — absolute inside sparkles area, below HOY */
    var fieldCanvas = document.createElement('canvas');
    fieldCanvas.style.cssText =
      'position:absolute;left:0;top:28px;width:100%;height:60%;' +
      'pointer-events:none;z-index:0';
    sparklesArea.appendChild(fieldCanvas);

    /* Field radial mask — fades dense sparkles at edges */
    var fieldMask = document.createElement('div');
    function updateFieldMask() {
      var maskH = fieldCanvas.offsetHeight || 115;
      var gradW = Math.round(maskH * 2.33);  /* ratio from original 280/120 ≈ 2.33 */
      var gradH = maskH;
      fieldMask.style.cssText =
        'position:absolute;left:0;top:28px;width:100%;height:60%;' +
        'pointer-events:none;z-index:1;' +
        'background:var(--bx-bg,#050508);' +
        '-webkit-mask-image:radial-gradient(' + gradW + 'px ' + gradH + 'px at top center,transparent 20%,black 100%);' +
        'mask-image:radial-gradient(' + gradW + 'px ' + gradH + 'px at top center,transparent 20%,black 100%)';
    }
    updateFieldMask();
    sparklesArea.appendChild(fieldMask);

    /* 3 glow lines — Foundtech green CSS gradients (#a2c62e → #d4ff60 → #efffb0) */
    /* RC#4 FIX: Dynamic glow line position based on HOY element height */
    var glowTop = hoy ? (hoy.offsetHeight + 4) : 66;
    var glowWrap = document.createElement('div');
    glowWrap.style.cssText =
      'position:absolute;top:' + glowTop + 'px;left:5%;width:90%;height:0;z-index:2';

    var glowWide = document.createElement('div');
    glowWide.style.cssText =
      'position:absolute;top:0;left:10%;width:80%;height:2px;' +
      'background:linear-gradient(90deg,transparent 0%,#a2c62e 30%,#d4ff60 50%,#a2c62e 70%,transparent 100%);' +
      'filter:blur(6px);opacity:0';

    var glowThin = document.createElement('div');
    glowThin.style.cssText =
      'position:absolute;top:0;left:10%;width:80%;height:1px;' +
      'background:linear-gradient(90deg,transparent 0%,#a2c62e 30%,#d4ff60 50%,#a2c62e 70%,transparent 100%);' +
      'opacity:0';

    var glowCore = document.createElement('div');
    glowCore.style.cssText =
      'position:absolute;top:-1px;left:30%;width:40%;height:4px;' +
      'background:linear-gradient(90deg,transparent 0%,#d4ff60 30%,#efffb0 50%,#d4ff60 70%,transparent 100%);' +
      'filter:blur(4px);opacity:0';

    glowWrap.appendChild(glowWide);
    glowWrap.appendChild(glowThin);
    glowWrap.appendChild(glowCore);
    sparklesArea.appendChild(glowWrap);

    /* ═══════════════════════════════════════════════════════════════
       2. Particle system (Aceternity-style Canvas 2D)
       ═══════════════════════════════════════════════════════════════ */

    var bgCtx    = bgCanvas.getContext('2d');
    var fieldCtx = fieldCanvas.getContext('2d');

    /* Foundtech palette */
    var COLORS = [
      { r: 162, g: 198, b: 46  },   /* #a2c62e — primary green   */
      { r: 212, g: 255, b: 96  },   /* #d4ff60 — bright yellow-green */
      { r: 240, g: 240, b: 240 }    /* #f0f0f0 — white accent    */
    ];
    var COLOR_WEIGHTS = [0.60, 0.30, 0.10];

    function pickColor() {
      var r = Math.random();
      if (r < COLOR_WEIGHTS[0]) return COLORS[0];
      if (r < COLOR_WEIGHTS[0] + COLOR_WEIGHTS[1]) return COLORS[1];
      return COLORS[2];
    }

    var BG_COUNT    = 60;    /* ambient background sparkles */
    var FIELD_COUNT = 180;   /* dense field sparkles        */

    var bgW = 0, bgH = 0, fW = 0, fH = 0;
    var bgParticles = [], fieldParticles = [];
    var running = false, raf;

    function resize() {
      bgW = bgCanvas.width  = bgCanvas.offsetWidth;
      bgH = bgCanvas.height = bgCanvas.offsetHeight;
      fW  = fieldCanvas.width  = fieldCanvas.offsetWidth;
      fH  = fieldCanvas.height = fieldCanvas.offsetHeight;
      updateFieldMask();
      /* RC#4 FIX: Recalculate glow line position on resize */
      if (hoy && glowWrap) {
        glowWrap.style.top = (hoy.offsetHeight + 4) + 'px';
      }
    }

    /* Circular particle — omnidirectional drift, sinusoidal twinkling */
    function createParticle(w, h, opts) {
      var col   = pickColor();
      var size  = opts.minSize + Math.random() * (opts.maxSize - opts.minSize);
      var angle = Math.random() * Math.PI * 2;
      var speed = opts.minSpeed + Math.random() * (opts.maxSpeed - opts.minSpeed);

      return {
        x: Math.random() * w,
        y: Math.random() * h,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: size,
        col: col,
        baseAlpha: 0.15 + Math.random() * 0.85,
        alpha: 0,
        phase: Math.random() * Math.PI * 2,
        twinkleSpeed: 0.008 + Math.random() * 0.025,
        life: 0,
        fadeInDuration: 30 + Math.random() * 60
      };
    }

    function initPool(count, w, h, opts) {
      var pool = [];
      for (var i = 0; i < count; i++) {
        var p = createParticle(w, h, opts);
        p.life = p.fadeInDuration + Math.random() * 200;  /* pre-age for instant visibility */
        pool.push(p);
      }
      return pool;
    }

    function updateParticle(p, w, h) {
      p.life++;
      var fadeIn  = Math.min(1, p.life / p.fadeInDuration);
      var twinkle = 0.5 + 0.5 * Math.sin(p.life * p.twinkleSpeed + p.phase);
      p.alpha = p.baseAlpha * twinkle * fadeIn;
      p.x += p.vx;
      p.y += p.vy;
      /* Edge-wrapping */
      if (p.x < -5)    p.x = w + 4;
      if (p.x > w + 5) p.x = -4;
      if (p.y < -5)    p.y = h + 4;
      if (p.y > h + 5) p.y = -4;
    }

    function drawParticle(ctx, p) {
      if (p.alpha < 0.01) return;
      ctx.save();
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle   = 'rgb(' + p.col.r + ',' + p.col.g + ',' + p.col.b + ')';
      ctx.shadowColor = 'rgb(' + p.col.r + ',' + p.col.g + ',' + p.col.b + ')';
      ctx.shadowBlur  = 4 + p.size * 2;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    /* Animation loop */
    function tick() {
      if (!running) return;
      raf = requestAnimationFrame(tick);

      bgCtx.clearRect(0, 0, bgW, bgH);
      for (var i = 0; i < bgParticles.length; i++) {
        updateParticle(bgParticles[i], bgW, bgH);
        drawParticle(bgCtx, bgParticles[i]);
      }

      fieldCtx.clearRect(0, 0, fW, fH);
      for (var j = 0; j < fieldParticles.length; j++) {
        updateParticle(fieldParticles[j], fW, fH);
        drawParticle(fieldCtx, fieldParticles[j]);
      }
    }

    /* ═══════════════════════════════════════════════════════════════
       3. ScrollTrigger — staggered slide+fade entrance with replay
       Sequential section reveals to create visual pacing.
       Motion rewards scrolling, not competing with content.
       ═══════════════════════════════════════════════════════════════ */

    /* Collect all animatable targets for reset/replay */
    var allTargets = [];
    if (label) allTargets.push(label);
    for (var i = 0; i < lines.length; i++) allTargets.push(lines[i]);
    if (hoy)  allTargets.push(hoy);
    allTargets.push(glowWide, glowThin, glowCore);
    if (btn)  allTargets.push(btn);
    if (logo) allTargets.push(logo);

    /* Set initial hidden states */
    function setHidden() {
      if (label) gsap.set(label, { opacity: 0, y: 30 });
      gsap.set(lines, { opacity: 0, y: 24 });
      if (hoy)  gsap.set(hoy,  { opacity: 0, y: -20, scale: 0.92 });
      gsap.set(glowWide, { opacity: 0, scaleX: 0.3 });
      gsap.set(glowThin, { opacity: 0, scaleX: 0.3 });
      gsap.set(glowCore, { opacity: 0, scaleX: 0.2 });
      if (btn)  gsap.set(btn,  { opacity: 0, y: 16 });
      if (logo) gsap.set(logo, { opacity: 0, y: 20 });
    }

    setHidden();

    /* Build the entrance timeline */
    function buildTimeline() {
      var tl = gsap.timeline({ paused: true });

      /* Phase 1 — Label slides up + fades in */
      if (label) {
        tl.to(label, {
          opacity: 1, y: 0,
          duration: 0.9, ease: 'power3.out'
        }, 0);
      }

      /* Phase 2 — Heading lines cascade with stagger (slide+fade combo) */
      tl.to(lines, {
        opacity: 1, y: 0,
        duration: 0.8, ease: 'power3.out',
        stagger: 0.12
      }, 0.3);

      /* Phase 3 — HOY scales up + fades in (the visual anchor) */
      if (hoy) {
        tl.to(hoy, {
          opacity: 1, y: 0, scale: 1,
          duration: 1.2, ease: 'power4.out'
        }, 0.85);
      }

      /* Phase 4 — Glow lines expand outward with cascade */
      tl.to(glowWide, {
        opacity: 1, scaleX: 1,
        duration: 0.7, ease: 'power2.out'
      }, 1.15);

      tl.to(glowThin, {
        opacity: 1, scaleX: 1,
        duration: 0.7, ease: 'power2.out'
      }, 1.22);

      tl.to(glowCore, {
        opacity: 1, scaleX: 1,
        duration: 0.5, ease: 'power2.out'
      }, 1.30);

      /* Phase 5 — Button rises into place (the payoff) */
      if (btn) {
        tl.to(btn, {
          opacity: 1, y: 0,
          duration: 1.0, ease: 'power3.out'
        }, 1.35);
      }

      /* Phase 6 — Logo fades in last (Foundtech signature) */
      if (logo) {
        tl.to(logo, {
          opacity: 1, y: 0,
          duration: 0.8, ease: 'power2.out'
        }, 1.6);
      }

      return tl;
    }

    var entranceTL = buildTimeline();

    /* ScrollTrigger — replay on re-enter */
    gsap.registerPlugin(ScrollTrigger);

    ScrollTrigger.create({
      trigger: section,
      start: 'top 75%',
      end: 'bottom 20%',
      invalidateOnRefresh: true,
      onEnter: function () {
        setHidden();
        entranceTL.restart();
      },
      onEnterBack: function () {
        setHidden();
        entranceTL.restart();
      },
      onLeave: function () {
        entranceTL.pause(0);
        setHidden();
      },
      onLeaveBack: function () {
        entranceTL.pause(0);
        setHidden();
      }
    });

    /* ═══════════════════════════════════════════════════════════════
       4. Start / Stop (Widget Observer lifecycle — particles only)
       ═══════════════════════════════════════════════════════════════ */

    function start() {
      if (running) return;
      running = true;
      resize();

      bgParticles = initPool(
        BG_COUNT, bgW, bgH,
        { minSize: 0.4, maxSize: 1.2, minSpeed: 0.05, maxSpeed: 0.3 }
      );
      fieldParticles = initPool(
        FIELD_COUNT, fW, fH,
        { minSize: 0.3, maxSize: 1.0, minSpeed: 0.03, maxSpeed: 0.2 }
      );

      tick();
    }

    function stop() {
      running = false;
      cancelAnimationFrame(raf);
      bgCtx.clearRect(0, 0, bgW, bgH);
      fieldCtx.clearRect(0, 0, fW, fH);
    }

    /* ═══════════════════════════════════════════════════════════════
       5. Widget Observer — lazy start/stop (particles)
       ═══════════════════════════════════════════════════════════════ */

    if (window.__bxObserveWidget) {
      window.__bxObserveWidget(section, { startAnim: start, stopAnim: stop });
    } else {
      start();
    }

    _resizeFn = function () { if (running) resize(); };
  }

  function publicResize() {
    if (_resizeFn) _resizeFn();
  }

  return { init: init, resize: publicResize };

})();