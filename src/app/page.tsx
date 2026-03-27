"use client";

import { useState } from "react";
import Image from "next/image";
import "./page.css";

const photos = [
  {
    src: "/photos/lencois-tree.jpg",
    alt: "Isolated tree in Lencois Maranhenses",
    caption: "Isolated tree in Lencois Maranhenses",
  },
  {
    src: "/photos/brazil.jpg",
    alt: "Two people in casual wear standing in a tropical garden setting",
    caption: "Man fishing in Salvador Bahia",
  },
  {
    src: "/photos/bolivia.jpg",
    alt: "Teal vehicle with surfboards on beach",
    caption: "Driving through Salar De Uyuni",
  },
  {
    src: "/photos/CR-coffee-tour.jpg",
    alt: "Coffee Tour in Costa Rica Alajuela Provience",
    caption: "Coffee Tour in Costa Rica Alajuela Provience",
  },
  {
    src: "/photos/morocco.jpg",
    alt: "Atacama Dessert",
    caption: "Atacama Dessert",
  },
];

export default function CollectionPage() {
  const [view, setView] = useState<"grid" | "list">("grid");

  return (
    <>
      <div className="view-toggle">
        <button
          onClick={() => setView("grid")}
          className={view === "grid" ? "active" : ""}
        >
          Grid
        </button>
        <button
          onClick={() => setView("list")}
          className={view === "list" ? "active" : ""}
        >
          List
        </button>
      </div>

      <div className={view === "grid" ? "grid-view" : "list-view"}>
        {photos.map((photo) => (
          <div
            key={photo.src}
            className="image-container"
            onClick={() => view === "grid" && setView("list")}
          >
            <Image
              src={photo.src}
              alt={photo.alt}
              width={800}
              height={600}
              style={{ width: "100%", height: "auto" }}
            />
            <div className="image-caption">{photo.caption}</div>
          </div>
        ))}
      </div>
    </>
  );
}
