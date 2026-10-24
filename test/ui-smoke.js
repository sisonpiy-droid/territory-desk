// Loads dist/index.html in jsdom, loads the sample, opens a record and asks follow-ups. Fails on any script error.
const { JSDOM, VirtualConsole } = require('jsdom'); const fs = require('fs'), path = require('path'), assert = require('assert');
const html = fs.readFileSync(path.join(__dirname, '..', 'dist', 'index.html'), 'utf8');
const errs = []; const vc = new VirtualConsole(); vc.on('jsdomError', e => errs.push(e.message)); vc.on('error', e => errs.push(String(e)));
const w = new JSDOM(html, { runScripts: 'dangerously', virtualConsole: vc, pretendToBeVisual: true }).window, d = w.document;
const click = sel => d.querySelector(sel).dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
click('[data-act="sample"]');
assert.strictEqual(d.querySelectorAll('.row').length, 20);
const ask = q => { w.__desk.ask(q); const m = [...d.querySelectorAll('.msg.desk')]; return m[m.length - 1].textContent; };
assert(/on hold/i.test(ask('Why is APP-007 on hold?')));
assert(/Hold\s*to\s*Approve/i.test(ask('APP-012 has now found a ground-floor space')));
assert(/undone/i.test(ask('undo')));
assert.deepStrictEqual(errs, []);
console.log('  ok   page loads, sample decides, follow-ups answer, no script errors');
