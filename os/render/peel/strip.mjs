// Renders the long "agent at work" strip image that gets mapped onto the peeled green strip.
// usage: node peel/strip.mjs <cfg.json> <out.png>   cfg: {"items":[["icon","text"],...]}
import puppeteer from 'puppeteer'; import fs from 'fs'; import path from 'path';
const cfg = JSON.parse(fs.readFileSync(process.argv[2], 'utf8')); const font = path.resolve('node_modules/@fontsource/heebo/files') + '/';
const items = cfg.items.map(([i, t]) => `<div class="it"><span class="ic">${i}</span>${t}</div>`).join('<div class="sep"></div>');
const html = `<html><head><meta charset="utf-8"><style>@font-face{font-family:H;font-weight:900;src:url(file://${font}heebo-hebrew-900-normal.woff2)}
html,body{margin:0;height:360px;background:linear-gradient(180deg,#1638ff,#0b1aa8);font-family:H,sans-serif;direction:rtl;color:#fff}
.row{display:inline-flex;align-items:center;height:360px;padding:0 120px;gap:70px;white-space:nowrap}
.it{display:flex;align-items:center;gap:30px;font-weight:900;font-size:120px}.ic{display:inline-flex;width:130px;height:130px;border-radius:50%;background:#2ee59d;color:#063;align-items:center;justify-content:center;font-size:90px}
.sep{width:18px;height:18px;border-radius:50%;background:#ffd23f}</style></head><body><div class="row" id="r">${items}</div></body></html>`;
const f = process.argv[3].replace(/\.png$/, '.html'); fs.writeFileSync(f, html);
const br = await puppeteer.launch({ args: ['--no-sandbox'] }); const p = await br.newPage(); await p.setViewport({ width: 400, height: 360 });
await p.goto('file://' + path.resolve(f)); await p.evaluate(() => document.fonts.ready);
const w = await p.evaluate(() => document.getElementById('r').scrollWidth); await p.setViewport({ width: w, height: 360 });
await p.screenshot({ path: process.argv[3] }); await br.close(); console.log(process.argv[3], w);
