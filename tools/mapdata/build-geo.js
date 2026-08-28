const fs=require('fs');
const KX=Math.cos(33.38*Math.PI/180);
function dp(pts,eps){
  if(pts.length<4) return pts;
  const d2=(p,a,b)=>{
    const px=(p[0]-a[0])*KX, py=p[1]-a[1], bx=(b[0]-a[0])*KX, by=b[1]-a[1];
    const L=bx*bx+by*by; let t=L?(px*bx+py*by)/L:0; t=Math.max(0,Math.min(1,t));
    const dx=px-bx*t, dy=py-by*t; return dx*dx+dy*dy;
  };
  const keep=new Uint8Array(pts.length); keep[0]=keep[pts.length-1]=1;
  const st=[[0,pts.length-1]], e2=eps*eps;
  while(st.length){
    const [i,j]=st.pop(); if(j<=i+1) continue;
    let best=-1,bd=0;
    for(let k=i+1;k<j;k++){const d=d2(pts[k],pts[i],pts[j]); if(d>bd){bd=d;best=k;}}
    if(bd>e2){ keep[best]=1; st.push([i,best],[best,j]); }
  }
  return pts.filter((_,i)=>keep[i]);
}
const r4=p=>p.map(c=>[+c[0].toFixed(4),+c[1].toFixed(4)]);

/* ── 본섬 : 통계청 2018 시도 경계 ── */
const main=JSON.parse(fs.readFileSync('jeju-raw.json','utf8'))[0];
const coast=r4(dp(main,0.0003));
console.log('본섬 '+main.length+' → '+coast.length+'점');

/* ── 부속 섬 : OSM ── */
const wanted={'우도':1,'가파도':1,'마라도':1,'비양도':1,'차귀도':1,'형제섬':1,
              '범섬':1,'문섬':1,'섶섬':1,'새섬':1,'지귀도':1};
const isles=[];
const seen={};
const add=(nm,g)=>{
  const pts=g.map(c=>[c.lon,c.lat]);
  const lon=pts.map(p=>p[0]), lat=pts.map(p=>p[1]);
  const w=Math.max(...lon)-Math.min(...lon), h=Math.max(...lat)-Math.min(...lat);
  if(Math.max(w,h)<0.0025) return;               // 화면에서 1px도 안 되는 바위는 뺀다
  const key=nm+'@'+((Math.min(...lat)+Math.max(...lat))/2).toFixed(2);
  if(seen[key]) return; seen[key]=1;
  isles.push({n:nm,p:r4(dp(pts,0.00012))});
};
JSON.parse(fs.readFileSync('isles.json','utf8')).elements
  .filter(e=>e.geometry&&e.geometry.length>3)
  .forEach(e=>{ const t=e.tags||{}, nm=t['name:ko']||t.name; if(nm&&wanted[nm]) add(nm,e.geometry); });
/* 우도는 way 로 따로 받았다 — 해안선 way 중 가장 큰 폐곡선 */
{
  const u=JSON.parse(fs.readFileSync('udo.json','utf8')).elements
    .filter(e=>e.geometry&&e.geometry.length>200)
    .filter(e=>{const la=e.geometry.map(c=>c.lat),lo=e.geometry.map(c=>c.lon);
      const cy=(Math.min(...la)+Math.max(...la))/2, cx=(Math.min(...lo)+Math.max(...lo))/2;
      return cy>33.49&&cy<33.53&&cx>126.94&&cx<126.98;})
    .sort((a,b)=>b.geometry.length-a.geometry.length)[0];
  if(u) add('우도',u.geometry);
}
isles.sort((a,b)=>b.p.length-a.p.length);
isles.forEach(i=>console.log('  '+i.n.padEnd(6)+i.p.length+'점'));

const out={coast,isles};
fs.writeFileSync('geo.json',JSON.stringify(out));
console.log('\n전체 '+(coast.length+isles.reduce((s,i)=>s+i.p.length,0))+'점, '
  +Math.round(JSON.stringify(out).length/1024)+'KB');
