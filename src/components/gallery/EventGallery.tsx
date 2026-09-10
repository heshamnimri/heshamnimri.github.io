"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
  const [filter, setFilter] = useState<"all" | "favorites">("all");

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
    return filter === "favorites"
      ? manifest.photos.filter((p) => favorites.has(p.id))
      : manifest.photos;
  }, [manifest, filter, favorites]);

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

  function openPhoto(p: EventPhoto) {
    const i = manifest!.photos.indexOf(p);
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
                  setFilter((f) => (f === "all" ? "favorites" : "all"))
                }
              >
                Favorites {favorites.size ? `(${favorites.size})` : ""}
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
          photos={manifest.photos}
          index={lightbox}
          onIndex={setLightbox}
          onClose={() => setLightbox(null)}
          favorites={manifest.features?.favorites ? favorites : undefined}
          onFavorite={toggleFavorite}
        />
      )}
      {share && <ShareSheet slug={slug} title={manifest.title} onClose={() => setShare(false)} />}
      {upload && apiBase() && (
        <GuestUpload slug={slug} onClose={() => setUpload(false)} />
      )}
    </div>
  );
}
