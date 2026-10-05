#!/usr/bin/env node
/**
 * Build faces.json for an event so guests can use "Find me".
 *
 *   node scripts/index-faces.mjs dist/events/<slug>
 *
 * Reads view/ (for detection) and full/ (for sharp face crops), writes
 * <event>/faces.json and turns on features.findMe in the manifest.
 * Also called by publish-event.mjs --find-me.
 *
 * Needs the models in models/faces (npm run faces:models).
 */
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import ort from "onnxruntime-node";
import {
  detectFaces,
  embedFace,
  encodeEmbedding,
  EMBEDDING_DIM,
  RECOGNIZER,
} from "../src/lib/faces/engine.ts";

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
export const modelDir = path.join(repoRoot, "models/faces");

const DETECT_SIZE = 1280;
const MIN_SCORE = 0.6;
/** Faces narrower than this in the original can't be recognized reliably. */
const MIN_FACE_PX = 40;

export async function indexFaces(eventDir, { log = console.log } = {}) {
  const manifestPath = path.join(eventDir, "manifest.json");
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  for (const f of ["det_10g.onnx", `${RECOGNIZER}.onnx`]) {
    if (!fs.existsSync(path.join(modelDir, f))) {
      throw new Error(`Missing ${path.join(modelDir, f)}. Run: npm run faces:models`);
    }
  }
  // Severity 3 hides a harmless warning about SCRFD's dynamic output shapes.
  const opts = { logSeverityLevel: 3 };
  const det = await ort.InferenceSession.create(path.join(modelDir, "det_10g.onnx"), opts);
  const rec = await ort.InferenceSession.create(path.join(modelDir, `${RECOGNIZER}.onnx`), opts);

  const faces = [];
  let withFaces = 0;
  for (const [i, photo] of manifest.photos.entries()) {
    const view = await loadRgb(path.join(eventDir, "view", `${photo.id}.jpg`));
    const found = (await detectFaces(ort, det, view, { size: DETECT_SIZE }))
      .filter((f) => f.score >= MIN_SCORE);

    // Embed from the original when we have it: crowd faces are tiny at 1600px.
    const fullPath = path.join(eventDir, "full", `${photo.id}.${photo.ext || "jpg"}`);
    const src = found.length && fs.existsSync(fullPath) ? await loadRgb(fullPath) : view;
    const k = src.width / view.width;

    let kept = 0;
    for (const f of found) {
      if ((f.box[2] - f.box[0]) * k < MIN_FACE_PX) continue;
      const v = await embedFace(ort, rec, src, f.kps.map((n) => n * k));
      const [x1, y1, x2, y2] = f.box;
      faces.push({
        p: photo.id,
        b: [x1 / view.width, y1 / view.height, (x2 - x1) / view.width, (y2 - y1) / view.height]
          .map((n) => Number(n.toFixed(4))),
        ...encodeEmbedding(v),
      });
      kept++;
    }
    if (kept) withFaces++;
    process.stdout.write(`\r  faces ${i + 1}/${manifest.photos.length}: ${faces.length} found          `);
  }
  process.stdout.write("\n");

  const index = { version: 1, model: RECOGNIZER, dim: EMBEDDING_DIM, faces };
  fs.writeFileSync(path.join(eventDir, "faces.json"), JSON.stringify(index));
  manifest.features = { ...manifest.features, findMe: true };
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  log(`  faces.json: ${faces.length} faces in ${withFaces} of ${manifest.photos.length} photos`);
  return index;
}

async function loadRgb(file) {
  const { data, info } = await sharp(file, { failOn: "none" })
    .rotate()
    .removeAlpha()
    .toColourspace("srgb")
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height, channels: info.channels };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const dir = process.argv[2];
  if (!dir) {
    console.error("Usage: node scripts/index-faces.mjs <event dir>");
    process.exit(1);
  }
  await indexFaces(path.resolve(dir));
  console.log(`  Upload: rclone copy "${path.resolve(dir)}" $RCLONE_REMOTE/events/${path.basename(path.resolve(dir))} --include "{faces,manifest}.json"`);
}
