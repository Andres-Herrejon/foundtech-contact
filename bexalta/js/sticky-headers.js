/* ==========================================================================
   sticky-headers.js — Sticky Section Header System (T1.1 REWRITE)
   Bexalta V2 | Foundtech
   Opacity-only crossfade at fixed position. NO vertical travel.
   Clone-based overlay: headers inside overflow:hidden sections are cloned
   into a fixed overlay (#bx-header-overlay) when their section group is
   in view. Crossfade between groups (old fades out, new fades in).
   ========================================================================== */

window.BxStickyHeaders = (function () {
  'use strict';
  var overlay = null;
  var activeClone = null;
  var activeGroup = null;
  var groups = {};
  var lockedGroups = {};
  var linkedTransitions = {};

  function clamp01(v) {
    if (v < 0) return 0;
    if (v > 1) return 1;
    return v;
  }

  function resolveSection(sectionRef) {
    if (!sectionRef) return null;
    if (typeof sectionRef === 'string') {
      if (sectionRef.charAt(0) === '#') return document.querySelector(sectionRef);
      return document.getElementById(sectionRef) || document.querySelector(sectionRef);
    }
    if (sectionRef.nodeType === 1) return sectionRef;
    return null;
  }

  function ensureGroup(groupId, header) {
    if (!groups[groupId]) {
      groups[groupId] = { header: null, clone: null };
    }
    if (header) groups[groupId].header = header;
    return groups[groupId];
  }

  /**
   * Build an isolated overlay clone.
   * We only copy header inner markup so section-specific wrapper classes
   * (absolute positioning, top offsets, reveal transforms) never affect
   * sticky placement.
   */
  function createClone(header, groupId) {
    var clone = document.createElement('div');
    clone.className = 'bx-sticky-header-clone';
    clone.dataset.bxGroupId = groupId;
    clone.innerHTML = header.innerHTML;
    clone.style.cssText =
      'position:relative;' +
      'top:auto;left:auto;right:auto;' +
      'width:100%;' +
      'max-width:var(--bx-section-width);' +
      'box-sizing:border-box;' +
      'margin:0 auto;' +
      'padding-top:var(--bx-header-top);' +
      'padding-left:var(--bx-padding-x);' +
      'padding-right:var(--bx-padding-x);' +
      'display:flex;' +
      'flex-direction:column;' +
      'align-items:flex-start;' +
      'gap:8px;' +
      'opacity:0;';
    clone.setAttribute('aria-hidden', 'true');
    return clone;
  }

  function ensureClone(groupId, header) {
    if (!overlay) return null;

    var group = ensureGroup(groupId, header);
    if (!group.header) return null;

    if (group.clone && group.clone.isConnected) return group.clone;

    var clone = createClone(group.header, groupId);
    overlay.appendChild(clone);
    group.clone = clone;
    return clone;
  }

  function removeClone(groupId, clone) {
    var group = groups[groupId];
    var node = clone || (group ? group.clone : null);
    if (!node) return;

    if (node.parentNode) node.parentNode.removeChild(node);
    if (group && group.clone === node) group.clone = null;

    if (activeClone === node) {
      activeClone = null;
      if (activeGroup === groupId) activeGroup = null;
    }
  }

  function fadeOutAndRemove(groupId, clone, duration) {
    if (!clone) return;
    gsap.killTweensOf(clone);
    gsap.to(clone, {
      opacity: 0,
      duration: duration || 0.2,
      ease: 'power1.out',
      onComplete: function () { removeClone(groupId, clone); }
    });
  }

  /* Keep source headers hidden; overlay clone is the only visible header. */
  function hideOriginal(header) {
    header.style.visibility = 'hidden';
  }

  function activate(groupId, header) {
    if (!overlay) return;
    if (lockedGroups[groupId]) return;

    var nextClone = ensureClone(groupId, header);
    if (!nextClone) return;
    if (activeGroup === groupId && activeClone === nextClone) return;

    // Crossfade from current active clone (if any).
    if (activeClone && activeClone !== nextClone) {
      var oldClone = activeClone;
      var oldGroup = activeGroup;
      gsap.to(oldClone, {
        opacity: 0,
        duration: 0.2,
        ease: 'power1.out',
        onComplete: function () { removeClone(oldGroup, oldClone); }
      });
    }

    activeClone = nextClone;
    activeGroup = groupId;

    gsap.killTweensOf(nextClone);
    gsap.to(nextClone, {
      opacity: 1,
      duration: 0.2,
      ease: 'power1.out'
    });
  }

  function deactivate(groupId) {
    if (lockedGroups[groupId]) return;
    if (!activeClone || activeGroup !== groupId) return;

    // Defer one frame so adjacent section activations can take over
    // without a blank frame at boundary transitions.
    var group = groups[groupId];
    var leavingClone = group ? group.clone : activeClone;
    requestAnimationFrame(function () {
      var current = groups[groupId] ? groups[groupId].clone : null;
      if (!current || current !== leavingClone || activeGroup !== groupId || lockedGroups[groupId]) return;

      activeClone = null;
      activeGroup = null;

      fadeOutAndRemove(groupId, leavingClone, 0.2);
    });
  }

  function applySplitBlend(fromGroupId, toGroupId, progress, split) {
    var fromClone = ensureClone(fromGroupId);
    var toClone = ensureClone(toGroupId);
    if (!fromClone || !toClone) return;

    var p = clamp01(progress);
    var splitPoint = clamp01(split);
    var fromOpacity = 0;
    var toOpacity = 0;

    if (splitPoint <= 0) {
      fromOpacity = 0;
      toOpacity = p;
    } else if (splitPoint >= 1) {
      fromOpacity = 1 - p;
      toOpacity = 0;
    } else if (p <= splitPoint) {
      fromOpacity = 1 - (p / splitPoint);
      toOpacity = 0;
    } else {
      fromOpacity = 0;
      toOpacity = (p - splitPoint) / (1 - splitPoint);
    }

    gsap.killTweensOf(fromClone);
    gsap.killTweensOf(toClone);
    fromClone.style.opacity = String(clamp01(fromOpacity));
    toClone.style.opacity = String(clamp01(toOpacity));

    if (toOpacity >= fromOpacity) {
      activeClone = toClone;
      activeGroup = toGroupId;
    } else {
      activeClone = fromClone;
      activeGroup = fromGroupId;
    }
  }

  function setPairLocked(fromGroupId, toGroupId, isLocked) {
    var locked = !!isLocked;
    lockedGroups[fromGroupId] = locked;
    lockedGroups[toGroupId] = locked;
  }

  return {
    init: function () {
      overlay = document.getElementById('bx-header-overlay');
      activeClone = null;
      activeGroup = null;
      groups = {};
      lockedGroups = {};
      linkedTransitions = {};
    },

    /**
     * @param {HTMLElement} sectionGroup - The pinned section or first section of group
     * @param {HTMLElement} header - The header element to make sticky
     * @param {string} endTrigger - CSS selector for the section used to end this sticky header
     * @param {string} endPosition - ScrollTrigger end expression (default: 'bottom top')
     */
    register: function (sectionGroup, header, endTrigger, endPosition) {
      var groupId = sectionGroup.id || Math.random().toString(36);
      var endExpr = endPosition || 'bottom top';
      ensureGroup(groupId, header);

      // Never show source header in-flow; prevents vertical travel artifacts.
      hideOriginal(header);

      ScrollTrigger.create({
        trigger: sectionGroup,
        start: 'top top',
        endTrigger: endTrigger || sectionGroup,
        end: endExpr,
        onToggle: function (self) {
          if (self.isActive) activate(groupId, header);
          else deactivate(groupId);
        },
        onUpdate: function (self) {
          // Safety net: if the clone gets removed while the trigger is active,
          // rebuild it immediately so the header never disappears mid-section.
          if (!self.isActive) return;
          var group = groups[groupId];
          if (!group || !group.clone || !group.clone.isConnected) {
            activate(groupId, header);
          }
        }
      });
    },

    /**
     * Link two sticky headers with a staged fade while the target section moves
     * from viewport bottom to top:
     * - first half: fade out origin header
     * - second half: fade in target header
     */
    linkSplitFade: function (fromSectionRef, toSectionRef, opts) {
      if (typeof ScrollTrigger === 'undefined') return;
      if (!overlay) return;

      var fromSection = resolveSection(fromSectionRef);
      var toSection = resolveSection(toSectionRef);
      if (!fromSection || !toSection) return;

      var fromGroupId = fromSection.id;
      var toGroupId = toSection.id;
      if (!fromGroupId || !toGroupId) return;
      if (!groups[fromGroupId] || !groups[toGroupId]) return;

      var key = fromGroupId + '->' + toGroupId;
      if (linkedTransitions[key]) return;

      var cfg = opts || {};
      var split = typeof cfg.split === 'number' ? cfg.split : 0.5;
      var startExpr = cfg.start || 'top bottom';
      var endExpr = cfg.end || 'top top';
      setPairLocked(fromGroupId, toGroupId, false);

      linkedTransitions[key] = ScrollTrigger.create({
        trigger: toSection,
        start: startExpr,
        end: endExpr,
        scrub: true,
        onRefreshInit: function () {
          setPairLocked(fromGroupId, toGroupId, false);
        },
        onToggle: function (self) {
          setPairLocked(fromGroupId, toGroupId, self.isActive);
          if (self.isActive) {
            applySplitBlend(fromGroupId, toGroupId, self.progress, split);
          }
        },
        onUpdate: function (self) {
          if (!self.isActive) return;
          applySplitBlend(fromGroupId, toGroupId, self.progress, split);
        },
        onLeave: function () {
          setPairLocked(fromGroupId, toGroupId, false);
          removeClone(fromGroupId);
          activate(toGroupId);
        },
        onLeaveBack: function () {
          setPairLocked(fromGroupId, toGroupId, false);
          removeClone(toGroupId);
          activate(fromGroupId);
        }
      });
    }
  };
})();
