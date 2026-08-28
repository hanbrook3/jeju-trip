/* 상·하행 분리도로가 두 줄로 겹쳐 그려진다. 이미 그린 선 가까이 붙은 구간은 지운다.
   중요한 등급(순환 → 간선 → 지선) 순으로 처리해 굵은 선이 공유 구간을 차지하게 한다. */
const fs=require('fs');
const lines=JSON.parse(fs.readFileSync('roads-clean.json','utf8'));
const KX=0.8387, DEG=111.0;
const NEAR=0.30/DEG;                 // 160m 안이면 같은 길로 본다
const CELL=NEAR;
const grid=new Map();
const kk=(x,y)=>x+':'+y;
const cellOf=p=>[Math.floor(p[0]*KX/CELL),Math.floor(p[1]/CELL)];
function mark(p){ const [x,y]=cellOf(p); const k=kk(x,y);
  if(!grid.has(k)) grid.set(k,[]); grid.get(k).push(p); }
function covered(p){
  const [x,y]=cellOf(p);
  for(let dx=-1;dx<=1;dx++) for(let dy=-1;dy<=1;dy++){
    const a=grid.get(kk(x+dx,y+dy)); if(!a) continue;
    for(const q of a){ const ex=(p[0]-q[0])*KX, ey=p[1]-q[1];
      if(ex*ex+ey*ey<NEAR*NEAR) return true; }
  }
  return false;
}
const d=(a,b)=>Math.hypot((a[0]-b[0])*KX,a[1]-b[1]);
const km=l=>{let s=0;for(let i=1;i<l.length;i++)s+=d(l[i],l[i-1]);return s*DEG;};

const rank={ring:0,trunk:1,br:2};
lines.sort((a,b)=> (rank[a.k]-rank[b.k]) || (km(b.p)-km(a.p)));

/* 점 간격이 들쭉날쭉하면 판정이 새므로 100m 간격으로 다시 찍는다 */
function resample(l,step){
  const out=[l[0]];
  let acc=0;
  for(let i=1;i<l.length;i++){
    let seg=d(l[i-1],l[i]), from=l[i-1];
    while(acc+seg>=step){
      const t=(step-acc)/seg;
      const p=[from[0]+(l[i][0]-from[0])*t, from[1]+(l[i][1]-from[1])*t];
      out.push(p); from=p; seg=d(from,l[i]); acc=0;
    }
    acc+=seg;
  }
  out.push(l[l.length-1]);
  return out;
}
const kept=[];
lines.forEach(L=>{
  const rs=resample(L.p,0.10/DEG);
  let run=[];
  const flush=()=>{ if(km(run)>1.5){ kept.push({n:L.n,k:L.k,p:run}); run.forEach(mark); } run=[]; };
  rs.forEach(p=>{ if(covered(p)) flush(); else run.push(p); });
  flush();
});

/* 다시 단순화 */
function dp(pts,eps){
  if(pts.length<3) return pts;
  const pd=(p,a,b)=>{const px=(p[0]-a[0])*KX,py=p[1]-a[1],bx=(b[0]-a[0])*KX,by=b[1]-a[1];
    const L=bx*bx+by*by;let t=L?(px*bx+py*by)/L:0;t=Math.max(0,Math.min(1,t));
    const dx=px-bx*t,dy=py-by*t;return dx*dx+dy*dy;};
  const keep=new Uint8Array(pts.length);keep[0]=keep[pts.length-1]=1;
  const st=[[0,pts.length-1]],e2=eps*eps;
  while(st.length){const [i,j]=st.pop();if(j<=i+1)continue;
    let bi=-1,bd=0;for(let k=i+1;k<j;k++){const x=pd(pts[k],pts[i],pts[j]);if(x>bd){bd=x;bi=k;}}
    if(bd>e2){keep[bi]=1;st.push([i,bi],[bi,j]);}}
  return pts.filter((_,i)=>keep[i]);
}
const fin=kept.map(L=>({n:L.n,k:L.k,p:dp(L.p,0.0005).map(c=>[+c[0].toFixed(4),+c[1].toFixed(4)])}))
              .filter(L=>L.p.length>2);
const by={};
fin.forEach(L=>{ by[L.n]=by[L.n]||{c:0,km:0,pts:0}; by[L.n].c++; by[L.n].km+=km(L.p); by[L.n].pts+=L.p.length; });
Object.entries(by).forEach(([n,v])=>console.log('  '+n.padEnd(10)+String(v.c).padStart(3)+'개 선  '+Math.round(v.km)+'km  '+v.pts+'점'));
fs.writeFileSync('roads-final.json',JSON.stringify(fin));
console.log('\n선 '+fin.length+'개, '+fin.reduce((s,r)=>s+r.p.length,0)+'점, '
  +Math.round(fs.statSync('roads-final.json').size/1024)+'KB');
