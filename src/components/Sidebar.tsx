"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import "./Sidebar.css";

const navLinks = [
  { href: "/about", label: "About" },
  { href: "/", label: "Collection" },
  { href: "/us-2024-elections", label: "US 2024 Elections" },
  { href: "/blog", label: "Blog" },
  {
    href: "https://sham-shots.darkroom.com/collections/lencois-maranhenses",
    label: "Store",
    external: true,
  },
];

const socialLinks = [
  { href: "https://x.com/shamshots", label: "Twitter" },
  { href: "https://www.instagram.com/sham_gram_/", label: "Instagram" },
  { href: "mailto:press.journalist.media@proton.me", label: "Email" },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="sidebar">
      <h1 className="logo">
        <Link href="/about">
          SHAM<br />
          SHOTS<br />
          MEDIA
        </Link>
      </h1>
      <nav className="nav">
        {navLinks.map((link) =>
          link.external ? (
            <a key={link.href} href={link.href} target="_blank" rel="noopener noreferrer">
              {link.label}
            </a>
          ) : (
            <Link
              key={link.href}
              href={link.href}
              className={pathname === link.href ? "active" : ""}
            >
              {link.label}
            </Link>
          )
        )}
      </nav>
      <div className="social">
        {socialLinks.map((link) => (
          <a key={link.href} href={link.href} target="_blank" rel="noopener noreferrer">
            {link.label}
          </a>
        ))}
      </div>
    </aside>
  );
}
