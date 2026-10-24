// Loads the judges-layout workbook through the same parsing path as an upload and checks it matches the answer key.
const assert = require('assert'), path = require('path');
const XLSX = require('xlsx'), E = require('../src/engine.js');
const wb = XLSX.readFile(path.join(__dirname, '..', 'test-data', 'sample-judges-layout.xlsx'));
const aoa = n => XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, raw: true, defval: '' });
let apps = E.parseApplications(aoa('Applications')), ters = E.parseTerritories(aoa('Territories'));
// the grey template row duplicates a real ID, so the loader drops it; mimic that here
const ex = apps.find(a => a.templateExample); apps = apps.filter(a => a !== ex); apps.find(a => a.id === 'APP-001#2').id = 'APP-001';
ters = ters.filter(t => !t.templateExample);
const r = E.run(apps, ters, E.STORES, E.clone(E.DEFAULT_CFG));
assert.strictEqual(apps.length, 20); assert.strictEqual(r.res['APP-002'].outcome, 'Approve'); assert.strictEqual(r.res['APP-001'].outcome, 'Waitlist');
console.log('  ok   judges-layout workbook parses and decides as expected (20 applicants)');
