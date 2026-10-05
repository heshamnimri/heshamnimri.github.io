#!/usr/bin/env node
/**
 * Download the InsightFace models used by "Find me" into models/faces.
 *
 *   node scripts/face-models.mjs           # download (once, ~450 MB of zips)
 *   node scripts/face-models.mjs --sync    # also copy the browser models to R2 (needs RCLONE_REMOTE)
 *   node scripts/face-models.mjs --local   # also copy the browser models to public/ for local testing
 *
 * det_10g (publish-time detector) comes from buffalo_l; det_500m and
 * w600k_mbf (used by both the script and the browser) come from buffalo_s.
 * InsightFace models are licensed for non-commercial use.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const modelDir = path.join(repoRoot, "models/faces");
const RELEASE = "https://github.com/deepinsight/insightface/releases/download/v0.7";
const WANTED = {
  "buffalo_l.zip": ["det_10g.onnx"],
  "buffalo_s.zip": ["det_500m.onnx", "w600k_mbf.onnx"],
};
/** What the gallery page loads from <media base>/models/faces/. */
export const BROWSER_MODELS = ["det_500m.onnx", "w600k_mbf.onnx"];

fs.mkdirSync(modelDir, { recursive: true });
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "face-models-"));
for (const [zip, files] of Object.entries(WANTED)) {
  if (files.every((f) => fs.existsSync(path.join(modelDir, f)))) continue;
  const zipPath = path.join(tmp, zip);
  console.log(`Downloading ${zip}`);
  execFileSync("curl", ["-fSL", "--progress-bar", "-o", zipPath, `${RELEASE}/${zip}`], { stdio: "inherit" });
  execFileSync("unzip", ["-o", "-j", "-q", zipPath, ...files, "-d", modelDir]);
}
fs.rmSync(tmp, { recursive: true, force: true });
console.log(`Models in ${modelDir}`);

if (process.argv.includes("--local")) {
  const dest = path.join(repoRoot, "public/models/faces");
  fs.mkdirSync(dest, { recursive: true });
  for (const f of BROWSER_MODELS) fs.copyFileSync(path.join(modelDir, f), path.join(dest, f));
  console.log(`Copied browser models to ${dest}`);
}

if (process.argv.includes("--sync")) {
  const remote = process.env.RCLONE_REMOTE;
  if (!remote) {
    console.error("Set RCLONE_REMOTE (e.g. r2:sham-media) to sync.");
    process.exit(1);
  }
  // Directory copy, not copyto: bucket-scoped R2 tokens can't create buckets.
  const include = BROWSER_MODELS.flatMap((f) => ["--include", f]);
  execFileSync("rclone", ["copy", modelDir, `${remote}/models/faces`, ...include], { stdio: "inherit" });
  console.log(`Copied browser models to ${remote}/models/faces`);
}
