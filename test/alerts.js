// Avisos en directo: al abrir el partido no salta nada; con jugadas nuevas salen los avisos elegidos
const { JSDOM } = require('jsdom');
const { check, done } = require('./check');
const fs = require('fs');
const html = fs.readFileSync(__dirname + '/../site/index.html', 'utf8');
const fx = require('./bcl136295.json');
let n = 120;
const resp = o => Promise.resolve({ ok: true, status: 200, json: async () => o });
const dom = new JSDOM(html, { url: 'https://erikbadibb.github.io/laboratorio-acb/#bcl-136295', runScripts: 'dangerously', pretendToBeVisual: true,
  beforeParse(w) {
    w.localStorage.setItem('lab-acb:fav-bcl', JSON.stringify({ id: 284920, abbr: 'SBB', name: 'Surne Bilbao' }));
    w.localStorage.setItem('lab-acb:every', '1');
    w.fetch = u => { u = String(u);
      if (u.includes('/api/bcl')) { const rows = fx.rows.slice(0, n), l = rows[rows.length - 1]; return resp({ game: Object.assign({}, fx.game, { isLive: true, sa: l[3], sb: l[4], period: l[1], chrono: l[2] }), colors: fx.colors, players: fx.players, rows, finished: false }); }
      if (u.includes('getgdap')) return resp([]);
      return Promise.reject(new TypeError('Failed to fetch')); };
    Object.defineProperty(w.HTMLElement.prototype, 'clientWidth', { get() { return 800; } });
  } });
const w = dom.window, d = w.document, errs = []; w.addEventListener('error', e => errs.push(e.message));
const wait = ms => new Promise(r => setTimeout(r, ms));
const toasts = () => [...d.querySelectorAll('#toasts .toast')].map(t => t.textContent.replace('✕', '').trim());
(async () => {
  await wait(700);
  const btn = () => d.querySelector('[data-alerts]').textContent;
  console.log('al abrir:', toasts().length, 'avisos flotantes |', btn());
  check(toasts().length === 0, 'avisos: no deben saltar los de antes de abrir el partido');
  n = 330; await wait(1400);
  const t1 = toasts(); console.log('tras jugadas nuevas:\n - ' + t1.join('\n - '));
  check(t1.length > 0, 'avisos: con jugadas nuevas debe saltar alguno');
  // Panel: desactivar faltas en este partido y comprobar que se guarda solo para él
  d.querySelector('[data-alerts]').click(); await wait(30);
  const cb = d.querySelector('[data-aon="faltas"]'); cb.checked = false; cb.dispatchEvent(new w.Event('change', { bubbles: true })); await wait(30);
  const per = JSON.parse(w.localStorage.getItem('lab-acb:alerts-bcl-136295'));
  console.log('panel: filas', d.querySelectorAll('.al-row').length, '| historial', d.querySelectorAll('.al-list li').length, '| faltas desactivadas en este partido:', per.on.faltas === false, '| global sin tocar:', w.localStorage.getItem('lab-acb:alerts') === null);
  check(per.on.faltas === false && w.localStorage.getItem('lab-acb:alerts') === null, 'avisos: la configuración debe guardarse por partido');
  const hist = [...d.querySelectorAll('.al-list li')].map(l => l.textContent);
  check(!hist.some(h => /faltas$/.test(h) || /llega a \d faltas$/.test(h)), 'avisos: el historial no debe incluir faltas desactivadas');
  // Umbral de parcial más alto
  const np = d.querySelector('[data-an="parcial"]'); np.value = '30'; np.dispatchEvent(new w.Event('change', { bubbles: true })); await wait(30);
  check(!/Parcial/.test(d.querySelector('.al-list') ? d.querySelector('.al-list').textContent : ''), 'avisos: el umbral de parcial no se aplica');
  d.querySelector('[data-adefault]').click(); await wait(10);
  check(JSON.parse(w.localStorage.getItem('lab-acb:alerts')).n.parcial === 30, 'avisos: «usar en todos los partidos»');
  console.log('errores', errs);
  check(!errs.length, 'avisos: errores de JavaScript');
  done('avisos en directo');
})();
