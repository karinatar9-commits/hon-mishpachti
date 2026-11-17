// glow-booking — online appointment booking for Glow House (Rinat's clinic).
//
// Public (no login; called by tor/index.html with the publishable key):
//   POST {mode:'config'}                      → business name, services, whether booking is open
//   POST {mode:'slots', service}              → free start times per day for that treatment
//   POST {mode:'book', service, start, name, phone} → books, writes the event to Rinat's calendar, notifies her
//   POST {mode:'booking', token}              → one booking's details (for the cancel page)
//   POST {mode:'cancel', token}               → the client cancels her own appointment
// Admin (header x-admin-token = Rinat's secret link, or Karin's app session):
//   POST {mode:'admin_get'} · {mode:'admin_save', value} · {mode:'admin_cancel', id} · {mode:'admin_test'}
//
// Availability = working hours − blocks Rinat defined − everything busy in her Google Calendar − appointments
// booked here. Clients only ever receive free start times; nothing from the calendar itself leaves the server.
// The calendar is reached through Rinat's own Google connection when she has connected it from her app
// (os_vault "google_glowcal", scope calendar.events, consent finished by os-google), otherwise through Karin's
// connection (os_vault "google") once Rinat has shared her calendar with Karin with "make changes to events".
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const SB_URL = Deno.env.get("SUPABASE_URL")!;
const db = createClient(SB_URL, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const CID = (Deno.env.get("GOOGLE_CLIENT_ID") || "").trim().replace(/^["']|["']$/g, "");
const CSECRET = (Deno.env.get("GOOGLE_CLIENT_SECRET") || "").trim().replace(/^["']|["']$/g, "");
const GREEN_ID = (Deno.env.get("GLOW_GREEN_ID") || "").trim();
const GREEN_TOKEN = (Deno.env.get("GLOW_GREEN_TOKEN") || "").trim();
const PAGE = "https://glow.goldchain-ai.com/";
const TZ = "Asia/Jerusalem";
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-admin-token", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (o: unknown, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { ...CORS, "Content-Type": "application/json", "Cache-Control": "no-store" } });

// ---------- time (everything the client sees is Israel time; everything stored is UTC) ----------
const fmtParts = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
function local(ms: number) {
  const p: any = Object.fromEntries(fmtParts.formatToParts(new Date(ms)).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, min: +p.hour * 60 + +p.minute };
}
function offsetMin(ms: number) { const l = local(ms); const [y, m, d] = l.date.split("-").map(Number); return Math.round((Date.UTC(y, m - 1, d, 0, l.min) - Math.floor(ms / 60000) * 60000) / 60000); }
// local date + minutes after midnight → UTC ms (handles the two clock changes a year)
function toUtc(date: string, min: number) {
  const [y, m, d] = date.split("-").map(Number);
  const guess = Date.UTC(y, m - 1, d, 0, min);
  let t = guess - offsetMin(guess) * 60000;
  const o2 = offsetMin(t); if (guess - o2 * 60000 !== t) t = guess - o2 * 60000;
  return t;
}
const addDays = (date: string, n: number) => { const [y, m, d] = date.split("-").map(Number); return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10); };
const weekday = (date: string) => { const [y, m, d] = date.split("-").map(Number); return new Date(Date.UTC(y, m - 1, d)).getUTCDay(); };
const hm = (s: string) => { const m = /^(\d{1,2}):(\d{2})$/.exec(String(s || "")); return m ? Math.min(1440, +m[1] * 60 + +m[2]) : NaN; };
const pad = (n: number) => String(n).padStart(2, "0");
const minStr = (min: number) => `${pad(Math.floor(min / 60))}:${pad(min % 60)}`;
const DAYS = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];
function whenText(ms: number) { const l = local(ms); const [, m, d] = l.date.split("-").map(Number); return `יום ${DAYS[weekday(l.date)]} ${d}.${m} בשעה ${minStr(l.min)}`; }

// ---------- settings ----------
type Svc = { id: string; cat: string; name: string; min: number; price: number | null; on: boolean };
async function loadSettings() {
  const { data } = await db.from("glow_book_settings").select("value,admin_hash").eq("id", "main").maybeSingle();
  return { S: (data?.value || {}) as any, adminHash: data?.admin_hash as string | null };
}
const clampInt = (v: unknown, lo: number, hi: number, def: number) => { const n = Math.round(Number(v)); return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : def; };
const cleanText = (v: unknown, max: number) => String(v ?? "").replace(/[\u0000-\u001f<>]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
const isDate = (s: unknown) => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s + "T00:00:00Z"));
// everything Rinat saves is re-validated here, so a bad value can never break the public page
function sanitizeSettings(v: any, prev: any) {
  const hours: any = {};
  for (let d = 0; d < 7; d++) {
    const h = v?.hours?.[d] || prev?.hours?.[d] || {};
    let f = hm(h.from), t = hm(h.to);
    if (!Number.isFinite(f)) f = 540; if (!Number.isFinite(t)) t = 1140;
    hours[d] = { on: !!h.on && t > f, from: minStr(f), to: minStr(Math.max(t, f)) };
  }
  const blocks = (Array.isArray(v?.blocks) ? v.blocks : []).slice(0, 200).map((b: any) => {
    if (!isDate(b?.from_date)) return null;
    const to_date = isDate(b?.to_date) && b.to_date >= b.from_date ? b.to_date : b.from_date;
    const f = hm(b.from), t = hm(b.to); const all = !!b.all_day || !Number.isFinite(f) || !Number.isFinite(t) || t <= f;
    return { id: cleanText(b.id, 40) || crypto.randomUUID(), from_date: b.from_date, to_date, all_day: all, from: all ? "" : minStr(f), to: all ? "" : minStr(t), note: cleanText(b.note, 80) };
  }).filter(Boolean);
  const weekly = (Array.isArray(v?.weekly) ? v.weekly : []).slice(0, 50).map((b: any) => {
    const wd = clampInt(b?.wd, 0, 6, -1), f = hm(b?.from), t = hm(b?.to);
    if (wd < 0 || !Number.isFinite(f) || !Number.isFinite(t) || t <= f) return null;
    return { id: cleanText(b.id, 40) || crypto.randomUUID(), wd, from: minStr(f), to: minStr(t), note: cleanText(b.note, 80) };
  }).filter(Boolean);
  const seen = new Set<string>();
  const services = (Array.isArray(v?.services) ? v.services : []).slice(0, 40).map((s: any) => {
    const name = cleanText(s?.name, 60); if (!name) return null;
    let id = String(s?.id || "").toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 40) || "s-" + crypto.randomUUID().slice(0, 8);
    while (seen.has(id)) id += "x"; seen.add(id);
    const price = s?.price === "" || s?.price == null ? null : Math.max(0, Math.min(100000, Number(s.price) || 0));
    return { id, cat: cleanText(s.cat, 40), name, min: clampInt(s.min, 5, 600, 30), price, on: s.on !== false };
  }).filter(Boolean);
  return {
    live: !!v?.live,
    business: cleanText(v?.business, 80) || "Glow House",
    address: cleanText(v?.address, 120),
    // which calendar is written to and which mailbox is notified are fixed in the database, not editable from the settings screen
    calendar_id: prev?.calendar_id || "",
    notify_email: prev?.notify_email || "",
    notify_phone: normPhone(v?.notify_phone) || "",
    whatsapp: normPhone(v?.whatsapp) || "",
    show_prices: !!v?.show_prices,
    step_min: [10, 15, 20, 30, 60].includes(+v?.step_min) ? +v.step_min : 15,
    buffer_min: clampInt(v?.buffer_min, 0, 60, 0),
    lead_min: clampInt(v?.lead_min, 0, 7 * 1440, 180),
    horizon_days: clampInt(v?.horizon_days, 1, 90, 30),
    cancel_hours: clampInt(v?.cancel_hours, 0, 168, 12),
    max_per_phone: clampInt(v?.max_per_phone, 1, 10, 3),
    hours, blocks, weekly, services,
  };
}

// ---------- people input ----------
function normPhone(v: unknown) {
  let d = String(v ?? "").replace(/\D/g, "");
  if (d.startsWith("972")) d = "0" + d.slice(3);
  return /^05\d{8}$/.test(d) ? d : "";
}
// The name ends up in a calendar title that another automation reads, so only letters, spaces, ' and - are kept.
function normName(v: unknown) {
  return String(v ?? "").normalize("NFC").replace(/[^\p{L}\p{M} '\-]/gu, " ").replace(/\s+/g, " ").trim().split(" ").slice(0, 4).join(" ").slice(0, 30).trim();
}
async function sha(s: string) { const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)); return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join(""); }
const ipOf = (req: Request) => (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "unknown";
async function tooMany(kind: string, ipHash: string, perHour: number) {
  const since = new Date(Date.now() - 3600_000).toISOString();
  const { count } = await db.from("glow_book_log").select("id", { count: "exact", head: true }).eq("kind", kind).eq("ip_hash", ipHash).gte("at", since);
  return (count || 0) >= perHour;
}
const logHit = (kind: string, ipHash: string, phone = "") => db.from("glow_book_log").insert({ kind, ip_hash: ipHash, phone: phone || null });

// ---------- admin ----------
async function isKarin(req: Request) {
  const token = (req.headers.get("Authorization") || "").replace("Bearer ", "");
  if (!token || token.startsWith("sb_")) return false;
  const { data: u } = await db.auth.getUser(token);
  const email = u?.user?.email?.toLowerCase(); if (!email) return false;
  if ((u?.user?.factors || []).some((f: any) => f.status === "verified")) {
    try { let b = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"); b += "=".repeat((4 - b.length % 4) % 4); if (JSON.parse(atob(b)).aal !== "aal2") return false; } catch { return false; }
  }
  const { data: fm } = await db.from("family_members").select("owner_id,role").eq("email", email).maybeSingle();
  return !!fm && fm.owner_id === "karin" && fm.role === "admin";
}
async function isAdmin(req: Request, adminHash: string | null, ipHash: string) {
  const t = req.headers.get("x-admin-token") || "";
  if (t.length >= 32 && adminHash) {
    if (await tooMany("admin_fail", ipHash, 10)) return false;
    if ((await sha(t)) === adminHash) return true;
    await logHit("admin_fail", ipHash);
    return false;
  }
  return await isKarin(req);
}

// ---------- Google Calendar (through Karin's connection) ----------
async function vget(k: string) { const { data } = await db.from("os_vault").select("value").eq("key", k).maybeSingle(); return data?.value; }
async function accessToken(slot = "google"): Promise<string> {
  const g: any = await vget(slot);
  if (!g?.refresh_token) throw new Error("not_connected");
  if (g.access_token && g.expires_at > Date.now() + 60000) return g.access_token;
  const r = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: CID, client_secret: CSECRET, refresh_token: g.refresh_token, grant_type: "refresh_token" }) });
  const j = await r.json();
  if (!r.ok) { if (j.error === "invalid_grant") await db.from("os_vault").upsert({ key: slot, value: { ...g, broken: true }, updated_at: new Date().toISOString() }); throw new Error("google_token: " + (j.error_description || j.error)); }
  await db.from("os_vault").upsert({ key: slot, value: { ...g, access_token: j.access_token, expires_at: Date.now() + (j.expires_in || 3600) * 1000, broken: false }, updated_at: new Date().toISOString() });
  return j.access_token;
}
// Rinat's own connection wins; then the calendar is simply her primary one
async function calSource(): Promise<{ slot: string; own: boolean }> {
  const g: any = await vget("google_glowcal");
  return g?.refresh_token && !g?.broken ? { slot: "google_glowcal", own: true } : { slot: "google", own: false };
}
async function gcal(calId: string, path: string, init: RequestInit = {}) {
  const src = await calSource();
  const t = await accessToken(src.slot);
  const r = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(src.own ? "primary" : calId)}/${path}`, { ...init, headers: { ...(init.headers || {}), Authorization: `Bearer ${t}`, "content-type": "application/json" } });
  const j = r.status === 204 ? {} : await r.json().catch(() => ({}));
  if (!r.ok) { const e: any = new Error(`google ${r.status}: ${String(j?.error?.message || "").slice(0, 200)}`); e.status = r.status; throw e; }
  return j;
}
type Busy = { s: number; e: number; id?: string };
// All busy time in the calendar for a window. Events marked "free" (and cancelled ones) don't block.
async function calendarBusy(calId: string, t0: number, t1: number): Promise<{ busy: Busy[]; ids: Map<string, Busy>; role: string }> {
  const busy: Busy[] = []; const ids = new Map<string, Busy>(); let pageToken = ""; let role = "";
  for (let page = 0; page < 10; page++) {
    const q = new URLSearchParams({ singleEvents: "true", orderBy: "startTime", timeMin: new Date(t0).toISOString(), timeMax: new Date(t1).toISOString(), maxResults: "2500", fields: "accessRole,nextPageToken,items(id,status,transparency,start,end)" });
    if (pageToken) q.set("pageToken", pageToken);
    const c: any = await gcal(calId, `events?${q}`);
    role = c.accessRole || role;
    for (const ev of c.items || []) {
      if (ev.status === "cancelled") continue;
      const s = ev.start?.dateTime ? Date.parse(ev.start.dateTime) : ev.start?.date ? toUtc(ev.start.date, 0) : NaN;
      const e = ev.end?.dateTime ? Date.parse(ev.end.dateTime) : ev.end?.date ? toUtc(ev.end.date, 0) : NaN;
      if (!Number.isFinite(s) || !Number.isFinite(e) || e <= s) continue;
      const b = { s, e, id: ev.id }; ids.set(ev.id, b);
      if (ev.transparency === "transparent") continue;
      busy.push(b);
    }
    pageToken = c.nextPageToken || ""; if (!pageToken) return { busy, ids, role };
  }
  throw new Error("calendar_too_large");
}

// ---------- availability ----------
async function availability(S: any, svc: Svc, opts: { from?: string; days?: number } = {}) {
  const now = Date.now();
  const today = local(now).date;
  const first = opts.from || today;
  const nDays = opts.days ?? S.horizon_days;
  const t0 = toUtc(first, 0), t1 = toUtc(addDays(first, nDays), 0);
  let cal: Awaited<ReturnType<typeof calendarBusy>> | null = null; let calError = "";
  try { cal = await calendarBusy(S.calendar_id, t0 - 86400_000, t1 + 86400_000); } catch (e) { calError = String((e as Error).message || e); }
  const { data: rows } = await db.from("glow_bookings").select("id,starts_at,ends_at,gcal_event_id").eq("status", "confirmed").gte("ends_at", new Date(t0 - 86400_000).toISOString()).lte("starts_at", new Date(t1 + 86400_000).toISOString());
  const busy: Busy[] = cal ? [...cal.busy] : [];
  for (const r of rows || []) {
    const s = Date.parse(r.starts_at), e = Date.parse(r.ends_at);
    if (cal && r.gcal_event_id) {
      const ev = cal.ids.get(r.gcal_event_id);
      // Rinat deleted or moved the event in her calendar → the calendar wins, and the booking record follows it
      if (!ev) { await db.from("glow_bookings").update({ status: "cancelled", cancelled_by: "calendar", updated_at: new Date().toISOString() }).eq("id", r.id).eq("status", "confirmed"); continue; }
      if (ev.s !== s || ev.e !== e) await db.from("glow_bookings").update({ starts_at: new Date(ev.s).toISOString(), ends_at: new Date(ev.e).toISOString(), busy: `[${new Date(ev.s).toISOString()},${new Date(ev.e + S.buffer_min * 60000).toISOString()})`, updated_at: new Date().toISOString() }).eq("id", r.id).then(() => {}, () => {});
      continue; // already counted from the calendar
    }
    busy.push({ s, e });
  }
  const buf = S.buffer_min * 60000, dur = svc.min * 60000, earliest = now + S.lead_min * 60000;
  const days: { date: string; times: string[] }[] = [];
  for (let i = 0; i < nDays; i++) {
    const date = addDays(first, i); if (date < today) continue;
    const wd = weekday(date); const h = S.hours?.[wd];
    const times: string[] = [];
    if (h?.on) {
      const open = hm(h.from), close = hm(h.to);
      const closed: [number, number][] = [];
      for (const b of S.blocks || []) if (date >= b.from_date && date <= b.to_date) closed.push(b.all_day ? [0, 1440] : [hm(b.from), hm(b.to)]);
      for (const b of S.weekly || []) if (b.wd === wd) closed.push([hm(b.from), hm(b.to)]);
      for (let m = open; m + svc.min <= close; m += S.step_min) {
        if (closed.some(([a, z]) => m < z && m + svc.min > a)) continue;
        const s = toUtc(date, m), e = s + dur;
        if (s < earliest) continue;
        if (busy.some((b) => s < b.e + buf && e + buf > b.s)) continue;
        times.push(minStr(m));
      }
    }
    days.push({ date, times });
  }
  return { days, calOk: !!cal, calError, role: cal?.role || "" };
}

// ---------- notifications ----------
async function sendMail(to: string, subject: string, text: string) {
  const t = await accessToken();
  const b64 = (s: string) => btoa(String.fromCharCode(...new TextEncoder().encode(s)));
  const raw = [`To: ${to}`, `Subject: =?UTF-8?B?${b64(subject)}?=`, "MIME-Version: 1.0", "Content-Type: text/plain; charset=UTF-8", "Content-Transfer-Encoding: base64", "", b64(text)].join("\r\n");
  const r = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", { method: "POST", headers: { Authorization: `Bearer ${t}`, "content-type": "application/json" }, body: JSON.stringify({ raw: b64(raw).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "") }) });
  if (!r.ok) throw new Error("mail " + r.status);
}
async function sendWa(phone: string, text: string) {
  if (!GREEN_ID || !GREEN_TOKEN || !phone) return false;
  const r = await fetch(`https://api.green-api.com/waInstance${GREEN_ID}/sendMessage/${GREEN_TOKEN}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ chatId: `972${phone.slice(1)}@c.us`, message: text }) });
  return r.ok;
}
// Rinat hears about every new or cancelled appointment: WhatsApp when the bot's keys are configured, otherwise email.
async function notifyRinat(S: any, subject: string, text: string) {
  const out: any = {};
  try { if (await sendWa(S.notify_phone, text)) out.wa = true; } catch (_) { /* fall through to email */ }
  if (!out.wa && S.notify_email) { try { await sendMail(S.notify_email, subject, text); out.mail = true; } catch (e) { out.error = String((e as Error).message || e).slice(0, 120); } }
  return out;
}

const publicServices = (S: any) => (S.services || []).filter((s: Svc) => s.on).map((s: Svc) => ({ id: s.id, cat: s.cat, name: s.name, min: s.min, price: S.show_prices ? s.price : null }));

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method" }, 405);
  let body: any = {}; try { body = await req.json(); } catch { return json({ error: "bad_json" }, 400); }
  const mode = String(body.mode || "");
  const ipHash = await sha("glow:" + ipOf(req));
  const { S, adminHash } = await loadSettings();
  const admin = (mode.startsWith("admin_") || body.preview) ? await isAdmin(req, adminHash, ipHash) : false;
  const open = !!S.live || (admin && !!body.preview);

  try {
    // ---- public ----
    if (mode === "config") {
      return json({ open, business: S.business, address: S.address, whatsapp: S.whatsapp ? "972" + S.whatsapp.slice(1) : "", services: open ? publicServices(S) : [], cancel_hours: S.cancel_hours });
    }
    if (mode === "slots") {
      if (!open) return json({ error: "closed" }, 403);
      if (await tooMany("slots", ipHash, 240)) return json({ error: "rate" }, 429);
      await logHit("slots", ipHash);
      const svc = (S.services || []).find((s: Svc) => s.on && s.id === body.service);
      if (!svc) return json({ error: "service" }, 400);
      const a = await availability(S, svc);
      if (!a.calOk) return json({ error: "calendar" }, 503); // never show hours we can't check against the calendar
      return json({ days: a.days.filter((d) => d.times.length) });
    }
    if (mode === "book") {
      if (!open) return json({ error: "closed" }, 403);
      if (body.website) return json({ ok: true }); // hidden field only bots fill
      if (await tooMany("book", ipHash, 6)) return json({ error: "rate" }, 429);
      const svc: Svc = (S.services || []).find((s: Svc) => s.on && s.id === body.service);
      const name = normName(body.name), phone = normPhone(body.phone);
      const m = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})$/.exec(String(body.start || ""));
      if (!svc) return json({ error: "service" }, 400);
      if (name.length < 2) return json({ error: "name" }, 400);
      if (!phone) return json({ error: "phone" }, 400);
      if (!m || !isDate(m[1])) return json({ error: "start" }, 400);
      await logHit("book", ipHash, phone);
      const date = m[1], time = `${m[2]}:${m[3]}`;
      const today = local(Date.now()).date;
      if (date < today || date >= addDays(today, S.horizon_days)) return json({ error: "taken" }, 409);
      const { count } = await db.from("glow_bookings").select("id", { count: "exact", head: true }).eq("phone", phone).eq("status", "confirmed").gte("starts_at", new Date().toISOString());
      if ((count || 0) >= S.max_per_phone) return json({ error: "too_many" }, 409);
      // check again against the live calendar at the moment of booking
      const a = await availability(S, svc, { from: date, days: 1 });
      if (!a.calOk) return json({ error: "calendar" }, 503);
      if (!a.days[0]?.times.includes(time)) return json({ error: "taken" }, 409);
      const s = toUtc(date, hm(time)), e = s + svc.min * 60000;
      const cancel_token = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
      const { data: row, error } = await db.from("glow_bookings").insert({ service_id: svc.id, service_name: svc.name, duration_min: svc.min, price: svc.price, starts_at: new Date(s).toISOString(), ends_at: new Date(e).toISOString(),
        busy: `[${new Date(s).toISOString()},${new Date(e + S.buffer_min * 60000).toISOString()})`, name, phone, cancel_token }).select("id").single();
      if (error) return json({ error: /overlap|exclusion|23P01/i.test(error.message + error.code) ? "taken" : "save" }, error.code === "23P01" ? 409 : 500);
      const notify: any = {}; let gcal_event_id: string | null = null;
      try {
        const ev: any = await gcal(S.calendar_id, "events", { method: "POST", body: JSON.stringify({
          summary: `${name} ${phone} - ${svc.name}`,
          description: `נקבע דרך זימון התורים אונליין.\nלקוחה: ${name}\nטלפון: ${phone}\nטיפול: ${svc.name} (${svc.min} דק׳)`,
          start: { dateTime: new Date(s).toISOString(), timeZone: TZ }, end: { dateTime: new Date(e).toISOString(), timeZone: TZ },
          extendedProperties: { private: { glow_booking: row.id } }, reminders: { useDefault: true } }) });
        gcal_event_id = ev.id; notify.calendar = true;
      } catch (err) {
        // Without the calendar entry the appointment is not real for Rinat — undo it and tell the client to try again.
        await db.from("glow_bookings").delete().eq("id", row.id);
        console.error("calendar insert failed", (err as Error).message);
        return json({ error: "calendar" }, 503);
      }
      const when = whenText(s);
      Object.assign(notify, await notifyRinat(S, `תור חדש: ${name} · ${svc.name} · ${when}`, `נקבע תור חדש דרך זימון התורים 🗓\n\n${name}\n${svc.name} (${svc.min} דק׳)\n${when}\nטלפון: ${phone}\n\nהתור כבר ביומן שלך.`));
      try { if (await sendWa(phone, `היי ${name} 💗\nהתור שלך ב-${S.business} נקבע:\n${svc.name}\n${when}${S.address ? "\n" + S.address : ""}\n\nלביטול או שינוי: ${PAGE}?c=${cancel_token}`)) notify.client_wa = true; } catch (_) { /* optional */ }
      await db.from("glow_bookings").update({ gcal_event_id, notify }).eq("id", row.id);
      return json({ ok: true, booking: { service: svc.name, min: svc.min, start: new Date(s).toISOString(), end: new Date(e).toISOString(), when, name, token: cancel_token, wa_sent: !!notify.client_wa } });
    }
    if (mode === "booking" || mode === "cancel") {
      if (await tooMany("token", ipHash, 40)) return json({ error: "rate" }, 429);
      await logHit("token", ipHash);
      const token = String(body.token || ""); if (!/^[a-f0-9]{64}$/.test(token)) return json({ error: "not_found" }, 404);
      const { data: b } = await db.from("glow_bookings").select("id,service_name,duration_min,starts_at,ends_at,name,phone,status,gcal_event_id").eq("cancel_token", token).maybeSingle();
      if (!b) return json({ error: "not_found" }, 404);
      const s = Date.parse(b.starts_at);
      const can = b.status === "confirmed" && s - Date.now() >= S.cancel_hours * 3600_000;
      const view = { service: b.service_name, min: b.duration_min, start: b.starts_at, end: b.ends_at, when: whenText(s), name: b.name, status: b.status, past: s < Date.now(), can_cancel: can, cancel_hours: S.cancel_hours };
      if (mode === "booking") return json({ booking: view, business: S.business, address: S.address, whatsapp: S.whatsapp ? "972" + S.whatsapp.slice(1) : "" });
      if (!can) return json({ error: b.status !== "confirmed" ? "already" : "late", booking: view }, 409);
      const { data: upd } = await db.from("glow_bookings").update({ status: "cancelled", cancelled_by: "client", updated_at: new Date().toISOString() }).eq("id", b.id).eq("status", "confirmed").select("id");
      if (!upd?.length) return json({ error: "already" }, 409);
      if (b.gcal_event_id) { try { await gcal(S.calendar_id, `events/${encodeURIComponent(b.gcal_event_id)}`, { method: "DELETE" }); } catch (err) { console.error("calendar delete failed", (err as Error).message); } }
      await notifyRinat(S, `תור בוטל: ${b.name} · ${b.service_name} · ${view.when}`, `${b.name} ביטלה את התור שלה ❌\n\n${b.service_name}\n${view.when}\nטלפון: ${b.phone}\n\nהתור הוסר מהיומן והשעה חזרה להיות פנויה.`);
      return json({ ok: true, booking: { ...view, status: "cancelled", can_cancel: false } });
    }

    // ---- admin ----
    if (!mode.startsWith("admin_")) return json({ error: "unknown mode" }, 400);
    if (!admin) return json({ error: "forbidden" }, 403);
    if (mode === "admin_google_url") {
      if (!CID || !CSECRET) return json({ error: "no_client" }, 400);
      const s = crypto.randomUUID().replace(/-/g, "");
      await db.from("os_vault").upsert({ key: "google_state", value: { s, exp: Date.now() + 15 * 60e3, slot: "google_glowcal" }, updated_at: new Date().toISOString() });
      const u = new URL("https://accounts.google.com/o/oauth2/v2/auth");
      Object.entries({ client_id: CID, redirect_uri: `${SB_URL}/functions/v1/os-google`, response_type: "code", scope: "openid email https://www.googleapis.com/auth/calendar.events", access_type: "offline", prompt: "consent", state: s, login_hint: S.calendar_id || "" }).forEach(([k, v]) => v && u.searchParams.set(k, v));
      return json({ url: u.toString() });
    }
    if (mode === "admin_google_disconnect") {
      await db.from("os_vault").upsert({ key: "google_glowcal", value: {}, updated_at: new Date().toISOString() });
      return json({ ok: true });
    }
    if (mode === "admin_get" || mode === "admin_test") {
      let calendar: any = { ok: false };
      const src = await calSource(); const gv: any = src.own ? await vget("google_glowcal") : null;
      try { const c = await calendarBusy(S.calendar_id, Date.now(), Date.now() + 86400_000); calendar = { ok: true, write: ["owner", "writer"].includes(c.role), role: c.role, own: src.own, email: gv?.email || "" }; }
      catch (e) { const st = (e as any).status; calendar = { ok: false, reason: st === 404 ? "not_shared" : String((e as Error).message || e).slice(0, 120) }; }
      const { data: upcoming } = await db.from("glow_bookings").select("id,service_name,duration_min,starts_at,ends_at,name,phone,status,cancelled_by,created_at").gte("starts_at", new Date(Date.now() - 86400_000).toISOString()).order("starts_at").limit(200);
      const kg: any = await vget("google");
      return json({ value: S, calendar, share_with: kg?.email || "", whatsapp_ready: !!(GREEN_ID && GREEN_TOKEN), page: PAGE, bookings: (upcoming || []).map((b: any) => ({ ...b, when: whenText(Date.parse(b.starts_at)) })) });
    }
    if (mode === "admin_save") {
      const value = sanitizeSettings(body.value, S);
      const { error } = await db.from("glow_book_settings").update({ value, updated_at: new Date().toISOString() }).eq("id", "main");
      if (error) return json({ error: "save" }, 500);
      return json({ ok: true, value });
    }
    if (mode === "admin_cancel") {
      if (!/^[0-9a-f-]{36}$/.test(String(body.id || ""))) return json({ error: "not_found" }, 404);
      const { data: b } = await db.from("glow_bookings").update({ status: "cancelled", cancelled_by: "rinat", updated_at: new Date().toISOString() }).eq("id", String(body.id || "")).eq("status", "confirmed").select("gcal_event_id").maybeSingle();
      if (!b) return json({ error: "not_found" }, 404);
      if (b.gcal_event_id) { try { await gcal(S.calendar_id, `events/${encodeURIComponent(b.gcal_event_id)}`, { method: "DELETE" }); } catch (_) { /* already gone */ } }
      return json({ ok: true });
    }
    return json({ error: "unknown mode" }, 400);
  } catch (e) {
    console.error(mode, (e as Error).message);
    return json({ error: "server" }, 500);
  }
});
