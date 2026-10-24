// Offline step: pin-code centres for the 7 cities from the All India Pincode Directory (data.gov.in, Government Open
// Data Licence - India; read from the GitHub republication dropdevrahul/pincodes-india, saved as scripts/raw/pincode.csv).
// Centre = mean of the post offices with valid coordinates, after dropping points more than 8 km from the median.
// Writes scripts/out/pins.json and prints coverage for the pins the app uses.
// Run: node scripts/pin-centres.js
const fs = require('fs'), path = require('path');
const PREFIXES = ['560', '570', '572', '575', '577', '580', '590'];
const OUTLIER_KM = 8;
const raw = fs.readFileSync(path.join(__dirname, 'raw', 'pincode.csv'), 'utf8').split(/\r?\n/);
const head = parse(raw[0]), col = n => head.indexOf(n);
const iPin = col('Pincode'), iLat = col('Latitude'), iLon = col('Longitude'), iOff = col('OfficeName'), iDist = col('District'), iState = col('StateName');

function parse(line) {   // CSV with quoted fields
  const out = []; let cur = '', q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (q) { if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; } else if (ch === '"') q = false; else cur += ch; }
    else if (ch === '"') q = true; else if (ch === ',') { out.push(cur); cur = ''; } else cur += ch;
  }
  out.push(cur); return out;
}
function km(a, b) { const r = Math.PI / 180, x = (b[1] - a[1]) * r * Math.cos((a[0] + b[0]) / 2 * r), y = (b[0] - a[0]) * r; return Math.sqrt(x * x + y * y) * 6371; }


const pts = {}, seen = {};
let rows = 0, kept = 0, badCoord = 0;
for (let i = 1; i < raw.length; i++) {
  if (!raw[i]) continue;
  const r = parse(raw[i]), pin = (r[iPin] || '').trim();
  if (!PREFIXES.some(p => pin.startsWith(p))) continue;
  rows++; seen[pin] = 1;
  const lat = parseFloat(r[iLat]), lon = parseFloat(r[iLon]);
  // valid only if inside a generous Karnataka box; blanks, NA, 0 and swapped values fall out here
  if (!(lat > 11.4 && lat < 18.6 && lon > 74 && lon < 78.7)) { badCoord++; continue; }
  kept++; (pts[pin] = pts[pin] || []).push({ ll: [lat, lon], office: r[iOff], district: r[iDist], state: r[iState] });
}
// Some post offices carry another town's coordinates (e.g. a Davanagere office placed in Bengaluru), so a point counts
// only if it lies within the city's reach, and then only the main cluster of the pin's points is kept.
const CITY = { '560': [12.9716, 77.5946, 40], '570': [12.2958, 76.6394, 30], '575': [12.9141, 74.8560, 30], '580': [15.4100, 75.0700, 30],
               '590': [15.8497, 74.4977, 30], '572': [13.3379, 77.1173, 30], '577': [14.4644, 75.9218, 30] };   // centre lat, lon, reach km
const pins = {}, outOfReach = [];
Object.keys(pts).sort().forEach(pin => {
  const c0 = CITY[pin.slice(0, 3)], all = pts[pin];
  const p = all.filter(x => km(x.ll, c0) <= c0[2]);
  if (!p.length) { outOfReach.push(pin); return; }
  // anchor = the point with most neighbours within 5 km; keep points within OUTLIER_KM of it
  let anchor = p[0], best = -1;
  p.forEach(a => { const n = p.filter(b => km(a.ll, b.ll) <= 5).length; if (n > best) { best = n; anchor = a; } });
  const use = p.filter(x => km(x.ll, anchor.ll) <= OUTLIER_KM);
  const c = [use.reduce((s, x) => s + x.ll[0], 0) / use.length, use.reduce((s, x) => s + x.ll[1], 0) / use.length];
  pins[pin] = { lat: +c[0].toFixed(5), lon: +c[1].toFixed(5), n: use.length, dropped: all.length - use.length, district: use[0].district };
});
fs.mkdirSync(path.join(__dirname, 'out'), { recursive: true });
fs.writeFileSync(path.join(__dirname, 'out', 'pins.json'), JSON.stringify(pins));

// coverage for the pins the app actually uses
const XLSX = require('xlsx'), E = require('../src/engine.js'), SD = require('../src/sample.js');
const wb = XLSX.readFile(path.join(__dirname, '..', 'test-data', 'sample-judges-layout.xlsx')), sheets = {};
wb.SheetNames.forEach(n => { sheets[n] = XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, raw: true, defval: '' }); });
const pk = E.pickSheets(sheets);
const uniq = xs => [...new Set(xs.filter(p => /^\d{6}$/.test(p)))];
const sets = {
  'judges workbook: applicant pins': uniq(E.parseApplications(pk.apps).map(a => a.pin)),
  'judges workbook: territory pins': uniq([].concat(...E.parseTerritories(pk.ters).map(t => t.pins))),
  'src/sample.js: applicant and territory pins': uniq(E.parseApplications(SD.appsAoA).map(a => a.pin).concat(...E.parseTerritories(SD.tersAoA).map(t => t.pins))),
  'existing stores (10)': uniq(E.STORES.map(s => s.pin))
};
console.log('Directory rows for the 7 city prefixes: ' + rows + '; with valid coordinates: ' + kept + '; blank or invalid: ' + badCoord);
console.log('Pins in the directory: ' + Object.keys(seen).length + '; with a centre: ' + Object.keys(pins).length);
let all = [];
Object.keys(sets).forEach(k => {
  const s = sets[k], have = s.filter(p => pins[p]), miss = s.filter(p => !pins[p]);
  all = all.concat(s);
  console.log(k + ': ' + have.length + ' of ' + s.length + ' (' + Math.round(100 * have.length / s.length) + '%)' + (miss.length ? '  missing: ' + miss.map(p => p + (seen[p] ? ' (in directory, no valid coordinates)' : ' (not in directory)')).join(', ') : ''));
});
const u = uniq(all), h = u.filter(p => pins[p]);
console.log('ALL distinct pins used: ' + h.length + ' of ' + u.length + ' (' + (100 * h.length / u.length).toFixed(1) + '%)');
const drops = Object.keys(pins).filter(p => pins[p].dropped).length;
console.log('Pins where some post offices were dropped as misplaced: ' + drops + '; pins with no post office within reach of their city (rural, out of scope): ' + outOfReach.length);
