# Media Worker

Cloudflare Worker that fronts the `sham-media` R2 bucket on `media.hishamnimri.com`.
Without it, galleries still work (Phase 1: R2 public bucket on a custom domain).
With it you get real passcodes, forced downloads, shared favorites, and guest uploads.

## Deploy

```sh
cd worker
npm i -g wrangler
wrangler login
wrangler r2 bucket create sham-media
wrangler kv namespace create STATE        # paste the id into wrangler.toml
wrangler secret put COOKIE_SECRET         # openssl rand -hex 32
wrangler secret put ADMIN_KEY             # openssl rand -hex 24
wrangler deploy
```

Then tell the site the Worker exists: add the repository variable
`NEXT_PUBLIC_MEDIA_WORKER=true` next to `NEXT_PUBLIC_MEDIA_BASE` and redeploy.

## Admin calls

```sh
export ADMIN_KEY=...
# guest uploads waiting for review
curl -H "Authorization: Bearer $ADMIN_KEY" https://media.hishamnimri.com/api/<slug>/inbox
# pull them locally, then re-run publish-event.mjs with --exact --slug <slug>
rclone copy r2:sham-media/events/<slug>/inbox ./events/<slug>/inbox
# everyone's favorites, with counts per photo
curl -H "Authorization: Bearer $ADMIN_KEY" https://media.hishamnimri.com/api/<slug>/favorites/all
```

## Local dev

```sh
wrangler dev --remote      # uses the real bucket
NEXT_PUBLIC_MEDIA_BASE=http://localhost:8787 npm run dev
```
