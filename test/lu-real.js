// Liga U con un partido real (test/lu2538967.json, capturado con el flujo «Capturar datos de prueba»):
// el motor debe cuadrar con el acta y la web debe mostrarlo entero (marcador, cuadre, mapa de tiro)
const { JSDOM } = require('jsdom');
const { check, done } = require('./check');
const fs = require('fs');
require('../engine.js'); require('../fiba.js'); require('../ligau.js');
const A = globalThis.ACB, F = globalThis.ACB_FIBA, LU = globalThis.ACB_LU;
const d = require('./lu2538967.json');
const teams = new Map(d.teams.map(x => [x.id_equipo_temporada, { abbr: String(x.nombre_abr || '').trim(), name: x.nombre_acor, color: x.Color || null }]));
const g = A.parseGame(F.fibaToRaw(LU.luToFiba(d.pbp, d.md[0], d.box, d.shots, teams)), { id: d.id });
const v = A.validate(g);
console.log('motor:', g.teams.map(t => t.abbr).join('-'), g.final.join('-'), '| acta', v.ok + '/' + v.n, '| minutos', v.minOk + '/' + v.minN, '| avisos', g.warnings.length);
check(v.n > 0 && v.ok === v.n && v.ptsOk && v.minOk === v.minN, 'Liga U real: el motor no cuadra con el acta');
check(d.md[0].local_points === g.final[0] && d.md[0].visitor_points === g.final[1], 'Liga U real: el marcador final no coincide');
// La web con la Liga U simulada a partir de los datos guardados
const html = fs.readFileSync(__dirname + '/../site/index.html', 'utf8');
const resp = o => Promise.resolve({ ok: true, status: 200, json: async () => o });
const dom = new JSDOM(html, { url: 'https://erikbadibb.github.io/laboratorio-acb/#lu-' + d.id, runScripts: 'dangerously', pretendToBeVisual: true,
  beforeParse(w) {
    w.fetch = u => { u = decodeURIComponent(String(u));
      if (u.includes('pbp_player_name_ligau_view')) { const m = u.match(/num=gte\.(\d+)/); return resp(m ? d.pbp.filter(r => r.num >= +m[1]) : d.pbp); }
      if (u.includes('teams_info_ligau')) return resp(d.teams);
      if (u.includes('all_matches_data_lf_endesa')) return resp(u.includes('match_id=eq') ? d.md : d.md);
      if (u.includes('all_players_boxscores')) return resp(d.box);
      if (u.includes('shots_with')) return resp(d.shots);
      return Promise.reject(new TypeError('Failed to fetch')); };
    Object.defineProperty(w.HTMLElement.prototype, 'clientWidth', { get() { return 800; } });
  } });
const w = dom.window, doc = w.document, errs = []; w.addEventListener('error', e => errs.push(e.message));
setTimeout(async () => {
  const foot = doc.querySelector('.boardfoot');
  console.log('web:', doc.querySelector('.score .big') && doc.querySelector('.score .big').textContent, '|', foot && foot.textContent.replace(/\s+/g, ' ').slice(0, 90));
  check(foot && /✓ Cuadre/.test(foot.textContent), 'Liga U real: la web no muestra el cuadre con el acta');
  doc.querySelector('[data-tab="tiro"]').click(); await new Promise(r => setTimeout(r, 40));
  const marks = doc.querySelectorAll('#view svg [data-tip]').length;
  console.log('mapa de tiro:', marks, 'tiros');
  check(marks > 100, 'Liga U real: el mapa de tiro no muestra los tiros');
  check(!errs.length, 'Liga U real: errores de JavaScript ' + errs.join(' '));
  done('Liga U con partido real');
}, 900);
