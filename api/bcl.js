// Puente para la Basketball Champions League (Vercel Edge Function)
// GET /api/bcl?id=136295  → jugada a jugada compacto de un partido, con CORS abierto.
export const config = { runtime: 'edge' };

const SITE = 'https://www.championsleague.basketball';
const UA = 'Mozilla/5.0 (compatible; LaboratorioACB/1.0)';

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
  if (!id) return new Response(JSON.stringify({ error: 'Falta el parámetro id' }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } });
  try {
    const r = await fetch(`${SITE}/en/games/${id}?t=${Date.now() >> 10}`, { headers: { 'User-Agent': UA, 'Accept': 'text/html' }, cache: 'no-store' });
    if (!r.ok) throw new Error('La web de la BCL respondió ' + r.status);
    const data = extract(await r.text());
    if (!data) return new Response(JSON.stringify({ error: 'El partido todavía no tiene jugadas publicadas', id }), { status: 404, headers: { ...cors, 'Content-Type': 'application/json' } });
    const live = data.game.isLive && !data.finished;
    return new Response(JSON.stringify(data), {
      headers: { ...cors, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': live ? 'public, s-maxage=1, stale-while-revalidate=2' : 'public, s-maxage=300, stale-while-revalidate=600' }
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e.message || e) }), { status: 502, headers: { ...cors, 'Content-Type': 'application/json' } });
  }
}
