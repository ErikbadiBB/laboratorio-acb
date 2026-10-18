// Comparación con la liga: 6 equipos, todos contra todos. La primera vez se analizan todos los partidos;
// la segunda, ninguno (quedan guardados). El informe del rival muestra su posición.
const { JSDOM } = require('jsdom');
const { check, done } = require('./check');
const fs = require('fs');
const html = fs.readFileSync(__dirname + '/../site/index.html', 'utf8');
const fx = require('./bcl136295.json');
// Los 5 partidos del equipo 1 ya están en el Scouting: la liga solo descarga los otros 10
const T = [1, 2, 3, 4, 5, 6].map(i => ({ teamId: 900 + i, code: 'T' + i, shortName: 'Equipo ' + i }));
const pairs = []; for (let i = 0; i < 6; i++) for (let j = i + 1; j < 6; j++) pairs.push([i, j]);
const games = pairs.map(([i, j], k) => ({ gameId: 500000 + k, teamA: T[i], teamB: T[j], teamAScore: 0, teamBScore: 0, liveGameStatus: 999, isLive: false, gameDateTimeUTC: '2026-10-0' + (1 + k % 9) + 'T18:00:00', round: { roundName: 'R' } }));
let calls = 0;
const resp = o => Promise.resolve({ ok: true, status: 200, json: async () => o });
const dom = new JSDOM(html, { url: 'https://erikbadibb.github.io/laboratorio-acb/#bcl-500000', runScripts: 'dangerously', pretendToBeVisual: true,
  beforeParse(w) {
    w.fetch = u => { u = String(u);
      if (u.includes('/api/bcl?id=')) { calls++; const k = +u.match(/id=(\d+)/)[1] - 500000, [i, j] = pairs[k], { box, ...rest } = fx;
        return resp(Object.assign({}, rest, { rows: fx.rows.slice(0, 380 + 15 * k), finished: true, game: Object.assign({}, fx.game, { A: Object.assign({}, fx.game.A, { teamId: T[i].teamId, code: T[i].code, shortName: T[i].shortName }), B: Object.assign({}, fx.game.B, { teamId: T[j].teamId, code: T[j].code, shortName: T[j].shortName }) }) })); }
      if (u.includes('getgdapgamesbycompetitionid')) return resp(games);
      if (u.includes('getgdap')) return resp([]);
      return Promise.reject(new TypeError('Failed to fetch')); };
    Object.defineProperty(w.HTMLElement.prototype, 'clientWidth', { get() { return 800; } });
  } });
const w = dom.window, d = w.document, errs = []; w.addEventListener('error', e => errs.push(e.message));
const wait = ms => new Promise(r => setTimeout(r, ms));
const until = async (f, ms = 8000) => { const t0 = Date.now(); while (!f() && Date.now() - t0 < ms) await wait(50); return f(); };
(async () => {
  await wait(700);
  d.querySelector('#m-scout').click(); await wait(50);
  const sel = d.querySelector('#sel-team'); sel.value = '901'; d.querySelector('#b-scout').click();
  await until(() => /analizado/.test(d.querySelector('#st-scout').textContent));
  console.log('scouting:', d.querySelector('#st-scout').textContent);
  d.querySelector('[data-stab="liga"]').click(); await wait(30);
  const c0 = calls; d.querySelector('[data-league]').click();
  await until(() => d.querySelectorAll('#view [data-sort^="slg|"]').length > 0);
  const rows = d.querySelectorAll('#view table tbody tr').length - 0;
  const kv = [...d.querySelectorAll('#view .lg-kv > div')].map(x => x.textContent.replace(/\s+/g, ' ').trim());
  console.log('primera vez: partidos descargados', calls - c0, '| filas', d.querySelectorAll('#view table')[0] && d.querySelectorAll('#view table')[0].querySelectorAll('tbody tr').length, '\n - ' + kv.slice(0, 4).join('\n - '));
  check(calls - c0 === 10, 'liga: deben analizarse los 10 partidos que no estaban ya en el Scouting');
  check(d.querySelectorAll('#view table')[0].querySelectorAll('tbody tr').length === 6 && kv.length === 12 && /de 6/.test(kv[0]), 'liga: clasificación o posiciones incompletas');
  const c1 = calls; d.querySelector('[data-league]').click(); await wait(400);
  console.log('segunda vez: partidos descargados', calls - c1);
  check(calls - c1 === 0, 'liga: los partidos ya analizados no deben volver a descargarse');
  d.querySelector('[data-stab="informe"]').click(); await wait(30);
  const inf = [...d.querySelectorAll('#view h2')].map(h => h.textContent);
  check(inf.includes('Frente a la liga'), 'liga: el informe del rival no muestra su posición en la liga');
  check(!errs.length, 'liga: errores de JavaScript ' + errs.join(' '));
  done('comparación con la liga');
})();
