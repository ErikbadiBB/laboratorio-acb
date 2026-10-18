/* Motor de análisis ACB a partir del play by play de api2.acb.com
   Expone globalThis.ACB = { parseGame, ... }  — sin dependencias */
(function (root) {
  'use strict';

  // ---------- Códigos de jugada ----------
  const C = {
    FTM: 92, FTX: 96, P2M: 93, P3M: 94, DUNK: 100, P2X: 97, P3X: 98, DUNKX: 533,
    ORB: 101, DRB: 104, TOV: 106, STL: 103, BLK: 102, BLKA: 105,
    AST2: 107, AST3: 108, ASTF: 119, FD: 110, OFF_FOUL: 109,
    SUB_IN: 112, SUB_OUT: 115, TIMEOUT: 113, TIMEOUT_TV: 118,
    START_GAME: 122, START_Q: 121, END_Q: 116, END_GAME: 123,
    STARTER: 599, JUMP_W: 178, JUMP_L: 179, CLOCK: 600
  };
  const MADE_FG = new Set([93, 94, 100]);
  const MISS_FG = new Set([97, 98, 533]);
  const FT = new Set([92, 96]);
  const AST = new Set([107, 108, 119]);
  const FT_PERSONAL = new Set([160, 161, 162]);
  // Faltas personales (cuentan para el jugador)
  const PF = new Set([109, 159, 160, 161, 162, 163, 164, 165, 166, 167, 168, 169, 170, 171, 172, 173, 174,
    537, 538, 539, 548, 549, 550, 551, 750, 751, 752, 753, 754, 755, 756, 757, 758, 759, 760, 761, 762, 763, 764,
    765, 766, 767, 768, 769, 778, 779, 780, 781, 782, 783, 784, 785, 786, 787]);
  // Faltas tras cuyos TL el equipo conserva la posesión (técnicas, antideportivas, descalificantes)
  const RETAIN = new Set([165, 166, 167, 168, 169, 170, 171, 172, 173, 174, 175, 176, 177, 537, 538, 539, 540, 541,
    542, 543, 544, 545, 546, 547, 548, 549, 550, 551, 552, 553, 554, 555, 556, 559, 560, 561, 562, 563]);
  for (let k = 750; k <= 787; k++) RETAIN.add(k);

  const LABEL = {
    92: 'Tiro libre anotado', 96: 'Tiro libre fallado', 93: 'Tiro de 2 anotado', 94: 'Triple anotado',
    100: 'Mate', 97: 'Tiro de 2 fallado', 98: 'Triple fallado', 533: 'Mate fallado',
    101: 'Rebote ofensivo', 104: 'Rebote defensivo', 106: 'Pérdida', 103: 'Recuperación',
    102: 'Tapón', 105: 'Tapón recibido', 107: 'Asistencia (2)', 108: 'Asistencia (3)', 119: 'Asistencia (falta)',
    110: 'Falta recibida', 109: 'Falta en ataque', 112: 'Entra a pista', 115: 'Sale de pista',
    113: 'Tiempo muerto', 118: 'Tiempo muerto TV', 122: 'Inicio del partido', 121: 'Inicio del periodo',
    116: 'Fin del periodo', 123: 'Fin del partido', 599: 'Quinteto inicial', 178: 'Gana salto', 179: 'Pierde salto',
    159: 'Falta personal', 160: 'Falta personal (1 TL)', 161: 'Falta personal (2 TL)', 162: 'Falta personal (3 TL)',
    163: 'Doble falta', 164: 'Falta personal', 165: 'Antideportiva (1 TL)', 166: 'Antideportiva (2 TL)',
    167: 'Antideportiva (3 TL)', 168: 'Doble antideportiva', 169: 'Antideportiva', 170: 'Descalificante',
    171: 'Descalificante', 172: 'Técnica', 173: 'Doble técnica', 174: 'Técnica', 175: 'Pelea', 176: 'Técnica al entrenador',
    177: 'Técnica al banquillo', 537: 'Técnica (1 TL)', 538: 'Técnica (2 TL)', 539: 'Técnica (3 TL)',
    130: 'Contraataque (2)', 131: 'Contraataque (3)', 405: 'Instant replay', 748: 'Challenge ganado', 749: 'Challenge perdido'
  };
  const TOV_TAG = { 1: 'Pasos', 2: '3 segundos', 7: '24 segundos', 8: '8 segundos', 9: '14 segundos', 10: '5 s en saque',
    11: '5 s', 12: 'Mal pase', 13: 'Balón perdido', 14: 'Dobles', 15: 'Campo atrás' };

  function label(e) {
    if (e.type === 106) return 'Pérdida' + (TOV_TAG[e.tag] ? ' – ' + TOV_TAG[e.tag] : '');
    return LABEL[e.type] || ('Acción ' + e.type);
  }

  // ---------- Utilidades ----------
  const periodLen = q => (q <= 4 ? 600 : 300);
  const periodStart = q => (q <= 4 ? (q - 1) * 600 : 2400 + (q - 5) * 300);
  const elapsed = (q, m, s) => periodStart(q) + periodLen(q) - (m * 60 + s);
  const fmtClock = (m, s) => m + ':' + String(s).padStart(2, '0');

  function newBox() {
    return { sec: 0, pts: 0, fgm: 0, fga: 0, fg2m: 0, fg2a: 0, fg3m: 0, fg3a: 0, ftm: 0, fta: 0, orb: 0, drb: 0,
      ast: 0, stl: 0, blk: 0, blka: 0, tov: 0, pf: 0, fd: 0, poss: 0, dunk: 0, astd: 0, ptsAst: 0 };
  }
  function addBox(a, b) { for (const k in b) a[k] = (a[k] || 0) + b[k]; return a; }

  // ---------- Parseo ----------
  // raw: respuesta de /PlayByPlay/play-by-play  ({homeTeam, awayTeam, plays, matchFinished})
  function parseGame(raw, meta) {
    meta = meta || {};
    const plays = (raw.plays || []).slice().sort((a, b) => a.order - b.order);
    const teams = [raw.homeTeam, raw.awayTeam].map(t => ({
      id: t.id, clubId: t.clubId, name: t.fullName, short: t.shortName, abbr: t.abbreviatedName,
      color: t.primaryColorHex, text: t.textColorHex, logo: t.logo
    }));
    const players = new Map();
    const warnings = [];

    // Eventos normalizados
    let pH = 0, pA = 0;
    const events = plays.map((x, i) => {
      const side = x.local ? 0 : 1;
      const e = {
        i, order: x.order, type: x.playType, tag: x.playTag, q: x.quarter, m: x.minute, s: x.second,
        t: elapsed(x.quarter, x.minute, x.second), clock: fmtClock(x.minute, x.second),
        side, pid: x.playerLicenseId || 0, sh: x.scoreHome, sa: x.scoreAway,
        x: x.x != null ? x.x : null, y: x.y != null ? x.y : null, src: x.src || null, txt: x.txt || x.shotTxt || null,
        d: [x.scoreHome - pH, x.scoreAway - pA], preH: pH, preA: pA
      };
      pH = x.scoreHome; pA = x.scoreAway;
      if (e.pid) {
        let p = players.get(e.pid);
        if (!p) { p = { pid: e.pid, name: x.playerName, num: null, side, img: x.playerImage, starter: false, last: null }; players.set(e.pid, p); }
        if (x.playerNumber) p.num = x.playerNumber;
        if (x.playerStats) p.last = x.playerStats;
        if (e.type === C.STARTER) p.starter = true;
      }
      return e;
    });

    // Lineups, tiempos, clutch
    const on = [new Set(), new Set()];
    const key = s => [...on[s]].sort((a, b) => a - b).join(',');
    const stint = new Map(); // pid -> t entrada
    const stints = [];       // {pid, side, t0, t1}
    events.forEach(e => { if (e.type === C.STARTER && e.pid) { on[e.side].add(e.pid); } });
    on.forEach((set, s) => set.forEach(pid => stint.set(pid, { t: 0, i: -1 })));
    let badLineup = 0;
    for (const e of events) {
      e.lin = [key(0), key(1)];
      const rem = periodLen(e.q) - (e.t - periodStart(e.q));
      e.clutch = e.q >= 4 && rem <= 300 && Math.abs(e.preH - e.preA) <= 5;
      if (e.type === C.SUB_OUT && e.pid) {
        if (on[e.side].has(e.pid)) {
          on[e.side].delete(e.pid);
          const st = stint.get(e.pid);
          stints.push({ pid: e.pid, side: e.side, t0: st.t, i0: st.i, t1: e.t, i1: e.i }); stint.delete(e.pid);
        }
      } else if (e.type === C.SUB_IN && e.pid) {
        if (!on[e.side].has(e.pid)) { on[e.side].add(e.pid); stint.set(e.pid, { t: e.t, i: e.i }); }
      }
      e.linAfter = [key(0), key(1)];
      if (e.type !== C.SUB_IN && e.type !== C.SUB_OUT && e.type !== C.STARTER &&
          (on[0].size !== 5 || on[1].size !== 5) && e.q) badLineup++;
    }
    const lastT = events.length ? events[events.length - 1].t : 0;
    stint.forEach((st, pid) => stints.push({ pid, side: players.get(pid).side, t0: st.t, i0: st.i, t1: lastT, i1: events.length }));
    // +/- de cada tramo en pista
    for (const st of stints) {
      let pm = 0;
      for (let k = st.i0 + 1; k < st.i1; k++) pm += events[k].d[st.side] - events[k].d[1 - st.side];
      st.pm = pm;
    }
    if (badLineup) warnings.push(badLineup + ' acciones con un quinteto distinto de 5 jugadores (posible error en los cambios del acta).');

    // Franjas de tiempo entre eventos
    const slices = [];
    for (let k = 0; k < events.length - 1; k++) {
      const a = events[k], b = events[k + 1];
      const dt = b.t - a.t;
      if (dt > 0) slices.push({ t0: a.t, t1: b.t, dt, q: b.q, lin: a.linAfter, clutch: b.clutch });
    }

    // Contribuciones estadísticas por evento: [side, pid, stat, v]
    const sameT = (k, f) => { // recorre eventos con el mismo t alrededor de k
      for (let j = k - 1; j >= 0 && events[j].t === events[k].t; j--) if (f(events[j], j)) return events[j];
      for (let j = k + 1; j < events.length && events[j].t === events[k].t; j++) if (f(events[j], j)) return events[j];
      return null;
    };
    const after = (k, f) => { for (let j = k + 1; j < events.length && events[j].t === events[k].t; j++) if (f(events[j], j)) return events[j]; return null; };

    for (const e of events) {
      const c = e.c = []; const s = e.side, p = e.pid;
      const add = (stat, v = 1, pid = p) => c.push([s, pid, stat, v]);
      switch (e.type) {
        case 92: add('ftm'); add('fta'); add('pts', 1); break;
        case 96: add('fta'); break;
        case 93: add('fgm'); add('fga'); add('fg2m'); add('fg2a'); add('pts', 2); break;
        case 100: add('fgm'); add('fga'); add('fg2m'); add('fg2a'); add('pts', 2); add('dunk'); break;
        case 94: add('fgm'); add('fga'); add('fg3m'); add('fg3a'); add('pts', 3); break;
        case 97: case 533: add('fga'); add('fg2a'); break;
        case 98: add('fga'); add('fg3a'); break;
        case 101: add('orb'); break;
        case 104: add('drb'); break;
        case 106: add('tov'); break;
        case 103: add('stl'); break;
        case 102: add('blk'); break;
        case 105: add('blka'); break;
        case 107: case 108: case 119: add('ast'); break;
        case 110: add('fd'); break;
        default: if (PF.has(e.type) && p) add('pf');
      }
      // Ajuste de puntos de equipo si el marcador no cuadra con la acción (correcciones de acta)
      for (const sd of [0, 1]) {
        const typed = c.filter(x => x[0] === sd && x[2] === 'pts').reduce((a, x) => a + x[3], 0);
        if (e.d[sd] !== typed) c.push([sd, 0, 'pts', e.d[sd] - typed]);
      }
    }

    // Asistencias: emparejar pasador → anotador
    const assists = [];
    events.forEach((e, k) => {
      if (!AST.has(e.type)) return;
      let tgt;
      if (e.type === 119) tgt = sameT(k, x => x.type === C.FD && x.side === e.side && x.pid !== e.pid);
      else tgt = sameT(k, x => MADE_FG.has(x.type) && x.side === e.side && x.pid !== e.pid && !x.assisted);
      if (!tgt) return;
      let pts;
      if (e.type === 119) pts = events.filter(x => x.t === e.t && x.type === 92 && x.pid === tgt.pid).length;
      else { pts = tgt.type === 94 ? 3 : 2; tgt.assisted = e.pid; tgt.c.push([tgt.side, tgt.pid, 'astd', 1]); }
      e.c.push([e.side, e.pid, 'ptsAst', pts]);
      assists.push({ from: e.pid, to: tgt.pid, side: e.side, pts, kind: e.type, t: e.t, q: e.q, clutch: e.clutch });
    });

    // ---------- Posesiones ----------
    const poss = [];
    const newPend = () => ({ act: false, firstAct: null, pts: 0, orb: 0, ptsOrb: 0 });
    let pend = [newPend(), newPend()], cur = null;
    let lastEnd = { t: 0, type: 'inicio', side: null, steal: false };
    const scoreAtEnd = { h: 0, a: 0 };
    const startKind = (s) => {
      if (lastEnd.type === 'inicio' || lastEnd.type === 'fin_periodo') return 'inicio';
      if (lastEnd.side !== 1 - s) return 'otro';
      if (lastEnd.type === 'canasta' || lastEnd.type === 'tl') return 'tras_canasta';
      if (lastEnd.type === 'rebote') return 'rebote_def';
      if (lastEnd.type === 'perdida') return lastEnd.steal ? 'robo' : 'perdida';
      return 'otro';
    };
    const act = (s, e) => {
      // Si el rival tenía una posesión abierta y ahora ataca este equipo, la anterior terminó sin evento explícito
      // (p. ej. falta del atacante tras su propio fallo)
      if (cur !== null && cur !== s && pend[cur].act) end(cur, e, 'cambio');
      if (!pend[s].act) { pend[s].act = true; pend[s].firstAct = e.t; } cur = s;
    };
    const end = (s, e, type, extra) => {
      const p = pend[s];
      const diff = (s === 0 ? 1 : -1) * (scoreAtEnd.h - scoreAtEnd.a);
      const rec = {
        n: poss.length, side: s, startT: lastEnd.t, endT: e.t, firstAct: p.firstAct ?? e.t,
        start: startKind(s), end: type, pts: p.pts, orb: p.orb, ptsOrb: p.ptsOrb,
        q: e.q, lin: e.linAfter || e.lin, clutch: e.clutch, endIdx: e.i, diffStart: diff
      };
      poss.push(rec); e.possEnd = rec.n;
      pend[s] = newPend(); cur = 1 - s;
      lastEnd = Object.assign({ t: e.t, type, side: s, steal: false }, extra || {});
      scoreAtEnd.h = e.sh; scoreAtEnd.a = e.sa;
    };

    events.forEach((e, k) => {
      for (const sd of [0, 1]) if (e.d[sd]) { pend[sd].pts += e.d[sd]; if (pend[sd].orb > 0) pend[sd].ptsOrb += e.d[sd]; }
      const s = e.side;
      const T = e.type;
      if (T === C.START_Q || T === C.START_GAME) {
        pend = [newPend(), newPend()]; cur = null;
        lastEnd = { t: e.t, type: 'inicio', side: null }; scoreAtEnd.h = e.sh; scoreAtEnd.a = e.sa; return;
      }
      if (MADE_FG.has(T)) {
        act(s, e);
        const andOne = after(k, x => FT.has(x.type) && x.side === s);
        if (!andOne) end(s, e, 'canasta');
      } else if (MISS_FG.has(T)) {
        act(s, e);
      } else if (FT.has(T)) {
        const personal = sameT(k, x => FT_PERSONAL.has(x.type) && x.side !== s);
        const retain = !personal && sameT(k, x => RETAIN.has(x.type) && x.side !== s);
        if (retain) return; // TL de técnica/antideportiva: no alteran la posesión en curso
        act(s, e);
        const more = after(k, x => FT.has(x.type) && x.side === s);
        if (!more && T === C.FTM) end(s, e, 'tl');
      } else if (T === C.ORB) {
        act(s, e); pend[s].orb++;
      } else if (T === C.DRB) {
        const o = 1 - s;
        const ftLater = after(k, x => FT.has(x.type) && x.side === o);
        if (!ftLater && pend[o].act) end(o, e, 'rebote');
      } else if (T === C.TOV) {
        act(s, e);
        const st = sameT(k, x => x.type === C.STL && x.side !== s);
        end(s, e, 'perdida', { steal: !!st });
      } else if (T === C.END_Q || T === C.END_GAME) {
        if (cur !== null && pend[cur].act) end(cur, e, 'fin_periodo');
        else lastEnd = { t: e.t, type: 'fin_periodo', side: null };
        pend = [newPend(), newPend()]; cur = null;
      }
    });

    const g = {
      id: meta.id || raw.matchId || null, teams, players, events, slices, stints, poss, assists, warnings,
      finished: !!raw.matchFinished, lastT, meta,
      periods: [...new Set(events.map(e => e.q))].filter(Boolean).sort((a, b) => a - b)
    };
    g.final = events.length ? [events[events.length - 1].sh, events[events.length - 1].sa] : [0, 0];
    g.quarterScores = g.periods.map(q => {
      const evq = events.filter(e => e.q === q);
      const prev = events.filter(e => e.q < q);
      const ph = prev.length ? prev[prev.length - 1].sh : 0, pa = prev.length ? prev[prev.length - 1].sa : 0;
      const l = evq[evq.length - 1];
      return { q, h: l.sh - ph, a: l.sa - pa };
    });
    computeWP(g);
    return g;
  }

  // ---------- Agregaciones genéricas ----------
  // filtro f(obj) se aplica a eventos, franjas y posesiones (todos tienen q, clutch, lin)
  function teamBoxes(g, f) {
    f = f || (() => true);
    const B = [newBox(), newBox()];
    for (const e of g.events) if (f(e)) for (const [s, , st, v] of e.c) B[s][st] += v;
    for (const p of g.poss) if (f(p)) B[p.side].poss++;
    for (const sl of g.slices) if (f(sl)) { B[0].sec += sl.dt; B[1].sec += sl.dt; }
    return B;
  }
  function playerBoxes(g, f) {
    f = f || (() => true);
    const P = new Map();
    const get = pid => { let b = P.get(pid); if (!b) { b = newBox(); P.set(pid, b); } return b; };
    for (const e of g.events) if (f(e)) for (const [, pid, st, v] of e.c) if (pid) get(pid)[st] += v;
    return P;
  }
  // Tallies por quinteto: {side, key, for:Box, against:Box}
  function lineupTallies(g, f) {
    f = f || (() => true);
    const L = new Map();
    const get = (s, k) => { const id = s + '|' + k; let o = L.get(id); if (!o) { o = { side: s, key: k, pids: k ? k.split(',').map(Number) : [], for: newBox(), against: newBox() }; L.set(id, o); } return o; };
    for (const e of g.events) {
      if (!f(e)) continue;
      for (const [s, , st, v] of e.c) {
        if (st === 'ptsAst' || st === 'astd') continue;
        get(s, e.lin[s]).for[st] += v; get(1 - s, e.lin[1 - s]).against[st] += v;
      }
    }
    for (const p of g.poss) if (f(p)) { get(p.side, p.lin[p.side]).for.poss++; get(1 - p.side, p.lin[1 - p.side]).against.poss++; }
    for (const sl of g.slices) if (f(sl)) { get(0, sl.lin[0]).for.sec += sl.dt; get(1, sl.lin[1]).for.sec += sl.dt; get(0, sl.lin[0]).against.sec += sl.dt; get(1, sl.lin[1]).against.sec += sl.dt; }
    return [...L.values()];
  }
  // Combinaciones (1 = on-court por jugador, 2 = parejas, 3 = tríos)
  function combos(lineups, size) {
    const M = new Map();
    const comb = (arr, k, start, cur, out) => { if (cur.length === k) { out.push(cur.slice()); return; } for (let i = start; i < arr.length; i++) { cur.push(arr[i]); comb(arr, k, i + 1, cur, out); cur.pop(); } };
    for (const L of lineups) {
      const out = []; comb(L.pids, size, 0, [], out);
      for (const c of out) {
        const id = L.side + '|' + c.join(',');
        let o = M.get(id); if (!o) { o = { side: L.side, key: c.join(','), pids: c, for: newBox(), against: newBox() }; M.set(id, o); }
        addBox(o.for, L.for); addBox(o.against, L.against);
      }
    }
    return [...M.values()];
  }

  // ---------- Métricas ----------
  const div = (a, b) => (b ? a / b : null);
  function teamMetrics(b, o) { // b: equipo, o: rival
    const min = b.sec / 60;
    return {
      pts: b.pts, poss: b.poss, min,
      ortg: div(100 * b.pts, b.poss), drtg: div(100 * o.pts, o.poss),
      net: (b.poss && o.poss) ? 100 * b.pts / b.poss - 100 * o.pts / o.poss : null,
      pace: b.sec ? (b.poss + o.poss) / 2 * 2400 / b.sec : null,
      efg: div(b.fgm + 0.5 * b.fg3m, b.fga), ts: div(b.pts, 2 * (b.fga + 0.44 * b.fta)),
      tovp: div(b.tov, b.poss), orbp: div(b.orb, b.orb + o.drb), drbp: div(b.drb, b.drb + o.orb),
      ftr: div(b.fta, b.fga), ftmr: div(b.ftm, b.fga),
      fg2: div(b.fg2m, b.fg2a), fg3: div(b.fg3m, b.fg3a), ft: div(b.ftm, b.fta),
      r3: div(b.fg3a, b.fga), astp: div(b.ast, b.fgm), astTo: div(b.ast, b.tov),
      stlp: div(b.stl, o.poss), blkp: div(b.blk, o.fg2a), ppp: div(b.pts, b.poss),
      possEst: b.fga + 0.44 * b.fta - b.orb + b.tov
    };
  }
  function pir(b) { return b.pts + b.orb + b.drb + b.ast + b.stl + b.blk + b.fd - (b.fga - b.fgm) - (b.fta - b.ftm) - b.tov - b.pf - b.blka; }
  function gmsc(b) { return b.pts + 0.4 * b.fgm - 0.7 * b.fga - 0.4 * (b.fta - b.ftm) + 0.7 * b.orb + 0.3 * b.drb + b.stl + 0.7 * b.ast + 0.7 * b.blk - 0.4 * b.pf - b.tov; }

  // Datos brutos por jugador: su box, lo ocurrido con él en pista y el total del equipo
  function playerRaw(g, f) {
    const lin = lineupTallies(g, f);
    const onc = combos(lin, 1);
    const own = playerBoxes(g, f);
    const team = teamBoxes(g, f);
    const out = new Map();
    for (const [pid, p] of g.players) {
      const s = p.side;
      const o = onc.find(x => x.side === s && x.pids[0] === pid) || { for: newBox(), against: newBox() };
      const b = addBox(newBox(), own.get(pid) || newBox());
      b.sec = o.for.sec;
      out.set(pid, {
        pid, name: p.name, num: p.num, side: s, teamId: g.teams[s].id, starter: p.starter,
        gp: o.for.sec > 0 ? 1 : 0, gs: p.starter ? 1 : 0,
        own: b, onF: addBox(newBox(), o.for), onA: addBox(newBox(), o.against),
        tmF: addBox(newBox(), team[s]), tmA: addBox(newBox(), team[1 - s]),
        wpa: (g.wpa && g.wpa.get(pid)) || 0
      });
    }
    return out;
  }
  function mergeRaw(acc, r) {
    const a = acc.get(r.pid);
    if (!a) { acc.set(r.pid, JSON.parse(JSON.stringify(r))); return; }
    a.num = r.num || a.num; a.gp += r.gp; a.gs += r.gs; a.wpa += r.wpa;
    for (const k of ['own', 'onF', 'onA', 'tmF', 'tmA']) addBox(a[k], r[k]);
  }
  function playerMetrics(r) {
    const b = r.own, tf = r.onF, ta = r.onA;
    const offF = newBox(), offA = newBox();
    addBox(offF, r.tmF); addBox(offA, r.tmA);
    for (const k in tf) { offF[k] -= tf[k]; offA[k] -= ta[k]; }
    const onNet = (tf.poss && ta.poss) ? 100 * tf.pts / tf.poss - 100 * ta.pts / ta.poss : null;
    const offNet = (offF.poss && offA.poss) ? 100 * offF.pts / offF.poss - 100 * offA.pts / offA.poss : null;
    return {
      pid: r.pid, name: r.name, num: r.num, side: r.side, teamId: r.teamId, starter: r.starter, gp: r.gp, gs: r.gs, box: b,
      min: tf.sec / 60, pm: tf.pts - ta.pts,
      ts: div(b.pts, 2 * (b.fga + 0.44 * b.fta)), efg: div(b.fgm + 0.5 * b.fg3m, b.fga),
      usg: div(b.fga + 0.44 * b.fta + b.tov, tf.fga + 0.44 * tf.fta + tf.tov),
      astp: div(b.ast, tf.fgm - b.fgm), tovp: div(b.tov, b.fga + 0.44 * b.fta + b.tov),
      orbp: div(b.orb, tf.orb + ta.drb), drbp: div(b.drb, tf.drb + ta.orb),
      stlp: div(b.stl, ta.poss), blkp: div(b.blk, ta.fg2a),
      onOrtg: div(100 * tf.pts, tf.poss), onDrtg: div(100 * ta.pts, ta.poss), onNet, offNet,
      onOff: (onNet != null && offNet != null) ? onNet - offNet : null,
      possOn: tf.poss, pir: pir(b), gmsc: gmsc(b), created: b.pts + b.ptsAst,
      astdp: div(b.astd, b.fgm), wpa: r.wpa
    };
  }
  function playerAdvanced(g, f) { return [...playerRaw(g, f).values()].map(playerMetrics); }

  // ---------- Probabilidad de victoria (modelo normal simple) ----------
  function erf(x) { const t = 1 / (1 + 0.3275911 * Math.abs(x)); const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x); return x >= 0 ? y : -y; }
  const Phi = x => 0.5 * (1 + erf(x / Math.SQRT2));
  function wpHome(margin, tRem, opts) {
    const sigma = (opts && opts.sigma) || 11.5, hca = (opts && opts.hca != null) ? opts.hca : 2.5;
    const frac = Math.max(tRem, 0) / 2400;
    if (frac <= 0.0005) return margin > 0 ? 1 : margin < 0 ? 0 : 0.5;
    const z = (margin + hca * frac) / (sigma * Math.sqrt(frac));
    return Phi(z);
  }
  function computeWP(g) {
    const total = t => { const lastQ = g.periods.length ? Math.max(...g.periods) : 4; return Math.max(lastQ <= 4 ? 2400 : 2400 + (lastQ - 4) * 300, 2400) - t; };
    const pts = [{ t: 0, wp: wpHome(0, 2400), m: 0 }];
    const wpa = new Map(); const swings = [];
    let prev = pts[0].wp;
    for (const e of g.events) {
      if (!e.d[0] && !e.d[1]) continue;
      const rem = e.q <= 4 ? 2400 - e.t : periodStart(e.q) + periodLen(e.q) - e.t;
      const m = e.sh - e.sa;
      const wp = wpHome(m, rem);
      const dlt = wp - prev;
      pts.push({ t: e.t, wp, m });
      const sd = e.d[0] ? 0 : 1;
      const signed = sd === 0 ? dlt : -dlt;
      if (e.pid) wpa.set(e.pid, (wpa.get(e.pid) || 0) + signed);
      swings.push({ e, side: sd, dwp: dlt, wp });
      prev = wp;
    }
    g.wp = pts; g.wpa = wpa;
    g.swings = swings.sort((a, b) => Math.abs(b.dwp) - Math.abs(a.dwp)).slice(0, 12);
  }

  // ---------- Parciales ----------
  function runs(g, thr) {
    thr = thr || 7;
    const sc = g.events.filter(e => e.d[0] > 0 || e.d[1] > 0);
    const out = []; let run = null; let lastScoreT = [0, 0];
    const close = (breaker) => {
      if (run && run.pts >= thr) {
        const tos = g.events.filter(e => (e.type === C.TIMEOUT) && e.t > run.t0 && e.t <= run.t1 + (breaker ? 0 : 0) && e.side === 1 - run.side);
        let afterTO = 0;
        if (tos.length) afterTO = run.list.filter(x => x.t > tos[0].t).reduce((a, x) => a + x.pts, 0);
        out.push(Object.assign({}, run, { breaker, timeouts: tos.map(x => x.clock + ' ' + x.q + 'C'), toT: tos.length ? tos[0].t : null, afterTO }));
      }
    };
    for (const e of sc) {
      const s = e.d[0] > 0 ? 0 : 1; const pts = e.d[s];
      if (run && run.side === s) { run.pts += pts; run.t1 = e.t; run.endScore = [e.sh, e.sa]; run.list.push({ t: e.t, pid: e.pid, pts }); }
      else {
        close(e);
        run = { side: s, pts, t0: lastScoreT[1 - s], t1: e.t, startScore: [e.preH, e.preA], endScore: [e.sh, e.sa], list: [{ t: e.t, pid: e.pid, pts }] };
      }
      lastScoreT[s] = e.t;
    }
    close(null);
    return out;
  }
  // Mejor tramo de N minutos (diferencial máximo) por equipo
  function bestStretch(g, windowSec) {
    windowSec = windowSec || 300;
    const sc = g.events.filter(e => e.d[0] || e.d[1]).map(e => ({ t: e.t, h: e.sh, a: e.sa }));
    sc.unshift({ t: 0, h: 0, a: 0 });
    const best = [null, null];
    for (let i = 0; i < sc.length; i++) {
      for (let j = i + 1; j < sc.length && sc[j].t - sc[i].t <= windowSec; j++) {
        const dh = sc[j].h - sc[i].h, da = sc[j].a - sc[i].a;
        const net = dh - da;
        if (!best[0] || net > best[0].net) best[0] = { net, t0: sc[i].t, t1: sc[j].t, f: dh, a: da };
        if (!best[1] || -net > best[1].net) best[1] = { net: -net, t0: sc[i].t, t1: sc[j].t, f: da, a: dh };
      }
    }
    return best;
  }

  // ---------- Tiempos muertos ----------
  function timeouts(g, n) {
    n = n || 4;
    const out = [];
    for (const e of g.events) {
      if (e.type !== C.TIMEOUT) continue;
      const s = e.side;
      const before = g.poss.filter(p => p.endT <= e.t);
      const afterP = g.poss.filter(p => p.startT >= e.t && p.endIdx > e.i);
      const pick = (arr, side, fromEnd) => { const f = arr.filter(p => p.side === side); return fromEnd ? f.slice(-n) : f.slice(0, n); };
      const sum = a => a.reduce((x, p) => x + p.pts, 0);
      const bO = pick(before, s, true), bD = pick(before, 1 - s, true), aO = pick(afterP, s, false), aD = pick(afterP, 1 - s, false);
      const win = (t0, t1) => { const ev = g.events.filter(x => x.t > t0 && x.t <= t1); let f = 0, a = 0; ev.forEach(x => { f += x.d[s]; a += x.d[1 - s]; }); return [f, a]; };
      out.push({
        e, side: s, q: e.q, clock: e.clock, score: [e.sh, e.sa],
        beforeO: [sum(bO), bO.length], beforeD: [sum(bD), bD.length], afterO: [sum(aO), aO.length], afterD: [sum(aD), aD.length],
        prev2: win(e.t - 120, e.t), next2: win(e.t, e.t + 120)
      });
    }
    return out;
  }

  // ---------- Posesiones por tipo de inicio ----------
  const START_LABEL = { tras_canasta: 'Tras canasta rival', rebote_def: 'Tras rebote defensivo', robo: 'Tras robo',
    perdida: 'Tras pérdida (balón muerto)', inicio: 'Inicio de periodo', otro: 'Otras' };
  function possessionProfile(P) {
    const by = {};
    for (const p of P) {
      const k = p.start; by[k] = by[k] || { n: 0, pts: 0, fast: 0, fastPts: 0 };
      by[k].n++; by[k].pts += p.pts;
      if (p.firstAct - p.startT <= 8 && (k === 'robo' || k === 'rebote_def')) { by[k].fast++; by[k].fastPts += p.pts; }
    }
    const tot = P.length, pts = P.reduce((a, p) => a + p.pts, 0);
    const second = P.reduce((a, p) => a + p.ptsOrb, 0);
    const withOrb = P.filter(p => p.orb > 0).length;
    const offTO = P.filter(p => p.start === 'robo' || p.start === 'perdida').reduce((a, p) => a + p.pts, 0);
    const fast = P.filter(p => p.firstAct - p.startT <= 8 && (p.start === 'robo' || p.start === 'rebote_def'));
    const durations = P.map(p => Math.max(0, p.endT - p.startT));
    const hist = [0, 0, 0, 0, 0]; // 0-8, 9-14, 15-20, 21-24, >24
    durations.forEach(d => { hist[d <= 8 ? 0 : d <= 14 ? 1 : d <= 20 ? 2 : d <= 24 ? 3 : 4]++; });
    const endBy = {}; P.forEach(p => { endBy[p.end] = (endBy[p.end] || 0) + 1; });
    return { tot, pts, by, second, withOrb, offTO, fastN: fast.length, fastPts: fast.reduce((a, p) => a + p.pts, 0),
      avgDur: durations.length ? durations.reduce((a, b) => a + b, 0) / durations.length : null, hist, endBy };
  }

  // ---------- Validación contra la estadística oficial ----------
  function validate(g) {
    const own = playerBoxes(g);
    const adv = new Map(playerAdvanced(g).map(p => [p.pid, p]));
    const map = { points: 'pts', twoPointersMade: 'fg2m', twoPointersAttempted: 'fg2a', threePointersMade: 'fg3m', threePointersAttempted: 'fg3a',
      freeThrowsMade: 'ftm', freeThrowsAttempted: 'fta', offRebounds: 'orb', defRebounds: 'drb', assists: 'ast', steals: 'stl',
      turnovers: 'tov', blocks: 'blk', personalFouls: 'pf', foulsDrawn: 'fd' };
    let ok = 0, n = 0; const diffs = []; let minOk = 0, minN = 0, pmOk = 0, pmN = 0;
    for (const [pid, p] of g.players) {
      if (!p.last) continue; n++;
      const b = own.get(pid) || newBox(); let good = true;
      for (const k in map) { if (p.last[k] == null) continue; if (p.last[k] !== (b[map[k]] || 0)) { good = false; diffs.push(p.name + ': ' + k + ' oficial ' + p.last[k] + ' / calculado ' + (b[map[k]] || 0)); } }
      if (good) ok++;
      const a = adv.get(pid);
      if (p.last.secondsPlayed != null && a) { minN++; if (Math.abs(p.last.secondsPlayed - a.min * 60) <= 2) minOk++; else diffs.push(p.name + ': segundos oficial ' + p.last.secondsPlayed + ' / calculado ' + Math.round(a.min * 60)); }
      if (p.last.plusMinus != null && a) { pmN++; if (p.last.plusMinus === a.pm) pmOk++; else diffs.push(p.name + ': +/- oficial ' + p.last.plusMinus + ' / calculado ' + a.pm); }
    }
    const tb = teamBoxes(g);
    const ptsOk = tb[0].pts === g.final[0] && tb[1].pts === g.final[1];
    return { ok, n, diffs, ptsOk, minOk, minN, pmOk, pmN };
  }

  // ---------- Multi-partido (scouting) ----------
  // Reorienta un partido a la perspectiva del equipo teamId: side 0 = nosotros
  function sideOf(g, teamId) { return g.teams[0].id === teamId ? 0 : g.teams[1].id === teamId ? 1 : -1; }

  root.ACB = {
    C, LABEL, TOV_TAG, START_LABEL, label, parseGame, teamBoxes, playerBoxes, lineupTallies, combos,
    teamMetrics, playerAdvanced, playerRaw, mergeRaw, playerMetrics, runs, bestStretch, timeouts, possessionProfile, validate, wpHome,
    newBox, addBox, pir, gmsc, sideOf, elapsed, periodStart, periodLen, isPF: t => PF.has(t)
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
