# Event galleries

Share one link with the people at an event so they can browse and download the
photos in full resolution. No app, no account.

Sample: `/e/sample-elections` (built from `public/photos/elections`).

## How it fits together

| Piece | Where | Role |
| --- | --- | --- |
| Gallery page | `src/app/e/[slug]` + `src/components/gallery` | Grid, lightbox, downloads, share sheet, QR, passcode gate, favorites, guest upload |
| 404 fallback | `src/app/not-found.tsx` | Opens any `/e/<slug>` that exists in storage but is not yet in `events.json`, so a new event never waits for a deploy |
| Event list | `src/data/events.json` | Slugs to pre-render, plus the private index token |
| Private index | `/e/index-<indexToken>` | Every event with status, for your eyes only |
| Publish script | `scripts/publish-event.mjs` | Folder of JPEGs → thumbs, view sizes, originals, zip, QR, manifest |
| Expiry script | `scripts/expire-events.mjs` | Purges expired events from storage, leaves a "closed" stub |
| Worker | `worker/` | Optional. Real passcodes, forced downloads, shared favorites, guest uploads |

Media location is set by `NEXT_PUBLIC_MEDIA_BASE`:

- unset → `public/events` inside the static site (Phase 0, testing only)
- `https://media.hishamnimri.com` → Cloudflare R2 bucket (objects live under `events/<slug>/`)

Set `NEXT_PUBLIC_MEDIA_WORKER=true` only after deploying the Worker. It switches
the page to cookie-based passcodes, shared favorites and guest uploads.

## Publish an event

```sh
# 1. Export full-size JPEGs from Lightroom into a folder (quality 90, sRGB)
# 2. Build the gallery
npm run event:publish -- ./events/smith-wedding \
  --title "Nadia & Omar" --date 2026-08-22 \
  --note "Thank you for having me. Download anything you like." \
  --expires 2027-08-22 --passcode sunset --favorites
# 3. Upload (or pass --sync with RCLONE_REMOTE=r2:sham-media set)
rclone sync dist/events/nadia-omar-k3f9q2 r2:sham-media/events/nadia-omar-k3f9q2
# 4. Commit src/data/events.json so the page gets a real 200 on the next deploy
```

The script prints the link, the passcode, and where the printable QR code is.
Re-run with `--exact --slug <slug>` to republish the same event after edits.

Flags: `--cover <id>`, `--brand-name`, `--brand-logo <url>`, `--brand-accent #hex`,
`--license "..."`, `--upload`, `--no-zip`, `--no-gps-strip`, `--local`.

Install `exiftool` (`brew install exiftool`) so GPS is stripped from originals.

## Storage setup (Phase 1)

1. Cloudflare → R2 → create bucket `sham-media`.
2. Bucket settings → custom domain `media.hishamnimri.com`.
3. Bucket CORS: allow `GET, HEAD` from `https://hishamnimri.com` (needed for
   selection downloads, which fetch originals into a zip in the browser).
4. `rclone config` with an R2 API token; name the remote `r2`.
5. GitHub repo → Settings → Variables → `NEXT_PUBLIC_MEDIA_BASE = https://media.hishamnimri.com`.

Without the Worker, a passcode is checked in the browser against a hash in the
manifest. It keeps casual visitors out but anyone who reads the manifest can
list the files. For anything sensitive, deploy the Worker (see `worker/README.md`).

## Close an event

```sh
RCLONE_REMOTE=r2:sham-media npm run event:expire            # dry run
RCLONE_REMOTE=r2:sham-media npm run event:expire -- --delete
```

## Analytics

GA4 events: `gallery_view`, `gallery_unlock`, `photo_open`, `download_photo`,
`download_all`, `download_selection`, `share_copy`, `share_native`,
`favorite_toggle`, `guest_upload`. All carry `event_slug`.
