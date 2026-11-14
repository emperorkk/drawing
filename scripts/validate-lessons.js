// Checks that every lesson is complete and consistent before it is published.
// Usage: node scripts/validate-lessons.js        (exit code 1 if anything is wrong)
//
// For each lesson: unique id, title, «how» phrase, intro, 3–12 steps, each with text and SVG;
// SVG uses only allowed elements, has balanced tags and stays inside the 240×240 box;
// every voice clip exists; the lesson page and preview image were built; sw.js lists the clips.
const fs = require("fs"), path = require("path");
const PUB = path.join(__dirname, "..", "public");
let problems = [];
const bad = (where, msg) => problems.push(`${where}: ${msg}`);
const ALLOWED = new Set(["path", "circle", "text"]);

function checkSvg(where, svg) {
  const tags = [...svg.matchAll(/<\/?([a-zA-Z]+)[^>]*?(\/?)>/g)];
  let open = [];
  for (const [, name, selfClose] of tags) {
    if (!ALLOWED.has(name)) bad(where, `element <${name}> is not allowed`);
  }
  // balanced: every <text ...> has a </text>; path/circle must self-close
  if ((svg.match(/<text\b/g) || []).length !== (svg.match(/<\/text>/g) || []).length) bad(where, "unclosed <text>");
  for (const m of svg.matchAll(/<(path|circle)\b[^>]*>/g)) if (!m[0].endsWith("/>")) bad(where, `<${m[1]}> must end with />`);
  for (const m of svg.matchAll(/\son\w+=|javascript:|<script/gi)) bad(where, "script or event handler in SVG");
  for (const m of svg.matchAll(/<circle\b[^>]*>/g)) {
    const g = k => +((m[0].match(new RegExp(`\\b${k}="([-\\d.]+)"`)) || [])[1]);
    const [cx, cy, r] = [g("cx"), g("cy"), g("r")];
    if ([cx, cy, r].some(isNaN)) bad(where, "circle without cx/cy/r");
    else if (cx - r < 0 || cy - r < 0 || cx + r > 240 || cy + r > 240) bad(where, `circle outside the 240×240 box (${cx},${cy},r${r})`);
  }
  for (const m of svg.matchAll(/\sd="([^"]+)"/g)) {
    // Walk the path to find absolute points (handles M L H V C Q T S Z and relative forms).
    const toks = m[1].match(/[a-zA-Z]|-?\d*\.?\d+(?:e-?\d+)?/g) || [];
    let x = 0, y = 0, cmd = "", i = 0, sx = 0, sy = 0;
    const n = () => parseFloat(toks[i++]);
    const out = [];
    while (i < toks.length) {
      if (/[a-zA-Z]/.test(toks[i])) cmd = toks[i++];
      const rel = cmd === cmd.toLowerCase(), C = cmd.toUpperCase();
      if (C === "Z") { x = sx; y = sy; continue; }
      const take = { M: 2, L: 2, T: 2, H: 1, V: 1, C: 6, S: 4, Q: 4, A: 7 }[C];
      if (!take) { bad(where, `unknown path command ${cmd}`); break; }
      const a = []; for (let k = 0; k < take; k++) a.push(n());
      if (a.some(isNaN)) { bad(where, "malformed path data"); break; }
      if (C === "H") x = rel ? x + a[0] : a[0];
      else if (C === "V") y = rel ? y + a[0] : a[0];
      else { const ex = a[take - 2], ey = a[take - 1]; x = rel ? x + ex : ex; y = rel ? y + ey : ey; }
      if (C === "M") { sx = x; sy = y; if (cmd === "m") cmd = "l"; if (cmd === "M") cmd = "L"; }
      out.push([x, y]);
    }
    for (const [px, py] of out) if (px < -1 || py < -1 || px > 241 || py > 241) { bad(where, `path point outside the box (${px.toFixed(0)},${py.toFixed(0)})`); break; }
  }
}

// Content checks for one lesson (no files needed). Used by new-lesson.js on drafts.
function checkLessonContent(l) {
  const w = l.id || "(no id)";
  if (!/^[a-z0-9-]+$/.test(l.id || "")) bad(w, "id must be lowercase latin letters, digits and dashes");
  for (const k of ["title", "how", "intro"]) if (!l[k] || typeof l[k] !== "string") bad(w, `missing ${k}`);
  if (!Array.isArray(l.steps) || l.steps.length < 3 || l.steps.length > 12) bad(w, "needs 3–12 steps");
  (l.steps || []).forEach((s, i) => {
    const sw_ = `${w} step ${i + 1}`;
    if (!s.say || s.say.length < 10) bad(sw_, "instruction text missing or too short");
    if (s.say && s.say.length > 220) bad(sw_, "instruction longer than 220 characters (hard to follow when read aloud)");
    if (!s.svg) bad(sw_, "no drawing"); else checkSvg(sw_, s.svg);
  });
}
function checkDraft(lesson) { problems = []; checkLessonContent(lesson); return problems.slice(); }
module.exports = { checkDraft };

if (require.main === module) {
const { LESSONS, UI_AUDIO } = require(path.join(PUB, "lessons.js"));
const sw = fs.readFileSync(path.join(PUB, "sw.js"), "utf8");
const ids = new Set();
for (const l of LESSONS) {
  const w = l.id || "(no id)";
  if (ids.has(l.id)) bad(w, "duplicate id"); ids.add(l.id);
  checkLessonContent(l);
  for (let n = 0; n <= (l.steps || []).length; n++) {
    const clip = `audio/${l.id}-${n}.mp3`;
    if (!fs.existsSync(path.join(PUB, clip))) bad(w, `missing voice clip ${clip}`);
    else if (!sw.includes(`"${clip}"`)) bad(w, `${clip} not in sw.js (run node scripts/update-sw.js)`);
  }
  if (!fs.existsSync(path.join(PUB, "zografies", l.id, "index.html"))) bad(w, "lesson page not built (run node scripts/build-site.js)");
  if (!fs.existsSync(path.join(PUB, "og", l.id + ".png"))) bad(w, "preview image missing (run node scripts/build-site.js --og)");
}
for (const k of Object.keys(UI_AUDIO)) if (!fs.existsSync(path.join(PUB, `audio/ui-${k}.mp3`))) bad("ui", `missing voice clip audio/ui-${k}.mp3`);
if (problems.length) { console.error(problems.join("\n")); console.error(`\n${problems.length} problem(s)`); process.exit(1); }
console.log(`ok: ${LESSONS.length} lessons, ${LESSONS.reduce((a, l) => a + l.steps.length, 0)} steps, all clips, pages and images present`);
}
