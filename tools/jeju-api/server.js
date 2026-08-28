/* 가족 공유 장소 저장소. 의존성 없이 http·fs 만 쓴다.
   덧붙이기만 하는 기록 한 장을 들고 있다가 통째로 내준다.
   지우지 않는 이유 — 이상한 것이 들어와도 그 줄만 빼면 되돌아가기 때문이다.

   띄우기:  JEJU_WORD=<약속어> JEJU_FILE=/opt/jeju-api/places.json node server.js
   확인:    curl -s localhost:3010/jeju/health */
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
    /* rev 를 아예 안 준 것과 0 을 준 것은 다르다.
       Number(null) 이 0 이라 그냥 Number() 로 받으면 빈 상태에서 처음 여는 사람이
       기록을 못 받고 same:true 만 받는다. */
    const revRaw = u.searchParams.get('rev');
    const rev = revRaw === null ? NaN : Number(revRaw);
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
