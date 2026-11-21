// Comparar la temporada de dos jugadores (Scouting › Comparar jugadores). 6 equipos, todos contra todos (BCL simulada).
// Por defecto se comparan dos jugadores del equipo cargado (sin descargas); al elegir otro equipo se descargan sus partidos
// una sola vez. Los totales coinciden con los de la pestaña Jugadores.
const { JSDOM } = require('jsdom');
const { check, done } = require('./check');
const fs = require('fs');
const html = fs.readFileSync(__dirname + '/../site/index.html', 'utf8');
const fx = require('./bcl136295.json');
const T = [1, 2, 3, 4, 5, 6].map(i => ({ teamId: 900 + i, code: 'T' + i, shortName: 'Equipo ' + i }));
const pairs = []; for (let i = 0; i < 6; i++) for (let j = i + 1; j < 6; j++) pairs.push([i, j]);
const games = pairs.map(([i, j], k) => ({ gameId: 500000 + k, teamA: T[i], teamB: T[j], teamAScore: 0, teamBScore: 0, liveGameStatus: 999, isLive: false, gameDateTimeUTC: '2026-10-' + String(1 + 2 * k).padStart(2, '0') + 'T18:00:00', round: { roundName: 'R' } }));
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
const w = dom.window, d = w.document, errs = []; w.addEventListener('error', e => errs.push(e.message)); w.console.error = (...a) => errs.push(a.join(' '));
const wait = ms => new Promise(r => setTimeout(r, ms));
const until = async (f, ms = 8000) => { const t0 = Date.now(); while (!f() && Date.now() - t0 < ms) await wait(50); return f(); };
const change = (el, v) => { el.value = String(v); el.dispatchEvent(new w.Event('change', { bubbles: true })); };
// Valor de una fila de comparación (bloque con título h2) para el jugador i
const cmpVal = (h2, label, i) => { const sec = [...d.querySelectorAll('#view section.panel')].find(s => (s.querySelector('h2') || {}).textContent && s.querySelector('h2').textContent.startsWith(h2));
  const ks = [...sec.querySelectorAll('.cmp .k')], k = ks.find(x => x.textContent === label); if (!k) return null;
  return (i ? k.nextElementSibling : k.previousElementSibling).querySelector('b').textContent; };
(async () => {
  await wait(700);
  d.querySelector('#m-scout').click(); await wait(50);
  change(d.querySelector('#sel-team'), 901); d.querySelector('#b-scout').click();
  await until(() => /analizado/.test(d.querySelector('#st-scout').textContent));
  const c0 = calls;
  d.querySelector('[data-stab="comparar"]').click(); await wait(40);
  const p0 = d.querySelector('#sel-cmpp0'), p1 = d.querySelector('#sel-cmpp1');
  console.log('por defecto:', p0.selectedOptions[0].text, '|', p1.selectedOptions[0].text, '| descargas', calls - c0);
  check(p0 && p1 && p0.value !== p1.value, 'comparar: por defecto deben salir dos jugadores distintos');
  check(calls === c0, 'comparar: con el equipo ya cargado no debe descargar nada');
  const claves = [...d.querySelectorAll('#view .ins li')].map(l => l.textContent);
  console.log('claves:\n - ' + claves.join('\n - '));
  check(claves.length >= 3, 'comparar: faltan las claves de la comparación');
  check(d.querySelectorAll('#view .cmp').length === 4, 'comparar: faltan bloques de comparación');
  // Totales: los puntos coinciden con los de la pestaña Jugadores
  d.querySelector('[data-cmpper="tot"]').click(); await wait(30);
  const name0 = p0.selectedOptions[0].text.split(' · ')[0], pts0 = cmpVal('Producción', 'Puntos', 0);
  d.querySelector('[data-stab="jugadores"]').click(); await wait(30);
  d.querySelector('[data-pergame="0"]').click(); await wait(30);
  const ths = [...d.querySelectorAll('#view thead th')].map(t => t.textContent.replace(/ [↑↓]$/, '')), ip = ths.indexOf('Pts');
  const row = [...d.querySelectorAll('#view tbody tr')].find(tr => tr.cells[0].textContent.includes(name0));
  console.log('totales', name0, 'comparar', pts0, '| jugadores', row && row.cells[ip].textContent);
  check(row && row.cells[ip].textContent === pts0, 'comparar: los puntos totales no coinciden con la pestaña Jugadores');
  // Jugador 2 de otro equipo: se descargan sus partidos (una vez)
  d.querySelector('[data-stab="comparar"]').click(); await wait(30);
  const c1 = calls; change(d.querySelector('#sel-cmpt1'), 902);
  await until(() => d.querySelector('#sel-cmpp1') && !d.querySelector('[data-cmpst]'));
  const got = calls - c1;
  console.log('otro equipo: descargas', got, '| jugador 2', d.querySelector('#sel-cmpp1').selectedOptions[0].text, '| equipo', d.querySelector('#sel-cmpt1').selectedOptions[0].text);
  check(got === 5, 'comparar: debe descargar los 5 partidos del otro equipo');
  check([...d.querySelectorAll('#view .cmp .tm')].some(x => x.textContent === 'T2'), 'comparar: el jugador 2 no es del otro equipo');
  change(d.querySelector('#sel-cmpp1'), d.querySelector('#sel-cmpp1').options[1].value); await wait(30);
  d.querySelector('[data-cmpper="p40"]').click(); await wait(30);
  d.querySelector('[data-cmpstat="pir"]').click(); await wait(60);
  const ch = d.querySelector('#view .chart svg');
  console.log('gráfica: círculos', ch && ch.querySelectorAll('circle[data-tip]').length, '| cuadrados', ch && ch.querySelectorAll('rect[data-tip]').length, '| mapas de tiro', [...d.querySelectorAll('#view h2')].filter(h => /mapa de tiro/.test(h.textContent)).length, '| tablas', d.querySelectorAll('#view table').length);
  check(ch && ch.querySelectorAll('circle[data-tip]').length >= 1 && ch.querySelectorAll('rect[data-tip]').length >= 1, 'comparar: la gráfica partido a partido no dibuja a los dos');
  check(calls - c1 === 5, 'comparar: los partidos del otro equipo no deben volver a descargarse');
  check(!errs.length, 'comparar: errores de JavaScript ' + errs.join(' '));
  done('comparar la temporada de dos jugadores');
})();
