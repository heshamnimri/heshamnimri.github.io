"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

function gtag(...args: unknown[]) {
  if (typeof window !== "undefined" && window.gtag) {
    window.gtag(...(args as [string, ...unknown[]]));
  }
}

function getUTMParams(): Record<string, string> {
  if (typeof window === "undefined") return {};
  const params = new URLSearchParams(window.location.search);
  const utm: Record<string, string> = {};
  for (const key of [
    "utm_source",
    "utm_medium",
    "utm_campaign",
    "utm_term",
    "utm_content",
  ]) {
    const val = params.get(key);
    if (val) utm[key] = val;
  }
  return utm;
}

function getVisitorContext() {
  if (typeof window === "undefined") return {};
  const nav = navigator;
  return {
    screen_resolution: `${screen.width}x${screen.height}`,
    viewport_size: `${window.innerWidth}x${window.innerHeight}`,
    device_pixel_ratio: window.devicePixelRatio,
    language: nav.language,
    languages: nav.languages?.join(","),
    platform: (nav as unknown as Record<string, unknown>).userAgentData
      ? ((nav as unknown as Record<string, unknown>).userAgentData as Record<string, unknown>).platform
      : nav.platform,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    referrer: document.referrer || "(direct)",
    connection_type:
      (nav as unknown as Record<string, unknown>).connection
        ? ((nav as unknown as Record<string, unknown>).connection as Record<string, unknown>).effectiveType
        : undefined,
    touch_support: "ontouchstart" in window || navigator.maxTouchPoints > 0,
  };
}

export function Analytics() {
  const pathname = usePathname();
  const pageLoadTime = useRef(Date.now());
  const scrollMaxRef = useRef(0);
  const hasSentEntryRef = useRef(false);

  // Send visitor context + UTM on first load
  useEffect(() => {
    if (hasSentEntryRef.current) return;
    hasSentEntryRef.current = true;

    const context = getVisitorContext();
    const utm = getUTMParams();

    gtag("event", "site_entry", {
      ...context,
      ...utm,
      entry_page: pathname,
      entry_timestamp: new Date().toISOString(),
    });
  }, [pathname]);

  // Track page views on route change
  useEffect(() => {
    pageLoadTime.current = Date.now();
    scrollMaxRef.current = 0;
  }, [pathname]);

  // Scroll depth tracking
  useEffect(() => {
    function onScroll() {
      const scrollTop = window.scrollY;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      if (docHeight <= 0) return;
      const percent = Math.round((scrollTop / docHeight) * 100);
      scrollMaxRef.current = Math.max(scrollMaxRef.current, percent);
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [pathname]);

  // Send engagement data when leaving page
  useEffect(() => {
    function onLeave() {
      const timeOnPage = Math.round((Date.now() - pageLoadTime.current) / 1000);
      gtag("event", "page_engagement", {
        page_path: pathname,
        time_on_page_seconds: timeOnPage,
        max_scroll_depth: scrollMaxRef.current,
      });
    }

    window.addEventListener("beforeunload", onLeave);
    return () => {
      onLeave();
      window.removeEventListener("beforeunload", onLeave);
    };
  }, [pathname]);

  // Track outbound link clicks
  useEffect(() => {
    function onClick(e: MouseEvent) {
      const link = (e.target as HTMLElement).closest("a");
      if (!link) return;
      const href = link.getAttribute("href");
      if (!href) return;

      const isExternal =
        href.startsWith("http") && !href.includes("hishamnimri.com");
      const isEmail = href.startsWith("mailto:");

      if (isExternal || isEmail) {
        gtag("event", "outbound_click", {
          link_url: href,
          link_text: link.textContent?.trim(),
          page_path: pathname,
        });
      }
    }

    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, [pathname]);

  return null;
}
