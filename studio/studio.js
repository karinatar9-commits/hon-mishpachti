// Studio OS — a business operating system for one client. Same code for every client; config.js holds what differs.
const C = window.STUDIO, $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const today = () => new Date().toISOString().slice(0, 10);
const plus = n => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10) };
const dfmt = s => s ? new Date(s + "T12:00").toLocaleDateString("he-IL", { day: "numeric", month: "numeric" }) : "";
const nis = n => "₪" + Math.round(n || 0).toLocaleString("he-IL");
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random());
const AG = Object.fromEntries(C.agents.map(a => [a.id, a]));
const toast = t => { const e = $("#toast"); e.textContent = t; e.classList.add("on"); clearTimeout(toast.t); toast.t = setTimeout(() => e.classList.remove("on"), 2600) };
for (const [k, v] of Object.entries(C.brand || {})) document.documentElement.style.setProperty("--" + k, v);
document.title = C.business.name + " · Studio OS";

/* ---------- data layer: demo = this browser only; live = the client's own Supabase project ---------- */
const KEY = "studio-data-v1";
let items = [], sb = null, user = null;
const DB = {
  async load() {
    if (C.demo) { items = JSON.parse(localStorage.getItem(KEY) || "null") || seed(); DB.save(); return }
    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
    sb = createClient(C.supabaseUrl, C.supabaseKey);
    user = (await sb.auth.getSession()).data.session?.user || null;
    if (!user) return;
    const { data, error } = await sb.from("st_items").select("id,kind,data").order("created_at");
    if (error) throw error;
    items = data.map(r => ({ id: r.id, kind: r.kind, ...r.data }));
  },
  save() { if (C.demo) localStorage.setItem(KEY, JSON.stringify(items)) },
  all: (kind, f) => items.filter(i => i.kind === kind && (!f || f(i))),
  get: id => items.find(i => i.id === id),
  async put(it) {
    if (!it.id) { it.id = uid(); items.push(it) } else { const i = items.findIndex(x => x.id === it.id); i < 0 ? items.push(it) : items[i] = it }
    DB.save();
    if (sb) { const { id, kind, ...data } = it; const { error } = await sb.from("st_items").upsert({ id, kind, data }); if (error) toast("לא נשמר: " + error.message) }
    return it;
  },
  async del(id) { items = items.filter(i => i.id !== id && i.project !== id); DB.save(); if (sb) await sb.from("st_items").delete().eq("id", id) }
};

function seed() {
  const P = (name, client, phone, city, type, area, stage, budget, due) => ({ id: uid(), kind: "project", name, client, phone, city, type, area, stage, budget, due });
  const ps = [
    P("בית פרטי · משפחת לוי", "דנה ואורי לוי", "", "נס ציונה", "בית פרטי", 240, 6, 3200000, plus(120)),
    P("שיפוץ דירת 5 חדרים · אברהם", "מיכל אברהם", "", "תל אביב", "שיפוץ דירה", 135, 4, 620000, plus(75)),
    P("משרדי סטודיו נובה", "סטודיו נובה בע\"מ", "", "הרצליה", "משרדים", 310, 1, 1100000, plus(160)),
    P("תוספת קומה · כהן", "יעל כהן", "", "רחובות", "תוספת בנייה", 85, 3, 780000, plus(200))
  ];
  const T = (p, title, due, done, by) => ({ id: uid(), kind: "task", project: ps[p]?.id || "", title, due, done: !!done, by: by || "" });
  const out = [...ps,
    T(0, "ביקור פיקוח באתר — יציקת תקרה", today()), T(0, "אישור דוגמת אבן חיפוי מול הספק", plus(1)), T(0, "חשבון חלקי מס' 4 של הקבלן — בדיקה", plus(-2)), T(0, "תיאום מועד התקנת אלומיניום", plus(6)), T(0, "עדכון לוח זמנים אחרי עיכוב הגשמים", plus(-9), 1),
    T(1, "סגירת תוכנית חשמל ותאורה", today()), T(1, "בחירת כלים סניטריים עם הלקוחה", plus(3)), T(1, "פרט נגרות מטבח — גרסה 2", plus(5)), T(1, "מדידת מצב קיים", plus(-20), 1),
    T(2, "מצגת קונספט — שתי חלופות", plus(4)), T(2, "פרוגרמה: מספר עמדות וחדרי ישיבות", plus(-1)),
    T(3, "השלמות לבקשת ההיתר — יועץ קונסטרוקציה", plus(2)), T(3, "מעקב ועדה מקומית", plus(9)),
    T(-1, "הצעת מחיר ללקוח חדש — דירת גן ברעננה", plus(1)), T(-1, "חידוש ביטוח אחריות מקצועית", plus(12)),
    { id: uid(), kind: "lead", name: "רונית שגב", phone: "", what: "דירת גן 4 חדרים, רעננה — שיפוץ מלא", area: 120, stage: "new", src: "אינסטגרם", next: "לחזור עם זמינות לפגישת היכרות" },
    { id: uid(), kind: "lead", name: "עידו ברק", phone: "", what: "בית חדש על מגרש, גדרה", area: 220, stage: "talk", src: "המלצה", next: "פגישה באתר" },
    { id: uid(), kind: "lead", name: "קליניקת ד\"ר פרץ", phone: "", what: "עיצוב קליניקה 90 מ\"ר, ראשון לציון", area: 90, stage: "offer", src: "גוגל", next: "מעקב על ההצעה שנשלחה" },
    { id: uid(), kind: "supplier", name: "אבן וקרמיקה הדרום", field: "חיפויים וריצוף", contact: "" },
    { id: uid(), kind: "supplier", name: "אלומיניום השרון", field: "אלומיניום וזיגוג", contact: "" },
    { id: uid(), kind: "supplier", name: "נגריית אורן", field: "נגרות ומטבחים", contact: "" },
    { id: uid(), kind: "meeting", project: ps[0].id, supplier: "אלומיניום השרון", date: plus(2), time: "10:00", topic: "פרטי חלונות וסגירת לו\"ז התקנה", notes: "" },
    { id: uid(), kind: "meeting", project: ps[1].id, supplier: "נגריית אורן", date: plus(5), time: "14:30", topic: "מטבח — הצעת מחיר ופרטים", notes: "" },
    { id: uid(), kind: "log", agent: "pm", text: "הכין טיוטת עדכון שבועי ללקוחות בפרויקט בית פרטי · משפחת לוי", at: Date.now() - 36e5 * 5 },
    { id: uid(), kind: "log", agent: "leads", text: "סימנה שהליד קליניקת ד\"ר פרץ מחכה למעקב כבר 4 ימים", at: Date.now() - 36e5 * 20 }
  ];
  return out;
}

/* ---------- derived ---------- */
const pname = id => DB.get(id)?.name || "כללי";
const openTasks = f => DB.all("task", t => !t.done && (!f || f(t))).sort((a, b) => (a.due || "9").localeCompare(b.due || "9"));
const late = () => openTasks(t => t.due && t.due < today());
const dueToday = () => openTasks(t => t.due === today());
const pending = () => DB.all("draft", d => d.status === "wait");
const LSTAGE = { new: "חדש", talk: "בשיחה", offer: "הצעה נשלחה", won: "נסגר ✓", lost: "לא רלוונטי" };
const log = (agent, text) => DB.put({ kind: "log", agent, text, at: Date.now() });

/* ---------- shell ---------- */
const NAV = [["today", "☀️", "היום"], ["projects", "📐", "פרויקטים"], ["leads", "🧲", "לידים"], ["suppliers", "🤝", "ספקים ופגישות"], ["content", "🎬", "תוכן"], ["team", "👥", "הצוות שלי"], ["talk", "🎙️", "לדבר עם " + AG.pa.name], ["setup", "⚙️", "הקמה"]];
let view = "today", arg = null, ptab = "tasks";
function go(v, a) { view = v; arg = a ?? null; location.hash = v + (a ? "/" + a : ""); render() }
function render() {
  const cnt = { today: late().length + dueToday().length, leads: DB.all("lead", l => !["won", "lost"].includes(l.stage)).length, team: pending().length };
  $("#side").innerHTML = `<div class="brand"><b>${esc(C.business.name)}</b><span>Studio OS ${C.demo ? '<i class="demo">הדגמה</i>' : ""}</span></div>` +
    NAV.map(([k, i, t]) => `<button class="nav ${view === k || (k === "projects" && view === "project") ? "on" : ""}" data-go="${k}"><i>${i}</i>${esc(t)}${cnt[k] ? `<em>${cnt[k]}</em>` : ""}</button>`).join("") +
    `<div class="sidefoot">מופעל על ידי goldchain_ai</div>`;
  (V[view] || V.today)();
  window.scrollTo(0, 0);
}
const top = (h, sub, btns = "") => $("#top").innerHTML = `<div><h1>${h}</h1>${sub ? `<div class="sub">${sub}</div>` : ""}</div><span class="sp"></span>${btns}`;
const taskRow = (t, showP = true) => `<div class="row ${t.done ? "done" : ""}"><button class="chk" data-done="${t.id}">${t.done ? "✓" : ""}</button><div class="t" data-edit="${t.id}">${esc(t.title)}<small>${showP ? esc(pname(t.project)) + " · " : ""}${t.due ? dfmt(t.due) : "ללא תאריך"}${t.by ? " · נוצר ע\"י " + esc(AG[t.by]?.name || t.by) : ""}</small></div>${!t.done && t.due && t.due < today() ? '<span class="tag bad">באיחור</span>' : t.due === today() && !t.done ? '<span class="tag a">היום</span>' : ""}</div>`;

const V = {
  today() {
    const h = new Date().getHours(), g = h < 12 ? "בוקר טוב" : h < 17 ? "צהריים טובים" : "ערב טוב";
    top(`${g}, ${esc(C.business.owner)}`, new Date().toLocaleDateString("he-IL", { weekday: "long", day: "numeric", month: "long" }), `<button class="btn a" data-go="talk">🎙️ לדבר עם ${esc(AG.pa.name)}</button><button class="btn g" data-new="task">+ משימה</button>`);
    const ps = DB.all("project", p => p.stage < C.stages.length - 1), mt = DB.all("meeting", m => m.date >= today() && m.date <= plus(7)).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
    const list = [...late(), ...dueToday()], soon = openTasks(t => t.due > today() && t.due <= plus(7));
    $("#view").innerHTML = `<div class="grid g4">
      <div class="card kpi"><b>${ps.length}</b><span>פרויקטים פעילים</span></div>
      <div class="card kpi ${dueToday().length ? "" : "ok"}"><b>${dueToday().length}</b><span>משימות להיום</span></div>
      <div class="card kpi ${late().length ? "bad" : "ok"}"><b>${late().length}</b><span>באיחור</span></div>
      <div class="card kpi"><b>${pending().length}</b><span>ממתין לאישור שלך</span></div></div>
    <div class="grid g2" style="margin-top:14px"><div class="grid">
      <div class="card"><h3>מה על השולחן היום</h3>${list.map(t => taskRow(t)).join("") || '<div class="empty">אין משימות פתוחות להיום 🎉</div>'}</div>
      <div class="card"><h3>השבוע הקרוב</h3>${soon.map(t => taskRow(t)).join("") || '<div class="empty">ריק</div>'}</div></div>
     <div class="grid">
      <div class="card"><h3>פגישות השבוע</h3>${mt.map(m => `<div class="row"><div class="t">${esc(m.topic)}<small>${esc(m.supplier)} · ${esc(pname(m.project))}</small></div><span class="tag">${dfmt(m.date)} ${esc(m.time || "")}</span></div>`).join("") || '<div class="empty">אין פגישות</div>'}</div>
      <div class="card"><h3>ממתין לאישור שלך</h3>${pending().map(d => `<div class="row"><span>${AG[d.agent]?.icon || ""}</span><div class="t" data-draft="${d.id}" style="cursor:pointer">${esc(d.title)}<small>${esc(AG[d.agent]?.name || "")} · ${esc(pname(d.project))}</small></div><button class="btn s g" data-draft="${d.id}">לפתוח</button></div>`).join("") || '<div class="empty">אין טיוטות ממתינות</div>'}</div>
      <div class="card feed"><h3>מה הצוות עשה</h3>${DB.all("log").sort((a, b) => b.at - a.at).slice(0, 6).map(l => `<div class="row"><span class="av">${AG[l.agent]?.icon || "•"}</span><div class="t">${esc(l.text)}<small>${esc(AG[l.agent]?.name || "")} · ${new Date(l.at).toLocaleString("he-IL", { day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit" })}</small></div></div>`).join("")}</div>
     </div></div>`;
  },
  projects() {
    top("פרויקטים", `${DB.all("project").length} פרויקטים`, `<button class="btn a" data-new="project">+ פרויקט חדש</button>`);
    $("#view").innerHTML = `<div class="grid g3">${DB.all("project").map(p => {
      const ot = openTasks(t => t.project === p.id), lt = ot.filter(t => t.due && t.due < today()).length;
      return `<div class="card pcard" data-go="project" data-a="${p.id}"><h3>${esc(p.name)}</h3><div class="meta">${esc(p.type)} · ${esc(p.city)} · ${p.area} מ"ר</div>
      <div><span class="tag a">${esc(C.stages[p.stage])}</span> ${lt ? `<span class="tag bad">${lt} באיחור</span>` : ""}</div>
      <div class="bar"><i style="width:${Math.round((p.stage + 1) / C.stages.length * 100)}%"></i></div>
      <div class="meta">${ot.length} משימות פתוחות · תקציב ${nis(p.budget)}${p.due ? " · יעד " + dfmt(p.due) : ""}</div></div>`}).join("")}</div>`;
  },
  project() {
    const p = DB.get(arg); if (!p) return go("projects");
    top(esc(p.name), `${esc(p.client)} · ${esc(p.type)} · ${esc(p.city)} · ${p.area} מ"ר · תקציב ${nis(p.budget)}`, `<button class="btn g" data-go="projects">→ כל הפרויקטים</button><button class="btn g" data-editp="${p.id}">עריכה</button>`);
    const TABS = [["tasks", "משימות"], ["boq", "כתב כמויות"], ["sup", "ספקים ופגישות"], ["plans", "תוכניות"], ["upd", "עדכונים ללקוח"]];
    const bar = (id, cta, extra = "") => `<div class="agentbar"><span class="av">${AG[id].icon}</span><div class="t"><b>${esc(AG[id].name)} · ${esc(AG[id].role)}</b><small>${esc(AG[id].job)}</small></div>${extra}<button class="btn a" data-run="${id}">${cta}</button></div>`;
    let body = "";
    if (ptab === "tasks") {
      const ts = DB.all("task", t => t.project === p.id).sort((a, b) => a.done - b.done || (a.due || "9").localeCompare(b.due || "9"));
      body = bar("pm", "מה חסר לשלב הזה?") + `<div class="card"><h3>משימות הפרויקט<span class="sp"></span><button class="btn s g" data-new="task">+ משימה</button></h3>${ts.map(t => taskRow(t, false)).join("") || '<div class="empty">אין משימות</div>'}</div>`;
    } else if (ptab === "boq") {
      const rows = DB.all("boq", r => r.project === p.id), tot = rows.reduce((s, r) => s + (+r.qty || 0) * (+r.price || 0), 0);
      let sec = "";
      body = bar("boq", rows.length ? "לחשב מחדש" : "להכין כתב כמויות") + `<div class="card"><h3>כתב כמויות ואומדן<span class="sp"></span><button class="btn s g" data-addboq>+ שורה</button><button class="btn s g" data-csv>ייצוא לאקסל</button></h3>
      ${rows.length ? `<table><thead><tr><th>סעיף</th><th>יח'</th><th class="n">כמות</th><th class="n">מחיר יח'</th><th class="n">סה"כ</th><th></th></tr></thead><tbody>${rows.map(r => `${r.sec !== sec ? `<tr class="sec"><td colspan="6">${esc(sec = r.sec)}</td></tr>` : ""}<tr><td><input data-boq="${r.id}" data-k="item" value="${esc(r.item)}"></td><td style="width:70px"><input data-boq="${r.id}" data-k="unit" value="${esc(r.unit)}"></td><td style="width:90px"><input data-boq="${r.id}" data-k="qty" type="number" value="${r.qty}"></td><td style="width:110px"><input data-boq="${r.id}" data-k="price" type="number" value="${r.price || ""}" placeholder="למלא"></td><td class="n">${r.price ? nis(r.qty * r.price) : "—"}</td><td><button data-delboq="${r.id}">✕</button></td></tr>`).join("")}</tbody>
      <tfoot><tr><td colspan="4">סה"כ אומדן (לפני מע"מ)</td><td class="n">${nis(tot)}</td><td></td></tr><tr><td colspan="4" style="font-weight:500;border:0">מול תקציב ${nis(p.budget)}</td><td class="n" style="border:0;color:${tot > p.budget ? "var(--bad)" : "var(--ok)"}">${tot ? Math.round(tot / p.budget * 100) + "%" : "—"}</td><td style="border:0"></td></tr></tfoot></table>` : `<div class="empty">עדיין אין כתב כמויות. ${esc(AG.boq.name)} תכין טיוטה לפי סוג הפרויקט והשטח, ואת מתקנת וממלאת מחירים.</div>`}</div>`;
    } else if (ptab === "sup") {
      const ms = DB.all("meeting", m => m.project === p.id).sort((a, b) => a.date.localeCompare(b.date)), qs = DB.all("quote", q => q.project === p.id);
      body = bar("buy", "להכין סדר יום לפגישה הקרובה") + `<div class="grid g2"><div class="card"><h3>פגישות<span class="sp"></span><button class="btn s g" data-new="meeting">+ פגישה</button></h3>${ms.map(m => `<div class="row"><div class="t" data-edit="${m.id}" style="cursor:pointer">${esc(m.topic)}<small>${esc(m.supplier)}${m.notes ? " · יש סיכום" : ""}</small></div><span class="tag ${m.date < today() ? "" : "a"}">${dfmt(m.date)} ${esc(m.time || "")}</span></div>`).join("") || '<div class="empty">אין פגישות</div>'}</div>
      <div class="card"><h3>הצעות מחיר<span class="sp"></span><button class="btn s g" data-new="quote">+ הצעה</button></h3>${qs.length ? compare(qs) : '<div class="empty">הוסיפי הצעות מחיר מספקים — ההשוואה תיבנה לבד.</div>'}</div></div>`;
    } else if (ptab === "plans") {
      const pl = DB.all("plan", x => x.project === p.id);
      body = bar("plans", "לקרוא תוכנית", `<input type="file" id="planF" accept="application/pdf,image/*" hidden>`) + `<div class="card"><h3>תוכניות שנקראו</h3>${pl.map(x => `<div class="row"><span>📄</span><div class="t">${esc(x.name)}<small>${esc(x.summary)}</small></div><span class="tag">${dfmt(x.date)}</span></div>`).join("") || `<div class="empty">העלי תוכנית (PDF או תמונה) — ${esc(AG.plans.name)} תחלץ שטחים, חדרים, פתחים והערות.</div>`}</div>`;
    } else {
      const us = DB.all("draft", d => d.project === p.id && d.type === "update").sort((a, b) => b.at - a.at);
      body = bar("pm", "לכתוב עדכון שבועי ללקוח") + `<div class="card"><h3>עדכונים</h3>${us.map(d => `<div class="row"><div class="t" data-draft="${d.id}" style="cursor:pointer">${esc(d.title)}<small>${new Date(d.at).toLocaleDateString("he-IL")}</small></div><span class="tag ${d.status === "wait" ? "w" : "ok"}">${d.status === "wait" ? "ממתין לאישור" : "אושר"}</span></div>`).join("") || '<div class="empty">עוד לא נכתבו עדכונים</div>'}</div>`;
    }
    $("#view").innerHTML = `<div class="card"><div class="steps">${C.stages.map((s, i) => `<button class="step ${i < p.stage ? "past" : i === p.stage ? "now" : ""}" data-stage="${i}">${esc(s)}</button>`).join("")}</div></div>
      <div class="tabs">${TABS.map(([k, t]) => `<button class="tab ${ptab === k ? "on" : ""}" data-tab="${k}">${t}</button>`).join("")}</div>${body}`;
  },
  leads() {
    top("לידים והצעות מחיר", "מפנייה ראשונה ועד חתימה", `<button class="btn a" data-new="lead">+ ליד חדש</button>`);
    $("#view").innerHTML = `<div class="agentbar"><span class="av">${AG.leads.icon}</span><div class="t"><b>${esc(AG.leads.name)} · ${esc(AG.leads.role)}</b><small>לחצי על ליד כדי שתכין לו מענה או הצעת שכר טרחה</small></div></div>
    <div class="cols">${Object.entries(LSTAGE).map(([k, t]) => `<div class="col"><h4>${t}</h4>${DB.all("lead", l => l.stage === k).map(l => `<div class="lead" data-edit="${l.id}"><b>${esc(l.name)}</b><small>${esc(l.what)}</small>${l.next ? `<small>⏭ ${esc(l.next)}</small>` : ""}</div>`).join("")}</div>`).join("")}</div>`;
  },
  suppliers() {
    top("ספקים ופגישות", "", `<button class="btn a" data-new="supplier">+ ספק</button><button class="btn g" data-new="meeting">+ פגישה</button>`);
    const ms = DB.all("meeting").sort((a, b) => b.date.localeCompare(a.date));
    $("#view").innerHTML = `<div class="grid g2"><div class="card"><h3>כל הפגישות</h3>${ms.map(m => `<div class="row"><div class="t" data-edit="${m.id}" style="cursor:pointer">${esc(m.topic)}<small>${esc(m.supplier)} · ${esc(pname(m.project))}</small></div><span class="tag ${m.date < today() ? "" : "a"}">${dfmt(m.date)} ${esc(m.time || "")}</span></div>`).join("") || '<div class="empty">אין</div>'}</div>
    <div class="card"><h3>ספקים</h3>${DB.all("supplier").map(s => `<div class="row"><div class="t" data-edit="${s.id}" style="cursor:pointer">${esc(s.name)}<small>${esc(s.field)}${s.contact ? " · " + esc(s.contact) : ""}</small></div></div>`).join("")}</div></div>`;
  },
  content() {
    top("תוכן ואינסטגרם", C.business.handle ? "@" + esc(C.business.handle) : "", `<button class="btn a" data-run="content">רעיונות לשבוע</button>`);
    const cs = DB.all("draft", d => d.type === "content").sort((a, b) => b.at - a.at);
    $("#view").innerHTML = `<div class="agentbar"><span class="av">${AG.content.icon}</span><div class="t"><b>${esc(AG.content.name)} · ${esc(AG.content.role)}</b><small>${esc(AG.content.job)}</small></div></div>
    <div class="grid g3">${cs.map(d => `<div class="card pcard" data-draft="${d.id}"><h3>${esc(d.title)}</h3><div class="meta">${esc(d.body.slice(0, 120))}…</div><div><span class="tag ${d.status === "wait" ? "w" : "ok"}">${d.status === "wait" ? "טיוטה" : "אושר"}</span> <span class="tag">${esc(d.format || "")}</span></div></div>`).join("") || '<div class="card empty" style="grid-column:1/-1">לחצי "רעיונות לשבוע" — ההצעות נבנות מהפרויקטים שלך.</div>'}</div>`;
  },
  team() {
    top("הצוות שלי", "סוכנים שעובדים בשבילך. כל דבר שיוצא החוצה — רק אחרי אישור שלך.");
    $("#view").innerHTML = `<div class="grid g3">${C.agents.map(a => `<div class="card agent"><span class="av">${a.icon}</span><div><b>${esc(a.name)}</b><small>${esc(a.role)}</small><p>${esc(a.job)}</p></div></div>`).join("")}</div>
    <div class="card" style="margin-top:14px"><h3>ממתין לאישור</h3>${pending().map(d => `<div class="row"><span>${AG[d.agent]?.icon}</span><div class="t">${esc(d.title)}<small>${esc(pname(d.project))}</small></div><button class="btn s g" data-draft="${d.id}">לפתוח</button></div>`).join("") || '<div class="empty">הכול מאושר</div>'}</div>`;
  },
  setup() {
    top("הקמה", "מה צריך כדי להפוך את ההדגמה למערכת חיה");
    const st = [["c", "פותחת חשבון Supabase (חינם) ומזמינה את קרין כחברת צוות", "שם נשמרים הנתונים — בבעלות הלקוחה"], ["c", "פותחת חשבון Anthropic, טוענת יתרה קטנה ומדביקה את המפתח ב-Supabase Secrets", "המוח של הסוכנים. המפתח לא עובר דרך אף אחד אחר"], ["p", "מריצה את setup/schema.sql ומעלה את הפונקציה studio-agent", "טבלאות, הרשאות וסוכנים"], ["p", "מעדכנת config.js: כתובת הפרויקט, המפתח הציבורי, demo:false", "זה כל מה שמשתנה בין לקוחות"], ["c", "נכנסת עם המייל שלה (קישור כניסה במייל, בלי סיסמה)", ""], ["c", "מאשרת חיבור Google — יומן ומייל", "כדי שהעוזרת תראה פגישות ותכין טיוטות"], ["p", "מזינה פרויקטים אמיתיים, ספקים ושלבי עבודה יחד עם הלקוחה", "שעה אחת של אפיון"], ["p", "שבוע הרצה: כל טיוטה של סוכן עוברת אישור, אוספים תיקונים", ""]];
    $("#view").innerHTML = `<div class="card setup"><h3>סדר ההקמה</h3><ol>${st.map(([w, t, d]) => `<li><span class="who ${w}">${w === "c" ? "הלקוחה" : "קרין"}</span>${esc(t)}${d ? `<br><small style="color:var(--mute)">${esc(d)}</small>` : ""}</li>`).join("")}</ol></div>
    <div class="card" style="margin-top:14px"><h3>מצב נוכחי</h3><div class="row"><div class="t">מצב</div><span class="tag ${C.demo ? "w" : "ok"}">${C.demo ? "הדגמה — הנתונים נשמרים רק בדפדפן הזה" : "חי"}</span></div><div class="row"><div class="t">סוכנים</div><span class="tag ${C.demo ? "w" : "ok"}">${C.demo ? "עובדים לפי כללים, בלי בינה מלאכותית" : "מחוברים"}</span></div>${C.demo ? `<div class="acts"><button class="btn g" data-reset>לאפס את נתוני ההדגמה</button></div>` : ""}</div>`;
  },
  talk() { V.today(); openTalk() }
};

function compare(qs) {
  const by = {}; qs.forEach(q => (by[q.item] ||= []).push(q));
  return `<table><thead><tr><th>פריט</th><th>ספק</th><th class="n">מחיר</th><th></th></tr></thead><tbody>${Object.entries(by).map(([it, a]) => { const mn = Math.min(...a.map(q => +q.price)); return a.sort((x, y) => x.price - y.price).map((q, i) => `<tr><td>${i ? "" : esc(it)}</td><td>${esc(q.supplier)}</td><td class="n">${nis(q.price)}</td><td>${+q.price === mn && a.length > 1 ? '<span class="tag ok">הזול</span>' : a.length > 1 ? `<span class="tag">+${Math.round((q.price / mn - 1) * 100)}%</span>` : ""}</td></tr>`).join("") }).join("")}</tbody></table>`;
}

/* ---------- forms ---------- */
const FORMS = {
  task: { t: "משימה", f: [["title", "מה צריך לעשות"], ["project", "פרויקט", "project"], ["due", "תאריך", "date"]] },
  project: { t: "פרויקט", f: [["name", "שם הפרויקט"], ["client", "לקוח"], ["phone", "טלפון הלקוח"], ["city", "עיר"], ["type", "סוג", ["בית פרטי", "שיפוץ דירה", "משרדים", "תוספת בנייה", "מסחרי", "עיצוב פנים"]], ["area", "שטח במ\"ר", "number"], ["budget", "תקציב ביצוע ₪", "number"], ["due", "יעד סיום", "date"]] },
  lead: { t: "ליד", f: [["name", "שם"], ["phone", "טלפון"], ["what", "מה מבקשים"], ["area", "שטח במ\"ר", "number"], ["src", "מאיפה הגיע"], ["stage", "שלב", Object.entries(LSTAGE)], ["next", "הצעד הבא"]] },
  supplier: { t: "ספק", f: [["name", "שם"], ["field", "תחום"], ["contact", "איש קשר / טלפון"]] },
  meeting: { t: "פגישה", f: [["topic", "נושא"], ["supplier", "עם מי"], ["project", "פרויקט", "project"], ["date", "תאריך", "date"], ["time", "שעה", "time"], ["notes", "סיכום פגישה", "area"]] },
  quote: { t: "הצעת מחיר", f: [["item", "פריט / עבודה"], ["supplier", "ספק"], ["price", "מחיר ₪", "number"], ["project", "פרויקט", "project"]] }
};
function form(kind, it = {}) {
  const F = FORMS[kind], isNew = !it.id;
  if (isNew) { it = { kind, project: view === "project" ? arg : "", due: kind === "task" ? today() : "", date: kind === "meeting" ? today() : "", stage: kind === "lead" ? "new" : kind === "project" ? 0 : undefined, ...it } }
  const inp = ([k, l, ty]) => {
    const v = it[k] ?? "";
    if (ty === "project") return `<select name="${k}"><option value="">כללי</option>${DB.all("project").map(p => `<option value="${p.id}" ${v === p.id ? "selected" : ""}>${esc(p.name)}</option>`).join("")}</select>`;
    if (Array.isArray(ty)) return `<select name="${k}">${ty.map(o => { const [ov, ol] = Array.isArray(o) ? o : [o, o]; return `<option value="${esc(ov)}" ${v === ov ? "selected" : ""}>${esc(ol)}</option>` }).join("")}</select>`;
    if (ty === "area") return `<textarea name="${k}">${esc(v)}</textarea>`;
    return `<input name="${k}" type="${ty || "text"}" value="${esc(v)}">`;
  };
  const extra = kind === "lead" && !isNew ? `<button type="button" class="btn g" data-leadrun="reply">${AG.leads.icon} מענה ראשון</button><button type="button" class="btn g" data-leadrun="offer">${AG.leads.icon} הצעת שכר טרחה</button>${it.stage !== "won" ? `<button type="button" class="btn g" data-leadwin>להפוך לפרויקט</button>` : ""}` : kind === "meeting" && !isNew ? `<button type="button" class="btn g" data-mtgtasks>${AG.buy.icon} משימות מהסיכום</button>` : "";
  sheet(`<h2>${isNew ? "חדש: " : ""}${F.t}</h2><form id="frm">${F.f.map(x => `<div class="f"><label>${x[1]}</label>${inp(x)}</div>`).join("")}<div class="acts"><button class="btn a">שמירה</button>${extra}${isNew ? "" : `<button type="button" class="btn g" data-del="${it.id}">מחיקה</button>`}<button type="button" class="btn g" data-close>ביטול</button></div></form>`);
  $("#frm").onsubmit = async e => {
    e.preventDefault(); const d = Object.fromEntries(new FormData(e.target));
    for (const [k, , ty] of F.f) if (ty === "number") d[k] = +d[k] || 0;
    Object.assign(it, d); await DB.put(it); close(); render(); toast("נשמר");
  };
  form.cur = it;
}
const sheet = h => { $("#sheet").innerHTML = h; $("#modal").classList.add("on") };
const close = () => $("#modal").classList.remove("on");
function draftView(id) {
  const d = DB.get(id); if (!d) return;
  const p = DB.get(d.project), wa = p?.phone && d.type === "update" ? "https://wa.me/972" + p.phone.replace(/\D/g, "").replace(/^0/, "") + "?text=" + encodeURIComponent(d.body) : "";
  sheet(`<h2>${AG[d.agent]?.icon || ""} ${esc(d.title)}</h2><div class="f"><label>${esc(AG[d.agent]?.name || "")} הכין/ה. אפשר לערוך לפני אישור.</label><textarea id="dbody" style="min-height:260px">${esc(d.body)}</textarea></div>${C.demo ? '<small style="color:var(--mute)">בהדגמה הטקסט נבנה מהנתונים לפי תבנית. במערכת החיה הסוכן מנסח בעצמו.</small>' : ""}
  <div class="acts"><button class="btn a" data-ok="${id}">אישור ושמירה</button><button class="btn g" data-copy>העתקה</button>${wa ? `<a class="btn g" target="_blank" rel="noopener" href="${wa}" style="text-decoration:none">פתיחה בוואטסאפ</a>` : ""}<button class="btn g" data-del="${id}">מחיקה</button><button class="btn g" data-close>סגירה</button></div>`);
}

/* ---------- agents ---------- */
// Live mode: the agent runs on the client's server (setup/studio-agent.ts) with their own AI key.
// Demo mode: rule-based stand-ins built from the data on screen, so the flow can be shown without any account.
async function runAgent(id, ctx = {}) {
  if (!C.demo && sb) {
    toast(AG[id].name + " עובד/ת…");
    let file; if (ctx.file) { if (ctx.file.size > 20e6) return toast("הקובץ גדול מ-20MB"); const b = new Uint8Array(await ctx.file.arrayBuffer()); let x = ""; for (let i = 0; i < b.length; i += 32768) x += String.fromCharCode(...b.subarray(i, i + 32768)); file = { name: ctx.file.name, type: ctx.file.type, b64: btoa(x) } }
    const { data, error } = await sb.functions.invoke("studio-agent", { body: { agent: id, project: ctx.project?.id, mode: ctx.mode, file, ...ctx.extra } });
    if (error) return toast("הסוכן נכשל: " + error.message);
    await DB.load(); render(); return toast(data?.note || "מוכן");
  }
  await DEMO[id](ctx); render();
}
const BOQ = {
  base: [["עבודות הכנה ופירוק", "פינוי פסולת ומכולות", "קומפ'", () => 1], ["בנייה וטיח", "מחיצות בלוקים / גבס", "מ\"ר", a => a * .55], ["בנייה וטיח", "טיח פנים", "מ\"ר", a => a * 2.6], ["ריצוף וחיפוי", "ריצוף כללי", "מ\"ר", a => a * 1.05], ["ריצוף וחיפוי", "חיפוי חדרים רטובים", "מ\"ר", a => a * .32], ["ריצוף וחיפוי", "פנלים", "מ\"א", a => a * .9], ["חשמל ותאורה", "נקודות חשמל ותקשורת", "נק'", a => a * .75], ["חשמל ותאורה", "גופי תאורה", "יח'", a => a * .4], ["אינסטלציה", "נקודות מים ודלוחין", "נק'", a => a * .14], ["אינסטלציה", "כלים סניטריים", "יח'", a => a * .06], ["צבע", "צבע קירות ותקרות", "מ\"ר", a => a * 3.4], ["נגרות", "דלתות פנים", "יח'", a => a * .055], ["נגרות", "מטבח", "מ\"א", a => Math.min(9, 3 + a * .025)], ["אלומיניום", "חלונות ודלתות הזזה", "מ\"ר", a => a * .16], ["מיזוג", "מערכת מיזוג", "כ\"ס", a => a * .045]],
  "בית פרטי": [["שלד", "בטון יסודות ורצפה", "מ\"ק", a => a * .32], ["שלד", "בטון קירות ותקרות", "מ\"ק", a => a * .42], ["שלד", "פלדת זיון", "טון", a => a * .075], ["חוץ", "חיפוי חוץ / שליכט", "מ\"ר", a => a * 1.3], ["חוץ", "איטום גג", "מ\"ר", a => a * .55]],
  "תוספת בנייה": [["שלד", "בטון קירות ותקרה", "מ\"ק", a => a * .4], ["שלד", "פלדת זיון", "טון", a => a * .07], ["חוץ", "איטום גג", "מ\"ר", a => a * 1.05]],
  "משרדים": [["תקרות", "תקרה אקוסטית", "מ\"ר", a => a * .8], ["מחיצות", "מחיצות זכוכית", "מ\"א", a => a * .12]]
};
const DEMO = {
  async boq({ project: p }) {
    items = items.filter(i => !(i.kind === "boq" && i.project === p.id));
    const rows = [...(BOQ[p.type] || []), ...BOQ.base.filter(r => !(p.type === "משרדים" && r[0] === "נגרות" && r[1] === "מטבח"))];
    for (const [sec, item, unit, q] of rows) items.push({ id: uid(), kind: "boq", project: p.id, sec, item, unit, qty: Math.max(1, Math.round(q(p.area))), price: 0 });
    DB.save(); await log("boq", `הכינה טיוטת כתב כמויות (${rows.length} סעיפים) לפרויקט ${p.name}`);
    toast("הטיוטה מוכנה — כמויות לפי מקדמים, למלא מחירים");
  },
  async pm({ project: p, mode }) {
    const ts = DB.all("task", t => t.project === p.id), done = ts.filter(t => t.done), open = ts.filter(t => !t.done).sort((a, b) => (a.due || "9").localeCompare(b.due || "9"));
    if (mode === "gaps") {
      const need = { 0: ["סיכום פגישת היכרות ופרוגרמה חתומה", "הסכם שכר טרחה חתום"], 1: ["מצגת קונספט", "אישור קונספט בכתב מהלקוח"], 2: ["תוכניות העמדה וחתכים", "תיאום ראשוני עם קונסטרוקטור"], 3: ["הגשת בקשה להיתר", "מעקב השלמות מול הוועדה"], 4: ["סט תוכניות עבודה מלא", "תיאום יועצים: חשמל, אינסטלציה, מיזוג", "כתב כמויות"], 5: ["שליחת מכרז ל-3 קבלנים", "טבלת השוואת הצעות"], 6: ["יומן פיקוח שבועי", "בדיקת חשבונות חלקיים"], 7: ["רשימת ליקויים (פאנץ' ליסט)", "מסירת תיק מתקן"] }[p.stage] || [];
      const miss = need.filter(n => !ts.some(t => t.title === n));
      for (const n of miss) await DB.put({ kind: "task", project: p.id, title: n, due: plus(7), done: false, by: "pm" });
      await log("pm", `בדק את שלב "${C.stages[p.stage]}" בפרויקט ${p.name} והוסיף ${miss.length} משימות חסרות`);
      return toast(miss.length ? `נוספו ${miss.length} משימות לשלב` : "לא חסר כלום לשלב הזה");
    }
    const body = `שלום ${p.client.split(" ")[0]},\n\nעדכון שבועי על ${p.name}:\n\n📍 שלב נוכחי: ${C.stages[p.stage]} (שלב ${p.stage + 1} מתוך ${C.stages.length})\n\n✅ מה הושלם:\n${done.slice(-4).map(t => "• " + t.title).join("\n") || "• ממשיכים לפי התוכנית"}\n\n🔜 מה בשבוע הקרוב:\n${open.slice(0, 4).map(t => `• ${t.title}${t.due ? " (" + dfmt(t.due) + ")" : ""}`).join("\n") || "• אין משימות פתוחות"}\n${open.some(t => t.due < today()) ? "\n⚠️ יש נושא שמתעכב ואני מטפלת בו — אעדכן כשייסגר.\n" : ""}\nלכל שאלה אני כאן.\n${C.business.owner} · ${C.business.name}`;
    const d = await DB.put({ kind: "draft", type: "update", agent: "pm", project: p.id, title: "עדכון שבועי · " + dfmt(today()), body, status: "wait", at: Date.now() });
    await log("pm", `הכין טיוטת עדכון שבועי ללקוח בפרויקט ${p.name}`); draftView(d.id);
  },
  async buy({ project: p }) {
    const m = DB.all("meeting", x => x.project === p.id && x.date >= today()).sort((a, b) => a.date.localeCompare(b.date))[0];
    if (!m) return toast("אין פגישה קרובה בפרויקט — הוסיפי פגישה");
    const qs = DB.all("quote", q => q.project === p.id && q.supplier === m.supplier), ot = openTasks(t => t.project === p.id).slice(0, 3);
    const body = `סדר יום · ${m.topic}\n${m.supplier} · ${dfmt(m.date)} ${m.time || ""}\nפרויקט: ${p.name} (${p.city})\n\n1. מצב נוכחי: ${C.stages[p.stage]}\n2. ${m.topic} — לסגור מפרט, מידות ודגמים\n3. מחיר: ${qs.length ? qs.map(q => `${q.item} ${nis(q.price)}`).join(", ") + " — לבדוק מה כלול ומה לא" : "לקבל הצעת מחיר כתובה ומפורטת"}\n4. לוח זמנים: מועד אספקה, מועד התקנה, תלות בעבודות אחרות\n5. תנאי תשלום ואחריות\n6. דוגמאות / מוקאפ לאישור הלקוח\n\nשאלות פתוחות מהפרויקט:\n${ot.map(t => "• " + t.title).join("\n") || "• —"}\n\nלצאת מהפגישה עם: הצעה כתובה, תאריך אספקה, שם איש קשר לביצוע.`;
    const d = await DB.put({ kind: "draft", type: "agenda", agent: "buy", project: p.id, title: "סדר יום · " + m.supplier, body, status: "wait", at: Date.now() });
    await log("buy", `הכין סדר יום לפגישה עם ${m.supplier}`); draftView(d.id);
  },
  async plans({ project: p, file }) {
    await DB.put({ kind: "plan", project: p.id, name: file?.name || "תוכנית", date: today(), summary: "בהדגמה הקובץ רק נרשם. קריאה אמיתית של התוכנית (שטחים, חדרים, פתחים, אי-התאמות) פועלת במערכת החיה." });
    toast("הקובץ נרשם. קריאת תוכניות פועלת רק במערכת החיה");
  },
  async leads({ lead: l, mode }) {
    const body = mode === "offer"
      ? `הצעת שכר טרחה\nלכבוד: ${l.name}\nהנדון: ${l.what}\n\nהיקף העבודה:\n${C.stages.map((s, i) => `${i + 1}. ${s}`).join("\n")}\n\nשטח מוערך: ${l.area || "—"} מ"ר\nשכר טרחה: [למלא סכום] ₪ + מע"מ\n\nאבני דרך לתשלום:\n• 20% בחתימה\n• 25% באישור קונספט\n• 30% במסירת תוכניות עבודה\n• 25% לאורך הפיקוח\n\nלא כולל: יועצים, אגרות, מדידות והדמיות נוספות.\nתוקף ההצעה: 30 יום.\n\n${C.business.owner} · ${C.business.name}`
      : `היי ${l.name.split(" ")[0]}, תודה שפנית!\nקראתי על ${l.what} — נשמע פרויקט שאשמח לקחת בו חלק.\n\nכדי להבין את הצרכים הייתי רוצה לקבוע שיחת היכרות קצרה של 20 דקות. מתאים לך השבוע?\n\nכדאי להכין: תוכנית קיימת אם יש, תמונות של המקום, ותקציב משוער.\n\n${C.business.owner} · ${C.business.name}`;
    const d = await DB.put({ kind: "draft", type: mode, agent: "leads", project: "", title: (mode === "offer" ? "הצעת שכר טרחה · " : "מענה ראשון · ") + l.name, body, status: "wait", at: Date.now() });
    await log("leads", `הכינה ${mode === "offer" ? "הצעת שכר טרחה" : "מענה ראשון"} ל${l.name}`); draftView(d.id);
  },
  async content() {
    const ps = DB.all("project").sort((a, b) => b.stage - a.stage), a = ps[0], b = ps[1] || a;
    const ideas = [["רילס", `לפני ואחרי · ${a.type} ב${a.city}`, `פתיחה: "ככה זה נראה כשהגענו."\nשוט 1: המצב הקיים. שוט 2: התוכנית על השולחן. שוט 3: האתר בעבודה. שוט 4: התוצאה.\nסיום: "רוצים לראות מה אפשר לעשות אצלכם? כתבו לי."`], ["קרוסלה", `5 טעויות בתכנון ${b.type}`, `שקף 1: כותרת.\nשקפים 2–6: טעות אחת בכל שקף + איך נמנעים ממנה (אחסון, תאורה, נקודות חשמל, כיווני אוויר, תקציב בלי בלת"מ).\nשקף 7: "שמרו לפני שמתחילים לתכנן."`], ["רילס", "יום באתר בנייה", `ליווי קצר של ביקור פיקוח: מה בודקים, מה מתקנים במקום, ולמה זה חוסך כסף ללקוח.`]];
    for (const [format, title, body] of ideas) await DB.put({ kind: "draft", type: "content", agent: "content", project: "", format, title, body, status: "wait", at: Date.now() });
    await log("content", "הכינה 3 רעיונות תוכן לשבוע"); toast("3 רעיונות מוכנים");
  }
};

/* ---------- voice assistant ---------- */
let rec = null, talking = false;
function brief() {
  const l = late().length, t = dueToday(), m = DB.all("meeting", x => x.date === today()), w = pending().length;
  return `יש לך ${t.length} משימות להיום${l ? ` ו-${l} באיחור` : ""}.${t[0] ? ` הראשונה: ${t[0].title}.` : ""}${m.length ? ` ${m.length === 1 ? "פגישה אחת" : m.length + " פגישות"} היום: ${m.map(x => x.topic + " ב-" + x.time).join(", ")}.` : " אין פגישות היום."}${w ? ` ו-${w} טיוטות מחכות לאישור שלך.` : ""}`;
}
function reply(q) {
  const findP = () => DB.all("project").find(p => q.split(/\s+/).some(w => w.length > 2 && (p.name.includes(w) || p.client.includes(w) || p.city.includes(w))));
  let m;
  if (m = q.match(/(?:תוסיפי|להוסיף|תרשמי|תזכירי לי)\s*(?:משימה)?\s*[:\-]?\s*(.+)/)) { const p = findP(); DB.put({ kind: "task", project: p?.id || "", title: m[1].trim(), due: /מחר/.test(q) ? plus(1) : today(), done: false, by: "pa" }); return [`הוספתי משימה: ${m[1]}${p ? ", בפרויקט " + p.name : ""}.`, []] }
  if (/איחור|מתעכב|דחוף/.test(q)) { const l = late(); return [l.length ? `${l.length} משימות באיחור.` : "אין שום דבר באיחור.", l.map(t => `${t.title} · ${pname(t.project)}`)] }
  if (/פגיש|יומן/.test(q)) { const ms = DB.all("meeting", x => x.date >= today()).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 5); return [ms.length ? `הפגישה הקרובה: ${ms[0].topic} עם ${ms[0].supplier}, ${dfmt(ms[0].date)} ב-${ms[0].time}.` : "אין פגישות קרובות.", ms.map(x => `${dfmt(x.date)} ${x.time} · ${x.topic}`)] }
  if (/ליד|פניות|לקוחות חדשים/.test(q)) { const ls = DB.all("lead", l => !["won", "lost"].includes(l.stage)); return [`${ls.length} לידים פתוחים.`, ls.map(l => `${l.name} · ${LSTAGE[l.stage]} · ${l.next || ""}`)] }
  if (/אישור|טיוט/.test(q)) { const d = pending(); return [d.length ? `${d.length} טיוטות מחכות לך.` : "אין טיוטות ממתינות.", d.map(x => x.title)] }
  const p = findP();
  if (p) { const ot = openTasks(t => t.project === p.id); return [`${p.name}: בשלב ${C.stages[p.stage]}. ${ot.length} משימות פתוחות${ot.filter(t => t.due < today()).length ? `, מתוכן ${ot.filter(t => t.due < today()).length} באיחור` : ""}.${ot[0] ? " הבאה בתור: " + ot[0].title + "." : ""}`, ot.slice(0, 5).map(t => `${t.title} · ${dfmt(t.due)}`)] }
  if (/פרויקט/.test(q)) return [`יש ${DB.all("project").length} פרויקטים.`, DB.all("project").map(p => `${p.name} · ${C.stages[p.stage]}`)];
  if (/היום|בריף|מה יש|מה קורה|בוקר/.test(q)) return [brief(), [...late(), ...dueToday()].map(t => `${t.title} · ${pname(t.project)}`)];
  return [C.demo ? "בהדגמה אני עונה על: מה יש היום, מה באיחור, פגישות, לידים, מצב פרויקט לפי שם, והוספת משימה. במערכת החיה אפשר לשאול כל דבר." : "לא הבנתי, נסי שוב.", []];
}
function say(t) {
  const o = $(".orb"); if (!("speechSynthesis" in window)) return;
  speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(t); u.lang = "he-IL"; u.rate = 1.02;
  const v = speechSynthesis.getVoices().filter(x => x.lang.startsWith("he")); u.voice = v.find(x => /female|carmit|hila/i.test(x.name)) || v[0] || null;
  u.onstart = () => { talking = true; o?.classList.add("say"); try { rec?.stop() } catch { } }; u.onend = () => { talking = false; o?.classList.remove("say"); listen() };
  speechSynthesis.speak(u);
}
async function ask(q) {
  if (!q.trim()) return; $(".talk .you").textContent = q;
  let a, rows = [];
  if (!C.demo && sb) { const { data, error } = await sb.functions.invoke("studio-agent", { body: { agent: "pa", q } }); a = error ? "יש תקלה בחיבור לסוכנת." : data.text; rows = data?.rows || []; if (data?.changed) await DB.load() }
  else[a, rows] = reply(q);
  $(".talk .ans").textContent = a; const pn = $(".talk .pan"); pn.innerHTML = rows.map(r => `<div>${esc(r)}</div>`).join(""); pn.classList.toggle("on", !!rows.length); say(a);
}
function listen() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition, st = $(".talk .st"); if (!$(".talk")) return;
  if (!SR) { if (st) st.textContent = "הדפדפן הזה לא תומך בזיהוי דיבור — אפשר להקליד"; return }
  try { rec?.abort() } catch { }
  rec = new SR(); rec.lang = "he-IL"; rec.continuous = true; rec.interimResults = true; let fin = "", tm;
  rec.onstart = () => { st.textContent = "מקשיבה…"; $(".orb")?.classList.add("hear") };
  rec.onresult = e => { let it = ""; for (let i = e.resultIndex; i < e.results.length; i++) e.results[i].isFinal ? fin += e.results[i][0].transcript + " " : it += e.results[i][0].transcript; $(".talk .you").textContent = fin + it; clearTimeout(tm); tm = setTimeout(() => { const q = (fin + it).trim(); fin = ""; if (q) { try { rec.stop() } catch { } ask(q) } }, 2200) };
  rec.onend = () => { $(".orb")?.classList.remove("hear"); if ($(".talk") && !talking) setTimeout(() => { try { rec.start() } catch { } }, 400) };
  rec.onerror = e => { if (e.error === "not-allowed") st.textContent = "צריך לאשר גישה למיקרופון" };
  try { rec.start() } catch { }
}
function openTalk() {
  const d = document.createElement("div"); d.className = "talk";
  d.innerHTML = `<button class="x" data-xtalk>✕ סגירה</button><div class="orb">${AG.pa.icon}</div><div class="st"></div><div class="you"></div><div class="ans"></div><div class="pan"></div>
  <div class="chips">${["מה יש לי היום?", "מה באיחור?", "פגישות קרובות", "מה מצב הפרויקט של לוי?", "לידים פתוחים"].map(c => `<button class="chip" data-q="${c}">${c}</button>`).join("")}</div>
  <form class="tin"><input placeholder="או להקליד כאן…"><button class="btn a">שליחה</button></form>`;
  document.body.append(d);
  $("form", d).onsubmit = e => { e.preventDefault(); const i = $("input", d); ask(i.value); i.value = "" };
  const hello = `${new Date().getHours() < 12 ? "בוקר טוב" : "היי"} ${C.business.owner}. ${brief()}`;
  $(".ans", d).textContent = hello; say(hello); listen();
}
function closeTalk() { try { rec?.abort() } catch { } rec = null; speechSynthesis?.cancel(); $(".talk")?.remove(); go("today") }

/* ---------- events ---------- */
document.addEventListener("click", async e => {
  const t = e.target.closest("[data-go],[data-new],[data-done],[data-edit],[data-tab],[data-stage],[data-run],[data-draft],[data-ok],[data-del],[data-close],[data-copy],[data-editp],[data-addboq],[data-delboq],[data-csv],[data-leadrun],[data-leadwin],[data-mtgtasks],[data-xtalk],[data-q],[data-reset]"); if (!t) return;
  const D = t.dataset, p = view === "project" ? DB.get(arg) : null;
  if (D.go) return go(D.go, D.a);
  if (D.new) return form(D.new);
  if (D.done) { const x = DB.get(D.done); x.done = !x.done; await DB.put(x); return render() }
  if (D.edit) { const x = DB.get(D.edit); return form(x.kind, x) }
  if (D.editp) return form("project", DB.get(D.editp));
  if (D.tab) { ptab = D.tab; return render() }
  if (D.stage) { p.stage = +D.stage; await DB.put(p); toast("השלב עודכן: " + C.stages[p.stage]); return render() }
  if (D.run) { if (D.run === "plans") return $("#planF").click(); return runAgent(D.run, { project: p, mode: ptab === "tasks" ? "gaps" : "" }) }
  if (D.draft) return draftView(D.draft);
  if (D.ok) { const x = DB.get(D.ok); x.body = $("#dbody").value; x.status = "ok"; await DB.put(x); close(); render(); return toast("אושר ונשמר") }
  if (D.copy) { await navigator.clipboard?.writeText($("#dbody").value); return toast("הועתק") }
  if (D.del) { if (!confirm("למחוק?")) return; const wasP = DB.get(D.del)?.kind === "project"; await DB.del(D.del); close(); return wasP ? go("projects") : render() }
  if ("close" in D) return close();
  if ("addboq" in D) { await DB.put({ kind: "boq", project: p.id, sec: "נוספים", item: "", unit: "יח'", qty: 1, price: 0 }); return render() }
  if (D.delboq) { await DB.del(D.delboq); return render() }
  if ("csv" in D) { const rows = DB.all("boq", r => r.project === p.id), csv = "﻿פרק,סעיף,יחידה,כמות,מחיר יחידה,סה\"כ\n" + rows.map(r => [r.sec, r.item, r.unit, r.qty, r.price || "", (r.qty * r.price) || ""].map(x => `"${String(x).replace(/"/g, '""')}"`).join(",")).join("\n"), a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" })); a.download = `כתב-כמויות-${p.name}.csv`; a.click(); return }
  if (D.leadrun) { close(); return runAgent("leads", { lead: form.cur, mode: D.leadrun, extra: { lead: form.cur.id, mode: D.leadrun } }) }
  if ("leadwin" in D) { const l = form.cur; l.stage = "won"; await DB.put(l); const np = await DB.put({ kind: "project", name: l.what.split(",")[0] + " · " + l.name, client: l.name, phone: l.phone, city: "", type: "שיפוץ דירה", area: l.area || 0, stage: 0, budget: 0, due: "" }); close(); toast("נפתח פרויקט חדש"); return go("project", np.id) }
  if ("mtgtasks" in D) { const m = form.cur, notes = $("#frm [name=notes]").value; m.notes = notes; await DB.put(m); const ls = notes.split(/\n|\. /).map(s => s.replace(/^[\s•\-\d.)]+/, "").trim()).filter(s => s.length > 5 && /צריך|לבדוק|לשלוח|לתאם|להזמין|לאשר|לקבל|לסגור|להעביר|לקבוע/.test(s)); for (const s of ls) await DB.put({ kind: "task", project: m.project, title: s, due: plus(3), done: false, by: "buy" }); await log("buy", `הוציא ${ls.length} משימות מסיכום הפגישה עם ${m.supplier}`); close(); render(); return toast(ls.length ? `נוספו ${ls.length} משימות מהסיכום` : "לא מצאתי פעולות בסיכום") }
  if ("xtalk" in D) return closeTalk();
  if (D.q) return ask(D.q);
  if ("reset" in D) { if (confirm("לאפס את כל נתוני ההדגמה?")) { localStorage.removeItem(KEY); location.reload() } }
});
document.addEventListener("change", async e => {
  const t = e.target;
  if (t.dataset.boq) { const r = DB.get(t.dataset.boq); r[t.dataset.k] = t.type === "number" ? +t.value || 0 : t.value; await DB.put(r); if (t.type === "number") render() }
  if (t.id === "planF" && t.files[0]) runAgent("plans", { project: DB.get(arg), file: t.files[0] });
});
$("#modal").addEventListener("click", e => { if (e.target.id === "modal") close() });
window.addEventListener("hashchange", () => { const [v, a] = location.hash.slice(1).split("/"); if (v && (v !== view || (a || null) !== arg) && V[v]) { view = v; arg = a || null; render() } });

/* ---------- start ---------- */
(async () => {
  try { await DB.load() } catch (e) { $("#view").innerHTML = `<div class="card">לא הצלחתי לטעון נתונים: ${esc(e.message)}</div>`; return }
  if (!C.demo && !user) {
    $("#side").innerHTML = ""; top(esc(C.business.name), "כניסה");
    $("#view").innerHTML = `<div class="card" style="max-width:420px"><h3>כניסה למערכת</h3><form id="lg"><div class="f"><label>המייל שלך</label><input type="email" name="email" required></div><button class="btn a">שלחי לי קישור כניסה</button></form></div>`;
    $("#lg").onsubmit = async e => { e.preventDefault(); const { error } = await sb.auth.signInWithOtp({ email: e.target.email.value, options: { emailRedirectTo: location.href.split("#")[0], shouldCreateUser: false } }); toast(error ? error.message : "נשלח קישור למייל") };
    return;
  }
  const [v, a] = location.hash.slice(1).split("/"); if (v && V[v] && v !== "talk") { view = v; arg = a || null }
  render();
})();
