const fs=require('fs');
const geo=JSON.parse(fs.readFileSync('geo.json','utf8'));
const cont=JSON.parse(fs.readFileSync('contours.json','utf8'));
const roads=JSON.parse(fs.readFileSync('roads-final.json','utf8'));

const wrap=(s,ind)=>{                       // 한 줄 110자 안쪽으로 접는다
  const out=[]; let line=ind;
  s.split('],[').forEach((seg,i,a)=>{
    const tok=(i?'[':'')+seg+(i<a.length-1?'],':'');
    if(line.length+tok.length>112){ out.push(line); line=ind; }
    line+=tok;
  });
  out.push(line); return out.join('\n');
};
const arr=p=>'['+p.map(c=>'['+c[0]+','+c[1]+']').join(',')+']';

let s='';
s+='/* ══════ 개략도 밑그림 — 실측 자료 ══════\n';
s+='   해안선·부속섬 : 통계청 2018 시도경계 + OpenStreetMap\n';
s+='   등고선        : SRTM 90m 표고를 마칭스퀘어로 딴 것\n';
s+='   도로          : OpenStreetMap 간선도로 (상·하행 중복 제거)\n';
s+='   타일 지도가 막히는 곳(카카오톡 인앱 브라우저 등)에서 이 그림이 대신 나온다. */\n';
s+='const COAST=[\n'+wrap(arr(geo.coast).slice(1,-1),' ')+'];\n';

s+='/* 부속 섬 */\nconst ISLES=[\n';
s+=geo.isles.map(i=>` {n:'${i.n}',p:${arr(i.p)}}`).join(',\n')+'];\n';

s+='/* 등고선 — 100·300·600·1000·1400m. 안쪽으로 갈수록 높다 */\nconst CONT=[\n';
s+=cont.map(c=>` {m:${c.lv},r:[\n`+c.r.map(r=>wrap(arr(r).slice(1,-1),'  ')).map(x=>'  ['+x.trim()+']').join(',\n')+']}').join(',\n')+'];\n';

s+="/* 간선도로 — k: ring 순환 · trunk 간선 · br 지선 */\nconst RD=[\n";
s+=roads.map(r=>` {n:'${r.n}',k:'${r.k}',p:${arr(r.p)}}`).join(',\n')+'];\n';

fs.writeFileSync('mapdata.js',s);
console.log('mapdata.js '+Math.round(s.length/1024)+'KB');
console.log(' 해안선 '+geo.coast.length+'점, 섬 '+geo.isles.length+'개, 등고선 '+cont.length+'단, 도로 '+roads.length+'선');
