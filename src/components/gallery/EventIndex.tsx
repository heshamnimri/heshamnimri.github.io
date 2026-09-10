"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  knownEventSlugs,
  manifestUrl,
  formatDate,
  isExpired,
  type EventManifest,
} from "@/lib/events";

type Row = { slug: string; manifest?: EventManifest; error?: string };

/** Private list of every event. Lives at /e/index-<token>; the token is in src/data/events.json. */
export function EventIndex() {
  const [rows, setRows] = useState<Row[]>(
    knownEventSlugs.map((slug) => ({ slug })),
  );

  useEffect(() => {
    let cancelled = false;
    Promise.all(
      knownEventSlugs.map(async (slug): Promise<Row> => {
        try {
          const res = await fetch(manifestUrl(slug), { cache: "no-store" });
          if (!res.ok) return { slug, error: `HTTP ${res.status}` };
          return { slug, manifest: (await res.json()) as EventManifest };
        } catch (e) {
          return { slug, error: (e as Error).message };
        }
      }),
    ).then((r) => !cancelled && setRows(r));
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="gallery gallery-index">
      <header className="gallery-head">
        <p className="gallery-kicker">Sham Shots Media · private</p>
        <h1>All events</h1>
        <p className="gallery-note">
          {rows.length} event{rows.length === 1 ? "" : "s"} in the site index.
          Events published to media storage but not yet listed here still open
          at their link.
        </p>
      </header>
      <table className="index-table">
        <thead>
          <tr>
            <th>Event</th>
            <th>Date</th>
            <th>Photos</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ slug, manifest, error }) => (
            <tr key={slug}>
              <td>
                <Link href={`/e/${slug}`}>{manifest?.title || slug}</Link>
                <div className="index-slug">{slug}</div>
              </td>
              <td>{formatDate(manifest?.date)}</td>
              <td>{manifest?.photos.length ?? "—"}</td>
              <td>
                {error
                  ? `Missing (${error})`
                  : manifest && isExpired(manifest)
                    ? "Expired"
                    : manifest?.passcodeHash
                      ? "Passcode"
                      : "Open"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
