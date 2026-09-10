"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { photoUrl, track, type EventPhoto } from "@/lib/events";

type Props = {
  slug: string;
  photos: EventPhoto[];
  index: number;
  onIndex: (i: number) => void;
  onClose: () => void;
  favorites?: Set<string>;
  onFavorite?: (id: string) => void;
};

export function Lightbox({
  slug,
  photos,
  index,
  onIndex,
  onClose,
  favorites,
  onFavorite,
}: Props) {
  const photo = photos[index];
  const [zoom, setZoom] = useState(false);
  const touch = useRef<{ x: number; y: number; t: number } | null>(null);
  const lastTap = useRef(0);

  const go = useCallback(
    (delta: number) => {
      const next = (index + delta + photos.length) % photos.length;
      setZoom(false);
      onIndex(next);
    },
    [index, photos.length, onIndex],
  );

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight") go(1);
      else if (e.key === "ArrowLeft") go(-1);
    }
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [go, onClose]);

  // Preload neighbours so swiping feels instant.
  useEffect(() => {
    [1, -1].forEach((d) => {
      const p = photos[(index + d + photos.length) % photos.length];
      if (p) new Image().src = photoUrl(slug, p, "view");
    });
  }, [index, photos, slug]);

  if (!photo) return null;

  function onTouchStart(e: React.TouchEvent) {
    if (e.touches.length !== 1) return;
    const t = e.touches[0];
    touch.current = { x: t.clientX, y: t.clientY, t: Date.now() };
  }
  function onTouchEnd(e: React.TouchEvent) {
    const start = touch.current;
    touch.current = null;
    if (!start || zoom) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    const dt = Date.now() - start.t;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      go(dx < 0 ? 1 : -1);
    } else if (dy > 90 && Math.abs(dy) > Math.abs(dx) * 1.5) {
      onClose();
    } else if (Math.abs(dx) < 10 && Math.abs(dy) < 10 && dt < 300) {
      const now = Date.now();
      if (now - lastTap.current < 320) setZoom((z) => !z);
      lastTap.current = now;
    }
  }

  const fullUrl = photoUrl(slug, photo, "full") + "?download=1";
  const isFav = favorites?.has(photo.id);

  return (
    <div
      className="lightbox"
      role="dialog"
      aria-modal="true"
      aria-label={`Photo ${index + 1} of ${photos.length}`}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      <div className="lightbox-bar">
        <span className="lightbox-count">
          {index + 1} / {photos.length}
        </span>
        <div className="lightbox-tools">
          {favorites && onFavorite && (
            <button
              className={`lb-btn ${isFav ? "is-on" : ""}`}
              onClick={() => onFavorite(photo.id)}
              aria-label={isFav ? "Remove favorite" : "Add favorite"}
            >
              ♥
            </button>
          )}
          <a
            className="lb-btn"
            href={fullUrl}
            download={`${slug}-${photo.id}.${photo.ext || "jpg"}`}
            onClick={() => track("download_photo", { event_slug: slug, photo_id: photo.id })}
          >
            Download
          </a>
          <button className="lb-btn" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
      </div>

      <button className="lb-nav lb-prev" onClick={() => go(-1)} aria-label="Previous">
        ‹
      </button>
      <div
        className={`lightbox-stage ${zoom ? "is-zoomed" : ""}`}
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
        onDoubleClick={() => setZoom((z) => !z)}
      >
        <img
          key={photo.id}
          src={photoUrl(slug, photo, "view")}
          alt={photo.caption || ""}
          draggable={false}
        />
      </div>
      <button className="lb-nav lb-next" onClick={() => go(1)} aria-label="Next">
        ›
      </button>
      {photo.caption && <p className="lightbox-caption">{photo.caption}</p>}
    </div>
  );
}
