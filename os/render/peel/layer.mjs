// Renders the hidden "business running on its own" layer (1080x1920) that the peeled strip reveals.
// Dense rows of glowing agent-activity cards, like city lights at night, so any strip position shows something.
// usage: node peel/layer.mjs <out.png>
import puppeteer from 'puppeteer'; import path from 'path'; import fs from 'fs';
const font = path.resolve('node_modules/@fontsource/heebo/files') + '/';
const acts = ['הודעה נענתה', 'תור נקבע · 10:30', 'חשבונית נשלחה', 'תשלום התקבל ₪1,240', 'תזכורת נשלחה', 'הזמנה לספק מוכנה', 'ליד חדש סונן', 'פגישה נקבעה ביומן', 'דוח נשלח לרו״ח', 'הצעת מחיר מוכנה', 'לקוח קיבל תשובה', 'התאמת בנק תקינה', 'קבלה נרשמה', 'תור הוזז · 14:00', 'מלאי עודכן'];
let rows = ''; let k = 0;
for (let y = 0; y < 1920; y += 74) {
  let row = ''; const off = (y / 74) % 2 ? -140 : 0;
  for (let i = 0; i < 6; i++) { const a = acts[(k++ * 7) % acts.length]; const gold = (k % 5 === 0);
    row += `<div class="c ${gold ? 'g' : ''}"><i></i>${a}</div>`; }
  rows += `<div class="r" style="top:${y}px;right:${off}px">${row}</div>`;
}
const html = `<html><head><meta charset="utf-8"><style>@font-face{font-family:H;font-weight:900;src:url(file://${font}heebo-hebrew-900-normal.woff2)}
html,body{margin:0;width:1080px;height:1920px;overflow:hidden;background:radial-gradient(circle at 50% 45%,#0f2a8a,#061033 70%);font-family:H,sans-serif;direction:rtl}
.r{position:absolute;display:flex;gap:18px;white-space:nowrap}
.c{display:flex;align-items:center;gap:12px;height:56px;padding:0 22px;border-radius:16px;background:rgba(80,140,255,.16);border:2px solid rgba(140,190,255,.45);color:#dfeaff;font-weight:900;font-size:30px;box-shadow:0 0 22px rgba(90,150,255,.55)}
.c i{width:26px;height:26px;border-radius:50%;background:#2ee59d;box-shadow:0 0 14px #2ee59d}
.c.g{background:rgba(255,200,60,.2);border-color:rgba(255,215,100,.7);color:#fff2c4;box-shadow:0 0 26px rgba(255,190,60,.6)}.c.g i{background:#ffd23f;box-shadow:0 0 14px #ffd23f}
</style></head><body>${rows}</body></html>`;
const f = process.argv[2].replace(/\.png$/, '.html'); fs.writeFileSync(f, html);
const br = await puppeteer.launch({ args: ['--no-sandbox'] }); const p = await br.newPage(); await p.setViewport({ width: 1080, height: 1920 });
await p.goto('file://' + path.resolve(f)); await p.evaluate(() => document.fonts.ready); await p.screenshot({ path: process.argv[2] }); await br.close(); console.log(process.argv[2]);
