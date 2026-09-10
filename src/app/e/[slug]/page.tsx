import type { Metadata } from "next";
import { EventGallery } from "@/components/gallery/EventGallery";
import { EventIndex } from "@/components/gallery/EventIndex";
import { knownEventSlugs, indexSlug } from "@/lib/events";
import "../gallery.css";

export const dynamicParams = false;

export function generateStaticParams() {
  return [...knownEventSlugs, indexSlug].map((slug) => ({ slug }));
}

export const metadata: Metadata = {
  title: "Event gallery",
  description: "Private event gallery by Sham Shots Media.",
  robots: { index: false, follow: false },
};

export default async function EventPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  if (slug === indexSlug) return <EventIndex />;
  return <EventGallery slug={slug} />;
}
