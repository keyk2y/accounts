/* 매출 기록장 서비스 워커
   새 버전을 올릴 때 아래 VERSION 숫자가 바뀌면(index.html의 VERSION과 같이),
   열어 둔 앱에 "새로운 패치 있습니다" 팝업이 떠요. */
var VERSION = '1.1.0';
var CACHE = 'mg-' + VERSION;
var FILES = ['./', './index.html', './manifest.json', './pwa.js',
  './icon-192.png', './icon-512.png', './icon-maskable-512.png', './apple-touch-icon.png'];

self.addEventListener('install', function (e) {
  /* 대기 상태로 두고, 사용자가 '지금 업데이트'를 눌렀을 때만 넘어가요 */
  e.waitUntil(caches.open(CACHE).then(function (c) {
    return c.addAll(FILES.map(function (f) { return new Request(f, { cache: 'reload' }); }));
  }));
});

self.addEventListener('message', function (e) {
  if (e.data === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k.indexOf('mg-') === 0 && k !== CACHE; })
        .map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  if (url.origin !== location.origin) return;           /* 글꼴 등 바깥 주소는 그대로 */
  if (req.mode === 'navigate') {                         /* 화면은 인터넷이 되면 최신, 안 되면 저장본 */
    e.respondWith(
      fetch(req).then(function (r) {
        var copy = r.clone();
        caches.open(CACHE).then(function (c) { c.put('./index.html', copy); });
        return r;
      }).catch(function () { return caches.match('./index.html'); })
    );
    return;
  }
  e.respondWith(caches.match(req).then(function (hit) { return hit || fetch(req); }));
});
