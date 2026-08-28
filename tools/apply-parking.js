/* tools/parking-coords.tsv 의 주차장 좌표를 index.html 의 SPOT 레코드에
   pk 로 넣는다.  node tools/apply-parking.js
   ll 은 건드리지 않는다 — ll 은 지도에 점을 찍는 자리이고 pk 는 차가 서는 자리다.
   SPOT 레코드는 한 줄에 n: 과 ll: 이 함께 있어 줄 단위로 안전하게 고칠 수 있다.
   이미 pk 가 있는 줄은 지나가므로 여러 번 돌려도 같다. */
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
