# 가족 공유 장소 저장소 (오라클) — 구현 계획

> **에이전트에게:** 이 계획은 `superpowers:subagent-driven-development` 또는
> `superpowers:executing-plans` 로 한 작업씩 실행한다. 단계는 `- [ ]` 로 추적한다.

**목표:** 가족이 각자 넣고 뺀 맛집·여행지가 **모든 기기에서 같게 보이도록** 하는
작은 공유 저장소를 이미 쓰고 있는 오라클 VM 에 얹는다.

**방식:** 덧붙이기만 하는 기록(log) 하나를 파일로 둔다. 앱은 그 기록을 받아 배포판
48곳·51곳 위에 얹어 최종 목록을 만든다. 데이터베이스를 쓰지 않는다 — 기록이 수십 줄이라
파일 한 장이면 충분하고, 되돌리기가 줄 지우기로 끝난다.

**쓰는 것:** Node(의존성 없음, `http`·`fs` 만) · PM2 · Caddy · JSON 파일

## 왜 깃허브가 아닌가

2026-08-28 실제로 확인했다.

| 시도 | 결과 |
|---|---|
| `raw.githubusercontent.com` 읽기 | 200 · CORS 통과 |
| `api.github.com` 저장소 읽기 | 200 |
| `api.github.com` 파일 쓰기 (토큰 없이) | **401 Requires authentication** |

깃허브에 쓰려면 쓰기 권한 토큰이 있어야 한다. **공개 저장소로 배포되는 정적 페이지에
토큰을 넣으면 그걸 읽은 누구나 저장소를 고칠 수 있다.** 세밀한 권한 토큰으로 범위를
좁혀도 그 저장소는 통째로 열린다. 읽기만 필요하면 깃허브로 충분하지만 이 기능은 쓰기가
있어야 하므로 안 된다.

## 어디에 얹나

이미 도는 것을 건드리지 않는다.

```
        가족 휴대폰
            │  https
            ▼
   <도메인>.duckdns.org  ── Caddy(443) ┬─ /mcp   → localhost:3000  (기존 V-World MCP)
                                       └─ /jeju/*→ localhost:3010  (새 공유 저장소)
```

- **기존 MCP 서버(포트 3000, PM2 `vworld-mcp`)를 건드리지 않는다.** 새 프로세스를
  포트 3010 에 따로 띄운다. 하나가 죽어도 다른 하나가 산다.
- 포트 3010 은 외부에 열지 않는다. Caddy 만 들어간다 (기존 3000 과 같은 방식).
- 방화벽·보안목록을 바꾸지 않는다. 이미 열린 443 을 나눠 쓴다.

## 전체 제약

- **기존 V-World MCP 를 멈추거나 고치지 않는다.** 새 PM2 프로세스로만 붙인다.
- 오라클 콘솔의 보안 설정을 바꾸지 않는다 (이미 443 이 열려 있다).
- Node 의존성을 설치하지 않는다. 표준 모듈만 쓴다.
- 기록은 **덧붙이기만 한다.** 지우거나 덮어쓰지 않는다 — 되돌릴 수 있어야 한다.
- 도메인·키를 계획서나 커밋에 적지 않는다. 서버에서 읽어 쓴다.

## 얼마나 열려 있는가 — 정직하게

**이 끝점은 사실상 공개다.** 주소가 공개 저장소의 `index.html` 에 들어가므로, 그것을 읽은
사람은 누구나 목록에 무언가를 넣을 수 있다. 브라우저의 출처 검사(CORS)는 다른 사이트의
스크립트를 막을 뿐, `curl` 은 막지 못한다.

가족 여행 목록이라 피해가 크지 않고, 아래 세 가지로 충분하다고 본다.

1. **덧붙이기만 하는 기록.** 무엇도 지워지지 않으므로 이상한 것이 들어와도 그 줄만 빼면 된다.
2. **크기 제한.** 한 번에 하나, 이름 40자, 전체 300개까지. 넘치면 거절한다.
3. **약속어.** 앱이 보내는 짧은 단어를 서버가 확인한다. 지나가는 스크립트는 막힌다
   (소스를 읽은 사람은 못 막는다 — 그건 이 구조로는 불가능하다).

더 조여야 한다면 방법은 하나뿐이다 — 가족에게 각자 다른 열쇠를 나눠 주고 서버가 그것을
확인하는 것. 지금은 과하다고 보고 넣지 않는다.

## 자료 모양

`/opt/jeju-api/places.json`

```json
{
  "rev": 3,
  "log": [
    { "id":"1787900000-a1", "t":1787900000, "who":"엄마", "act":"add", "kind":"food",
      "rec":{ "n":"○○국수", "zone":"제주시내", "theme":"직접 추가", "kind":"식당",
              "ll":[33.5,126.5], "addr":"…", "tel":"064-…", "menu":[], "note":"",
              "main":"", "pick":false, "rate":"" } },
    { "id":"1787900100-b2", "t":1787900100, "who":"아빠", "act":"del", "kind":"food",
      "n":"○○국수" }
  ]
}
```

- `rev` 는 기록이 늘 때마다 1 오른다. 앱이 "바뀐 게 있나" 를 싸게 물어보는 데 쓴다.
- `act:'del'` 은 **기록으로 들어온 장소만** 지운다. 배포판 48곳·51곳은 이 기록으로 지울 수
  없다 — 일정이 그 위에 서 있기 때문이다. 서버가 그것을 강제하지 않고 **앱이 지키며**,
  서버는 기록을 그대로 받아 둔다(기록은 판단하지 않는다).

## 파일

| 파일 | 하는 일 |
|---|---|
| `/opt/jeju-api/server.js` | 공유 저장소 서버 (VM) |
| `/opt/jeju-api/places.json` | 기록 (VM) |
| `/etc/caddy/Caddyfile` | `/jeju/*` 를 3010 으로 넘기는 줄 하나 |
| `tools/jeju-api/server.js` | 위 서버의 원본. 저장소에 두고 VM 으로 올린다 |

---

## Task 1: 서버를 쓰고 내 컴퓨터에서 시험한다

VM 에 올리기 전에 여기서 돌려 본다. 잘못 올려 기존 서비스를 흔들지 않기 위해서다.

**파일:**
- 신규: `tools/jeju-api/server.js`

**내보내는 것:** `GET /jeju/places` · `GET /jeju/health` · `POST /jeju/places`

- [ ] **1단계: 서버를 쓴다**

`tools/jeju-api/server.js`:

```js
/* 가족 공유 장소 저장소. 의존성 없이 http·fs 만 쓴다.
   덧붙이기만 하는 기록 한 장을 들고 있다가 통째로 내준다.
   지우지 않는 이유 — 이상한 것이 들어와도 그 줄만 빼면 되돌아가기 때문이다. */
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = Number(process.env.JEJU_PORT || 3010);
const FILE = process.env.JEJU_FILE || path.join(__dirname, 'places.json');
const 약속어 = process.env.JEJU_WORD || '';
const 허용출처 = ['https://hanbrook3.github.io', 'http://127.0.0.1:8765', 'http://localhost:8765'];
const 최대개수 = 300;

function 읽기(){
  try{ const o = JSON.parse(fs.readFileSync(FILE, 'utf8')); return { rev: o.rev | 0, log: o.log || [] }; }
  catch(e){ return { rev: 0, log: [] }; }
}
function 쓰기(o){
  const tmp = FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(o));
  fs.renameSync(tmp, FILE);   /* 통째로 갈아 끼워 반쯤 쓰인 파일이 남지 않게 한다 */
}
/* 들어온 것을 믿지 않는다. 모양이 맞지 않으면 이유를 붙여 돌려보낸다. */
function 검사(x){
  if(!x || typeof x !== 'object') return '내용이 없습니다';
  if(x.act !== 'add' && x.act !== 'del') return 'act 는 add 또는 del 이어야 합니다';
  if(x.kind !== 'spot' && x.kind !== 'food') return 'kind 는 spot 또는 food 여야 합니다';
  if(typeof x.who !== 'string' || x.who.length > 20) return '이름은 20자까지입니다';
  if(x.act === 'del'){
    if(typeof x.n !== 'string' || !x.n || x.n.length > 40) return '지울 이름이 잘못됐습니다';
    return null;
  }
  const r = x.rec;
  if(!r || typeof r !== 'object') return 'rec 가 없습니다';
  if(typeof r.n !== 'string' || !r.n || r.n.length > 40) return '이름이 잘못됐습니다';
  if(!Array.isArray(r.ll) || r.ll.length !== 2) return '좌표가 잘못됐습니다';
  const la = Number(r.ll[0]), lo = Number(r.ll[1]);
  if(!(la > 32.9 && la < 34.1 && lo > 125.9 && lo < 127.5)) return '제주 밖 좌표입니다';
  if(JSON.stringify(r).length > 4000) return '내용이 너무 깁니다';
  return null;
}
function 보내기(res, code, obj, origin){
  const h = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' };
  if(origin){ h['Access-Control-Allow-Origin'] = origin; h['Vary'] = 'Origin'; }
  res.writeHead(code, h);
  res.end(JSON.stringify(obj));
}

http.createServer(function(req, res){
  const origin = 허용출처.indexOf(req.headers.origin) >= 0 ? req.headers.origin : '';
  const u = new URL(req.url, 'http://x');

  if(req.method === 'OPTIONS'){
    res.writeHead(204, {
      'Access-Control-Allow-Origin': origin || 'null',
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
      'Vary': 'Origin'
    });
    return res.end();
  }

  if(u.pathname === '/jeju/health') return 보내기(res, 200, { ok: true, rev: 읽기().rev }, origin);

  if(u.pathname === '/jeju/places' && req.method === 'GET'){
    const 것 = 읽기();
    const rev = Number(u.searchParams.get('rev'));
    /* 바뀐 게 없으면 기록을 통째로 보내지 않는다 — 자주 물어도 싸게 끝난다 */
    if(Number.isFinite(rev) && rev === 것.rev) return 보내기(res, 200, { rev: 것.rev, same: true }, origin);
    return 보내기(res, 200, 것, origin);
  }

  if(u.pathname === '/jeju/places' && req.method === 'POST'){
    let 몸 = '';
    req.on('data', function(d){ 몸 += d; if(몸.length > 8000) req.destroy(); });
    req.on('end', function(){
      let x;
      try{ x = JSON.parse(몸); }catch(e){ return 보내기(res, 400, { error: 'JSON 이 아닙니다' }, origin); }
      if(약속어 && x.word !== 약속어) return 보내기(res, 403, { error: '약속어가 다릅니다' }, origin);
      const 잘못 = 검사(x);
      if(잘못) return 보내기(res, 400, { error: 잘못 }, origin);
      const 것 = 읽기();
      if(것.log.length >= 최대개수) return 보내기(res, 409, { error: '기록이 가득 찼습니다' }, origin);
      const 줄 = {
        id: Date.now() + '-' + Math.random().toString(36).slice(2, 6),
        t: Math.floor(Date.now() / 1000),
        who: x.who || '', act: x.act, kind: x.kind
      };
      if(x.act === 'add') 줄.rec = x.rec; else 줄.n = x.n;
      것.log.push(줄);
      것.rev++;
      쓰기(것);
      return 보내기(res, 200, 것, origin);
    });
    return;
  }

  보내기(res, 404, { error: '없는 주소입니다' }, origin);
}).listen(PORT, '127.0.0.1', function(){ console.log('jeju-api ' + PORT); });
```

- [ ] **2단계: 내 컴퓨터에서 띄운다**

```bash
node tools/jeju-api/server.js
```

기대 출력: `jeju-api 3010`

- [ ] **3단계: 빈 상태를 확인한다**

```bash
curl -s http://127.0.0.1:3010/jeju/places
```

기대: `{"rev":0,"log":[]}`

- [ ] **4단계: 한 건 넣어 본다**

```bash
curl -s -X POST http://127.0.0.1:3010/jeju/places -H "Content-Type: application/json" --data-binary @tools/jeju-api/sample-add.json
```

먼저 `tools/jeju-api/sample-add.json` 을 만든다. 한글이 명령줄에서 깨지는 것을 피하려고
파일로 보낸다 (윈도우에서 `curl` 이 인자를 코드페이지로 바꾼다).

```json
{ "who":"시험", "act":"add", "kind":"food",
  "rec":{ "n":"시험식당", "zone":"제주시내", "theme":"직접 추가", "kind":"식당",
          "ll":[33.5,126.5], "addr":"", "tel":"", "menu":[], "note":"", "main":"",
          "pick":false, "rate":"" } }
```

기대: `rev` 가 `1` 이고 `log` 에 한 줄이 들어 있다.

- [ ] **5단계: 잘못된 것이 막히는지 본다**

`tools/jeju-api/sample-bad.json` 을 만든다.

```json
{ "who":"시험", "act":"add", "kind":"food", "rec":{ "n":"서울집", "ll":[37.5,127.0] } }
```

```bash
curl -s -X POST http://127.0.0.1:3010/jeju/places -H "Content-Type: application/json" --data-binary @tools/jeju-api/sample-bad.json
```

기대: `{"error":"제주 밖 좌표입니다"}`

```bash
curl -s -X POST http://127.0.0.1:3010/jeju/places -H "Content-Type: application/json" -d "{\"act\":\"drop\",\"kind\":\"food\",\"who\":\"\"}"
```

기대: `{"error":"act 는 add 또는 del 이어야 합니다"}`

- [ ] **6단계: 안 바뀌었을 때 싸게 끝나는지 본다**

```bash
curl -s "http://127.0.0.1:3010/jeju/places?rev=1"
```

기대: `{"rev":1,"same":true}`

- [ ] **7단계: 시험 부스러기를 지우고 커밋한다**

```bash
rm -f tools/jeju-api/places.json tools/jeju-api/sample-bad.json
git add tools/jeju-api/server.js tools/jeju-api/sample-add.json
git commit -m "가족 공유 장소 저장소 서버를 만듦"
```

---

## Task 2: VM 에 올리고 PM2 로 띄운다

**기존 `vworld-mcp` 를 건드리지 않는다.** 새 프로세스로만 붙인다.

- [ ] **1단계: 접속 정보를 확인하고 지금 상태를 본다**

기존 배포 스크립트(`deploy.bat` · `update.bat`)에 적힌 접속 주소와 열쇠 파일을 그대로 쓴다.
**계획서에 옮겨 적지 않는다.**

```bash
ssh -i <열쇠> <사용자>@<VM주소> "pm2 status && ls /opt"
```

기대: `vworld-mcp` 가 `online`. **이것이 멈추면 안 된다.**

- [ ] **2단계: 자리를 만들고 올린다**

```bash
ssh -i <열쇠> <사용자>@<VM주소> "sudo mkdir -p /opt/jeju-api && sudo chown -R \$(whoami) /opt/jeju-api"
scp -i <열쇠> tools/jeju-api/server.js <사용자>@<VM주소>:/opt/jeju-api/server.js
```

- [ ] **3단계: 약속어를 만든다**

VM 에서 만들고 **어디에도 커밋하지 않는다.** 앱에도 같은 값이 들어가므로 한 번 보고 옮긴다.

```bash
ssh -i <열쇠> <사용자>@<VM주소> "openssl rand -hex 6"
```

나온 값을 아래에서 `<약속어>` 로 쓴다.

- [ ] **4단계: PM2 로 띄운다**

```bash
ssh -i <열쇠> <사용자>@<VM주소> "cd /opt/jeju-api && JEJU_WORD=<약속어> JEJU_FILE=/opt/jeju-api/places.json pm2 start server.js --name jeju-api && pm2 save"
```

- [ ] **5단계: VM 안에서 도는지 본다**

```bash
ssh -i <열쇠> <사용자>@<VM주소> "curl -s localhost:3010/jeju/health; echo; pm2 status"
```

기대: `{"ok":true,"rev":0}` 이 나오고 `vworld-mcp` 와 `jeju-api` 가 **둘 다** `online`.

- [ ] **6단계: 재부팅에도 살아남게 한다**

```bash
ssh -i <열쇠> <사용자>@<VM주소> "pm2 save && pm2 startup systemd | tail -2"
```

기대: 이미 설정돼 있다는 안내가 나온다(기존 MCP 때문에 되어 있다).
안 되어 있으면 안내된 명령을 그대로 실행한다.

---

## Task 3: Caddy 에 길을 낸다

- [ ] **1단계: 지금 설정을 본다**

```bash
ssh -i <열쇠> <사용자>@<VM주소> "sudo cat /etc/caddy/Caddyfile"
```

도메인 한 줄과 `reverse_proxy localhost:3000` 이 보인다. **그 도메인을 그대로 쓴다.**

- [ ] **2단계: 되돌릴 수 있게 백업한다**

```bash
ssh -i <열쇠> <사용자>@<VM주소> "sudo cp /etc/caddy/Caddyfile /etc/caddy/Caddyfile.bak"
```

- [ ] **3단계: `/jeju/*` 를 3010 으로 넘긴다**

도메인 블록 안, 기존 `reverse_proxy` **앞**에 넣는다. 순서가 중요하다 —
뒤에 두면 기존 규칙이 먼저 먹어 `/jeju/*` 가 MCP 로 간다.

```
	handle /jeju/* {
		reverse_proxy localhost:3010
	}
```

- [ ] **4단계: 문법을 보고 반영한다**

```bash
ssh -i <열쇠> <사용자>@<VM주소> "sudo caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile && sudo systemctl reload caddy && systemctl is-active caddy"
```

기대: `Valid configuration` 이 나오고 마지막 줄이 `active`.

- [ ] **5단계: 기존 MCP 가 멀쩡한지 먼저 본다**

```bash
ssh -i <열쇠> <사용자>@<VM주소> "curl -s localhost:3000/health | head -c 120"
```

기대: 기존 MCP 응답이 그대로 나온다.
**여기서 이상하면 백업(`Caddyfile.bak`)으로 되돌리고 멈춘다.**

- [ ] **6단계: 밖에서 닿는지 본다**

```bash
curl -s https://<도메인>/jeju/health
```

기대: `{"ok":true,"rev":0}`

---

## Task 4: 브라우저에서 닿는지 확인한다

서버끼리는 되는데 브라우저에서 막히는 일이 흔하다. 실제 원본에서 확인한다.

- [ ] **1단계: 배포된 앱 원본에서 읽어 본다**

`https://hanbrook3.github.io/jeju-trip/` 을 열고 콘솔에서:

```js
await (await fetch('https://<도메인>/jeju/places')).json();
```

기대: `{rev: 0, log: []}` — 오류 없이 나온다.

- [ ] **2단계: 써 본다**

```js
await (await fetch('https://<도메인>/jeju/places', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ word: '<약속어>', who: '시험', act: 'add', kind: 'food',
    rec: { n: '브라우저시험', ll: [33.5, 126.5] } })
})).json();
```

기대: `rev` 가 1 오르고 `log` 에 들어간다.

- [ ] **3단계: 약속어가 틀리면 막히는지 본다**

```js
(await fetch('https://<도메인>/jeju/places', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ word: '틀린값', who: '시험', act: 'add', kind: 'food',
    rec: { n: '막혀야함', ll: [33.5, 126.5] } })
})).status;
```

기대: `403`

- [ ] **4단계: 다른 사이트에서는 막히는지 본다**

`https://example.com` 을 열고 1단계의 `fetch` 를 그대로 해 본다.

기대: CORS 오류가 난다. **막히는 것이 맞다.**

- [ ] **5단계: 시험 기록을 지운다**

```bash
ssh -i <열쇠> <사용자>@<VM주소> "cd /opt/jeju-api && cp places.json places.json.bak && printf '{\"rev\":0,\"log\":[]}' > places.json && pm2 restart jeju-api"
```

```bash
curl -s https://<도메인>/jeju/places
```

기대: `{"rev":0,"log":[]}`

- [ ] **6단계: 커밋할 것이 있는지 본다**

서버 코드는 Task 1 에서 커밋했다. 여기서는 없다.
`<도메인>` 과 `<약속어>` 는 다음 계획(앱 쪽)에서 `index.html` 에 들어간다.

---

## 확인 기준

1. `pm2 status` 에 `vworld-mcp` 와 `jeju-api` 가 둘 다 `online`.
2. `curl -s localhost:3000/health` — 기존 MCP 가 그대로 답한다.
3. `curl -s https://<도메인>/jeju/health` — `{"ok":true,...}`.
4. 배포된 앱 원본에서 읽기·쓰기가 된다.
5. 약속어가 틀리면 403.
6. 다른 사이트에서는 CORS 로 막힌다.
7. 제주 밖 좌표·잘못된 `act`·너무 긴 내용이 거절된다.
8. `?rev=` 가 같으면 `same:true` 만 돌아온다.
9. VM 을 재부팅해도 둘 다 다시 뜬다.
10. 계획서·커밋 어디에도 도메인·약속어·열쇠가 없다.

## 이 계획에 없는 것

- **가족마다 다른 열쇠.** 지금은 약속어 하나를 함께 쓴다. 소스를 읽은 사람은 막지 못하지만
  가족 여행 목록이라 그 위험을 받아들인다(위 "얼마나 열려 있는가").
- **실시간 밀어주기.** 앱이 열릴 때와 탭을 바꿀 때 물어보는 것으로 충분하다.
  웹소켓을 쓰지 않는다.
- **데이터베이스.** 기록이 수십 줄이라 파일 한 장이면 된다.
- **되돌리기 화면.** 이상한 기록은 VM 에서 `places.json` 의 그 줄을 지우고
  `pm2 restart jeju-api` 하면 된다.
