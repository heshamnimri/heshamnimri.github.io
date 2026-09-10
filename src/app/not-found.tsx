import type { Metadata } from "next";
import { NotFoundSwitch } from "@/components/gallery/NotFoundSwitch";
import "./e/gallery.css";

export const metadata: Metadata = {
  title: "Not found",
  robots: { index: false, follow: false },
};

/**
 * GitHub Pages serves this file for any unknown path. Event galleries that
 * were published to media storage but not yet added to src/data/events.json
 * still open here, so a new event never has to wait for a site deploy.
 */
export default function NotFound() {
  return <NotFoundSwitch />;
}
