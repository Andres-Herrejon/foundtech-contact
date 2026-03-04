window.BxAmbientShell = (function () {
  'use strict';

  function makeFloatingTarget(basePoints, phase, amp) {
    var pts = [];
    for (var i = 0; i < basePoints.length; i++) {
      var b = basePoints[i];
      var p = phase + i * 0.017;
      pts.push(new THREE.Vector3(
        b.x + Math.sin(p * 1.37) * amp,
        b.y + Math.cos(p * 1.11) * amp * 0.72,
        b.z + Math.sin(p * 0.93 + i * 0.013) * amp * 0.9
      ));
    }
    return pts;
  }

  return {
    create: function (config) {
      config = config || {};
      // config.color, config.particleCount, config.parallaxFactor, config.container
      var canvas = document.createElement('canvas');
      canvas.className = 'bx-ambient-canvas';
      canvas.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;z-index:0;pointer-events:none;opacity:0;';
      (config.container || document.body).appendChild(canvas);

      var count = config.particleCount || ((window.innerWidth < 768) ? 2000 : 5000);
      var inst = BxParticleCore.create(canvas, {
        count: count,
        waveMode: false,
        rotate: false,
        camZ: 20
      });
      if (!inst) return;
      var baseAmbient = BxParticleCore.generateAmbient(count);
      inst.setTarget(baseAmbient);
      inst.setColor(
        config.color || BxParticleCore.COLORS.primary,
        BxParticleCore.COLORS.white, 0.3
      );

      var floating = config.floatMotion !== false;
      var floatAmp = typeof config.floatIntensity === 'number' ? config.floatIntensity : 0.35;
      var floatIntervalMs = Math.max(1000, (config.floatInterval || 2.4) * 1000);
      var floatPhase = 0;
      var floatTimer = null;
      var lastExternalFeedAt = 0;

      function startFloatLoop() {
        if (!floating || floatTimer) return;
        floatTimer = setInterval(function () {
          if (performance.now() - lastExternalFeedAt < 650) return;
          floatPhase += 0.9;
          inst.setTarget(makeFloatingTarget(baseAmbient, floatPhase, floatAmp));
        }, floatIntervalMs);
      }

      function stopFloatLoop() {
        if (!floatTimer) return;
        clearInterval(floatTimer);
        floatTimer = null;
      }

      var api = {
        fadeIn: function (dur) {
          gsap.to(canvas, { opacity: 1, duration: dur || 1 });
          inst.startAnim();
          startFloatLoop();
        },
        fadeOut: function (dur) {
          gsap.to(canvas, {
            opacity: 0,
            duration: dur || 1,
            onComplete: function () {
              stopFloatLoop();
              inst.stopAnim();
            }
          });
        },
        feedParticles: function (positions) {
          if (!positions || !positions.length) return;
          lastExternalFeedAt = performance.now();
          inst.setTarget(positions);
        },
        setFloating: function (enabled) {
          floating = !!enabled;
          if (!floating) stopFloatLoop();
          else if (canvas.style.opacity !== '0') startFloatLoop();
        },
        destroy: function () {
          stopFloatLoop();
          inst.stopAnim();
          canvas.remove();
        },
        resize: function () {
          if (inst && inst.resize) inst.resize();
        }
      };

      window.addEventListener('resize', function () {
        if (inst && inst.resize) inst.resize();
      });

      return api;
    }
  };
})();
