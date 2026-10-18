# StatsLAB

Herramienta web de estadística avanzada de baloncesto calculada desde el jugada a jugada oficial.
Competiciones: **Liga Endesa (ACB)**, **Basketball Champions League (BCL)** y **Liga U (ACB U22)**.
Usuario: Erik (Bilbao Basket). Responde siempre en castellano.

- Web publicada: https://erikbadibb.github.io/laboratorio-acb/
- Repositorio: https://github.com/ErikbadiBB/laboratorio-acb (este proyecto, rama `main`)
- Puente BCL (Vercel, «Root Directory» = `site`): https://laboratorio-acb.vercel.app/api/bcl

## Estructura

| Archivo | Qué es |
|---|---|
| `app.html` | Toda la interfaz (HTML + CSS + JS en un solo archivo). Es el archivo que más se toca. |
| `engine.js` | Motor de cálculo (`globalThis.ACB`): posesiones jugada a jugada, quintetos, four factors, on/off, WPA, parciales, clutch, `validate()` contra el acta oficial. Trabaja con el formato de la API de la ACB. |
| `fiba.js` | Adaptador BCL/FIBA → formato del motor (`globalThis.ACB_FIBA.fibaToRaw`), zonas de tiro. |
| `ligau.js` | Adaptador Liga U → formato compacto FIBA (`globalThis.ACB_LU.luToFiba`), que luego pasa por `fibaToRaw`. |
| `build.js` | Une `engine.js + fiba.js + ligau.js` y un partido de ejemplo dentro de `app.html` → genera `site/index.html` (web) y `dist/statslab.html`. |
| `site/` | **Lo que se publica**: `index.html` (generado), `manifest.webmanifest`, iconos, `api/bcl.js`. |
| `site/api/bcl.js` | Puente BCL (función Edge de Vercel). Se edita directamente aquí. |
| `.github/workflows/pages.yml` | Al hacer push a `main`: ejecuta `node build.js` y publica `site/` en GitHub Pages. |
| `test/` | Pruebas con datos reales (`m105375.json` ACB, `bcl136295.json` BCL). |

No editar `site/index.html` a mano: se regenera con `npm run build`.

## Comandos

```bash
npm install          # jsdom + playwright (para las pruebas)
npm run build        # genera site/index.html y dist/statslab.html
npm test             # motor ACB, BCL, interfaz sin navegador, directo
npm run test:visual  # capturas con Playwright (desbordes en 1200/800/400 px, mapa de tiro)
```

Antes de publicar: `npm run build && npm test` sin errores (las pruebas imprimen `ERRORS []`).

## Publicar

Basta con hacer commit y push a `main` (después de `npm run build && npm test`):
- GitHub Actions («Publicar web») regenera `site/index.html` y publica `site/` en GitHub Pages en 1-2 minutos.
- Vercel (proyecto `laboratorio-acb`, equipo «Bilbao Basket», preset «Other», Root Directory `site`) redespliega solo el puente `site/api/bcl.js`.

Comprobar después en la web real (recargar con `?v=N` para saltar la caché) abriendo un partido de cada competición:
`#acb-105394`, `#bcl-136295`, `#lu-2538967`. El marcador debe mostrar «✓ Cuadre con la estadística oficial».

## Fuentes de datos

Todas son públicas (las mismas que usan las webs oficiales). Las claves están en `app.html`.

- **ACB**: `https://api2.acb.com/api` con cabecera `X-APIKEY` (clave pública de live.acb.com). CORS abierto.
  `/matchdata/PlayByPlay/play-by-play?matchId=`, `/matchdata/MatchHeader/match-header`, `/matchdata/Menu/competition-data?competitionIds=1`, `/matchdata/Menu/matchlist?roundId=`.
- **BCL**:
  - Calendario y acta: `https://digital-api.fiba.basketball/hapi/` con cabecera `Ocp-Apim-Subscription-Key`. `getgdapgamesbycompetitionid?gdapCompetitionId=209123` (temporada 26-27), `getgdapgamestatisticsbygameid`, `getgdapgamebyid`.
  - Jugada a jugada: no tiene CORS → pasa por el puente de Vercel. El puente lee `https://www.championsleague.basketball/en/events/api/game-live-info/{id}/detail` (sirve en directo y terminado; caché de unos 20 s en su CDN) y, si falla, el HTML de la página del partido.
  - Tiempo real: `GET /api/bcl?token=1` da la URL de Azure WebPubSub; la app se conecta con subprotocolo `json.webpubsub.azure.v1`, se une al grupo `game-{id}` y recibe mensajes (`fileType` `periodactions` con el cuarto completo, o `game` con reloj/periodo; el cuerpo puede venir en gzip+base64).
  - Formato FIBA de acciones: `ac` = P2, P3, FT, REB, TREB, ASS, FOUL, RFOUL, SUBST (dirección en el texto «Sub-In»/«Sub-Out»), TO, TTO, ST, BS, TIMO, JB, STARTG/STARTP/ENDP/ENDG. Coordenadas en media pista 280×262, aro en (140, 29), 18,67 u/m.
- **Liga U (U22)**: Supabase de ligau.com, `https://ebthophzalnwztjbujaq.supabase.co/rest/v1/` con la clave anónima pública de su web (cabeceras `apikey` y `Authorization: Bearer`). Competición 155, temporada `2026-27`.
  Tablas: `pbp_player_name_ligau_view` (jugada a jugada; trae filas duplicadas, se deduplican), `all_matches_data_lf_endesa` (partidos/calendario), `all_players_boxscores_lf_endesa` (acta), `shots_with_player_info_view` (tiros con coordenadas en metros), `teams_info_ligau` (siglas y colores).
  Particularidades: el rebote no dice si es ofensivo o defensivo (se deduce del último fallo); los titulares son las «Entra a pista» del 1C a 10:00; la falta «Flagrante» no cuenta como falta personal en el acta; no hay +/- oficial.

## Interfaz (app.html)

- Cabecera: competición (`ACB | BCL | U22`), modo (`Partido | Scouting`), botón 🎨 de estilos.
- Selector de partido: carrusel por jornada/semana con tarjetas; se pliega en una franja al cargar un partido.
- Pestañas: Entrenador (bloques configurables, guardados en `localStorage` y exportables con un código), Resumen, Factores, Jugadores, Quintetos, Rotaciones, Dinámica, Posesiones, Tiro, Clutch, Jugadas.
- Directo: refresco configurable (1 s por defecto); en BCL además canal en tiempo real; si el partido no ha empezado, reintenta cada 15 s.
- Estilos (`data-skin` en `<html>`): Original, Noche de partido, Informe de scouting, Retransmisión TV, Parqué, Bilbao Negro. Se guardan por dispositivo.
- Hash de la URL: `#acb-ID`, `#bcl-ID`, `#lu-ID`.
- `localStorage` usa el prefijo `lab-acb:` (no cambiarlo, perdería la configuración guardada de los usuarios).

## Convenciones

- HTML autónomo y ligero en dependencias; sin frameworks ni paso de compilación aparte de `build.js`.
- Textos de la interfaz en castellano.
- Al añadir una competición: escribir un adaptador al formato compacto FIBA y reutilizar `fibaToRaw`; validar con `ACB.validate()` contra el acta (debe cuadrar en puntos y minutos).
