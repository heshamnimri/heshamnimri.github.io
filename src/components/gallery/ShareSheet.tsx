"use client";

import { useState } from "react";
import { galleryUrl, track } from "@/lib/events";
import { ItalicTail, Sheet } from "./ui";

export function ShareSheet({
  slug,
  title,
  license,
  onClose,
}: {
  slug: string;
  title: string;
  license: string;
  onClose: () => void;
}) {
  const url = galleryUrl(slug);
  const [copied, setCopied] = useState(false);
  const canShare = typeof navigator !== "undefined" && "share" in navigator;

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      track("share_copy", { event_slug: slug });
      setTimeout(() => setCopied(false), 1600);
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
    <Sheet label="Share" onClose={onClose}>
      <h2>
        <ItalicTail text="Share this gallery" />
      </h2>
      <div className="g-url">{url.replace(/^https:\/\//, "")}</div>
      <div className={canShare ? "g-pair" : "g-stack"}>
        <button className="g-btn g-btn-ink g-lb-save" onClick={copy}>
          {copied ? "Link copied ✓" : "Copy link"}
        </button>
        {canShare && (
          <button className="g-btn" onClick={nativeShare}>
            More options
          </button>
        )}
      </div>
      <p className="g-fine">{license}</p>
    </Sheet>
  );
}
