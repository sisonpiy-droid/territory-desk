// Motion: small GSAP animations that explain what just happened, never decoration for its own sake.
//   - first screen eases in; a new file draws the outcome bar and counts the numbers up
//   - changing page slides the content in; opening a record or a section eases it open
//   - Ask the desk slides in, and each new message rises into place
//   - a decision that changed pulses so the eye finds it
// Safe by design: if GSAP did not load, or the person prefers reduced motion, nothing here runs and the page is unchanged.
(function () {
'use strict';
var D = window.__desk, S = D.S;
var still = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
function ok() { return !!window.gsap && !still.matches; }
function $(s, r) { return (r || document).querySelector(s); }
function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
function safe(fn) { return function () { try { if (ok()) fn.apply(null, arguments); } catch (e) { /* motion must never break the page */ } }; }
var EASE = 'power3.out';

var last = { initial: null, tab: null, ask: null, changed: '' };

// numbers that count up: 20, "9.3 h", "55%"
function countUp(el, delay) {
  var m = /^(\D*)(\d+(?:\.\d+)?)(.*)$/.exec(el.textContent.trim()); if (!m) return;
  var end = parseFloat(m[2]), dec = (m[2].split('.')[1] || '').length, o = { v: 0 };
  gsap.to(o, { v: end, duration: 0.8, delay: delay || 0, ease: 'power2.out', onUpdate: function () { el.textContent = m[1] + o.v.toFixed(dec) + m[3]; }, onComplete: function () { el.textContent = m[1] + end.toFixed(dec) + m[3]; } });
}

// a new file: bar draws, strip numbers count, rows file in
var intro = safe(function () {
  var tl = gsap.timeline({ defaults: { ease: EASE } });
  var bar = $$('.bar .seg');
  if (bar.length) tl.from(bar, { scaleX: 0, transformOrigin: 'left center', duration: 0.7, stagger: 0.08 }, 0);
  var nums = $$('.ps b, .oc b, .fchip b');
  nums.forEach(function (n, i) { countUp(n, 0.05 * i); });
  var cards = $$('.ps, .oc');
  if (cards.length) tl.from(cards, { y: 10, autoAlpha: 0, duration: 0.45, stagger: 0.05, clearProps: 'all' }, 0.05);
  var rows = $$('.rows > .row').slice(0, 14);
  if (rows.length) tl.from(rows, { y: 14, autoAlpha: 0, duration: 0.45, stagger: 0.035, clearProps: 'all' }, 0.2);
});

// a different page: the content slides in under the title
var pageIn = safe(function () {
  var body = $('#tabbody'); if (!body) return;
  gsap.from(body.children, { y: 12, autoAlpha: 0, duration: 0.4, stagger: 0.05, ease: EASE, clearProps: 'all' });
  var h = $('.page-h h1'); if (h) gsap.from(h, { x: -10, autoAlpha: 0, duration: 0.35, ease: EASE, clearProps: 'all' });
});

// Ask the desk opens from the right
var askIn = safe(function () {
  var a = $('#ask'); if (!a) return;
  gsap.from(a, { x: 36, autoAlpha: 0, duration: 0.4, ease: EASE, clearProps: 'all' });
});

// decisions that changed since the last run
var pulse = safe(function (ids) {
  var els = ids.map(function (id) { return document.getElementById('row-' + id); }).filter(Boolean);
  if (!els.length) return;
  gsap.fromTo(els, { backgroundColor: 'rgba(59, 79, 216, 0.16)' }, { backgroundColor: 'rgba(59, 79, 216, 0)', duration: 1.6, ease: 'power2.out', clearProps: 'backgroundColor' });
  gsap.from(els.map(function (e) { return $('.pill', e); }).filter(Boolean), { scale: 0.7, duration: 0.5, ease: 'back.out(2.2)', clearProps: 'transform' });
});

window.DeskExt.afterRender.push(function () {
  if (!ok()) return;
  var isNew = last.initial !== S.initial, tabChanged = last.tab !== S.tab, askOpened = S.askOpen && last.ask === false;
  var changedKey = Object.keys(S.changed || {}).sort().join(',');
  if (isNew) intro();
  else if (tabChanged && last.tab !== null) pageIn();
  else if (changedKey && changedKey !== last.changed) pulse(Object.keys(S.changed));
  if (askOpened && !isNew) askIn();
  last = { initial: S.initial, tab: S.tab, ask: !!S.askOpen, changed: changedKey };
});

// things that appear without a full render: records, record sections, chat messages, the start screen
var seen = typeof WeakSet === 'function' ? new WeakSet() : null;
function once(el) { if (!seen) return true; if (seen.has(el)) return false; seen.add(el); return true; }
var onAdded = safe(function (el) {
  if (el.classList.contains('empty')) {
    gsap.from(el.children, { y: 18, autoAlpha: 0, duration: 0.6, stagger: 0.08, ease: EASE, clearProps: 'all' });
  } else if (el.classList.contains('detail') && once(el)) {
    gsap.from(el, { autoAlpha: 0, y: -8, duration: 0.3, ease: EASE, clearProps: 'all' });
  } else if (el.classList.contains('dbody') && once(el) && el.closest('.detail') && el.closest('.detail').getAttribute('data-seen')) {
    gsap.from(el, { autoAlpha: 0, y: 6, duration: 0.25, ease: EASE, clearProps: 'all' });
  } else if (el.classList.contains('msg') && once(el)) {
    gsap.from(el, { y: 14, autoAlpha: 0, duration: 0.35, ease: EASE, clearProps: 'all' });
  } else if (el.classList.contains('notices') || el.classList.contains('only')) {
    gsap.from(el, { y: -6, autoAlpha: 0, duration: 0.3, ease: EASE, clearProps: 'all' });
  }
});
if (window.MutationObserver) {
  new MutationObserver(function (list) {
    list.forEach(function (m) {
      Array.prototype.forEach.call(m.addedNodes, function (n) {
        if (n.nodeType !== 1) return;
        var targets = [n].concat($$('.empty, .detail, .dbody, .msg', n));
        targets.forEach(function (t) { if (t.classList) onAdded(t); });
        $$('.detail', n).concat(n.classList && n.classList.contains('detail') ? [n] : []).forEach(function (d) { d.setAttribute('data-seen', '1'); });
      });
    });
  }).observe(document.body, { childList: true, subtree: true });
}

// press feedback on buttons: a small, quick squeeze
document.addEventListener('pointerdown', safe(function (e) {
  var b = e.target.closest && e.target.closest('.btn, .fchip, .chip, .nav-i, .ps, .oc, .dtab');
  if (b && !b.disabled) gsap.fromTo(b, { scale: 0.97 }, { scale: 1, duration: 0.35, ease: 'back.out(3)', clearProps: 'transform' });
}), true);
})();
