"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { EventGallery, PageMessage } from "./EventGallery";

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
    <PageMessage kicker="Sham Shots Media" title="Page not found">
      That page does not exist. <Link href="/">Back to the portfolio</Link>.
    </PageMessage>
  );
}
