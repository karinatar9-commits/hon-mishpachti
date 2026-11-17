// Renders transparent 1080x1920 PNG overlays for a before/after split-screen reel from cfg.json.
// usage: node overlays.mjs <cfg.json> <outdir>   (run from a folder with puppeteer + @fontsource/heebo installed)
import puppeteer from 'puppeteer'; import fs from 'fs'; import path from 'path';
const cfg = JSON.parse(fs.readFileSync(process.argv[2], 'utf8')); const out = process.argv[3];
const font = path.resolve('node_modules/@fontsource/heebo/files') + '/';
const css = `@font-face{font-family:H;font-weight:900;src:url(file://${font}heebo-hebrew-900-normal.woff2)}@font-face{font-family:H;font-weight:600;src:url(file://${font}heebo-hebrew-600-normal.woff2)}
html,body{margin:0;width:1080px;height:1920px;background:transparent;font-family:H,sans-serif;direction:rtl;position:relative}
.tag{position:absolute;right:40px;font-weight:900;font-size:50px;padding:10px 28px;border-radius:16px;color:#fff;box-shadow:0 8px 30px rgba(0,0,0,.4)}
.bad{top:40px;background:#e5484d}.good{top:1000px;background:#22a06b}
.bar{position:absolute;top:940px;left:0;right:0;height:40px;background:#0b0b14}
.beat{position:absolute;top:905px;left:0;right:0;text-align:center}.beat span{display:inline-block;background:#fff;color:#111;font-weight:900;font-size:62px;padding:8px 34px;border-radius:20px;box-shadow:0 10px 40px rgba(0,0,0,.5)}
.c{position:absolute;left:0;right:0;text-align:center;color:#fff;text-shadow:0 6px 40px rgba(0,0,0,.9)}
.acc{color:#f5d77a}.pill{display:inline-block;background:#fff;color:#111;text-shadow:none;border-radius:18px;padding:10px 28px}
.dim{position:absolute;inset:0;background:rgba(6,4,14,.55)}.end{position:absolute;inset:0;background:rgba(6,4,14,.86)}`;
const e = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
const cards = {
  frame: `<div class="bar"></div><div class="tag bad">${e(cfg.badTag || 'בלי סוכן')}</div><div class="tag good">${e(cfg.goodTag || 'עם סוכן')}</div>`,
  hook: `<div class="dim"></div><div class="c" style="top:700px;font-weight:900;font-size:120px;line-height:1.1">${e(cfg.hook[0])}<br><span class="acc">${e(cfg.hook[1])}</span></div><div class="c" style="top:1020px;font-weight:600;font-size:56px">${e(cfg.hook[2] || '')}</div>`,
  end: `<div class="end"></div><div class="c" style="top:520px;font-weight:900;font-size:104px;line-height:1.15">${e(cfg.end[0])}<br><span class="acc">${e(cfg.end[1])}</span></div><div class="c" style="top:840px;font-weight:600;font-size:56px;line-height:1.4">${e(cfg.end[2]).replace(/\|/g, '<br>')}</div><div class="c" style="top:1090px;font-weight:900;font-size:58px">רוצים כזה בעסק שלכם?</div><div class="c" style="top:1200px;font-weight:600;font-size:52px"><span class="pill">השאירו פרטים לייעוץ</span></div><div class="c" style="top:1330px;font-weight:900;font-size:66px;direction:ltr">goldchain-ai.com</div><div class="c" style="top:1450px;font-weight:600;font-size:46px">או בוואטסאפ · הקישור בביו</div>`
};
cfg.beats.forEach((b, i) => cards['b' + i] = `<div class="beat"><span style="${/\d/.test(b) ? 'direction:ltr' : ''}">${e(b)}</span></div>`);
fs.mkdirSync(out, { recursive: true });
const br = await puppeteer.launch({ args: ['--no-sandbox'] }); const p = await br.newPage(); await p.setViewport({ width: 1080, height: 1920 });
for (const [k, h] of Object.entries(cards)) { const f = `${out}/${k}.html`; fs.writeFileSync(f, `<html><head><meta charset="utf-8"><style>${css}</style></head><body>${h}</body></html>`); await p.goto('file://' + path.resolve(f)); await p.evaluate(() => document.fonts.ready); await p.screenshot({ path: `${out}/${k}.png`, omitBackground: true }); }
await br.close();
