#!/usr/bin/env python3
"""Builds screen/ep2.json (series E ep2: online booking system the business owns). Scene starts come from VO scene cuts.
usage: python3 screen/ep2_build.py t1 t2 ... (8 scene start times, seconds, already in screen time) dur"""
import json, sys, os
IMG = os.path.abspath('screen/img')
ts = [float(x) for x in sys.argv[1:-1]]; dur = float(sys.argv[-1])
css = (".ph{position:absolute;right:120px;top:40px;width:360px;height:720px;border-radius:44px;overflow:hidden;border:10px solid #111;box-shadow:0 30px 90px rgba(0,0,0,.45);background:#f7efe6}"
       ".ph img{width:100%;display:block}"
       ".side{position:absolute;left:70px;right:560px;top:0;bottom:0;display:flex;flex-direction:column;justify-content:center;gap:18px;text-align:right}"
       ".num{display:inline-block;align-self:flex-start;background:#111;color:#ffd23f;font-weight:900;font-size:64px;width:110px;height:110px;border-radius:50%;text-align:center;line-height:110px}"
       ".lbl{font-weight:900;font-size:112px;line-height:.95;letter-spacing:-2px}"
       ".tap{position:absolute;width:86px;height:86px;margin:-43px 0 0 -43px;border-radius:50%;background:rgba(255,90,31,.45);border:6px solid #ff5a1f;animation:tap .7s ease-out!important;animation-delay:calc(var(--t) + var(--d,0s))!important}"
       "@keyframes tap{0%{opacity:0;transform:scale(1.8)}40%{opacity:1;transform:scale(.8)}100%{opacity:.9;transform:scale(1)}}"
       ".price{font-weight:900;font-size:64px;background:#fff;color:#111;padding:10px 30px;border-radius:20px;transform:rotate(-4deg);text-decoration:line-through;text-decoration-color:#ff2d2d;text-decoration-thickness:8px}"
       ".prices{display:flex;gap:26px}"
       ".cal{background:#fff;color:#111;border-radius:36px;width:1080px;padding:26px 34px;box-shadow:0 30px 80px rgba(0,0,0,.35)}"
       ".cal h3{margin:0 0 14px;font-size:50px;font-weight:900;display:flex;justify-content:space-between}.cal h3 span{color:#1638ff}"
       ".slot{display:flex;align-items:center;gap:26px;border-top:2px solid #eee;height:92px;font-size:38px;font-weight:600;color:#999}"
       ".slot b{width:130px;color:#555;direction:ltr;text-align:right}"
       ".ev{flex:1;border-radius:18px;padding:10px 24px;font-weight:900;font-size:40px;color:#111}"
       ".ev.busy{background:#e9ecf5;color:#667}"
       ".ev.new{background:#ffd23f;border-right:12px solid #ff5a1f;animation:pop .5s cubic-bezier(.2,1.4,.4,1)!important;animation-delay:calc(var(--t) + var(--d,0s))!important}"
       ".gold{background:radial-gradient(circle at 50% 40%,#ffe9a3,#e8a917 55%,#8a5a00)}"
       ".gbig{color:#2a1a00!important;text-align:center;letter-spacing:-3px}")
def phone(img, n, label, sub, tap):
    tx, ty, td = tap  # css px of the 390x780 capture
    k = 360 / 390
    return (f"<div class='ph'><img src='file://{IMG}/{img}'></div>"
            f"<div class='tap' style='right:{120 + 10 + (390 - tx) * k:.0f}px;top:{40 + 10 + ty * k:.0f}px;--d:{td}s'></div>"
            f"<div class='side'><div class='num' style='--d:.1s'>{n}</div><div class='lbl' style='--d:.25s'>{label}</div>"
            + (f"<div class='mid acc' style='font-size:64px;--d:.5s'>{sub}</div>" if sub else "") + "</div>")
H = [
 ("#ff5a1f", "<div class='mid'>לא נמאס לשלם</div><div class='big' style='font-size:190px;--d:.3s'>דמי מנוי</div><div class='prices'><div class='price' style='--d:.8s'>ינואר ₪</div><div class='price' style='--d:1.0s'>פברואר ₪</div><div class='price' style='--d:1.2s'>מרץ ₪</div></div>"),
 ("#1638ff", "<div class='mid'>מה אם המערכת</div><div class='big' style='font-size:150px;--d:.3s'>נבנית במיוחד</div><div class='mid acc' style='--d:.7s'>לעסק שלכם?</div>"),
 ("#ff5a1f", "<div class='mid'>ושייכת</div><div class='big' style='--d:.25s'>רק לכם.</div><div class='mid' style='font-size:64px;--d:.9s'>ככה זה עובד 👇</div>"),
 ("#ffcf5a", phone('ep2_s1.png', 1, 'בוחרים<br>טיפול', '', (200, 283, .6))),
 ("#1638ff", phone('ep2_s2.png', 2, 'יום ושעה<br>פנויה', 'רק מה שבאמת פנוי', (332, 630, .5))),
 ("#ff5a1f", phone('ep2_s3.png', 3, 'שם<br>וטלפון', '', (195, 725, .6))),
 ("#07070c", phone('ep2_s4.png', '✓', 'התור<br>נקבע!', 'בלי טלפונים', (0, -500, 99))),
 ("#1638ff", "<div class='cal'><h3>היומן שלכם<span>ראשון 22.11</span></h3>"
   "<div class='slot'><b>14:00</b><div class='ev busy'>תפוס</div></div><div class='slot'><b>15:30</b><div class='ev busy'>תפוס</div></div>"
   "<div class='slot'><b>16:30</b><div class='ev new' style='--d:.4s'>טיפול פנים · נועה כהן ✓</div></div><div class='slot'><b>17:30</b><div></div></div></div>"
   "<div class='mid acc' style='font-size:76px;--d:1.0s'>נכנס ישר ליומן</div>"),
 ("#e8a917", "<div class='bgfx gold'></div><div class='mid' style='color:#2a1a00'>שלחו לבעלי עסקים</div><div class='big gbig' style='font-size:130px;--d:.4s'>שזה יעזור<br>להם</div>"),
 ("#ff5a1f", "<div class='mid'>רוצים לשמוע עוד?</div><div class='big' style='font-size:200px;--d:.3s'>תגיבו</div><div class='chip' style='font-size:110px;--d:.7s'>״אני״</div>"),
]
scenes = []
for i, (bg, html) in enumerate(H):
    t = ts[i]; end = ts[i + 1] if i + 1 < len(ts) else dur
    s = {"t": round(t, 2), "len": round(end - t, 2), "bg": bg, "html": html}
    if bg == "#07070c": s["fx"] = "grid"
    scenes.append(s)
ep = {"title": ["נמאס לשלם", "דמי מנוי?"], "end": ["תגיבו 'אני'", "לפרטים"],
      "series": "ככה זה עובד", "ep": 2, "css": css, "scenes": scenes, "dur": round(dur, 2)}
json.dump(ep, open('screen/ep2.json', 'w'), ensure_ascii=False)
print(json.dumps([(s['t'], s['len']) for s in scenes]))
