// Writes the stress workbooks in test-data/stress/. Run: node test/make-stress.js (test/stress.js checks them)
const XLSX = require('xlsx'), fs = require('fs'), path = require('path');
const SD = require('../src/sample.js');
const out = path.join(__dirname, '..', 'test-data', 'stress');
fs.mkdirSync(out, { recursive: true });
const H = SD.appsAoA[1], A = SD.appsAoA.slice(2), TH = SD.tersAoA[1], T = SD.tersAoA.slice(2);
const title = t => [t];
function write(name, sheets) {
  const wb = XLSX.utils.book_new();
  Object.keys(sheets).forEach(n => XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(sheets[n]), n));
  XLSX.writeFile(wb, path.join(out, name));
}
const copy = rows => rows.map(r => r.slice());

// 1. Blank cells all over the place, plus empty rows in between
const blank = copy(A);
blank[1][5] = '';           // APP-002 investment
blank[2][4] = '';           // APP-003 pin
blank[3][12] = '';          // APP-004 language
blank[5][2] = '';           // APP-006 city
blank[7][9] = ''; blank[7][10] = '';  // APP-008 size and floor
blank[15][6] = '';          // APP-016 experience
blank[19][11] = '';         // APP-020 target launch
write('blank-cells.xlsx', {
  Applications: [title('Applications'), H].concat(blank.slice(0, 10), [[], ['', '', '']], blank.slice(10)),
  Territories: [title('Territories'), TH].concat(T.slice(0, 4), [[]], T.slice(4))
});

// 2. Numbers typed as text, with units and Indian digit grouping
const txt = copy(A).map(r => { r[4] = String(r[4]); return r; });
txt[0][5] = '25 lakh'; txt[1][5] = 'Rs 40,00,000'; txt[2][5] = '₹30L'; txt[3][5] = '0.28 crore'; txt[4][5] = '35';
txt[0][6] = '4 years'; txt[1][6] = '6 yrs'; txt[0][9] = '450 sq ft'; txt[1][9] = '380sqft'; txt[0][11] = '3 months'; txt[2][4] = '570 002'; txt[3][4] = '570008.0';
const txtT = copy(T).map(r => { r[5] = String(r[5]) + ' slots'; return r; });
txtT[0][3] = '570001;570002 / 570008,570009';
write('numbers-as-text.xlsx', { Applications: [title('Applications'), H].concat(txt), Territories: [title('Territories'), TH].concat(txtT) });

// 3. Odd headers, different column order, no title row, generic sheet names
const oddH = ['App ID', 'Name of applicant', 'PIN', 'Town', 'State', 'Investment (Rs. Lakhs)', 'Experience in retail (yrs)', 'Business today', 'Space (owned/rented/none)', 'Size of space (sq.ft.)', 'Which floor', 'Launch in (months)', 'Language preference', 'Applicant notes'];
const map = [0, 1, 4, 2, 3, 5, 6, 7, 8, 9, 10, 11, 12, 13];
const oddT = ['Territory', 'City name', 'State', 'Pins', 'Tier', 'Slots open', 'Priority level'];
write('odd-headers.xlsx', { Sheet1: [oddH].concat(A.map(r => map.map(i => r[i]))), Sheet2: [oddT].concat(T) });

// 4. Leading and trailing spaces, mixed case
const sp = copy(A).map(r => r.map(c => typeof c === 'string' ? '  ' + c + '   ' : c));
sp[0][2] = ' MYSURU '; sp[1][8] = 'OWNED '; sp[2][10] = ' mall UNIT'; sp[3][12] = 'kannada  '; sp[5][0] = ' app-006 ';
write('trailing-spaces.xlsx', { ' Applications ': [title('Applications'), H].concat(sp), 'territories': [title('Territories'), TH].concat(copy(T).map(r => r.map(c => typeof c === 'string' ? c + '  ' : c))) });

// 5. 150 applications across 12 territories (deterministic)
let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const pick = xs => xs[Math.floor(rnd() * xs.length)];
const cities = [['Bengaluru', '560', 30], ['Mysuru', '570', 25], ['Mangaluru', '575', 25], ['Hubballi-Dharwad', '580', 25], ['Belagavi', '590', 25], ['Tumakuru', '572', 20], ['Davanagere', '577', 20]];
const bigT = [], bigA = [];
cities.forEach((c, i) => { for (let k = 0; k < (i < 5 ? 2 : 1); k++) { const pins = []; for (let j = 0; j < 5; j++) pins.push(c[1] + String(100 + i * 40 + k * 10 + j * 2).slice(-3)); bigT.push(['TER-' + String(bigT.length + 1).padStart(2, '0'), c[0], 'Karnataka', pins.join(', '), c[0] === 'Bengaluru' ? 'Tier 1' : c[0] === 'Tumakuru' || c[0] === 'Davanagere' ? 'Tier 3' : 'Tier 2', 1 + Math.floor(rnd() * 3), pick(['High', 'Medium', 'Low'])]); } });
for (let n = 1; n <= 150; n++) {
  const t = pick(bigT), c = cities.find(x => x[0] === t[1]), pins = t[3].split(', ');
  const space = pick(['Owned', 'Rented', 'Rented', 'Not yet identified']);
  bigA.push(['APP-' + String(n).padStart(3, '0'), 'Applicant ' + n, rnd() < 0.03 ? 'Mysore' : c[0], 'Karnataka', rnd() < 0.04 ? 570009 : +pick(pins), Math.round(c[2] * (0.6 + rnd() * 0.9)), Math.floor(rnd() * 9),
    pick(['Runs a mobile shop', 'Garment retail', 'IT professional', 'Kirana store', 'Homemaker', 'Optical shop']), space, space === 'Not yet identified' ? '' : 200 + Math.floor(rnd() * 400),
    space === 'Not yet identified' ? 'Not known' : pick(['Ground', 'Ground', 'Mall unit', 'Upper']), 1 + Math.floor(rnd() * 8), pick(['Kannada', 'English', 'Hindi', '']), pick(['', '', 'Bank loan pending', 'Already have a shop', 'Looking for a ground floor shop'])]);
}
write('big-150.xlsx', { Applications: [title('Applications'), H].concat(bigA), Territories: [title('Territories'), TH].concat(bigT) });

// 6. Territories sheet missing
write('missing-sheet.xlsx', { Applications: [title('Applications'), H].concat(copy(A)) });

console.log('wrote 6 stress workbooks to test-data/stress/');
