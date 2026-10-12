# StatsLAB

Herramienta web para analizar partidos de la Liga Endesa y de la Basketball Champions League con estadística avanzada a partir del jugada a jugada oficial.

## Qué hace

- **Partido**: pega el enlace de live.acb.com o de championsleague.basketball (o elige jornada y partido). Posesiones contadas jugada a jugada, cuatro factores, reparto de la diferencia, estadística avanzada por jugador, quintetos, rotaciones, parciales, tiempos muertos, probabilidad de victoria, eficiencia según el inicio de la posesión, red de asistencias y jugadas.
- **Entrenador**: panel personalizable con los bloques que elijas (en pista ahora con faltas y tiempos muertos, últimas jugadas, rotación, etc.).
- **Mapa de tiro**: en la Champions League, que publica la posición de cada tiro.
- **Directo**: se actualiza cada segundo (configurable).
- **Scouting de equipo**: acumula todos los partidos terminados de un equipo.
- **Validación**: compara lo calculado con la estadística oficial (y en la BCL también minutos y +/-).

## Cómo funciona

- `index.html`: la herramienta completa, sin dependencias.
- `api/bcl.js`: puente para la Champions League (función de Vercel). La web de la BCL no permite que otras webs lean su jugada a jugada; este puente lo lee y lo devuelve con acceso abierto.
