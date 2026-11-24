# Builds screen/ep6_A.json + ep6_B.json (A/B hook test). Episode 6: stock drops below threshold -> agent drafts supplier order for approval.
import json
base = json.load(open('screen/ep5.json'))
L = lambda s: f"<span style='direction:ltr;unicode-bidi:isolate;display:inline-block'>{s}</span>"
css = base['css'] + ".meter{width:900px;height:70px;border-radius:999px;background:#fff3;position:relative;overflow:hidden}.meter i{position:absolute;inset:0 auto 0 0;background:#2ee59d;border-radius:999px;animation:drain 1.6s ease-in-out;animation-delay:calc(var(--t) + .5s)}@keyframes drain{from{width:85%;background:#2ee59d}to{width:30%;background:#ff3b3b}}.thr{position:absolute;top:-8px;bottom:-8px;left:42%;width:8px;background:#111;border-radius:4px}.red{background:#ff3b3b;color:#fff;font-weight:900;font-size:52px;padding:14px 40px;border-radius:999px;transform:rotate(-3deg)}.btn{background:#1638ff;color:#fff;font-weight:900;font-size:64px;padding:28px 70px;border-radius:30px;box-shadow:0 20px 50px rgba(22,56,255,.45)}.stamp{font-weight:900;font-size:120px;color:#2ee59d;border:10px solid #2ee59d;border-radius:30px;padding:6px 50px;transform:rotate(-6deg)}"
hooks = {
 'A': dict(title=["נגמר המלאי?", "הסוכן כבר הזמין"],
   html="<div class='mid' style='color:#111'>עדיין מגלים שנגמר הקמח</div><div class='big' style='color:#111;font-size:190px;--d:.5s'>כשהמגש ריק?</div>", bg="#ffcf5a"),
 'B': dict(title=["2 שעות בשבוע", "של ספירת מלאי"],
   html="<div class='big' style='--d:.05s'>שעתיים</div><div class='mid acc' style='--d:.45s'>בשבוע של ספירת מלאי</div><div class='mid' style='--d:1.1s'>חזרו אליכם.</div>", bg="#ff5a1f"),
}
cuts = {'A': [0.3, 3.6, 5.8, 8.1, 10.6, 15.1, 18.7, 22.4], 'B': [0.3, 3.4, 5.55, 7.9, 10.4, 14.9, 18.4, 22.2]}
body = [
 ("#1638ff", None, "<div class='mid'>ככה זה עובד</div><div class='mid acc' style='--d:.35s'>עם סוכן בינה מלאכותית</div>"),
 ("#07070c", "grid", "<div class='live'><span class='rec' style='background:#2ee59d'></span>קופה · עכשיו</div><div class='tr'>"
   f"<div class='ln' style='--d:.1s'><b>מכירה ·</b> 12 חלות ← קמח <mark>6 ק״ג</mark></div>"
   f"<div class='ln' style='--d:.7s'><b>מכירה ·</b> 30 לחמניות ← קמח <mark>4 ק״ג</mark></div>"
   f"<div class='ln' style='--d:1.3s'><b>מכירה ·</b> 2 עוגות ← קמח <mark>3 ק״ג</mark></div></div>"),
 ("#07070c", "grid", "<div class='mid'>קמח לבן</div><div class='meter'><i></i><span class='thr'></span></div>"
   f"<div class='chips' style='--d:.3s'><div class='cp'><small>במלאי</small><b>18 ק״ג</b></div><div class='cp'><small>סף הזמנה</small><b>25 ק״ג</b></div></div><div class='red' style='--d:1.6s'>מתחת לסף!</div>"),
 ("#ff5a1f", None, "<div class='q'><h3>הזמנה מהספק<span>טיוטה</span></h3>"
   "<div class='qr' style='--d:.4s'><span>ספק</span><span style='direction:rtl'>הספק הקבוע</span></div>"
   f"<div class='qr' style='--d:1.0s'><span>קמח לבן · כמות רגילה</span><span style='direction:rtl'>4 שקים של 25 ק״ג</span></div>"
   f"<div class='qr' style='--d:1.8s'><span>לפי המחיר האחרון</span><span style='direction:rtl'>96 ₪ לשק</span></div>"
   f"<div class='qr qt' style='--d:2.6s'><span>סה״כ</span><span>{L('384 ₪')}</span></div></div><div class='send' style='--d:3.3s'>✓ מוכן לאישור שלכם</div>"),
 ("#07070c", "grid", "<div class='mid'>אתם רק מאשרים</div><div class='btn' style='--d:.4s'>אישור ושליחה</div><div class='stamp' style='--d:1.7s'>נשלח לספק ✓</div>"),
 ("#e8a917", None, "<div class='bgfx gold'></div><div class='mid' style='color:#2a1a00'>שלחו לבעל עסק</div><div class='big gbig' style='font-size:110px!important;--d:.4s'>שנגמר לו המלאי<br>ברגע הכי לא נוח</div>"),
]
for v, h in hooks.items():
    c = cuts[v]; sc = [dict(t=c[0], len=round(c[1]-c[0], 2), bg=h['bg'], html=h['html'])]
    for i, (bg, fx, html) in enumerate(body):
        s = dict(t=c[i+1], len=round(c[i+2]-c[i+1], 2), bg=bg, html=html)
        if fx: s['fx'] = fx
        sc.append(s)
    json.dump(dict(title=h['title'], end=["רוצים כזה", "בעסק שלכם?"], css=css, scenes=sc, dur=c[-1], series="ככה זה עובד", ep=6),
              open(f'screen/ep6_{v}.json', 'w'), ensure_ascii=False)
print('ok')
