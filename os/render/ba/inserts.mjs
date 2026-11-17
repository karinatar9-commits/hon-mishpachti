// Renders short full-screen "the system at work" inserts (9:16, animated) for before/after reels.
// usage: node ba/inserts.mjs <inserts.json> <outdir>  -> <outdir>/<name>.mp4 for each insert
// inserts.json: [{"name":"i0","dur":2.4,"label":"...","caption":"...","kind":"chat"|"list"|"quote", ...}]
import puppeteer from 'puppeteer'; import fs from 'fs'; import path from 'path'; import { execFileSync } from 'child_process';
const items = JSON.parse(fs.readFileSync(process.argv[2], 'utf8')); const out = process.argv[3]; const FPS = 30;
const font = path.resolve('node_modules/@fontsource/heebo/files') + '/';
const css = `@font-face{font-family:H;font-weight:900;src:url(file://${font}heebo-hebrew-900-normal.woff2)}@font-face{font-family:H;font-weight:600;src:url(file://${font}heebo-hebrew-600-normal.woff2)}@font-face{font-family:H;font-weight:400;src:url(file://${font}heebo-hebrew-400-normal.woff2)}
*{box-sizing:border-box}html,body{margin:0;width:1080px;height:1920px;background:radial-gradient(circle at 50% 30%,#1c1830,#0b0b14 70%);font-family:H,sans-serif;direction:rtl;color:#fff;overflow:hidden}
*{animation-play-state:paused!important;animation-fill-mode:both!important}
.chip{position:absolute;top:150px;left:0;right:0;text-align:center}.chip span{display:inline-block;background:#f5d77a;color:#111;font-weight:900;font-size:50px;padding:10px 34px;border-radius:40px}
.card{position:absolute;top:300px;left:90px;right:90px;background:#fff;color:#111;border-radius:48px;padding:50px 46px;box-shadow:0 40px 120px rgba(0,0,0,.6);animation:pop .45s ease-out}
.cap{position:absolute;top:1560px;left:0;right:0;text-align:center;font-weight:900;font-size:76px;animation:up .4s ease-out}.cap b{color:#f5d77a}
.h{font-weight:900;font-size:50px;margin-bottom:30px;display:flex;justify-content:space-between;align-items:center}.h small{font-weight:600;font-size:34px;color:#888}
.in,.outb{font-size:44px;line-height:1.35;padding:26px 32px;border-radius:34px;margin:22px 0;max-width:86%;animation:up .35s ease-out}
.in{background:#eef0f4;margin-left:auto}.outb{background:#d9fdd3;margin-right:auto}
.dots{font-size:60px;color:#999;margin-right:auto;width:150px;animation:blink .5s ease-in-out}
.row{display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid #eee;padding:30px 0;font-size:42px;animation:slide .4s ease-out}.row b{font-weight:900}.row .st{font-size:34px;font-weight:900;padding:8px 20px;border-radius:20px;background:#d9fdd3;color:#16794a;white-space:nowrap}.row .st.w{background:#fff3cd;color:#8a6100}
.ln{display:flex;justify-content:space-between;font-size:42px;padding:16px 0;border-bottom:2px dashed #e4e4e4}.tot{font-weight:900;font-size:50px;border:0;padding-top:26px}
.btn{margin-top:40px;text-align:center;background:#111;color:#fff;font-weight:900;font-size:48px;padding:28px;border-radius:30px;animation:press .3s ease-in-out}
.stamp{position:absolute;bottom:-60px;left:60px;transform:rotate(-8deg);background:#22a06b;color:#fff;font-weight:900;font-size:60px;padding:18px 40px;border-radius:24px;animation:stamp .3s ease-out}
@keyframes pop{from{transform:scale(.85);opacity:0}to{transform:scale(1);opacity:1}}@keyframes up{from{transform:translateY(40px);opacity:0}to{transform:none;opacity:1}}
@keyframes slide{from{transform:translateX(-80px);opacity:0}to{transform:none;opacity:1}}@keyframes blink{0%{opacity:0}50%{opacity:1}100%{opacity:1}}
@keyframes press{0%{transform:scale(1)}50%{transform:scale(.94);background:#22a06b}100%{transform:scale(1);background:#22a06b}}
@keyframes stamp{from{transform:rotate(-8deg) scale(2.2);opacity:0}to{transform:rotate(-8deg) scale(1);opacity:1}}`;
const e = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
const at = (t) => `style="animation-delay:${t}s"`;
function body(it) {
  let inner = '';
  if (it.kind === 'chat') {
    inner = `<div class="h">${e(it.title)}<small>${e(it.time || '')}</small></div><div class="in" ${at(0.25)}>${e(it.incoming)}</div>` +
      `<div class="dots" ${at(0.75)}>•••</div><div class="outb" ${at(1.25)}>${e(it.reply)}</div>`;
  } else if (it.kind === 'list') {
    inner = `<div class="h">${e(it.title)}<small>${e(it.time || '')}</small></div>` + it.rows.map((r, i) =>
      `<div class="row" ${at(0.3 + i * 0.35)}><div><b>${e(r[0])}</b><br><span style="font-size:36px;color:#666">${e(r[1])}</span></div><span class="st ${r[3] ? 'w' : ''}">${e(r[2])}</span></div>`).join('');
  } else {
    inner = `<div class="h">${e(it.title)}<small>${e(it.time || '')}</small></div><div style="font-size:38px;color:#666;margin-bottom:20px">${e(it.sub)}</div>` +
      it.lines.map((l, i) => `<div class="ln ${i === it.lines.length - 1 ? 'tot' : ''}"><span>${e(l[0])}</span><span>${e(l[1])}</span></div>`).join('') +
      `<div class="btn" ${at(1.3)}>${e(it.button)}</div><div class="stamp" ${at(1.55)}>${e(it.stamp)}</div>`;
  }
  return `<div class="chip"><span>${e(it.label)}</span></div><div class="card">${inner}</div><div class="cap" ${at(it.capAt ?? 1.5)}>${it.caption}</div>`;
}
fs.mkdirSync(out, { recursive: true });
const br = await puppeteer.launch({ args: ['--no-sandbox'] }); const p = await br.newPage(); await p.setViewport({ width: 1080, height: 1920 });
for (const it of items) {
  const dir = `${out}/${it.name}_f`; fs.mkdirSync(dir, { recursive: true });
  const f = `${dir}/page.html`; fs.writeFileSync(f, `<html><head><meta charset="utf-8"><style>${css}</style></head><body>${body(it)}</body></html>`);
  await p.goto('file://' + path.resolve(f)); await p.evaluate(() => document.fonts.ready);
  const n = Math.round(it.dur * FPS);
  for (let k = 0; k < n; k++) {
    await p.evaluate((t) => document.getAnimations().forEach(a => { a.currentTime = t * 1000; }), k / FPS);
    await p.screenshot({ path: `${dir}/${String(k).padStart(4, '0')}.png` });
  }
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-framerate', String(FPS), '-i', `${dir}/%04d.png`, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-preset', 'veryfast', '-crf', '20', `${out}/${it.name}.mp4`]);
  console.log(`${out}/${it.name}.mp4`);
}
await br.close();
