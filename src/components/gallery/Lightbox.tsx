"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { formatBytes, photoUrl, track, type EventPhoto } from "@/lib/events";
import { savePhoto } from "./savePhoto";
import { useLayer } from "./ui";

type Props = {
  slug: string;
  photos: EventPhoto[];
  index: number;
  /** Catalogue number (1-based position in the whole event) for a photo. */
  numberOf: (p: EventPhoto) => number;
  total: number;
  onIndex: (i: number) => void;
  onClose: () => void;
  favorites?: Set<string>;
  onFavorite?: (id: string) => void;
};

const pad = (n: number) => String(n).padStart(3, "0");

export function Lightbox({
  slug,
  photos,
  index,
  numberOf,
  total,
  onIndex,
  onClose,
  favorites,
  onFavorite,
}: Props) {
  const photo = photos[index];
  const [saving, setSaving] = useState<"busy" | "saved" | null>(null);
  const touch = useRef<{ x: number; y: number } | null>(null);
  const lastSwipe = useRef(0);

  useLayer(onClose);

  const go = useCallback(
    (delta: number) => onIndex((index + delta + photos.length) % photos.length),
    [index, photos.length, onIndex],
  );

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowRight") go(1);
      else if (e.key === "ArrowLeft") go(-1);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [go]);

  // Preload neighbours so advancing feels instant.
  useEffect(() => {
    [1, -1].forEach((d) => {
      const p = photos[(index + d + photos.length) % photos.length];
      if (p) new Image().src = photoUrl(slug, p, "view");
    });
  }, [index, photos, slug]);

  useEffect(() => setSaving(null), [index]);

  if (!photo) return null;

  function onTouchStart(e: React.TouchEvent) {
    if (e.touches.length !== 1) return;
    touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  }
  function onTouchEnd(e: React.TouchEvent) {
    const start = touch.current;
    touch.current = null;
    if (!start) return;
    const dx = e.changedTouches[0].clientX - start.x;
    const dy = e.changedTouches[0].clientY - start.y;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      lastSwipe.current = Date.now();
      go(dx < 0 ? 1 : -1);
    } else if (dy > 90 && Math.abs(dy) > Math.abs(dx) * 1.5) {
      lastSwipe.current = Date.now();
      onClose();
    }
  }
  // A swipe also fires a click on the half it ended on; ignore that one.
  const tap = (delta: number) => () => {
    if (Date.now() - lastSwipe.current > 400) go(delta);
  };

  async function onDownload() {
    if (saving === "busy") return;
    setSaving("busy");
    track("download_photo", { event_slug: slug, photo_id: photo.id });
    const result = await savePhoto(slug, photo);
    if (result === "cancelled" || result === "opened") return setSaving(null);
    setSaving("saved");
    setTimeout(() => setSaving((s) => (s === "saved" ? null : s)), 1600);
  }

  const num = numberOf(photo);
  const isFav = favorites?.has(photo.id);
  const from = Math.max(0, index - 4);
  const strip = photos.slice(from, index + 5);
  const counter =
    photos.length === total
      ? `Nº ${pad(num)} / ${total}`
      : `Nº ${pad(num)} · ${index + 1} of ${photos.length}`;

  return (
    <div
      className="g-lightbox"
      role="dialog"
      aria-modal="true"
      aria-label={`Photo ${index + 1} of ${photos.length}`}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      <div className="g-lb-top">
        <button className="g-btn g-btn-sm" onClick={onClose}>
          ✕ Close
        </button>
        <span className="g-lb-count">{counter}</span>
      </div>

      <div className="g-lb-stage">
        <img key={photo.id} src={photoUrl(slug, photo, "view")} alt={photo.caption || ""} draggable={false} />
        <button className="g-lb-half prev" onClick={tap(-1)} aria-label="Previous photo" />
        <button className="g-lb-half next" onClick={tap(1)} aria-label="Next photo" />
      </div>

      <div className="g-lb-bottom">
        <div className="g-lb-info">
          <span className="g-lb-title">Nº {pad(num)}</span>
          <span className="g-lb-meta">
            {photo.caption ? `${photo.caption} · ` : ""}
            {photo.id}.{photo.ext || "jpg"} · {formatBytes(photo.bytes)}
          </span>
        </div>
        <div className="g-lb-actions">
          {favorites && onFavorite && (
            <button
              className={`g-icon-btn ${isFav ? "is-on" : ""}`}
              onClick={() => onFavorite(photo.id)}
              aria-label={isFav ? "Remove favorite" : "Add favorite"}
              aria-pressed={isFav}
            >
              ♥
            </button>
          )}
          <button className="g-btn g-btn-ink g-lb-save" onClick={onDownload} disabled={saving === "busy"}>
            {saving === "busy" ? "Saving…" : saving === "saved" ? "Saved ✓" : "Download"}
          </button>
        </div>
      </div>

      <div className="g-lb-strip">
        {strip.map((p, k) => (
          <button
            key={p.id}
            className="g-lb-thumb"
            aria-current={from + k === index}
            aria-label={`Photo ${numberOf(p)}`}
            onClick={() => onIndex(from + k)}
          >
            <img src={photoUrl(slug, p, "thumb")} alt="" loading="lazy" />
          </button>
        ))}
      </div>
    </div>
  );
}
