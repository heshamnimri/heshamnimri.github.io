"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { galleryUrl, track } from "@/lib/events";

export function ShareSheet({
  slug,
  title,
  onClose,
}: {
  slug: string;
  title: string;
  onClose: () => void;
}) {
  const url = galleryUrl(slug);
  const [qr, setQr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const canShare = typeof navigator !== "undefined" && "share" in navigator;

  useEffect(() => {
    QRCode.toDataURL(url, { width: 480, margin: 1 }).then(setQr);
  }, [url]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      track("share_copy", { event_slug: slug });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  async function nativeShare() {
    try {
      await navigator.share({ title, url });
      track("share_native", { event_slug: slug });
    } catch {
      /* user dismissed */
    }
  }

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-label="Share this gallery"
        onClick={(e) => e.stopPropagation()}
      >
        <h2>Share this gallery</h2>
        {qr && <img className="sheet-qr" src={qr} alt={`QR code for ${url}`} />}
        <p className="sheet-url">{url}</p>
        <div className="gallery-actions">
          <button className="btn btn-primary" onClick={copy}>
            {copied ? "Copied" : "Copy link"}
          </button>
          {canShare && (
            <button className="btn" onClick={nativeShare}>
              Share…
            </button>
          )}
          <button className="btn" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
