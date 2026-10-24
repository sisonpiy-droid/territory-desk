// Site finder screenshots at 1360 and 390, light and dark. Run: node test/shots-geo.js
const {chromium}=require('playwright'),path=require('path');(async()=>{const b=await chromium.launch();const errs=[];
for(const w of [1360,390])for(const sch of ['light','dark']){const p=await b.newPage({viewport:{width:w,height:1000},colorScheme:sch});p.on('pageerror',e=>errs.push(e.message));
await p.goto('file://'+path.resolve('dist/index.html'));await p.setInputFiles('#file','test-data/sample-judges-layout.xlsx');await p.waitForSelector('.row');
await p.click('[data-act=tab][data-v=sites]');await p.click('[data-act=geo-app][data-v=APP-007]');await p.waitForTimeout(300);
await p.evaluate(()=>document.querySelectorAll('.sf-box').forEach(d=>{if(/Sanity/.test(d.textContent))d.open=true}));
await p.evaluate(()=>document.querySelector('.tabs').scrollIntoView());await p.screenshot({path:'shots/g-sites-'+w+'-'+sch+'.png',fullPage:w===390});
if(w===1360&&sch==='light'){await p.evaluate(()=>[...document.querySelectorAll('.sf-box')].find(d=>/Sanity/.test(d.textContent)).scrollIntoView());await p.screenshot({path:'shots/g-sanity.png'});}
console.log(w,sch,'scrollWidth',await p.evaluate(()=>document.documentElement.scrollWidth));}
console.log(errs.length?errs:'no page errors');await b.close();})();
