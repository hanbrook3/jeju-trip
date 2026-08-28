/* OSM 도로 조각 → 연속 선형.  끝점끼리 이어 붙이고 단순화한다. */
const fs=require('fs');
const els=JSON.parse(fs.readFileSync('roads.json','utf8')).elements.filter(e=>e.geometry);

/* 개략도에 남길 도로만. 이름이 갈려 있어도 한 노선으로 묶는다. */
const GROUPS=[
 {n:'일주도로',   k:'ring',  names:['일주동로','일주서로','조천우회로']},
 {n:'평화로',     k:'trunk', names:['평화로']},
 {n:'번영로',     k:'trunk', names:['번영로']},
 {n:'5·16도로',   k:'trunk', names:['516로']},
 {n:'1100도로',   k:'trunk', names:['1100로']},
 {n:'남조로',     k:'trunk', names:['남조로']},
 {n:'비자림로',   k:'trunk', names:['비자림로']},
 {n:'중산간동로', k:'br',    names:['중산간동로']},
 {n:'중산간서로', k:'br',    names:['중산간서로']},
 {n:'산록남로',   k:'br',    names:['산록남로']},
 {n:'산록북로',   k:'br',    names:['산록북로']},
 {n:'서성로',     k:'br',    names:['서성로','서성일로']},
 {n:'한창로',     k:'br',    names:['한창로']},
 {n:'금백조로',   k:'br',    names:['금백조로']},
 {n:'애원로',     k:'br',    names:['애원로']},
];

const d2=(a,b)=>{const dx=(a[0]-b[0])*0.8387,dy=a[1]-b[1];return dx*dx+dy*dy;};
const TOL=0.0025;                       // 약 250m 안이면 같은 노선의 이음매로 본다
function chain(parts){
  const left=parts.map(p=>p.slice());
  const lines=[];
  while(left.length){
    let cur=left.shift();
    let grew=true;
    while(grew){
      grew=false;
      for(let i=0;i<left.length;i++){
        const p=left[i], h=cur[0], t=cur[cur.length-1];
        if(d2(t,p[0])<TOL*TOL){ cur=cur.concat(p.slice(1)); left.splice(i,1); grew=true; break; }
        if(d2(t,p[p.length-1])<TOL*TOL){ cur=cur.concat(p.slice().reverse().slice(1)); left.splice(i,1); grew=true; break; }
        if(d2(h,p[p.length-1])<TOL*TOL){ cur=p.slice(0,-1).concat(cur); left.splice(i,1); grew=true; break; }
        if(d2(h,p[0])<TOL*TOL){ cur=p.slice().reverse().slice(0,-1).concat(cur); left.splice(i,1); grew=true; break; }
      }
    }
    lines.push(cur);
  }
  return lines.sort((a,b)=>b.length-a.length);
}
const KX=0.8387;
function dp(pts,eps){
  if(pts.length<3) return pts;
  const pd=(p,a,b)=>{const px=(p[0]-a[0])*KX,py=p[1]-a[1],bx=(b[0]-a[0])*KX,by=b[1]-a[1];
    const L=bx*bx+by*by;let t=L?(px*bx+py*by)/L:0;t=Math.max(0,Math.min(1,t));
    const dx=px-bx*t,dy=py-by*t;return dx*dx+dy*dy;};
  const keep=new Uint8Array(pts.length);keep[0]=keep[pts.length-1]=1;
  const st=[[0,pts.length-1]],e2=eps*eps;
  while(st.length){const [i,j]=st.pop();if(j<=i+1)continue;
    let bi=-1,bd=0;for(let k=i+1;k<j;k++){const d=pd(pts[k],pts[i],pts[j]);if(d>bd){bd=d;bi=k;}}
    if(bd>e2){keep[bi]=1;st.push([i,bi],[bi,j]);}}
  return pts.filter((_,i)=>keep[i]);
}
const len=l=>{let s=0;for(let i=1;i<l.length;i++)s+=Math.sqrt(d2(l[i],l[i-1]));return s;};

const out=[];
GROUPS.forEach(g=>{
  const parts=els.filter(e=>g.names.includes((e.tags||{}).name))
                 .map(e=>e.geometry.map(c=>[c.lon,c.lat]));
  if(!parts.length){ console.log('  ! '+g.n+' 조각 없음'); return; }
  const lines=chain(parts).filter(l=>len(l)>0.03);     // 3km 미만 토막은 버린다
  const kept=lines.map(l=>dp(l,0.00045).map(c=>[+c[0].toFixed(4),+c[1].toFixed(4)]));
  const pts=kept.reduce((s,l)=>s+l.length,0);
  const ends=kept[0]?` 끝점 ${kept[0][0].join()} → ${kept[0][kept[0].length-1].join()}`:'';
  console.log(`  ${g.n.padEnd(10)} 조각 ${parts.length} → 선 ${kept.length}개 ${pts}점${ends}`);
  kept.forEach(l=>out.push({n:g.n,k:g.k,p:l}));
});
fs.writeFileSync('roads-clean.json',JSON.stringify(out));
console.log('\n선 '+out.length+'개, '+out.reduce((s,r)=>s+r.p.length,0)+'점, '
  +Math.round(fs.statSync('roads-clean.json').size/1024)+'KB');
