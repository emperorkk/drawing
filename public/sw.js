// Offline cache: the whole app (pages, lessons, voice clips) works without internet after the first visit.
// Bump VERSION whenever any file changes so phones pick up the new version.
const VERSION = 'zografizo-v5';
const FILES = ["./", "index.html", "lessons.js", "manifest.webmanifest", "icons/icon-192.png", "icons/icon-512.png", "audio/anemomylos-0.mp3", "audio/anemomylos-1.mp3", "audio/anemomylos-2.mp3", "audio/anemomylos-3.mp3", "audio/anemomylos-4.mp3", "audio/anemomylos-5.mp3", "audio/anemomylos-6.mp3", "audio/delfini-0.mp3", "audio/delfini-1.mp3", "audio/delfini-2.mp3", "audio/delfini-3.mp3", "audio/delfini-4.mp3", "audio/delfini-5.mp3", "audio/delfini-6.mp3", "audio/delfini-7.mp3", "audio/delfini-8.mp3", "audio/dourios-ippos-0.mp3", "audio/dourios-ippos-1.mp3", "audio/dourios-ippos-2.mp3", "audio/dourios-ippos-3.mp3", "audio/dourios-ippos-4.mp3", "audio/dourios-ippos-5.mp3", "audio/dourios-ippos-6.mp3", "audio/dourios-ippos-7.mp3", "audio/dourios-ippos-8.mp3", "audio/dourios-ippos-9.mp3", "audio/faros-0.mp3", "audio/faros-1.mp3", "audio/faros-2.mp3", "audio/faros-3.mp3", "audio/faros-4.mp3", "audio/faros-5.mp3", "audio/faros-6.mp3", "audio/faros-7.mp3", "audio/faros-8.mp3", "audio/kaiki-0.mp3", "audio/kaiki-1.mp3", "audio/kaiki-2.mp3", "audio/kaiki-3.mp3", "audio/kaiki-4.mp3", "audio/kaiki-5.mp3", "audio/kaiki-6.mp3", "audio/kolokytha-0.mp3", "audio/kolokytha-1.mp3", "audio/kolokytha-2.mp3", "audio/kolokytha-3.mp3", "audio/kolokytha-4.mp3", "audio/kolokytha-5.mp3", "audio/kolokytha-6.mp3", "audio/kolokytha-7.mp3", "audio/koukouvagia-0.mp3", "audio/koukouvagia-1.mp3", "audio/koukouvagia-2.mp3", "audio/koukouvagia-3.mp3", "audio/koukouvagia-4.mp3", "audio/koukouvagia-5.mp3", "audio/koukouvagia-6.mp3", "audio/panta-0.mp3", "audio/panta-1.mp3", "audio/panta-2.mp3", "audio/panta-3.mp3", "audio/panta-4.mp3", "audio/panta-5.mp3", "audio/panta-6.mp3", "audio/panta-7.mp3", "audio/panta-8.mp3", "audio/ui-done.mp3", "audio/ui-saved.mp3", "audio/ui-welcome.mp3", "audio/xelona-0.mp3", "audio/xelona-1.mp3", "audio/xelona-2.mp3", "audio/xelona-3.mp3", "audio/xelona-4.mp3", "audio/xelona-5.mp3", "audio/xelona-6.mp3", "audio/xelona-7.mp3", "audio/xelona-8.mp3", "audio/xelona-9.mp3", "audio/xtapodi-0.mp3", "audio/xtapodi-1.mp3", "audio/xtapodi-2.mp3", "audio/xtapodi-3.mp3", "audio/xtapodi-4.mp3", "audio/xtapodi-5.mp3", "audio/xtapodi-6.mp3"];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then(hit => hit || fetch(e.request).then(res => {
      // Also keep Google Fonts for offline use.
      if (res.ok && (e.request.url.startsWith(self.location.origin) || e.request.url.includes('fonts.g'))) {
        const copy = res.clone(); caches.open(VERSION).then(c => c.put(e.request, copy));
      }
      return res;
    }).catch(() => caches.match('index.html')))
  );
});
