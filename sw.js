// App shell and data are cached; everything is fetched fresh when online and
// falls back to the last copy when offline.
const CACHE = "psp-v4";
const SHELL = ["./", "index.html", "styles.css?v=4", "app.js?v=4", "manifest.webmanifest", "brand/logo-mark.svg", "icons/ps-icon-192.png", "icons/ps-icon-512.png", "fonts/manrope-latin-500-normal.woff2", "fonts/manrope-latin-600-normal.woff2", "fonts/manrope-latin-700-normal.woff2", "fonts/manrope-latin-800-normal.woff2", "fonts/playfair-display-latin-600-normal.woff2", "fonts/playfair-display-latin-700-normal.woff2", "fonts/playfair-display-latin-800-normal.woff2", "fonts/cinzel-latin-600-normal.woff2", "fonts/cinzel-latin-700-normal.woff2", "data/curriculum.json", "data/episodes/index.json", "data/episodes/ep01.json"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return;
  e.respondWith(
    fetch(e.request, { cache: "no-cache" })
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy));
        return res;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: true }))
  );
});
