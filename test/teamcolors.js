// Colores de los equipos: se usan los de la fuente, se ajustan al fondo del estilo y no se confunden entre sí
const launch = require('./browser');
const fx = require('./bcl136295.json');
const CASES = [
  ['BCL real (rojo / morado)', null, ''],
  ['mismo color los dos', { teamA: '#ed3237', teamB: '#ee3338' }, ''],
  ['local blanco', { teamA: '#ffffff', teamB: '#5719d9' }, ''],
  ['visitante negro, estilo Noche', { teamA: '#ed3237', teamB: '#000000' }, 'noche'],
  ['amarillo en Parqué', { teamA: '#ffd400', teamB: '#1f5f6e' }, 'parque'],
  ['sin colores en la fuente', { teamA: null, teamB: null }, 'negro'],
  ['interruptor apagado', null, '', false]
];
(async () => {
  const b = await launch(); let bad = 0;
  for (const [name, colors, skin, on] of CASES) {
    const p = await b.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.route('**/*', r => { const u = r.request().url(); const H = { 'access-control-allow-origin': '*' };
      if (u.includes('/api/bcl')) { const { box, ...rest } = fx; return r.fulfill({ json: Object.assign(rest, { finished: true }, colors ? { colors } : {}), headers: H }); }
      if (u.includes('getgdap')) return r.fulfill({ json: [], headers: H });
      if (u.startsWith('file:')) return r.continue(); return r.abort(); });
    await p.addInitScript(([skin, on]) => { localStorage.setItem('lab-acb:skin', JSON.stringify(skin)); if (on === false) localStorage.setItem('lab-acb:teamcolors', 'false'); }, [skin, on]);
    await p.goto('file://' + __dirname + '/../site/index.html#bcl-136295'); await p.waitForSelector('#view .board'); await p.click('[data-tab="jugadores"]'); await p.waitForTimeout(300);
    const r = await p.evaluate(() => {
      const v = document.querySelector('#view'), cs = getComputedStyle(v);
      const rgb = s => s.match(/[\d.]+/g).slice(0, 3).map(Number);
      const lin = x => { x /= 255; return x <= .04045 ? x / 12.92 : ((x + .055) / 1.055) ** 2.4; };
      const L = c => .2126 * lin(c[0]) + .7152 * lin(c[1]) + .0722 * lin(c[2]);
      const C = (a, b) => (Math.max(L(a), L(b)) + .05) / (Math.min(L(a), L(b)) + .05);
      const panel = rgb(getComputedStyle(v.querySelector('.panel')).backgroundColor), bgc = rgb(getComputedStyle(document.body).backgroundColor);
      const sa = (getComputedStyle(v.querySelector('.panel')).backgroundColor.match(/[\d.]+/g)[3]); const a = sa == null ? 1 : +sa;
      const surf = panel.map((x, i) => x * a + bgc[i] * (1 - a));
      const home = cs.getPropertyValue('--home').trim(), away = cs.getPropertyValue('--away').trim();
      const nm = [...v.querySelectorAll('.team .nm')].map(e => rgb(getComputedStyle(e).color));
      const tag = rgb(getComputedStyle(v.querySelector('.tm.t1') || v.querySelector('.tm')).color), tagBg = rgb(getComputedStyle(v.querySelector('.tm.t1') || v.querySelector('.tm')).backgroundColor);
      return { home, away, tc: v.classList.contains('tc'), cHome: C(rgb(getComputedStyle(v.querySelector('.sw.t0')).backgroundColor), surf), cAway: C(rgb(getComputedStyle(v.querySelector('.sw.t1')).backgroundColor), surf), cTag: C(tag, tagBg), nm0: nm[0].join(','), nm1: nm[1].join(',') };
    });
    const ok = r.cHome >= 3 && r.cAway >= 3 && r.cTag >= 4 && !errs.length;
    if (!ok) bad++;
    console.log(name.padEnd(30), r.tc ? `local ${r.home} · visitante ${r.away}` : 'colores del estilo', `| contraste ${r.cHome.toFixed(1)} / ${r.cAway.toFixed(1)} · siglas ${r.cTag.toFixed(1)}`, ok ? '' : '  <<< REVISAR', errs.join(' '));
    await p.close();
  }
  console.log('CASOS CON PROBLEMAS', bad);
  await b.close();
})();
