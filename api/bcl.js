// Puente para la Basketball Champions League (Vercel Edge Function)
// GET /api/bcl?id=136295  → jugada a jugada compacto de un partido, con CORS abierto.
// GET /api/bcl?token=1     → credencial temporal del canal en directo (WebPubSub) de la BCL.
export const config = { runtime: 'edge' };

const SITE = 'https://www.championsleague.basketball';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36';
const HAPI = 'https://digital-api.fiba.basketball/hapi/';
const HAPI_KEY = '898cd5e7389140028ecb42943c47eb74';

// Fuente principal: el mismo JSON que usa la web de la BCL en directo
async function fromLive(id) {
  const [r, meta] = await Promise.all([
    fetch(`${SITE}/en/events/api/game-live-info/${id}/detail`, { headers: { 'User-Agent': UA, 'Accept': 'application/json', 'Referer': `${SITE}/en/games/${id}` }, cache: 'no-store' }),
    fetch(`${HAPI}getgdapgamebyid?gdapGameId=${id}`, { headers: { 'Ocp-Apim-Subscription-Key': HAPI_KEY }, cache: 'no-store' }).then(x => x.ok ? x.json() : null).catch(() => null)
  ]);
  if (!r.ok) throw new Error('La web de la BCL respondió ' + r.status);
  const j = await r.json();
  const c = j.game && j.game.content, pa = j.periodActions && j.periodActions.content, comp = j.gameCompetitors && j.gameCompetitors.content;
  if (!c || !pa || !pa.items || !Object.keys(pa.items).length || !meta) return null;
  const o = {
    game: { gameId: id, teamA: meta.teamA, teamB: meta.teamB, teamAScore: meta.teamAScore, teamBScore: meta.teamBScore, isLive: !!meta.isLive, currentPeriod: c.CurrentPeriod || meta.currentPeriod, chrono: c.RC || meta.chrono, liveGameStatus: meta.liveGameStatus, competition: { competitionId: 209123 }, round: { roundName: meta.roundName }, gameDateTimeUTC: meta.gameDateTimeUTC },
    teamColors: { teamA: c.c && c.c[0] && c.c[0].Color, teamB: c.c && c.c[1] && c.c[1].Color },
    playersTeamA: (comp && comp.playersTeamA) || [], playersTeamB: (comp && comp.playersTeamB) || [],
    playByPlay: { items: pa.items }
  };
  const d = compact(o);
  const last = d.rows[d.rows.length - 1];
  if (last) { d.game.sa = last[3]; d.game.sb = last[4]; }
  d.game.liveStatus = c.status; d.game.periodStatus = c.CurrentPeriodStatus;
  return d;
}

// Extrae el estado del partido del HTML (payload RSC de Next.js)
export function extract(html) {
  const re = /self\.__next_f\.push\(\[1,"((?:\\.|[^"\\])*)"\]\)/g;
  let m, s = '';
  while ((m = re.exec(html))) { try { s += JSON.parse('"' + m[1] + '"'); } catch (e) { /* trozo ilegible */ } }
  const line = s.split('\n').find(l => l.includes('"playByPlay":{"items"'));
  if (!line) return null;
  const root = JSON.parse(line.slice(line.indexOf(':') + 1));
  let o = null;
  const walk = x => { if (o || !x || typeof x !== 'object') return; if (x.playByPlay && x.game) { o = x; return; } for (const k in x) walk(x[k]); };
  walk(root);
  if (!o) return null;
  return compact(o);
}

const und = v => (v === '$undefined' || v === undefined ? null : v);
function compact(o) {
  const g = o.game;
  const players = [
    ...(o.playersTeamA || []).map(p => [p.personId, 'A', p.uniformNumber, p.firstName + ' ' + p.lastName]),
    ...(o.playersTeamB || []).map(p => [p.personId, 'B', p.uniformNumber, p.firstName + ' ' + p.lastName])
  ];
  const rows = [];
  const items = (o.playByPlay && o.playByPlay.items) || {};
  for (const q of Object.keys(items)) for (const i of items[q].items || []) {
    rows.push([i.order, q, i.Time, i.SA, i.SB, i.ac, i.txt, und(i.oId) || 0, und(i.pId) || 0,
      i.made === undefined ? null : (i.made ? 1 : 0), und(i.x), und(i.y), i.in === undefined ? null : (i.in ? 1 : 0), und(i.p2Id)]);
  }
  rows.sort((a, b) => a[0] - b[0]);
  return {
    game: {
      id: g.gameId, A: g.teamA, B: g.teamB, sa: g.teamAScore, sb: g.teamBScore, isLive: !!g.isLive,
      period: g.currentPeriod, chrono: g.chrono, status: g.liveGameStatus, comp: g.competition && g.competition.competitionId,
      round: g.round && g.round.roundName, date: g.gameDateTimeUTC
    },
    colors: o.teamColors || null, players, rows,
    finished: rows.some(r => r[5] === 'ENDG') || g.liveGameStatus === 999
  };
}

export default async function handler(req) {
  const url = new URL(req.url);
  const id = (url.searchParams.get('id') || '').replace(/\D/g, '');
  const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, OPTIONS' };
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
  if (url.searchParams.get('token')) {
    try {
      const t = await fetch(`${SITE}/en/events/api/websocket-token`, { headers: { 'User-Agent': UA, 'Accept': 'application/json' }, cache: 'no-store' });
      const j = await t.json();
      return new Response(JSON.stringify({ url: j.url }), { headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'public, s-maxage=600' } });
    } catch (e) { return new Response(JSON.stringify({ error: String(e.message || e) }), { status: 502, headers: { ...cors, 'Content-Type': 'application/json' } }); }
  }
  if (!id) return new Response(JSON.stringify({ error: 'Falta el parámetro id' }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } });
  try {
    let data = await fromLive(id).catch(() => null);
    if (!data) {
      const r = await fetch(`${SITE}/en/games/${id}?t=${Date.now() >> 10}`, { headers: { 'User-Agent': UA, 'Accept': 'text/html' }, cache: 'no-store' });
      if (!r.ok) throw new Error('La web de la BCL respondió ' + r.status);
      data = extract(await r.text());
    }
    if (!data) return new Response(JSON.stringify({ error: 'El partido todavía no tiene jugadas publicadas', id }), { status: 404, headers: { ...cors, 'Content-Type': 'application/json' } });
    const live = data.game.isLive && !data.finished;
    return new Response(JSON.stringify(data), {
      headers: { ...cors, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': live ? 'public, s-maxage=1, stale-while-revalidate=2' : 'public, s-maxage=300, stale-while-revalidate=600' }
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e.message || e) }), { status: 502, headers: { ...cors, 'Content-Type': 'application/json' } });
  }
}
