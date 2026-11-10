# Ζωγραφίζω

Step-by-step drawing lessons in Greek with Mediterranean themes, made for a 7–8 year old.
The app animates each stroke and reads the instruction aloud; the child draws on paper,
then photographs the finished drawing to earn a star.

- Plain HTML/JS, no build step, no dependencies.
- Photos are stored only on the device (IndexedDB). Nothing is uploaded anywhere.
- Works offline after the first visit (service worker) and can be installed to the home screen.

## Layout

```
public/            everything that gets deployed
  index.html       the app
  lessons.js       lesson data: SVG shapes + Greek text per step
  audio/           Greek narration, one mp3 per step (generated)
  sw.js            offline cache — bump VERSION when files change
  manifest.webmanifest, icons/
scripts/gen-audio.js   generates missing mp3s with OpenAI text-to-speech
```

## Deploy on Cloudflare Pages

Workers & Pages → Create → Pages → Connect to Git → pick this repo:

- Production branch: `main`
- Build command: *(leave empty)*
- Build output directory: `public`

## Adding a lesson

1. Add an entry to `public/lessons.js` (`id`, `title`, `intro`, `steps[]` with `say` + `svg`, drawn in a 240×240 box).
2. Generate the new voice clips (existing files are skipped):
   ```bash
   OPENAI_API_KEY=sk-... node scripts/gen-audio.js public
   ```
3. Add the new files to `FILES` in `public/sw.js` and bump `VERSION`.
