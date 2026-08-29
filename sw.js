/* 제주 여행 가이드 — 오프라인 지원
   앱 화면은 캐시에서 바로 꺼내 쓰고, 뒤에서 새 버전을 받아 둔다.
   지도 타일과 경로 계산은 인터넷이 필요하다 — 실패해도 앱은 열린다. */
const CACHE = 'jeju-trip-v4';
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

  /* 지도 타일·경로 서버는 캐시하지 않는다. 양이 크고 자주 바뀐다.
     OpenStreetMap 은 이용정책이 타일 저장을 금지하므로 특히 걸러야 한다.
     별칭 호스트(xdworld1/2/3)까지 잡히도록 도메인 단위로 본다. */
  if (/(^|\.)vworld\.kr$|(^|\.)openstreetmap\.org$|(^|\.)project-osrm\.org$/.test(url.hostname)) return;

  /* **살아 있는 자료를 주는 서버는 캐시하면 안 된다.**
     공유 목록(duckdns)은 늘 같은 주소 ?rev=N 으로 부르므로, 한 번 캐시에 들어가면
     그 뒤로 네트워크에 안 나가 남이 넣은 맛집이 영영 안 보인다. rev 가 안 바뀌니
     주소도 안 바뀌어 스스로 풀리지도 않는다.
     길찾기(kakaomobility)는 출발 시각에 따라 답이 달라지고, 장소 검색(dapi.kakao)은
     캐시된 옛 결과를 돌려주면 안 된다.
     Cache Storage 는 Cache-Control: no-store 를 보지 않으므로 여기서 걸러야 한다. */
  if (/(^|\.)duckdns\.org$|(^|\.)kakaomobility\.com$|(^|\.)kakao\.com$/.test(url.hostname)) return;

  const isDoc = req.mode === 'navigate' ||
    (url.origin === location.origin && (url.pathname.endsWith('/') || url.pathname.endsWith('index.html')));

  if (isDoc) {
    /* cache:'no-cache' 는 HTTP 캐시를 건너뛰되 **조건부 요청(If-None-Match)은 살린다.**
       reload 를 쓰면 내용이 하나도 안 바뀌었어도 매번 본문 전체(gzip 약 1MB)를 다시 받아,
       신호가 약한 곳에서 지도 타일과 대역폭을 다툰다. 배포처인 GitHub Pages 는 ETag 를
       주므로 안 바뀌었을 때는 304 로 끝난다.
       waitUntil 없이는 응답을 돌려준 뒤 워커가 꺼져 갱신이 취소된다. */
    const update = fetch('./index.html', { cache: 'no-cache' })
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
