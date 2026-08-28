/* 제주 표고 격자 — 한라산을 동심 타원 대신 실제 지형으로 그린다.
   opentopodata(SRTM 90m) 우선, 막히면 open-meteo 로 넘어간다. 둘 다 초당 1회로 제한. */
const fs=require('fs'), https=require('https');
const L0=126.135, L1=126.985, A0=33.175, A1=33.585;
const NX=96, NY=48;
const pts=[];
for(let y=0;y<NY;y++) for(let x=0;x<NX;x++)
  pts.push([ +(A0+(A1-A0)*y/(NY-1)).toFixed(5), +(L0+(L1-L0)*x/(NX-1)).toFixed(5) ]);
console.log('격자 '+NX+'x'+NY+' = '+pts.length+'점, 요청 '+Math.ceil(pts.length/100)+'회');

const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const getJSON=u=>new Promise((res,rej)=>{
  https.get(u,{headers:{'User-Agent':'jeju-family-trip/1.0'}},r=>{
    let d=''; r.on('data',c=>d+=c);
    r.on('end',()=>{ try{ res({code:r.statusCode,body:JSON.parse(d)}); }
      catch(e){ res({code:r.statusCode,body:null,raw:d.slice(0,160)}); } });
  }).on('error',rej);
});

async function batch(b){
  const locs=b.map(p=>p[0]+','+p[1]).join('|');
  const r=await getJSON('https://api.opentopodata.org/v1/srtm90m?locations='+encodeURIComponent(locs));
  if(r.code===200&&r.body&&r.body.results&&r.body.results.length===b.length)
    return r.body.results.map(x=>x.elevation);
  if(r.code===429) return null;                       // 뒤로 물러선다
  const m=await getJSON('https://api.open-meteo.com/v1/elevation?latitude='
    +b.map(p=>p[0]).join(',')+'&longitude='+b.map(p=>p[1]).join(','));
  if(m.code===200&&m.body&&m.body.elevation&&m.body.elevation.length===b.length)
    return m.body.elevation;
  return null;
}

(async()=>{
  const out=[]; let wait=1100;
  for(let i=0;i<pts.length;i+=100){
    const b=pts.slice(i,i+100);
    let got=null;
    for(let t=0;t<6&&!got;t++){
      got=await batch(b);
      if(!got){ wait=Math.min(wait*1.7,9000); await sleep(wait); }
    }
    if(!got){ console.error('\n실패: '+i+'번째 묶음'); process.exit(1); }
    out.push(...got);
    if((i/100)%8===0) process.stdout.write(' '+out.length);
    await sleep(1100);
  }
  const v=out.map(x=>x==null?0:x);
  console.log('\n받은 값 '+out.length+'개  최고 '+Math.max(...v)+'m');
  fs.writeFileSync('dem.json',JSON.stringify({L0,L1,A0,A1,NX,NY,z:v}));
  console.log('dem.json 저장 ('+Math.round(fs.statSync('dem.json').size/1024)+'KB)');
})().catch(e=>{console.error('실패:',e.message);process.exit(1);});
