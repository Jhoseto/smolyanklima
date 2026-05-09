const q = encodeURIComponent("Daikin Perfera FTXM25A");
const url = `https://html.duckduckgo.com/html/?q=${q}`;
const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" } });
const html = await res.text();
const imgs = [...html.matchAll(/<img[^>]+src=['"]([^'"]+)['"]/g)].map(m => m[1]);
console.log("DDG imgs:", imgs.slice(0, 5));
