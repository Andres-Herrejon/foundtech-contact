window.BxParticleTransitions = (function () {
  'use strict';
  return {
    /** Explode current shape outward */
    explode: function (inst, config) {
      config = config || {};
      return inst.scatter(config.radius || 15, config.duration || 0.8);
    },

    /** Implode scattered particles into new shape */
    implode: function (inst, targetPoints, config) {
      config = config || {};
      inst.setTarget(targetPoints);
      return gsap.to(inst.mat.uniforms.uMorphProgress, {
        value: 0.9, duration: config.duration || 1.0,
        ease: 'power2.out'
      });
    },

    /** Combined: explode → hold → implode */
    transition: function (inst, targetPoints, config) {
      config = config || {};
      var tl = gsap.timeline();
      tl.add(this.explode(inst, config));
      tl.add(this.implode(inst, targetPoints, config), '+=0.2');
      return tl;
    }
  };
})();
