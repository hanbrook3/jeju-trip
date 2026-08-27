/* 제주 여행 가이드 — 오프라인 지원
   앱 껍데기(index.html)는 캐시에서 먼저 꺼내 쓰고, 뒤에서 조용히 갱신한다.
   지도 타일과 경로 계산은 네트워크가 필요하다 — 실패해도 앱은 열린다. */
const CACHE = 'jeju-trip-v1';
const SHELL = ['./', './index.html'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  /* 지도 타일·경로 서버는 캐시하지 않는다. 양이 크고 자주 바뀐다. */
  if (/xdworld\.vworld\.kr|router\.project-osrm\.org/.test(url.hostname)) return;

  /* 문서(앱 화면) — 캐시 먼저, 네트워크로 뒤에서 갱신 */
  if (req.mode === 'navigate' || url.pathname.endsWith('/') || url.pathname.endsWith('index.html')) {
    e.respondWith(
      caches.match('./index.html').then(hit => {
        const net = fetch(req)
          .then(res => { caches.open(CACHE).then(c => c.put('./index.html', res.clone())); return res; })
          .catch(() => hit);
        return hit || net;
      })
    );
    return;
  }

  /* 글꼴 등 나머지 — 캐시에 있으면 쓰고, 없으면 받아서 넣어 둔다 */
  e.respondWith(
    caches.match(req).then(hit => hit || fetch(req).then(res => {
      if (res && res.status === 200 && (res.type === 'basic' || res.type === 'cors')) {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(req, copy));
      }
      return res;
    }).catch(() => hit))
  );
});
