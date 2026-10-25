// Offline step: daytime-draw places from OpenStreetMap (ODbL) through the Overpass API, run once, politely
// (one city at a time, a pause between requests, a clear User-Agent). Writes scripts/raw/osm-<city>.json.
// Run: node scripts/osm-fetch.js [city ...]
const fs = require('fs'), path = require('path'), CITIES = require('./cities');
const ENDPOINT = 'https://overpass-api.de/api/interpreter', PAUSE_MS = 15000;
const sleep = ms => new Promise(r => setTimeout(r, ms));
function bbox(c) { const dLat = (c.radius + 2) / 111, dLon = (c.radius + 2) / (111 * Math.cos(c.lat * Math.PI / 180)); return [c.lat - dLat, c.lon - dLon, c.lat + dLat, c.lon + dLon].map(x => x.toFixed(4)).join(','); }
async function query(q) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    const r = await fetch(ENDPOINT, { method: 'POST', body: 'data=' + encodeURIComponent(q), headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'territory-desk-hackathon/1.0 (one-off offline build; contact via github.com/sisonpiy-droid)' } });
    if (r.ok) return r.json();
    console.log('  Overpass ' + r.status + ', waiting before retry ' + attempt);
    await sleep(PAUSE_MS * 2 * attempt);
  }
  throw new Error('Overpass failed after 3 attempts');
}
(async () => {
  const names = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(CITIES);
  fs.mkdirSync(path.join(__dirname, 'raw'), { recursive: true });
  for (const name of names) {
    const out = path.join(__dirname, 'raw', 'osm-' + CITIES[name].prefix + '.json');
    if (fs.existsSync(out)) { console.log(name + ': already fetched'); continue; }
    const b = bbox(CITIES[name]);
    const places = await query('[out:json][timeout:180];(' +
      'nwr["amenity"="marketplace"](' + b + ');nwr["shop"="mall"](' + b + ');nwr["shop"="supermarket"](' + b + ');' +
      'nwr["amenity"="bus_station"](' + b + ');node["highway"="bus_stop"](' + b + ');' +
      'nwr["railway"="station"](' + b + ');nwr["station"="subway"](' + b + ');' +
      'nwr["amenity"~"^(college|university)$"](' + b + ');nwr["amenity"="hospital"](' + b + ');' +
      ');out center tags qt;');
    await sleep(PAUSE_MS);
    const shops = await query('[out:json][timeout:180];(node["shop"](' + b + ');way["shop"](' + b + '););out center qt;');
    fs.writeFileSync(out, JSON.stringify({ city: name, bbox: b, fetched: new Date().toISOString(), places: places.elements, shops: shops.elements.map(e => [e.lat || (e.center && e.center.lat), e.lon || (e.center && e.center.lon)]) }));
    console.log(name + ': ' + places.elements.length + ' places, ' + shops.elements.length + ' shops');
    await sleep(PAUSE_MS);
  }
})().catch(e => { console.error(e.message); process.exit(1); });
