const q = encodeURIComponent("Daikin Perfera FTXM25A");
const url = `https://api.technopolis.bg/b2c/products/search?query=${q}`;
const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" } });
const json = await res.json();
console.log("Technopolis API:", json.products?.[0]?.images);
