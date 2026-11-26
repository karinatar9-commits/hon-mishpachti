# Tips reel "3 טריקים ב-ChatGPT" (26.11, for Fri 27.11 10:00). Same look as tools/tools4.json.
# VO is sped up 1.1x and delayed 0.3s in the mux, so scene time = raw/1.1 + 0.3.
import json, copy, sys
base = json.load(open('tools/tools4.json'))
CSS = base['css'] + """
.sc{justify-content:center;padding-top:0;padding-bottom:120px;gap:44px}
.badge i{width:170px;height:170px;font-size:124px}.ben{font-size:76px;max-width:1000px}
.chat{width:1020px;border-radius:30px;overflow:hidden;background:#15151d;box-shadow:0 40px 120px rgba(0,0,0,.55);border:2px solid #2a2a36}
.chat .bar u{direction:ltr}
.msgs{display:flex;flex-direction:column;gap:34px;padding:50px 36px 56px}
.me{align-self:flex-start;background:#2f6bff;color:#fff;font-weight:600;font-size:60px;line-height:1.3;padding:24px 34px;border-radius:36px;border-bottom-right-radius:8px;max-width:820px}
.ai{align-self:flex-end;background:#fff;color:#111;font-weight:600;font-size:58px;line-height:1.35;padding:30px 40px;border-radius:36px;border-bottom-left-radius:8px;max-width:860px}
.ai b{color:#ff5a1f}
.doc{background:#fff8ec;color:#111;border-radius:30px;padding:50px 60px;width:1000px;box-shadow:0 30px 80px rgba(0,0,0,.45)}
.doc h3{margin:0 0 18px;font-size:70px;font-weight:900}.doc .row{font-size:56px;padding:18px 0}
.mark{background:#ffd23f;border-radius:10px;padding:0 10px}
.vs{display:flex;gap:30px}.vs>div{width:490px;border-radius:36px;padding:50px 30px;text-align:center;font-weight:900}
.vs .n{font-size:180px;line-height:1.1;direction:ltr}.vs .l{font-size:58px;margin-top:8px}

.kw2{background:#ffd23f;color:#111;font-weight:900;font-size:128px;padding:26px 60px;border-radius:44px;transform:rotate(-3deg);white-space:nowrap}
.h{font-size:52px}
"""
def T(raw): return round(raw/1.1 + 0.3, 2)
def bar(): return "<div class='bar'><s></s><s></s><s></s><u>ChatGPT</u></div>"
def tip(n, title, sub, body, bg="#07070c"):
    return f"<div class='badge'><i>{n}</i><b style='font-size:92px;direction:rtl'>{title}</b></div><div class='ben' style='--d:.15s'>{sub}</div>{body}"
S = {}
S['tip1a'] = tip(1, "תגידו לו:", "לפני שאתה עונה, תשאל אותי שאלות", f"<div class='chat' style='--d:.3s'>{bar()}<div class='msgs'><div class='me'>תכתוב לי פוסט לעסק. לפני שאתה עונה, תשאל אותי 3 שאלות.</div></div></div>")
S['tip1b'] = tip(1, "תגידו לו:", "התשובה יוצאת על <span class='y'>העסק שלכם</span>, לא כללית", f"<div class='chat'>{bar()}<div class='msgs'><div class='me' style='font-size:48px;opacity:.75'>לפני שאתה עונה, תשאל אותי 3 שאלות.</div><div class='ai' style='--d:.3s'>בשמחה:<br><b>1.</b> מה העסק מוכר?<br><b>2.</b> מי הלקוח שאתם רוצים?<br><b>3.</b> מה הוא צריך לעשות אחרי שקרא?</div></div></div>")
S['tip2a'] = tip(2, "הצעת מחיר", "תדביקו אותה בצ׳אט", "<div class='doc' style='--d:.3s'><h3>הצעת מחיר · עיצוב חלון ראווה</h3><div class='row' style='--d:.5s'>עיצוב והתקנה · 4,800 ₪</div><div class='row' style='--d:.65s'>חומרים · 1,900 ₪</div><div class='row' style='--d:.8s'>תשלום: 50% מקדמה, היתרה בסיום</div><div class='row' style='--d:.95s'>זמן ביצוע: לפי זמינות</div></div>")
S['tip2b'] = tip(2, "ותשאלו:", "<span class='y'>איפה הלקוח יתווכח איתי?</span>", f"<div class='chat' style='--d:.2s'>{bar()}<div class='msgs'><div class='me'>איפה הלקוח יתווכח איתי?</div><div class='ai' style='--d:.4s'><b>זמן הביצוע.</b> \"לפי זמינות\" בלי תאריך. כתבו תאריך יעד, והוויכוח נגמר לפני שהתחיל.</div></div></div>")
S['tip3a'] = tip(3, "כשיש מספרים", "תוסיפו 4 מילים:", "<div class='kw2' style='--d:.3s;font-size:120px'>תחשב את זה בקוד</div>")
S['tip3b'] = tip(3, "4 מילים", "ככה הוא <span class='y'>באמת מחשב</span>, ולא מנחש", "<div class='vs' style='--d:.3s'><div style='background:#2a1414;color:#ff8a7a;border:3px solid #ff5a1f'><div class='l'>בלי</div><div class='n'>≈ ?</div><div class='l'>מעריך בראש</div></div><div style='background:#0f2a1f;color:#2ee59d;border:3px solid #2ee59d'><div class='l'>עם \"תחשב בקוד\"</div><div class='n'>✓</div><div class='l'>מריץ חישוב</div></div></div><div class='h' style='--d:.8s;direction:rtl'>עובד על סכומים, אחוזים ומע״מ</div>")
CTA = "<div class='cta' style='margin-top:160px'>שמרו 🔖</div><div class='hk2' style='--d:.3s;color:#111;font-size:84px'>ושלחו לבעל עסק<br>שעובד עם צ׳אט</div>"
END = "<div class='hk' style='color:#111;font-size:120px;margin-top:180px'>עוד טיפים<br>כאלה?</div><div class='kw' style='--d:.3s;font-size:130px'>עקבו</div><div class='h' style='--d:.6s;color:#111;font-size:56px;margin-top:40px'>@goldchain_ai · goldchain-ai.com</div>"
HOOK = {
 'A': ["<div class='hk2' style='font-size:118px;margin-top:140px'>עדיין מקבלים<br>מ-<span dir=ltr>ChatGPT</span></div><div class='hk' style='--d:.2s;font-size:170px'><span class='o'>תשובות</span><br><span class='y'>כלליות?</span></div>",
       "<div class='hk' style='font-size:170px;margin-top:120px'>3 טריקים</div><div class='hk2' style='--d:.2s'>לבעלי עסקים</div><div class='free' style='--d:.5s;font-size:60px'>👀 השלישי הכי שווה</div>"],
 'B': ["<div class='hk' style='font-size:170px;margin-top:120px'>3 טריקים<br>ב-<span class='y' dir=ltr>ChatGPT</span></div><div class='hk2' style='--d:.2s'>שכל בעל עסק<br>צריך להכיר</div>",
       "<div class='hk' style='font-size:170px;margin-top:120px'>3 טריקים</div><div class='hk2' style='--d:.2s'>לבעלי עסקים</div><div class='free' style='--d:.4s;font-size:60px'>👀 השלישי הכי שווה</div>"],
}
# raw VO cut points (silencedetect -35dB d=0.25 + estimates inside long phrases)
CUT = {
 'A': dict(h2=3.6, t1a=7.01, t1b=10.85, t2a=14.36, t2b=16.7, t3a=19.06, kw=22.51, t3b=23.77, cta=26.52, end=29.47),
 'B': dict(h2=3.9, t1a=5.72, t1b=9.6, t2a=12.97, t2b=15.3, t3a=17.68, kw=20.89, t3b=22.12, cta=24.77, end=27.72),
}
for v in 'AB':
    c = CUT[v]; order = [('h1',-1.0),('h2',c['h2']),('t1a',c['t1a']),('t1b',c['t1b']),('t2a',c['t2a']),('t2b',c['t2b']),('t3a',c['t3a']),('t3b',c['t3b']),('cta',c['cta']),('end',c['end'])]
    times = [(-1.0 if k=='h1' else T(r)) for k,r in order]
    vo_end = T(c['end']); dur = round(vo_end + 3.5, 2)
    kd = round((c['kw'] - c['t3a'])/1.1, 2)
    html = {'h1':HOOK[v][0],'h2':HOOK[v][1],'t1a':S['tip1a'],'t1b':S['tip1b'],'t2a':S['tip2a'],'t2b':S['tip2b'],'t3a':S['tip3a'].replace('--d:.3s;font-size:120px', f'--d:{kd}s;font-size:120px'),'t3b':S['tip3b'],'cta':CTA,'end':END}
    bg = {'h1':'#07070c','h2':'#1638ff','cta':'#ff5a1f','end':'#ffd23f'}
    scenes = []
    for i,(k,_) in enumerate(order):
        t = times[i]; nxt = times[i+1] if i+1 < len(order) else dur + 0.2
        s = {'t': t, 'len': round(nxt - t + 0.05, 2), 'bg': bg.get(k,'#07070c'), 'html': html[k]}
        if k not in bg: s['fx'] = 'grid'
        scenes.append(s)
    json.dump({'w':1080,'h':1920,'dur':dur,'css':CSS,'scenes':scenes}, open(f'tips/gpt3_{v}.json','w'), ensure_ascii=False)
    print(v, dur, [s['t'] for s in scenes])
