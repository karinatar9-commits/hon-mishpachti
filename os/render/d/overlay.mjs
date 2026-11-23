// Transparent 1080x1920 PNG cards for format D ("טעות שעולה כסף") reels.
// usage: node d/overlay.mjs <cfg.json> <outdir>   cfg: {"hooks":{"A":[l1,l2],"B":[l1,l2]}, "labels":{"name":"text"}, "end":[l1,l2]}
import puppeteer from 'puppeteer'; import fs from 'fs'; import path from 'path';
const cfg = JSON.parse(fs.readFileSync(process.argv[2], 'utf8')); const out = process.argv[3];
const font = path.resolve('node_modules/@fontsource/heebo/files') + '/';
const css = `@font-face{font-family:H;font-weight:900;src:url(file://${font}heebo-hebrew-900-normal.woff2)}@font-face{font-family:H;font-weight:600;src:url(file://${font}heebo-hebrew-600-normal.woff2)}
html,body{margin:0;width:1080px;height:1920px;background:transparent;font-family:H,sans-serif;direction:rtl;position:relative}
.c{position:absolute;left:60px;right:60px;text-align:center;color:#fff;text-shadow:0 6px 40px rgba(0,0,0,.9)}
.acc{color:#f5d77a}.pill{display:inline-block;background:#fff;color:#111;text-shadow:none;border-radius:18px;padding:10px 28px}
.shade{position:absolute;left:0;right:0;top:0;height:900px;background:linear-gradient(rgba(6,4,14,.75),rgba(6,4,14,0))}
.lab{position:absolute;left:0;right:0;top:1500px;text-align:center}.lab span{display:inline-block;background:rgba(255,255,255,.95);color:#111;font-weight:900;font-size:60px;padding:12px 36px;border-radius:22px;box-shadow:0 10px 40px rgba(0,0,0,.5)}
.end{position:absolute;inset:0;background:rgba(6,4,14,.86)}`;
const e = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
const cards = {};
for (const [k, h] of Object.entries(cfg.hooks)) cards['hook' + k] = `<div class="shade"></div><div class="c" style="top:260px;font-weight:900;font-size:112px;line-height:1.12">${e(h[0])}<br><span class="acc">${e(h[1])}</span></div>`;
for (const [k, t] of Object.entries(cfg.labels)) cards[k] = `<div class="lab"><span>${e(t)}</span></div>`;
cards.end = `<div class="end"></div><div class="c" style="top:520px;font-weight:900;font-size:100px;line-height:1.15">${e(cfg.end[0])}<br><span class="acc">${e(cfg.end[1])}</span></div><div class="c" style="top:1000px;font-weight:900;font-size:58px">רוצים כזה בעסק שלכם?</div><div class="c" style="top:1110px;font-weight:600;font-size:52px"><span class="pill">השאירו פרטים לייעוץ</span></div><div class="c" style="top:1240px;font-weight:900;font-size:66px;direction:ltr">goldchain-ai.com</div><div class="c" style="top:1360px;font-weight:600;font-size:46px">או בוואטסאפ · הקישור בביו</div>`;
fs.mkdirSync(out, { recursive: true });
const br = await puppeteer.launch({ args: ['--no-sandbox'] }); const p = await br.newPage(); await p.setViewport({ width: 1080, height: 1920 });
for (const [k, h] of Object.entries(cards)) { const f = `${out}/${k}.html`; fs.writeFileSync(f, `<html><head><meta charset="utf-8"><style>${css}</style></head><body>${h}</body></html>`); await p.goto('file://' + path.resolve(f)); await p.evaluate(() => document.fonts.ready); await p.screenshot({ path: `${out}/${k}.png`, omitBackground: true }); }
await br.close();
