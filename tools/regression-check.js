/* 회귀 점검 — 손댈 때마다 이걸 돌린다.
   브라우저 콘솔(또는 Claude 의 javascript_tool)에 통째로 붙여 넣으면
   한 덩어리 JSON 이 나온다. 아래 "기대값" 과 다르면 뭔가 깨진 것이다.

   먼저 로컬 서버를 띄우고 375x667 로 맞춰 둘 것:
     node tools/serve.js          →  http://127.0.0.1:8765

   기대값 (2026-08-28 기준)
     배지불일치 0        지도 핀 번호와 일정 카드 번호가 어긋나면 0 이 아니다
     핀합계 31           5일치 정차지 합계 — 4일차에 숙소 도착이 들어가 30 → 31
     핀색 = 목록배지색    핀은 그곳에 닿는 구간의 색이다. 첫 정차지만 갈래 색으로 남는다
     지적경계 10 / 경로 5   제주현대미술관이 두 필지(잘못된 것)에서 한 필지로 줄었다
     핀클릭.간격 8       핀을 누르면 카드 상단이 지도 바로 아래 8px 에 온다
     배율 {미술관 14, 일출봉 13, 숲길 12, 맛집 14, 일정_일출봉 13}
                         장소 크기에 맞춘 배율. 넷이 다 같아지면 통일로 되돌아간 것이고,
                         일정_일출봉 이 일출봉과 다르면 탭 사이가 어긋난 것이다.
                         성산일출봉은 3일차(D[2])다 — 2·3일차를 맞바꾼 뒤 옮겨졌다
     탭통일 {패널 true, 안움직임 true, 선택표시 1}  여행지·맛집 카드도 일정 탭처럼 반응하는가
     점클릭 {일치 true, 간격 8}   지도 점을 누르면 그 카드가 열리고 지도 바로 아래로 온다
     지도통합 {거친탭 "trip,spot,food", 한곳수정이_세탭에 true}
     핀참조 {일정 5, 여행지 0}     탭을 바꾸면 번호 핀 참조가 비워져야 한다
     점갈래_일정   {여행지 49, 명소 35, 맛집 51, 범례 4항목}
     점갈래_여행지 {여행지 49, 명소 35, 맛집 0,  범례 2항목}
     점갈래_맛집   {여행지 0,  명소 0,  맛집 51, 범례 2항목}
     길찾기 0            카카오맵 길찾기 버튼은 없앴다 — 다시 생기면 0 이 아니다
     섬전체 {줌 9, 다보임 true}   1일차 기준이다. 3일차는 동부만 도는 날이라
                         줌 10 · 다보임 false 가 정상이다
     전체보기 667 / 닫기 213±1
     범례 {높이 71±2, 한줄 false}  지도 조작 단추를 44px(터치 권장 크기)로 키워
                         범례와 한 줄에 안 들어간다. 29 로 돌아가면 단추가 다시 작아진 것이다
     개략도 {path 58(z9) / 77(z12), 오류 0}
     오류 []

   주의: 탭을 바꾼 직후 곧바로 카드를 누르면 탭 전환의 fitMap 이 나중에 실행돼
   배율이 9 로 보인다. 아래처럼 1.4초 이상 기다려야 진짜 값이 나온다.

   주의: 대기시간 합이 26초쯤이라 javascript_tool 의 30초 제한에 걸린다.
   섹션 단위로 서너 번에 나눠 붙이고, 앞 결과는 window.__rc 에 모아 두면 된다.

   주의: 가족이 넣은 장소가 있으면 점갈래 숫자가 달라진다. 점검 전에
   localStorage.removeItem('jeju.share') 후 인터넷을 끊고 새로고침할 것
   (인터넷이 있으면 공유 서버에서 다시 받아 온다).

   주의: 화면을 375x667 로 맞추고 돌릴 것. 전체보기·닫기·범례 높이가
   화면 크기에 따라 달라진다. */
(async () => {
  const w = ms => new Promise(r => setTimeout(r, ms));
  const err = []; window.addEventListener('error', e => err.push(String(e.message)));
  const o = {};
  await w(1800);

  /* 1) 지도 핀 번호 ↔ 일정 카드 번호 */
  document.querySelector('.mtab[data-m="trip"]').click(); await w(900);
  let bad = 0, pins = 0;
  for (let i = 0; i < 5; i++) {
    document.querySelectorAll('#daytabs .dtab')[i].click(); await w(650);
    const P = [...document.querySelectorAll('.leaflet-marker-icon.pin b')].map(b => b.textContent.trim());
    const C = [...document.querySelectorAll('#tl details.stop[data-lat]')].map(d => d.querySelector('.sn')?.textContent.trim());
    pins += P.length; P.forEach((p, n) => { if (C[n] && C[n] !== p) bad++; });
  }
  o.배지불일치 = bad; o.핀합계 = pins;
  o.지적경계 = AREAS.length; o.경로 = Object.keys(PATHS).length;
  o.길찾기 = document.querySelectorAll('a[href*="map.kakao.com/link/to"]').length;

  /* 2) 핀을 누르면 그 일정 카드 "상단" 이 지도 바로 아래로 와야 한다 */
  document.querySelectorAll('#daytabs .dtab')[0].click(); await w(700);
  window.scrollTo(0, 0); await w(300);
  [...document.querySelectorAll('.leaflet-marker-icon.pin')]
    .find(m => m.querySelector('b')?.textContent.trim() === '3').click();
  await w(800);
  let d = document.querySelector('#tl details.stop[open]');
  o.핀클릭 = { k: d?.dataset.k,
    간격: Math.round(d.getBoundingClientRect().top - document.querySelector('.stickytop').getBoundingClientRect().bottom) };

  /* 3) 카드를 열면 그 장소의 크기에 맞는 배율로 들어간다.
        한 값으로 통일하지 않는다 — 미술관은 가까이, 숲길은 멀리.
        그리고 같은 장소는 탭이 달라도 같은 배율이어야 한다. */
  document.querySelector('.mtab[data-m="spot"]').click(); await w(1600);
  const 배율재기 = async (n) => {
    const i = SPOT.findIndex(x => x.n === n);
    document.querySelectorAll('#spotcards details[open]').forEach(x => x.open = false); await w(250);
    document.querySelector('#spotcards details[data-si="' + i + '"]').querySelector('summary').click();
    await w(1100); return map.getZoom();
  };
  o.배율 = { 미술관: await 배율재기('유민미술관'), 일출봉: await 배율재기('성산일출봉'),
             숲길: await 배율재기('사려니숲길') };
  document.querySelector('.mtab[data-m="food"]').click(); await w(1600);
  document.querySelector('#foodcards details summary').click(); await w(1100);
  o.배율.맛집 = map.getZoom();
  document.querySelector('.mtab[data-m="trip"]').click(); await w(1600);
  document.querySelectorAll('#daytabs .dtab')[2].click(); await w(1500);
  const 일출봉카드 = [...document.querySelectorAll('#tl details.stop[data-lat]')]
    .find(el => (D[2].stops.filter(x => x.ll)[+el.dataset.k] || {}).n === '성산일출봉');
  if (일출봉카드) { 일출봉카드.querySelector('summary').click(); await w(1000); }
  o.배율.일정_일출봉 = map.getZoom();

  /* 3-1) 여행지·맛집 카드도 일정 탭처럼 반응하는가.
         카드를 열면 지도 아래 패널이 뜨지 않고, 화면이 움직이지 않고, 그 점이 선택 표시된다.
         예전에는 카드와 똑같은 내용이 패널에 또 그려져 한 화면에 두 번 나왔다. */
  document.querySelector('.mtab[data-m="spot"]').click(); await w(1600);
  document.querySelectorAll('#spotcards details[open]').forEach(x => x.open = false);
  hideInfo(); await w(400);
  const sc = [...document.querySelectorAll('#spotcards details')][6];
  sc.scrollIntoView({ block: 'center' }); await w(500);
  const y0 = Math.round(scrollY), t0 = Math.round(sc.getBoundingClientRect().top);
  sc.querySelector('summary').click(); await w(1400);
  o.탭통일 = { 패널: document.getElementById('mapinfo').hidden,
    안움직임: Math.round(scrollY) === y0 && Math.round(sc.getBoundingClientRect().top) === t0,
    선택표시: document.querySelectorAll('#map .poi.sel').length };

  /* 3-2) 지도 점을 누르면 그 카드가 열리고 카드 상단이 지도 바로 아래로 온다.
         일정 탭에서 핀을 누를 때와 같은 값(8px)이어야 한다. */
  document.querySelectorAll('#spotcards details[open]').forEach(x => x.open = false);
  hideInfo(); window.scrollTo(0, 900); await w(600);
  const sp = SPOT[20];
  let mk = null;
  poiLyr.eachLayer(m => { const p = m.getLatLng && m.getLatLng();
    if (p && Math.abs(p.lat - sp.ll[0]) < 1e-6 && Math.abs(p.lng - sp.ll[1]) < 1e-6) mk = m; });
  if (mk) mk.fire('click');
  await w(1300);
  const op = document.querySelector('#spotcards details[open]');
  o.점클릭 = { 일치: op?.querySelector('.ftit b')?.textContent === sp.n,
    간격: op ? Math.round(op.getBoundingClientRect().top
      - document.querySelector('.stickytop').getBoundingClientRect().bottom) : null };

  /* 3-3) 세 탭의 지도가 통합 함수 한 곳을 거치는가.
         `drawMapFor` 를 잠깐 감싸 배율 하나만 바꿔 보고, 세 탭이 모두 따라오는지 본다.
         지도 그리는 코드를 탭별로 되돌리면 여기서 걸린다. */
  const seen = [], origDraw = window.drawMapFor;
  window.drawMapFor = function (m) { seen.push(m); origDraw(m);
    try { map.setView(map.getCenter(), 12, { animate: false }); } catch (e) {} };
  const z = {};
  document.querySelector('.mtab[data-m="trip"]').click(); await w(1900); z.일정 = map.getZoom();
  document.querySelector('.mtab[data-m="spot"]').click(); await w(1900); z.여행지 = map.getZoom();
  document.querySelector('.mtab[data-m="food"]').click(); await w(1900); z.맛집 = map.getZoom();
  window.drawMapFor = origDraw;
  o.지도통합 = { 거친탭: seen.join(','),
    한곳수정이_세탭에: z.일정 === 12 && z.여행지 === 12 && z.맛집 === 12 };

  /* 3-4) 탭을 바꾸면 일정 탭의 번호 핀 참조가 남지 않아야 한다.
         남으면 focusStop 이 지워진 마커를 만진다. */
  document.querySelector('.mtab[data-m="trip"]').click(); await w(1800);
  const pinTrip = pinRefs.length;
  document.querySelector('.mtab[data-m="spot"]').click(); await w(1800);
  o.핀참조 = { 일정: pinTrip, 여행지: pinRefs.length };

  /* 3-5) 탭에 맞는 점만 그리는가. 일정은 전부, 여행지는 볼거리만, 맛집은 먹을거리만.
         범례도 그린 점만 설명해야 한다. */
  const 점세기 = () => { const c = { 여행지: 0, 명소: 0, 맛집: 0 };
    poiLyr.eachLayer(m => { const el = m.getElement && m.getElement(); if (!el) return;
      const k = el.className;
      if (k.includes('food')) c.맛집++; else if (k.includes('spot')) c.여행지++; else c.명소++; });
    return c; };
  const 범례항목 = () => [...document.querySelectorAll('#legend > span')]
    .filter(x => x.getClientRects().length && (x.querySelector('i')))
    .map(x => x.innerText.replace(/\s+/g, ' ').trim());
  document.querySelector('.mtab[data-m="trip"]').click(); await w(1800);
  o.점갈래_일정 = { ...점세기(), 범례: 범례항목() };
  document.querySelector('.mtab[data-m="spot"]').click(); await w(1800);
  o.점갈래_여행지 = { ...점세기(), 범례: 범례항목() };
  document.querySelector('.mtab[data-m="food"]').click(); await w(1800);
  o.점갈래_맛집 = { ...점세기(), 범례: 범례항목() };

  /* 4) 지도 조작 버튼 세 개 — 섬전체 기대값은 1일차 기준이다 */
  document.querySelector('.mtab[data-m="trip"]').click(); await w(1200);
  document.querySelectorAll('#daytabs .dtab')[0].click(); await w(1000);
  document.getElementById('mapfit').click(); await w(800);
  o.섬전체 = { 줌: map.getZoom(), 다보임: (() => { const b = map.getBounds();
    return b.contains([33.1941, 126.1609]) && b.contains([33.5661, 126.9462]); })() };
  document.getElementById('mapall').click(); await w(900);
  o.전체보기 = Math.round(document.getElementById('map').getBoundingClientRect().height);
  document.getElementById('mapall').click(); await w(900);
  o.닫기 = Math.round(document.getElementById('map').getBoundingClientRect().height);

  /* 5) 범례 + 버튼이 한 줄에 들어가는가 */
  const lg = document.getElementById('legend');
  const it = [...lg.querySelectorAll(':scope>span')].filter(x => x.getClientRects().length);
  const rows = [...new Set(it.map(x => Math.round(x.getBoundingClientRect().top + x.getBoundingClientRect().height / 2)))];
  o.범례 = { 높이: Math.round(lg.getBoundingClientRect().height), 한줄: Math.max(...rows) - Math.min(...rows) < 6 };

  /* 6) 개략도 — 카카오톡에서 타일이 막힌 상황 */
  map.removeLayer(tileLyr); buildState = ''; setBuild('vec'); fitCurrent(); await w(900);
  o.개략도z9 = { path: map.getPane('vecpane').querySelectorAll('path').length, 줌: map.getZoom(), 최대줌: map.getMaxZoom() };
  map.setView([33.45, 126.92], 12, { animate: false }); await w(700);
  o.개략도z12 = { path: map.getPane('vecpane').querySelectorAll('path').length,
    순환: vecLine.ring[0].options.weight, 해안: vecCoast.options.weight };

  o.타일서버 = TILE_SRC.map(t => t.u.split('/')[2]);
  o.오류 = err;
  return JSON.stringify(o, null, 1);
})()
