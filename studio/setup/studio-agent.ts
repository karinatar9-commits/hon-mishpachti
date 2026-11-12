// Studio OS — the agents. Deploy as an edge function named "studio-agent" in the client's Supabase project (verify_jwt on).
// Needs one secret, added by the client herself: ANTHROPIC_API_KEY.
// Every call runs as the signed-in owner, so the database rules decide what the agent can see. Agents only write drafts,
// tasks and tables inside the system — nothing is ever sent to anyone from here.
import { createClient } from "npm:@supabase/supabase-js@2";
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
const J = (o: unknown, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { ...cors, "Content-Type": "application/json" } });
const BIZ = { name: "שירז אדריכלות", owner: "שירז", stages: ["היכרות ופרוגרמה", "קונספט", "תכנון מוקדם", "היתר בנייה", "תכנון מפורט", "מכרז קבלנים", "ביצוע ופיקוח", "מסירה"] };
const FAST = "claude-haiku-5-5", SMART = "claude-sonnet-5-5";
const OUT = `החזירי JSON בלבד, בלי טקסט מסביב, במבנה: {"note":"משפט קצר על מה שנעשה","text":"תשובה בקול, עד 3 משפטים (רק לעוזרת)","rows":["שורות להצגה"],"drafts":[{"type":"update|agenda|reply|offer|content","title":"","body":"","format":""}],"tasks":[{"title":"","due":"YYYY-MM-DD","project":"מזהה או ריק"}],"boq":[{"sec":"פרק","item":"סעיף","unit":"יח'","qty":0}],"plan":{"summary":""}}. שדות שלא רלוונטיים — להשמיט.`;
const ROLE: Record<string, { model: string; sys: string }> = {
  pa: { model: FAST, sys: "את נועה, העוזרת האישית. עני קצר, בעברית מדוברת, לפי הנתונים בלבד. אם ביקשו להוסיף משימה — החזירי אותה ב-tasks. אל תמציאי נתונים." },
  pm: { model: FAST, sys: "אתה דן, מנהל הפרויקטים. במצב gaps: בדוק מה חסר כדי לסיים את השלב הנוכחי והחזר משימות חסרות בלבד (בלי כפילויות למשימות קיימות). אחרת: כתוב עדכון שבועי ללקוח — חם, קצר, ברור, בלי ז'רגון — כטיוטה מסוג update." },
  boq: { model: SMART, sys: "את תמר, כמאית. הכיני כתב כמויות לפרויקט לפי סוגו, שטחו, שלבו והתוכניות שנקראו. כמויות בלבד, בלי מחירים (המחירים ממולאים על ידי האדריכלית). ציינו ב-note על אילו הנחות התבססת." },
  buy: { model: FAST, sys: "אתה יואב, רכש וספקים. במצב notes: הוצא משימות מסיכום הפגישה. אחרת: הכן סדר יום לפגישת הספק הקרובה בפרויקט כטיוטה מסוג agenda, כולל שאלות שחייבים לסגור והשוואה להצעות מחיר קיימות." },
  plans: { model: SMART, sys: "את גל, קוראת תוכניות. קראי את התוכנית המצורפת וסכמי ב-plan.summary: סוג הגיליון וקנה מידה, רשימת חללים עם שטחים, פתחים, הערות חשובות, ואי-התאמות או מידות חסרות. מה שלא קריא — לכתוב שלא קריא, לא לנחש." },
  leads: { model: FAST, sys: "את עדי. לפי mode: reply = מענה ראשון חם לליד; offer = הצעת שכר טרחה מסודרת עם היקף עבודה ואבני דרך. סכומים — להשאיר [למלא סכום] אלא אם נמסרו." },
  content: { model: FAST, sys: "את ליה. הציעי 3 רעיונות תוכן לאינסטגרם לשבוע (רילס/קרוסלה) שנשענים על הפרויקטים האמיתיים. בלי שמות לקוחות ובלי כתובות. כל רעיון כטיוטה מסוג content עם format." }
};
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const key = Deno.env.get("ANTHROPIC_API_KEY"); if (!key) return J({ error: "חסר ANTHROPIC_API_KEY ב-Secrets" }, 500);
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: req.headers.get("Authorization") || "" } } });
    const { data: u } = await sb.auth.getUser(); if (!u?.user) return J({ error: "לא מחובר" }, 401);
    const b = await req.json(); const role = ROLE[b.agent]; if (!role) return J({ error: "סוכן לא מוכר" }, 400);
    const { data: rows, error } = await sb.from("st_items").select("id,kind,data").neq("kind", "log"); if (error) throw error;
    const all = rows.map((r: any) => ({ id: r.id, kind: r.kind, ...r.data }));
    const proj = all.find((i: any) => i.id === b.project);
    const scope = proj ? all.filter((i: any) => i.id === proj.id || i.project === proj.id || i.kind === "supplier") : all.filter((i: any) => i.kind !== "boq");
    const ctx = { today: new Date().toISOString().slice(0, 10), business: BIZ, project: proj || null, lead: all.find((i: any) => i.id === b.lead) || null, mode: b.mode || "", question: b.q || "", data: scope.map((i: any) => { const { body, ...x } = i; return x }) };
    const content: any[] = [];
    if (b.file?.b64) content.push(b.file.type === "application/pdf" ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: b.file.b64 } } : { type: "image", source: { type: "base64", media_type: b.file.type, data: b.file.b64 } });
    content.push({ type: "text", text: JSON.stringify(ctx) });
    const r = await fetch("https://api.anthropic.com/v1/messages", { method: "POST", headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" }, body: JSON.stringify({ model: role.model, max_tokens: 20000, output_config: { effort: "low" }, system: `${role.sys}\nהעסק: ${BIZ.name}. בעלת העסק: ${BIZ.owner}.\n${OUT}`, messages: [{ role: "user", content }] }) });
    const a = await r.json(); if (!r.ok) return J({ error: a?.error?.message || "שגיאת מודל" }, 502);
    const txt = (a.content || []).filter((c: any) => c.type === "text").map((c: any) => c.text).join("");
    const m = txt.match(/\{[\s\S]*\}/); if (!m) return J({ error: "תשובה לא תקינה מהסוכן" }, 502);
    const o = JSON.parse(m[0]); const ins: any[] = []; const at = Date.now(); const pid = proj?.id || "";
    for (const d of o.drafts || []) ins.push({ kind: "draft", data: { ...d, agent: b.agent, project: pid, status: "wait", at } });
    for (const t of o.tasks || []) ins.push({ kind: "task", data: { title: t.title, due: t.due || ctx.today, project: t.project || pid, done: false, by: b.agent } });
    if (o.boq?.length && pid) { await sb.from("st_items").delete().eq("kind", "boq").eq("data->>project", pid); for (const q of o.boq) ins.push({ kind: "boq", data: { ...q, project: pid, price: 0 } }) }
    if (o.plan?.summary && pid) ins.push({ kind: "plan", data: { project: pid, name: b.file?.name || "תוכנית", date: ctx.today, summary: o.plan.summary } });
    if (o.note && b.agent !== "pa") ins.push({ kind: "log", data: { agent: b.agent, text: o.note, at } });
    if (ins.length) { const { error: e2 } = await sb.from("st_items").insert(ins); if (e2) throw e2 }
    return J({ note: o.note || "מוכן", text: o.text || o.note || "", rows: o.rows || [], changed: ins.length > 0 });
  } catch (e) { return J({ error: String((e as Error).message || e) }, 500) }
});
