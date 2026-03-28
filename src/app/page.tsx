import type { Metadata } from "next";
import { PhotoGallery } from "@/components/PhotoGallery";
import "./page.css";

export const metadata: Metadata = {
  title: {
    absolute: "Sham Shots Media | Hesham Nimri - Documentary Photography",
  },
  description:
    "Browse the photography collection by Hesham Nimri — documentary and travel photography from Brazil, Bolivia, Costa Rica, and beyond.",
  alternates: { canonical: "https://hishamnimri.com/" },
  openGraph: {
    title: "Photography Collection | Sham Shots Media",
    description:
      "Documentary and travel photography from Brazil, Bolivia, Costa Rica, and beyond.",
    url: "https://hishamnimri.com",
    images: [
      {
        url: "/photos/lencois-tree.jpg",
        width: 1200,
        height: 800,
        alt: "Isolated tree in Lencois Maranhenses",
      },
    ],
  },
};

export default function CollectionPage() {
  return (
    <>
      <h1 className="sr-only">Photography Collection</h1>
      <PhotoGallery />
    </>
  );
}
