"use client";

import { useCallback, useEffect, useState } from "react";
import { apiBase, track } from "@/lib/events";

function guestId() {
  const key = "gallery-guest-id";
  try {
    let id = localStorage.getItem(key);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(key, id);
    }
    return id;
  } catch {
    return "anonymous";
  }
}

/**
 * Favorites live in the Worker (shared with the photographer) when the API is
 * available, and fall back to this browser's localStorage otherwise.
 */
export function useFavorites(slug: string, enabled: boolean) {
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const storageKey = `gallery-favorites:${slug}`;
  const api = apiBase();

  useEffect(() => {
    if (!enabled) return;
    if (api) {
      fetch(`${api}/${encodeURIComponent(slug)}/favorites?guest=${guestId()}`, {
        credentials: "include",
      })
        .then((r) => (r.ok ? r.json() : { ids: [] }))
        .then((d: { ids: string[] }) => setFavorites(new Set(d.ids)))
        .catch(() => {});
    } else {
      try {
        const raw = localStorage.getItem(storageKey);
        if (raw) setFavorites(new Set(JSON.parse(raw) as string[]));
      } catch {}
    }
  }, [slug, enabled, api, storageKey]);

  const toggleFavorite = useCallback(
    (id: string) => {
      setFavorites((prev) => {
        const next = new Set(prev);
        const on = !next.has(id);
        if (on) next.add(id);
        else next.delete(id);
        track("favorite_toggle", { event_slug: slug, photo_id: id, on });
        if (api) {
          fetch(`${api}/${encodeURIComponent(slug)}/favorites`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ guest: guestId(), id, on }),
          }).catch(() => {});
        } else {
          try {
            localStorage.setItem(storageKey, JSON.stringify([...next]));
          } catch {}
        }
        return next;
      });
    },
    [slug, api, storageKey],
  );

  return { favorites, toggleFavorite };
}
