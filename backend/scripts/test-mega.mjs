const q = encodeURIComponent("Монтажна стойка за климатик");
const url = `https://megaelectronics.bg/?s=${q}&post_type=product`;
const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" } });
const html = await res.text();
const allUrls = html.match(/https:\/\/megaelectronics\.bg\/wp-content\/uploads\/[^"'\s]+\.(?:jpg|jpeg|png|webp)/gi) || [];

const valid = [...new Set(allUrls)].filter(u => {
  if (u.includes("cropped-") || u.includes("fav_") || u.includes("viber") || u.includes("logo") || u.toLowerCase().includes("mega_logo")) return false;
  if (u.match(/-\d+x\d+\.(jpg|jpeg|png|webp)$/i)) return false;
  return true;
});

console.log("valid urls:", valid);
