/* =========================================================
   preloader.js — Centralized asset preloader for Bexalta V2
   =========================================================
   Preloads SVGs, images, and image-sequence frames before
   the page becomes interactive. Exposes globals that other
   modules consume:
     window.__bxPreloadedSVGs   — fetched SVG markup (text)
     window.__bxPreloadedFrames — Image objects per sequence
     window.__bxPreloaderReady  — Promise (resolves on done)
     window.__bxDismissPreloader — fades out the overlay
   ========================================================= */

(function () {
  'use strict';

  /* ---- Asset manifest ---------------------------------- */

  var SVGS = [
    'assets/logo_bexalta_white.svg',
    'assets/logo_foundtech_whitegreen.svg'
  ];

  var IMAGES = [
    'assets/foundtech-logo.png',
    'assets/logo-dhl.png',
    'assets/logo-nestle.png',
    'assets/logo-roche.png',
    'assets/logo-google.png',
    'assets/logo-zurich-airport.png',
    'assets/logo-dupont.png'
  ];

  var SEQUENCES = [
    { folder: './sequence/gliding_field/', count: 60,  pad: 4, startIndex: 1 },
    { folder: './sequence/audi/',          count: 60,  pad: 4, startIndex: 1 },
    { folder: './sequence/real_building_01/', count: 127, pad: 4, startIndex: 1 },
    { folder: './sequence/real_building_02/', count: 113, pad: 4, startIndex: 1 }
  ];

  var MAX_CONCURRENT = 30;
  var SAFETY_TIMEOUT = 15000; // ms

  /* ---- Totals ------------------------------------------ */

  var totalSequenceFrames = 0;
  var s;
  for (s = 0; s < SEQUENCES.length; s++) {
    totalSequenceFrames += SEQUENCES[s].count;
  }
  var totalCount = SVGS.length + IMAGES.length + totalSequenceFrames; // 369
  var loadedCount = 0;

  /* ---- DOM references ---------------------------------- */

  var barEl = null;
  var textEl = null;

  function getDOM() {
    barEl = document.querySelector('.bx-preloader__bar');
    textEl = document.querySelector('.bx-preloader__text');
  }

  /* ---- Progress tracking ------------------------------- */

  function tick() {
    loadedCount++;
    if (barEl) {
      barEl.style.width = (loadedCount / totalCount * 100) + '%';
    }
    if (textEl) {
      textEl.textContent = loadedCount + ' / ' + totalCount;
    }
  }

  /* ---- Globals ----------------------------------------- */

  window.__bxPreloadedSVGs = {};
  window.__bxPreloadedFrames = {};

  /* ---- SVG loader -------------------------------------- */

  function loadSVG(url) {
    return fetch(url)
      .then(function (res) { return res.text(); })
      .then(function (text) {
        window.__bxPreloadedSVGs[url] = text;
        tick();
      })
      .catch(function () {
        // Graceful degradation: count as loaded even on error
        tick();
      });
  }

  /* ---- Image loader (cache-warm only) ------------------ */

  function loadImage(url) {
    return new Promise(function (resolve) {
      var img = new Image();
      img.onload = function () { tick(); resolve(); };
      img.onerror = function () { tick(); resolve(); };
      img.src = url;
    });
  }

  /* ---- Sequence loader (batched concurrency) ----------- */

  function loadSequence(seq) {
    var folder = seq.folder;
    var count = seq.count;
    var pad = seq.pad;
    var startIndex = seq.startIndex;

    // Pre-allocate array
    window.__bxPreloadedFrames[folder] = new Array(count);

    // Build list of jobs
    var jobs = [];
    var i;
    for (i = 0; i < count; i++) {
      jobs.push({ index: i, url: folder + 'frame_' + String(i + startIndex).padStart(pad, '0') + '.webp' });
    }

    // Process jobs in batches of MAX_CONCURRENT
    var cursor = 0;

    function nextBatch() {
      if (cursor >= jobs.length) {
        return Promise.resolve();
      }

      var batch = jobs.slice(cursor, cursor + MAX_CONCURRENT);
      cursor += MAX_CONCURRENT;

      var promises = [];
      var b;
      for (b = 0; b < batch.length; b++) {
        promises.push((function (job) {
          return new Promise(function (resolve) {
            var img = new Image();
            img.onload = function () {
              window.__bxPreloadedFrames[folder][job.index] = img;
              tick();
              resolve();
            };
            img.onerror = function () {
              // Store a blank Image so the array index exists
              window.__bxPreloadedFrames[folder][job.index] = img;
              tick();
              resolve();
            };
            img.src = job.url;
          });
        })(batch[b]));
      }

      return Promise.all(promises).then(nextBatch);
    }

    return nextBatch();
  }

  /* ---- Dismiss preloader ------------------------------- */

  window.__bxDismissPreloader = function () {
    var overlay = document.getElementById('bx-preloader');
    if (!overlay) return;

    overlay.classList.add('bx-preloader--done');
    document.body.classList.remove('bx-loading');

    setTimeout(function () {
      overlay.style.display = 'none';
    }, 600);
  };

  /* ---- Main load orchestrator -------------------------- */

  var resolveReady;
  window.__bxPreloaderReady = new Promise(function (resolve) {
    resolveReady = resolve;
  });

  function runPreload() {
    getDOM();

    var promises = [];

    // SVGs
    var si;
    for (si = 0; si < SVGS.length; si++) {
      promises.push(loadSVG(SVGS[si]));
    }

    // Standalone images
    var ii;
    for (ii = 0; ii < IMAGES.length; ii++) {
      promises.push(loadImage(IMAGES[ii]));
    }

    // Image sequences
    var qi;
    for (qi = 0; qi < SEQUENCES.length; qi++) {
      promises.push(loadSequence(SEQUENCES[qi]));
    }

    // Safety timeout — resolve even if some assets failed to load
    var timedOut = false;
    var safetyTimer = setTimeout(function () {
      timedOut = true;
      console.log('[BxPreloader] Safety timeout reached (' + loadedCount + '/' + totalCount + ' loaded). Proceeding.');
      resolveReady();
    }, SAFETY_TIMEOUT);

    Promise.all(promises).then(function () {
      if (!timedOut) {
        clearTimeout(safetyTimer);
        console.log('[BxPreloader] All assets loaded (' + loadedCount + '/' + totalCount + ')');
        resolveReady();
      }
    });
  }

  /* ---- Bootstrap --------------------------------------- */

  function init() {
    document.body.classList.add('bx-loading');
    runPreload();
  }

  if (document.body) {
    init();
  } else {
    document.addEventListener('DOMContentLoaded', init);
  }

})();
