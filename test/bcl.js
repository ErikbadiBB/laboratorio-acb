require('../engine.js'); require('../fiba.js');
const A = globalThis.ACB, F = globalThis.ACB_FIBA;
const d = require('./bcl136295.json');
const raw = F.fibaToRaw(d);
const g = A.parseGame(raw, { id: 136295 });
const f = x => x == null ? '-' : Math.round(x * 1000) / 1000;
console.log('warnings', g.warnings, 'final', g.final, JSON.stringify(g.quarterScores));
const v = A.validate(g); console.log('box', v.ok + '/' + v.n, 'pts', v.ptsOk, 'min', v.minOk + '/' + v.minN, 'pm', v.pmOk + '/' + v.pmN); v.diffs.slice(0, 30).forEach(x => console.log('  ', x));
const tb = A.teamBoxes(g); console.log('poss', tb[0].poss, tb[1].poss, 'est', f(A.teamMetrics(tb[0], tb[1]).possEst), f(A.teamMetrics(tb[1], tb[0]).possEst));
let same = 0; for (let i = 1; i < g.poss.length; i++) if (g.poss[i].side === g.poss[i - 1].side) { same++; const p = g.poss[i]; console.log('   same', p.q, g.events[p.endIdx].clock, p.side, p.start, p.end); }
const pp = [0, 0]; g.poss.forEach(p => pp[p.side] += p.pts); console.log('pts in poss', pp);
console.log('assists matched', g.assists.length, 'of', d.rows.filter(r => r[5] === 'ASS').length);
const shots = g.events.filter(e => e.x != null && [93, 94, 97, 98, 100, 533].includes(e.type)); console.log('shots with xy', shots.length);
const z = {}; shots.forEach(e => { const k = e.side + ' ' + F.shotZone(e.x, e.y, [94, 98].includes(e.type)); z[k] = z[k] || [0, 0]; z[k][1]++; if ([93, 94, 100].includes(e.type)) z[k][0]++; }); console.log(z);
