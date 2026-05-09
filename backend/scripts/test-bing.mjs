const q = encodeURIComponent("Mitsubishi Electric MSZ-AP25VG");
const url = `https://www.bing.com/images/search?q=${q}`;
const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" } });
const html = await res.text();
// Bing stores image URLs in m="{... murl: 'https://...' ...}"
const matches = [...html.matchAll(/murl&quot;:&quot;(https:\/\/[^&]+)&quot;/g)].map(m => m[1]);
console.log("Bing imgs:", matches.slice(0, 5));
