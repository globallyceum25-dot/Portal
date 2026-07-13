/* ============================================================
   LYCEUM CONNECT — service worker (Phase 7, PWA)
   - Precaches the app shell so the portal opens offline.
   - Navigations: network-first → cached page → offline.html.
   - Same-origin static: stale-while-revalidate.
   - Cross-origin CDN: cache-first (opportunistic).
   - NEVER caches Supabase / API / auth traffic — live data and
     login always go to the network and are never served stale.
   ============================================================ */
'use strict';

var VERSION = 'lc-pwa-v1';
var SHELL = VERSION + '-shell';
var RUNTIME = VERSION + '-runtime';

// Core app shell — precached on install so first offline load works.
var PRECACHE = [
  '/index.html', '/login.html', '/offline.html',
  '/css/styles.css',
  '/js/auth.js', '/js/api.js', '/js/main.js', '/js/data.js',
  '/assets/logo.png', '/assets/icon-192.png', '/assets/icon-512.png',
  '/manifest.webmanifest'
];

// Hosts whose responses must always hit the network (dynamic / auth / private).
function isDynamic(url) {
  return url.hostname.indexOf('supabase.co') > -1 ||
         url.hostname === 'localhost' && url.port === '8090' ||
         url.pathname.indexOf('/api/') === 0;
}
function sameOrigin(url) { return url.origin === self.location.origin; }
function isStaticAsset(url) { return /\.(css|js|png|jpg|jpeg|webp|svg|gif|ico|woff2?|ttf)$/i.test(url.pathname); }

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(SHELL).then(function (c) {
      // addAll fails the whole install if any URL 404s — add individually + tolerate misses.
      return Promise.all(PRECACHE.map(function (u) { return c.add(u).catch(function () {}); }));
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k.indexOf(VERSION) !== 0; })
        .map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;                 // never touch writes
  var url = new URL(req.url);
  if (isDynamic(url)) return;                        // Supabase / API / auth → straight to network

  // Navigations: network-first, fall back to cached page, then offline.html.
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req).then(function (res) {
        var copy = res.clone(); caches.open(RUNTIME).then(function (c) { c.put(req, copy); });
        return res;
      }).catch(function () {
        return caches.match(req).then(function (hit) { return hit || caches.match('/offline.html'); });
      })
    );
    return;
  }

  // Same-origin static assets: stale-while-revalidate.
  if (sameOrigin(url) && isStaticAsset(url)) {
    e.respondWith(
      caches.match(req).then(function (hit) {
        var net = fetch(req).then(function (res) {
          if (res && res.status === 200) { var copy = res.clone(); caches.open(RUNTIME).then(function (c) { c.put(req, copy); }); }
          return res;
        }).catch(function () { return hit; });
        return hit || net;
      })
    );
    return;
  }

  // Cross-origin CDN (fonts / libs): cache-first, opportunistic.
  if (!sameOrigin(url)) {
    e.respondWith(
      caches.match(req).then(function (hit) {
        return hit || fetch(req).then(function (res) {
          try { var copy = res.clone(); caches.open(RUNTIME).then(function (c) { c.put(req, copy); }); } catch (x) {}
          return res;
        }).catch(function () { return hit; });
      })
    );
  }
});

// Let the page trigger an immediate update.
self.addEventListener('message', function (e) { if (e.data === 'skipWaiting') self.skipWaiting(); });
