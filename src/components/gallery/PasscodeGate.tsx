"use client";

import { useState } from "react";
import { apiBase, sha256Hex, track } from "@/lib/events";

type Props = {
  slug: string;
  title: string;
  passcodeHash?: string;
  onUnlocked: () => void;
};

/**
 * Two modes. With the Worker in front of media, the passcode is checked server
 * side and a scoped cookie is set. Without it, the hash in the manifest is
 * compared locally, which keeps casual visitors out but is not real security.
 */
export function PasscodeGate({ slug, title, passcodeHash, onUnlocked }: Props) {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const api = apiBase();
    try {
      if (api) {
        const res = await fetch(`${api}/${encodeURIComponent(slug)}/unlock`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ passcode: code.trim() }),
        });
        if (res.status === 401) throw new Error("That passcode is not right.");
        if (!res.ok) throw new Error(`Could not unlock (HTTP ${res.status}).`);
      } else {
        const hash = await sha256Hex(code.trim());
        if (hash !== passcodeHash) throw new Error("That passcode is not right.");
        sessionStorage.setItem(`gallery-unlocked:${slug}`, hash);
      }
      track("gallery_unlock", { event_slug: slug });
      onUnlocked();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="gallery gallery-empty">
      <p className="gallery-kicker">Photos by Sham Shots Media</p>
      <h1>{title}</h1>
      <p>This gallery is private. Enter the passcode you were given.</p>
      <form className="passcode-form" onSubmit={submit}>
        <label htmlFor="gallery-passcode" className="sr-only">
          Passcode
        </label>
        <input
          id="gallery-passcode"
          type="password"
          inputMode="text"
          autoComplete="off"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="Passcode"
          required
        />
        <button className="btn btn-primary" disabled={busy || !code}>
          {busy ? "Checking…" : "Open gallery"}
        </button>
      </form>
      {error && <p className="form-error" role="alert">{error}</p>}
    </div>
  );
}
