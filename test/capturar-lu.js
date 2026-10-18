// Guarda un partido real de la Liga U como dato de prueba (lo ejecuta el flujo «Capturar datos de prueba»).
// Uso: node test/capturar-lu.js [match_id]  → test/lu<ID>.json con solo los campos que usa el adaptador.
const fs = require('fs'), path = require('path');
const app = fs.readFileSync(path.join(__dirname, '..', 'app.html'), 'utf8');
const LU_API = app.match(/const LU_API = '([^']+)'/)[1], LU_KEY = app.match(/const LU_KEY = '([^']+)'/)[1];
const [, COMP, SEASON] = app.match(/const LU_COMP = (\d+), LU_SEASON = '([^']+)'/);
const id = +(process.argv[2] || 2538967);
const lu = async p => { const r = await fetch(LU_API + p, { headers: { apikey: LU_KEY, Authorization: 'Bearer ' + LU_KEY } }); if (!r.ok) throw new Error(p + ' HTTP ' + r.status); return r.json(); };
const pick = (o, keys) => Object.fromEntries(keys.filter(k => k in o).map(k => [k, o[k]]));
(async () => {
  const [pbp, md, box, shots, teams] = await Promise.all([
    lu(`pbp_player_name_ligau_view?select=*&match_id=eq.${id}&order=num.asc`), lu(`all_matches_data_lf_endesa?select=*&match_id=eq.${id}`),
    lu(`all_players_boxscores_lf_endesa?select=*&match_id=eq.${id}`), lu(`shots_with_player_info_view?select=*&limit=10000&match_id=eq.${id}`),
    lu(`teams_info_ligau?select=id_equipo_temporada,nombre_acor,nombre_abr,Color&competition_id=eq.${COMP}&season=eq.${SEASON}`)]);
  const out = {
    id, capturado: new Date().toISOString(),
    pbp: pbp.map(r => pick(r, ['num', 'action', 'quarter', 'time', 'text', 'idPlayer', 'idLicense', 'idTeam', 'team', 'player_name', 'scoreA', 'scoreB', 'logParam1', 'logParam2', 'logParam3', 'logParam4', 'logParam5', 'logParam6', 'deleted'])),
    md: md.map(r => pick(r, ['match_id', 'jornada', 'group_name', 'team1_id', 'team2_id', 'team1_short_name', 'team2_short_name', 'status_code', 'game_time', 'quarter', 'fecha', 'local_points', 'visitor_points'])),
    box: box.map(r => pick(r, ['id', 'id_equipo', 'no', 'name', 'min', 'pts', 'p2m', 'p2a', 'p3m', 'p3a', 'p1m', 'p1a', 'ro', 'rd', 'assist', 'st', 'to', 'bs', 'pf'])),
    shots: shots.map(r => pick(r, ['coord_x_metros', 'coord_y_metros', 'cuarto', 'tiempo', 'player_id', 'made', 'two_or_three'])),
    teams
  };
  const f = path.join(__dirname, 'lu' + id + '.json');
  fs.writeFileSync(f, JSON.stringify(out));
  console.log('guardado', f, (fs.statSync(f).size / 1024).toFixed(0) + ' KB', '| jugadas', out.pbp.length, '| acta', out.box.length, '| tiros', out.shots.length);
})().catch(e => { console.error(e); process.exit(1); });
