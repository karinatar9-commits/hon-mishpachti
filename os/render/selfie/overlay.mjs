// Overlays for the "selfie talk" reel format (Karin's real footage, lip-synced to her narration): transparent 1080x1920 PNGs.
// usage: node selfie/overlay.mjs cfg.json outdir   cfg: {"tops":[{html}], "caps":["text",...]}
import puppeteer from 'puppeteer'; import fs from 'fs'; import path from 'path';
const cfg = JSON.parse(fs.readFileSync(process.argv[2], 'utf8')); const out = process.argv[3]; fs.mkdirSync(out, { recursive: true });
const font = path.resolve('node_modules/@fontsource/heebo/files') + '/';
const css = `@font-face{font-family:H;font-weight:900;src:url(file://${font}heebo-hebrew-900-normal.woff2)}@font-face{font-family:H;font-weight:700;src:url(file://${font}heebo-hebrew-700-normal.woff2)}@font-face{font-family:L;font-weight:900;src:url(file://${font}heebo-latin-900-normal.woff2)}
html,body{margin:0;width:1080px;height:1920px;background:transparent;font-family:H,L,sans-serif;direction:rtl;color:#fff}
.top{position:absolute;top:150px;left:60px;right:60px;display:flex;flex-direction:column;align-items:center;gap:18px;text-align:center}
.pill{background:#ffd23f;color:#111;font-weight:900;font-size:92px;line-height:1;padding:12px 40px 18px;border-radius:28px;transform:rotate(-2deg);box-shadow:0 10px 0 rgba(0,0,0,.25)}
.h{font-weight:900;font-size:82px;line-height:1.1;margin-top:26px;text-shadow:0 4px 0 #000,0 0 22px rgba(0,0,0,.85),0 0 6px #000;-webkit-text-stroke:2px #000;paint-order:stroke fill}
.h b{color:#ffd23f}
.q{display:flex;align-items:center;gap:26px;background:#fff;color:#111;border-radius:36px;padding:26px 34px;box-shadow:0 14px 40px rgba(0,0,0,.45);text-align:right}
.q i{flex:none;font-style:normal;width:120px;height:120px;border-radius:50%;background:#ff5a1f;color:#fff;font-weight:900;font-size:86px;line-height:120px;text-align:center}
.q span{font-weight:900;font-size:58px;line-height:1.15}
.cap{position:absolute;top:1235px;left:60px;right:60px;text-align:center;font-weight:900;font-size:84px;line-height:1.18;-webkit-text-stroke:14px #000;paint-order:stroke fill;text-shadow:0 8px 0 rgba(0,0,0,.6)}
.cap b{color:#ffd23f}.tag{font-weight:700;font-size:44px;background:rgba(0,0,0,.6);padding:8px 26px;border-radius:999px;direction:ltr}`;
const br = await puppeteer.launch({ args: ['--no-sandbox'] }); const p = await br.newPage(); await p.setViewport({ width: 1080, height: 1920 });
const shot = async (body, name) => { await p.setContent(`<html><head><meta charset="utf-8"><style>${css}${cfg.css||''}</style></head><body>${body}</body></html>`); await p.evaluate(() => document.fonts.ready); await p.screenshot({ path: `${out}/${name}.png`, omitBackground: true }); };
for (const [i, t] of cfg.tops.entries()) await shot(`<div class="top">${t.html}</div>`, `t${i}`);
for (const [i, c] of cfg.caps.entries()) await shot(`<div class="cap">${c.text}</div>`, `c${i}`);
await br.close(); console.log('ok', cfg.tops.length, cfg.caps.length);
