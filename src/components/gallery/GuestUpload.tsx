"use client";

import { useState } from "react";
import { apiBase, track } from "@/lib/events";
import { ItalicTail, Sheet } from "./ui";

const MAX_FILES = 20;
const MAX_BYTES = 40 * 1024 * 1024;

/** Sends guest photos to the Worker inbox. They appear only after the photographer approves them. */
export function GuestUpload({ slug, onClose }: { slug: string; onClose: () => void }) {
  const [files, setFiles] = useState<File[]>([]);
  const [name, setName] = useState("");
  const [progress, setProgress] = useState<string | null>(null);
  const [done, setDone] = useState(0);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const api = apiBase();
    if (!api || !files.length) return;
    setError(null);
    let ok = 0;
    for (const [i, file] of files.entries()) {
      setProgress(`Sending ${i + 1} of ${files.length}…`);
      const body = new FormData();
      body.append("file", file);
      body.append("name", name);
      try {
        const res = await fetch(`${api}/${encodeURIComponent(slug)}/upload`, {
          method: "POST",
          body,
          credentials: "include",
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        ok++;
      } catch (err) {
        setError(`${file.name}: ${(err as Error).message}`);
      }
    }
    setProgress(null);
    setDone(ok);
    track("guest_upload", { event_slug: slug, count: ok });
  }

  return (
    <Sheet label="Add photos" onClose={onClose}>
        <h2>
          <ItalicTail text="Add your photos" />
        </h2>
        {done > 0 ? (
          <>
            <p className="g-steps">
              {done} photo{done === 1 ? "" : "s"} sent. They will show up in the
              gallery once the photographer has reviewed them.
            </p>
            <button className="g-btn g-btn-ink g-btn-shadow" onClick={onClose}>Done</button>
          </>
        ) : (
          <form onSubmit={submit} className="g-stack">
            <p className="g-fine">
              Up to {MAX_FILES} photos, {MAX_BYTES / 1024 / 1024} MB each. Photos are
              reviewed before they appear.
            </p>
            <div className="g-field">
            <label htmlFor="upload-name">Your name (optional)</label>
            <input
              className="g-input"
              id="upload-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={80}
            />
            </div>
            <div className="g-field">
            <label htmlFor="upload-files">Photos</label>
            <input
              className="g-input"
              id="upload-files"
              type="file"
              accept="image/jpeg,image/png,image/heic,image/webp"
              multiple
              onChange={(e) => {
                const list = Array.from(e.target.files ?? []).slice(0, MAX_FILES);
                const tooBig = list.find((f) => f.size > MAX_BYTES);
                setError(tooBig ? `${tooBig.name} is larger than ${MAX_BYTES / 1024 / 1024} MB.` : null);
                setFiles(tooBig ? [] : list);
              }}
            />
            </div>
            {error && <p className="g-error" role="alert">{error}</p>}
            <div className="g-pair">
              <button
                className="g-btn g-btn-ink g-btn-shadow"
                disabled={!files.length || progress !== null}
              >
                {progress ?? `Send ${files.length || ""} photo${files.length === 1 ? "" : "s"}`}
              </button>
              <button type="button" className="g-btn" onClick={onClose}>
                Cancel
              </button>
            </div>
          </form>
        )}
    </Sheet>
  );
}
