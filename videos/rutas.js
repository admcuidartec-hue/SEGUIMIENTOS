// Sirve unpkg y Google Fonts desde copias locales (el navegador del sandbox no sale a internet).
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const CDN = path.join(__dirname, 'cdn');
const PK = { 'react@18.3.1': 'react-18.3.1', 'react-dom@18.3.1': 'react-dom-18.3.1', '@babel/standalone@7.29.0': 'babel-standalone-7.29.0', '@phosphor-icons/web@2.1.1': 'phosphor-icons-web-2.1.1' };
const tipo = f => f.endsWith('.js') ? 'application/javascript' : f.endsWith('.css') ? 'text/css' : f.endsWith('.woff2') ? 'font/woff2' : f.endsWith('.woff') ? 'font/woff' : f.endsWith('.ttf') ? 'font/ttf' : 'application/octet-stream';
module.exports = async ctx => {
  await ctx.route(/^https:\/\/unpkg\.com\//, route => {
    const u = new URL(route.request().url()); let rest = decodeURIComponent(u.pathname.slice(1));
    const k = Object.keys(PK).find(x => rest === x || rest.startsWith(x + '/'));
    if (!k) return route.abort();
    let sub = rest.slice(k.length + 1) || JSON.parse(fs.readFileSync(path.join(CDN, PK[k], 'package/package.json'))).main || 'index.js';
    const f = path.join(CDN, PK[k], 'package', sub);
    if (!fs.existsSync(f)) return route.abort();
    route.fulfill({ body: fs.readFileSync(f), contentType: tipo(f), headers: { 'access-control-allow-origin': '*' } });
  });
  await ctx.route(/^https:\/\/fonts\.googleapis\.com\//, route => route.fulfill({ body: fs.readFileSync(path.join(CDN, 'fonts/geist.css')), contentType: 'text/css', headers: { 'access-control-allow-origin': '*' } }));
  await ctx.route(/^https:\/\/fonts\.gstatic\.com\//, route => {
    const f = path.join(CDN, 'fonts', crypto.createHash('md5').update(route.request().url() + '\n').digest('hex').slice(0, 12) + '.woff2');
    if (!fs.existsSync(f)) return route.abort();
    route.fulfill({ body: fs.readFileSync(f), contentType: 'font/woff2', headers: { 'access-control-allow-origin': '*' } });
  });
};
