# drawapp.party (Ζωγραφίζω): guide for Claude

Greek step-by-step drawing lessons for children (about 6–10), Mediterranean themes.
Plain HTML/JS, no build step. Cloudflare Worker `drawing` deploys `main` automatically.
Always commit and push to `main` (the owner's choice).

## When asked for a new drawing

The drawing itself is written by you, in the chat. Everything else is scripted.

1. **Write the draft** to `drafts/<id>.json` (git-ignored):
   `{ "id", "title", "how", "intro", "steps": [{ "say", "svg" }] }`
   - `id`: latin slug (`gata`, `dourios-ippos`). `title`: Greek name. `how`: the drawing in the
     accusative for «Πώς να ζωγραφίσεις …» (`μια γάτα στο τοιχάκι`).
   - `intro`: 1–2 warm sentences, often a small Greek/Mediterranean fact.
   - 6–9 steps for a 7–8 year old. Each `say` is one short spoken instruction (under ~160
     characters, simple Greek, second person). Big shapes first, details later; the last step
     adds background and suggests colours.
   - `svg`: only `<path>`, `<circle>`, `<text class="fill">` in a 240×240 box, stroke-only;
     `class="fill"` for small solid details (pupils, noses). Keep inside 10..230. Each step adds
     1–4 shapes. Match the style of the existing lessons in `public/lessons.js`.
2. **Check and look:** `node scripts/new-lesson.js check drafts/<id>.json`, then open
   `drafts/<id>.png` with the Read tool. Look for: is it recognisable, do new lines cross the
   subject, is anything outside the dashed frame, does each step's text match the blue lines,
   is the order sensible for drawing on paper, is the Greek correct. Fix and re-check until it
   looks right. Show the user the sheet if they want to approve it.
3. **Publish:** `node scripts/new-lesson.js publish drafts/<id>.json`
   (needs `NODE_USE_ENV_PROXY=1 NODE_EXTRA_CA_CERTS=/root/.ccr/ca-bundle.crt` in the cloud
   session so Node reaches Zyphra through the proxy). It adds the lesson to `lessons.js`,
   generates the voice with Zyphra, trims pauses, checks every clip and regenerates failures
   (3 tries), builds the pages and preview images, refreshes `sw.js`, writes
   `docs/previews/<id>.png`, and runs the validator. `--no-voice` skips the voice.
4. **Commit and push** to `main`. GitHub runs `.github/workflows/check.yml`.
5. **Tell the user** which clips to listen to (the checker catches dropped words and long
   pauses, not mispronunciation).

## Voice

- Default: Zyphra `zyphra/ZONOS3-Mini`, voice `MyFairyVoice` (`scripts/gen-audio.js`).
  OpenAI `cedar` stays available with `--provider openai`. Keys are proxy-injected network
  secrets, never in code.
- Zyphra sometimes drops words, leaves long pauses, or returns silence: always run
  `trim-silence.py` and `check-audio.py` (publish does this).

## Other rules

- Never edit generated files by hand: `public/zografies/`, `oroi/`, `aporrito/`, `metrikes/`,
  `og/`, `sitemap.xml`, `robots.txt`, `sw.js`, and the marked blocks in `index.html`.
  Change `scripts/build-site.js` or `site.config.js` and rebuild.
- After any change in `public/`: `node scripts/build-site.js --og && node scripts/update-sw.js
  && node scripts/validate-lessons.js`.
- Secrets (Worker): `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `METRICS_KEY`, set in the Cloudflare
  dashboard only. Metrics KV: `drawing-metrics`.
- Privacy: anything new that is measured must be added to the list on `/aporrito/`
  (`recorded` in `build-site.js`) before it ships.
