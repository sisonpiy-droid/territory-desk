// Messy-notes cases an examiner might add: the form and the notes disagree, funding from outside, wrong state.
// Run: node test/hardening.js
const assert = require('assert');
const E = require('../src/engine.js'), SD = require('../src/sample.js');
const H = SD.appsAoA[1];
const row = o => { const base = ['APP-X', 'Test Person', 'Mysuru', 'Karnataka', '570010', 40, 4, 'Runs a mobile shop', 'Rented', 400, 'Ground', 3, 'English', '']; Object.keys(o).forEach(k => { base[{ id: 0, city: 2, state: 3, pin: 4, inv: 5, biz: 7, space: 8, size: 9, floor: 10, notes: 13 }[k]] = o[k]; }); return base; };
const decide = rows => { const apps = E.parseApplications([['t'], H].concat(rows)), ters = E.parseTerritories(SD.tersAoA), r = E.run(apps, ters, E.STORES, E.clone(E.DEFAULT_CFG)); return { r, apps }; };
const codes = (d, id) => d.r.res[id].issues.map(i => i.code);

let d = decide([row({ id: 'A1' }), row({ id: 'A2', notes: 'The shop is only 200 sq ft' }), row({ id: 'A3', notes: 'I can invest 18 lakh in total' }), row({ id: 'A4', floor: 'Ground', notes: 'Shop is on the first floor' }),
  row({ id: 'A5', state: 'Tamil Nadu' }), row({ id: 'A6', state: 'KA' }), row({ id: 'A7', notes: 'My brother will add 10 lakh as co-investor' }), row({ id: 'A8', notes: 'Looking for a 300 sq ft ground floor shop', space: 'Not yet identified', size: '', floor: '' }),
  row({ id: 'A9', notes: 'Shop is 430 sq ft, near the main road' }), row({ id: 'A10', notes: 'can invest 1 crore' })]);
assert.strictEqual(d.r.res['A1'].outcome, 'Approve', 'a clean application is still approved');
assert(codes(d, 'A2').includes('NOTES_CONFLICT') && d.r.res['A2'].outcome === 'Hold', 'size in notes disagrees with the form');
assert(codes(d, 'A3').includes('NOTES_CONFLICT') && /18 lakh/.test(d.r.res['A3'].issues.find(i => i.code === 'NOTES_CONFLICT').detail), 'investment in notes disagrees with the form');
assert(codes(d, 'A4').includes('NOTES_CONFLICT'), 'upper floor in the notes against a ground-floor form');
assert(codes(d, 'A5').includes('STATE_MISMATCH') && d.r.res['A5'].outcome === 'Hold', 'wrong state holds');
assert(!codes(d, 'A6').includes('STATE_MISMATCH'), 'KA is Karnataka');
assert(codes(d, 'A7').includes('FUNDING_OUTSIDE') && !codes(d, 'A7').includes('NOTES_CONFLICT'), 'a co-investor is a flag, not a contradiction');
assert(d.r.res['A7'].conditions.some(c => /co-investor/.test(c)), 'and becomes a condition');
assert(!codes(d, 'A8').includes('NOTES_CONFLICT'), 'a wish for a space is not a contradiction');
assert(!codes(d, 'A9').includes('NOTES_CONFLICT'), 'a size within 25% is fine');
assert(codes(d, 'A10').includes('NOTES_CONFLICT'), 'one crore is 100 lakh, far from 40');
['English', 'Hindi', 'Kannada'].forEach(l => assert(/\S/.test(E.letter(d.r.res['A5'], d.apps.find(a => a.id === 'A5'), l, E.DEFAULT_CFG))));
// the sample answer key is untouched (run.js and file.js check it); here: no sample note trips the new rules
const s = E.run(E.parseApplications(SD.appsAoA), E.parseTerritories(SD.tersAoA), E.STORES, E.clone(E.DEFAULT_CFG));
Object.values(s.res).forEach(r => r.issues.forEach(i => assert(i.code !== 'STATE_MISMATCH' && i.code !== 'FUNDING_OUTSIDE', 'sample ' + r.id)));
console.log('  ok   messy notes, state and outside funding are caught (10 cases); sample unchanged');
