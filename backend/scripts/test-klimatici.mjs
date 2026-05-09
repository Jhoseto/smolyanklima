const q = encodeURIComponent("Daikin Perfera FTXM25A");
const url = `https://klimatici.bg/search?q=${q}`;
const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" } });
const html = await res.text();
const allUrls = html.match(/https?:\/\/[^"'\s]+\.(?:jpg|jpeg|png|webp)/gi) || [];
console.log("all urls:", [...new Set(allUrls)].slice(0, 10));
