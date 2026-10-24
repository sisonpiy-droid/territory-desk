// A bank of plain-language follow-ups ("why", "what if", "who is competing") run against the built page.
// Each case starts from a fresh sample load. Run: node test/phrasings.js
const { JSDOM, VirtualConsole } = require('jsdom'), fs = require('fs'), path = require('path');
const html = fs.readFileSync(path.join(__dirname, '..', 'dist', 'index.html'), 'utf8');
const errs = [], vc = new VirtualConsole(); vc.on('jsdomError', e => errs.push(e.message));
const w = new JSDOM(html, { runScripts: 'dangerously', virtualConsole: vc, pretendToBeVisual: true }).window, d = w.document;
const SD = w.SampleData, D = w.__desk;
function fresh() { D.load(SD.appsAoA, SD.tersAoA, 'sample'); }
function ask(q) { D.ask(q); const m = [...d.querySelectorAll('.msg.desk')]; return m[m.length - 1].textContent.replace(/\s+/g, ' '); }
const out = id => D.S.run.res[id] ? D.S.run.res[id].outcome : (D.getApp(id) && D.getApp(id).withdrawn ? 'Withdrawn' : '?');

// [question, regex the answer must match, optional { id: expected outcome after }]
const WHY = [
  ['Why is APP-007 on hold?', /APP-007.*on hold.*no shop space/i],
  ['why app 7 on hold', /APP-007.*no shop space/i],
  ['why is app007 held', /APP-007.*no shop space/i],
  ['APP-007 why?', /APP-007.*no shop space/i],
  ['Why was APP-001 waitlisted?', /APP-001.*570001.*APP-002/i],
  ['how come APP-019 is on the waitlist', /APP-019.*TER-02/i],
  ['Why didn\'t APP-015 get approved?', /APP-015.*APP-008/i],
  ['Why was APP-011 rejected?', /APP-011.*investment far below/i],
  ['Explain APP-009', /APP-009.*notes contradict the form/i],
  ['What\'s the reason for APP-013?', /APP-013.*upper-floor/i],
  ['reason for app-017', /APP-017.*do not match/i],
  ['Tell me about APP-002', /APP-002.*Approved for pin 570001/i],
  ['What happened with APP-005?', /APP-005.*store is already open/i],
  ['Why is Divya on hold?', /APP-007/i],
  ['why is APP-10 on hold', /APP-010.*slightly below the floor/i],
  ['What would it take for APP-010?', /APP-010.*25 lakh/i],
  ['What does APP-012 need to do?', /APP-012.*(space|ground)/i]
];
const WHATIF = [
  ['APP-012 has now found a ground-floor space', /Hold.*Approve/i, { 'APP-012': 'Approve' }],
  ['APP-012 found a 400 sq ft ground floor shop', /400 sq ft/i, { 'APP-012': 'Approve' }],
  ['What if APP-010 can invest 25 lakh?', /APP-010/i, { 'APP-010': 'Approve' }],
  ['APP-010 can now invest 30 lakh', /investment Rs 30 lakh/i, { 'APP-010': 'Approve' }],
  ['APP-013 has moved to a ground floor shop', /ground floor/i, { 'APP-013': 'Approve' }],
  ['What if TER-02 had one more slot?', /TER-02.*slots 1 to 2/i, { 'APP-019': 'Approve' }],
  ['TER-02 has one more slot', /slots 1 to 2/i, { 'APP-019': 'Approve' }],
  ['add 2 slots to TER-05', /TER-05/i],
  ['APP-002 has withdrawn', /withdrawn/i, { 'APP-001': 'Approve' }],
  ['APP-002 dropped out', /withdrawn/i, { 'APP-001': 'Approve' }],
  ['APP-008 is no longer interested', /withdrawn/i, { 'APP-015': 'Approve' }],
  ['APP-009 now has a 350 sq ft ground floor shop, lease signed', /350 sq ft/i],
  ['What if APP-007 finds a 400 sq ft shop on the ground floor', /APP-007/i, { 'APP-007': 'Approve' }],
  ['APP-017\'s pin is actually 572103', /pin 572103/i],
  ['APP-014 prefers Hindi now', /Hindi/i],
  ['TER-04 is now high priority', /priority Medium to High/i],
  ['APP-005 changed pin to 570002', /pin 570002/i]
];
const RIVALS = [
  ['Who is competing with APP-002?', /APP-001/],
  ['who are APP-001\'s rivals', /APP-002/],
  ['Who is ahead of APP-015?', /APP-008/],
  ['Who beat APP-019?', /APP-020/],
  ['rivals for APP-008', /APP-015/],
  ['who is APP-020 up against', /APP-019/],
  ['Compare APP-001 and APP-002', /APP-001.*APP-002.*Total/],
  ['Tell me about TER-01', /TER-01.*slots filled/],
  ['Who else is in TER-02?', /TER-02.*APP-020/],
  ['List all holds', /on hold/i],
  ['Give me a summary', /approved.*waitlisted.*on hold/i],
  ['Which decisions are fragile?', /flip/i],
  ['How confident is APP-008?', /APP-008.*medium confidence/i]
];

let pass = 0, fail = 0;
[['why', WHY], ['what if', WHATIF], ['who is competing', RIVALS]].forEach(([g, list]) => {
  console.log('Follow-ups: ' + g + ' (' + list.length + ')');
  list.forEach(([q, rx, expect]) => {
    fresh();
    let a, why = '';
    try { a = ask(q); } catch (e) { a = 'THREW ' + e.message; }
    if (!rx.test(a)) why = 'answer did not match ' + rx + ': ' + a.slice(0, 160);
    if (!why && expect) Object.keys(expect).forEach(id => { if (out(id) !== expect[id]) why = id + ' is ' + out(id) + ', expected ' + expect[id]; });
    if (why) { fail++; console.log('  FAIL', JSON.stringify(q), '\n       ', why); } else pass++;
  });
});
if (errs.length) { fail++; console.log('  FAIL script errors:', errs); }
console.log('  ' + pass + ' of ' + (pass + fail) + ' phrasings answered as expected');
process.exit(fail ? 1 : 0);
