#!/usr/bin/env node
/**
 * Find events past their `expires` date and remove their files from R2.
 *
 *   RCLONE_REMOTE=r2:sham-media node scripts/expire-events.mjs           # dry run
 *   RCLONE_REMOTE=r2:sham-media node scripts/expire-events.mjs --delete  # purge
 *
 * The slug stays in src/data/events.json so the link still resolves to the
 * "this gallery closed" page instead of a 404. Pass --forget to drop it too.
 */
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const eventsJsonPath = path.join(repoRoot, "src/data/events.json");
const remote = process.env.RCLONE_REMOTE;
const doDelete = process.argv.includes("--delete");
const forget = process.argv.includes("--forget");
const mediaBase = process.env.NEXT_PUBLIC_MEDIA_BASE;

if (!remote) {
  console.error("Set RCLONE_REMOTE, e.g. r2:sham-media");
  process.exit(1);
}

const eventsJson = JSON.parse(fs.readFileSync(eventsJsonPath, "utf8"));
const today = new Date().toISOString().slice(0, 10);
const expired = [];

for (const slug of eventsJson.events) {
  let manifest;
  try {
    const raw = execFileSync("rclone", ["cat", `${remote}/events/${slug}/manifest.json`], { encoding: "utf8" });
    manifest = JSON.parse(raw);
  } catch {
    console.log(`${slug}: no manifest in ${remote} (already removed?)`);
    continue;
  }
  if (manifest.expires && manifest.expires < today) expired.push({ slug, manifest });
}

if (!expired.length) {
  console.log("Nothing expired.");
  process.exit(0);
}

for (const { slug, manifest } of expired) {
  console.log(`${slug}: "${manifest.title}" expired ${manifest.expires}`);
  if (doDelete) {
    // Keep a stub manifest so the page can show the "closed" notice.
    const stub = { ...manifest, photos: [], zip: undefined };
    execFileSync("rclone", ["purge", `${remote}/events/${slug}`], { stdio: "inherit" });
    execFileSync("rclone", ["rcat", `${remote}/events/${slug}/manifest.json`], {
      input: JSON.stringify(stub),
      stdio: ["pipe", "inherit", "inherit"],
    });
    if (forget) eventsJson.events = eventsJson.events.filter((s) => s !== slug);
  }
}

if (doDelete && forget) {
  fs.writeFileSync(eventsJsonPath, JSON.stringify(eventsJson, null, 2) + "\n");
}
if (!doDelete) console.log("\nDry run. Re-run with --delete to remove these from storage.");
if (mediaBase) console.log(`Media base: ${mediaBase}`);
