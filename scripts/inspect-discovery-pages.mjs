import {writeFile} from 'node:fs/promises';
const pages={
'four-roses-single-barrel':'https://www.gall.nl/four-roses-single-barrel-70cl-729671.html',
'glen-scotia-double-cask':'https://www.gall.nl/glen-scotia-double-cask-70cl-703788.html',
'kilchoman-sanaig':'https://www.gall.nl/kilchoman-sanaig-70cl-704091.html',
'arran-10':'https://www.heijdenwijnimport.nl/product/331355612/arran-10-years-single-malt-whisky',
'makers-mark-46':'https://www.makersmark.com/en-us/bourbons/makers-mark-46',
'wild-turkey-rare-breed':'https://www.wildturkeybourbon.com/en-us/products/rare-breed/',
'kavalan-concertmaster':'https://www.hotalingandco.com/portfolio/kavalan/kavalan-concertmaster/',
'stauning-rye':'https://stauningwhisky.com/products/malted-rye-whisky',
'starward-two-fold':'https://starward.com.au/collections/all/products/two-fold',
'millstone-100-rye':'https://www.thewhiskyexchange.com/p/20397/millstone-100-rye'
};
const results=await Promise.allSettled(Object.entries(pages).map(async([slug,url])=>{
 const res=await fetch(url,{headers:{'User-Agent':'Mozilla/5.0'},signal:AbortSignal.timeout(20000)});
 const html=await res.text();
 await writeFile(`/private/tmp/${slug}.html`,html);
 const meta=[...html.matchAll(/<meta\b[^>]*>/gi)].map(m=>m[0]).filter(m=>/og:image|og:description/i.test(m));
 const imgs=[...html.matchAll(/<img\b[^>]*>/gi)].map(m=>m[0]).filter(m=>new RegExp(slug.split('-')[0],'i').test(m)).slice(0,5);
 console.log(JSON.stringify({slug,status:res.status,meta,imgs}));
}));
for (const r of results) if(r.status==='rejected') console.log(r.reason.message);
