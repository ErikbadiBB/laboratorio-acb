/* Adaptador Liga U (ACB U22, datos FEB servidos por ligau.com) → formato compacto FIBA → motor
   Entrada: filas de pbp_player_name_ligau_view, fila de all_matches_data_lf_endesa,
   boxscore (all_players_boxscores_lf_endesa), tiros (shots_with_player_info_view) y equipos. */
(function (root) {
  'use strict';
  const toInt = v => (v == null || v === '' ? null : Number(v));

  // Coordenadas Liga U (metros desde la línea de fondo y desde la banda) → media pista FIBA 280 × 262
  function shotXY(s) {
    if (s.coord_x_metros == null || s.coord_y_metros == null) return [null, null];
    let xm = Number(s.coord_x_metros), ym = Number(s.coord_y_metros);
    if (xm > 14) { xm = 28 - xm; ym = 15 - ym; }
    return [Math.round(140 + (ym - 7.5) * 18.67), Math.round(29 + (xm - 1.575) * 18.67)];
  }

  function luToFiba(pbpIn, md, boxIn, shotsIn, teams) {
    teams = teams || new Map();
    const idA = md.team1_id, idB = md.team2_id;
    const tA = teams.get(idA) || {}, tB = teams.get(idB) || {};
    const abbr = (t, name) => (t.abbr || String(name || '').replace(/[^A-ZÁÉÍÓÚÑ ]/gi, '').split(' ').filter(Boolean).map(w => w[0]).join('').slice(0, 3)).toUpperCase();
    const game = {
      id: md.match_id,
      A: { teamId: idA, organisationId: idA, code: abbr(tA, md.team1_short_name), shortName: tA.name || md.team1_short_name, officialName: md.team1_short_name },
      B: { teamId: idB, organisationId: idB, code: abbr(tB, md.team2_short_name), shortName: tB.name || md.team2_short_name, officialName: md.team2_short_name },
      sa: md.local_points, sb: md.visitor_points, period: 'Q' + (md.quarter || 1), chrono: md.game_time
    };
    const finished = md.status_code === 3 || /final/i.test(md.game_time || '');

    // Filas únicas y en orden
    const seen = new Map();
    for (const r of pbpIn || []) if (!r.deleted) seen.set(r.num + '|' + r.action + '|' + (r.idPlayer || '') + '|' + (r.text || ''), r);
    const ev = [...seen.values()].sort((a, b) => a.num - b.num);

    // Jugadores: boxscore + nombres completos del jugada a jugada; licencia → jugador
    const players = new Map(), lic = new Map();
    for (const b of boxIn || []) players.set(b.id, [b.id, b.id_equipo === idA ? 'A' : 'B', b.no != null ? String(b.no) : '', b.name]);
    for (const r of ev) {
      if (!r.idPlayer) continue;
      const pid = Number(r.idPlayer);
      if (r.idLicense) lic.set(String(r.idLicense), pid);
      const side = r.idTeam === idA || r.team === 1 ? 'A' : 'B';
      if (!players.has(pid)) players.set(pid, [pid, side, '', r.player_name || '']);
      else if (r.player_name) players.get(pid)[3] = r.player_name;
    }

    // Titulares: entradas a pista en el 1C a 10:00 antes de cualquier otra acción
    const starters = new Set(), drop = new Set();
    for (const r of ev) {
      if (r.action === 'period') continue;
      if (r.action === 'subst' && r.quarter === 1 && r.time === '10:00' && /entra/i.test(r.text)) { starters.add(Number(r.idPlayer)); drop.add(r); continue; }
      break;
    }

    // Tiros con posición: se asocian por cuarto, reloj, jugador y resultado
    const shotQ = new Map();
    for (const s of shotsIn || []) {
      const k = s.cuarto + '|' + s.tiempo + '|' + s.player_id + '|' + (s.made ? 1 : 0) + '|' + s.two_or_three;
      if (!shotQ.has(k)) shotQ.set(k, []); shotQ.get(k).push(s);
    }

    const rows = [];
    let sa = 0, sb = 0, lastMiss = null;
    const pfCount = new Map();
    const sideId = s => (s === 0 ? idA : idB);
    const add = (r, ac, txt, extra) => {
      const q = r.quarter > 4 ? 'OT' + (r.quarter - 4) : 'Q' + r.quarter;
      const pid = r.idPlayer ? Number(r.idPlayer) : 0;
      const side = r.team === 1 ? 0 : r.team === 2 ? 1 : (r.idTeam === idA ? 0 : r.idTeam === idB ? 1 : null);
      const row = [r.num * 10 + (extra && extra.sub || 0), q, r.time, sa, sb, ac, txt, side == null ? 0 : sideId(side), pid,
        extra && extra.made != null ? extra.made : null, extra && extra.x != null ? extra.x : null, extra && extra.y != null ? extra.y : null, null, null];
      if (extra && extra.pid != null) row[8] = extra.pid;
      if (extra && extra.oId != null) row[7] = extra.oId;
      rows.push(row); return side;
    };

    for (const r of ev) {
      if (drop.has(r)) continue;
      if (r.scoreA != null && r.scoreA !== '') { sa = Number(r.scoreA); sb = Number(r.scoreB); }
      const p = [r.logParam1, r.logParam2, r.logParam3, r.logParam4, r.logParam5, r.logParam6];
      switch (r.action) {
        case 'period':
          if (/comienzo/i.test(r.text)) { if (r.quarter === 1) add(r, 'STARTG', 'Start of game'); add(r, 'STARTP', 'Start of period', { sub: 1 }); }
          else add(r, 'ENDP', 'End of period');
          break;
        case 'shoot': {
          const pts = toInt(p[5]) === 3 ? 3 : 2, made = p[3] === '1' ? 1 : 0;
          const k = r.quarter + '|' + r.time + '|' + Number(r.idPlayer) + '|' + made + '|' + pts;
          const s = shotQ.has(k) && shotQ.get(k).shift();
          const [x, y] = s ? shotXY(s) : [null, null];
          const side = add(r, pts === 3 ? 'P3' : 'P2', (p[4] === '9' ? 'dunk ' : '') + (made ? 'made' : 'missed'), { made, x, y });
          if (!made) lastMiss = side;
          break;
        }
        case 'fthrow': {
          const made = p[3] === '1' ? 1 : 0;
          const side = add(r, 'FT', made ? 'made' : 'missed', { made });
          if (!made) lastMiss = side;
          break;
        }
        case 'rebound': {
          const side = r.team === 1 ? 0 : r.team === 2 ? 1 : (r.idTeam === idA ? 0 : 1);
          const off = lastMiss != null && side === lastMiss;
          add(r, r.idPlayer ? 'REB' : 'TREB', off ? 'offensive rebound' : 'defensive rebound');
          lastMiss = null;
          break;
        }
        case 'assist': add(r, 'ASS', 'assist'); break;
        case 'recovery': add(r, 'ST', 'steal'); break;
        case 'blockshot': add(r, 'BS', 'block'); break;
        case 'lose': add(r, r.idPlayer ? 'TO' : 'TTO', 'turnover'); break;
        case 'timeout': add(r, 'TIMO', 'timeout'); break;
        case 'subst': add(r, 'SUBST', /entra/i.test(r.text) ? 'Sub-In' : 'Sub-Out'); break;
        case 'foul': {
          const t = r.text || '';
          const m = t.match(/Tiros libres:\s*(\d)/i); const n = m ? +m[1] : (toInt(p[5]) || 0);
          let kind = 'personal';
          if (p[2] === '8' || /ofensiva/i.test(t)) kind = 'offensive';
          else if (/t[eé]cnica/i.test(t)) kind = r.idPlayer ? 'technical' : 'technical coach';
          else if (/descalificante/i.test(t)) kind = 'disqualifying';
          else if (/flagrante|antideportiva/i.test(t) || p[2] === '18') kind = 'unsportsmanlike';
          // Si el contador de faltas del jugador no sube, el acta no se la imputa (p. ej. «Flagrante»): falta sin jugador
          const fc = t.match(/\(Faltas:\s*(\d+)/i), pid = r.idPlayer ? Number(r.idPlayer) : 0;
          let charge = true;
          if (fc && pid) { const prev = pfCount.get(pid) || 0; if (+fc[1] <= prev) charge = false; else pfCount.set(pid, +fc[1]); }
          const side = add(r, 'FOUL', kind + ' foul' + (n ? '; ' + n + ' free throw' + (n > 1 ? 's' : '') : ''), charge ? null : { pid: 0 });
          const drawn = p[3] && lic.get(String(p[3]));
          if (drawn && side != null) add(r, 'RFOUL', 'foul drawn', { sub: 2, pid: drawn, oId: sideId(1 - side) });
          break;
        }
        default: break;
      }
    }
    if (finished && rows.length && !rows.some(r => r[5] === 'ENDG')) { const l = rows[rows.length - 1]; rows.push([l[0] + 5, l[1], '00:00', sa, sb, 'ENDG', 'End of game', 0, 0, null, null, null, null, null]); }
    game.sa = sa; game.sb = sb;

    const box = (boxIn || []).map(b => [b.id, b.id_equipo, starters.has(b.id) ? 1 : 0, b.min, b.pts, b.p2m, b.p2a, b.p3m, b.p3a, b.p1m, b.p1a,
      b.ro, b.rd, b.assist, b.st, b.to, b.bs, b.pf, null]);
    return {
      game, players: [...players.values()], rows, box: box.length ? box : undefined, finished,
      colors: { teamA: tA.color || null, teamB: tB.color || null }
    };
  }

  root.ACB_LU = { luToFiba, shotXY };
})(typeof globalThis !== 'undefined' ? globalThis : this);
