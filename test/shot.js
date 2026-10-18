const { chromium } = require('playwright');
const fx = require('./bcl136295.json');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1200, height: 1500 } });
  const boxObjs = fx.box.map(r => ({ player: { playerId: r[0] }, team: { organisationId: r[1] }, isStarter: !!r[2], playDurationInSeconds: r[3], points: r[4], twoPointsMade: r[5], twoPointsAttempted: r[6], threePointsMade: r[7], threePointsAttempted: r[8], freeThrowsMade: r[9], freeThrowsAttempted: r[10], offensiveRebounds: r[11], defensiveRebounds: r[12], assists: r[13], steals: r[14], turnovers: r[15], blockedShots: r[16], personalFouls: r[17], plusMinus: r[18] }));
  await p.route('**/*', route => {
    const u = route.request().url();
    if (u.includes('/api/bcl')) { const { box, ...rest } = fx; return route.fulfill({ json: Object.assign(rest, { finished: true }), headers: { 'access-control-allow-origin': '*' } }); }
    if (u.includes('getgdapgamestatisticsbygameid')) return route.fulfill({ json: boxObjs, headers: { 'access-control-allow-origin': '*' } });
    if (u.startsWith('file:')) return route.continue();
    return route.abort();
  });
  p.on('pageerror', e => console.log('PAGEERR', e.message));
  await p.goto('file://' + __dirname + '/../site/index.html#bcl-136295');
  await p.waitForTimeout(1200);
  await p.screenshot({ path: '/tmp/coach.png', fullPage: false });
  await p.click('[data-tab="tiro"]'); await p.waitForTimeout(300);
  const el = await p.$('#view'); await el.screenshot({ path: '/tmp/tiro.png' });
  await p.setViewportSize({ width: 400, height: 900 }); await p.click('[data-tab="entrenador"]'); await p.waitForTimeout(300);
  await p.screenshot({ path: '/tmp/mobile.png' });
  const ov = await p.evaluate(() => document.documentElement.scrollWidth > innerWidth);
  console.log('mobile horizontal overflow:', ov);
  await b.close();
})();
