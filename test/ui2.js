const { JSDOM } = require('jsdom');
const { check, done } = require('./check');
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
  const boardTxt = d.querySelector('.boardfoot').textContent; console.log('board:', boardTxt.replace(/\s+/g, ' '));
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
  const cfg = () => JSON.parse(w.localStorage.getItem('lab-acb:coach'));
  const blocks = () => { const c = cfg(); return c.panels[c.cur].blocks; };
  console.log('paneles:', [...d.querySelectorAll('[data-cpanel]')].map(b => b.textContent).join(' / '));
  d.querySelector('[data-cedit]').click(); await wait(20);
  console.log('edición: barras', d.querySelectorAll('.cb-bar').length, '| galería', d.querySelectorAll('[data-cadd]').length, 'bloques para añadir');
  d.querySelector('[data-cadd="mapa"]').click(); await wait(20);
  d.querySelector('[data-cmove="mapa|-1"]').click(); await wait(20);
  console.log('añadir + subir mapa:', JSON.stringify(blocks())); check(blocks().indexOf('mapa') === blocks().length - 2, 'Entrenador: añadir y subir un bloque');
  d.querySelector('[data-cremove="ultimas"]').click(); await wait(20);
  d.querySelector('[data-cwidth="marcador|third"]').click(); await wait(20);
  console.log('quitar últimas + marcador a 1/3:', JSON.stringify(blocks()), JSON.stringify(cfg().panels[cfg().cur].w), '| clase', d.querySelector('[data-block="marcador"]').className);
  d.querySelector('[data-cundo]').click(); await wait(20);
  console.log('deshacer -> ancho marcador', JSON.stringify(cfg().panels[cfg().cur].w)); check(!cfg().panels[cfg().cur].w.marcador, 'Entrenador: deshacer');
  d.querySelector('[data-cnew]').click(); await wait(20);
  const nm = d.querySelector('#in-cpname'); nm.value = 'Mi tablet'; nm.dispatchEvent(new w.Event('change', { bubbles: true })); await wait(20);
  d.querySelector('[data-cpreset="descanso"]').click(); await wait(20);
  d.querySelector('[data-cadd="notas"]').click(); await wait(20);
  console.log('panel nuevo:', cfg().panels.map(p => p.name).join(' / '), '| actual', cfg().panels[cfg().cur].name, JSON.stringify(blocks()));
  const ta = d.querySelector('[data-notes]'); ta.value = 'Cambiar a zona tras TM'; ta.dispatchEvent(new w.Event('input', { bubbles: true }));
  console.log('notas guardadas:', w.localStorage.getItem(ta.dataset.notes.replace(/^/, 'lab-acb:')));
  d.querySelector('[data-ccompact]').click(); await wait(20);
  console.log('compacto:', d.querySelector('.coach-grid').classList.contains('compact'), '| bloques nuevos:', [...d.querySelectorAll('#view section.panel h2')].map(h => h.textContent.trim()).filter(t => /Líderes|Últimos 5|Notas|Por tramos/.test(t)).join(' | '));
  d.querySelector('[data-cdel]').click(); await wait(20);
  d.querySelector('[data-cedit]').click(); await wait(20);
  console.log('tras borrar:', cfg().panels.map(p => p.name).join(' / '), '| edición cerrada', !d.querySelector('.cb-bar'));
  // Código antiguo (un panel) se importa como panel nuevo
  d.querySelector('[data-cedit]').click(); await wait(20);
  d.querySelector('#in-ccode').value = w.btoa(JSON.stringify({ blocks: ['claves', 'wp'], focus: 'all', mine: 'SBB' }));
  d.querySelector('[data-cpaste]').click(); await wait(20);
  check(cfg().panels.some(p => p.name === 'Importado'), 'Entrenador: importar código antiguo');
  console.log('importar código antiguo:', cfg().panels.map(p => p.name).join(' / '), JSON.stringify(blocks()));
  d.querySelector('[data-cedit]').click(); await wait(20);
  // Teclado: flecha derecha en la pestaña activa pasa a la siguiente
  d.querySelector('[role="tab"][aria-selected="true"]').dispatchEvent(new w.KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })); await wait(20);
  console.log('teclado -> pestaña', d.querySelector('[role="tab"][aria-selected="true"]').dataset.tab, '| foco en', d.activeElement.dataset.tab, '| tabindex', [...d.querySelectorAll('[role="tab"]')].filter(t => t.tabIndex === 0).length);
  check(d.activeElement.dataset.tab === 'resumen', 'teclado: las flechas no cambian de pestaña');
  d.querySelector('[data-tab="entrenador"]').click(); await wait(20);
  d.querySelector('[data-cpanel="0"]').click(); await wait(20);
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
  const informe = [...d.querySelectorAll('#view .ins li')].map(l => l.textContent);
  console.log('scout:', d.querySelector('#st-scout').textContent, '| informe:', informe.length, 'claves ·', d.querySelectorAll('#view [data-sort^="sik|"]').length, 'columnas de jugadores clave');
  check(informe.length >= 6 && d.querySelector('[data-print]'), 'scouting: el informe del rival está incompleto');
  d.querySelector('[data-stab="evolucion"]').click(); await wait(40);
  d.querySelector('[data-evostat="pm"]').click(); await wait(40);
  console.log('evolución:', d.querySelectorAll('#view .chart svg').length, 'gráficas ·', d.querySelectorAll('#view .chart circle[data-tip]').length, 'puntos');
  check(d.querySelectorAll('#view .chart svg').length === 2 && d.querySelectorAll('#view .chart circle[data-tip]').length === 2, 'scouting: la evolución no dibuja las dos gráficas');
  console.log('ERRORS', errors);
  check(!errors.length, 'interfaz BCL: errores de JavaScript');
  check(/✓ Cuadre/.test(boardTxt), 'interfaz BCL: el partido no cuadra con el acta');
  check(/Surne Bilbao \(BCL\): 1 partido/.test(d.querySelector('#st-scout').textContent), 'scouting: no se cargó el partido');
  done('interfaz BCL, Entrenador y scouting');
})();
