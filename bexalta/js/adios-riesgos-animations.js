/**
 * Adios Riesgos Section — Widget Controller
 * Uses source widgets from animation-widgets.html:
 * - bx-building-urgentfix
 * - bx-helmet-coin-zoom
 * - bx-building-sidewalk
 * Pacing remains scroll-linked with the existing timing windows.
 */
window.BxAdiosRiesgosAnimations = (function () {
  'use strict';

  var PIN_END = '+=460%';

  // Phase pacing (with dedicated text-transition windows between animations).
  var PHASE1_END = 0.40;
  var T1_END = 0.46;
  var PHASE2_END = 0.72;
  var T2_END = 0.78;
  var FIRST_FORM_END = 0.10;
  var END_SCATTER_START = 0.90;

  var ACTIVE_WEIGHT_EPSILON = 0.001;

  var COIN_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 110.05 110.05"><defs><style>.cls-1{fill:#fff}</style></defs><g><path class="cls-1" d="M99.47,21.16v-10.58h-10.59V0H21.17v10.58h-10.59v10.58H0v67.72h10.58v10.58h10.59v10.59h67.71v-10.59h10.59v-10.58h10.58V21.16h-10.58ZM50.87,7.1h13v13h-13V7.1ZM86.73,54.95h-10.56v4.64h10.56v27.04h-10.56v10.56H28.01V27.91h48.16v10.56h10.56v16.48Z"/><g><rect class="cls-1" x="44.49" y="65.51" width="25.77" height="15.21"/><rect class="cls-1" x="44.49" y="44.39" width="25.77" height="4.64"/></g></g></svg>';

  function clamp01(v) {
    if (v < 0) return 0;
    if (v > 1) return 1;
    return v;
  }

  function easeInOut(t) {
    var x = clamp01(t);
    return x * x * (3 - 2 * x);
  }

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

  function computeWidgetWeights(progress) {
    var p = clamp01(progress);

    if (p < PHASE1_END) {
      return [1, 0, 0];
    }

    if (p < T1_END) {
      var t1 = (p - PHASE1_END) / (T1_END - PHASE1_END);
      return t1 < 0.5 ? [1, 0, 0] : [0, 1, 0];
    }

    if (p < PHASE2_END) {
      return [0, 1, 0];
    }

    if (p < T2_END) {
      var t2 = (p - PHASE2_END) / (T2_END - PHASE2_END);
      return t2 < 0.5 ? [0, 1, 0] : [0, 0, 1];
    }

    return [0, 0, 1];
  }

  function getDominantWidgetIndex(progress) {
    var weights = computeWidgetWeights(progress);
    var best = 0;
    var bestWeight = -1;
    for (var i = 0; i < weights.length; i++) {
      if (weights[i] > bestWeight) {
        bestWeight = weights[i];
        best = i;
      }
    }
    return best;
  }

  function computeWidgetScatter(progress) {
    var p = clamp01(progress);
    var scatter = [0, 0, 0];

    // Enter section with phase 1 already scattered, then form.
    if (p < FIRST_FORM_END) {
      scatter[0] = 1 - easeInOut(p / FIRST_FORM_END);
    }

    // Transition 1: phase 1 scatters out, then phase 2 forms in.
    if (p >= PHASE1_END && p < T1_END) {
      var t1 = (p - PHASE1_END) / (T1_END - PHASE1_END);
      if (t1 < 0.5) {
        scatter[0] = easeInOut(t1 / 0.5);
      } else {
        scatter[1] = 1 - easeInOut((t1 - 0.5) / 0.5);
      }
    }

    // Transition 2: phase 2 scatters out, then phase 3 forms in.
    if (p >= PHASE2_END && p < T2_END) {
      var t2 = (p - PHASE2_END) / (T2_END - PHASE2_END);
      if (t2 < 0.5) {
        scatter[1] = easeInOut(t2 / 0.5);
      } else {
        scatter[2] = 1 - easeInOut((t2 - 0.5) / 0.5);
      }
    }

    // Leave section with phase 3 scattering out.
    if (p >= END_SCATTER_START) {
      var tEnd = easeInOut((p - END_SCATTER_START) / (1 - END_SCATTER_START));
      scatter[2] = Math.max(scatter[2], tEnd);
    }

    return scatter;
  }

  function startInstance(inst) {
    if (!inst || inst.__running) return;
    inst.startAnim();
    inst.__running = true;
  }

  function stopInstance(inst) {
    if (!inst || !inst.__running) return;
    inst.stopAnim();
    inst.__running = false;
  }

  function stopAllInstances(instances) {
    for (var i = 0; i < instances.length; i++) {
      stopInstance(instances[i]);
    }
  }

  function applyWidgetBlend(layers, instances, progress) {
    var weights = computeWidgetWeights(progress);
    var i;

    for (i = 0; i < layers.length; i++) {
      if (!layers[i]) continue;
      layers[i].style.opacity = String(weights[i]);
    }

    for (i = 0; i < instances.length; i++) {
      if (weights[i] > ACTIVE_WEIGHT_EPSILON) startInstance(instances[i]);
      else stopInstance(instances[i]);
    }
  }

  function applyWidgetScatter(instances, progress) {
    var scatter = computeWidgetScatter(progress);
    for (var i = 0; i < instances.length; i++) {
      var inst = instances[i];
      if (!inst || typeof inst.setScatterProgress !== 'function') continue;
      inst.setScatterProgress(scatter[i]);
    }
  }

  function normalizeRange(progress, start, end) {
    if (end <= start) return progress >= end ? 1 : 0;
    return clamp01((progress - start) / (end - start));
  }

  function applyWidgetScrollProgress(instances, progress) {
    var p = clamp01(progress);
    var ranges = [
      [FIRST_FORM_END, PHASE1_END],
      [T1_END, PHASE2_END],
      [T2_END, 1]
    ];

    for (var i = 0; i < instances.length; i++) {
      var inst = instances[i];
      if (!inst || typeof inst.setScrollProgress !== 'function') continue;
      inst.setScrollProgress(normalizeRange(p, ranges[i][0], ranges[i][1]));
    }
  }

  function sampleInstanceParticles(inst, maxCount) {
    if (!inst || typeof inst.getSampledPositions !== 'function') return [];
    return inst.getSampledPositions(maxCount || 4000);
  }

  function makeCoinTexture(svgStr, cb) {
    var size = 256;
    var cv = document.createElement('canvas');
    cv.width = size;
    cv.height = size;

    var ctx = cv.getContext('2d');
    var blob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var img = new Image();

    img.onload = function () {
      var pad = 4;
      var drawSize = size - pad * 2;
      ctx.drawImage(img, pad, pad, drawSize, drawSize);
      URL.revokeObjectURL(url);
      cb(cv);
    };

    img.onerror = function () {
      URL.revokeObjectURL(url);
      cb(cv);
    };

    img.src = url;
  }

  function createBuildingSidewalkWidget(layer) {
    var canvas = layer.querySelector('canvas');
    if (!canvas) return null;

    var TOTAL = 40000;
    var N_BUILDING = 20000;
    var N_SIDEWALK = TOTAL - N_BUILDING;
    var SW_START = N_BUILDING;

    var VERT = '' +
      'attribute float size;\n' +
      'attribute float aRandom;\n' +
      'attribute float aSpeed;\n' +
      'attribute float aScatterSeed;\n' +
      'varying vec3 vColor;\n' +
      'varying float vAlpha;\n' +
      'varying float vDist;\n' +
      'uniform float uTime;\n' +
      'uniform float uMorphProgress;\n' +
      'uniform float uScatter;\n' +
      'void main(){\n' +
      '  vColor=color;\n' +
      '  vec3 p=position;\n' +
      '  float turb=(1.0-uMorphProgress*0.7);\n' +
      '  float t2=uTime*0.4+aRandom*6.2831;\n' +
      '  p.x+=sin(t2*aSpeed)*0.015*turb;\n' +
      '  p.y+=cos(t2*0.7*aSpeed)*0.015*turb;\n' +
      '  p.z+=sin(t2*0.5+aRandom*3.14)*0.01*turb;\n' +
      '  if(uScatter>0.0001){\n' +
      '    float ang=aScatterSeed*6.2831+uTime*0.35;\n' +
      '    vec3 sdir=normalize(vec3(cos(ang)+p.x*0.08,sin(ang*1.31)+p.y*0.08,sin(ang*0.73)+p.z*0.08));\n' +
      '    p+=sdir*uScatter*(5.0+aRandom*2.0);\n' +
      '  }\n' +
      '  vec4 mv=modelViewMatrix*vec4(p,1.0);\n' +
      '  gl_Position=projectionMatrix*mv;\n' +
      '  float sa=size*(180.0/-mv.z);\n' +
      '  gl_PointSize=clamp(sa,0.3,5.0);\n' +
      '  float dist=length(mv.xyz);\n' +
      '  vDist=dist;\n' +
      '  vAlpha=smoothstep(50.0,3.0,dist)*(0.4+0.4*aRandom);\n' +
      '}';

    var FRAG = '' +
      'varying vec3 vColor;\n' +
      'varying float vAlpha;\n' +
      'varying float vDist;\n' +
      'void main(){\n' +
      '  float d=length(gl_PointCoord-0.5);\n' +
      '  if(d>0.5)discard;\n' +
      '  float core=smoothstep(0.5,0.05,d);\n' +
      '  float glow=smoothstep(0.5,0.25,d);\n' +
      '  float alpha=(core*0.7+glow*0.25)*vAlpha;\n' +
      '  gl_FragColor=vec4(vColor,alpha);\n' +
      '}';

    var rect = layer.getBoundingClientRect();
    var renderer = new THREE.WebGLRenderer({
      canvas: canvas,
      antialias: false,
      alpha: true,
      powerPreference: 'high-performance'
    });
    renderer.setSize(rect.width, rect.height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));

    var scene = new THREE.Scene();
    var camera = new THREE.PerspectiveCamera(55, rect.width / rect.height, 0.1, 100);
    camera.position.set(0, 1.5, 9);

    var geo = new THREE.BufferGeometry();
    var pos = new Float32Array(TOTAL * 3);
    var col = new Float32Array(TOTAL * 3);
    var szs = new Float32Array(TOTAL);
    var rnd = new Float32Array(TOTAL);
    var spd = new Float32Array(TOTAL);
    var scatterSeed = new Float32Array(TOTAL);

    var BW = 2.0;
    var BH = 4.0;
    var BD = 1.5;
    var BCX = 0;
    var BCY = -2.0;
    var FLOORS = 8;

    var SW_MARGIN = 0.8;
    var SW_INNER_W = BW / 2;
    var SW_INNER_D = BD / 2;
    var SW_OUTER_W = BW / 2 + SW_MARGIN;
    var SW_OUTER_D = BD / 2 + SW_MARGIN;
    var SW_Y = BCY;

    var i;
    for (i = 0; i < N_BUILDING; i++) {
      var t = i / N_BUILDING;
      var x;
      var y;
      var z;

      if (t < 0.35) {
        var edge = Math.floor(t / 0.0875);
        var et = (t % 0.0875) / 0.0875;
        var ex = (edge % 2 === 0 ? -1 : 1) * BW / 2;
        var ez = (edge < 2 ? -1 : 1) * BD / 2;
        x = BCX + ex + (Math.random() - 0.5) * 0.06;
        y = BCY + et * BH + (Math.random() - 0.5) * 0.06;
        z = ez + (Math.random() - 0.5) * 0.06;
      } else if (t < 0.6) {
        var ft = (t - 0.35) / 0.25;
        var floor = Math.floor(ft * FLOORS);
        var floorY = BCY + (floor / FLOORS) * BH;
        var side = Math.floor((ft * FLOORS - floor) * 4);
        var st = (ft * FLOORS - floor) * 4 - side;

        if (side < 2) {
          x = BCX + (st - 0.5) * BW;
          z = (side === 0 ? -1 : 1) * BD / 2;
        } else {
          z = (st - 0.5) * BD;
          x = BCX + (side === 2 ? -1 : 1) * BW / 2;
        }

        y = floorY + (Math.random() - 0.5) * 0.04;
        x += (Math.random() - 0.5) * 0.04;
        z += (Math.random() - 0.5) * 0.04;
      } else if (t < 0.85) {
        var face = Math.floor(Math.random() * 4);
        var u = Math.random();
        var v = Math.random();

        if (face < 2) {
          x = BCX + (u - 0.5) * BW;
          y = BCY + v * BH;
          z = (face === 0 ? -1 : 1) * BD / 2 + (Math.random() - 0.5) * 0.08;
        } else {
          z = (u - 0.5) * BD;
          y = BCY + v * BH;
          x = BCX + (face === 2 ? -1 : 1) * BW / 2 + (Math.random() - 0.5) * 0.08;
        }
      } else {
        x = BCX + (Math.random() - 0.5) * BW;
        z = (Math.random() - 0.5) * BD;
        y = BCY + BH + (Math.random() - 0.5) * 0.04;
      }

      var i3 = i * 3;
      pos[i3] = x;
      pos[i3 + 1] = y;
      pos[i3 + 2] = z;
      szs[i] = 0.3 * (0.3 + Math.random() * 0.7);
      rnd[i] = Math.random();
      spd[i] = 0.5 + Math.random() * 0.5;
    }

    var swLocalX = new Float32Array(N_SIDEWALK);
    var swLocalZ = new Float32Array(N_SIDEWALK);

    for (i = 0; i < N_SIDEWALK; i++) {
      var idx = SW_START + i;
      var i3sw = idx * 3;
      var sx;
      var sz;

      do {
        sx = (Math.random() - 0.5) * SW_OUTER_W * 2;
        sz = (Math.random() - 0.5) * SW_OUTER_D * 2;
      } while (Math.abs(sx) < SW_INNER_W && Math.abs(sz) < SW_INNER_D);

      swLocalX[i] = sx;
      swLocalZ[i] = sz;

      pos[i3sw] = BCX + sx;
      pos[i3sw + 1] = SW_Y + (Math.random() - 0.5) * 0.03;
      pos[i3sw + 2] = sz;

      szs[idx] = 0.28 * (0.4 + Math.random() * 0.6);
      rnd[idx] = Math.random();
      spd[idx] = 0.5 + Math.random() * 0.5;
    }

    var MAX_CRACKS = 12;
    var CRACK_COLOR = { r: 0.808, g: 0.329, b: 0.463 };
    var CRACK_SCROLL_DURATION = 16;
    var ROTATION_TURNS = 2.0;

    var crackSeeds = [];
    for (i = 0; i < MAX_CRACKS; i++) {
      var cx;
      var cz;
      do {
        cx = (Math.random() - 0.5) * SW_OUTER_W * 1.8;
        cz = (Math.random() - 0.5) * SW_OUTER_D * 1.8;
      } while (Math.abs(cx) < SW_INNER_W * 0.6 && Math.abs(cz) < SW_INNER_D * 0.6);

      crackSeeds.push({
        x: cx,
        z: cz,
        maxR: 0.25 + Math.random() * 0.35,
        growRate: 0.035 + Math.random() * 0.025,
        currentR: 0,
        active: false,
        spawnTime: 2.2 + i * 0.95
      });
    }

    var swCracked = new Uint8Array(N_SIDEWALK);
    var brickTgtX = new Float32Array(N_SIDEWALK);
    var brickTgtY = new Float32Array(N_SIDEWALK);
    var brickTgtZ = new Float32Array(N_SIDEWALK);
    var brickActive = new Uint8Array(N_SIDEWALK);

    for (i = 0; i < TOTAL; i++) {
      var i3c = i * 3;

      if (i < N_BUILDING) {
        var isAccent = Math.random() < 0.15;
        if (isAccent) {
          col[i3c] = 0.635;
          col[i3c + 1] = 0.776;
          col[i3c + 2] = 0.180;
        } else {
          var sBuilding = 0.75 + Math.random() * 0.15;
          col[i3c] = sBuilding;
          col[i3c + 1] = sBuilding;
          col[i3c + 2] = sBuilding;
        }
      } else {
        var sSidewalk = 0.45 + Math.random() * 0.12;
        col[i3c] = sSidewalk;
        col[i3c + 1] = sSidewalk;
        col[i3c + 2] = sSidewalk;
      }
      scatterSeed[i] = Math.random();
    }

    var basePos = new Float32Array(pos);
    var baseCol = new Float32Array(col);

    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.setAttribute('size', new THREE.BufferAttribute(szs, 1));
    geo.setAttribute('aRandom', new THREE.BufferAttribute(rnd, 1));
    geo.setAttribute('aSpeed', new THREE.BufferAttribute(spd, 1));
    geo.setAttribute('aScatterSeed', new THREE.BufferAttribute(scatterSeed, 1));

    var mat = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms: {
        uTime: { value: 0 },
        uMorphProgress: { value: 0.95 },
        uScatter: { value: 0.0 }
      },
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });

    var particles = new THREE.Points(geo, mat);
    scene.add(particles);

    var time = 0;
    var lastFrame = 0;
    var destroyed = false;
    var rafId = null;
    var scrollProgress = 0;
    var crackClock = 0;

    function resetCrackState() {
      for (i = 0; i < N_SIDEWALK; i++) {
        var idx = SW_START + i;
        var i3 = idx * 3;
        pos[i3] = basePos[i3];
        pos[i3 + 1] = basePos[i3 + 1];
        pos[i3 + 2] = basePos[i3 + 2];
        col[i3] = baseCol[i3];
        col[i3 + 1] = baseCol[i3 + 1];
        col[i3 + 2] = baseCol[i3 + 2];
        swCracked[i] = 0;
        brickActive[i] = 0;
      }

      for (i = 0; i < MAX_CRACKS; i++) {
        crackSeeds[i].active = false;
        crackSeeds[i].currentR = 0;
      }

      geo.attributes.position.needsUpdate = true;
      geo.attributes.color.needsUpdate = true;
    }

    function tick(now) {
      if (destroyed) return;
      rafId = requestAnimationFrame(tick);

      if (!now) now = performance.now();
      var dt = lastFrame ? Math.min((now - lastFrame) / 1000, 0.05) : 0.016;
      lastFrame = now;
      time += dt;
      mat.uniforms.uTime.value = time;

      var targetCrackClock = scrollProgress * CRACK_SCROLL_DURATION;
      var crackStep = targetCrackClock - crackClock;
      if (crackStep < -0.0001) {
        resetCrackState();
      }
      crackClock = targetCrackClock;
      var crackAdvance = crackStep > 0 ? crackStep : 0;

      var targetRotY = scrollProgress * Math.PI * 2 * ROTATION_TURNS;
      particles.rotation.y += (targetRotY - particles.rotation.y) * Math.min(1, dt * 12);

      var c;
      for (c = 0; c < MAX_CRACKS; c++) {
        var crack = crackSeeds[c];
        if (targetCrackClock < crack.spawnTime) {
          crack.active = false;
          crack.currentR = 0;
          continue;
        }
        crack.active = true;
        if (crack.currentR <= 0) crack.currentR = 0.02;
        if (crack.currentR < crack.maxR) {
          crack.currentR = Math.min(crack.currentR + crack.growRate * crackAdvance, crack.maxR);
        }
      }

      var colArr = geo.attributes.color.array;
      var posArr = geo.attributes.position.array;
      var colorDirty = false;

      for (i = 0; i < N_SIDEWALK; i++) {
        var pidx = SW_START + i;
        var p3 = pidx * 3;

        if (!swCracked[i]) {
          var lx = swLocalX[i];
          var lz = swLocalZ[i];

          for (c = 0; c < MAX_CRACKS; c++) {
            var crackNow = crackSeeds[c];
            if (!crackNow.active) continue;

            var dx = lx - crackNow.x;
            var dz = lz - crackNow.z;
            var dist = Math.sqrt(dx * dx + dz * dz);

            if (dist < crackNow.currentR) {
              swCracked[i] = 1;
              brickActive[i] = 1;

              colArr[p3] = CRACK_COLOR.r + (Math.random() - 0.5) * 0.06;
              colArr[p3 + 1] = CRACK_COLOR.g + (Math.random() - 0.5) * 0.06;
              colArr[p3 + 2] = CRACK_COLOR.b + (Math.random() - 0.5) * 0.06;

              var dirX = lx;
              var dirZ = lz;
              var len = Math.sqrt(dirX * dirX + dirZ * dirZ) || 1;
              var pushDist = SW_OUTER_W + 0.15 + Math.random() * 0.3;

              brickTgtX[i] = BCX + (dirX / len) * pushDist + (Math.random() - 0.5) * 0.15;
              brickTgtZ[i] = (dirZ / len) * pushDist + (Math.random() - 0.5) * 0.15;
              brickTgtY[i] = SW_Y + Math.random() * 0.18;

              colorDirty = true;
              break;
            }
          }
        }

        if (brickActive[i]) {
          var lp = 1 - Math.pow(1 - 0.08, crackAdvance * 60);
          if (lp <= 0) continue;
          var toX = brickTgtX[i] - posArr[p3];
          var toY = brickTgtY[i] - posArr[p3 + 1];
          var toZ = brickTgtZ[i] - posArr[p3 + 2];

          posArr[p3] += toX * lp;
          posArr[p3 + 1] += toY * lp;
          posArr[p3 + 2] += toZ * lp;

          if (Math.abs(toX) < 0.005 && Math.abs(toY) < 0.005 && Math.abs(toZ) < 0.005) {
            posArr[p3] = brickTgtX[i];
            posArr[p3 + 1] = brickTgtY[i];
            posArr[p3 + 2] = brickTgtZ[i];
            brickActive[i] = 0;
          }
        }
      }

      if (colorDirty) geo.attributes.color.needsUpdate = true;
      geo.attributes.position.needsUpdate = true;

      camera.position.x = Math.sin(time * 0.08) * 0.15;
      camera.position.y = 1.5 + Math.cos(time * 0.06) * 0.08;
      camera.position.z = 9;
      camera.lookAt(0, -0.3, 0);

      renderer.render(scene, camera);
    }

    function startAnim() {
      if (!destroyed && !rafId) tick();
    }

    function stopAnim() {
      if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
    }

    function setScrollProgress(progress) {
      scrollProgress = clamp01(progress);
    }

    function setScatterProgress(progress) {
      mat.uniforms.uScatter.value = clamp01(progress);
    }

    function getSampledPositions(maxCount) {
      var attr = geo && geo.attributes && geo.attributes.position;
      if (!attr) return [];
      var arr = attr.array;
      var total = arr.length / 3;
      if (total <= 0) return [];
      var target = Math.max(1, maxCount || 4000);
      var step = Math.max(1, Math.floor(total / target));
      var pts = [];
      for (var i = 0; i < total; i += step) {
        var i3 = i * 3;
        pts.push(new THREE.Vector3(arr[i3], arr[i3 + 1], arr[i3 + 2]));
        if (pts.length >= target) break;
      }
      return pts;
    }

    function destroy() {
      destroyed = true;
      stopAnim();
      geo.dispose();
      mat.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
    }

    function resize() {
      var r = layer.getBoundingClientRect();
      camera.aspect = r.width / r.height;
      camera.updateProjectionMatrix();
      renderer.setSize(r.width, r.height);
    }

    return {
      startAnim: startAnim,
      stopAnim: stopAnim,
      setScrollProgress: setScrollProgress,
      setScatterProgress: setScatterProgress,
      getSampledPositions: getSampledPositions,
      destroy: destroy,
      resize: resize
    };
  }

  function createBuildingUrgentFixWidget(layer) {
    var canvas = layer.querySelector('canvas');
    if (!canvas) return null;

    var N = 50000;
    var N_LOWER = 15000;
    var N_TOP = 25000;
    var N_PIPE = 3000;
    var N_WATER = N - N_LOWER - N_TOP - N_PIPE;

    var TOP_START = N_LOWER;
    var PIPE_START = N_LOWER + N_TOP;
    var WATER_START = PIPE_START + N_PIPE;

    var VERT = '' +
      'attribute float size;\n' +
      'attribute float aRandom;\n' +
      'attribute float aSpeed;\n' +
      'attribute float aScatterSeed;\n' +
      'varying vec3 vColor;\n' +
      'varying float vAlpha;\n' +
      'varying float vDist;\n' +
      'uniform float uTime;\n' +
      'uniform float uMorphProgress;\n' +
      'uniform float uSizeScale;\n' +
      'uniform float uScatter;\n' +
      'void main(){\n' +
      '  vColor=color;\n' +
      '  vec3 p=position;\n' +
      '  float turb=(1.0-uMorphProgress*0.7);\n' +
      '  float t2=uTime*0.4+aRandom*6.2831;\n' +
      '  p.x+=sin(t2*aSpeed)*0.025*turb;\n' +
      '  p.y+=cos(t2*0.7*aSpeed)*0.025*turb;\n' +
      '  p.z+=sin(t2*0.5+aRandom*3.14)*0.015*turb;\n' +
      '  if(uScatter>0.0001){\n' +
      '    float ang=aScatterSeed*6.2831+uTime*0.32;\n' +
      '    vec3 sdir=normalize(vec3(cos(ang)+p.x*0.08,sin(ang*1.27)+p.y*0.08,sin(ang*0.69)+p.z*0.08));\n' +
      '    p+=sdir*uScatter*(5.6+aRandom*2.4);\n' +
      '  }\n' +
      '  vec4 mv=modelViewMatrix*vec4(p,1.0);\n' +
      '  gl_Position=projectionMatrix*mv;\n' +
      '  float sa=size*uSizeScale*(180.0/-mv.z);\n' +
      '  gl_PointSize=clamp(sa,0.3,6.0);\n' +
      '  float dist=length(mv.xyz);\n' +
      '  vDist=dist;\n' +
      '  vAlpha=smoothstep(50.0,3.0,dist)*(0.4+0.4*aRandom);\n' +
      '}';

    var FRAG = '' +
      'varying vec3 vColor;\n' +
      'varying float vAlpha;\n' +
      'varying float vDist;\n' +
      'void main(){\n' +
      '  float d=length(gl_PointCoord-0.5);\n' +
      '  if(d>0.5)discard;\n' +
      '  float core=smoothstep(0.5,0.05,d);\n' +
      '  float glow=smoothstep(0.5,0.25,d);\n' +
      '  float alpha=(core*0.7+glow*0.25)*vAlpha;\n' +
      '  gl_FragColor=vec4(vColor,alpha);\n' +
      '}';

    var rect = layer.getBoundingClientRect();
    var renderer = new THREE.WebGLRenderer({
      canvas: canvas,
      antialias: false,
      alpha: true,
      powerPreference: 'high-performance'
    });
    renderer.setSize(rect.width, rect.height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));

    var scene = new THREE.Scene();
    var camera = new THREE.PerspectiveCamera(55, rect.width / rect.height, 0.1, 100);
    camera.position.set(0, 0, 9);

    var geo = new THREE.BufferGeometry();
    var pos = new Float32Array(N * 3);
    var col = new Float32Array(N * 3);
    var szs = new Float32Array(N);
    var rnd = new Float32Array(N);
    var spd = new Float32Array(N);
    var scatterSeed = new Float32Array(N);

    var waterVel = new Float32Array(N_WATER * 3);
    var waterActive = false;

    var BW = 2.0;
    var BH = 4.0;
    var BD = 1.5;
    var BCX = 0;
    var BCY = -2.0;

    var PIPE_R = 0.04;
    var PIPE_Z = -0.70;
    var PIPE_VX = 0.3;
    var PIPE_VY0 = 1.50;
    var PIPE_VY1 = 1.85;
    var PIPE_HX0 = -0.4;
    var PIPE_HX1 = 0.3;
    var PIPE_HY = 1.85;
    var BREAK = { x: 0.3, y: 1.85, z: -0.70 };

    var TOP_Y0 = 1.2;
    var i;

    for (i = 0; i < N_LOWER; i++) {
      var t = i / N_LOWER;
      var x;
      var y;
      var z;

      if (t < 0.35) {
        var edge = Math.floor(t / 0.0875);
        var et = (t % 0.0875) / 0.0875;
        var ex = (edge % 2 === 0 ? -1 : 1) * BW / 2;
        var ez = (edge < 2 ? -1 : 1) * BD / 2;

        x = BCX + ex + (Math.random() - 0.5) * 0.06;
        y = BCY + et * (TOP_Y0 - BCY) + (Math.random() - 0.5) * 0.06;
        z = ez + (Math.random() - 0.5) * 0.06;
      } else if (t < 0.6) {
        var ft = (t - 0.35) / 0.25;
        var floor = Math.floor(ft * 6);
        var floorY = BCY + (floor / 6) * (TOP_Y0 - BCY);
        var side = Math.floor((ft * 6 - floor) * 4);
        var st = (ft * 6 - floor) * 4 - side;

        if (side < 2) {
          x = BCX + (st - 0.5) * BW;
          z = (side === 0 ? -1 : 1) * BD / 2;
        } else {
          z = (st - 0.5) * BD;
          x = BCX + (side === 2 ? -1 : 1) * BW / 2;
        }

        y = floorY + (Math.random() - 0.5) * 0.04;
        x += (Math.random() - 0.5) * 0.04;
        z += (Math.random() - 0.5) * 0.04;
      } else {
        var face = Math.floor(Math.random() * 4);
        var u = Math.random();
        var v = Math.random();

        if (face < 2) {
          x = BCX + (u - 0.5) * BW;
          y = BCY + v * (TOP_Y0 - BCY);
          z = (face === 0 ? -1 : 1) * BD / 2 + (Math.random() - 0.5) * 0.08;
        } else {
          z = (u - 0.5) * BD;
          y = BCY + v * (TOP_Y0 - BCY);
          x = BCX + (face === 2 ? -1 : 1) * BW / 2 + (Math.random() - 0.5) * 0.08;
        }
      }

      var i3 = i * 3;
      pos[i3] = x;
      pos[i3 + 1] = y;
      pos[i3 + 2] = z;
      szs[i] = 0.3 * (0.3 + Math.random() * 0.7);
      rnd[i] = Math.random();
      spd[i] = 0.5 + Math.random() * 0.5;
    }

    var TOP_Y1 = BCY + BH;
    for (i = 0; i < N_TOP; i++) {
      var idxTop = TOP_START + i;
      var i3top = idxTop * 3;
      var tTop = i / N_TOP;
      var xTop;
      var yTop;
      var zTop;

      if (tTop < 0.15) {
        var edgeTop = Math.floor(tTop / 0.0375);
        var etTop = (tTop % 0.0375) / 0.0375;
        var exTop = (edgeTop % 2 === 0 ? -1 : 1) * BW / 2;
        var ezTop = (edgeTop < 2 ? -1 : 1) * BD / 2;

        xTop = BCX + exTop + (Math.random() - 0.5) * 0.04;
        yTop = TOP_Y0 + etTop * (TOP_Y1 - TOP_Y0) + (Math.random() - 0.5) * 0.04;
        zTop = ezTop + (Math.random() - 0.5) * 0.04;
      } else if (tTop < 0.35) {
        var ftTop = (tTop - 0.15) / 0.2;
        var floorTop = Math.floor(ftTop * 2);
        var floorYTop = TOP_Y0 + (floorTop / 2) * (TOP_Y1 - TOP_Y0);
        var sideTop = Math.floor((ftTop * 2 - floorTop) * 4);
        var stTop = (ftTop * 2 - floorTop) * 4 - sideTop;

        if (sideTop < 2) {
          xTop = BCX + (stTop - 0.5) * BW;
          zTop = (sideTop === 0 ? -1 : 1) * BD / 2;
        } else {
          zTop = (stTop - 0.5) * BD;
          xTop = BCX + (sideTop === 2 ? -1 : 1) * BW / 2;
        }

        yTop = floorYTop + (Math.random() - 0.5) * 0.03;
        xTop += (Math.random() - 0.5) * 0.03;
        zTop += (Math.random() - 0.5) * 0.03;
      } else if (tTop < 0.75) {
        var faceTop = Math.floor(Math.random() * 4);
        var uTop = Math.random();
        var vTop = Math.random();

        if (faceTop < 2) {
          xTop = BCX + (uTop - 0.5) * BW;
          yTop = TOP_Y0 + vTop * (TOP_Y1 - TOP_Y0);
          zTop = (faceTop === 0 ? -1 : 1) * BD / 2 + (Math.random() - 0.5) * 0.06;
        } else {
          zTop = (uTop - 0.5) * BD;
          yTop = TOP_Y0 + vTop * (TOP_Y1 - TOP_Y0);
          xTop = BCX + (faceTop === 2 ? -1 : 1) * BW / 2 + (Math.random() - 0.5) * 0.06;
        }
      } else {
        xTop = BCX + (Math.random() - 0.5) * BW;
        zTop = (Math.random() - 0.5) * BD;
        yTop = TOP_Y1 + (Math.random() - 0.5) * 0.03;
      }

      pos[i3top] = xTop;
      pos[i3top + 1] = yTop;
      pos[i3top + 2] = zTop;
      szs[idxTop] = 0.3 * (0.3 + Math.random() * 0.7);
      rnd[idxTop] = Math.random();
      spd[idxTop] = 0.5 + Math.random() * 0.5;
    }

    var N_PV = Math.floor(N_PIPE * 0.45);
    var N_PH = Math.floor(N_PIPE * 0.45);

    for (i = 0; i < N_PIPE; i++) {
      var idxPipe = PIPE_START + i;
      var i3pipe = idxPipe * 3;
      var xPipe;
      var yPipe;
      var zPipe;

      if (i < N_PV) {
        var tPipeV = i / N_PV;
        xPipe = PIPE_VX + (Math.random() - 0.5) * PIPE_R * 2;
        yPipe = PIPE_VY0 + tPipeV * (PIPE_VY1 - PIPE_VY0);
        zPipe = PIPE_Z + (Math.random() - 0.5) * PIPE_R * 2;
      } else if (i < N_PV + N_PH) {
        var tPipeH = (i - N_PV) / N_PH;
        xPipe = PIPE_HX0 + tPipeH * (PIPE_HX1 - PIPE_HX0);
        yPipe = PIPE_HY + (Math.random() - 0.5) * PIPE_R * 2;
        zPipe = PIPE_Z + (Math.random() - 0.5) * PIPE_R * 2;
      } else {
        var anglePipe = Math.random() * Math.PI * 2;
        var rPipe = Math.random() * PIPE_R * 3;
        xPipe = BREAK.x + Math.cos(anglePipe) * rPipe;
        yPipe = BREAK.y + Math.sin(anglePipe) * rPipe;
        zPipe = BREAK.z + (Math.random() - 0.5) * PIPE_R * 2;
      }

      pos[i3pipe] = xPipe;
      pos[i3pipe + 1] = yPipe;
      pos[i3pipe + 2] = zPipe;
      szs[idxPipe] = 0.3 * (0.4 + Math.random() * 0.6);
      rnd[idxPipe] = Math.random();
      spd[idxPipe] = 0.5 + Math.random() * 0.5;
    }

    function resetWater(li) {
      var idx = WATER_START + li;
      var i3 = idx * 3;
      var v3 = li * 3;

      pos[i3] = BREAK.x + (Math.random() - 0.5) * 0.05;
      pos[i3 + 1] = BREAK.y + (Math.random() - 0.5) * 0.05;
      pos[i3 + 2] = BREAK.z + (Math.random() - 0.5) * 0.03;

      waterVel[v3] = (Math.random() - 0.5) * 1.2;
      waterVel[v3 + 1] = -0.3 + Math.random() * 0.8;
      waterVel[v3 + 2] = 0.3 + Math.random() * 0.5;
    }

    for (i = 0; i < N_WATER; i++) {
      var idxWater = WATER_START + i;
      var i3water = idxWater * 3;

      pos[i3water] = BREAK.x + (Math.random() - 0.5) * 0.02;
      pos[i3water + 1] = BREAK.y + (Math.random() - 0.5) * 0.02;
      pos[i3water + 2] = BREAK.z + (Math.random() - 0.5) * 0.02;

      szs[idxWater] = 0.25 * (0.3 + Math.random() * 0.7);
      rnd[idxWater] = Math.random();
      spd[idxWater] = 0.5 + Math.random() * 0.5;
    }

    for (i = 0; i < N; i++) {
      var i3color = i * 3;

      if (i < N_LOWER + N_TOP) {
        var s = 0.7 + Math.random() * 0.18;
        col[i3color] = s;
        col[i3color + 1] = s;
        col[i3color + 2] = s;
      } else if (i < PIPE_START + N_PIPE) {
        col[i3color] = 0.808 + (Math.random() - 0.5) * 0.05;
        col[i3color + 1] = 0.329 + (Math.random() - 0.5) * 0.05;
        col[i3color + 2] = 0.463 + (Math.random() - 0.5) * 0.05;
      } else {
        col[i3color] = 0.886 + (Math.random() - 0.5) * 0.04;
        col[i3color + 1] = 0.902 + (Math.random() - 0.5) * 0.04;
        col[i3color + 2] = 0.576 + (Math.random() - 0.5) * 0.04;
      }
      scatterSeed[i] = Math.random();
    }

    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.setAttribute('size', new THREE.BufferAttribute(szs, 1));
    geo.setAttribute('aRandom', new THREE.BufferAttribute(rnd, 1));
    geo.setAttribute('aSpeed', new THREE.BufferAttribute(spd, 1));
    geo.setAttribute('aScatterSeed', new THREE.BufferAttribute(scatterSeed, 1));

    var mat = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms: {
        uTime: { value: 0 },
        uMorphProgress: { value: 0.95 },
        uSizeScale: { value: 1.0 },
        uScatter: { value: 0.0 }
      },
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });

    var particles = new THREE.Points(geo, mat);
    scene.add(particles);

    var expandTgt = new Float32Array(N_LOWER * 3);
    for (i = 0; i < N_LOWER; i++) {
      var i3exp = i * 3;
      var dxExp = pos[i3exp] - BCX;
      var dyExp = pos[i3exp + 1];
      var dzExp = pos[i3exp + 2];
      var lenExp = Math.sqrt(dxExp * dxExp + dyExp * dyExp + dzExp * dzExp) || 1;
      var distExp = 12 + Math.random() * 8;

      expandTgt[i3exp] = (dxExp / lenExp) * distExp + (Math.random() - 0.5) * 3;
      expandTgt[i3exp + 1] = (dyExp / lenExp) * distExp + (Math.random() - 0.5) * 3;
      expandTgt[i3exp + 2] = (dzExp / lenExp) * distExp + (Math.random() - 0.5) * 3;
    }
    var lowerSeed = new Float32Array(N_LOWER * 3);
    for (i = 0; i < N_LOWER; i++) {
      var i3seed = i * 3;
      lowerSeed[i3seed] = pos[i3seed];
      lowerSeed[i3seed + 1] = pos[i3seed + 1];
      lowerSeed[i3seed + 2] = pos[i3seed + 2];
    }

    var expanding = false;
    var time = 0;
    var lastFrame = 0;
    var destroyed = false;
    var rafId = null;
    var lastScrollProgress = -1;
    var scrollProgress = 0;

    var camState = { x: 0, y: 0, z: 9 };
    var lookTarget = { x: 0, y: 0, z: 0 };
    var sizeState = { scale: 1.0 };

    var EXPAND_AT = 1.8;
    var WATER_AT = 3.6;
    var HOLD_END_AT = 11.2;

    var tl = gsap.timeline({ paused: true });
    tl.to(camState, { z: 2.4, y: 1.65, duration: 3.2, ease: 'power2.inOut' }, EXPAND_AT);
    tl.to(lookTarget, { y: 1.72, z: -0.5, duration: 3.2, ease: 'power2.inOut' }, EXPAND_AT);
    tl.to(sizeState, { scale: 0.30, duration: 3.2, ease: 'power2.inOut' }, EXPAND_AT);
    tl.to({}, { duration: HOLD_END_AT - WATER_AT }, WATER_AT);

    function activateWaterBurst() {
      waterActive = true;
      for (var wi = 0; wi < N_WATER; wi++) {
        resetWater(wi);
        var pre = Math.random() * 2.0;
        var v3 = wi * 3;
        var idxW = WATER_START + wi;
        var i3W = idxW * 3;

        pos[i3W] += waterVel[v3] * pre;
        pos[i3W + 1] += waterVel[v3 + 1] * pre - 0.5 * 3.5 * pre * pre;
        pos[i3W + 2] += waterVel[v3 + 2] * pre;
        waterVel[v3 + 1] -= 3.5 * pre;
      }
    }

    var tlDuration = tl.duration() || HOLD_END_AT;
    var expandStartProgress = EXPAND_AT / tlDuration;
    var waterStartProgress = WATER_AT / tlDuration;

    function restoreLowerShape() {
      for (i = 0; i < N_LOWER; i++) {
        var i3lower = i * 3;
        pos[i3lower] = lowerSeed[i3lower];
        pos[i3lower + 1] = lowerSeed[i3lower + 1];
        pos[i3lower + 2] = lowerSeed[i3lower + 2];
      }
      geo.attributes.position.needsUpdate = true;
    }

    function resetWaterState() {
      for (i = 0; i < N_WATER; i++) {
        resetWater(i);
      }
      geo.attributes.position.needsUpdate = true;
    }

    function tick(now) {
      if (destroyed) return;
      rafId = requestAnimationFrame(tick);

      if (!now) now = performance.now();
      var dt = lastFrame ? Math.min((now - lastFrame) / 1000, 0.05) : 0.016;
      lastFrame = now;
      time += dt;

      mat.uniforms.uTime.value = time;
      mat.uniforms.uSizeScale.value = sizeState.scale;

      var targetRotation = scrollProgress * Math.PI * 2 * 1.85;
      particles.rotation.y += (targetRotation - particles.rotation.y) * Math.min(1, dt * 12);

      if (expanding) {
        var lpExpand = 1 - Math.pow(1 - 0.06, dt * 60);
        for (i = 0; i < N_LOWER; i++) {
          var i3lower = i * 3;
          pos[i3lower] += (expandTgt[i3lower] - pos[i3lower]) * lpExpand;
          pos[i3lower + 1] += (expandTgt[i3lower + 1] - pos[i3lower + 1]) * lpExpand;
          pos[i3lower + 2] += (expandTgt[i3lower + 2] - pos[i3lower + 2]) * lpExpand;
        }
      }

      if (waterActive) {
        var G = 3.5;
        var drag = Math.pow(0.99, dt * 60);

        for (i = 0; i < N_WATER; i++) {
          var idxNow = WATER_START + i;
          var i3Now = idxNow * 3;
          var v3Now = i * 3;

          waterVel[v3Now + 1] -= G * dt;
          waterVel[v3Now] *= drag;
          waterVel[v3Now + 2] *= drag;

          pos[i3Now] += waterVel[v3Now] * dt;
          pos[i3Now + 1] += waterVel[v3Now + 1] * dt;
          pos[i3Now + 2] += waterVel[v3Now + 2] * dt;

          if (pos[i3Now + 1] < 1.0 || pos[i3Now + 2] < -1.5 || Math.abs(pos[i3Now]) > 1.5) {
            resetWater(i);
          }
        }
      }

      geo.attributes.position.needsUpdate = true;

      camera.position.set(
        camState.x + Math.sin(time * 0.15) * 0.03,
        camState.y + Math.cos(time * 0.12) * 0.02,
        camState.z
      );
      camera.lookAt(lookTarget.x, lookTarget.y, lookTarget.z);

      renderer.render(scene, camera);
    }

    function startAnim() {
      if (destroyed) return;
      if (!rafId) tick();
    }

    function stopAnim() {
      if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
      tl.pause();
    }

    function setScrollProgress(progress) {
      var p = clamp01(progress);
      if (Math.abs(p - lastScrollProgress) < 0.0005) return;

      if (lastScrollProgress < expandStartProgress && p >= expandStartProgress) {
        expanding = true;
      }
      if (lastScrollProgress >= expandStartProgress && p < expandStartProgress) {
        expanding = false;
        restoreLowerShape();
      }

      if (lastScrollProgress < waterStartProgress && p >= waterStartProgress) {
        activateWaterBurst();
      }
      if (lastScrollProgress >= waterStartProgress && p < waterStartProgress) {
        waterActive = false;
        resetWaterState();
      }

      lastScrollProgress = p;
      scrollProgress = p;
      tl.progress(p);
    }

    function setScatterProgress(progress) {
      mat.uniforms.uScatter.value = clamp01(progress);
    }

    function getSampledPositions(maxCount) {
      var attr = geo && geo.attributes && geo.attributes.position;
      if (!attr) return [];
      var arr = attr.array;
      var total = arr.length / 3;
      if (total <= 0) return [];
      var target = Math.max(1, maxCount || 4000);
      var step = Math.max(1, Math.floor(total / target));
      var pts = [];
      for (var i = 0; i < total; i += step) {
        var i3 = i * 3;
        pts.push(new THREE.Vector3(arr[i3], arr[i3 + 1], arr[i3 + 2]));
        if (pts.length >= target) break;
      }
      return pts;
    }

    function destroy() {
      destroyed = true;
      stopAnim();
      tl.kill();
      geo.dispose();
      mat.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
    }

    function resize() {
      var r = layer.getBoundingClientRect();
      camera.aspect = r.width / r.height;
      camera.updateProjectionMatrix();
      renderer.setSize(r.width, r.height);
    }

    return {
      startAnim: startAnim,
      stopAnim: stopAnim,
      setScrollProgress: setScrollProgress,
      setScatterProgress: setScatterProgress,
      getSampledPositions: getSampledPositions,
      destroy: destroy,
      resize: resize
    };
  }

  function createHelmetCoinZoomWidget(layer) {
    var canvas = layer.querySelector('canvas');
    if (!canvas) return null;

    var N = 13000;

    var VERT = '' +
      'attribute float size;\n' +
      'attribute float aRandom;\n' +
      'attribute float aSpeed;\n' +
      'attribute float aDepth;\n' +
      'attribute float aScatterSeed;\n' +
      'varying vec3 vColor;\n' +
      'varying float vAlpha;\n' +
      'varying float vDepth;\n' +
      'uniform float uTime;\n' +
      'uniform float uMorphProgress;\n' +
      'uniform float uSizeScale;\n' +
      'uniform float uCoinMix;\n' +
      'uniform float uScatter;\n' +
      'void main(){\n' +
      '  vColor=color;\n' +
      '  vDepth=aDepth;\n' +
      '  vec3 p=position;\n' +
      '  float turb=(1.0-uMorphProgress*0.7);\n' +
      '  float t2=uTime*0.4+aRandom*6.2831;\n' +
      '  p.x+=sin(t2*aSpeed)*0.025*turb;\n' +
      '  p.y+=cos(t2*0.7*aSpeed)*0.025*turb;\n' +
      '  p.z+=sin(t2*0.5+aRandom*3.14)*0.015*turb;\n' +
      '  if(uScatter>0.0001){\n' +
      '    float ang=aScatterSeed*6.2831+uTime*0.38;\n' +
      '    vec3 sdir=normalize(vec3(cos(ang)+p.x*0.08,sin(ang*1.19)+p.y*0.08,sin(ang*0.61)+p.z*0.08));\n' +
      '    p+=sdir*uScatter*(5.2+aRandom*2.3);\n' +
      '  }\n' +
      '  vec4 mv=modelViewMatrix*vec4(p,1.0);\n' +
      '  gl_Position=projectionMatrix*mv;\n' +
      '  float cullNoise=sin(aRandom*43.7+position.x*11.3+position.y*7.9)*0.15;\n' +
      '  float cullThreshold=(0.75+cullNoise*0.6)*uCoinMix;\n' +
      '  float coinCull=smoothstep(cullThreshold-0.03,cullThreshold,aRandom);\n' +
      '  float coinSizeVar=1.0+uCoinMix*(fract(aRandom*127.1)-0.5)*0.6;\n' +
      '  float depthScale=mix(1.0,aDepth,uCoinMix);\n' +
      '  float sa=size*uSizeScale*(180.0/-mv.z)*coinSizeVar*depthScale;\n' +
      '  float proxBoost=1.0+uCoinMix*smoothstep(2.0,0.3,-mv.z)*0.8;\n' +
      '  gl_PointSize=clamp(sa*proxBoost,0.4,30.0)*coinCull;\n' +
      '  float dist=length(mv.xyz);\n' +
      '  float baseAlpha=smoothstep(50.0,3.0,dist)*(0.4+0.4*aRandom);\n' +
      '  vAlpha=baseAlpha*coinCull*mix(1.0,aDepth,uCoinMix);\n' +
      '}';

    var FRAG = '' +
      'uniform sampler2D uCoinTex;\n' +
      'uniform float uCoinMix;\n' +
      'varying vec3 vColor;\n' +
      'varying float vAlpha;\n' +
      'varying float vDepth;\n' +
      'void main(){\n' +
      '  float d=length(gl_PointCoord-0.5);\n' +
      '  if(d>0.5)discard;\n' +
      '  float core=smoothstep(0.5,0.05,d);\n' +
      '  float glow=smoothstep(0.5,0.25,d);\n' +
      '  float depthAlpha=mix(1.0,vDepth,uCoinMix);\n' +
      '  float discAlpha=(core*0.7+glow*0.25)*vAlpha*depthAlpha;\n' +
      '  vec4 discColor=vec4(vColor,discAlpha);\n' +
      '  vec2 coinUV=vec2(gl_PointCoord.x,1.0-gl_PointCoord.y);\n' +
      '  vec4 coinSample=texture2D(uCoinTex,coinUV);\n' +
      '  float coinAlpha=coinSample.a*vAlpha*1.2*depthAlpha;\n' +
      '  vec4 coinColor=vec4(vColor*coinSample.rgb,coinAlpha);\n' +
      '  gl_FragColor=mix(discColor,coinColor,uCoinMix);\n' +
      '}';

    var rect = layer.getBoundingClientRect();
    var renderer = new THREE.WebGLRenderer({
      canvas: canvas,
      antialias: false,
      alpha: true,
      powerPreference: 'high-performance'
    });
    renderer.setSize(rect.width, rect.height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));

    var scene = new THREE.Scene();
    var camera = new THREE.PerspectiveCamera(55, rect.width / rect.height, 0.1, 100);
    camera.position.set(0, 0, 9);

    var geo = new THREE.BufferGeometry();
    var pos = new Float32Array(N * 3);
    var col = new Float32Array(N * 3);
    var szs = new Float32Array(N);
    var rnd = new Float32Array(N);
    var spd = new Float32Array(N);
    var depth = new Float32Array(N);
    var scatterSeed = new Float32Array(N);

    var seedPoints = null;
    if (window.BxParticleCore && typeof window.BxParticleCore.generateHelmetShape === 'function') {
      seedPoints = window.BxParticleCore.generateHelmetShape(N);
    }

    var i;
    for (i = 0; i < N; i++) {
      var i3 = i * 3;
      if (seedPoints && seedPoints[i]) {
        pos[i3] = seedPoints[i].x;
        pos[i3 + 1] = seedPoints[i].y;
        pos[i3 + 2] = seedPoints[i].z;
      } else {
        pos[i3] = (Math.random() - 0.5) * 2.0;
        pos[i3 + 1] = (Math.random() - 0.5) * 2.0;
        pos[i3 + 2] = (Math.random() - 0.5) * 2.0;
      }
    }

    for (i = 0; i < N; i++) {
      var i3c = i * 3;
      var s = 0.7 + Math.random() * 0.18;
      col[i3c] = s;
      col[i3c + 1] = s;
      col[i3c + 2] = s;
      szs[i] = 0.315 * (0.3 + Math.random() * 0.7);
      rnd[i] = Math.random();
      spd[i] = 0.5 + Math.random() * 0.5;
      depth[i] = 0.85 + Math.random() * 0.3;
      scatterSeed[i] = Math.random();
    }

    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.setAttribute('size', new THREE.BufferAttribute(szs, 1));
    geo.setAttribute('aRandom', new THREE.BufferAttribute(rnd, 1));
    geo.setAttribute('aSpeed', new THREE.BufferAttribute(spd, 1));
    geo.setAttribute('aDepth', new THREE.BufferAttribute(depth, 1));
    geo.setAttribute('aScatterSeed', new THREE.BufferAttribute(scatterSeed, 1));

    var coinTex = new THREE.Texture();
    coinTex.needsUpdate = false;
    makeCoinTexture(COIN_SVG, function (cv) {
      coinTex.image = cv;
      coinTex.needsUpdate = true;
    });

    var mat = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms: {
        uTime: { value: 0 },
        uMorphProgress: { value: 0.95 },
        uSizeScale: { value: 1.0 },
        uCoinTex: { value: coinTex },
        uCoinMix: { value: 0.0 },
        uScatter: { value: 0.0 }
      },
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });

    var particles = new THREE.Points(geo, mat);
    scene.add(particles);

    var time = 0;
    var lastFrame = 0;
    var destroyed = false;
    var rafId = null;
    var lastScrollProgress = -1;

    var camState = { x: 0, y: 0, z: 9 };
    var lookTarget = { x: 0, y: 0, z: 0 };
    var rotState = { speed: 0.3 };
    var sizeState = { scale: 1.0 };
    var coinState = { mix: 0.0 };

    var tl = gsap.timeline({ paused: true });
    tl.to(camState, { z: 3.2, y: 0.05, duration: 5.0, ease: 'power1.inOut' }, 4.0);
    tl.to(lookTarget, { y: 0.02, duration: 5.0, ease: 'power1.inOut' }, 4.0);
    tl.to(sizeState, { scale: 1.08, duration: 5.0, ease: 'power1.inOut' }, 4.0);
    tl.to(rotState, { speed: 0.16, duration: 5.0, ease: 'power1.inOut' }, 4.0);

    // Bump beat before final dive to coin reveal.
    tl.to(camState, { z: 3.9, duration: 1.2, ease: 'power1.out' }, 9.2);
    tl.to(camState, { z: 3.0, duration: 1.0, ease: 'power2.in' }, 10.4);

    tl.to(camState, { x: 0.12, y: 0.04, z: 0.9, duration: 6.2, ease: 'power2.inOut' }, 11.8);
    tl.to(lookTarget, { x: 0.08, y: 0.02, z: -0.25, duration: 6.2, ease: 'power2.inOut' }, 11.8);
    tl.to(sizeState, { scale: 1.42, duration: 6.2, ease: 'power2.inOut' }, 11.8);
    tl.to(coinState, { mix: 1.0, duration: 5.6, ease: 'power2.inOut' }, 12.1);
    tl.to(rotState, { speed: 0.06, duration: 6.2, ease: 'power2.inOut' }, 11.8);

    function tick(now) {
      if (destroyed) return;
      rafId = requestAnimationFrame(tick);

      if (!now) now = performance.now();
      var dt = lastFrame ? Math.min((now - lastFrame) / 1000, 0.05) : 0.016;
      lastFrame = now;
      time += dt;

      mat.uniforms.uTime.value = time;
      mat.uniforms.uSizeScale.value = sizeState.scale;
      mat.uniforms.uCoinMix.value = coinState.mix;

      particles.rotation.y += dt * rotState.speed;

      camera.position.set(
        camState.x + Math.sin(time * 0.15) * 0.03,
        camState.y + Math.cos(time * 0.12) * 0.02,
        camState.z
      );
      camera.lookAt(lookTarget.x, lookTarget.y, lookTarget.z);

      renderer.render(scene, camera);
    }

    function startAnim() {
      if (destroyed) return;
      if (!rafId) tick();
    }

    function stopAnim() {
      if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
      tl.pause();
    }

    function setScrollProgress(progress) {
      var p = clamp01(progress);
      if (Math.abs(p - lastScrollProgress) < 0.0005) return;
      lastScrollProgress = p;
      tl.progress(p);
    }

    function setScatterProgress(progress) {
      mat.uniforms.uScatter.value = clamp01(progress);
    }

    function getSampledPositions(maxCount) {
      var attr = geo && geo.attributes && geo.attributes.position;
      if (!attr) return [];
      var arr = attr.array;
      var total = arr.length / 3;
      if (total <= 0) return [];
      var target = Math.max(1, maxCount || 4000);
      var step = Math.max(1, Math.floor(total / target));
      var pts = [];
      for (var i = 0; i < total; i += step) {
        var i3 = i * 3;
        pts.push(new THREE.Vector3(arr[i3], arr[i3 + 1], arr[i3 + 2]));
        if (pts.length >= target) break;
      }
      return pts;
    }

    function destroy() {
      destroyed = true;
      stopAnim();
      tl.kill();
      geo.dispose();
      mat.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
    }

    function resize() {
      var r = layer.getBoundingClientRect();
      camera.aspect = r.width / r.height;
      camera.updateProjectionMatrix();
      renderer.setSize(r.width, r.height);
    }

    return {
      startAnim: startAnim,
      stopAnim: stopAnim,
      setScrollProgress: setScrollProgress,
      setScatterProgress: setScatterProgress,
      getSampledPositions: getSampledPositions,
      destroy: destroy,
      resize: resize
    };
  }

  function initPinnedScroll(section, layers, instances, hooks) {
    if (typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined') return;

    gsap.registerPlugin(ScrollTrigger);

    var paragraph = section.querySelector('.ar-paragraph');
    var track = section.querySelector('.bx-hscroll__track');
    var lastProgress = -1;

    applyWidgetBlend(layers, instances, 0);
    applyWidgetScatter(instances, 0);
    applyWidgetScrollProgress(instances, 0);
    stopAllInstances(instances);
    if (track) gsap.set(track, { xPercent: 0 });

    if (paragraph) {
      gsap.set(paragraph, { opacity: 0 });
      ScrollTrigger.create({
        trigger: section,
        start: 'top top',
        end: PIN_END,
        onEnter: function () { gsap.to(paragraph, { opacity: 1, duration: 0.3 }); },
        onLeave: function () { gsap.to(paragraph, { opacity: 0, duration: 0.3 }); },
        onEnterBack: function () { gsap.to(paragraph, { opacity: 1, duration: 0.3 }); },
        onLeaveBack: function () { gsap.to(paragraph, { opacity: 0, duration: 0.3 }); }
      });
    }

    ScrollTrigger.create({
      trigger: section,
      start: 'top top',
      end: PIN_END,
      pin: true,
      pinSpacing: true,
      scrub: 0.8,
      anticipatePin: 1,
      onEnter: function () {
        applyWidgetBlend(layers, instances, 0);
        applyWidgetScatter(instances, 0);
        applyWidgetScrollProgress(instances, 0);
        if (track) gsap.set(track, { xPercent: 0 });
        if (hooks && typeof hooks.onEnter === 'function') hooks.onEnter();
      },
      onEnterBack: function () {
        applyWidgetBlend(layers, instances, 1);
        applyWidgetScatter(instances, 1);
        applyWidgetScrollProgress(instances, 1);
        if (track) gsap.set(track, { xPercent: -200 });
        if (hooks && typeof hooks.onEnterBack === 'function') hooks.onEnterBack();
      },
      onLeave: function () {
        applyWidgetScatter(instances, 1);
        applyWidgetScrollProgress(instances, 1);
        if (hooks && typeof hooks.onLeave === 'function') hooks.onLeave();
      },
      onLeaveBack: function () {
        applyWidgetScatter(instances, 0);
        applyWidgetScrollProgress(instances, 0);
        stopAllInstances(instances);
        if (hooks && typeof hooks.onLeaveBack === 'function') hooks.onLeaveBack();
      },
      onUpdate: function (self) {
        var p = self.progress;
        if (Math.abs(p - lastProgress) < 0.0008) return;
        lastProgress = p;

        applyWidgetBlend(layers, instances, p);
        applyWidgetScatter(instances, p);
        applyWidgetScrollProgress(instances, p);
        if (track) gsap.set(track, { xPercent: textTrackX(p) });
        if (hooks && typeof hooks.onUpdate === 'function') hooks.onUpdate(p);
      }
    });

    // Keep the last pattern alive after unpin, then stop only when Adios is fully out of view.
    ScrollTrigger.create({
      trigger: section,
      start: 'bottom top',
      onEnter: function () {
        stopAllInstances(instances);
        if (hooks && typeof hooks.onFullyOut === 'function') hooks.onFullyOut();
      },
      onLeaveBack: function () {
        applyWidgetBlend(layers, instances, 1);
        applyWidgetScatter(instances, 1);
        applyWidgetScrollProgress(instances, 1);
      }
    });
  }

  /* ── Fixed header fade (matches imaginemos pattern) ── */

  function initFixedHeaderFade(section, header) {
    if (!header) return;
    if (typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined') return;
    gsap.registerPlugin(ScrollTrigger);

    var label = header.querySelector('.ar-label');
    var heading = header.querySelector('.ar-heading');

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
      end: PIN_END,          // +=460% — matches the section's pin duration
      onEnter: staggerIn,
      onLeave: fadeOut,
      onEnterBack: staggerIn,
      onLeaveBack: resetHidden
    });
  }

  function init() {
    var section = document.getElementById('adios-riesgos');
    if (!section || typeof THREE === 'undefined' || typeof gsap === 'undefined') return;

    var urgentLayer = section.querySelector('.ar-shape-layer--urgent');
    var helmetLayer = section.querySelector('.ar-shape-layer--helmet');
    var sidewalkLayer = section.querySelector('.ar-shape-layer--sidewalk');

    var layers = [urgentLayer, helmetLayer, sidewalkLayer];

    var urgentWidget = urgentLayer ? createBuildingUrgentFixWidget(urgentLayer) : null;
    var helmetWidget = helmetLayer ? createHelmetCoinZoomWidget(helmetLayer) : null;
    var sidewalkWidget = sidewalkLayer ? createBuildingSidewalkWidget(sidewalkLayer) : null;

    var instances = [urgentWidget, helmetWidget, sidewalkWidget];

    for (var i = 0; i < instances.length; i++) {
      if (instances[i]) instances[i].__running = false;
    }

    var ambient = null;
    var ambientVisible = false;
    var ambientFeedTs = 0;
    var ambientLifecycleBound = false;

    function ensureAmbient() {
      if (ambient) return ambient;
      if (typeof ScrollTrigger === 'undefined') return null;
      if (!window.BxAmbientShell || !window.BxParticleCore) return null;

      ambient = BxAmbientShell.create({
        color: BxParticleCore.COLORS.primary,
        particleCount: 5000,
        parallaxFactor: 0.3,
        floatMotion: true,
        floatIntensity: 0.42,
        floatInterval: 2.2
      });

      if (!ambientLifecycleBound) {
        ambientLifecycleBound = true;
        ScrollTrigger.create({
          trigger: '#hola-eficiencia',
          start: 'bottom bottom',
          onLeave: function () {
            if (!ambient || !ambientVisible) return;
            ambient.fadeOut(0.9);
            ambientVisible = false;
          },
          onEnterBack: function () {
            if (!ambient || ambientVisible) return;
            ambient.fadeIn(0.35);
            ambientVisible = true;
          }
        });
      }

      return ambient;
    }

    function showAmbient(duration) {
      var amb = ensureAmbient();
      if (!amb || ambientVisible) return;
      amb.fadeIn(duration || 0.4);
      ambientVisible = true;
    }

    function hideAmbient(duration) {
      if (!ambient || !ambientVisible) return;
      ambient.fadeOut(duration || 0.25);
      ambientVisible = false;
    }

    function feedAmbient(progress, force) {
      var amb = ensureAmbient();
      if (!amb) return;
      var now = performance.now();
      if (!force && (now - ambientFeedTs) < 120) return;

      var sourceIdx = getDominantWidgetIndex(progress);
      var sourceInst = instances[sourceIdx] || instances[2] || instances[1] || instances[0];
      var pts = sampleInstanceParticles(sourceInst, 4200);
      if (!pts.length) return;

      amb.feedParticles(pts);
      ambientFeedTs = now;
    }

    initPinnedScroll(section, layers, instances, {
      onUpdate: function (progress) {
        if (progress >= END_SCATTER_START) {
          showAmbient(0.35);
          feedAmbient(progress, false);
        } else if (progress < END_SCATTER_START - 0.05) {
          hideAmbient(0.25);
        }
      },
      onLeave: function () {
        showAmbient(0.2);
        feedAmbient(1, true);
      },
      onEnterBack: function () {
        showAmbient(0.2);
        feedAmbient(1, true);
      },
      onLeaveBack: function () {
        hideAmbient(0.2);
      }
    });

    window.addEventListener('resize', function () {
      for (var j = 0; j < instances.length; j++) {
        if (instances[j] && typeof instances[j].resize === 'function') {
          instances[j].resize();
        }
      }
    });

    // Fixed header fade (replaces BxStickyHeaders)
    var arHeader = section.querySelector('.ar-header');
    initFixedHeaderFade(section, arHeader);
  }

  return { init: init };
})();
