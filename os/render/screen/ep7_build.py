# Builds screen/ep7_A.json + ep7_B.json (A/B hook test). Episode 7: a cheque bounces -> agent reopens the invoice and drafts a polite payment request for approval.
# usage: python3 screen/ep7_build.py '<json cuts {"A":[...],"B":[...]}>'
import json, sys
base = json.load(open('screen/ep6_A.json'))
L = lambda s: f"<span style='direction:ltr;unicode-bidi:isolate;display:inline-block'>{s}</span>"
css = base['css'] + ".strike{font-size:60px;font-weight:900;color:#2ee59d;position:relative;padding:0 10px}.strike:after{content:'';position:absolute;left:0;right:0;top:52%;height:8px;background:#ff3b3b;transform:scaleX(0);transform-origin:right;animation:sx .4s ease-out forwards;animation-delay:calc(var(--t) + 1.1s)}@keyframes sx{to{transform:scaleX(1)}}.inv{display:flex;gap:36px;align-items:center;justify-content:center}"
hooks = {
 'A': dict(title=["צ׳ק חזר?", "הסוכן כבר יודע"],
   html="<div class='mid' style='color:#111'>עדיין מגלים שצ׳ק חזר</div><div class='big' style='color:#111;font-size:150px;--d:.5s'>כשהלקוח<br>לא עונה?</div>", bg="#ffcf5a"),
 'B': dict(title=["צ׳ק חזר?", "תדעו תוך דקה"],
   html="<div class='big' style='--d:.05s'>תוך דקה</div><div class='mid acc' style='--d:.45s'>אתם יודעים שצ׳ק חזר</div><div class='mid' style='--d:1.1s'>לא אחרי 3 שבועות.</div>", bg="#ff5a1f"),
}
body = [
 ("#1638ff", None, "<div class='mid'>ככה זה עובד</div><div class='mid acc' style='--d:.35s'>עם סוכן בינה מלאכותית</div>"),
 ("#07070c", "grid", "<div class='live'><span class='rec' style='background:#2ee59d'></span>מייל נכנס · עכשיו</div><div class='tr'>"
   "<div class='ln' style='--d:.1s'><b>מאת ·</b> הבנק · הודעה על החזרת צ׳ק</div>"
   f"<div class='ln' style='--d:.7s'><b>צ׳ק ·</b> {L('#4127')} · <mark>חזר · אין כיסוי</mark></div>"
   f"<div class='ln' style='--d:1.3s'><b>סכום ·</b> {L('3,400 ₪')}</div></div>"
   "<div class='chips' style='--d:1.9s'><div class='cp'><small>זוהה לקוח</small><b>א.ב. עיצובים</b></div><div class='cp'><small>חשבונית</small><b>" + L('#1082') + "</b></div></div>"),
 ("#07070c", "grid", "<div class='mid'>חשבונית " + L('#1082') + "</div><div class='inv'><span class='strike'>שולמה</span><span class='red' style='--d:1.6s'>פתוחה שוב</span></div>"
   "<div class='chips' style='--d:.3s'><div class='cp'><small>נרשם בספרים</small><b>✓ עודכן</b></div></div>"),
 ("#ff5a1f", None, "<div class='q'><h3>הודעה ללקוח<span>טיוטה</span></h3>"
   "<div class='qr' style='--d:.4s'><span style='direction:rtl'>שלום, הצ׳ק " + L('#4127') + " חזר מהבנק.</span></div>"
   "<div class='qr' style='--d:1.1s'><span style='direction:rtl'>אפשר להסדיר בהעברה או בצ׳ק חדש.</span></div>"
   "<div class='qr qt' style='--d:1.8s'><span style='direction:rtl'>תודה, ונשמח לעזור 🙏</span></div></div><div class='send' style='--d:2.6s'>✓ מוכן לאישור שלכם</div>"),
 ("#07070c", "grid", "<div class='mid'>אתם רק מאשרים</div><div class='btn' style='--d:.4s'>אישור ושליחה</div><div class='stamp' style='--d:1.7s'>נשלח ללקוח ✓</div>"),
 ("#e8a917", None, "<div class='bgfx gold'></div><div class='mid' style='color:#2a1a00'>שלחו לבעל עסק</div><div class='big gbig' style='font-size:120px!important;--d:.4s'>שעובד<br>עם צ׳קים</div>"),
]
cuts = json.loads(sys.argv[1])
for v, h in hooks.items():
    c = cuts[v]; sc = [dict(t=c[0], len=round(c[1]-c[0], 2), bg=h['bg'], html=h['html'])]
    for i, (bg, fx, html) in enumerate(body):
        s = dict(t=c[i+1], len=round(c[i+2]-c[i+1], 2), bg=bg, html=html)
        if fx: s['fx'] = fx
        sc.append(s)
    json.dump(dict(title=h['title'], end=["רוצים כזה", "בעסק שלכם?"], css=css, scenes=sc, dur=c[-1], series="ככה זה עובד", ep=7),
              open(f'screen/ep7_{v}.json', 'w'), ensure_ascii=False)
print('ok')
