// Reading follow-ups more broadly: ID forms, typos, synonyms, several changes in one sentence, hypotheticals.
// Pure text functions; src/ext/understand.js turns the result into changes through the same update functions as the Ask box.
(function (root) {
'use strict';

// Words the desk acts on. A misspelt word within one edit (two for long words) of one of these is corrected.
var VOCAB = ('why waitlisted waitlist approved approve approval rejected reject hold held found ground floor space shop premises ' +
  'withdrawn withdrew withdraw invest investment lakh lakhs crore slot slots priority compare competing competitor rivals rival ' +
  'summary territory experience years months language kannada hindi english mall upper rented owned lease signed explain reason ' +
  'happened confident confidence fragile override anyway because increase another extra additional square feet launch opening ' +
  'store stores ahead behind against dropped interested applicant application identified secured finalised rent owns').split(' ');
// Ordinary words that must never be "corrected"
var KEEP = {};
('the and has have had now new not with for from that this what who whom which when where how can could would will was were are ' +
 'is be been she he they them her his their our your you me my we us its also just only more less then than into onto over under ' +
 'after before still very much many some any all each every other same show tell give list about like want wants need needs does ' +
 'done make made take took get got gets find finds look looking near main road market city town there here said says say if else ' +
 'should might must back out off down up one two three four five six seven eight nine ten first second third per case team call ' +
 'sign sure okay yes please thanks thank put set move moved moves open opened opens ready able plan plans money fund funds budget ' +
 'capital raise raised bank loan bought buy own size area pin code codes wait what whats happen status update updated changed ' +
 'change instead since just told says agreed agree partner partners owner store unit units shop shops place close upper lower ' +
 'level side front rear road high low medium full half both either neither more most least them those these such sold hand ' +
 'fine good great bigger smaller large small big ground floor floors who whose suppose imagine assume would able also going ' +
 'ahead left gave give gone come came none nothing something someone anyone else bound bold hole fold cold told sold mold').split(' ').forEach(function (w) { KEEP[w] = 1; });
VOCAB.forEach(function (w) { KEEP[w] = 1; });

function dist(a, b, max) {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  var pp = null, prev = [], cur, i, j;
  for (j = 0; j <= b.length; j++) prev[j] = j;
  for (i = 1; i <= a.length; i++) {
    cur = [i]; var rowMin = i;
    for (j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (pp && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) cur[j] = Math.min(cur[j], pp[j - 2] + 1);  // swapped letters
      rowMin = Math.min(rowMin, cur[j]);
    }
    if (rowMin > max) return max + 1;
    pp = prev; prev = cur;
  }
  return prev[b.length];
}
function fixWord(w) {
  var lw = w.toLowerCase();
  if (lw.length < 3 || KEEP[lw] || KEEP[lw.replace(/(es|s|ed|ing)$/, '')] || /\d/.test(lw)) return null;
  var max = lw.length >= 7 ? 2 : 1, best = null, bd = max + 1, tie = false;
  VOCAB.forEach(function (v) {
    if (lw.length < 7 && v[0] !== lw[0]) return;
    var d = dist(lw, v, max);
    if (d < bd) { bd = d; best = v; tie = false; }
    else if (d === bd && best && v !== best) { if (v.indexOf(best) === 0) best = v; else if (best.indexOf(v) !== 0) tie = true; }  // waitlist/waitlisted: take the longer
  });
  return best && bd <= max && !tie ? best : null;
}

var SYN = [
  [/\b(declines?|declined|will not sign|won'?t sign|wont sign|not signing|never signed|did not sign|didn'?t sign|does not sign|doesn'?t sign|lets? the offer (?:expire|lapse)|offer (?:expires|expired|lapses|lapsed))\b/gi, 'withdrew'],
  [/\b(quit|quits|has quit|is out|pulled out|not going ahead|not proceeding|no longer proceeding|gave up|has left|backed off|cancelled|canceled)\b/gi, 'withdrew'],
  [/\b(ground[-\s]?level|street[-\s]?level|street[-\s]?facing|road[-\s]?facing|groundfloor|gf)\b/gi, 'ground floor'],
  [/\bfirst[-\s]floor\b/gi, 'first floor'],
  [/\b(sqft|sq\.\s?ft\.?|sq\s?ft|sft|square\s?foot)\b/gi, 'sq ft'],
  [/₹\s?/g, 'Rs '],
  [/\b(adn|nad|anf)\b/gi, 'and'], [/\b(waht|whta|wht)\b/gi, 'what'], [/\b(hwo|hw)\b/gi, 'how'], [/\b(teh|hte)\b/gi, 'the'], [/\b(wyh|whyy)\b/gi, 'why'],
  [/\b(has|have|had|just)\s+fund\b/gi, '$1 found'],
  [/\b(lakhs|lacs|lac)\b/gi, 'lakh']
];

// Normalises a follow-up. Returns { text, fixes: [[from, to]], ids: true if an ID form was rewritten }
function normalize(text) {
  var t = String(text || ''), fixes = [];
  t = t.replace(/[A-Za-z]+/g, function (w) { var f = fixWord(w); if (f && f !== w.toLowerCase()) { fixes.push([w, f]); return f; } return w; });
  var t0 = t;
  t = t.replace(/\b(?:application|app|ap)\s*(?:no\.?|number|#|id)?\s*[-#_:.]?\s*0*(\d{1,4})\b/gi, function (m, n) { return 'APP-' + (n.length < 3 ? ('00' + n).slice(-3) : n); });
  t = t.replace(/\b(?:territory|terr|ter)\s*(?:no\.?|number|#|id)?\s*[-#_:.]?\s*0*(\d{1,3})\b/gi, function (m, n) { return 'TER-' + ('0' + n).slice(-2); });
  var idsRewritten = t !== t0;
  SYN.forEach(function (s) { t = t.replace(s[0], s[1]); });
  if (/\bTER-\d/.test(t)) t = t.replace(/\b(more|another|extra|additional|\d+)\s+(stores?|outlets?|locations?|franchises?|spots?|places?)\b/gi, '$1 slots');
  return { text: t, fixes: fixes, ids: idsRewritten };
}

// Splits "APP-012 found a shop and APP-010 can invest 30 lakh" into one clause per ID.
function split(text) {
  var re = /\b(APP|TER)-\d+/gi, m, pos = [];
  while ((m = re.exec(text))) pos.push(m.index);
  if (pos.length < 2) return [text];
  var cuts = [0];
  for (var i = 1; i < pos.length; i++) {
    var between = text.slice(pos[i - 1], pos[i]);
    var d = /^(.*)(;|\.\s|,\s*(?:and\s+|also\s+|plus\s+)?|\s(?:and|also|plus|while|but)\s+(?:also\s+)?)/i.exec(between);
    var dm = null, rx = /(;|\.\s|,\s*(?:and\s+|also\s+|plus\s+)?|\s(?:and|also|plus|while|but)\s+(?:also\s+)?)/gi, x;
    while ((x = rx.exec(between))) dm = x;
    if (d && dm) cuts.push(pos[i - 1] + dm.index + dm[0].length);
  }
  var out = [];
  for (var k = 0; k < cuts.length; k++) out.push(text.slice(cuts[k], cuts[k + 1]).replace(/^[\s,;.]+|[\s,;.]+$/g, '').replace(/\s+(and|also|plus)$/i, ''));
  return out.filter(Boolean);
}

// "Would APP-012 be approved if she found a shop?" asks about a change without reporting one.
function isHypothetical(text) {
  var low = text.toLowerCase().trim();
  if (/\bwhat if\b/.test(low)) return false;   // "what if" is applied as a scenario with undo, as before
  return /^(would|will|could|does|do|is|can|should|what happens|what would happen|suppose|imagine|assume|say|if)\b/.test(low) && /\bif\b|\bsuppose\b|\bimagine\b|\bassum/.test(low);
}

// Relative investment: "raised another 5 lakh"
function relativeInvest(text) {
  var m = text.toLowerCase().match(/\b(another|more|extra|additional|further)\s*(?:rs\.?\s*)?(\d+(?:\.\d+)?)\s*(lakh|l)\b|\b(?:rs\.?\s*)?(\d+(?:\.\d+)?)\s*(lakh|l)\s+(more|extra)\b/);
  return m ? parseFloat(m[2] || m[4]) : null;
}

var api = { normalize: normalize, split: split, isHypothetical: isHypothetical, relativeInvest: relativeInvest, fixWord: fixWord };
if (typeof module !== 'undefined' && module.exports) module.exports = api;
root.DeskUnderstand = api;
})(typeof window !== 'undefined' ? window : globalThis);
