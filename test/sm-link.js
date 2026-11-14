// Conexión con Supermanager (simulada): inicio de sesión con ACB ID sin guardar la contraseña, equipos y plantillas
// copiados de Supermanager, jugadores enlazados por nombre, enlace a mano de los dudosos, sesión renovada y cambios de plantilla
const { JSDOM } = require('jsdom');
const { check, done } = require('./check');
const fs = require('fs');
const { acbRaw, fx } = require('./acbraw');
const html = fs.readFileSync(__dirname + '/../site/index.html', 'utf8');
const pidOf = name => Number(Object.keys(fx.names).find(k => fx.names[k].startsWith(name)));
const H = pidOf('Darrun Hilliard'), M = pidOf('Margiris Normantas'), N = pidOf('Nick Ongenda'), F = pidOf('Aleix Font'), V = pidOf('Eric Vila');
const PASS = 'contraseña-de-prueba-123';
const T = (id, ab) => ({ id, abbreviatedName: ab, shortName: ab, fullName: ab });
const rounds = [{ id: 101, roundNumber: 1 }, { id: 102, roundNumber: 2 }, { id: 103, roundNumber: 3 }, { id: 104, roundNumber: 4 }];
const mk = (id, status, l, when) => { const last = l.plays[l.plays.length - 1]; return { id, homeTeam: T(4475, fx.h), awayTeam: T(4471, fx.a), homeScore: last.scoreHome, awayScore: last.scoreAway, startDateTime: when, matchStatus: status }; };
const resp = (o, status = 200) => Promise.resolve({ ok: status < 300, status, json: async () => o, text: async () => JSON.stringify(o) });
// Supermanager simulado
const smx = { jwt: 'J1', refreshOk: true, calls: [], bodies: [],
  players: () => [
    { position: 1, statusTeamSquad: 'full', idPlayer: 9001, shortName: 'D. Hilliard', fullName: 'Darrun Hilliard', price: 1200000, team: { shortName: fx.h } },
    { position: 3, statusTeamSquad: 'full', idPlayer: 9002, shortName: 'NORMANTAS, M.', price: 900000 },
    { position: 5, statusTeamSquad: 'full', idPlayer: 9003, shortName: 'N. Ongenda', fullName: 'Nick Ongenda' },
    { position: 3, statusTeamSquad: 'full', idPlayer: 9004, shortName: 'J. Desconocido', fullName: 'Juan Desconocido' },
    { position: 1, statusTeamSquad: 'empty' }] };
// Plantillas guardadas de cada jornada (como /basic/userteamplayer/journeys/{id}): J1 con Juan Desconocido, J2 sin él, J3 = la de ahora, J4 vacía
const P = n => smx.players().find(p => p.idPlayer === n);
const J3 = smx.players();
smx.journeys = () => [{ number: 1, playerList: [P(9001), P(9002), P(9004)] }, { number: 2, playerList: [P(9001), P(9003)] }, { number: 3, playerList: J3 }, { number: 4, playerList: [] }];
const dom = new JSDOM(html, { url: 'https://erikbadibb.github.io/laboratorio-acb/', runScripts: 'dangerously', pretendToBeVisual: true,
  beforeParse(w) {
    w.fetch = (u, o = {}) => { u = String(u); const hd = o.headers || {};
      if (/supermanager|id\.acb\.com/.test(u)) { smx.calls.push(u.replace(/^https:\/\/[^/]+/, '')); if (o.body) smx.bodies.push(String(o.body)); }
      if (u === 'https://id.acb.com/api/signIn') { const b = new URLSearchParams(o.body); return b.get('password') === PASS && hd['Content-Type'] === 'application/x-www-form-urlencoded' ? resp({ code: 'C-123', email: 'x' }) : resp('NotAuthorizedException', 401); }
      if (u === 'https://supermanager.acb.com/oauth/V2/open/accounttoken/getTokens') return JSON.parse(o.body).uuid === 'C-123' ? resp({ type: 'Bearer', jwt: 'J1', refresh: 'R1' }) : resp([{ code: 'Invalid code' }], 401);
      if (u === 'https://supermanager.acb.com/oauth/V2/open/refresh') return smx.refreshOk && JSON.parse(o.body).token === 'R1' ? resp({ type: 'Bearer', jwt: smx.jwt, refresh: 'R1' }) : resp([{ code: 'x' }], 401);
      if (u.startsWith('https://supermanager.acb.com/api/')) {
        if (hd.Authorization !== 'Bearer ' + smx.jwt) return resp([{ code: 'FRWLL011', message: 'El token de acceso no existe.' }], 401);
        if (u.endsWith('/basic/userteam/all')) return resp([{ name: null }, { name: 'Liga Endesa 26-27', idCompetition: 1, userTeamList: [{ idUserTeam: 77, nameTeam: 'Erik BB' }] }]);
        if (u.endsWith('/basic/userteamplayer/journeys/77')) return resp(smx.journeys());
        if (u.endsWith('/basic/userteamplayer/77')) return resp(smx.players());
        return resp({}, 404);
      }
      if (u.includes('competition-data')) return resp({ currentCompetitionId: 1, currentEditionId: 1, currentRoundId: 103, competitions: [{ id: 1, editions: [{ id: 1, rounds }] }] });
      if (u.includes('matchlist')) { const r = +u.match(/roundId=(\d+)/)[1];
        if (r === 104) return resp({ matches: [mk(105377, 'SCHEDULED', acbRaw(0), '2026-11-21T18:00:00')] });
        if (r === 103) return resp({ matches: [mk(105376, 'FINALIZED', acbRaw(0), '2026-11-14T18:00:00')] });
        return resp({ matches: [mk(105300 + r, 'FINALIZED', acbRaw(0), '2026-10-0' + r + 'T18:00:00')] }); }
      if (u.includes('play-by-play')) return resp(acbRaw(0));
      if (u.includes('match-header')) return resp({ matchStatus: 'FINALIZED' });
      return Promise.reject(new TypeError('Failed to fetch')); };
    Object.defineProperty(w.HTMLElement.prototype, 'clientWidth', { get() { return 800; } });
  } });
const w = dom.window, d = w.document, errs = []; w.addEventListener('error', e => errs.push(e.message)); w.console.error = (...a) => errs.push(a.join(' '));
const wait = ms => new Promise(r => setTimeout(r, ms));
const until = async (f, ms = 6000) => { const t0 = Date.now(); while (!f() && Date.now() - t0 < ms) await wait(50); return f(); };
const cfg = () => JSON.parse(w.localStorage.getItem('lab-acb:sm'));
const team = () => cfg().teams.find(t => t.link);
const allStorage = () => Object.keys(w.localStorage).map(k => w.localStorage.getItem(k)).join('\n');
const login = async pass => { d.querySelector('#in-smuser').value = 'erik'; d.querySelector('#in-smpass').value = pass; d.querySelector('#sm-login').dispatchEvent(new w.Event('submit', { bubbles: true, cancelable: true })); };
(async () => {
  await wait(500);
  d.querySelector('[data-smopen]').click();
  await until(() => Object.keys(JSON.parse(w.localStorage.getItem('lab-acb:sm-pool') || '{}')).length >= 20);
  // 1) Conectar: contraseña incorrecta y luego la buena
  check(d.querySelector('#view [data-smlogin="1"]'), 'SM: falta el botón «Conectar con Supermanager»');
  d.querySelector('#view [data-smlogin="1"]').click(); await wait(30);
  await login('mala'); await until(() => /incorrectos/.test((d.querySelector('#st-smlogin') || {}).textContent || ''));
  check(/incorrectos/.test(d.querySelector('#st-smlogin').textContent) && d.querySelector('#in-smpass').value === '', 'SM: con la contraseña mala debe avisar y vaciar el campo');
  await login(PASS);
  await until(() => team() && team().hist.some(h => h.players.length >= 3), 8000);
  const t = team();
  console.log('equipo:', t && t.name, '| plantilla:', t && JSON.stringify(t.hist), '| por enlazar:', t && (t.miss || []).map(m => m.n).join(', '));
  check(t && t.name === 'Erik BB' && cfg().teams.length === 1, 'SM: el equipo de Supermanager debe sustituir al equipo vacío');
  check(t && [H, M, N].every(p => t.hist.find(h => h.from === 3).players.includes(p)), 'SM: Hilliard, Normantas («NORMANTAS, M.») y Ongenda deben enlazarse por nombre');
  check(t && t.pos[H] === 1 && t.pos[M] === 3 && t.pos[N] === 5, 'SM: posiciones de Supermanager');
  check(t && t.miss.length === 1 && t.miss[0].n === 'Juan Desconocido', 'SM: el jugador que no se reconoce debe quedar para enlazar a mano');
  const at = (tt, rn) => { let r = []; for (const h of tt.hist) if (h.from <= rn) r = h.players; return r; };
  check(t && t.start === 1 && at(t, 1).join() === [H, M].join() && at(t, 2).join() === [H, N].join(), 'SM: las jornadas anteriores deben copiarse con su plantilla de cada jornada');
  check(!allStorage().includes(PASS) && !smx.bodies.some((b, i) => b.includes(encodeURIComponent(PASS)) && !smx.calls[i].includes('signIn')), 'SM: la contraseña no debe guardarse ni enviarse fuera de la ACB');
  check(JSON.parse(w.localStorage.getItem('lab-acb:sm-auth')).jwt === 'J1', 'SM: no se guarda la sesión');
  // 2) Jornada, vista Pista: bases arriba, aleros en medio, pívots abajo, y al lado la estadística completa
  await until(() => d.querySelectorAll('#view .sm-crow').length === 3 && d.querySelector(`#view .sm-tile[data-pid="${H}"] .sm-tpts`) && /\d/.test(d.querySelector(`#view .sm-tile[data-pid="${H}"] .sm-tpts`).textContent));
  const crow = [...d.querySelectorAll('#view .sm-crow')].map(r => [...r.querySelectorAll('.sm-tile')].map(x => +x.dataset.pid));
  const tileH = d.querySelector(`#view .sm-tile[data-pid="${H}"]`), hdr = [...d.querySelectorAll('#view table th')].map(x => x.textContent.replace(/[↑↓]/g, '').trim());
  const trH = [...d.querySelectorAll('#view table tbody tr')].find(tr => /Hilliard/.test(tr.textContent));
  console.log('pista:', JSON.stringify(crow), '|', tileH.querySelector('.sm-tname').textContent, tileH.querySelector('.sm-tbar').textContent.trim(), '| tabla:', hdr.join(' '), '|', trH && [...trH.children].map(c => c.textContent.trim()).join(' | '));
  check(crow[0].join() === String(H) && crow[1].join() === String(M) && crow[2].join() === String(N), 'SM: en la pista, bases arriba, aleros en medio y pívots abajo');
  check(tileH.querySelector('.sm-tname').textContent === 'Hilliard' && tileH.querySelector('.sm-tbar').classList.contains('is-good'), 'SM: la ficha muestra el apellido y los puntos en verde');
  check(['Jugador', 'SM', 'Partido', 'Min', 'Pts', 'T2', 'T3', 'TL', 'RO', 'RD', 'Ast', 'Val', '+/-'].every(h => hdr.includes(h)), 'SM: la tabla debe tener la estadística completa como en «Jugadores»');
  check(trH && /\d+\/\d+/.test(trH.textContent) && trH.children[1].textContent.replace('★', '').trim() === tileH.querySelector('.sm-tpts').textContent.trim(), 'SM: la tabla debe traer tiros y los mismos puntos que la pista');
  // Botón «Columna Partido»: quita y vuelve a poner esa columna de la tabla; la ficha no cambia
  const ths = () => [...d.querySelectorAll('#view table th')].map(x => x.textContent.replace(/[↑↓]/g, '').trim());
  const tile0 = d.querySelector(`#view .sm-tile[data-pid="${H}"]`).outerHTML;
  d.querySelector('#view [data-smgame]').click(); await wait(30);
  check(!ths().includes('Partido') && ths().includes('SM') && w.localStorage.getItem('lab-acb:sm-game') === 'false', 'SM: con la columna oculta no debe salir «Partido»');
  check(d.querySelector(`#view .sm-tile[data-pid="${H}"]`).outerHTML === tile0, 'SM: ocultar la columna no debe cambiar la ficha');
  d.querySelector('#view [data-smgame]').click(); await wait(30);
  check(ths().includes('Partido'), 'SM: la columna «Partido» debe volver');
  // Acumulado desde la J1 con los puntos de las jornadas anteriores (J1: Hilliard + Normantas; J2: Hilliard + Ongenda; J3: los tres + Font)
  d.querySelector('#view [data-smview="temporada"]').click();
  await until(() => d.querySelector('#view table') && [...d.querySelectorAll('#view table')[0].querySelectorAll('tbody tr')].length >= 3);
  const trs = [...d.querySelectorAll('#view table')[0].querySelectorAll('tbody tr, tfoot tr')].map(r => [...r.children].map(c => c.textContent.trim()).join(' | '));
  console.log('temporada:', trs.join(' / '));
  check(trs.some(r => /^J1/.test(r) && !/\| 0$/.test(r)) && trs.some(r => /^J2/.test(r) && !/\| 0$/.test(r)), 'SM: las jornadas 1 y 2 deben sumar puntos');
  d.querySelector('#view [data-smview="jornada"]').click(); await until(() => d.querySelector('#view [data-smlayout="tarjetas"]'));
  // Vista Tarjetas: por posición, con foto o iniciales y puntos en pastilla dorada
  d.querySelector('#view [data-smlayout="tarjetas"]').click();
  await until(() => d.querySelectorAll('#view .sm-pos').length === 3 && d.querySelector(`#view .sm-card[data-pid="${H}"] .sm-gold`));
  const pos = [...d.querySelectorAll('#view .sm-pos')].map(x => x.textContent.replace(/\s+/g, ' ').trim());
  console.log('grupos:', pos.join(' · '), '|', d.querySelector('#view .sm-top').textContent.replace(/\s+/g, ' ').trim());
  check(pos.join() === 'Bases 1,Aleros 1,Pívots 1', 'SM: la jornada debe agrupar por posición');
  check(/Conectado con Supermanager/.test(d.querySelector('#view .sm-conn').textContent) && /enlazar 1 jugador/.test(d.querySelector('#view .sm-top').textContent), 'SM: debe indicar que está conectado y avisar del jugador por enlazar');
  // 3) Plantilla del equipo enlazado: sin añadir ni quitar a mano, y enlace del dudoso
  d.querySelector('#view [data-smview="plantilla"]').click(); await wait(40);
  check(!d.querySelector('#in-smq') && !d.querySelector('#view [data-smrm]') && d.querySelector('#in-smname').disabled, 'SM: la plantilla de Supermanager no se edita aquí');
  const sel = d.querySelector('#view select[data-smfix]');
  check(sel && sel.options.length >= 1, 'SM: falta el selector para enlazar al jugador dudoso');
  const opt = d.createElement('option'); opt.value = F; sel.appendChild(opt); sel.value = String(F); sel.dispatchEvent(new w.Event('change', { bubbles: true }));
  await until(() => team().miss.length === 0 && team().hist.find(h => h.from === 3).players.includes(F));
  check(team().hist.find(h => h.from === 3).players.includes(F) && JSON.parse(w.localStorage.getItem('lab-acb:sm-links'))['9004'] === F, 'SM: el enlace a mano debe recordarse y entrar en la plantilla');
  check(at(team(), 1).includes(F) && !at(team(), 2).includes(F), 'SM: el jugador enlazado a mano solo entra en las jornadas en que estaba');
  // 4) La sesión caduca: se renueva sola
  smx.jwt = 'J2'; d.querySelector('#view [data-smsync]').click();
  await until(() => JSON.parse(w.localStorage.getItem('lab-acb:sm-auth') || '{}').jwt === 'J2' && !/Sincronizando/.test(d.querySelector('#view .sm-top').textContent));
  check(JSON.parse(w.localStorage.getItem('lab-acb:sm-auth')).jwt === 'J2' && smx.calls.includes('/oauth/V2/open/refresh'), 'SM: la sesión debe renovarse sola');
  // 5) Fichaje en Supermanager con la jornada 3 ya empezada: vale desde la 4 y la 3 no cambia
  const base = smx.players; smx.players = () => base().filter(p => p.idPlayer !== 9003).concat([{ position: 5, statusTeamSquad: 'full', idPlayer: 9005, fullName: 'Eric Vila' }]);
  d.querySelector('#view [data-smsync]').click();
  await until(() => team().hist.some(h => h.from === 4 && h.players.includes(V)));
  const h3 = team().hist.find(h => h.from === 3).players, h4 = (team().hist.find(h => h.from === 4) || {}).players || [];
  console.log('J3:', h3.join(','), '| J4:', h4.join(','));
  check(h3.includes(N) && h3.includes(F) && !h3.includes(V) && h4.includes(V) && h4.includes(F) && !h4.includes(N), 'SM: los cambios con la jornada empezada valen desde la siguiente');
  // 6) Sesión caducada sin poder renovarla: pide conectar otra vez
  smx.jwt = 'J3'; smx.refreshOk = false; d.querySelector('#view [data-smsync]').click();
  await until(() => /caducado/.test(d.querySelector('#view .sm-top').textContent));
  check(/caducado/.test(d.querySelector('#view .sm-top').textContent) && !w.localStorage.getItem('lab-acb:sm-auth'), 'SM: con la sesión caducada debe pedir conectar de nuevo');
  check(team() && team().hist.length >= 2, 'SM: al caducar la sesión los equipos se conservan');
  check(!errs.length, 'SM: errores de JavaScript ' + errs.join(' | '));
  w.close();
  done('Supermanager: conexión');
})();
