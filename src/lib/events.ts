import eventsData from "@/data/events.json";

export type EventPhoto = {
  id: string;
  w: number;
  h: number;
  bytes: number;
  taken?: string;
  caption?: string;
  ext?: string;
};

export type EventManifest = {
  slug: string;
  title: string;
  date?: string;
  note?: string;
  cover?: string;
  expires?: string;
  published?: string;
  /** sha-256 hex of the passcode; the Worker enforces it, the page gates on it. */
  passcodeHash?: string;
  brand?: { name?: string; logo?: string; accent?: string };
  license?: string;
  zip?: { file: string; bytes: number; count: number };
  features?: { favorites?: boolean; upload?: boolean; api?: boolean };
  photos: EventPhoto[];
};

export const SITE_URL = "https://hishamnimri.com";

/**
 * Where event media lives. Phase 0 serves it from /events inside the static site.
 * Phase 1+ points this at the R2 custom domain, e.g. https://media.hishamnimri.com
 */
export const MEDIA_BASE = (
  process.env.NEXT_PUBLIC_MEDIA_BASE || "/events"
).replace(/\/$/, "");

export const knownEventSlugs: string[] = eventsData.events;
export const indexSlug = `index-${eventsData.indexToken}`;

export function eventBase(slug: string) {
  return `${MEDIA_BASE}/${encodeURIComponent(slug)}`;
}

export function manifestUrl(slug: string) {
  return `${eventBase(slug)}/manifest.json`;
}

export function photoUrl(
  slug: string,
  photo: EventPhoto,
  size: "thumb" | "view" | "full",
) {
  const ext = size === "full" ? photo.ext || "jpg" : "jpg";
  return `${eventBase(slug)}/${size}/${photo.id}.${ext}`;
}

export function zipUrl(slug: string, manifest: EventManifest) {
  return manifest.zip ? `${eventBase(slug)}/${manifest.zip.file}` : null;
}

/** The Worker API lives next to the media when MEDIA_BASE is absolute. */
export function apiBase() {
  return MEDIA_BASE.startsWith("http") ? `${MEDIA_BASE}/api` : null;
}

export function galleryUrl(slug: string) {
  return `${SITE_URL}/e/${slug}`;
}

export function isExpired(manifest: EventManifest, now = new Date()) {
  if (!manifest.expires) return false;
  return new Date(manifest.expires + "T23:59:59") < now;
}

export function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(bytes > 100e6 ? 0 : 1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export function formatDate(iso?: string) {
  if (!iso) return "";
  const d = new Date(iso.length === 10 ? iso + "T12:00:00" : iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export async function sha256Hex(text: string) {
  const data = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function track(event: string, params: Record<string, unknown> = {}) {
  if (typeof window !== "undefined" && window.gtag) {
    window.gtag("event", event, params);
  }
}

/**
 * Cookies are only meaningful when the Worker fronts the media (passcode
 * cookie). A plain R2 custom domain does not send
 * Access-Control-Allow-Credentials, and browsers reject credentialed
 * requests without it, so stay in "omit" mode until the API exists.
 */
export function mediaCredentials(): RequestCredentials {
  return apiBase() ? "include" : "omit";
}
