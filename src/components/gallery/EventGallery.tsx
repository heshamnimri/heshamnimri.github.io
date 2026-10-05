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
import { Lightbox } from "./Lightbox";
import { PasscodeGate } from "./PasscodeGate";
import { ShareSheet } from "./ShareSheet";
import { GuestUpload } from "./GuestUpload";
import { FindMe, type FaceMatch } from "./FindMe";
import { LOOSE_THRESHOLD, MATCH_THRESHOLD } from "@/lib/faces/engine";
import { useFavorites } from "./useFavorites";
import { downloadSelection, SELECTION_CAP_BYTES } from "./downloadSelection";

type Status =
  | { kind: "loading" }
  | { kind: "missing" }
  | { kind: "error"; message: string }
  | { kind: "ready"; manifest: EventManifest; locked: boolean };

export function EventGallery({ slug }: { slug: string }) {
  const [status, setStatus] = useState<Status>({ kind: "loading" });
  const [lightbox, setLightbox] = useState<number | null>(null);
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [share, setShare] = useState(false);
  const [upload, setUpload] = useState(false);
  const [zipping, setZipping] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "favorites" | "me">("all");
  const [findMe, setFindMe] = useState(false);
  const [matches, setMatches] = useState<FaceMatch[] | null>(null);
  const [loose, setLoose] = useState(false);
  const findMeBar = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(manifestUrl(slug), {
        cache: "no-store",
        credentials: mediaCredentials(),
      });
      if (res.status === 404) return setStatus({ kind: "missing" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const manifest = (await res.json()) as EventManifest & {
        locked?: boolean;
      };
      const locked =
        Boolean(manifest.locked) ||
        (Boolean(manifest.passcodeHash) &&
          sessionStorage.getItem(`gallery-unlocked:${slug}`) !==
            manifest.passcodeHash);
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
  const { favorites, toggleFavorite } = useFavorites(
    slug,
    Boolean(manifest?.features?.favorites),
  );

  const photos = useMemo(() => {
    if (!manifest) return [];
    if (filter === "me" && matches) {
      const byId = new Map(manifest.photos.map((p) => [p.id, p]));
      const min = loose ? LOOSE_THRESHOLD : MATCH_THRESHOLD;
      return matches
        .filter((m) => m.score >= min && byId.has(m.id))
        .map((m) => byId.get(m.id)!);
    }
    return filter === "favorites"
      ? manifest.photos.filter((p) => favorites.has(p.id))
      : manifest.photos;
  }, [manifest, filter, favorites, matches, loose]);

  const looseExtra = useMemo(
    () =>
      matches?.filter((m) => m.score >= LOOSE_THRESHOLD && m.score < MATCH_THRESHOLD)
        .length ?? 0,
    [matches],
  );

  // Bring the results into view; on phones the cover pushes them off screen.
  useEffect(() => {
    if (matches) findMeBar.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [matches]);

  useEffect(() => {
    if (!manifest?.brand?.accent) return;
    document.documentElement.style.setProperty(
      "--gallery-accent",
      manifest.brand.accent,
    );
    return () => {
      document.documentElement.style.removeProperty("--gallery-accent");
    };
  }, [manifest?.brand?.accent]);

  if (status.kind === "loading") {
    return <div className="gallery gallery-empty"><p>Loading…</p></div>;
  }
  if (status.kind === "missing") {
    return (
      <div className="gallery gallery-empty">
        <h1>Gallery not found</h1>
        <p>
          Check the link you were sent. If it looks right, the event may have
          been taken down. <Link href="/">Sham Shots Media</Link>
        </p>
      </div>
    );
  }
  if (status.kind === "error") {
    return (
      <div className="gallery gallery-empty">
        <h1>Could not load this gallery</h1>
        <p>{status.message}. Try again in a moment.</p>
        <button className="btn" onClick={load}>Retry</button>
      </div>
    );
  }

  const { locked } = status;
  if (!manifest) return null;

  if (locked) {
    return (
      <PasscodeGate
        slug={slug}
        title={manifest.title}
        passcodeHash={manifest.passcodeHash}
        onUnlocked={load}
      />
    );
  }

  if (isExpired(manifest)) {
    return (
      <div className="gallery gallery-empty">
        <p className="gallery-kicker">Sham Shots Media</p>
        <h1>{manifest.title}</h1>
        <p>
          This gallery closed on {formatDate(manifest.expires)}. If you still
          need the photos, get in touch through{" "}
          <Link href="/about">the contact page</Link>.
        </p>
      </div>
    );
  }

  const zip = zipUrl(slug, manifest);
  const cover = manifest.cover
    ? manifest.photos.find((p) => p.id === manifest.cover) ?? manifest.photos[0]
    : manifest.photos[0];

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const selectedPhotos = manifest.photos.filter((p) => selected.has(p.id));
  const selectedBytes = selectedPhotos.reduce((n, p) => n + p.bytes, 0);
  const overCap = selectedBytes > SELECTION_CAP_BYTES;

  async function onDownloadSelection() {
    if (!selectedPhotos.length || overCap) return;
    track("download_selection", { event_slug: slug, count: selectedPhotos.length });
    await downloadSelection(slug, manifest!, selectedPhotos, setZipping);
    setZipping(null);
  }

  // Browsing your matches stays within your matches.
  const lightboxPhotos = filter === "me" ? photos : manifest.photos;

  function onFaceMatches(found: FaceMatch[]) {
    const strong = found.filter((m) => m.score >= MATCH_THRESHOLD).length;
    track("find_me_result", { event_slug: slug, count: strong });
    setMatches(found);
    setLoose(strong === 0);
    setFilter("me");
    setFindMe(false);
  }

  function selectMatches() {
    setSelecting(true);
    setSelected(new Set(photos.map((p) => p.id)));
  }

  function openPhoto(p: EventPhoto) {
    const i = lightboxPhotos.indexOf(p);
    setLightbox(i);
    track("photo_open", { event_slug: slug, photo_id: p.id });
  }

  return (
    <div className="gallery">
      <header className="gallery-head">
        {cover && (
          <div
            className="gallery-cover"
            style={{ aspectRatio: `${cover.w} / ${cover.h}` }}
          >
            <img
              src={photoUrl(slug, cover, "view")}
              alt=""
              fetchPriority="high"
            />
          </div>
        )}
        <div className="gallery-head-text">
          <p className="gallery-kicker">
            {manifest.brand?.logo && (
              <img
                className="gallery-brand-logo"
                src={manifest.brand.logo}
                alt={manifest.brand.name || ""}
              />
            )}
            {manifest.brand?.name ? `${manifest.brand.name} · ` : ""}
            Photos by Sham Shots Media
          </p>
          <h1>{manifest.title}</h1>
          <p className="gallery-meta">
            {formatDate(manifest.date)}
            {manifest.date && " · "}
            {manifest.photos.length} photos
            {manifest.expires && ` · available until ${formatDate(manifest.expires)}`}
          </p>
          {manifest.note && <p className="gallery-note">{manifest.note}</p>}
          <div className="gallery-actions">
            {zip && (
              <a
                className="btn btn-primary"
                href={zip}
                download
                onClick={() => track("download_all", { event_slug: slug })}
              >
                Download all
                <span className="btn-sub">
                  {manifest.zip!.count} photos · {formatBytes(manifest.zip!.bytes)}
                </span>
              </a>
            )}
            <button className="btn" onClick={() => setShare(true)}>
              Share
            </button>
            <button
              className={`btn ${selecting ? "btn-active" : ""}`}
              onClick={() => {
                setSelecting((s) => !s);
                setSelected(new Set());
              }}
            >
              {selecting ? "Cancel selection" : "Select photos"}
            </button>
            {manifest.features?.favorites && (
              <button
                className={`btn ${filter === "favorites" ? "btn-active" : ""}`}
                onClick={() =>
                  setFilter((f) => (f === "favorites" ? "all" : "favorites"))
                }
              >
                Favorites {favorites.size ? `(${favorites.size})` : ""}
              </button>
            )}
            {manifest.features?.findMe && (
              <button
                className={`btn ${filter === "me" ? "btn-active" : ""}`}
                onClick={() => setFindMe(true)}
              >
                Find me
              </button>
            )}
            {manifest.features?.upload && (
              <button className="btn" onClick={() => setUpload(true)}>
                Add your photos
              </button>
            )}
          </div>
        </div>
      </header>

      {photos.length === 0 && filter === "favorites" && (
        <p className="gallery-empty-note">
          No favorites yet. Tap the heart on a photo to add it here.
        </p>
      )}

      {filter === "me" && matches && (
        <div className="findme-bar" role="status" ref={findMeBar}>
          <p>
            {photos.length
              ? `Found you in ${photos.length} photo${photos.length === 1 ? "" : "s"}${loose ? ", including possible matches" : ""}.`
              : "We couldn't find you in this gallery. Try another selfie, facing the camera in good light."}
          </p>
          <div className="gallery-actions">
            {!loose && looseExtra > 0 && (
              <button className="btn" onClick={() => setLoose(true)}>
                Show {looseExtra} possible match{looseExtra === 1 ? "" : "es"}
              </button>
            )}
            {photos.length > 0 && !selecting && (
              <button className="btn" onClick={selectMatches}>
                Select these
              </button>
            )}
            <button className="btn" onClick={() => setFindMe(true)}>
              Try another selfie
            </button>
            <button
              className="btn"
              onClick={() => {
                setFilter("all");
                setMatches(null);
              }}
            >
              Show all photos
            </button>
          </div>
        </div>
      )}

      <div className="gallery-grid">
        {photos.map((p) => {
          const isSel = selected.has(p.id);
          return (
            <figure
              key={p.id}
              className={`gallery-item ${isSel ? "is-selected" : ""}`}
              style={{ aspectRatio: `${p.w} / ${p.h}` }}
            >
              <button
                className="gallery-item-btn"
                onClick={() => (selecting ? toggleSelect(p.id) : openPhoto(p))}
                aria-label={selecting ? `Select photo ${p.id}` : `Open photo ${p.id}`}
                aria-pressed={selecting ? isSel : undefined}
              >
                <img
                  src={photoUrl(slug, p, "thumb")}
                  alt={p.caption || ""}
                  loading="lazy"
                  decoding="async"
                  width={p.w}
                  height={p.h}
                />
              </button>
              {selecting && <span className="gallery-check" aria-hidden />}
              {manifest.features?.favorites && !selecting && (
                <button
                  className={`gallery-heart ${favorites.has(p.id) ? "is-on" : ""}`}
                  aria-label={favorites.has(p.id) ? "Remove favorite" : "Add favorite"}
                  onClick={() => toggleFavorite(p.id)}
                >
                  ♥
                </button>
              )}
            </figure>
          );
        })}
      </div>

      <footer className="gallery-foot">
        <p>
          <Link href="/">Sham Shots Media</Link> · Hesham Nimri
        </p>
        <p className="gallery-license">
          {manifest.license ||
            "Personal use is welcome. Please credit Hesham Nimri when you share."}
        </p>
      </footer>

      {selecting && (
        <div className="selection-bar" role="region" aria-label="Selection">
          <span>
            {selected.size} selected
            {selected.size > 0 && ` · ${formatBytes(selectedBytes)}`}
            {overCap && ` · over the ${formatBytes(SELECTION_CAP_BYTES)} limit, use Download all`}
          </span>
          <button
            className="btn btn-primary"
            disabled={!selected.size || overCap || zipping !== null}
            onClick={onDownloadSelection}
          >
            {zipping ?? "Download selected"}
          </button>
        </div>
      )}

      {lightbox !== null && (
        <Lightbox
          slug={slug}
          photos={lightboxPhotos}
          index={lightbox}
          onIndex={setLightbox}
          onClose={() => setLightbox(null)}
          favorites={manifest.features?.favorites ? favorites : undefined}
          onFavorite={toggleFavorite}
        />
      )}
      {share && <ShareSheet slug={slug} title={manifest.title} onClose={() => setShare(false)} />}
      {findMe && (
        <FindMe slug={slug} onResult={onFaceMatches} onClose={() => setFindMe(false)} />
      )}
      {upload && apiBase() && (
        <GuestUpload slug={slug} onClose={() => setUpload(false)} />
      )}
    </div>
  );
}
