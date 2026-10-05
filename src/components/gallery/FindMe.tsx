"use client";

import { useEffect, useRef, useState } from "react";
import { faceModelUrl, facesUrl, mediaCredentials, track } from "@/lib/events";
import {
  detectFaces,
  embedFace,
  matchPhotos,
  type FaceIndex,
  type OrtLike,
  type OrtSession,
  type Rgb,
} from "@/lib/faces/engine";

export type FaceMatch = { id: string; score: number };

/** Selfies are shrunk to this before detection; plenty for one close face. */
const SELFIE_MAX = 1024;

type Step =
  | { kind: "intro" }
  | { kind: "working"; label: string }
  | { kind: "error"; message: string };

type Engine = { ort: OrtLike; det: OrtSession; rec: OrtSession; index: FaceIndex };

// Loaded once per page view, reused if the guest tries another selfie.
let enginePromise: Promise<Engine> | null = null;

export function FindMe({
  slug,
  onResult,
  onClose,
}: {
  slug: string;
  onResult: (matches: FaceMatch[]) => void;
  onClose: () => void;
}) {
  const [step, setStep] = useState<Step>({ kind: "intro" });
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function onFile(file: File | undefined) {
    if (!file) return;
    track("find_me_start", { event_slug: slug });
    try {
      setStep({ kind: "working", label: "Getting ready…" });
      const engine = await loadEngine(slug, (label) => setStep({ kind: "working", label }));
      setStep({ kind: "working", label: "Looking for your face…" });
      const img = await decodeImage(file);
      const faces = await detectFaces(engine.ort, engine.det, img, { size: 640 });
      if (!faces.length) {
        track("find_me_no_face", { event_slug: slug });
        setStep({
          kind: "error",
          message:
            "We couldn't see a face in that photo. Try again facing the camera, in good light, without sunglasses.",
        });
        return;
      }
      // The selfie-taker is the biggest face in frame.
      const face = faces.reduce((a, b) =>
        b.box[2] - b.box[0] > a.box[2] - a.box[0] ? b : a,
      );
      setStep({ kind: "working", label: "Searching the gallery…" });
      const probe = await embedFace(engine.ort, engine.rec, img, face.kps);
      const matches = matchPhotos(engine.index, probe);
      onResult(matches);
    } catch (e) {
      enginePromise = null;
      track("find_me_error", { event_slug: slug, message: (e as Error).message });
      setStep({
        kind: "error",
        message: "Something went wrong loading face search. Check your connection and try again.",
      });
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  const working = step.kind === "working";

  return (
    <div className="sheet-backdrop" onClick={working ? undefined : onClose}>
      <div
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-label="Find photos of me"
        onClick={(e) => e.stopPropagation()}
      >
        <h2>Find photos of you</h2>
        <p className="sheet-text">
          Take a selfie and we&apos;ll show the photos you&apos;re in. Your selfie
          stays on your phone: matching runs on this device and nothing is
          uploaded.
        </p>
        {step.kind === "working" && (
          <p className="sheet-status" role="status">
            {step.label}
          </p>
        )}
        {step.kind === "error" && (
          <p className="sheet-status sheet-error" role="alert">
            {step.message}
          </p>
        )}
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="user"
          hidden
          onChange={(e) => onFile(e.target.files?.[0])}
        />
        <div className="gallery-actions">
          <button
            className="btn btn-primary"
            disabled={working}
            onClick={() => fileRef.current?.click()}
          >
            {step.kind === "error" ? "Try again" : "Take a selfie"}
          </button>
          <button className="btn" disabled={working} onClick={onClose}>
            Cancel
          </button>
        </div>
        <p className="sheet-fine">
          The first search downloads about 16 MB. Works best with one face,
          looking at the camera.
        </p>
      </div>
    </div>
  );
}

function loadEngine(slug: string, onProgress: (label: string) => void) {
  enginePromise ??= (async () => {
    // Only the WebAssembly CPU backend: small, and works on every phone.
    const ort = await import("onnxruntime-web/wasm");
    ort.env.wasm.wasmPaths = `https://cdn.jsdelivr.net/npm/onnxruntime-web@${ort.env.versions.web}/dist/`;
    if (!globalThis.crossOriginIsolated) ort.env.wasm.numThreads = 1;

    const sizes: Record<string, [number, number]> = {};
    const report = () => {
      const [got, total] = Object.values(sizes).reduce(
        ([g, t], [a, b]) => [g + a, t + b],
        [0, 0],
      );
      onProgress(
        total ? `Downloading face search… ${Math.round((got / total) * 100)}%` : "Downloading face search…",
      );
    };
    const fetchModel = (file: string) =>
      fetchBytes(faceModelUrl(file), (got, total) => {
        sizes[file] = [got, total];
        report();
      });

    const [detBytes, recBytes, index] = await Promise.all([
      fetchModel("det_500m.onnx"),
      fetchModel("w600k_mbf.onnx"),
      fetch(facesUrl(slug), { credentials: mediaCredentials() }).then((r) => {
        if (!r.ok) throw new Error(`faces.json HTTP ${r.status}`);
        return r.json() as Promise<FaceIndex>;
      }),
    ]);
    onProgress("Starting face search…");
    const opts = { executionProviders: ["wasm"], logSeverityLevel: 3 as const };
    const det = await ort.InferenceSession.create(detBytes, opts);
    const rec = await ort.InferenceSession.create(recBytes, opts);
    return { ort: ort as unknown as OrtLike, det, rec, index };
  })();
  return enginePromise;
}

async function fetchBytes(url: string, onProgress: (got: number, total: number) => void) {
  const res = await fetch(url);
  if (!res.ok || !res.body) throw new Error(`${url} HTTP ${res.status}`);
  const total = Number(res.headers.get("content-length")) || 0;
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let got = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    got += value.length;
    onProgress(got, total);
  }
  const out = new Uint8Array(got);
  let o = 0;
  for (const c of chunks) {
    out.set(c, o);
    o += c.length;
  }
  return out;
}

/** Decode with an <img> so EXIF rotation and every format the browser shows just work. */
async function decodeImage(file: File): Promise<Rgb> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const scale = Math.min(1, SELFIE_MAX / Math.max(img.naturalWidth, img.naturalHeight));
    const width = Math.round(img.naturalWidth * scale);
    const height = Math.round(img.naturalHeight * scale);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
    ctx.drawImage(img, 0, 0, width, height);
    return { data: ctx.getImageData(0, 0, width, height).data, width, height, channels: 4 };
  } finally {
    URL.revokeObjectURL(url);
  }
}
