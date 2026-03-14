/**
 * credenciales-animations.js — T6.4 (Sequential rewrite)
 * Single pinned section with intro stagger + 3 sequential layers:
 *   Intro: Foundtech logo, heading, partner text, logo carousel
 *   Layer 1: bx-image-sequence (real_building_01) — scroll-driven
 *   Layer 2: bx-image-sequence (real_building_02) — scroll-driven
 *   Layer 3: bx-wave-theater  (BxParticleCore flat-grid waves) — scroll-driven
 * All animations advance with scroll, completing fully per phase.
 * Sequential transitions: each layer plays → holds last frame → fades out →
 * next layer fades in (no crossfade, no overlap).
 * Smooth lerp interpolation for buttery scroll experience.
 * Deps: GSAP 3.12.5, ScrollTrigger, Three.js r128, BxParticleCore,
 *       widget-observer.js (__bxObserveWidget)
 */
window.BxCredencialesAnimations = (function () {
  'use strict';

  var _instances = [];

  /* ── Constants ────────────────────────────────────────────────────── */
  var PIN_END       = '+=500%';   /* extra 100% vs Afuera for intro phase */
  var INTRO_END     = 0.20;       /* 0–20% scroll: intro stagger + hold */
  var FADE_DUR      = 0.03;       /* fade-out / fade-in duration (3% scroll each) */
  var HOLD_DUR      = 0.07;       /* hold on last frame before fading out */

  /*
   * Sequential phase layout (overall scroll 0.20 → 1.00 = 0.80 total):
   *
   * Layer 1: anim 0.20→0.39 | hold 0.39→0.46 | fadeOut 0.46→0.49
   * Layer 2: fadeIn 0.49→0.52 | anim 0.52→0.66 | hold 0.66→0.73 | fadeOut 0.73→0.76
   * Layer 3: fadeIn 0.76→0.79 | anim 0.79→0.93 | hold 0.93→1.00
   */
  var L1_ANIM_START  = INTRO_END;               // 0.20
  var L1_ANIM_END    = 0.39;                     // animation plays
  var L1_HOLD_END    = L1_ANIM_END + HOLD_DUR;   // 0.46 — hold last frame
  var L1_FADE_END    = L1_HOLD_END + FADE_DUR;   // 0.49 — fade out to 0

  var L2_FADE_START  = L1_FADE_END;              // 0.49
  var L2_FADE_IN_END = L2_FADE_START + FADE_DUR; // 0.52 — fade in to 1
  var L2_ANIM_END    = 0.66;                     // animation plays
  var L2_HOLD_END    = L2_ANIM_END + HOLD_DUR;   // 0.73 — hold last frame
  var L2_FADE_END    = L2_HOLD_END + FADE_DUR;   // 0.76 — fade out to 0

  var L3_FADE_START  = L2_FADE_END;              // 0.76
  var L3_FADE_IN_END = L3_FADE_START + FADE_DUR; // 0.79 — fade in to 1
  var L3_ANIM_END    = 0.93;                     // animation plays
  var L3_HOLD_END    = 1.00;                     // hold last frame until end

  /* Keep PHASE boundaries for header + text-page switching (midpoint of transitions) */
  var PHASE1_END     = (L1_FADE_END + L2_FADE_IN_END) / 2;  // ~0.505
  var PHASE2_END     = (L2_FADE_END + L3_FADE_IN_END) / 2;  // ~0.775

  function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
  function easeInOut(t) { var x = clamp01(t); return x * x * (3 - 2 * x); }

  /* ── Text track: 3 pages, switch at transition midpoints ── */
  function textTrackX(progress) {
    /* Text switches happen during the fade-out/fade-in gap */
    var fadeWidth = FADE_DUR * 2;  /* total transition zone = fadeOut + fadeIn */

    /* Transition 1: L1→L2 (centered at ~0.505) */
    var t1Center = (L1_FADE_END + L2_FADE_IN_END) / 2;
    var t1Start  = t1Center - fadeWidth / 2;
    var t1End    = t1Center + fadeWidth / 2;

    /* Transition 2: L2→L3 (centered at ~0.775) */
    var t2Center = (L2_FADE_END + L3_FADE_IN_END) / 2;
    var t2Start  = t2Center - fadeWidth / 2;
    var t2End    = t2Center + fadeWidth / 2;

    if (progress < t1Start) return 0;
    if (progress < t1End)   return -100 * easeInOut((progress - t1Start) / fadeWidth);
    if (progress < t2Start) return -100;
    if (progress < t2End)   return -100 - 100 * easeInOut((progress - t2Start) / fadeWidth);
    return -200;
  }

  /* ── Layer opacities: sequential fade-out then fade-in (no overlap) ── */
  function computeLayerOpacities(progress) {
    var p = progress;
    var o0 = 0, o1 = 0, o2 = 0;

    /* ── Layer 0 (real_building_01) ── */
    if (p >= L1_ANIM_START && p < L1_HOLD_END) {
      /* Playing animation or holding last frame — fully visible */
      o0 = 1;
    } else if (p >= L1_HOLD_END && p < L1_FADE_END) {
      /* Fading out */
      o0 = 1 - easeInOut((p - L1_HOLD_END) / FADE_DUR);
    }

    /* ── Layer 1 (real_building_02) ── */
    if (p >= L2_FADE_START && p < L2_FADE_IN_END) {
      /* Fading in */
      o1 = easeInOut((p - L2_FADE_START) / FADE_DUR);
    } else if (p >= L2_FADE_IN_END && p < L2_HOLD_END) {
      /* Playing animation or holding last frame — fully visible */
      o1 = 1;
    } else if (p >= L2_HOLD_END && p < L2_FADE_END) {
      /* Fading out */
      o1 = 1 - easeInOut((p - L2_HOLD_END) / FADE_DUR);
    }

    /* ── Layer 2 (wave_theater) ── */
    if (p >= L3_FADE_START && p < L3_FADE_IN_END) {
      /* Fading in */
      o2 = easeInOut((p - L3_FADE_START) / FADE_DUR);
    } else if (p >= L3_FADE_IN_END) {
      /* Playing animation or holding last frame — fully visible */
      o2 = 1;
    }

    return [o0, o1, o2];
  }


  /* ──────────────────────────────────────────────
     Logo Carousel (CSS animation, pause/resume)
     ────────────────────────────────────────────── */
  function initLogoCarousel(section) {
    var carousel = section.querySelector('.bx-logo-carousel');
    if (!carousel) return;
    var track = carousel.querySelector('.cr-carousel__track');
    if (!track) return;

    /* On short viewports the carousel (top:775px) sits below the fold
       inside the pinned section, so IntersectionObserver never fires.
       Start running immediately — the intro stagger handles visibility. */
    track.style.animationPlayState = 'running';
  }


  /* ──────────────────────────────────────────────
     1. Image Sequence Layer — scroll-driven
     Canvas 2D with contain/letterbox, frame driven by scroll progress
     ────────────────────────────────────────────── */
  function initImageSequenceLayer(layerEl) {
    var canvas = layerEl.querySelector('canvas');
    if (!canvas) return null;
    var ctx = canvas.getContext('2d');

    var folder     = layerEl.dataset.folder     || './sequence/';
    var prefix     = layerEl.dataset.prefix     || 'frame_';
    var suffix     = layerEl.dataset.suffix     || '.webp';
    var FRAME_COUNT = parseInt(layerEl.dataset.frameCount) || 60;
    var PAD        = parseInt(layerEl.dataset.pad)         || 4;
    var START_INDEX = parseInt(layerEl.dataset.startIndex) || 1;

    function framePath(i) {
      var num = String(i + START_INDEX).padStart(PAD, '0');
      return folder + prefix + num + suffix;
    }

    var frames = [];
    var loaded = 0;
    var ready = false;

    /* Check for pre-loaded frames from centralized preloader */
    var preloadedFrames = window.__bxPreloadedFrames && window.__bxPreloadedFrames[folder];

    function preload() {
      if (preloadedFrames && preloadedFrames.length >= FRAME_COUNT) {
        frames = preloadedFrames;
        loaded = FRAME_COUNT;
        ready = true;
        return Promise.resolve();
      }
      return new Promise(function (resolve) {
        for (var i = 0; i < FRAME_COUNT; i++) {
          var img = new Image();
          img.onload = img.onerror = function () {
            loaded++;
            if (loaded >= FRAME_COUNT) { ready = true; resolve(); }
          };
          img.src = framePath(i);
          frames[i] = img;
        }
      });
    }

    /* Draw with contain/letterbox — preserves original aspect ratio */
    var lastDrawn = -1;
    function drawFrame(index) {
      if (index === lastDrawn) return;
      var img = frames[index];
      if (!img || !img.naturalWidth) return;

      var rect = canvas.parentElement.getBoundingClientRect();
      var dpr  = Math.min(window.devicePixelRatio, 2);
      var cw   = Math.round(rect.width  * dpr);
      var ch   = Math.round(rect.height * dpr);
      if (canvas.width !== cw || canvas.height !== ch) {
        canvas.width  = cw;
        canvas.height = ch;
      }

      var imgAspect    = img.naturalWidth / img.naturalHeight;
      var canvasAspect = cw / ch;
      var dw, dh, dx, dy;
      if (imgAspect > canvasAspect) {
        dw = cw; dh = cw / imgAspect; dx = 0; dy = (ch - dh) / 2;
      } else {
        dh = ch; dw = ch * imgAspect; dx = (cw - dw) / 2; dy = 0;
      }

      ctx.clearRect(0, 0, cw, ch);
      ctx.drawImage(img, dx, dy, dw, dh);
      lastDrawn = index;
    }

    /* Scroll-driven: map progress 0→1 to frame index */
    var currentProgress = 0;
    function setScrollProgress(p) {
      currentProgress = clamp01(p);
      if (!ready) return;
      var frameIndex = Math.round(currentProgress * (FRAME_COUNT - 1));
      drawFrame(frameIndex);
    }

    /* Boot */
    preload().then(function () {
      canvas.style.display = 'block';
      drawFrame(0);
    });

    return {
      setScrollProgress: setScrollProgress,
      resize: function () {
        lastDrawn = -1;
        if (ready) drawFrame(Math.round(currentProgress * (FRAME_COUNT - 1)));
      }
    };
  }


  /* ──────────────────────────────────────────────
     2. Wave Theater Layer (BxParticleCore flat-grid)
     Scroll-driven: timeline scrubbed by scroll progress, RAF renders
     ────────────────────────────────────────────── */
  function initWaveTheaterLayer(layerEl) {
    var canvas = layerEl.querySelector('canvas');
    if (!canvas) return null;
    if (typeof BxParticleCore === 'undefined') return null;

    var N = 25000;
    var inst = BxParticleCore.create(canvas, {
      count: N,
      waveMode: true,
      fov: 45,
      camZ: 12
    });
    if (!inst) return null;

    inst.setTarget(BxParticleCore.generateFlatGrid(N));
    inst.mat.uniforms.uWaveType.value  = 0;
    inst.mat.uniforms.uFlowSpeed.value = 0.3;
    inst.setColor(
      BxParticleCore.COLORS.primary,
      BxParticleCore.COLORS.primaryBright,
      0.25
    );

    /* ── Scroll-driven timeline (paused, seeked by scroll) ── */
    var waveState = {
      waveType: 0,
      flowSpeed: 0.3,
      intensity: 1,
      morphProgress: 0,
      camZ: 12,
      camY: 0
    };

    var tl = gsap.timeline({ paused: true });

    /* Phase A (0→33%): gentle sine, camera pulls in */
    tl.to(waveState, { flowSpeed: 0.8, duration: 4, ease: 'power1.inOut' }, 0);
    tl.to(waveState, { camZ: 10, duration: 4, ease: 'power2.inOut' }, 0);

    /* Phase B (25→60%): transition to interference, brighter */
    tl.to(waveState, { waveType: 1, duration: 4, ease: 'power2.inOut' }, 3);
    tl.to(waveState, { flowSpeed: 1.2, duration: 4, ease: 'power1.inOut' }, 3);
    tl.to(waveState, { camZ: 9, camY: -0.5, duration: 4, ease: 'power2.inOut' }, 3);

    /* Phase C (58→100%): flow mode, full intensity */
    tl.to(waveState, { waveType: 2, duration: 4, ease: 'power2.inOut' }, 7);
    tl.to(waveState, { flowSpeed: 1.5, duration: 3, ease: 'power1.inOut' }, 7);
    tl.to(waveState, { camZ: 8.5, camY: 0, duration: 4, ease: 'power2.inOut' }, 8);
    tl.to(waveState, { morphProgress: 0.3, duration: 3, ease: 'power2.out' }, 8);

    /* Apply timeline state to Three.js uniforms */
    function applyState() {
      inst.mat.uniforms.uWaveType.value = waveState.waveType;
      inst.mat.uniforms.uFlowSpeed.value = waveState.flowSpeed;
      inst.mat.uniforms.uWaveIntensity.value = waveState.intensity;
      inst.mat.uniforms.uMorphProgress.value = waveState.morphProgress;
      inst.camera.position.z = waveState.camZ;
      inst.camera.position.y = waveState.camY;
    }

    /* Scroll-driven: seek timeline to given progress (0→1) */
    function setScrollProgress(p) {
      tl.progress(clamp01(p));
      applyState();
    }

    return {
      startAnim: function () { if (inst.startAnim) inst.startAnim(); },
      stopAnim:  function () { if (inst.stopAnim)  inst.stopAnim(); },
      setScrollProgress: setScrollProgress,
      resize:    function () { if (inst.resize) inst.resize(); }
    };
  }


  /* ──────────────────────────────────────────────
     Fixed header fade — 3 headers crossfade synced
     to canvas layer phases (after intro fades out)
     ────────────────────────────────────────────── */
  function initFixedHeaderFade(headers) {
    if (!headers || !headers.length) return;
    if (typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined') return;
    gsap.registerPlugin(ScrollTrigger);

    /* Prepare each header: hidden initially */
    headers.forEach(function (h) {
      if (!h) return;
      var label   = h.querySelector('.cr-label');
      var heading = h.querySelector('.cr-heading');
      gsap.set(h, { opacity: 0, willChange: 'opacity' });
      if (label)   gsap.set(label,   { opacity: 0, willChange: 'opacity' });
      if (heading)  gsap.set(heading, { opacity: 0, y: 20, willChange: 'opacity, transform' });
    });

    function staggerIn(header) {
      var label   = header.querySelector('.cr-label');
      var heading = header.querySelector('.cr-heading');
      gsap.to(header, { opacity: 1, duration: 0.2, ease: 'power1.out' });
      if (label) gsap.to(label, { opacity: 1, duration: 0.2, ease: 'power1.out' });
      if (heading) gsap.to(heading, {
        opacity: 1, y: 0, duration: 0.2, delay: 0.15,
        ease: 'power2.out',
        onComplete: function () { heading.style.willChange = 'auto'; }
      });
    }

    function fadeOut(header) {
      var label   = header.querySelector('.cr-label');
      var heading = header.querySelector('.cr-heading');
      gsap.to(header, { opacity: 0, duration: 0.2, ease: 'power1.in' });
      if (label) gsap.to(label, { opacity: 0, duration: 0.2, ease: 'power1.in' });
      if (heading) gsap.to(heading, { opacity: 0, y: 20, duration: 0.2, ease: 'power1.in' });
    }

    function resetHidden(header) {
      var label   = header.querySelector('.cr-label');
      var heading = header.querySelector('.cr-heading');
      gsap.set(header, { opacity: 0 });
      if (label)   gsap.set(label,   { opacity: 0 });
      if (heading)  gsap.set(heading, { opacity: 0, y: 20 });
    }

    /* Phase boundaries in overall scroll progress (matches PIN_END = +=500%):
       Intro: 0 → 0.20 (no headers)
       Layer 1: 0.20 → ~0.505  → header 1 (switches at transition midpoint)
       Layer 2: ~0.505 → ~0.775 → header 2
       Layer 3: ~0.775 → 1.00   → header 3
    */
    var phases = [
      { start: INTRO_END,  end: PHASE1_END },   // header 1
      { start: PHASE1_END, end: PHASE2_END },   // header 2
      { start: PHASE2_END, end: 1.0 }           // header 3
    ];

    var activeHeader = -1;

    /* Called from the pinned scroll's onUpdate to sync header switches */
    function updateHeaders(progress) {
      var newActive = -1;
      for (var i = 0; i < phases.length; i++) {
        if (progress >= phases[i].start && progress < phases[i].end) {
          newActive = i;
          break;
        }
      }
      /* Handle the very end (progress === 1) */
      if (progress >= 1) newActive = 2;

      if (newActive === activeHeader) return;

      /* Fade out previous header */
      if (activeHeader >= 0 && activeHeader < headers.length && headers[activeHeader]) {
        fadeOut(headers[activeHeader]);
      }

      /* Fade in new header */
      if (newActive >= 0 && newActive < headers.length && headers[newActive]) {
        staggerIn(headers[newActive]);
      }

      activeHeader = newActive;
    }

    /* Reset all headers to hidden (when section leaves) */
    function resetAll() {
      activeHeader = -1;
      headers.forEach(function (h) { if (h) resetHidden(h); });
    }

    return { updateHeaders: updateHeaders, resetAll: resetAll };
  }


  /* ──────────────────────────────────────────────
     Intro stagger: slide+fade for logo, heading,
     partner, carousel — then fade all out before
     canvas layers take over
     ────────────────────────────────────────────── */
  function initIntroStagger(introEl) {
    var items = [
      introEl.querySelector('.cr-logo'),
      introEl.querySelector('.cr-about-heading'),
      introEl.querySelector('.cr-partner'),
      introEl.querySelector('.cr-carousel')
    ].filter(Boolean);

    if (!items.length) return;

    /* Set initial state: invisible + shifted down */
    gsap.set(items, { opacity: 0, y: 30, willChange: 'transform, opacity' });
  }


  /* ──────────────────────────────────────────────
     3. Pinned scroll orchestrator — smooth scroll-linked
     Lerps scroll progress for buttery feel, routes per-phase
     progress to each layer so animations complete fully.
     Includes intro stagger phase before canvas layers.
     ────────────────────────────────────────────── */
  function initPinnedScroll(section, layers, instances, headerCtrl) {
    if (typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined') return;
    gsap.registerPlugin(ScrollTrigger);

    var introEl   = section.querySelector('.cr-intro');
    var paragraph = section.querySelector('.cr-paragraph');
    var track     = section.querySelector('.bx-hscroll__track');

    var introItems = introEl ? [
      introEl.querySelector('.cr-logo'),
      introEl.querySelector('.cr-about-heading'),
      introEl.querySelector('.cr-partner'),
      introEl.querySelector('.cr-carousel')
    ].filter(Boolean) : [];

    /* Smooth interpolation state */
    var targetProgress = 0;
    var smoothProgress = 0;
    var LERP = 0.10;
    var tickerActive = false;
    var sectionActive = false;

    /* Intro state */
    var introRevealed = false;
    var INTRO_FADEOUT_START = 0.12;
    var INTRO_FADEOUT_END   = INTRO_END;

    /* Initial state: ALL layers hidden, paragraph hidden */
    layers.forEach(function (l) {
      if (l) l.style.opacity = '0';
    });
    if (track)     gsap.set(track, { xPercent: 0 });
    if (paragraph) gsap.set(paragraph, { opacity: 0 });

    /* ── Drive all animations from smoothed progress value ── */
    function driveAnimations(p) {

      /* ── INTRO PHASE: staggered reveal then fade-out ── */
      if (p > 0.01 && !introRevealed) {
        introRevealed = true;
        gsap.to(introItems, {
          opacity: 1, y: 0,
          duration: 0.8, ease: 'power3.out',
          stagger: 0.12
        });
      }

      /* Fade out intro elements before canvas phase */
      if (p >= INTRO_FADEOUT_START) {
        var introFade = clamp01((p - INTRO_FADEOUT_START) / (INTRO_FADEOUT_END - INTRO_FADEOUT_START));
        var introOpacity = 1 - easeInOut(introFade);
        introItems.forEach(function (el) {
          el.style.opacity = String(introOpacity);
        });
        if (introEl) introEl.style.pointerEvents = introOpacity > 0.01 ? '' : 'none';
      }

      /* ── CANVAS PHASE: sequential layers + scroll-scrubbed + text paging ── */
      if (p >= INTRO_END) {
        /* Show paragraph */
        if (paragraph) {
          var paraFade = clamp01((p - INTRO_END) / 0.03);
          paragraph.style.opacity = String(paraFade);
          paragraph.style.pointerEvents = paraFade > 0 ? 'auto' : 'none';
        }

        /* Sequential layer opacities (no crossfade) */
        var opacities = computeLayerOpacities(p);
        for (var i = 0; i < layers.length; i++) {
          if (!layers[i]) continue;
          layers[i].style.opacity = String(opacities[i]);
          layers[i].style.pointerEvents = opacities[i] > 0.5 ? 'auto' : 'none';
        }

        /* Per-layer local progress: animation fills 0→1 within its anim range,
           stays at 1 during hold and fade-out (last frame visible) */
        var p1 = clamp01((p - L1_ANIM_START) / (L1_ANIM_END - L1_ANIM_START));
        var p2 = clamp01((p - L2_FADE_IN_END) / (L2_ANIM_END - L2_FADE_IN_END));
        var p3 = clamp01((p - L3_FADE_IN_END) / (L3_ANIM_END - L3_FADE_IN_END));

        /* Drive scroll-linked layer animations (only when visible) */
        if (opacities[0] > 0.001 && instances[0] && instances[0].setScrollProgress) instances[0].setScrollProgress(p1);
        if (opacities[1] > 0.001 && instances[1] && instances[1].setScrollProgress) instances[1].setScrollProgress(p2);
        if (opacities[2] > 0.001 && instances[2] && instances[2].setScrollProgress) instances[2].setScrollProgress(p3);

        /* Start/stop rendering based on visibility */
        for (var j = 0; j < instances.length; j++) {
          if (!instances[j]) continue;
          if (opacities[j] > 0.01) {
            if (instances[j].startAnim) instances[j].startAnim();
          } else {
            if (instances[j].stopAnim) instances[j].stopAnim();
          }
        }

        /* Text paging */
        if (track) gsap.set(track, { xPercent: textTrackX(p) });

        /* Crossfade fixed headers (synced to layer phases) */
        if (headerCtrl) headerCtrl.updateHeaders(p);

      } else {
        /* Before canvas phase: layers off, paragraph hidden, headers hidden */
        if (headerCtrl) headerCtrl.resetAll();
        if (paragraph) {
          paragraph.style.opacity = '0';
          paragraph.style.pointerEvents = 'none';
        }
        if (track) gsap.set(track, { xPercent: 0 });

        for (var k = 0; k < layers.length; k++) {
          if (!layers[k]) continue;
          layers[k].style.opacity = '0';
          layers[k].style.pointerEvents = 'none';
          if (instances[k] && instances[k].stopAnim) instances[k].stopAnim();
        }
      }
    }

    /* ── GSAP ticker-based smooth interpolation ── */
    function onTick() {
      var diff = targetProgress - smoothProgress;
      if (Math.abs(diff) > 0.0001) {
        smoothProgress += diff * LERP;
        driveAnimations(smoothProgress);
      } else if (!sectionActive) {
        /* Section out of view and animation settled — clean up */
        driveAnimations(smoothProgress);
        stopTicker();
        instances.forEach(function (inst) { if (inst && inst.stopAnim) inst.stopAnim(); });
      }
    }

    function startTicker() {
      if (!tickerActive) {
        tickerActive = true;
        gsap.ticker.add(onTick);
      }
    }

    function stopTicker() {
      if (tickerActive) {
        tickerActive = false;
        gsap.ticker.remove(onTick);
      }
    }

    ScrollTrigger.create({
      trigger: section,
      start: 'top top',
      end: PIN_END,
      pin: true,
      pinSpacing: true,
      anticipatePin: 1,
      invalidateOnRefresh: true,
      onEnter: function () {
        sectionActive = true;
        startTicker();
      },
      onLeave: function () {
        sectionActive = false;
        if (paragraph) gsap.to(paragraph, { opacity: 0, duration: 0.3 });
        if (headerCtrl) headerCtrl.resetAll();
        targetProgress = 1;
      },
      onEnterBack: function () {
        sectionActive = true;
        startTicker();
      },
      onLeaveBack: function () {
        sectionActive = false;
        if (paragraph) gsap.to(paragraph, { opacity: 0, duration: 0.3 });
        if (headerCtrl) headerCtrl.resetAll();
        targetProgress = 0;
        /* Reset intro for re-entry */
        introRevealed = false;
        gsap.set(introItems, { opacity: 0, y: 30 });
        if (introEl) introEl.style.pointerEvents = '';
      },
      onUpdate: function (self) {
        targetProgress = self.progress;
      }
    });
  }


  /* ──────────────────────────────────────────────
     PUBLIC init()
     ────────────────────────────────────────────── */
  function init() {
    if (typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined') return;
    gsap.registerPlugin(ScrollTrigger);

    var section = document.getElementById('credenciales');
    if (!section) return;

    /* Logo carousel */
    initLogoCarousel(section);

    /* Intro stagger setup */
    var introEl = section.querySelector('.cr-intro');
    if (introEl) initIntroStagger(introEl);

    /* Collect the 3 layers */
    var layer1 = section.querySelector('.cr-shape-layer--seq1');
    var layer2 = section.querySelector('.cr-shape-layer--seq2');
    var layer3 = section.querySelector('.cr-shape-layer--wave');
    var layers = [layer1, layer2, layer3];

    /* Init widget instances */
    var inst1 = layer1 ? initImageSequenceLayer(layer1) : null;
    var inst2 = layer2 ? initImageSequenceLayer(layer2) : null;
    var inst3 = layer3 ? initWaveTheaterLayer(layer3)   : null;
    var instances = [inst1, inst2, inst3];
    _instances = instances;

    /* Fixed headers (one per canvas layer, crossfaded by scroll) */
    var crHeaders = [
      section.querySelector('.cr-header--1'),
      section.querySelector('.cr-header--2'),
      section.querySelector('.cr-header--3')
    ];
    var headerCtrl = initFixedHeaderFade(crHeaders);

    /* Pinned scroll orchestrator */
    initPinnedScroll(section, layers, instances, headerCtrl);
  }

  function resize() {
    _instances.forEach(function (inst) {
      if (inst && inst.resize) inst.resize();
    });
  }

  return { init: init, resize: resize };
})();