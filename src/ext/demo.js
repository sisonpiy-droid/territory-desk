// Guided demo: plays the one-minute video sequence (upload, decisions, one "why", one "what if") the same way every time.
// Start with the "Play demo" button, or open the link with #demo. Esc or Stop ends it.
(function () {
'use strict';
var D = window.__desk, S = D.S, SD = window.SampleData;
var timers = [], bar = null;

function $(s) { return document.querySelector(s); }
function later(ms, fn) { timers.push(setTimeout(fn, ms)); }
function stop() { timers.forEach(clearTimeout); timers = []; hl(null); if (bar) { bar.remove(); bar = null; } }
function hl(sel, block) {
  Array.prototype.forEach.call(document.querySelectorAll('.demo-hl'), function (e) { e.classList.remove('demo-hl'); });
  var el = sel && $(sel); if (!el) return;
  el.classList.add('demo-hl'); el.scrollIntoView({ behavior: 'smooth', block: block || 'center' });
}
function say(n, total, text) {
  if (!bar) {
    bar = document.createElement('div'); bar.className = 'demo-bar'; bar.setAttribute('role', 'status');
    bar.innerHTML = '<span class="demo-step"></span><p></p><button class="btn sm" data-demo="stop">Stop</button>';
    document.body.appendChild(bar);
  }
  bar.querySelector('.demo-step').textContent = n + ' / ' + total;
  bar.querySelector('p').textContent = text;
}
function type(text, ms, done) {
  var i = 0, inp = $('#askin'); if (!inp) return done();
  inp.focus();
  (function tick() { if (!$('#askin')) return; $('#askin').value = text.slice(0, ++i); if (i < text.length) later(ms, tick); else later(400, done); })();
}
function outcomeOf(id) { var r = S.run && S.run.res[id]; return r ? r.outcome : ''; }
function word(o) { return { Approve: 'approved', Waitlist: 'waitlisted', Hold: 'on hold', Reject: 'rejected' }[o] || o; }

function play() {
  stop();
  var N = 9;
  S.run = null; S.open = {}; D.rerender(); window.scrollTo(0, 0);
  say(1, N, 'The expansion team uploads this week\'s Applications and Territories workbook.');
  hl('.drop');

  later(3500, function () {
    D.load(SD.appsAoA, SD.tersAoA, 'this week\'s workbook');
    var c = { Approve: 0, Waitlist: 0, Hold: 0, Reject: 0 };
    Object.keys(S.run.res).forEach(function (id) { c[S.run.res[id].outcome]++; });
    say(2, N, 'Every application is decided in a second: ' + c.Approve + ' approved, ' + c.Waitlist + ' waitlisted, ' + c.Hold + ' on hold, ' + c.Reject + ' rejected. Never two stores in one pin code.');
    hl('.summary');
  });
  later(9500, function () { say(3, N, 'Where applications drop out, and why. Click any step to see who.'); hl('.pipe-card'); });
  later(15500, function () { say(4, N, 'What needs a person today, with each message drafted in the applicant\'s own language.'); hl('.ops-grid .card'); });

  later(21500, function () {
    var appr = S.apps.filter(function (a) { return outcomeOf(a.id) === 'Approve'; })[0];
    if (appr) { S.open[appr.id] = true; D.rerender(); }
    say(5, N, 'Every partner gets the reason, a score, a training plan in their language and a date to sign by.');
    if (appr) hl('#row-' + appr.id, 'start');
  });

  later(29500, function () {
    var ids = S.apps.map(function (a) { return a.id; });
    var hold = ids.filter(function (id) { return outcomeOf(id) === 'Hold'; });
    var fixable = hold.filter(function (id) { var r = S.run.res[id]; return r.ifFixed && r.ifFixed.possible && r.ifFixed.outcome === 'Approve' && r.issues.some(function (i) { return i.code === 'NO_SPACE'; }); });
    var whyId = fixable[0] || hold[0], ifId = fixable[fixable.length - 1] || whyId;
    hl('#ask');
    say(6, N, 'Ask why, in plain language.');
    type('Why is ' + whyId + ' on hold?', 45, function () {
      D.ask($('#askin').value);
      hl('#ask');
      later(6500, function () {
        say(7, N, 'Give it new information and the decision changes.');
        var before = outcomeOf(ifId);
        type(ifId + ' has now found a ground-floor space', 40, function () {
          D.ask($('#askin').value);
          hl('#ask');
          say(7, N, ifId + ' moves from ' + word(before) + ' to ' + word(outcomeOf(ifId)) + '. Every other decision is checked again, and the change is logged.');
          later(8000, function () {
            var r = S.run.res[ifId], tid = r && r.ter ? r.ter.id : '';
            S.tab = 'board'; D.rerender();
            say(8, N, 'The pin board updates' + (tid ? ': ' + tid + ' now has ' + Math.min(r.ter.slots, S.run.approvedByTer[tid] || 0) + ' of ' + r.ter.slots + ' slots filled.' : '.'));
            hl('.board');
            later(6000, function () {
              say(9, N, 'Territory Desk: from first application to an open, trained store, without the spreadsheet chase.');
              hl('.summary');
              later(4500, stop);
            });
          });
        });
      });
    });
  });
}

var btn = document.createElement('button');
btn.className = 'btn'; btn.setAttribute('data-demo', 'play'); btn.textContent = 'Play demo';
var acts = $('.top .actions'); if (acts) acts.insertBefore(btn, acts.firstChild);

document.addEventListener('click', function (e) {
  var el = e.target.closest && e.target.closest('[data-demo]'); if (!el) return;
  if (el.getAttribute('data-demo') === 'play') play(); else stop();
});
document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && bar) stop(); });
if (location.hash === '#demo') setTimeout(play, 600);
window.__demo = { play: play, stop: stop };

var css = document.createElement('style');
css.textContent = [
  '.demo-hl { outline: 3px solid var(--accent) !important; outline-offset: 4px; border-radius: 12px; transition: outline-color .3s; }',
  '.demo-bar { position: fixed; left: 50%; bottom: calc(18px + env(safe-area-inset-bottom, 0px)); transform: translateX(-50%); z-index: 50; width: min(760px, calc(100vw - 24px));',
  '  display: flex; align-items: center; gap: 14px; background: var(--ink); color: var(--bg); border-radius: 14px; padding: 12px 14px 12px 18px; box-shadow: 0 10px 30px rgba(0,0,0,.25); }',
  '.demo-bar p { margin: 0; flex: 1; font-size: 15.5px; line-height: 1.4; font-weight: 500; }',
  '.demo-step { font-family: var(--display); font-weight: 800; font-size: 13px; opacity: .7; white-space: nowrap; }',
  '.demo-bar .btn { background: transparent; color: var(--bg); border-color: color-mix(in srgb, var(--bg) 40%, transparent); }'
].join('\n');
document.head.appendChild(css);
})();
