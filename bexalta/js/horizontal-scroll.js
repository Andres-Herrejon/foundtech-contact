window.BxHorizontalScroll = (function () {
  'use strict';
  return {
    /**
     * @param {HTMLElement} container - The .bx-hscroll element
     * @param {Object} config
     * @param {number} config.scrubSpeed - ScrollTrigger scrub value (default 1)
     * @param {string} config.ease - GSAP ease (default 'none')
     * @returns {{ timeline: gsap.core.Timeline, scrollTrigger: ScrollTrigger, destroy: Function }}
     */
    create: function (container, config) {
      config = config || {};
      var track = container.querySelector('.bx-hscroll__track');
      var pages = track.querySelectorAll('.bx-hscroll__page');
      var pageCount = pages.length;
      if (pageCount < 2) return null;

      var tl = gsap.to(track, {
        xPercent: -100 * (pageCount - 1),
        ease: config.ease || 'none',
        scrollTrigger: {
          trigger: container,
          start: 'top bottom',
          end: '+=' + (pageCount - 1) * 100 + '%',
          scrub: config.scrubSpeed || 1,
          // Note: pin is handled by the PARENT section, not here
        }
      });

      return {
        timeline: tl,
        scrollTrigger: tl.scrollTrigger,
        destroy: function () { tl.scrollTrigger.kill(); tl.kill(); }
      };
    }
  };
})();
