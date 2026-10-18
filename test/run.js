require('../engine.js');
const fx = require('./m105375.json');
const A = globalThis.ACB;
const keys = ['points','twoPointersMade','twoPointersAttempted','threePointersMade','threePointersAttempted','freeThrowsMade','freeThrowsAttempted','offRebounds','defRebounds','assists','steals','turnovers','blocks','personalFouls','foulsDrawn'];
// Reconstruir respuesta cruda; playerStats final en el último evento de cada jugador
const lastIdx = {};
fx.rows.forEach((r, i) => { if (r[9]) lastIdx[r[9]] = i; });
const plays = fx.rows.map((r, i) => {
  const [order, playType, playTag, quarter, minute, second, local, sh, sa, pid] = r;
  const nm = pid ? fx.names[pid].split('|') : [null, null];
  const p = { order, playType, playTag, quarter, minute, second, local: !!local, scoreHome: sh, scoreAway: sa,
    playerLicenseId: pid || null, playerName: nm[0], playerNumber: playType === 599 ? null : (nm[1] || null), playerImage: null, playerStats: null };
  if (pid && lastIdx[pid] === i) p.playerStats = Object.fromEntries(keys.map((k, j) => [k, fx.val[pid][j]]));
  return p;
});
const raw = { homeTeam: { id: 1, fullName: fx.h, abbreviatedName: fx.h }, awayTeam: { id: 2, fullName: fx.a, abbreviatedName: fx.a }, plays, matchFinished: true };
const g = A.parseGame(raw, { id: 105375 });
console.log('warnings', g.warnings);
console.log('final', g.final, 'quarters', JSON.stringify(g.quarterScores));
const v = A.validate(g);
console.log('validation', v.ok + '/' + v.n, 'ptsOk', v.ptsOk); v.diffs.forEach(d => console.log('  ', d));
const tb = A.teamBoxes(g);
const m0 = A.teamMetrics(tb[0], tb[1]), m1 = A.teamMetrics(tb[1], tb[0]);
const f = x => x == null ? '-' : (Math.round(x * 1000) / 1000);
console.log('poss', tb[0].poss, tb[1].poss, 'est', f(m0.possEst), f(m1.possEst), 'secs', tb[0].sec);
console.log('H', Object.fromEntries(Object.entries(m0).map(([k, v]) => [k, f(v)])));
console.log('A', Object.fromEntries(Object.entries(m1).map(([k, v]) => [k, f(v)])));
// minutos
const adv = A.playerAdvanced(g);
let tmin = [0, 0]; adv.forEach(p => tmin[p.side] += p.min);
console.log('team minutes', tmin.map(f));
adv.sort((a, b) => a.side - b.side || b.min - a.min).forEach(p => console.log(p.side, p.name.padEnd(20), f(p.min), 'pts', p.box.pts, '+/-', p.pm, 'usg', f(p.usg), 'ts', f(p.ts), 'net', f(p.onNet), 'onoff', f(p.onOff), 'pir', p.pir, 'wpa', f(p.wpa)));
// suma +/- de equipo
console.log('sum +/- /5', adv.filter(p => p.side === 0).reduce((a, p) => a + p.pm, 0) / 5, g.final[0] - g.final[1]);
// posesiones: suma puntos
const pp = [0, 0]; g.poss.forEach(p => pp[p.side] += p.pts);
console.log('pts in poss', pp, 'final', g.final);
// check alternancia
let same = 0; for (let i = 1; i < g.poss.length; i++) if (g.poss[i].side === g.poss[i - 1].side) same++;
console.log('consecutive same-side possessions', same);
for (let i = 1; i < g.poss.length; i++) if (g.poss[i].side === g.poss[i - 1].side) { const p = g.poss[i]; console.log('   ', p.q, g.events[p.endIdx].clock, p.side, p.start, p.end, 'prev', g.poss[i-1].end); }
console.log('profile H', JSON.stringify(A.possessionProfile(g.poss.filter(p=>p.side===0))));
console.log('profile A', JSON.stringify(A.possessionProfile(g.poss.filter(p=>p.side===1))));
const L = A.lineupTallies(g).filter(l => l.side === 0).sort((a, b) => b.for.sec - a.for.sec).slice(0, 4);
L.forEach(l => console.log('lineup', l.pids.map(p => g.players.get(p).name.split(' ').pop()).join('-'), f(l.for.sec / 60), 'pm', l.for.pts - l.against.pts, 'poss', l.for.poss, l.against.poss));
console.log('runs', A.runs(g).map(r => (r.side ? fx.a : fx.h) + ' ' + r.pts + '-0 ' + r.t0 + '-' + r.t1 + ' TO:' + r.timeouts.join('/')));
console.log('best5', JSON.stringify(A.bestStretch(g)));
console.log('TOs', A.timeouts(g).map(t => [t.side, t.q, t.clock, t.beforeO, t.afterO, t.beforeD, t.afterD].join(' ')));
console.log('assists', g.assists.length, 'swings', g.swings.slice(0, 3).map(s => s.e.clock + ' ' + f(s.dwp)));
console.log('clutch box', JSON.stringify(A.teamBoxes(g, x => x.clutch).map(b => [b.pts, b.poss, b.sec])));
// stint +/- consistency
const pmS = {}; g.stints.forEach(s => pmS[s.pid] = (pmS[s.pid] || 0) + s.pm);
const bad = adv.filter(p => (pmS[p.pid] || 0) !== p.pm).map(p => p.name + ' ' + pmS[p.pid] + ' vs ' + p.pm);
console.log('stint pm mismatches', bad);
// merge test: two copies = double
const acc = new Map(); for (const r of A.playerRaw(g).values()) { A.mergeRaw(acc, r); A.mergeRaw(acc, r); }
const m2 = [...acc.values()].map(A.playerMetrics).find(p => p.name === 'Darrun Hilliard');
console.log('merged Hilliard gp', m2.gp, 'min', m2.min.toFixed(1), 'pts', m2.box.pts, 'usg', m2.usg.toFixed(3), 'onoff', m2.onOff.toFixed(2));
