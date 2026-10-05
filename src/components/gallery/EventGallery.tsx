"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  mediaCredentials,
  apiBase,
  formatBytes,
  formatDate,
  isExpired,
  manifestUrl,
  photoUrl,
  track,
  zipUrl,
  type EventManifest,
  type EventPhoto,
} from "@/lib/events";
import { LOOSE_THRESHOLD, MATCH_THRESHOLD } from "@/lib/faces/engine";
import { Lightbox } from "./Lightbox";
import { PasscodeGate } from "./PasscodeGate";
import { ShareSheet } from "./ShareSheet";
import { GuestUpload } from "./GuestUpload";
import { FaceIcon, FindMe, type FaceMatch } from "./FindMe";
import { useFavorites } from "./useFavorites";
import { downloadSelection, SELECTION_CAP_BYTES } from "./downloadSelection";
import { savePhoto } from "./savePhoto";
import { galleryFonts } from "./fonts";
import { ItalicTail, progressBar } from "./ui";

type Status =
  | { kind: "loading" }
  | { kind: "missing" }
  | { kind: "error"; message: string }
  | { kind: "ready"; manifest: EventManifest; locked: boolean };

type Download =
  | { kind: "progress"; p: number; sub: string }
  | { kind: "done"; label: string; sub: string }
  | { kind: "failed" };

const DEFAULT_LICENSE = "Personal use is welcome. Please credit Hesham Nimri when you share.";
const pad = (n: number) => String(n).padStart(3, "0");
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

export function EventGallery({ slug }: { slug: string }) {
  const [status, setStatus] = useState<Status>({ kind: "loading" });
  const [lightbox, setLightbox] = useState<number | null>(null);
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sheet, setSheet] = useState<"share" | "upload" | null>(null);
  const [findMe, setFindMe] = useState<"intro" | "camera" | null>(null);
  const [filter, setFilter] = useState<"all" | "favorites" | "me">("all");
  const [density, setDensity] = useState<"dense" | "large">("dense");
  const [matches, setMatches] = useState<FaceMatch[] | null>(null);
  const [selfie, setSelfie] = useState<string | null>(null);
  const [loose, setLoose] = useState(false);
  const [download, setDownload] = useState<Download | null>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const zipLink = useRef<HTMLAnchorElement>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(manifestUrl(slug), {
        cache: "no-store",
        credentials: mediaCredentials(),
      });
      if (res.status === 404) return setStatus({ kind: "missing" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const manifest = (await res.json()) as EventManifest & { locked?: boolean };
      const locked =
        Boolean(manifest.locked) ||
        (Boolean(manifest.passcodeHash) &&
          sessionStorage.getItem(`gallery-unlocked:${slug}`) !== manifest.passcodeHash);
      setStatus({ kind: "ready", manifest, locked });
      track("gallery_view", { event_slug: slug, photo_count: manifest.photos?.length ?? 0 });
    } catch (e) {
      setStatus({ kind: "error", message: (e as Error).message });
    }
  }, [slug]);

  useEffect(() => {
    load();
  }, [load]);

  const manifest = status.kind === "ready" ? status.manifest : null;
  const { favorites, toggleFavorite } = useFavorites(slug, Boolean(manifest?.features?.favorites));

  const numbers = useMemo(
    () => new Map(manifest?.photos.map((p, i) => [p.id, i + 1]) ?? []),
    [manifest],
  );

  const photos = useMemo(() => {
    if (!manifest) return [];
    if (filter === "me" && matches) {
      const byId = new Map(manifest.photos.map((p) => [p.id, p]));
      const min = loose ? LOOSE_THRESHOLD : MATCH_THRESHOLD;
      return matches.filter((m) => m.score >= min && byId.has(m.id)).map((m) => byId.get(m.id)!);
    }
    if (filter === "favorites") return manifest.photos.filter((p) => favorites.has(p.id));
    return manifest.photos;
  }, [manifest, filter, favorites, matches, loose]);

  const looseExtra = useMemo(
    () => matches?.filter((m) => m.score >= LOOSE_THRESHOLD && m.score < MATCH_THRESHOLD).length ?? 0,
    [matches],
  );

  // Bring the results card into view; on phones the hero pushes it off screen.
  useEffect(() => {
    if (matches) resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [matches]);

  // Unfavoriting inside the favorites view can shrink the list under the lightbox.
  useEffect(() => {
    if (lightbox === null) return;
    if (!photos.length) setLightbox(null);
    else if (lightbox >= photos.length) setLightbox(photos.length - 1);
  }, [photos.length, lightbox]);

  useEffect(() => {
    if (!manifest?.brand?.accent) return;
    document.documentElement.style.setProperty("--g-green", manifest.brand.accent);
    return () => {
      document.documentElement.style.removeProperty("--g-green");
    };
  }, [manifest?.brand?.accent]);

  if (status.kind === "loading") {
    return (
      <div className={`gallery ${galleryFonts}`}>
        <div className="g-page">
          <p className="g-kicker">Loading…</p>
        </div>
      </div>
    );
  }
  if (status.kind === "missing") {
    return (
      <PageMessage kicker="Sham Shots Media" title="Gallery not found">
        Check the link you were sent. If it looks right, the event may have been taken down.{" "}
        <Link href="/">Sham Shots Media</Link>
      </PageMessage>
    );
  }
  if (status.kind === "error") {
    return (
      <PageMessage kicker="Sham Shots Media" title="Could not load this gallery">
        {status.message}. Try again in a moment.
        <span style={{ display: "block", marginTop: 16 }}>
          <button className="g-btn g-btn-ink g-btn-shadow" onClick={load}>
            Retry
          </button>
        </span>
      </PageMessage>
    );
  }
  if (!manifest) return null;

  if (status.locked) {
    return (
      <PasscodeGate slug={slug} title={manifest.title} passcodeHash={manifest.passcodeHash} onUnlocked={load} />
    );
  }

  if (isExpired(manifest)) {
    return (
      <PageMessage kicker="Photos by Sham Shots Media" title={manifest.title}>
        This gallery closed on {formatDate(manifest.expires)}. If you still need the photos, get in touch through{" "}
        <Link href="/about">the contact page</Link>.
      </PageMessage>
    );
  }

  const m = manifest;
  const zip = zipUrl(slug, m);
  const cover = (m.cover && m.photos.find((p) => p.id === m.cover)) || m.photos[0];
  const totalBytes = m.zip?.bytes ?? m.photos.reduce((n, p) => n + p.bytes, 0);
  const license = m.license || DEFAULT_LICENSE;
  const numberOf = (p: EventPhoto) => numbers.get(p.id) ?? 0;
  const lightboxPhotos = filter === "all" ? m.photos : photos;
  const viewDensity = filter === "me" ? "large" : density;

  const selectedPhotos = m.photos.filter((p) => selected.has(p.id));
  const sizeOf = (list: EventPhoto[]) => list.reduce((n, p) => n + p.bytes, 0);
  const busy = download?.kind === "progress";

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function finish(label: string, sub: string, after?: () => void) {
    setDownload({ kind: "done", label, sub });
    setTimeout(() => {
      setDownload(null);
      after?.();
    }, 1800);
  }

  function downloadAll() {
    if (!zip || busy) return;
    track("download_all", { event_slug: slug });
    zipLink.current?.click();
    // The browser owns this download, so confirm it started rather than fake progress.
    finish("Download started ✓", `${formatBytes(m.zip!.bytes)} zip · check your downloads`);
  }

  async function downloadList(list: EventPhoto[], event: string) {
    if (!list.length || busy) return;
    track(event, { event_slug: slug, count: list.length });
    const sub = `${plural(list.length, "photo")} · ${formatBytes(sizeOf(list))}`;
    const exitSelect = () => {
      setSelecting(false);
      setSelected(new Set());
    };
    try {
      if (list.length === 1) {
        setDownload({ kind: "progress", p: 0.5, sub });
        const r = await savePhoto(slug, list[0]);
        if (r === "cancelled" || r === "opened") return setDownload(null);
      } else {
        setDownload({ kind: "progress", p: 0, sub });
        await downloadSelection(slug, m, list, (p) => setDownload({ kind: "progress", p, sub }));
      }
      finish("Done ✓", "Saved to your downloads", exitSelect);
    } catch {
      setDownload({ kind: "failed" });
      setTimeout(() => setDownload(null), 2600);
    }
  }

  // What the big button in the floating bar says and does right now.
  let primary: { label: string; sub: string; disabled?: boolean; onClick: () => void };
  const visibleOverCap = sizeOf(photos) > SELECTION_CAP_BYTES;
  if (download?.kind === "progress") {
    primary = { label: progressBar(download.p), sub: download.sub, onClick: () => {} };
  } else if (download?.kind === "done") {
    primary = { label: download.label.toUpperCase(), sub: download.sub, onClick: () => {} };
  } else if (download?.kind === "failed") {
    primary = { label: "DOWNLOAD FAILED", sub: "Check your connection and try again", onClick: () => {} };
  } else if (selecting) {
    const bytes = sizeOf(selectedPhotos);
    const over = bytes > SELECTION_CAP_BYTES;
    primary = selectedPhotos.length
      ? {
          label: `DOWNLOAD ${selectedPhotos.length}`,
          sub: over ? `${formatBytes(bytes)} · over the ${formatBytes(SELECTION_CAP_BYTES)} limit` : formatBytes(bytes),
          disabled: over,
          onClick: () => downloadList(selectedPhotos, "download_selection"),
        }
      : { label: "SELECT PHOTOS", sub: "Tap photos to choose", disabled: true, onClick: () => {} };
  } else if (filter !== "all" && photos.length) {
    primary = {
      label: filter === "me" ? `DOWNLOAD YOUR ${photos.length}` : `DOWNLOAD ${photos.length}`,
      sub: visibleOverCap ? "Too many for one zip · use Select" : `${plural(photos.length, "photo")} · ${formatBytes(sizeOf(photos))}`,
      disabled: visibleOverCap,
      onClick: () => downloadList(photos, filter === "me" ? "download_find_me" : "download_selection"),
    };
  } else if (zip) {
    primary = {
      label: "DOWNLOAD ALL",
      sub: `${plural(m.zip!.count, "photo")} · ${formatBytes(m.zip!.bytes)}`,
      onClick: downloadAll,
    };
  } else {
    primary = { label: "SELECT TO DOWNLOAD", sub: "Pick the photos you want", onClick: () => setSelecting(true) };
  }

  function onFaceMatches(found: FaceMatch[], selfieUrl: string) {
    const strong = found.filter((x) => x.score >= MATCH_THRESHOLD).length;
    track("find_me_result", { event_slug: slug, count: strong });
    setMatches(found);
    setSelfie(selfieUrl);
    setLoose(false);
    setFilter("me");
    setSelecting(false);
    setSelected(new Set());
    setFindMe(null);
  }

  function clearFilter() {
    setFilter("all");
    setMatches(null);
    setSelecting(false);
    setSelected(new Set());
  }

  function selectVisible() {
    setSelecting(true);
    setSelected(new Set(photos.map((p) => p.id)));
  }

  function openPhoto(p: EventPhoto) {
    setLightbox(lightboxPhotos.indexOf(p));
    track("photo_open", { event_slug: slug, photo_id: p.id });
  }

  const toolbarLabel =
    filter === "me"
      ? photos.length
        ? `Your photos · ${photos.length}`
        : "No matches"
      : filter === "favorites"
        ? `Favorites · ${photos.length}`
        : `${m.photos.length} photos · ${formatBytes(totalBytes)}`;

  return (
    <div className={`gallery ${galleryFonts}`}>
      {zip && <a ref={zipLink} href={zip} download hidden aria-hidden tabIndex={-1} />}

      <header className="g-hero">
        {cover && <img className="g-hero-img" src={photoUrl(slug, cover, "view")} alt="" fetchPriority="high" />}
        <div className="g-hero-fade" />
        <div className="g-hero-top">
          {m.features?.upload && apiBase() && (
            <button className="g-btn g-btn-sm g-btn-paper g-btn-shadow" onClick={() => setSheet("upload")}>
              Add photos
            </button>
          )}
          <button className="g-btn g-btn-sm g-btn-paper g-btn-shadow" onClick={() => setSheet("share")}>
            Share
          </button>
        </div>
        <div className="g-hero-body">
          <span className="g-kicker">
            {m.brand?.logo && <img src={m.brand.logo} alt={m.brand.name || ""} />}
            {m.brand?.name ? `${m.brand.name} · ` : ""}Photos by Sham Shots Media
          </span>
          <h1 className="g-title">
            <ItalicTail text={m.title} />
          </h1>
          <span className="g-meta">
            {[formatDate(m.date), plural(m.photos.length, "photo"), m.expires && `available until ${formatDate(m.expires)}`]
              .filter(Boolean)
              .join(" · ")}
          </span>
          {m.note && <p className="g-note">{m.note}</p>}
          {m.features?.findMe && (
            <div className="g-find">
              <button className="g-btn g-btn-green g-btn-shadow" onClick={() => setFindMe("intro")}>
                <FaceIcon />
                Find me
              </button>
              <span>Take a selfie to see the photos you&apos;re in.</span>
            </div>
          )}
        </div>
      </header>

      {filter === "me" && matches && (
        <div className="g-results">
          <div className="g-card" ref={resultsRef} role="status">
            <div className="g-results-head">
              {selfie && <img className="g-selfie" src={selfie} alt="Your selfie" />}
              <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                <span className={`g-tag ${photos.length ? "g-tag-match" : ""}`}>
                  Find me · {photos.length ? "match" : "no match"}
                </span>
                <span className="g-results-title">
                  {photos.length ? `Found you in ${plural(photos.length, "photo")}.` : "No photos found."}
                </span>
              </div>
            </div>
            {!photos.length && <span className="g-results-tip">Try a clear, front-facing selfie in good light.</span>}
            {!loose && looseExtra > 0 && (
              <button className="g-linkish" onClick={() => setLoose(true)}>
                + Show {looseExtra} possible match{looseExtra === 1 ? "" : "es"}
              </button>
            )}
            <div className="g-results-actions">
              {photos.length > 0 && (
                <button className="g-btn g-btn-ink" onClick={selectVisible}>
                  Select these
                </button>
              )}
              <button className="g-btn" onClick={() => setFindMe("camera")}>
                Try another selfie
              </button>
              <button className={`g-btn ${photos.length ? "g-span" : ""}`} onClick={clearFilter}>
                Show all photos
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="g-toolbar">
        <div className="g-toolbar-left">
          <span className="g-toolbar-label">{toolbarLabel}</span>
          {filter !== "all" && (
            <button className="g-btn g-btn-xs" onClick={clearFilter}>
              ✕ Clear
            </button>
          )}
        </div>
        <div className="g-toolbar-right">
          {m.features?.favorites && (
            <button
              className="g-btn g-btn-xs g-fav-filter"
              style={{ minHeight: 30 }}
              aria-pressed={filter === "favorites"}
              onClick={() => setFilter((f) => (f === "favorites" ? "all" : "favorites"))}
            >
              ♥ {favorites.size || ""}
            </button>
          )}
          <div className="g-seg" role="group" aria-label="Grid size">
            <button aria-pressed={viewDensity === "dense"} aria-label="Small tiles" onClick={() => setDensity("dense")}>
              <svg width="13" height="13" viewBox="0 0 14 14" fill="currentColor" aria-hidden>
                {[0, 5, 10].flatMap((y) => [0, 5, 10].map((x) => <rect key={`${x}${y}`} x={x} y={y} width="4" height="4" />))}
              </svg>
            </button>
            <button aria-pressed={viewDensity === "large"} aria-label="Large tiles" onClick={() => setDensity("large")}>
              <svg width="13" height="13" viewBox="0 0 14 14" fill="currentColor" aria-hidden>
                {[0, 7.5].flatMap((y) => [0, 7.5].map((x) => <rect key={`${x}${y}`} x={x} y={y} width="6.5" height="6.5" />))}
              </svg>
            </button>
          </div>
        </div>
      </div>

      {filter === "favorites" && !photos.length && (
        <p className="g-empty-note">No favorites yet. Tap ♥ on a photo to add it here.</p>
      )}

      <div className="g-grid" data-density={viewDensity}>
        {photos.map((p) => {
          const isSel = selected.has(p.id);
          return (
            <div key={p.id} className={`g-tile ${isSel ? "is-selected" : ""}`}>
              <button
                className="g-tile-btn"
                onClick={() => (selecting ? toggleSelect(p.id) : openPhoto(p))}
                aria-label={`${selecting ? "Select" : "Open"} photo ${numberOf(p)}`}
                aria-pressed={selecting ? isSel : undefined}
              >
                <img src={photoUrl(slug, p, "thumb")} alt={p.caption || ""} loading="lazy" decoding="async" />
              </button>
              {selecting && <span className="g-check" aria-hidden>{isSel ? "×" : ""}</span>}
              <span className="g-num" aria-hidden>{pad(numberOf(p))}</span>
              {m.features?.favorites && !selecting && (
                <button
                  className={`g-heart ${favorites.has(p.id) ? "is-on" : ""}`}
                  aria-label={favorites.has(p.id) ? "Remove favorite" : "Add favorite"}
                  aria-pressed={favorites.has(p.id)}
                  onClick={() => toggleFavorite(p.id)}
                >
                  ♥
                </button>
              )}
            </div>
          );
        })}
      </div>

      <footer className="g-foot">
        <div className="g-foot-line">
          <Link href="/">Sham Shots Media</Link>
          <span>·</span>
          <span>Hesham Nimri</span>
        </div>
        <span className="g-foot-license">{license}</span>
      </footer>

      <div className="g-actionbar" role="region" aria-label="Download">
        <button
          className="g-primary"
          onClick={primary.onClick}
          aria-disabled={primary.disabled || busy || undefined}
          disabled={primary.disabled}
          aria-live="polite"
        >
          <span className="g-primary-label">{primary.label}</span>
          <span className="g-primary-sub">{primary.sub}</span>
        </button>
        <button
          className="g-btn g-secondary"
          disabled={busy}
          onClick={() => {
            setSelecting((s) => !s);
            setSelected(new Set());
          }}
        >
          {selecting ? "Cancel" : "Select"}
        </button>
      </div>

      {lightbox !== null && lightboxPhotos[lightbox] && (
        <Lightbox
          slug={slug}
          photos={lightboxPhotos}
          index={lightbox}
          numberOf={numberOf}
          total={m.photos.length}
          onIndex={setLightbox}
          onClose={() => setLightbox(null)}
          favorites={m.features?.favorites ? favorites : undefined}
          onFavorite={toggleFavorite}
        />
      )}
      {sheet === "share" && (
        <ShareSheet slug={slug} title={m.title} license={license} onClose={() => setSheet(null)} />
      )}
      {sheet === "upload" && apiBase() && <GuestUpload slug={slug} onClose={() => setSheet(null)} />}
      {findMe && (
        <FindMe
          slug={slug}
          photos={m.photos}
          start={findMe}
          onResult={onFaceMatches}
          onClose={() => setFindMe(null)}
        />
      )}
    </div>
  );
}

export function PageMessage({
  kicker,
  title,
  children,
}: {
  kicker: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`gallery ${galleryFonts}`}>
      <div className="g-page">
        <span className="g-kicker">{kicker}</span>
        <h1 className="g-title">
          <ItalicTail text={title} />
        </h1>
        <p>{children}</p>
      </div>
    </div>
  );
}
