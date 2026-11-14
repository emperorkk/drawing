// Lesson pipeline: everything around a new drawing except the drawing itself.
// The drawing (a draft JSON file) is written by Claude in the chat; this script checks,
// renders, voices and publishes it. See CLAUDE.md for the full workflow.
//
//   node scripts/new-lesson.js check   drafts/<id>.json   validate + render a step sheet to drafts/<id>.png
//   node scripts/new-lesson.js publish drafts/<id>.json   add to lessons.js, voice, build, validate
//         [--no-voice]   skip voice generation (e.g. when the Zyphra quota is used up)
//   node scripts/new-lesson.js sheets  <out-dir>          render step sheets for every published lesson
//
// Draft format (same as an entry in public/lessons.js):
//   { "id": "delfini", "title": "Δελφίνι", "how": "ένα δελφίνι", "intro": "…",
//     "steps": [ { "say": "…", "svg": "<path d=\"…\"/>" }, … ] }
const fs = require("fs"), path = require("path"), { execFileSync } = require("child_process");
const ROOT = path.join(__dirname, "..");
const PUB = path.join(ROOT, "public");
const LESSONS_FILE = path.join(PUB, "lessons.js");
const { checkDraft } = require("./validate-lessons.js");

const run = (cmd, args, opts = {}) => execFileSync(cmd, args, { cwd: ROOT, stdio: opts.capture ? "pipe" : "inherit", encoding: "utf8", env: { ...process.env, ...(opts.env || {}) } });
const die = msg => { console.error("✗ " + msg); process.exit(1); };
const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function loadDraft(file) {
  if (!file || !fs.existsSync(file)) die(`draft not found: ${file}`);
  let d;
  try { d = JSON.parse(fs.readFileSync(file, "utf8")); } catch (e) { die(`draft is not valid JSON: ${e.message}`); }
  const problems = checkDraft(d);
  if (problems.length) die("draft has problems:\n  " + problems.join("\n  "));
  return d;
}

// ---- step sheet: every step with the new lines in blue, plus the finished drawing ----
async function renderSheet(lessons, outFile) {
  let chromium;
  try { ({ chromium } = require("playwright")); } catch { die("Playwright is not installed (npm i --no-save playwright)"); }
  const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  const page = await browser.newPage({ viewport: { width: 1000, height: 800 } });
  for (const [l, file] of lessons) {
    const cards = l.steps.map((s, i) => {
      const old = l.steps.slice(0, i).map(x => x.svg).join("");
      return `<figure><svg viewBox="0 0 240 240"><rect class="frame" x="0.5" y="0.5" width="239" height="239"/><g class="old">${old}</g><g class="cur">${s.svg}</g></svg>
        <figcaption><b>Βήμα ${i + 1}</b> ${esc(s.say)}</figcaption></figure>`;
    }).join("");
    const final = `<figure><svg viewBox="0 0 240 240"><rect class="frame" x="0.5" y="0.5" width="239" height="239"/><g class="all">${l.steps.map(s => s.svg).join("")}</g></svg><figcaption><b>Τελικό</b></figcaption></figure>`;
    await page.setContent(`<html><head><style>
      body{margin:0;padding:24px;font-family:sans-serif;background:#fff;color:#123a63;width:952px}
      h1{font-size:26px;margin:0 0 4px} p{margin:0 0 16px;color:#5b7390;font-size:15px}
      .g{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}
      figure{margin:0;border:2px solid #c9d8ea;border-radius:12px;padding:8px}
      svg{width:100%;display:block;background:#f3f7fb;border-radius:8px}
      path,circle{fill:none;stroke-linecap:round;stroke-linejoin:round}
      .frame{fill:none;stroke:#e3a0a0;stroke-width:1;stroke-dasharray:4 4}
      .old path,.old circle{stroke:#9fb4cc;stroke-width:3} .old .fill,.old text{fill:#9fb4cc;stroke:none}
      .cur path,.cur circle{stroke:#1f6fd1;stroke-width:4.5} .cur .fill,.cur text{fill:#1f6fd1;stroke:none}
      .all path,.all circle{stroke:#123a63;stroke-width:3.5} .all .fill,.all text{fill:#123a63;stroke:none}
      figcaption{font-size:13px;line-height:1.35;margin-top:6px}
    </style></head><body><h1>${esc(l.title)} <small style="font-weight:400;color:#5b7390">(${esc(l.id)}, ${l.steps.length} βήματα)</small></h1>
    <p>${esc(l.intro)}</p><div class="g">${cards}${final}</div></body></html>`);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    await page.screenshot({ path: file, fullPage: true });
    console.log("sheet:", path.relative(ROOT, file));
  }
  await browser.close();
}

// ---- add or replace the lesson in public/lessons.js ----
const q = s => JSON.stringify(s);
const sq = s => "'" + s.replace(/\\/g, "\\\\").replace(/'/g, "\\'") + "'";
function serialize(l) {
  return `  {
    id: ${q(l.id)},
    title: ${q(l.title)},
    how: ${q(l.how)},
    intro: ${q(l.intro)},
    steps: [
${l.steps.map(s => `      { say: ${q(s.say)},\n        svg: ${sq(s.svg)} }`).join(",\n")}
    ]
  }`;
}
function upsertLesson(l) {
  let src = fs.readFileSync(LESSONS_FILE, "utf8");
  const marker = `    id: ${q(l.id)},`;
  const at = src.indexOf(marker);
  if (at >= 0) {
    const start = src.lastIndexOf("\n  {\n", at) + 1;
    const endIdx = src.indexOf("\n  }", at) + 4; // through the closing brace of this lesson
    src = src.slice(0, start) + serialize(l) + src.slice(endIdx);
    console.log(`replaced lesson ${l.id} in lessons.js`);
  } else {
    const tail = "\n  }\n];\nvar UI_AUDIO";
    const i = src.indexOf(tail);
    if (i < 0) die("could not find the end of the LESSONS array in lessons.js");
    src = src.slice(0, i) + "\n  },\n" + serialize(l) + "\n];\nvar UI_AUDIO" + src.slice(i + tail.length);
    console.log(`added lesson ${l.id} to lessons.js`);
  }
  fs.writeFileSync(LESSONS_FILE, src);
  delete require.cache[require.resolve(LESSONS_FILE)];
  const { LESSONS } = require(LESSONS_FILE);
  const back = LESSONS.find(x => x.id === l.id);
  if (!back || JSON.stringify(back) !== JSON.stringify(l)) die("lessons.js did not round-trip the lesson correctly");
}

// ---- voice: generate, trim pauses, check, regenerate failures (max 3 tries per clip) ----
function voice(l) {
  const tmp = fs.mkdtempSync(path.join(require("os").tmpdir(), "voice-"));
  const env = { ZYPHRA_API_KEY: process.env.ZYPHRA_API_KEY || "proxy-injected" };
  const clips = Array.from({ length: l.steps.length + 1 }, (_, n) => `${l.id}-${n}`);
  let todo = clips;
  for (let attempt = 1; attempt <= 3 && todo.length; attempt++) {
    console.log(`voice attempt ${attempt}: ${todo.join(", ")}`);
    run("node", ["scripts/gen-audio.js", "public", "--force", "--only", todo.join(",")], { env });
    for (const c of todo) fs.copyFileSync(path.join(PUB, "audio", c + ".mp3"), path.join(tmp, c + ".mp3"));
    const trimmed = run("python3", ["scripts/trim-silence.py", path.join(PUB, "audio"), ...todo.map(c => path.join(tmp, c + ".mp3"))], { capture: true });
    const empty = trimmed.split("\n").filter(x => x.includes("EMPTY")).map(x => x.split(".mp3")[0]);
    let report = "";
    try { report = run("python3", ["scripts/check-audio.py", "public", ...todo], { capture: true }); }
    catch (e) { report = e.stdout || ""; }
    const failed = report.split("\n").filter(x => x.trim() && !/ ok$/.test(x) && !/clips flagged/.test(x)).map(x => x.split(/\s+/)[0]);
    todo = [...new Set([...failed, ...empty])];
    if (todo.length) console.log("needs another try:\n  " + report.split("\n").filter(x => todo.some(t => x.startsWith(t))).join("\n  "));
  }
  if (todo.length) die(`these clips still fail after 3 tries: ${todo.join(", ")} (listen to them, or rewrite their text)`);
  console.log("voice: all clips pass");
}

(async () => {
  const [cmd, arg] = process.argv.slice(2);
  if (cmd === "check") {
    const l = loadDraft(arg);
    await renderSheet([[l, arg.replace(/\.json$/, ".png")]]);
    console.log(`✓ ${l.id}: ${l.steps.length} steps pass the checks. Look at the sheet before publishing.`);
  } else if (cmd === "publish") {
    const l = loadDraft(arg);
    upsertLesson(l);
    if (!process.argv.includes("--no-voice")) voice(l);
    run("node", ["scripts/build-site.js", "--og"]);
    run("node", ["scripts/update-sw.js"]);
    await renderSheet([[l, path.join(ROOT, "docs", "previews", l.id + ".png")]]);
    run("node", ["scripts/validate-lessons.js"]);
    console.log(`✓ ${l.id} published locally. Review, then commit and push.`);
  } else if (cmd === "sheets") {
    const { LESSONS } = require(LESSONS_FILE);
    await renderSheet(LESSONS.map(l => [l, path.join(path.resolve(arg || "previews"), l.id + ".png")]));
  } else {
    console.log("usage: node scripts/new-lesson.js check|publish <draft.json> [--no-voice]  |  sheets <out-dir>");
    process.exit(cmd ? 1 : 0);
  }
})().catch(e => die(e.stack || e.message));
