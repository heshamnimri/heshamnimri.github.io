/**
 * Sham Shots media Worker (Phase 3).
 *
 * Sits in front of the R2 bucket on media.hishamnimri.com and adds what a
 * static site cannot do on its own:
 *   - real passcode enforcement (signed, scoped cookie)
 *   - Content-Disposition: attachment on ?download=1
 *   - shared favorites per guest (KV)
 *   - guest uploads into an inbox, reviewed with the publish script
 *
 * Routes
 *   GET  /events/:slug/manifest.json       manifest (photos stripped + locked:true when protected)
 *   GET  /events/:slug/<thumb|view|full>/* media, gated when protected
 *   GET  /events/:slug/all-photos.zip      gated when protected
 *   POST /api/:slug/unlock {passcode}      sets gallery cookie
 *   GET  /api/:slug/favorites?guest=<id>   {ids:[...]}
 *   POST /api/:slug/favorites {guest,id,on}
 *   GET  /api/:slug/favorites/all          all guests' favorites (admin key)
 *   POST /api/:slug/upload  multipart file+name  -> events/:slug/inbox/
 *   GET  /api/:slug/inbox                  list inbox (admin key)
 *   DELETE /api/:slug/inbox/:key           remove an inbox item (admin key)
 *
 * Admin requests send `Authorization: Bearer <ADMIN_KEY>`.
 */

const COOKIE_TTL_S = 60 * 60 * 24 * 14;
const UPLOAD_MAX_BYTES = 40 * 1024 * 1024;
const UPLOAD_TYPES = new Set(["image/jpeg", "image/png", "image/heic", "image/webp"]);

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin");
    const cors = corsHeaders(origin, env);

    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });

    try {
      let res;
      if (url.pathname.startsWith("/api/")) res = await handleApi(request, url, env);
      else if (url.pathname.startsWith("/events/")) res = await handleMedia(request, url, env, ctx);
      else res = json({ ok: true, service: "sham-shots-media" });
      for (const [k, v] of Object.entries(cors)) res.headers.set(k, v);
      return res;
    } catch (err) {
      console.error(err);
      return json({ error: "internal" }, 500, cors);
    }
  },
};

/* ---------- media ---------- */

async function handleMedia(request, url, env, ctx) {
  if (request.method !== "GET" && request.method !== "HEAD") return json({ error: "method" }, 405);
  const m = url.pathname.match(/^\/events\/([^/]+)\/(.+)$/);
  if (!m) return json({ error: "not found" }, 404);
  const [, slug, rest] = m;
  if (rest.startsWith("inbox/")) return json({ error: "not found" }, 404);

  const manifest = await readManifest(env, slug);
  if (!manifest) return json({ error: "not found" }, 404);
  const isProtected = Boolean(manifest.passcodeHash);
  const unlocked = isProtected ? await hasValidCookie(request, env, slug) : true;

  if (rest === "manifest.json") {
    if (isProtected && !unlocked) {
      const { passcodeHash, photos, zip, ...rest } = manifest;
      return json({ ...rest, photos: [], locked: true }, 200, { "Cache-Control": "no-store" });
    }
    const { passcodeHash, ...safe } = manifest;
    return json(safe, 200, { "Cache-Control": "no-store" });
  }

  if (!unlocked) return json({ error: "locked" }, 401);

  const key = `events/${slug}/${rest}`;
  const cache = caches.default;
  const cacheKey = new Request(url.toString(), { method: "GET" });
  let cached = isProtected ? null : await cache.match(cacheKey);
  if (cached) return new Response(cached.body, cached);

  const obj = await env.MEDIA.get(key);
  if (!obj) return json({ error: "not found" }, 404);

  const headers = new Headers();
  obj.writeHttpMetadata(headers);
  headers.set("ETag", obj.httpEtag);
  headers.set("Accept-Ranges", "bytes");
  headers.set("Cache-Control", isProtected ? "private, max-age=3600" : "public, max-age=31536000, immutable");
  if (!headers.get("Content-Type")) headers.set("Content-Type", guessType(rest));
  if (url.searchParams.get("download") === "1" || rest.endsWith(".zip")) {
    const name = rest.split("/").pop();
    headers.set("Content-Disposition", `attachment; filename="${slug}-${name}"`);
  }
  const res = new Response(obj.body, { headers });
  if (!isProtected && request.method === "GET" && !url.searchParams.has("download")) {
    ctx.waitUntil(cache.put(cacheKey, res.clone()));
  }
  return res;
}

/* ---------- api ---------- */

async function handleApi(request, url, env) {
  const m = url.pathname.match(/^\/api\/([^/]+)\/([^/]+)(?:\/(.+))?$/);
  if (!m) return json({ error: "not found" }, 404);
  const [, slug, action, extra] = m;
  const manifest = await readManifest(env, slug);
  if (!manifest) return json({ error: "not found" }, 404);
  const isAdmin = isAdminRequest(request, env);
  const unlocked = manifest.passcodeHash ? await hasValidCookie(request, env, slug) : true;

  if (action === "unlock" && request.method === "POST") {
    const body = await request.json().catch(() => ({}));
    const hash = await sha256Hex(String(body.passcode ?? "").trim());
    if (!manifest.passcodeHash || hash !== manifest.passcodeHash) return json({ error: "bad passcode" }, 401);
    const token = await signToken(env, slug, Date.now() + COOKIE_TTL_S * 1000);
    return json(
      { ok: true },
      200,
      { "Set-Cookie": `${cookieName(slug)}=${token}; Path=/; Max-Age=${COOKIE_TTL_S}; HttpOnly; Secure; SameSite=None` },
    );
  }

  if (action === "favorites") {
    if (!manifest.features?.favorites) return json({ error: "favorites off" }, 404);
    if (extra === "all") {
      if (!isAdmin) return json({ error: "unauthorized" }, 401);
      const list = await env.STATE.list({ prefix: `fav:${slug}:` });
      const all = {};
      for (const k of list.keys) {
        const guest = k.name.slice(`fav:${slug}:`.length);
        all[guest] = JSON.parse((await env.STATE.get(k.name)) || "[]");
      }
      const counts = {};
      for (const ids of Object.values(all)) for (const id of ids) counts[id] = (counts[id] || 0) + 1;
      return json({ guests: all, counts });
    }
    if (!unlocked) return json({ error: "locked" }, 401);
    if (request.method === "GET") {
      const guest = sanitizeId(url.searchParams.get("guest"));
      if (!guest) return json({ ids: [] });
      return json({ ids: JSON.parse((await env.STATE.get(`fav:${slug}:${guest}`)) || "[]") });
    }
    if (request.method === "POST") {
      const body = await request.json().catch(() => ({}));
      const guest = sanitizeId(body.guest);
      const id = sanitizeId(body.id);
      if (!guest || !id) return json({ error: "bad request" }, 400);
      const key = `fav:${slug}:${guest}`;
      const ids = new Set(JSON.parse((await env.STATE.get(key)) || "[]"));
      if (body.on) ids.add(id);
      else ids.delete(id);
      await env.STATE.put(key, JSON.stringify([...ids]), { expirationTtl: 60 * 60 * 24 * 400 });
      return json({ ids: [...ids] });
    }
  }

  if (action === "upload" && request.method === "POST") {
    if (!manifest.features?.upload) return json({ error: "uploads off" }, 404);
    if (!unlocked) return json({ error: "locked" }, 401);
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return json({ error: "no file" }, 400);
    if (file.size > UPLOAD_MAX_BYTES) return json({ error: "too large" }, 413);
    if (!UPLOAD_TYPES.has(file.type)) return json({ error: "unsupported type" }, 415);
    const name = String(form.get("name") || "").slice(0, 80);
    const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
    const key = `events/${slug}/inbox/${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${ext}`;
    await env.MEDIA.put(key, file.stream(), {
      httpMetadata: { contentType: file.type },
      customMetadata: { guest: name, originalName: file.name.slice(0, 120) },
    });
    return json({ ok: true, key });
  }

  if (action === "inbox") {
    if (!isAdmin) return json({ error: "unauthorized" }, 401);
    if (request.method === "GET") {
      const list = await env.MEDIA.list({ prefix: `events/${slug}/inbox/` });
      return json({
        items: list.objects.map((o) => ({
          key: o.key,
          bytes: o.size,
          uploaded: o.uploaded,
          guest: o.customMetadata?.guest,
          originalName: o.customMetadata?.originalName,
        })),
      });
    }
    if (request.method === "DELETE" && extra) {
      await env.MEDIA.delete(`events/${slug}/inbox/${extra}`);
      return json({ ok: true });
    }
  }

  return json({ error: "not found" }, 404);
}

/* ---------- helpers ---------- */

async function readManifest(env, slug) {
  if (!/^[\w-]+$/.test(slug)) return null;
  const obj = await env.MEDIA.get(`events/${slug}/manifest.json`);
  return obj ? obj.json() : null;
}

function isAdminRequest(request, env) {
  const auth = request.headers.get("Authorization") || "";
  return Boolean(env.ADMIN_KEY) && auth === `Bearer ${env.ADMIN_KEY}`;
}

function cookieName(slug) {
  return `g_${slug.replace(/[^\w]/g, "_")}`;
}

async function hasValidCookie(request, env, slug) {
  const raw = request.headers.get("Cookie") || "";
  const m = raw.match(new RegExp(`(?:^|;\\s*)${cookieName(slug)}=([^;]+)`));
  if (!m) return false;
  const [expStr, sig] = m[1].split(".");
  const exp = Number(expStr);
  if (!exp || exp < Date.now()) return false;
  const expected = await hmac(env, `${slug}:${exp}`);
  return timingSafeEqual(sig, expected);
}

async function signToken(env, slug, exp) {
  return `${exp}.${await hmac(env, `${slug}:${exp}`)}`;
}

async function hmac(env, text) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(env.COOKIE_SECRET || "dev-secret"),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(text));
  return hex(sig);
}

async function sha256Hex(text) {
  return hex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)));
}

function hex(buf) {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function timingSafeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function sanitizeId(v) {
  const s = String(v ?? "").replace(/[^\w-]/g, "").slice(0, 64);
  return s || null;
}

function guessType(name) {
  const ext = name.split(".").pop().toLowerCase();
  return { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", zip: "application/zip", json: "application/json" }[ext] || "application/octet-stream";
}

function corsHeaders(origin, env) {
  const allowed = (env.ALLOWED_ORIGINS || "https://hishamnimri.com,https://www.hishamnimri.com,https://shamshots.com").split(",");
  const ok = origin && (allowed.includes(origin) || /^http:\/\/localhost(:\d+)?$/.test(origin));
  return {
    "Access-Control-Allow-Origin": ok ? origin : allowed[0],
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Methods": "GET, HEAD, POST, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Expose-Headers": "Content-Disposition, Content-Length",
    Vary: "Origin",
  };
}

function json(body, status = 200, extra = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...extra },
  });
}
