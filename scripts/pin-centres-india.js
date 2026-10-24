// Offline step: a centre for every pin code in India from the All India Pincode Directory (data.gov.in, Government Open
// Data Licence - India; GitHub republication saved as scripts/raw/pincode.csv). Used by the live lookup (api/place.js)
// for pins outside the 7 built-in cities. Centre = mean of the pin's main cluster of post offices (points more than
// 8 km from the busiest point are dropped as misplaced). Writes api/_pins-india.json as { pin: [lat, lon, district, state] }.
// Run: node scripts/pin-centres-india.js
const fs = require('fs'), path = require('path');
const raw = fs.readFileSync(path.join(__dirname, 'raw', 'pincode.csv'), 'utf8').split(/\r?\n/);
function parse(line) { const out = []; let cur = '', q = false; for (let i = 0; i < line.length; i++) { const ch = line[i]; if (q) { if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; } else if (ch === '"') q = false; else cur += ch; } else if (ch === '"') q = true; else if (ch === ',') { out.push(cur); cur = ''; } else cur += ch; } out.push(cur); return out; }
function km(a, b) { const r = Math.PI / 180, x = (b[1] - a[1]) * r * Math.cos((a[0] + b[0]) / 2 * r), y = (b[0] - a[0]) * r; return Math.sqrt(x * x + y * y) * 6371; }
const head = parse(raw[0]), c = n => head.indexOf(n);
const pts = {}, meta = {};
for (let i = 1; i < raw.length; i++) {
  if (!raw[i]) continue;
  const r = parse(raw[i]), pin = (r[c('Pincode')] || '').trim(), lat = parseFloat(r[c('Latitude')]), lon = parseFloat(r[c('Longitude')]);
  if (!/^\d{6}$/.test(pin)) continue;
  meta[pin] = meta[pin] || [titleCase(r[c('District')]), titleCase(r[c('StateName')])];
  if (!(lat > 6 && lat < 37.5 && lon > 68 && lon < 97.5)) continue;
  (pts[pin] = pts[pin] || []).push([lat, lon]);
}
function titleCase(s) { return String(s || '').toLowerCase().replace(/\b[a-z]/g, m => m.toUpperCase()); }
const out = {};
Object.keys(pts).forEach(pin => {
  const p = pts[pin];
  let anchor = p[0], best = -1;
  p.forEach(a => { const n = p.filter(b => km(a, b) <= 5).length; if (n > best) { best = n; anchor = a; } });
  const use = p.filter(x => km(x, anchor) <= 8);
  out[pin] = [+(use.reduce((s, x) => s + x[0], 0) / use.length).toFixed(4), +(use.reduce((s, x) => s + x[1], 0) / use.length).toFixed(4)].concat(meta[pin]);
});
fs.writeFileSync(path.join(__dirname, '..', 'api', '_pins-india.json'), JSON.stringify(out));
console.log('pins with a centre: ' + Object.keys(out).length + ' of ' + Object.keys(meta).length + ' in the directory; ' + Math.round(fs.statSync(path.join(__dirname, '..', 'api', '_pins-india.json')).size / 1024) + ' KB');
