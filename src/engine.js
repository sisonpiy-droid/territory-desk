(function (root) {
'use strict';

/* ------------------------------------------------------------------ */
/* Fixed reference data (from the brief)                               */
/* ------------------------------------------------------------------ */
var CITIES = {
  'Bengaluru':        { prefix: '560', tier: 'Tier 1' },
  'Mysuru':           { prefix: '570', tier: 'Tier 2' },
  'Mangaluru':        { prefix: '575', tier: 'Tier 2' },
  'Hubballi-Dharwad': { prefix: '580', tier: 'Tier 2' },
  'Belagavi':         { prefix: '590', tier: 'Tier 2' },
  'Tumakuru':         { prefix: '572', tier: 'Tier 3' },
  'Davanagere':       { prefix: '577', tier: 'Tier 3' }
};
var ALIASES = {
  'bangalore': 'Bengaluru', 'bengaluru': 'Bengaluru', 'bengalore': 'Bengaluru',
  'mysore': 'Mysuru', 'mysuru': 'Mysuru',
  'mangalore': 'Mangaluru', 'mangaluru': 'Mangaluru',
  'hubli': 'Hubballi-Dharwad', 'hubballi': 'Hubballi-Dharwad', 'dharwad': 'Hubballi-Dharwad',
  'hubballidharwad': 'Hubballi-Dharwad', 'hublidharwad': 'Hubballi-Dharwad',
  'belgaum': 'Belagavi', 'belagavi': 'Belagavi',
  'tumkur': 'Tumakuru', 'tumakuru': 'Tumakuru',
  'davangere': 'Davanagere', 'davanagere': 'Davanagere'
};
var STORES = [
  { id: 'ST-01', city: 'Bengaluru', pin: '560001', year: 2019 },
  { id: 'ST-02', city: 'Bengaluru', pin: '560034', year: 2020 },
  { id: 'ST-03', city: 'Bengaluru', pin: '560038', year: 2021 },
  { id: 'ST-04', city: 'Bengaluru', pin: '560066', year: 2022 },
  { id: 'ST-05', city: 'Bengaluru', pin: '560076', year: 2023 },
  { id: 'ST-06', city: 'Mysuru', pin: '570009', year: 2021 },
  { id: 'ST-07', city: 'Mysuru', pin: '570017', year: 2024 },
  { id: 'ST-08', city: 'Mangaluru', pin: '575001', year: 2022 },
  { id: 'ST-09', city: 'Hubballi-Dharwad', pin: '580020', year: 2023 },
  { id: 'ST-10', city: 'Belagavi', pin: '590001', year: 2024 }
];
// Cities with no store yet learn the trade at the nearest city that has one
var NEAREST_CITY = { 'Tumakuru': 'Bengaluru', 'Davanagere': 'Hubballi-Dharwad' };

/* ------------------------------------------------------------------ */
/* Assumptions (every one of these is editable in the UI)              */
/* ------------------------------------------------------------------ */
var DEFAULT_CFG = {
  floors: { 'Tier 1': 30, 'Tier 2': 25, 'Tier 3': 20 },  // minimum investment, Rs lakh
  rejectRatio: 0.7,        // below 70% of the floor: not salvageable, reject
  minSpace: 250,           // sq ft hard minimum
  idealMin: 300, idealMax: 500,
  earliestWeeks: 10,       // agreement -> fit-out -> training -> opening
  noSpaceExtraWeeks: 6,    // extra time if the partner has no space yet
  cannibNear: 5,           // pin numbers apart: treated as adjacent to an existing store
  cannibMid: 25,
  firstTimerYears: 1,
  weights: { capital: 25, experience: 20, space: 25, timeline: 10, cannibal: 10, data: 10 }
};

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */
function clone(o) { return JSON.parse(JSON.stringify(o)); }
function clamp(x, a, b) { return Math.max(a, Math.min(b, x)); }
function num(v) {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number') return isNaN(v) ? null : v;
  var m = String(v).replace(/,/g, '').match(/-?\d+(\.\d+)?/);
  return m ? parseFloat(m[0]) : null;
}
function normHeader(s) { return String(s == null ? '' : s).toLowerCase().replace(/[^a-z0-9]/g, ''); }
function canonCity(v) {
  var s = String(v == null ? '' : v).trim();
  if (CITIES[s]) return s;
  var k = s.toLowerCase().replace(/[^a-z]/g, '');
  return ALIASES[k] || s;
}
function r1(x) { return Math.round(x * 10) / 10; }
function pad(n, w) { n = String(n); while (n.length < w) n = '0' + n; return n; }

/* ------------------------------------------------------------------ */
/* Reading the uploaded sheets (arrays of arrays in, records out)      */
/* ------------------------------------------------------------------ */
function findHeaderRow(aoa, firstKey) {
  for (var i = 0; i < Math.min(aoa.length, 15); i++) {
    var row = aoa[i] || [];
    for (var j = 0; j < row.length; j++) {
      if (normHeader(row[j]).indexOf(firstKey) === 0) return i;
    }
  }
  return -1;
}
function colFinder(headers) {
  var H = headers.map(normHeader);
  return function () {
    for (var a = 0; a < arguments.length; a++) {
      for (var i = 0; i < H.length; i++) if (H[i].indexOf(arguments[a]) === 0) return i;
    }
    return -1;
  };
}
function cell(row, i) { return i < 0 || i >= row.length || row[i] === undefined || row[i] === null ? '' : row[i]; }
function rowBlank(row) { return !row || row.every(function (c) { return String(c == null ? '' : c).trim() === ''; }); }

function normSpace(v) {
  var s = String(v == null ? '' : v).toLowerCase();
  if (/\bown/.test(s)) return 'Owned';
  if (/rent|lease/.test(s)) return 'Rented';
  return 'Not yet identified';
}
function normFloor(v) {
  var s = String(v == null ? '' : v).toLowerCase();
  if (/ground/.test(s)) return 'Ground';
  if (/mall/.test(s)) return 'Mall unit';
  if (/upper|first|1st|second|2nd|third|above|terrace/.test(s)) return 'Upper';
  return 'Not known';
}
function normLang(v) {
  var s = String(v == null ? '' : v).toLowerCase();
  if (/kann/.test(s)) return 'Kannada';
  if (/hin/.test(s)) return 'Hindi';
  if (/eng/.test(s)) return 'English';
  return '';
}
function normTier(v, city) {
  var m = String(v == null ? '' : v).match(/[123]/);
  if (m) return 'Tier ' + m[0];
  return CITIES[city] ? CITIES[city].tier : 'Tier 2';
}
function normPriority(v) {
  var s = String(v == null ? '' : v).toLowerCase();
  if (/high/.test(s)) return 'High';
  if (/low/.test(s)) return 'Low';
  return 'Medium';
}

function parseApplications(aoa) {
  var hi = findHeaderRow(aoa, 'applicationid');
  if (hi < 0) throw new Error('Could not find an "Application ID" header row in the Applications sheet.');
  var ci = colFinder(aoa[hi]);
  var C = {
    id: ci('applicationid', 'appid'), name: ci('applicantname', 'name'), city: ci('city'), state: ci('state'),
    pin: ci('pincode', 'pin'), invest: ci('investment'), exp: ci('retailexperience', 'experience'),
    biz: ci('currentpastbusiness', 'currentbusiness', 'business'), space: ci('spaceavailable'),
    size: ci('spacesize'), floor: ci('floor'), launch: ci('targetlaunch', 'launch'),
    lang: ci('preferredlanguage', 'language'), notes: ci('notes')
  };
  var out = [], seen = {};
  for (var r = hi + 1; r < aoa.length; r++) {
    var row = aoa[r];
    if (rowBlank(row)) continue;
    var idRaw = String(cell(row, C.id)).trim().toUpperCase();
    var name = String(cell(row, C.name)).trim();
    if (!idRaw && !name) continue;
    var id = idRaw || ('ROW-' + (r + 1));
    if (seen[id]) { seen[id]++; id = id + '#' + seen[id]; } else seen[id] = 1;
    var city = canonCity(cell(row, C.city));
    var pinRaw = String(cell(row, C.pin)).trim();
    var pin = pinRaw.replace(/\.0$/, '').replace(/\s/g, '');
    var spaceRaw = String(cell(row, C.space)).trim();
    var a = {
      id: id, row: r + 1, name: name || id, city: city, state: String(cell(row, C.state)).trim(),
      pin: pin, pinRaw: pinRaw, invest: num(cell(row, C.invest)), exp: num(cell(row, C.exp)),
      biz: String(cell(row, C.biz)).trim(), space: normSpace(spaceRaw), spaceRaw: spaceRaw,
      size: num(cell(row, C.size)), floor: normFloor(cell(row, C.floor)),
      launch: num(cell(row, C.launch)), lang: normLang(cell(row, C.lang)),
      langRaw: String(cell(row, C.lang)).trim(), notes: String(cell(row, C.notes)).trim(),
      sizeAssumed: false, withdrawn: false
    };
    a.templateExample = (id === 'APP-001' && /ravi kumar/i.test(name) && pin === '570001' && /diwali/i.test(a.notes));
    out.push(a);
  }
  return out;
}

function parseTerritories(aoa) {
  var hi = findHeaderRow(aoa, 'territoryid');
  if (hi < 0) throw new Error('Could not find a "Territory ID" header row in the Territories sheet.');
  var ci = colFinder(aoa[hi]);
  var C = { id: ci('territoryid'), city: ci('city'), state: ci('state'), pins: ci('pincodes', 'pincode', 'pin'),
            tier: ci('citytier', 'tier'), slots: ci('openslots', 'slots'), priority: ci('priority') };
  var out = [];
  for (var r = hi + 1; r < aoa.length; r++) {
    var row = aoa[r];
    if (rowBlank(row)) continue;
    var id = String(cell(row, C.id)).trim().toUpperCase();
    if (!id) continue;
    var city = canonCity(cell(row, C.city));
    var pins = (String(cell(row, C.pins)).match(/\d{6}/g) || []);
    var seen = {}; pins = pins.filter(function (p) { if (seen[p]) return false; seen[p] = 1; return true; });
    var t = {
      id: id, row: r + 1, city: city, state: String(cell(row, C.state)).trim(), pins: pins,
      tier: normTier(cell(row, C.tier), city), slots: Math.max(0, num(cell(row, C.slots)) || 0),
      priority: normPriority(cell(row, C.priority))
    };
    t.templateExample = (id === 'TER-01' && pins.join(',') === '570001,570002,570008' && t.slots === 3 && t.priority === 'High');
    out.push(t);
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Evaluation of a single applicant                                    */
/* ------------------------------------------------------------------ */
var RETAIL_RX = /(shop|store|retail|showroom|outlet|kirana|supermarket|\bmart\b|trading|trader|wholesale|garment|footwear|mobile|electronics|optical|eyewear|jewel|pharmacy|medical|stationery|boutique|sales|merchant|dealer|franchise|general store|provision)/i;

function buildContext(territories, stores, cfg, apps) {
  var pinToTer = {}, dupPins = [];
  territories.forEach(function (t) {
    t.pins.forEach(function (p) { if (pinToTer[p]) { if (dupPins.indexOf(p) < 0) dupPins.push(p); } else pinToTer[p] = t; });
  });
  var storeByPin = {}; stores.forEach(function (s) { storeByPin[s.pin] = s; });
  var cityHasTer = {}; territories.forEach(function (t) { cityHasTer[t.city] = true; });
  var nameCount = {};
  (apps || []).forEach(function (a) { if (a.withdrawn) return; var k = a.name.trim().toLowerCase(); nameCount[k] = (nameCount[k] || 0) + 1; });
  return { territories: territories, stores: stores, cfg: cfg, pinToTer: pinToTer, storeByPin: storeByPin,
           cityHasTer: cityHasTer, dupPins: dupPins, nameCount: nameCount };
}

function feasibleMonths(a, cfg) {
  var weeks = cfg.earliestWeeks + (a.space === 'Not yet identified' ? cfg.noSpaceExtraWeeks : 0);
  return weeks / 4.345;
}

function nearestStoreInfo(a, ctx) {
  var n = parseInt(a.pin, 10); if (isNaN(n)) return null;
  var best = null;
  ctx.stores.forEach(function (s) {
    if (s.city !== a.city) return;
    var d = Math.abs(parseInt(s.pin, 10) - n);
    if (!best || d < best.d) best = { store: s, d: d };
  });
  return best;
}

function evaluateApp(a, ctx) {
  var cfg = ctx.cfg, W = cfg.weights, issues = [];
  function add(code, level, title, detail, extra) {
    var it = { code: code, level: level, title: title, detail: detail };
    if (extra) for (var k in extra) it[k] = extra[k];
    issues.push(it);
  }
  var city = CITIES[a.city];
  var pin = a.pin;
  var validPin = /^\d{6}$/.test(pin || '');
  var ter = validPin ? (ctx.pinToTer[pin] || null) : null;
  var tier = ter ? ter.tier : (city ? city.tier : null);
  var floor = tier ? cfg.floors[tier] : null;

  /* ---- pin and territory ---- */
  if (!city) {
    add('CITY_UNKNOWN', 'hold', 'City not recognised', '“' + a.city + '” is not one of the cities the brand serves.');
  }
  if (!validPin) {
    add('PIN_BAD', 'hold', 'Invalid pin code', 'Pin code “' + a.pinRaw + '” is not a 6-digit number.');
  } else if (city && pin.indexOf(city.prefix) !== 0) {
    add('PIN_MISMATCH', 'hold', 'Pin code and city do not match',
        pin + ' does not start with ' + city.prefix + ', the prefix for ' + a.city + '. One of the two is wrong.');
  } else {
    var st = ctx.storeByPin[pin];
    if (st) {
      add('PIN_HAS_STORE', 'hold', 'A store is already open in this pin code',
          st.id + ' (opened ' + st.year + ') already operates in ' + pin + '. The brand never opens two stores in one pin code.', { store: st });
    } else if (!ter) {
      if (!ctx.cityHasTer[a.city]) {
        add('NO_TERRITORY', 'reject', 'No expansion territory in this city',
            'The brand has no open territory in ' + a.city + ' right now.');
      } else {
        add('PIN_OUTSIDE', 'hold', 'Pin code is outside the expansion territories',
            pin + ' is not covered by any territory the brand wants to grow in within ' + a.city + '.');
      }
    }
  }

  /* ---- investment ---- */
  var ratio = null;
  if (a.invest === null || a.invest <= 0) {
    add('INVEST_MISSING', 'hold', 'Investment amount missing', 'No usable investment figure was given.');
  } else if (floor) {
    ratio = a.invest / floor;
    if (ratio < cfg.rejectRatio) {
      add('INVEST_LOW', 'reject', 'Investment far below what a store here needs',
          'Rs ' + a.invest + ' lakh is ' + Math.round(ratio * 100) + '% of the Rs ' + floor + ' lakh floor for a ' + tier + ' city (cut-off ' + Math.round(cfg.rejectRatio * 100) + '%).', { need: floor });
    } else if (ratio < 1) {
      add('INVEST_GAP', 'hold', 'Investment slightly below the floor',
          'Rs ' + a.invest + ' lakh against a Rs ' + floor + ' lakh floor for a ' + tier + ' city. A co-investor or proof of extra funds would close the gap.', { need: floor });
    }
  }

  /* ---- space ---- */
  var hasSpace = a.space === 'Owned' || a.space === 'Rented';
  if (!hasSpace) {
    add('NO_SPACE', 'hold', 'No shop space identified yet', 'The applicant has not yet found a space, so the store cannot be fitted out.');
  } else {
    if (a.size === null && !a.sizeAssumed) add('SIZE_MISSING', 'hold', 'Space size missing', 'A ' + a.space.toLowerCase() + ' space is stated but no size was given.');
    else if (a.size !== null && a.size < cfg.minSpace) add('SIZE_SMALL', 'hold', 'Space too small',
        a.size + ' sq ft is under the ' + cfg.minSpace + ' sq ft minimum for the store format.');
    if (a.floor === 'Upper') add('FLOOR_UPPER', 'hold', 'Upper-floor space', 'Upper floors get too little walk-in footfall; ground floor or a mall unit is needed.');
  }

  /* ---- contradictions between the form and the free-text notes ---- */
  var notesAll = (a.notes || '').toLowerCase();
  var notes = a.notesSuperseded ? '' : notesAll;   // once Ops records new information, old free-text no longer counts
  var claimsSpace = /\b(already|have|has|got|own|owns|owned|secured|signed|finalised|finalized)\b[^.]{0,40}\b(shop|space|premises|property|unit|showroom)\b/.test(notes) || /lease (is )?signed|rent agreement|agreement signed/.test(notes);
  var deniesSpace = /\b(no shop|no space|not yet|yet to|haven't found|havent found|don't have|dont have|looking for|searching for|will (rent|find|take|identify|look)|once approved|after approval)\b/.test(notes);
  if (a.space === 'Not yet identified' && claimsSpace && !deniesSpace) {
    add('NOTES_CONFLICT', 'hold', 'Notes contradict the form',
        'The form says no space has been identified, but the notes say the applicant already has one. Which is right needs confirming.');
  } else if (hasSpace && deniesSpace && !claimsSpace) {
    add('NOTES_CONFLICT', 'hold', 'Notes contradict the form',
        'The form says a space is ' + a.space.toLowerCase() + ', but the notes say the applicant is still looking.');
  } else if (a.floor === 'Upper' && /ground[\s-]?floor/.test(notes) && !/looking|searching|prefer|want|need/.test(notes)) {
    add('NOTES_CONFLICT', 'hold', 'Notes contradict the form', 'The form says upper floor, but the notes mention a ground-floor shop.');
  }

  /* ---- soft flags: do not block, but lower confidence ---- */
  if (a.exp === 0 && /\b(run|runs|running|owner|owns|own|manage|manages|managing|operate|operates)\b[^.]{0,30}\b(shop|store|retail|showroom|outlet)/i.test(a.biz)) {
    add('EXP_CONFLICT', 'soft', 'Experience looks understated', 'Retail experience is 0 years but the business description says the applicant runs a shop.');
  } else if (a.exp !== null && a.exp >= 5 && /student|fresher|homemaker|unemployed/i.test(a.biz)) {
    add('EXP_CONFLICT', 'soft', 'Experience looks overstated', a.exp + ' years of retail experience but the business description says "' + a.biz + '".');
  }
  if (/\b(loan|bank|finance|mudra|borrow|subsidy|sanction)/.test(notesAll)) {
    add('LOAN', 'soft', 'Funding depends on a loan', 'The notes suggest part of the investment depends on a loan that may not be sanctioned yet.');
  }
  var nk = a.name.trim().toLowerCase();
  if (ctx.nameCount[nk] > 1) add('DUP_APPLICANT', 'soft', 'Same name on several applications', 'Another application carries the same applicant name; possible duplicate.');
  var fm = feasibleMonths(a, cfg);
  if (a.launch !== null && a.launch < fm - 0.01) {
    add('LAUNCH_SOON', 'info', 'Target launch is earlier than realistic',
        'Target is ' + a.launch + ' month(s); the earliest realistic opening is about ' + fm.toFixed(1) + ' months.');
  }
  if (!a.lang) add('LANG_MISSING', 'info', 'Training language missing', 'Defaulting to English until the applicant confirms.');

  /* ---- level ---- */
  var level = 'ready';
  if (issues.some(function (i) { return i.level === 'hold'; })) level = 'hold';
  if (issues.some(function (i) { return i.level === 'reject'; })) level = 'reject';

  /* ---- score (0-100) ---- */
  var parts = {}, softCount = issues.filter(function (i) { return i.level === 'soft'; }).length;
  var capF = 0, capNote = 'no figure';
  if (ratio !== null) {
    capF = ratio >= 1 ? 0.4 + 0.6 * clamp((ratio - 1) / 0.5, 0, 1) : 0.4 * clamp((ratio - cfg.rejectRatio) / (1 - cfg.rejectRatio), 0, 1);
    capNote = 'Rs ' + a.invest + ' lakh vs Rs ' + floor + ' lakh floor (' + Math.round(ratio * 100) + '%)';
  }
  parts.capital = { pts: W.capital * capF, max: W.capital, label: 'Capital', note: capNote };

  var yrs = a.exp === null ? 0 : a.exp;
  var retailBiz = RETAIL_RX.test(a.biz || '');
  var expF = (0.2 + 0.8 * Math.min(yrs, 5) / 5) * (retailBiz ? 1 : 0.85);
  parts.experience = { pts: W.experience * expF, max: W.experience, label: 'Experience',
    note: yrs + ' yr' + (yrs === 1 ? '' : 's') + (retailBiz ? ', retail background' : ', non-retail background') };

  var spF = 0, spNote = 'no space';
  if (hasSpace) {
    var ownF = a.space === 'Owned' ? 1 : 0.85;
    var sz = a.size, szF;
    if (sz === null) szF = 0.7;
    else if (sz >= cfg.idealMin && sz <= cfg.idealMax) szF = 1;
    else if (sz > cfg.idealMax) szF = 0.9;
    else szF = 0.7;
    var flF = a.floor === 'Ground' ? 1 : a.floor === 'Mall unit' ? 0.9 : a.floor === 'Upper' ? 0.5 : 0.6;
    spF = ownF * szF * flF;
    spNote = a.space + ', ' + (sz === null ? 'size to confirm' : sz + ' sq ft') + ', ' + (a.floor === 'Not known' ? 'floor to confirm' : a.floor.toLowerCase());
  }
  parts.space = { pts: W.space * spF, max: W.space, label: 'Space', note: spNote };

  var tF = 0.6, tNote = 'no target given';
  if (a.launch !== null) {
    tF = a.launch >= fm ? 1 : Math.max(0, 1 - (fm - a.launch) / fm);
    tNote = 'target ' + a.launch + ' mo vs earliest ' + fm.toFixed(1) + ' mo';
  }
  parts.timeline = { pts: W.timeline * tF, max: W.timeline, label: 'Timeline', note: tNote };

  var ns = nearestStoreInfo(a, ctx), cF = 1, cNote = 'no store in this city yet', risk = 'Low';
  if (ns) {
    if (ns.d === 0) { cF = 0; risk = 'Blocked'; }
    else if (ns.d <= cfg.cannibNear) { cF = 0; risk = 'High'; }
    else if (ns.d <= cfg.cannibMid) { cF = 0.5; risk = 'Medium'; }
    cNote = 'nearest store ' + ns.store.id + ' is ' + ns.d + ' pin numbers away';
  }
  parts.cannibal = { pts: W.cannibal * cF, max: W.cannibal, label: 'Spacing', note: cNote, risk: risk };

  var dF = clamp(1 - 0.25 * softCount, 0, 1);
  parts.data = { pts: W.data * dF, max: W.data, label: 'Data confidence', note: softCount ? softCount + ' soft flag' + (softCount > 1 ? 's' : '') : 'clean' };

  var score = 0; for (var k in parts) score += parts[k].pts;

  /* ---- conditions attached to an approval ---- */
  var cond = [];
  if (a.sizeAssumed) cond.push('Confirm the space is at least ' + cfg.minSpace + ' sq ft before the agreement is signed');
  if (hasSpace && a.floor === 'Not known') cond.push('Confirm the floor (ground floor or mall unit)');
  if (issues.some(function (i) { return i.code === 'LOAN'; })) cond.push('Show the loan sanction letter as proof of funds');
  if (issues.some(function (i) { return i.code === 'EXP_CONFLICT'; })) cond.push('Verify past retail experience during KYC');
  if (issues.some(function (i) { return i.code === 'DUP_APPLICANT'; })) cond.push('Confirm this is the only application from this person');
  if (a.space === 'Rented') cond.push('Registered lease for the space');

  return { level: level, issues: issues, tier: tier, ter: ter, floor: floor, ratio: ratio, parts: parts, score: r1(score), conditions: cond, feasible: fm };
}

/* ------------------------------------------------------------------ */
/* Allocation: one store per pin, slots per territory                  */
/* ------------------------------------------------------------------ */
function cmp(A, B) {
  return (B.ev.score - A.ev.score) || ((B.a.exp || 0) - (A.a.exp || 0)) || ((B.a.invest || 0) - (A.a.invest || 0)) || (A.a.id < B.a.id ? -1 : 1);
}

function core(apps, territories, stores, cfg) {
  var live = apps.filter(function (a) { return !a.withdrawn; });
  var ctx = buildContext(territories, stores, cfg, live);
  var evals = {}, res = {};
  live.forEach(function (a) { evals[a.id] = evaluateApp(a, ctx); });

  var ready = live.filter(function (a) { return evals[a.id].level === 'ready'; }).map(function (a) { return { a: a, ev: evals[a.id] }; });
  var byPin = {};
  ready.forEach(function (x) { (byPin[x.a.pin] = byPin[x.a.pin] || []).push(x); });
  var pinWinners = [];
  Object.keys(byPin).forEach(function (pin) {
    var g = byPin[pin].sort(cmp);
    g.forEach(function (x, i) {
      x.rankPin = i + 1; x.pinN = g.length; x.pinGroup = g;
    });
    pinWinners.push(g[0]);
  });
  var byTer = {};
  pinWinners.forEach(function (x) { (byTer[x.ev.ter.id] = byTer[x.ev.ter.id] || []).push(x); });
  var outcome = {};
  Object.keys(byTer).forEach(function (tid) {
    var g = byTer[tid].sort(cmp), t = g[0].ev.ter;
    g.forEach(function (x, i) {
      x.rankTer = i + 1; x.terN = g.length;
      if (i < t.slots) outcome[x.a.id] = { o: 'Approve', winner: true };
      else outcome[x.a.id] = { o: 'Waitlist', reason: 'territory_full' };
    });
    g._slots = t.slots;
    byTer[tid] = g;
  });
  ready.forEach(function (x) {
    if (x.rankPin > 1) outcome[x.a.id] = { o: 'Waitlist', reason: 'pin_lost', winner: x.pinGroup[0].a.id };
  });

  var approvedByTer = {};
  Object.keys(outcome).forEach(function (id) { if (outcome[id].o === 'Approve') { var tid = evals[id].ter.id; approvedByTer[tid] = (approvedByTer[tid] || 0) + 1; } });
  var approvedPins = {};
  live.forEach(function (a) { if (outcome[a.id] && outcome[a.id].o === 'Approve') approvedPins[a.pin] = a.id; });

  live.forEach(function (a) {
    var ev = evals[a.id], oc = outcome[a.id];
    var r = { id: a.id, score: ev.score, parts: ev.parts, issues: ev.issues, tier: ev.tier, ter: ev.ter, conditions: ev.conditions, feasible: ev.feasible };
    if (ev.level === 'reject') r.outcome = 'Reject';
    else if (ev.level === 'hold') r.outcome = 'Hold';
    else r.outcome = oc.o;
    if (r.outcome === 'Approve' || r.outcome === 'Waitlist') {
      var x = ready.filter(function (y) { return y.a.id === a.id; })[0];
      r.rankPin = x.rankPin; r.pinN = x.pinN; r.rankTer = x.rankTer || null; r.terN = x.terN || null;
      r.pinRivals = x.pinGroup.filter(function (y) { return y.a.id !== a.id; }).map(function (y) { return y.a.id; });
      if (oc.reason) { r.waitReason = oc.reason; r.winner = oc.winner || null; }
      if (r.outcome === 'Approve') {
        var next = null;
        if (x.pinGroup.length > 1) next = x.pinGroup[1];
        else {
          var g = byTer[ev.ter.id], t = ev.ter;
          if (g.length > t.slots) next = g[t.slots];
        }
        if (next) { r.nextRival = next.a.id; r.margin = r1(ev.score - next.ev.score); }
      } else if (oc.reason === 'territory_full') {
        var gg = byTer[ev.ter.id]; r.beatenBy = gg.slice(0, ev.ter.slots).map(function (y) { return y.a.id; });
        r.margin = r1(gg[ev.ter.slots - 1] ? gg[ev.ter.slots - 1].ev.score - ev.score : 0);
      } else {
        var w = x.pinGroup[0]; r.margin = r1(w.ev.score - ev.score);
      }
    }
    res[a.id] = r;
  });
  return { ctx: ctx, evals: evals, res: res, ready: ready, byTer: byTer, approvedByTer: approvedByTer, approvedPins: approvedPins, live: live };
}

function freePins(core0, city, exceptApp) {
  var out = [];
  core0.ctx.territories.forEach(function (t) {
    if (t.city !== city) return;
    var left = t.slots - (core0.approvedByTer[t.id] || 0);
    if (left <= 0) return;
    t.pins.forEach(function (p) {
      if (core0.ctx.storeByPin[p]) return;
      if (core0.approvedPins[p]) return;
      var contested = core0.ready.some(function (x) { return x.a.pin === p && (!exceptApp || x.a.id !== exceptApp); });
      out.push({ pin: p, ter: t.id, priority: t.priority, contested: contested, left: left });
    });
  });
  var pr = { High: 0, Medium: 1, Low: 2 };
  out.sort(function (a, b) { return (a.contested - b.contested) || (pr[a.priority] - pr[b.priority]) || (a.pin < b.pin ? -1 : 1); });
  return out;
}

function simulateFixed(a, core0, apps, territories, stores, cfg) {
  var ev = core0.evals[a.id], b = clone(a), fixes = [], possible = true, why = '';
  var fp = freePins(core0, a.city, a.id);
  ev.issues.forEach(function (i) {
    switch (i.code) {
      case 'PIN_HAS_STORE': case 'PIN_OUTSIDE':
        if (fp.length) { b.pin = fp[0].pin; fixes.push('Take free pin ' + fp[0].pin + ' in ' + fp[0].ter); } else { possible = false; why = 'no_free_pin'; }
        break;
      case 'PIN_MISMATCH': case 'PIN_BAD': case 'CITY_UNKNOWN': possible = false; why = 'pin_unknown'; break;
      case 'NO_SPACE': b.space = 'Rented'; b.size = cfg.idealMin; b.floor = 'Ground'; b.sizeAssumed = false; b.notesSuperseded = true; fixes.push('Find a rented ground-floor space of about ' + cfg.idealMin + ' sq ft'); break;
      case 'SIZE_MISSING': b.size = cfg.idealMin; fixes.push('Confirm a space of at least ' + cfg.idealMin + ' sq ft'); break;
      case 'SIZE_SMALL': b.size = cfg.idealMin; fixes.push('Move to a space of at least ' + cfg.idealMin + ' sq ft'); break;
      case 'FLOOR_UPPER': b.floor = 'Ground'; fixes.push('Move to a ground-floor or mall space'); break;
      case 'INVEST_GAP': case 'INVEST_MISSING': b.invest = i.need || ev.floor; fixes.push('Show Rs ' + (i.need || ev.floor) + ' lakh of investable funds'); break;
      case 'NOTES_CONFLICT': b.notesSuperseded = true; fixes.push('Clear up the contradiction between notes and form'); break;
    }
  });
  if (!possible || ev.issues.some(function (i) { return i.level === 'reject'; })) return { possible: false, why: why, fixes: fixes };
  var apps2 = apps.map(function (x) { return x.id === a.id ? b : x; });
  var c2 = core(apps2, territories, stores, cfg), r2 = c2.res[a.id];
  return { possible: true, fixes: fixes, outcome: r2.outcome, rankPin: r2.rankPin, pinN: r2.pinN, score: r2.score, pin: b.pin,
           terId: r2.ter ? r2.ter.id : null, winner: r2.winner || null, beatenBy: r2.beatenBy || null, stillHold: r2.outcome === 'Hold' };
}

function run(apps, territories, stores, cfg) {
  var c = core(apps, territories, stores, cfg);
  Object.keys(c.res).forEach(function (id) {
    var r = c.res[id], a = apps.filter(function (x) { return x.id === id; })[0];
    if (r.outcome === 'Hold') {
      r.ifFixed = simulateFixed(a, c, apps, territories, stores, cfg);
      var pinIssue = r.issues.filter(function (i) { return i.code === 'PIN_HAS_STORE' || i.code === 'PIN_OUTSIDE'; })[0];
      if (pinIssue) r.alternatives = freePins(c, a.city, a.id).slice(0, 4);
    } else if (r.outcome === 'Waitlist') {
      r.alternatives = freePins(c, a.city, a.id).filter(function (p) { return p.pin !== a.pin; }).slice(0, 3);
    }
  });
  c.cfg = cfg;
  return c;
}

/* ------------------------------------------------------------------ */
/* Plain-language explanation of a decision                            */
/* ------------------------------------------------------------------ */
function strengths(r) {
  var arr = Object.keys(r.parts).map(function (k) { return { k: k, f: r.parts[k].max ? r.parts[k].pts / r.parts[k].max : 0, p: r.parts[k] }; });
  arr.sort(function (a, b) { return b.f - a.f; });
  return arr;
}

function explain(r, a, state) {
  var cfg = state.cfg, out = { headline: '', lines: [], next: [] };
  var t = r.ter;
  if (r.outcome === 'Approve') {
    out.headline = 'Approved for pin ' + a.pin + (t ? ' in ' + t.id + ' (' + a.city + ', ' + t.tier + ', ' + t.priority + ' priority)' : '');
    var st = strengths(r).slice(0, 2).map(function (s) { return s.p.label.toLowerCase() + ' (' + s.p.note + ')'; });
    out.lines.push('Score ' + r.score + ' out of 100. Strongest points: ' + st.join('; ') + '.');
    if (r.pinN > 1) out.lines.push('Won pin ' + a.pin + ' against ' + r.pinRivals.join(', ') + (r.margin !== undefined ? ' by ' + r.margin + ' points.' : '.'));
    if (r.terN) out.lines.push('Took one of ' + t.slots + ' open slot' + (t.slots === 1 ? '' : 's') + ' in ' + t.id + (r.nextRival ? '; the next in line is ' + r.nextRival + ' (' + r.margin + ' points behind).' : '.'));
    if (r.conditions.length) out.lines.push('Conditions to clear: ' + r.conditions.join('; ') + '.');
  } else if (r.outcome === 'Waitlist') {
    out.headline = 'Eligible, but waitlisted';
    if (r.waitReason === 'pin_lost') {
      out.lines.push('Scores ' + r.score + ', but pin ' + a.pin + ' goes to ' + r.winner + ' (' + r.margin + ' points ahead). The brand opens one store per pin code.');
      out.next.push('Moves up if ' + r.winner + ' drops out or fails verification.');
    } else {
      out.lines.push('Best applicant for pin ' + a.pin + ' (score ' + r.score + '), but ' + t.id + ' has only ' + t.slots + ' open slot' + (t.slots === 1 ? '' : 's') + ', taken by ' + (r.beatenBy || []).join(', ') + ' with higher scores' + (r.margin ? ' (' + r.margin + ' points ahead at the cut-off).' : '.'));
      out.next.push('Promoted if a slot opens in ' + t.id + ' or one of those applicants drops out.');
    }
    if (r.alternatives && r.alternatives.length) out.next.push('Open alternative' + (r.alternatives.length > 1 ? 's' : '') + ' in ' + a.city + ': ' + r.alternatives.map(function (p) { return p.pin + ' (' + p.ter + ')'; }).join(', ') + ' (needs a space there).');
  } else if (r.outcome === 'Hold') {
    var holds = r.issues.filter(function (i) { return i.level === 'hold'; });
    out.headline = 'On hold: ' + holds.map(function (i) { return i.title.toLowerCase(); }).join('; ');
    holds.forEach(function (i) { out.lines.push(i.detail); });
    if (r.ifFixed) {
      var f = r.ifFixed;
      if (!f.possible && f.why === 'no_free_pin') out.next.push('No open pin is left in ' + a.city + ': every slot in its territories is already taken, so a re-targeted application would join the waitlist.');
      else if (!f.possible) out.next.push('Cannot be re-scored until the pin code or city is corrected.');
      else {
        out.next.push('To move forward: ' + f.fixes.join('; ') + '.');
        if (f.outcome === 'Approve') out.next.push('If that happens, the application would be approved (score ' + f.score + (f.pinN > 1 ? ', ranked #' + f.rankPin + ' of ' + f.pinN + ' for pin ' + f.pin : '') + ').');
        else if (f.outcome === 'Waitlist') out.next.push('If that happens, it would still be waitlisted (score ' + f.score + (f.winner ? ', behind ' + f.winner : f.beatenBy ? ', behind ' + f.beatenBy.join(', ') : '') + ').');
        else out.next.push('Even then it would remain on hold for other reasons.');
      }
    }
    if (r.alternatives && r.alternatives.length) out.next.push('Open pins in ' + a.city + ': ' + r.alternatives.map(function (p) { return p.pin + ' (' + p.ter + ')'; }).join(', ') + '.');
  } else if (r.outcome === 'Reject') {
    var rj = r.issues.filter(function (i) { return i.level === 'reject'; });
    out.headline = 'Not taken forward: ' + rj.map(function (i) { return i.title.toLowerCase(); }).join('; ');
    rj.forEach(function (i) { out.lines.push(i.detail); });
    out.next.push('Keep on file and re-contact if the situation changes (for example, more capital or a new territory opening).');
  }
  r.issues.filter(function (i) { return i.level === 'soft' || i.level === 'info'; }).forEach(function (i) { out.lines.push('Note: ' + i.detail); });
  if (r.outcome === 'Approve') {
    out.short = 'Takes pin ' + a.pin + (t ? ' in ' + t.id : '') + (r.pinN > 1 ? ', ahead of ' + r.pinRivals.join(', ') + ' by ' + r.margin : r.nextRival ? ', ' + r.margin + ' ahead of ' + r.nextRival : '') + (r.conditions.length ? '; ' + r.conditions.length + ' condition' + (r.conditions.length > 1 ? 's' : '') : '');
  } else if (r.outcome === 'Waitlist') {
    out.short = r.waitReason === 'pin_lost' ? 'Pin ' + a.pin + ' goes to ' + r.winner + ' (' + r.margin + ' points ahead)' : t.id + ' is full; ' + r.margin + ' points under the cut-off';
  } else out.short = out.headline;
  return out;
}

/* ------------------------------------------------------------------ */
/* Onboarding plan for approved partners                               */
/* ------------------------------------------------------------------ */
function mentorStore(a, ctx) {
  var ns = nearestStoreInfo(a, ctx);
  if (ns) return ns.store;
  var nc = NEAREST_CITY[a.city];
  var s = ctx.stores.filter(function (x) { return x.city === nc; });
  return s.length ? s[s.length - 1] : ctx.stores[0];
}

function onboardingPlan(r, a, state) {
  var cfg = state.cfg, lang = a.lang || 'English';
  var ctx = state.run.ctx;
  var firstTimer = (a.exp || 0) < cfg.firstTimerYears;
  var mentor = mentorStore(a, ctx);
  var steps = [
    { wk: 'Week 0-1', title: 'Verify and sign', detail: 'KYC, proof of funds (Rs ' + (r.ter ? cfg.floors[r.tier] : '') + ' lakh minimum) and space documents. Franchise agreement signed.' },
    { wk: 'Week 1-2', title: 'Site validation', detail: 'Visit to the ' + (a.size ? a.size + ' sq ft ' : '') + (a.floor === 'Not known' ? '' : a.floor.toLowerCase() + ' ') + 'space; layout and signage approved.' },
    { wk: 'Week 2-6', title: 'Fit-out and licences', detail: 'Fit-out by the brand vendor; shop and establishment licence and GST registration in parallel; first inventory ordered.' },
    { wk: firstTimer ? 'Week 3-6' : 'Week 4-5', title: 'Training in ' + lang,
      detail: (firstTimer ? 'Extended 3-week track for first-time retailers: product and sales basics, billing and inventory systems, then one week shadowing at ' + mentor.id + ' (' + mentor.city + ').'
                          : 'Express 1-week track for experienced retailers: brand standards, billing and inventory systems, and a day at ' + mentor.id + ' (' + mentor.city + ').') +
              ' All material and the trainer in ' + lang + '.' },
    { wk: 'Week 7-8', title: 'Systems and dry run', detail: 'POS and stock system set up; mock sales day with the area manager.' },
    { wk: 'Week ' + cfg.earliestWeeks, title: 'Opening and first 30 days', detail: 'Soft launch, then grand opening. Daily check-in for week 1, weekly review for the first month.' }
  ];
  var targetNote = '';
  if (a.launch !== null) {
    var fm = r.feasible;
    targetNote = a.launch >= fm ? 'Target of ' + a.launch + ' month(s) is achievable.' : 'Target of ' + a.launch + ' month(s) is too tight; the realistic opening is about ' + fm.toFixed(1) + ' months from approval.';
  }
  return { track: firstTimer ? 'Extended (first-time retailer)' : 'Express (experienced)', language: lang, mentor: mentor, steps: steps, openWeeks: cfg.earliestWeeks, targetNote: targetNote, conditions: r.conditions };
}

/* ------------------------------------------------------------------ */
/* Messages to applicants in their own language                        */
/* ------------------------------------------------------------------ */
var ASK = {
  PIN_BAD: { en: 'a valid 6-digit pin code', hi: 'सही 6 अंकों का पिन कोड', kn: 'ಸರಿಯಾದ 6 ಅಂಕಿಯ ಪಿನ್ ಕೋಡ್' },
  PIN_MISMATCH: { en: 'the correct pin code and city (the two do not match)', hi: 'सही पिन कोड और शहर (दोनों मेल नहीं खाते)', kn: 'ಸರಿಯಾದ ಪಿನ್ ಕೋಡ್ ಮತ್ತು ನಗರ (ಇವೆರಡೂ ಹೊಂದಿಕೆಯಾಗುತ್ತಿಲ್ಲ)' },
  CITY_UNKNOWN: { en: 'your city', hi: 'आपका शहर', kn: 'ನಿಮ್ಮ ನಗರ' },
  PIN_HAS_STORE: { en: 'a different pin code (we already have a store in this one)', hi: 'कोई दूसरा पिन कोड (इस पिन कोड में हमारा स्टोर पहले से है)', kn: 'ಬೇರೆ ಪಿನ್ ಕೋಡ್ (ಈ ಪಿನ್ ಕೋಡ್‌ನಲ್ಲಿ ನಮ್ಮ ಅಂಗಡಿ ಈಗಾಗಲೇ ಇದೆ)' },
  PIN_OUTSIDE: { en: 'a pin code inside our current expansion areas', hi: 'हमारे वर्तमान विस्तार क्षेत्रों के भीतर का पिन कोड', kn: 'ನಮ್ಮ ಪ್ರಸ್ತುತ ವಿಸ್ತರಣಾ ಪ್ರದೇಶಗಳೊಳಗಿನ ಪಿನ್ ಕೋಡ್' },
  NO_SPACE: { en: 'details of a shop space (ownership, size and floor)', hi: 'दुकान की जगह का विवरण (मालिकाना, आकार और मंज़िल)', kn: 'ಅಂಗಡಿ ಜಾಗದ ವಿವರಗಳು (ಮಾಲೀಕತ್ವ, ಗಾತ್ರ ಮತ್ತು ಮಹಡಿ)' },
  SIZE_MISSING: { en: 'the size of your space in sq ft', hi: 'आपकी जगह का आकार (वर्ग फुट में)', kn: 'ನಿಮ್ಮ ಜಾಗದ ಗಾತ್ರ (ಚದರ ಅಡಿಗಳಲ್ಲಿ)' },
  SIZE_SMALL: { en: 'a space of at least {min} sq ft', hi: 'कम से कम {min} वर्ग फुट की जगह', kn: 'ಕನಿಷ್ಠ {min} ಚದರ ಅಡಿಗಳ ಜಾಗ' },
  FLOOR_UPPER: { en: 'a ground-floor or mall space (upper floors get too few customers)', hi: 'ग्राउंड फ्लोर या मॉल में जगह (ऊपरी मंज़िल पर ग्राहक कम आते हैं)', kn: 'ನೆಲ ಮಹಡಿ ಅಥವಾ ಮಾಲ್‌ನಲ್ಲಿ ಜಾಗ (ಮೇಲಿನ ಮಹಡಿಗಳಿಗೆ ಗ್ರಾಹಕರು ಕಡಿಮೆ ಬರುತ್ತಾರೆ)' },
  INVEST_GAP: { en: 'proof of about Rs {need} lakh in total funds (or a co-investor)', hi: 'कुल लगभग ₹{need} लाख की राशि का प्रमाण (या सह-निवेशक)', kn: 'ಒಟ್ಟು ಸುಮಾರು ₹{need} ಲಕ್ಷ ಹಣದ ಪುರಾವೆ (ಅಥವಾ ಸಹ-ಹೂಡಿಕೆದಾರ)' },
  INVEST_MISSING: { en: 'your investment amount', hi: 'आपकी निवेश राशि', kn: 'ನಿಮ್ಮ ಹೂಡಿಕೆ ಮೊತ್ತ' },
  NOTES_CONFLICT: { en: 'a clarification: your notes and your form say different things about your space', hi: 'स्पष्टीकरण: आपके नोट्स और फ़ॉर्म में जगह के बारे में अलग-अलग जानकारी है', kn: 'ಸ್ಪಷ್ಟೀಕರಣ: ನಿಮ್ಮ ಟಿಪ್ಪಣಿ ಮತ್ತು ಫಾರ್ಮ್‌ನಲ್ಲಿ ಜಾಗದ ಬಗ್ಗೆ ಬೇರೆ ಬೇರೆ ಮಾಹಿತಿ ಇದೆ' }
};
var REJECT_WHY = {
  INVEST_LOW: { en: 'the investment capacity is well below what a store in this city needs', hi: 'निवेश क्षमता इस शहर में स्टोर के लिए ज़रूरी राशि से काफ़ी कम है', kn: 'ಹೂಡಿಕೆ ಸಾಮರ್ಥ್ಯ ಈ ನಗರದಲ್ಲಿ ಅಂಗಡಿಗೆ ಬೇಕಾದ ಮೊತ್ತಕ್ಕಿಂತ ತುಂಬಾ ಕಡಿಮೆ ಇದೆ' },
  NO_TERRITORY: { en: 'we are not opening new stores in this city right now', hi: 'हम फ़िलहाल इस शहर में नए स्टोर नहीं खोल रहे हैं', kn: 'ನಾವು ಸದ್ಯಕ್ಕೆ ಈ ನಗರದಲ್ಲಿ ಹೊಸ ಅಂಗಡಿಗಳನ್ನು ತೆರೆಯುತ್ತಿಲ್ಲ' }
};
var LANGKEY = { English: 'en', Hindi: 'hi', Kannada: 'kn' };

function fill(s, m) { return s.replace(/\{(\w+)\}/g, function (_, k) { return m[k] !== undefined ? m[k] : ''; }); }

function letter(r, a, lang, cfg) {
  var L = LANGKEY[lang] || 'en';
  var m = { name: a.name, id: a.id, pin: a.pin, city: a.city, min: cfg.minSpace };
  var T = {
    Approve: {
      en: 'Dear {name}, congratulations! Your application {id} for a store in {city} (pin code {pin}) is approved. Next step: document verification and the franchise agreement. Your training will be in English. Our team will call you within 2 working days.',
      hi: 'प्रिय {name}, बधाई हो! {city} (पिन कोड {pin}) में स्टोर के लिए आपका आवेदन {id} स्वीकृत हो गया है। अगला कदम: दस्तावेज़ों का सत्यापन और फ्रैंचाइज़ी एग्रीमेंट। आपकी ट्रेनिंग हिंदी में होगी। हमारी टीम 2 कार्य-दिवसों में आपको फ़ोन करेगी।',
      kn: 'ಆತ್ಮೀಯ {name}, ಅಭಿನಂದನೆಗಳು! {city} (ಪಿನ್ ಕೋಡ್ {pin}) ನಲ್ಲಿ ಅಂಗಡಿ ತೆರೆಯಲು ನಿಮ್ಮ ಅರ್ಜಿ {id} ಅನುಮೋದನೆಯಾಗಿದೆ. ಮುಂದಿನ ಹಂತ: ದಾಖಲೆಗಳ ಪರಿಶೀಲನೆ ಮತ್ತು ಫ್ರಾಂಚೈಸಿ ಒಪ್ಪಂದ. ನಿಮ್ಮ ತರಬೇತಿ ಕನ್ನಡದಲ್ಲಿ ನಡೆಯುತ್ತದೆ. ನಮ್ಮ ತಂಡ 2 ಕೆಲಸದ ದಿನಗಳಲ್ಲಿ ನಿಮಗೆ ಕರೆ ಮಾಡುತ್ತದೆ.'
    },
    Waitlist: {
      en: 'Dear {name}, your application {id} is eligible, but there is no open place for pin code {pin} at the moment. You are on our waiting list and we will contact you as soon as a place opens up.',
      hi: 'प्रिय {name}, आपका आवेदन {id} योग्य है, लेकिन अभी पिन कोड {pin} के लिए जगह उपलब्ध नहीं है। आप हमारी प्रतीक्षा सूची में हैं और जगह खाली होते ही हम आपसे संपर्क करेंगे।',
      kn: 'ಆತ್ಮೀಯ {name}, ನಿಮ್ಮ ಅರ್ಜಿ {id} ಅರ್ಹವಾಗಿದೆ, ಆದರೆ ಸದ್ಯಕ್ಕೆ ಪಿನ್ ಕೋಡ್ {pin} ಗೆ ಸ್ಥಾನ ಲಭ್ಯವಿಲ್ಲ. ನೀವು ನಮ್ಮ ಕಾಯುವ ಪಟ್ಟಿಯಲ್ಲಿದ್ದೀರಿ; ಸ್ಥಾನ ಖಾಲಿಯಾದ ತಕ್ಷಣ ನಾವು ನಿಮ್ಮನ್ನು ಸಂಪರ್ಕಿಸುತ್ತೇವೆ.'
    },
    Hold: {
      en: 'Dear {name}, thank you for applying ({id}). We cannot approve it yet. Please send us: {ask}. As soon as we have this, we will review your application again.',
      hi: 'प्रिय {name}, आवेदन ({id}) के लिए धन्यवाद। हम इसे अभी स्वीकृत नहीं कर सकते। कृपया हमें भेजें: {ask}। यह मिलते ही हम आपके आवेदन की दोबारा समीक्षा करेंगे।',
      kn: 'ಆತ್ಮೀಯ {name}, ಅರ್ಜಿ ({id}) ಸಲ್ಲಿಸಿದ್ದಕ್ಕೆ ಧನ್ಯವಾದಗಳು. ನಾವು ಇದನ್ನು ಇನ್ನೂ ಅನುಮೋದಿಸಲು ಸಾಧ್ಯವಿಲ್ಲ. ದಯವಿಟ್ಟು ನಮಗೆ ಕಳುಹಿಸಿ: {ask}. ಇದು ಸಿಕ್ಕ ತಕ್ಷಣ ನಾವು ನಿಮ್ಮ ಅರ್ಜಿಯನ್ನು ಮತ್ತೆ ಪರಿಶೀಲಿಸುತ್ತೇವೆ.'
    },
    Reject: {
      en: 'Dear {name}, thank you for applying ({id}). We are sorry we cannot take this application forward: {why}. We will keep your details and contact you if this changes.',
      hi: 'प्रिय {name}, आवेदन ({id}) के लिए धन्यवाद। हमें खेद है कि हम इस आवेदन को आगे नहीं बढ़ा पा रहे हैं: {why}। हम आपका विवरण सुरक्षित रखेंगे और स्थिति बदलने पर आपसे संपर्क करेंगे।',
      kn: 'ಆತ್ಮೀಯ {name}, ಅರ್ಜಿ ({id}) ಸಲ್ಲಿಸಿದ್ದಕ್ಕೆ ಧನ್ಯವಾದಗಳು. ಕ್ಷಮಿಸಿ, ನಾವು ಈ ಅರ್ಜಿಯನ್ನು ಮುಂದುವರಿಸಲು ಸಾಧ್ಯವಿಲ್ಲ: {why}. ನಿಮ್ಮ ವಿವರಗಳನ್ನು ಇಟ್ಟುಕೊಳ್ಳುತ್ತೇವೆ ಮತ್ತು ಪರಿಸ್ಥಿತಿ ಬದಲಾದರೆ ಸಂಪರ್ಕಿಸುತ್ತೇವೆ.'
    }
  };
  if (r.outcome === 'Hold') {
    var asks = r.issues.filter(function (i) { return i.level === 'hold' && ASK[i.code]; }).map(function (i) {
      return fill(ASK[i.code][L], { min: cfg.minSpace, need: i.need || '' });
    });
    m.ask = asks.join(L === 'en' ? '; ' : '; ');
  }
  if (r.outcome === 'Reject') {
    var rj = r.issues.filter(function (i) { return i.level === 'reject'; })[0];
    m.why = rj && REJECT_WHY[rj.code] ? REJECT_WHY[rj.code][L] : '';
  }
  var tpl = T[r.outcome];
  if (!tpl) return '';
  var text = tpl[L];
  if (r.outcome === 'Approve' && L === 'en') text = text.replace('in English', 'in ' + (a.lang || 'English'));
  return fill(text, m);
}

var api = {
  CITIES: CITIES, STORES: STORES, DEFAULT_CFG: DEFAULT_CFG, NEAREST_CITY: NEAREST_CITY,
  parseApplications: parseApplications, parseTerritories: parseTerritories,
  evaluateApp: evaluateApp, run: run, explain: explain, onboardingPlan: onboardingPlan, letter: letter,
  freePins: freePins, clone: clone, canonCity: canonCity, num: num, strengths: strengths, pad: pad,
  ASK: ASK, LANGKEY: LANGKEY, fill: fill
};
if (typeof module !== 'undefined' && module.exports) module.exports = api;
root.Engine = api;
})(typeof window !== 'undefined' ? window : globalThis);
