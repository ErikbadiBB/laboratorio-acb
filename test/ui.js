const { JSDOM } = require('jsdom');
const fs = require('fs');
const html = fs.readFileSync(__dirname + '/../dist/statslab.html', 'utf8');
const errors = [];
const dom = new JSDOM('<!doctype html><html><body>' + html + '</body></html>', {
  runScripts: 'dangerously', pretendToBeVisual: true,
  beforeParse(w) {
    w.fetch = () => Promise.reject(new TypeError('Failed to fetch'));
    w.addEventListener('error', e => errors.push(e.message));
    w.HTMLElement.prototype.getBoundingClientRect = () => ({ left: 0, top: 0, width: 800, height: 200 });
    Object.defineProperty(w.HTMLElement.prototype, 'clientWidth', { get() { return 800; } });
  }
});
const w = dom.window;
w.console.error = (...a) => errors.push(a.join(' '));
setTimeout(async () => {
  const d = w.document;
  const tabs = [...d.querySelectorAll('[data-tab]')].map(b => b.dataset.tab);
  console.log('tabs', tabs.join(','));
  for (const t of tabs) {
    d.querySelector(`[data-tab="${t}"]`).click();
    await new Promise(r => setTimeout(r, 30));
    const v = d.querySelector('#view');
    console.log(t.padEnd(11), 'len', v.innerHTML.length, 'tables', v.querySelectorAll('table').length, 'svgs', v.querySelectorAll('svg').length, 'empty', v.querySelectorAll('.empty').length);
    // filters & toggles
    for (const sel of ['[data-filt="q2"]', '[data-filt="clutch"]', '[data-pcols="adv"]', '[data-pcols="imp"]', '[data-lsize="2"]', '[data-lsize="3"]', '[data-close="last5"]', '[data-close="last2"]', '[data-pkind="pos"]', '[data-pside="0"]', 'th[data-sort]']) {
      const b = d.querySelector(sel); if (b) { b.click(); await new Promise(r => setTimeout(r, 10)); }
    }
    const f = d.querySelector('[data-filt="all"]'); if (f) f.click();
  }
  // insights text
  d.querySelector('[data-tab="resumen"]').click(); await new Promise(r => setTimeout(r, 30));
  console.log('INS:\n - ' + [...d.querySelectorAll('.ins li')].map(l => l.textContent).join('\n - '));
  console.log('status:', d.querySelector('#st-match').textContent);
  console.log('fallback hidden:', d.querySelector('#fallback').hidden);
  console.log('board:', d.querySelector('.boardfoot').textContent);
  // scout mode empty
  d.querySelector('#m-scout').click(); await new Promise(r => setTimeout(r, 30));
  console.log('scout view:', d.querySelector('#view').textContent.slice(0, 80));
  console.log('ERRORS', errors);
  process.exit(0);
}, 400);
