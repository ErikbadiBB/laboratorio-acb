// Equipo favorito: al entrar sin #partido se abre el suyo (directo, inminente o el último) y se avisa del próximo
const { JSDOM } = require('jsdom');
const { check, done } = require('./check');
const fs = require('fs');
const html = fs.readFileSync(__dirname + '/../site/index.html', 'utf8');
const fx = require('./bcl136295.json');
const day = 864e5, iso = t => new Date(t).toISOString().slice(0, 19);
const T = (id, code, name) => ({ teamId: id, code, shortName: name });
const IGO = T(284940, 'IGO', 'Igokea m:tel'), SBB = T(284920, 'SBB', 'Surne Bilbao'), OTR = T(1, 'OTR', 'Otro equipo');
const games = (live) => [
  { gameId: 136295, teamA: IGO, teamB: SBB, teamAScore: 79, teamBScore: 92, liveGameStatus: 999, isLive: false, gameDateTimeUTC: iso(Date.now() - 5 * day), round: { roundName: 'RS' } },
  { gameId: 136300, teamA: SBB, teamB: OTR, teamAScore: 0, teamBScore: 0, liveGameStatus: live ? 1 : 0, isLive: !!live, gameDateTimeUTC: iso(Date.now() + (live ? -0.02 : 2) * day), round: { roundName: 'RS' } },
  { gameId: 136301, teamA: IGO, teamB: OTR, teamAScore: 70, teamBScore: 60, liveGameStatus: 999, isLive: false, gameDateTimeUTC: iso(Date.now() - 1 * day), round: { roundName: 'RS' } }
];
const resp = o => Promise.resolve({ ok: true, status: 200, json: async () => o });
const open = (live) => new Promise(res => {
  const asked = [];
  const dom = new JSDOM(html, { url: 'https://erikbadibb.github.io/laboratorio-acb/', runScripts: 'dangerously', pretendToBeVisual: true,
    beforeParse(w) {
      w.localStorage.setItem('lab-acb:compet', JSON.stringify('bcl'));
      w.localStorage.setItem('lab-acb:fav-bcl', JSON.stringify({ id: 284920, abbr: 'SBB', name: 'Surne Bilbao' }));
      w.fetch = u => { u = String(u);
        if (u.includes('/api/bcl?id=')) { const id = +u.match(/id=(\d+)/)[1]; asked.push(id); const { box, ...rest } = fx; return resp(Object.assign({}, rest, { finished: id === 136295, game: Object.assign({}, fx.game, { id, isLive: id !== 136295 }) })); }
        if (u.includes('getgdapgamesbycompetitionid')) return resp(games(live));
        if (u.includes('statisticsbygameid')) return resp([]);
        return Promise.reject(new TypeError('Failed to fetch')); };
      Object.defineProperty(w.HTMLElement.prototype, 'clientWidth', { get() { return 800; } });
    } });
  const w = dom.window, errs = []; w.addEventListener('error', e => errs.push(e.message));
  setTimeout(() => res({ w, d: w.document, asked, errs }), 900);
});
(async () => {
  let { w, d, asked, errs } = await open(false);
  const st = d.querySelector('#st-match').textContent;
  console.log('sin directo -> abre', asked[0], '|', st, '| botón', d.querySelector('#b-favgo').textContent.trim(), '| tarjetas con ★', [...d.querySelectorAll('.pk-card')].filter(c => /★/.test(c.textContent)).length, '| favorito en selector', d.querySelector('#sel-fav').selectedOptions[0].textContent);
  check(asked[0] === 136295 && /Próximo de SBB/.test(st), 'favorito: debe abrir el último partido y avisar del próximo');
  check(!d.querySelector('#b-favgo').hidden && !errs.length, 'favorito: botón rápido o errores');
  // Entrenador «Mi equipo» = favorito
  d.querySelector('[data-tab="entrenador"]').click(); await new Promise(r => setTimeout(r, 30));
  const coach = [...d.querySelectorAll('#view section.panel h2')].map(h => h.textContent).join(' | ');
  check(/SBB En pista/.test(coach) && !/IGO En pista/.test(coach), 'favorito: «Mi equipo» del Entrenador');
  // Quitar el favorito
  const sel = d.querySelector('#sel-fav'); sel.value = ''; sel.dispatchEvent(new w.Event('change', { bubbles: true }));
  check(d.querySelector('#b-favgo').hidden && w.localStorage.getItem('lab-acb:fav-bcl') === 'null', 'favorito: no se puede quitar');
  w.close();
  ({ w, d, asked, errs } = await open(true));
  console.log('con directo -> abre', asked[0], '|', d.querySelector('#st-match').textContent);
  check(asked[0] === 136300, 'favorito: con partido en directo debe abrir ese');
  w.close();
  done('equipo favorito');
})();
