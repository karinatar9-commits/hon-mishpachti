// Karin OS — content studio. Writes video scripts (Claude), orders AI clips (Higgsfield), plans the daily videos,
// hands jobs to the GitHub renderer (authenticated by GitHub OIDC), and publishes to
// Instagram only when Karin presses "אשר ופרסם" in the app.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.49.4";
import { createRemoteJWKSet, jwtVerify } from "npm:jose@5";

const SB_URL = Deno.env.get("SUPABASE_URL")!;
const db = createClient(SB_URL, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
// Karin's address for notification emails lives in os_settings (key owner_email), not in this public code.
async function ownerEmail(): Promise<string> {
  const { data } = await db.from("os_settings").select("value").eq("key", "owner_email").maybeSingle();
  const e = String((data?.value as any)?.email || "");
  if (!e) console.error("os_settings.owner_email is missing");
  return e;
}
const AKEY = Deno.env.get("ANTHROPIC_API_KEY") || "";
const HF_KEY = Deno.env.get("HF_KEY") || "";            // "keyId:keySecret"
const EL_KEY = Deno.env.get("ELEVEN_KEY") || "";       // ElevenLabs: narration in Karin's cloned voice
const META = Deno.env.get("META_TOKEN") || "";
const META_GLOW = Deno.env.get("META_TOKEN_GLOW") || "";
const G = "https://graph.facebook.com/v23.0";
const REPO = "karinatar9-commits/hon-mishpachti";
const JWKS = createRemoteJWKSet(new URL("https://token.actions.githubusercontent.com/.well-known/jwks"));
const BUCKET = "os-media";

const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-gh-oidc, x-cron-key", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (o: unknown, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });
const now = () => new Date().toISOString();
// @ts-ignore EdgeRuntime is provided by Supabase
const bg = (p: Promise<unknown>) => EdgeRuntime.waitUntil(p.catch((e) => console.error(e)));

// once a second factor is enrolled, only sessions that passed it (aal2) are accepted
function aalOk(token: string, user: any) {
  if (!(user?.factors || []).some((f: any) => f.status === "verified")) return true;
  try { let b = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"); b += "=".repeat((4 - b.length % 4) % 4); return JSON.parse(atob(b)).aal === "aal2"; } catch { return false; }
}

async function settings() {
  const { data } = await db.from("os_settings").select("key,value");
  const main: any = (data || []).find((x: any) => x.key === "main")?.value || {};
  const models: any = (data || []).find((x: any) => x.key === "models")?.value || {};
  const lessons: any = (data || []).find((x: any) => x.key === "content_lessons")?.value || {};
  const cron: string = (data || []).find((x: any) => x.key === "cron_secret")?.value?.k || "";
  return { main, lessons, cron, model: models.content || models.chat || "claude-sonnet-5-5" };
}

const BRAND: Record<string, (s: any) => string> = {
  glow: (s) => `Glow House / רינת קוסמטיקס — קליניקת יופי ואסתטיקה בנווה ים, ראשון לציון (מגדלור 63). קול המותג: ${s.brandVoice || "חם, מקצועי, בגובה העיניים, נשי ומדויק"}. קהל: ${s.audience || "נשים 25-55 באזור ראשון לציון"}.`,
  karin: (s) => `החשבון העסקי של קרין עטר. ${s.brandKarin || "מנהלת כספים, משקיעה ובונת מערכות AI לעסקים — מסבירה כסף, השקעות ואוטומציה בשפה פשוטה ומעוררת"}. קהל: ${s.audienceKarin || "בעלי עסקים ונשים שרוצות להבין כסף והשקעות"}.`,
};

// b-roll library that ships with the renderer (os/render/media/broll/<tag>.mp4)
const BG_TAGS = `"ai" (רשת נוירונים זוהרת, מופשט), "robot" (רובוט-עוזר שעובד מול מסכים), "phone" (טלפון עם הודעות והתראות), "owner" (בעל עסק עייף מול ניירת), "flow" (תהליך אוטומטי, כרטיסים שזורמים בין תחנות), "growth" (גרף שעולה), "time" (שעון וזמן שרץ), "win" (בעל עסק רגוע והמערכות עובדות לבד)`;
const SCHEMA = `החזר/י JSON בלבד (בלי טקסט מסביב) במבנה:
{"title":"...","anim":"","bg":"","palette":{"bg1":"#hex","bg2":"#hex","accent":"#hex","text":"#hex"},"handle":"@...",
 "scenes":[{"type":"title|point|stat|list|compare|quote|cta|ai|image","dur":3.5,"kicker":"","headline":"","body":"","emoji":"","value":"","items":[""],"left_title":"","right_title":"","left":[""],"right":[""],"prompt":"","bg":""}],
 "caption":"כיתוב לאינסטגרם עם שורת הוק, ערך וקריאה לפעולה","hashtags":["#..."]}
כללים: עברית תקנית. סצנה ראשונה type=title עם הוק שעוצר גלילה (עד 7 מילים). אחרונה type=cta. כותרת עד 8 מילים, body עד 18 מילים, items עד 4 פריטים קצרים. dur בין 2.5 ל-6 שניות לפי כמות הטקסט (קריאה נוחה). סכום dur קרוב ל-LEN שניות. stat: value מספר קצר (למשל "73%" או "₪1,200"). compare: שני טורים קצרים. emoji אחד לכל סצנה.`;

async function claudeJSON(prompt: string | any[], model: string, search = 0) {
  // thinking counts against max_tokens on the 5.5 models, so keep effort low and leave room for the JSON
  const req: any = { model, max_tokens: 16000, output_config: { effort: "low" }, messages: [{ role: "user", content: prompt }] };
  if (search) req.tools = [{ type: "web_search_20250305", name: "web_search", max_uses: search }];
  const r = await fetch("https://api.anthropic.com/v1/messages", { method: "POST", headers: { "x-api-key": AKEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify(req) });
  const raw = await r.text();
  let j: any; try { j = JSON.parse(raw); } catch { throw new Error(`API ${r.status}: ${raw.slice(0, 160) || "empty body"}`); }
  if (!r.ok) throw new Error(j?.error?.message || `API ${r.status}`);
  const t = (j.content || []).filter((c: any) => c.type === "text").map((c: any) => c.text).join("");
  try { return JSON.parse(t.slice(t.indexOf("{"), t.lastIndexOf("}") + 1)); }
  catch { throw new Error(`no JSON (stop=${j.stop_reason}, out=${j.usage?.output_tokens}): ${t.slice(0, 160)}`); }
}

// Goldchain's six skills (orchestrator, discovery, copywriting, video, education, cases, leads) — the same texts Karin installed; cached per instance
let GC_SKILLS: any = null;
async function gcSkills(): Promise<string> {
  if (!GC_SKILLS) { try { GC_SKILLS = await (await fetch("https://raw.githubusercontent.com/karinatar9-commits/hon-mishpachti/main/os/skills/goldchain.json")).json(); } catch { GC_SKILLS = {}; } }
  return ["orchestrator", "copywriting", "video", "education", "discovery", "cases", "leads"].filter((k) => GC_SKILLS[k]?.text).map((k) => `### סקיל: ${GC_SKILLS[k].title}\n${String(GC_SKILLS[k].text).slice(0, 2200)}`).join("\n\n");
}

// ---- Guides: every Goldchain post gets its own locked guide at goldchain-ai.com/<slug> (draft until Karin approves) ----
const GUIDE_RULES = `אתה כותב מדריך קצר ל-Goldchain AI (קרין) שנשלח למי שמגיב לפוסט. הקהל: בעלי עסקים קטנים-בינוניים בישראל, הנישה: הצד הפיננסי של העסק.
המדריך הוא 3 שלבים בדיוק:
1) "ספרו על העסק" — טופס טקסט חופשי להעתקה, עם שדות שהקורא ממלא במילים שלו, שרלוונטיים לנושא הפוסט.
2) פרומפט מלא להעתקה ל-Claude שבונה בדיוק את מה שהפוסט הראה, כארטיפקט/אפליקציה אחת שעובדת מיד עם נתוני דוגמה מסומנים. מפורט, מדויק טכנית, בלי להבטיח חיבורים שלא קיימים.
3) "להפוך את זה לאמיתי" — מה מחברים (מערכות, נתונים אמיתיים, אוטומציה) והצעה עדינה לבנות את זה עד הסוף עם Goldchain.
סגנון: עברית תקנית, חם וענייני, בלי בושה ובלי "אתם לא יודעים", בלי הבטחות כמו "אפס טעויות". לא לפרט את כל הידע — מספיק כדי לבנות גרסה ראשונה.
החזר JSON בלבד:
{"slug":"באנגלית קטנה עם מקפים, 2-24 תווים, ייחודי לנושא","keyword":"מילה אחת בעברית שאנשים יכתבו בתגובה","title":"שם המדריך","h1":"כותרת ראשית קצרה","h2":"שורת משנה","lead":"משפט פתיחה לדף","popup":"כותרת לחלון ההרשמה","subtitle":"שורה אחת למייל","steps":[{"title":"","desc":"","text":""},{"title":"","desc":"","text":""},{"title":"","desc":"","text":""}]}`;
async function guideJob(opts: { videoId?: string; topic?: string; script?: any }) {
  const s = await settings();
  let topic = opts.topic || "", script = opts.script;
  if (opts.videoId) { const { data: v } = await db.from("os_videos").select("topic,script,caption,account").eq("id", opts.videoId).single(); if (!v || v.account !== "karin") return { skip: "not_goldchain" }; topic = v.topic; script = v.script; }
  const les: string[] = (s.lessons.guides || []).concat(s.lessons.karin || []).slice(-15);
  const g: any = await claudeJSON(`${GUIDE_RULES}\n\nנושא הפוסט: ${topic}\n${script ? "התסריט: " + JSON.stringify(script).slice(0, 4000) : ""}${les.length ? "\n\nלקחים מקרין:\n- " + les.join("\n- ") : ""}`, s.model);
  let slug = String(g.slug || "guide").toLowerCase().replace(/[^a-z0-9-]/g, "").replace(/^-+|-+$/g, "").slice(0, 24) || "guide";
  const { data: ex } = await db.from("os_settings").select("key").like("key", `guide_${slug}%`);
  if (ex?.length) slug = `${slug}-${ex.length + 1}`;
  const { data: main } = await db.from("os_settings").select("value").eq("key", "guide_assistant").maybeSingle();
  const val = { ...g, slug, active: false, community: main?.value?.community || "", video_id: opts.videoId || null, created_at: now() };
  await db.from("os_settings").upsert({ key: `guide_${slug}`, value: val, updated_at: now() });
  await db.from("os_tasks").insert({ title: `מדריך חדש מחכה לאישור: ${g.title}`, agent: "biz", status: "open", source: "content", priority: "normal", notes: `goldchain-ai.com/${slug} · מילת תגובה: ${g.keyword}. לבדוק שהפרומפט בשלב 2 באמת בונה את מה שבפוסט, ואז לאשר בקוביית "מדריכים לפוסטים".` });
  return { slug, keyword: g.keyword };
}

async function scriptJob(id: string, feedback?: string) {
  const { data: v } = await db.from("os_videos").select("*").eq("id", id).single();
  try {
    const s = await settings();
    const mixed0 = v.style === "mixed";
    const car = v.format === "carousel";
    const film = v.style === "film" && !car && !!HF_KEY;
    const mixed = mixed0 || film;
    const kit = (s.main.brandKit || {})[v.account] || {};
    const les: string[] = (s.lessons[v.account] || []).concat(s.lessons.all || []);
    const skills = v.account === "karin" ? await gcSkills() : "";
    const gcDir = v.account === "karin" && !car ? `\nכיוון קבוע לסרטוני Goldchain (קרין ביקשה במפורש: "יותר מדי רובוטי", היא רוצה הסברים, סימולציות והדגמות):
- ההשראה: היוצרים עמיחי (amichai.ai) ואיילון גרופר (eilon.grouper). מה עובד אצלם: הוק חד בשנייה הראשונה, הבטחה ברורה ("5 שיטות", "ככה זה עובד"), חלונות של הכלי האמיתי צפים על רקע כהה ומקלידים בהם מול הצופה, טיפים ממוספרים (point ואחריו app), שפה של בן אדם ("אני מראה לכם", "תראו מה קורה"), ובסוף "תגיבו [מילה] ואני שולחת לכם את המדריך".
- ההוק (לפי רן נוריאני, ran_nuriani — סרטונים עם מאות אלפי צפיות): השנייה הראשונה היא שבירת דפוס ויזואלית, לא הסבר. זווית צילום לא צפויה (מבפנים החוצה, מקרוב מאוד, POV), רגע מתוח מהיומיום של בעל עסק (ערימת חשבוניות בלילה, טלפון שמצלצל באמצע לקוח, מסך בנק אדום), ומילה אחת עד שלוש בגדול כמו אגרוף ("לא.", "עוד אחת?", "3 בלילה"). רק אחר כך ההסבר. לפתוח לולאה: לרמוז על משהו שיגיע ("תסתכלו מה קורה בשורה האחרונה"). אם מותר type=ai — הסצנה הראשונה היא קטע ai קולנועי כזה (prompt באנגלית: cinematic, unusual angle, moody light, close-up, no text, no robots), עם headline של מילה עד שלוש.
- "anim":"demo" כברירת מחדל. אחרי ההוק, רוב הסצנות הן demo שמראות את התהליך קורה בפועל: איך זה נראה היום (ידני), ואיך זה נראה כשהסוכן עושה את זה — הודעה נכנסת, הסוכן עונה, שורות מותאמות, תור נקבע, ובסוף קרין מאשרת.
- הקריינות בגוף ראשון של קרין, כמו שמסבירים לחבר: "תראו מה קורה כאן...", "שימו לב לשורה הזאת...". מסבירה מה רואים על המסך ולמה זה חשוב. לא סיסמאות ולא רשימות.
- בלי רובוטים ובלי "AI" כדימוי. הדגמה של עסק אמיתי (קליניקה, משרד, חנות) עם שמות ונתונים מדומים.
- הסוף: ברירת המחדל היא הזמנה לייעוץ — "רוצים כזה בעסק שלכם? השאירו פרטים · goldchain-ai.com · או בוואטסאפ, הקישור בביו". מדריך עם מילה בתגובות רק כשקרין ביקשה מדריך לסרטון הזה. לא "עקבו לעוד טיפים". בסצנת ה-cta השדה "kicker" הוא טקסט הכפתור (עד 4 מילים).` : "";
    let p = (skills ? `הסקילים של Goldchain AI שקרין הגדירה — לעבוד לפיהם (מיצוב, קופי, מבנה וידאו, קריאה לפעולה):\n${skills}\n\n` : "") + `את/ה ליה — במאית תוכן ויוצרת רילסים ומצגות מובילה. ${car ? "בנה/י קרוסלה (מצגת) לאינסטגרם: 5-9 שקפים 4:5, כל שקף עומד בפני עצמו, השקף הראשון הוק שגורם להחליק, האחרון קריאה לפעולה. dur לא חשוב (3)." : `בנה/י סרטון הסבר אנכי (9:16) לאינסטגרם, טקסט על המסך עם אנימציה ${v.voice ? "וקריינות בעברית" : "(בלי קריינות)"}`}, שמסביר את הנושא בצורה מעניינת ומפתיעה — עובדה מפתיעה, מנגנון, דוגמה, טעות נפוצה, ומה לעשות.
${les.length ? "כללים שקרין לימדה אותך מהערות קודמות (חובה לשמור עליהם):\n- " + les.join("\n- ") : ""}
${kit.accent ? "העיצוב קבוע לפי ערכת המותג — אל תשנה/י צבעים." : ""}
מותג: ${BRAND[v.account](s.main)}
${v.auto ? "זו הבקשה של קרין במילים שלה (הבן/י ממנה את הנושא, הזווית, האורך והסגנון; אם ביקשה משהו מפורש — כבד/י אותו)" : "נושא"}: ${v.topic}
${v.notes ? "דגשים מקרין: " + v.notes : ""}
אורך: ${v.length_s} שניות.
${mixed && !car ? `שלב/י 1-3 סצנות type=ai: קטע וידאו AI קולנועי שממחיש רגע (בלי טקסט בתוך התמונה). ב-prompt כתוב/י באנגלית תיאור ויזואלי מפורט (נושא, תאורה, תנועת מצלמה), בלי אנשים מזוהים ובלי לוגואים. ב-headline כתוב/י את הטקסט שיופיע על הקטע.` : "אל תשתמש/י ב-type=ai."}
${!car ? `סגנון הרילס (חובה): כל סצנה מוצגת על קטע וידאו קולנועי ברקע, עם כותרת גדולה שקופצת מילה-מילה וכתוביות שעוקבות אחרי הקריינות. לכן:
- headline קצר וחד: 2 עד 5 מילים בלבד, כמו כותרת של טיקטוק. מילה אחת שרוצים להדגיש עוטפים בכוכביות, למשל "זה עולה לך *כסף*".
- הסצנה הראשונה היא הוק של עד 5 מילים שיוצר מתח או סקרנות (שאלה, טענה מפתיעה, מספר). לא לפתוח ב"היי" או בהצגה עצמית.
- קצב רגוע (קרין ביקשה במפורש: לא לרוץ מהר): 5 עד 6 סצנות בלבד, כל אחת 5 עד 7 שניות, משפט קריינות אחד או שניים בכל סצנה. אפשר לגוון בסוגים: stat עם מספר גדול, list של 3 פריטים קצרים, compare לפני/אחרי.
- body להשאיר ריק ברוב הסצנות — ההסבר נאמר בקריינות ומופיע ככתוביות.
- סגנון אחד לכל הסרטון (קרין ביקשה במפורש: לא לערבב סגנונות, זה נראה בלאגן). בוחרים אחת משתי אפשרויות: (א) סרטון וידאו — "anim" ריק, ובשדה "bg" ברמת הסרטון קטע רקע אחד לכל הסרטון מתוך: ${BG_TAGS}; (ב) סרטון אנימציה — "anim" הוא סוג אחד בלבד מתוך demo / graph / breakdown / route / stick / shapes, כל סצנות התוכן הן מהסוג הזה בלבד (למשל כמה סצנות stick ברצף עם mood ו-caption שונים), והפתיחה והסיום יוצגו אוטומטית על אותו רקע.
- הסוף: cta אחד ברור (לעקוב / לשמור / לכתוב מילה בתגובות).
סוגי האנימציה לסרטון אנימציה (לעולם לא לערבב שני סוגים באותו סרטון; אם קרין ביקשה סוג מסוים — זה ה-anim). לכל סצנה headline קצר, vo, ו-dur של 6 עד 8 שניות:
- {"type":"demo","kind":"app|point|chat|table|flow|calendar","headline":""} — סימולציה חיה של התהליך עצמו, כמו הדגמה על מסך. app: חלון אפליקציה צף (כמו Claude) שבו מקלידים בקשה והתשובה נכתבת מול העיניים — "app":"Claude","prompt":"הבקשה בעברית מדוברת","reply":"התשובה, עד 40 מילים, עם נתוני דוגמה". point: מספר גדול וכותרת, לטיפים ממוספרים — "n":1,"title":"עד 3 מילים","sub":"עד 5 מילים", ו-headline ריק. chat: "title" ו-"messages":[{"from":"in|out|sys","text":""}] (in = הלקוח, out = הסוכן, sys = מה שקרה במערכת, למשל "✓ נקבע ביומן"), 3 עד 5 הודעות קצרות. table: "title","cols":["",""],"rows":[["",""]] עד 6 שורות, "flags":[אינדקס שורה בעייתית],"flag_note":"מה הבעיה","done_label":"הותאמו". flow: "steps":[{"icon":"אימוג'י","label":"עד 3 מילים","sub":"עד 4 מילים"}] 3 עד 5 שלבים. calendar: "title","slot":[יום 0-4, שעה 0-5],"slot_label":"","note":"". אפשר לגוון kind בין הסצנות. נתוני דוגמה בלבד, ריאליים לעסק ישראלי.
- {"type":"graph","headline":"","labels":["ינו","פבר","מרץ"],"values":[12,18,26],"unit":"K או % או ₪","style":"bars או line","note":"שורת מסקנה קצרה"} — גרף שגדל עם מספרים שרצים. 3 עד 7 ערכים. רק מספרים אמיתיים מהמקור או דוגמה שמוצגת בקריינות במפורש כדוגמה.
- {"type":"breakdown","headline":"","title":"שם הדבר שמפרקים","layers":["שכבה","שכבה","שכבה"]} — מוצר, תהליך או רעיון שמתפרק ל-3 עד 6 שכבות, כל שכבה עד 3 מילים.
- {"type":"route","headline":"","from":"נקודת התחלה","to":"נקודת סיום","value":"המרחק או הזמן"} — מסלול זוהר על כדור הארץ; טוב גם למסע של לקוח מפנייה ועד סגירה.
- {"type":"stick","headline":"","figures":3,"mood":"happy|sad|angry|shock","caption":"שורת פאנץ' עד 5 מילים"} — דמויות מקל מצוירות ביד על נייר צהוב, להמחשת סיטואציה אנושית בהומור.
- {"type":"shapes","headline":"","steps":["לקוח אחד","מספר לשניים","שניים לארבעה"],"factor":2} — נקודות שמתרבות בכל שלב; להמחשת התפשטות, צמיחה או חיסכון שמצטבר. 3 עד 5 שלבים.` : ""}
${v.voice && !car ? `קריינות: לכל סצנה הוסף/י שדה "vo" — משפט או שניים בעברית מדוברת וטבעית שהקריינית אומרת בזמן הסצנה (לא לקרוא את הכותרת מילה במילה; להסביר אותה). בלי אימוג'י, בלי סימנים מיוחדים, מספרים במילים, מונחים באנגלית לכתוב באותיות לטיניות. עד 22 מילים לסצנה. dur של כל סצנה = זמן הדיבור של ה-vo (בערך 2.6 מילים לשנייה) ועוד חצי שנייה.` : ""}
${gcDir}
${SCHEMA.replace("LEN", String(v.length_s))}`;
    if (film) p = `${skills ? "הסקילים של Goldchain AI שקרין הגדירה (מיצוב וקהל — לא להעמיס מידע):\n" + skills.slice(0, 5000) + "\n\n" : ""}את/ה ליה — במאית של סרטונים קצרים קולנועיים. זה סרט קצר, לא מצגת ולא הרצאה.
${les.length ? "כללים שקרין לימדה (חובה):\n- " + les.join("\n- ") + "\n" : ""}מותג: ${BRAND[v.account](s.main)}
נושא: ${v.topic}
${v.notes ? "דגשים: " + v.notes : ""}
הסיפור (קרין ביקשה במפורש): סימולציה של בעל/ת עסק בתוך העסק שלו/ה ברגע שהבעיה קורה — רואים את זה, מרגישים את זה. ואז אותו מקום, אותו אדם, כשהפתרון כבר בתוך העסק: מה השתנה ואיך זה משתלב ביום-יום. הסרט צריך להיות מעניין גם בלי קול בכלל.
מבנה: 6 עד 7 שוטים, כל אחד 5 שניות. שוט 1 = הוק: שבירת דפוס ויזואלית (זווית לא צפויה, תקריב קיצוני, POV, רגע מתוח). שוטים 2-3 = הבעיה מסלימה. שוט 4 = רגע המפנה. שוטים 5-6 = אותו אדם, רגוע, העסק עובד, הפתרון קורה ברקע (טלפון מאיר בהתראה, לקוח מחייך, ערימה נעלמת). שוט אחרון = סיום שקט עם המותג.
לכל שוט: {"type":"ai","dur":5,"prompt":"תיאור באנגלית לקטע וידאו קולנועי 9:16","headline":"","vo":""}
- prompt: אותה דמות ואותו מקום בכל השוטים — כתוב/י בכל שוט את אותו תיאור דמות מלא (גיל, מראה, לבוש) ואותו תיאור מקום (סוג העסק, תאורה, צבעים). סגנון: cinematic, shallow depth of field, natural moody light, handheld, realistic, 35mm. לכתוב תנועת מצלמה ומה קורה בדיוק. בלי טקסט בתמונה, בלי מסכים עם כתב קריא, בלי לוגואים, בלי רובוטים.
- headline: רוב השוטים ריקים. רק בהוק, ברגע המפנה ובסוף — 1 עד 3 מילים חזקות ("עוד אחת?", "3 בלילה.", "ואז זה.").
- vo: אופציונלי וקצר מאוד (עד 10 מילים), רק איפה שזה מוסיף. אפשר להשאיר הכל ריק — הסרט עובד בלי מילים.
- שוט אחרון: headline עם מה שבונים בשתי-שלוש מילים, ו-kicker = הזמנה לייעוץ ("השאירו פרטים · goldchain-ai.com").
החזר/י JSON בלבד: {"title":"","anim":"","scenes":[...],"caption":"כיתוב קצר עם הוק, משפט על הפתרון וקריאה לפעולה","hashtags":["#..."]}`;
    if (feedback) p += `\n\nזה התסריט הקודם:\n${JSON.stringify({ ...v.script, caption: v.caption })}\n\nההערות של קרין עליו (חובה ליישם את כולן, ולשמור את מה שלא העירה עליו):\n${feedback}\n\nבנוסף הוסף/י ל-JSON שדה "lessons": 0-3 כללים קצרים וכלליים שאפשר ללמוד מההערות האלה לכל הסרטונים הבאים (למשל "הוק בצורת שאלה", "לא יותר מ-12 מילים בשקף"). רק כללים שחלים גם על נושאים אחרים.`;
    if (v.ref_url) p += `\n\nקרין צירפה תמונה (שרטוט, צילום מסך או סקיצה עם הסבר). קרא/י אותה בעיון: מה שכתוב ומצויר בה הוא ההנחיה — המבנה, הסדר, המסרים והטקסטים שהיא רוצה. פתח/י את זה לסרטון מלא. אפשר לשלב עד 2 סצנות type=image שמציגות את התמונה שלה עצמה על המסך (רק אם היא ראויה להצגה לצופים, למשל צילום מסך או תרשים נקי; סקיצה בכתב יד — לא להציג).`;
    const sc = await claudeJSON(v.ref_url ? [{ type: "image", source: { type: "url", url: v.ref_url } }, { type: "text", text: p }] : p, s.model);
    if (!v.ref_url) (sc.scenes || []).forEach((x: any) => { if (x.type === "image") x.type = "point"; });
    sc.scenes = (sc.scenes || []).slice(0, 14).map((x: any) => ({ ...x, dur: Math.min(8, Math.max(2, +x.dur || 3.5)) }));
    if (car) sc.scenes.forEach((x: any) => { if (x.type === "ai") x.type = "point"; });
    // narration asked for but the writer skipped it on a scene: read the on-screen text instead of leaving silence
    if (v.voice && !car && !film) sc.scenes.forEach((x: any) => { if (!String(x.vo || "").trim()) x.vo = [x.headline, x.body, ...(x.items || [])].filter(Boolean).join(". ").slice(0, 220); });
    if (kit.accent) sc.palette = { bg1: kit.bg1, bg2: kit.bg2, accent: kit.accent, text: kit.text || "#ffffff" };
    if (Array.isArray(sc.lessons) && sc.lessons.length) {
      const cur: any = s.lessons; const arr: string[] = cur[v.account] || [];
      for (const l of sc.lessons) if (typeof l === "string" && l.trim() && !arr.includes(l.trim())) arr.push(l.trim());
      cur[v.account] = arr.slice(-30);
      await db.from("os_settings").upsert({ key: "content_lessons", value: cur, updated_at: now() });
      delete sc.lessons;
    }
    const caption = [sc.caption, (sc.hashtags || []).join(" ")].filter(Boolean).join("\n\n");
    let status = "queued";
    if (sc.scenes.some((x: any) => x.type === "ai")) {
      const cap = film ? 8 : Math.max(0, Math.min(3, +(v.source === "daily" ? (s.main.daily?.clips ?? 1) : 3)));
      sc.scenes.filter((x: any) => x.type === "ai").slice(cap).forEach((x: any) => { x.type = "point"; });
      if (mixed && HF_KEY && !car && cap) {
        for (const x of sc.scenes.filter((x: any) => x.type === "ai")) {
          const r = await fetch("https://api.higgsfield.ai/kling-video/v3.0/std/text-to-video", { method: "POST", headers: { Authorization: `Key ${HF_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({ prompt: x.prompt || x.headline, duration: Math.min(15, Math.max(3, Math.ceil(x.dur))), aspect_ratio: "9:16", sound: "off" }) });
          const j = await r.json().catch(() => ({}));
          if (r.ok && j.status_url) x.hf = { status_url: j.status_url, status: "queued" }; else { x.type = "point"; x.note = "AI clip failed: " + (j?.detail || j?.error || r.status); }
        }
        if (sc.scenes.some((x: any) => x.hf)) status = "waiting_clips";
      } else sc.scenes.forEach((x: any) => { if (x.type === "ai") x.type = "point"; });
    }
    await db.from("os_videos").update({ script: sc, caption, status, error: null, updated_at: now() }).eq("id", id);
    if (v.account === "karin" && !feedback && s.main.autoGuides === true) await guideJob({ videoId: id }).catch((e) => console.log("guide", String(e)));
  } catch (e) {
    await db.from("os_videos").update({ status: "failed", error: "כתיבת התסריט נכשלה: " + String(e).slice(0, 300), updated_at: now() }).eq("id", id);
  }
}

// ---------- daily plan: the agent picks today's topics and starts the videos ----------
async function selfCall(body: any, cron: string) {
  await fetch(`${SB_URL}/functions/v1/os-content`, { method: "POST", headers: { "content-type": "application/json", "x-cron-key": cron }, body: JSON.stringify(body) }).catch((e) => console.error(e));
}
async function dailyPlan(force = false) {
  const s = await settings();
  const d = s.main.daily || {};
  if (!force && d.on === false) return { skipped: "off" };
  const n = Math.max(1, Math.min(5, +d.n || 3));
  const day = new Date(); day.setUTCHours(0, 0, 0, 0);
  const { count } = await db.from("os_videos").select("id", { count: "exact", head: true }).eq("source", "daily").gte("created_at", day.toISOString());
  const need = force ? n : n - (count || 0);
  if (need <= 0) return { skipped: "already" };
  const { data: prev } = await db.from("os_videos").select("topic").order("created_at", { ascending: false }).limit(40);
  const p = `את/ה עורך/ת התוכן של חשבון האינסטגרם ${s.main.handleKarin || "@goldchain_ai"}. ${BRAND.karin(s.main)}
בחר/י ${need} נושאים לסרטוני רילס קצרים להיום (${new Date().toISOString().slice(0, 10)}). חפש/י ברשת מה חדש השבוע בעולם ה-AI והאוטומציה (מודלים חדשים, כלים, יכולות, מקרי שימוש לעסקים קטנים) ובחר/י שילוב: לפחות נושא אחד חדשותי מהימים האחרונים שמוסבר בפשטות, ולפחות אחד מעשי ("איך עושים X עם AI בעסק"). כל נושא צריך הוק ברור ותועלת לבעל עסק קטן בישראל. רק עובדות שמצאת במקור אמין — בלי להמציא מספרים, תאריכים או יכולות.
${d.focus ? "דגשים קבועים מקרין: " + d.focus : ""}
לא לחזור על נושאים שכבר נעשו: ${(prev || []).map((x: any) => x.topic.slice(0, 70)).join(" | ") || "אין"}
החזר/י JSON בלבד: {"topics":[{"topic":"הנושא במשפט אחד","notes":"הזווית, 2-4 עובדות מאומתות עם שם המקור, והקריאה לפעולה","length_s":30}]}`;
  const out = await claudeJSON(p, s.model, 3);
  const ids: string[] = [];
  for (const t of (out.topics || []).slice(0, need)) {
    if (!t?.topic) continue;
    const row = { account: "karin", topic: String(t.topic).slice(0, 2000), notes: String(t.notes || "").slice(0, 2000) || null, style: d.clips === 0 || !HF_KEY ? "explainer" : "mixed", format: "reel", length_s: Math.min(60, Math.max(15, +t.length_s || 30)), voice: d.voice !== false, source: "daily" };
    const { data } = await db.from("os_videos").insert(row).select("id").single();
    if (data?.id) ids.push(data.id);
  }
  for (const id of ids) await selfCall({ mode: "script_one", id }, s.cron);   // each script gets its own time budget
  return { created: ids.length };
}

// ---------- ליה: one Goldchain reel every day at 15:00 Israel time, picked from the ideas scout, in Karin's voice ----------
async function liaDaily(force = false) {
  const hr = +new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Jerusalem", hour: "2-digit", hour12: false }).format(new Date());
  if (!force && hr !== 15) return { skipped: "not_15" };
  const s = await settings();
  const L = s.main.lia || {};
  if (!force && L.on === false) return { skipped: "off" };
  const day = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Jerusalem" });
  const get = async (k: string) => (await db.from("os_settings").select("value").eq("key", k).maybeSingle()).data?.value;
  const st: any = (await get("lia_state")) || {};
  if (!force && st.day === day) return { skipped: "already" };
  const dig: any = (await get("ideas_digest")) || {};
  const fb: any[] = ((await get("ideas_feedback")) || {}).items || [];
  const down = new Set(fb.filter((f) => f.vote === "down").map((f) => f.id)), up = new Set(fb.filter((f) => f.vote === "up").map((f) => f.id));
  const used = new Set(st.used || []);
  const pool = (dig.ideas || []).filter((x: any) => x?.id && !down.has(x.id) && !used.has(x.id)).sort((a: any, b: any) => (up.has(b.id) ? 1 : 0) - (up.has(a.id) ? 1 : 0));
  const idea = pool[0];
  if (!idea) { if (!force) await selfCall({ mode: "ideas" }, s.cron); return { skipped: "no_idea" }; }
  const topic = `${idea.title}${idea.hook ? " — הוק: " + idea.hook : ""}`;
  const notes = [idea.pain && "הכאב: " + idea.pain, idea.before && "לפני: " + idea.before, idea.after && "אחרי: " + idea.after, idea.angle && "זווית: " + idea.angle, idea.source && "מקור: " + idea.source].filter(Boolean).join(" | ");
  const row = { account: "karin", topic: topic.slice(0, 2000), notes: notes.slice(0, 2000) || null, style: !HF_KEY ? "explainer" : (L.style || "film"), format: idea.format && /קרוסל/.test(idea.format) ? "carousel" : "reel", length_s: 35, voice: true, source: "daily" };
  const { data } = await db.from("os_videos").insert(row).select("id").single();
  await db.from("os_settings").upsert({ key: "lia_state", value: { day, used: [...used, idea.id].slice(-120), last: { id: data?.id, idea: idea.title, at: now() } }, updated_at: now() });
  if (data?.id) await selfCall({ mode: "script_one", id: data.id }, s.cron);
  return { created: data?.id, idea: idea.title };
}

async function pollClips() {
  const { data } = await db.from("os_videos").select("id,script").eq("status", "waiting_clips");
  for (const v of data || []) {
    const sc = v.script; let pending = false;
    for (const x of sc.scenes) {
      if (!x.hf || x.clip_url) continue;
      const r = await fetch(x.hf.status_url, { headers: { Authorization: `Key ${HF_KEY}` } });
      const j = await r.json().catch(() => ({}));
      x.hf.status = j.status || x.hf.status;
      if (j.status === "completed" && j.video?.url) x.clip_url = j.video.url;
      else if (["failed", "nsfw", "canceled"].includes(j.status)) { x.type = "point"; delete x.hf; }
      else pending = true;
    }
    await db.from("os_videos").update({ script: sc, status: pending ? "waiting_clips" : "queued", updated_at: now() }).eq("id", v.id);
  }
}

async function publishJob(id: string) {
  const fail = async (msg: string) => { await db.from("os_videos").update({ status: "review", error: "הפרסום נכשל: " + msg, updated_at: now() }).eq("id", id); };
  try {
    const { data: v } = await db.from("os_videos").select("*").eq("id", id).single();
    const s = await settings();
    const ig = v.account === "glow" ? s.main.igGlow : s.main.igKarin;
    const tok = v.account === "glow" && META_GLOW ? META_GLOW : META;
    if (!tok) return fail("עוד לא חובר טוקן של מטא");
    if (!ig) return fail("לא נבחר חשבון אינסטגרם בהגדרות שיווק");
    let c: any;
    if (v.format === "carousel" && (v.slides || []).length === 1) {
      c = await (await fetch(`${G}/${ig}/media`, { method: "POST", body: new URLSearchParams({ image_url: v.slides[0], caption: v.caption || "", access_token: tok }) })).json();
    } else if (v.format === "carousel") {
      const kids: string[] = [];
      for (const u of (v.slides || []).slice(0, 10)) {
        const k = await (await fetch(`${G}/${ig}/media`, { method: "POST", body: new URLSearchParams({ image_url: u, is_carousel_item: "true", access_token: tok }) })).json();
        if (!k.id) return fail(k.error?.message || "שקף לא עלה");
        kids.push(k.id);
      }
      c = await (await fetch(`${G}/${ig}/media`, { method: "POST", body: new URLSearchParams({ media_type: "CAROUSEL", children: kids.join(","), caption: v.caption || "", access_token: tok }) })).json();
    } else {
      const body = new URLSearchParams({ media_type: "REELS", video_url: v.video_url, caption: v.caption || "", share_to_feed: "true", access_token: tok });
      if (v.cover_url) body.set("cover_url", v.cover_url);
      c = await (await fetch(`${G}/${ig}/media`, { method: "POST", body })).json();
    }
    if (!c.id) return fail(c.error?.error_user_msg || c.error?.message || "יצירת המדיה נכשלה");
    let st = "";
    for (let i = 0; i < 60; i++) {
      await new Promise((r) => setTimeout(r, i ? 5000 : 2000));
      const s2 = await (await fetch(`${G}/${c.id}?fields=status_code,status&access_token=${tok}`)).json();
      st = s2.status_code;
      if (st === "FINISHED") break;
      if (st === "ERROR" || st === "EXPIRED") return fail(s2.status || st);
    }
    if (st !== "FINISHED") return fail("העיבוד במטא לקח יותר מדי זמן");
    const pub = await (await fetch(`${G}/${ig}/media_publish`, { method: "POST", body: new URLSearchParams({ creation_id: c.id, access_token: tok }) })).json();
    if (!pub.id) return fail(pub.error?.message || "media_publish נכשל");
    const m = await (await fetch(`${G}/${pub.id}?fields=permalink&access_token=${tok}`)).json();
    await db.from("os_videos").update({ status: "published", ig_media_id: pub.id, permalink: m.permalink || null, error: null, updated_at: now() }).eq("id", id);
  } catch (e) { await fail(String(e).slice(0, 300)); }
}

// narration in Karin's cloned voice (her own app, or the system cron key)
async function ttsText(body: any) { const s = await settings(); if (!EL_KEY || !s.main.voiceId) return json({ error: "no_voice" }, 400);
      const vid = String(body.voice_id || "").replace(/[^A-Za-z0-9]/g, "").slice(0, 40) || s.main.voiceId; // optional: another cloned voice from the same account // narration for a hand-edited video, in Karin's cloned voice
      const text = String(body.text || "").slice(0, 2500).trim(); if (!text) return json({ error: "empty" }, 400);
      const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(vid)}?output_format=mp3_44100_128`, { method: "POST", headers: { "xi-api-key": EL_KEY, "content-type": "application/json" },
        body: JSON.stringify({ text, model_id: body.model || s.main.voiceModel || "eleven_v3", language_code: "he", voice_settings: { stability: body.stability ?? s.main.voiceStability ?? 0.5, similarity_boost: body.similarity ?? 0.85, style: body.style ?? 0.35, use_speaker_boost: true, ...(body.speed ? { speed: Math.min(1.2, Math.max(0.7, Number(body.speed))) } : {}) } }) });
      if (!r.ok) return json({ error: (await r.text()).slice(0, 300) }, 502);
      const path = `vo/${Date.now()}.mp3`; const up = await db.storage.from(BUCKET).upload(path, new Uint8Array(await r.arrayBuffer()), { contentType: "audio/mpeg", upsert: true });
      if (up.error) return json({ error: up.error.message }, 500);
      return json({ url: db.storage.from(BUCKET).getPublicUrl(path).data.publicUrl }); }

async function graph(path: string, tok: string) {
  const j = await (await fetch(`${G}/${path}${path.includes("?") ? "&" : "?"}access_token=${tok}`)).json();
  if (j.error) throw new Error(j.error.message);
  return j;
}


// ---------- Glow House morning snapshot: campaigns, page/Instagram, leads → one short Hebrew brief + email to Karin ----------
const GLOW = { act: "act_2052225301495780", page: "111564514515729", ig: "17841406940882705" };
async function glowDaily() {
  const tok = META_GLOW; const s = await settings(); const out: any = { at: now(), errors: [] as string[] };
  const safe = async (k: string, fn: () => Promise<any>) => { try { out[k] = await fn(); } catch (e) { out.errors.push(`${k}: ${String((e as Error).message).slice(0, 160)}`); } };
  const conv = (a: any[]) => +((a || []).find((x: any) => /messaging_conversation_started/.test(x.action_type))?.value || 0);
  const lead = (a: any[]) => +((a || []).find((x: any) => x.action_type === "lead")?.value || 0);
  const row = (x: any) => ({ name: x.campaign_name, spend: Math.round(+x.spend || 0), reach: +x.reach || 0, impr: +x.impressions || 0, clicks: +x.clicks || 0, conv: conv(x.actions), leads: lead(x.actions) });
  if (tok) {
    const F = "campaign_name,spend,reach,impressions,clicks,actions";
    await safe("yesterday", async () => ((await graph(`${GLOW.act}/insights?level=campaign&date_preset=yesterday&fields=${F}&limit=50`, tok)).data || []).map(row));
    await safe("week", async () => ((await graph(`${GLOW.act}/insights?level=campaign&date_preset=last_7d&fields=${F}&limit=50`, tok)).data || []).map(row));
    await safe("running", async () => ((await graph(`${GLOW.act}/ads?fields=name,effective_status,campaign{name,daily_budget,effective_status},adset{name,daily_budget,targeting{age_min,age_max}}&effective_status=["ACTIVE","PENDING_REVIEW","DISAPPROVED","WITH_ISSUES","IN_PROCESS"]&limit=50`, tok)).data || [])
      .filter((a: any) => ["ACTIVE", "IN_PROCESS", "PENDING_REVIEW"].includes(a.effective_status) || a.campaign?.effective_status === "ACTIVE")
      .map((a: any) => ({ ad: a.name, status: a.effective_status, campaign: a.campaign?.name, budget: Math.round((+a.adset?.daily_budget || +a.campaign?.daily_budget || 0) / 100), age: a.adset?.targeting ? `${a.adset.targeting.age_min}-${a.adset.targeting.age_max}` : "" })));
    let ptok = "";
    await safe("page", async () => { const p = await graph(`${GLOW.page}?fields=name,fan_count,followers_count,access_token`, tok); ptok = p.access_token || ""; return { followers: p.followers_count, fans: p.fan_count }; });
    if (ptok) await safe("posts", async () => ((await graph(`${GLOW.page}/posts?fields=message,created_time,reactions.summary(true).limit(0),comments.summary(true).limit(0),shares&limit=5`, ptok)).data || [])
      .map((x: any) => ({ t: String(x.message || "").slice(0, 60), at: x.created_time?.slice(0, 10), likes: x.reactions?.summary?.total_count || 0, comments: x.comments?.summary?.total_count || 0, shares: x.shares?.count || 0 })));
    await safe("ig", async () => { const g = await graph(`${GLOW.ig}?fields=username,followers_count,media_count,media.limit(6){caption,timestamp,like_count,comments_count,media_product_type}`, tok);
      return { followers: g.followers_count, posts: g.media_count, recent: (g.media?.data || []).map((m: any) => ({ t: String(m.caption || "").slice(0, 60), at: m.timestamp?.slice(0, 10), likes: m.like_count, comments: m.comments_count, type: m.media_product_type })) }; });
  } else out.errors.push("meta: אין חיבור");
  // leads in the system (Glow House)
  const since = new Date(Date.now() - 86400000).toISOString();
  const { data: L } = await db.from("os_items").select("data,created_at").eq("kind", "leads");
  const gl = (L || []).filter((x: any) => x.data?.biz === "Glow House");
  out.leads = { new24: gl.filter((x: any) => x.created_at >= since).length, open: gl.filter((x: any) => !["won", "lost"].includes(x.data?.stage)).length, waiting: gl.filter((x: any) => x.data?.stage === "new").length };
  // yesterday's snapshot, so the brief can say what changed
  const { data: prev } = await db.from("os_settings").select("value").eq("key", "glow_daily").maybeSingle();
  const pv = prev?.value?.raw || null;
  const lessons = (await db.from("os_settings").select("value").eq("key", "meta_lessons").maybeSingle()).data?.value;
  // optional one-off focus Karin asked for (text lives in os_settings, not in code)
  const focus = (await db.from("os_settings").select("value").eq("key", "glow_focus").maybeSingle()).data?.value;
  const focusOn = focus?.note && (!focus.until || String(focus.until) >= now().slice(0, 10));
  if (AKEY) {
    const p = `את/ה דניאל, מנהל השיווק של Glow House (רינת קוסמטיקס, קליניקת יופי בראשון לציון: שיזוף בהתזה, הסרת שיער, גבות). כתוב/י לקרין תמונת בוקר קצרה בעברית פשוטה.
היא לא אוהבת טבלאות מספרים — כל מספר בתוך משפט שמסביר מה הוא אומר ולמה זה חשוב. קצר, ענייני, בלי הקדמות.
מדדי ייחוס מהעבר של החשבון: שיחת וואטסאפ עולה בממוצע כ-14 ₪; מתחת ל-12 ₪ מצוין, מעל 15 ₪ צריך לשנות; שיזוף בגילאי 25-54 עבד הכי טוב. ${lessons?.summary ? "לקחים מהעבר: " + String(lessons.summary).slice(0, 600) : ""}
${focusOn ? "מיקוד שקרין ביקשה לבוקר הזה (לפתוח בו את התמונה): " + String(focus.note).slice(0, 600) + "\n" : ""}כללים: קמפיינים ששמם מתחיל ב-"Glow OS" הם של קרין; את השאר מנהל אבינועם (שותף שיווק) — עליהם מדווחים, וכל שינוי ממליצים "לתאם עם אבינועם". קמפיין בשלושת הימים הראשונים נמצא בלמידה — לא להמליץ לשנות בו כלום. אם מודעה נדחתה (DISAPPROVED) או בבעיה — זו התראה ראשונה. אל תמציא/י נתונים שאין; אם משהו חסר (למשל אינסטגרם לא נגיש) תגיד/י את זה במשפט אחד.
נתוני היום: ${JSON.stringify({ ...out, errors: undefined })}
שגיאות גישה: ${JSON.stringify(out.errors)}
אתמול-שלשום (להשוואה): ${pv ? JSON.stringify({ yesterday: pv.yesterday, ig: pv.ig?.followers, page: pv.page, leads: pv.leads }) : "אין"}
החזר/י JSON תקין בלבד, בלי מירכאות כפולות בתוך הטקסט (כתוב/י ₪ ולא ש"ח): {"headline":"משפט אחד — הדבר הכי חשוב הבוקר","status":"good|watch|alert","story":["2-4 משפטים: מה קרה אתמול ומה זה אומר"],"campaigns":[{"name":"...","line":"משפט על מצבו"}],"social":"משפט על אינסטגרם/פייסבוק","actions":["עד 3 דברים לעשות היום, הכי חשוב ראשון"]}`;
    for (let i = 0; i < 2 && !out.brief; i++) { try { out.brief = await claudeJSON(p, s.model); } catch (e) { if (i) out.errors.push("brief: " + String((e as Error).message).slice(0, 160)); } }
  }
  const raw = { yesterday: out.yesterday, week: out.week, running: out.running, page: out.page, posts: out.posts, ig: out.ig, leads: out.leads };
  await db.from("os_settings").upsert({ key: "glow_daily", value: { at: out.at, brief: out.brief || null, raw, errors: out.errors }, updated_at: now() });
  // email to Karin herself (her own morning digest, pre-approved)
  const b = out.brief; const base = "https://karinatar9-commits.github.io/hon-mishpachti/os/#glow-hub";
  if (b) {
    const body = `${b.headline}\n\n${(b.story || []).join("\n")}\n\n${(b.campaigns || []).length ? "📢 הקמפיינים\n" + b.campaigns.map((c: any) => `• ${c.name}: ${c.line}`).join("\n") + "\n\n" : ""}${b.social ? "📸 " + b.social + "\n\n" : ""}${(b.actions || []).length ? "✅ מה לעשות היום\n" + b.actions.map((a: string, i: number) => `${i + 1}. ${a}`).join("\n") + "\n\n" : ""}הכל במערכת: ${base}`;
    const d = new Date().toLocaleDateString("he-IL", { timeZone: "Asia/Jerusalem", day: "2-digit", month: "2-digit" });
    await db.from("os_actions").insert({ agent: "pa", type: "email", title: `Glow House · בוקר ${d}`, payload: { to: await ownerEmail(), subject: `${b.status === "alert" ? "⚠️ " : "✨ "}Glow House · ${b.headline}`.slice(0, 140), body }, status: "approved", decided_at: now() });
  }
  return { ok: !!b, errors: out.errors };
}


// ---------- Goldchain idea scout: every 48h, research + ideas + weekly corner, learns from Karin's votes ----------
async function ideasScout() {
  const s = await settings();
  const get = async (k: string) => (await db.from("os_settings").select("value").eq("key", k).maybeSingle()).data?.value;
  const prev: any = (await get("ideas_digest")) || {};
  const fb: any[] = ((await get("ideas_feedback")) || {}).items || [];
  const brief: any = (await db.from("os_briefs").select("answers").eq("agent", "biz").maybeSingle()).data?.answers || {};
  const lessons = (brief.goldchain_lessons || []).filter((l: any) => ["ideas", "orchestrator", "copywriting"].includes(l.skill)).map((l: any) => l.lesson);
  const lastCorner = prev.corner_at ? Date.parse(prev.corner_at) : 0;
  const wantCorner = Date.now() - lastCorner > 6 * 86400000;
  const kinds = ["tip", "mistake", "risk"]; const ck = kinds[(prev.corner_n || 0) % 3];
  const used = (prev.history || []).flatMap((h: any) => h.titles || []).slice(-40);
  const p = `את/ה סקאוט הרעיונות של Goldchain AI — העסק של קרין עטר: הטמעת סוכני AI ואוטומציות בתוך המערכות הקיימות של עסקים קטנים ובינוניים בישראל (כספים וגבייה, חשבוניות, לידים ומכירות, שירות, ייעול תפעולי — Morning, Priority, בנקים, וואטסאפ, Gmail, Sheets). המטרה שלה: להיכנס לעסק ולפתור לבעלים את הכאב הכי גדול שלו, ולהכניס סדר, שליטה והגנה. הנישה שלה (מיקוד מחייב): הצד הפיננסי של העסק — תזרים, גבייה, Priority, Morning, בנקים, פנסיה ומשכורות, מכרזים. כמעט אף יוצר לא מציג את עצמו כמי שמבין את הצד הזה; זה הבידול שלה. אסטרטגיית התוכן: לא סרטונים כלליים על יכולות AI (זה מה שאלפי יוצרים מעלים), אלא כאב אחד אמיתי מעסק אמיתי ואיך הוא נעלם. כל רעיון חייב להיות כאב פיננסי/תפעולי ספציפי של בעל עסק, עם התהליך לפני ואחרי. חדשות AI כלליות רק אם הן נוגעות לכספים, לבנקים, למערכות האלה או לרגולציה. הקהל: בעלי עסקים קטנים ובינוניים, עצמאים, מנהלי כספים ותפעול בישראל — לא טכנולוגיים, עמוסים, חשדניים כלפי הייפ.
מחקר (השתמש/י בחיפוש, עד 7 חיפושים, ממוקדים): 1) חדשות AI ואוטומציה מהיומיים האחרונים שרלוונטיות לעסקים קטנים (כלים חדשים, שינויים ב-OpenAI/Anthropic/Google/Meta/WhatsApp, רגולציה ופרטיות בישראל). 2) מתחרים ויוצרי תוכן בנישה (סוכנויות אוטומציה ו-AI לעסקים בישראל ובעולם, יוצרי אינסטגרם/לינקדאין/יוטיוב על אוטומציה לעסקים) — מה הם מפרסמים עכשיו ומה תופס. 3) כאבים אמיתיים של בעלי עסקים: שאלות בקבוצות, כתבות בגלובס/כלכליסט/TheMarker/ynet על עסקים קטנים, פורומים, Reddit (r/smallbusiness, r/automation).
אסור להמציא: כל עובדה עם מקור (קישור). אין לך גישה למספרי לייקים של מתחרים — אל תמציא/י מספרים; תאר/י מה בולט במילים. לא לחזור על רעיונות קודמים: ${JSON.stringify(used)}.
${lessons.length ? "כללים שקרין לימדה (חובה):\n- " + lessons.slice(-20).join("\n- ") : ""}
${fb.length ? "החלטות קודמות של קרין על רעיונות (למד/י מה עובד אצלה):\n" + fb.slice(-25).map((f: any) => `${f.vote === "up" ? "✔ בחרה" : "✘ פסלה"}: ${f.title}${f.why ? " — " + f.why : ""}`).join("\n") : ""}
${wantCorner ? `הפינה השבועית הקבועה השבוע: ${ck === "tip" ? "טיפ שבועי מעשי ל-AI בעסק" : ck === "mistake" ? "טעות נפוצה של מי שמתחיל להשתמש ב-AI בעסק" : "סיכון של שימוש ב-AI בלי הבנה (פרטיות, הזיות, הרשאות, תלות, עלויות)"} — כתוב/י אותה כטקסט מוכן לפוסט/קרוסלה, עם דוגמה מעסק ישראלי ומה לעשות במקום.` : ""}
כתוב/י בעברית פשוטה, מספרים בתוך משפטים. החזר/י JSON תקין בלבד, בלי מירכאות כפולות בתוך הטקסט:
{"headline":"משפט אחד — מה הכי חשוב היום","news":[{"title":"","why":"למה זה חשוב לבעל עסק ולקרין","url":""}],"creators":[{"name":"יוצר/מתחרה","what":"מה פרסם","standout":"מה בולט ולמה זה עובד","url":""}],"pains":[{"pain":"הכאב במילים של בעל העסק","evidence":"איפה ראית","url":""}],"ideas":[{"title":"","format":"רילס|קרוסלה|פוסט לינקדאין|סטורי","hook":"משפט פתיחה","pain":"הכאב הפיננסי/תפעולי הספציפי","before":"איך זה נראה היום בעסק","after":"איך הכאב נעלם עם הסוכן","angle":"למה זה מתאים לקהל שלה","source":""}]${wantCorner ? `,"corner":{"type":"${ck}","title":"","body":"4-8 משפטים מוכנים לפרסום","cta":""}` : ""}}
עד 4 חדשות, עד 4 יוצרים, עד 4 כאבים, בדיוק 5 רעיונות.`;
  let d: any = null, err = "";
  for (let i = 0; i < 2 && !d; i++) { try { d = await claudeJSON(p, s.model, 7); } catch (e) { err = String((e as Error).message).slice(0, 200); } }
  if (!d) return { ok: false, error: err };
  d.ideas = (d.ideas || []).map((x: any, i: number) => ({ ...x, id: Date.now().toString(36) + i }));
  const at = now();
  const val = { ...d, at, corner_at: d.corner ? at : prev.corner_at || null, corner_n: (prev.corner_n || 0) + (d.corner ? 1 : 0), corner_last: d.corner || prev.corner_last || null,
    history: [...(prev.history || []), { at, titles: (d.ideas || []).map((x: any) => x.title) }].slice(-10) };
  await db.from("os_settings").upsert({ key: "ideas_digest", value: val, updated_at: at });
  const L = (a: any[], f: (x: any) => string) => (a || []).map(f).join("\n");
  const body = `${d.headline}\n\n💡 5 רעיונות\n${L(d.ideas, (x) => `• ${x.title} (${x.format})\n  הוק: ${x.hook}\n  ${x.angle}`)}\n\n${d.corner ? `📌 הפינה השבועית — ${d.corner.title}\n${d.corner.body}\n${d.corner.cta || ""}\n\n` : ""}📰 מה חדש\n${L(d.news, (x) => `• ${x.title} — ${x.why} ${x.url || ""}`)}\n\n👀 מה קורה אצל היוצרים\n${L(d.creators, (x) => `• ${x.name}: ${x.what} — ${x.standout} ${x.url || ""}`)}\n\n😣 מה כואב לבעלי עסקים\n${L(d.pains, (x) => `• ${x.pain} (${x.evidence}) ${x.url || ""}`)}\n\nלבחור ולפסול רעיונות (והסוכן לומד): https://karinatar9-commits.github.io/hon-mishpachti/os/#ideas`;
  await db.from("os_actions").insert({ agent: "biz", type: "email", title: "Goldchain · רעיונות", payload: { to: await ownerEmail(), subject: `💡 Goldchain · ${d.headline}`.slice(0, 140), body }, status: "approved", decided_at: at });
  return { ok: true, ideas: d.ideas.length, corner: !!d.corner };
}

// ---------- renderer API (GitHub Actions, OIDC) ----------
async function renderApi(body: any) {
  const s = await settings();
  if (body.mode === "render_next") {
    if (HF_KEY) await pollClips();
    const stale = new Date(Date.now() - 25 * 60000).toISOString();
    const { data: list } = await db.from("os_videos").select("*").or(`status.eq.queued,and(status.eq.rendering,claimed_at.lt.${stale})`).order("updated_at").limit(1);
    const v = list?.[0]; if (!v) return json({ job: null });
    const version = (v.version || 0) + 1;
    await db.from("os_videos").update({ status: "rendering", claimed_at: now(), version, updated_at: now() }).eq("id", v.id);
    const kit = (s.main.brandKit || {})[v.account] || {};
    if (kit.accent) v.script.palette = { bg1: kit.bg1, bg2: kit.bg2, accent: kit.accent, text: kit.text || "#ffffff" };
    return json({ job: { id: v.id, version, format: v.format, account: v.account, script: v.script, ref_url: v.ref_url || "", clone: !!(EL_KEY && s.main.voiceId), voice: !!v.voice, voice_name: s.main.voiceName || "he-IL-HilaNeural", cta: kit.cta || "", brand: v.account === "glow" ? "Glow House" : "Karin Atar", handle: v.account === "glow" ? (s.main.handleGlow || "") : (s.main.handleKarin || "") } });
  }
  if (body.mode === "tts") {          // one scene of narration in the cloned voice; the key never leaves this function
    if (!EL_KEY || !s.main.voiceId) return json({ url: null });
    const { data: v } = await db.from("os_videos").select("script,version").eq("id", body.id).single();
    const text = String(v?.script?.scenes?.[+body.i]?.vo || "").slice(0, 600).trim();
    if (!text) return json({ url: null });
    const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(s.main.voiceId)}?output_format=mp3_44100_128`, { method: "POST", headers: { "xi-api-key": EL_KEY, "content-type": "application/json" },
      body: JSON.stringify({ text, model_id: s.main.voiceModel || "eleven_v3", language_code: "he", voice_settings: { stability: s.main.voiceStability ?? 0.5, similarity_boost: 0.85, style: 0.35, use_speaker_boost: true } }) });
    if (!r.ok) return json({ url: null, error: (await r.text()).slice(0, 200) });
    const path = `videos/${body.id}/vo${+body.i}.mp3`;
    const up = await db.storage.from(BUCKET).upload(path, new Uint8Array(await r.arrayBuffer()), { contentType: "audio/mpeg", upsert: true });
    if (up.error) return json({ url: null, error: up.error.message });
    return json({ url: db.storage.from(BUCKET).getPublicUrl(path).data.publicUrl + `?v=${Date.now()}` });
  }
  if (body.mode === "render_upload") {
    const base = `videos/${body.id}/v${body.version}`;
    const b = await db.storage.from(BUCKET).createSignedUploadUrl(base + ".jpg", { upsert: true });
    if (b.error) return json({ error: b.error.message }, 500);
    if (body.slides) {
      const urls: string[] = [];
      for (let i = 0; i < Math.min(10, +body.slides); i++) { const x = await db.storage.from(BUCKET).createSignedUploadUrl(`${base}-s${i + 1}.jpg`, { upsert: true }); if (x.error) return json({ error: x.error.message }, 500); urls.push(x.data.signedUrl); }
      return json({ slides: urls, cover: b.data.signedUrl });
    }
    const a = await db.storage.from(BUCKET).createSignedUploadUrl(base + ".mp4", { upsert: true });
    if (a.error) return json({ error: a.error.message }, 500);
    return json({ video: a.data.signedUrl, cover: b.data.signedUrl });
  }
  if (body.mode === "render_done") {
    const base = `videos/${body.id}/v${body.version}`;
    const pu = (p: string) => db.storage.from(BUCKET).getPublicUrl(p).data.publicUrl;
    const t = `?v=${Date.now()}`;
    const upd: any = { status: "review", cover_url: pu(base + ".jpg") + t, error: body.warn ? String(body.warn).slice(0, 300) : null, updated_at: now() };
    if (body.slides) { upd.slides = Array.from({ length: Math.min(10, +body.slides) }, (_, i) => pu(`${base}-s${i + 1}.jpg`)); upd.video_url = upd.slides[0]; }
    else upd.video_url = pu(base + ".mp4");
    await db.from("os_videos").update(upd).eq("id", body.id);
    return json({ ok: true });
  }
  if (body.mode === "render_fail") {
    await db.from("os_videos").update({ status: "failed", error: "הרינדור נכשל: " + String(body.error || "").slice(0, 400), updated_at: now() }).eq("id", body.id);
    return json({ ok: true });
  }
  return json({ error: "unknown mode" }, 400);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const body = await req.json().catch(() => ({}));
    const oidc = req.headers.get("x-gh-oidc");
    if (oidc) {
      const { payload } = await jwtVerify(oidc, JWKS, { issuer: "https://token.actions.githubusercontent.com", audience: "karin-os-render" });
      if (payload.repository !== REPO) return json({ error: "forbidden" }, 403);
      return await renderApi(body);
    }
    const ck = req.headers.get("x-cron-key");
    if (ck) {
      const s = await settings();
      if (!s.cron || ck !== s.cron) return json({ error: "forbidden" }, 403);
      if (body.mode === "daily") { if (!AKEY) return json({ error: "no_key" }, 400); bg(dailyPlan(!!body.force).then((r) => console.log("daily", JSON.stringify(r)))); return json({ ok: true }); }
      if (body.mode === "script_one") { await db.from("os_videos").update({ status: "scripting" }).eq("id", body.id).eq("status", "scripting"); bg(scriptJob(String(body.id))); return json({ ok: true }); }
      if (body.mode === "status") return json({ claude: !!AKEY, meta: !!META, metaGlow: !!META_GLOW, higgsfield: !!HF_KEY });
      if (body.mode === "glow_daily") { const r = await glowDaily(); return json(r); }
      if (body.mode === "tts_text") return await ttsText(body);
      if (body.mode === "el_voices") { if (!EL_KEY) return json({ error: "no_eleven_key" }, 400); const r = await fetch("https://api.elevenlabs.io/v1/voices", { headers: { "xi-api-key": EL_KEY } }); const j = await r.json().catch(() => ({})); return json({ status: r.status, voices: (j.voices || []).filter((v: any) => v.category !== "premade").map((v: any) => ({ id: v.voice_id, name: v.name, category: v.category })) }); }
      if (body.mode === "lia") { if (!AKEY) return json({ error: "no_key" }, 400); bg(liaDaily(!!body.force).then((r) => console.log("lia", JSON.stringify(r)))); return json({ ok: true }); }
      if (body.mode === "ideas") { if (!AKEY) return json({ error: "no_key" }, 400); bg(ideasScout().then((r) => console.log("ideas", JSON.stringify(r)))); return json({ ok: true }); }
      // read-only: results of chosen campaigns split by age and gender (lifetime)
      if (body.mode === "ads_breakdown") {
        const tok = META_GLOW || META; if (!tok) return json({ error: "no_meta" }, 400);
        const out: any = {};
        for (const id of (body.campaigns || []).slice(0, 10)) {
          try { out[id] = ((await graph(`${id}/insights?date_preset=maximum&breakdowns=age,gender&fields=campaign_name,spend,actions&limit=100`, tok)).data || []).map((x: any) => ({ c: x.campaign_name, age: x.age, g: x.gender, spend: +x.spend || 0, conv: +((x.actions || []).find((a: any) => a.action_type === "onsite_conversion.messaging_conversation_started_7d")?.value || 0) })); }
          catch (e) { out[id] = { error: String((e as Error).message).slice(0, 200) }; }
        }
        await db.from("os_settings").upsert({ key: "meta_breakdown", value: { at: now(), out }, updated_at: now() });
        return json({ ok: true });
      }
      // Build one campaign in Glow House's ad account, everything PAUSED (nothing is spent until Karin turns it on in Ads Manager).
      // The ad set is copied from the best ad set the account ever had, so WhatsApp destination, page and placements stay as they were.
      if (body.mode === "ads_build") {
        const tok = META_GLOW; if (!tok) return json({ error: "no_meta_glow" }, 400);
        const b = body.spec || {}; const log: any[] = []; const out: any = { at: now(), log };
        const post = async (path: string, params: Record<string, unknown>) => {
          const f = new URLSearchParams(); for (const [k, v] of Object.entries(params)) if (v !== undefined) f.set(k, typeof v === "string" ? v : JSON.stringify(v));
          f.set("access_token", tok);
          const r = await fetch(`${G}/${path}`, { method: "POST", body: f }); const j = await r.json();
          if (j.error) throw new Error(`${path}: ${j.error.error_user_msg || j.error.message}`); return j;
        };
        const step = async (name: string, fn: () => Promise<any>) => { try { const r = await fn(); log.push({ step: name, ok: true }); return r; } catch (e) { log.push({ step: name, ok: false, error: String((e as Error).message).slice(0, 400) }); throw e; } };
        // several primary texts / headlines on one ad, so Meta picks the best mix (Avinoam's rule, 26.11.2026)
        const feed = (Array.isArray(b.texts) && b.texts.length > 1) || (Array.isArray(b.headlines) && b.headlines.length > 1)
          ? { bodies: (b.texts || [b.text]).slice(0, 5).map((t: string) => ({ text: String(t) })), titles: (b.headlines || [b.headline]).slice(0, 5).map((t: string) => ({ text: String(t) })),
              call_to_actions: [{ type: "WHATSAPP_MESSAGE", value: { app_destination: "WHATSAPP" } }], additional_data: { is_click_to_message: true }, optimization_type: "DEGREES_OF_FREEDOM" } : undefined;
        const welcome = b.greeting ? { type: "VISUAL_EDITOR", version: 2, landing_screen_type: "welcome_message", media_type: "text",
          text_format: { customer_action_type: "autofill_message", message: { text: String(b.greeting).slice(0, 600), autofill_message: { content: String(b.prefill || "").slice(0, 300) } } } } : undefined;
        const makeCreative = async (act: string) => {
          const vid = b.video_id ? { id: String(b.video_id) } : await step("video_upload", () => post(`${act}/advideos`, { file_url: b.video_url, name: b.name }));
          out.video_id = vid.id;
          let thumb = "";
          for (let i = 0; i < 20 && !thumb; i++) { if (i || !b.video_id) await new Promise((r) => setTimeout(r, 4000)); try { const th = await graph(`${vid.id}/thumbnails?fields=uri,is_preferred`, tok); thumb = (th.data || []).find((x: any) => x.is_preferred)?.uri || th.data?.[0]?.uri || ""; } catch { /* still processing */ } }
          if (!thumb) throw new Error("הסרטון עדיין בעיבוד אצל מטא — להריץ שוב בעוד כמה דקות");
          const texts = (b.texts || [b.text]); const heads = (b.headlines || [b.headline]);
          return await step("creative", () => post(`${act}/adcreatives`, { name: b.name, object_story_spec: { page_id: b.page_id, instagram_user_id: b.ig_id, video_data: { video_id: vid.id, image_url: thumb, message: texts[0], title: heads[0], call_to_action: { type: "WHATSAPP_MESSAGE", value: { app_destination: "WHATSAPP" } } } }, asset_feed_spec: feed, page_welcome_message: welcome }));
        };
        try {
          const act = `act_${b.account}`;
          if (b.test_creative) { const cr = await makeCreative(act); out.creative_id = cr.id; out.ok = true; out.test = true; await db.from("os_settings").upsert({ key: "glow_campaign_build", value: out, updated_at: now() }); return json(out); }
          const camp = b.campaign_id ? { id: b.campaign_id } : await step("campaign", () => post(`${act}/campaigns`, { name: b.name, objective: "OUTCOME_ENGAGEMENT", status: "PAUSED", special_ad_categories: [], buying_type: "AUCTION", is_adset_budget_sharing_enabled: false }));
          out.campaign_id = camp.id;
          // settings of the best ad set ever (read only), reused for the new one
          const old = await graph(`${b.from_adset}?fields=targeting,optimization_goal,billing_event,destination_type,promoted_object,bid_strategy`, tok);
          let geo = old.targeting?.geo_locations;
          if (b.lat && b.lng) { geo = { custom_locations: [{ latitude: b.lat, longitude: b.lng, radius: b.radius || 15, distance_unit: "kilometer" }], location_types: ["home", "recent"] }; out.city = `${b.lat},${b.lng} +${b.radius || 15}km`; }
          else if (b.city) {
            const g = await graph(`search?type=adgeolocation&location_types=["city"]&q=${encodeURIComponent(b.city)}&country_code=IL&limit=5`, tok);
            const c = (g.data || [])[0]; if (c) { geo = { cities: [{ key: c.key, radius: b.radius || 15, distance_unit: "kilometer" }], location_types: ["home", "recent"] }; out.city = c.name; }
          }
          // placements left automatic (Advantage+): the old list includes positions Meta no longer accepts
          const t: any = { ...old.targeting, age_min: b.age_min, age_max: b.age_max, genders: [2], geo_locations: geo };
          for (const k of ["publisher_platforms", "facebook_positions", "instagram_positions", "messenger_positions", "audience_network_positions", "whatsapp_positions", "threads_positions", "device_platforms"]) delete t[k];
          const as = await step("adset", () => post(`${act}/adsets`, { name: b.adset_name, campaign_id: camp.id, status: "PAUSED", daily_budget: b.daily_budget, targeting: t,
            optimization_goal: old.optimization_goal || "CONVERSATIONS", billing_event: old.billing_event || "IMPRESSIONS", destination_type: old.destination_type || "WHATSAPP",
            promoted_object: { page_id: b.page_id }, bid_strategy: old.bid_strategy || "LOWEST_COST_WITHOUT_CAP", attribution_spec: [{ event_type: "CLICK_THROUGH", window_days: 1 }] }));
          const adset = as.id; out.adset_id = adset;
          const cr = await makeCreative(act);
          out.creative_id = cr.id;
          const ad = await step("ad", () => post(`${act}/ads`, { name: b.ad_name, adset_id: adset, creative: { creative_id: cr.id }, status: "PAUSED" }));
          out.ad_id = ad.id; out.ok = true;
        } catch (e) { out.ok = false; out.error = String((e as Error).message).slice(0, 400); }
        await db.from("os_settings").upsert({ key: "glow_campaign_build", value: out, updated_at: now() });
        return json(out);
      }
      // Glow House: a second campaign that sends people straight to the booking page (no WhatsApp step). Karin asked 19.11.2026
      // after 11 WhatsApp conversations brought no tan booking. Targeting + budget copied from the live ad set of body.from_campaign.
      // Everything is created PAUSED; nothing is spent until Karin turns it on.
      if (body.mode === "ads_build_link") {
        const tok = META_GLOW; if (!tok) return json({ error: "no_meta_glow" }, 400);
        const b = body.spec || {}; const log: any[] = []; const out: any = { at: now(), log };
        const post = async (path: string, params: Record<string, unknown>) => {
          const f = new URLSearchParams(); for (const [k, v] of Object.entries(params)) if (v !== undefined) f.set(k, typeof v === "string" ? v : JSON.stringify(v));
          f.set("access_token", tok); const j = await (await fetch(`${G}/${path}`, { method: "POST", body: f })).json();
          if (j.error) throw new Error(`${path}: ${j.error.error_user_msg || j.error.message}`); return j;
        };
        const step = async (name: string, fn: () => Promise<any>) => { try { const r = await fn(); log.push({ step: name, ok: true }); return r; } catch (e) { log.push({ step: name, ok: false, error: String((e as Error).message).slice(0, 400) }); throw e; } };
        try {
          const src = ((await graph(`${GLOW.act}/adsets?fields=name,campaign{name,daily_budget},effective_status,targeting,daily_budget&limit=50`, tok)).data || [])
            .find((a: any) => a.campaign?.name === String(b.from_campaign || "") && a.effective_status === "ACTIVE");
          if (!src) throw new Error("source ad set not found");
          const t: any = { ...src.targeting, targeting_automation: { advantage_audience: 0 } };
          const budget = b.daily_budget || src.daily_budget || src.campaign?.daily_budget;
          const camp = b.campaign_id ? { id: b.campaign_id } : await step("campaign", () => post(`${GLOW.act}/campaigns`, { name: b.name, objective: "OUTCOME_TRAFFIC", status: "PAUSED", special_ad_categories: [], buying_type: "AUCTION", is_adset_budget_sharing_enabled: false }));
          out.campaign_id = camp.id;
          const as = await step("adset", () => post(`${GLOW.act}/adsets`, { name: b.adset_name || b.name, campaign_id: camp.id, status: "PAUSED", daily_budget: budget, targeting: t,
            optimization_goal: "LINK_CLICKS", billing_event: "IMPRESSIONS", destination_type: "WEBSITE", bid_strategy: "LOWEST_COST_WITHOUT_CAP" }));
          out.adset_id = as.id; out.daily_budget = budget;
          const vid = await step("video_upload", () => post(`${GLOW.act}/advideos`, { file_url: b.video_url, name: b.name }));
          out.video_id = vid.id;
          let thumb = "";
          for (let i = 0; i < 20 && !thumb; i++) { await new Promise((r) => setTimeout(r, 4000)); try { const th = await graph(`${vid.id}/thumbnails?fields=uri,is_preferred`, tok); thumb = (th.data || []).find((x: any) => x.is_preferred)?.uri || th.data?.[0]?.uri || ""; } catch { /* processing */ } }
          if (!thumb) throw new Error("video still processing — run again in a few minutes");
          const cr = await step("creative", () => post(`${GLOW.act}/adcreatives`, { name: b.name, object_story_spec: { page_id: GLOW.page, instagram_user_id: GLOW.ig,
            video_data: { video_id: vid.id, image_url: thumb, message: b.text, title: b.headline, link_description: b.description, call_to_action: { type: "BOOK_NOW", value: { link: b.link } } } } }));
          out.creative_id = cr.id;
          const ad = await step("ad", () => post(`${GLOW.act}/ads`, { name: b.ad_name || b.name, adset_id: as.id, creative: { creative_id: cr.id }, status: "PAUSED" }));
          out.ad_id = ad.id; out.ok = true;
        } catch (e) { out.ok = false; out.error = String((e as Error).message).slice(0, 400); }
        await db.from("os_settings").upsert({ key: "glow_link_build", value: out, updated_at: now() });
        return json(out);
      }
      // read-only: lead quality of the running Glow House campaigns (where the conversations come from, and how many people kept talking)
      // speech-to-text for a short recording Karin shares (ElevenLabs Scribe); result kept in os_settings 'stt_last'
      if (body.mode === "stt") {
        if (!EL_KEY) return json({ error: "no_el" }, 400);
        const a = await fetch(String(body.url)); if (!a.ok) return json({ error: "fetch " + a.status }, 400);
        const fd = new FormData(); fd.append("model_id", "scribe_v1"); fd.append("language_code", "he"); fd.append("diarize", "true"); fd.append("file", new Blob([await a.arrayBuffer()], { type: "audio/mpeg" }), "a.mp3");
        const r = await fetch("https://api.elevenlabs.io/v1/speech-to-text", { method: "POST", headers: { "xi-api-key": EL_KEY }, body: fd }); const j = await r.json();
        const words = (j.words || []).filter((w: any) => w.type === "word"); let out = "", sp = "";
        for (const w of words) { if (w.speaker_id !== sp) { sp = w.speaker_id; out += `\n[${sp} ${Math.round(w.start)}s] `; } out += w.text + " "; }
        await db.from("os_settings").upsert({ key: "stt_last", value: { at: now(), status: r.status, text: j.text || null, by_speaker: out.trim(), error: j.detail || null }, updated_at: now() });
        return json({ ok: r.ok });
      }
      // Glow House ad set: narrow ages and/or placements on one named ad set (Karin asked 18.11.2026 to fix the tan campaign). dry:true only reads.
      // Pause or resume one Glow House campaign by its exact name. Only campaigns whose name starts with "Glow OS" (ours) —
      // never the campaigns run by the agency.
      if (body.mode === "ads_campaign_status") {
        const tok = META_GLOW; if (!tok) return json({ error: "no_meta_glow" }, 400);
        const name = String(body.campaign || ""); const status = body.status === "ACTIVE" ? "ACTIVE" : "PAUSED";
        if (!name.startsWith("Glow OS")) return json({ error: "only Glow OS campaigns" }, 400);
        const camps = ((await graph(`${GLOW.act}/campaigns?fields=name,effective_status&limit=100`, tok)).data || []).filter((c: any) => c.name === name);
        if (!camps.length) return json({ error: "campaign not found" }, 404);
        const out: any = { at: now(), status, done: [] };
        for (const c of camps) {
          const f = new URLSearchParams({ status, access_token: tok });
          const j = await (await fetch(`${G}/${c.id}`, { method: "POST", body: f })).json();
          out.done.push({ id: c.id, before: c.effective_status, ok: !!j.success, error: j.error?.message });
        }
        await db.from("os_settings").upsert({ key: "glow_campaign_status", value: out, updated_at: now() });
        return json(out);
      }
      if (body.mode === "ads_adset_tune") {
        const tok = META_GLOW; if (!tok) return json({ error: "no_meta_glow" }, 400);
        const sets = ((await graph(`${GLOW.act}/adsets?fields=name,campaign{name},effective_status,targeting&limit=50`, tok)).data || []).filter((a: any) => a.campaign?.name === String(body.campaign || "") && a.effective_status === "ACTIVE");
        const out: any = { at: now(), sets: [] };
        for (const a of sets) {
          const r: any = { id: a.id, name: a.name, before: a.targeting };
          const t = JSON.parse(JSON.stringify(a.targeting || {}));
          if (body.age_min) t.age_min = Number(body.age_min); if (body.age_max) t.age_max = Number(body.age_max);
          if (body.placements) { t.publisher_platforms = ["facebook", "instagram"]; t.facebook_positions = ["feed", "facebook_reels"]; t.instagram_positions = Array.isArray(body.ig_positions) ? body.ig_positions : ["stream", "reels"]; delete t.messenger_positions; delete t.audience_network_positions; }
          r.after = t;
          if (!body.dry) { try { const f = new URLSearchParams(); f.set("targeting", JSON.stringify(t)); f.set("access_token", tok); const j = await (await fetch(`${G}/${a.id}`, { method: "POST", body: f })).json(); if (j.error) throw new Error(j.error.error_user_msg || j.error.message); r.updated = true; } catch (e) { r.error = String((e as Error).message).slice(0, 400); } }
          out.sets.push(r);
        }
        await db.from("os_settings").upsert({ key: "glow_adset_tune", value: out, updated_at: now() });
        return json(out);
      }
      if (body.mode === "ads_budget") {
        // תקציב יומי לסדרות הפעילות של קמפיין Glow OS בלבד (בשקלים, 20–150)
        const tok = META_GLOW; if (!tok) return json({ error: "no_meta_glow" }, 400);
        const name = String(body.campaign || ""); const ils = Math.round(Number(body.daily_ils));
        if (!name.startsWith("Glow OS")) return json({ error: "only Glow OS campaigns" }, 400);
        if (!(ils >= 20 && ils <= 150)) return json({ error: "daily_ils must be 20-150" }, 400);
        const sets = ((await graph(`${GLOW.act}/adsets?fields=name,campaign{name},effective_status,daily_budget&limit=50`, tok)).data || []).filter((a: any) => a.campaign?.name === name && a.effective_status === "ACTIVE");
        const out: any = { at: now(), campaign: name, daily_ils: ils, sets: [] };
        for (const a of sets) {
          const r: any = { id: a.id, name: a.name, before: Math.round((+a.daily_budget || 0) / 100) };
          if (!body.dry) { try { const f = new URLSearchParams({ daily_budget: String(ils * 100), access_token: tok }); const j = await (await fetch(`${G}/${a.id}`, { method: "POST", body: f })).json(); if (j.error) throw new Error(j.error.error_user_msg || j.error.message); r.updated = true; } catch (e) { r.error = String((e as Error).message).slice(0, 400); } }
          out.sets.push(r);
        }
        await db.from("os_settings").upsert({ key: "glow_budget", value: out, updated_at: now() });
        return json(out);
      }
      if (body.mode === "ads_quality") {
        const tok = META_GLOW || META; if (!tok) return json({ error: "no_meta" }, 400);
        const out: any = { at: now() }; const rng = body.since ? `time_range={"since":"${String(body.since).slice(0, 10)}","until":"${now().slice(0, 10)}"}` : "date_preset=last_7d";
        const F = "campaign_name,campaign_id,spend,impressions,reach,clicks,actions,cost_per_action_type";
        const g = async (k: string, extra: string) => { try { out[k] = (await graph(`${GLOW.act}/insights?level=campaign&${rng}&fields=${F}${extra}&limit=200`, tok)).data || []; } catch (e) { out[k] = { error: String((e as Error).message).slice(0, 300) }; } };
        await g("total", "");
        try { out.ads = (await graph(`${GLOW.act}/insights?level=ad&${rng}&fields=campaign_name,ad_name,spend,impressions,reach,frequency,cpm,ctr,inline_link_click_ctr,actions,video_play_actions,video_p25_watched_actions,video_p50_watched_actions,video_p100_watched_actions,video_avg_time_watched_actions,video_thruplay_watched_actions&limit=100`, tok)).data || []; } catch (e) { out.ads = { error: String((e as Error).message).slice(0, 300) }; }
        await g("placement", "&breakdowns=publisher_platform,platform_position");
        await g("region", "&breakdowns=region");
        await g("age_gender", "&breakdowns=age,gender");
        await g("hour", "&breakdowns=hourly_stats_aggregated_by_advertiser_time_zone");
        try { out.ad_status = (await graph(`${GLOW.act}/ads?fields=name,effective_status,configured_status,issues_info,ad_review_feedback,campaign{name},creative{id,page_welcome_message}&effective_status=["ACTIVE","PENDING_REVIEW","DISAPPROVED","WITH_ISSUES","IN_PROCESS","PAUSED"]&limit=50`, tok)).data || []; } catch (e) { out.ad_status = { error: String((e as Error).message).slice(0, 300) }; }
        try { out.adsets = (await graph(`${GLOW.act}/adsets?fields=name,campaign{name},effective_status,targeting,daily_budget,destination_type&effective_status=["ACTIVE","PAUSED"]&limit=30`, tok)).data || []; } catch (e) { out.adsets = { error: String((e as Error).message).slice(0, 300) }; }
        await db.from("os_settings").upsert({ key: "meta_quality", value: out, updated_at: now() });
        return json({ ok: true });
      }
      // Click-to-WhatsApp ad: replace the opening message (greeting) and the message the customer sends, keeping everything else.
      // Creatives can't be edited, so a copy is made with page_welcome_message and the ad is pointed to it. Approved by Karin 17.11.2026.
      if (body.mode === "ads_welcome") {
        const tok = META_GLOW; if (!tok) return json({ error: "no_meta_glow" }, 400);
        const out: any = { at: now(), ads: [] };
        const post = async (path: string, params: Record<string, unknown>) => {
          const f = new URLSearchParams(); for (const [k, v] of Object.entries(params)) if (v !== undefined) f.set(k, typeof v === "string" ? v : JSON.stringify(v));
          f.set("access_token", tok); const j = await (await fetch(`${G}/${path}`, { method: "POST", body: f })).json();
          if (j.error) throw new Error(`${path}: ${j.error.error_user_msg || j.error.message}`); return j;
        };
        const camp = String(body.campaign || "");
        const ads = ((await graph(`${GLOW.act}/ads?fields=id,name,effective_status,campaign{name},creative{id,name,object_story_spec,page_welcome_message,effective_object_story_id}&limit=50`, tok)).data || [])
          .filter((a: any) => a.campaign?.name === camp && ["ACTIVE", "PAUSED", "IN_PROCESS", "PENDING_REVIEW"].includes(a.effective_status));
        const welcome = { type: "VISUAL_EDITOR", version: 2, landing_screen_type: "welcome_message", media_type: "text",
          text_format: { customer_action_type: "autofill_message", message: { text: String(body.greeting || "").slice(0, 600), autofill_message: { content: String(body.prefill || "").slice(0, 300) } } } };
        for (const a of ads) {
          const r: any = { ad: a.id, name: a.name, old_creative: a.creative?.id, old_welcome: a.creative?.page_welcome_message || null };
          try {
            const story = body.use_story && a.creative?.effective_object_story_id; const spec = a.creative?.object_story_spec; if (!spec && !story) throw new Error("no object_story_spec"); const vd = spec?.video_data; if (vd?.image_url && vd?.image_hash) delete vd.image_hash;
            const nm = `${a.creative.name || a.name} · welcome ${now().slice(0, 10)}`;
            const cr = story ? await post(`${GLOW.act}/adcreatives`, { name: nm, object_story_id: a.creative.effective_object_story_id, page_welcome_message: welcome }) : await post(`${GLOW.act}/adcreatives`, { name: nm, object_story_spec: spec, page_welcome_message: welcome });
            r.new_creative = cr.id;
            if (!body.dry) { await post(a.id, { creative: { creative_id: cr.id } }); r.updated = true; }
          } catch (e) { r.error = String((e as Error).message).slice(0, 400); }
          out.ads.push(r);
        }
        await db.from("os_settings").upsert({ key: "glow_welcome_update", value: out, updated_at: now() });
        return json(out);
      }
      // read-only look at how the ad account is built (accounts, page, the settings of existing campaigns), kept for building the campaign screen
      if (body.mode === "ads_probe") {
        const tok = META_GLOW || META; if (!tok) return json({ error: "no_meta" }, 400);
        const out: any = { at: now() }; const tryG = async (k: string, path: string) => { try { out[k] = await graph(path, tok); } catch (e) { out[k] = { error: String((e as Error).message).slice(0, 300) }; } };
        await tryG("perms", "me/permissions");
        await tryG("pages", "me/accounts?fields=name,id,instagram_business_account{id,username},connected_instagram_account{id,username}&limit=20");
        await tryG("accounts", "me/adaccounts?fields=name,account_id,currency,account_status,timezone_name,min_daily_budget,spend_cap,amount_spent,funding_source_details,business{id,name}&limit=20");
        const acc = (out.accounts?.data || []).find((a: any) => +a.amount_spent > 0) || (out.accounts?.data || [])[0];
        if (acc) {
          const A = `act_${acc.account_id}`;
          await tryG("campaigns", `${A}/campaigns?fields=name,objective,status,effective_status,buying_type,special_ad_categories,daily_budget,lifetime_budget,bid_strategy,created_time&limit=30`);
          await tryG("adsets", `${A}/adsets?fields=name,campaign_id,status,effective_status,optimization_goal,billing_event,bid_strategy,destination_type,promoted_object,daily_budget,lifetime_budget,targeting,attribution_spec,created_time&limit=40`);
          await tryG("ads", `${A}/ads?fields=name,adset_id,status,effective_status,creative{id,name,object_type,object_story_id,effective_object_story_id,instagram_user_id,call_to_action_type,object_story_spec,asset_feed_spec,body,title,video_id,image_hash}&limit=40`);
        }
        if (body.wa) { // read-only: which WhatsApp number the page sends ad conversations to
          for (const pg of (out.pages?.data || [])) {
            await tryG(`wa_${pg.id}`, `${pg.id}?fields=name,whatsapp_number,phone`);
            await tryG(`wa2_${pg.id}`, `${pg.id}?fields=whatsapp_business_account{id,name,phone_numbers{display_phone_number,verified_name,platform_type,status,quality_rating}}`);
          }
        }
        await db.from("os_settings").upsert({ key: "meta_probe", value: out, updated_at: now() });
        return json({ ok: true, keys: Object.keys(out) });
      }
      return json({ error: "unknown mode" }, 400);
    }
    const token = (req.headers.get("Authorization") || "").replace("Bearer ", "");
    const { data: u } = await db.auth.getUser(token);
    const email = u?.user?.email?.toLowerCase();
    const { data: fm } = await db.from("family_members").select("owner_id,role").eq("email", email || "-").maybeSingle();
    if (!fm || fm.owner_id !== "karin" || fm.role !== "admin" || !aalOk(token, u?.user)) return json({ error: "forbidden" }, 403);

    const m = body.mode;
    if (m === "status") return json({ claude: !!AKEY, meta: !!META, metaGlow: !!META_GLOW, higgsfield: !!HF_KEY, voice: true, render: true, clone: !!EL_KEY });
    const saveRef = async (id: string, img: unknown) => {      // picture Karin attached (sketch / screenshot) → storage, so Lia can read it
      const mm = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/.exec(String(img || ""));
      if (!mm || mm[2].length > 4_000_000) return;
      const bin = Uint8Array.from(atob(mm[2]), (c) => c.charCodeAt(0));
      const path = `refs/${id}.${mm[1] === "jpeg" ? "jpg" : mm[1]}`;
      const up = await db.storage.from(BUCKET).upload(path, bin, { contentType: "image/" + mm[1], upsert: true });
      if (!up.error) await db.from("os_videos").update({ ref_url: db.storage.from(BUCKET).getPublicUrl(path).data.publicUrl }).eq("id", id);
    };
    if (m === "create") {
      if (!AKEY) return json({ error: "no_key" }, 400);
      const row = { account: body.account === "glow" ? "glow" : "karin", topic: String(body.topic || "").slice(0, 2000), notes: String(body.notes || "").slice(0, 2000) || null, style: body.style === "mixed" ? "mixed" : "explainer", format: body.format === "carousel" ? "carousel" : "reel", length_s: Math.min(90, Math.max(10, +body.length_s || 30)), voice: !!body.voice && body.format !== "carousel" };
      if (!row.topic) return json({ error: "חסר נושא" }, 400);
      const { data, error } = await db.from("os_videos").insert(row).select("id").single();
      if (error) return json({ error: error.message }, 500);
      if (body.image) await saveRef(data.id, body.image);
      bg(scriptJob(data.id));
      return json({ id: data.id });
    }
    if (m === "ask") {            // plain-language request: Lia decides topic angle, length and scenes
      if (!AKEY) return json({ error: "no_key" }, 400);
      const text = String(body.text || "").slice(0, 3000).trim() || (body.image ? "סרטון לפי התמונה המצורפת" : "");
      if (!text) return json({ error: "כתבי מה להכין" }, 400);
      const car = /קרוסל|מצגת|שקפים|פוסט תמונות/.test(text);
      const len = (text.match(/(\d{2})\s*שני/) || [])[1];
      const row = { account: /glow|גלואו|קליניק|רינת/i.test(text) ? "glow" : "karin", topic: text, style: !car && HF_KEY && !/בלי (קטעי|וידאו) ?ai/i.test(text) ? "mixed" : "explainer", format: car ? "carousel" : "reel", length_s: Math.min(90, Math.max(15, +len || 35)), voice: !car && !/בלי קריינות|בלי קול/.test(text), auto: true };
      const { data, error } = await db.from("os_videos").insert(row).select("id").single();
      if (error) return json({ error: error.message }, 500);
      if (body.image) await saveRef(data.id, body.image);
      bg(scriptJob(data.id));
      return json({ id: data.id });
    }
    if (m === "glow_daily_get") { const { data } = await db.from("os_settings").select("value").eq("key", "glow_daily").maybeSingle(); return json(data?.value || {}); }
    if (m === "glow_daily_now") { bg(glowDaily()); return json({ ok: true }); }
    if (m === "ideas_get") { const { data } = await db.from("os_settings").select("value").eq("key", "ideas_digest").maybeSingle(); const { data: f } = await db.from("os_settings").select("value").eq("key", "ideas_feedback").maybeSingle(); return json({ ...(data?.value || {}), history: undefined, votes: (f?.value?.items || []).slice(-60) }); }
    if (m === "guide_make") { if (!AKEY) return json({ error: "no_key" }, 400); return json(await guideJob({ videoId: body.id, topic: String(body.topic || "").slice(0, 2000) })); }
    if (m === "guide_list") { const { data } = await db.from("os_settings").select("key,value,updated_at").like("key", "guide\\_%").order("updated_at", { ascending: false }); return json({ guides: (data || []).map((r: any) => ({ slug: r.key.slice(6), title: r.value.title, keyword: r.value.keyword, active: r.value.active !== false, url: "https://goldchain-ai.com/" + r.key.slice(6) + "/", post: r.value.post || null, updated_at: r.updated_at })) }); }
    if (m === "guide_set") { const k = "guide_" + String(body.slug || "").replace(/[^a-z0-9-]/g, ""); const { data } = await db.from("os_settings").select("value").eq("key", k).maybeSingle(); if (!data) return json({ error: "not_found" }, 404);
      const v: any = { ...data.value }; if (typeof body.active === "boolean") v.active = body.active; if (body.post) v.post = String(body.post).slice(0, 300); if (body.keyword) v.keyword = String(body.keyword).slice(0, 40);
      await db.from("os_settings").update({ value: v, updated_at: now() }).eq("key", k); return json({ ok: true }); }
    if (m === "tts_text") return await ttsText(body);
    if (m === "el_voices") { if (!EL_KEY) return json({ error: "no_eleven_key" }, 400); // Karin's own (cloned) ElevenLabs voices
      const r = await fetch("https://api.elevenlabs.io/v1/voices", { headers: { "xi-api-key": EL_KEY } }); const j = await r.json().catch(() => ({}));
      return json({ status: r.status, voices: (j.voices || []).filter((v: any) => v.category !== "premade").map((v: any) => ({ id: v.voice_id, name: v.name, category: v.category })) }); }
    if (m === "ideas_now") { if (!AKEY) return json({ error: "no_key" }, 400); bg(ideasScout()); return json({ ok: true }); }
    if (m === "ideas_vote") {
      const { data: f } = await db.from("os_settings").select("value").eq("key", "ideas_feedback").maybeSingle();
      const items = (f?.value?.items || []).filter((x: any) => x.id !== body.id);
      items.push({ id: String(body.id || ""), title: String(body.title || "").slice(0, 200), vote: body.vote === "up" ? "up" : "down", why: String(body.why || "").slice(0, 400), at: now() });
      await db.from("os_settings").upsert({ key: "ideas_feedback", value: { items: items.slice(-80) }, updated_at: now() });
      if (body.why) await db.from("os_items").insert({ kind: "notes", data: { skill: "ideas", lesson: `${body.vote === "up" ? "רעיון שקרין בחרה" : "רעיון שקרין פסלה"} (${String(body.title || "").slice(0, 80)}): ${String(body.why).slice(0, 300)}`, by: "קרין" } });
      return json({ ok: true });
    }
    if (m === "daily_now") { if (!AKEY) return json({ error: "no_key" }, 400); bg(dailyPlan(true)); return json({ ok: true }); }
    if (m === "revise") {
      const fb = String(body.feedback || "").slice(0, 4000);
      const { data: v } = await db.from("os_videos").select("feedback").eq("id", body.id).single();
      await db.from("os_videos").update({ status: "revising", feedback: [...(v?.feedback || []), { at: now(), text: fb }], updated_at: now() }).eq("id", body.id);
      bg(scriptJob(body.id, fb));
      return json({ ok: true });
    }
    if (m === "save_script") {
      const sc = body.script; if (!sc || !Array.isArray(sc.scenes) || !sc.scenes.length) return json({ error: "תסריט ריק" }, 400);
      sc.scenes = sc.scenes.slice(0, 14).map((x: any) => ({ ...x, dur: Math.min(10, Math.max(1.5, +x.dur || 3.5)) }));
      await db.from("os_videos").update({ script: sc, caption: typeof body.caption === "string" ? body.caption : undefined, status: "queued", error: null, updated_at: now() }).eq("id", body.id);
      return json({ ok: true });
    }
    if (m === "lessons") { await db.from("os_settings").upsert({ key: "content_lessons", value: body.value || {}, updated_at: now() }); return json({ ok: true }); }
    if (m === "rerender") { await db.from("os_videos").update({ status: "queued", error: null, updated_at: now() }).eq("id", body.id); return json({ ok: true }); }
    if (m === "publish") {
      const { data: v } = await db.from("os_videos").select("status,video_url").eq("id", body.id).single();
      if (!v?.video_url || !["review", "failed"].includes(v.status)) return json({ error: "הסרטון לא מוכן לפרסום" }, 400);
      await db.from("os_videos").update({ status: "publishing", caption: typeof body.caption === "string" ? body.caption : undefined, error: null, updated_at: now() }).eq("id", body.id);
      bg(publishJob(body.id));
      return json({ ok: true });
    }
    if (m === "accounts") {
      const out: any = { karin: null, glow: null };
      for (const [k, t] of [["karin", META], ["glow", META_GLOW || META]] as const) {
        if (!t) continue;
        try { out[k] = (await graph("me/accounts?fields=name,id,instagram_business_account{id,username,followers_count}&limit=50", t)).data || []; } catch (e) { out[k] = { error: String((e as Error).message) }; }
      }
      return json(out);
    }
    if (m === "ads") {
      if (!META && !META_GLOW) return json({ error: "no_meta" }, 400);
      const acc: any[] = []; const seenA = new Set<string>();
      for (const tok of [META_GLOW, META].filter(Boolean)) {
        const list = (await graph("me/adaccounts?fields=name,account_id,currency,amount_spent,account_status&limit=10", tok)).data || [];
        for (const a of list.slice(0, 5)) {
          if (seenA.has(a.account_id)) continue; seenA.add(a.account_id);
          try { a.campaigns = (await graph(`act_${a.account_id}/insights?level=campaign&date_preset=last_30d&fields=campaign_name,spend,impressions,clicks,ctr,cpc,actions&limit=25`, tok)).data || []; } catch (e) { a.error = String((e as Error).message); }
          acc.push(a);
        }
      }
      return json({ accounts: acc });
    }
    if (m === "ads_lessons") {
      const { data } = await db.from("os_settings").select("value").eq("key", "meta_lessons").maybeSingle();
      return json(data?.value || {});
    }
    // Everything the ad accounts ever ran (lifetime), then a plain-language read of what worked and what did not.
    if (m === "ads_history") {
      if (!META && !META_GLOW) return json({ error: "no_meta" }, 400);
      const act = (x: any) => { const o: any = {}; for (const a of x.actions || []) if (/lead|messaging_conversation_started|link_click|landing_page_view/.test(a.action_type)) o[a.action_type.replace("onsite_conversion.", "")] = +a.value; return o; };
      const slim = (x: any) => ({ name: x.campaign_name, ad: x.ad_name, adset: x.adset_name, objective: x.objective, from: x.date_start, to: x.date_stop, spend: +x.spend || 0, impressions: +x.impressions || 0, reach: +x.reach || undefined, clicks: +x.clicks || 0, ctr: +(+x.ctr || 0).toFixed(2), cpc: +(+x.cpc || 0).toFixed(2), cpm: +(+x.cpm || 0).toFixed(2), results: act(x), text: x.text, title: x.title, cta: x.cta, targeting: x.targeting, goal: x.goal });
      const seen = new Set<string>(); const accounts: any[] = [];
      for (const tok of [META_GLOW, META].filter(Boolean)) {
        let acc: any[] = [];
        try { acc = (await graph("me/adaccounts?fields=name,account_id,currency,amount_spent&limit=20", tok)).data || []; } catch (e) { accounts.push({ name: "חשבון מודעות", error: String((e as Error).message) }); continue; }
        for (const a of acc.slice(0, 6)) {
          if (seen.has(a.account_id)) continue; seen.add(a.account_id);
          const row: any = { name: a.name, id: a.account_id, currency: a.currency, spent: (+a.amount_spent || 0) / 100 };
          try {
            const camps = (await graph(`act_${a.account_id}/insights?level=campaign&date_preset=maximum&fields=campaign_name,objective,spend,impressions,reach,clicks,ctr,cpc,cpm,actions,date_start,date_stop&limit=80`, tok)).data || [];
            const ads = ((await graph(`act_${a.account_id}/insights?level=ad&date_preset=maximum&fields=ad_id,ad_name,campaign_name,adset_name,spend,impressions,clicks,ctr,cpc,actions&limit=150`, tok)).data || []).sort((x: any, y: any) => (+y.spend || 0) - (+x.spend || 0)).slice(0, 30);
            // one small call per ad (the multi-id lookup is no longer supported): the ad's text and who it was aimed at
            let miss = 0;
            await Promise.all(ads.map(async (x: any) => { if (!x.ad_id) return; try {
              const c = await graph(`${x.ad_id}?fields=creative{body,title,call_to_action_type},adset{optimization_goal,targeting}`, tok);
              x.text = String(c.creative?.body || "").slice(0, 400); x.title = c.creative?.title; x.cta = c.creative?.call_to_action_type; const t = c.adset?.targeting || {};
              x.targeting = { age: [t.age_min, t.age_max], genders: t.genders, cities: (t.geo_locations?.cities || []).map((y: any) => y.name + (y.radius ? ` +${y.radius}km` : "")), regions: (t.geo_locations?.regions || []).map((y: any) => y.name), countries: t.geo_locations?.countries, custom: (t.custom_audiences || []).map((y: any) => y.name) }; x.goal = c.adset?.optimization_goal;
            } catch { miss++; } }));
            if (miss) row.note = `לא הצלחתי לקרוא נוסח וקהל של ${miss} מתוך ${ads.length} מודעות`;
            // who actually responded: results split by age and gender, and by region
            const seg = (x: any) => ({ age: x.age, gender: x.gender, region: x.region, spend: +x.spend || 0, impressions: +x.impressions || 0, clicks: +x.clicks || 0, results: act(x) });
            try { row.by_age_gender = ((await graph(`act_${a.account_id}/insights?date_preset=maximum&breakdowns=age,gender&fields=spend,impressions,clicks,actions&limit=100`, tok)).data || []).map(seg); } catch (e) { row.seg_note = String((e as Error).message).slice(0, 140); }
            try { row.by_region = ((await graph(`act_${a.account_id}/insights?date_preset=maximum&breakdowns=region&fields=spend,impressions,clicks,actions&limit=60`, tok)).data || []).map(seg).sort((x: any, y: any) => y.spend - x.spend).slice(0, 15); } catch { /* optional */ }
            row.campaigns = camps.map(slim); row.ads = ads.map(slim);
          } catch (e) { row.error = String((e as Error).message); }
          accounts.push(row);
        }
      }
      const has = accounts.some((a) => (a.campaigns || []).length);
      let lessons: any = null, lessonsError = "";
      if (has) {
        const s = await settings();
        try {
          lessons = await claudeJSON(`את מנהלת קמפיינים בכירה. לפנייך כל ההיסטוריה של חשבונות המודעות במטא (קמפיינים ומודעות, מצטבר לכל התקופה). נתחי אותה בעברית פשוטה, בלי ז'רגון, רק לפי המספרים שכאן. אל תמציאי נתונים. אם אין מספיק נתונים כדי לקבוע משהו — כתבי זאת.
החזירי JSON בלבד: {"summary":"3-4 משפטים: כמה הוצא, מה התקבל, ומה השורה התחתונה","worked":[{"what":"מה עבד (קמפיין/מודעה/קהל/נוסח)","numbers":"המספרים שמראים את זה","why":"למה כנראה"}],"failed":[{"what":"","numbers":"","why":""}],"segments":[{"who":"פלח (גיל/מגדר/אזור)","numbers":"הוצאה, שיחות ועלות לשיחה","verdict":"להגדיל / להשאיר / לצמצם ולמה"}],"rules":["כלל קצר לקמפיין הבא, נגזר מהנתונים"],"next":[{"name":"שם לקמפיין מוצע","goal":"מטרה","audience":"קהל","creative":"איזו מודעה","daily_budget":"תקציב יומי מוצע ולמה"}]}
עד 5 פריטים בכל רשימה (ב-segments עד 6). by_age_gender ו-by_region הם מי שהגיב בפועל; targeting הוא למי כוונה המודעה.
הנתונים:
${JSON.stringify(accounts).slice(0, 60000)}`, s.model);
        } catch (e) { lessonsError = String((e as Error).message).slice(0, 200); }
      }
      const value = { at: now(), accounts, lessons, lessonsError };
      await db.from("os_settings").upsert({ key: "meta_lessons", value, updated_at: now() });
      return json(value);
    }
    return json({ error: "unknown mode" }, 400);
  } catch (e) {
    return json({ error: String((e as Error)?.message || e) }, 500);
  }
});
