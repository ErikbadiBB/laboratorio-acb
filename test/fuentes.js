// Vigilancia de las fuentes de datos (la ejecuta GitHub cada mañana; también a mano con `node test/fuentes.js`).
// Comprueba que cada fuente responde, que hay calendario de la temporada y que un partido de referencia de cada
// competición sigue cuadrando con el acta oficial. Si algo falla, termina con error y GitHub avisa por correo.
const fs = require('fs'), path = require('path');
require('../engine.js'); require('../fiba.js'); require('../ligau.js');
const A = globalThis.ACB, F = globalThis.ACB_FIBA, LU = globalThis.ACB_LU;
const app = fs.readFileSync(path.join(__dirname, '..', 'app.html'), 'utf8');
const k = name => { const m = app.match(new RegExp('const ' + name + " = '([^']+)'")); if (!m) throw new Error('No encuentro ' + name + ' en app.html'); return m[1]; };
const API = k('API'), KEY = k('DEFAULT_KEY'), HAPI = k('HAPI'), HAPI_KEY = k('HAPI_KEY'), PROXY = k('DEFAULT_PROXY'), LU_API = k('LU_API'), LU_KEY = k('LU_KEY');
const BCL_COMP_ID = +app.match(/const BCL_COMP_ID = (\d+)/)[1];
const [, LU_COMP, LU_SEASON] = app.match(/const LU_COMP = (\d+), LU_SEASON = '([^']+)'/);
const REF = { acb: 105394, bcl: 136295, lu: 2538967 }; // partidos de referencia (CLAUDE.md)
const WEB = 'https://erikbadibb.github.io/laboratorio-acb/';

const get = async (url, headers = {}, type = 'json') => {
  const r = await fetch(url, { headers, signal: AbortSignal.timeout(25000) });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return type === 'json' ? r.json() : r.text();
};
const acb = p => get(API + p, { 'X-APIKEY': KEY });
const hapi = p => get(HAPI + p, { 'Ocp-Apim-Subscription-Key': HAPI_KEY });
const lu = p => get(LU_API + p, { apikey: LU_KEY, Authorization: 'Bearer ' + LU_KEY });
const cuadre = g => { const v = A.validate(g); const ok = v.n > 0 && v.ok === v.n && v.ptsOk && v.minOk === v.minN && v.pmOk === v.pmN; return [ok, `${g.teams[0].abbr} ${g.final[0]}-${g.final[1]} ${g.teams[1].abbr} · acta ${v.ok}/${v.n}` + (v.minN ? ` · minutos ${v.minOk}/${v.minN}` : '') + (v.pmN ? ` · +/- ${v.pmOk}/${v.pmN}` : '') + (ok ? '' : ' · ' + v.diffs.slice(0, 3).join('; '))]; };

const checks = [
  ['ACB · calendario', async () => { const cd = await acb('/matchdata/Menu/competition-data?competitionIds=1'); const c = cd.competitions.find(x => x.id === cd.currentCompetitionId) || cd.competitions[0]; const ed = c.editions.find(e => e.id === cd.currentEditionId) || c.editions[c.editions.length - 1]; const ml = await acb('/matchdata/Menu/matchlist?roundId=' + cd.currentRoundId); return [ed.rounds.length > 0 && ml.matches.length > 0, `${ed.rounds.length} jornadas · jornada actual con ${ml.matches.length} partidos`]; }],
  ['ACB · partido de referencia', async () => { const raw = await acb('/matchdata/PlayByPlay/play-by-play?matchId=' + REF.acb); const g = A.parseGame(raw, { id: REF.acb }); const [ok, txt] = cuadre(g); return [ok, txt + (raw.homeTeam && raw.homeTeam.primaryColorHex ? ' · trae colores' : ' · sin colores de equipo')]; }],
  ['BCL · calendario (FIBA)', async () => { const g = await hapi('getgdapgamesbycompetitionid?gdapCompetitionId=' + BCL_COMP_ID); return [g.length > 0, g.length + ' partidos en la competición ' + BCL_COMP_ID]; }],
  ['BCL · puente y partido de referencia', async () => {
    const [d, box] = await Promise.all([get(PROXY + '/api/bcl?id=' + REF.bcl), hapi('getgdapgamestatisticsbygameid?gdapGameId=' + REF.bcl)]);
    d.box = box.filter(b => b.player).map(b => [b.player.playerId, b.team.organisationId, b.isStarter ? 1 : 0, b.playDurationInSeconds, b.points, b.twoPointsMade, b.twoPointsAttempted, b.threePointsMade, b.threePointsAttempted, b.freeThrowsMade, b.freeThrowsAttempted, b.offensiveRebounds, b.defensiveRebounds, b.assists, b.steals, b.turnovers, b.blockedShots, b.personalFouls, b.plusMinus]);
    return cuadre(A.parseGame(F.fibaToRaw(d), { id: REF.bcl }));
  }],
  ['BCL · canal en tiempo real', async () => { const t = await get(PROXY + '/api/bcl?token=1'); return [/^wss?:/.test(t.url || ''), t.url ? 'credencial recibida' : 'sin credencial']; }],
  ['Liga U · calendario', async () => { const m = await lu(`all_matches_data_lf_endesa?select=match_id&competition_id=eq.${LU_COMP}&season=eq.${LU_SEASON}`); return [m.length > 0, `${m.length} partidos en la temporada ${LU_SEASON}`]; }],
  ['Liga U · partido de referencia', async () => {
    const id = REF.lu;
    const [pbp, md, box, shots, t] = await Promise.all([lu(`pbp_player_name_ligau_view?select=*&match_id=eq.${id}&order=num.asc`), lu(`all_matches_data_lf_endesa?select=*&match_id=eq.${id}`), lu(`all_players_boxscores_lf_endesa?select=*&match_id=eq.${id}`), lu(`shots_with_player_info_view?select=*&limit=10000&match_id=eq.${id}`), lu(`teams_info_ligau?select=id_equipo_temporada,nombre_acor,nombre_abr,Color&competition_id=eq.${LU_COMP}&season=eq.${LU_SEASON}`)]);
    const teams = new Map(t.map(x => [x.id_equipo_temporada, { abbr: String(x.nombre_abr || '').trim(), name: x.nombre_acor, color: x.Color || null }]));
    const [ok, txt] = cuadre(A.parseGame(F.fibaToRaw(LU.luToFiba(pbp, md[0], box, shots, teams)), { id }));
    return [ok, txt + ` · «num» ${typeof (pbp[0] || {}).num === 'number' ? 'numérico (descarga parcial en directo activa)' : 'no numérico (se descarga entero)'}`];
  }],
  ['Web publicada', async () => {
    const html = await get(WEB + '?v=' + Date.now(), {}, 'text');
    let local = null; try { local = fs.readFileSync(path.join(__dirname, '..', 'site', 'index.html'), 'utf8'); } catch (e) { }
    if (!/StatsLAB/.test(html)) return [false, 'no parece la web de StatsLAB'];
    return [true, local == null ? 'responde' : html === local ? 'responde y es la última versión' : 'responde (versión distinta a la del repositorio: puede estar publicándose)'];
  }]
];

(async () => {
  const lines = []; let bad = 0;
  for (const [name, fn] of checks) {
    let ok, txt; try { [ok, txt] = await fn(); } catch (e) { ok = false; txt = String(e.message || e); }
    if (!ok) bad++;
    lines.push(`${ok ? '✓' : '✗'} ${name}: ${txt}`);
    console.log(lines[lines.length - 1]);
  }
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `## Vigilancia de fuentes\n\n${lines.map(l => '- ' + l).join('\n')}\n`);
  console.log(bad ? `\n${bad} comprobación(es) con problemas` : '\nTodo en orden');
  process.exit(bad ? 1 : 0);
})();
