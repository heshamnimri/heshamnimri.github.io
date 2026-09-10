#!/usr/bin/env node
/**
 * Publish an event gallery from a folder of exported JPEGs.
 *
 *   node scripts/publish-event.mjs <folder> --title "Nadia & Omar" [options]
 *
 * Options
 *   --slug <slug>        Base slug. A random 6-char suffix is appended unless --exact.
 *   --exact              Use --slug as-is (for republishing an existing event).
 *   --date YYYY-MM-DD    Event date.
 *   --note "..."         Short note shown under the title.
 *   --cover <id>         Photo id (file basename) to use as the cover.
 *   --expires YYYY-MM-DD Gallery closes after this date.
 *   --passcode <text>    Gate the gallery. Stored as a sha-256 hash.
 *   --brand-name, --brand-logo <url>, --brand-accent <#hex>
 *   --license "..."      Usage line in the footer.
 *   --favorites          Enable favorites (shared when the Worker is deployed).
 *   --upload             Enable guest uploads (requires the Worker).
 *   --out <dir>          Output root. Default: dist/events
 *   --local              Write into public/events so the static site serves it (Phase 0 / testing).
 *   --sync               Run rclone sync to R2 after building (needs RCLONE_REMOTE, e.g. r2:sham-media).
 *   --no-zip             Skip building the all-photos zip.
 *   --no-gps-strip       Keep GPS EXIF in originals.
 *
 * Output layout (mirrors what the page and the Worker expect):
 *   <out>/<slug>/manifest.json
 *   <out>/<slug>/thumb/<id>.jpg   (480px long edge)
 *   <out>/<slug>/view/<id>.jpg    (1600px long edge)
 *   <out>/<slug>/full/<id>.<ext>  (original bytes, GPS stripped)
 *   <out>/<slug>/all-photos.zip
 *   <out>/<slug>/qr.png
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import sharp from "sharp";
import { ZipArchive } from "archiver";
import QRCode from "qrcode";

const SITE_URL = "https://hishamnimri.com";
const THUMB = 480;
const VIEW = 1600;
const EXTS = new Set([".jpg", ".jpeg", ".png", ".webp"]);

const args = parseArgs(process.argv.slice(2));
const folder = args._[0];
if (!folder || !args.title) {
  console.error("Usage: node scripts/publish-event.mjs <folder> --title \"Event name\" [options]");
  process.exit(1);
}

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const eventsJsonPath = path.join(repoRoot, "src/data/events.json");
const slug = args.exact
  ? args.slug
  : `${slugify(args.slug || args.title)}-${crypto.randomBytes(4).toString("base64url").slice(0, 6).toLowerCase()}`;
const outRoot = args.local
  ? path.join(repoRoot, "public/events")
  : path.resolve(args.out || "dist/events");
const out = path.join(outRoot, slug);

const files = fs
  .readdirSync(folder)
  .filter((f) => EXTS.has(path.extname(f).toLowerCase()) && !f.startsWith("."))
  .sort(naturalCompare);
if (!files.length) {
  console.error(`No images found in ${folder}`);
  process.exit(1);
}

for (const d of ["thumb", "view", "full"]) fs.mkdirSync(path.join(out, d), { recursive: true });

const hasExiftool = spawnSync("exiftool", ["-ver"], { stdio: "ignore" }).status === 0;
if (!args["no-gps-strip"] && !hasExiftool) {
  console.warn("exiftool not found: originals keep their GPS data. Install with `brew install exiftool`.");
}

console.log(`Publishing ${files.length} photos as ${slug}`);
const photos = [];
for (const [i, file] of files.entries()) {
  const src = path.join(folder, file);
  const ext = path.extname(file).toLowerCase().replace(".jpeg", ".jpg");
  const id = path.basename(file, path.extname(file)).replace(/[^\w-]+/g, "-");
  const image = sharp(src, { failOn: "none" }).rotate();
  const meta = await image.metadata();
  const rotated = meta.orientation && meta.orientation >= 5;
  const w = rotated ? meta.height : meta.width;
  const h = rotated ? meta.width : meta.height;

  await image.clone().resize({ width: THUMB, height: THUMB, fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 78, mozjpeg: true }).toFile(path.join(out, "thumb", `${id}.jpg`));
  await image.clone().resize({ width: VIEW, height: VIEW, fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 86, mozjpeg: true }).toFile(path.join(out, "view", `${id}.jpg`));

  const fullPath = path.join(out, "full", `${id}${ext}`);
  fs.copyFileSync(src, fullPath);
  if (!args["no-gps-strip"] && hasExiftool) {
    execFileSync("exiftool", ["-q", "-gps:all=", "-overwrite_original", fullPath]);
  }

  photos.push({
    id,
    w,
    h,
    bytes: fs.statSync(fullPath).size,
    ext: ext.slice(1),
    taken: exifDate(meta),
  });
  process.stdout.write(`\r  ${i + 1}/${files.length} ${file}          `);
}
process.stdout.write("\n");

let zip;
if (!args["no-zip"]) {
  const zipName = "all-photos.zip";
  const zipPath = path.join(out, zipName);
  await new Promise((resolve, reject) => {
    const output = fs.createWriteStream(zipPath);
    const archive = new ZipArchive({ store: true });
    output.on("close", resolve);
    archive.on("error", reject);
    archive.pipe(output);
    for (const p of photos) {
      archive.file(path.join(out, "full", `${p.id}.${p.ext}`), { name: `${slug}/${p.id}.${p.ext}` });
    }
    archive.finalize();
  });
  zip = { file: zipName, bytes: fs.statSync(zipPath).size, count: photos.length };
  console.log(`  zip: ${(zip.bytes / 1e6).toFixed(0)} MB`);
}

const galleryUrl = `${SITE_URL}/e/${slug}`;
await QRCode.toFile(path.join(out, "qr.png"), galleryUrl, { width: 1200, margin: 2 });

const manifest = {
  slug,
  title: args.title,
  date: args.date,
  note: args.note,
  cover: args.cover ? args.cover.replace(/\.\w+$/, "") : photos[0].id,
  expires: args.expires,
  published: new Date().toISOString().slice(0, 10),
  passcodeHash: args.passcode
    ? crypto.createHash("sha256").update(String(args.passcode).trim()).digest("hex")
    : undefined,
  brand:
    args["brand-name"] || args["brand-logo"] || args["brand-accent"]
      ? { name: args["brand-name"], logo: args["brand-logo"], accent: args["brand-accent"] }
      : undefined,
  license: args.license,
  zip,
  features: { favorites: Boolean(args.favorites), upload: Boolean(args.upload) },
  photos,
};
fs.writeFileSync(path.join(out, "manifest.json"), JSON.stringify(manifest, null, 2));

// Register the slug so the site build pre-renders /e/<slug>/ with a 200.
const eventsJson = JSON.parse(fs.readFileSync(eventsJsonPath, "utf8"));
if (!eventsJson.events.includes(slug)) {
  eventsJson.events.push(slug);
  fs.writeFileSync(eventsJsonPath, JSON.stringify(eventsJson, null, 2) + "\n");
}

if (args.sync) {
  const remote = process.env.RCLONE_REMOTE;
  if (!remote) {
    console.error("Set RCLONE_REMOTE (e.g. r2:sham-media) to sync.");
    process.exit(1);
  }
  console.log(`Syncing to ${remote}/events/${slug}`);
  execFileSync("rclone", ["sync", out, `${remote}/events/${slug}`, "--progress", "--transfers", "8"], {
    stdio: "inherit",
  });
}

console.log(`
Done.
  Gallery:   ${galleryUrl}
  Files:     ${out}
  QR code:   ${path.join(out, "qr.png")}
${args.passcode ? `  Passcode:  ${args.passcode}\n` : ""}${
  args.sync ? "" : `  Upload:    rclone sync "${out}" $RCLONE_REMOTE/events/${slug}\n`
}  Commit src/data/events.json so the page is pre-rendered (the link already works via the 404 fallback).
`);

function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith("--")) out[key] = true;
      else {
        out[key] = next;
        i++;
      }
    } else out._.push(a);
  }
  return out;
}

function slugify(s) {
  return String(s).toLowerCase().normalize("NFKD").replace(/[^\w\s-]/g, "").trim().replace(/[\s_]+/g, "-").replace(/-+/g, "-").slice(0, 40);
}

function naturalCompare(a, b) {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
}

function exifDate(meta) {
  if (!meta.exif) return undefined;
  const m = meta.exif.toString("latin1").match(/(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}` : undefined;
}
