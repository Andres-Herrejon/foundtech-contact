/* ══════════════════════════════════════════════════════════════
   motion-prefs.js — Prefers-reduced-motion helper
   Bexalta V2 | T0.2
   ══════════════════════════════════════════════════════════════ */

window.BxMotionPrefs = (function () {
  'use strict';
  var mq = window.matchMedia('(prefers-reduced-motion: reduce)');
  var reduced = mq.matches;
  mq.addEventListener('change', function (e) { reduced = e.matches; });
  return {
    isReduced: function () { return reduced; },
    duration: function (ms) { return reduced ? 0 : ms; },
    gsapDuration: function (s) { return reduced ? 0.01 : s; }
  };
})();
