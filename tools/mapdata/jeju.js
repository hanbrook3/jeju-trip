const fs=require('fs');
const g=JSON.parse(fs.readFileSync('sk-prov.json','utf8'));
const f=g.features.find(x=>(x.properties.name||'').includes('제주'));
const polys=f.geometry.coordinates.map(c=>c[0]);
polys.sort((a,b)=>b.length-a.length);
console.log('폴리곤 개수:',polys.length);
polys.slice(0,12).forEach((p,i)=>{
  const lon=p.map(c=>c[0]),lat=p.map(c=>c[1]);
  const w=Math.max(...lon)-Math.min(...lon), h=Math.max(...lat)-Math.min(...lat);
  console.log(`${i}: ${p.length}점  경도 ${Math.min(...lon).toFixed(4)}~${Math.max(...lon).toFixed(4)}  위도 ${Math.min(...lat).toFixed(4)}~${Math.max(...lat).toFixed(4)}  크기 ${w.toFixed(3)}x${h.toFixed(3)}`);
});
fs.writeFileSync('jeju-raw.json',JSON.stringify(polys));
