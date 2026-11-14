// Worker for drawapp.party. Static files come from ./public (the ASSETS binding);
// this script only answers /api/* (see run_worker_first in wrangler.jsonc).
//
//   POST /api/request   drawing request -> Telegram message to the owner
//   POST /api/event     anonymous usage counter (+1), see /aporrito/ for the full list
//   GET  /api/stats     the counters, for /metrikes/; needs  Authorization: Bearer <METRICS_KEY>
//
// Bindings: METRICS (KV). Secrets: TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, METRICS_KEY.

const EVENTS = new Set(["page_view", "lesson_start", "lesson_complete", "photo_saved"]);
const PAGES = new Set(["home", "lesson", "catalog", "terms", "privacy", "metrics", "other"]);
const TTL = 60 * 60 * 24 * 400; // counters expire after ~13 months
const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }
});
const day = () => new Date().toISOString().slice(0, 10);

// Counters are KV keys "m|<day>|<kind>|<value>" with the count in the key's metadata,
// so /api/stats can read everything with list() alone. Last write wins: counts are approximate
// under heavy concurrency, which is fine for this site's traffic.
async function bump(env, kind, value) {
  const key = `m|${day()}|${kind}|${value}`;
  const { metadata } = await env.METRICS.getWithMetadata(key);
  const c = (metadata && metadata.c) || 0;
  await env.METRICS.put(key, "", { metadata: { c: c + 1 }, expirationTtl: TTL });
}

function device(ua) {
  ua = ua || "";
  if (/iPad|Tablet|Android(?!.*Mobile)/i.test(ua)) return "tablet";
  if (/Mobi|iPhone|Android/i.test(ua)) return "mobile";
  return "desktop";
}

async function event(request, env, ctx) {
  if (!env.METRICS) return new Response(null, { status: 204 });
  let b;
  try { b = await request.json(); } catch { return new Response(null, { status: 400 }); }
  if (!b || !EVENTS.has(b.e)) return new Response(null, { status: 400 });
  const lesson = typeof b.l === "string" && /^[a-z0-9-]{1,40}$/.test(b.l) ? b.l : null;
  const jobs = [];
  if (b.e === "page_view") {
    jobs.push(bump(env, "page_view", PAGES.has(b.p) ? b.p : "other"));
    if (typeof b.r === "string" && /^[a-z0-9.-]{1,80}$/i.test(b.r)) jobs.push(bump(env, "ref", b.r.toLowerCase().replace(/^www\./, "")));
    if (b.i === 1) jobs.push(bump(env, "installed", "1"));
    jobs.push(bump(env, "device", device(request.headers.get("user-agent"))));
    const country = request.cf && request.cf.country;
    if (country && /^[A-Z]{2}$/.test(country)) jobs.push(bump(env, "country", country));
  } else if (lesson) {
    jobs.push(bump(env, b.e, lesson));
  } else {
    return new Response(null, { status: 400 });
  }
  ctx.waitUntil(Promise.all(jobs).catch(() => {}));
  return new Response(null, { status: 204 });
}

function sameKey(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

async function stats(request, env) {
  if (!env.METRICS || !env.METRICS_KEY) return json({ error: "not_configured" }, 503);
  const auth = request.headers.get("authorization") || "";
  if (!sameKey(auth.replace(/^Bearer /, ""), env.METRICS_KEY)) return json({ error: "unauthorized" }, 401);
  const days = Math.min(400, Math.max(1, parseInt(new URL(request.url).searchParams.get("days"), 10) || 30));
  const since = new Date(Date.now() - (days - 1) * 86400000).toISOString().slice(0, 10);
  const rows = [];
  let cursor;
  do {
    const page = await env.METRICS.list({ prefix: "m|", cursor });
    for (const k of page.keys) {
      const [, d, kind, ...rest] = k.name.split("|");
      if (d >= since) rows.push({ d, k: kind, v: rest.join("|"), c: (k.metadata && k.metadata.c) || 0 });
    }
    cursor = page.list_complete ? undefined : page.cursor;
  } while (cursor);
  return json({ since, days, rows });
}

const clean = (s, max) => (typeof s === "string" ? s : "").replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/\s+/g, " ").trim().slice(0, max);

async function sha256(text) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("");
}

async function drawingRequest(request, env, ctx) {
  if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) return json({ ok: false, error: "not_configured" }, 503);
  let b;
  try { b = await request.json(); } catch { return json({ ok: false, error: "bad_request" }, 400); }
  if (b && b.website) return json({ ok: true }); // honeypot field: bots fill it, people never see it
  const what = clean(b && b.drawing, 200), name = clean(b && b.name, 40);
  if (what.length < 2) return json({ ok: false, error: "empty" }, 400);

  // At most 5 requests a day per connection. Only a salted hash is kept, for one day.
  if (env.METRICS) {
    const ip = request.headers.get("cf-connecting-ip") || "";
    const key = `rl|${await sha256(day() + "|" + ip + "|" + (env.METRICS_KEY || "drawapp"))}`;
    const n = parseInt((await env.METRICS.get(key)) || "0", 10);
    if (n >= 5) return json({ ok: false, error: "too_many" }, 429);
    await env.METRICS.put(key, String(n + 1), { expirationTtl: 86400 });
  }

  const when = new Date().toLocaleString("el-GR", { timeZone: "Europe/Athens" });
  const country = (request.cf && request.cf.country) || "?";
  const text = `🎨 Νέο αίτημα ζωγραφιάς\n\n${what}\n\nΑπό: ${name || "—"}\nΧώρα: ${country}\n${when}`;
  const r = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ chat_id: env.TELEGRAM_CHAT_ID, text, disable_web_page_preview: true })
  });
  if (!r.ok) return json({ ok: false, error: "send_failed" }, 502);
  if (env.METRICS) ctx.waitUntil(bump(env, "request_sent", "-").catch(() => {}));
  return json({ ok: true });
}

export default {
  async fetch(request, env, ctx) {
    const { pathname } = new URL(request.url);
    if (pathname.startsWith("/api/")) {
      try {
        if (pathname === "/api/event" && request.method === "POST") return await event(request, env, ctx);
        if (pathname === "/api/request" && request.method === "POST") return await drawingRequest(request, env, ctx);
        if (pathname === "/api/stats" && request.method === "GET") return await stats(request, env);
        return json({ error: "not_found" }, 404);
      } catch (e) {
        return json({ error: "server_error" }, 500);
      }
    }
    return env.ASSETS.fetch(request);
  }
};
