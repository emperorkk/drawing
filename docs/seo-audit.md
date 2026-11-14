# SEO audit: Ζωγραφίζω

Audited: 14 Nov 2026, against the version on `main` at commit `f78fb7a` (12 lessons).
Audience: Greek-speaking parents and children (about 6–10) looking for drawing lessons.

## Summary

Search engines and link previews saw an almost empty site. The app drew everything with
JavaScript into one page, so the lessons, their text and the drawings were invisible to
crawlers and to WhatsApp, Viber, Facebook and Telegram previews. There was one indexable
URL, one generic title, and no image to show when the link was shared.

| Area | Before | Severity |
|---|---|---|
| Indexable content | `<div id="app"></div>` is empty until JS runs; no text, no links | Critical |
| URLs per lesson | Lessons live at `/#xtapodi`; fragments are not separate pages for Google | Critical |
| Title | `Ζωγραφίζω` on every view, no keywords | High |
| Meta description | One generic sentence (46 characters) | High |
| Open Graph / Twitter cards | None: shared links show no image, title or description | High |
| Canonical URL | None | Medium |
| `robots.txt` / `sitemap.xml` | Missing (Cloudflare serves the app's fallback for both) | Medium |
| Structured data | None | Medium |
| Headings | `h1` appears only after JS; lesson pages have no `h1` | Medium |
| Internal links | Lessons are buttons, not links; crawlers can't follow them | Medium |
| Image alt text | Drawings are inline SVG marked `aria-hidden`; no text alternative | Low |
| Language | `lang="el"` set correctly | OK |
| Mobile | Responsive, installable, works offline | OK |
| Speed | Small page, no frameworks; Google Fonts is the only render-blocking request | OK |
| HTTPS | Cloudflare Pages | OK |

## What people search for (Greek)

Typical queries this site can answer, all served by the per-lesson pages:

- `πώς να ζωγραφίσω χταπόδι`, `πώς ζωγραφίζουμε κουκουβάγια`, `ζωγραφιά δελφίνι εύκολα`
- `ζωγραφική για παιδιά βήμα βήμα`, `εύκολες ζωγραφιές για παιδιά`, `μαθήματα ζωγραφικής για παιδιά`
- seasonal: `ζωγραφιές Νοέμβριος`, `κολοκύθα ζωγραφιά`, `λιομάζωμα ζωγραφιά για παιδιά`
- school topics: `αμφορέας ζωγραφιά`, `Δούρειος Ίππος ζωγραφιά`, `μαίανδρος σχέδιο`

The lessons' Greek themes (amphora, Trojan horse, olive harvest, Cycladic cat, caretta turtle)
are a real advantage: there is little Greek-language, step-by-step content for these.

## Fixes made

1. **A real page per lesson** at `/zografies/<id>/`, generated from `lessons.js` by
   `scripts/build-site.js`. Each has the full text of every step, the drawing at every step
   as inline SVG with a text label, an `h1` of the form «Πώς να ζωγραφίσεις …», and a
   button that opens the voiced lesson in the app.
2. **A catalogue page** `/zografies/` linking every lesson.
3. **Crawlable home page**: the home grid is now in the HTML as real links (the app
   replaces it when JS runs, so nothing changes for the child).
4. **Titles and descriptions** written for each page, within 60 / 155 characters.
5. **Open Graph and Twitter cards** on every page, with a 1200×630 preview image per lesson
   (`/og/<id>.png`) and one for the site.
6. **Canonical URLs**, `robots.txt` and `sitemap.xml`.
7. **Structured data** (JSON-LD): `WebApplication` on the home page, `HowTo` with every step
   on each lesson page, `BreadcrumbList` on lesson pages, `CollectionPage` on the catalogue.
8. **Internal links**: every lesson page links to all other lessons.
9. **Terms («ως έχει») and privacy pages**, which also help trust signals.

## Still to do (needs you)

- **Set the site's real address** in `site.config.js` and re-run the build: canonical URLs,
  the sitemap and preview images all need the absolute address.
- **Google Search Console**: add the site, submit `/sitemap.xml`, and check indexing after a
  week. Bing Webmaster Tools accepts the same sitemap.
- **A custom domain** (e.g. `zografizo.gr`) ranks and shares better than `*.pages.dev`.
- **Links from other sites**: Greek parenting blogs, school teachers' resource lists,
  Facebook groups for parents. This matters more than anything on the page itself.
- Note: Google stopped showing HowTo rich results in 2023. The HowTo markup still helps
  search engines understand the steps, but don't expect step-by-step snippets in results.

## How to check

```bash
node scripts/build-site.js --og      # regenerate pages, sitemap and preview images
```

Then, once deployed: paste a lesson URL into Telegram or WhatsApp to see the preview, and
test a lesson page in Google's Rich Results Test.
