import type { Metadata } from "next";
import { Space_Mono } from "next/font/google";
import { Sidebar } from "@/components/Sidebar";
import { MobileNav } from "@/components/MobileNav";
import { Analytics } from "@/components/Analytics";
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
    "Hisham Nimri",
    "Sham Shots Media",
    "photojournalism",
    "documentary photography",
    "visual storytelling",
  ],
  authors: [{ name: "Hesham Nimri" }],
  metadataBase: new URL("https://hishamnimri.com"),
  openGraph: {
    title: "Sham Shots Media - Photojournalism and Film",
    description:
      "Visual storytelling platform by photojournalist Hesham Nimri. Documentary photography and film capturing compelling narratives from around the world.",
    url: "https://hishamnimri.com",
    siteName: "Sham Shots Media",
    type: "website",
    images: [
      {
        url: "/photos/lencois-tree.jpg",
        width: 1200,
        height: 800,
        alt: "Sham Shots Media - Documentary Photography",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Sham Shots Media - Photojournalism and Film",
    description:
      "Visual storytelling platform by photojournalist Hesham Nimri.",
    images: ["/photos/lencois-tree.jpg"],
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

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": "https://hishamnimri.com/#organization",
      name: "Sham Shots Media",
      url: "https://hishamnimri.com",
      founder: { "@id": "https://hishamnimri.com/#person" },
      sameAs: [
        "https://x.com/shamshots",
      ],
    },
    {
      "@type": "Person",
      "@id": "https://hishamnimri.com/#person",
      name: "Hesham Nimri",
      jobTitle: "Photojournalist",
      url: "https://hishamnimri.com",
      sameAs: [
        "https://x.com/shamshots",
        "https://www.linkedin.com/in/hnimri/",
        "https://independent-photo.com/photographer/hisham-nimri/",
        "https://nrc-publications.canada.ca/eng/view/object/?id=4be1e31f-5495-4773-a3e2-0bb17ef58f26",
        "https://saemobilus.sae.org/papers/lidar-camera-based-convolutional-neural-network-detection-autonomous-driving-2020-01-0136",
      ],
    },
  ],
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
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
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
              gtag('config', 'G-29DF4H2TN6', {
                send_page_view: true,
                cookie_flags: 'SameSite=None;Secure',
              });
            `,
          }}
        />
      </head>
      <body className={spaceMono.className}>
        <div className="site-container">
          <Sidebar />
          <main className="main-content">
            <MobileNav />
            <Analytics />
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
