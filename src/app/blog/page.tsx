import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import "./blog.css";

export const metadata: Metadata = {
  title: "Blog",
  description:
    "Stories and insights from photojournalist Hesham Nimri — behind-the-scenes coverage of documentary photography projects around the world.",
  alternates: { canonical: "https://hishamnimri.com/blog" },
  openGraph: {
    title: "Blog | Sham Shots Media",
    description:
      "Stories and insights from photojournalist Hesham Nimri.",
    url: "https://hishamnimri.com/blog",
  },
};

const posts = [
  {
    slug: "elections-behind-the-lens",
    image: "/photos/elections/1.jpg",
    alt: "Family going to vote in the Bronx, New York City",
    date: "2024-11-05",
    dateFormatted: "November 5, 2024",
    title: "Behind the Lens: Covering the 2024 Elections",
    excerpt:
      "Documenting democracy in the Bronx and Manhattan on election day.",
  },
];

export default function BlogPage() {
  return (
    <div className="blog-index">
      <h1 className="sr-only">Blog</h1>
      {posts.map((post) => (
        <article key={post.slug} className="blog-entry">
          <Link href={`/blog/${post.slug}`}>
            <div className="blog-entry-image">
              <Image
                src={post.image}
                alt={post.alt}
                width={1200}
                height={800}
                style={{ width: "100%", height: "auto" }}
              />
            </div>
          </Link>
          <div className="blog-entry-meta">
            <time dateTime={post.date}>{post.dateFormatted}</time>
          </div>
          <h2 className="blog-entry-title">
            <Link href={`/blog/${post.slug}`}>{post.title}</Link>
          </h2>
          <p className="blog-entry-excerpt">{post.excerpt}</p>
        </article>
      ))}
    </div>
  );
}
