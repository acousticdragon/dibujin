/* Dibuja y adivina para Windows: abre el juego en una ventana y deja activo el servidor Wi-Fi local,
   así otras personas de la misma red pueden unirse desde el navegador del celular, sin internet. */
const { app, BrowserWindow, Menu, session, shell, dialog } = require("electron");
const path = require("path");
const { start } = require("../server/lan-server.js");

let info = null;
if (!app.requestSingleInstanceLock()) app.quit();

function crearVentana() {
  const w = new BrowserWindow({
    width: 480, height: 900, minWidth: 340, minHeight: 560,
    backgroundColor: "#0d0d11", title: "Dibuja y adivina", autoHideMenuBar: true,
    icon: path.join(__dirname, "..", "www", "icon-512.png"),
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true }
  });
  w.loadURL("http://localhost:" + info.port + "/");
  w.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: "deny" }; });
}

app.whenReady().then(async () => {
  Menu.setApplicationMenu(null);
  session.defaultSession.setPermissionRequestHandler((wc, permiso, cb) =>
    cb(["media", "fullscreen", "clipboard-sanitized-write"].includes(permiso)));
  try {
    info = await start({ port: 8766, root: path.join(__dirname, "..", "www") });
  } catch (e) {
    dialog.showErrorBox("Dibuja y adivina", "No se pudo iniciar el servidor Wi-Fi local: " + e.message);
    app.quit();
    return;
  }
  crearVentana();
  app.on("activate", () => { if (!BrowserWindow.getAllWindows().length) crearVentana(); });
});
app.on("second-instance", () => { const w = BrowserWindow.getAllWindows()[0]; if (w) { if (w.isMinimized()) w.restore(); w.focus(); } });
app.on("window-all-closed", () => app.quit());
app.on("before-quit", () => { try { info && info.close(); } catch (e) {} });
