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
  qr.js                 small QR code encoder for the QR button (no dependencies)
  sw.js                 offline cache (generated)
worker/index.js         /api/request (Telegram), /api/event and /api/stats (metrics)
wrangler.jsonc          Worker config: assets, KV binding
site.config.js          site address, name and description
scripts/
  new-lesson.js         lesson pipeline: check/render a draft, publish (voice, build, validate)
  build-site.js         generates the pages, sitemap and preview images
  validate-lessons.js   checks lessons, clips, pages and images before publishing
  gen-audio.js          generates missing mp3s (Zyphra by default, or OpenAI)
  trim-silence.py       shortens long pauses in generated clips
  check-audio.py        flags clips with dropped words, silent gaps or murmured pauses
  update-sw.js          refreshes the offline file list
docs/seo-audit.md       SEO audit and what was done
docs/previews/          step sheet of every lesson (new lines in blue)
.github/workflows/check.yml   checks every push: lessons, pages up to date, voice clips, Worker config
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

Ask for it in the Claude chat; `CLAUDE.md` has the workflow. By hand:

```bash
node scripts/new-lesson.js check drafts/<id>.json     # validate + step sheet drafts/<id>.png
ZYPHRA_API_KEY=... node scripts/new-lesson.js publish drafts/<id>.json
git add -A && git commit -m "Add <id> lesson" && git push
```

`publish` adds the lesson to `lessons.js`, generates and checks the voice clips (regenerating
failures), builds pages and preview images, refreshes the offline cache and validates.
Single steps are still available: `gen-audio.js`, `trim-silence.py`, `check-audio.py`,
`build-site.js --og`, `update-sw.js`, `validate-lessons.js`.
