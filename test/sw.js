/* ==========================================================================
   Service worker для экранов меню.

   Задача одна: после первой успешной загрузки экран должен показывать меню
   всегда — даже когда интернета нет совсем. Стратегия «отдаём из кэша сразу,
   а свежую версию подтягиваем фоном»: меню появляется мгновенно, а правки
   цен доезжают к следующей перезагрузке.
   ========================================================================== */

var CACHE = 'menu-v12';

/* Критичное — то, без чего экран не покажет меню. ~100 КБ. */
var CORE = [
  '1.html',
  '2.html',
  'style.css',
  'app.js',
  'fonts/unbounded-cyrillic-600-normal.woff2',
  'fonts/unbounded-latin-600-normal.woff2',
  'fonts/unbounded-cyrillic-700-normal.woff2',
  'fonts/unbounded-latin-700-normal.woff2',
  'fonts/golos-text-cyrillic-400-normal.woff2',
  'fonts/golos-text-latin-400-normal.woff2',
  'fonts/golos-text-cyrillic-500-normal.woff2',
  'fonts/golos-text-latin-500-normal.woff2',
  'fonts/golos-text-cyrillic-600-normal.woff2',
  'fonts/golos-text-latin-600-normal.woff2',
  'fonts/ibm-plex-mono-cyrillic-400-normal.woff2',
  'fonts/ibm-plex-mono-latin-400-normal.woff2',
  'fonts/ibm-plex-mono-cyrillic-500-normal.woff2',
  'fonts/ibm-plex-mono-latin-500-normal.woff2',
  'fonts/ibm-plex-mono-cyrillic-600-normal.woff2',
  'fonts/ibm-plex-mono-latin-600-normal.woff2',
  'media/logo.png',
  'media/hot-poster.jpg',
  'media/cold-poster.jpg'
];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE)
      .then(function (c) {
        // addAll падает целиком, если хоть один файл не ответил,
        // поэтому кладём по одному и не роняем установку из-за мелочи
        return Promise.all(CORE.map(function (url) {
          return c.add(url).catch(function () { return null; });
        }));
      })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys()
      .then(function (names) {
        return Promise.all(names.map(function (n) {
          return n === CACHE ? null : caches.delete(n);
        }));
      })
      .then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  var req = e.request;

  if (req.method !== 'GET') { return; }

  var url = new URL(req.url);
  if (url.origin !== location.origin) { return; }

  // Проверка обновлений из app.js должна ходить мимо кэша
  if (url.searchParams.has('t')) { return; }

  // Видео мимо кэша — принципиально.
  // Браузер тянет его кусками (заголовок Range), сервер отвечает кодом 206,
  // а не 200. Положить такой ответ в кэш нельзя, зато cache.match при чтении
  // заголовок Range игнорирует и отдаёт целиком ту версию, что легла первой.
  // Ролик из-за этого застревает навсегда и не обновляется при замене файла.
  // Без сети видео просто не загрузится и останется постер — он в CORE.
  if (req.destination === 'video' || /\.(mp4|webm|m4v)$/i.test(url.pathname)) {
    return;
  }

  e.respondWith(
    caches.open(CACHE).then(function (cache) {
      return cache.match(req).then(function (cached) {

        var network = fetch(req).then(function (res) {
          if (res && res.status === 200 && res.type === 'basic') {
            cache.put(req, res.clone());
          }
          return res;
        }).catch(function () {
          return cached || Response.error();
        });

        // Есть копия — отдаём мгновенно, сеть догоняет фоном
        return cached || network;
      });
    })
  );
});
