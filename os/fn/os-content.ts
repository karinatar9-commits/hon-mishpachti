// Karin OS — content studio. Writes video scripts (Claude), orders AI clips (Higgsfield), plans the daily videos,
// hands jobs to the GitHub renderer (authenticated by GitHub OIDC), and publishes to
// Instagram only when Karin presses "אשר ופרסם" in the app.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { createRemoteJWKSet, jwtVerify } from "npm:jose@5";

const SB_URL = Deno.env.get("SUPABASE_URL")!;
const db = createClient(SB_URL, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
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

const SCHEMA = `החזר/י JSON בלבד (בלי טקסט מסביב) במבנה:
{"title":"...","palette":{"bg1":"#hex","bg2":"#hex","accent":"#hex","text":"#hex"},"handle":"@...",
 "scenes":[{"type":"title|point|stat|list|compare|quote|cta|ai|image","dur":3.5,"kicker":"","headline":"","body":"","emoji":"","value":"","items":[""],"left_title":"","right_title":"","left":[""],"right":[""],"prompt":""}],
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

async function scriptJob(id: string, feedback?: string) {
  const { data: v } = await db.from("os_videos").select("*").eq("id", id).single();
  try {
    const s = await settings();
    const mixed = v.style === "mixed";
    const car = v.format === "carousel";
    const kit = (s.main.brandKit || {})[v.account] || {};
    const les: string[] = (s.lessons[v.account] || []).concat(s.lessons.all || []);
    let p = `את/ה ליה — במאית תוכן ויוצרת רילסים ומצגות מובילה. ${car ? "בנה/י קרוסלה (מצגת) לאינסטגרם: 5-9 שקפים 4:5, כל שקף עומד בפני עצמו, השקף הראשון הוק שגורם להחליק, האחרון קריאה לפעולה. dur לא חשוב (3)." : `בנה/י סרטון הסבר אנכי (9:16) לאינסטגרם, טקסט על המסך עם אנימציה ${v.voice ? "וקריינות בעברית" : "(בלי קריינות)"}`}, שמסביר את הנושא בצורה מעניינת ומפתיעה — עובדה מפתיעה, מנגנון, דוגמה, טעות נפוצה, ומה לעשות.
${les.length ? "כללים שקרין לימדה אותך מהערות קודמות (חובה לשמור עליהם):\n- " + les.join("\n- ") : ""}
${kit.accent ? "העיצוב קבוע לפי ערכת המותג — אל תשנה/י צבעים." : ""}
מותג: ${BRAND[v.account](s.main)}
${v.auto ? "זו הבקשה של קרין במילים שלה (הבן/י ממנה את הנושא, הזווית, האורך והסגנון; אם ביקשה משהו מפורש — כבד/י אותו)" : "נושא"}: ${v.topic}
${v.notes ? "דגשים מקרין: " + v.notes : ""}
אורך: ${v.length_s} שניות.
${mixed && !car ? `שלב/י 1-3 סצנות type=ai: קטע וידאו AI קולנועי שממחיש רגע (בלי טקסט בתוך התמונה). ב-prompt כתוב/י באנגלית תיאור ויזואלי מפורט (נושא, תאורה, תנועת מצלמה), בלי אנשים מזוהים ובלי לוגואים. ב-headline כתוב/י את הטקסט שיופיע על הקטע.` : "אל תשתמש/י ב-type=ai."}
${v.voice && !car ? `קריינות: לכל סצנה הוסף/י שדה "vo" — משפט או שניים בעברית מדוברת וטבעית שהקריינית אומרת בזמן הסצנה (לא לקרוא את הכותרת מילה במילה; להסביר אותה). בלי אימוג'י, בלי סימנים מיוחדים, מספרים במילים, מונחים באנגלית לכתוב באותיות לטיניות. עד 22 מילים לסצנה. dur של כל סצנה = זמן הדיבור של ה-vo (בערך 2.6 מילים לשנייה) ועוד חצי שנייה.` : ""}
${SCHEMA.replace("LEN", String(v.length_s))}`;
    if (feedback) p += `\n\nזה התסריט הקודם:\n${JSON.stringify({ ...v.script, caption: v.caption })}\n\nההערות של קרין עליו (חובה ליישם את כולן, ולשמור את מה שלא העירה עליו):\n${feedback}\n\nבנוסף הוסף/י ל-JSON שדה "lessons": 0-3 כללים קצרים וכלליים שאפשר ללמוד מההערות האלה לכל הסרטונים הבאים (למשל "הוק בצורת שאלה", "לא יותר מ-12 מילים בשקף"). רק כללים שחלים גם על נושאים אחרים.`;
    if (v.ref_url) p += `\n\nקרין צירפה תמונה (שרטוט, צילום מסך או סקיצה עם הסבר). קרא/י אותה בעיון: מה שכתוב ומצויר בה הוא ההנחיה — המבנה, הסדר, המסרים והטקסטים שהיא רוצה. פתח/י את זה לסרטון מלא. אפשר לשלב עד 2 סצנות type=image שמציגות את התמונה שלה עצמה על המסך (רק אם היא ראויה להצגה לצופים, למשל צילום מסך או תרשים נקי; סקיצה בכתב יד — לא להציג).`;
    const sc = await claudeJSON(v.ref_url ? [{ type: "image", source: { type: "url", url: v.ref_url } }, { type: "text", text: p }] : p, s.model);
    if (!v.ref_url) (sc.scenes || []).forEach((x: any) => { if (x.type === "image") x.type = "point"; });
    sc.scenes = (sc.scenes || []).slice(0, 14).map((x: any) => ({ ...x, dur: Math.min(8, Math.max(2, +x.dur || 3.5)) }));
    if (car) sc.scenes.forEach((x: any) => { if (x.type === "ai") x.type = "point"; });
    // narration asked for but the writer skipped it on a scene: read the on-screen text instead of leaving silence
    if (v.voice && !car) sc.scenes.forEach((x: any) => { if (!String(x.vo || "").trim()) x.vo = [x.headline, x.body, ...(x.items || [])].filter(Boolean).join(". ").slice(0, 220); });
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
      const cap = Math.max(0, Math.min(3, +(v.source === "daily" ? (s.main.daily?.clips ?? 1) : 3)));
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
    if (v.format === "carousel") {
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

async function graph(path: string, tok: string) {
  const j = await (await fetch(`${G}/${path}${path.includes("?") ? "&" : "?"}access_token=${tok}`)).json();
  if (j.error) throw new Error(j.error.message);
  return j;
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
      body: JSON.stringify({ text, model_id: s.main.voiceModel || "eleven_v3", language_code: "he" }) });
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
      if (!META) return json({ error: "no_meta" }, 400);
      const acc = (await graph("me/adaccounts?fields=name,account_id,currency,amount_spent,account_status&limit=10", META)).data || [];
      for (const a of acc.slice(0, 5)) {
        try { a.campaigns = (await graph(`act_${a.account_id}/insights?level=campaign&date_preset=last_30d&fields=campaign_name,spend,impressions,clicks,ctr,cpc,actions&limit=25`, META)).data || []; } catch (e) { a.error = String((e as Error).message); }
      }
      return json({ accounts: acc });
    }
    return json({ error: "unknown mode" }, 400);
  } catch (e) {
    return json({ error: String((e as Error)?.message || e) }, 500);
  }
});
