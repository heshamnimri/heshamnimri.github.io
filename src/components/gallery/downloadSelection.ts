import { photoUrl, type EventManifest, type EventPhoto } from "@/lib/events";

/** JSZip holds the archive in memory, so keep selections modest. */
export const SELECTION_CAP_BYTES = 300 * 1024 * 1024;

export async function downloadSelection(
  slug: string,
  manifest: EventManifest,
  photos: EventPhoto[],
  onProgress: (label: string) => void,
) {
  const { default: JSZip } = await import("jszip");
  const zip = new JSZip();
  for (const [i, p] of photos.entries()) {
    onProgress(`Fetching ${i + 1} of ${photos.length}…`);
    const res = await fetch(photoUrl(slug, p, "full"), { credentials: "include" });
    if (!res.ok) throw new Error(`Could not fetch ${p.id}`);
    zip.file(`${slug}-${p.id}.${p.ext || "jpg"}`, await res.arrayBuffer());
  }
  onProgress("Zipping…");
  const blob = await zip.generateAsync({ type: "blob", compression: "STORE" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${manifest.title.replace(/[^\w-]+/g, "-").toLowerCase()}-selection.zip`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 60_000);
}
