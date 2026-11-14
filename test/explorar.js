// Diagnóstico: descarga una página (y sus scripts) y muestra cabeceras y coincidencias de un patrón.
// Uso: node test/explorar.js <url> [patrón] [método] [cuerpo JSON]   (lo ejecuta el flujo «Explorar una web»)
const [url, pat, method = 'GET', body] = process.argv.slice(2);
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';
const re = pat ? new RegExp(pat, 'gi') : null;
const all = new Map(); // coincidencia exacta → [veces, contexto de ejemplo, dónde]
const show = (label, text) => {
  if (!re) { console.log(`--- ${label} (primeros 3000 caracteres) ---\n` + text.slice(0, 3000)); return; }
  let m, n = 0; re.lastIndex = 0;
  while ((m = re.exec(text))) {
    if (m[0].length === 0) { re.lastIndex++; continue; }
    n++; const k = m[0], o = all.get(k);
    if (o) o[0]++; else all.set(k, [1, text.slice(Math.max(0, m.index - 80), Math.min(text.length, m.index + k.length + 80)).replace(/\s+/g, ' '), label]);
  }
  console.log(`--- ${label}: ${n} coincidencias ---`);
};
const resumen = () => {
  if (!re) return;
  console.log(`\n===== RESUMEN: ${all.size} coincidencias distintas =====`);
  [...all].slice(0, 250).forEach(([k, [c, ctx, where]]) => console.log(`\n» ${k}  (x${c}, ${where})\n    ${ctx}`));
};
(async () => {
  const opt = { method, headers: { 'User-Agent': UA, Accept: '*/*', Origin: 'https://erikbadibb.github.io' }, redirect: 'follow' };
  if (body) { opt.body = body; opt.headers['Content-Type'] = /^\s*[{[]/.test(body) ? 'application/json' : 'application/x-www-form-urlencoded'; }
  if (method === 'OPTIONS') Object.assign(opt.headers, { 'Access-Control-Request-Method': 'GET', 'Access-Control-Request-Headers': 'authorization,content-type' });
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
  resumen();
})().catch(e => { console.error(e); process.exit(1); });
