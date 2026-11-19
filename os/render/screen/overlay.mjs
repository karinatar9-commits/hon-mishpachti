// Header sticker + end CTA PNGs (1080x1920, transparent) for the screen-series reels.
// usage: node screen/overlay.mjs <episode.json> <outdir>   episode.json: {"series":"...","ep":1,"title":["l1","l2"]}
import puppeteer from 'puppeteer'; import fs from 'fs'; import path from 'path';
const ep = JSON.parse(fs.readFileSync(process.argv[2], 'utf8')); const out = process.argv[3]; fs.mkdirSync(out, { recursive: true });
const font = path.resolve('node_modules/@fontsource/heebo/files') + '/';
const css = `@font-face{font-family:H;font-weight:900;src:url(file://${font}heebo-hebrew-900-normal.woff2)}@font-face{font-family:H;font-weight:600;src:url(file://${font}heebo-hebrew-600-normal.woff2)}
html,body{margin:0;width:1080px;height:1920px;background:transparent;font-family:H,sans-serif;direction:rtl;color:#fff;position:relative}
.hd{position:absolute;top:250px;right:70px;left:70px;transform:rotate(-3deg)}
.burst{position:absolute;top:-95px;right:-60px;width:250px;height:250px}
.ser{display:inline-block;background:#ff5a1f;color:#fff;font-weight:900;font-size:44px;padding:8px 26px;border-radius:14px;position:relative}
.t{font-weight:900;font-size:96px;line-height:1.02;margin-top:18px;text-shadow:0 8px 40px rgba(0,0,0,.8);position:relative}.t span{color:#ffd23f}
.end{position:absolute;inset:0;background:rgba(6,4,14,.82)}.c{position:absolute;left:0;right:0;text-align:center}
.pill{display:inline-block;background:#fff;color:#111;border-radius:18px;padding:10px 28px}`;
const burst = `<svg class="burst" viewBox="-50 -50 100 100">${Array.from({ length: 14 }, (_, i) => `<rect x="-2.4" y="-48" width="4.8" height="30" rx="2.4" fill="#ff5a1f" transform="rotate(${i * 360 / 14})"/>`).join('')}</svg>`;
const cards = {
  head: `<div class="hd"><div class="ser">${ep.tag || (ep.series + ' · פרק ' + ep.ep)}</div><div class="t">${ep.title[0]}<br><span>${ep.title[1]}</span></div></div>`,
  cta: `<div class="end"></div><div class="c" style="top:640px;font-weight:900;font-size:100px;line-height:1.1">${ep.end?.[0] || 'רוצים כזה'}<br><span style="color:#ffd23f">${ep.end?.[1] || 'בעסק שלכם?'}</span></div><div class="c" style="top:960px;font-weight:600;font-size:52px"><span class="pill">${ep.pill || 'השאירו פרטים לייעוץ'}</span></div><div class="c" style="top:1090px;font-weight:900;font-size:68px;direction:ltr">goldchain-ai.com</div><div class="c" style="top:1210px;font-weight:600;font-size:46px">או בוואטסאפ · הקישור בביו</div>${ep.tag ? '' : `<div class="c" style="top:1330px;font-weight:600;font-size:40px;opacity:.75">${ep.series} · פרק ${ep.ep + 1} בקרוב</div>`}`
};
const br = await puppeteer.launch({ args: ['--no-sandbox'] }); const p = await br.newPage(); await p.setViewport({ width: 1080, height: 1920 });
for (const [k, h] of Object.entries(cards)) { const f = `${out}/${k}.html`; fs.writeFileSync(f, `<html><head><meta charset="utf-8"><style>${css}</style></head><body>${h}</body></html>`); await p.goto('file://' + path.resolve(f)); await p.evaluate(() => document.fonts.ready); await p.screenshot({ path: `${out}/${k}.png`, omitBackground: true }); }
await br.close();
