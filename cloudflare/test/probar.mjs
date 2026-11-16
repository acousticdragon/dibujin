// Prueba local del Worker con un Cloudflare simulado (no necesita internet): node cloudflare/test/probar.mjs
import worker, { Limiter } from "../src/worker.js";
const store = new Map(); const state = { storage: { get: async k => store.get(k), put: async (k, v) => store.set(k, v) } };
const lim = new Limiter(state);
let llamadas = [];
globalThis.fetch = async (u, o) => { llamadas.push([String(u), o]); return Response.json({ iceServers: [{ urls: ["stun:stun.cloudflare.com:3478"] }, { urls: ["turn:turn.cloudflare.com:3478?transport=udp", "turns:turn.cloudflare.com:443?transport=tcp"], username: "u", credential: "c" }] }); };
const env = { TURN_KEY_ID: "kid", TURN_KEY_API_TOKEN: "tok", MAX_PER_DAY: "5", MAX_PER_IP_HOUR: "3", TTL: "3600", ALLOWED_ORIGINS: "*",
  LIMITER: { idFromName: () => "g", get: () => ({ fetch: (u, o) => lim.fetch(new Request(u, o)) }) }, ASSETS: { fetch: async () => new Response("<html>juego</html>") } };
const pedir = (ip, extra = {}, metodo = "GET", ruta = "/api/turn") => worker.fetch(new Request("https://x.dev" + ruta, { method: metodo, headers: { "cf-connecting-ip": ip, origin: "https://localhost", ...extra } }), env);
const ok = (c, m) => { console.log((c ? "✔ " : "✘ ") + m); if (!c) process.exitCode = 1; };
let r = await pedir("1.1.1.1"); let j = await r.json();
ok(r.status === 200 && j.iceServers.length === 2 && j.ttl === 3600, "entrega iceServers con TTL");
ok(r.headers.get("access-control-allow-origin") === "*", "CORS abierto");
ok(llamadas[0][0].includes("/keys/kid/credentials/generate-ice-servers") && llamadas[0][1].headers.Authorization === "Bearer tok" && JSON.parse(llamadas[0][1].body).ttl === 3600, "llama bien a Cloudflare con el token en el servidor");
ok(!JSON.stringify(j).includes("tok\""), "el token no se filtra en la respuesta");
ok((await pedir("1.1.1.1", {}, "OPTIONS")).status === 204, "OPTIONS (CORS) ok");
ok((await pedir("1.1.1.1", {}, "POST")).status === 405, "rechaza POST");
await pedir("1.1.1.1"); await pedir("1.1.1.1");
r = await pedir("1.1.1.1"); ok(r.status === 429 && (await r.json()).motivo === "ip", "tope por IP y hora (3)");
await pedir("2.2.2.2"); r = await pedir("3.3.3.3"); ok(r.status === 200, "otra IP sí pasa");
r = await pedir("4.4.4.4"); ok(r.status === 429 && (await r.json()).motivo === "dia", "tope diario global (5)");
r = await pedir("5.5.5.5", {}, "GET", "/index.html"); ok((await r.text()).includes("juego"), "el resto de rutas sirve el juego");
const sinSecretos = { ...env, TURN_KEY_ID: "" }; r = await worker.fetch(new Request("https://x.dev/api/turn"), sinSecretos); ok(r.status === 500, "avisa si faltan los secretos");
