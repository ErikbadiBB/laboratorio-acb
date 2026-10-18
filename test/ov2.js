const launch = require('./browser');
const fx = require('./bcl136295.json');
(async () => {
  const b = await launch(); const p = await b.newPage({ viewport: { width: 400, height: 900 } });
  await p.route('**/*', r => { const u = r.request().url(); if (u.includes('/api/bcl')) { const { box, ...rest } = fx; return r.fulfill({ json: Object.assign(rest, { finished: true }), headers: { 'access-control-allow-origin': '*' } }); } if (u.startsWith('file:')) return r.continue(); return r.abort(); });
  await p.goto('file://' + __dirname + '/../site/index.html#bcl-136295'); await p.waitForTimeout(700);
  const wide = await p.evaluate(() => [...document.querySelectorAll('body *')].filter(e => { const r = e.getBoundingClientRect(); return r.right > innerWidth + 1 && !e.closest('.scroll,.tabs'); }).slice(0, 8).map(e => e.tagName + '.' + e.className + '#' + e.id + ' ' + Math.round(e.getBoundingClientRect().right)));
  console.log(wide);
  await b.close();
})();
