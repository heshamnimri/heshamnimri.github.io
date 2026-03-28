"use client";

import { useState } from "react";
import Image from "next/image";

const photos = [
  {
    src: "/photos/lencois-tree.jpg",
    alt: "Isolated tree in Lencois Maranhenses",
    caption: "Isolated tree in Lencois Maranhenses",
  },
  {
    src: "/photos/brazil.jpg",
    alt: "Man fishing in Salvador Bahia, Brazil",
    caption: "Man fishing in Salvador Bahia",
  },
  {
    src: "/photos/bolivia.jpg",
    alt: "Driving through Salar De Uyuni, Bolivia",
    caption: "Driving through Salar De Uyuni",
  },
  {
    src: "/photos/CR-coffee-tour.jpg",
    alt: "Coffee tour in Costa Rica, Alajuela Province",
    caption: "Coffee Tour in Costa Rica Alajuela Province",
  },
  {
    src: "/photos/morocco.jpg",
    alt: "Atacama Desert landscape",
    caption: "Atacama Desert",
  },
];

export function PhotoGallery() {
  const [view, setView] = useState<"grid" | "list">("grid");

  function switchView(v: "grid" | "list") {
    setView(v);
    if (typeof window !== "undefined" && window.gtag) {
      window.gtag("event", "view_toggle", { view_mode: v });
    }
  }

  return (
    <>
      <div className="view-toggle">
        <button
          onClick={() => switchView("grid")}
          className={view === "grid" ? "active" : ""}
        >
          Grid
        </button>
        <button
          onClick={() => switchView("list")}
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
            onClick={() => view === "grid" && switchView("list")}
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
