// Supermanager: lista de jugadores de la competición, equipo propio, capitán y jornada en directo
const { JSDOM } = require('jsdom');
const { check, done } = require('./check');
const fs = require('fs');
require('../engine.js');
const A = globalThis.ACB;
const { acbRaw, fx, total } = require('./acbraw');
const html = fs.readFileSync(__dirname + '/../site/index.html', 'utf8');
const pidOf = name => Object.keys(fx.names).find(k => fx.names[k].startsWith(name));
const H = pidOf('Darrun Hilliard'), M = pidOf('Margiris Normantas'), N = pidOf('Nick Ongenda');
const val = (limit, pid) => A.playerAdvanced(A.parseGame(acbRaw(limit), { id: 1 })).find(p => String(p.pid) === String(pid)).pir;
const T = (id, ab) => ({ id, abbreviatedName: ab, shortName: ab, fullName: ab });
let live = { status: 'STARTED', limit: 300 }, calls = { pbp: 0, ml: 0 };
const rounds = [{ id: 101, roundNumber: 1 }, { id: 102, roundNumber: 2 }, { id: 103, roundNumber: 3 }];
const mk = (id, status, sh, sa, when) => ({ id, homeTeam: T(4475, fx.h), awayTeam: T(4471, fx.a), homeScore: sh, awayScore: sa, startDateTime: when, matchStatus: status });
const resp = o => Promise.resolve({ ok: true, status: 200, json: async () => o });
const dom = new JSDOM(html, { url: 'https://erikbadibb.github.io/laboratorio-acb/', runScripts: 'dangerously', pretendToBeVisual: true,
  beforeParse(w) {
    w.fetch = u => { u = String(u);
      if (u.includes('competition-data')) return resp({ currentCompetitionId: 1, currentEditionId: 1, currentRoundId: 103, competitions: [{ id: 1, editions: [{ id: 1, rounds }] }] });
      if (u.includes('matchlist')) { calls.ml++; const r = +u.match(/roundId=(\d+)/)[1];
        if (r === 103) { const l = acbRaw(live.status === 'FINALIZED' ? 0 : live.limit); const last = l.plays[l.plays.length - 1]; return resp({ matches: [mk(105376, live.status, last.scoreHome, last.scoreAway, '2026-11-01T18:00:00')] }); }
        return resp({ matches: [mk(105300 + r, 'FINALIZED', 107, 92, '2026-10-0' + r + 'T18:00:00')] }); }
      if (u.includes('play-by-play')) { calls.pbp++; const id = +u.match(/matchId=(\d+)/)[1]; return resp(id === 105376 ? acbRaw(live.status === 'FINALIZED' ? 0 : live.limit) : acbRaw(0)); }
      if (u.includes('match-header')) return resp({ matchStatus: live.status, currentQuarter: 3, timeLeft: '4:21' });
      return Promise.reject(new TypeError('Failed to fetch')); };
    Object.defineProperty(w.HTMLElement.prototype, 'clientWidth', { get() { return 800; } });
  } });
const w = dom.window, d = w.document, errs = []; w.addEventListener('error', e => errs.push(e.message)); w.console.error = (...a) => errs.push(a.join(' '));
const wait = ms => new Promise(r => setTimeout(r, ms));
const until = async (f, ms = 6000) => { const t0 = Date.now(); while (!f() && Date.now() - t0 < ms) await wait(50); return f(); };
const rowOf = name => [...d.querySelectorAll('#view table tbody tr')].find(r => r.textContent.includes(name));
const cells = tr => [...tr.children].map(c => c.textContent.replace(/\s+/g, ' ').trim());
const setSel = (el, v) => { el.value = v; el.dispatchEvent(new w.Event('change', { bubbles: true })); };
(async () => {
  await wait(500);
  // 1) Abrir el área y cargar la lista de jugadores de las últimas jornadas
  d.querySelector('[data-smopen]').click();
  await until(() => Object.keys(JSON.parse(w.localStorage.getItem('lab-acb:sm-pool') || '{}')).length > 0 && !d.querySelector('[data-smload][disabled]'));
  const pool = JSON.parse(w.localStorage.getItem('lab-acb:sm-pool') || '{}');
  console.log('jugadores en la lista:', Object.keys(pool).length, '| equipos:', [...new Set(Object.values(pool).map(o => o.a))].join(', '), '| partidos descargados:', calls.pbp);
  check(Object.keys(pool).length >= 20 && pool[H] && pool[H].a === fx.h && pool[N] && pool[N].a === fx.a, 'SM: la lista de jugadores no recoge los dos equipos');
  check(d.querySelector('[data-smopen]').getAttribute('aria-pressed') === 'true' && d.querySelector('[data-compet][aria-pressed="true"]') === null, 'SM: el botón SM no queda activo');
  // 2) Montar un equipo: buscar, añadir, capitán
  d.querySelector('[data-smedit]').click(); await wait(30);
  const q = d.querySelector('#in-smq'); q.value = 'hilliard'; q.dispatchEvent(new w.Event('input', { bubbles: true }));
  check(d.querySelectorAll('#sm-plist .sm-pl').length === 1, 'SM: la búsqueda debe dejar un solo jugador');
  d.querySelector('#sm-plist [data-smtoggle]').click(); await wait(30);
  for (const [txt] of [['normantas'], ['ongenda']]) { const q2 = d.querySelector('#in-smq'); q2.value = txt; q2.dispatchEvent(new w.Event('input', { bubbles: true })); d.querySelector('#sm-plist [data-smtoggle]').click(); await wait(30); }
  setSel(d.querySelector('#in-smname'), 'Mi Supermanager'); await wait(20);
  d.querySelector(`[data-smcap="${M}"]`).click(); await wait(20);
  d.querySelector('[data-smedit]').click(); await wait(30);
  const cfg = JSON.parse(w.localStorage.getItem('lab-acb:sm'));
  console.log('equipo:', cfg.teams[0].name, cfg.teams[0].players.length, 'jugadores | capitán', cfg.teams[0].cap, '| multiplicador', cfg.mult);
  check(cfg.teams[0].players.length === 3 && String(cfg.teams[0].cap) === String(M), 'SM: no se guardó el equipo con su capitán');
  // 3) Partido en directo
  await until(() => rowOf('Hilliard') && /En juego|3C/.test(cells(rowOf('Hilliard'))[1]));
  let r = cells(rowOf('Hilliard')), v1 = val(300, H);
  console.log('en directo:', r.join(' | '));
  check(/3C 4:21/.test(r[1]) && String(v1) === r[10] && String(v1) === r[11], 'SM: Hilliard en directo (estado, valoración y puntos SM)');
  const rm = cells(rowOf('Normantas'));
  check(rm[11] === String(val(300, M) * 2), 'SM: el capitán debe sumar el doble: ' + rm[11] + ' vs ' + val(300, M) * 2);
  const onCourt = d.querySelectorAll('#view .sm-on').length;
  console.log('en pista ahora (marcados):', onCourt, '| total SM:', d.querySelector('#view .kv b').textContent);
  check(onCourt >= 1 && onCourt <= 3, 'SM: jugadores en pista ahora');
  // 4) Llegan jugadas nuevas: se actualiza solo
  live.limit = 520; await until(() => cells(rowOf('Hilliard'))[10] !== String(v1), 9000);
  const v2 = val(520, H); r = cells(rowOf('Hilliard'));
  console.log('tras más jugadas: Val', r[10], '(esperado', v2 + ')');
  check(String(v2) === r[10], 'SM: no se actualiza la valoración en directo');
  // 5) Final
  live.status = 'FINALIZED'; await until(() => /Final/.test(cells(rowOf('Hilliard'))[1]), 9000);
  r = cells(rowOf('Hilliard')); const vf = val(0, H);
  console.log('final:', r.join(' | '));
  check(String(vf) === r[10] && /Final/.test(r[1]), 'SM: valoración final');
  const sumSM = [H, M, N].reduce((a, p) => a + val(0, p) * (String(p) === String(M) ? 2 : 1), 0);
  check(Number(d.querySelector('#view .kv b').textContent.replace(/\D/g, '')) === sumSM, 'SM: el total de puntos no suma lo esperado (' + d.querySelector('#view .kv b').textContent + ' vs ' + sumSM + ')');
  // 6) Un segundo equipo y borrarlo; jornada anterior
  d.querySelector('[data-smedit]').click(); await wait(20); d.querySelector('[data-smnew]').click(); await wait(20);
  check(JSON.parse(w.localStorage.getItem('lab-acb:sm')).teams.length === 2, 'SM: no se crea el segundo equipo');
  d.querySelector('[data-smdel]').click(); await wait(20); d.querySelector('[data-smedit]').click(); await wait(20);
  check(JSON.parse(w.localStorage.getItem('lab-acb:sm')).teams.length === 1, 'SM: no se borra el equipo');
  d.querySelector('[data-smround="-1"]').click(); await until(() => /Jornada 2/.test(d.querySelector('#view .pk-round').textContent) && rowOf('Hilliard') && /Final/.test(cells(rowOf('Hilliard'))[1]));
  check(/107–92/.test(cells(rowOf('Hilliard'))[1]), 'SM: la jornada anterior debe traer su propio partido');
  console.log('jornada anterior:', d.querySelector('#view .pk-round').textContent, '|', cells(rowOf('Hilliard'))[1]);
  check(/Jornada 2/.test(d.querySelector('#view .pk-round').textContent), 'SM: no cambia de jornada');
  // 7) Volver a ACB
  d.querySelector('[data-compet="acb"]').click(); await wait(60);
  check(d.querySelector('[data-smopen]').getAttribute('aria-pressed') === 'false' && !d.querySelector('[data-smteam]'), 'SM: al volver a ACB debe salir del área');
  check(!errs.length, 'SM: errores de JavaScript ' + errs.join(' | '));
  w.close();
  done('Supermanager');
})();
