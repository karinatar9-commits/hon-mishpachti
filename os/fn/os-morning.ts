// Karin OS — Glow House books, read from Morning (Green Invoice). READ-ONLY: this function only signs in and
// searches documents and expenses. It never creates, edits, sends or cancels anything in Morning.
// Needs two secrets added by the account owner: MORNING_ID and MORNING_SECRET (an API key of Rinat's Morning account).
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const MID = Deno.env.get("MORNING_ID") || "", MSEC = Deno.env.get("MORNING_SECRET") || "";
const API = "https://api.greeninvoice.co.il/api/v1";
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-key", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (o: unknown, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });
const now = () => new Date().toISOString();

function aalOk(token: string, user: any) {
  if (!(user?.factors || []).some((f: any) => f.status === "verified")) return true;
  try { let b = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"); b += "=".repeat((4 - b.length % 4) % 4); return JSON.parse(atob(b)).aal === "aal2"; } catch { return false; }
}
async function allowed(req: Request) {
  const ck = req.headers.get("x-cron-key");
  if (ck) { const { data } = await db.from("os_settings").select("value").eq("key", "cron_secret").maybeSingle(); return !!data?.value?.k && ck === data.value.k; }
  const token = (req.headers.get("Authorization") || "").replace("Bearer ", "");
  const { data: u } = await db.auth.getUser(token);
  const { data: fm } = await db.from("family_members").select("owner_id,role").eq("email", u?.user?.email?.toLowerCase() || "-").maybeSingle();
  return !!fm && fm.owner_id === "karin" && fm.role === "admin" && aalOk(token, u?.user);
}
async function login() {
  const r = await fetch(`${API}/account/token`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: MID, secret: MSEC }) });
  const j: any = await r.json().catch(() => ({}));
  if (!r.ok || !j.token) throw new Error("הכניסה למורנינג נכשלה: " + (j.errorMessage || j.message || r.status));
  return j.token as string;
}
// only the two search endpoints are ever called
async function search(tok: string, what: "documents" | "expenses", fromDate: string, toDate: string) {
  const items: any[] = [];
  for (let page = 1; page <= 30; page++) {
    const r = await fetch(`${API}/${what}/search`, { method: "POST", headers: { "content-type": "application/json", Authorization: `Bearer ${tok}` }, body: JSON.stringify({ page, pageSize: 100, fromDate, toDate, sort: what === "documents" ? "documentDate" : "date" }) });
    const j: any = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(`${what}: ` + (j.errorMessage || j.message || r.status));
    items.push(...(j.items || []));
    if (!j.items?.length || page >= (j.pages || 1)) break;
  }
  return items;
}
const TYPES: Record<number, string> = { 10: "הצעת מחיר", 100: "הזמנה", 200: "תעודת משלוח", 300: "חשבון עסקה", 305: "חשבונית מס", 320: "חשבונית מס קבלה", 330: "חשבונית זיכוי", 400: "קבלה", 405: "קבלה על תרומה" };
const num = (x: any) => (typeof x === "number" ? x : +x || 0);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    if (!(await allowed(req))) return json({ error: "forbidden" }, 403);
    const body = await req.json().catch(() => ({}));
    const { data: cur } = await db.from("os_settings").select("value").eq("key", "glow_morning").maybeSingle();
    if (body.mode === "status") return json({ keys: !!(MID && MSEC), at: cur?.value?.at || null, error: cur?.value?.error || null, docs: (cur?.value?.docs || []).length, exps: (cur?.value?.exps || []).length });
    if (body.mode === "get") return json(cur?.value || {});
    if (body.mode === "sync") {
      if (!MID || !MSEC) return json({ error: "no_keys" }, 400);
      const to = new Date(), from = new Date(to.getFullYear() - 1, to.getMonth(), 1);
      const fd = from.toISOString().slice(0, 10), td = to.toISOString().slice(0, 10);
      try {
        const tok = await login();
        const [rawD, rawE] = await Promise.all([search(tok, "documents", fd, td), search(tok, "expenses", fd, td).catch((e) => ({ error: String(e.message) }) as any)]);
        const docs = rawD.map((d: any) => ({ id: d.id, date: String(d.documentDate || d.creationDate || "").slice(0, 10), type: d.type, typeName: TYPES[d.type] || String(d.type), number: d.number, client: d.client?.name || "", desc: String(d.description || "").slice(0, 120), total: num(d.amount), vat: num(d.vat), net: num(d.amountExcludeVat) || num(d.amount) - num(d.vat), status: d.status, pay: [...new Set((d.payment || []).map((p: any) => p.type))], currency: d.currency || "ILS" }));
        const expItems = Array.isArray(rawE) ? rawE : [];
        const exps = expItems.map((e: any) => ({ id: e.id, date: String(e.date || e.documentDate || e.reportingDate || "").slice(0, 10), supplier: e.supplier?.name || e.supplierName || "", desc: String(e.description || "").slice(0, 120), total: num(e.amount), vat: num(e.vat), net: num(e.amountExcludeVat) || num(e.amount) - num(e.vat), cat: e.accountingClassification?.title || e.accountingClassification?.name || e.category || "", status: e.status, currency: e.currency || "ILS" }));
        // two untouched examples of each, kept only so the field names can be checked against the real account
        const strip = (o: any) => JSON.parse(JSON.stringify(o, (k, v) => (/email|phone|mobile|taxId|address|city|zip|token|secret|url|link/i.test(k) ? undefined : v)));
        const value = { at: now(), from: fd, to: td, docs, exps, expsError: Array.isArray(rawE) ? null : rawE.error, sample: { doc: rawD.slice(0, 2).map(strip), exp: expItems.slice(0, 2).map(strip) } };
        await db.from("os_settings").upsert({ key: "glow_morning", value, updated_at: now() });
        return json({ ok: true, docs: docs.length, exps: exps.length, expsError: value.expsError });
      } catch (e) {
        const error = String((e as Error).message || e).slice(0, 300);
        await db.from("os_settings").upsert({ key: "glow_morning", value: { ...(cur?.value || {}), error, errorAt: now() }, updated_at: now() });
        return json({ error }, 502);
      }
    }
    return json({ error: "unknown mode" }, 400);
  } catch (e) { return json({ error: String((e as Error)?.message || e) }, 500); }
});
