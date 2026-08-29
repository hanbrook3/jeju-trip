/* 구간 실측(이동시간·거리·통행료)을 카카오에서 받아 index.html 의 RIDE 에 구워 넣는다.
     KAKAO_REST_KEY=$(cat tools/.kakao-key) node tools/build-rides.js --dry
     KAKAO_REST_KEY=$(cat tools/.kakao-key) node tools/build-rides.js

   왜 구워 두나 — 가족은 REST 키가 없다. 키가 없으면 이동시간이 추정식
   (직선km × 1.47 + 5, 실측 대비 최대 오차 31%)으로 떨어진다. 구워 두면 누구나
   키 없이 실제 도로 시간을 쓴다. PATHS 를 미리 굽는 것과 같은 뜻이다.

   **여행 당일 그 시각에 출발한다고 보고 받는다.** 일반 길찾기(/v1/directions)는
   "지금" 기준이라 새벽에 갈 길을 저녁 교통으로 재는 셈이 된다. 미래 운행 엔드포인트
   (/v1/future/directions)에 departure_time 을 주면 그 시각의 예측을 준다 —
   제주항→방목지가 지금 기준 32분인데 10/5 05:55 출발이면 27분이다.
   가짜 시간을 넣으면 실제로 다녀 보았을 때 일정이 엉망이 되므로 이렇게 한다.

   출발 시각은 두 번 돌려 맞춘다. 앞 정차지에 적힌 시각은 **도착** 시각이라 실제
   출발은 그보다 늦다. 1차로 어림한 이동시간을 다음 정차지 도착 시각에서 빼면
   출발 시각이 나오고, 그 시각으로 다시 받는다.

   좌표는 rideLL 과 같은 규칙(주차장 우선)으로 고른다 — 그래야 앱의 rideKey 와 맞는다.

   **부제(sub)는 건드리지 않는다.** 부제의 시간 표현은 뜻이 제각각이라
   (`왕복 1시간 30분`=체류, `항해 2시간`=배, `385.4km`=여러 구간 합) 자동으로
   갈아 끼우면 틀린 값이 들어간다. */
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const HTML = path.join(ROOT, 'index.html');
const KEY = process.env.KAKAO_REST_KEY || '';
const DRY = process.argv.includes('--dry');
const 해 = 2026;

if (!KEY) { console.error('KAKAO_REST_KEY 가 없습니다.'); process.exit(1); }

const 원문 = fs.readFileSync(HTML, 'utf8');
function 배열읽기(이름) {
  const i = 원문.indexOf('const ' + 이름 + '=[');
  if (i < 0) throw new Error(이름 + ' 을 못 찾음');
  const j = 원문.indexOf('\n];', i);
  return eval(원문.slice(i + ('const ' + 이름 + '=').length, j + 2));
}
const D = 배열읽기('D'), SPOT = 배열읽기('SPOT');

function 길좌표(정차지) {
  if (!정차지) return null;
  if (정차지.pk) return 정차지.pk;
  const m = SPOT.find(s => s.n === 정차지.n);
  if (m && m.pk) return m.pk;
  return 정차지.ll || null;
}
function 키(a, b) {
  return a[0].toFixed(4) + ',' + a[1].toFixed(4) + '>' + b[0].toFixed(4) + ',' + b[1].toFixed(4);
}
function 분(v) { const m = /^(\d{1,2}):([0-5]\d)$/.exec(String(v || '').trim()); return m ? +m[1] * 60 + +m[2] : null; }
const 두자리 = v => (v < 10 ? '0' : '') + v;
/* 그날 0시에서 몇 분 뒤인지로 yyyyMMddHHmm 을 만든다. 자정을 넘겨도 날짜가 따라간다. */
function 떠나는때(d, 지난분) {
  const [월, 일] = D[d].dm.split('.').map(Number);
  const t = new Date(해, 월 - 1, 일, 0, 0);
  t.setMinutes(지난분);
  return t.getFullYear() + 두자리(t.getMonth() + 1) + 두자리(t.getDate())
    + 두자리(t.getHours()) + 두자리(t.getMinutes());
}

async function 재기(a, b, 때) {
  const url = 'https://apis-navi.kakaomobility.com/v1/future/directions'
    + '?origin=' + a[1] + ',' + a[0] + '&destination=' + b[1] + ',' + b[0]
    + '&departure_time=' + 때;
  const r = await fetch(url, { headers: { Authorization: 'KakaoAK ' + KEY } });
  const j = await r.json();
  const route = j && j.routes && j.routes[0];
  if (!route || route.result_code !== 0) return { 오류: (route && route.result_msg) || ('HTTP ' + r.status) };
  const s = route.summary || {};
  return {
    분: Math.round((s.duration || 0) / 60),
    km: +((s.distance || 0) / 1000).toFixed(1),
    통행료: (s.fare && s.fare.toll) || 0,
  };
}

(async () => {
  const 표 = {}, 밀림 = [], 겹침 = [];
  let 실패 = 0;
  for (let d = 0; d < D.length; d++) {
    const 정차지 = D[d].stops;
    for (let i = 0; i + 1 < 정차지.length; i++) {
      const a = 길좌표(정차지[i]), b = 길좌표(정차지[i + 1]);
      if (!a || !b) continue;
      const k = 키(a, b);
      const 앞 = 분(정차지[i].t), 뒤 = 분(정차지[i + 1].t);
      if (표[k]) { 겹침.push(`${d + 1}일차 ${정차지[i].n} → ${정차지[i + 1].n} (이미 받은 구간)`); continue; }

      /* 1차 — 앞 정차지 도착 시각으로 어림잡는다 */
      const 첫때 = 떠나는때(d, 앞 === null ? 9 * 60 : 앞);
      let r = await 재기(a, b, 첫때);
      if (!r.오류 && 앞 !== null && 뒤 !== null) {
        /* 2차 — 다음 도착 시각에서 어림한 이동을 빼면 진짜 출발 시각이다 */
        const 출발 = Math.max(앞, 뒤 - r.분);
        if (출발 !== 앞) {
          const 다시 = await 재기(a, b, 떠나는때(d, 출발));
          if (!다시.오류) r = 다시;
        }
      }
      if (r.오류) {
        실패++;
        console.log(`  ! ${d + 1}일차 ${정차지[i].n} → ${정차지[i + 1].n} : ${r.오류}`);
        continue;
      }
      표[k] = r;
      if (앞 !== null && 뒤 !== null && 뒤 - 앞 < r.분) {
        밀림.push(`${d + 1}일차 ${정차지[i].n} → ${정차지[i + 1].n} : 일정 ${뒤 - 앞}분 · 실측 ${r.분}분 (${r.분 - (뒤 - 앞)}분 모자람)`);
      }
      console.log(`  ${d + 1}일차 ${정차지[i].n} → ${정차지[i + 1].n} : ${r.분}분 ${r.km}km${r.통행료 ? ' 통행료 ' + r.통행료.toLocaleString() + '원' : ''}`);
    }
  }
  const 줄 = Object.keys(표).map(k => " '" + k + "':[" + 표[k].분 + ',' + 표[k].km + ',' + 표[k].통행료 + ']');
  const 본문 = 'const RIDE={\n' + 줄.join(',\n') + '\n};';

  console.log(`\n구간 ${Object.keys(표).length}개 · 실패 ${실패}개 · ${본문.length} 바이트`);
  if (겹침.length) {
    console.log('\n※ 좌표가 같아 한 벌만 받은 구간 ' + 겹침.length + '개 — 앱은 좌표로만 찾으므로 한 벌뿐이다:');
    겹침.forEach(x => console.log('   ' + x));
  }
  if (밀림.length) {
    console.log('\n※ 실측이 지금 일정보다 오래 걸리는 곳 ' + 밀림.length + '군데 — 넣으면 그만큼 밀린다:');
    밀림.forEach(x => console.log('   ' + x));
  } else {
    console.log('\n실측이 지금 일정 안에 다 들어간다 — 넣어도 시각이 밀리지 않는다.');
  }
  if (DRY) { console.log('\n--dry 라 파일을 고치지 않았습니다.'); return; }

  const 줄들 = 원문.split('\n');
  const s = 줄들.findIndex(l => l.indexOf('const RIDE={') === 0);
  if (s < 0) {
    const 자리 = 줄들.findIndex(l => l.indexOf('const rideCache={') === 0);
    if (자리 < 0) throw new Error('넣을 자리를 못 찾음');
    줄들.splice(자리, 0, '/* 구간 실측 — 카카오에서 받아 구워 두었다. 키가 없어도 실제 도로 시간을 쓴다.', '   [분, km, 통행료]. 다시 만들려면 tools/build-rides.js */', 본문);
  } else {
    let e = -1;
    for (let i = s; i < 줄들.length; i++) if (줄들[i].indexOf('};') === 0) { e = i; break; }
    if (e < 0) throw new Error('RIDE 의 끝을 못 찾음');
    줄들.splice(s, e - s + 1, 본문);
  }
  fs.writeFileSync(HTML, 줄들.join('\n'));
  console.log('index.html 의 RIDE 를 넣었습니다.');
})();
