/**
 * School NoteBook — Service Worker
 * Hỗ trợ offline đầy đủ cho cả Sổ tay chính và Mini Note.
 */

const CACHE_NAME = 'schooldb-v3.9';

const PRECACHE_URLS = [
    './',
    './index.html',
    './mini.html',
    './styles.css?v=3.9',
    './app.js?v=3.9',
    './shared/note-schema.js?v=3.9',
    './firebase-config.js',
    './manifest.json',
    './manifest-mini.json',
    './icons/icon-192.png',
    './icons/icon-512.png',
    'https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css',
    'https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.js',
    'https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/contrib/auto-render.min.js'
];

// Install: Cache các file tĩnh cốt lõi
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(PRECACHE_URLS).catch((err) => {
                console.warn('Precache partial fail:', err);
            });
        }).then(() => self.skipWaiting())
    );
});

// Activate: Xóa các cache cũ
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
            );
        }).then(() => self.clients.claim())
    );
});

// Fetch: Chiến lược Stale-While-Revalidate hoặc Cache-First cho CDN
self.addEventListener('fetch', (event) => {
    const request = event.request;
    if (request.method !== 'GET') return;

    const url = new URL(request.url);

    // Không can thiệp vào Firestore API (Firestore SDK tự quản lý IndexedDB offline)
    if (url.hostname.includes('firestore.googleapis.com') || url.hostname.includes('firebaseio.com')) {
        return;
    }

    // Trên localhost / 127.0.0.1: Luôn lấy trực tiếp từ network để đảm bảo code mới nhất có hiệu lực ngay
    if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') {
        event.respondWith(fetch(request).catch(() => caches.match(request)));
        return;
    }

    // 1. Cho các tài nguyên CDN (Fonts, RemixIcon, SortableJS, Firebase SDK): Cache-First
    if (url.hostname.includes('cdn.jsdelivr.net') ||
        url.hostname.includes('fonts.googleapis.com') ||
        url.hostname.includes('fonts.gstatic.com') ||
        url.hostname.includes('gstatic.com')) {
        event.respondWith(
            caches.match(request).then((cached) => {
                if (cached) return cached;
                return fetch(request).then((networkRes) => {
                    if (networkRes && networkRes.status === 200) {
                        const copy = networkRes.clone();
                        caches.open(CACHE_NAME).then((c) => c.put(request, copy));
                    }
                    return networkRes;
                }).catch(() => cached);
            })
        );
        return;
    }

    // 2. Cho các file trong app (HTML, CSS, JS): Network-first có fallback về cache
    event.respondWith(
        fetch(request).then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
                const responseToCache = networkResponse.clone();
                caches.open(CACHE_NAME).then((cache) => {
                    cache.put(request, responseToCache);
                });
            }
            return networkResponse;
        }).catch(() => {
            return caches.match(request).then((cachedResponse) => {
                if (cachedResponse) return cachedResponse;
                // Nếu người dùng đang điều hướng tới trang web và mất mạng
                if (request.mode === 'navigate') {
                    return caches.match('./index.html');
                }
            });
        })
    );
});
