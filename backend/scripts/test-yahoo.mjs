const q = encodeURIComponent("Mitsubishi Electric MSZ-AP25VG");
const url = `https://images.search.yahoo.com/search/images?p=${q}`;
const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" } });
const html = await res.text();
// Yahoo stores image data in a JSON array inside a script tag or data attributes
const matches = [...html.matchAll(/imgurl=(https:\/\/[^&]+)&/g)].map(m => decodeURIComponent(m[1]));
console.log("Yahoo imgs:", matches.slice(0, 5));
