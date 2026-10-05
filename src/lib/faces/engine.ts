/**
 * Face detection and embedding shared by the publish script (onnxruntime-node)
 * and the gallery page (onnxruntime-web). Both sides must produce comparable
 * embeddings, so the pre- and post-processing lives here once.
 *
 * Models are InsightFace (non-commercial license):
 *   - SCRFD detector (det_10g when indexing, det_500m in the browser)
 *   - ArcFace w600k_mbf recognizer, 512-d embeddings
 *
 * This file is imported directly by Node (type stripping), so it must stay
 * self-contained and use only erasable TypeScript syntax.
 */

export type Rgb = {
  data: Uint8Array | Uint8ClampedArray;
  width: number;
  height: number;
  /** 3 for RGB, 4 for RGBA (canvas ImageData). */
  channels: number;
};

export type Face = {
  /** x1, y1, x2, y2 in image pixels. */
  box: [number, number, number, number];
  score: number;
  /** Five landmarks (eyes, nose, mouth corners) as x0, y0, x1, y1, ... */
  kps: number[];
};

/** The subset of the onnxruntime API used here; node and web share it. */
type OrtTensor = { data: unknown; dims: readonly number[] };
export type OrtLike = {
  Tensor: new (type: "float32", data: Float32Array, dims: number[]) => OrtTensor;
};
export type OrtSession = {
  inputNames: readonly string[];
  outputNames: readonly string[];
  run(feeds: Record<string, OrtTensor>): Promise<Record<string, OrtTensor>>;
};

export const EMBEDDING_DIM = 512;
export const RECOGNIZER = "w600k_mbf";

/** Cosine similarity at or above this is shown as a match. */
export const MATCH_THRESHOLD = 0.4;
/** "Show more" lowers the bar to this. */
export const LOOSE_THRESHOLD = 0.32;

const STRIDES = [8, 16, 32];
const ANCHORS_PER_CELL = 2;

/**
 * Run SCRFD on an image. The image is letterboxed into a square of `size`
 * (a multiple of 32), so pass something close to that size for best speed.
 */
export async function detectFaces(
  ort: OrtLike,
  session: OrtSession,
  img: Rgb,
  { size = 640, threshold = 0.5, nms = 0.4 } = {},
): Promise<Face[]> {
  const scale = Math.min(size / img.width, size / img.height);
  const w = Math.round(img.width * scale);
  const h = Math.round(img.height * scale);
  const input = new Float32Array(3 * size * size);
  const plane = size * size;
  // Area-average when shrinking a lot so small faces keep their detail.
  const step = 1 / scale;
  const taps = Math.max(1, Math.min(4, Math.floor(step)));
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let r = 0, g = 0, b = 0;
      for (let ty = 0; ty < taps; ty++) {
        for (let tx = 0; tx < taps; tx++) {
          const sx = (x + (tx + 0.5) / taps) * step - 0.5;
          const sy = (y + (ty + 0.5) / taps) * step - 0.5;
          const px = bilinear(img, sx, sy);
          r += px[0]; g += px[1]; b += px[2];
        }
      }
      const n = taps * taps;
      const o = y * size + x;
      input[o] = (r / n - 127.5) / 128;
      input[plane + o] = (g / n - 127.5) / 128;
      input[2 * plane + o] = (b / n - 127.5) / 128;
    }
  }
  // SCRFD expects the letterbox padding to be black, normalized.
  const pad = -127.5 / 128;
  for (let y = 0; y < size; y++) {
    for (let x = y < h ? w : 0; x < size; x++) {
      const o = y * size + x;
      input[o] = input[plane + o] = input[2 * plane + o] = pad;
    }
  }

  const tensor = new ort.Tensor("float32", input, [1, 3, size, size]);
  const out = await session.run({ [session.inputNames[0]]: tensor });
  const names = session.outputNames;
  const faces: Face[] = [];

  STRIDES.forEach((stride, i) => {
    const scores = out[names[i]].data as Float32Array;
    const boxes = out[names[i + STRIDES.length]].data as Float32Array;
    const kps = out[names[i + 2 * STRIDES.length]].data as Float32Array;
    const cols = Math.ceil(size / stride);
    for (let a = 0; a < scores.length; a++) {
      const score = scores[a];
      if (score < threshold) continue;
      const cell = Math.floor(a / ANCHORS_PER_CELL);
      const cx = (cell % cols) * stride;
      const cy = Math.floor(cell / cols) * stride;
      const d = boxes.subarray(a * 4, a * 4 + 4);
      const k = kps.subarray(a * 10, a * 10 + 10);
      const pts: number[] = [];
      for (let p = 0; p < 5; p++) {
        pts.push((cx + k[p * 2] * stride) / scale, (cy + k[p * 2 + 1] * stride) / scale);
      }
      faces.push({
        box: [
          (cx - d[0] * stride) / scale,
          (cy - d[1] * stride) / scale,
          (cx + d[2] * stride) / scale,
          (cy + d[3] * stride) / scale,
        ],
        score,
        kps: pts,
      });
    }
  });

  return nonMaxSuppression(faces, nms);
}

// ArcFace's canonical landmark positions in a 112x112 crop.
const ARCFACE_DST = [
  38.2946, 51.6963, 73.5318, 51.5014, 56.0252, 71.7366, 41.5493, 92.3655,
  70.7299, 92.2041,
];

/** Align a face to 112x112 and return its L2-normalized embedding. */
export async function embedFace(
  ort: OrtLike,
  session: OrtSession,
  img: Rgb,
  kps: number[],
): Promise<Float32Array> {
  // Similarity transform from crop space to image space.
  const [a, b, tx, ty] = similarity(ARCFACE_DST, kps);
  const zoom = Math.hypot(a, b);
  const taps = Math.max(1, Math.min(6, Math.round(zoom)));
  const size = 112;
  const plane = size * size;
  const input = new Float32Array(3 * plane);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = 0, g = 0, bl = 0;
      for (let sy = 0; sy < taps; sy++) {
        for (let sx = 0; sx < taps; sx++) {
          const u = x - 0.5 + (sx + 0.5) / taps;
          const v = y - 0.5 + (sy + 0.5) / taps;
          const px = bilinear(img, a * u - b * v + tx, b * u + a * v + ty);
          r += px[0]; g += px[1]; bl += px[2];
        }
      }
      const n = taps * taps;
      const o = y * size + x;
      input[o] = (r / n - 127.5) / 127.5;
      input[plane + o] = (g / n - 127.5) / 127.5;
      input[2 * plane + o] = (bl / n - 127.5) / 127.5;
    }
  }
  const tensor = new ort.Tensor("float32", input, [1, 3, size, size]);
  const out = await session.run({ [session.inputNames[0]]: tensor });
  return normalize(Float32Array.from(out[session.outputNames[0]].data as Float32Array));
}

export function cosine(a: ArrayLike<number>, b: ArrayLike<number>) {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}

/* ---------- faces.json ---------- */

export type FaceIndex = {
  version: 1;
  model: string;
  dim: number;
  /** One entry per indexed face. */
  faces: {
    /** Photo id from the manifest. */
    p: string;
    /** Box as fractions of the photo: x, y, w, h. */
    b: [number, number, number, number];
    /** int8 embedding, base64. */
    e: string;
    /** Dequantization scale. */
    s: number;
  }[];
};

/** Quantize a normalized embedding to int8 + scale (4x smaller, same ranking). */
export function encodeEmbedding(v: Float32Array) {
  let max = 0;
  for (const x of v) max = Math.max(max, Math.abs(x));
  const s = max / 127 || 1;
  const q = new Int8Array(v.length);
  for (let i = 0; i < v.length; i++) q[i] = Math.round(v[i] / s);
  return { e: toBase64(new Uint8Array(q.buffer)), s: Number(s.toPrecision(6)) };
}

export function decodeEmbedding(e: string, s: number) {
  const q = new Int8Array(fromBase64(e).buffer);
  const v = new Float32Array(q.length);
  for (let i = 0; i < q.length; i++) v[i] = q[i] * s;
  return normalize(v);
}

/** Best similarity per photo id, sorted best first. */
export function matchPhotos(index: FaceIndex, probe: Float32Array) {
  const best = new Map<string, number>();
  for (const f of index.faces) {
    const sim = cosine(probe, decodeEmbedding(f.e, f.s));
    if (sim > (best.get(f.p) ?? -1)) best.set(f.p, sim);
  }
  return [...best.entries()]
    .map(([id, score]) => ({ id, score }))
    .sort((x, y) => y.score - x.score);
}

/* ---------- helpers ---------- */

function bilinear(img: Rgb, x: number, y: number): [number, number, number] {
  const { width: w, height: h, channels: c, data } = img;
  if (x < -0.5 || y < -0.5 || x > w - 0.5 || y > h - 0.5) return [0, 0, 0];
  const x0 = Math.max(0, Math.min(w - 1, Math.floor(x)));
  const y0 = Math.max(0, Math.min(h - 1, Math.floor(y)));
  const x1 = Math.min(w - 1, x0 + 1);
  const y1 = Math.min(h - 1, y0 + 1);
  const fx = Math.max(0, Math.min(1, x - x0));
  const fy = Math.max(0, Math.min(1, y - y0));
  const i00 = (y0 * w + x0) * c, i10 = (y0 * w + x1) * c;
  const i01 = (y1 * w + x0) * c, i11 = (y1 * w + x1) * c;
  const out: [number, number, number] = [0, 0, 0];
  for (let k = 0; k < 3; k++) {
    const top = data[i00 + k] * (1 - fx) + data[i10 + k] * fx;
    const bot = data[i01 + k] * (1 - fx) + data[i11 + k] * fx;
    out[k] = top * (1 - fy) + bot * fy;
  }
  return out;
}

/**
 * Least-squares similarity transform mapping `src` points onto `dst`
 * (flat x,y arrays). Returns [a, b, tx, ty] for
 *   x' = a*x - b*y + tx,  y' = b*x + a*y + ty
 */
function similarity(src: number[], dst: number[]): [number, number, number, number] {
  const n = src.length / 2;
  let sx = 0, sy = 0, dx = 0, dy = 0;
  for (let i = 0; i < n; i++) {
    sx += src[2 * i]; sy += src[2 * i + 1];
    dx += dst[2 * i]; dy += dst[2 * i + 1];
  }
  sx /= n; sy /= n; dx /= n; dy /= n;
  let num1 = 0, num2 = 0, den = 0;
  for (let i = 0; i < n; i++) {
    const px = src[2 * i] - sx, py = src[2 * i + 1] - sy;
    const qx = dst[2 * i] - dx, qy = dst[2 * i + 1] - dy;
    num1 += px * qx + py * qy;
    num2 += px * qy - py * qx;
    den += px * px + py * py;
  }
  const a = num1 / den;
  const b = num2 / den;
  return [a, b, dx - (a * sx - b * sy), dy - (b * sx + a * sy)];
}

function nonMaxSuppression(faces: Face[], iouLimit: number) {
  faces.sort((x, y) => y.score - x.score);
  const kept: Face[] = [];
  for (const f of faces) {
    if (kept.every((k) => iou(k.box, f.box) <= iouLimit)) kept.push(f);
  }
  return kept;
}

function iou(a: number[], b: number[]) {
  const ix = Math.max(0, Math.min(a[2], b[2]) - Math.max(a[0], b[0]));
  const iy = Math.max(0, Math.min(a[3], b[3]) - Math.max(a[1], b[1]));
  const inter = ix * iy;
  const area = (r: number[]) => (r[2] - r[0]) * (r[3] - r[1]);
  return inter / (area(a) + area(b) - inter);
}

function normalize(v: Float32Array) {
  let n = 0;
  for (const x of v) n += x * x;
  n = Math.sqrt(n) || 1;
  for (let i = 0; i < v.length; i++) v[i] /= n;
  return v;
}

function toBase64(bytes: Uint8Array) {
  let s = "";
  for (const x of bytes) s += String.fromCharCode(x);
  return btoa(s);
}

function fromBase64(b64: string) {
  const s = atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}
