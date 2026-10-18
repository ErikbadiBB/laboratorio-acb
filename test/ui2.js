const { JSDOM } = require('jsdom');
const fs = require('fs');
const html = fs.readFileSync(__dirname + '/../site/index.html', 'utf8');
const fx = require('./bcl136295.json');
const errors = [];
const boxObjs = fx.box.map(b => ({ player: { playerId: b[0] }, team: { organisationId: b[1] }, isStarter: !!b[2], playDurationInSeconds: b[3], points: b[4], twoPointsMade: b[5], twoPointsAttempted: b[6], threePointsMade: b[7], threePointsAttempted: b[8], freeThrowsMade: b[9], freeThrowsAttempted: b[10], offensiveRebounds: b[11], defensiveRebounds: b[12], assists: b[13], steals: b[14], turnovers: b[15], blockedShots: b[16], personalFouls: b[17], plusMinus: b[18] }));
boxObjs.push({ player: null, team: { organisationId: 8579 } });
let calls = { proxy: 0 };
const resp = (o, st = 200) => Promise.resolve({ ok: st < 400, status: st, json: async () => o, text: async () => JSON.stringify(o) });
const dom = new JSDOM(html, {
  url: 'https://erikbadibb.github.io/laboratorio-acb/#bcl-136295', runScripts: 'dangerously', pretendToBeVisual: true,
  beforeParse(w) {
    w.fetch = (u) => {
      u = String(u);
      if (u.includes('/api/bcl?id=136295')) { calls.proxy++; const { box, ...rest } = fx; return resp(Object.assign({}, rest, { finished: true })); }
      if (u.includes('getgdapgamestatisticsbygameid')) return resp(boxObjs);
      if (u.includes('getgdapgamesbycompetitionid')) return resp([{ gameId: 136295, teamA: { teamId: 284940, code: 'IGO', shortName: 'Igokea m:tel' }, teamB: { teamId: 284920, code: 'SBB', shortName: 'Surne Bilbao' }, teamAScore: 79, teamBScore: 92, liveGameStatus: 999, isLive: false, gameDateTimeUTC: '2026-10-06T18:00:00', round: { roundName: 'Regular Season' }, groupPairingCode: 'G' }]);
      return Promise.reject(new TypeError('Failed to fetch'));
    };
    w.addEventListener('error', e => errors.push(e.message));
    Object.defineProperty(w.HTMLElement.prototype, 'clientWidth', { get() { return 800; } });
  }
});
const w = dom.window; w.console.error = (...a) => errors.push(a.join(' '));
const wait = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  await wait(800);
  const d = w.document;
  console.log('status:', d.querySelector('#st-match').textContent);
  console.log('board:', d.querySelector('.boardfoot').textContent.replace(/\s+/g, ' '));
  for (const t of [...d.querySelectorAll('[data-tab]')].map(b => b.dataset.tab)) {
    d.querySelector(`[data-tab="${t}"]`).click(); await wait(30);
    const v = d.querySelector('#view');
    console.log(t.padEnd(11), 'tables', v.querySelectorAll('table').length, 'svgs', v.querySelectorAll('svg').length, 'empty', [...v.querySelectorAll('.empty')].map(e => e.textContent.slice(0, 50)).join('|'));
  }
  // Tiro: shots drawn
  d.querySelector('[data-tab="tiro"]').click(); await wait(30);
  console.log('shot marks', d.querySelectorAll('#view svg [data-tip]').length, 'zones table rows', d.querySelectorAll('#view table tbody tr').length);
  d.querySelector('[data-shotq="1"]').click(); await wait(20); console.log('Q1 shot marks', d.querySelectorAll('#view svg [data-tip]').length);
  // Entrenador
  d.querySelector('[data-tab="entrenador"]').click(); await wait(30);
  const sec = () => [...d.querySelectorAll('#view section.panel h2')].map(h => h.textContent.trim()).join(' | ');
  console.log('coach sections:', sec());
  d.querySelector('[data-cfocus="all"]').click(); await wait(20); console.log('coach all:', d.querySelectorAll('#view section.panel').length, 'panels');
  d.querySelector('[data-cedit]').click(); await wait(20);
  const cb = d.querySelector('[data-cblock="mapa"]'); cb.checked = true; cb.dispatchEvent(new w.Event('change', { bubbles: true })); await wait(20);
  d.querySelector('[data-cmove="mapa|-1"]').click(); await wait(20);
  console.log('cfg', JSON.stringify(JSON.parse(w.localStorage.getItem('lab-acb:coach')).blocks));
  const cb2 = d.querySelector('[data-cblock="ultimas"]'); cb2.checked = false; cb2.dispatchEvent(new w.Event('change', { bubbles: true })); await wait(20);
  d.querySelector('[data-cwidth="marcador"]').click(); await wait(20);
  console.log('cfg2', w.localStorage.getItem('lab-acb:coach'));
  // en pista content
  d.querySelector('[data-cfocus="mine"]').click(); await wait(20);
  console.log('pista:', [...d.querySelectorAll('#view section.panel')].find(s => /En pista/.test(s.textContent)).textContent.replace(/\s+/g, ' ').slice(0, 300));
  // Switch competition to ACB and load sample-free -> ACB fetch fails
  console.log('compet pressed', [...d.querySelectorAll('[data-compet]')].map(b => b.dataset.compet + ':' + b.getAttribute('aria-pressed')).join(' '));
  console.log('picker', d.querySelector('#pk-title').textContent, '|', d.querySelector('#st-match').textContent, '|', d.querySelector('#pk-round').textContent, '| cards', d.querySelectorAll('.pk-card').length, 'on', d.querySelectorAll('.pk-card.on').length, '| open', d.querySelector('#loader-match').classList.contains('open'));
  d.querySelector('#b-pick').click(); await wait(20); console.log('after toggle open', d.querySelector('#loader-match').classList.contains('open'), d.querySelector('#b-pick').textContent, d.querySelectorAll('.pk-card.on').length);
  // scout BCL
  d.querySelector('#m-scout').click(); await wait(20);
  console.log('teams', [...d.querySelector('#sel-team').options].map(o => o.text + (o.selected ? '*' : '')).join(', '));
  d.querySelector('#b-scout').click(); await wait(400);
  console.log('scout:', d.querySelector('#st-scout').textContent, '| kv:', (d.querySelector('#view .kv') || {}).textContent?.replace(/\s+/g, ' ').slice(0, 160));
  console.log('ERRORS', errors);
  process.exit(0);
})();
