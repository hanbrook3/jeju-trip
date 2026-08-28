/* 일정 계산 함수 단위 시험.  node tools/editor-test.js
   index.html 안의 "일정 계산" 블록만 꺼내 돌린다. DOM 없이 돌아가야 한다. */
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const h = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

const S = '/* ══════ 일정 계산 ══════ */';
const E = '/* ══════ 일정 계산 끝 ══════ */';
const a = h.indexOf(S), b = h.indexOf(E);
if (a < 0 || b < 0) { console.error('계산 블록을 못 찾음 — 앵커 주석을 확인할 것'); process.exit(1); }
const code = h.slice(a, b + E.length);

/* 블록이 내보내는 이름들을 여기서 받는다 */
const API = {};
try {
  new Function('__out', code + '\n__out.hm2min=hm2min; __out.min2hm=min2hm;' +
    ' __out.km=km; __out.guessMin=guessMin;')(API);
} catch (e) {
  console.error('계산 블록 실행 실패:', e.message); process.exit(1);
}

let 통과 = 0, 실패 = 0;
function 확인(이름, 실제, 기대) {
  const 같음 = JSON.stringify(실제) === JSON.stringify(기대);
  if (같음) { 통과++; }
  else { 실패++; console.log(`  ✗ ${이름}\n     기대 ${JSON.stringify(기대)}\n     실제 ${JSON.stringify(실제)}`); }
}

console.log('[시간 유틸]');
확인('09:30 → 570분', API.hm2min('09:30'), 570);
확인('05:40 → 340분', API.hm2min('05:40'), 340);
확인('00:00 → 0분', API.hm2min('00:00'), 0);
확인('570분 → 09:30', API.min2hm(570), '09:30');
확인('340분 → 05:40', API.min2hm(340), '05:40');
확인('0분 → 00:00', API.min2hm(0), '00:00');
확인('1445분 → 24:05 (자정 넘김)', API.min2hm(1445), '24:05');
확인('잘못된 값은 그대로', API.hm2min('없음'), null);

console.log('\n[거리와 이동시간 추정]');
/* 2026-08-28 OSRM 실측: 성산일출봉→천지연폭포 48.3km 55분, 협재→함덕 47.7km 55분,
   제주항→남원 39.3km 47분, 사려니→비자림 20.8km 29분, 산방산→오설록 9.2km 11분,
   일출봉→섭지코지 6.1km 11분. 추정은 이 값의 ±35% 안에 들어야 쓸 만하다. */
const 실측 = [
  ['성산일출봉→천지연폭포', [33.4581,126.9425], [33.247,126.554], 55],
  ['협재→함덕',            [33.394,126.24],    [33.5432,126.669], 55],
  ['제주항→남원숙소',        [33.5169,126.5316], [33.2745,126.66], 47],
  ['사려니→비자림',          [33.395,126.684],   [33.4843,126.8065], 29],
  ['산방산→오설록',          [33.237,126.313],   [33.3057,126.2894], 11],
  ['일출봉→섭지코지',        [33.4581,126.9425], [33.4242,126.9311], 11],
];
for (const [이름, a, b, 실제] of 실측) {
  const 추정 = API.guessMin(a, b);
  const 오차 = Math.abs(추정 - 실제) / 실제;
  확인(`${이름} 추정 ${추정}분 (실제 ${실제}분, 오차 ${Math.round(오차*100)}%)`, 오차 <= 0.35, true);
}
확인('같은 자리는 0분', API.guessMin([33.5,126.5],[33.5,126.5]), 0);
확인('좌표가 없으면 null', API.guessMin(null,[33.5,126.5]), null);

console.log(`\n통과 ${통과} · 실패 ${실패}`);
process.exitCode = 실패 ? 1 : 0;
