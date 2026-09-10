import { mediaCredentials, photoUrl, type EventPhoto } from "@/lib/events";

/**
 * Save one original photo with as few taps as possible.
 *
 * Phones: fetch the file and hand it to the OS share sheet, where "Save Image"
 * puts it straight into Photos (iOS 15+, Android Chrome).
 * Desktop: fetch into memory and trigger a real download, so the image never
 * opens in a new tab even though it lives on another domain.
 * Anything fails: fall back to opening the direct link with ?download=1.
 *
 * Returns what happened so the caller can show the right feedback.
 */
export async function savePhoto(
  slug: string,
  photo: EventPhoto,
): Promise<"shared" | "downloaded" | "opened" | "cancelled"> {
  const filename = `${slug}-${photo.id}.${photo.ext || "jpg"}`;
  const url = photoUrl(slug, photo, "full");

  let blob: Blob;
  try {
    const res = await fetch(url, { credentials: mediaCredentials() });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    blob = await res.blob();
  } catch {
    window.open(`${url}?download=1`, "_blank", "noopener");
    return "opened";
  }

  const file = new File([blob], filename, { type: blob.type || "image/jpeg" });

  if (isTouchDevice() && canShareFile(file)) {
    try {
      await navigator.share({ files: [file] });
      return "shared";
    } catch (err) {
      if ((err as Error).name === "AbortError") return "cancelled";
      // Share failed for another reason; fall through to a download.
    }
  }

  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = objectUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
  return "downloaded";
}

function isTouchDevice() {
  return (
    typeof window !== "undefined" &&
    (navigator.maxTouchPoints > 0 || "ontouchstart" in window)
  );
}

function canShareFile(file: File) {
  return (
    typeof navigator !== "undefined" &&
    typeof navigator.share === "function" &&
    typeof navigator.canShare === "function" &&
    navigator.canShare({ files: [file] })
  );
}
