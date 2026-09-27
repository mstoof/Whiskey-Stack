import {writeFile,readFile} from 'node:fs/promises';
const urls=JSON.parse(await readFile('/private/tmp/price-research-urls.json','utf8'));
const results=await Promise.allSettled(urls.map(async url=>{
 const res=await fetch(url,{headers:{'User-Agent':'Mozilla/5.0'},signal:AbortSignal.timeout(20000)});
 const html=await res.text();
 const data=[...html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)].map(m=>{try{return JSON.parse(m[1])}catch{return null}});
 const links=[...new Set([...html.matchAll(/(?:href=["']|"url":")([^"']*\/artikel\/[^"']+)/g)].map(m=>m[1]))];
 const filename='/private/tmp/price-'+Buffer.from(url).toString('base64url')+'.html';
 await writeFile(filename,html);
 return {url,status:res.status,data,links,file:filename};
}));
const out=results.map((r,i)=>r.status==='fulfilled'?r.value:{url:urls[i],error:r.reason.message});
await writeFile('/private/tmp/price-research-results.json',JSON.stringify(out,null,2));
for(const r of out) console.log(JSON.stringify({url:r.url,status:r.status,error:r.error,data:r.data,links:r.links?.slice(0,20)}));
