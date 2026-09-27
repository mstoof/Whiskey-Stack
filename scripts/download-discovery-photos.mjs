import { writeFile } from 'node:fs/promises';
const photos = {
"kavalan-concertmaster.png": "https://static.gall.nl/images/IMG_684128_500.png?rev=0.4",
"millstone-100-rye.jpg": "https://img.thewhiskyexchange.com/330/dutch_mil3.jpg?v=202407241",
"four-roses-single-barrel.png": "https://static.gall.nl/images/IMG_3844219_500.png?rev=1.3",
"glen-scotia-double-cask.png": "https://static.gall.nl/images/IMG_684147_500.png?rev=0.4",
"kilchoman-sanaig.png": "https://static.gall.nl/images/IMG_683979_500.png?rev=0.4",
"arran-10.png": "https://www.heijdenwijnimport.nl/product-images/5612/331355612/conversions/arran-10-years-single-malt-whisky-search-result@2x.png",
"makers-mark-46.png": "https://www.makersmark.com/sites/default/files/2026-06/makers46_1%20%281%29.png",
"stauning-rye.png": "https://stauningwhisky.com/cdn/shop/files/stauning-whisky-whisky-stauning-r-y-e-whisky-1255014037_1200x1200.png?v=1787149091",
"starward-two-fold.png": "https://starward.com.au/cdn/shop/products/two-fold-starward-whisky-121261.png?v=1698805088",
"wild-turkey-rare-breed.webp": "https://www.wildturkeybourbon.com/app/uploads/sites/3/2024/05/MAS-23-00440_Wild-Turkey-Rare-Breed-750_CAMP_F-2-scaled.webp",

 'redbreast-12.png': 'https://static.gall.nl/images/IMG_1760739_500.png?rev=1.3',
 'bunnahabhain-12.png': 'https://bunnahabhain.com/cdn/shop/files/Bunna12FRONTNaked.png?v=1778145149&width=1000',
 'bulleit-rye.jpg': 'https://images.ctfassets.net/awz4vj3h97d6/4G4lDcXH1qMQUDd38nwm17/208e45a53d9ce77773eba1261ab4cb43/bulleit-rye.jpg?fm=jpg&q=85&w=1000',
 'johnnie-walker-black-label.webp': 'https://images.ctfassets.net/waruwpig3jxu/55BPOqOreCU44edDswoigY/1f8a2698c628970ec6da4a47a718ed23/black-750ml_producthero_fullfront_desktop.webp?q=80&w=1000',
 'amrut-fusion.png': 'https://static.gall.nl/images/IMG_684041_500.png?rev=0.4',
};
const results = await Promise.allSettled(Object.entries(photos).map(async ([file,url]) => {
 const response = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
 if (!response.ok || !response.headers.get('content-type')?.startsWith('image/')) throw new Error(`${file}: ${response.status}`);
 const bytes=Buffer.from(await response.arrayBuffer());
 await writeFile(new URL(`../public/bottles/${file}`,import.meta.url),bytes);
 console.log(file,bytes.length);
}));

for (const r of results) if (r.status === "rejected") console.error(r.reason.message);
