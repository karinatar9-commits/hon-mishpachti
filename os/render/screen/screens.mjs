// Renders the animated laptop-screen content (1280x800) for the "screen series" reels as PNG frames + mp4.
// usage: node screen/screens.mjs <episode.json> <out.mp4>   (run from os/render; needs puppeteer + @fontsource/heebo)
// episode.json: {"dur": 18, "scenes":[{"t":0,"len":2.6,"html":"...","bg":"#ff5a1f"}, ...]}
// Scene HTML may use classes: .big .mid .small .acc .bubble.in/.out .tile .chip .card .row .rep .burst; children get
// an entrance animation via style="--d:0.4s" (delay relative to scene start).
import puppeteer from 'puppeteer'; import fs from 'fs'; import path from 'path'; import { execFileSync } from 'child_process';
const ep = JSON.parse(fs.readFileSync(process.argv[2], 'utf8')); const out = process.argv[3]; const FPS = 30;
const font = path.resolve('node_modules/@fontsource/heebo/files') + '/';
const css = `@font-face{font-family:H;font-weight:900;src:url(file://${font}heebo-hebrew-900-normal.woff2)}@font-face{font-family:H;font-weight:600;src:url(file://${font}heebo-hebrew-600-normal.woff2)}@font-face{font-family:L;font-weight:900;src:url(file://${font}heebo-latin-900-normal.woff2)}
*{box-sizing:border-box;animation-play-state:paused!important;animation-fill-mode:both!important}
html,body{margin:0;width:1280px;height:800px;overflow:hidden;background:#000;font-family:H,L,sans-serif;direction:rtl;color:#fff}
.sc{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:26px;animation:vis var(--len) linear;animation-delay:var(--t);overflow:hidden}
.sc>*:not(.bgfx){animation:pop .5s cubic-bezier(.2,1.4,.4,1);animation-delay:calc(var(--t) + var(--d,0s))}
.big{font-weight:900;font-size:230px;line-height:.9;letter-spacing:-6px}.mid{font-weight:900;font-size:96px;line-height:1}.small{font-weight:600;font-size:54px;opacity:.85}
.acc{color:#ffd23f}.dot{display:inline-block;width:26px;height:26px;border-radius:50%;background:#fff;margin-left:14px;animation:pulse .9s ease-in-out infinite!important;animation-play-state:paused!important}
.bubble{font-size:46px;font-weight:600;padding:26px 36px;border-radius:40px;max-width:820px;line-height:1.3;box-shadow:0 20px 60px rgba(0,0,0,.35)}
.in{background:#fff;color:#111;align-self:flex-start;margin-right:150px;border-bottom-right-radius:8px}.out{background:#2ee59d;color:#062;align-self:flex-end;margin-left:150px;border-bottom-left-radius:8px}
.tiles{display:flex;gap:30px}.tile{width:290px;height:200px;border-radius:30px;background:#16161f;border:3px solid #333;display:flex;flex-direction:column;align-items:center;justify-content:center;font-weight:900;font-size:46px;gap:10px;animation:pop .5s cubic-bezier(.2,1.4,.4,1),lit .3s linear;animation-delay:calc(var(--t) + var(--d,0s)),calc(var(--t) + var(--d,0s) + .6s)}
.tile i{font-style:normal;font-size:60px}
.chip{background:#fff;color:#111;font-weight:900;font-size:58px;padding:22px 46px;border-radius:999px;transform:rotate(-4deg)}
.card{background:#fff8ec;color:#111;border-radius:40px;padding:44px 56px;width:900px;box-shadow:0 30px 80px rgba(0,0,0,.35)}
.card h3{margin:0 0 18px;font-size:58px;font-weight:900}.row{font-size:44px;font-weight:600;padding:12px 0;border-top:2px solid #eadfcd;animation:slide .45s ease-out;animation-delay:calc(var(--t) + var(--d,0s))}
.rep{position:absolute;inset:-40px;display:flex;flex-direction:column;justify-content:center;align-items:center;font-weight:900;font-size:170px;line-height:.86;color:transparent;-webkit-text-stroke:3px rgba(255,255,255,.35);white-space:nowrap}
.rep b{color:#fff;-webkit-text-stroke:0}
.bgfx{position:absolute;inset:0;pointer-events:none}
.burst{position:absolute;width:520px;height:520px;top:-140px;left:-120px;animation:spin 12s linear infinite!important;animation-play-state:paused!important}
.scan{position:absolute;left:0;right:0;height:6px;background:linear-gradient(90deg,transparent,#2ee59d,transparent);animation:scan 1.4s linear infinite!important;animation-play-state:paused!important}
.grid{position:absolute;inset:0;background-image:radial-gradient(rgba(255,255,255,.18) 2px,transparent 2px);background-size:40px 40px}
@keyframes vis{0%{opacity:0;transform:scale(1.06)}5%{opacity:1;transform:scale(1)}95%{opacity:1}100%{opacity:0}}
@keyframes pop{from{opacity:0;transform:translateY(50px) scale(.8)}to{opacity:1;transform:none}}
@keyframes slide{from{opacity:0;transform:translateX(-60px)}to{opacity:1;transform:none}}
@keyframes lit{from{border-color:#333;background:#16161f}to{border-color:#2ee59d;background:#0f2a1f}}
@keyframes pulse{0%,100%{transform:scale(1);opacity:1}50%{transform:scale(1.5);opacity:.4}}
@keyframes spin{to{transform:rotate(360deg)}}@keyframes scan{from{top:0}to{top:800px}}`;
const burst = (c) => `<svg class="burst" viewBox="-50 -50 100 100">${Array.from({ length: 14 }, (_, i) => `<rect x="-2.2" y="-48" width="4.4" height="34" rx="2.2" fill="${c}" transform="rotate(${i * 360 / 14})"/>`).join('')}</svg>`;
const page = ep.scenes.map(s => `<div class="sc" style="--t:${s.t}s;--len:${s.len}s;background:${s.bg || '#000'}">${s.fx === 'grid' ? '<div class="bgfx grid"></div><div class="bgfx"><div class="scan"></div></div>' : ''}${s.fx === 'burst' ? `<div class="bgfx">${burst(s.burst || 'rgba(255,255,255,.9)')}</div>` : ''}${s.html.replace('{burst}', '')}</div>`).join('');
const dir = out.replace(/\.mp4$/, '_f'); fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(`${dir}/page.html`, `<html><head><meta charset="utf-8"><style>${css}</style></head><body>${page}</body></html>`);
const br = await puppeteer.launch({ args: ['--no-sandbox'] }); const p = await br.newPage(); await p.setViewport({ width: 1280, height: 800 });
await p.goto('file://' + path.resolve(`${dir}/page.html`)); await p.evaluate(() => document.fonts.ready);
const n = Math.round(ep.dur * FPS);
for (let k = 0; k < n; k++) {
  await p.evaluate((t) => document.getAnimations().forEach(a => { a.currentTime = t * 1000; }), k / FPS);
  await p.screenshot({ path: `${dir}/${String(k).padStart(4, '0')}.png` });
}
await br.close();
execFileSync('ffmpeg', ['-v', 'error', '-y', '-framerate', String(FPS), '-i', `${dir}/%04d.png`, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-preset', 'veryfast', '-crf', '18', out]);
console.log(out);
