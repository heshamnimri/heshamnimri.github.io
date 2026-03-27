import type { Metadata } from "next";
import { Space_Mono } from "next/font/google";
import { Sidebar } from "@/components/Sidebar";
import { MobileNav } from "@/components/MobileNav";
import "./globals.css";
import "./layout.css";

const spaceMono = Space_Mono({
  weight: ["400", "700"],
  style: ["normal", "italic"],
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Sham Shots Media | Hesham Nimri",
    template: "%s | Sham Shots Media",
  },
  description:
    "Sham Shots Media is a visual storytelling platform founded by photojournalist Hesham Nimri. Through the lens of documentary photography and film, we capture compelling narratives that bridge cultural understanding and shed light on underreported stories from around the world.",
  keywords: [
    "Hesham Nimri",
    "Hisham nimri",
    "sham shots media",
    "Photojournalism",
    "media",
  ],
  authors: [{ name: "Hesham Nimri" }],
  metadataBase: new URL("https://hishamnimri.com"),
  openGraph: {
    title: "Sham Shots Media - Photojournalism and Film",
    description:
      "Sham Shots Media is a visual storytelling platform founded by photojournalist Hesham Nimri. Through the lens of documentary photography and film, we capture compelling narratives that bridge cultural understanding and shed light on underreported stories from around the world.",
    url: "https://hishamnimri.com",
    type: "website",
  },
  verification: {
    google: "Yzhu8uf-0vBttTGJvU2xM8l25yM7748foZ9kYCD1FWU",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-snippet": -1,
      "max-image-preview": "large",
      "max-video-preview": -1,
    },
  },
  alternates: {
    canonical: "https://hishamnimri.com/",
  },
  icons: {
    icon: "/favicon.png",
    apple: "/apple-touch-icon.png",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <script
          async
          src="https://www.googletagmanager.com/gtag/js?id=G-29DF4H2TN6"
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', 'G-29DF4H2TN6');
            `,
          }}
        />
      </head>
      <body className={spaceMono.className}>
        <div className="site-container">
          <Sidebar />
          <main className="main-content">
            <MobileNav />
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
