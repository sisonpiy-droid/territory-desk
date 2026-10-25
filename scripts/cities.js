// Shared by the offline geo scripts: the 7 cities, their centres and the area we model around each.
// Centres are the usual city-centre coordinates; radius is how far from the centre we keep hexagons (km).
module.exports = {
  'Bengaluru':        { prefix: '560', lat: 12.9716, lon: 77.5946, radius: 22 },
  'Mysuru':           { prefix: '570', lat: 12.2958, lon: 76.6394, radius: 10 },
  'Mangaluru':        { prefix: '575', lat: 12.9141, lon: 74.8560, radius: 10 },
  'Hubballi-Dharwad': { prefix: '580', lat: 15.4100, lon: 75.0700, radius: 15 },   // between the two cities, so both are inside
  'Belagavi':         { prefix: '590', lat: 15.8497, lon: 74.4977, radius: 10 },
  'Tumakuru':         { prefix: '572', lat: 13.3379, lon: 77.1173, radius: 9 },
  'Davanagere':       { prefix: '577', lat: 14.4644, lon: 75.9218, radius: 9 }
};
