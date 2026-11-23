// Overlays for the avatar layout (box on top, Karin's avatar small at the bottom). 1080x1920 transparent PNGs.
// usage: node d/av_overlay.mjs <cfg.json> <outdir>   cfg: same as d/overlay.mjs ({hooks, labels, end})
import puppeteer from 'puppeteer'; import fs from 'fs'; import path from 'path';
const cfg = JSON.parse(fs.readFileSync(process.argv[2], 'utf8')); const out = process.argv[3];
const font = path.resolve('node_modules/@fontsource/heebo/files') + '/';
const css = `@font-face{font-family:H;font-weight:900;src:url(file://${font}heebo-hebrew-900-normal.woff2)}@font-face{font-family:H;font-weight:600;src:url(file://${font}heebo-hebrew-600-normal.woff2)}
html,body{margin:0;width:1080px;height:1920px;background:transparent;font-family:H,sans-serif;direction:rtl;position:relative}
.c{position:absolute;left:40px;right:40px;text-align:center;color:#fff}
.acc{color:#f5d77a}.pill{display:inline-block;background:#fff;color:#111;border-radius:18px;padding:10px 28px}
.lab{position:absolute;left:0;right:0;top:120px;text-align:center}.lab span{display:inline-block;background:#f5d77a;color:#111;font-weight:900;font-size:58px;padding:10px 36px;border-radius:22px}
.name{position:absolute;right:70px;top:1810px;font-weight:900;font-size:36px;color:#fff;background:rgba(0,0,0,.55);padding:6px 22px;border-radius:14px}
.end{position:absolute;inset:0;background:rgba(6,4,14,.9)}`;
const e = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
const cards = {};
for (const [k, h] of Object.entries(cfg.hooks)) cards['hook' + k] = `<div class="c" style="top:40px;font-weight:900;font-size:82px;line-height:1.08">${e(h[0])}<br><span class="acc">${e(h[1])}</span></div>`;
for (const [k, t] of Object.entries(cfg.labels)) cards[k] = `<div class="lab"><span>${e(t)}</span></div>`;
cards.frame = `<div class="name">Goldchain AI</div>`;
cards.end = `<div class="end"></div><div class="c" style="top:480px;font-weight:900;font-size:100px;line-height:1.15">${e(cfg.end[0])}<br><span class="acc">${e(cfg.end[1])}</span></div><div class="c" style="top:960px;font-weight:900;font-size:58px">רוצים כזה בעסק שלכם?</div><div class="c" style="top:1070px;font-weight:600;font-size:52px"><span class="pill">השאירו פרטים לייעוץ</span></div><div class="c" style="top:1200px;font-weight:900;font-size:66px;direction:ltr">goldchain-ai.com</div><div class="c" style="top:1320px;font-weight:600;font-size:46px">או בוואטסאפ · הקישור בביו</div>`;
fs.mkdirSync(out, { recursive: true });
const br = await puppeteer.launch({ args: ['--no-sandbox'] }); const p = await br.newPage(); await p.setViewport({ width: 1080, height: 1920 });
for (const [k, h] of Object.entries(cards)) { const f = `${out}/${k}.html`; fs.writeFileSync(f, `<html><head><meta charset="utf-8"><style>${css}</style></head><body>${h}</body></html>`); await p.goto('file://' + path.resolve(f)); await p.evaluate(() => document.fonts.ready); await p.screenshot({ path: `${out}/${k}.png`, omitBackground: true }); }
await br.close();
