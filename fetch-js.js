import https from 'https';

const url = 'https://smolianklima.onhercules.app/assets/index-DWvYysuu.js';

https.get(url, (res) => {
  let chunks = [];
  res.on('data', (chunk) => chunks.push(chunk));
  res.on('end', () => {
    const data = Buffer.concat(chunks).toString('utf-8');
    // Extracting long strings that might be Bulgarian text
    const regex = /"[^"]*[А-Яа-я]+[^"]*"/g;
    const matches = data.match(regex);
    if (matches) {
       // Filter out too short strings or code-like stuff
       const filtered = matches.filter(m => m.length > 5);
       console.log(Array.from(new Set(filtered)).join('\n'));
    } else {
       console.log("No Cyrillic matches found.");
    }
  });
}).on('error', (e) => {
  console.error(e);
});
