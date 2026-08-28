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
  new Function('__out', code + '\n__out.hm2min=hm2min; __out.min2hm=min2hm;')(API);
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

console.log(`\n통과 ${통과} · 실패 ${실패}`);
process.exitCode = 실패 ? 1 : 0;
