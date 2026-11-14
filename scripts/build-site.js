// Generates the crawlable pages of the site from public/lessons.js and site.config.js:
//   /zografies/<id>/   one page per lesson (all steps as text + drawings, HowTo structured data)
//   /zografies/        catalogue
//   /oroi/  /aporrito/  /metrikes/   terms («ως έχει»), privacy, metrics
//   /sitemap.xml  /robots.txt
//   the static home grid and SEO tags inside public/index.html (between marker comments)
//   /og/<id>.png /og/default.png preview images, only with --og (needs Playwright)
//
// Usage: node scripts/build-site.js [--og]
const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, "..");
const PUB = path.join(ROOT, "public");
const site = require(path.join(ROOT, "site.config.js"));
const { LESSONS } = require(path.join(PUB, "lessons.js"));
const URL_ = site.url.replace(/\/$/, "");
// Date shown on terms/privacy and in the sitemap. Kept in site.config.js so rebuilding
// gives identical files (CI checks that the generated pages are up to date).
const today = site.updated;

const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const ld = o => `<script type="application/ld+json">${JSON.stringify(o).replace(/</g, "\\u003c")}</script>`;
const clip = (s, n) => s.length <= n ? s : s.slice(0, s.lastIndexOf(" ", n - 1)) + "…";
const write = (rel, content) => { const f = path.join(PUB, rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, content); };
const allSvg = l => l.steps.map(s => s.svg).join("");
const pic = (inner, label, cls = "") => `<svg class="pic ${cls}" viewBox="0 0 240 240" role="img" aria-label="${esc(label)}">${inner}</svg>`;
const lessonTitle = l => `Πώς να ζωγραφίσεις ${l.how}`;
const lessonDesc = l => clip(`${lessonTitle(l)}, βήμα βήμα, σε ${l.steps.length} εύκολα βήματα με φωνητικές οδηγίες στα ελληνικά. ${l.intro}`, 155);

function head({ title, desc, pathname, image, page, noindex, extra = "" }) {
  const url = URL_ + pathname;
  return `<!doctype html>
<html lang="el" data-page="${page}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
${noindex ? '<meta name="robots" content="noindex,nofollow">' : `<link rel="canonical" href="${url}">`}
<meta name="theme-color" content="#1f6fd1">
<meta property="og:type" content="website">
<meta property="og:locale" content="el_GR">
<meta property="og:site_name" content="${esc(site.name)}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${URL_}${image}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(desc)}">
<meta name="twitter:image" content="${URL_}${image}">
<link rel="icon" href="/icons/icon-192.png">
<link rel="apple-touch-icon" href="/icons/icon-192.png">
<link rel="manifest" href="/manifest.webmanifest">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Comfortaa:wght@700&family=Commissioner:wght@400;600;700&display=swap">
<link rel="stylesheet" href="/pages.css">
${extra}
<script src="/track.js" defer></script>
</head>
<body>
<main class="wrap">`;
}
const footer = `
<footer class="site">
  <a href="/">Αρχική</a>
  <a href="/zografies/">Όλες οι ζωγραφιές</a>
  <a href="/#zita">Ζήτα μια ζωγραφιά</a>
  <a href="/oroi/">Όροι χρήσης</a>
  <a href="/aporrito/">Απόρρητο</a>
</footer>
</main>
</body>
</html>
`;
const card = l => `<a class="card" href="/zografies/${l.id}/">${pic(`<g class="all">${allSvg(l)}</g>`, l.title)}<b>${esc(l.title)}</b><span>${l.steps.length} βήματα</span></a>`;

// ---------- lesson pages ----------
for (const l of LESSONS) {
  const p = `/zografies/${l.id}/`;
  const title = `${lessonTitle(l)}: ζωγραφική για παιδιά βήμα βήμα | ${site.name}`;
  const howto = {
    "@context": "https://schema.org", "@type": "HowTo",
    name: lessonTitle(l), description: l.intro, inLanguage: "el",
    image: `${URL_}/og/${l.id}.png`, url: URL_ + p,
    tool: [{ "@type": "HowToTool", name: "χαρτί" }, { "@type": "HowToTool", name: "μολύβι" }, { "@type": "HowToTool", name: "ξυλομπογιές" }],
    step: l.steps.map((s, i) => ({ "@type": "HowToStep", position: i + 1, name: `Βήμα ${i + 1}`, text: s.say, url: `${URL_}${p}#vima-${i + 1}` }))
  };
  const crumbs = {
    "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [
      { "@type": "ListItem", position: 1, name: site.name, item: URL_ + "/" },
      { "@type": "ListItem", position: 2, name: "Ζωγραφιές", item: URL_ + "/zografies/" },
      { "@type": "ListItem", position: 3, name: l.title, item: URL_ + p }]
  };
  const steps = l.steps.map((s, i) => {
    const old = l.steps.slice(0, i).map(x => x.svg).join("");
    return `<li id="vima-${i + 1}">${pic(`<g class="old">${old}</g><g class="cur">${s.svg}</g>`, `${l.title}, βήμα ${i + 1}`)}<span class="n">Βήμα ${i + 1}</span><p>${esc(s.say)}</p></li>`;
  }).join("\n");
  write(`zografies/${l.id}/index.html`, head({ title, desc: lessonDesc(l), pathname: p, image: `/og/${l.id}.png`, page: "lesson", extra: ld(howto) + "\n" + ld(crumbs) }) + `
<nav class="crumbs" aria-label="Πλοήγηση"><a href="/">${esc(site.name)}</a> › <a href="/zografies/">Ζωγραφιές</a> › <span>${esc(l.title)}</span></nav>
<section class="hero">
  <h1>${esc(lessonTitle(l).replace(/^./, c => c.toUpperCase()))}</h1>
  <p class="lead">${esc(l.intro)}</p>
  <p class="meta">${l.steps.length} βήματα · για παιδιά ${site.ages} ετών · με φωνητικές οδηγίες στα ελληνικά · δωρεάν</p>
  <a class="btn" href="/#${l.id}">Ξεκίνα το μάθημα με φωνή</a>
  <div class="board">${pic(`<g class="all">${allSvg(l)}</g>`, `${l.title}: η τελική ζωγραφιά`)}</div>
</section>
<section>
  <h2>Τα βήματα</h2>
  <p class="meta">Θα χρειαστείς χαρτί, μολύβι και ξυλομπογιές. Σε κάθε βήμα, η καινούργια γραμμή είναι μπλε.</p>
</section>
<ol class="steps">
${steps}
</ol>
<a class="btn" href="/#${l.id}">Ξεκίνα το μάθημα με φωνή</a>
<section><h2>Κι άλλες ζωγραφιές</h2></section>
<div class="cards">${LESSONS.filter(x => x !== l).map(card).join("")}</div>
` + footer);
}

// ---------- catalogue ----------
write("zografies/index.html", head({
  title: `Ζωγραφιές για παιδιά βήμα βήμα: ${LESSONS.length} δωρεάν μαθήματα | ${site.name}`,
  desc: clip(`${LESSONS.length} δωρεάν μαθήματα ζωγραφικής για παιδιά, βήμα βήμα στα ελληνικά: ${LESSONS.map(l => l.title.toLowerCase()).join(", ")}.`, 155),
  pathname: "/zografies/", image: "/og/default.png", page: "catalog",
  extra: ld({ "@context": "https://schema.org", "@type": "CollectionPage", name: "Ζωγραφιές για παιδιά", inLanguage: "el", url: URL_ + "/zografies/",
    hasPart: LESSONS.map(l => ({ "@type": "HowTo", name: lessonTitle(l), url: `${URL_}/zografies/${l.id}/` })) })
}) + `
<nav class="crumbs" aria-label="Πλοήγηση"><a href="/">${esc(site.name)}</a> › <span>Ζωγραφιές</span></nav>
<h1>Ζωγραφιές για παιδιά, βήμα βήμα</h1>
<p class="lead">${LESSONS.length} δωρεάν μαθήματα ζωγραφικής στα ελληνικά. Κάθε μάθημα δείχνει μία γραμμή τη φορά και τη διαβάζει δυνατά, για να ζωγραφίζει το παιδί στο χαρτί του.</p>
<div class="cards">${LESSONS.map(card).join("")}</div>
` + footer);

// ---------- terms («ως έχει») ----------
write("oroi/index.html", head({ title: `Όροι χρήσης | ${site.name}`, desc: "Πώς μπορείς να χρησιμοποιείς το Ζωγραφίζω: δωρεάν, για προσωπική χρήση, όπως ακριβώς είναι («ως έχει»).", pathname: "/oroi/", image: "/og/default.png", page: "terms" }) + `
<nav class="crumbs" aria-label="Πλοήγηση"><a href="/">${esc(site.name)}</a> › <span>Όροι χρήσης</span></nav>
<article class="prose">
<h1>Όροι χρήσης</h1>
<p class="meta">Τελευταία ενημέρωση: ${today}</p>
<h2>Η εφαρμογή παρέχεται «ως έχει»</h2>
<p>Το Ζωγραφίζω είναι μια δωρεάν εφαρμογή που φτιάχτηκε για ένα παιδί και τη μοιραζόμαστε με όποιον τη βρει χρήσιμη. Τη δίνουμε όπως ακριβώς είναι, χωρίς καμία εγγύηση: ούτε ότι θα λειτουργεί πάντα, ούτε ότι θα λειτουργεί σε κάθε συσκευή, ούτε ότι δεν έχει λάθη.</p>
<ul>
  <li><strong>Δωρεάν και για προσωπική χρήση.</strong> Μπορείς να τη χρησιμοποιείς στο σπίτι, στο σχολείο ή στο εργαστήρι, χωρίς χρέωση. Δεν επιτρέπεται να την πουλήσεις ή να την παρουσιάσεις ως δική σου.</li>
  <li><strong>Με επίβλεψη από μεγάλο.</strong> Είναι φτιαγμένη για παιδιά, αλλά ένας γονιός ή δάσκαλος πρέπει να αποφασίζει πότε και πώς τη χρησιμοποιούν.</li>
  <li><strong>Μπορεί να αλλάξει ή να σταματήσει.</strong> Τα μαθήματα, οι φωνές και οι λειτουργίες μπορεί να αλλάξουν, και η εφαρμογή μπορεί να μην είναι διαθέσιμη κάποια στιγμή, χωρίς προειδοποίηση.</li>
  <li><strong>Οι φωτογραφίες είναι δική σου ευθύνη.</strong> Οι φωτογραφίες των ζωγραφιών μένουν μόνο στη συσκευή σου. Αν σβήσεις τα δεδομένα του browser ή αλλάξεις κινητό, χάνονται, και δεν μπορούμε να τις επαναφέρουμε.</li>
  <li><strong>Φωνές και σχέδια με τεχνητή νοημοσύνη.</strong> Οι φωνητικές οδηγίες δημιουργούνται με υπηρεσίες σύνθεσης φωνής και τα σχέδια φτιάχτηκαν με τη βοήθεια τεχνητής νοημοσύνης. Μπορεί να υπάρχει κάποια λέξη που δεν ακούγεται σωστά ή κάποιο σχέδιο που δεν βγαίνει τέλειο.</li>
  <li><strong>Καμία ευθύνη για ζημιές.</strong> Στο μέτρο που το επιτρέπει ο νόμος, δεν ευθυνόμαστε για οποιαδήποτε ζημιά ή απώλεια από τη χρήση της εφαρμογής.</li>
</ul>
<h2>Αιτήματα για ζωγραφιές</h2>
<p>Όταν στέλνεις ένα αίτημα για νέα ζωγραφιά, το κείμενό σου φτάνει σε εμάς ως μήνυμα. Δεν υποσχόμαστε ότι θα φτιαχτεί κάθε ζωγραφιά που ζητιέται. Μη γράφεις προσωπικά στοιχεία, όπως διευθύνσεις ή τηλέφωνα.</p>
<p>Για το τι καταγράφουμε, δες τη σελίδα <a href="/aporrito/">Απόρρητο</a>.</p>
</article>
` + footer);

// ---------- privacy ----------
const recorded = [
  ["Επίσκεψη σελίδας", "Ποιο είδος σελίδας άνοιξε (αρχική, μάθημα, κατάλογος, όροι, απόρρητο)", "Για να ξέρουμε ποιες σελίδες χρησιμοποιούνται"],
  ["Από πού ήρθε ο επισκέπτης", "Μόνο το όνομα του ιστότοπου (π.χ. google.com), ποτέ η πλήρης διεύθυνση", "Για να δούμε αν μας βρίσκουν από αναζητήσεις"],
  ["Εγκατεστημένη εφαρμογή", "Αν η εφαρμογή ανοίχτηκε από την αρχική οθόνη του κινητού (ναι/όχι)", "Για να ξέρουμε αν αξίζει η λειτουργία χωρίς internet"],
  ["Είδος συσκευής", "Κινητό, tablet ή υπολογιστής, όπως το καταλαβαίνει ο server από τον browser", "Για να ξέρουμε σε τι οθόνες να δοκιμάζουμε"],
  ["Χώρα", "Μόνο η χώρα (π.χ. GR), όπως τη δίνει το Cloudflare", "Για να ξέρουμε αν η εφαρμογή χρησιμοποιείται εκτός Ελλάδας"],
  ["Έναρξη μαθήματος", "Ποιο μάθημα άνοιξε", "Για να ξέρουμε ποια μαθήματα αρέσουν"],
  ["Ολοκλήρωση μαθήματος", "Ποιο μάθημα έφτασε στο τελευταίο βήμα", "Για να βρίσκουμε μαθήματα που είναι πολύ δύσκολα"],
  ["Φύλαξη φωτογραφίας", "Ότι φυλάχτηκε μια φωτογραφία και σε ποιο μάθημα. Ποτέ η ίδια η φωτογραφία", "Για να ξέρουμε αν χρησιμοποιείται η λειτουργία"],
  ["Αίτημα ζωγραφιάς", "Ότι στάλθηκε ένα αίτημα (το πλήθος ανά ημέρα)", "Για να ξέρουμε πόσα αιτήματα έρχονται"]
];
write("aporrito/index.html", head({ title: `Απόρρητο: τι καταγράφουμε | ${site.name}`, desc: "Τι καταγράφει το Ζωγραφίζω: μόνο ανώνυμα συνολικά νούμερα, χωρίς cookies και χωρίς προσωπικά στοιχεία. Οι φωτογραφίες μένουν στη συσκευή σου.", pathname: "/aporrito/", image: "/og/default.png", page: "privacy" }) + `
<nav class="crumbs" aria-label="Πλοήγηση"><a href="/">${esc(site.name)}</a> › <span>Απόρρητο</span></nav>
<article class="prose">
<h1>Απόρρητο</h1>
<p class="meta">Τελευταία ενημέρωση: ${today}</p>
<p class="lead">Το Ζωγραφίζω το χρησιμοποιούν παιδιά, γι' αυτό καταγράφουμε όσο λιγότερα γίνεται: μόνο ανώνυμα συνολικά νούμερα, όπως «σήμερα άνοιξε 12 φορές το μάθημα με το χταπόδι».</p>
<h2>Τι δεν καταγράφουμε ποτέ</h2>
<ul>
  <li>Δεν χρησιμοποιούμε <strong>cookies</strong> και δεν βάζουμε κανένα αναγνωριστικό στη συσκευή σου.</li>
  <li>Δεν αποθηκεύουμε <strong>διευθύνσεις IP</strong>, ονόματα, email ή οποιοδήποτε στοιχείο που δείχνει ποιος είσαι.</li>
  <li>Οι <strong>φωτογραφίες</strong> των ζωγραφιών μένουν μόνο στη συσκευή σου και δεν ανεβαίνουν πουθενά.</li>
  <li>Δεν ακολουθούμε τι κάνει ένα συγκεκριμένο άτομο. Κάθε ενέργεια απλώς αυξάνει έναν μετρητή κατά ένα.</li>
  <li>Δεν υπάρχουν διαφημίσεις και δεν δίνουμε δεδομένα σε κανέναν.</li>
</ul>
<h2>Τι καταγράφουμε</h2>
<p>Αυτά είναι <strong>όλα</strong> όσα μετράμε. Κάθε γραμμή είναι ένας μετρητής ανά ημέρα:</p>
<div class="table-wrap"><table>
<thead><tr><th>Τι</th><th>Τι ακριβώς κρατάμε</th><th>Γιατί</th></tr></thead>
<tbody>
${recorded.map(r => `<tr><td><strong>${r[0]}</strong></td><td>${r[1]}</td><td>${r[2]}</td></tr>`).join("\n")}
</tbody></table></div>
<p>Οι μετρητές σβήνονται αυτόματα μετά από <strong>13 μήνες</strong>. Τα συνολικά νούμερα τα βλέπει μόνο ο διαχειριστής, στη σελίδα <a href="/metrikes/">Μετρήσεις</a>, που ζητάει κωδικό.</p>
<h2>Αν δεν θέλεις να μετράμε ούτε αυτά</h2>
<p>Αν ο browser σου έχει ενεργή την επιλογή <em>«Να μην παρακολουθούμαι»</em> (Do Not Track) ή <em>Global Privacy Control</em>, η εφαρμογή δεν στέλνει τίποτα απολύτως.</p>
<h2>Αιτήματα για ζωγραφιές</h2>
<p>Όταν στέλνεις αίτημα για νέα ζωγραφιά, το κείμενο που γράφεις, το όνομα (αν το συμπληρώσεις) και η χώρα στέλνονται ως μήνυμα Telegram στον διαχειριστή. Δεν τα αποθηκεύουμε κάπου αλλού. Για να μη στέλνονται άπειρα μηνύματα, κρατάμε για μία ημέρα έναν κρυπτογραφημένο (hash) μετρητή ανά σύνδεση, που δεν μπορεί να μετατραπεί πίσω σε διεύθυνση IP. Μη γράφεις προσωπικά στοιχεία στο αίτημα.</p>
<h2>Οι υπηρεσίες που χρησιμοποιούμε</h2>
<ul>
  <li><strong>Cloudflare</strong> φιλοξενεί την εφαρμογή. Όπως κάθε φιλοξενία, οι servers του επεξεργάζονται τεχνικά στοιχεία της σύνδεσης (π.χ. IP) για να σου στείλουν τη σελίδα και για προστασία από επιθέσεις.</li>
  <li><strong>Google Fonts</strong> δίνει τις γραμματοσειρές. Ο browser σου τις κατεβάζει από τους servers της Google.</li>
  <li><strong>Telegram</strong> παραδίδει τα αιτήματα για ζωγραφιές στον διαχειριστή.</li>
</ul>
<p>Για ερωτήσεις ή για να μας ζητήσεις κάτι σχετικό με τα δεδομένα, στείλε μήνυμα μέσα από τη φόρμα <a href="/#zita">«Ζήτα μια ζωγραφιά»</a>.</p>
</article>
` + footer);

// ---------- metrics (owner only; data needs the METRICS_KEY) ----------
write("metrikes/index.html", head({ title: `Μετρήσεις | ${site.name}`, desc: "Ανώνυμα συνολικά νούμερα χρήσης.", pathname: "/metrikes/", image: "/og/default.png", page: "metrics", noindex: true }) + `
<nav class="crumbs" aria-label="Πλοήγηση"><a href="/">${esc(site.name)}</a> › <span>Μετρήσεις</span></nav>
<h1>Μετρήσεις</h1>
<p>Ανώνυμα συνολικά νούμερα. Η λίστα με όλα όσα καταγράφονται είναι στη σελίδα <a href="/aporrito/">Απόρρητο</a>.</p>
<form class="box" id="login">
  <label for="key"><strong>Κωδικός μετρήσεων</strong></label>
  <input id="key" type="password" autocomplete="current-password" required style="font:inherit;padding:10px;border-radius:10px;border:2px solid var(--line);background:var(--bg);color:var(--ink)">
  <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center">
    <label for="days">Περίοδος</label>
    <select id="days" style="font:inherit;padding:8px;border-radius:10px"><option value="7">7 ημέρες</option><option value="30" selected>30 ημέρες</option><option value="90">90 ημέρες</option><option value="400">Όλα</option></select>
    <button class="btn" type="submit">Δείξε τα νούμερα</button>
  </div>
  <p class="meta" id="status"></p>
</form>
<div id="out"></div>
<script>
(function(){
  var LESSONS = ${JSON.stringify(Object.fromEntries(LESSONS.map(l => [l.id, l.title])))};
  var PAGES = {home:"Αρχική",lesson:"Σελίδα μαθήματος",catalog:"Κατάλογος",terms:"Όροι",privacy:"Απόρρητο",metrics:"Μετρήσεις",other:"Άλλη"};
  var form = document.getElementById("login"), keyEl = document.getElementById("key"), daysEl = document.getElementById("days");
  var status = document.getElementById("status"), out = document.getElementById("out");
  try { keyEl.value = sessionStorage.getItem("metricsKey") || ""; } catch(e){}
  function esc(s){ return String(s).replace(/[&<>"]/g, function(c){ return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]; }); }
  function sum(rows, k, v){ return rows.filter(function(r){ return r.k===k && (v===undefined || r.v===v); }).reduce(function(a,r){ return a+r.c; },0); }
  function group(rows, k){ var m={}; rows.forEach(function(r){ if(r.k===k) m[r.v]=(m[r.v]||0)+r.c; }); return Object.keys(m).map(function(v){ return [v,m[v]]; }).sort(function(a,b){ return b[1]-a[1]; }); }
  function table(head, rows){ return '<div class="table-wrap"><table><thead><tr>'+head.map(function(h,i){ return '<th'+(i?' class="num"':'')+'>'+h+'</th>'; }).join("")+'</tr></thead><tbody>'+(rows.length?rows.map(function(r){ return '<tr>'+r.map(function(c,i){ return '<td'+(i?' class="num"':'')+'>'+esc(c)+'</td>'; }).join("")+'</tr>'; }).join(""):'<tr><td colspan="'+head.length+'">Τίποτα ακόμα</td></tr>')+'</tbody></table></div>'; }
  function render(d){
    var r = d.rows, views = sum(r,"page_view"), starts = sum(r,"lesson_start"), done = sum(r,"lesson_complete");
    var html = '<section class="box"><h2>Σύνοψη: από '+esc(d.since)+'</h2>'+table(["Μέτρηση","Πλήθος"],[
      ["Επισκέψεις σελίδων",views],["Μαθήματα που ξεκίνησαν",starts],["Μαθήματα που ολοκληρώθηκαν",done],
      ["Ποσοστό ολοκλήρωσης",starts?Math.round(100*done/starts)+"%":"–"],["Φωτογραφίες που φυλάχτηκαν",sum(r,"photo_saved")],
      ["Αιτήματα ζωγραφιάς",sum(r,"request_sent")],["Ανοίγματα από εγκατεστημένη εφαρμογή",sum(r,"installed","1")]])+'</section>';
    var days = {}; r.forEach(function(x){ if(x.k==="page_view"){ days[x.d]=(days[x.d]||0)+x.c; } });
    html += '<section class="box"><h2>Ανά μάθημα</h2>'+table(["Μάθημα","Άνοιξαν","Τέλος","%","Φωτο"],
      Object.keys(LESSONS).map(function(id){ var s=sum(r,"lesson_start",id), c=sum(r,"lesson_complete",id); return [LESSONS[id],s,c,s?Math.round(100*c/s)+"%":"–",sum(r,"photo_saved",id)]; })
      .sort(function(a,b){ return b[1]-a[1]; }))+'</section>';
    html += '<section class="box"><h2>Επισκέψεις ανά ημέρα</h2>'+table(["Ημέρα","Επισκέψεις"],Object.keys(days).sort().reverse().map(function(k){ return [k,days[k]]; }))+'</section>';
    html += '<section class="box"><h2>Σελίδες</h2>'+table(["Σελίδα","Επισκέψεις"],group(r,"page_view").map(function(x){ return [PAGES[x[0]]||x[0],x[1]]; }))+'</section>';
    html += '<section class="box"><h2>Από πού ήρθαν</h2>'+table(["Ιστότοπος","Επισκέψεις"],group(r,"ref"))+'<p class="meta">Μόνο επισκέψεις που ήρθαν από άλλον ιστότοπο. Οι υπόλοιπες άνοιξαν απευθείας.</p></section>';
    html += '<section class="box"><h2>Συσκευές</h2>'+table(["Συσκευή","Επισκέψεις"],group(r,"device").map(function(x){ return [{mobile:"Κινητό",tablet:"Tablet",desktop:"Υπολογιστής"}[x[0]]||x[0],x[1]]; }))+'</section>';
    html += '<section class="box"><h2>Χώρες</h2>'+table(["Χώρα","Επισκέψεις"],group(r,"country"))+'</section>';
    out.innerHTML = html;
  }
  form.addEventListener("submit", function(ev){
    ev.preventDefault(); status.textContent = "Φορτώνει…";
    fetch("/api/stats?days="+daysEl.value, {headers:{Authorization:"Bearer "+keyEl.value}}).then(function(res){
      if (res.status===401) throw new Error("Λάθος κωδικός.");
      if (res.status===503) throw new Error("Οι μετρήσεις δεν έχουν ρυθμιστεί ακόμα στο Cloudflare (λείπει το METRICS ή το METRICS_KEY).");
      if (!res.ok) throw new Error("Κάτι πήγε στραβά ("+res.status+"). Δοκίμασε ξανά.");
      return res.json();
    }).then(function(d){ try{ sessionStorage.setItem("metricsKey", keyEl.value); }catch(e){} status.textContent = ""; render(d); })
      .catch(function(e){ status.textContent = e.message; });
  });
})();
</script>
` + footer);

// ---------- sitemap + robots ----------
const urls = ["/", "/zografies/", ...LESSONS.map(l => `/zografies/${l.id}/`), "/oroi/", "/aporrito/"];
write("sitemap.xml", `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(u => `  <url><loc>${URL_}${u}</loc><lastmod>${today}</lastmod></url>`).join("\n")}
</urlset>
`);
write("robots.txt", `User-agent: *
Allow: /
Disallow: /metrikes/
Disallow: /api/

Sitemap: ${URL_}/sitemap.xml
`);

// ---------- home page: SEO tags + static grid (replaced by the app when JS runs) ----------
const idxFile = path.join(PUB, "index.html");
let idx = fs.readFileSync(idxFile, "utf8");
const homeTitle = `${site.name}: ${site.tagline}`;
const seo = `<!-- seo:start (generated by scripts/build-site.js) -->
<title>${esc(homeTitle)}</title>
<meta name="description" content="${esc(site.description)}">
<link rel="canonical" href="${URL_}/">
<meta property="og:type" content="website">
<meta property="og:locale" content="el_GR">
<meta property="og:site_name" content="${esc(site.name)}">
<meta property="og:title" content="${esc(homeTitle)}">
<meta property="og:description" content="${esc(site.description)}">
<meta property="og:url" content="${URL_}/">
<meta property="og:image" content="${URL_}/og/default.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(homeTitle)}">
<meta name="twitter:description" content="${esc(site.description)}">
<meta name="twitter:image" content="${URL_}/og/default.png">
${ld({ "@context": "https://schema.org", "@type": "WebApplication", name: site.name, url: URL_ + "/", description: site.description, inLanguage: "el",
  applicationCategory: "EducationalApplication", operatingSystem: "Any", isAccessibleForFree: true,
  offers: { "@type": "Offer", price: "0", priceCurrency: "EUR" }, audience: { "@type": "EducationalAudience", educationalRole: "student", suggestedMinAge: 6, suggestedMaxAge: 10 } })}
<!-- seo:end -->`;
const staticGrid = `<!-- static:start (generated by scripts/build-site.js; the app replaces this when JavaScript runs) -->
<div class="hello"><h1>${esc(site.name)}</h1><p>${esc(site.tagline)}. Διάλεξε μια ζωγραφιά: θα σου δείχνω βήμα βήμα τι να κάνεις στο χαρτί σου.</p></div>
<div class="grid">${LESSONS.map(l => `<a class="card" href="/zografies/${l.id}/"><svg class="pic" viewBox="0 0 240 240" role="img" aria-label="${esc(l.title)}">${allSvg(l)}</svg><span class="name">${esc(l.title)}</span><span class="meta">${l.steps.length} βήματα</span></a>`).join("")}</div>
<!-- static:end -->`;
const swap = (s, a, b, val) => { const i = s.indexOf(a), j = s.indexOf(b); if (i < 0 || j < 0) throw new Error("marker missing in index.html: " + a); return s.slice(0, i) + val + s.slice(j + b.length); };
idx = swap(idx, "<!-- seo:start", "<!-- seo:end -->", seo);
idx = swap(idx, "<!-- static:start", "<!-- static:end -->", staticGrid);
fs.writeFileSync(idxFile, idx);

console.log(`built ${LESSONS.length} lesson pages, catalogue, terms, privacy, metrics, sitemap (${urls.length} urls) for ${URL_}`);
if (URL_.includes("REPLACE-WITH")) console.warn("WARNING: set url in site.config.js to the real address, then build again.");

// ---------- Open Graph images ----------
if (process.argv.includes("--og")) (async () => {
  const { chromium } = require("playwright");
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
  fs.mkdirSync(path.join(PUB, "og"), { recursive: true });
  const shell = (left, title, sub) => `<html><head><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Comfortaa:wght@700&family=Commissioner:wght@600&display=swap"><style>
    body{margin:0;width:1200px;height:630px;background:#f3f7fb;display:flex;align-items:center;gap:56px;padding:0 70px;box-sizing:border-box;font-family:Commissioner,sans-serif;color:#123a63}
    .l{flex:none;width:470px;height:470px;background:#fff;border:4px solid #c9d8ea;border-radius:40px;display:flex;align-items:center;justify-content:center}
    .l svg{width:420px;height:420px} path,circle{fill:none;stroke:#123a63;stroke-width:3.5;stroke-linecap:round;stroke-linejoin:round} .fill,text{fill:#123a63;stroke:none}
    .r{display:flex;flex-direction:column;gap:22px} .s{font-family:Comfortaa;font-size:30px;color:#1f6fd1} h1{font-family:Comfortaa;font-size:58px;line-height:1.15;margin:0}
    .t{font-size:28px;color:#5b7390} .m{height:12px;width:260px;background:repeating-linear-gradient(90deg,#1f6fd1 0 4px,transparent 4px 16px);opacity:.6;border-top:3px solid #1f6fd1;border-bottom:3px solid #1f6fd1}
    .grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;width:420px;height:420px}.grid svg{width:205px;height:205px;background:#dbe8f8;border-radius:20px}
  </style></head><body><div class="l">${left}</div><div class="r"><div class="s">${esc(site.name)}</div><h1>${esc(title)}</h1><div class="m"></div><div class="t">${esc(sub)}</div></div></body></html>`;
  const shot = async (html, file) => { await page.setContent(html, { waitUntil: "networkidle" }).catch(() => {}); await page.evaluate(() => document.fonts.ready); await page.screenshot({ path: path.join(PUB, "og", file) }); };
  for (const l of LESSONS)
    await shot(shell(`<svg viewBox="0 0 240 240">${allSvg(l)}</svg>`, lessonTitle(l).replace(/^./, c => c.toUpperCase()), `${l.steps.length} βήματα · με φωνή στα ελληνικά`), `${l.id}.png`);
  const four = ["xtapodi", "koukouvagia", "amforeas", "delfini"].map(id => LESSONS.find(l => l.id === id)).filter(Boolean);
  await shot(shell(`<div class="grid">${four.map(l => `<svg viewBox="0 0 240 240">${allSvg(l)}</svg>`).join("")}</div>`, "Ζωγραφική για παιδιά, βήμα βήμα", `${LESSONS.length} δωρεάν μαθήματα στα ελληνικά`), "default.png");
  await browser.close();
  console.log(`og images: ${LESSONS.length + 1}`);
})();
