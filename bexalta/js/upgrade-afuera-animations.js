/* ================================================================
   upgrade-afuera-animations.js — T5.5 (Sequential, no overlap)
   Single pinned section with 3 sequential layers:
     Layer 1: bx-image-sequence (gliding_field) — scroll-driven
     Layer 2: bx-image-sequence (audi) — scroll-driven
     Layer 3: bx-warehouse-coin-space (Three.js) — scroll-driven
   Opacity transitions are SEQUENTIAL — each layer fades in, holds
   at full opacity for appreciation, then fades out before the next
   layer fades in. No crossfade overlap between layers.
   Layer 3 (particles) keeps rendering until the section container
   is completely out of the viewport.
   Deps: GSAP 3.12.5, ScrollTrigger, Three.js r128
   ================================================================ */

window.BxUpgradeAfueraAnimations = (function () {
  'use strict';

  var _instances = [];

  /* ── Constants (sequential, non-overlapping with hold) ───────────── */
  var PIN_END = '+=500%';     // longer pin = more scroll room to appreciate each anim

  /* Phase layout across 0→1 scroll progress:
     Layer 1: fadeIn → hold (play webP) → fadeOut
     Layer 2: fadeIn → hold (play webP) → fadeOut
     Layer 3: fadeIn → hold (particles keep running until section exits)

     Each fade is ~4% of scroll, hold periods are generous.
  */
  var FADE_DUR   = 0.04;     // duration of each fade-in / fade-out

  // Layer 1: 0.00 → 0.30  (hold from 0.00 to 0.26, fade out 0.26→0.30)
  var L1_START   = 0.00;
  var L1_HOLD    = 0.26;     // start fading out
  var L1_END     = 0.30;     // fully gone

  // Layer 2: 0.30 → 0.62  (fade in 0.30→0.34, hold 0.34→0.58, fade out 0.58→0.62)
  var L2_START   = 0.30;
  var L2_IN      = 0.34;     // fully visible
  var L2_HOLD    = 0.58;     // start fading out
  var L2_END     = 0.62;     // fully gone

  // Layer 3: 0.62 → 1.00  (fade in 0.62→0.66, then stays visible forever)
  var L3_START   = 0.62;
  var L3_IN      = 0.66;     // fully visible — stays until section exits viewport

  // Legacy aliases used by textTrackX and applyWidgetScrollProgress
  var PHASE1_END = L1_END;
  var T1_END     = L2_IN;
  var PHASE2_END = L2_END;
  var T2_END     = L3_IN;

  function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
  function easeInOut(t) { var x = clamp01(t); return x * x * (3 - 2 * x); }

  /* ── Text track: pages advance in the gap between phases ────────── */
  function textTrackX(progress) {
    var p = clamp01(progress);
    if (p < PHASE1_END) return 0;
    if (p < T1_END) {
      return -100 * easeInOut((p - PHASE1_END) / (T1_END - PHASE1_END));
    }
    if (p < PHASE2_END) return -100;
    if (p < T2_END) {
      return -100 - 100 * easeInOut((p - PHASE2_END) / (T2_END - PHASE2_END));
    }
    return -200;
  }

  /* ── Sequential layer opacities (no overlap) ────────────────────── */
  function computeLayerOpacities(progress) {
    var p = clamp01(progress);
    var o0 = 0, o1 = 0, o2 = 0;

    // Layer 1: visible from L1_START, fades out L1_HOLD→L1_END
    if (p < L1_HOLD) {
      o0 = 1;
    } else if (p < L1_END) {
      o0 = 1 - easeInOut((p - L1_HOLD) / (L1_END - L1_HOLD));
    }

    // Layer 2: fades in L2_START→L2_IN, holds, fades out L2_HOLD→L2_END
    if (p >= L2_START && p < L2_IN) {
      o1 = easeInOut((p - L2_START) / (L2_IN - L2_START));
    } else if (p >= L2_IN && p < L2_HOLD) {
      o1 = 1;
    } else if (p >= L2_HOLD && p < L2_END) {
      o1 = 1 - easeInOut((p - L2_HOLD) / (L2_END - L2_HOLD));
    }

    // Layer 3: fades in L3_START→L3_IN, then stays at 1 forever
    if (p >= L3_START && p < L3_IN) {
      o2 = easeInOut((p - L3_START) / (L3_IN - L3_START));
    } else if (p >= L3_IN) {
      o2 = 1;
    }

    return [o0, o1, o2];
  }

  /* ── Normalize progress within a subrange ────────────────────────── */
  function normalizeRange(progress, start, end) {
    if (end <= start) return progress >= end ? 1 : 0;
    return clamp01((progress - start) / (end - start));
  }

  /* ── Per-layer scroll progress: each fills 0→1 in its own range ── */
  function applyWidgetScrollProgress(instances, progress) {
    var p = clamp01(progress);
    var ranges = [
      [0, PHASE1_END],
      [T1_END, PHASE2_END],
      [T2_END, 1]
    ];

    for (var i = 0; i < instances.length; i++) {
      var inst = instances[i];
      if (!inst || typeof inst.setScrollProgress !== 'function') continue;
      inst.setScrollProgress(normalizeRange(p, ranges[i][0], ranges[i][1]));
    }
  }

  /* ── Apply widget blend: show/hide layers & start/stop renderers ── */
  function applyWidgetBlend(layers, instances, progress) {
    var opacities = computeLayerOpacities(progress);

    for (var i = 0; i < layers.length; i++) {
      if (!layers[i]) continue;
      layers[i].style.opacity = String(opacities[i]);
    }

    for (var j = 0; j < instances.length; j++) {
      if (!instances[j]) continue;
      if (opacities[j] > 0.001) {
        if (instances[j].startAnim) instances[j].startAnim();
      } else {
        if (instances[j].stopAnim) instances[j].stopAnim();
      }
    }
  }


  /* ──────────────────────────────────────────────
     1. Image Sequence Layer — scroll-driven
     Canvas 2D with contain/letterbox, frame driven by scroll progress
     ────────────────────────────────────────────── */
  function initImageSequenceLayer(layerEl) {
    var canvas = layerEl.querySelector('canvas');
    if (!canvas) return null;
    var ctx = canvas.getContext('2d');

    var folder = layerEl.dataset.folder || './sequence/';
    var prefix = layerEl.dataset.prefix || 'frame_';
    var suffix = layerEl.dataset.suffix || '.webp';
    var FRAME_COUNT = parseInt(layerEl.dataset.frameCount) || 60;
    var PAD = parseInt(layerEl.dataset.pad) || 4;
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
      var cw = Math.round(rect.width * Math.min(window.devicePixelRatio, 2));
      var ch = Math.round(rect.height * Math.min(window.devicePixelRatio, 2));
      if (canvas.width !== cw || canvas.height !== ch) {
        canvas.width = cw;
        canvas.height = ch;
      }

      var imgAspect = img.naturalWidth / img.naturalHeight;
      var canvasAspect = cw / ch;
      var dw, dh, dx, dy;
      if (imgAspect > canvasAspect) {
        dw = cw;
        dh = cw / imgAspect;
        dx = 0;
        dy = (ch - dh) / 2;
      } else {
        dh = ch;
        dw = ch * imgAspect;
        dx = (cw - dw) / 2;
        dy = 0;
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
     2. Warehouse Coin Space Layer (Three.js)
     Scroll-driven: timeline scrubbed by scroll progress, RAF renders
     ────────────────────────────────────────────── */
  function initWarehouseCoinSpaceLayer(layerEl) {
    var canvas = layerEl.querySelector('canvas');
    if (!canvas || typeof THREE === 'undefined') return null;

    var N_WAREHOUSE = 20000;
    var N_COIN = 12000;
    var N_STARS_1 = 60000;
    var N_STARS_2 = 80000;
    var N_SHOOT = 300;
    var N_STARS = N_STARS_1 + N_STARS_2 + N_SHOOT;
    var N_CS = N_COIN + N_STARS;

    var COIN_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 110.05 110.05"><defs><style>.cls-1{fill:#fff}</style></defs><g><path class="cls-1" d="M99.47,21.16v-10.58h-10.59V0H21.17v10.58h-10.59v10.58H0v67.72h10.58v10.58h10.59v10.59h67.71v-10.59h10.59v-10.58h10.58V21.16h-10.58ZM50.87,7.1h13v13h-13V7.1ZM86.73,54.95h-10.56v4.64h10.56v27.04h-10.56v10.56H28.01V27.91h48.16v10.56h10.56v16.48Z"/><g><rect class="cls-1" x="44.49" y="65.51" width="25.77" height="15.21"/><rect class="cls-1" x="44.49" y="44.39" width="25.77" height="4.64"/></g></g></svg>';

    function parseCoinSVG(svgStr, numPoints, scale, callback) {
      var sz = 256, cv = document.createElement('canvas');
      cv.width = sz; cv.height = sz;
      var c = cv.getContext('2d');
      var blob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' });
      var url = URL.createObjectURL(blob);
      var img = new Image();
      img.onload = function () {
        c.drawImage(img, 0, 0, sz, sz); URL.revokeObjectURL(url);
        var id = c.getImageData(0, 0, sz, sz), px = id.data, valid = [];
        for (var y = 0; y < sz; y++) for (var x = 0; x < sz; x++) { var i = (y * sz + x) * 4; if (px[i + 3] > 128) valid.push({ x: x, y: y }); }
        var pts = [];
        for (var i = 0; i < numPoints; i++) {
          if (valid.length > 0) { var p = valid[Math.floor(Math.random() * valid.length)]; pts.push({ x: ((p.x / sz) - 0.5) * scale, y: (0.5 - (p.y / sz)) * scale, z: (Math.random() - 0.5) * scale * 0.08 }); }
          else pts.push({ x: (Math.random() - 0.5) * scale, y: (Math.random() - 0.5) * scale, z: (Math.random() - 0.5) * 0.2 });
        }
        callback(pts);
      };
      img.onerror = function () {
        URL.revokeObjectURL(url); var pts = [];
        for (var i = 0; i < numPoints; i++) pts.push({ x: (Math.random() - 0.5) * scale, y: (Math.random() - 0.5) * scale, z: (Math.random() - 0.5) * 0.2 });
        callback(pts);
      };
      img.src = url;
    }

    function generateWarehouse(count) {
      var W = 5.0, H = 2.2, D = 3.0, cx = 0, cy = -4.2, roofPeak = 0.7, pts = [];
      for (var i = 0; i < count; i++) {
        var t = i / count, x, y, z;
        if (t < 0.25) {
          var edge = Math.floor(t / 0.0625), et = (t % 0.0625) / 0.0625;
          var ex = (edge % 2 === 0 ? -1 : 1) * W / 2, ez = (edge < 2 ? -1 : 1) * D / 2;
          x = cx + ex + (Math.random() - 0.5) * 0.05; y = cy + et * H + (Math.random() - 0.5) * 0.05; z = ez + (Math.random() - 0.5) * 0.05;
        } else if (t < 0.42) {
          var wt = (t - 0.25) / 0.17, face = Math.floor(wt * 4), u = Math.random(), v = Math.random();
          if (face < 2) { x = cx + (u - 0.5) * W; y = cy + v * H; z = (face === 0 ? -1 : 1) * D / 2 + (Math.random() - 0.5) * 0.06; }
          else { z = (u - 0.5) * D; y = cy + v * H; x = cx + (face === 2 ? -1 : 1) * W / 2 + (Math.random() - 0.5) * 0.06; }
        } else if (t < 0.55) {
          var ft = (t - 0.42) / 0.13;
          if (ft < 0.5) { var li = Math.floor(ft * 10); z = (li / 5 - 1) * D / 2; x = cx + (Math.random() - 0.5) * W; }
          else { var li2 = Math.floor((ft - 0.5) * 14); x = cx + (li2 / 7 - 1) * W / 2; z = (Math.random() - 0.5) * D; }
          y = cy + (Math.random() - 0.5) * 0.02;
        } else if (t < 0.72) {
          z = (Math.random() - 0.5) * D; var side = Math.random() > 0.5 ? 1 : -1, rx = Math.random();
          x = cx + side * rx * W / 2; y = cy + H + roofPeak * (1 - Math.abs(x - cx) / (W / 2)) + (Math.random() - 0.5) * 0.04;
        } else if (t < 0.82) {
          var rrt = (t - 0.72) / 0.10;
          if (rrt < 0.4) { x = cx + (Math.random() - 0.5) * 0.08; z = (Math.random() - 0.5) * D; y = cy + H + roofPeak + (Math.random() - 0.5) * 0.04; }
          else { var s2 = Math.random() > 0.5 ? 1 : -1; x = cx + s2 * W / 2 + (Math.random() - 0.5) * 0.06; z = (Math.random() - 0.5) * D; y = cy + H + (Math.random() - 0.5) * 0.04; }
        } else if (t < 0.90) {
          var dtt = (t - 0.82) / 0.08, bay = Math.floor(dtt * 3), bayCx = cx + (bay - 1) * W / 3;
          var doorW = W / 3 * 0.7, doorH = H * 0.7; x = bayCx + (Math.random() - 0.5) * doorW; y = cy + Math.random() * doorH; z = -D / 2 + (Math.random() - 0.5) * 0.04;
          if (Math.random() < 0.3) { y = cy + (Math.floor(Math.random() * 8) / 8) * doorH; x = bayCx + (Math.random() - 0.5) * doorW; }
        } else {
          var ct = (t - 0.90) / 0.10, colIdx = Math.floor(ct * 8), colX, colZ;
          if (colIdx < 4) { colX = cx + (colIdx / 3 - 0.5) * W * 0.8; colZ = -D / 2; }
          else { colX = cx + ((colIdx - 4) / 3 - 0.5) * W * 0.6; colZ = (Math.random() - 0.5) * D * 0.6; }
          x = colX + (Math.random() - 0.5) * 0.12; y = cy + Math.random() * H; z = colZ + (Math.random() - 0.5) * 0.12;
        }
        pts.push({ x: x, y: y, z: z });
      }
      return pts;
    }

    function generateStars(count, radius) {
      var pts = [], PHI = (1 + Math.sqrt(5)) / 2;
      for (var i = 0; i < count; i++) {
        var t = i / count, theta = 2 * Math.PI * i / PHI, phi = Math.acos(1 - 2 * t);
        var r = radius * (0.3 + Math.random() * 0.7);
        pts.push({ x: r * Math.sin(phi) * Math.cos(theta), y: r * Math.sin(phi) * Math.sin(theta), z: r * Math.cos(phi) });
      }
      return pts;
    }

    var VERT = [
      'attribute float size;',
      'attribute float aRandom;',
      'attribute float aSpeed;',
      'attribute float aGroup;',
      'attribute float aAlpha;',
      'varying vec3 vColor;',
      'varying float vAlpha;',
      'varying float vGroup;',
      'uniform float uTime;',
      'uniform float uMorphProgress;',
      'uniform float uGlowBoost;',
      'uniform float uBoostStretch;',
      'uniform float uMotionBlur;',
      'uniform float uStarRush;',
      'void main(){',
      '  vColor=color;',
      '  vGroup=aGroup;',
      '  vec3 p=position;',
      '  float turb=(1.0-uMorphProgress*0.7);',
      '  float t2=uTime*0.4+aRandom*6.2831;',
      '  float coinDamp=(aGroup>0.5&&aGroup<1.5)?0.25:1.0;',
      '  p.x+=sin(t2*aSpeed)*0.01*turb*coinDamp;',
      '  p.y+=cos(t2*0.7*aSpeed)*0.01*turb*coinDamp;',
      '  p.z+=sin(t2*0.5+aRandom*3.14)*0.006*turb*coinDamp;',
      '  if(uBoostStretch>0.0 && uStarRush<0.01 && aGroup>1.5 && aGroup<2.5){',
      '    p.y-=uBoostStretch*aRandom*4.0;',
      '    p.x+=uBoostStretch*sin(aRandom*12.0)*0.6;',
      '    p.z+=uBoostStretch*cos(aRandom*8.7)*0.3;',
      '  }',
      '  if(uStarRush>0.0 && aGroup>1.5){',
      '    float rushSpeed=0.4+aRandom*0.6;',
      '    float phase=fract(uTime*rushSpeed+aRandom*5.17);',
      '    float rushDist=phase*80.0*uStarRush;',
      '    p.y-=rushDist;',
      '    p.x+=phase*sin(aRandom*17.3)*3.0*uStarRush;',
      '    p.z+=phase*cos(aRandom*23.1)*1.5*uStarRush;',
      '  }',
      '  if(aGroup>2.5 && uStarRush<0.01){',
      '    float speed=0.2+aRandom*0.3;',
      '    float shootPhase=fract(uTime*speed+aRandom*7.13);',
      '    p.y-=shootPhase*40.0;',
      '    p.x+=shootPhase*sin(aRandom*17.3)*6.0;',
      '    p.z+=shootPhase*cos(aRandom*23.1)*3.0;',
      '  }',
      '  vec4 mv=modelViewMatrix*vec4(p,1.0);',
      '  gl_Position=projectionMatrix*mv;',
      '  float sa=size*(180.0/-mv.z);',
      '  float twinkle=(aGroup>1.5)?(0.5+0.5*sin(uTime*2.0+aRandom*30.0)):1.0;',
      '  float shimmer=(aGroup>1.5)?0.85+0.15*sin(uTime*4.0+aRandom*50.0):1.0;',
      '  float glowMul=1.0+uGlowBoost*(aGroup>0.5&&aGroup<1.5?1.0:0.0);',
      '  float boostSz=1.0+uBoostStretch*0.4*(aGroup>1.5?1.0:0.0);',
      '  float blurSz=1.0+uMotionBlur*0.3*(aGroup>0.5&&aGroup<1.5?1.0:0.0);',
      '  gl_PointSize=clamp(sa*twinkle*shimmer*glowMul*boostSz*blurSz,0.1,18.0);',
      '  float dist=length(mv.xyz);',
      '  float baseAlpha=smoothstep(90.0,3.0,dist)*(0.3+0.5*aRandom)*twinkle*shimmer;',
      '  vAlpha=baseAlpha*aAlpha;',
      '}'
    ].join('\n');

    var FRAG = [
      'varying vec3 vColor;',
      'varying float vAlpha;',
      'varying float vGroup;',
      'uniform float uGlowBoost;',
      'uniform float uBoostStretch;',
      'uniform float uMotionBlur;',
      'uniform float uStarRush;',
      'void main(){',
      '  vec2 uv=gl_PointCoord-0.5;',
      '  float d=length(uv);',
      '  if(d>0.5)discard;',
      '  float streak=(vGroup>1.5)?1.0+uBoostStretch*2.5:1.0;',
      '  float rushStreak=(vGroup>1.5)?1.0+uStarRush*3.0:1.0;',
      '  float mblur=(vGroup>0.5&&vGroup<1.5)?1.0+uMotionBlur*0.5:1.0;',
      '  vec2 sUV=vec2(uv.x,uv.y*streak*rushStreak*mblur);',
      '  float ds=length(sUV);',
      '  float core=smoothstep(0.5,0.05,ds);',
      '  float glow=smoothstep(0.55,0.2,ds);',
      '  float glowMul=(vGroup>0.5&&vGroup<1.5)?1.0+uGlowBoost*0.6:1.0;',
      '  float shootBright=(vGroup>2.5)?2.0:1.0;',
      '  float alpha=(core*0.65+glow*0.3)*vAlpha*glowMul*shootBright;',
      '  gl_FragColor=vec4(vColor,alpha);',
      '}'
    ].join('\n');

    var r = layerEl.getBoundingClientRect();
    var renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: false, alpha: true, powerPreference: 'high-performance' });
    renderer.setSize(r.width, r.height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));

    var scene = new THREE.Scene();
    var camera = new THREE.PerspectiveCamera(55, r.width / r.height, 0.1, 200);

    var warehouseGroup = new THREE.Object3D();
    var coinStarGroup = new THREE.Object3D();
    scene.add(warehouseGroup);
    scene.add(coinStarGroup);

    /* WAREHOUSE particles */
    var wGeo = new THREE.BufferGeometry();
    var wPos = new Float32Array(N_WAREHOUSE * 3), wCol = new Float32Array(N_WAREHOUSE * 3);
    var wSzs = new Float32Array(N_WAREHOUSE), wBaseSzs = new Float32Array(N_WAREHOUSE), wRnd = new Float32Array(N_WAREHOUSE);
    var wSpd = new Float32Array(N_WAREHOUSE), wGrp = new Float32Array(N_WAREHOUSE);
    var wAlpha = new Float32Array(N_WAREHOUSE);
    var warehousePts = generateWarehouse(N_WAREHOUSE);
    var primaryCol = new THREE.Color('#a2c62e'), whiteCol = new THREE.Color('#e0e0e0');

    for (var i = 0; i < N_WAREHOUSE; i++) {
      var i3 = i * 3; wPos[i3] = warehousePts[i].x; wPos[i3 + 1] = warehousePts[i].y; wPos[i3 + 2] = warehousePts[i].z;
      wRnd[i] = Math.random(); var c = wRnd[i] < 0.15 ? primaryCol : whiteCol;
      wCol[i3] = c.r; wCol[i3 + 1] = c.g; wCol[i3 + 2] = c.b;
      var bs = 0.3 * (0.3 + Math.random() * 0.7); wBaseSzs[i] = bs; wSzs[i] = bs;
      wSpd[i] = 0.5 + Math.random() * 0.5; wGrp[i] = 0; wAlpha[i] = 1;
    }
    wGeo.setAttribute('position', new THREE.BufferAttribute(wPos, 3));
    wGeo.setAttribute('color', new THREE.BufferAttribute(wCol, 3));
    wGeo.setAttribute('size', new THREE.BufferAttribute(wSzs, 1));
    wGeo.setAttribute('aRandom', new THREE.BufferAttribute(wRnd, 1));
    wGeo.setAttribute('aSpeed', new THREE.BufferAttribute(wSpd, 1));
    wGeo.setAttribute('aGroup', new THREE.BufferAttribute(wGrp, 1));
    wGeo.setAttribute('aAlpha', new THREE.BufferAttribute(wAlpha, 1));

    var wMat = new THREE.ShaderMaterial({
      vertexShader: VERT, fragmentShader: FRAG,
      uniforms: { uTime: { value: 0 }, uMorphProgress: { value: 0.9 }, uGlowBoost: { value: 0 }, uBoostStretch: { value: 0 }, uMotionBlur: { value: 0 }, uStarRush: { value: 0 } },
      vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending
    });
    warehouseGroup.add(new THREE.Points(wGeo, wMat));

    /* COIN + STARS particles */
    var csGeo = new THREE.BufferGeometry();
    var csPos = new Float32Array(N_CS * 3), csTgt = new Float32Array(N_CS * 3);
    var csCol = new Float32Array(N_CS * 3), csTgtCol = new Float32Array(N_CS * 3);
    var csSzs = new Float32Array(N_CS), csBaseSzs = new Float32Array(N_CS);
    var csRnd = new Float32Array(N_CS), csSpd = new Float32Array(N_CS);
    var csGrp = new Float32Array(N_CS), csAlpha = new Float32Array(N_CS);

    var silverCol = new THREE.Color('#c0c0c0');
    var COIN_START_SCALE = 0.45;

    for (var i = 0; i < N_COIN; i++) {
      var i3 = i * 3; csPos[i3] = 0; csPos[i3 + 1] = 0; csPos[i3 + 2] = 0;
      csTgt[i3] = 0; csTgt[i3 + 1] = 0; csTgt[i3 + 2] = 0;
      csCol[i3] = silverCol.r; csCol[i3 + 1] = silverCol.g; csCol[i3 + 2] = silverCol.b;
      csTgtCol[i3] = silverCol.r; csTgtCol[i3 + 1] = silverCol.g; csTgtCol[i3 + 2] = silverCol.b;
      var bs = 0.22 * (0.4 + Math.random() * 0.6); csBaseSzs[i] = bs;
      csSzs[i] = bs * COIN_START_SCALE;
      csRnd[i] = Math.random(); csSpd[i] = 0.6 + Math.random() * 0.4; csGrp[i] = 1; csAlpha[i] = 1;
    }

    var starPts1 = generateStars(N_STARS_1, 50);
    for (var i = 0; i < N_STARS_1; i++) {
      var ci = N_COIN + i, i3 = ci * 3;
      csPos[i3] = starPts1[i].x; csPos[i3 + 1] = starPts1[i].y; csPos[i3 + 2] = starPts1[i].z;
      csTgt[i3] = csPos[i3]; csTgt[i3 + 1] = csPos[i3 + 1]; csTgt[i3 + 2] = csPos[i3 + 2];
      csCol[i3] = 0.8; csCol[i3 + 1] = 0.85; csCol[i3 + 2] = 0.95;
      csTgtCol[i3] = 0.8; csTgtCol[i3 + 1] = 0.85; csTgtCol[i3 + 2] = 0.95;
      csRnd[ci] = Math.random();
      csBaseSzs[ci] = 0.45 + csRnd[ci] * 0.80;
      csSzs[ci] = 0;
      csSpd[ci] = 0.3 + Math.random() * 0.4; csGrp[ci] = 2;
      csAlpha[ci] = 0.2 + csRnd[ci] * 0.3;
    }

    var starPts2 = generateStars(N_STARS_2, 65);
    for (var i = 0; i < N_STARS_2; i++) {
      var ci = N_COIN + N_STARS_1 + i, i3 = ci * 3;
      csPos[i3] = starPts2[i].x; csPos[i3 + 1] = starPts2[i].y; csPos[i3 + 2] = starPts2[i].z;
      csTgt[i3] = csPos[i3]; csTgt[i3 + 1] = csPos[i3 + 1]; csTgt[i3 + 2] = csPos[i3 + 2];
      csCol[i3] = 0.85; csCol[i3 + 1] = 0.88; csCol[i3 + 2] = 0.98;
      csTgtCol[i3] = 0.85; csTgtCol[i3 + 1] = 0.88; csTgtCol[i3 + 2] = 0.98;
      csRnd[ci] = Math.random();
      csBaseSzs[ci] = 0.50 + csRnd[ci] * 0.90;
      csSzs[ci] = 0;
      csSpd[ci] = 0.3 + Math.random() * 0.4; csGrp[ci] = 2;
      csAlpha[ci] = 0.3 + csRnd[ci] * 0.7;
    }

    var shootPts = generateStars(N_SHOOT, 40);
    for (var i = 0; i < N_SHOOT; i++) {
      var ci = N_COIN + N_STARS_1 + N_STARS_2 + i, i3 = ci * 3;
      csPos[i3] = shootPts[i].x; csPos[i3 + 1] = shootPts[i].y; csPos[i3 + 2] = shootPts[i].z;
      csTgt[i3] = csPos[i3]; csTgt[i3 + 1] = csPos[i3 + 1]; csTgt[i3 + 2] = csPos[i3 + 2];
      csCol[i3] = 1.0; csCol[i3 + 1] = 0.95; csCol[i3 + 2] = 0.8;
      csTgtCol[i3] = 1.0; csTgtCol[i3 + 1] = 0.95; csTgtCol[i3 + 2] = 0.8;
      csRnd[ci] = Math.random();
      csBaseSzs[ci] = 0.60 + csRnd[ci] * 0.80;
      csSzs[ci] = 0;
      csSpd[ci] = 0.5 + Math.random() * 0.5; csGrp[ci] = 3;
      csAlpha[ci] = 0.6 + csRnd[ci] * 0.4;
    }

    csGeo.setAttribute('position', new THREE.BufferAttribute(csPos, 3));
    csGeo.setAttribute('color', new THREE.BufferAttribute(csCol, 3));
    csGeo.setAttribute('size', new THREE.BufferAttribute(csSzs, 1));
    csGeo.setAttribute('aRandom', new THREE.BufferAttribute(csRnd, 1));
    csGeo.setAttribute('aSpeed', new THREE.BufferAttribute(csSpd, 1));
    csGeo.setAttribute('aGroup', new THREE.BufferAttribute(csGrp, 1));
    csGeo.setAttribute('aAlpha', new THREE.BufferAttribute(csAlpha, 1));

    var csMat = new THREE.ShaderMaterial({
      vertexShader: VERT, fragmentShader: FRAG,
      uniforms: { uTime: { value: 0 }, uMorphProgress: { value: 0.9 }, uGlowBoost: { value: 0 }, uBoostStretch: { value: 0 }, uMotionBlur: { value: 0 }, uStarRush: { value: 0 } },
      vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending
    });
    coinStarGroup.add(new THREE.Points(csGeo, csMat));

    /* STATE */
    var time = 0, lastFrame = 0, destroyed = false, rafId = null;
    var coinReady = false, coinLocalPts = null;

    var warehouseState = { opacity: 1, rotSpeed: 0.3, dropY: 0 };
    var coinScaleState = { val: COIN_START_SCALE };
    var coinShiftY = { val: 0 };
    var starVis = { f1: 0, f2: 0, shoot: 0 };
    var colorPhase = { val: 0 };
    var glowState = { val: 0 };
    var boostStretch = { val: 0 };
    var motionBlur = { val: 0 };
    var starRush = { val: 0 };
    var coinSpin = { val: 0 };
    var coinSpinAngle = 0;
    var starShimmer = { val: 0 };
    var camState = { y: -1.5, z: 14 };

    var SILVER = new THREE.Color('#c0c0c0');
    var PLATINUM = new THREE.Color('#e5e4e2'), PLATINUM_B = new THREE.Color('#f8f8ff');
    var GOLD = new THREE.Color('#ffd700'), GOLD_B = new THREE.Color('#fff4b0');

    function showField1(p) { for (var i = 0; i < N_STARS_1; i++) { var ci = N_COIN + i; csSzs[ci] = csBaseSzs[ci] * Math.min(1, p); } csGeo.attributes.size.needsUpdate = true; }
    function showField2(p) { for (var i = 0; i < N_STARS_2; i++) { var ci = N_COIN + N_STARS_1 + i; csSzs[ci] = csBaseSzs[ci] * Math.min(1, p); } csGeo.attributes.size.needsUpdate = true; }
    function showShootingStars(p) { for (var i = 0; i < N_SHOOT; i++) { var ci = N_COIN + N_STARS_1 + N_STARS_2 + i; csSzs[ci] = csBaseSzs[ci] * Math.min(1, p); } csGeo.attributes.size.needsUpdate = true; }

    var wcsTimeline = null;

    parseCoinSVG(COIN_SVG, N_COIN, 2.0, function (pts) {
      coinLocalPts = pts;
      for (var i = 0; i < N_COIN; i++) {
        var i3 = i * 3;
        csTgt[i3] = pts[i].x * COIN_START_SCALE;
        csTgt[i3 + 1] = pts[i].y * COIN_START_SCALE;
        csTgt[i3 + 2] = pts[i].z * COIN_START_SCALE;
      }
      coinReady = true;
      buildTimeline();
    });

    function buildTimeline() {
      var tl = gsap.timeline({ paused: true });
      tl.to(camState, { y: 0, z: 6.5, duration: 4, ease: 'power2.inOut' }, 3);
      tl.to(warehouseState, { dropY: -8, duration: 4, ease: 'power2.in' }, 3);
      tl.to(warehouseState, { opacity: 0, duration: 3, ease: 'power2.in' }, 3.5);
      tl.to(coinScaleState, { val: 1.0, duration: 4, ease: 'power2.out' }, 3);
      tl.to(coinShiftY, { val: -0.5, duration: 3, ease: 'power2.in' }, 7);
      tl.to(camState, { y: -0.5, duration: 3, ease: 'power2.in' }, 7);
      tl.to(coinShiftY, { val: 0, duration: 3, ease: 'power2.out' }, 10);
      tl.to(camState, { y: 0, duration: 3, ease: 'power2.out' }, 10);
      tl.to(motionBlur, { val: 1.2, duration: 2, ease: 'power2.in' }, 7);
      tl.to(motionBlur, { val: 0, duration: 2.5, ease: 'power2.out' }, 11);
      tl.to(starVis, { f1: 1, duration: 3, ease: 'power1.out', onUpdate: function () { showField1(starVis.f1); } }, 8.5);
      tl.to(colorPhase, {
        val: 1, duration: 5, ease: 'power2.inOut',
        onUpdate: function () {
          var p = Math.min(colorPhase.val, 1);
          for (var i = 0; i < N_COIN; i++) {
            var i3 = i * 3, bright = csRnd[i] < 0.2;
            var from = SILVER, to = bright ? PLATINUM_B : PLATINUM;
            csTgtCol[i3] = from.r + (to.r - from.r) * p;
            csTgtCol[i3 + 1] = from.g + (to.g - from.g) * p;
            csTgtCol[i3 + 2] = from.b + (to.b - from.b) * p;
          }
        }
      }, 7);
      tl.to(glowState, { val: 0.6, duration: 4, ease: 'power2.out' }, 8);
      tl.to(boostStretch, { val: 0.7, duration: 2, ease: 'power2.in' }, 7.5);
      tl.to(boostStretch, { val: 0, duration: 3, ease: 'power2.out' }, 10.5);
      tl.to(glowState, { val: 0.9, duration: 1.5, ease: 'power2.out' }, 14);
      tl.to(coinShiftY, { val: -0.4, duration: 2, ease: 'power2.in' }, 15.5);
      tl.to(camState, { y: -0.35, duration: 2, ease: 'power2.in' }, 15.5);
      tl.to(coinShiftY, { val: 0, duration: 2.5, ease: 'power2.out' }, 17.5);
      tl.to(camState, { y: 0, duration: 2.5, ease: 'power2.out' }, 17.5);
      tl.to(starVis, { f2: 1, duration: 1.5, ease: 'power1.out', onUpdate: function () { showField2(starVis.f2); } }, 15.5);
      tl.to(starRush, { val: 1.0, duration: 1, ease: 'power3.in' }, 15.5);
      tl.to(starRush, { val: 0, duration: 3, ease: 'power2.out' }, 18.5);
      tl.to(motionBlur, { val: 1.5, duration: 1, ease: 'power3.in' }, 15.5);
      tl.to(motionBlur, { val: 0, duration: 2.5, ease: 'power2.out' }, 18.5);
      tl.to(colorPhase, {
        val: 2, duration: 4, ease: 'power2.inOut',
        onUpdate: function () {
          var p = colorPhase.val; if (p > 1) {
            var t = p - 1;
            for (var i = 0; i < N_COIN; i++) {
              var i3 = i * 3, bright = csRnd[i] < 0.25;
              var from = bright ? PLATINUM_B : PLATINUM, to = bright ? GOLD_B : GOLD;
              csTgtCol[i3] = from.r + (to.r - from.r) * t;
              csTgtCol[i3 + 1] = from.g + (to.g - from.g) * t;
              csTgtCol[i3 + 2] = from.b + (to.b - from.b) * t;
            }
          }
        }
      }, 15.5);
      tl.to(camState, { z: 5.8, duration: 4, ease: 'power2.inOut' }, 15.5);
      tl.to(coinShiftY, { val: 0, duration: 1.5, ease: 'power2.out' }, 20);
      tl.to(glowState, { val: 0.4, duration: 2, ease: 'power2.out' }, 20);
      tl.to(coinSpin, { val: 1.2, duration: 3, ease: 'power2.inOut' }, 20);
      tl.to(camState, { z: 6.2, duration: 3, ease: 'power1.inOut' }, 20);
      tl.to(starShimmer, { val: 1, duration: 2, ease: 'power2.out' }, 20);
      tl.to(starVis, { shoot: 1, duration: 2, ease: 'power1.out', onUpdate: function () { showShootingStars(starVis.shoot); } }, 21);
      tl.to(starVis, { f1: 1.2, duration: 2, ease: 'power1.out', onUpdate: function () { showField1(starVis.f1); } }, 20);
      wcsTimeline = tl;
    }

    function tick(now) {
      if (destroyed) return;
      rafId = requestAnimationFrame(tick);
      if (!now) now = performance.now();
      var dt = lastFrame ? Math.min((now - lastFrame) / 1000, 0.05) : 0.016;
      lastFrame = now; time += dt;

      wMat.uniforms.uTime.value = time; wMat.uniforms.uBoostStretch.value = 0; wMat.uniforms.uMotionBlur.value = 0;
      csMat.uniforms.uTime.value = time;
      csMat.uniforms.uGlowBoost.value = glowState.val;
      csMat.uniforms.uBoostStretch.value = boostStretch.val;
      csMat.uniforms.uMotionBlur.value = motionBlur.val;
      csMat.uniforms.uStarRush.value = starRush.val;

      var lp = 1 - Math.pow(1 - 0.12, dt * 60);

      warehouseGroup.position.y = warehouseState.dropY;
      if (warehouseState.opacity < 0.99) {
        for (var i = 0; i < N_WAREHOUSE; i++) wSzs[i] = wBaseSzs[i] * Math.max(0, warehouseState.opacity);
        wGeo.attributes.size.needsUpdate = true;
      }
      warehouseGroup.rotation.y += dt * warehouseState.rotSpeed;

      if (coinReady && coinLocalPts) {
        var sc = coinScaleState.val;
        var shiftY = coinShiftY.val;
        coinSpinAngle += dt * coinSpin.val;
        var cosA = Math.cos(coinSpinAngle), sinA = Math.sin(coinSpinAngle);
        for (var i = 0; i < N_COIN; i++) {
          var i3 = i * 3;
          var lx = coinLocalPts[i].x * sc;
          var ly = coinLocalPts[i].y * sc;
          var lz = coinLocalPts[i].z * sc;
          csTgt[i3] = lx * cosA + lz * sinA;
          csTgt[i3 + 1] = ly + shiftY;
          csTgt[i3 + 2] = -lx * sinA + lz * cosA;
          csPos[i3] += (csTgt[i3] - csPos[i3]) * csSpd[i] * lp;
          csPos[i3 + 1] += (csTgt[i3 + 1] - csPos[i3 + 1]) * csSpd[i] * lp;
          csPos[i3 + 2] += (csTgt[i3 + 2] - csPos[i3 + 2]) * csSpd[i] * lp;
          csSzs[i] = csBaseSzs[i] * sc;
        }
      }

      for (var i = 0; i < N_STARS_1; i++) {
        var ci = N_COIN + i, i3 = ci * 3;
        csPos[i3] += (csTgt[i3] - csPos[i3]) * csSpd[ci] * lp;
        csPos[i3 + 1] += (csTgt[i3 + 1] - csPos[i3 + 1]) * csSpd[ci] * lp;
        csPos[i3 + 2] += (csTgt[i3 + 2] - csPos[i3 + 2]) * csSpd[ci] * lp;
      }
      for (var i = 0; i < N_STARS_2; i++) {
        var ci = N_COIN + N_STARS_1 + i, i3 = ci * 3;
        csPos[i3] += (csTgt[i3] - csPos[i3]) * csSpd[ci] * lp;
        csPos[i3 + 1] += (csTgt[i3 + 1] - csPos[i3 + 1]) * csSpd[ci] * lp;
        csPos[i3 + 2] += (csTgt[i3 + 2] - csPos[i3 + 2]) * csSpd[ci] * lp;
      }
      for (var i = 0; i < N_SHOOT; i++) {
        var ci = N_COIN + N_STARS_1 + N_STARS_2 + i, i3 = ci * 3;
        csPos[i3] += (csTgt[i3] - csPos[i3]) * csSpd[ci] * lp;
        csPos[i3 + 1] += (csTgt[i3 + 1] - csPos[i3 + 1]) * csSpd[ci] * lp;
        csPos[i3 + 2] += (csTgt[i3 + 2] - csPos[i3 + 2]) * csSpd[ci] * lp;
      }

      csGeo.attributes.position.needsUpdate = true;
      csGeo.attributes.size.needsUpdate = true;

      var ca = csGeo.attributes.color.array, dirty = false;
      for (var i = 0; i < N_CS * 3; i++) {
        var d = csTgtCol[i] - ca[i];
        if (Math.abs(d) > 0.001) { ca[i] += d * lp; dirty = true; } else ca[i] = csTgtCol[i];
      }
      if (dirty) csGeo.attributes.color.needsUpdate = true;

      camera.position.set(
        Math.sin(time * 0.08) * 0.04,
        camState.y + Math.cos(time * 0.06) * 0.03,
        camState.z
      );
      camera.lookAt(0, 0, 0);
      renderer.render(scene, camera);
    }

    /* Scroll-driven: seek timeline to given progress (0→1) */
    function setScrollProgress(p) {
      if (wcsTimeline) wcsTimeline.progress(clamp01(p));
    }

    function startAnim() {
      if (!destroyed && !rafId) tick();
    }
    function stopAnim() {
      if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
    }
    function destroy() {
      destroyed = true; stopAnim();
      if (wcsTimeline) wcsTimeline.kill();
      wGeo.dispose(); wMat.dispose(); csGeo.dispose(); csMat.dispose();
      renderer.dispose(); renderer.forceContextLoss();
    }
    function onResize() {
      var r = layerEl.getBoundingClientRect();
      camera.aspect = r.width / r.height; camera.updateProjectionMatrix();
      renderer.setSize(r.width, r.height);
    }

    return { startAnim: startAnim, stopAnim: stopAnim, setScrollProgress: setScrollProgress, destroy: destroy, resize: onResize };
  }


  /* ──────────────────────────────────────────────
     3. Pinned scroll orchestrator — smooth scroll-linked
     Lerps scroll progress for buttery feel, routes per-phase
     progress to each layer so animations complete fully.
     ────────────────────────────────────────────── */
  function initPinnedScroll(section, layers, instances) {
    if (typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined') return;
    gsap.registerPlugin(ScrollTrigger);

    var paragraph = section.querySelector('.uf-paragraph');
    var track = section.querySelector('.bx-hscroll__track');

    /* Smooth interpolation state */
    var targetProgress = 0;
    var smoothProgress = 0;
    var LERP = 0.10;
    var tickerActive = false;
    var sectionActive = false;

    /* Initial state: first layer visible */
    layers.forEach(function (l, i) {
      if (l) l.style.opacity = i === 0 ? '1' : '0';
    });
    if (track) gsap.set(track, { xPercent: 0 });
    if (paragraph) gsap.set(paragraph, { opacity: 0 });

    /* Drive all animations from smoothed progress value */
    function driveAnimations(p) {
      /* Sequential layer opacities (no overlap) */
      var opacities = computeLayerOpacities(p);
      for (var i = 0; i < layers.length; i++) {
        if (!layers[i]) continue;
        layers[i].style.opacity = String(opacities[i]);
      }

      /* Per-phase local progress: each animation scrubs 0→1 in its own range.
         Layer 1 plays during L1_START→L1_HOLD (hold point = sequence complete).
         Layer 2 plays during L2_IN→L2_HOLD.
         Layer 3 plays during L3_IN→1.0. */
      var p1 = clamp01(p / L1_HOLD);
      var p2 = clamp01((p - L2_IN) / (L2_HOLD - L2_IN));
      var p3 = clamp01((p - L3_IN) / (1 - L3_IN));

      /* Drive scroll-linked layer animations (only when visible) */
      if (opacities[0] > 0.001 && instances[0] && instances[0].setScrollProgress) instances[0].setScrollProgress(p1);
      if (opacities[1] > 0.001 && instances[1] && instances[1].setScrollProgress) instances[1].setScrollProgress(p2);
      if (opacities[2] > 0.001 && instances[2] && instances[2].setScrollProgress) instances[2].setScrollProgress(p3);

      /* Start/stop renderers based on visibility.
         Layer 3 (particles) keeps running once visible — never stopped by scroll. */
      for (var j = 0; j < instances.length; j++) {
        if (!instances[j]) continue;
        if (j === 2) {
          // Particle layer: start once visible, never stop during pin
          if (opacities[j] > 0.01 && instances[j].startAnim) instances[j].startAnim();
        } else {
          if (opacities[j] > 0.01) {
            if (instances[j].startAnim) instances[j].startAnim();
          } else {
            if (instances[j].stopAnim) instances[j].stopAnim();
          }
        }
      }

      /* Text paging */
      if (track) gsap.set(track, { xPercent: textTrackX(p) });
    }

    /* Track whether the section has fully left the viewport */
    var sectionExitedViewport = false;

    /* GSAP ticker-based smooth interpolation */
    function onTick() {
      var diff = targetProgress - smoothProgress;
      if (Math.abs(diff) > 0.0001) {
        smoothProgress += diff * LERP;
        driveAnimations(smoothProgress);
      } else if (!sectionActive) {
        /* Section out of view and animation settled — clean up */
        driveAnimations(smoothProgress);
        stopTicker();
        /* Only stop particle renderer when section truly exited viewport */
        if (sectionExitedViewport) {
          instances.forEach(function (inst) { if (inst && inst.stopAnim) inst.stopAnim(); });
        } else {
          /* Stop layers 0 & 1 but keep layer 2 (particles) running */
          for (var i = 0; i < instances.length - 1; i++) {
            if (instances[i] && instances[i].stopAnim) instances[i].stopAnim();
          }
        }
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
        sectionExitedViewport = false;
        if (paragraph) gsap.to(paragraph, { opacity: 1, duration: 0.3 });
        startTicker();
      },
      onLeave: function () {
        sectionActive = false;
        if (paragraph) gsap.to(paragraph, { opacity: 0, duration: 0.3 });
        targetProgress = 1;
        /* Don't mark as exited yet — particle layer stays alive.
           The separate viewport observer below handles full exit. */
      },
      onEnterBack: function () {
        sectionActive = true;
        sectionExitedViewport = false;
        if (paragraph) gsap.to(paragraph, { opacity: 1, duration: 0.3 });
        startTicker();
      },
      onLeaveBack: function () {
        sectionActive = false;
        sectionExitedViewport = true;
        if (paragraph) gsap.to(paragraph, { opacity: 0, duration: 0.3 });
        targetProgress = 0;
      },
      onUpdate: function (self) {
        targetProgress = self.progress;
      }
    });

    /* Separate observer: stop particle renderer only when the section
       container is completely out of the viewport (scrolled past). */
    ScrollTrigger.create({
      trigger: section,
      start: 'top bottom',   // enters viewport from below
      end: 'bottom top',     // exits viewport going up
      invalidateOnRefresh: true,
      onLeave: function () {
        /* Section fully scrolled past — now safe to kill particles */
        sectionExitedViewport = true;
        instances.forEach(function (inst) { if (inst && inst.stopAnim) inst.stopAnim(); });
      },
      onEnterBack: function () {
        sectionExitedViewport = false;
        /* Restart particle layer if it should be visible */
        if (instances[2] && instances[2].startAnim) instances[2].startAnim();
        startTicker();
      }
    });
  }


  /* ──────────────────────────────────────────────
     4. Fixed header fade — scroll-synced stagger
     ────────────────────────────────────────────── */
  function initFixedHeaderFade(section, header) {
    if (!header) return;
    if (typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined') return;
    gsap.registerPlugin(ScrollTrigger);

    var label = header.querySelector('.uf-label');
    var heading = header.querySelector('.uf-heading');

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
      end: PIN_END,          // +=400% — matches the section's pin duration
      invalidateOnRefresh: true,
      onEnter: staggerIn,
      onLeave: fadeOut,
      onEnterBack: staggerIn,
      onLeaveBack: resetHidden
    });
  }


  /* ──────────────────────────────────────────────
     PUBLIC init()
     ────────────────────────────────────────────── */
  function init() {
    if (typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined') return;
    gsap.registerPlugin(ScrollTrigger);

    var section = document.getElementById('upgrade-afuera-1');
    if (!section) return;

    /* Collect the 3 layers */
    var layer1 = section.querySelector('.uf-shape-layer--seq1');
    var layer2 = section.querySelector('.uf-shape-layer--seq2');
    var layer3 = section.querySelector('.uf-shape-layer--wcs');
    var layers = [layer1, layer2, layer3];

    /* Init image sequences with correct frame counts */
    if (layer1) {
      layer1.dataset.frameCount = '109';
      layer1.dataset.pad = '4';
      layer1.dataset.startIndex = '1';
    }
    if (layer2) {
      layer2.dataset.frameCount = '480';
      layer2.dataset.pad = '4';
      layer2.dataset.startIndex = '1';
    }

    var inst1 = layer1 ? initImageSequenceLayer(layer1) : null;
    var inst2 = layer2 ? initImageSequenceLayer(layer2) : null;
    var inst3 = layer3 ? initWarehouseCoinSpaceLayer(layer3) : null;
    var instances = [inst1, inst2, inst3];
    _instances = instances;

    /* Pinned scroll orchestrator */
    initPinnedScroll(section, layers, instances);

    /* Fixed header fade (replaces BxStickyHeaders) */
    var ufHeader = section.querySelector('.uf-header');
    initFixedHeaderFade(section, ufHeader);
  }

  function resize() {
    _instances.forEach(function (inst) {
      if (inst && inst.resize) inst.resize();
    });
  }

  return { init: init, resize: resize };
})();
