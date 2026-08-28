# 일정 편집기 1단계 — 구현 계획

> ## ✅ 끝났다 (2026-08-28)
>
> 16개 작업을 모두 마쳤다. 아래 체크박스는 실행 당시의 것이고 지금은 기록으로 둔다.
> **다시 손볼 때는 이 계획이 아니라 `HANDOVER.md` §13 과 설계 문서를 먼저 본다.**
>
> 확인한 것 — 계산 시험 `node tools/editor-test.js` 74건 통과,
> 편집 점검 `tools/editor-check.js` 일곱 항목 전부 기대값, 회귀 점검 전 항목 통과, 오류 0.
> 카카오 길찾기로 갈아탄 뒤에도 그대로 통과한다.
>
> **아직 안 한 것** — 2단계(장소 바꾸기 · 순서 바꾸기 · 넣기와 빼기). 설계 문서 §8.

> **작업자에게:** 이 계획은 `subagent-driven-development` 또는 `executing-plans` 스킬로
> 작업 단위로 실행한다. 각 단계는 체크박스(`- [ ]`)로 추적한다.

**목표:** 일정의 시각과 머무는 시간을 앱 안에서 고치면 이동시간이 자동 계산되어 뒤 일정이
따라 움직이고, 무리한 곳에 경고가 붙는다.

**설계 문서:** [2026-08-28-schedule-editor-design.md](../specs/2026-08-28-schedule-editor-design.md)

**구조:** 계산 로직을 `index.html` 안의 한 블록에 순수 함수로 모아 node 에서 단위 시험하고,
그 위에 편집 화면을 얹는다. 앱은 단일 파일이 전제이므로 코드를 밖으로 빼지 않는다.

**쓰는 것:** 순수 자바스크립트 · Leaflet(이미 내장) · OSRM(이미 연결됨) · localStorage

---

## 파일

| 파일 | 무엇 | 왜 |
|---|---|---|
| `index.html` 수정 | 계산 블록 + 편집 화면 | 단일 파일 전제(HANDOVER §2) |
| `tools/editor-test.js` 새로 | 계산 함수 단위 시험 (node 로 실행) | 브라우저 없이 빠르게 돌린다 |
| `tools/editor-check.js` 새로 | 편집 화면 점검 (브라우저 콘솔) | `regression-check.js` 와 같은 방식 |
| `tools/regression-check.js` | 안 고침 | 보기 화면이 안 깨졌는지 확인용 |

`index.html` 안에서 계산 코드는 **앵커 주석으로 감싼다.** `editor-test.js` 가 이 앵커로
코드를 꺼내 node 에서 실행한다.

```
/* ══════ 일정 계산 ══════ */
   ... 순수 함수들 ...
/* ══════ 일정 계산 끝 ══════ */
```

**이 블록 안에는 DOM 을 만지는 코드를 넣지 않는다.** 넣는 순간 node 시험이 죽는다.

---

## 사전 확인 (모든 작업 전에 한 번)

- [ ] **로컬 서버를 띄운다**

```bash
node tools/serve.js
```

- [ ] **현재 상태가 깨끗한지 확인한다**

```bash
git status --short
```

기대: 아무것도 안 나옴

---

## Task 1: 시험 발판과 시간 유틸

**파일:**
- 수정: `index.html` (`const telHref=` 줄 바로 앞에 계산 블록을 새로 만든다)
- 새로: `tools/editor-test.js`

- [ ] **1단계: 시험 발판과 실패하는 시험을 쓴다**

`tools/editor-test.js` 를 만든다. (Write 도구로 만들 것 — heredoc 은 역슬래시를 먹는다, HANDOVER §4.4)

```js
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
```

- [ ] **2단계: 시험을 돌려 실패를 확인한다**

```bash
node tools/editor-test.js
```

기대: `계산 블록을 못 찾음 — 앵커 주석을 확인할 것` 로 종료

- [ ] **3단계: 계산 블록과 시간 유틸을 넣는다**

`index.html` 에서 `const telHref=t=>'tel:'` 로 시작하는 줄을 찾아 **그 앞에** 넣는다.
앵커 매칭 node 스크립트를 쓴다(HANDOVER §4.3).

넣을 내용:

```js
/* ══════ 일정 계산 ══════
   일정 편집기가 쓰는 순수 함수들. DOM 을 만지지 않는다 —
   tools/editor-test.js 가 이 블록만 꺼내 node 에서 시험하기 때문이다. */
/* 'HH:MM' → 분. 읽을 수 없으면 null */
function hm2min(v){
  const m=/^(\d{1,2}):([0-5]\d)$/.exec(String(v||'').trim());
  return m ? (+m[1])*60 + (+m[2]) : null;
}
/* 분 → 'HH:MM'. 자정을 넘기면 24:05 처럼 이어서 센다 */
function min2hm(v){
  const n=Math.max(0,Math.round(v));
  return String(Math.floor(n/60)).padStart(2,'0')+':'+String(n%60).padStart(2,'0');
}
/* ══════ 일정 계산 끝 ══════ */
```

- [ ] **4단계: 시험이 통과하는지 확인한다**

```bash
node tools/editor-test.js
```

기대: `통과 8 · 실패 0`

- [ ] **5단계: 문법 검사**

```bash
node -e "const h=require('fs').readFileSync('index.html','utf8');(h.match(/<script>([\s\S]*?)<\/script>/g)||[]).forEach((b,i)=>{const c=b.replace(/^<script>/,'').replace(/<\/script>$/,'');try{new Function(c);console.log(i+': OK');}catch(e){console.log(i+': '+e.message);process.exitCode=1;}});"
```

기대: `0: OK` `1: OK`

- [ ] **6단계: 커밋**

```bash
git add index.html tools/editor-test.js
git commit -m "일정 계산 블록과 시간 유틸을 넣음"
```

---

## Task 2: 이동시간 추정 (오프라인 폴백)

경로 서버가 막혔을 때 쓸 추정값. 순수 함수라 먼저 만든다.

**파일:**
- 수정: `index.html` (계산 블록 안)
- 수정: `tools/editor-test.js`

- [ ] **1단계: 실패하는 시험을 쓴다**

`tools/editor-test.js` 의 `__out` 줄에 이름을 더한다.

```js
  new Function('__out', code + '\n__out.hm2min=hm2min; __out.min2hm=min2hm;' +
    ' __out.km=km; __out.guessMin=guessMin;')(API);
```

파일 끝의 `console.log(\`\n통과 …\`)` 앞에 붙인다.

```js
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
```

- [ ] **2단계: 시험을 돌려 실패를 확인한다**

```bash
node tools/editor-test.js
```

기대: `계산 블록 실행 실패: km is not defined`

- [ ] **3단계: 구현을 넣는다**

계산 블록의 `/* ══════ 일정 계산 끝 ══════ */` **앞에** 넣는다.

```js
/* 두 좌표 사이 직선거리(km) */
function km(a,b){
  if(!a||!b) return null;
  const R=6371, r=Math.PI/180;
  const s=Math.sin((b[0]-a[0])*r/2)**2
        + Math.cos(a[0]*r)*Math.cos(b[0]*r)*Math.sin((b[1]-a[1])*r/2)**2;
  return 2*R*Math.asin(Math.sqrt(s));
}
/* 경로 서버가 막혔을 때 쓰는 이동시간 추정(분).
   직선거리에 우회율 1.25 를 얹고, 짧을수록 느린 실제 특성을 반영해
   속도를 25~50km/h 사이에서 거리에 따라 올린다.
   2026-08-28 제주 안 여섯 구간 실측 기준으로 맞췄다. */
function guessMin(a,b){
  const d=km(a,b);
  if(d===null) return null;
  if(d<0.05) return 0;
  const 도로=d*1.25;
  const 속도=Math.min(50, 25+도로*1.1);
  return Math.round(도로/속도*60);
}
```

- [ ] **4단계: 시험이 통과하는지 확인한다**

```bash
node tools/editor-test.js
```

기대: 모든 줄이 통과. 실패하면 `guessMin` 의 우회율·속도 계수를 조정하고 다시 돌린다.
**시험을 느슨하게 고치지 말고 계수를 고칠 것.**

- [ ] **5단계: 커밋**

```bash
git add index.html tools/editor-test.js
git commit -m "이동시간 추정 함수를 넣음"
```

---

## Task 3: 머무는 시간 자동 채우기

배포판 시각에서 이동시간을 빼 `stay` 를 만든다. 이게 맞아야 편집기를 처음 열었을 때
계산 결과가 지금 일정과 같아진다(설계 §9 확인 기준 1).

**파일:**
- 수정: `index.html` (계산 블록 안)
- 수정: `tools/editor-test.js`

- [ ] **1단계: 실패하는 시험을 쓴다**

`__out` 줄에 `__out.fillStay=fillStay;` 를 더하고, 파일 끝에 붙인다.

```js
console.log('\n[머무는 시간 자동 채우기]');
/* 좌표가 있는 두 곳: 시각 차이에서 이동시간을 뺀 것이 stay */
{
  const stops=[
    {t:'10:00',n:'가',ll:[33.4581,126.9425]},
    {t:'11:30',n:'나',ll:[33.4242,126.9311]},
    {t:'13:00',n:'다',ll:[33.4242,126.9311]},
  ];
  const 이동=()=>11;                       /* 가→나 11분으로 고정 */
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
```

- [ ] **2단계: 시험을 돌려 실패를 확인한다**

```bash
node tools/editor-test.js
```

기대: `계산 블록 실행 실패: fillStay is not defined`

- [ ] **3단계: 구현을 넣는다**

계산 블록 끝 앵커 앞에 넣는다.

```js
/* 배포판 시각에서 머무는 시간을 역산한다.
   지금 자료에는 시각만 있어서, 편집기를 처음 열었을 때 계산 결과가
   지금 일정과 똑같이 나오게 하려면 이 값이 필요하다.
   ride(i) 는 i 번째에서 i+1 번째로 가는 이동시간(분) 또는 null. */
function fillStay(stops,ride){
  const STAY_기본=60;
  return stops.map(function(s,i){
    const 이곳=hm2min(s.t), 다음=i+1<stops.length ? hm2min(stops[i+1].t) : null;
    if(이곳===null||다음===null) return STAY_기본;
    const 이동=ride(i)||0;
    return Math.max(0, 다음-이곳-이동);
  });
}
```

- [ ] **4단계: 시험이 통과하는지 확인한다**

```bash
node tools/editor-test.js
```

기대: 전부 통과

- [ ] **5단계: 커밋**

```bash
git add index.html tools/editor-test.js
git commit -m "머무는 시간을 배포판 시각에서 역산하는 함수를 넣음"
```

---

## Task 4: 재계산 엔진

**파일:**
- 수정: `index.html` (계산 블록 안)
- 수정: `tools/editor-test.js`

- [ ] **1단계: 실패하는 시험을 쓴다**

`__out` 줄에 `__out.recalc=recalc;` 를 더하고 붙인다.

```js
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
```

- [ ] **2단계: 시험을 돌려 실패를 확인한다**

```bash
node tools/editor-test.js
```

기대: `계산 블록 실행 실패: recalc is not defined`

- [ ] **3단계: 구현을 넣는다**

```js
/* 하루 일정을 순서대로 쌓아 시각을 계산한다.
   opt.start  하루 첫 도착 시각 'HH:MM'
   opt.stay[] 각 정차지에 머무는 분
   opt.ride[] i → i+1 이동시간(분). null 이면 0 으로 본다
   opt.pin{}  {순번: 'HH:MM'} 사용자가 못 박은 시각. 거기서부터 다시 쌓는다 */
function recalc(stops,opt){
  const stay=opt.stay||[], ride=opt.ride||[], pin=opt.pin||{};
  const arrive=[], depart=[];
  let 시각=hm2min(opt.start);
  if(시각===null) 시각=0;
  for(let i=0;i<stops.length;i++){
    if(i>0) 시각=depart[i-1]+(ride[i-1]||0);
    const 못박음=hm2min(pin[i]);
    if(못박음!==null) 시각=못박음;
    arrive[i]=시각;
    depart[i]=시각+(stay[i]||0);
  }
  return { arrive:arrive.map(min2hm), depart:depart.map(min2hm),
           arriveMin:arrive, departMin:depart };
}
```

- [ ] **4단계: 시험이 통과하는지 확인한다**

```bash
node tools/editor-test.js
```

기대: 전부 통과

- [ ] **5단계: 커밋**

```bash
git add index.html tools/editor-test.js
git commit -m "일정 시각을 순서대로 쌓는 재계산 함수를 넣음"
```

---

## Task 5: 경고 — 식사 타이밍

**파일:**
- 수정: `index.html` (계산 블록 안)
- 수정: `tools/editor-test.js`

- [ ] **1단계: 실패하는 시험을 쓴다**

`__out` 줄에 `__out.mealWarn=mealWarn;` 를 더하고 붙인다.

```js
console.log('\n[경고 — 식사 타이밍]');
확인('아침 08:00 은 이상 없음', API.mealWarn('07:10','08:00'), null);
확인('점심 12:40 은 이상 없음', API.mealWarn('12:40','12:40'), null);
확인('저녁 18:40 은 이상 없음', API.mealWarn('18:40','18:40'), null);
확인('점심이 15:20 이면 늦다',
  API.mealWarn('12:15','15:20'), '점심이 오후 3시 20분입니다. 너무 늦습니다.');
확인('아침이 05:30 이면 이르다',
  API.mealWarn('07:10','05:30'), '아침이 오전 5시 30분입니다. 너무 이릅니다.');
확인('저녁이 21:10 이면 늦다',
  API.mealWarn('18:40','21:10'), '저녁이 오후 9시 10분입니다. 너무 늦습니다.');
확인('끼니는 원래 시각으로 정한다 — 점심을 16시로 밀어도 저녁이 아니다',
  API.mealWarn('12:15','16:00'), '점심이 오후 4시입니다. 너무 늦습니다.');
확인('시각을 못 읽으면 경고 없음', API.mealWarn('12:15',''), null);
```

- [ ] **2단계: 시험을 돌려 실패를 확인한다**

```bash
node tools/editor-test.js
```

기대: `계산 블록 실행 실패: mealWarn is not defined`

- [ ] **3단계: 구현을 넣는다**

```js
/* 오전/오후 한국어 표기 — 경고 문구에 쓴다 */
function hmKo(v){
  const n=hm2min(v); if(n===null) return String(v);
  const h=Math.floor(n/60)%24, m=n%60;
  const 라벨=h<12?'오전':'오후';
  let hh=h%12; if(hh===0) hh=12;
  return 라벨+' '+hh+'시'+(m?' '+m+'분':'');
}
/* 식사 시각이 알맞은 때인가.
   어느 끼니인지는 배포판에 적힌 원래 시각으로 정하고 편집 중에 바뀌지 않는다 —
   점심을 16시로 밀었을 때 "저녁이 이르다" 로 뒤집히면 안 되기 때문이다. */
var MEAL_창={아침:[390,570],점심:[690,840],저녁:[1050,1200]};
function mealWarn(원래,지금){
  const o=hm2min(원래), n=hm2min(지금);
  if(o===null||n===null) return null;
  const 끼니 = o<660 ? '아침' : (o<900 ? '점심' : '저녁');
  const [이른,늦은]=MEAL_창[끼니];
  if(n<이른) return 끼니+'이 '+hmKo(지금)+'입니다. 너무 이릅니다.';
  if(n>늦은) return 끼니+'이 '+hmKo(지금)+'입니다. 너무 늦습니다.';
  return null;
}
```

- [ ] **4단계: 시험이 통과하는지 확인한다**

```bash
node tools/editor-test.js
```

기대: 전부 통과

- [ ] **5단계: 커밋**

```bash
git add index.html tools/editor-test.js
git commit -m "식사 타이밍 경고를 넣음"
```

---

## Task 6: 경고 — 운영시간과 휴무일

**파일:**
- 수정: `index.html` (계산 블록 안)
- 수정: `tools/editor-test.js`

- [ ] **1단계: 실패하는 시험을 쓴다**

`__out` 줄에 `__out.openHours=openHours; __out.offDay=offDay; __out.spotWarn=spotWarn;` 를 더하고 붙인다.

```js
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
```

- [ ] **2단계: 시험을 돌려 실패를 확인한다**

```bash
node tools/editor-test.js
```

기대: `계산 블록 실행 실패: openHours is not defined`

- [ ] **3단계: 구현을 넣는다**

```js
/* 운영시간 문구에서 여는·닫는 시각을 뽑는다. 못 읽으면 null —
   '상시 개방' 처럼 시각이 없는 곳에 억지 경고를 붙이지 않기 위해서다.
   48곳 중 26곳이 읽힌다(2026-08-28 실측). */
function openHours(v){
  const m=/(\d{1,2}):(\d{2})\s*[~\-]\s*(\d{1,2}):(\d{2})/.exec(String(v||''));
  if(!m) return null;
  return { open:(+m[1])*60+(+m[2]), close:(+m[3])*60+(+m[4]) };
}
/* 휴무 문구에서 매주 쉬는 요일을 뽑는다.
   '매월 첫째 월요일' '기상 악화 시 통제' 처럼 요일 하나로 정리되지 않는 것은 잡지 않는다. */
function offDay(v){
  const m=/매주\s*([월화수목금토일])요일/.exec(String(v||''));
  return m ? m[1] : null;
}
/* 여행지 한 곳에 대한 경고. spot 은 SPOT 배열의 항목, 요일은 '화', 시각은 'HH:MM' */
function spotWarn(spot,요일,시각){
  if(!spot) return null;
  const 쉬는날=offDay(spot.off);
  if(쉬는날&&쉬는날===요일)
    return '이날은 '+요일+'요일입니다. '+spot.n+'은(는) 매주 '+쉬는날+'요일 휴무입니다.';
  const 시=openHours(spot.open), n=hm2min(시각);
  if(!시||n===null) return null;
  if(n>시.close) return '도착이 '+hmKo(시각)+'인데 '+spot.n+'은(는) '+hmKo(min2hm(시.close))+'에 문을 닫습니다.';
  if(n<시.open)  return '도착이 '+hmKo(시각)+'인데 '+spot.n+'은(는) '+hmKo(min2hm(시.open))+'에 엽니다.';
  return null;
}
```

- [ ] **4단계: 시험이 통과하는지 확인한다**

```bash
node tools/editor-test.js
```

기대: 전부 통과

- [ ] **5단계: 지금 일정에 대 보고 유민미술관이 걸리는지 확인한다**

`tools/editor-test.js` 끝에 붙인다.

```js
console.log('\n[지금 일정에 대 보기]');
{
  /* index.html 의 D 와 SPOT 을 꺼내 실제로 걸리는 곳을 센다 */
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
  const D=grab('D'), SPOT=grab('SPOT');
  const by={}; SPOT.forEach(function(s){ by[s.n]=s; });
  const 걸린것=[];
  D.forEach(function(d,i){ d.stops.forEach(function(s){
    const w=API.spotWarn(by[s.n], d.dw.split(' ')[0], s.t);
    if(w) 걸린것.push((i+1)+'일차 '+w);
  }); });
  걸린것.forEach(function(x){ console.log('  ※ '+x); });
  확인('지금 일정에서 걸리는 곳은 1건(유민미술관 화요일 휴무)', 걸린것.length, 1);
}
```

```bash
node tools/editor-test.js
```

기대: `※ 2일차 이날은 화요일입니다. 유민미술관은(는) 매주 화요일 휴무입니다.` 가 나오고 통과

- [ ] **6단계: 커밋**

```bash
git add index.html tools/editor-test.js
git commit -m "운영시간과 휴무일 경고를 넣음"
```

---

## Task 7: 경고 — 못 박은 시각(배 시간)

**파일:**
- 수정: `index.html` (계산 블록 안)
- 수정: `tools/editor-test.js`

- [ ] **1단계: 실패하는 시험을 쓴다**

`__out` 줄에 `__out.fixWarn=fixWarn;` 를 더하고 붙인다.

```js
console.log('\n[경고 — 못 박은 시각]');
확인('제때 도착하면 이상 없음', API.fixWarn('진도항 도착','11:05','11:05'), null);
확인('일찍 도착해도 이상 없음', API.fixWarn('진도항 도착','11:05','10:40'), null);
확인('늦으면 경고', API.fixWarn('진도항 도착','11:05','11:20'),
  '진도항 도착이 오전 11시 20분으로 계산됩니다. 오전 11시 5분까지 도착해야 합니다.');
확인('시각을 못 읽으면 경고 없음', API.fixWarn('진도항 도착','','11:20'), null);
```

- [ ] **2단계: 시험을 돌려 실패를 확인한다**

```bash
node tools/editor-test.js
```

기대: `계산 블록 실행 실패: fixWarn is not defined`

- [ ] **3단계: 구현을 넣는다**

```js
/* 못 박은 시각보다 늦게 도착하는가. 배 시간처럼 놓치면 안 되는 것에 쓴다 */
function fixWarn(이름,못박은,계산된){
  const a=hm2min(못박은), b=hm2min(계산된);
  if(a===null||b===null||b<=a) return null;
  return 이름+'이(가) '+hmKo(계산된)+'으로 계산됩니다. '+hmKo(못박은)+'까지 도착해야 합니다.';
}
```

- [ ] **4단계: 시험이 통과하는지 확인한다**

```bash
node tools/editor-test.js
```

기대: 전부 통과. `이(가)` 조사 때문에 기대 문구가 안 맞으면 **시험의 기대 문구를 실제
출력에 맞춰 고친다**(조사 처리는 이 기능의 본질이 아니다).

- [ ] **5단계: 커밋**

```bash
git add index.html tools/editor-test.js
git commit -m "못 박은 시각 경고를 넣음"
```

---

## Task 8: 이동시간 — 경로 서버와 캐시

여기서부터는 비동기라 node 시험이 어렵다. 브라우저에서 확인한다.

**파일:**
- 수정: `index.html` (계산 블록 **밖**, `drawRoute` 근처)

- [ ] **1단계: 구현을 넣는다**

`async function drawRoute(` 앞에 넣는다.

```js
/* 두 곳 사이 이동시간(분). 경로 서버의 실제 도로 소요시간을 쓰고,
   막히면 추정으로 넘어간다 — 계산이 멈추면 편집기를 못 쓰게 되기 때문이다.
   좌표쌍마다 캐시해 같은 구간을 두 번 묻지 않는다. */
const rideCache={};
function rideKey(a,b){ return a[0].toFixed(4)+','+a[1].toFixed(4)+'>'+b[0].toFixed(4)+','+b[1].toFixed(4); }
function rideNow(a,b){
  if(!a||!b) return null;
  const k=rideKey(a,b);
  return rideCache[k]!==undefined ? rideCache[k] : guessMin(a,b);
}
async function rideFetch(a,b){
  if(!a||!b) return null;
  const k=rideKey(a,b);
  if(rideCache[k]!==undefined) return rideCache[k];
  try{
    const url='https://router.project-osrm.org/route/v1/driving/'
      +a[1]+','+a[0]+';'+b[1]+','+b[0]+'?overview=false';
    const j=await (await fetch(url)).json();
    const r=j&&j.routes&&j.routes[0];
    if(r&&typeof r.duration==='number'){
      rideCache[k]=Math.round(r.duration/60);
      return rideCache[k];
    }
  }catch(e){}
  return guessMin(a,b);
}
```

- [ ] **2단계: 문법 검사**

```bash
node -e "const h=require('fs').readFileSync('index.html','utf8');(h.match(/<script>([\s\S]*?)<\/script>/g)||[]).forEach((b,i)=>{const c=b.replace(/^<script>/,'').replace(/<\/script>$/,'');try{new Function(c);console.log(i+': OK');}catch(e){console.log(i+': '+e.message);process.exitCode=1;}});"
```

기대: `0: OK` `1: OK`

- [ ] **3단계: 브라우저에서 확인한다**

`http://127.0.0.1:8765/` 를 375×667 로 열고 콘솔에 붙인다.

```js
(async () => {
  const 일출봉=[33.4581,126.9425], 천지연=[33.247,126.554];
  const 추정=guessMin(일출봉,천지연);
  const 실제=await rideFetch(일출봉,천지연);
  const 캐시=rideNow(일출봉,천지연);
  return JSON.stringify({추정, 실제, 캐시, 캐시가실제와같음: 캐시===실제}, null, 1);
})()
```

기대: `실제` 가 55 근처, `캐시가실제와같음` 이 `true`

- [ ] **4단계: 커밋**

```bash
git add index.html
git commit -m "경로 서버에서 이동시간을 받아 캐시하는 함수를 넣음"
```

---

## Task 9: 편집 상태 저장

**파일:**
- 수정: `index.html` (계산 블록 안 — 지문 만들기는 순수 함수)
- 수정: `index.html` (계산 블록 밖 — localStorage 읽고 쓰기)
- 수정: `tools/editor-test.js`

- [ ] **1단계: 실패하는 시험을 쓴다**

`__out` 줄에 `__out.planFingerprint=planFingerprint;` 를 더하고 붙인다.

```js
console.log('\n[저장 지문]');
{
  const A=[{stops:[{n:'가',t:'09:00'},{n:'나',t:'10:00'}]}];
  const B=[{stops:[{n:'가',t:'09:00'},{n:'나',t:'10:00'}]}];
  const C=[{stops:[{n:'가',t:'09:00'},{n:'다',t:'10:00'}]}];
  확인('같은 일정은 같은 지문', API.planFingerprint(A), API.planFingerprint(B));
  확인('이름이 바뀌면 다른 지문', API.planFingerprint(A)!==API.planFingerprint(C), true);
  확인('지문은 문자열', typeof API.planFingerprint(A), 'string');
}
```

- [ ] **2단계: 시험을 돌려 실패를 확인한다**

```bash
node tools/editor-test.js
```

기대: `계산 블록 실행 실패: planFingerprint is not defined`

- [ ] **3단계: 지문 함수를 계산 블록에 넣는다**

```js
/* 배포판 일정의 지문. 저장해 둔 편집이 어느 일정에 붙은 것인지 가리는 데 쓴다.
   배포판이 바뀌었는데 옛 편집이 남아 있으면 엉뚱한 곳에 붙는다. */
function planFingerprint(D){
  let s='';
  D.forEach(function(d){ d.stops.forEach(function(x){ s+=x.n+'|'+x.t+';'; }); });
  let hash=0;
  for(let i=0;i<s.length;i++){ hash=(hash*31+s.charCodeAt(i))|0; }
  return String(hash);
}
```

- [ ] **4단계: 시험이 통과하는지 확인한다**

```bash
node tools/editor-test.js
```

기대: 전부 통과

- [ ] **5단계: 저장·불러오기를 계산 블록 밖에 넣는다**

`drawRoute` 앞의 `rideCache` 근처에 넣는다. (localStorage 는 node 에 없으므로 계산 블록 밖이어야 한다)

```js
/* 편집 내용은 바뀐 값만 저장한다. 정차지 전체를 저장하면
   배포판 일정이 바뀌었을 때 옛 값이 통째로 되살아난다. */
const EDIT_KEY='jeju-trip-edit';
function editLoad(){
  try{
    const raw=localStorage.getItem(EDIT_KEY);
    if(!raw) return null;
    const o=JSON.parse(raw);
    if(o.fp!==planFingerprint(D)){ localStorage.removeItem(EDIT_KEY); return null; }
    return o.edit||null;
  }catch(e){ return null; }
}
function editSave(edit){
  try{ localStorage.setItem(EDIT_KEY,JSON.stringify({fp:planFingerprint(D),edit:edit})); }catch(e){}
}
function editClear(){ try{ localStorage.removeItem(EDIT_KEY); }catch(e){} }
```

- [ ] **6단계: 브라우저에서 확인한다**

```js
(() => {
  editSave({'0':{'1':{stay:90}}});
  const a=editLoad();
  editClear();
  const b=editLoad();
  return JSON.stringify({저장후:a, 지운뒤:b, 지문:planFingerprint(D)}, null, 1);
})()
```

기대: `저장후` 가 `{"0":{"1":{"stay":90}}}`, `지운뒤` 가 `null`

- [ ] **7단계: 커밋**

```bash
git add index.html tools/editor-test.js
git commit -m "편집 내용 저장과 일정 지문을 넣음"
```

---

## Task 10: `#` 진입과 편집 띠

**파일:**
- 수정: `index.html` (범례 HTML · CSS · 편집 상태)

- [ ] **1단계: 범례에 `#` 을 넣는다**

`<span class="lgtip">점을 누르면 아래에 정보가 나옵니다</span>` 뒤, `<span class="legbtns">` 앞에 넣는다.

```html
      <span class="lghash" id="editkey" title="일정 편집">#</span>
```

- [ ] **2단계: CSS 를 넣는다**

`.legend .lgtip{color:var(--faint);font-size:10.5px}` 뒤에 넣는다.

```css
.legend .lghash{color:var(--faint);cursor:pointer;padding:0 4px;user-select:none}
.legend .lghash:hover{color:var(--ink2)}
.editbar{
  display:flex;align-items:center;gap:8px;flex-wrap:wrap;
  padding:7px 12px;background:var(--seasoft);border-bottom:1px solid var(--line);
  font-size:12px;color:var(--sea)
}
.editbar[hidden]{display:none}
.editbar b{font-weight:600}
.editbar .sp{margin-left:auto;display:flex;gap:6px}
.editbar button{
  appearance:none;cursor:pointer;font-family:inherit;font-size:11.5px;
  padding:4px 9px;border-radius:6px;border:1px solid var(--line);
  background:#fff;color:var(--ink2)
}
```

- [ ] **3단계: 편집 띠 HTML 을 넣는다**

`<div class="infozone">` 바로 앞에 넣는다.

```html
<div class="editbar" id="editbar" hidden>
  <b>편집 중</b><span id="editday"></span>
  <span class="sp">
    <button type="button" id="editreset">원래대로</button>
    <button type="button" id="editcopy">코드 복사</button>
    <button type="button" id="editclose">닫기</button>
  </span>
</div>
```

- [ ] **4단계: 켜고 끄는 코드를 넣는다**

`initMap();` 앞에 넣는다.

```js
/* ══════ 일정 편집 ══════
   범례 줄의 # 로 들어간다. 가족이 받은 링크에는 편집할 이유가 없으므로
   화면에 크게 두지 않는다. 실수로 눌러도 '원래대로' 로 완전히 되돌아간다. */
let editOn=false;
function setEdit(on){
  editOn=!!on;
  const bar=document.getElementById('editbar');
  if(bar) bar.hidden=!editOn;
  document.body.classList.toggle('editing',editOn);
  render(curDay);
}
document.getElementById('editkey').addEventListener('click',function(){ setEdit(!editOn); });
document.getElementById('editclose').addEventListener('click',function(){ setEdit(false); });
document.getElementById('editreset').addEventListener('click',function(){
  editClear(); setEdit(false);
});
```

- [ ] **5단계: 문법 검사**

```bash
node -e "const h=require('fs').readFileSync('index.html','utf8');(h.match(/<script>([\s\S]*?)<\/script>/g)||[]).forEach((b,i)=>{const c=b.replace(/^<script>/,'').replace(/<\/script>$/,'');try{new Function(c);console.log(i+': OK');}catch(e){console.log(i+': '+e.message);process.exitCode=1;}});"
```

기대: `0: OK` `1: OK`

- [ ] **6단계: 브라우저에서 확인한다**

```js
(async () => {
  const w=ms=>new Promise(r=>setTimeout(r,ms));
  document.querySelector('.mtab[data-m="trip"]').click(); await w(1500);
  const key=document.getElementById('editkey');
  const 전=document.getElementById('editbar').hidden;
  key.click(); await w(800);
  const 후=document.getElementById('editbar').hidden;
  document.getElementById('editclose').click(); await w(600);
  const 닫은뒤=document.getElementById('editbar').hidden;
  const lg=document.getElementById('legend');
  const it=[...lg.querySelectorAll(':scope>span')].filter(x=>x.getClientRects().length);
  const rows=[...new Set(it.map(x=>Math.round(x.getBoundingClientRect().top+x.getBoundingClientRect().height/2)))];
  return JSON.stringify({처음숨김:전, 누른뒤보임:!후, 닫으면숨김:닫은뒤,
    범례한줄: Math.max(...rows)-Math.min(...rows)<6,
    범례높이: Math.round(lg.getBoundingClientRect().height)}, null, 1);
})()
```

기대: `처음숨김 true` · `누른뒤보임 true` · `닫으면숨김 true` · `범례한줄 true` · `범례높이` 29 근처

**범례가 두 줄이 되면** `#` 의 `padding` 을 줄이거나 `.lgtip` 을 320px 에서 숨기는 규칙을 더한다.

- [ ] **7단계: 커밋**

```bash
git add index.html
git commit -m "범례의 # 으로 들어가는 편집 띠를 넣음"
```

---

## Task 11: 편집 카드 — 시각·머무는 시간·못 박기

**파일:**
- 수정: `index.html` (`render()` 안의 정차지 카드 · 편집 상태 관리)

- [ ] **1단계: 편집 상태와 계산을 잇는 코드를 넣는다**

Task 10 에서 만든 `/* ══════ 일정 편집 ══════` 블록 안, `setEdit` 앞에 넣는다.

```js
/* 편집 내용 — {일차:{순번:{t,stay,fix}}} 꼴로 바뀐 값만 담는다 */
let editData=null;
function editGet(){ if(editData===null) editData=editLoad()||{}; return editData; }
function editOf(day,idx){ const e=editGet(); return (e[day]&&e[day][idx])||{}; }
function editSet(day,idx,key,val){
  const e=editGet();
  if(!e[day]) e[day]={};
  if(!e[day][idx]) e[day][idx]={};
  e[day][idx][key]=val;
  editSave(e);
}
/* 하루치 계산 결과를 낸다. 이동시간은 캐시에 있으면 실제값, 없으면 추정값을 쓴다 */
function dayPlan(day){
  const stops=D[day].stops;
  const rides=[];
  for(let i=0;i<stops.length-1;i++) rides.push(rideNow(stops[i].ll,stops[i+1].ll));
  const stay=fillStay(stops,function(i){ return rides[i]; }).map(function(v,i){
    const e=editOf(day,i); return e.stay!==undefined ? e.stay : v;
  });
  const pin={};
  stops.forEach(function(s,i){
    const e=editOf(day,i);
    if(e.t) pin[i]=e.t;
    else if(i===0) pin[0]=s.t;
  });
  const r=recalc(stops,{start:stops[0].t,stay:stay,ride:rides,pin:pin});
  r.stay=stay; r.rides=rides;
  return r;
}
/* 하루 경고를 모은다 */
function dayWarns(day){
  const stops=D[day].stops, p=dayPlan(day), 요일=D[day].dw.split(' ')[0];
  const by={}; SPOT.forEach(function(s){ by[s.n]=s; });
  return stops.map(function(s,i){
    const 지금=p.arrive[i], out=[];
    if(s.ty==='meal'){ const w=mealWarn(s.t,지금); if(w) out.push(w); }
    const sw=spotWarn(by[s.n],요일,지금); if(sw) out.push(sw);
    const e=editOf(day,i);
    if(e.fix||s.ty==='ship'){ const fw=fixWarn(s.n,e.t||s.t,지금); if(fw) out.push(fw); }
    return out;
  });
}
```

- [ ] **2단계: 정차지 카드에 편집 칸을 붙인다**

> ⚠️ **`render()` 의 `k` 는 전체 정차지 번호가 아니다.** `const k=s.ll?mi++:-1` 로,
> **좌표가 있는 것만 세는 지도 핀 번호**이고 좌표가 없으면 `-1` 이다. 52곳 중 22곳이
> 좌표가 없다. 편집은 좌표 없는 정차지(휴게소·체크아웃)도 다뤄야 하므로
> **전체 인덱스를 따로 받아야 한다.** `data-k` 는 핀 번호 그대로 두고 건드리지 않는다.

먼저 `map` 이 전체 인덱스를 받게 한다. 아래를 찾아

```js
  tl.innerHTML=d.stops.map(s=>{
```

이렇게 바꾼다.

```js
  tl.innerHTML=d.stops.map((s,si)=>{
```

그리고 같은 곳의 `${has?detail(s):''}` 앞에 편집 블록을 끼운다. 편집 중일 때만 나온다.

```js
${editOn?editRow(i,si,s):''}
```

그리고 `render()` 함수 앞에 `editRow` 를 넣는다.

```js
/* 편집 중일 때 카드 안에 붙는 줄. si 는 전체 정차지 인덱스(핀 번호가 아니다) */
function editRow(day,si,s){
  const e=editOf(day,si);
  const p=window.__plan||{};
  const 도착=(p.arrive&&p.arrive[si])||s.t;
  const 머뭄=(p.stay&&p.stay[si])!==undefined?p.stay[si]:60;
  const 경고=(window.__warn&&window.__warn[si])||[];
  const k=si;
  return '<div class="erow" data-si="'+si+'">'
    +'<label>도착 <input type="time" class="et" value="'+도착+'"></label>'
    +'<label>머무는 시간 <input type="number" class="es" min="0" step="5" value="'+머뭄+'">분</label>'
    +'<label class="ef"><input type="checkbox" class="ex"'+((e.fix||s.ty==='ship')?' checked':'')+'> 시각 고정</label>'
    +(경고.length?'<div class="ewarn">'+경고.map(function(w){return '※ '+w;}).join('<br>')+'</div>':'')
    +'</div>';
}
```

- [ ] **3단계: CSS 를 넣는다**

`.editbar button{…}` 뒤에 넣는다.

```css
.erow{
  display:flex;flex-wrap:wrap;gap:8px 12px;align-items:center;
  padding:8px 14px 10px;border-top:1px dashed var(--line);font-size:12px;color:var(--muted)
}
.erow label{display:inline-flex;align-items:center;gap:4px}
.erow input[type=time],.erow input[type=number]{
  font-family:inherit;font-size:12px;padding:3px 5px;
  border:1px solid var(--line);border-radius:5px;background:#fff;color:var(--ink2)
}
.erow input[type=number]{width:56px}
.erow .ewarn{
  flex:1 0 100%;margin-top:2px;padding:6px 8px;border-radius:6px;
  background:var(--ambersoft);color:#8A5A12;font-size:11.5px;line-height:1.5
}
.eride{
  padding:3px 14px;font-size:11px;color:var(--faint)
}
```

- [ ] **4단계: `render()` 가 계산 결과를 준비하게 한다**

`render()` 안에서 `tl.innerHTML=` 로 목록을 만들기 **직전에** 넣는다.

```js
  if(editOn){ window.__plan=dayPlan(i); window.__warn=dayWarns(i); }
```

- [ ] **5단계: 입력을 받아 다시 그린다**

`/* ══════ 일정 편집 ══════` 블록 끝에 넣는다.

```js
/* 편집 칸을 고치면 저장하고 그 날을 다시 그린다 */
document.getElementById('tl').addEventListener('change',function(e){
  if(!editOn) return;
  const row=e.target.closest('.erow'); if(!row) return;
  const si=+row.dataset.si;
  if(e.target.classList.contains('et')) editSet(curDay,si,'t',e.target.value);
  else if(e.target.classList.contains('es')) editSet(curDay,si,'stay',Math.max(0,+e.target.value||0));
  else if(e.target.classList.contains('ex')) editSet(curDay,si,'fix',e.target.checked);
  render(curDay);
});
```

- [ ] **6단계: 문법 검사**

```bash
node -e "const h=require('fs').readFileSync('index.html','utf8');(h.match(/<script>([\s\S]*?)<\/script>/g)||[]).forEach((b,i)=>{const c=b.replace(/^<script>/,'').replace(/<\/script>$/,'');try{new Function(c);console.log(i+': OK');}catch(e){console.log(i+': '+e.message);process.exitCode=1;}});"
```

기대: `0: OK` `1: OK`

- [ ] **7단계: 브라우저에서 확인한다 — 설계 §9 확인 기준 1·2·3**

```js
(async () => {
  const w=ms=>new Promise(r=>setTimeout(r,ms));
  document.querySelector('.mtab[data-m="trip"]').click(); await w(1500);
  document.querySelectorAll('#daytabs .dtab')[1].click(); await w(1200);
  if(document.getElementById('editbar').hidden) document.getElementById('editkey').click();
  await w(1000);
  const 원래=D[1].stops.map(s=>s.t);
  const 계산=dayPlan(1).arrive;
  const 같음=원래.every((t,i)=>t===계산[i]);
  return JSON.stringify({원래, 계산, 처음열었을때_지금일정과같은가:같음}, null, 1);
})()
```

기대: `처음열었을때_지금일정과같은가` 가 `true` (설계 §9 확인 기준 1)

**`false` 이면** `fillStay` 나 `dayPlan` 의 이동시간 처리가 틀린 것이다.
어느 정차지부터 어긋나는지 보고 그 구간의 `rideNow` 값을 확인한다.

- [ ] **8단계: 커밋**

```bash
git add index.html
git commit -m "편집 카드에 시각·머무는 시간·시각 고정을 넣음"
```

---

## Task 12: 하루 요약 배너 갱신

**파일:**
- 수정: `index.html` (`render()` 안 `dStats`)

- [ ] **1단계: 구현을 넣는다**

`document.getElementById('dStats').innerHTML=d.st.map(x=>` 를 찾아, 그 앞에 넣는다.

```js
  /* 편집 중에는 배너 시각도 계산 결과를 따라야 한다 — 배너와 목록이 다른 시간을 말하면 안 된다.
     날마다 가운데 항목이 거리이기도 하고 시각이기도 하므로,
     첫 값이 HH:MM 형식인 항목만 갱신한다. */
  let st=d.st;
  if(editOn&&window.__plan){
    const p=window.__plan, 마지막=p.arrive.length-1;
    st=d.st.map(function(x,n){
      if(hm2min(x[0])===null) return x;
      if(n===0) return [p.arrive[0],x[1]];
      if(n===d.st.length-1) return [p.arrive[마지막],x[1]];
      const j=d.stops.findIndex(function(s){ return s.n===x[1]||x[1].indexOf(s.n)>=0; });
      return j>=0 ? [p.arrive[j],x[1]] : x;
    });
  }
```

그리고 그 다음 줄의 `d.st.map(x=>` 를 `st.map(x=>` 로 바꾼다.

- [ ] **2단계: 문법 검사**

```bash
node -e "const h=require('fs').readFileSync('index.html','utf8');(h.match(/<script>([\s\S]*?)<\/script>/g)||[]).forEach((b,i)=>{const c=b.replace(/^<script>/,'').replace(/<\/script>$/,'');try{new Function(c);console.log(i+': OK');}catch(e){console.log(i+': '+e.message);process.exitCode=1;}});"
```

기대: `0: OK` `1: OK`

- [ ] **3단계: 브라우저에서 확인한다 — 설계 §9 확인 기준 2**

```js
(async () => {
  const w=ms=>new Promise(r=>setTimeout(r,ms));
  document.querySelector('.mtab[data-m="trip"]').click(); await w(1500);
  document.querySelectorAll('#daytabs .dtab')[1].click(); await w(1200);
  if(document.getElementById('editbar').hidden) document.getElementById('editkey').click();
  await w(1000);
  const 배너전=document.getElementById('dStats').textContent.replace(/\s+/g,' ').trim();
  /* 첫 정차지를 30분 늦춘다 */
  const t0=D[1].stops[0].t, [h0,m0]=t0.split(':').map(Number);
  const 늦춘=String(h0).padStart(2,'0')+':'+String((m0+30)%60).padStart(2,'0');
  editSet(1,0,'t',(m0+30)>=60?String(h0+1).padStart(2,'0')+':'+String((m0+30)-60).padStart(2,'0'):늦춘);
  render(1); await w(800);
  const p=dayPlan(1);
  const 배너후=document.getElementById('dStats').textContent.replace(/\s+/g,' ').trim();
  const 밀림=D[1].stops.map((s,i)=>hm2min(p.arrive[i])-hm2min(s.t));
  editClear(); editData=null; render(1);
  return JSON.stringify({배너전, 배너후, 전부30분밀렸나:밀림.every(x=>x===30), 밀림}, null, 1);
})()
```

기대: `전부30분밀렸나` 가 `true`, 배너 시각도 30분 뒤로 바뀜 (설계 §9 확인 기준 2)

- [ ] **4단계: 커밋**

```bash
git add index.html
git commit -m "편집 중에는 하루 요약 배너 시각도 함께 갱신"
```

---

## Task 13: 이동시간 칩과 실제 소요시간 받아오기

**파일:**
- 수정: `index.html`

- [ ] **1단계: 정차지 사이에 이동시간을 보여준다**

`editRow` 가 만드는 문자열 끝(`+'</div>'`) 뒤에 이어 붙인다.

```js
    +(function(){
       const r=(p.rides&&p.rides[k]);
       if(r===null||r===undefined) return '';
       const d=km(s.ll,(D[day].stops[k+1]||{}).ll);
       return '<div class="eride">↓ 이동 '+r+'분'+(d?' · '+d.toFixed(1)+'km':'')+'</div>';
     })()
```

- [ ] **2단계: 편집을 켤 때 실제 소요시간을 받아온다**

`setEdit` 안, `render(curDay);` 앞에 넣는다.

```js
  if(editOn) warmRides(curDay);
```

그리고 `setEdit` 앞에 넣는다.

```js
/* 그날 구간들의 실제 도로 소요시간을 받아 캐시를 채운다.
   받아오는 동안에는 추정값으로 계산되고, 다 받으면 한 번 다시 그린다. */
async function warmRides(day){
  const stops=D[day].stops;
  let 바뀜=false;
  for(let i=0;i<stops.length-1;i++){
    if(!stops[i].ll||!stops[i+1].ll) continue;
    const 전=rideNow(stops[i].ll,stops[i+1].ll);
    const 후=await rideFetch(stops[i].ll,stops[i+1].ll);
    if(전!==후) 바뀜=true;
  }
  if(바뀜&&editOn&&curDay===day) render(day);
}
```

- [ ] **3단계: 날짜를 바꿀 때도 받아오게 한다**

`tabs.addEventListener('click',` 안의 `render(+b.dataset.i);` 뒤에 넣는다.

```js
  if(editOn) warmRides(+b.dataset.i);
```

- [ ] **4단계: 문법 검사**

```bash
node -e "const h=require('fs').readFileSync('index.html','utf8');(h.match(/<script>([\s\S]*?)<\/script>/g)||[]).forEach((b,i)=>{const c=b.replace(/^<script>/,'').replace(/<\/script>$/,'');try{new Function(c);console.log(i+': OK');}catch(e){console.log(i+': '+e.message);process.exitCode=1;}});"
```

기대: `0: OK` `1: OK`

- [ ] **5단계: 브라우저에서 확인한다 — 설계 §9 확인 기준 4**

```js
(async () => {
  const w=ms=>new Promise(r=>setTimeout(r,ms));
  document.querySelector('.mtab[data-m="trip"]').click(); await w(1500);
  document.querySelectorAll('#daytabs .dtab')[1].click(); await w(1200);
  if(document.getElementById('editbar').hidden) document.getElementById('editkey').click();
  await w(4000);   /* 소요시간을 받아올 시간 */
  const 칩=[...document.querySelectorAll('.eride')].map(x=>x.textContent.trim());
  return JSON.stringify({칩개수:칩.length, 칩:칩.slice(0,5)}, null, 1);
})()
```

기대: 좌표가 있는 구간마다 `↓ 이동 N분 · N.Nkm` 이 나온다

- [ ] **6단계: 커밋**

```bash
git add index.html
git commit -m "정차지 사이에 이동시간을 보여주고 실제 소요시간을 받아옴"
```

---

## Task 14: 코드 복사

**파일:**
- 수정: `index.html`

- [ ] **1단계: 구현을 넣는다**

`document.getElementById('editreset')` 핸들러 뒤에 넣는다.

```js
/* 편집 결과를 D 배열에 붙일 수 있는 형태로 만들어 클립보드에 담는다.
   사람이 읽고 파일에 옮길 수 있어야 하므로 정차지 이름을 주석으로 붙인다. */
function editCode(){
  const e=editGet(), 줄=[];
  Object.keys(e).sort(function(a,b){return a-b;}).forEach(function(day){
    const p=dayPlan(+day);
    D[+day].stops.forEach(function(s,i){
      const c=e[day]&&e[day][i]; if(!c) return;
      const 조각=[];
      조각.push("t:'"+p.arrive[i]+"'");
      if(c.stay!==undefined) 조각.push('stay:'+c.stay);
      if(c.fix) 조각.push('fix:true');
      줄.push('  /* '+(+day+1)+'일차 '+s.n+' */ '+조각.join(', '));
    });
  });
  return 줄.length ? 줄.join('\n') : '(고친 것이 없습니다)';
}
document.getElementById('editcopy').addEventListener('click',function(){
  const t=editCode();
  const 알림=function(m){ const b=document.getElementById('editday'); if(b) b.textContent=' · '+m; };
  if(navigator.clipboard&&navigator.clipboard.writeText){
    navigator.clipboard.writeText(t).then(function(){ 알림('복사했습니다'); },
      function(){ 알림('복사 실패 — 콘솔에 출력했습니다'); console.log(t); });
  }else{ 알림('콘솔에 출력했습니다'); console.log(t); }
});
```

- [ ] **2단계: 문법 검사**

```bash
node -e "const h=require('fs').readFileSync('index.html','utf8');(h.match(/<script>([\s\S]*?)<\/script>/g)||[]).forEach((b,i)=>{const c=b.replace(/^<script>/,'').replace(/<\/script>$/,'');try{new Function(c);console.log(i+': OK');}catch(e){console.log(i+': '+e.message);process.exitCode=1;}});"
```

기대: `0: OK` `1: OK`

- [ ] **3단계: 브라우저에서 확인한다 — 설계 §9 확인 기준 8·9**

```js
(async () => {
  const w=ms=>new Promise(r=>setTimeout(r,ms));
  document.querySelector('.mtab[data-m="trip"]').click(); await w(1500);
  document.querySelectorAll('#daytabs .dtab')[1].click(); await w(1200);
  if(document.getElementById('editbar').hidden) document.getElementById('editkey').click();
  await w(1200);
  editSet(1,1,'stay',120); render(1); await w(600);
  const 코드=editCode();
  document.getElementById('editreset').click(); await w(800);
  const 되돌린뒤=D[1].stops.map(s=>s.t).join(',');
  const 원래=[...document.querySelectorAll('#tl details.stop .tm')].length;
  return JSON.stringify({코드, 되돌린뒤_편집남음:editLoad(), 띠숨김:document.getElementById('editbar').hidden}, null, 1);
})()
```

기대: `코드` 에 `2일차 …` 줄이 나오고, `되돌린뒤_편집남음` 이 `null`, `띠숨김` 이 `true`

- [ ] **4단계: 커밋**

```bash
git add index.html
git commit -m "편집 결과를 코드로 복사하는 버튼을 넣음"
```

---

## Task 15: 편집 점검 스크립트와 회귀 확인

**파일:**
- 새로: `tools/editor-check.js`
- 확인: `tools/regression-check.js` (고치지 않는다)

- [ ] **1단계: 편집 점검 스크립트를 만든다**

`tools/editor-check.js` 를 Write 도구로 만든다.

```js
/* 편집기 점검 — 편집을 손댈 때마다 돌린다.
   브라우저 콘솔(또는 javascript_tool)에 붙여 넣는다. 375x667 로 맞출 것.
   대기시간이 30초 제한에 가까우므로 섹션 단위로 나눠 붙여도 된다.

   기대값 (2026-08-28 기준)
     처음같음 true        편집기를 열었을 때 계산 시각이 지금 일정과 같다
     30분밀기 true        첫 정차지를 30분 늦추면 그날 전부 30분 밀린다
     머뭄늘리기 {앞:0, 뒤:30}  머무는 시간을 30분 늘리면 그 뒤만 밀린다
     유민경고 true        2일차 유민미술관에 화요일 휴무 경고가 붙는다
     식사경고 true        점심을 15:20 으로 밀면 늦다는 경고가 붙는다
     배경고 true          1일차 출발을 2시간 늦추면 진도항 도착 경고가 붙는다
     되돌리기 true        원래대로를 누르면 저장이 지워진다
     오류 [] */
(async () => {
  const w = ms => new Promise(r => setTimeout(r, ms));
  const err = []; window.addEventListener('error', e => err.push(String(e.message)));
  const o = {};
  await w(1800);

  document.querySelector('.mtab[data-m="trip"]').click(); await w(1500);
  document.querySelectorAll('#daytabs .dtab')[1].click(); await w(1200);
  if (document.getElementById('editbar').hidden) document.getElementById('editkey').click();
  await w(3500);

  /* 1) 처음 열었을 때 지금 일정과 같은가 */
  o.처음같음 = D[1].stops.every((s, i) => s.t === dayPlan(1).arrive[i]);

  /* 2) 첫 정차지를 30분 늦추면 전부 30분 밀린다 */
  const t0 = hm2min(D[1].stops[0].t);
  editSet(1, 0, 't', min2hm(t0 + 30)); render(1); await w(700);
  o.30분밀기 = D[1].stops.every((s, i) => hm2min(dayPlan(1).arrive[i]) - hm2min(s.t) === 30);
  editClear(); editData = null; render(1); await w(500);

  /* 3) 머무는 시간을 30분 늘리면 그 뒤만 밀린다 */
  const 전 = dayPlan(1).arriveMin.slice();
  const 원래머뭄 = dayPlan(1).stay[1];
  editSet(1, 1, 'stay', 원래머뭄 + 30); render(1); await w(700);
  const 후 = dayPlan(1).arriveMin;
  o.머뭄늘리기 = { 앞: 후[1] - 전[1], 뒤: 후[2] - 전[2] };
  editClear(); editData = null; render(1); await w(500);

  /* 4) 유민미술관 화요일 휴무 경고 */
  o.유민경고 = dayWarns(1).flat().some(x => x.indexOf('유민미술관') >= 0 && x.indexOf('휴무') >= 0);

  /* 5) 점심을 15시로 밀면 식사 경고 */
  const 점심 = D[1].stops.findIndex(s => s.ty === 'meal' && hm2min(s.t) >= 660 && hm2min(s.t) < 900);
  if (점심 >= 0) {
    editSet(1, 점심, 't', '15:20'); render(1); await w(700);
    o.식사경고 = dayWarns(1)[점심].some(x => x.indexOf('점심') >= 0 && x.indexOf('늦') >= 0);
    editClear(); editData = null; render(1); await w(500);
  } else { o.식사경고 = '해당 정차지 없음'; }

  /* 6) 1일차 진도항 도착을 배 시간 뒤로 밀면 배 경고 */
  document.querySelectorAll('#daytabs .dtab')[0].click(); await w(1300);
  const 항구 = D[0].stops.findIndex(s => s.ty === 'ship');
  if (항구 >= 0) {
    editSet(0, 0, 't', min2hm(hm2min(D[0].stops[0].t) + 120)); render(0); await w(700);
    o.배경고 = dayWarns(0)[항구].some(x => x.indexOf('도착해야') >= 0);
    editClear(); editData = null; render(0); await w(500);
  } else { o.배경고 = '해당 정차지 없음'; }
  document.querySelectorAll('#daytabs .dtab')[1].click(); await w(1300);

  /* 7) 되돌리기 */
  editSet(1, 1, 'stay', 999);
  document.getElementById('editreset').click(); await w(700);
  o.되돌리기 = editLoad() === null && document.getElementById('editbar').hidden;

  o.오류 = err;
  return JSON.stringify(o, null, 1);
})()
```

- [ ] **2단계: 문법 검사**

```bash
node -e "const s=require('fs').readFileSync('tools/editor-check.js','utf8');try{new Function(s);console.log('OK');}catch(e){console.log(e.message);process.exitCode=1;}"
```

기대: `OK`

- [ ] **3단계: 브라우저에서 돌린다**

`http://127.0.0.1:8765/` 를 새로 고치고 `tools/editor-check.js` 를 콘솔에 붙인다.

기대: `처음같음 true` · `30분밀기 true` · `머뭄늘리기 {앞:0, 뒤:30}` ·
`유민경고 true` · `되돌리기 true` · `오류 []`

- [ ] **4단계: 계산 시험을 다시 돌린다**

```bash
node tools/editor-test.js
```

기대: 전부 통과

- [ ] **5단계: 회귀 점검을 돌린다 — 보기 화면이 안 깨졌는지**

`tools/regression-check.js` 를 섹션 단위로 나눠 콘솔에 붙인다.
**편집을 끈 상태에서 돌려야 한다.**

기대: 그 파일 주석의 기대값과 모두 일치, `오류 []`

- [ ] **6단계: 커밋**

```bash
git add tools/editor-check.js
git commit -m "편집기 점검 스크립트를 넣음"
```

---

## Task 16: 문서 갱신

**파일:**
- 수정: `HANDOVER.md`

- [ ] **1단계: §3 표와 주요 함수에 편집기를 더한다**

`| \`FOOD\` | 맛집 탭 …` 줄 뒤에 넣는다.

```
| `MEAL_창` | 식사 시간대 (아침 06:30~09:30 · 점심 11:30~14:00 · 저녁 17:30~20:00) | 3 |
```

주요 함수 목록에 더한다.

```
**일정 편집(§13)** — `hm2min` `min2hm` `guessMin` `fillStay` `recalc`(계산 블록) ·
`rideFetch` `rideNow`(이동시간) · `dayPlan` `dayWarns` `editRow`(편집 화면) ·
`editLoad` `editSave` `editCode`(저장과 내보내기)
```

- [ ] **2단계: §13 을 새로 쓴다**

문서 끝에 넣는다.

```markdown
---

## 13. 일정 편집기

범례 줄의 **`#`** 으로 들어간다. 설계와 이유는
[docs/superpowers/specs/2026-08-28-schedule-editor-design.md](docs/superpowers/specs/2026-08-28-schedule-editor-design.md).

### 계산 블록은 DOM 을 만지지 않는다

`index.html` 안의 `/* ══════ 일정 계산 ══════ */` ~ `/* ══════ 일정 계산 끝 ══════ */`
사이는 **순수 함수만 넣는다.** `tools/editor-test.js` 가 이 블록만 꺼내 node 에서
돌리기 때문에, DOM 이나 `localStorage` 를 만지는 순간 시험이 통째로 죽는다.

```bash
node tools/editor-test.js        # 계산 시험 (브라우저 없이)
```

편집 화면 점검은 `tools/editor-check.js` 를 브라우저 콘솔에 붙인다.

### 되돌리지 말 것

- **머무는 시간은 배포판 시각에서 역산한다.** 그래야 편집기를 처음 열었을 때 계산
  결과가 지금 일정과 똑같이 나온다. 값이 갑자기 바뀌면 무엇이 내 편집이고 무엇이
  계산 오차인지 알 수 없다.
- **끼니는 배포판 원래 시각으로 정한다.** 계산된 시각으로 정하면 점심을 16시로 밀었을 때
  "저녁이 이르다" 로 경고가 뒤집힌다.
- **읽어낼 수 없는 운영시간·휴무 문구에는 경고하지 않는다.** 잘못된 경고는 없는 것만 못하다.
  `'매월 첫째 월요일'` `'기상 악화 시 통제'` 같은 것은 일부러 안 잡는다.
- **저장은 바뀐 값만.** 정차지 전체를 저장하면 배포판이 바뀌었을 때 옛 값이 되살아난다.
  일정 지문이 다르면 저장을 자동으로 버린다.

### 아직 안 만든 것 (2단계)

장소 바꾸기 · 순서 바꾸기 · 넣기와 빼기. 설계 문서 §8 에 있다.
```

- [ ] **3단계: 커밋**

```bash
git add HANDOVER.md
git commit -m "인수인계 문서에 일정 편집기를 더함"
```

---

## 다 끝난 뒤

- [ ] `node tools/editor-test.js` — 전부 통과
- [ ] `tools/editor-check.js` — 기대값과 일치
- [ ] `tools/regression-check.js` — 기대값과 일치, 오류 0
- [ ] 사용자에게 **2일차 유민미술관 화요일 휴무**를 어떻게 할지 묻는다
      (일정을 고칠지, 다른 날로 옮길지 — 편집기로 바로 해 볼 수 있다)
- [ ] 배포 여부를 묻는다
