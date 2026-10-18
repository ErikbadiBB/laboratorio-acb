/* Adaptador FIBA (Basketball Champions League) → formato del motor (ACB)
   Entrada: { game, players:[[personId,'A'|'B',dorsal,nombre]], rows:[...], box?:[...] }
   rows: [order, periodo, reloj, SA, SB, ac, txt, oId, pId, made, x, y, in, p2Id] */
(function (root) {
  'use strict';
  const periodNum = q => { const m = String(q).match(/(\d+)/); if (/^OT|^E|^P/i.test(q)) return 4 + (m ? +m[1] : 1); return m ? +m[1] : 1; };

  function foulType(txt) {
    const t = (txt || '').toLowerCase();
    const n = /3 free/.test(t) ? 3 : /2 free/.test(t) ? 2 : /1 free|free throw awarded/.test(t) ? 1 : 0;
    if (/offensive/.test(t)) return 109;
    if (/technical/.test(t) && /coach|bench/.test(t)) return 176;
    if (/technical/.test(t)) return n ? (n === 1 ? 537 : 538) : 172;
    if (/unsportsmanlike/.test(t)) return n === 1 ? 165 : n === 3 ? 167 : n === 2 ? 166 : 169;
    if (/disqualif/.test(t)) return n === 1 ? 548 : n === 2 ? 549 : n === 3 ? 550 : 170;
    return n === 1 ? 160 : n === 2 ? 161 : n === 3 ? 162 : 159;
  }
  function tovTag(txt) {
    const t = (txt || '').toLowerCase();
    if (/bad pass/.test(t)) return 12; if (/travel/.test(t)) return 1; if (/3 sec/.test(t)) return 2;
    if (/shot clock|24/.test(t)) return 7; if (/8 sec/.test(t)) return 8; if (/5 sec/.test(t)) return 10;
    if (/double dribble/.test(t)) return 14; if (/backcourt|back court/.test(t)) return 15;
    return 13;
  }

  const isIn = r => /in$/i.test(String(r[6] || '').trim()) ? true : /out$/i.test(String(r[6] || '').trim()) ? false : !!r[12];

  function fibaToRaw(d) {
    const G = d.game, A = G.A, B = G.B;
    const sideOf = oId => (oId === A.organisationId ? 0 : oId === B.organisationId ? 1 : null);
    const pinfo = new Map(d.players.map(p => [p[0], { side: p[1] === 'A' ? 0 : 1, num: p[2], name: p[3] }]));
    const rows = d.rows.slice().sort((a, b) => a[0] - b[0]);
    const plays = [];
    const push = (r, type, extra) => {
      const [order, Q, Time, SA, SB, ac, txt, oId, pId] = r;
      const [m, s] = String(Time || '0:00').split(':').map(Number);
      let side = sideOf(oId); if (side == null && pId && pinfo.has(pId)) side = pinfo.get(pId).side;
      const pi = pId && pinfo.get(pId);
      plays.push(Object.assign({
        order, playType: type, playTag: null, quarter: periodNum(Q), minute: m || 0, second: s || 0,
        local: side === 0, scoreHome: SA, scoreAway: SB, licenseType: pId ? 1 : null,
        playerLicenseId: pId || null, playerName: pi ? pi.name : null, playerNumber: pi ? pi.num : null,
        playerStats: null, src: ac, txt
      }, extra || {}));
    };

    // Titulares: del boxscore oficial si existe; si no, se deducen del primer cambio de cada jugador
    const starters = new Set();
    if (d.box && d.box.some(b => b[2])) d.box.forEach(b => { if (b[2]) starters.add(b[0]); });
    else {
      const first = new Map();
      for (const r of rows) {
        const pId = r[8]; if (!pId || first.has(pId)) continue;
        if (r[5] === 'SUBST') first.set(pId, isIn(r) ? 'in' : 'out'); else first.set(pId, 'act');
      }
      first.forEach((v, pid) => { if (v !== 'in') starters.add(pid); });
    }
    const firstRow = rows[0] || [0, 'Q1', '10:00', 0, 0];
    starters.forEach(pid => { const pi = pinfo.get(pid); if (!pi) return; push([10, 'Q1', '10:00', 0, 0, 'STARTER', '', pi.side === 0 ? A.organisationId : B.organisationId, pid], 599); });

    // Asistencias: se resuelven contra la acción previa del mismo equipo
    let lastMade = null, lastFD = null;
    for (const r of rows) {
      const ac = r[5], txt = r[6] || '', made = r[9], sideR = sideOf(r[7]);
      switch (ac) {
        case 'STARTG': push(r, 122); break;
        case 'STARTP': push(r, 121); break;
        case 'ENDP': push(r, 116); break;
        case 'ENDG': push(r, 123); break;
        case 'JB': push(r, /won/i.test(txt) ? 178 : 179); break;
        case 'P2': case 'P3': {
          const dunk = /dunk/i.test(txt);
          const t = ac === 'P3' ? (made ? 94 : 98) : (made ? (dunk ? 100 : 93) : (dunk ? 533 : 97));
          push(r, t, { x: r[10], y: r[11], shotTxt: txt });
          if (made) lastMade = { side: sideR, ac, order: r[0] };
          break;
        }
        case 'FT': push(r, made ? 92 : 96); break;
        case 'REB': push(r, /offensive/i.test(txt) ? 101 : 104); break;
        case 'TREB': push(Object.assign(r.slice(), { 8: 0 }), /offensive/i.test(txt) ? 101 : 104); break;
        case 'ASS': {
          const t = lastMade && lastMade.side === sideR && r[0] - lastMade.order < 1000 ? (lastMade.ac === 'P3' ? 108 : 107) : 119;
          push(r, t); break;
        }
        case 'FOUL': push(r, foulType(txt)); break;
        case 'RFOUL': push(r, 110); lastFD = r; break;
        case 'SUBST': push(r, isIn(r) ? 112 : 115); break;
        case 'TO': { push(r, 106); plays[plays.length - 1].playTag = tovTag(txt); break; }
        case 'TTO': { push(Object.assign(r.slice(), { 8: 0 }), 106); plays[plays.length - 1].playTag = tovTag(txt); break; }
        case 'ST': push(r, 103); break;
        case 'BS': push(r, 102); break;
        case 'TIMO': push(r, 113); break;
        case 'VTR': push(r, /successful/i.test(txt) && !/unsuccessful/i.test(txt) ? 748 : 749); break;
        default: break; // JS y otras acciones sin efecto estadístico
      }
    }
    // Estadística oficial por jugador (para el cuadre)
    if (d.box) {
      const last = new Map(); plays.forEach((p, i) => { if (p.playerLicenseId) last.set(p.playerLicenseId, i); });
      d.box.forEach(b => {
        const i = last.get(b[0]); if (i == null) return;
        plays[i].playerStats = { points: b[4], twoPointersMade: b[5], twoPointersAttempted: b[6], threePointersMade: b[7], threePointersAttempted: b[8],
          freeThrowsMade: b[9], freeThrowsAttempted: b[10], offRebounds: b[11], defRebounds: b[12], assists: b[13], steals: b[14],
          turnovers: b[15], blocks: b[16], personalFouls: b[17], secondsPlayed: b[3], plusMinus: b[18] };
      });
    }
    const team = (t, color) => ({ id: t.teamId, clubId: t.organisationId, fullName: t.shortName || t.officialName, shortName: t.shortName, abbreviatedName: t.code, primaryColorHex: color || null });
    const finished = !!d.finished || rows.some(r => r[5] === 'ENDG');
    return { homeTeam: team(A, d.colors && d.colors.teamA), awayTeam: team(B, d.colors && d.colors.teamB), plays, matchFinished: finished, competition: 'BCL' };
  }

  // Zona de tiro a partir de las coordenadas FIBA (media pista 280 × 262, aro en (140, 29), 18,67 u/m)
  function shotZone(x, y, isThree) {
    if (x == null || y == null) return null;
    const dx = (x - 140) / 18.67, dy = (y - 29) / 18.67, r = Math.hypot(dx, dy);
    if (isThree) return (y < 57) ? 'Triple de esquina' : 'Triple frontal';
    if (r <= 1.25) return 'Zona restringida';
    if (Math.abs(x - 140) <= 45.7 && y <= 137) return 'Pintura';
    return 'Media distancia';
  }

  root.ACB_FIBA = { fibaToRaw, shotZone, periodNum };
})(typeof globalThis !== 'undefined' ? globalThis : this);
