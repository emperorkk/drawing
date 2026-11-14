# Ζωγραφίζω

Step-by-step drawing lessons in Greek with Mediterranean themes, made for a 7–8 year old.
The app animates each stroke and reads the instruction aloud; the child draws on paper,
then photographs the finished drawing to earn a star.

- Plain HTML/JS, no build step, no dependencies.
- Photos are stored only on the device (IndexedDB). Nothing is uploaded anywhere.
- Works offline after the first visit (service worker) and can be installed to the home screen.

## Layout

```
public/                 everything that is served (static files)
  index.html            the app (its SEO tags and static grid are generated)
  lessons.js            lesson data: SVG shapes + Greek text per step
  audio/                Greek narration, one mp3 per step (generated)
  zografies/            one crawlable page per lesson + catalogue (generated)
  oroi/ aporrito/ metrikes/   terms («ως έχει»), privacy, metrics (generated)
  og/                   1200×630 link-preview images (generated)
  sitemap.xml robots.txt (generated)
  track.js              anonymous usage counts (see /aporrito/)
  sw.js                 offline cache (generated)
worker/index.js         /api/request (Telegram), /api/event and /api/stats (metrics)
wrangler.jsonc          Worker config: assets, KV binding
site.config.js          site address, name and description
scripts/
  build-site.js         generates the pages, sitemap and preview images
  validate-lessons.js   checks lessons, clips, pages and images before publishing
  gen-audio.js          generates missing mp3s (Zyphra by default, or OpenAI)
  trim-silence.py       shortens long pauses in generated clips
  check-audio.py        flags clips with dropped words, silent gaps or murmured pauses
  update-sw.js          refreshes the offline file list
docs/seo-audit.md       SEO audit and what was done
```

## Deploy

The site is the Cloudflare Worker `drawing`, deployed by Workers Builds from `main`
(`npx wrangler deploy` reads `wrangler.jsonc`). Static files come from `public/`; the
script only answers `/api/*`. Metrics are stored in the KV namespace `drawing-metrics`.

Secrets (Worker → Settings → Variables and Secrets, type *Secret*):

| Name | What |
|---|---|
| `TELEGRAM_BOT_TOKEN` | from @BotFather (`/newbot`) |
| `TELEGRAM_CHAT_ID` | your chat id: message the bot, then open `https://api.telegram.org/bot<TOKEN>/getUpdates` and copy `message.chat.id` |
| `METRICS_KEY` | any long password; you type it on `/metrikes/` |

Local run: put the same three in `.dev.vars` (git-ignored) and run `npx wrangler dev`.

## Adding a lesson

1. Add an entry to `public/lessons.js` (`id`, `title`, `intro`, `steps[]` with `say` + `svg`, drawn in a 240×240 box).
2. Generate the new voice clips (existing files are skipped). The default is Zyphra
   (model `zyphra/ZONOS3-Mini`, voice `MyFairyVoice`); OpenAI (`cedar`) still works:
   ```bash
   ZYPHRA_API_KEY=... node scripts/gen-audio.js public
   OPENAI_API_KEY=... node scripts/gen-audio.js public --provider openai
   ```
   `--force` regenerates existing clips; `--only panta,ui-done` limits it to some clips.
   Zyphra allows 100 requests a day and sometimes leaves long pauses or returns a silent
   clip, so shorten pauses afterwards (needs ffmpeg) and re-run any clip reported EMPTY:
   ```bash
   mkdir -p /tmp/raw && cp public/audio/panta-*.mp3 /tmp/raw/
   python3 scripts/trim-silence.py public/audio /tmp/raw/*.mp3
   python3 scripts/check-audio.py public      # flags dropped words, gaps, murmured pauses
   ```
3. Build the pages and preview images, refresh the offline file list, and check everything:
   ```bash
   node scripts/build-site.js --og
   node scripts/update-sw.js
   node scripts/validate-lessons.js
   ```
   Run this after *any* change in `public/`, then commit and push. Phones reload
   themselves into the new version the next time the app is opened.
