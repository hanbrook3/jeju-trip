/* 카카오 길찾기에서 실제 도로 좌표를 받아 index.html 의 PATHS 를 다시 만든다.
     KAKAO_REST_KEY=<키> node tools/build-paths.js
     KAKAO_REST_KEY=<키> node tools/build-paths.js --dry    (파일을 고치지 않고 크기만 본다)

   왜 미리 굽나 — 가족은 REST 키가 없고 여행 중엔 인터넷도 없을 수 있다.
   구워 두면 누구나 키 없이, 오프라인에서도 진짜 도로 선을 본다.

   구간마다 따로 받는 이유 — 카카오 경유지 한도가 5개인데 하루 정차지가 8곳인 날이 있다.
   구간별로 받아 이으면 한도와 무관하고 각 구간이 독립이라 다시 받기도 쉽다.

   좌표는 rideLL 과 같은 규칙으로 고른다(주차장이 있으면 주차장) — 선이 실제로 차가
   서는 곳까지 가야 이동시간과 그림이 어긋나지 않는다.

   **build-rides.js 와 똑같이 여행 당일 그 시각으로 받는다.** 전에는 여기만
   `/v1/directions`(=구울 때의 지금 교통)를 써서, 같은 화면 안에서 선과 시각이 서로
   다른 길이 되는 구간이 있었다(1일차 제주항→방목지가 선은 시내 연삼로, 시각은
   516로였다). "지금" 경로는 분 단위로 흔들려 구울 때마다 답이 달라지기도 했다.
   출발 시각은 build-rides 와 같은 방법으로 두 번 맞춘다 — 정차지에 적힌 시각은
   도착 시각이라, 1차로 어림한 이동시간을 다음 도착 시각에서 빼야 진짜 출발이 나온다. */
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const HTML = path.join(ROOT, 'index.html');
const KEY = process.env.KAKAO_REST_KEY || '';
const DRY = process.argv.includes('--dry');
const 허용오차 = 0.00006;          /* 약 6.7m — 20m 로 줄이면 길 위까지 확대했을 때 선이 도로를 벗어나 구불구불해 보인다 */
const 해 = 2026;

const 두자리 = v => (v < 10 ? '0' : '') + v;
/* 'HH:MM' 을 그날 0시에서 몇 분 뒤인지로. 못 읽으면 null */
function 분(hhmm) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm || ""));
  return m ? (+m[1]) * 60 + (+m[2]) : null;
}
/* 그날 0시에서 몇 분 뒤인지로 yyyyMMddHHmm 을 만든다. 자정을 넘겨도 날짜가 따라간다. */
function 떠나는때(d, 지난분, D) {
  const [월, 일] = D[d].dm.split('.').map(Number);
  const t = new Date(해, 월 - 1, 일, 0, 0);
  t.setMinutes(지난분);
  return t.getFullYear() + 두자리(t.getMonth() + 1) + 두자리(t.getDate())
    + 두자리(t.getHours()) + 두자리(t.getMinutes());
}

if (!KEY) { console.error('KAKAO_REST_KEY 가 없습니다. 콘솔의 앱 설정 > 플랫폼 키에서 REST 키를 넣으세요.'); process.exit(1); }

/* index.html 에서 배열 하나를 꺼내 값으로 만든다 */
function 배열읽기(줄, 이름) {
  const s = 줄.findIndex(l => l.indexOf('const ' + 이름 + '=[') === 0);
  if (s < 0) throw new Error(이름 + ' 을 못 찾음');
  let e = -1;
  for (let i = s; i < 줄.length; i++) if (줄[i].indexOf('];') === 0) { e = i; break; }
  if (e < 0) throw new Error(이름 + ' 의 끝을 못 찾음');
  return { s, e, 값: eval(줄.slice(s, e + 1).join('\n') + '\n' + 이름) };
}
/* 길찾기에 쓸 좌표 — index.html 의 rideLL 과 같은 규칙 */
function 길좌표(정차지, 여행지) {
  if (!정차지) return null;
  if (정차지.pk) return 정차지.pk;
  const m = (여행지 || []).find(s => s.n === 정차지.n);
  if (m && m.pk) return m.pk;
  return 정차지.ll || null;
}
/* 점을 줄인다(Douglas-Peucker) — 도로 모양은 그대로 두고 개수만 뺀다 */
function 줄이기(점들, 오차) {
  if (점들.length < 3) return 점들.slice();
  let 최대 = 0, 자리 = 0;
  const a = 점들[0], b = 점들[점들.length - 1];
  for (let i = 1; i < 점들.length - 1; i++) {
    const d = 선까지거리(점들[i], a, b);
    if (d > 최대) { 최대 = d; 자리 = i; }
  }
  if (최대 <= 오차) return [a, b];
  return 줄이기(점들.slice(0, 자리 + 1), 오차).slice(0, -1).concat(줄이기(점들.slice(자리), 오차));
}
function 선까지거리(p, a, b) {
  const dx = b[1] - a[1], dy = b[0] - a[0];
  if (dx === 0 && dy === 0) return Math.hypot(p[1] - a[1], p[0] - a[0]);
  const t = ((p[1] - a[1]) * dx + (p[0] - a[0]) * dy) / (dx * dx + dy * dy);
  const u = Math.max(0, Math.min(1, t));
  return Math.hypot(p[1] - (a[1] + u * dx), p[0] - (a[0] + u * dy));
}

/* 경유지(via)를 주면 그 점들을 지나는 길을 받는다 — 카카오 추천이 크게 돌아갈 때 쓴다.
   화요일 아침 → 1100고지가 추천대로면 한라산을 북쪽으로 돌아 51.5km 인데,
   서귀다원(516로) 을 경유지로 주면 남쪽 중산간으로 올라 47.1km 가 된다. */
async function 구간(a, b, 때, 경유) {
  const url = 'https://apis-navi.kakaomobility.com/v1/future/directions'
    + '?origin=' + a[1] + ',' + a[0] + '&destination=' + b[1] + ',' + b[0]
    + (경유 && 경유.length ? '&waypoints=' + 경유.map(p => p[1] + ',' + p[0]).join('|') : '')
    + '&departure_time=' + 때;
  const r = await fetch(url, { headers: { Authorization: 'KakaoAK ' + KEY } });
  const j = await r.json();
  const route = j && j.routes && j.routes[0];
  if (!route || route.result_code !== 0) return { 오류: (route && route.result_msg) || 'HTTP ' + r.status };
  const 점 = [];
  (route.sections || []).forEach(sec => (sec.roads || []).forEach(road => {
    const v = road.vertexes || [];
    for (let i = 0; i + 1 < v.length; i += 2) 점.push([+v[i + 1].toFixed(6), +v[i].toFixed(6)]);
  }));
  return { 점, 분: Math.round(((route.summary || {}).duration || 0) / 60) };
}

(async () => {
  const 줄 = fs.readFileSync(HTML, 'utf8').split('\n');
  const D = 배열읽기(줄, 'D').값;
  const SPOT = 배열읽기(줄, 'SPOT').값;
  const P = 배열읽기(줄, 'PATHS');

  const 새PATHS = [];
  let 원점수 = 0, 준점수 = 0, 실패 = 0;
  for (let i = 0; i < D.length; i++) {
    const 전부 = D[i].stops;
    const 정차지 = 전부.filter(s => s.ll);
    let 하루 = [];
    for (let k = 0; k + 1 < 정차지.length; k++) {
      const a = 길좌표(정차지[k], SPOT), b = 길좌표(정차지[k + 1], SPOT);
      if (!a || !b) continue;
      /* **배로 건너는 구간은 도로로 잇지 않는다.** 육로가 없는 곳을 물으면 카카오가
         돌아가는 길을 돌려준다 — 진도→제주를 물었더니 완도 쪽 해안도로가 나왔다. */
      /* **걸어서 옮기는 구간은 도로로 잇지 않는다.** 숲길은 도로가 아니어서 길찾기가
         엉뚱한 우회 도로를 준다 — 사려니 편도 10.2km 를 물으면 남조로·비자림로 9.3km
         자동차 길이 나온다. 버스 구간은 실제로 도로를 달리므로 그대로 받는다. */
      if (정차지[k].way && 정차지[k].way.ty === 'walk') {
        console.log(`  · ${i + 1}일차 ${정차지[k].n} → ${정차지[k + 1].n} : 걸어가는 길이라 곧게 잇습니다`);
        하루 = 하루.concat([a, b]);
        continue;
      }
      const 앞 = 전부.indexOf(정차지[k]), 뒤 = 전부.indexOf(정차지[k + 1]);
      if (전부.slice(앞 + 1, 뒤).some(s => s.ty === 'ship')) {
        console.log(`  · ${i + 1}일차 ${정차지[k].n} → ${정차지[k + 1].n} : 사이에 배가 있어 잇지 않습니다`);
        continue;
      }
      /* 1차 — 앞 정차지 도착 시각으로 어림잡는다 */
      const 앞시각 = 분(정차지[k].t), 뒤시각 = 분(정차지[k + 1].t);
      let r = await 구간(a, b, 떠나는때(i, 앞시각 === null ? 9 * 60 : 앞시각, D), 정차지[k].via);
      /* 2차 — 다음 도착 시각에서 어림한 이동을 빼면 진짜 출발 시각이다 */
      if (!r.오류 && 앞시각 !== null && 뒤시각 !== null) {
        const 출발 = Math.max(앞시각, 뒤시각 - r.분);
        if (출발 !== 앞시각) {
          const 다시 = await 구간(a, b, 떠나는때(i, 출발, D), 정차지[k].via);
          if (!다시.오류) r = 다시;
        }
      }
      if (r.오류) {
        실패++;
        console.log(`  ! ${i + 1}일차 ${정차지[k].n} → ${정차지[k + 1].n} : ${r.오류} (직선으로 잇습니다)`);
        하루 = 하루.concat([a, b]);
        continue;
      }
      원점수 += r.점.length;
      하루 = 하루.concat(r.점);
    }
    /* 이어 붙인 자리에 같은 점이 겹치므로 한 번 훑어 지운다 */
    하루 = 하루.filter((p, k) => k === 0 || p[0] !== 하루[k - 1][0] || p[1] !== 하루[k - 1][1]);
    const 줄인것 = 줄이기(하루, 허용오차);
    준점수 += 줄인것.length;
    새PATHS.push(줄인것);
    console.log(`  ${i + 1}일차 ${정차지.length}곳 · 받은 점 ${하루.length} → 줄인 점 ${줄인것.length}`);
  }

  const 본문 = 'const PATHS=[\n'
    + 새PATHS.map(일 => ' [' + 일.map(p => '[' + p[0] + ',' + p[1] + ']').join(',') + ']').join(',\n')
    + '\n];';
  console.log(`\n받은 점 ${원점수} → 넣을 점 ${준점수} · 새 PATHS ${본문.length} 바이트 (지금 ${줄.slice(P.s, P.e + 1).join('\n').length} 바이트) · 실패 구간 ${실패}`);
  if (DRY) { console.log('--dry 라 파일을 고치지 않았습니다.'); return; }
  줄.splice(P.s, P.e - P.s + 1, 본문);
  fs.writeFileSync(HTML, 줄.join('\n'));
  console.log('index.html 의 PATHS 를 바꿨습니다.');
})();
