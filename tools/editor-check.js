/* 편집기 점검 — 편집을 손댈 때마다 돌린다.
   브라우저 콘솔(또는 javascript_tool)에 붙여 넣는다. 375x667 로 맞출 것.
   대기시간이 30초 제한에 가까우므로 섹션 단위로 나눠 붙여도 된다.

   계산 함수만 보는 시험은 따로 있다 — node tools/editor-test.js
   이 파일은 화면에 붙은 뒤에도 그대로 도는지 보는 것이다.

   기대값 (2026-08-28 기준)
     처음같음 true        편집기를 열었을 때 계산 시각이 지금 일정과 같다
     30분밀기 true        첫 정차지를 30분 늦추면 그날 전부 30분 밀린다
     머뭄늘리기 {앞:0, 뒤:30}  머무는 시간을 30분 늘리면 그 뒤만 밀린다
     유민경고 true        2일차 유민미술관에 화요일 휴무 경고가 붙는다
     식사경고 true        점심을 15:20 으로 밀면 늦다는 경고가 붙는다
     배경고 true          1일차 출발을 2시간 늦추면 진도항 도착 경고가 붙는다
     되돌리기 true        원래대로를 누르면 저장이 지워진다
     오류 []

   주의: 서비스워커가 옛 index.html 을 물고 있으면 새 함수가 없다고 나온다.
   확인 전에 워커와 캐시를 지우고 새로 열 것. */
(async () => {
  const w = ms => new Promise(r => setTimeout(r, ms));
  const err = []; window.addEventListener('error', e => err.push(String(e.message)));
  const o = {};
  await w(1800);

  document.querySelector('.mtab[data-m="trip"]').click(); await w(1500);
  document.querySelectorAll('#daytabs .dtab')[1].click(); await w(1200);
  if (document.getElementById('editbar').hidden) document.getElementById('editkey').click();
  await w(3500);

  /* 1) 처음 열었을 때 지금 일정과 같은가 — 머무는 시간 역산이 맞아야 한다 */
  o.처음같음 = D[1].stops.every((s, i) => s.t === dayPlan(1).arrive[i]);

  /* 2) 첫 정차지를 30분 늦추면 전부 30분 밀린다 */
  const t0 = hm2min(D[1].stops[0].t);
  editSet(1, 0, 't', min2hm(t0 + 30)); render(1); await w(700);
  o['30분밀기'] = D[1].stops.every((s, i) => hm2min(dayPlan(1).arrive[i]) - hm2min(s.t) === 30);
  editClear(); editData = null; render(1); await w(500);

  /* 3) 머무는 시간을 30분 늘리면 그 뒤만 밀린다.
        고친 곳 자신의 도착은 안 바뀐다 — stay 는 출발부터 영향을 준다 */
  const 전 = dayPlan(1).arriveMin.slice();
  const 원래머뭄 = dayPlan(1).stay[1];
  editSet(1, 1, 'stay', 원래머뭄 + 30); render(1); await w(700);
  const 후 = dayPlan(1).arriveMin;
  o.머뭄늘리기 = { 앞: 후[1] - 전[1], 뒤: 후[2] - 전[2] };
  editClear(); editData = null; render(1); await w(500);

  /* 4) 유민미술관 화요일 휴무 경고 — 지금 일정에 실제로 있는 문제다 */
  o.유민경고 = dayWarns(1).flat().some(x => x.indexOf('유민미술관') >= 0 && x.indexOf('휴무') >= 0);

  /* 5) 점심을 15시로 밀면 식사 경고 */
  const 점심 = D[1].stops.findIndex(s => s.ty === 'meal' && hm2min(s.t) >= 660 && hm2min(s.t) < 900);
  if (점심 >= 0) {
    editSet(1, 점심, 't', '15:20'); render(1); await w(700);
    o.식사경고 = dayWarns(1)[점심].some(x => x.indexOf('점심') >= 0 && x.indexOf('늦') >= 0);
    editClear(); editData = null; render(1); await w(500);
  } else { o.식사경고 = '해당 정차지 없음'; }

  /* 6) 1일차 출발을 2시간 늦추면 진도항 도착 경고 */
  document.querySelectorAll('#daytabs .dtab')[0].click(); await w(1300);
  const 항구 = D[0].stops.findIndex(s => s.ty === 'ship');
  if (항구 >= 0) {
    editSet(0, 0, 't', min2hm(hm2min(D[0].stops[0].t) + 120)); render(0); await w(700);
    o.배경고 = dayWarns(0)[항구].some(x => x.indexOf('도착해야') >= 0);
    editClear(); editData = null; render(0); await w(500);
  } else { o.배경고 = '해당 정차지 없음'; }
  document.querySelectorAll('#daytabs .dtab')[1].click(); await w(1300);

  /* 7) 되돌리기 — 부모님이 실수로 눌렀을 때의 탈출구 */
  editSet(1, 1, 'stay', 999);
  document.getElementById('editreset').click(); await w(700);
  o.되돌리기 = editLoad() === null && document.getElementById('editbar').hidden;

  o.오류 = err;
  return JSON.stringify(o, null, 1);
})()
