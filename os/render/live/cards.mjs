// Trailer title cards and subtitle strips (transparent PNGs). usage: node live/cards.mjs <cfg.json> <outdir>
// cfg: {"cards":{"c1":["small","BIG"]...}, "subs":["...",...], "end":[l1,l2,l3]}
import puppeteer from 'puppeteer'; import fs from 'fs'; import path from 'path';
const cfg = JSON.parse(fs.readFileSync(process.argv[2], 'utf8')); const out = process.argv[3];
const font = path.resolve('node_modules/@fontsource/heebo/files') + '/';
const css = `@font-face{font-family:H;font-weight:900;src:url(file://${font}heebo-hebrew-900-normal.woff2)}@font-face{font-family:H;font-weight:700;src:url(file://${font}heebo-hebrew-700-normal.woff2)}@font-face{font-family:H;font-weight:400;src:url(file://${font}heebo-hebrew-400-normal.woff2)}
html,body{margin:0;width:1080px;height:1920px;background:transparent;font-family:H,sans-serif;direction:rtl;position:relative}
.bg{position:absolute;inset:0;background:radial-gradient(ellipse at 50% 48%,#1a1412 0%,#050405 70%)}
.c{position:absolute;left:50px;right:50px;text-align:center;color:#f3ede4}
.sm{top:760px;font-weight:400;font-size:58px;letter-spacing:6px;color:#cfc6b8}
.big{font-weight:900;line-height:1.05;letter-spacing:2px;text-shadow:0 0 40px rgba(255,140,60,.25)}
.acc{color:#ff8a3d}
.sub{position:absolute;left:0;right:0;top:1680px;text-align:center;color:#fff;font-weight:700;font-size:44px;line-height:1.3;padding:0 60px;text-shadow:0 2px 10px #000}
.end .c{color:#fff}.pill{display:inline-block;background:#ff8a3d;color:#111;border-radius:16px;padding:10px 30px;font-weight:900}`;
const e = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
const pages = {};
for (const [k, [sm, big, acc]] of Object.entries(cfg.cards)) {
  const fs = big.length > 12 ? 118 : big.length > 8 ? 150 : 190;
  pages[k] = `<div class="bg"></div>${sm ? `<div class="c sm">${e(sm)}</div>` : ''}<div class="c big ${acc ? 'acc' : ''}" style="top:${sm ? 860 : 820}px;font-size:${fs}px">${e(big)}</div>`;
}
cfg.subs.forEach((s, i) => pages['sub' + i] = `<div class="sub">${e(s)}</div>`);
pages.end = `<div class="bg"></div><div class="end"><div class="c big" style="top:600px;font-size:120px">${e(cfg.end[0])}</div><div class="c big acc" style="top:760px;font-size:150px">${e(cfg.end[1])}</div><div class="c" style="top:1000px;font-weight:400;font-size:50px">${e(cfg.end[2])}</div><div class="c" style="top:1130px;font-size:50px"><span class="pill">ייעוץ · וואטסאפ בביו</span></div><div class="c" style="top:1270px;font-weight:900;font-size:64px;direction:ltr">goldchain-ai.com</div></div>`;
fs.mkdirSync(out, { recursive: true });
const br = await puppeteer.launch({ args: ['--no-sandbox'] }); const p = await br.newPage(); await p.setViewport({ width: 1080, height: 1920 });
for (const [k, h] of Object.entries(pages)) { const f = `${out}/${k}.html`; fs.writeFileSync(f, `<html><head><meta charset="utf-8"><style>${css}</style></head><body>${h}</body></html>`); await p.goto('file://' + path.resolve(f)); await p.evaluate(() => document.fonts.ready); await p.screenshot({ path: `${out}/${k}.png`, omitBackground: !h.includes('class="bg"') }); }
await br.close();
