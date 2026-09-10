import type { Metadata } from "next";
import Image from "next/image";
import "./page.css";

export const metadata: Metadata = {
  title: "US 2024 Elections",
  description:
    "Documentary photography from the 2024 US elections — polling stations in the Bronx and Manhattan, New York City, by photojournalist Hesham Nimri.",
  alternates: { canonical: "https://hishamnimri.com/us-2024-elections" },
  openGraph: {
    title: "US 2024 Elections | Sham Shots Media",
    description:
      "Documentary photography from the 2024 US elections in New York City.",
    url: "https://hishamnimri.com/us-2024-elections",
    images: [
      {
        url: "/photos/elections/1.jpg",
        width: 1200,
        height: 800,
        alt: "Family going to vote in the Bronx, New York City",
      },
    ],
  },
};

const photos = [
  {
    src: "/photos/elections/1.jpg",
    alt: "Family going to vote in the Bronx, New York City",
    caption: "Family going to vote in the Bronx, New York City",
  },
  {
    src: "/photos/elections/2.jpg",
    alt: "Young voter proudly wears voting stickers in New York City",
    caption: "Young voter proudly wears voting stickers",
  },
  {
    src: "/photos/elections/3.jpg",
    alt: "Inside a Bronx polling station on election day",
    caption: "Inside Bronx polling station",
  },
  {
    src: "/photos/elections/4.jpg",
    alt: "Multilingual voting sign outside Manhattan polling station",
    caption: "Manhattan multi-lingual voting sign",
  },
];

export default function ElectionsPage() {
  return (
    <div>
      <h1 className="sr-only">US 2024 Elections Photography</h1>
      {photos.map((photo) => (
        <div key={photo.src} className="image-container">
          <Image
            src={photo.src}
            alt={photo.alt}
            width={1200}
            height={800}
            style={{ width: "100%", height: "auto" }}
          />
          <div className="image-caption">{photo.caption}</div>
        </div>
      ))}
    </div>
  );
}
