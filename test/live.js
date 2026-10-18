const { JSDOM } = require('jsdom');
const fs = require('fs');
const html = fs.readFileSync(__dirname + '/../site/index.html', 'utf8');
const fx = require('./bcl136295.json');
let n = 250, calls = 0, clock = null;
const resp = o => Promise.resolve({ ok: true, status: 200, json: async () => o });
const dom = new JSDOM(html, { url: 'https://erikbadibb.github.io/laboratorio-acb/#bcl-136295', runScripts: 'dangerously', pretendToBeVisual: true,
  beforeParse(w) {
    w.fetch = u => { u = String(u);
      if (u.includes('/api/bcl')) { calls++; const rows = fx.rows.slice(0, n); const l = rows[rows.length - 1]; return resp({ game: Object.assign({}, fx.game, { isLive: true, sa: l[3], sb: l[4], period: l[1], chrono: clock || l[2] }), colors: fx.colors, players: fx.players, rows, finished: false }); }
      if (u.includes('getgdapgamestatisticsbygameid')) return resp([]);
      return Promise.reject(new TypeError('Failed to fetch')); };
    Object.defineProperty(w.HTMLElement.prototype, 'clientWidth', { get() { return 800; } });
  } });
const w = dom.window; const d = w.document; const errs = []; w.addEventListener('error', e => errs.push(e.message));
const wait = ms => new Promise(r => setTimeout(r, ms));
let renders = 0; const obs = new w.MutationObserver(m => { if (m.some(x => x.target.id === 'view')) renders++; });
(async () => {
  await wait(600);
  obs.observe(d.querySelector('#view'), { childList: true });
  console.log('board', d.querySelector('.score').textContent.replace(/\s+/g, ' '), '| live-wrap hidden:', d.querySelector('#live-wrap').hidden, '| every', d.querySelector('#sel-every').value);
  const c0 = calls; await wait(3200); console.log('calls in ~3s (sin cambios):', calls - c0, 'renders:', renders);
  clock = '1:23'; await wait(1300); console.log('solo cambia el reloj -> renders:', renders, '| estado', d.querySelector('#sb-st').textContent); clock = null;
  n = 300; renders = 0; await wait(1300); console.log('tras nuevas jugadas -> renders:', renders, '| marcador', d.querySelector('.score .big').textContent);
  n = fx.rows.length; await wait(1300);
  console.log('final -> live-wrap hidden:', d.querySelector('#live-wrap').hidden, '| st', d.querySelector('.score .st').textContent);
  const c1 = calls; await wait(2200); console.log('calls tras final (debe ser 0):', calls - c1, 'errs', errs);
  process.exit(0);
})();
