/* 로컬 확인용 서버.  node tools/serve.js  →  http://127.0.0.1:8765
   file:// 로 열면 서비스워커가 등록되지 않으므로 반드시 이걸로 띄운다.
   Cache-Control: no-cache 라 고치고 새로고침하면 바로 반영된다. */
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..');
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.png': 'image/png',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.json': 'application/json'
};
http.createServer((q, r) => {
  let f = decodeURIComponent(q.url.split('?')[0]).split('#')[0];
  if (f === '/' || f === '') f = '/index.html';
  const full = path.resolve(path.join(ROOT, f));
  if (!full.startsWith(ROOT) || !fs.existsSync(full) || fs.statSync(full).isDirectory()) {
    r.writeHead(404, { 'Content-Type': 'text/plain' });
    return r.end('404 ' + f);
  }
  r.writeHead(200, {
    'Content-Type': TYPES[path.extname(full)] || 'application/octet-stream',
    'Service-Worker-Allowed': '/',
    'Cache-Control': 'no-cache'
  });
  r.end(fs.readFileSync(full));
}).listen(8765, () => console.log('http://127.0.0.1:8765'));
