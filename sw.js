/* 제주 여행 가이드 — 오프라인 지원
   앱 화면은 캐시에서 바로 꺼내 쓰고, 뒤에서 새 버전을 받아 둔다.
   지도 타일과 경로 계산은 인터넷이 필요하다 — 실패해도 앱은 열린다. */
const CACHE = 'jeju-trip-v2';
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

/* 새 버전을 받으면 열려 있는 화면에 알린다 */
function tellClients(msg) {
  return self.clients.matchAll({ includeUncontrolled: true }).then(cs => {
    cs.forEach(c => { try { c.postMessage(msg); } catch (e) {} });
  });
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  /* 지도 타일·경로 서버는 캐시하지 않는다. 양이 크고 자주 바뀐다. */
  if (/xdworld\.vworld\.kr|router\.project-osrm\.org/.test(url.hostname)) return;

  const isDoc = req.mode === 'navigate' ||
    (url.origin === location.origin && (url.pathname.endsWith('/') || url.pathname.endsWith('index.html')));

  if (isDoc) {
    /* cache:'reload' 로 브라우저 HTTP 캐시를 건너뛰어 진짜 최신을 받는다.
       waitUntil 없이는 응답을 돌려준 뒤 워커가 꺼져 갱신이 취소된다. */
    const update = fetch('./index.html', { cache: 'reload' })
      .then(res => {
        if (!res || !res.ok) return null;
        const copy = res.clone();
        return caches.open(CACHE).then(c =>
          c.match('./index.html')
            .then(old => (old ? old.text() : Promise.resolve('')))
            .then(oldText =>
              copy.text().then(newText => {
                if (oldText === newText) return res;
                return c.put('./index.html', new Response(newText, {
                  headers: { 'Content-Type': 'text/html; charset=utf-8' }
                })).then(() => tellClients({ type: 'updated' })).then(() => res);
              })
            )
        );
      })
      .catch(() => null);

    e.waitUntil(update);
    e.respondWith(
      caches.match('./index.html').then(hit => hit || update.then(r => r || fetch(req)))
    );
    return;
  }

  /* 글꼴 등 나머지 — 캐시에 있으면 쓰고, 없으면 받아서 넣어 둔다 */
  e.respondWith(
    caches.match(req).then(hit => hit || fetch(req).then(res => {
      if (res && res.status === 200 && (res.type === 'basic' || res.type === 'cors')) {
        const copy = res.clone();
        e.waitUntil(caches.open(CACHE).then(c => c.put(req, copy)));
      }
      return res;
    }).catch(() => hit))
  );
});
