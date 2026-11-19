// Goldchain guide gate: a lead leaves details -> saved to Karin OS leads, guide content returned (never in the page source),
// and a designed email with a personal link to the guide is sent (approved os_action; Karin approved auto-sending guide emails on 16.11).
import { createClient } from "jsr:@supabase/supabase-js@2";
const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
// Karin's address for notification emails lives in os_settings (key owner_email), not in this public code.
async function ownerEmail(): Promise<string> {
  const { data } = await db.from("os_settings").select("value").eq("key", "owner_email").maybeSingle();
  const e = String((data?.value as any)?.email || "");
  if (!e) console.error("os_settings.owner_email is missing");
  return e;
}
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (o: unknown, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });
const clean = (v: unknown, n: number) => String(v ?? "").replace(/[<>]/g, "").trim().slice(0, n);
// every guide lives in os_settings under key guide_<slug>; the site serves goldchain-ai.com/<slug> from one template
const slugOk = (g: string) => /^[a-z0-9-]{2,30}$/.test(g);
const SITE = "https://goldchain-ai.com";
async function content(g: string) { const { data } = await db.from("os_settings").select("value").eq("key", "guide_" + (slugOk(g) ? g : "assistant")).maybeSingle(); return data?.value || null; }
const esc = (s: string) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
function mailText(first: string, c: any, link: string) {
  return `היי ${first}!\n\nהמדריך "${c.title}" מחכה לך כאן:\n${link}\n\n${c.community ? "הקהילה בוואטסאפ: " + c.community + "\n\n" : ""}קרין · Goldchain AI`;
}
function mapMailHtml(first: string, link: string) {
  return `<!DOCTYPE html><html lang="he" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:24px 12px;background:#eef0f7;font-family:Arial,Helvetica,sans-serif" dir="rtl">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#070b1f;border-radius:16px" dir="rtl">
<tr><td style="padding:30px 32px 0;text-align:right;color:#f2b632;font-size:12px;letter-spacing:2px;font-weight:bold">GOLDCHAIN AI</td></tr>
<tr><td style="padding:20px 32px 0;text-align:right;color:#ffffff;font-size:24px;font-weight:bold">היי ${esc(first)}, מפת ההורדה שלך מוכנה</td></tr>
<tr><td style="padding:12px 32px 0;text-align:right;color:#b7bfdf;font-size:15px;line-height:1.7">לפי המשימות והשעות שסימנת במיפוי: מה יורד ראשון, מה הסוכן עושה בכל משימה ומה נשאר אצלך.</td></tr>
<tr><td style="padding:26px 32px 0;text-align:right">
<table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="border-radius:12px;background-color:#f2b632">
<a href="${esc(link)}" style="display:inline-block;padding:14px 30px;color:#1a1203;font-size:16px;font-weight:bold;text-decoration:none">לפתיחת המפה ←</a></td></tr></table></td></tr>
<tr><td style="padding:28px 32px 0"><div style="height:1px;background:#1e2547;line-height:1px">&nbsp;</div></td></tr>
<tr><td style="padding:16px 32px 28px;text-align:right;color:#7f88ad;font-size:12px;line-height:1.7">רוצה לעבור על המפה יחד? אפשר פשוט לענות למייל הזה.<br><a href="${SITE}" style="color:#39e0ff;text-decoration:none">goldchain-ai.com</a> · <a href="https://instagram.com/goldchain_ai" style="color:#39e0ff;text-decoration:none">@goldchain_ai</a></td></tr>
</table></td></tr></table></body></html>`;
}
function mailHtml(first: string, c: any, link: string) {
  const sub = c.subtitle || "3 שלבים, עם טקסט מוכן להעתקה ל-Claude, מהרעיון ועד עוזר אישי שמדבר איתך.";
  const wa = c.community ? `<tr><td style="padding:14px 0 0"><a href="${esc(c.community)}" style="display:inline-block;padding:11px 22px;border-radius:999px;border:1px solid #a78bfa;color:#e9e3ff;text-decoration:none;font-size:14px">💬 להצטרפות לקהילה בוואטסאפ</a></td></tr>` : "";
  return `<!DOCTYPE html><html lang="he" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:24px 12px;background:#f3f2f7;font-family:Arial,Helvetica,sans-serif" dir="rtl">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#0b0b14;border-radius:16px" dir="rtl">
<tr><td style="padding:30px 32px 0;text-align:right;color:#8b86a3;font-size:12px;letter-spacing:2px">GOLDCHAIN AI · BY KARIN</td></tr>
<tr><td style="padding:22px 32px 0;text-align:right;color:#ffffff;font-size:24px;font-weight:bold">היי ${esc(first)}! הנה המדריך שלך 🚀</td></tr>
<tr><td style="padding:12px 32px 0;text-align:right;color:#f5d77a;font-size:16px;font-weight:bold">${esc(c.title)}</td></tr>
<tr><td style="padding:10px 32px 0;text-align:right;color:#b9b4cc;font-size:14px;line-height:1.7">${esc(sub)}</td></tr>
<tr><td style="padding:26px 32px 0;text-align:right">
<table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="border-radius:10px;background-color:#c9a8f5;background-image:linear-gradient(90deg,#f5d77a,#a78bfa)">
<a href="${esc(link)}" style="display:inline-block;padding:14px 30px;color:#0b0b14;font-size:16px;font-weight:bold;text-decoration:none">לפתיחת המדריך ←</a></td></tr>${wa}</table></td></tr>
<tr><td style="padding:28px 32px 0"><div style="height:1px;background:#24223a;line-height:1px">&nbsp;</div></td></tr>
<tr><td style="padding:16px 32px 28px;text-align:right;color:#77728f;font-size:12px;line-height:1.7">רוצים שנבנה לכם את זה עד הסוף, מחובר למערכות שלכם? פשוט תענו למייל הזה.<br><a href="${SITE}" style="color:#a78bfa;text-decoration:none">goldchain-ai.com</a> · <a href="https://instagram.com/goldchain_ai" style="color:#a78bfa;text-decoration:none">@goldchain_ai</a></td></tr>
</table></td></tr></table></body></html>`;
}
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method" }, 405);
  try {
    const b = await req.json().catch(() => ({}));
    const g = clean(b.guide, 30) || "assistant";
    if (b.mode === "contact") { // consultation request from goldchain-ai.com → lead in Karin OS + a heads-up email to Karin
      if (b.website) return json({ error: "invalid" }, 400);
      const name = clean(b.name, 80), phone = clean(b.phone, 30).replace(/[^\d+\-\s]/g, ""), email = clean(b.email, 120).toLowerCase(), biz = clean(b.biz, 120), need = clean(b.need, 800);
      if (!name || (phone.replace(/\D/g, "").length < 9 && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email))) return json({ error: "invalid" }, 400);
      const at = new Date().toISOString();
      const map = /^[a-z]+:\d+(\.5)?(,[a-z]+:\d+(\.5)?){0,11}$/.test(String(b.map || "")) ? String(b.map) : "", mapLink = map ? `${SITE}/audit/?m=${map}` : "";
      await db.from("os_items").insert({ kind: "leads", data: { name, phone, email, company: biz, need, audit_map: mapLink || undefined, biz: "אישי", source: "אתר goldchain-ai.com · בקשת ייעוץ" + (clean(b.src, 30) ? " · " + clean(b.src, 30) : ""), source_type: "site", stage: "new", consent: b.consent === true, consent_at: b.consent === true ? at : null, by: "האתר" } });
      await db.from("os_actions").insert({ agent: "biz", type: "email", title: `פנייה חדשה מהאתר · ${name}`, payload: { to: await ownerEmail(), subject: `🔔 פנייה חדשה מהאתר · ${name}${biz ? " · " + biz : ""}`, body: `פנייה חדשה מ-goldchain-ai.com\n\nשם: ${name}\nטלפון: ${phone || "-"}\nמייל: ${email || "-"}\nעסק: ${biz || "-"}\n\nמה צריך:\n${need || "-"}${mapLink ? "\n\nמפת ההורדה שקיבל: " + mapLink : ""}\n\nהליד נשמר במערכת תחת לידים.` }, status: "approved", decided_at: at });
      if (mapLink && email) { const first = name.split(" ")[0]; await db.from("os_actions").insert({ agent: "biz", type: "email", title: `מפת הורדה לליד · ${first}`, payload: { to: email, from_name: "קרין | Goldchain AI", subject: "מפת ההורדה שלך מוכנה", body: `היי ${first}!\n\nמפת ההורדה שלך, לפי המיפוי שעשית באתר, מחכה כאן:\n${mapLink}\n\nרוצה לעבור עליה יחד? אפשר פשוט לענות למייל הזה.\n\nקרין · Goldchain AI`, html: mapMailHtml(first, mapLink) }, status: "approved", decided_at: at }); }
      return json({ ok: true });
    }
    if (b.mode === "audit_done") { // goldchain-ai.com/audit: anonymous count of finished task audits (no personal data)
      const day = new Date().toISOString().slice(0, 10), src = clean(b.src, 30) || "direct", h = Math.max(0, Math.min(80, Number(b.hours) || 0));
      const { data } = await db.from("os_settings").select("value").eq("key", "audit_stats").maybeSingle();
      const v: any = data?.value || { total: 0, hours: 0, days: {}, src: {}, tasks: {} };
      v.total = (v.total || 0) + 1; v.hours = (v.hours || 0) + h; v.days = v.days || {}; v.days[day] = (v.days[day] || 0) + 1; v.src = v.src || {}; v.src[src] = (v.src[src] || 0) + 1; v.tasks = v.tasks || {};
      for (const t of (Array.isArray(b.tasks) ? b.tasks : []).slice(0, 12)) { const k = clean(t, 12); if (/^[a-z]+$/.test(k)) v.tasks[k] = (v.tasks[k] || 0) + 1; }
      v.last = new Date().toISOString();
      await db.from("os_settings").upsert({ key: "audit_stats", value: v });
      return json({ ok: true });
    }
    if (b.mode === "wa_click") { // goldchain-ai.com/wa short link: count clicks per day/source (anonymous, no personal data)
      const src = clean(b.src, 30) || "direct", day = new Date().toISOString().slice(0, 10);
      const { data } = await db.from("os_settings").select("value").eq("key", "wa_clicks").maybeSingle();
      const v: any = data?.value || { total: 0, days: {}, src: {} };
      v.total = (v.total || 0) + 1; v.days = v.days || {}; v.days[day] = (v.days[day] || 0) + 1; v.src = v.src || {}; v.src[src] = (v.src[src] || 0) + 1; v.last = new Date().toISOString();
      await db.from("os_settings").upsert({ key: "wa_clicks", value: v });
      return json({ ok: true });
    }
    if (b.mode === "meta") { // public teaser only: titles, never the copy-paste texts
      if (!slugOk(g)) return json({ error: "guide" }, 404);
      const c: any = await content(g); if (!c || c.active === false) return json({ error: "guide" }, 404);
      return json({ ok: true, meta: { title: c.title, h1: c.h1, h2: c.h2, lead: c.lead, popup: c.popup, community: c.community, step_titles: (c.steps || []).map((s: any) => s.title) } });
    }
    if (b.mode === "get") {
      const tok = clean(b.token, 64); if (tok.length < 20) return json({ error: "token" }, 403);
      const { data } = await db.from("os_items").select("id").eq("kind", "leads").eq("data->>guide_token", tok).limit(1);
      if (!data?.length) return json({ error: "token" }, 403);
      return json({ ok: true, content: await content(g) });
    }
    if (b.website) return json({ error: "invalid" }, 400); // honeypot
    const first = clean(b.first, 60), last = clean(b.last, 60), email = clean(b.email, 120).toLowerCase();
    if (!first || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return json({ error: "invalid" }, 400);
    if (b.consent !== true) return json({ error: "consent" }, 400);
    const since = new Date(Date.now() - 3600e3).toISOString();
    const { count } = await db.from("os_items").select("id", { count: "exact", head: true }).eq("kind", "leads").eq("data->>source_type", "guide").gte("updated_at", since);
    if ((count || 0) > 40) return json({ error: "busy" }, 429);
    const c: any = await content(g);
    const at = new Date().toISOString();
    const { data: ex } = await db.from("os_items").select("id,data").eq("kind", "leads").eq("data->>email", email).limit(1);
    let token = crypto.randomUUID().replace(/-/g, "");
    let sendMail = true;
    if (ex && ex.length) {
      const d: any = ex[0].data || {};
      if (d.guide_token) token = d.guide_token;
      const sent = (d.guides_sent || []) as string[];
      sendMail = !sent.includes(g);
      await db.from("os_items").update({ data: { ...d, guide_token: token, source_type: d.source_type || "guide", guides: Array.from(new Set([...(d.guides || []), g])), guides_sent: sendMail ? [...sent, g] : sent, consent: true, consent_at: d.consent_at || at, last_seen: at }, updated_at: at }).eq("id", ex[0].id);
    } else {
      await db.from("os_items").insert({ kind: "leads", data: { name: `${first} ${last}`.trim(), first, last, email, biz: "אישי", source: "מדריך: " + (c?.title || g), source_type: "guide", guides: [g], guides_sent: [g], guide_token: token, stage: "new", consent: true, consent_at: at, by: "דף המדריך" } });
    }
    const link = `${SITE}/${g}/?t=${token}`;
    if (sendMail && c) await db.from("os_actions").insert({ agent: "biz", type: "email", title: `מדריך לליד · ${first}`, payload: { to: email, from_name: "קרין | Goldchain AI", subject: `המדריך שלך מוכן · ${c.title}`, body: mailText(first, c, link), html: mailHtml(first, c, link) }, status: "approved", decided_at: at });
    return json({ ok: true, token, content: c });
  } catch (e) { return json({ error: String(e).slice(0, 120) }, 500); }
});
