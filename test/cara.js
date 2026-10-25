// Cara a cara: para cada jugador y cada rival, «con el rival en pista» + «con el rival en el banquillo»
// debe dar exactamente el total del partido (minutos, puntos y +/-). También se comprueba la pestaña en la web.
require('../engine.js'); require('../fiba.js');
const { check, done } = require('./check');
const A = globalThis.ACB, F = globalThis.ACB_FIBA;
const fx = require('./bcl136295.json');
const g = A.parseGame(F.fibaToRaw(JSON.parse(JSON.stringify(fx))), { id: 136295 });
const on = (lin, pid) => String(lin || '').split(',').map(Number).includes(pid);
const tot = new Map(A.playerAdvanced(g).map(p => [p.pid, p]));
let pairs = 0, bad = [];
for (const a of tot.values()) {
  if (!a.min) continue;
  const sb = 1 - a.side;
  for (const b of tot.values()) {
    if (b.side !== sb || !b.min) continue;
    const x = A.playerAdvanced(g, e => on(e.lin[sb], b.pid)).find(p => p.pid === a.pid), y = A.playerAdvanced(g, e => !on(e.lin[sb], b.pid)).find(p => p.pid === a.pid);
    pairs++;
    if (Math.abs(x.min + y.min - a.min) > 1e-6 || x.box.pts + y.box.pts !== a.box.pts || x.pm + y.pm !== a.pm) bad.push(`${a.name} / ${b.name}`);
  }
}
console.log('parejas comprobadas', pairs, '| descuadres', bad.length, bad.slice(0, 3));
check(pairs > 100 && !bad.length, 'cara a cara: «en pista» + «en el banquillo» no suma el total del partido');
// La pestaña en la web
const { JSDOM } = require('jsdom');
const html = require('fs').readFileSync(__dirname + '/../site/index.html', 'utf8');
const resp = o => Promise.resolve({ ok: true, status: 200, json: async () => o });
const dom = new JSDOM(html, { url: 'https://erikbadibb.github.io/laboratorio-acb/#bcl-136295', runScripts: 'dangerously', pretendToBeVisual: true,
  beforeParse(w) {
    w.localStorage.setItem('lab-acb:fav-bcl', JSON.stringify({ id: 284920, abbr: 'SBB', name: 'Surne Bilbao' }));
    w.fetch = u => { u = String(u); if (u.includes('/api/bcl')) { const { box, ...rest } = fx; return resp(Object.assign({}, rest, { finished: true })); } if (u.includes('getgdap')) return resp([]); return Promise.reject(new TypeError('Failed to fetch')); };
    Object.defineProperty(w.HTMLElement.prototype, 'clientWidth', { get() { return 800; } });
  } });
const w = dom.window, d = w.document, errs = []; w.addEventListener('error', e => errs.push(e.message));
setTimeout(async () => {
  d.querySelector('[data-tab="cara"]').click(); await new Promise(r => setTimeout(r, 40));
  const h = d.querySelector('#view section:nth-of-type(2) h2').textContent, rows = d.querySelectorAll('#view table tbody tr').length;
  console.log('web: jugador por defecto', h.trim(), '|', rows, 'rivales |', [...d.querySelectorAll('#view .ins li')].map(l => l.textContent).join(' / '));
  check(/IGO/.test(h) && rows >= 8, 'cara a cara: por defecto debe salir un jugador del rival de «mi equipo» con una fila por rival');
  const sel = d.querySelector('#sel-cara'), sbbOpt = [...sel.options].find(o => /^SBB/.test(o.textContent));
  sel.value = sbbOpt.value; sel.dispatchEvent(new w.Event('change', { bubbles: true })); await new Promise(r => setTimeout(r, 40));
  d.querySelector('[data-filt="h2"]').click(); await new Promise(r => setTimeout(r, 40));
  const h2 = d.querySelector('#view section:nth-of-type(2) h2').textContent;
  console.log('web: cambio de jugador y tramo ->', h2.trim(), '|', d.querySelector('[data-filt="h2"]').getAttribute('aria-pressed'));
  check(/SBB/.test(h2) && !errs.length, 'cara a cara: cambiar de jugador o de tramo ' + errs.join(' '));
  done('cara a cara');
}, 800);
