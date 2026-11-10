// Generates Greek narration mp3s with OpenAI TTS. Usage: OPENAI_API_KEY=... node scripts/gen-audio.js public
const fs = require("fs"), path = require("path");
const dir = process.argv[2];
const { LESSONS, UI_AUDIO } = require(path.resolve(dir, "lessons.js"));
const out = path.join(dir, "audio");
fs.mkdirSync(out, { recursive: true });
const jobs = [];
for (const l of LESSONS) {
  jobs.push([`${l.id}-0`, l.intro]);
  l.steps.forEach((s, i) => jobs.push([`${l.id}-${i + 1}`, s.say]));
}
for (const [k, v] of Object.entries(UI_AUDIO)) jobs.push([`ui-${k}`, v]);

async function one([name, text]) {
  const file = path.join(out, name + ".mp3");
  if (fs.existsSync(file)) return;
  const r = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + process.env.OPENAI_API_KEY },
    body: JSON.stringify({
      model: "gpt-4o-mini-tts",
      voice: "cedar",
      input: text,
      instructions: "Μίλα στα ελληνικά, με φυσική ελληνική προφορά. Ζεστή, χαρούμενη φωνή που μιλά σε ένα παιδί 8 χρονών. Αργός, καθαρός ρυθμός.",
      response_format: "mp3"
    })
  });
  if (!r.ok) throw new Error(name + ": " + r.status + " " + (await r.text()));
  fs.writeFileSync(file, Buffer.from(await r.arrayBuffer()));
  console.log("ok", name);
}
(async () => {
  for (let i = 0; i < jobs.length; i += 4) await Promise.all(jobs.slice(i, i + 4).map(one));
  console.log("done", jobs.length);
})().catch(e => { console.error(e.message); process.exit(1); });
