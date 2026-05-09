import https from "https";

async function fetchDDGImages(query) {
  // 1. Get vqd token
  const res1 = await fetch(`https://duckduckgo.com/?q=${encodeURIComponent(query)}`, {
    headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" }
  });
  const html = await res1.text();
  const vqdMatch = html.match(/vqd=["']([^"']+)["']/);
  if (!vqdMatch) throw new Error("No vqd found");
  const vqd = vqdMatch[1];

  // 2. Search images
  const res2 = await fetch(`https://duckduckgo.com/i.js?l=us-en&o=json&q=${encodeURIComponent(query)}&vqd=${vqd}&f=,,,,&p=1`, {
    headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" }
  });
  const json = await res2.json();
  return json.results.map(r => r.image);
}

const urls = await fetchDDGImages("Daikin Perfera FTXM25A");
console.log("DDG Images:", urls.slice(0, 5));
