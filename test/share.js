// Compartir un bloque del Entrenador como imagen: se genera un PNG con el estilo de la página
const launch = require('./browser');
const fx = require('./bcl136295.json');
const OUT = require('os').tmpdir(); const { check, done } = require('./check');
(async () => {
  const b = await launch();
  for (const skin of ['', 'tv']) {
    const ctx = await b.newContext({ viewport: { width: 1200, height: 1000 }, acceptDownloads: true }); const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.route('**/*', r => { const u = r.request().url(); const H = { 'access-control-allow-origin': '*' };
      if (u.includes('/api/bcl')) { const { box, ...rest } = fx; return r.fulfill({ json: Object.assign(rest, { finished: true }), headers: H }); }
      if (u.includes('getgdap')) return r.fulfill({ json: [], headers: H });
      if (u.startsWith('file:')) return r.continue(); return r.abort(); });
    await p.addInitScript(sk => { localStorage.setItem('lab-acb:tab', JSON.stringify('entrenador')); localStorage.setItem('lab-acb:skin', JSON.stringify(sk)); localStorage.setItem('lab-acb:fav-bcl', JSON.stringify({ id: 284920, abbr: 'SBB', name: 'Surne Bilbao' })); }, skin);
    await p.goto('file://' + __dirname + '/../site/index.html#bcl-136295'); await p.waitForSelector('#view .board'); await p.waitForTimeout(400);
    for (const id of ['marcador', 'pista']) {
      const [dl] = await Promise.all([p.waitForEvent('download', { timeout: 15000 }), p.click(`[data-share="${id}"]`)]);
      const f = `${OUT}/share-${skin || 'original'}-${id}.png`; await dl.saveAs(f);
      const size = require('fs').statSync(f).size;
      console.log(skin || 'original', id, '->', dl.suggestedFilename(), size, 'bytes', '| errores', errs);
      check(size > 20000 && !errs.length, `compartir: imagen de «${id}» (${skin || 'original'})`);
    }
    await ctx.close();
  }
  await b.close();
  done('compartir bloque como imagen');
})();
