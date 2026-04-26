import https from 'https';

https.get('https://smolianklima.onhercules.app/', (res) => {
  let data = '';
  res.on('data', (chunk) => data += chunk);
  res.on('end', () => console.log(data));
});
