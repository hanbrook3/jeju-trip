/* 표고 격자 → 등고선 폐곡선.  마칭스퀘어 → 조각 잇기 → 차이킨 다듬기 → 단순화 */
const fs=require('fs');
const D=JSON.parse(fs.readFileSync('dem.json','utf8'));
const {L0,L1,A0,A1,NX,NY,z}=D;
const gx=x=>L0+(L1-L0)*x/(NX-1), gy=y=>A0+(A1-A0)*y/(NY-1);
const Z=(x,y)=>z[y*NX+x];

function segments(lv){
  const out=[];
  const ip=(x1,y1,v1,x2,y2,v2)=>{ const t=(lv-v1)/(v2-v1||1e-9);
    return [gx(x1+(x2-x1)*t), gy(y1+(y2-y1)*t)]; };
  for(let y=0;y<NY-1;y++) for(let x=0;x<NX-1;x++){
    const a=Z(x,y+1), b=Z(x+1,y+1), c=Z(x+1,y), d=Z(x,y);   // 좌상 시계방향
    let k=(a>lv?8:0)|(b>lv?4:0)|(c>lv?2:0)|(d>lv?1:0);
    if(k===0||k===15) continue;
    const T=()=>ip(x,y+1,a,x+1,y+1,b), R=()=>ip(x+1,y+1,b,x+1,y,c),
          B=()=>ip(x+1,y,c,x,y,d),     Lf=()=>ip(x,y,d,x,y+1,a);
    const push=(p,q)=>out.push([p,q]);
    switch(k){
      case 1: case 14: push(Lf(),B()); break;
      case 2: case 13: push(B(),R()); break;
      case 3: case 12: push(Lf(),R()); break;
      case 4: case 11: push(T(),R()); break;
      case 6: case 9:  push(T(),B()); break;
      case 7: case 8:  push(Lf(),T()); break;
      case 5:  push(Lf(),T()); push(B(),R()); break;
      case 10: push(Lf(),B()); push(T(),R()); break;
    }
  }
  return out;
}
const key=p=>p[0].toFixed(6)+','+p[1].toFixed(6);
function link(segs){
  const m=new Map();
  segs.forEach(s=>{ [[s[0],s[1]],[s[1],s[0]]].forEach(([a,b])=>{
    const k=key(a); if(!m.has(k)) m.set(k,[]); m.get(k).push(b); }); });
  const used=new Set(), rings=[];
  segs.forEach(s=>{
    const sk=key(s[0])+'|'+key(s[1]);
    if(used.has(sk)) return;
    const ring=[s[0],s[1]];
    used.add(sk); used.add(key(s[1])+'|'+key(s[0]));
    for(let g=0;g<12000;g++){
      const cur=ring[ring.length-1], prev=ring[ring.length-2];
      const nxt=(m.get(key(cur))||[]).find(n=>
        key(n)!==key(prev) && !used.has(key(cur)+'|'+key(n)));
      if(!nxt) break;
      used.add(key(cur)+'|'+key(nxt)); used.add(key(nxt)+'|'+key(cur));
      ring.push(nxt);
      if(key(nxt)===key(ring[0])) break;
    }
    if(ring.length>7) rings.push(ring);
  });
  return rings;
}
/* 차이킨 — 격자에서 온 계단 자국을 없앤다 */
function chaikin(r,n){
  let p=r.slice();
  const closed=key(p[0])===key(p[p.length-1]);
  if(closed) p.pop();
  for(let it=0;it<n;it++){
    const q=[];
    for(let i=0;i<p.length;i++){
      const a=p[i], b=p[(i+1)%p.length];
      q.push([a[0]*.75+b[0]*.25, a[1]*.75+b[1]*.25]);
      q.push([a[0]*.25+b[0]*.75, a[1]*.25+b[1]*.75]);
    }
    p=q;
  }
  return p;
}
const KX=Math.cos(33.38*Math.PI/180);
function dp(pts,eps){
  if(pts.length<5) return pts;
  const d2=(p,a,b)=>{const px=(p[0]-a[0])*KX,py=p[1]-a[1],bx=(b[0]-a[0])*KX,by=b[1]-a[1];
    const L=bx*bx+by*by;let t=L?(px*bx+py*by)/L:0;t=Math.max(0,Math.min(1,t));
    const dx=px-bx*t,dy=py-by*t;return dx*dx+dy*dy;};
  const keep=new Uint8Array(pts.length); keep[0]=keep[pts.length-1]=1;
  const st=[[0,pts.length-1]],e2=eps*eps;
  while(st.length){const [i,j]=st.pop(); if(j<=i+1) continue;
    let bi=-1,bd=0;
    for(let k=i+1;k<j;k++){const d=d2(pts[k],pts[i],pts[j]); if(d>bd){bd=d;bi=k;}}
    if(bd>e2){keep[bi]=1;st.push([i,bi],[bi,j]);}}
  return pts.filter((_,i)=>keep[i]);
}
const areaOf=r=>{let s=0;for(let i=0,n=r.length;i<n;i++){const a=r[i],b=r[(i+1)%n];
  s+=(a[0]-b[0])*(a[1]+b[1]);} return Math.abs(s/2);};

const LEVELS=[100,300,600,1000,1400];
const res=[];
LEVELS.forEach(lv=>{
  let rings=link(segments(lv))
    .map(r=>dp(chaikin(r,2),0.00045))
    .filter(r=>areaOf(r)>0.00012)                 // 화면에서 안 보일 조각은 뺀다
    .sort((a,b)=>areaOf(b)-areaOf(a));
  const total=rings.reduce((s,r)=>s+r.length,0);
  console.log(lv+'m: 고리 '+rings.length+'개, '+total+'점  (최대 '+(rings[0]?rings[0].length:0)+'점)');
  res.push({lv,r:rings.map(r=>r.map(c=>[+c[0].toFixed(4),+c[1].toFixed(4)]))});
});
fs.writeFileSync('contours.json',JSON.stringify(res));
console.log('\ncontours.json '+Math.round(fs.statSync('contours.json').size/1024)+'KB');
