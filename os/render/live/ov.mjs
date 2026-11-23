// Overlays for the live-action reels: a top headline per narration line (from frame one), a subtitle pill per line, an end card.
// usage: node live/ov.mjs <cfg.json> <outdir>   cfg: {"hl":[[small, big],...], "subs":["...",...], "end":[l1, l2, l3]}
import puppeteer from 'puppeteer'; import fs from 'fs'; import path from 'path';
const cfg = JSON.parse(fs.readFileSync(process.argv[2], 'utf8')); const out = process.argv[3];
const font = path.resolve('node_modules/@fontsource/heebo/files') + '/';
const css = `@font-face{font-family:H;font-weight:900;src:url(file://${font}heebo-hebrew-900-normal.woff2)}@font-face{font-family:H;font-weight:700;src:url(file://${font}heebo-hebrew-700-normal.woff2)}@font-face{font-family:H;font-weight:600;src:url(file://${font}heebo-hebrew-600-normal.woff2)}
html,body{margin:0;width:1080px;height:1920px;background:transparent;font-family:H,sans-serif;direction:rtl;position:relative}
.top{position:absolute;left:0;right:0;top:0;height:520px;background:linear-gradient(rgba(8,6,14,.82),rgba(8,6,14,.55) 60%,rgba(8,6,14,0))}
.s{position:absolute;left:40px;right:40px;top:110px;text-align:center;color:#fff;font-weight:700;font-size:64px;text-shadow:0 4px 20px rgba(0,0,0,.6)}
.b{position:absolute;left:30px;right:30px;top:200px;text-align:center;color:#f5d77a;font-weight:900;line-height:1.05;text-shadow:0 6px 30px rgba(0,0,0,.7)}
.sub{position:absolute;left:0;right:0;top:1540px;text-align:center}.sub span{display:inline-block;max-width:920px;background:rgba(10,8,16,.78);color:#fff;font-weight:700;font-size:48px;line-height:1.35;padding:14px 30px;border-radius:18px}
.end{position:absolute;inset:0;background:rgba(8,6,14,.88)}.c{position:absolute;left:40px;right:40px;text-align:center;color:#fff}.acc{color:#f5d77a}.pill{display:inline-block;background:#fff;color:#111;border-radius:18px;padding:10px 28px}`;
const e = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
const cards = {};
cfg.hl.forEach(([s, b], i) => { const fs = b.length > 14 ? 104 : b.length > 10 ? 124 : 140; cards['hl' + i] = `<div class="top"></div><div class="s">${e(s)}</div><div class="b" style="font-size:${fs}px">${e(b)}</div>`; });
cfg.subs.forEach((s, i) => cards['sub' + i] = `<div class="sub"><span>${e(s)}</span></div>`);
cards.end = `<div class="end"></div><div class="c" style="top:560px;font-weight:900;font-size:96px;line-height:1.15">${e(cfg.end[0])}<br><span class="acc">${e(cfg.end[1])}</span></div><div class="c" style="top:930px;font-weight:600;font-size:52px">${e(cfg.end[2])}</div><div class="c" style="top:1080px;font-weight:600;font-size:50px"><span class="pill">ייעוץ · וואטסאפ בביו</span></div><div class="c" style="top:1210px;font-weight:900;font-size:66px;direction:ltr">goldchain-ai.com</div>`;
fs.mkdirSync(out, { recursive: true });
const br = await puppeteer.launch({ args: ['--no-sandbox'] }); const p = await br.newPage(); await p.setViewport({ width: 1080, height: 1920 });
for (const [k, h] of Object.entries(cards)) { const f = `${out}/${k}.html`; fs.writeFileSync(f, `<html><head><meta charset="utf-8"><style>${css}</style></head><body>${h}</body></html>`); await p.goto('file://' + path.resolve(f)); await p.evaluate(() => document.fonts.ready); await p.screenshot({ path: `${out}/${k}.png`, omitBackground: true }); }
await br.close();
