// Transparent overlay frames for format F (peek): hook, stacking "done" pills, a mid statement and the end CTA.
// usage: node peel/overlay.mjs <cfg.json> <outdir>  -> %04d.png (1080x1920, 30fps, cfg.dur s)
// cfg: {"dur":16.5,"hook":["l1","l2"],"hookOut":2.3,"pills":[[t,"text"],...],"pillsOut":8.2,"mid":{"t":8.3,"out":10.4,"l1":"","l2":""},"end":{"t":10.4,"l1":"","l2":""}}
import puppeteer from 'puppeteer'; import fs from 'fs'; import path from 'path';
const c = JSON.parse(fs.readFileSync(process.argv[2], 'utf8')); const out = process.argv[3]; const FPS = 30;
const font = path.resolve('node_modules/@fontsource/heebo/files') + '/';
const A = (n, d, t, e = 'ease-out') => `${n} ${d}s ${e} ${t}s both`; const st = (...a) => `style="animation:${a.join(',')}"`;
const e = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
const css = `@font-face{font-family:H;font-weight:900;src:url(file://${font}heebo-hebrew-900-normal.woff2)}@font-face{font-family:H;font-weight:600;src:url(file://${font}heebo-hebrew-600-normal.woff2)}
*{box-sizing:border-box;animation-play-state:paused!important}html,body{margin:0;width:1080px;height:1920px;background:transparent;font-family:H,sans-serif;direction:rtl;color:#fff;overflow:hidden;position:relative}
.hook{position:absolute;top:260px;left:50px;right:50px;text-align:center;font-weight:900;font-size:110px;line-height:1.05;text-shadow:0 8px 50px rgba(0,0,0,.95)}.hook span{color:#ffd23f}
.log{position:absolute;top:230px;right:60px;display:flex;flex-direction:column;gap:22px;align-items:flex-start}
.pl{display:flex;align-items:center;gap:20px;background:#fff;color:#111;font-weight:900;font-size:58px;padding:16px 40px 16px 30px;border-radius:999px;box-shadow:0 14px 40px rgba(0,0,0,.45)}
.ck{flex:none;width:66px;height:66px;border-radius:50%;background:#22a06b;position:relative}.ck:after{content:'';position:absolute;left:23px;top:11px;width:16px;height:32px;border:solid #fff;border-width:0 8px 8px 0;transform:rotate(45deg)}
.dim{position:absolute;inset:0;background:rgba(6,4,14,.6)}.c{position:absolute;left:0;right:0;text-align:center}.acc{color:#ffd23f}
.end{position:absolute;inset:0;background:rgba(6,4,14,.86)}.pill{display:inline-block;background:#fff;color:#111;border-radius:18px;padding:10px 28px}
@keyframes fin{from{opacity:0}to{opacity:1}}@keyframes fout{to{opacity:0}}@keyframes zoom{from{transform:scale(.6);opacity:0}to{transform:none;opacity:1}}
@keyframes pin{from{transform:translateX(160px) scale(.7);opacity:0}to{transform:none;opacity:1}}@keyframes up{from{transform:translateY(40px);opacity:0}to{transform:none;opacity:1}}`;
let h = `<div class="hook" ${st(A('zoom', .3, 0), A('fout', .3, c.hookOut))}>${e(c.hook[0])}<br><span>${e(c.hook[1])}</span></div>`;
h += `<div class="log">` + c.pills.map(([t, x]) => `<div class="pl" ${st(A('pin', .35, t), A('fout', .3, c.pillsOut))}><span class="ck"></span>${e(x)}</div>`).join('') + `</div>`;
const m = c.mid; h += `<div class="dim" ${st(A('fin', .3, m.t), A('fout', .25, m.out))}></div><div class="c" style="top:720px;font-weight:900;font-size:120px;line-height:1.1"><div ${st(A('up', .35, m.t + .1), A('fout', .25, m.out))}>${e(m.l1)}</div><div class="acc" ${st(A('zoom', .4, m.t + .5), A('fout', .25, m.out))}>${e(m.l2)}</div></div>`;
const E = c.end; h += `<div ${st(A('fin', .35, E.t))}><div class="end"></div><div class="c" style="top:600px;font-weight:900;font-size:104px;line-height:1.12">${e(E.l1)}<br><span class="acc">${e(E.l2)}</span></div><div class="c" style="top:930px;font-weight:600;font-size:52px"><span class="pill">השאירו פרטים לייעוץ</span></div><div class="c" style="top:1060px;font-weight:900;font-size:68px;direction:ltr">goldchain-ai.com</div><div class="c" style="top:1180px;font-weight:600;font-size:46px">או בוואטסאפ · הקישור בביו</div></div>`;
fs.mkdirSync(out, { recursive: true }); fs.writeFileSync(`${out}/page.html`, `<html><head><meta charset="utf-8"><style>${css}</style></head><body>${h}</body></html>`);
const br = await puppeteer.launch({ args: ['--no-sandbox'] }); const p = await br.newPage(); await p.setViewport({ width: 1080, height: 1920 });
await p.goto('file://' + path.resolve(`${out}/page.html`)); await p.evaluate(() => document.fonts.ready);
const from = +(process.argv[4] || 0), n = Math.round(c.dur * FPS), to = Math.min(n, +(process.argv[5] || n));
for (let k = from; k < to; k++) { await p.evaluate((t) => document.getAnimations().forEach(a => { a.currentTime = t * 1000; }), k / FPS); await p.screenshot({ path: `${out}/${String(k).padStart(4, '0')}.png`, omitBackground: true }); }
await br.close(); console.log('frames', from, to);
