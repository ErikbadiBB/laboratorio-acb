// Rendimiento de la interfaz: tiempo de cada pestaña, ordenar/filtrar, directo y scouting (npm run test:perf)
// Perfil de rendimiento: tiempo de cada pestaña, directo y scouting
const ROOT = __dirname + '/..';
const launch = require('./browser');
const fx = require('./bcl136295.json');
(async () => {
  const b = await launch(); const p = await b.newPage({ viewport: { width: 1200, height: 900 } });
  const boxObjs = fx.box.map(r => ({ player: { playerId: r[0] }, team: { organisationId: r[1] }, isStarter: !!r[2], playDurationInSeconds: r[3], points: r[4], twoPointsMade: r[5], twoPointsAttempted: r[6], threePointsMade: r[7], threePointsAttempted: r[8], freeThrowsMade: r[9], freeThrowsAttempted: r[10], offensiveRebounds: r[11], defensiveRebounds: r[12], assists: r[13], steals: r[14], turnovers: r[15], blockedShots: r[16], personalFouls: r[17], plusMinus: r[18] }));
  const games = Array.from({ length: 12 }, (_, i) => ({ gameId: 136295 + i, gameDateTimeUTC: '2026-10-0' + (1 + (i % 9)) + 'T18:00:00', teamA: fx.game.A, teamB: fx.game.B, teamAScore: 79, teamBScore: 92, liveGameStatus: 999, isLive: false, round: { roundName: 'R' + i } }));
  await p.route('**/*', r => { const u = r.request().url(); const H = { 'access-control-allow-origin': '*' };
    if (u.includes('/api/bcl')) { const { box, ...rest } = fx; return r.fulfill({ json: Object.assign(rest, { finished: true }), headers: H }); }
    if (u.includes('getgdapgamestatisticsbygameid')) return r.fulfill({ json: boxObjs, headers: H });
    if (u.includes('getgdapgamesbycompetitionid')) return r.fulfill({ json: games, headers: H });
    if (u.startsWith('file:')) return r.continue(); return r.abort(); });
  p.on('pageerror', e => console.log('PAGEERR', e.message));
  await p.goto('file://' + ROOT + '/site/index.html#bcl-136295'); await p.waitForTimeout(1500);
  const timeClick = sel => p.evaluate(sel => new Promise(res => { const t0 = performance.now(); document.querySelector(sel).click(); const t1 = performance.now(); requestAnimationFrame(() => setTimeout(() => res([t1 - t0, performance.now() - t0]), 0)); }), sel);
  const tabs = ['entrenador', 'resumen', 'factores', 'jugadores', 'quintetos', 'rotaciones', 'dinamica', 'posesiones', 'tiro', 'clutch', 'jugadas'];
  const out = {};
  for (let rep = 0; rep < 3; rep++) for (const t of tabs) { const [s, f] = await timeClick(`[data-tab="${t}"]`); (out[t] = out[t] || []).push(f); }
  console.log('Pestañas (ms, mediana de 3, click→pintado):');
  let tot = 0; for (const t of tabs) { const v = out[t].sort((a, b) => a - b)[1]; tot += v; console.log('  ' + t.padEnd(11) + v.toFixed(1)); }
  console.log('  TOTAL'.padEnd(13) + tot.toFixed(1));
  await p.click('[data-tab="jugadores"]'); await p.waitForTimeout(100);
  const [s1, f1] = await timeClick('th[data-sort]'); console.log('Ordenar columna:', f1.toFixed(1));
  const [s2, f2] = await timeClick('[data-filt="q2"]'); console.log('Filtro 2C:', f2.toFixed(1));
  await p.click('[data-tab="entrenador"]');
  // (el directo se comprueba en test/live.js)
  // Scouting
  await p.goto('file://' + ROOT + '/site/index.html#bcl-136295'); await p.waitForTimeout(1200);
  await p.click('#m-scout'); await p.waitForTimeout(300);
  const t0 = Date.now(); await p.click('#b-scout');
  await p.waitForFunction(() => /analizado/.test(document.querySelector('#st-scout').textContent), null, { timeout: 30000 });
  console.log('Scouting 12 partidos (descarga+análisis):', Date.now() - t0, 'ms');
  const sc = {}; for (const t of ['resumen', 'jugadores', 'quintetos', 'posesiones', 'cierres', 'partidos']) { const r = []; for (let i = 0; i < 3; i++) r.push((await timeClick(`[data-stab="${t}"]`))[1]); sc[t] = r.sort((a, b) => a - b)[1]; }
  console.log('Scouting pestañas:', Object.entries(sc).map(([k, v]) => k + ' ' + v.toFixed(0)).join(' · '));
  await b.close();
})();
