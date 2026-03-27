import Image from "next/image";
import "./page.css";

const photos = [
  {
    src: "/photos/elections/1.jpg",
    alt: "New york polling station",
    caption: "Family going to vote in the Bronx, New York City",
  },
  {
    src: "/photos/elections/2.jpg",
    alt: "New york polling station",
    caption: "Young voter proudly wears voting stickers",
  },
  {
    src: "/photos/elections/3.jpg",
    alt: "New york polling station",
    caption: "Inside Bronx polling station",
  },
  {
    src: "/photos/elections/4.jpg",
    alt: "New york polling station",
    caption: "Manhattan multi-lingual voting sign",
  },
];

export default function ElectionsPage() {
  return (
    <div>
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
