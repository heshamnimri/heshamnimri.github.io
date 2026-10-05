"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  faceModelUrl,
  facesUrl,
  mediaCredentials,
  photoUrl,
  track,
  type EventPhoto,
} from "@/lib/events";
import {
  detectFaces,
  embedFace,
  matchPhotos,
  type FaceIndex,
  type OrtLike,
  type OrtSession,
  type Rgb,
} from "@/lib/faces/engine";
import { ItalicTail, Sheet, useLayer } from "./ui";

export type FaceMatch = { id: string; score: number };

/** Selfies are shrunk to this before detection; plenty for one close face. */
const SELFIE_MAX = 1024;
/** The scan screen runs at least this long so people can see it working. */
const SCAN_MIN_MS = 1600;

type Step = "intro" | "camera" | "review" | "scan" | "denied" | "noface" | "error";

type Engine = { ort: OrtLike; det: OrtSession; rec: OrtSession; index: FaceIndex };

// Loaded once per page view and reused across selfies.
let enginePromise: Promise<Engine> | null = null;
let engineProgress = 0;
const progressListeners = new Set<(p: number) => void>();

export function FindMe({
  slug,
  photos,
  start,
  onResult,
  onClose,
}: {
  slug: string;
  photos: EventPhoto[];
  /** "intro" from the hero button; "camera" from TRY ANOTHER SELFIE. */
  start: "intro" | "camera";
  onResult: (matches: FaceMatch[], selfie: string) => void;
  onClose: () => void;
}) {
  const [step, setStep] = useState<Step>(start);
  const [selfie, setSelfie] = useState<string | null>(null);
  const [scan, setScan] = useState({ p: 0, checked: 0, label: "" });
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const cancelled = useRef(false);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const close = useCallback(() => {
    cancelled.current = true;
    stopCamera();
    onClose();
  }, [onClose, stopCamera]);

  // Start fetching the models while the guest reads the intro or frames the shot.
  useEffect(() => {
    loadEngine(slug).catch(() => {});
    return () => stopCamera();
  }, [slug, stopCamera]);

  useEffect(() => {
    if (step !== "camera") return;
    let live = true;
    if (!navigator.mediaDevices?.getUserMedia) {
      setStep("denied");
      return;
    }
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "user", width: { ideal: 1280 } }, audio: false })
      .then((stream) => {
        if (!live) return stream.getTracks().forEach((t) => t.stop());
        streamRef.current = stream;
        const v = videoRef.current;
        if (v) {
          v.srcObject = stream;
          v.play().catch(() => {});
        }
      })
      .catch(() => {
        if (!live) return;
        track("find_me_camera_denied", { event_slug: slug });
        setStep("denied");
      });
    return () => {
      live = false;
      stopCamera();
    };
  }, [step, slug, stopCamera]);

  function capture() {
    const v = videoRef.current;
    if (!v || !v.videoWidth) return;
    const c = document.createElement("canvas");
    c.width = v.videoWidth;
    c.height = v.videoHeight;
    const ctx = c.getContext("2d")!;
    // Keep the mirror image the guest just saw.
    ctx.translate(c.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(v, 0, 0);
    stopCamera();
    setSelfie(c.toDataURL("image/jpeg", 0.9));
    setStep("review");
  }

  function onFile(file: File | undefined) {
    if (!file) return;
    stopCamera();
    setSelfie(URL.createObjectURL(file));
    setStep("review");
    if (fileRef.current) fileRef.current.value = "";
  }

  async function search() {
    if (!selfie) return;
    cancelled.current = false;
    setStep("scan");
    track("find_me_start", { event_slug: slug });
    const t0 = Date.now();
    const wasReady = engineProgress === 1;
    try {
      // First 40% of the bar is getting the models, if they aren't here yet.
      const onLoad = (p: number) => setScan({ p: p * 0.4, checked: 0, label: "Getting ready…" });
      progressListeners.add(onLoad);
      onLoad(engineProgress);
      const engine = await loadEngine(slug).finally(() => progressListeners.delete(onLoad));
      if (cancelled.current) return;

      const img = await decodeImage(selfie);
      const faces = await detectFaces(engine.ort, engine.det, img, { size: 640 });
      if (cancelled.current) return;
      if (!faces.length) {
        track("find_me_no_face", { event_slug: slug });
        setStep("noface");
        return;
      }
      // The selfie-taker is the biggest face in frame.
      const face = faces.reduce((a, b) => (b.box[2] - b.box[0] > a.box[2] - a.box[0] ? b : a));
      const probe = await embedFace(engine.ort, engine.rec, img, face.kps);
      const matches = matchPhotos(engine.index, probe);

      // Walk the count through the gallery, finishing no sooner than SCAN_MIN_MS.
      const from = wasReady ? 0 : 0.4;
      const startAt = Date.now();
      const span = Math.max(600, SCAN_MIN_MS - (startAt - t0));
      await new Promise<void>((resolve) => {
        const tick = () => {
          if (cancelled.current) return resolve();
          const f = Math.min(1, (Date.now() - startAt) / span);
          setScan({ p: from + (1 - from) * f, checked: Math.round(f * photos.length), label: "" });
          if (f < 1) requestAnimationFrame(tick);
          else resolve();
        };
        tick();
      });
      if (cancelled.current) return;
      onResult(matches, selfie);
    } catch (e) {
      enginePromise = null;
      track("find_me_error", { event_slug: slug, message: (e as Error).message });
      setStep("error");
    }
  }

  const fileInput = (
    <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => onFile(e.target.files?.[0])} />
  );

  if (step === "intro") {
    return (
      <Sheet label="Find me" head={<span>{photos.length} photos</span>} onClose={close}>
        {fileInput}
        <h2>
          Find your <em>photos</em>
        </h2>
        <div className="g-steps">
          <div className="g-step"><b>01</b><span>Take a selfie, or upload a clear photo of your face.</span></div>
          <div className="g-step"><b>02</b><span>We look through all {photos.length} photos from this event.</span></div>
          <div className="g-step"><b>03</b><span>You get the photos you&apos;re in, ready to download.</span></div>
        </div>
        <p className="g-privacy">
          Your selfie never leaves this device. Matching runs in your browser and nothing is uploaded or saved.
        </p>
        <div className="g-stack">
          <button className="g-btn g-btn-green g-btn-shadow" style={{ minHeight: 50 }} onClick={() => setStep("camera")}>
            Take a selfie
          </button>
          <button className="g-btn" style={{ minHeight: 46 }} onClick={() => fileRef.current?.click()}>
            Upload a photo
          </button>
          <button className="g-btn g-btn-text" onClick={close}>
            Not now
          </button>
        </div>
        <p className="g-fine">The first search downloads about 16 MB.</p>
      </Sheet>
    );
  }

  return (
    <CameraLayer onClose={close}>
      {fileInput}
      {step === "camera" && (
        <video ref={videoRef} className="g-cam-feed" muted playsInline autoPlay aria-label="Camera preview" />
      )}
      {selfie && (step === "review" || step === "scan") && (
        <img className={`g-cam-still ${step === "scan" ? "is-scanning" : ""}`} src={selfie} alt="Your selfie" />
      )}
      {(step === "camera" || step === "review") && <div className={`g-oval ${step === "review" ? "is-ok" : ""}`} />}

      <div className="g-cam-top">
        <button className="g-btn g-btn-sm g-btn-ghost-light" onClick={close}>
          ✕ Close
        </button>
        <span className="g-cam-step">
          FIND ME · {{ camera: "1/3", review: "2/3", scan: "3/3", denied: "CAMERA", noface: "2/3", error: "" }[step]}
        </span>
      </div>

      {step === "camera" && (
        <div className="g-cam-bottom is-center">
          <span className="g-cam-hint">Center your face in the oval</span>
          <button className="g-shutter" onClick={capture} aria-label="Take selfie">
            <span />
          </button>
          <button className="g-under" onClick={() => fileRef.current?.click()}>
            UPLOAD INSTEAD
          </button>
        </div>
      )}

      {step === "review" && (
        <div className="g-cam-bottom">
          <span className="g-cam-headline is-center">
            Use this <em>photo?</em>
          </span>
          <div className="g-pair" style={{ gridTemplateColumns: "minmax(0,1fr) minmax(0,1.4fr)" }}>
            <button className="g-btn g-btn-light" style={{ minHeight: 50 }} onClick={() => setStep("camera")}>
              Retake
            </button>
            <button className="g-btn g-btn-green g-btn-green-on-dark" style={{ minHeight: 50 }} onClick={search}>
              Use this photo
            </button>
          </div>
        </div>
      )}

      {step === "scan" && (
        <div className="g-cam-bottom" role="status">
          <span className="g-cam-headline">
            Looking for <em>you…</em>
          </span>
          <div className="g-progress">
            <div style={{ width: `${Math.round(scan.p * 100)}%` }} />
          </div>
          <div className="g-scan-meta">
            <span>{scan.label || `Checked ${scan.checked} of ${photos.length} photos`}</span>
            <span>{Math.round(scan.p * 100)}%</span>
          </div>
          <div className="g-scan-strip" aria-hidden>
            {photos.slice(Math.max(0, scan.checked - 5), scan.checked + 4).map((p) => {
              const k = photos.indexOf(p);
              return (
                <img
                  key={p.id}
                  src={photoUrl(slug, p, "thumb")}
                  alt=""
                  className={k === scan.checked ? "is-now" : ""}
                  style={{ opacity: k === scan.checked ? 1 : k < scan.checked ? 0.35 : 0.7 }}
                />
              );
            })}
          </div>
          <button className="g-btn g-btn-light" onClick={close}>
            Cancel
          </button>
        </div>
      )}

      {step === "denied" && (
        <Notice
          icon="camera-off"
          title={<>Camera access <em>is off.</em></>}
          text="Allow camera access for this site in your browser settings, or upload a photo instead."
          primary={["Upload a photo", () => fileRef.current?.click()]}
          secondary={["Try again", () => setStep("camera")]}
        />
      )}
      {step === "noface" && (
        <Notice
          icon="face"
          title={<>No face <em>found.</em></>}
          text="Try a clear, front-facing selfie in good light, without sunglasses."
          primary={["Retake", () => setStep("camera")]}
          secondary={["Upload a photo", () => fileRef.current?.click()]}
        />
      )}
      {step === "error" && (
        <Notice
          icon="face"
          title={<>Face search <em>didn&apos;t load.</em></>}
          text="Check your connection and try again."
          primary={["Try again", search]}
          secondary={["Close", close]}
        />
      )}
    </CameraLayer>
  );
}

function CameraLayer({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  useLayer(onClose);
  return (
    <div className="g-cam" role="dialog" aria-modal="true" aria-label="Find me">
      {children}
    </div>
  );
}

function Notice({
  icon,
  title,
  text,
  primary,
  secondary,
}: {
  icon: "camera-off" | "face";
  title: React.ReactNode;
  text: string;
  primary: [string, () => void];
  secondary: [string, () => void];
}) {
  return (
    <div className="g-cam-center" role="alert">
      <div className="g-cam-icon">
        {icon === "camera-off" ? (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="square" aria-hidden>
            <path d="M3 7h4l2-3h6l2 3h4v13H3z" />
            <circle cx="12" cy="13" r="3.5" />
            <path d="M3 3l18 18" />
          </svg>
        ) : (
          <FaceIcon size={24} />
        )}
      </div>
      <span className="g-cam-headline" style={{ fontSize: 36 }}>{title}</span>
      <span className="g-cam-text">{text}</span>
      <div className="g-stack" style={{ marginTop: 8 }}>
        <button className="g-btn g-btn-green g-btn-green-on-dark" style={{ minHeight: 50 }} onClick={primary[1]}>
          {primary[0]}
        </button>
        <button className="g-btn g-btn-light" style={{ minHeight: 46 }} onClick={secondary[1]}>
          {secondary[0]}
        </button>
      </div>
    </div>
  );
}

export function FaceIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="square" aria-hidden>
      <path d="M3 8V3h5M16 3h5v5M21 16v5h-5M8 21H3v-5" />
      <circle cx="12" cy="10" r="3.2" />
      <path d="M6.5 18c1.2-2.6 3.2-3.8 5.5-3.8s4.3 1.2 5.5 3.8" />
    </svg>
  );
}

function setEngineProgress(p: number) {
  engineProgress = p;
  progressListeners.forEach((l) => l(p));
}

function loadEngine(slug: string) {
  enginePromise ??= (async () => {
    // Only the WebAssembly CPU backend: small, and works on every phone.
    const ort = await import("onnxruntime-web/wasm");
    ort.env.wasm.wasmPaths = `https://cdn.jsdelivr.net/npm/onnxruntime-web@${ort.env.versions.web}/dist/`;
    if (!globalThis.crossOriginIsolated) ort.env.wasm.numThreads = 1;

    const sizes: Record<string, [number, number]> = {};
    const fetchModel = (file: string) =>
      fetchBytes(faceModelUrl(file), (got, total) => {
        sizes[file] = [got, total];
        const [g, t] = Object.values(sizes).reduce(([a, b], [x, y]) => [a + x, b + y], [0, 0]);
        if (t) setEngineProgress(Math.min(0.95, g / t));
      });

    const [detBytes, recBytes, index] = await Promise.all([
      fetchModel("det_500m.onnx"),
      fetchModel("w600k_mbf.onnx"),
      fetch(facesUrl(slug), { credentials: mediaCredentials() }).then((r) => {
        if (!r.ok) throw new Error(`faces.json HTTP ${r.status}`);
        return r.json() as Promise<FaceIndex>;
      }),
    ]);
    const opts = { executionProviders: ["wasm"], logSeverityLevel: 3 as const };
    const det = await ort.InferenceSession.create(detBytes, opts);
    const rec = await ort.InferenceSession.create(recBytes, opts);
    setEngineProgress(1);
    return { ort: ort as unknown as OrtLike, det, rec, index };
  })();
  enginePromise.catch(() => {
    enginePromise = null;
    setEngineProgress(0);
  });
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
async function decodeImage(src: string): Promise<Rgb> {
  const img = new Image();
  img.src = src;
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
}
