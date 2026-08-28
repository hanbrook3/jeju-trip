# 카카오 길찾기 전환과 주차장 좌표 — 구현 계획

> **에이전트에게:** 이 계획은 `superpowers:subagent-driven-development` 또는
> `superpowers:executing-plans` 로 한 작업씩 실행한다. 단계는 `- [ ]` 로 추적한다.

**목표:** 일정 편집기의 이동시간을 OSRM 대신 카카오 길찾기에서 받고, 여행지 좌표를
주차장 기준으로 써서 **차가 실제로 서는 곳까지의 시간**을 계산한다.

**방식:** `rideFetch` 가 부르는 곳만 바꾼다 — 캐시와 폴백 구조는 그대로 둔다.
여행지에 `pk`(주차장 좌표)를 더하고 시간 계산만 그것을 쓴다. 지도에 점을 찍는 `ll` 은
건드리지 않는다. REST 키는 코드에 넣지 않고 편집기에서 한 번 받아 브라우저에만 둔다.

**쓰는 것:** 순수 자바스크립트 · `fetch` · `localStorage` ·
카카오모빌리티 Directions API · 카카오 로컬 API. **지도 SDK 는 쓰지 않는다.**

## 전체 제약

- **다른 세션이 1단계 Task 10~16 을 진행 중이다. 이 계획은 그것이 끝난 뒤에 시작한다.**
  시작 전 `git status` 로 `index.html` 에 남의 작업이 있는지 본다.
- `index.html` 을 통째로 다시 쓰지 않는다. 줄 단위로 고친다.
- **REST 키를 코드·커밋·출력에 넣지 않는다.** 하드코딩 금지.
- **`ll` 을 덮어쓰지 않는다.** `pk` 는 나란히 두는 새 항목이다.
- 작업마다 `node tools/editor-test.js` 가 통과해야 한다 (지금 통과 66 · 실패 0).
- 마지막에 `tools/regression-check.js` 기대값이 그대로여야 한다
  (배지불일치 0 · 핀합계 30 · 지적경계 11 · 경로 5 · 길찾기 0 · 점갈래 48/35/51).
- 외부 스크립트를 새로 불러오지 않는다. "한 파일" 전제를 지킨다.
- 글은 한국어로 담백하게. 커밋 메시지도 한국어.

## 이미 확인한 사실 (2026-08-28)

브라우저에서 두 API 모두 **CORS 가 열려 있다.** `https://hanbrook3.github.io` 와
`http://127.0.0.1:8765` 두 원본에서 `fetch` 가 status 200 으로 돌아왔다.

| API | 주소 | 인증 | 무료 쿼터 |
|---|---|---|---|
| 자동차 길찾기 | `https://apis-navi.kakaomobility.com/v1/directions` | `Authorization: KakaoAK {REST 키}` | 10,000건/일 |
| 장소 검색 | `https://dapi.kakao.com/v2/local/search/keyword.json` | 같음 | 100,000건/일 |

- 응답의 `routes[0].result_code` 가 `0` 이면 성공. `summary.duration` 이 초, `summary.distance` 가 미터.
- **좌표가 도로에서 멀면 `102`(시작 지점) 또는 `103`(도착 지점)** 이 오고 경로가 없다.
  등록된 99곳 중 성산일출봉·한라생태숲 둘이 여기 걸렸고, 주차장 좌표로 바꾸니 풀렸다.
- 앱은 카카오디벨로퍼스 `제주 여행 가이드`(앱 ID 1560035)이고 카카오맵 API 가 켜져 있다.

주차장 좌표 기준 실측 — **아래 작업들의 기준값이다.**

| 구간 | 직선 | 도로 | 소요 |
|---|---|---|---|
| 성산일출봉 → 천지연폭포 | 42.7km | 49.3km | 71분 |
| 협재 → 함덕 | 43.1km | 52.2km | 68분 |
| 제주항 → 남원 숙소 | 28.9km | 33.9km | 47분 |
| 사려니 → 비자림 | 15.8km | 21.4km | 28분 |
| 산방산 → 오설록 | 7.9km | 9.1km | 14분 |
| 성산일출봉 → 섭지코지 | 4.1km | 8.3km | 16분 |

## 파일

| 파일 | 하는 일 |
|---|---|
| `index.html` 계산 블록 | `rideLL` · `guessMin` · `naviKey` · `rideFetch` · `findPlace` |
| `index.html` `SPOT` 배열 | 레코드마다 `pk:[위도,경도]` 추가 (34곳) |
| `index.html` 편집 띠 | 키가 없을 때만 보이는 입력칸 |
| `tools/apply-parking.js` | **신규.** TSV 를 읽어 `pk` 를 넣는 1회용 스크립트 |
| `tools/parking-coords.tsv` | `pk` 값의 출처. 고치지 않는다 |
| `tools/editor-test.js` | 순수 함수 시험 |

---

## Task 1: 주차장 좌표를 `SPOT` 에 넣는다

`tools/parking-coords.tsv` 의 34곳을 `pk` 로 옮긴다. 손으로 넣으면 틀리므로 스크립트로 넣는다.

**파일:**
- 신규: `tools/apply-parking.js`
- 수정: `index.html` (`SPOT` 배열 — 스크립트가 고친다)

**내보내는 것:** `SPOT` 레코드의 `pk:[위도,경도]`. Task 2 의 `rideLL` 이 이것을 읽는다.

- [ ] **1단계: 스크립트를 쓴다**

`tools/apply-parking.js`:

```js
/* tools/parking-coords.tsv 의 주차장 좌표를 index.html 의 SPOT 레코드에
   pk 로 넣는다.  node tools/apply-parking.js
   ll 은 건드리지 않는다. 이미 pk 가 있는 줄은 지나간다.
   SPOT 레코드는 한 줄에 n: 과 ll: 이 함께 있어 줄 단위로 안전하게 고칠 수 있다. */
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const HTML = path.join(ROOT, 'index.html');
const TSV = path.join(ROOT, 'tools', 'parking-coords.tsv');

const 주차장 = {};
for (const line of fs.readFileSync(TSV, 'utf8').split('\n')) {
  if (!line || line[0] === '#') continue;
  const c = line.split('\t');
  if (c.length < 6 || c[4] === '-' || c[4] === '') continue;
  주차장[c[0]] = [Number(c[4]).toFixed(6), Number(c[5]).toFixed(6)];
}

const 줄 = fs.readFileSync(HTML, 'utf8').split('\n');
let 넣음 = 0, 이미 = 0;
const 결과 = 줄.map(line => {
  const m = line.match(/\{n:'([^']+)'/);
  if (!m || !주차장[m[1]]) return line;
  if (!/ll:\[[0-9.]+,[0-9.]+\]/.test(line)) return line;
  if (/pk:\[/.test(line)) { 이미++; return line; }
  const [la, lo] = 주차장[m[1]];
  넣음++;
  return line.replace(/(ll:\[[0-9.]+,[0-9.]+\])/, `$1,pk:[${la},${lo}]`);
});

fs.writeFileSync(HTML, 결과.join('\n'));
console.log(`pk 넣음 ${넣음}곳 · 이미 있던 곳 ${이미}곳 · TSV 의 주차장 ${Object.keys(주차장).length}곳`);
```

- [ ] **2단계: 돌리기 전 상태를 확인한다**

```bash
git status --short index.html
```

기대: 다른 세션의 변경이 없어야 한다. 있으면 멈추고 사람에게 묻는다.

- [ ] **3단계: 돌린다**

```bash
node tools/apply-parking.js
```

기대 출력: `pk 넣음 34곳 · 이미 있던 곳 0곳 · TSV 의 주차장 34곳`

- [ ] **4단계: 두 배열이 맞는지 본다**

```bash
grep -c "pk:\[" index.html
```

기대: `34`

```bash
grep -o "n:'성산일출봉'[^,]*,theme[^,]*,zone:'[^']*',ll:\[[0-9.,]*\],pk:\[[0-9.,]*\]" index.html
```

기대: `ll` 뒤에 `pk` 가 붙어 나온다. `ll` 값은 그대로여야 한다.

- [ ] **5단계: 회귀 점검**

```bash
node tools/serve.js
```

브라우저를 375x667 로 맞추고 `http://127.0.0.1:8765` 에서 `tools/regression-check.js` 를 붙여 넣는다.

기대: 배지불일치 0 · 핀합계 30 · 점갈래_일정 {여행지 48, 명소 35, 맛집 51} · 오류 []
`pk` 는 지도에 쓰이지 않으므로 **하나도 바뀌면 안 된다.**

- [ ] **6단계: 커밋**

```bash
git add tools/apply-parking.js index.html
git commit -m "여행지에 주차장 좌표를 넣음"
```

---

## Task 2: 길찾기에 쓸 좌표를 고른다

정차지는 저마다 `ll` 을 들고 있고 `pk` 는 `SPOT` 에만 있다. 이름으로 이어 준다.

**파일:**
- 수정: `index.html` (계산 블록, `km` 바로 뒤)
- 수정: `tools/editor-test.js`

**쓰는 것:** 없음 (순수 함수)
**내보내는 것:** `rideLL(정차지, 여행지목록) → [위도,경도] | null`. Task 5 가 쓴다.

- [ ] **1단계: 실패하는 시험을 쓴다**

`tools/editor-test.js` 의 `new Function` 줄 끝에 이름을 더한다.

```js
    ' __out.rideLL=rideLL;' +
```

파일 끝의 `console.log(\`\n통과 …\`)` 앞에 붙인다.

```js
console.log('\n[길찾기 좌표 고르기]');
const 여행지 = [
  { n: '성산일출봉', ll: [33.4581,126.9425], pk: [33.459135,126.940538] },
  { n: '섭지코지',   ll: [33.4242,126.9311], pk: [33.423545,126.930145] },
  { n: '형제해안도로', ll: [33.2100,126.2600] },
];
확인('주차장이 있으면 주차장', API.rideLL({ n:'성산일출봉', ll:[33.4581,126.9425] }, 여행지)[0], 33.459135);
확인('주차장이 없으면 제자리', API.rideLL({ n:'형제해안도로', ll:[33.21,126.26] }, 여행지)[0], 33.21);
확인('목록에 없는 이름도 제자리', API.rideLL({ n:'휴게소', ll:[33.3,126.5] }, 여행지)[1], 126.5);
확인('정차지가 pk 를 직접 들면 그것', API.rideLL({ n:'아무개', ll:[33.1,126.1], pk:[33.2,126.2] }, 여행지)[0], 33.2);
확인('좌표가 없으면 null', API.rideLL({ n:'체크아웃' }, 여행지), null);
확인('정차지가 없으면 null', API.rideLL(null, 여행지), null);
```

- [ ] **2단계: 시험을 돌려 실패를 확인한다**

```bash
node tools/editor-test.js
```

기대: `계산 블록 실행 실패: rideLL is not defined`

- [ ] **3단계: 함수를 쓴다**

`index.html` 계산 블록에서 `km` 함수 바로 뒤에 넣는다.

```js
/* 길찾기에 쓸 좌표. 주차장이 있으면 그쪽을 쓴다.
   ll 은 지도에 점을 찍는 자리라 그대로 두고, 여기서 고른 값은 시간 계산에만 쓴다.
   오름은 정상과 주차장이 수백 미터 떨어져 있다. */
function rideLL(정차지, 여행지){
  if(!정차지) return null;
  if(정차지.pk) return 정차지.pk;
  const m = (여행지||[]).find(s => s.n === 정차지.n);
  if(m && m.pk) return m.pk;
  return 정차지.ll || null;
}
```

- [ ] **4단계: 시험을 돌려 통과를 확인한다**

```bash
node tools/editor-test.js
```

기대: `실패 0`

- [ ] **5단계: 커밋**

```bash
git add index.html tools/editor-test.js
git commit -m "길찾기에 쓸 좌표를 주차장 우선으로 고르는 함수를 넣음"
```

---

## Task 3: 폴백을 카카오 기준으로 다시 맞춘다

`guessMin` 은 OSRM 실측으로 맞춰 둔 것이라 카카오 값보다 짧게 나온다. 특히 짧은 구간이
38% 벗어나 시험 한계(35%)를 넘는다. 카카오 실측으로 다시 맞추고, 두 토막이던 식을
한 줄로 줄인다.

**파일:**
- 수정: `index.html` (계산 블록의 `guessMin`)
- 수정: `tools/editor-test.js` (실측표 교체)

**내보내는 것:** `guessMin(a,b) → 분 | null`. 이름과 반환형은 그대로라 부르는 쪽은 안 바뀐다.

- [ ] **1단계: 시험의 기준값을 카카오 실측으로 바꾼다**

`tools/editor-test.js` 의 `[거리와 이동시간 추정]` 절에서 `실측` 배열과 그 위 주석을
통째로 아래로 바꾼다. 좌표도 주차장 기준으로 바꾼다.

```js
/* 2026-08-28 카카오 길찾기 실측 (주차장 좌표 기준):
   성산일출봉→천지연폭포 49.3km 71분, 협재→함덕 52.2km 68분, 제주항→남원 33.9km 47분,
   사려니→비자림 21.4km 28분, 산방산→오설록 9.1km 14분, 일출봉→섭지코지 8.3km 16분.
   추정은 이 값의 ±35% 안에 들어야 쓸 만하다. */
const 실측 = [
  ['성산일출봉→천지연폭포', [33.459135,126.940538], [33.244092,126.560300], 71],
  ['협재→함덕',            [33.393742,126.240433], [33.543926,126.668291], 68],
  ['제주항→남원숙소',        [33.5169,126.5316],     [33.3050,126.7122],     47],
  ['사려니→비자림',          [33.395514,126.684912], [33.491304,126.810948], 28],
  ['산방산→오설록',          [33.236290,126.312623], [33.304756,126.289425], 14],
  ['일출봉→섭지코지',        [33.459135,126.940538], [33.423545,126.930145], 16],
];
```

- [ ] **2단계: 시험을 돌려 실패를 확인한다**

```bash
node tools/editor-test.js
```

기대: `산방산→오설록` 이 실패한다 (지금 식은 13분을 내는데 실제는 14분이 아니라
OSRM 의 11분에 맞춰져 있어 짧은 구간이 어긋난다). 실패가 하나라도 나오면 다음으로 간다.

- [ ] **3단계: 식을 바꾼다**

`index.html` 계산 블록의 `guessMin` 을 통째로 아래로 바꾼다.

```js
/* 키가 없거나 인터넷이 막혔을 때 쓰는 이동시간 추정(분).
   2026-08-28 카카오 길찾기 실측 여섯 구간에 맞췄다 — 최대 오차 31%.
   직선거리에 비례하는 주행 시간에, 출발·도착 언저리의 저속 구간을 5분으로 얹었다.
   짧은 구간일수록 우회율이 커서(섭지코지 2.0배) 비례식만으로는 맞지 않는다. */
function guessMin(a,b){
  const d=km(a,b);
  if(d===null) return null;
  if(d<0.05) return 0;
  return Math.round(d*1.47+5);
}
```

- [ ] **4단계: 시험을 돌려 통과를 확인한다**

```bash
node tools/editor-test.js
```

기대: `실패 0`. 여섯 구간의 오차가 각각 4% · 0% · 0% · 0% · 21% · 31% 로 찍힌다.

- [ ] **5단계: 커밋**

```bash
git add index.html tools/editor-test.js
git commit -m "이동시간 추정을 카카오 실측 기준으로 다시 맞춤"
```

---

## Task 4: REST 키를 보관한다

**키를 코드에 넣지 않는다.** REST 키는 JavaScript 키와 달리 도메인 제한이 없어서
저장소에 올라가면 남이 그대로 가져다 쓴다. 편집기에서 한 번 받아 브라우저에만 둔다.

**파일:**
- 수정: `index.html` (계산 블록)
- 수정: `tools/editor-test.js`

**내보내는 것:** `naviKey()` 로 읽고 `naviKey(문자열)` 로 저장, `naviKey('')` 로 지운다.
Task 5·6 이 쓴다.

- [ ] **1단계: 실패하는 시험을 쓴다**

`new Function` 줄에 이름을 더한다.

```js
    ' __out.naviKey=naviKey;' +
```

파일 끝에 붙인다. 시험은 DOM 없이 도는 곳이라 `localStorage` 가 없다 — **없을 때 조용히
빈 문자열을 내는 것**이 여기서 확인할 동작이다.

```js
console.log('\n[REST 키 보관]');
확인('저장소가 없으면 빈 문자열', API.naviKey(), '');
확인('저장소가 없어도 저장이 터지지 않는다', API.naviKey('abc'), '');
```

- [ ] **2단계: 시험을 돌려 실패를 확인한다**

```bash
node tools/editor-test.js
```

기대: `계산 블록 실행 실패: naviKey is not defined`

- [ ] **3단계: 함수를 쓴다**

`index.html` 계산 블록에 넣는다.

```js
/* 카카오 REST 키. 코드에 넣지 않고 편집기에서 한 번 받아 이 브라우저에만 둔다.
   편집자는 나 혼자이고 가족은 편집기를 쓰지 않으므로 이걸로 충분하다.
   저장소를 못 쓰는 곳(시험 등)에서는 빈 문자열을 낸다. */
const NAVI_KEY='jeju.naviKey';
function naviKey(v){
  try{
    if(v===undefined) return localStorage.getItem(NAVI_KEY)||'';
    const t=String(v).trim();
    if(!t){ localStorage.removeItem(NAVI_KEY); return ''; }
    localStorage.setItem(NAVI_KEY,t);
    return t;
  }catch(e){ return ''; }
}
```

- [ ] **4단계: 시험을 돌려 통과를 확인한다**

```bash
node tools/editor-test.js
```

기대: `실패 0`

- [ ] **5단계: 커밋**

```bash
git add index.html tools/editor-test.js
git commit -m "카카오 REST 키를 브라우저에만 두는 함수를 넣음"
```

---

## Task 5: `rideFetch` 를 카카오 길찾기로 바꾼다

부르는 곳만 바꾼다. 캐시(`rideCache`·`rideKey`)와 폴백(`guessMin`)은 그대로다.

**파일:**
- 수정: `index.html` (계산 블록의 `rideFetch`)

**쓰는 것:** `naviKey`(Task 4) · `guessMin`(Task 3) · `rideKey`·`rideCache`(이미 있음)
**내보내는 것:** `rideFetch(a,b) → Promise<분|null>`. 서명은 그대로다.

- [ ] **1단계: 함수를 바꾼다**

`index.html` 계산 블록의 `rideFetch` 를 통째로 아래로 바꾼다.

```js
async function rideFetch(a,b){
  if(!a||!b) return null;
  const k=rideKey(a,b);
  if(rideCache[k]!==undefined) return rideCache[k];
  const key=naviKey();
  if(!key) return guessMin(a,b);
  try{
    const url='https://apis-navi.kakaomobility.com/v1/directions'
      +'?origin='+a[1]+','+a[0]+'&destination='+b[1]+','+b[0];
    const j=await (await fetch(url,{headers:{Authorization:'KakaoAK '+key}})).json();
    const r=j&&j.routes&&j.routes[0];
    /* result_code 102·103 은 좌표가 도로에서 멀다는 뜻이다. 그때는 추정으로 넘어간다. */
    if(r&&r.result_code===0&&r.summary&&typeof r.summary.duration==='number'){
      rideCache[k]=Math.round(r.summary.duration/60);
      return rideCache[k];
    }
  }catch(e){}
  return guessMin(a,b);
}
```

- [ ] **2단계: 순수 함수 시험이 그대로 도는지 본다**

```bash
node tools/editor-test.js
```

기대: `실패 0`. `rideFetch` 는 시험 대상이 아니지만 블록이 깨지지 않았는지 본다.

- [ ] **3단계: 브라우저에서 실제로 불러 본다**

`node tools/serve.js` 로 띄우고 `http://127.0.0.1:8765` 콘솔에서 —
**키는 붙여 넣되 이 결과를 어디에도 옮겨 적지 않는다.**

```js
naviKey('여기에_REST_키');
await rideFetch([33.459135,126.940538],[33.423545,126.930145]);
```

기대: `16` (성산일출봉 주차장 → 섭지코지, 2026-08-28 실측 16분)

```js
naviKey('');
await rideFetch([33.4,126.3],[33.5,126.6]);
```

기대: 키가 없으니 `guessMin` 값이 나온다 (숫자, 오류 없음).

- [ ] **4단계: 도로에서 먼 좌표가 추정으로 넘어가는지 본다**

```js
naviKey('여기에_REST_키');
rideCache['33.4581,126.9425>33.4242,126.9311']=undefined;
await rideFetch([33.4581,126.9425],[33.4242,126.9311]);
```

기대: 카카오가 `result_code 102` 를 내지만 오류 없이 추정값(11분 근처)이 나온다.

- [ ] **5단계: 커밋**

```bash
git add index.html
git commit -m "이동시간을 카카오 길찾기에서 받도록 바꿈"
```

---

## Task 6: 이동시간 계산이 주차장 좌표를 쓰게 한다

`rideLL`(Task 2)을 실제로 물린다. **1단계 Task 13(이동시간 칩)이 끝나 있어야 한다.**

**파일:**
- 수정: `index.html` (1단계 Task 13 이 만든 이동시간 수집 코드)

**쓰는 것:** `rideLL`(Task 2) · `rideNow`·`rideFetch`(이미 있음)

- [ ] **1단계: 좌표를 넘기는 자리를 찾는다**

```bash
grep -n -o -E ".{0,70}ride(Now|Fetch)\(.{0,60}" index.html
```

정차지의 좌표를 그대로 넘기는 자리가 나온다 (`rideNow(s.ll, t.ll)` 같은 모양).
**그 자리마다** 좌표를 `rideLL` 로 감싼다.

- [ ] **2단계: 감싼다**

```js
rideNow(rideLL(s, SPOT), rideLL(t, SPOT))
```

```js
await rideFetch(rideLL(s, SPOT), rideLL(t, SPOT))
```

`SPOT` 은 전역이라 그대로 쓸 수 있다. 맛집은 주차장 좌표를 붙이지 않았으므로 넘기지 않는다.

- [ ] **3단계: 브라우저에서 값이 달라지는지 본다**

`http://127.0.0.1:8765` 콘솔에서:

```js
const 일출봉 = SPOT.find(s=>s.n==='성산일출봉');
console.log('지도용', 일출봉.ll, '길찾기용', rideLL(일출봉, SPOT));
```

기대: 앞은 `[33.4581, 126.9425]`, 뒤는 `[33.459135, 126.940538]` — **서로 달라야 한다.**
같으면 Task 1 의 `pk` 가 안 들어간 것이다.

- [ ] **4단계: 회귀 점검**

`tools/regression-check.js` 를 붙여 넣는다.
기대: 배지불일치 0 · 핀합계 30 · 점갈래 48/35/51 · 오류 [] — 지도는 `ll` 을 쓰므로 그대로다.

- [ ] **5단계: 커밋**

```bash
git add index.html
git commit -m "이동시간을 주차장 좌표 기준으로 계산함"
```

---

## Task 7: 편집 띠에서 키를 받는다

키가 없으면 이동시간이 추정으로만 나온다. 편집기에 들어왔을 때 그것을 알리고 받는다.

**파일:**
- 수정: `index.html` (편집 띠 HTML · 스타일 · 편집기 스크립트)

**쓰는 것:** `naviKey`(Task 4)

1단계 Task 10 이 만든 편집 띠는 지금 이 모양이다. 달라졌으면 그 구조에 맞춰 넣는다.

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

- [ ] **1단계: 입력칸을 넣는다**

`<b>편집 중</b><span id="editday"></span>` 바로 뒤에 넣는다.

```html
  <span class="ekey" id="ekeywrap" hidden>
    <input type="password" id="ekey" placeholder="카카오 REST 키" autocomplete="off" spellcheck="false">
    <button type="button" id="ekeysave">저장</button>
  </span>
  <span class="ekeyok" id="ekeyok" hidden>실제 소요시간</span>
```

- [ ] **2단계: 스타일을 넣는다**

`.editbar button{…}` 규칙 바로 뒤에 넣는다.

```css
.editbar .ekey{display:flex;gap:5px;align-items:center}
.editbar .ekey[hidden]{display:none}
.editbar .ekey input{
  font-family:inherit;font-size:11.5px;padding:4px 7px;width:150px;
  border:1px solid var(--line);border-radius:6px;background:#fff;color:var(--ink2)
}
.editbar .ekeyok{color:var(--sea);font-size:11px}
.editbar .ekeyok[hidden]{display:none}
```

- [ ] **3단계: 동작을 붙인다**

편집기 스크립트에서 편집 띠를 여는 함수 안에 넣는다.

```js
/* 키가 있으면 실제 소요시간, 없으면 입력칸. 키는 화면에도 코드에도 남기지 않는다. */
function ekeySync(){
  const 있음 = !!naviKey();
  document.getElementById('ekeywrap').hidden = 있음;
  document.getElementById('ekeyok').hidden = !있음;
}
document.getElementById('ekeysave').addEventListener('click', () => {
  naviKey(document.getElementById('ekey').value);
  document.getElementById('ekey').value = '';
  ekeySync();
});
```

편집 띠를 여는 곳에서 `ekeySync()` 를 부른다.

- [ ] **4단계: 브라우저에서 확인한다**

1. `localStorage.removeItem('jeju.naviKey')` 후 새로고침
2. 범례 줄의 `#` 를 눌러 편집기에 들어간다 → **입력칸이 보인다**
3. REST 키를 붙여 넣고 저장 → **입력칸이 사라지고 `실제 소요시간` 이 보인다**
4. 새로고침 후 다시 들어간다 → **여전히 `실제 소요시간`** (브라우저에 남아 있다)

- [ ] **5단계: 키가 코드에 없는지 확인한다**

```bash
git diff --cached | grep -i -E "KakaoAK [0-9a-f]{32}|[0-9a-f]{32}" || echo "키 없음 — 통과"
```

기대: `키 없음 — 통과`

- [ ] **6단계: 커밋**

```bash
git add index.html
git commit -m "편집 띠에서 카카오 REST 키를 받게 함"
```

---

## Task 8: 문서를 맞춘다

**파일:**
- 수정: `docs/superpowers/specs/2026-08-28-schedule-editor-design.md`
- 수정: `HANDOVER.md`

- [ ] **1단계: 설계 문서 §4.1 의 `pk` 줄을 실제와 맞춘다**

`pk` 가 몇 곳에 들어갔는지 Task 1 의 출력과 맞는지 본다. 다르면 숫자를 고친다.

- [ ] **2단계: 설계 문서 §4.3 의 폴백 문장을 고친다**

`계수는 위 실측으로 맞춘다` 를 실제 식으로 바꾼다.

```markdown
- **키가 없거나 인터넷이 없으면 직선거리로 추정한다.** 계산이 멈추면 편집기 자체가
  못 쓰게 되므로 폴백이 필요하다. `분 = round(직선km × 1.47 + 5)` 이고
  위 여섯 구간에서 최대 오차 31% 다.
```

- [ ] **3단계: HANDOVER 에 키 취급을 적는다**

`### 구조` 절 앞에 넣는다.

```markdown
### 카카오 REST 키

**저장소에 넣지 않는다.** REST 키는 JavaScript 키와 달리 도메인 제한이 없어 소스에
박히면 남이 그대로 가져다 쓴다. 편집기(`#`)에 처음 들어갈 때 한 번 붙여 넣으면
그 브라우저의 `localStorage['jeju.naviKey']` 에만 남는다. 가족은 편집기를 쓰지 않으므로
키 없이도 앱이 그대로 돌아간다 — 이동시간만 추정값이 된다.

키를 잃어버렸거나 새로 받으려면 카카오디벨로퍼스 `제주 여행 가이드`(앱 ID 1560035)의
`앱 설정 > 플랫폼 키` 에서 본다.
```

- [ ] **4단계: 커밋**

```bash
git add docs/superpowers/specs/2026-08-28-schedule-editor-design.md HANDOVER.md
git commit -m "카카오 길찾기 전환을 문서에 반영함"
```

---

## 확인 기준

1. `node tools/editor-test.js` — 실패 0.
2. `grep -c "pk:\[" index.html` — 34.
3. `rideLL(SPOT.find(s=>s.n==='성산일출봉'), SPOT)` 이 `ll` 과 **다른** 좌표를 낸다.
4. 키를 넣으면 성산일출봉 주차장 → 섭지코지가 **16분**으로 나온다.
5. 키를 지우면 같은 구간이 추정값으로 나오고 **오류가 없다.**
6. 도로에서 먼 좌표(`[33.4581,126.9425]`)를 넣어도 오류 없이 추정으로 넘어간다.
7. `tools/regression-check.js` 전 항목이 기대값 그대로다.
8. `git log -p` 어디에도 32자리 키가 없다.
9. 인터넷을 끊어도 편집기가 돌아간다.

## 이 계획에 없는 것

- **장소 검색과 목록 추가·삭제.** 별도 계획으로 뺐다
  (`2026-08-28-place-search-and-list-edit.md`). 그쪽이 이 계획의 `naviKey` 를 쓴다.
- **지도 타일을 카카오로 바꾸는 일.** 설계 문서 §10 그대로 이번 범위가 아니다.
- **맛집 주차장 좌표.** 식당은 대개 도로에 붙어 있어 등록 좌표로 길찾기가 된다.
  99곳 전수 조사에서 걸린 두 곳은 모두 여행지였다.
