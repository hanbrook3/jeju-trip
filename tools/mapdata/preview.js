/* 개략도 미리보기 — 앱을 열지 않고 밑그림을 PNG 로 찍어 눈으로 확인한다.
   브라우저 스크린샷이 안 되는 환경에서 "세련됐는지"를 판단하는 유일한 수단이다.

   색과 선 굵기는 index.html 의 VEC / VW 를 직접 읽어 온다 — 따로 적어 두면
   반드시 어긋나므로 절대 여기에 값을 복사해 두지 말 것.

   쓰는 법:
     node preview.js                     섬 전체 (줌 9 굵기) + 예시 경로·핀
     node preview.js z12                 최대 배율 굵기
     node preview.js z11 126.60,33.42,126.90,33.58    특정 구역만
     node preview.js z9 - nopins         핀·경로 없이 밑그림만

   결과는 preview.png. Read 도구로 열어서 보면 된다. */
const fs = require('fs'), zlib = require('zlib'), path = require('path');

const HERE = __dirname;
const HTML = path.join(HERE, '..', '..', 'index.html');

/* ── 앱에서 색·굵기를 그대로 가져온다 ── */
function pick(name) {
  const src = fs.readFileSync(HTML, 'utf8');
  const i = src.indexOf('const ' + name + '=');
  if (i < 0) throw new Error(name + ' 를 index.html 에서 못 찾음');
  /* 중괄호 짝을 세어 선언 끝을 찾는다 */
  let d = 0, j = src.indexOf('{', i);
  for (let k = j; k < src.length; k++) {
    if (src[k] === '{') d++;
    else if (src[k] === '}' && --d === 0) { j = k; break; }
  }
  return eval('(' + src.slice(src.indexOf('{', i), j + 1) + ')');
}
const VEC = pick('VEC'), VW = pick('VW');
const SEA = (fs.readFileSync(HTML, 'utf8').match(/#map\{[^}]*background:(#[0-9A-Fa-f]{6})/) || [])[1] || '#CFE2EA';

const geo = JSON.parse(fs.readFileSync(path.join(HERE, 'geo.json'), 'utf8'));
const cont = JSON.parse(fs.readFileSync(path.join(HERE, 'contours.json'), 'utf8'));
const roads = JSON.parse(fs.readFileSync(path.join(HERE, 'roads-final.json'), 'utf8'));

/* 1일차 실제 경로·정차지 — 밑그림이 주인공을 가리지 않는지 보려고 얹는다 */
const DAY = {
  path: [[33.5169,126.5316],[33.500,126.532],[33.478,126.540],[33.455,126.550],[33.440,126.575],
    [33.4270,126.6041],[33.400,126.612],[33.380,126.618],[33.3618,126.6229],[33.340,126.616],
    [33.322,126.632],[33.312,126.668],[33.3050,126.7122],[33.292,126.700],[33.280,126.672],[33.2745,126.6600]],
  stops: [[33.5169,126.5316],[33.4270,126.6041],[33.3618,126.6229],[33.3050,126.7122],[33.2745,126.6600]],
  poi: [[33.4292,126.9323,'#15616D'],[33.2495,126.6186,'#9E3B3B'],[33.4400,126.9000,'#C88C28'],
    [33.3940,126.2400,'#15616D'],[33.2370,126.3130,'#15616D'],[33.5432,126.6690,'#C88C28'],
    [33.3057,126.2894,'#9E3B3B'],[33.4843,126.8065,'#15616D'],[33.2523,126.6239,'#15616D'],
    [33.2140,126.2510,'#C88C28'],[33.3860,126.7990,'#15616D'],[33.5240,126.8480,'#9E3B3B']]
};

/* ── 인자 ── */
const A = process.argv.slice(2);
const zi = { z9: 0, z10: 1, z11: 2, z12: 3 }[A[0] || 'z9'] ?? 0;
const bb = (A[1] && A[1] !== '-') ? A[1].split(',').map(Number) : [126.130, 33.170, 126.990, 33.590];
const pins = A[2] !== 'nopins';
const W = 694, H = 426, SS = 3;

/* ── 래스터 ── */
const CW = W * SS, CH = H * SS;
const KX = Math.cos(33.38 * Math.PI / 180);
const S = Math.min(CW / ((bb[2] - bb[0]) * KX), CH / ((bb[3] - bb[1])));
const ox = (CW - (bb[2] - bb[0]) * KX * S) / 2, oy = (CH - (bb[3] - bb[1]) * S) / 2;
const X = l => ox + (l - bb[0]) * KX * S, Y = a => CH - oy - (a - bb[1]) * S;
const buf = new Uint8Array(CW * CH * 3);
const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
const px = (x, y, c) => { if (x < 0 || y < 0 || x >= CW || y >= CH) return;
  const k = ((y | 0) * CW + (x | 0)) * 3; buf[k] = c[0]; buf[k + 1] = c[1]; buf[k + 2] = c[2]; };

(c => { const k = hex(c); for (let n = 0; n < CW * CH; n++) { buf[n*3] = k[0]; buf[n*3+1] = k[1]; buf[n*3+2] = k[2]; } })(SEA);

function poly(pts, col) {                       /* 스캔라인 채우기 */
  const c = hex(col), P = pts.map(p => [X(p[0]), Y(p[1])]);
  let a = 1e9, b = -1e9; P.forEach(p => { a = Math.min(a, p[1]); b = Math.max(b, p[1]); });
  for (let y = Math.max(0, a | 0); y <= Math.min(CH - 1, Math.ceil(b)); y++) {
    const xs = [], cy = y + 0.5;
    for (let n = 0, m = P.length; n < m; n++) {
      const u = P[n], v = P[(n + 1) % m];
      if ((u[1] > cy) !== (v[1] > cy)) xs.push(u[0] + (cy - u[1]) / (v[1] - u[1]) * (v[0] - u[0]));
    }
    xs.sort((p, q) => p - q);
    for (let n = 0; n + 1 < xs.length; n += 2)
      for (let x = Math.max(0, Math.ceil(xs[n])); x <= Math.min(CW - 1, Math.floor(xs[n + 1])); x++) px(x, y, c);
  }
}
const disc = (cx, cy, r, c) => { const r2 = r * r;
  for (let y = Math.floor(cy - r); y <= cy + r; y++) for (let x = Math.floor(cx - r); x <= cx + r; x++) {
    const dx = x - cx, dy = y - cy; if (dx * dx + dy * dy <= r2) px(x, y, c); } };
function line(pts, col, wpx, close) {
  if (!wpx) return;
  const c = hex(col), r = Math.max(.5, wpx * SS / 2);
  const P = pts.map(p => [X(p[0]), Y(p[1])]); if (close) P.push(P[0]);
  for (let n = 1; n < P.length; n++) {
    const a = P[n - 1], b = P[n];
    const d = Math.hypot(b[0] - a[0], b[1] - a[1]), m = Math.max(1, Math.ceil(d / (r * .5)));
    for (let t = 0; t <= m; t++) disc(a[0] + (b[0]-a[0]) * t / m, a[1] + (b[1]-a[1]) * t / m, r, c);
  }
}

/* ── 앱의 buildVector() 와 같은 순서 ── */
line(geo.coast, VEC.halo, 5, true);
poly(geo.coast, VEC.land);
cont.forEach((c, n) => c.r.forEach(r => poly(r, VEC.band[n])));
line(geo.coast, VEC.edge, VW.coast[zi], true);
roads.filter(r => zi >= 1 || r.k !== 'br').forEach(r => {
  const k = VEC.road[r.k] ? r.k : 'br';
  line(r.p, VEC.road[k], VW[k][zi]);
});
geo.isles.forEach(x => { poly(x.p, VEC.land); line(x.p, VEC.edge, 1, true); });
if (pins) {
  line(DAY.path.map(c => [c[1], c[0]]), '#ffffff', 5.6);
  line(DAY.path.map(c => [c[1], c[0]]), '#9E3B3B', 3.0);
  DAY.poi.forEach(p => { disc(X(p[1]), Y(p[0]), 3.4*SS, hex('#ffffff')); disc(X(p[1]), Y(p[0]), 2.3*SS, hex(p[2])); });
  DAY.stops.forEach(s => { disc(X(s[1]), Y(s[0]), 6.4*SS, hex('#ffffff')); disc(X(s[1]), Y(s[0]), 5.2*SS, hex('#15616D')); });
}

/* ── 축소 후 PNG ── */
const out = Buffer.alloc(W * H * 3);
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  let r = 0, g = 0, b = 0;
  for (let j = 0; j < SS; j++) for (let n = 0; n < SS; n++) {
    const k = (((y*SS + j) * CW) + (x*SS + n)) * 3; r += buf[k]; g += buf[k+1]; b += buf[k+2]; }
  const m = SS * SS, q = (y * W + x) * 3;
  out[q] = r/m | 0; out[q+1] = g/m | 0; out[q+2] = b/m | 0;
}
const raw = Buffer.alloc((W * 3 + 1) * H);
for (let y = 0; y < H; y++) { raw[y * (W*3+1)] = 0; out.copy(raw, y * (W*3+1) + 1, y * W * 3, (y+1) * W * 3); }
const T = (() => { const t = []; for (let n = 0; n < 256; n++) { let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc = b => { let c = 0xFFFFFFFF; for (const x of b) c = T[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
const ch = (t, d) => { const L = Buffer.alloc(4); L.writeUInt32BE(d.length);
  const td = Buffer.concat([Buffer.from(t), d]); const cc = Buffer.alloc(4); cc.writeUInt32BE(crc(td));
  return Buffer.concat([L, td, cc]); };
const ih = Buffer.alloc(13); ih.writeUInt32BE(W, 0); ih.writeUInt32BE(H, 4); ih[8] = 8; ih[9] = 2;
fs.writeFileSync(path.join(HERE, 'preview.png'), Buffer.concat([
  Buffer.from([137,80,78,71,13,10,26,10]), ch('IHDR', ih),
  ch('IDAT', zlib.deflateSync(raw, { level: 9 })), ch('IEND', Buffer.alloc(0))]));

console.log('preview.png  ' + W + 'x' + H);
console.log('  배율 ' + (A[0] || 'z9') + ' — 해안선 ' + VW.coast[zi] + 'px, 순환 ' + VW.ring[zi] + 'px, 간선 ' + VW.trunk[zi] + 'px'
  + (zi >= 1 ? ', 지선 ' + VW.br[zi] + 'px' : ', 지선 숨김'));
console.log('  구역 경도 ' + bb[0] + '~' + bb[2] + ', 위도 ' + bb[1] + '~' + bb[3]);
console.log('  색은 index.html 의 VEC/VW 에서 읽었다 — 앱과 항상 일치한다.');
