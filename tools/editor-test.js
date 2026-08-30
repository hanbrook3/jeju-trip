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
    ' __out.km=km; __out.guessMin=guessMin; __out.fillStay=fillStay;' +
    ' __out.recalc=recalc; __out.mealWarn=mealWarn;' +
    ' __out.openHours=openHours; __out.offDay=offDay; __out.spotWarn=spotWarn;' +
    ' __out.fixWarn=fixWarn; __out.planFingerprint=planFingerprint;' +
    ' __out.rideLL=rideLL; __out.naviKey=naviKey;')(API);
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
/* 2026-08-28 카카오 길찾기 실측 (주차장 좌표 기준):
   성산일출봉→천지연폭포 49.3km 71분, 협재→함덕 52.2km 68분, 제주항→남원 33.9km 47분,
   사려니→비자림 21.4km 28분, 산방산→오설록 9.1km 14분, 일출봉→섭지코지 8.3km 16분. */
const 실측 = [
  ['성산일출봉→천지연폭포', [33.459135,126.940538], [33.244092,126.560300], 71],
  ['협재→함덕',            [33.393742,126.240433], [33.543926,126.668291], 68],
  ['제주항→남원숙소',        [33.5169,126.5316],     [33.3050,126.7122],     47],
  ['사려니→비자림',          [33.395514,126.684912], [33.491304,126.810948], 28],
  ['산방산→오설록',          [33.236290,126.312623], [33.304756,126.289425], 14],
  ['일출봉→섭지코지',        [33.459135,126.940538], [33.423545,126.930145], 16],
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

/* index.html 의 최상위 const 선언 하나를 통째로 꺼낸다 (D, SPOT …) */
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

/* index.html 에서 꺼낸 배포판 일정. 아래 여러 절이 함께 쓴다 */
let D;

console.log('\n[진짜 일정으로 확인]');
{
  D=grab('D');
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

console.log('\n[재계산]');
{
  /* 세 곳 · 이동 20분씩 · 머무는 시간 60/30/0 */
  const stops=[{n:'가'},{n:'나'},{n:'다'}];
  const r=API.recalc(stops,{start:'09:00',stay:[60,30,0],ride:[20,20]});
  확인('첫 곳 도착 09:00', r.arrive[0], '09:00');
  확인('첫 곳 출발 10:00', r.depart[0], '10:00');
  확인('둘째 도착 10:20', r.arrive[1], '10:20');
  확인('둘째 출발 10:50', r.depart[1], '10:50');
  확인('셋째 도착 11:10', r.arrive[2], '11:10');
}
{
  /* 머무는 시간을 30분 늘리면 그 뒤만 밀린다 */
  const stops=[{n:'가'},{n:'나'},{n:'다'}];
  const a=API.recalc(stops,{start:'09:00',stay:[60,30,0],ride:[20,20]});
  const b=API.recalc(stops,{start:'09:00',stay:[90,30,0],ride:[20,20]});
  확인('앞은 그대로', b.arrive[0], a.arrive[0]);
  확인('뒤는 30분 밀림', b.arrive[2], '11:40');
}
{
  /* 중간 시각을 못 박으면 거기부터 다시 쌓는다 */
  const stops=[{n:'가'},{n:'나'},{n:'다'}];
  const r=API.recalc(stops,{start:'09:00',stay:[60,30,0],ride:[20,20],pin:{1:'12:00'}});
  확인('못 박은 곳은 그 시각', r.arrive[1], '12:00');
  확인('그 뒤는 거기서 다시 쌓임', r.arrive[2], '12:50');
  확인('앞은 안 건드림', r.arrive[0], '09:00');
}
{
  /* 좌표가 없어 이동시간을 모르면 0 으로 본다 */
  const stops=[{n:'가'},{n:'나'}];
  const r=API.recalc(stops,{start:'07:10',stay:[150,0],ride:[null]});
  확인('이동시간 null 은 0 으로', r.arrive[1], '09:40');
}

console.log('\n[진짜 일정으로 재계산]');
/* 하루치를 recalc 에 넣을 재료. 이동시간은 추정, 머무는 시간은 배포판 시각에서 역산,
   첫 도착은 그날 첫 정차지 시각으로 못 박는다 — 편집기가 처음 열릴 때와 같은 상태다. */
function 하루재료(d){
  const stops=d.stops, ride=[];
  for(let i=0;i<stops.length-1;i++) ride.push(API.guessMin(stops[i].ll,stops[i+1].ll));
  const stay=API.fillStay(stops,function(i){ return ride[i]; });
  return { stops:stops, ride:ride, stay:stay,
           start:stops[0].t, pin:{0:stops[0].t} };
}
/* 확인 1 — 편집이 없으면 배포판 시각 그대로 */
{
  let 어긋남=0, 비교=0;
  D.forEach(function(d,di){
    const m=하루재료(d);
    const r=API.recalc(m.stops,{start:m.start,stay:m.stay,ride:m.ride,pin:m.pin});
    m.stops.forEach(function(s,i){ 비교++;
      if(r.arrive[i]!==s.t){ 어긋남++;
        console.log('  ✗ '+(di+1)+'일차 '+s.n+' 배포판 '+s.t+' 계산 '+r.arrive[i]); } });
  });
  확인('확인1 · 편집이 없으면 정차지 전부 배포판 시각 그대로', [어긋남], [0]);
}
/* 확인 2 — 첫 시각을 30분 늦추면 그날 전부 30분 밀린다 */
{
  let 어긋남=0, 비교=0;
  D.forEach(function(d,di){
    const m=하루재료(d);
    const 기준=API.recalc(m.stops,{start:m.start,stay:m.stay,ride:m.ride,pin:m.pin});
    const 늦춤=API.recalc(m.stops,{start:m.start,stay:m.stay,ride:m.ride,
      pin:{0:API.min2hm(API.hm2min(m.stops[0].t)+30)}});
    m.stops.forEach(function(s,i){ 비교++;
      const 차=늦춤.arriveMin[i]-기준.arriveMin[i];
      if(차!==30){ 어긋남++;
        console.log('  ✗ '+(di+1)+'일차 '+s.n+' 차이 '+차+'분 (기대 30)'); } });
  });
  확인('확인2 · 첫 시각 30분 늦추면 정차지 전부 30분 밀림', [어긋남], [0]);
}
/* 확인 3 — 가운데 한 곳에 30분 더 머물면 그 뒤만 밀린다.
   고친 곳 자신의 도착은 그대로다 — stay 는 그 곳의 출발부터 영향을 준다. */
{
  const m=하루재료(D[1]);
  const k=Math.floor(m.stops.length/2);
  const 기준=API.recalc(m.stops,{start:m.start,stay:m.stay,ride:m.ride,pin:m.pin});
  const 늘린stay=m.stay.slice(); 늘린stay[k]+=30;
  const 늘림=API.recalc(m.stops,{start:m.start,stay:늘린stay,ride:m.ride,pin:m.pin});
  let 어긋남=0;
  m.stops.forEach(function(s,i){
    const 차=늘림.arriveMin[i]-기준.arriveMin[i], 기대=(i<=k?0:30);
    if(차!==기대){ 어긋남++;
      console.log('  ✗ 2일차 '+s.n+' 차이 '+차+'분 (기대 '+기대+')'); } });
  /* 정차지 개수를 박아 두면 일정이 바뀔 때마다 깨진다 —
     루프가 헛돌지 않았는지만 보면 되므로 개수는 자료에서 읽는다 */
  확인('확인3 · 2일차 「'+m.stops[k].n+'」 에 30분 더 머물면 그 앞 0분·그 뒤 30분',
       [m.stops.length>0, 어긋남], [true,0]);
}

console.log('\n[경고 — 식사 타이밍]');
확인('아침 08:00 은 이상 없음', API.mealWarn('아침 · 국밥','07:10','08:00'), null);
확인('점심 12:40 은 이상 없음', API.mealWarn('점심 · 갈치조림','12:40','12:40'), null);
확인('저녁 18:40 은 이상 없음', API.mealWarn('저녁 · 흑돼지','18:40','18:40'), null);
확인('점심이 15:20 이면 늦다',
  API.mealWarn('점심 · 복탕','12:15','15:20'), '점심이 오후 3시 20분입니다. 너무 늦습니다.');
확인('아침이 05:30 이면 이르다',
  API.mealWarn('아침 · 국밥','07:10','05:30'), '아침이 오전 5시 30분입니다. 너무 이릅니다.');
확인('저녁이 21:10 이면 늦다',
  API.mealWarn('저녁 · 흑돼지','18:40','21:10'), '저녁이 오후 9시 10분입니다. 너무 늦습니다.');
확인('끼니는 이름으로 정한다 — 점심을 16시로 밀어도 저녁이 아니다',
  API.mealWarn('점심 · 복탕','12:15','16:00'), '점심이 오후 4시입니다. 너무 늦습니다.');
확인('시각을 못 읽으면 경고 없음', API.mealWarn('점심 · 복탕','12:15',''), null);
/* 끼니 경계(11:00/15:00)와 창의 경계가 어긋나 생기던 사각지대.
   배포판 그대로인데 경고가 뜨면 아무도 경고를 안 본다. */
확인('배포판 09:40 휴게소는 조용하다',
  API.mealWarn('휴게소 · 점심거리 구입','09:40','09:40'), null);
확인('배포판 11:20 점심은 조용하다',
  API.mealWarn('점심 · 진도 복탕·백반','11:20','11:20'), null);
확인('그래도 크게 밀면 잡는다',
  API.mealWarn('점심 · 진도 복탕·백반','11:20','16:00'), '점심이 오후 4시입니다. 너무 늦습니다.');
확인('이름에 끼니말이 없으면 배포판 시각에 가장 가까운 창으로',
  API.mealWarn('펜션 조식','09:00','09:00'), null);
/* 장소를 바꾸거나 제목을 고쳐 끼니말이 사라져도 판정에서 빠지면 안 된다 */
확인('이름을 잃어도 여전히 잡는다',
  API.mealWarn('복탕집','11:20','16:00'), '점심이 오후 4시입니다. 너무 늦습니다.');

console.log('\n[경고 — 운영시간과 휴무일]');
확인('운영시간 읽기', API.openHours('09:00 ~ 18:00 (매표 마감 17:20)'), {open:540,close:1080});
확인('물결 없는 형식도', API.openHours('10:00-16:00'), {open:600,close:960});
확인('괄호 안 시각도 잡는다', API.openHours('외부 상시 개방 · 내부 관람은 일정에 따라 제한 (보통 10:00~16:00)'),
  {open:600,close:960});
확인('상시 개방은 시각 없음', API.openHours('상시 개방'), null);
확인('휴무 요일 읽기', API.offDay('매주 화요일'), '화');
확인('연중무휴는 없음', API.offDay('연중무휴 (폭우 시 안전상 통제)'), null);
확인('매월 첫째는 안 잡는다', API.offDay('매월 첫째 월요일 (정상 탐방로만 휴무)'), null);
확인('여러 요일 중 첫째만', API.offDay('매주 월요일, 신정, 설날, 추석'), '월');

const 유민={n:'유민미술관',open:'09:00 ~ 18:00 (매표 마감 17:20)',off:'매주 화요일'};
const 일출봉={n:'성산일출봉',open:'07:30 ~ 19:00',off:'연중무휴'};
확인('화요일 유민미술관은 휴무 경고',
  API.spotWarn(유민,'화','14:00'), '이날은 화요일입니다. 유민미술관은 매주 화요일 휴무입니다.');
확인('수요일이면 이상 없음', API.spotWarn(유민,'수','14:00'), null);
확인('닫은 뒤 도착',
  API.spotWarn(일출봉,'화','19:40'), '도착이 오후 7시 40분인데 성산일출봉은 오후 7시에 문을 닫습니다.');
확인('열기 전 도착',
  API.spotWarn(일출봉,'화','06:00'), '도착이 오전 6시인데 성산일출봉은 오전 7시 30분에 엽니다.');
확인('영업 중이면 이상 없음', API.spotWarn(일출봉,'화','10:55'), null);
확인('자료가 없으면 경고 없음', API.spotWarn(null,'화','10:00'), null);

console.log('\n[지금 일정에 대 보기]');
{
  /* index.html 의 D 와 SPOT 을 맞대 실제로 걸리는 곳을 센다 */
  const SPOT=grab('SPOT');
  const by={}; SPOT.forEach(function(s){ by[s.n]=s; });
  const 걸린것=[];
  D.forEach(function(d,i){ d.stops.forEach(function(s){
    const w=API.spotWarn(by[s.n], d.dw.split(' ')[0], s.t);
    if(w) 걸린것.push((i+1)+'일차 '+w);
  }); });
  걸린것.forEach(function(x){ console.log('  ※ '+x); });
  /* 2026-08-28 까지는 1건이었다 — 2일차(화) 유민미술관이 매주 화요일 휴무였다.
     동부를 수요일로 옮겨(2·3일차 맞바꿈) 그 문제를 없앴으므로 이제 0 이어야 한다.
     일정을 손대다 다시 휴무일에 걸리면 여기서 잡힌다. */
  확인('지금 일정에서 휴무일에 걸리는 곳이 없다', 걸린것.length, 0);
}

console.log('\n[경고 — 못 박은 시각]');
확인('제때 도착하면 이상 없음', API.fixWarn('진도항 도착','11:05','11:05'), null);
확인('일찍 도착해도 이상 없음', API.fixWarn('진도항 도착','11:05','10:40'), null);
확인('늦으면 경고', API.fixWarn('진도항 도착','11:05','11:20'),
  '진도항 도착이 오전 11시 20분으로 계산됩니다. 오전 11시 5분까지 도착해야 합니다.');
확인('시각을 못 읽으면 경고 없음', API.fixWarn('진도항 도착','','11:20'), null);

console.log('\n[저장 지문]');
{
  const A=[{stops:[{n:'가',t:'09:00'},{n:'나',t:'10:00'}]}];
  const B=[{stops:[{n:'가',t:'09:00'},{n:'나',t:'10:00'}]}];
  const C=[{stops:[{n:'가',t:'09:00'},{n:'다',t:'10:00'}]}];
  확인('같은 일정은 같은 지문', API.planFingerprint(A), API.planFingerprint(B));
  확인('이름이 바뀌면 다른 지문', API.planFingerprint(A)!==API.planFingerprint(C), true);
  확인('지문은 문자열', typeof API.planFingerprint(A), 'string');
}

console.log('\n[길찾기 좌표 고르기]');
const 여행지시험 = [
  { n: '성산일출봉', ll: [33.4581,126.9425], pk: [33.459135,126.940538] },
  { n: '형제해안도로', ll: [33.2100,126.2600] },
];
확인('주차장이 있으면 주차장', API.rideLL({ n:'성산일출봉', ll:[33.4581,126.9425] }, 여행지시험)[0], 33.459135);
확인('주차장이 없으면 제자리', API.rideLL({ n:'형제해안도로', ll:[33.21,126.26] }, 여행지시험)[0], 33.21);
확인('목록에 없는 이름도 제자리', API.rideLL({ n:'휴게소', ll:[33.3,126.5] }, 여행지시험)[1], 126.5);
확인('정차지가 pk 를 직접 들면 그것', API.rideLL({ n:'아무개', ll:[33.1,126.1], pk:[33.2,126.2] }, 여행지시험)[0], 33.2);
확인('좌표가 없으면 null', API.rideLL({ n:'체크아웃' }, 여행지시험), null);
확인('정차지가 없으면 null', API.rideLL(null, 여행지시험), null);

console.log('\n[REST 키 보관]');
확인('저장소가 없으면 빈 문자열', API.naviKey(), '');
확인('저장소가 없어도 저장이 터지지 않는다', API.naviKey('abc'), '');

console.log(`\n통과 ${통과} · 실패 ${실패}`);
process.exitCode = 실패 ? 1 : 0;
