// Writes docs/slide4-assumptions-register.md from the live app's register, so the slide 4 table is never out of date.
// Run: node test/make-register-doc.js
const { chromium } = require('playwright'), path = require('path'), fs = require('fs');
(async () => {
  const b = await chromium.launch(), p = await b.newPage();
  await p.goto('file://' + path.join(__dirname, '..', 'dist', 'index.html'));
  await p.setInputFiles('#file', path.join(__dirname, '..', 'test-data', 'sample-judges-layout.xlsx')); await p.waitForSelector('.row');
  const rows = await p.evaluate(() => window.__desk.assumptionRows());
  await b.close();
  const areas = [...new Set(rows.map(r => r.area))];
  const md = '# Slide 4: assumptions and how we would check them\n\nGenerated from the app (Records, Assumptions register) by `node test/make-register-doc.js`. Every row is shown on screen as an assumption, can be edited where the "Change it" column says, and has a real-world check.\n\n' +
    areas.map(a => '## ' + a + '\n\n| Assumption | Default | Change it | How we would check it |\n|---|---|---|---|\n' + rows.filter(r => r.area === a).map(r => '| ' + [r.name, r.def, r.where, r.how].map(x => String(x).replace(/\|/g, '/')).join(' | ') + ' |').join('\n')).join('\n\n') +
    '\n\n## What the tool deliberately does not assume\n\n- **Offers:** no drop-off rate. When an offer lapses the next waitlisted applicant is promoted, so nothing is ever offered twice and no over-offering percentage is needed.\n- **Territory levers:** no rupee figures. The page names the lever and an owner; money appears only if the team types its own incentive cost and store value, and then only as a break-even.\n- **Bad six months:** uses the same placeholder sales and costs as the payback band, labelled illustrative, with the real check being the first six months of sales at existing stores.\n';
  fs.writeFileSync(path.join(__dirname, '..', 'docs', 'slide4-assumptions-register.md'), md);
  console.log('wrote docs/slide4-assumptions-register.md with ' + rows.length + ' assumptions in ' + areas.length + ' areas');
})();
