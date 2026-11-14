// Diagnóstico: descarga una página (y sus scripts) y muestra cabeceras y coincidencias de un patrón.
// Uso: node test/explorar.js <url> [patrón] [método] [cuerpo JSON]   (lo ejecuta el flujo «Explorar una web»)
const [url, pat, method = 'GET', body] = process.argv.slice(2);
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';
const re = pat ? new RegExp(pat, 'gi') : null;
const show = (label, text) => {
  if (!re) { console.log(`--- ${label} (primeros 3000 caracteres) ---\n` + text.slice(0, 3000)); return; }
  const found = new Set(); let m; re.lastIndex = 0;
  while ((m = re.exec(text)) && found.size < 400) { const a = Math.max(0, m.index - 60), b = Math.min(text.length, m.index + m[0].length + 60); found.add(text.slice(a, b).replace(/\s+/g, ' ')); if (m[0].length === 0) re.lastIndex++; }
  console.log(`--- ${label}: ${found.size} coincidencias ---`); found.forEach(f => console.log('  · ' + f));
};
(async () => {
  const opt = { method, headers: { 'User-Agent': UA, Accept: '*/*', Origin: 'https://erikbadibb.github.io' }, redirect: 'follow' };
  if (body) { opt.body = body; opt.headers['Content-Type'] = 'application/json'; }
  const r = await fetch(url, opt);
  console.log('URL final:', r.url, '| estado', r.status);
  for (const [k, v] of r.headers) if (/content-type|access-control|set-cookie|location|server|www-authenticate|x-powered/i.test(k)) console.log(`  ${k}: ${v.slice(0, 200)}`);
  const text = await r.text();
  console.log('Tamaño:', text.length);
  show('página', text);
  // Scripts de la página (para encontrar las direcciones de su API)
  const srcs = [...text.matchAll(/<script[^>]+src=["']([^"']+)["']/gi)].map(x => new URL(x[1], r.url).href);
  if (srcs.length) console.log('Scripts:', srcs.join('\n  '));
  for (const s of srcs.slice(0, 25)) {
    try { const js = await (await fetch(s, { headers: { 'User-Agent': UA } })).text(); show(s.split('/').pop() + ` (${js.length} car.)`, js); } catch (e) { console.log('No se pudo leer', s, e.message); }
  }
})().catch(e => { console.error(e); process.exit(1); });
