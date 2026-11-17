# DIBUJA Y ADIVINA — Web, Windows y Android (proyecto independiente)

Todo sale de la carpeta `www/` (el juego en HTML). No depende de Mafia ni de Ludo.

```
www/            el juego (index.html, personaje.js, lan.js, sw.js, config.json, skins.json, íconos)
server/         servidor Wi-Fi local (sin dependencias, solo Node.js)
electron/       app de Windows
cloudflare/     servicio TURN gratis + alojamiento opcional del juego
.github/workflows/   compilación automática (APK y .exe) y publicación en Cloudflare
capacitor.config.json  package.json  INICIAR-WIFI-LOCAL.bat
```

## 1) Web (Netlify, GitHub Pages, Cloudflare…)
Sube la carpeta **www** completa (en Netlify: arrastrar y soltar). Entra a `https://tu-sitio/` y listo.
- `www/config.json`: datos de relevo TURN y links de descarga:
  `"downloads": { "android": "https://.../Dibuja.apk", "windows": "https://.../Dibuja-Setup.exe" }`

## 2) Windows y Android sin programar (se compilan solos en GitHub, gratis)
1. Crea un repositorio nuevo en github.com y sube TODO el contenido de esta carpeta.
   Importante: debe quedar la carpeta oculta `.github/workflows/` con `build.yml`.
2. Pestaña **Actions** > "Compilar apps (Android y Windows)" > **Run workflow**.
3. En 10 a 15 minutos aparecen al final de la página:
   - **Dibuja-Android-APK** (instalable; hay que permitir "orígenes desconocidos").
   - **Dibuja-Windows-instalador** (el .exe).
4. Para que la web ofrezca esas descargas: sube los archivos a Netlify (por ejemplo dentro de `www/`) y pon sus links en `config.json`.

Si una compilación falla, copia el mensaje de error y mándamelo: es la parte que no se puede probar desde aquí.

## 3) Jugar por la misma Wi-Fi SIN internet
- Abre la app de **Windows** (o ejecuta `INICIAR-WIFI-LOCAL.bat`; necesita Node.js).
- Entra a "Online": verás una dirección tipo `http://192.168.1.20:8766` y un QR.
- Los demás (Android, iPhone, otro PC) abren esa dirección en el navegador, en la misma Wi-Fi.
- La primera vez Windows pregunta por el Firewall: elige "Permitir" en redes privadas.
- En este modo no hay voz ni escaneo de QR con cámara (los navegadores las bloquean sin https).
- El puerto es 8766 (no choca con otros juegos que usen 8765).

## 4) Cloudflare: relevo TURN + web gratis (para jugar entre redes distintas)
1. Cuenta gratis en dash.cloudflare.com.
2. **Llave TURN**: *Realtime* > *TURN Server* > crear. Guarda el **Turn Key ID** y el **API Token**.
3. **Token para publicar**: *My Profile* > *API Tokens* > plantilla *Edit Cloudflare Workers*. Anota también tu **Account ID**.
4. En GitHub: *Settings* > *Secrets and variables* > *Actions*: crea `CLOUDFLARE_API_TOKEN` y `CLOUDFLARE_ACCOUNT_ID`.
5. *Actions* > **Publicar en Cloudflare** > *Run workflow*. Tu juego queda en `https://dibuja-juego.TU-SUBDOMINIO.workers.dev`.
6. En Cloudflare: *Workers & Pages* > dibuja-juego > *Settings* > *Variables and Secrets*: agrega los secretos `TURN_KEY_ID` y `TURN_KEY_API_TOKEN`.
7. Abre `https://dibuja-juego.TU-SUBDOMINIO.workers.dev/api/turn`: debe mostrar un JSON con "iceServers".
8. En `www/config.json` pon `"turn": { "endpoint": "/api/turn" }` (o la URL completa si juegas desde otro dominio), sube el cambio y vuelve a ejecutar los workflows.
9. En el juego: *Ajustes* > *Probar conexión*: debe salir ✅ en "Servidor de relevo (TURN)".

Prueba del servicio sin internet: `node cloudflare/test/probar.mjs`.

## Cómo se juega
Cada turno una persona elige una palabra y la dibuja; los demás escriben su respuesta en el chat. Más rápido = más puntos.
- **Online:** salas con código, QR o enlace, voz, chat, reacciones, contraseña y expulsión. **Salas abiertas** y **⚡ Partida rápida** para jugar con gente nueva.
- **Local:** un solo celular. **Wi-Fi local:** sin internet (ver arriba).
- **Votos:** al terminar cada dibujo se puede votar 👍/👎. Cada 👍 suma 10 puntos a quien dibujó. Al final se marca ⭐ el dibujo más votado.
- **Portada:** el menú muestra una portada que se dibuja sola. Tocándola puedes dibujar la tuya, o usar cualquier dibujo de la partida como portada.
- **Opciones de partida:** rondas, tiempo, palabras asignadas o 3 a elegir, 0 a 3 pistas de letras, temas, palabras propias y "solo mis palabras".
- **Herramientas:** lápiz, goma, balde, deshacer, borrar, 4 tamaños, 16 colores y color libre 🎨. Paletas y pinceles (neón, spray, arcoíris) se desbloquean con monedas.
- **Estadísticas:** partidas, victorias, aciertos y dibujos.
Las monedas, el personaje y la tienda se guardan en el dispositivo (clave `dibuja1`, constante `KEY` en `index.html`).
La cuenta compartida entre juegos se hará más adelante.
