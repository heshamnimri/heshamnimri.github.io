import { IBM_Plex_Mono, Instrument_Serif } from "next/font/google";

export const gallerySerif = Instrument_Serif({
  weight: "400",
  style: ["normal", "italic"],
  subsets: ["latin"],
  variable: "--g-serif",
});

export const galleryMono = IBM_Plex_Mono({
  weight: ["400", "500", "600"],
  subsets: ["latin"],
  variable: "--g-mono",
});

/** Class names that expose both fonts as CSS variables. */
export const galleryFonts = `${gallerySerif.variable} ${galleryMono.variable}`;
