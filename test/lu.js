// Liga U en directo con datos sintéticos: primera descarga completa, después solo jugadas nuevas,
// lista completa cada 30 s y fin del partido
const { JSDOM } = require('jsdom');
const fs = require('fs');
const html = fs.readFileSync(__dirname + '/../site/index.html', 'utf8');
const P = { 1: [11, 12, 13, 14, 15], 2: [21, 22, 23, 24, 25] };
const all = [{ num: 1, action: 'period', quarter: 1, time: '10:00', text: 'Comienzo del periodo' }];
let num = 2;
for (const t of [1, 2]) for (const id of P[t]) all.push({ num: num++, action: 'subst', quarter: 1, time: '10:00', text: 'Entra a pista', idPlayer: String(id), idLicense: String(id * 100), idTeam: t, team: t, player_name: 'Jugador ' + id });
let sa = 0, sb = 0;
for (let i = 0; i < 60; i++) {
  const t = i % 2 ? 2 : 1, made = i % 3 !== 0;
  if (made) { if (t === 1) sa += 2; else sb += 2; }
  const sec = 590 - i * 9;
  all.push({ num: num++, action: 'shoot', quarter: 1, time: Math.floor(sec / 60) + ':' + String(sec % 60).padStart(2, '0'), text: 'Tiro de 2', idPlayer: String(P[t][i % 5]), idTeam: t, team: t,
    logParam1: null, logParam2: null, logParam3: null, logParam4: made ? '1' : '0', logParam5: null, logParam6: '2', scoreA: String(sa), scoreB: String(sb) });
  if (!made) all.push({ num: num++, action: 'rebound', quarter: 1, time: all[all.length - 1].time, text: 'Rebote', idPlayer: String(P[3 - t][0]), idTeam: 3 - t, team: 3 - t });
}
let n = 30, status = 1, offset = 0;
const urls = [];
const resp = o => Promise.resolve({ ok: true, status: 200, json: async () => o });
const md = () => ({ match_id: 2538967, team1_id: 1, team2_id: 2, team1_short_name: 'EQUIPO A', team2_short_name: 'EQUIPO B', status_code: status, game_time: status === 3 ? 'Final' : '5:00', quarter: 1, local_points: 0, visitor_points: 0, jornada: 1, fecha: 1790000000 });
const dom = new JSDOM(html, { url: 'https://erikbadibb.github.io/laboratorio-acb/#lu-2538967', runScripts: 'dangerously', pretendToBeVisual: true,
  beforeParse(w) {
    const now = w.Date.now; w.Date.now = () => now() + offset;
    w.fetch = u => { u = decodeURIComponent(String(u));
      if (u.includes('pbp_player_name_ligau_view')) { urls.push(u); const m = u.match(/num=gte\.(\d+)/); const rows = all.slice(0, n); return resp(m ? rows.filter(r => r.num >= +m[1]) : rows); }
      if (u.includes('teams_info_ligau')) return resp([{ id_equipo_temporada: 1, nombre_acor: 'EQUIPO A', nombre_abr: 'AAA' }, { id_equipo_temporada: 2, nombre_acor: 'EQUIPO B', nombre_abr: 'BBB' }]);
      if (u.includes('all_matches_data_lf_endesa')) return resp([md()]);
      if (u.includes('all_players_boxscores') || u.includes('shots_with')) return resp([]);
      return Promise.reject(new TypeError('Failed to fetch')); };
    Object.defineProperty(w.HTMLElement.prototype, 'clientWidth', { get() { return 800; } });
  } });
const w = dom.window, d = w.document, errs = [];
w.addEventListener('error', e => errs.push(e.message));
const wait = ms => new Promise(r => setTimeout(r, ms));
const score = () => d.querySelector('.score .big').textContent;
const inc = () => urls.filter(u => /num=gte/.test(u)).length, full = () => urls.length - inc();
(async () => {
  await wait(600);
  console.log('inicio', score(), '| completas', full(), 'parciales', inc());
  n = 60; await wait(2300);
  const ref = all.slice(0, 60).reverse().find(r => r.scoreA);
  console.log('tras jugadas nuevas', score(), '(esperado ' + ref.scoreA + '–' + ref.scoreB + ') | completas', full(), 'parciales', inc());
  offset = 31000; const f0 = full(); await wait(1300);
  console.log('a los 30 s vuelve a pedir la lista completa:', full() > f0);
  // El salto de reloj deja 31 s sin novedades: el directo pasa a comprobar cada 5 s
  console.log('ritmo sin novedades:', (d.querySelector('#st-match').textContent.match(/cada \d+ s/) || ['(1 s)'])[0]);
  n = all.length; status = 3; await wait(5600);
  const c = urls.length; await wait(1300);
  console.log('final:', d.querySelector('#sb-st').textContent, score(), '(esperado ' + sa + '–' + sb + ')', '| consultas tras el final', urls.length - c, '| errores', errs);
  process.exit(0);
})();
