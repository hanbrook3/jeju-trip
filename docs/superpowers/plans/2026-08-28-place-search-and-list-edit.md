# 장소 검색과 목록 추가·삭제 (가족 공유) — 구현 계획

> **에이전트에게:** 이 계획은 `superpowers:subagent-driven-development` 또는
> `superpowers:executing-plans` 로 한 작업씩 실행한다. 단계는 `- [ ]` 로 추적한다.

**목표:** 가족이 각자 카카오 장소 검색으로 맛집·여행지를 찾아 목록에 넣고 뺄 수 있게 하고,
**그 결과가 모든 기기에서 같게 보이게** 한다.

**방식:** 배포판 48곳·51곳은 그대로 두고, 공유 서버의 **덧붙이기 기록**을 그 위에 얹어
최종 목록을 만든다. 얹는 일은 원본을 스냅숏해 두고 매번 다시 계산하므로 몇 번 얹어도
같은 결과가 나온다. 인터넷이 없으면 마지막으로 받아 둔 기록을 쓴다.

**쓰는 것:** 순수 자바스크립트 · `fetch` · `localStorage`(캐시로만) · 카카오 로컬 API

**먼저 끝나 있어야 하는 것**
1. `2026-08-28-shared-place-store-server.md` 전부 — `<도메인>` 과 `<약속어>` 가 나온다.
2. `2026-08-28-kakao-ride-and-parking.md` 의 Task 4(`naviKey`) — 카카오 REST 키를 얻는다.

## 전체 제약

- **평소(비편집) 화면이 한 픽셀도 달라지면 안 된다.** 검색칸·`+`·`−` 는 편집 모드에서만.
- **`localStorage` 는 캐시일 뿐이다.** 진짜 값은 공유 서버에 있다.
- **배포판 48곳·51곳은 가족이 지울 수 없다.** 일정이 그 위에 서 있다.
- **일정에 쓰이는 장소는 지울 수 없다.**
- `index.html` 을 통째로 다시 쓰지 않는다. 줄 단위로 고친다.
- 카카오 REST 키를 코드에 넣지 않는다. 약속어와 도메인은 넣는다(막을 방법이 없고,
  서버 계획의 "얼마나 열려 있는가" 에서 그 위험을 받아들이기로 했다).
- 작업마다 `node tools/editor-test.js` 가 통과해야 한다.
- 글은 한국어로 담백하게. 커밋 메시지도 한국어.

## 누가 무엇을 할 수 있나

| | 가족 | 나 |
|---|---|---|
| 맛집·여행지 **찾아서 넣기** | 할 수 있다 | 할 수 있다 |
| 자기가 넣은 것 **빼기** | 할 수 있다 | 할 수 있다 |
| 배포판 48곳·51곳 빼기 | **못 한다** | 코드를 고쳐 배포 |
| 일정에 쓰이는 장소 빼기 | **못 한다** | 일정에서 먼저 뺀 뒤 |
| 일정 고치기 | 못 한다 | 할 수 있다 |

**일정에 넣을 수 있는 맛집·여행지는 여행지 탭·맛집 탭 목록에 있는 것뿐이다.** 목록에
없으면 먼저 목록에 넣어야 한다. 그래야 일정에 있는 곳이 언제나 좌표와 정보를 갖는다.

## UI 규칙 — 기존 조작과 겹치지 않게

`HANDOVER.md` §13 이 정해 둔 것을 그대로 지킨다.

| 이미 정해진 것 | 새 기능이 지키는 방법 |
|---|---|
| **지도 위에 아무것도 띄우지 않는다** | 검색칸과 결과는 지도 **아래** 편집 띠 안에 둔다 |
| **조작 버튼은 전부 범례 줄에 있다** | 진입은 기존 범례 줄의 `#` 하나뿐 |
| **목록 카드를 누르면 지도만 그 자리로 간다** | 이 동작을 건드리지 않는다. 삭제는 **작은 손잡이**이고 눌러도 카드가 열리거나 지도가 움직이지 않는다 |
| **지도 점을 누르면 그 카드가 열린다** | 그대로 둔다 |

**검색 결과 항목도 같은 규칙을 따른다.** 본문을 누르면 지도가 그 자리로 가고, 오른쪽 `+`
를 눌러야 목록에 들어간다.

**삭제 손잡이에서 `preventDefault()` 와 `stopPropagation()` 을 빠뜨리면 지우려다 지도가
튄다.** 이 계획에서 가장 틀리기 쉬운 곳이다.

## 자료를 어떻게 채우나

카카오가 주는 것은 이름·주소·전화·분류·좌표뿐이다. **없는 글은 비워 둔다. 지어내지 않는다.**

| 우리 항목 | 카카오에서 | 없으면 |
|---|---|---|
| `n` | `place_name` | — |
| `ll` | `[y, x]` | — |
| `addr` | `road_address_name` 없으면 `address_name` | 빈 문자열 |
| `tel` (맛집) | `phone` | 빈 문자열 |
| `kind` (맛집) | `category_name` 에 `카페` 가 있으면 `카페`, 아니면 `식당` | — |
| `zone` | 주소의 읍·면·동에서 뽑는다 | `기타` |
| `theme` | 없다 | `직접 추가` |
| `누가` | 넣은 사람 이름 | 빈 문자열 |

`theme:'직접 추가'` 는 분류 막대에 제 칸으로 나온다. **일부러 그렇게 둔다** — 넣은 것이
무엇인지 한눈에 보이고 나중에 글을 채울 때 찾기 쉽다.

## 파일

| 파일 | 하는 일 |
|---|---|
| `index.html` 계산 블록 | `zoneOf` · `toSpot` · `toFood` · `findPlace` |
| `index.html` 공유 블록 | `shareFetch` · `sharePost` · `shareApply` · `myName` |
| `index.html` 편집 띠 | 검색칸과 결과 목록 |
| `index.html` 카드 | 편집 모드일 때만 보이는 `−`, 넣은 사람 표시 |
| `tools/editor-test.js` | 순수 함수 시험 |
| `tools/regression-check.js` | 기대값 주석 갱신 |

---

## Task 1: 검색 결과를 우리 레코드로 바꾼다

순수 함수라 먼저 만든다. 네트워크 없이 시험할 수 있다.

**파일:**
- 수정: `index.html` (계산 블록)
- 수정: `tools/editor-test.js`

**내보내는 것:** `zoneOf(주소)` · `toSpot(문서)` · `toFood(문서)`

- [ ] **1단계: 실패하는 시험을 쓴다**

`tools/editor-test.js` 의 `new Function` 줄에 이름을 더한다.

```js
    ' __out.zoneOf=zoneOf; __out.toSpot=toSpot; __out.toFood=toFood;' +
```

파일 끝의 `console.log(`\n통과 …`)` 앞에 붙인다.

```js
console.log('\n[검색 결과를 레코드로]');
확인('성산읍은 성산', API.zoneOf('제주특별자치도 서귀포시 성산읍 고성리 21'), '성산');
확인('안덕면은 안덕', API.zoneOf('제주특별자치도 서귀포시 안덕면 사계리 1'), '안덕');
확인('중문은 서귀포시내가 아니라 중문', API.zoneOf('제주특별자치도 서귀포시 중문동 2864'), '중문');
확인('읍면 없는 서귀포시는 서귀포시내', API.zoneOf('제주특별자치도 서귀포시 서홍동 791'), '서귀포시내');
확인('읍면 없는 제주시는 제주시내', API.zoneOf('제주특별자치도 제주시 이도이동 1'), '제주시내');
확인('제주가 아니면 기타', API.zoneOf('전라남도 진도군 임회면'), '기타');
확인('주소가 없어도 터지지 않는다', API.zoneOf(null), '기타');

const 문서 = { place_name:'성산일출봉', address_name:'제주특별자치도 서귀포시 성산읍 고성리 1',
  road_address_name:'', phone:'064-783-0959', category_name:'여행 > 관광,명소 > 자연명소',
  x:'126.940537521366', y:'33.459134970543' };
const 새여행지 = API.toSpot(문서);
확인('여행지 이름', 새여행지.n, '성산일출봉');
확인('여행지 좌표는 [위도,경도]', 새여행지.ll[0], 33.459134970543);
확인('여행지 구역', 새여행지.zone, '성산');
확인('여행지 분류는 직접 추가', 새여행지.theme, '직접 추가');
확인('도로명이 없으면 지번 주소', 새여행지.addr, '제주특별자치도 서귀포시 성산읍 고성리 1');
확인('설명은 비어 있다', 새여행지.info, '');

const 카페문서 = { place_name:'카페한라산', address_name:'제주특별자치도 제주시 구좌읍 면수1길 48',
  road_address_name:'제주특별자치도 제주시 구좌읍 면수1길 48', phone:'064-783-1522',
  category_name:'음식점 > 카페', x:'126.862904', y:'33.524723' };
const 새맛집 = API.toFood(카페문서);
확인('카페로 갈래', 새맛집.kind, '카페');
확인('맛집 전화', 새맛집.tel, '064-783-1522');
확인('맛집 구역', 새맛집.zone, '구좌');
확인('차림표는 빈 배열', 새맛집.menu.length, 0);
확인('식당은 식당으로', API.toFood({ ...카페문서, category_name:'음식점 > 한식' }).kind, '식당');
확인('문서가 없으면 null', API.toSpot(null), null);
```

- [ ] **2단계: 시험을 돌려 실패를 확인한다**

```bash
node tools/editor-test.js
```

기대: `계산 블록 실행 실패: zoneOf is not defined`

- [ ] **3단계: 함수를 쓴다**

`index.html` 계산 블록에 넣는다.

```js
/* 카카오 주소에서 우리가 쓰는 구역 이름을 뽑는다.
   읍·면을 먼저 보고 없으면 시 단위로 떨어뜨린다.
   중문은 서귀포시 안에 있으므로 서귀포시보다 먼저 본다. */
const ZONE_읍면 = {
  '성산읍':'성산','구좌읍':'구좌','조천읍':'조천','한림읍':'한림','애월읍':'애월',
  '대정읍':'대정','남원읍':'남원','안덕면':'안덕','한경면':'한경','표선면':'표선',
  '우도면':'우도','추자면':'추자'
};
function zoneOf(주소){
  const a = String(주소 || '');
  for(const k in ZONE_읍면) if(a.includes(k)) return ZONE_읍면[k];
  if(a.includes('중문')) return '중문';
  if(a.includes('서귀포시')) return '서귀포시내';
  if(a.includes('제주시')) return '제주시내';
  return '기타';
}
/* 카카오 장소 문서를 여행지 레코드로. 없는 글은 지어내지 않고 빈 값으로 둔다. */
function toSpot(문서){
  if(!문서 || !문서.place_name) return null;
  const 지번 = 문서.address_name || '';
  return { n:문서.place_name, theme:'직접 추가', zone:zoneOf(지번 || 문서.road_address_name),
    ll:[Number(문서.y), Number(문서.x)],
    addr:문서.road_address_name || 지번,
    open:'', off:'', info:'', hist:'', arch:'', point:'' };
}
/* 카카오 장소 문서를 맛집 레코드로. */
function toFood(문서){
  if(!문서 || !문서.place_name) return null;
  const 지번 = 문서.address_name || '';
  return { n:문서.place_name, zone:zoneOf(지번 || 문서.road_address_name), theme:'직접 추가',
    kind:String(문서.category_name || '').includes('카페') ? '카페' : '식당',
    main:'', pick:false, ll:[Number(문서.y), Number(문서.x)],
    addr:문서.road_address_name || 지번, tel:문서.phone || '',
    menu:[], note:'', rate:'' };
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
git commit -m "카카오 장소 문서를 여행지·맛집 레코드로 바꾸는 함수를 넣음"
```

---

## Task 2: 카카오 장소 검색

**파일:**
- 수정: `index.html` (계산 블록)

**쓰는 것:** `naviKey`(길찾기 계획 Task 4)
**내보내는 것:** `findPlace(말, 종류) → Promise<문서배열>`

- [ ] **1단계: 함수를 쓴다**

```js
/* 카카오 장소 검색. 제주 한가운데를 중심으로 60km 안만 본다 —
   같은 이름의 뭍 가게가 섞여 들어오는 것을 막는다.
   키가 없으면 빈 배열을 낸다. 부르는 쪽이 "키를 넣어 주세요" 를 보여 준다. */
async function findPlace(말, 종류){
  const key = naviKey();
  const q = String(말 || '').trim();
  if(!key || !q) return [];
  const 분류 = 종류 === 'food' ? '&category_group_code=FD6,CE7' : '';
  const url = 'https://dapi.kakao.com/v2/local/search/keyword.json'
    + '?query=' + encodeURIComponent(q)
    + '&x=126.5312&y=33.3846&radius=60000&size=10&sort=accuracy' + 분류;
  try{
    const r = await fetch(url, { headers:{ Authorization:'KakaoAK ' + key } });
    if(!r.ok) return [];
    const j = await r.json();
    return (j && j.documents) || [];
  }catch(e){ return []; }
}
```

- [ ] **2단계: 순수 함수 시험이 그대로 도는지 본다**

```bash
node tools/editor-test.js
```

기대: `실패 0`

- [ ] **3단계: 브라우저에서 실제로 불러 본다**

`node tools/serve.js` 로 띄우고 `http://127.0.0.1:8765` 콘솔에서:

```js
naviKey('여기에_REST_키');
(await findPlace('돈사돈', 'food')).map(d => d.place_name + ' / ' + d.category_name);
```

기대: 제주 안의 식당이 나오고 `category_name` 이 전부 음식점·카페다.

```js
naviKey(''); await findPlace('돈사돈', 'food');
```

기대: `[]`

- [ ] **4단계: 커밋**

```bash
git add index.html
git commit -m "카카오 장소 검색 함수를 넣음"
```

---

## Task 3: 공유 목록을 받아 얹는다

**여기가 이 계획의 뼈대다.** 배포판 목록을 스냅숏해 두고, 공유 기록을 그 위에 다시 얹는다.
몇 번 얹어도 같은 결과가 나와야 한다.

**파일:**
- 수정: `index.html` (계산 블록 뒤에 공유 블록을 새로 만든다)
- 수정: `tools/editor-test.js`

**내보내는 것:** `shareApply(원본, 기록) → 배열` · `shareFetch()` · `sharePost(...)` · `myName()`

- [ ] **1단계: 실패하는 시험을 쓴다**

`shareApply` 만 순수하게 떼어 시험한다. 나머지는 네트워크라 브라우저에서 본다.

```js
    ' __out.shareApply=shareApply;' +
```

```js
console.log('\n[공유 기록 얹기]');
const 원본 = [{ n:'가', ll:[33.1,126.1] }, { n:'나', ll:[33.2,126.2] }];
const 기록 = [
  { id:'1', who:'엄마', act:'add', kind:'food', rec:{ n:'다', ll:[33.3,126.3] } },
  { id:'2', who:'아빠', act:'add', kind:'food', rec:{ n:'라', ll:[33.4,126.4] } },
  { id:'3', who:'엄마', act:'del', kind:'food', n:'다' },
  { id:'4', who:'아빠', act:'del', kind:'food', n:'가' },
];
const 결과 = API.shareApply(원본, 기록, 'food');
확인('원본 둘 + 넣은 둘 - 뺀 하나 = 셋', 결과.length, 3);
확인('배포판 장소는 못 지운다', 결과.some(x => x.n === '가'), true);
확인('넣었다 뺀 것은 없다', 결과.some(x => x.n === '다'), false);
확인('남은 것은 있다', 결과.some(x => x.n === '라'), true);
확인('넣은 사람이 붙는다', 결과.find(x => x.n === '라').누가, '아빠');
확인('다른 갈래 기록은 안 섞인다', API.shareApply(원본, 기록, 'spot').length, 2);
확인('두 번 얹어도 같다', API.shareApply(원본, 기록, 'food').length, 3);
확인('기록이 없으면 원본 그대로', API.shareApply(원본, [], 'food').length, 2);
```

- [ ] **2단계: 시험을 돌려 실패를 확인한다**

```bash
node tools/editor-test.js
```

기대: `계산 블록 실행 실패: shareApply is not defined`

- [ ] **3단계: 얹는 함수를 쓴다**

계산 블록 안에 넣는다(순수 함수라 여기 있어야 시험이 된다).

```js
/* 배포판 목록 위에 공유 기록을 얹어 최종 목록을 만든다.
   원본을 건드리지 않고 새 배열을 내므로 몇 번 얹어도 같은 결과가 나온다.
   지우기는 기록으로 들어온 것만 지운다 — 배포판 48곳·51곳은 일정이 그 위에 서 있다. */
function shareApply(원본, 기록, 갈래){
  const 목록 = (원본 || []).slice();
  (기록 || []).forEach(function(줄){
    if(!줄 || 줄.kind !== 갈래) return;
    if(줄.act === 'add'){
      if(!줄.rec || !줄.rec.n) return;
      if(목록.some(function(x){ return x.n === 줄.rec.n; })) return;
      const 것 = Object.assign({}, 줄.rec);
      것.누가 = 줄.who || '';
      것.기록 = 줄.id;
      목록.push(것);
    }else if(줄.act === 'del'){
      const i = 목록.findIndex(function(x){ return x.n === 줄.n && x.기록; });
      if(i >= 0) 목록.splice(i, 1);
    }
  });
  return 목록;
}
```

- [ ] **4단계: 시험을 돌려 통과를 확인한다**

```bash
node tools/editor-test.js
```

기대: `실패 0`

- [ ] **5단계: 공유 서버와 이야기하는 부분을 쓴다**

계산 블록 **밖**(DOM 을 쓰는 쪽)에 넣는다. `<도메인>` 과 `<약속어>` 는 서버 계획에서 나온 값이다.

```js
/* 공유 목록. 진짜 값은 서버에 있고 localStorage 는 인터넷이 없을 때 쓰는 캐시일 뿐이다. */
const SHARE_URL = 'https://<도메인>/jeju/places';
const SHARE_WORD = '<약속어>';
const SHARE_CACHE = 'jeju.share';
const SPOT0 = SPOT.slice(), FOOD0 = FOOD.slice();   /* 배포판 원본. 절대 바꾸지 않는다 */
let 공유기록 = [], 공유rev = -1;

function shareCacheLoad(){
  try{
    const o = JSON.parse(localStorage.getItem(SHARE_CACHE) || 'null');
    if(o && Array.isArray(o.log)){ 공유기록 = o.log; 공유rev = o.rev | 0; }
  }catch(e){}
}
function shareCacheSave(){
  try{ localStorage.setItem(SHARE_CACHE, JSON.stringify({ rev:공유rev, log:공유기록 })); }catch(e){}
}
/* 받은 기록을 목록에 얹고 화면을 다시 그린다. */
function shareRedraw(){
  const s = shareApply(SPOT0, 공유기록, 'spot');
  const f = shareApply(FOOD0, 공유기록, 'food');
  SPOT.length = 0; Array.prototype.push.apply(SPOT, s);
  FOOD.length = 0; Array.prototype.push.apply(FOOD, f);
  if(typeof renderSpot === 'function') renderSpot();
  if(typeof renderFood === 'function') renderFood();
  if(typeof redrawMap === 'function') redrawMap();
}
/* 서버에서 받아 온다. 안 바뀌었으면 서버가 same:true 만 보내 싸게 끝난다.
   인터넷이 없으면 조용히 지나간다 — 캐시가 이미 얹혀 있다. */
async function shareFetch(){
  try{
    const r = await fetch(SHARE_URL + '?rev=' + 공유rev, { cache:'no-store' });
    if(!r.ok) return false;
    const j = await r.json();
    if(j.same) return false;
    공유기록 = j.log || []; 공유rev = j.rev | 0;
    shareCacheSave(); shareRedraw();
    return true;
  }catch(e){ return false; }
}
/* 한 건 보낸다. 서버가 새 기록을 통째로 돌려주므로 그대로 얹는다. */
async function sharePost(act, kind, 값){
  const 몸 = { word:SHARE_WORD, who:myName(), act:act, kind:kind };
  if(act === 'add') 몸.rec = 값; else 몸.n = 값;
  try{
    const r = await fetch(SHARE_URL, { method:'POST',
      headers:{ 'Content-Type':'application/json' }, body:JSON.stringify(몸) });
    const j = await r.json();
    if(!r.ok) return { error: j.error || '보내지 못했습니다' };
    공유기록 = j.log || []; 공유rev = j.rev | 0;
    shareCacheSave(); shareRedraw();
    return { ok:true };
  }catch(e){ return { error:'인터넷이 없습니다' }; }
}
/* 넣은 사람 이름. 로그인이 아니라 표시용이다. */
function myName(){
  try{
    let n = localStorage.getItem('jeju.who') || '';
    if(!n){ n = (prompt('이름을 알려 주세요 (누가 넣었는지 표시됩니다)') || '').trim().slice(0, 20); 
      if(n) localStorage.setItem('jeju.who', n); }
    return n;
  }catch(e){ return ''; }
}
```

- [ ] **6단계: 앱을 열 때 부른다**

첫 `render()` **앞**에 넣는다.

```js
shareCacheLoad(); shareRedraw(); shareFetch();
```

탭을 바꿀 때도 한 번 물어본다. `setMode()` 끝에 넣는다.

```js
  if(m === 'spot' || m === 'food') shareFetch();
```

- [ ] **7단계: 브라우저에서 확인한다**

```js
공유rev; 공유기록.length;
```

기대: 서버의 값과 같다.

```js
SPOT.length; FOOD.length;
```

기대: 기록이 비어 있으면 48 과 51.

인터넷을 끊고 새로고침한다 → **목록이 그대로 보이고 오류가 없다.**

- [ ] **8단계: 커밋**

```bash
git add index.html tools/editor-test.js
git commit -m "가족 공유 장소 목록을 받아 얹게 함"
```

---

## Task 4: 편집 모드의 검색칸과 결과 목록

**파일:**
- 수정: `index.html` (편집 띠 HTML · 스타일 · 편집기 스크립트)

**쓰는 것:** `findPlace`(Task 2) · `curMode`·`setMode`(이미 있음)

- [ ] **1단계: 편집 띠에 검색 구역을 넣는다**

`<div class="editbar" id="editbar" hidden>` 의 닫는 `</div>` 바로 앞:

```html
  <span class="eplace" id="eplace" hidden>
    <input type="search" id="eq" placeholder="장소 이름" autocomplete="off" spellcheck="false">
    <button type="button" id="ego">찾기</button>
  </span>
```

편집 띠 바로 뒤(`<div class="infozone">` 앞). **지도 위가 아니다.**

```html
<div class="eresult" id="eresult" hidden></div>
```

- [ ] **2단계: 스타일을 넣는다**

```css
.editbar .eplace{display:flex;gap:5px;align-items:center}
.editbar .eplace[hidden]{display:none}
.editbar .eplace input{
  font-family:inherit;font-size:11.5px;padding:4px 7px;width:130px;
  border:1px solid var(--line);border-radius:6px;background:#fff;color:var(--ink2)
}
.eresult{max-width:520px;margin:0 auto;padding:0 14px}
.eresult[hidden]{display:none}
.eresult .erow{
  display:flex;align-items:center;gap:8px;
  padding:8px 10px;border:1px solid var(--line);border-radius:8px;
  background:#fff;margin-bottom:6px;font-size:12.5px;cursor:pointer
}
.eresult .erow .en{font-weight:600;color:var(--ink)}
.eresult .erow .ea{color:var(--faint);font-size:11px;margin-left:auto;text-align:right}
.eresult .erow .eadd{
  appearance:none;cursor:pointer;font-family:inherit;font-size:13px;line-height:1;
  padding:5px 9px;border-radius:6px;border:1px solid var(--sea);
  background:#fff;color:var(--sea);flex:0 0 auto
}
.eresult .emsg{color:var(--faint);font-size:12px;padding:4px 2px}
```

- [ ] **3단계: 검색을 붙인다**

```js
let 검색결과 = [];
/* 편집 모드에서 탭에 맞는 구역만 보인다. 일정 탭이면 일정 편집, 아니면 장소 검색. */
function eplaceSync(){
  const 켬 = !document.getElementById('editbar').hidden;
  const 장소탭 = curMode === 'spot' || curMode === 'food';
  document.getElementById('eplace').hidden = !(켬 && 장소탭);
  if(!(켬 && 장소탭)){ document.getElementById('eresult').hidden = true; 검색결과 = []; }
}
async function 장소찾기(){
  const box = document.getElementById('eresult');
  box.hidden = false;
  box.innerHTML = '<p class="emsg">찾는 중…</p>';
  if(!naviKey()){ box.innerHTML = '<p class="emsg">카카오 REST 키를 먼저 넣어 주세요.</p>'; return; }
  검색결과 = await findPlace(document.getElementById('eq').value, curMode);
  if(!검색결과.length){ box.innerHTML = '<p class="emsg">찾지 못했습니다.</p>'; return; }
  box.innerHTML = 검색결과.map(function(d, i){
    return '<div class="erow" data-ei="' + i + '">'
      + '<span class="en">' + d.place_name + '</span>'
      + '<span class="ea">' + (d.road_address_name || d.address_name || '') + '</span>'
      + '<button type="button" class="eadd" data-ei="' + i + '" aria-label="목록에 넣기">+</button>'
      + '</div>';
  }).join('');
}
document.getElementById('ego').addEventListener('click', 장소찾기);
document.getElementById('eq').addEventListener('keydown', function(e){ if(e.key === 'Enter') 장소찾기(); });
```

`setMode()` 끝과 편집 띠를 여닫는 곳에서 `eplaceSync()` 를 부른다.

- [ ] **4단계: 결과를 누르면 지도만 그 자리로 가게 한다**

```js
document.getElementById('eresult').addEventListener('click', function(e){
  if(e.target.closest('.eadd')) return;      /* 넣기 버튼은 여기서 처리하지 않는다 */
  const row = e.target.closest('.erow');
  if(!row) return;
  const d = 검색결과[+row.dataset.ei];
  if(!d) return;
  map.setView([Number(d.y), Number(d.x)], 15, { animate:false });
});
```

- [ ] **5단계: 브라우저에서 확인한다**

1. 여행지 탭 → 범례의 `#` → **검색칸이 보인다.** 일정 탭으로 옮기면 **사라진다.**
2. 맛집 탭에서 식당을 찾는다 → 결과가 지도 **아래**에 나온다.
3. 결과 줄을 누른다 → **지도만 그 자리로 간다. 화면이 스크롤되지 않는다.**
4. 편집기를 닫는다 → **검색칸과 결과가 모두 사라진다.**

- [ ] **6단계: 커밋**

```bash
git add index.html
git commit -m "편집 모드에 장소 검색칸과 결과 목록을 넣음"
```

---

## Task 5: 목록에 넣기

**파일:**
- 수정: `index.html` (편집기 스크립트)

**쓰는 것:** `toSpot`·`toFood`(Task 1) · `sharePost`(Task 3)

- [ ] **1단계: `+` 를 붙인다**

```js
document.getElementById('eresult').addEventListener('click', async function(e){
  const btn = e.target.closest('.eadd');
  if(!btn) return;
  e.stopPropagation();
  const d = 검색결과[+btn.dataset.ei];
  if(!d) return;
  const 맛집 = curMode === 'food';
  if((맛집 ? FOOD : SPOT).some(function(x){ return x.n === d.place_name; })){
    btn.textContent = '있음'; return;
  }
  const 새것 = 맛집 ? toFood(d) : toSpot(d);
  if(!새것) return;
  btn.disabled = true; btn.textContent = '…';
  const r = await sharePost('add', 맛집 ? 'food' : 'spot', 새것);
  if(r.error){ btn.disabled = false; btn.textContent = '+'; alert(r.error); return; }
  btn.textContent = '넣음';
});
```

`sharePost` 가 성공하면 `shareRedraw()` 가 목록과 지도를 다시 그린다. 여기서 따로
`renderFood()` 를 부르지 않는다 — 두 곳에서 그리면 어느 쪽이 진짜인지 알 수 없게 된다.

- [ ] **2단계: 브라우저에서 확인한다**

1. 맛집 탭 편집 모드에서 식당을 찾아 `+` 를 누른다
2. 이름을 묻는 창이 한 번 뜬다(처음만). 이름을 넣는다
3. **목록에 카드가 생기고 지도에 점이 하나 는다**
4. 카드를 누른다 → **지도만 그 자리로 간다** (기존 규칙 그대로)
5. 같은 곳을 다시 `+` → `있음` 으로 바뀐다

- [ ] **3단계: 다른 기기에서 보이는지 확인한다 — 이 기능의 핵심**

휴대폰으로 `https://hanbrook3.github.io/jeju-trip/` 를 연다.

기대: **방금 넣은 곳이 그대로 보인다.**

- [ ] **4단계: 커밋**

```bash
git add index.html
git commit -m "찾은 장소를 가족 공유 목록에 넣는 기능을 넣음"
```

---

## Task 6: 목록에서 빼기

**이 계획에서 가장 틀리기 쉬운 곳이다.** 카드를 누르면 지도가 움직이는 기존 동작을
건드리지 않아야 한다.

**파일:**
- 수정: `index.html` (`renderSpotCards`·`renderFoodCards` · 스타일 · 편집기 스크립트)

- [ ] **1단계: 카드에 손잡이와 넣은 사람을 넣는다**

`renderSpotCards` 의 `<summary class="fhead2">` 안, `<svg class="chev"` **앞**:

```js
        ${s.기록 ? `<button type="button" class="fdel" data-del="${s.n}" aria-label="목록에서 빼기">−</button>` : ''}
```

`<span class="ftit">` 안, 이름 뒤:

```js
        ${s.누가 ? `<span class="fwho">${s.누가}</span>` : ''}
```

`renderFoodCards` 에도 같은 두 줄을 넣는다. **`s.기록` 이 있는 것만 손잡이가 붙는다** —
배포판 48곳·51곳에는 붙지 않으므로 가족이 지울 수 없다.

- [ ] **2단계: 평소에는 숨긴다**

```css
.fdel{
  appearance:none;cursor:pointer;font-family:inherit;font-size:14px;line-height:1;
  padding:3px 8px;margin-right:4px;border-radius:6px;
  border:1px solid var(--line);background:#fff;color:var(--faint);flex:0 0 auto;
  display:none
}
body.editing .fdel{display:inline-block}
.fwho{margin-left:5px;font-size:10.5px;color:var(--faint)}
```

편집 띠를 여닫을 때 `document.body.classList.toggle('editing', 켬)` 을 부른다.

- [ ] **3단계: 일정에 쓰이는지 보는 함수를 만든다**

계산 블록에 넣는다(순수 함수).

```js
/* 이 이름이 일정의 정차지로 쓰이고 있나. 쓰이는 곳은 뺄 수 없다 —
   빼면 일정에 좌표도 정보도 없는 이름만 남는다. */
function usedInPlan(D, 이름){
  for(let i = 0; i < (D || []).length; i++){
    const s = D[i].stops || [];
    for(let j = 0; j < s.length; j++) if(s[j].n === 이름) return i + 1;
  }
  return 0;
}
```

시험도 함께 넣는다.

```js
    ' __out.usedInPlan=usedInPlan;' +
```

```js
console.log('\n[일정에 쓰이는 장소]');
const 가짜D = [{ stops:[{ n:'가' }, { n:'나' }] }, { stops:[{ n:'다' }] }];
확인('1일차에 있으면 1', API.usedInPlan(가짜D, '가'), 1);
확인('2일차에 있으면 2', API.usedInPlan(가짜D, '다'), 2);
확인('없으면 0', API.usedInPlan(가짜D, '라'), 0);
```

- [ ] **4단계: 눌러도 카드가 열리거나 지도가 움직이지 않게 한다**

```js
document.addEventListener('click', async function(e){
  const btn = e.target.closest('.fdel');
  if(!btn) return;
  e.preventDefault();               /* details 가 열리는 것을 막는다 */
  e.stopPropagation();              /* 카드 클릭 → 지도 이동 을 막는다 */
  const 이름 = btn.dataset.del;
  const 날 = usedInPlan(D, 이름);
  if(날){ alert(날 + '일차 일정에 쓰이고 있어 뺄 수 없습니다.'); return; }
  btn.disabled = true;
  const r = await sharePost('del', curMode === 'food' ? 'food' : 'spot', 이름);
  if(r.error){ btn.disabled = false; alert(r.error); }
}, true);
```

- [ ] **5단계: 겹치지 않는지 확인한다 — 이 작업의 핵심**

1. **편집 모드가 아닐 때** 카드를 본다 → **`−` 가 보이지 않는다**
2. 편집 모드에 들어간다 → 가족이 넣은 카드에만 `−` 가 나타난다.
   **배포판 48곳·51곳에는 없다**
3. 카드의 **이름 부분**을 누른다 → 카드가 열리고 지도가 그 자리로 간다 (**기존 동작 그대로**)
4. **`−` 를 누른다** → 카드가 사라진다. **지도가 움직이지 않고 다른 카드가 열리지 않는다**
5. 지도 점을 누른다 → 그 카드가 열린다 (**기존 동작 그대로**)

콘솔로도 잰다.

```js
const 전 = map.getCenter();
document.querySelector('.fdel').click();
await new Promise(r => setTimeout(r, 1200));
const 후 = map.getCenter();
console.log('지도가 안 움직였나', 전.lat === 후.lat && 전.lng === 후.lng);
```

기대: `true`

- [ ] **6단계: 일정에 쓰이는 곳이 막히는지 본다**

일정에 있는 장소를 목록에 넣고(같은 이름) 빼 보려 한다.

기대: `N일차 일정에 쓰이고 있어 뺄 수 없습니다.` 가 나오고 지워지지 않는다.

- [ ] **7단계: 커밋**

```bash
git add index.html tools/editor-test.js
git commit -m "가족이 넣은 장소를 목록에서 빼는 기능을 넣음"
```

---

## Task 7: 일정에서 고를 수 있는 장소를 목록으로 한정한다

일정 편집기(1단계 Task 11 이후)에서 장소를 고를 때 **여행지 탭·맛집 탭 목록에 있는
것만** 고르게 한다. 목록에 없는 곳을 일정에 넣으면 좌표도 정보도 없이 이름만 남는다.

**파일:**
- 수정: `index.html` (일정 편집기의 장소 고르기)
- 수정: `docs/superpowers/specs/2026-08-28-schedule-editor-design.md`

- [ ] **1단계: 고를 수 있는 목록을 만드는 함수를 넣는다**

```js
/* 일정에 넣을 수 있는 장소. 여행지·맛집 목록에 있는 것뿐이다.
   공유 기록이 얹힌 뒤의 SPOT·FOOD 를 보므로 가족이 넣은 곳도 바로 고를 수 있다. */
function planChoices(){
  return SPOT.map(function(s){ return { n:s.n, ll:s.ll, pk:s.pk, 갈래:'여행지' }; })
    .concat(FOOD.map(function(f){ return { n:f.n, ll:f.ll, 갈래:'맛집' }; }));
}
```

- [ ] **2단계: 장소 고르기가 이 목록만 쓰게 한다**

일정 편집기의 장소 검색 자리를 찾는다.

```bash
grep -n -o -E ".{0,60}(SPOT|FOOD)\.(filter|find|map).{0,60}" index.html
```

일정 편집 쪽에서 목록을 만드는 자리를 `planChoices()` 로 바꾼다.
**직접 입력은 좌표 없는 정차지(휴게소·체크아웃)에만 남긴다.** 맛집·여행지로는 목록만.

- [ ] **3단계: 목록에 없으면 안내한다**

고르기 화면에서 찾지 못했을 때:

```
목록에 없습니다. 여행지·맛집 탭에서 먼저 넣어 주세요.
```

- [ ] **4단계: 브라우저에서 확인한다**

1. 일정 편집에서 장소를 고른다 → **48+51+가족이 넣은 것**이 다 나온다
2. 목록에 없는 이름을 친다 → 안내가 나오고 고를 수 없다
3. 맛집 탭에서 하나 넣고 다시 일정 고르기를 연다 → **방금 넣은 곳이 나온다**

- [ ] **5단계: 설계 문서를 맞춘다**

§2 의 `장소 선택` 줄을 고친다.

```markdown
| 장소 선택 | **여행지·맛집 목록에서만** | 목록에 있는 곳은 좌표와 정보가 있어 이동시간이 바로 계산된다. 목록에 없으면 여행지·맛집 탭에서 먼저 넣는다. 휴게소·체크아웃처럼 장소가 아닌 정차지는 이름만 고친다 |
```

- [ ] **6단계: 커밋**

```bash
git add index.html docs/superpowers/specs/2026-08-28-schedule-editor-design.md
git commit -m "일정에서 고를 수 있는 장소를 여행지·맛집 목록으로 한정함"
```

---

## Task 8: 회귀 점검과 문서

**파일:**
- 수정: `tools/regression-check.js` (기대값 주석)
- 수정: `HANDOVER.md`

- [ ] **1단계: 회귀 점검을 깨끗한 상태에서 돌리게 한다**

`tools/regression-check.js` 머리말에 한 줄 더한다.

```
   주의: 가족이 넣은 장소가 있으면 점갈래 숫자가 달라진다. 점검 전에
   localStorage.removeItem('jeju.share') 후 인터넷을 끊고 새로고침할 것.
   (인터넷이 있으면 서버에서 다시 받아 온다)
```

- [ ] **2단계: 깨끗한 상태에서 돌린다**

인터넷을 끊고:

```js
localStorage.removeItem('jeju.share'); location.reload();
```

그 뒤 `tools/regression-check.js` 를 붙여 넣는다.
기대: 배지불일치 0 · 핀합계 30 · 점갈래_일정 {여행지 48, 명소 35, 맛집 51} · 오류 []

- [ ] **3단계: HANDOVER 에 적는다**

```markdown
### 가족 공유 맛집·여행지 목록

가족이 각자 카카오 장소 검색으로 넣고 뺀 것이 **모든 기기에서 같게 보인다.**
저장소는 오라클 VM 의 `/opt/jeju-api` 이고 Caddy 가 `/jeju/*` 로 넘긴다
(`docs/superpowers/plans/2026-08-28-shared-place-store-server.md`).

**배포판 48곳·51곳은 가족이 지울 수 없다.** 카드에 `−` 가 붙는 것은 공유 기록으로
들어온 것뿐이다. 일정에 쓰이는 장소도 뺄 수 없다 — 빼면 일정에 이름만 남는다.

**localStorage 는 캐시일 뿐이다.** 진짜 값은 서버에 있다. 인터넷이 없으면 마지막으로
받아 둔 것을 보여 준다.

이상한 기록이 들어오면 VM 의 `/opt/jeju-api/places.json` 에서 그 줄을 지우고
`pm2 restart jeju-api` 하면 된다. 덧붙이기만 하므로 무엇도 영구히 잃지 않는다.

**평소 화면은 달라지지 않는다.** 검색칸과 `−` 는 `#` 로 편집 모드에 들어갔을 때만 보인다.
```

- [ ] **4단계: 커밋**

```bash
git add tools/regression-check.js HANDOVER.md
git commit -m "가족 공유 장소 목록을 문서에 반영함"
```

---

## 확인 기준

1. **편집 모드가 아닐 때 화면이 지금과 똑같다.** 검색칸도 `−` 도 보이지 않는다.
2. 맛집 탭에서 찾으면 음식점·카페만, 제주 안에서만 나온다.
3. 검색 결과 줄을 누르면 **지도만** 그 자리로 간다.
4. `+` 를 누르면 카드와 지도 점이 는다.
5. **다른 기기에서 새로고침하면 그것이 보인다.**
6. **`−` 를 눌러도 지도가 움직이지 않고 카드가 열리지 않는다.**
7. 배포판 48곳·51곳에는 `−` 가 붙지 않는다.
8. 일정에 쓰이는 장소는 빼려 하면 막힌다.
9. 카드에 넣은 사람 이름이 보인다.
10. 인터넷을 끊어도 마지막 목록이 그대로 보이고 오류가 없다.
11. 일정 편집의 장소 고르기에 여행지·맛집 목록만 나온다.
12. 깨끗한 상태에서 회귀 점검 전 항목이 기대값 그대로다.
13. 카카오 키가 없으면 "키를 먼저 넣어 주세요" 가 나오고 앱은 멀쩡하다.
14. `git log -p` 어디에도 카카오 32자리 키가 없다.

## 이 계획에 없는 것

- **가족이 일정을 고치는 것.** 일정은 나만 고친다(설계 문서 §2).
- **넣은 장소의 설명·차림표·사진.** 카카오가 주지 않는다. 손으로 채운다.
- **여행지 분류 자동 판정.** `직접 추가` 로 두고 손으로 옮긴다. 카카오 분류를
  우리 분류로 자동으로 매기면 틀린 것이 조용히 섞인다.
- **가족마다 다른 열쇠.** 서버 계획의 판단을 그대로 따른다.
