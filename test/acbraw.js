// Reconstruye la respuesta de la API de la ACB (play-by-play) a partir del partido de prueba m105375.json.
// limit: número de jugadas (para simular un partido en directo); sin limit, el partido completo con su acta.
const fx = require('./m105375.json');
const keys = ['points', 'twoPointersMade', 'twoPointersAttempted', 'threePointersMade', 'threePointersAttempted', 'freeThrowsMade', 'freeThrowsAttempted', 'offRebounds', 'defRebounds', 'assists', 'steals', 'turnovers', 'blocks', 'personalFouls', 'foulsDrawn'];
function acbRaw(limit) {
  const rows = limit ? fx.rows.slice(0, limit) : fx.rows, lastIdx = {};
  rows.forEach((r, i) => { if (r[9]) lastIdx[r[9]] = i; });
  const plays = rows.map((r, i) => {
    const [order, playType, playTag, quarter, minute, second, local, sh, sa, pid] = r;
    const nm = pid ? fx.names[pid].split('|') : [null, null];
    const p = { order, playType, playTag, quarter, minute, second, local: !!local, scoreHome: sh, scoreAway: sa, playerLicenseId: pid || null, playerName: nm[0], playerNumber: playType === 599 ? null : (nm[1] || null), playerImage: null, playerStats: null };
    if (!limit && pid && lastIdx[pid] === i) p.playerStats = Object.fromEntries(keys.map((k, j) => [k, fx.val[pid][j]]));
    return p;
  });
  return { homeTeam: { id: 4475, fullName: 'Surne Bilbao', shortName: 'Surne Bilbao', abbreviatedName: fx.h }, awayTeam: { id: 4471, fullName: 'Kids&Us Manresa', shortName: 'Kids&Us Manresa', abbreviatedName: fx.a }, plays, matchFinished: !limit };
}
module.exports = { acbRaw, fx, total: fx.rows.length };
