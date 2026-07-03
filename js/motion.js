/* ============================================================
   LYCEUM CONNECT — Cursor-reactive motion layer
   Opt-in via data attributes, applied on DOM ready.
     data-tilt="6"        3D tilt toward cursor + spotlight glow
     data-spotlight        cursor-following glow only (no tilt)
     data-magnetic="0.25"  element gently pulls toward the cursor
   Disabled for touch/coarse pointers and prefers-reduced-motion.
   ============================================================ */
(function () {
  'use strict';

  var finePointer = window.matchMedia('(pointer: fine)').matches;
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!finePointer || reduceMotion) return;

  var DEFAULT_TILT = 6;      // max degrees of rotation
  var DEFAULT_PULL = 0.22;   // fraction of cursor offset applied

  // --- 3D tilt + spotlight -------------------------------------------------
  function initTilt(el, glowOnly) {
    var raf = null, rect = null;
    var max = glowOnly ? 0 : (parseFloat(el.dataset.tilt) || DEFAULT_TILT);

    function measure() { rect = el.getBoundingClientRect(); }

    function onMove(e) {
      if (!rect) measure();
      var px = (e.clientX - rect.left) / rect.width;   // 0..1
      var py = (e.clientY - rect.top) / rect.height;   // 0..1
      px = Math.min(1, Math.max(0, px));
      py = Math.min(1, Math.max(0, py));
      el.style.setProperty('--mx', (px * 100).toFixed(1) + '%');
      el.style.setProperty('--my', (py * 100).toFixed(1) + '%');
      if (max) {
        var rx = (0.5 - py) * max * 2;
        var ry = (px - 0.5) * max * 2;
        if (raf) cancelAnimationFrame(raf);
        raf = requestAnimationFrame(function () {
          el.style.transform =
            'perspective(800px) rotateX(' + rx.toFixed(2) + 'deg) rotateY(' +
            ry.toFixed(2) + 'deg) scale(1.035)';
        });
      }
    }

    function onEnter() { measure(); el.classList.add('is-pointing'); }
    function onLeave() {
      rect = null;
      if (raf) cancelAnimationFrame(raf);
      el.classList.remove('is-pointing');
      if (max) el.style.transform = '';
    }

    el.addEventListener('pointerenter', onEnter);
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerleave', onLeave);
    window.addEventListener('scroll', function () { rect = null; }, { passive: true });
  }

  // --- Magnetic pull -------------------------------------------------------
  function initMagnetic(el) {
    var raf = null, rect = null;
    var pull = parseFloat(el.dataset.magnetic) || DEFAULT_PULL;

    function onMove(e) {
      if (!rect) rect = el.getBoundingClientRect();
      var mx = e.clientX - (rect.left + rect.width / 2);
      var my = e.clientY - (rect.top + rect.height / 2);
      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(function () {
        el.style.transform =
          'translate(' + (mx * pull).toFixed(1) + 'px,' + (my * pull).toFixed(1) + 'px)';
      });
    }
    function onEnter() { rect = el.getBoundingClientRect(); }
    function onLeave() {
      rect = null;
      if (raf) cancelAnimationFrame(raf);
      el.style.transform = '';
    }

    el.addEventListener('pointerenter', onEnter);
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerleave', onLeave);
  }

  function init() {
    document.querySelectorAll('[data-tilt]').forEach(function (el) { initTilt(el, false); });
    document.querySelectorAll('[data-spotlight]').forEach(function (el) { initTilt(el, true); });
    document.querySelectorAll('[data-magnetic]').forEach(initMagnetic);
  }

  if (document.readyState !== 'loading') init();
  else document.addEventListener('DOMContentLoaded', init);
})();
