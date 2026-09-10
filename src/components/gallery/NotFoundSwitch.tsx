"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { EventGallery } from "./EventGallery";

export function NotFoundSwitch() {
  const [slug, setSlug] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const m = window.location.pathname.match(/^\/e\/([^/]+)\/?$/);
    setSlug(m ? decodeURIComponent(m[1]) : null);
    setReady(true);
  }, []);

  if (!ready) return null;
  if (slug) return <EventGallery slug={slug} />;

  return (
    <div className="gallery gallery-empty">
      <h1>Page not found</h1>
      <p>
        That page does not exist. <Link href="/">Back to the portfolio</Link>.
      </p>
    </div>
  );
}
