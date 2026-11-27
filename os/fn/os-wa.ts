// Karin OS — WhatsApp for Goldchain AI (via Green API).
// Two jobs: (1) scheduled messages to chats and groups that Karin writes and times in the app,
// sent one by one with random pauses so the number isn't flagged; (2) a small CRM per chat
// (tags, stage, notes, follow-up date) that fills itself from incoming messages.
// Nothing is sent unless Karin created the scheduled message in the app.
// Secrets (Supabase function secrets, never in this file): GREEN_GC_URL (apiUrl), GREEN_GC_ID, GREEN_GC_TOKEN.
// The webhook token lives in os_settings key "wa_hook" (readable only by Karin).
// @ts-nocheck
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const SB_URL = Deno.env.get("SUPABASE_URL")!;
const db = createClient(SB_URL, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const GURL = (Deno.env.get("GREEN_GC_URL") || "https://api.green-api.com").replace(/\/$/, "");
const GID = Deno.env.get("GREEN_GC_ID") || "";
const GTOK = Deno.env.get("GREEN_GC_TOKEN") || "";
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-key", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (o: unknown, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });
const now = () => new Date().toISOString();
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const PER_TICK = 10;          // messages per cron run (runs every minute)
const DAY_CAP = 150;          // hard daily cap on outgoing scheduled messages
const ready = () => !!(GID && GTOK);

function aalOk(token: string, user: any) {
  if (!(user?.factors || []).some((f: any) => f.status === "verified")) return true;
  try { let b = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"); b += "=".repeat((4 - b.length % 4) % 4); return JSON.parse(atob(b)).aal === "aal2"; } catch { return false; }
}
async function setting(key: string) { const { data } = await db.from("os_settings").select("value").eq("key", key).maybeSingle(); return data?.value; }
async function isCron(req: Request) { const k = req.headers.get("x-cron-key"); if (!k) return false; const v = await setting("cron_secret"); return !!v?.k && v.k === k; }
async function isKarin(req: Request) {
  const token = (req.headers.get("Authorization") || "").replace("Bearer ", "");
  if (!token) return false;
  const { data: u } = await db.auth.getUser(token);
  const email = u?.user?.email?.toLowerCase();
  if (!email) return false;
  const { data: fm } = await db.from("family_members").select("owner_id,role").eq("email", email).maybeSingle();
  return !!fm && fm.owner_id === "karin" && fm.role === "admin" && aalOk(token, u?.user);
}

async function green(method: string, body?: unknown) {
  const r = await fetch(`${GURL}/waInstance${GID}/${method}/${GTOK}`, body === undefined ? {} : { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const t = await r.text(); let j: any; try { j = JSON.parse(t); } catch { j = { raw: t.slice(0, 300) }; }
  if (!r.ok) throw new Error(`${method} ${r.status}: ${(j?.message || j?.raw || "").toString().slice(0, 200)}`);
  return j;
}
const isGroup = (id: string) => id.endsWith("@g.us");
const fill = (text: string, name: string) => text.replace(/\{שם\}|\{name\}/g, (name || "").split(" ")[0] || "");

// ---------- send what's due: one scheduled message at a time, a few targets per run ----------
async function tick() {
  if (!ready()) return { ok: false, error: "not_connected" };
  const since = new Date(Date.now() - 864e5).toISOString();
  const { data: day } = await db.from("wa_sched").select("results").gte("updated_at", since);
  let sentToday = 0; (day || []).forEach((r: any) => (r.results || []).forEach((x: any) => { if (x.ok && x.at >= since) sentToday++; }));
  const { data: rows } = await db.from("wa_sched").select("*").in("status", ["scheduled", "sending"]).lte("send_at", now()).order("send_at").limit(1);
  const row = rows?.[0]; if (!row) return { ok: true, idle: true };
  if (row.status === "scheduled") { const { data: c } = await db.from("wa_sched").update({ status: "sending", updated_at: now() }).eq("id", row.id).eq("status", "scheduled").select("id"); if (!c?.length) return { ok: true, raced: true }; }
  const targets = row.targets || [], results = [...(row.results || [])]; let done = row.done || 0, n = 0;
  while (done < targets.length && n < PER_TICK && sentToday < DAY_CAP) {
    const t = targets[done];
    try { const r = await green("sendMessage", { chatId: t.id, message: fill(row.text, t.name) }); results.push({ id: t.id, name: t.name, ok: true, msg: r.idMessage, at: now() }); sentToday++; }
    catch (e) { results.push({ id: t.id, name: t.name, ok: false, error: String(e.message || e).slice(0, 200), at: now() }); }
    done++; n++;
    await db.from("wa_sched").update({ done, results, updated_at: now() }).eq("id", row.id);
    if (done < targets.length) await sleep(4000 + Math.random() * 5000);   // human-like gap
  }
  const finished = done >= targets.length;
  const allFailed = finished && results.length && results.every((x: any) => !x.ok);
  await db.from("wa_sched").update({ status: finished ? (allFailed ? "failed" : "sent") : "sending", done, results, updated_at: now() }).eq("id", row.id);
  return { ok: true, id: row.id, done, of: targets.length, capped: sentToday >= DAY_CAP };
}

// ---------- pull chat and group names into the CRM ----------
async function sync() {
  if (!ready()) return { ok: false, error: "not_connected" };
  const list = await green("getContacts");
  const rows = (list || []).filter((c: any) => c.id && (c.type === "group" || c.type === "user") && !c.id.endsWith("@broadcast"))
    .map((c: any) => ({ chat_id: c.id, name: c.contactName || c.name || null, is_group: c.type === "group" || isGroup(c.id) }));
  const { data: have } = await db.from("wa_chats").select("chat_id,name");
  const named = new Map((have || []).map((r: any) => [r.chat_id, r.name]));
  const up = rows.filter((r: any) => !named.has(r.chat_id) || (!named.get(r.chat_id) && r.name));
  for (let i = 0; i < up.length; i += 500) await db.from("wa_chats").upsert(up.slice(i, i + 500).map((r: any) => ({ ...r, updated_at: now() })), { onConflict: "chat_id" });
  return { ok: true, total: rows.length, added: up.length };
}

// ---------- incoming notifications from Green API ----------
async function hook(req: Request) {
  const hk = await setting("wa_hook");
  const auth = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  if (!hk?.token || auth !== hk.token) return json({ error: "forbidden" }, 403);
  const b = await req.json().catch(() => ({}));
  const t = b.typeWebhook;
  if (!["incomingMessageReceived", "outgoingMessageReceived", "outgoingAPIMessageReceived"].includes(t)) return json({ ok: true });
  const sd = b.senderData || {}, md = b.messageData || {};
  const chat = sd.chatId; if (!chat || chat.endsWith("@broadcast")) return json({ ok: true });
  const text = md.textMessageData?.textMessage || md.extendedTextMessageData?.text || md.fileMessageData?.caption || ({ imageMessage: "📷 תמונה", videoMessage: "🎥 סרטון", audioMessage: "🎤 הקלטה", documentMessage: "📄 קובץ", locationMessage: "📍 מיקום", contactMessage: "👤 איש קשר" } as any)[md.typeMessage] || "";
  const incoming = t === "incomingMessageReceived";
  const { data: cur } = await db.from("wa_chats").select("chat_id,name,unread,tags").eq("chat_id", chat).maybeSingle();
  const name = cur?.name || sd.chatName || sd.senderContactName || sd.senderName || null;
  const row: any = { chat_id: chat, name, is_group: isGroup(chat), last_msg: String(text).slice(0, 300), last_dir: incoming ? "in" : "out", last_at: new Date((b.timestamp || Date.now() / 1000) * 1000).toISOString(), unread: incoming ? (cur?.unread || 0) + 1 : 0, updated_at: now() };
  if (!cur && incoming && !isGroup(chat)) row.tags = ["חדש"];   // a new person who wrote first = a new lead
  await db.from("wa_chats").upsert(row, { onConflict: "chat_id" });
  return json({ ok: true });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const url = new URL(req.url);
  if (url.searchParams.get("hook") === "1") return hook(req);
  const cron = await isCron(req);
  if (!cron && !(await isKarin(req))) return json({ error: "forbidden" }, 403);
  const body = await req.json().catch(() => ({}));
  try {
    if (body.mode === "tick") return json(await tick());
    if (body.mode === "status") {
      if (!ready()) return json({ connected: false, reason: "no_secrets" });
      const s = await green("getStateInstance").catch((e) => ({ stateInstance: "error", error: String(e.message || e) }));
      return json({ connected: s.stateInstance === "authorized", state: s.stateInstance, error: s.error });
    }
    if (body.mode === "sync") return json(await sync());
    if (body.mode === "setup") {   // point Green API's notifications at this function, with a secret token
      if (!ready()) return json({ ok: false, error: "not_connected" });
      let hk = await setting("wa_hook");
      if (!hk?.token) { hk = { token: crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "") }; await db.from("os_settings").upsert({ key: "wa_hook", value: hk, updated_at: now() }); }
      const r = await green("setSettings", { webhookUrl: `${SB_URL}/functions/v1/os-wa?hook=1`, webhookUrlToken: hk.token, incomingWebhook: "yes", outgoingMessageWebhook: "yes", outgoingAPIMessageWebhook: "yes", stateWebhook: "no", pollMessageWebhook: "no", incomingCallWebhook: "no" });
      return json({ ok: true, saved: r.saveSettings === true });
    }
    if (body.mode === "send_now" && body.id) {   // Karin pressed "send now" on a scheduled message
      await db.from("wa_sched").update({ send_at: now(), updated_at: now() }).eq("id", body.id).eq("status", "scheduled");
      return json({ ok: true, note: "goes out within a minute" });
    }
    return json({ error: "unknown mode" }, 400);
  } catch (e) { console.error(e); return json({ error: String((e as Error).message || e).slice(0, 300) }, 500); }
});
