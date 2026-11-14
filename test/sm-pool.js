// Supermanager: un jugador que solo jugó una jornada antigua (fuera de las 4 últimas) debe poder elegirse
// en esa jornada (al verla se descargan todos sus partidos) y con «Buscar en toda la temporada»
const { JSDOM } = require('jsdom');
const { check, done } = require('./check');
const fs = require('fs');
const { acbRaw, fx } = require('./acbraw');
const html = fs.readFileSync(__dirname + '/../site/index.html', 'utf8');
const OLD = 999001, oldPid = Object.keys(fx.names)[0]; // en la J1 un jugador «Tadas Sedekerskis» del Baskonia
const T = (id, ab) => ({ id, abbreviatedName: ab, shortName: ab, fullName: ab });
const rounds = [1, 2, 3, 4, 5, 6].map(n => ({ id: 200 + n, roundNumber: n }));
const raw1 = () => { const r = acbRaw(0); r.awayTeam = { id: 4480, fullName: 'Kosner Baskonia', shortName: 'Baskonia', abbreviatedName: 'BKN' }; r.plays.forEach(p => { if (String(p.playerLicenseId) === oldPid) { p.playerLicenseId = OLD; p.playerName = 'Tadas Sedekerskis'; } }); return r; };
const resp = o => Promise.resolve({ ok: true, status: 200, json: async () => o });
const dom = new JSDOM(html, { url: 'https://erikbadibb.github.io/laboratorio-acb/', runScripts: 'dangerously', pretendToBeVisual: true,
  beforeParse(w) {
    w.localStorage.setItem('lab-acb:area', JSON.stringify('sm'));
    w.fetch = u => { u = String(u);
      if (u.includes('competition-data')) return resp({ currentCompetitionId: 1, currentEditionId: 1, currentRoundId: 206, competitions: [{ id: 1, editions: [{ id: 1, rounds }] }] });
      if (u.includes('matchlist')) { const n = +u.match(/roundId=(\d+)/)[1] - 200; return resp({ matches: [{ id: 300 + n, homeTeam: T(4475, fx.h), awayTeam: n === 1 ? T(4480, 'BKN') : T(4471, fx.a), homeScore: 107, awayScore: 92, startDateTime: '2026-10-0' + n + 'T18:00:00', matchStatus: 'FINALIZED' }] }); }
      if (u.includes('play-by-play')) { const id = +u.match(/matchId=(\d+)/)[1]; return resp(id === 301 ? raw1() : acbRaw(0)); }
      if (u.includes('match-header')) return resp({ matchStatus: 'FINALIZED', currentQuarter: 4, timeLeft: '0:00' });
      return Promise.reject(new TypeError('Failed to fetch')); };
    Object.defineProperty(w.HTMLElement.prototype, 'clientWidth', { get() { return 800; } });
  } });
const w = dom.window, d = w.document, errs = []; w.addEventListener('error', e => errs.push(e.message)); w.console.error = (...a) => errs.push(a.join(' '));
const wait = ms => new Promise(r => setTimeout(r, ms));
const until = async (f, ms = 6000) => { const t0 = Date.now(); while (!f() && Date.now() - t0 < ms) await wait(50); return f(); };
const pool = () => JSON.parse(w.localStorage.getItem('lab-acb:sm-pool') || '{}');
const search = txt => { const q = d.querySelector('#in-smq'); q.value = txt; q.dispatchEvent(new w.Event('input', { bubbles: true })); return [...d.querySelectorAll('#sm-plist .sm-pl')].map(b => b.textContent.replace(/\s+/g, ' ').trim()); };
(async () => {
  await until(() => Object.keys(pool()).length >= 20 && d.querySelector('#view .sm-head, #view .empty'));
  console.log('lista inicial (últimas 4 jornadas):', Object.keys(pool()).length, 'jugadores · ¿Sedekerskis?', !!pool()[OLD]);
  check(!pool()[OLD], 'prueba mal montada: el jugador de la J1 no debería estar en la lista inicial');
  // a) Ir a la jornada 1 en la Plantilla
  d.querySelector('[data-smview="plantilla"]').click(); await wait(30);
  for (let i = 0; i < 5; i++) { d.querySelector('#view [data-smround="-1"]').click(); await wait(30); }
  await until(() => /jornada 1/.test(d.querySelector('#view h3').textContent) && pool()[OLD]);
  const res = search('sedek');
  console.log('en la J1, buscando «sedek»:', res.join(' / '));
  check(res.length === 1 && /Tadas Sedekerskis.*BKN/.test(res[0]), 'SM: en la J1 debe aparecer el jugador que la jugó');
  const all = search(''), absent = fx.names[oldPid].split('|')[0];
  console.log('último de la lista en la J1 (no la jugó):', all[all.length - 1]);
  check(all[all.length - 1].includes(absent), 'SM: en la J1, los que no la jugaron deben ir al final');
  d.querySelector('#sm-plist [data-smadd]').click(); await wait(40);
  // b) «Buscar en toda la temporada» desde cero también lo encuentra
  w.localStorage.removeItem('lab-acb:sm-pool'); w.localStorage.removeItem('lab-acb:sm-games');
  d.querySelector('[data-smload]').click();
  await until(() => pool()[OLD] && !d.querySelector('[data-smload][disabled]'), 8000);
  console.log('tras «Buscar en toda la temporada»:', Object.keys(pool()).length, 'jugadores · ¿Sedekerskis?', !!pool()[OLD]);
  check(!!pool()[OLD], 'SM: «Buscar en toda la temporada» debe encontrar a los jugadores de jornadas antiguas');
  check(!errs.length, 'SM: errores de JavaScript ' + errs.join(' | '));
  done('Supermanager: jugadores de jornadas antiguas');
})();
