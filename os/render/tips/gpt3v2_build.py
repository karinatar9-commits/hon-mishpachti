# v2 after Karin "לא אהבתי" (design, pace, hook): laptop plate (series-E look), ~19s, short hooks. VO not sped up; compose delays VO 0.3s.
import json
CSS = json.load(open('screen/ep4.json')).get('css','') + """
.num{display:inline-flex;width:120px;height:120px;border-radius:32px;background:#ff5a1f;color:#fff;font-weight:900;font-size:90px;align-items:center;justify-content:center}
.say{font-weight:900;font-size:92px;line-height:1.05;text-align:center;max-width:1180px}
.say .y{color:#ffd23f}
.kwb{background:#ffd23f;color:#111;font-weight:900;font-size:120px;padding:18px 56px;border-radius:40px;transform:rotate(-2deg);white-space:nowrap}
.bubble b{color:#ff5a1f}
"""
def tip(n, quote, reply):
    return f"<div class='num'>{n}</div><div class='say' style='--d:.15s'>״{quote}״</div>" + (f"<div class='bubble in' style='--d:.9s;font-size:44px'>{reply}</div>" if reply else "")
TIP1 = tip(1, "תשאל אותי שאלות<br><span class='y'>לפני שאתה עונה</span>", "בשמחה: מה העסק מוכר? למי? ומה המטרה?")
TIP2 = tip(2, "איפה הלקוח <span class='y'>יתווכח</span><br>עם ההצעה הזו?", "<b>זמן הביצוע.</b> כתוב ״לפי זמינות״, בלי תאריך.")
TIP3 = "<div class='num'>3</div><div class='mid' style='--d:.1s'>כשיש מספרים:</div><div class='kwb' style='--d:.3s'>״תחשב את זה בקוד״</div><div class='small' style='--d:.7s'>ככה הוא מחשב, לא מנחש</div>"
SAVE = "<div class='big'>שמרו 🔖</div><div class='mid' style='--d:.3s'>ושלחו לחבר עם עסק</div>"
V = {
 'A': dict(scenes=[(-0.3,'#ff5a1f',"<div class='mid'>ChatGPT עונה לכם</div><div class='big' style='--d:.2s'>גנרי?</div>"),
                   (2.8,'#1638ff',"<div class='big'>3 משפטים</div><div class='mid acc' style='--d:.2s'>שמשנים את התשובה</div>"),
                   (4.94,None,TIP1),(8.14,None,TIP2),(11.36,None,TIP3),(13.5,'#ff5a1f',SAVE)], dur=16.0),
 'B': dict(scenes=[(-0.3,'#1638ff',"<div class='big'>3 משפטים</div><div class='mid acc' style='--d:.2s'>שהופכים את ChatGPT<br>לעוזר אמיתי</div>"),
                   (3.97,None,TIP1),(7.45,None,TIP2),(10.81,None,TIP3),(13.0,'#ff5a1f',SAVE)], dur=15.5),
}
for v,c in V.items():
    sc = c['scenes']; out=[]
    for i,(t,bg,h) in enumerate(sc):
        nxt = sc[i+1][0] if i+1<len(sc) else c['dur']+0.3
        s = {'t':t,'len':round(nxt-t+0.05,2),'bg':bg or '#07070c','html':h}
        if not bg: s['fx']='grid'
        out.append(s)
    json.dump({'tag':'טיפ AI','title':['3 משפטים','ל-ChatGPT'],'end':['עוד טיפים','כאלה? עקבו'],'pill':'@goldchain_ai',
               'dur':c['dur'],'css':CSS,'scenes':out}, open(f'tips/gpt3v2_{v}.json','w'), ensure_ascii=False)
print('ok')
