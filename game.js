const files=['game-1.txt','game-2.txt','game-3.txt','game-4.txt'];
const parts=await Promise.all(files.map(f=>fetch(f).then(r=>{if(!r.ok)throw new Error(`Chargement ${f}: ${r.status}`);return r.text()})));
const url=URL.createObjectURL(new Blob([parts.join('')],{type:'text/javascript'}));
await import(url);
