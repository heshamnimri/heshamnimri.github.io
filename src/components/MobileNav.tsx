"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import "./MobileNav.css";

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
  { href: "mailto:press.journalist.media@proton.me", label: "Email" },
];

export function MobileNav() {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();
  const navRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        isOpen &&
        navRef.current &&
        buttonRef.current &&
        !navRef.current.contains(e.target as Node) &&
        !buttonRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, [isOpen]);

  return (
    <div className="topnav">
      <h1 className="logo-mobile">SHAM SHOTS MEDIA</h1>

      <div ref={navRef} className="mobile-links" style={{ display: isOpen ? "block" : "none" }}>
        {navLinks.map((link) =>
          link.external ? (
            <a key={link.href} href={link.href} target="_blank" rel="noopener noreferrer">
              {link.label}
            </a>
          ) : (
            <Link
              key={link.href}
              href={link.href}
              className={pathname === link.href ? "nav-active" : ""}
            >
              {link.label}
            </Link>
          )
        )}
        <div className="mobile-social">
          {socialLinks.map((link) => (
            <a key={link.href} href={link.href} target="_blank" rel="noopener noreferrer">
              {link.label}
            </a>
          ))}
        </div>
      </div>

      <button
        ref={buttonRef}
        className="hamburger-icon"
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Toggle navigation"
      >
        {isOpen ? "\u2715" : "\u2630"}
      </button>
    </div>
  );
}
