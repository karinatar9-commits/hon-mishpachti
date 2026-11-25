// Meme-style sketch reels (Karin 25.11): white caption bar on top like a classic meme, optional small bottom line + handle.
// usage: node meme/overlay.mjs <cfg.json> <outdir>   cfg: {"cards":{"name":{"top":"...","bottom":"...","big":false}}, "handle":"@goldchain_ai"}
import puppeteer from 'puppeteer'; import fs from 'fs'; import path from 'path';
const cfg = JSON.parse(fs.readFileSync(process.argv[2], 'utf8')); const out = process.argv[3];
const font = path.resolve('node_modules/@fontsource/heebo/files') + '/';
const css = `@font-face{font-family:H;font-weight:900;src:url(file://${font}heebo-hebrew-900-normal.woff2)}@font-face{font-family:H;font-weight:600;src:url(file://${font}heebo-hebrew-600-normal.woff2)}
html,body{margin:0;width:1080px;height:1920px;background:transparent;font-family:H,sans-serif;direction:rtl;position:relative}
.top{position:absolute;top:0;left:0;right:0;height:420px;box-sizing:border-box;display:flex;align-items:center;justify-content:center;background:#fff;color:#111;font-weight:900;text-align:center;padding:110px 60px 20px;line-height:1.12;white-space:pre-line}
.bot{position:absolute;left:60px;right:60px;bottom:330px;text-align:center}.bot span{display:inline-block;white-space:pre-line;background:rgba(10,10,16,.88);color:#fff;font-weight:900;font-size:62px;line-height:1.25;padding:22px 36px;border-radius:28px}
.h{position:absolute;bottom:200px;left:0;right:0;text-align:center;color:rgba(255,255,255,.85);font-weight:600;font-size:36px;direction:ltr;text-shadow:0 2px 12px rgba(0,0,0,.9)}`;
const e = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
fs.mkdirSync(out, { recursive: true });
const br = await puppeteer.launch({ args: ['--no-sandbox'] }); const p = await br.newPage(); await p.setViewport({ width: 1080, height: 1920 });
for (const [k, c] of Object.entries(cfg.cards)) {
  const h = (c.top ? `<div class="top" style="font-size:${c.size || 82}px">${e(c.top)}</div>` : '') + (c.bottom ? `<div class="bot"><span>${e(c.bottom)}</span></div>` : '') + (cfg.handle && !c.noHandle ? `<div class="h">${e(cfg.handle)}</div>` : '');
  const f = `${out}/${k}.html`; fs.writeFileSync(f, `<html><head><meta charset="utf-8"><style>${css}</style></head><body>${h}</body></html>`);
  await p.goto('file://' + path.resolve(f)); await p.evaluate(() => document.fonts.ready); await p.screenshot({ path: `${out}/${k}.png`, omitBackground: true });
}
await br.close(); console.log(Object.keys(cfg.cards));
