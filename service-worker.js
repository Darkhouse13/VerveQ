const CACHE_NAME = 'footquizz-cache-v3';
const API_CACHE_NAME = 'footquizz-api-cache-v2';
const urlsToCache = [
    '/',
    '/index.html',
    '/enhanced_quiz.html',
    '/survival.html',
    '/leaderboard.html',
    '/static/enhanced_styles.css',
    '/static/accessibility.js',
    '/offline.html'
    // It's better to cache fonts and other third-party assets dynamically
];

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('Opened cache');
                return cache.addAll(urlsToCache);
            })
    );
});

self.addEventListener('fetch', event => {
    const apiUrlPattern = new URL(self.location).origin + '/api/';
    const survivalUrlPattern = new URL(self.location).origin + '/survival/';

    // Strategy for API calls: Network first, then cache
    if (event.request.url.startsWith(apiUrlPattern) || event.request.url.startsWith(survivalUrlPattern)) {
        event.respondWith(
            caches.open(API_CACHE_NAME).then(cache => {
                return fetch(event.request)
                    .then(response => {
                        // If the request is successful, cache it
                        if (response.status === 200) {
                            cache.put(event.request, response.clone());
                        }
                        return response;
                    })
                    .catch(() => {
                        // If the network fails, try to get it from the cache
                        return cache.match(event.request);
                    });
            })
        );
        return;
    }

    // Strategy for all other requests: Cache first, then network, with offline fallback
    event.respondWith(
        caches.match(event.request)
            .then(response => {
                // Cache hit - return response
                if (response) {
                    return response;
                }

                // Clone the request to use it in the cache and for the browser
                const fetchRequest = event.request.clone();

                return fetch(fetchRequest).then(
                    response => {
                        // Check if we received a valid response
                        if (!response || response.status !== 200 || response.type !== 'basic') {
                            return response;
                        }

                        // Clone the response to use it in the cache and for the browser
                        const responseToCache = response.clone();

                        caches.open(CACHE_NAME)
                            .then(cache => {
                                cache.put(event.request, responseToCache);
                            });

                        return response;
                    }
                ).catch(() => {
                    // If both network and cache fail, show the offline page
                    // This is especially useful for navigating to new pages offline
                    if (event.request.mode === 'navigate') {
                        return caches.match('/offline.html');
                    }
                });
            })
    );
});

self.addEventListener('activate', event => {
    const cacheWhitelist = [CACHE_NAME, API_CACHE_NAME];
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheWhitelist.indexOf(cacheName) === -1) {
                        console.log('Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
});
