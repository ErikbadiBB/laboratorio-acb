// Supermanager: reglas de las bases (valoración +20 % si gana su equipo y la valoración es positiva; no juega = 0;
// suma de los jugadores), jornada en directo, plantilla que cambia entre jornadas y acumulado por jornadas
const { JSDOM } = require('jsdom');
const { check, done } = require('./check');
const fs = require('fs');
require('../engine.js');
const A = globalThis.ACB;
const { acbRaw, fx } = require('./acbraw');
const html = fs.readFileSync(__dirname + '/../site/index.html', 'utf8');
const pidOf = name => Object.keys(fx.names).find(k => fx.names[k].startsWith(name));
const H = pidOf('Darrun Hilliard'), M = pidOf('Margiris Normantas'), N = pidOf('Nick Ongenda');
const HOME = 4475;
// Puntos SM calculados aparte con el motor: valoración, +20 % si su equipo gana (o va ganando) y la valoración es > 0
function smExp(limit, pid) {
  const g = A.parseGame(acbRaw(limit), { id: 1 }), p = A.playerAdvanced(g).find(x => String(x.pid) === String(pid));
  if (!p || !p.min) return 0;
  const lead = g.final[0] === g.final[1] ? null : (g.final[0] > g.final[1] ? 0 : 1);
  return p.pir > 0 && lead === p.side ? Math.round(p.pir * 12) / 10 : p.pir;
}
const fmt = v => (Math.round(v * 10) / 10).toLocaleString('es-ES', { maximumFractionDigits: 1 });
const T = (id, ab) => ({ id, abbreviatedName: ab, shortName: ab, fullName: ab });
let live = { status: 'STARTED', limit: 300 };
const rounds = [{ id: 101, roundNumber: 1 }, { id: 102, roundNumber: 2 }, { id: 103, roundNumber: 3 }];
const mk = (id, status, l, when) => { const last = l.plays[l.plays.length - 1]; return { id, homeTeam: T(HOME, fx.h), awayTeam: T(4471, fx.a), homeScore: last.scoreHome, awayScore: last.scoreAway, startDateTime: when, matchStatus: status }; };
const resp = o => Promise.resolve({ ok: true, status: 200, json: async () => o });
const dom = new JSDOM(html, { url: 'https://erikbadibb.github.io/laboratorio-acb/', runScripts: 'dangerously', pretendToBeVisual: true,
  beforeParse(w) {
    w.fetch = u => { u = String(u);
      if (u.includes('competition-data')) return resp({ currentCompetitionId: 1, currentEditionId: 1, currentRoundId: 103, competitions: [{ id: 1, editions: [{ id: 1, rounds }] }] });
      if (u.includes('matchlist')) { const r = +u.match(/roundId=(\d+)/)[1];
        if (r === 103) return resp({ matches: [mk(105376, live.status, acbRaw(live.status === 'FINALIZED' ? 0 : live.limit), '2026-11-14T18:00:00')] });
        return resp({ matches: [mk(105300 + r, 'FINALIZED', acbRaw(0), '2026-10-0' + r + 'T18:00:00')] }); }
      if (u.includes('play-by-play')) { const id = +u.match(/matchId=(\d+)/)[1]; return resp(id === 105376 && live.status !== 'FINALIZED' ? acbRaw(live.limit) : acbRaw(0)); }
      if (u.includes('match-header')) return resp({ matchStatus: live.status, currentQuarter: 3, timeLeft: '4:21' });
      return Promise.reject(new TypeError('Failed to fetch')); };
    Object.defineProperty(w.HTMLElement.prototype, 'clientWidth', { get() { return 800; } });
    w.localStorage.setItem('lab-acb:sm-layout', '"tarjetas"'); // aquí se prueban las tarjetas; la vista Pista, en sm-link.js
  } });
const w = dom.window, d = w.document, errs = []; w.addEventListener('error', e => errs.push(e.message)); w.console.error = (...a) => errs.push(a.join(' '));
const wait = ms => new Promise(r => setTimeout(r, ms));
const until = async (f, ms = 6000) => { const t0 = Date.now(); while (!f() && Date.now() - t0 < ms) await wait(50); return f(); };
const card = pid => d.querySelector(`#view .sm-card[data-pid="${pid}"]`);
const cardPts = pid => { const c = card(pid); return c ? c.querySelector('.sm-pts').firstChild.textContent.trim() : null; };
const total = () => d.querySelector('#view .sm-total b').textContent.trim();
const acum = () => d.querySelectorAll('#view .sm-total b')[1].textContent.trim();
const cfg = () => JSON.parse(w.localStorage.getItem('lab-acb:sm'));
const addBySearch = async txt => { const q = d.querySelector('#in-smq'); q.value = txt; q.dispatchEvent(new w.Event('input', { bubbles: true })); d.querySelector('#sm-plist [data-smadd]').click(); await wait(40); };
(async () => {
  await wait(500);
  // 1) Abrir el área: lista de jugadores de las últimas jornadas
  d.querySelector('[data-smopen]').click();
  await until(() => Object.keys(JSON.parse(w.localStorage.getItem('lab-acb:sm-pool') || '{}')).length >= 20 && !/Cargando/.test(d.querySelector('#st-sm') ? d.querySelector('#st-sm').textContent : 'Cargando'));
  const pool = JSON.parse(w.localStorage.getItem('lab-acb:sm-pool'));
  console.log('jugadores:', Object.keys(pool).length, '| partidos guardados:', Object.keys(JSON.parse(w.localStorage.getItem('lab-acb:sm-games') || '{}')).length);
  check(pool[H] && pool[N], 'SM: la lista de jugadores no recoge los dos equipos');
  check(/Elegir jugadores/.test(d.querySelector('#view').textContent), 'SM: con el equipo vacío debe invitar a elegir jugadores');
  // 2) Plantilla: buscar y añadir
  d.querySelector('#view [data-smview="plantilla"]').click(); await wait(40);
  for (const n of ['hilliard', 'normantas', 'ongenda']) await addBySearch(n);
  console.log('plantilla J3:', d.querySelector('#view h3').textContent.trim());
  check(/3\/10/.test(d.querySelector('#view h3').textContent) && cfg().teams[0].hist.some(h => h.from === 3 && h.players.length === 3), 'SM: la plantilla no guarda los 3 jugadores en la jornada 3');
  // 3) Jornada en directo: bonus provisional si su equipo va ganando
  d.querySelector('[data-smview="jornada"]').click();
  await until(() => card(H) && /3C 4:21/.test(card(H).textContent));
  const e300 = [H, M, N].map(p => smExp(300, p));
  console.log('en directo:', [H, M, N].map(p => cardPts(p)).join(' / '), '| esperado', e300.map(fmt).join(' / '), '| total', total());
  check(cardPts(H) === fmt(e300[0]) && cardPts(M) === fmt(e300[1]) && cardPts(N) === fmt(e300[2]), 'SM: puntos en directo');
  check(total() === fmt(e300.reduce((a, b) => a + b, 0)), 'SM: total en directo');
  check(/\+20 %\?/.test(card(H).textContent) && !/\+20/.test(card(N).textContent), 'SM: el bonus provisional debe marcarse solo al equipo que va ganando');
  // 4) Más jugadas
  live.limit = 520; await until(() => cardPts(H) === fmt(smExp(520, H)), 9000);
  check(cardPts(H) === fmt(smExp(520, H)), 'SM: no se actualiza en directo');
  // 5) Final: bonus definitivo
  live.status = 'FINALIZED'; await until(() => /Final/.test(card(H).textContent) && cardPts(H) === fmt(smExp(0, H)), 9000);
  const ef = [H, M, N].map(p => smExp(0, p)), sumF = ef.reduce((a, b) => a + b, 0);
  console.log('final:', [H, M, N].map(p => cardPts(p)).join(' / '), '| esperado', ef.map(fmt).join(' / '), '| total', total());
  check(cardPts(H) === fmt(ef[0]) && cardPts(N) === fmt(ef[2]) && total() === fmt(sumF), 'SM: puntos finales con el +20 % por victoria');
  check(/\+20 %/.test(card(H).textContent) && !/\+20 %\?/.test(card(H).textContent) && !/\+20/.test(card(N).textContent), 'SM: el bonus definitivo solo al equipo ganador');
  // 6) Acumulado con cambios de plantilla: empieza en J2, donde solo estaba Hilliard
  d.querySelector('[data-smview="plantilla"]').click(); await wait(40);
  const st = d.querySelector('#sel-smstart'); st.value = '2'; st.dispatchEvent(new w.Event('change', { bubbles: true })); await wait(40);
  d.querySelector('#view [data-smround="-1"]').click(); await until(() => /jornada 2/.test(d.querySelector('#view h3').textContent));
  check(/0\/10/.test(d.querySelector('#view h3').textContent), 'SM: en la J2 la plantilla debe estar vacía (se creó en la J3)');
  await addBySearch('hilliard');
  d.querySelector('#view [data-smround="1"]').click(); await until(() => /jornada 3/.test(d.querySelector('#view h3').textContent));
  check(/3\/10/.test(d.querySelector('#view h3').textContent), 'SM: el cambio en la J2 no debe tocar la plantilla de la J3');
  d.querySelector('[data-smview="jornada"]').click(); await until(() => card(H));
  const accExp = smExp(0, H) + sumF;
  console.log('acumulado J2+J3:', acum(), '| esperado', fmt(accExp));
  check(acum() === fmt(accExp), 'SM: acumulado desde la jornada de inicio');
  d.querySelector('[data-smview="temporada"]').click(); await until(() => d.querySelector('#view table'));
  const rowsT = [...d.querySelectorAll('#view table')[0].querySelectorAll('tbody tr, tfoot tr')].map(r => [...r.children].map(c => c.textContent.trim()).join(' | '));
  console.log('temporada:', rowsT.join(' / '));
  check(rowsT.some(r => r.startsWith('J2') && r.endsWith(fmt(smExp(0, H)))) && rowsT.some(r => /Acumulado/.test(r) && r.endsWith(fmt(accExp))), 'SM: tabla de temporada');
  // 7) Segundo equipo y borrarlo (dos pasos); volver a ACB
  d.querySelector('[data-smnew]').click(); await wait(30);
  check(cfg().teams.length === 2 && d.querySelector('#in-smname'), 'SM: nuevo equipo');
  d.querySelector('[data-smdel]').click(); await wait(20);
  check(cfg().teams.length === 2, 'SM: borrar debe pedir confirmación');
  d.querySelector('[data-smdel]').click(); await wait(20);
  check(cfg().teams.length === 1, 'SM: no se borra el equipo');
  d.querySelector('[data-compet="acb"]').click(); await wait(60);
  check(d.querySelector('[data-smopen]').getAttribute('aria-pressed') === 'false' && !d.querySelector('[data-smteam]'), 'SM: al volver a ACB debe salir del área');
  check(!errs.length, 'SM: errores de JavaScript ' + errs.join(' | '));
  w.close();
  done('Supermanager');
})();
