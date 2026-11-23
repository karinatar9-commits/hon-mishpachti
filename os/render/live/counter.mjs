// Animated counter overlays (transparent PNG frames at 30 fps).
// usage: node live/counter.mjs <outdir> <kind> <from> <to> <countSec> <holdSec> [small] [big]
//  kind=head: the top headline whose big line is a rolling number + word (hook from frame one)
//  kind=pill: a centred pill "<label> N" that turns green at 0
import puppeteer from 'puppeteer'; import fs from 'fs'; import path from 'path';
const [out, kind, from, to, cs, hs, small = '', word = ''] = process.argv.slice(2);
const font = path.resolve('node_modules/@fontsource/heebo/files') + '/';
const css = `@font-face{font-family:H;font-weight:900;src:url(file://${font}heebo-hebrew-900-normal.woff2)}@font-face{font-family:H;font-weight:700;src:url(file://${font}heebo-hebrew-700-normal.woff2)}
html,body{margin:0;width:1080px;height:1920px;background:transparent;font-family:H,sans-serif;direction:rtl;position:relative}
.top{position:absolute;left:0;right:0;top:0;height:560px;background:linear-gradient(rgba(8,6,14,.85),rgba(8,6,14,.55) 60%,rgba(8,6,14,0))}
.s{position:absolute;left:40px;right:40px;top:96px;text-align:center;color:#fff;font-weight:700;font-size:66px}
.b{position:absolute;left:20px;right:20px;top:180px;text-align:center;font-weight:900;font-size:170px;line-height:1;color:#ff4d3d;text-shadow:0 8px 40px rgba(0,0,0,.6)}
.b .w{color:#fff;font-size:120px}
.pill{position:absolute;left:0;right:0;top:1180px;text-align:center}.pill span{display:inline-block;padding:18px 44px;border-radius:999px;font-weight:900;font-size:86px;color:#fff;box-shadow:0 12px 40px rgba(0,0,0,.5)}`;
const FPS = 30, n1 = Math.round(+cs * FPS), n2 = Math.round(+hs * FPS);
fs.mkdirSync(out, { recursive: true });
const br = await puppeteer.launch({ args: ['--no-sandbox'] }); const p = await br.newPage(); await p.setViewport({ width: 1080, height: 1920 });
await p.setContent(`<html><head><meta charset="utf-8"><style>${css}</style></head><body><div id="r"></div></body></html>`); await p.evaluate(() => document.fonts.ready);
for (let f = 0; f < n1 + n2; f++) {
  const u = Math.min(1, f / Math.max(1, n1)), e = 1 - Math.pow(1 - u, 3), v = Math.round(+from + (+to - +from) * e);
  const pulse = 1 + .06 * Math.max(0, Math.sin(f / 3)) * (u < 1 ? 1 : 0);
  const html = kind === 'head'
    ? `<div class="top"></div><div class="s">${small}</div><div class="b" style="transform:scale(${pulse})">${v} <span class="w">${word}</span></div>`
    : `<div class="pill"><span style="background:${v === 0 ? '#22a06b' : '#e5484d'};transform:scale(${v === 0 ? 1.08 : 1})">${v === 0 ? '0 ✓' : v} ${small}</span></div>`;
  await p.evaluate(h => { document.getElementById('r').innerHTML = h; }, html);
  await p.screenshot({ path: `${out}/${String(f).padStart(4, '0')}.png`, omitBackground: true });
}
await br.close(); console.log(out, n1 + n2);
