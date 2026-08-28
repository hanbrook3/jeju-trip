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
    ' __out.km=km; __out.guessMin=guessMin; __out.fillStay=fillStay;')(API);
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

console.log('\n[머무는 시간 자동 채우기]');
/* 좌표가 있는 두 곳: 시각 차이에서 이동시간을 뺀 것이 stay */
{
  const stops=[
    {t:'10:00',n:'가',ll:[33.4581,126.9425]},
    {t:'11:30',n:'나',ll:[33.4242,126.9311]},
    {t:'13:00',n:'다',ll:[33.4242,126.9311]},
  ];
  /* 가→나 11분, 나→다 0분 (나와 다는 같은 좌표라 이동이 없다).
     구간마다 값이 달라야 fillStay 가 ride 에 올바른 번호를 넘기는지 확인된다. */
  const 이동=i=>i===0?11:0;
  const r=API.fillStay(stops,이동);
  확인('첫 곳 stay = 90분 - 11분 = 79', r[0], 79);
  확인('둘째 곳 stay = 90분 - 0분 = 90', r[1], 90);
  확인('마지막 곳은 기본값 60', r[2], 60);
}
/* 좌표가 없으면 이동시간 0 — 시각 차이가 그대로 stay */
{
  const stops=[{t:'07:10',n:'휴게소'},{t:'09:40',n:'휴게소2'}];
  const r=API.fillStay(stops,()=>null);
  확인('좌표 없으면 시각 차이 전부가 stay', r[0], 150);
}
/* 시각을 읽을 수 없으면 기본값 */
{
  const stops=[{t:'',n:'가'},{t:'10:00',n:'나'}];
  const r=API.fillStay(stops,()=>null);
  확인('시각을 못 읽으면 60', r[0], 60);
}

console.log('\n[진짜 일정으로 확인]');
{
  /* index.html 의 D 를 꺼낸다 */
  function grab(name){
    const key='const '+name+'=', i=h.indexOf(key);
    let j=i+key.length, depth=0, inStr=null, esc=false;
    const open=h[j], close=open==='['?']':'}';
    for(;j<h.length;j++){ const c=h[j];
      if(esc){esc=false;continue;}
      if(inStr){ if(c==='\\')esc=true; else if(c===inStr)inStr=null; continue; }
      if(c==='"'||c==="'"||c==='`'){inStr=c;continue;}
      if(c===open)depth++; else if(c===close){depth--; if(depth===0){j++;break;}} }
    return eval('('+h.slice(i+key.length,j)+')');
  }
  const D=grab('D');
  /* 이동시간을 추정으로 넣고 stay 를 역산한 뒤, 그 값으로 시각을 다시 쌓으면
     원래 시각이 그대로 나와야 한다 */
  let 어긋남=0;
  D.forEach(function(d,di){
    const stops=d.stops;
    const rides=[];
    for(let i=0;i<stops.length-1;i++) rides.push(API.guessMin(stops[i].ll,stops[i+1].ll));
    const stay=API.fillStay(stops,function(i){ return rides[i]; });
    /* 되돌려 쌓기 */
    let t=API.hm2min(stops[0].t);
    for(let i=0;i<stops.length;i++){
      if(i>0) t=t+stay[i-1]+(rides[i-1]||0);
      const 원래=API.hm2min(stops[i].t);
      if(원래!==null&&원래!==t){ 어긋남++;
        console.log('  ✗ '+(di+1)+'일차 '+stops[i].n+' 원래 '+stops[i].t+' 계산 '+API.min2hm(t)); }
    }
  });
  확인('배포판 시각을 역산했다가 다시 쌓으면 원래대로 돌아온다', 어긋남, 0);
}

console.log(`\n통과 ${통과} · 실패 ${실패}`);
process.exitCode = 실패 ? 1 : 0;
