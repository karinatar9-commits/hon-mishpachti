// Goldchain guide gate: a lead leaves details -> saved to Karin OS leads, guide content returned (never in the page source),
// and a designed email with a personal link to the guide is sent (approved os_action; Karin approved auto-sending guide emails on 16.11).
import { createClient } from "jsr:@supabase/supabase-js@2";
const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (o: unknown, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });
const clean = (v: unknown, n: number) => String(v ?? "").replace(/[<>]/g, "").trim().slice(0, n);
const GUIDES: Record<string, string> = { assistant: "guide_assistant" };
const SITE = "https://goldchain-ai.com";
async function content(g: string) { const { data } = await db.from("os_settings").select("value").eq("key", GUIDES[g] || "guide_assistant").maybeSingle(); return data?.value || null; }
const esc = (s: string) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
function mailText(first: string, c: any, link: string) {
  return `היי ${first}!\n\nהמדריך "${c.title}" מחכה לך כאן:\n${link}\n\n${c.community ? "הקהילה בוואטסאפ: " + c.community + "\n\n" : ""}קרין · Goldchain AI`;
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
