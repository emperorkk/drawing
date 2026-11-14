// Generates the Greek narration mp3s in <app-dir>/audio from lessons.js.
//
// Usage:
//   ZYPHRA_API_KEY=... node scripts/gen-audio.js public                    (Zyphra, the default)
//   OPENAI_API_KEY=... node scripts/gen-audio.js public --provider openai  (OpenAI)
//   add --force to regenerate clips that already exist,
//   --only a,b,c to limit to some clips (a clip name like panta-3, or a lesson id like panta)
//
// Existing clips are skipped unless --force is given.
const fs = require("fs"), path = require("path");

const args = process.argv.slice(2);
const dir = args.find(a => !a.startsWith("--") && args[args.indexOf(a) - 1] !== "--provider" && args[args.indexOf(a) - 1] !== "--only");
const opt = n => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : undefined; };
const provider = opt("--provider") || "zyphra";
const force = args.includes("--force");
const only = opt("--only");
if (!dir) { console.error("Usage: node scripts/gen-audio.js <app-dir> [--provider zyphra|openai] [--force] [--only <prefix>]"); process.exit(1); }

const PROVIDERS = {
  zyphra: {
    url: "https://api.zyphracloud.com/api/v1/audio/speech",
    key: "ZYPHRA_API_KEY",
    body: text => ({
      model: "zyphra/ZONOS3-Mini",
      voice: "MyFairyVoice",
      input: text,
      response_format: "mp3",
      text_norm: null // the default (en_us) would expand numbers in English; the model detects Greek by itself
    }),
    // Zyphra sometimes leaves long silent gaps, or returns a clip with no speech at all.
    // After generating, run: python3 scripts/trim-silence.py public/audio <clips...>
    note: "Zyphra allows 100 speech requests per day on this account."
  },
  openai: {
    url: "https://api.openai.com/v1/audio/speech",
    key: "OPENAI_API_KEY",
    body: text => ({
      model: "gpt-4o-mini-tts",
      voice: "cedar",
      input: text,
      instructions: "Μίλα στα ελληνικά, με φυσική ελληνική προφορά. Ζεστή, χαρούμενη φωνή που μιλά σε ένα παιδί 8 χρονών. Αργός, καθαρός ρυθμός.",
      response_format: "mp3"
    })
  }
};
const P = PROVIDERS[provider];
if (!P) { console.error("Unknown provider: " + provider); process.exit(1); }

const { LESSONS, UI_AUDIO } = require(path.resolve(dir, "lessons.js"));
const out = path.join(dir, "audio");
fs.mkdirSync(out, { recursive: true });
let jobs = [];
for (const l of LESSONS) {
  jobs.push([`${l.id}-0`, l.intro]);
  l.steps.forEach((s, i) => jobs.push([`${l.id}-${i + 1}`, s.say]));
}
for (const [k, v] of Object.entries(UI_AUDIO)) jobs.push([`ui-${k}`, v]);
if (only) { const pre = only.split(","); jobs = jobs.filter(([n]) => pre.some(p => n === p || n.startsWith(p + "-") || (p.endsWith("-") && n.startsWith(p)))); }

async function one([name, text]) {
  const file = path.join(out, name + ".mp3");
  if (fs.existsSync(file) && !force) return;
  for (let attempt = 1; ; attempt++) {
    const r = await fetch(P.url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + process.env[P.key] },
      body: JSON.stringify(P.body(text))
    });
    if (r.ok) {
      const buf = Buffer.from(await r.arrayBuffer());
      if (buf.length < 2000) throw new Error(name + ": suspiciously small file (" + buf.length + " bytes)");
      fs.writeFileSync(file, buf);
      console.log("ok", name);
      return;
    }
    const msg = name + ": " + r.status + " " + (await r.text()).slice(0, 300);
    if ((r.status === 429 || r.status >= 500) && attempt < 4) { await new Promise(s => setTimeout(s, 2000 * attempt)); continue; }
    throw new Error(msg);
  }
}
(async () => {
  console.log(provider + ": " + jobs.length + " clips" + (force ? " (regenerating)" : ""));
  for (let i = 0; i < jobs.length; i += 4) await Promise.all(jobs.slice(i, i + 4).map(one));
  console.log("done");
})().catch(e => { console.error(e.message); process.exit(1); });
