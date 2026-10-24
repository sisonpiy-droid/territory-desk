// Inlines everything into one static file: dist/index.html
// Load order: engine.js, sample.js, src/modules/*.js (sorted), ui.js, src/ext/*.js (sorted)
//  - modules: pure logic (metrics, overrides, planning); may register hooks on window.DeskExt
//  - ext:     UI additions that need the app running (use window.__desk); also may register hooks
const fs = require('fs'), path = require('path');
const dir = p => path.join(__dirname, 'src', p);
const list = d => (fs.existsSync(dir(d)) ? fs.readdirSync(dir(d)).filter(f => f.endsWith('.js')).sort().map(f => path.join(d, f)) : []);
const order = ['engine.js', 'sample.js'].concat(list('modules'), ['ui.js'], list('ext'));
const body = order.map(f => '<script>\n/* ' + f + ' */\n' + fs.readFileSync(dir(f), 'utf8').replace(/<\/script>/g, '<\\/script>') + '\n</script>').join('\n');
let html = fs.readFileSync(dir('template.html'), 'utf8').replace('/*SCRIPTS*/', () => body);
fs.mkdirSync(path.join(__dirname, 'dist'), { recursive: true });
fs.writeFileSync(path.join(__dirname, 'dist', 'index.html'), html);
// SheetJS is served from the same site, never a CDN
fs.copyFileSync(path.join(__dirname, 'vendor', 'xlsx.full.min.js'), path.join(__dirname, 'dist', 'xlsx.full.min.js'));
console.log('built dist/index.html from ' + order.join(', ') + ' (' + html.length + ' bytes)');
