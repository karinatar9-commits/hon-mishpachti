// Transparent 1280x800 frames: big "agent did it" chips that pop over the footage shown on the laptop screen.
// usage: node peel/chips.mjs <cfg.json> <outdir>  cfg: {"dur":18.5,"chips":[[tIn,tOut,"text"],...]}
import puppeteer from 'puppeteer'; import fs from 'fs'; import path from 'path';
const c = JSON.parse(fs.readFileSync(process.argv[2], 'utf8')); const out = process.argv[3]; const FPS = 30;
const font = path.resolve('node_modules/@fontsource/heebo/files') + '/';
const A = (n, d, t, e = 'cubic-bezier(.2,1.4,.4,1)') => `${n} ${d}s ${e} ${t}s both`;
const css = `@font-face{font-family:H;font-weight:900;src:url(file://${font}heebo-hebrew-900-normal.woff2)}
*{animation-play-state:paused!important}html,body{margin:0;width:1280px;height:800px;background:transparent;font-family:H,sans-serif;direction:rtl;overflow:hidden;position:relative}
.ch{position:absolute;top:60px;right:60px;display:flex;align-items:center;gap:22px;background:#fff;color:#111;font-weight:900;font-size:66px;padding:20px 46px 20px 34px;border-radius:999px;box-shadow:0 20px 60px rgba(0,0,0,.45)}
.ck{flex:none;width:76px;height:76px;border-radius:50%;background:#22a06b;position:relative}.ck:after{content:'';position:absolute;left:26px;top:12px;width:18px;height:38px;border:solid #fff;border-width:0 9px 9px 0;transform:rotate(45deg)}
@keyframes pop{from{transform:scale(.4) translateY(-40px);opacity:0}to{transform:none;opacity:1}}@keyframes out{to{transform:translateY(-30px);opacity:0}}`;
const h = c.chips.map(([a, b, t]) => `<div class="ch" style="animation:${A('pop', .45, a)},${A('out', .25, b, 'ease-in')}"><span class="ck"></span>${t}</div>`).join('');
fs.mkdirSync(out, { recursive: true }); fs.writeFileSync(`${out}/page.html`, `<html><head><meta charset="utf-8"><style>${css}</style></head><body>${h}</body></html>`);
const br = await puppeteer.launch({ args: ['--no-sandbox'] }); const p = await br.newPage(); await p.setViewport({ width: 1280, height: 800 });
await p.goto('file://' + path.resolve(`${out}/page.html`)); await p.evaluate(() => document.fonts.ready);
for (let k = 0; k < Math.round(c.dur * FPS); k++) { await p.evaluate((t) => document.getAnimations().forEach(a => { a.currentTime = t * 1000; }), k / FPS); await p.screenshot({ path: `${out}/${String(k).padStart(4, '0')}.png`, omitBackground: true }); }
await br.close(); console.log('ok');
