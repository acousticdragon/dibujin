/* Dibuja y adivina — servicio de credenciales TURN en Cloudflare (gratis hasta el límite de Cloudflare).
   - GET /api/turn  ->  { iceServers: [...] } con credenciales que caducan (TTL, por defecto 4 h)
   - El TOKEN secreto nunca sale de aquí. Debes crear dos secretos: TURN_KEY_ID y TURN_KEY_API_TOKEN.
   - Freno casero: tope de credenciales por día (MAX_PER_DAY) y por IP y hora (MAX_PER_IP_HOUR).
     Cuando se pasa el tope, el servicio responde 429 y el juego sigue con conexión directa (sin relevo).
   - Si además publicas la carpeta www con este Worker, el juego y la API quedan en el mismo dominio. */

export class Limiter {
  constructor(state) { this.state = state; }
  async fetch(req) {
    const { ip, max, perIp } = await req.json();
    const now = new Date().toISOString(), day = now.slice(0, 10), hour = now.slice(0, 13);
    let s = (await this.state.storage.get("s")) || { day, n: 0, ips: {} };
    if (s.day !== day) s = { day, n: 0, ips: {} };
    for (const k of Object.keys(s.ips)) if (!k.endsWith("|" + hour)) delete s.ips[k];
    const key = ip + "|" + hour;
    if (s.n >= max) return Response.json({ ok: false, why: "dia" });
    if ((s.ips[key] || 0) >= perIp) return Response.json({ ok: false, why: "ip" });
    s.n++; s.ips[key] = (s.ips[key] || 0) + 1;
    await this.state.storage.put("s", s);
    return Response.json({ ok: true, quedan: max - s.n });
  }
}

const json = (obj, status, headers) =>
  new Response(JSON.stringify(obj), { status, headers: { "content-type": "application/json; charset=utf-8", ...headers } });

function origenPermitido(req, env) {
  const lista = String(env.ALLOWED_ORIGINS || "*").split(",").map(x => x.trim()).filter(Boolean);
  if (lista.includes("*")) return "*";
  const o = req.headers.get("origin") || "";
  return lista.includes(o) ? o : lista[0] || "";
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (url.pathname !== "/api/turn") {
      return env.ASSETS ? env.ASSETS.fetch(req) : new Response("Dibuja y adivina: servicio TURN activo", { status: 200 });
    }
    const cors = {
      "access-control-allow-origin": origenPermitido(req, env),
      "access-control-allow-methods": "GET, OPTIONS",
      "access-control-allow-headers": "content-type",
      "vary": "origin"
    };
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    if (req.method !== "GET") return json({ error: "método no permitido" }, 405, cors);
    if (!env.TURN_KEY_ID || !env.TURN_KEY_API_TOKEN) return json({ error: "faltan los secretos TURN_KEY_ID y TURN_KEY_API_TOKEN" }, 500, cors);

    const ip = req.headers.get("cf-connecting-ip") || "desconocida";
    const lim = env.LIMITER.get(env.LIMITER.idFromName("global"));
    const r = await (await lim.fetch("https://limite/", {
      method: "POST",
      body: JSON.stringify({ ip, max: +env.MAX_PER_DAY || 3000, perIp: +env.MAX_PER_IP_HOUR || 20 })
    })).json();
    if (!r.ok) return json({ error: "límite alcanzado", motivo: r.why }, 429, cors);

    const ttl = Math.min(+env.TTL || 14400, 172800);
    let res;
    try {
      res = await fetch(
        `https://rtc.live.cloudflare.com/v1/turn/keys/${encodeURIComponent(env.TURN_KEY_ID)}/credentials/generate-ice-servers`,
        { method: "POST", headers: { Authorization: "Bearer " + env.TURN_KEY_API_TOKEN, "Content-Type": "application/json" }, body: JSON.stringify({ ttl }) }
      );
    } catch (e) { return json({ error: "no se pudo contactar a Cloudflare" }, 502, cors); }
    if (!res.ok) return json({ error: "Cloudflare rechazó la petición", estado: res.status }, 502, cors);
    const d = await res.json();
    const lista = Array.isArray(d.iceServers) ? d.iceServers : d.iceServers ? [d.iceServers] : [];
    if (!lista.length) return json({ error: "respuesta inesperada de Cloudflare" }, 502, cors);
    return json({ iceServers: lista, ttl }, 200, { ...cors, "cache-control": "no-store" });
  }
};
