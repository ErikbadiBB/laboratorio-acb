const { chromium } = require('playwright');
const fx = require('./bcl136295.json');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage();
  await p.route('**/*', r => { const u = r.request().url(); if (u.includes('/api/bcl')) { const { box, ...rest } = fx; return r.fulfill({ json: Object.assign(rest, { finished: true }), headers: { 'access-control-allow-origin': '*' } }); } if (u.startsWith('file:')) return r.continue(); return r.abort(); });
  for (const [w, h] of [[1200, 900], [800, 900], [400, 900]]) {
    await p.setViewportSize({ width: w, height: h });
    await p.goto('file://' + __dirname + '/../site/index.html#bcl-136295'); await p.waitForTimeout(700);
    const res = [];
    for (const t of ['entrenador', 'resumen', 'jugadores', 'tiro', 'dinamica']) { await p.click(`[data-tab="${t}"]`); await p.waitForTimeout(150); res.push(t + ':' + (await p.evaluate(() => document.documentElement.scrollWidth - innerWidth))); }
    console.log(w, res.join(' '));
    if (w === 400) await p.screenshot({ path: '/tmp/mobile2.png' });
  }
  await b.close();
})();
