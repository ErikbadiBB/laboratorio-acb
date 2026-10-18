// Contraste de los colores de texto en cada estilo (WCAG: 4,5 texto normal; 3 para texto grande o negrita ≥ 14pt)
const launch = require('./browser');
const SKINS = ['', 'noche', 'scouting', 'tv', 'parque', 'negro'];
const PAIRS = [ // [texto, fondo, mínimo, dónde]
  ['--ink-3', '--surface', 4.5, 'etiquetas y notas'], ['--ink-3', '--bg', 4.5, 'pestañas sin elegir'], ['--ink-3', '--surface-2', 4.5, 'texto tenue en filas/tarjetas'],
  ['--ink-2', '--surface-2', 4.5, 'cabeceras de tabla'], ['--accent', '--surface', 4.5, 'enlaces (Copiar…)'],
  ['--good', '--surface', 4.5, 'valores positivos'], ['--bad', '--surface', 4.5, 'valores negativos'], ['--warn', '--surface', 4.5, 'avisos'],
  ['--accent-ink', '--accent', 4.5, 'botones'], ['--home-ink', '--home', 4.5, 'siglas local'], ['--away-ink', '--away', 4.5, 'siglas visitante']
];
(async () => {
  const b = await launch(); let bad = 0;
  for (const scheme of ['light', 'dark']) for (const sk of SKINS) {
    if (scheme === 'dark' && sk) continue; // los estilos con nombre no dependen del modo del sistema
    const p = await b.newPage({ colorScheme: scheme });
    await p.goto('file://' + __dirname + '/../site/index.html'); await p.waitForTimeout(150);
    const res = await p.evaluate(([sk, PAIRS]) => {
      if (sk) document.documentElement.setAttribute('data-skin', sk);
      const cs = getComputedStyle(document.documentElement);
      const el = document.createElement('i'); document.body.appendChild(el);
      const rgba = v => { el.style.color = ''; el.style.color = v; const m = getComputedStyle(el).color.match(/[\d.]+/g).map(Number); return { r: m[0], g: m[1], b: m[2], a: m[3] == null ? 1 : m[3] }; };
      const over = (c, base) => ({ r: c.r * c.a + base.r * (1 - c.a), g: c.g * c.a + base.g * (1 - c.a), b: c.b * c.a + base.b * (1 - c.a), a: 1 });
      const lum = c => { const f = v => { v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }; return .2126 * f(c.r) + .7152 * f(c.g) + .0722 * f(c.b); };
      const v = k => cs.getPropertyValue(k).trim() || (/-ink$/.test(k) && k !== '--accent-ink' ? '#fff' : '');
      const bg = rgba(v('--bg'));
      return PAIRS.map(([t, f, min, where]) => { const fb = over(rgba(v(f)), bg), tc = over(rgba(v(t)), fb); const L1 = lum(tc), L2 = lum(fb); const r = (Math.max(L1, L2) + .05) / (Math.min(L1, L2) + .05); return [t, f, +r.toFixed(2), min, where]; });
    }, [sk, PAIRS]);
    const fails = res.filter(r => r[2] < r[3]); bad += fails.length;
    console.log((sk || 'original') + (scheme === 'dark' ? ' (oscuro)' : ''), fails.length ? fails.map(r => `${r[0]} sobre ${r[1]} ${String(r[2]).replace('.', ',')} (${r[4]})`).join(' · ') : 'todo ≥ 4,5');
    await p.close();
  }
  console.log('PARES POR DEBAJO', bad);
  await b.close();
})();
