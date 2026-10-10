# Laboratorio ACB

Herramienta web para analizar partidos de la Liga Endesa con estadística avanzada a partir del play by play público de live.acb.com.

## Qué hace

- **Partido**: pega el enlace de live.acb.com (o elige jornada y partido) y obtienes posesiones contadas jugada a jugada, cuatro factores por cuarto y en clutch, reparto de la diferencia por factores, estadística avanzada por jugador (USG%, AST%, rebote%, on/off, WPA), quintetos, tríos y parejas, rotaciones con el +/- de cada tramo, parciales, efecto de los tiempos muertos, probabilidad de victoria, eficiencia según cómo empieza la posesión, red de asistencias y el listado de jugadas. En partidos en juego se actualiza cada 30 segundos.
- **Scouting de equipo**: acumula todos los partidos terminados de un equipo en la temporada.
- **Validación**: compara lo calculado con la estadística oficial de cada jugador y lo indica en el marcador.

## Cómo funciona

Un único `index.html` sin dependencias ni servidor propio. Lee los datos directamente de `api2.acb.com` con la clave pública que usa la web oficial; si cambia, se actualiza en «Ajustes de conexión».

El acta de la ACB no incluye coordenadas de tiro, así que no hay mapas de tiro por zonas.
