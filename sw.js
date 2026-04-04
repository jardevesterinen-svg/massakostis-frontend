self.addEventListener("install", (event) => {
    self.skipWaiting();
    event.waitUntil(
        caches.open("kosteus-cache").then((cache) => {
            return cache.addAll([
                "/",
                "/index.html",
                "/app.js",
                "/db.js",
                "/styles.css",
                "/manifest.json"
            ]);
        })
    );
});

self.addEventListener("fetch", (event) => {
    event.respondWith(
        caches.match(event.request).then((res) => res || fetch(event.request))
    );
});