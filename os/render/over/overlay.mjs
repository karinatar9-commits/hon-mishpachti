// Format B ("הסוכן מעל הכתף"): transparent overlay frames with system cards popping over full-screen footage.
// usage: node over/overlay.mjs <cfg.json> <outdir>  -> <outdir>/%04d.png (1080x1920 RGBA, 30fps, cfg.dur seconds) + end.png
// cfg: {"dur":18, "hook":["l1","l2"], "hookOut":2.4, "live":"סוכן פעיל", "cards":[{t,out,label,kind:'chat'|'list'|'doc',...}], "saved":{t,pre,big,sub}, "end":["l1","l2"]}
import puppeteer from 'puppeteer'; import fs from 'fs'; import path from 'path';
const cfg = JSON.parse(fs.readFileSync(process.argv[2], 'utf8')); const out = process.argv[3]; const FPS = 30;
const font = path.resolve('node_modules/@fontsource/heebo/files') + '/';
const css = `@font-face{font-family:H;font-weight:900;src:url(file://${font}heebo-hebrew-900-normal.woff2)}@font-face{font-family:H;font-weight:600;src:url(file://${font}heebo-hebrew-600-normal.woff2)}@font-face{font-family:H;font-weight:400;src:url(file://${font}heebo-hebrew-400-normal.woff2)}
*{box-sizing:border-box}html,body{margin:0;width:1080px;height:1920px;background:transparent;font-family:H,sans-serif;direction:rtl;color:#fff;overflow:hidden;position:relative}
*{animation-play-state:paused!important}
.hook{position:absolute;top:300px;left:60px;right:60px;text-align:center;font-weight:900;font-size:112px;line-height:1.05;text-shadow:0 8px 50px rgba(0,0,0,.95),0 2px 8px rgba(0,0,0,.8)}.hook span{color:#f5d77a}
.grad{position:absolute;left:0;right:0;bottom:0;height:900px;background:linear-gradient(transparent,rgba(0,0,0,.55))}
.live{position:absolute;top:120px;right:50px;display:flex;align-items:center;gap:16px;background:rgba(10,10,20,.72);backdrop-filter:blur(8px);padding:14px 30px;border-radius:999px;font-weight:900;font-size:40px}
.dot{width:24px;height:24px;border-radius:50%;background:#2ee07a;box-shadow:0 0 18px #2ee07a}
.log{position:absolute;top:210px;right:50px;display:flex;flex-direction:column;gap:14px;align-items:flex-start}
.pl{display:flex;align-items:center;gap:14px;background:rgba(255,255,255,.94);color:#111;font-weight:900;font-size:36px;padding:10px 26px 10px 22px;border-radius:999px;box-shadow:0 10px 30px rgba(0,0,0,.35)}
.ck{flex:none;width:44px;height:44px;border-radius:50%;background:#22a06b;position:relative}.ck:after{content:'';position:absolute;left:15px;top:8px;width:11px;height:21px;border:solid #fff;border-width:0 6px 6px 0;transform:rotate(45deg)}
.card{position:absolute;left:70px;right:70px;bottom:250px;background:#fff;color:#111;border-radius:44px;padding:40px 42px 46px;box-shadow:0 40px 120px rgba(0,0,0,.55)}
.ch{display:flex;align-items:center;gap:18px;font-weight:900;font-size:50px;margin-bottom:26px}.ch small{margin-right:auto;font-weight:600;font-size:32px;color:#888}
.ch .ck{width:56px;height:56px}.ch .ck:after{left:19px;top:10px;width:14px;height:26px}
.sub{font-size:36px;color:#666;margin:-10px 0 18px}
.in,.ob{font-size:42px;line-height:1.35;padding:22px 30px;border-radius:32px;margin:16px 0;max-width:88%}
.in{background:#eef0f4;margin-left:auto}.ob{background:#d9fdd3;margin-right:auto}
.dots{font-size:56px;color:#999;width:140px;margin-right:auto;line-height:1}
.row{display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid #eee;padding:22px 0;font-size:40px}.row b{font-weight:900}.st{font-size:32px;font-weight:900;padding:8px 20px;border-radius:20px;background:#d9fdd3;color:#16794a;white-space:nowrap}
.ln{display:flex;justify-content:space-between;font-size:40px;padding:14px 0;border-bottom:2px dashed #e4e4e4}.tot{font-weight:900;font-size:48px;border:0}
.btn{margin-top:28px;text-align:center;background:#111;color:#fff;font-weight:900;font-size:46px;padding:24px;border-radius:28px}
.stamp{position:absolute;bottom:-50px;left:50px;transform:rotate(-8deg);background:#22a06b;color:#fff;font-weight:900;font-size:56px;padding:16px 38px;border-radius:24px}
.dim{position:absolute;inset:0;background:rgba(6,4,14,.62)}
.sv{position:absolute;top:640px;left:0;right:0;text-align:center;text-shadow:0 8px 40px rgba(0,0,0,.8)}.sv .p{font-weight:900;font-size:66px}.sv .b{font-weight:900;font-size:230px;line-height:1.05;color:#f5d77a;direction:ltr}.sv .s{font-weight:600;font-size:50px;margin-top:10px}
.end{position:absolute;inset:0;background:rgba(6,4,14,.86)}.c{position:absolute;left:0;right:0;text-align:center}.acc{color:#f5d77a}.pill{display:inline-block;background:#fff;color:#111;border-radius:18px;padding:10px 28px}
@keyframes cin{from{transform:translateY(160px) scale(.92);opacity:0}to{transform:none;opacity:1}}@keyframes cout{to{transform:translateY(-120px) scale(.85);opacity:0}}
@keyframes fin{from{opacity:0}to{opacity:1}}@keyframes fout{to{opacity:0}}@keyframes up{from{transform:translateY(30px);opacity:0}to{transform:none;opacity:1}}
@keyframes pin{from{transform:translateX(120px) scale(.6);opacity:0}to{transform:none;opacity:1}}@keyframes zoom{from{transform:scale(.6);opacity:0}to{transform:none;opacity:1}}
@keyframes press{0%{transform:scale(1)}50%{transform:scale(.94);background:#22a06b}100%{transform:scale(1);background:#22a06b}}
@keyframes stamp{from{transform:rotate(-8deg) scale(2.2);opacity:0}to{transform:rotate(-8deg) scale(1);opacity:1}}@keyframes blink{0%,100%{opacity:.3}50%{opacity:1}}`;
const e = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
const A = (name, d, t, ease = 'ease-out') => `${name} ${d}s ${ease} ${t}s both`;
const st = (...a) => `style="animation:${a.join(',')}"`;
function card(c) {
  const T = c.t; let inner = `<div class="ch"><span class="ck"></span>${e(c.label)}<small>${e(c.time || 'עכשיו')}</small></div>` + (c.sub ? `<div class="sub">${e(c.sub)}</div>` : '');
  if (c.kind === 'chat') inner += `<div class="in" ${st(A('up', .3, T + .25))}>${e(c.incoming)}</div><div class="dots" ${st(A('fin', .2, T + .6), A('fout', .15, T + 1.05))}>•••</div><div class="ob" ${st(A('up', .3, T + 1.1))}>${e(c.reply)}</div>`;
  else if (c.kind === 'list') inner += c.rows.map((r, i) => `<div class="row" ${st(A('up', .3, T + .25 + i * .22))}><div><b>${e(r[0])}</b><br><span style="font-size:34px;color:#666">${e(r[1])}</span></div><span class="st">${e(r[2])}</span></div>`).join('');
  else inner += c.lines.map((l, i) => `<div class="ln ${l[2] ? 'tot' : ''}" ${st(A('up', .3, T + .2 + i * .15))}><span>${e(l[0])}</span><span>${e(l[1])}</span></div>`).join('') +
    (c.button ? `<div class="btn" ${st(A('up', .3, T + .6), A('press', .3, T + 1.15, 'ease-in-out'))}>${e(c.button)}</div>` : '') + `<div class="stamp" ${st(A('stamp', .3, T + (c.button ? 1.45 : 1.1)))}>${e(c.stamp)}</div>`;
  return `<div class="card" ${st(A('cin', .4, T), A('cout', .35, c.out, 'ease-in'))}>${inner}</div>`;
}
const H = cfg.hookOut ?? 2.4, sv = cfg.saved;
let html = `<div class="grad" ${st(A('fin', .4, H - .3), A('fout', .3, sv.t))}></div>`;
html += `<div class="hook" ${st(A('zoom', .3, 0), A('fout', .3, H))}>${e(cfg.hook[0])}<br><span>${e(cfg.hook[1])}</span></div>`;
html += `<div class="live" ${st(A('fin', .3, H), A('fout', .3, sv.t))}><span class="dot" ${st(A('blink', 1, H))}></span>${e(cfg.live || 'הסוכן עובד ברקע')}</div>`;
html += `<div class="log">` + cfg.cards.map(c => `<div class="pl" ${st(A('pin', .35, c.out + .2), A('fout', .3, sv.t))}><span class="ck"></span>${e(c.done || c.label)}</div>`).join('') + `</div>`;
html += cfg.cards.map(card).join('');
html += `<div class="dim" ${st(A('fin', .35, sv.t))}></div><div class="sv"><div class="p" ${st(A('up', .35, sv.t + .1))}>${e(sv.pre)}</div><div class="b" ${st(A('zoom', .4, sv.t + .35))}>${e(sv.big)}</div><div class="s" ${st(A('up', .35, sv.t + .8))}>${e(sv.sub)}</div></div>`;
const end = `<div class="end"></div><div class="c" style="top:560px;font-weight:900;font-size:104px;line-height:1.12">${e(cfg.end[0])}<br><span class="acc">${e(cfg.end[1])}</span></div><div class="c" style="top:900px;font-weight:900;font-size:60px">רוצים כזה בעסק שלכם?</div><div class="c" style="top:1010px;font-weight:600;font-size:52px"><span class="pill">השאירו פרטים לייעוץ</span></div><div class="c" style="top:1140px;font-weight:900;font-size:68px;direction:ltr">goldchain-ai.com</div><div class="c" style="top:1260px;font-weight:600;font-size:46px">או בוואטסאפ · הקישור בביו</div>`;
fs.mkdirSync(out, { recursive: true });
const br = await puppeteer.launch({ args: ['--no-sandbox'] }); const p = await br.newPage(); await p.setViewport({ width: 1080, height: 1920 });
const doc = (b) => `<html><head><meta charset="utf-8"><style>${css}</style></head><body>${b}</body></html>`;
fs.writeFileSync(`${out}/end.html`, doc(end)); await p.goto('file://' + path.resolve(`${out}/end.html`)); await p.evaluate(() => document.fonts.ready); await p.screenshot({ path: `${out}/end.png`, omitBackground: true });
fs.writeFileSync(`${out}/page.html`, doc(html)); await p.goto('file://' + path.resolve(`${out}/page.html`)); await p.evaluate(() => document.fonts.ready);
const from = +(process.argv[4] || 0), n = Math.round(cfg.dur * FPS), to = Math.min(n, +(process.argv[5] || n));
for (let k = from; k < to; k++) {
  await p.evaluate((t) => document.getAnimations().forEach(a => { a.currentTime = t * 1000; }), k / FPS);
  await p.screenshot({ path: `${out}/${String(k).padStart(4, '0')}.png`, omitBackground: true });
}
await br.close(); console.log('frames', from, to);
