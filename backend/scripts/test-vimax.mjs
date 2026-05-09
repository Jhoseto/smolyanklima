const q = encodeURIComponent("Медни тръби");
const url = `https://vimax.bg/search.html?phrase=${q}`;
const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" } });
const html = await res.text();
const allUrls = html.match(/https:\/\/vimax\.bg\/image\/cache\/catalog\/[^"'\s]+\.(?:jpg|jpeg|png|webp)/gi) || [];

const valid = [...new Set(allUrls)].filter(u => {
  if (u.includes("logo") || u.includes("banner") || u.includes("icon")) return false;
  return true;
});

console.log("valid urls:", valid);
