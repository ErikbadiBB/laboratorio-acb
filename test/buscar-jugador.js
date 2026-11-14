// Diagnóstico con datos reales de la ACB: en qué jornadas y partidos aparece un jugador (y con qué valoración).
// Uso: node test/buscar-jugador.js "sedekerskis"   (lo ejecuta el flujo «Consultar un jugador» en GitHub)
const fs = require('fs'), path = require('path');
require('../engine.js');
const A = globalThis.ACB;
const app = fs.readFileSync(path.join(__dirname, '..', 'app.html'), 'utf8');
const API = app.match(/const API = '([^']+)'/)[1], KEY = app.match(/const DEFAULT_KEY = '([^']+)'/)[1];
const q = String(process.argv[2] || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const acb = async p => { const r = await fetch(API + p, { headers: { 'X-APIKEY': KEY } }); if (r.status === 204) return null; if (!r.ok) throw new Error(p + ' HTTP ' + r.status); return r.json(); };
(async () => {
  const cd = await acb('/matchdata/Menu/competition-data?competitionIds=1');
  const c = cd.competitions.find(x => x.id === cd.currentCompetitionId) || cd.competitions[0];
  const ed = c.editions.find(e => e.id === cd.currentEditionId) || c.editions[c.editions.length - 1];
  const cur = ed.rounds.find(r => r.id === cd.currentRoundId);
  console.log('Jornada actual:', cur.roundNumber, '| buscando:', q);
  const found = [];
  for (const r of ed.rounds.filter(r => r.roundNumber <= cur.roundNumber).sort((a, b) => a.roundNumber - b.roundNumber)) {
    const ml = await acb('/matchdata/Menu/matchlist?roundId=' + r.id);
    let seen = false;
    for (const m of (ml && ml.matches) || []) {
      if (m.matchStatus !== 'FINALIZED' && m.matchStatus !== 'STARTED') continue;
      const raw = await acb('/matchdata/PlayByPlay/play-by-play?matchId=' + m.id); if (!raw || !raw.plays) continue;
      const names = new Map(); raw.plays.forEach(p => { if (p.playerLicenseId && p.playerName) names.set(p.playerLicenseId, p.playerName); });
      for (const [pid, n] of names) if (String(n).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().includes(q)) {
        const g = A.parseGame(raw, { id: m.id }), p = A.playerAdvanced(g).find(x => x.pid === pid);
        console.log(`J${r.roundNumber} · partido ${m.id} ${m.homeTeam.abbreviatedName}-${m.awayTeam.abbreviatedName} (${m.matchStatus}) · ${n} [${pid}] · equipo ${g.teams[p.side].abbr} (id ${g.teams[p.side].id}) · min ${p.min.toFixed(1)} · val ${p.pir}`);
        seen = true; found.push(r.roundNumber);
      }
    }
    if (!seen) console.log(`J${r.roundNumber}: no aparece`);
  }
  const last4 = found.filter(n => n > cur.roundNumber - 4);
  console.log(`\nAparece en ${found.length} jornadas; en las últimas 4: ${last4.length ? last4.map(n => 'J' + n).join(', ') : 'NINGUNA (por eso no estaría en la lista del Supermanager)'}`);
})().catch(e => { console.error(e); process.exit(1); });
