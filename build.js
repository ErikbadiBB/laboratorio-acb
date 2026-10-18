// Empaqueta app.html + engine.js + partido de ejemplo en un único HTML autónomo
const fs = require('fs');
const path = require('path');
const dir = __dirname;
const app = fs.readFileSync(path.join(dir, 'app.html'), 'utf8');
const engine = fs.readFileSync(path.join(dir, 'engine.js'), 'utf8') + '\n' + fs.readFileSync(path.join(dir, 'fiba.js'), 'utf8') + '\n' + fs.readFileSync(path.join(dir, 'ligau.js'), 'utf8');
const fx = JSON.parse(fs.readFileSync(path.join(dir, 'test/m105375.json'), 'utf8'));
const sample = {
  id: 105375, label: 'Jornada 1 · 26/09/2026',
  home: { id: 4475, clubId: 4, fullName: 'Surne Bilbao', shortName: 'Surne Bilbao', abbreviatedName: 'SBB' },
  away: { id: 4471, clubId: 10, fullName: 'Kids&Us Manresa', shortName: 'Kids&Us Manresa', abbreviatedName: 'K&U' },
  names: fx.names, val: fx.val, rows: fx.rows
};
const out = app
  .replace('/*__ENGINE__*/', () => engine)
  .replace('/*__SAMPLE__*/', () => 'const SAMPLE = ' + JSON.stringify(sample) + ';');
fs.mkdirSync(path.join(dir, 'dist'), { recursive: true });
fs.writeFileSync(path.join(dir, 'dist/statslab.html'), out);
console.log('ok', (out.length / 1024).toFixed(1) + ' KB');
// Versión web autónoma (GitHub Pages / cualquier servidor): documento completo
const head = '<!doctype html>\n<html lang="es">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n<meta name="description" content="Estadística avanzada de partidos ACB y Champions League desde el play by play">\n<meta name="theme-color" content="#1d3b53">\n<meta name="apple-mobile-web-app-capable" content="yes">\n<meta name="apple-mobile-web-app-title" content="StatsLAB">\n<link rel="manifest" href="manifest.webmanifest">\n<link rel="icon" href="icon.svg" type="image/svg+xml">\n<link rel="apple-touch-icon" href="icon-180.png">\n<script>try{var k=JSON.parse(localStorage.getItem("lab-acb:skin"));if(k)document.documentElement.setAttribute("data-skin",k)}catch(e){}</script>\n<style>:root{color-scheme:light;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}body{margin:0;font-size:14px}img{max-width:100%}[hidden]{display:none!important}</style>\n</head>\n<body>\n';
fs.mkdirSync(path.join(dir, 'site'), { recursive: true });
fs.writeFileSync(path.join(dir, 'site/index.html'), head + out + '\n</body>\n</html>\n');
console.log('site/index.html listo');
