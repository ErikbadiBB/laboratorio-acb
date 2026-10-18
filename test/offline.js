// Sin conexión: la web publicada (servida en localhost con su service worker) se vuelve a abrir
// sin red y muestra el último partido guardado
const http = require('http'), fs = require('fs'), path = require('path');
const launch = require('./browser');
const fx = require('./bcl136295.json');
const SITE = path.join(__dirname, '..', 'site');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.png': 'image/png' };
const srv = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  if (u.pathname === '/api/bcl') { const { box, ...rest } = fx; res.writeHead(200, { 'Content-Type': 'application/json' }); return res.end(JSON.stringify(Object.assign(rest, { finished: true }))); }
  const f = path.join(SITE, u.pathname === '/' ? 'index.html' : u.pathname);
  if (!f.startsWith(SITE) || !fs.existsSync(f)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res);
});
srv.listen(0, async () => {
  const base = 'http://localhost:' + srv.address().port + '/';
  const b = await launch(); const ctx = await b.newContext(); const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.goto(base); await p.evaluate(() => localStorage.setItem('lab-acb:proxy', '""')); // puente en el mismo servidor
  await p.goto(base + '?v=1#bcl-136295'); await p.waitForSelector('#view .boardfoot'); await p.waitForTimeout(800);
  await p.evaluate(() => navigator.serviceWorker.ready);
  console.log('con red:', (await p.textContent('#st-match')).slice(0, 30), '| guardados', await p.evaluate(() => localStorage.getItem('lab-acb:saved').length > 10));
  await ctx.setOffline(true);
  await p.goto(base + '?v=2#bcl-136295'); await p.waitForTimeout(1500);
  const board = await p.$('#view .boardfoot');
  console.log('sin red:', await p.textContent('#st-match'), '| marcador', board ? (await p.textContent('#view .score .big')) : 'NO');
  console.log('tarjetas guardadas:', await p.textContent('#pk-round'), (await p.$$('.pk-card')).length, '| errores', errs);
  await b.close(); srv.close();
});
