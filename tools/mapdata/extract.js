const fs=require('fs');
const g=JSON.parse(fs.readFileSync('sk-prov.json','utf8'));
console.log('feature 수:',g.features.length);
g.features.forEach(f=>{
  const p=f.properties;
  const nm=p.name||p.NAME_1||p.name_eng||JSON.stringify(p).slice(0,60);
  console.log(' -',nm, f.geometry.type);
});
