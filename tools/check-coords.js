/* 여행지·맛집의 등록 좌표가 등록 주소와 맞는지 전수 조사한다.
     KAKAO_REST_KEY=<키> node tools/check-coords.js
     KAKAO_REST_KEY=<키> node tools/check-coords.js > tools/coord-audit.tsv

   방법 — 이름으로 검색하면 엉뚱한 가게가 잡혀 오탐이 많다(외돌개 → 외돌개농수산).
   그래서 **등록된 주소를 좌표로 바꿔** 등록 좌표와 견준다. 주소는 사람이 적은 것이라
   대개 맞고, 좌표는 손으로 찍어 틀리기 쉽다. 둘이 벌어지면 좌표를 의심한다.

   주소로 못 찾으면 이름으로 한 번 더 찾아보고, 그것도 없으면 '확인불가' 로 남긴다.
   고치지 않는다 — 무엇이 얼마나 어긋났는지만 낸다. */
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const KEY = process.env.KAKAO_REST_KEY || '';
if (!KEY) { console.error('KAKAO_REST_KEY 가 없습니다.'); process.exit(1); }

function 배열읽기(줄, 이름) {
  const s = 줄.findIndex(l => l.indexOf('const ' + 이름 + '=[') === 0);
  if (s < 0) throw new Error(이름 + ' 을 못 찾음');
  let e = -1;
  for (let i = s; i < 줄.length; i++) if (줄[i].indexOf('];') === 0) { e = i; break; }
  return eval(줄.slice(s, e + 1).join('\n') + '\n' + 이름);
}
function 거리(a, b) {
  const r = Math.PI / 180, R = 6371000;
  const s = Math.sin((b[0] - a[0]) * r / 2) ** 2
    + Math.cos(a[0] * r) * Math.cos(b[0] * r) * Math.sin((b[1] - a[1]) * r / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}
async function 카카오(주소, 종류) {
  const base = 종류 === 'addr'
    ? 'https://dapi.kakao.com/v2/local/search/address.json?query='
    : 'https://dapi.kakao.com/v2/local/search/keyword.json?size=1&query=';
  try {
    const r = await fetch(base + encodeURIComponent(주소), { headers: { Authorization: 'KakaoAK ' + KEY } });
    if (!r.ok) return null;
    const j = await r.json();
    const d = j && j.documents && j.documents[0];
    if (!d) return null;
    return { ll: [Number(d.y), Number(d.x)], 이름: d.place_name || d.address_name || '' };
  } catch (e) { return null; }
}
/* 좌표가 어느 주소 위에 있는지 — 읍·면·동이 다르면 강한 신호다 */
async function 역주소(ll) {
  try {
    const r = await fetch('https://dapi.kakao.com/v2/local/geo/coord2address.json?x=' + ll[1] + '&y=' + ll[0],
      { headers: { Authorization: 'KakaoAK ' + KEY } });
    const j = await r.json();
    const d = j && j.documents && j.documents[0];
    return (d && ((d.road_address && d.road_address.address_name) || (d.address && d.address.address_name))) || '';
  } catch (e) { return ''; }
}
/* 주소에서 읍·면·동(리 포함)만 뽑아 견준다 */
function 동네(주소) {
  const m = String(주소 || '').match(/([가-힣]+(?:읍|면|동))\s*([가-힣]*리)?/);
  return m ? (m[1] + (m[2] ? ' ' + m[2] : '')) : '';
}

(async () => {
  const 줄 = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8').split('\n');
  const 목록 = 배열읽기(줄, 'SPOT').map(s => ({ 갈래: '여행지', ...s }))
    .concat(배열읽기(줄, 'FOOD').map(f => ({ 갈래: '맛집', ...f })));

  console.log('갈래\t이름\t등록위도\t등록경도\t주소로_찾은위도\t주소로_찾은경도\t어긋남m\t등록주소\t좌표가_있는곳\t판정');
  for (const p of 목록) {
    if (!p.ll) { console.log(`${p.갈래}\t${p.n}\t-\t-\t-\t-\t-\t${p.addr || ''}\t-\t좌표없음`); continue; }
    let 기준 = p.addr ? await 카카오(p.addr, 'addr') : null;
    let 출처 = '주소';
    if (!기준) { 기준 = await 카카오(p.n, 'kw'); 출처 = '이름'; }
    const 있는곳 = await 역주소(p.ll);
    if (!기준) {
      console.log(`${p.갈래}\t${p.n}\t${p.ll[0]}\t${p.ll[1]}\t-\t-\t-\t${p.addr || ''}\t${있는곳}\t확인불가`);
      continue;
    }
    const d = 거리(p.ll, 기준.ll);
    const 같은동네 = 동네(p.addr) && 동네(있는곳) && 동네(p.addr) === 동네(있는곳);
    let 판정 = 'OK';
    if (d >= 300) 판정 = 같은동네 ? '멀다' : '어긋남';
    else if (d >= 150) 판정 = 같은동네 ? '조금멀다' : '어긋남';
    else if (!같은동네 && 동네(p.addr) && 동네(있는곳)) 판정 = '동네다름';
    if (출처 === '이름' && 판정 !== 'OK') 판정 += '(이름기준)';
    console.log(`${p.갈래}\t${p.n}\t${p.ll[0]}\t${p.ll[1]}\t${기준.ll[0].toFixed(6)}\t${기준.ll[1].toFixed(6)}\t${d.toFixed(0)}\t${p.addr || ''}\t${있는곳}\t${판정}`);
  }
})();
