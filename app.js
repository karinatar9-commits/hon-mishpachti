import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm';

const SUPABASE_URL = 'https://tcnnmbmooynevstasgaj.supabase.co';
const SUPABASE_KEY = 'sb_publishable_qOxby8FAtaYFziBdLXIuUg_WB5Kp7lQ';
const sb = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'pkce' } });
const SITE = location.origin + location.pathname.replace(/[^/]*$/, '');

const $app = document.getElementById('app');
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const CATS = [
  { k: 'property', name: 'נדל״ן', short: 'נדל', color: '#FFA36B' },
  { k: 'funds', name: 'פנסיה וגמל', short: 'גמל', color: '#7EA6FF' },
  { k: 'cash', name: 'מזומן ופיקדונות', short: '₪', color: '#9FB0C2' },
  { k: 'crypto', name: 'קריפטו', short: '₿', color: '#4BE3B8' },
  { k: 'invest', name: 'חשבון השקעות', short: 'השק', color: '#5FD0F5' },
  { k: 'securities', name: 'ני״ע', short: 'ני״ע', color: '#C29BFF' },
  { k: 'metals', name: 'זהב וכסף', short: 'Au', color: '#E9C46A' }
];
const CAT = Object.fromEntries(CATS.map((c) => [c.k, c]));
const LEVEL = {
  bad: { label: 'דחוף', bg: 'rgba(255,138,122,0.16)', fg: '#FF9C8E' },
  warn: { label: 'לבדוק', bg: 'rgba(233,196,106,0.16)', fg: '#F0CF7E' },
  idea: { label: 'רעיון', bg: 'rgba(126,166,255,0.16)', fg: '#9DBBFF' },
  ok: { label: 'נסגר', bg: 'rgba(75,227,184,0.14)', fg: '#6FEBC6' }
};
const STATUS = {
  ok: { label: 'מעודכן', bg: 'rgba(75,227,184,0.14)', fg: '#6FEBC6' },
  warn: { label: 'לבדוק', bg: 'rgba(233,196,106,0.16)', fg: '#F0CF7E' },
  bad: { label: 'חסר', bg: 'rgba(255,138,122,0.16)', fg: '#FF9C8E' }
};
const ORDER = { bad: 0, warn: 1, idea: 2, ok: 3 };

const ui = { tab: 'home', owner: null, sub: null, cur: 'ILS', cf: 'all', inf: 'all', authMode: 'login', msg: null, busy: false };
let D = null; // loaded data
let ME = null;

/* ---------- formatting ---------- */
const iso = (t) => '\u2066' + t + '\u2069'; // keep signs and currency in left-to-right order inside Hebrew text
const fx = () => D.fx;
function money(v) {
  if (v == null || isNaN(v)) return 'חסר שווי';
  const n = ui.cur === 'USD' ? v / fx() : v;
  return iso((n < 0 ? '−' : '') + (ui.cur === 'USD' ? '$' : '₪') + Math.round(Math.abs(n)).toLocaleString('en-US'));
}
function short(v) {
  const n = ui.cur === 'USD' ? v / fx() : v; const a = Math.abs(n); let t;
  if (a >= 1e6) t = (a / 1e6).toFixed(2) + 'M'; else if (a >= 1e4) t = Math.round(a / 1e3) + 'K'; else t = Math.round(a).toLocaleString('en-US');
  return iso((n < 0 ? '−' : '') + (ui.cur === 'USD' ? '$' : '₪') + t);
}
const signed = (v) => iso((v > 0.5 ? '+' : '') + money(v));
function pct(p) { if (p == null || !isFinite(p)) return '—'; return iso((p > 0.05 ? '+' : p < -0.05 ? '−' : '') + Math.abs(p).toFixed(1) + '%'); }
const tone = (p) => (p > 0.05 ? '#4BE3B8' : p < -0.05 ? '#FF8A7A' : '#93A1B2');
function qty(q) { q = +q; if (q >= 1000) return Math.round(q).toLocaleString('en-US'); if (q >= 1) return (+q.toFixed(3)).toLocaleString('en-US', { maximumFractionDigits: 3 }); return String(+q.toFixed(6)); }
function uprice(p) { p = +p; if (p >= 100) return '$' + p.toLocaleString('en-US', { maximumFractionDigits: 2 }); if (p >= 1) return '$' + p.toFixed(2); if (p >= 0.01) return '$' + p.toFixed(4); return '$' + p.toFixed(6); }
const dayPart = (v, ch) => (ch ? (v * ch) / (100 + ch) : 0);

const ICON = {
  home: '<path d="M4 11l8-6 8 6v8a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z"/>',
  coin: '<circle cx="12" cy="12" r="8"/><path d="M10 8.5h3a1.8 1.8 0 0 1 0 3.5h-3zM10 12h3.5a1.8 1.8 0 0 1 0 3.5H10zM10 8.5v7M11.5 7v1.5M11.5 15.5V17"/>',
  market: '<path d="M4 18l5-6 4 3 7-8"/><path d="M15 7h5v5"/>',
  bulb: '<path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  back: '<path d="M9 6l6 6-6 6"/>',
  bank: '<path d="M4 10l8-5 8 5"/><path d="M6 10v8M10 10v8M14 10v8M18 10v8M4 20h16"/>'
};
const ic = (n, s = 24) => `<svg class="ic" width="${s}" height="${s}" viewBox="0 0 24 24" aria-hidden="true">${ICON[n]}</svg>`;

/* ---------- data ---------- */
async function loadData() {
  const res = await Promise.all([
    sb.from('owners').select('*').order('sort'),
    sb.from('settings').select('*'),
    sb.from('crypto_prices').select('*').order('sort'),
    sb.from('crypto_holdings').select('*'),
    sb.from('metals').select('*'),
    sb.from('securities').select('*').order('id'),
    sb.from('security_prices').select('*'),
    sb.from('funds').select('*').order('id'),
    sb.from('assets').select('*').order('id'),
    sb.from('insights').select('*').order('sort'),
    sb.from('analysis').select('*').eq('id', 1),
    sb.from('price_history').select('*').order('day'),
    sb.from('expenses').select('*').eq('id', 1)
  ]);
  const err = res.find((r) => r.error);
  if (err) throw err.error;
  const [owners, settings, prices, holdings, metals, secs, secp, funds, assets, insights, analysis, hist, exp] = res.map((r) => r.data || []);
  const S = Object.fromEntries(settings.map((r) => [r.key, r.value]));
  return {
    owners, prices, holdings, metals, secs, funds, assets, insights,
    secp: Object.fromEntries(secp.map((r) => [r.price_key, r])),
    analysis: analysis[0] || { headline: '', points: [] }, hist, exp: exp[0] ? exp[0].data : null,
    fx: +(S.fx || 3.1), gold: S.gold || { price: 0, chg: 0 }, silver: S.silver || { price: 0, chg: 0 }, asof: S.asof || ''
  };
}

function compute() {
  const PRICE = {}, CHG = {}, META = {};
  D.prices.forEach((p) => { PRICE[p.symbol] = +p.price_usd; CHG[p.symbol] = +p.chg_24h || 0; META[p.symbol] = p; });
  const OW = Object.fromEntries(D.owners.map((o) => [o.id, o]));
  const agg = {}, day = {};
  D.owners.forEach((o) => { agg[o.id] = { cats: Object.fromEntries(CATS.map((c) => [c.k, 0])), debt: 0, missing: 0, warn: 0, cVal: 0, cCost: 0 }; day[o.id] = 0; });
  const C = D.holdings.map((h) => { const v = +h.qty * (PRICE[h.symbol] || 0) * D.fx; const a = agg[h.owner]; if (a) { a.cats.crypto += v; a.cVal += v; a.cCost += +h.cost_ils; day[h.owner] += dayPart(v, CHG[h.symbol]); } return { ...h, value: v }; });
  const MT = D.metals.map((m) => { const px = m.metal === 'XAU' ? D.gold : D.silver; const v = +m.oz * +px.price * D.fx; const a = agg[m.owner]; if (a) { a.cats.metals += v; if (m.status !== 'ok') a.warn++; day[m.owner] += dayPart(v, +px.chg); } return { ...m, value: v }; });
  const SEC = D.secs.map((s) => { const p = D.secp[s.price_key] || { price: 0, as_of: '—' }; const v = s.currency === 'USD' ? +s.units * +p.price * D.fx : (+s.units * +p.price) / 100; const a = agg[s.owner]; if (a) a.cats.securities += v; return { ...s, value: v, as_of: p.as_of }; });
  D.funds.forEach((f) => { if (agg[f.owner]) agg[f.owner].cats.funds += +f.balance_ils; });
  D.assets.forEach((r) => { const a = agg[r.owner]; if (!a) return; if (r.status !== 'ok') a.warn++; if (r.value_ils == null) { a.missing++; return; } if (r.category === 'debt') a.debt += +r.value_ils; else a.cats[r.category] += +r.value_ils; });
  const fam = { cats: Object.fromEntries(CATS.map((c) => [c.k, 0])), debt: 0, personal: 0, companies: 0, gross: 0 };
  D.owners.forEach((o) => { const a = agg[o.id]; a.gross = CATS.reduce((s, c) => s + a.cats[c.k], 0); a.net = a.gross + a.debt; CATS.forEach((c) => (fam.cats[c.k] += a.cats[c.k])); fam.debt += a.debt; if (o.is_company) fam.companies += a.net; else fam.personal += a.net; });
  fam.gross = CATS.reduce((s, c) => s + fam.cats[c.k], 0); fam.net = fam.gross + fam.debt;
  fam.day = Object.values(day).reduce((s, v) => s + v, 0);
  const partAt = (fxv, g, s, cr) => { let t = 0; D.holdings.forEach((h) => (t += +h.qty * ((cr && cr[h.symbol]) || PRICE[h.symbol] || 0) * fxv)); D.metals.forEach((m) => (t += +m.oz * (m.metal === 'XAU' ? g : s) * fxv)); return t; };
  const nowPart = partAt(D.fx, +D.gold.price, +D.silver.price, PRICE);
  const hist = D.hist.slice(-30).map((h) => ({ d: h.day, v: fam.net - nowPart + partAt(+h.fx, +h.gold, +h.silver, h.crypto) }));
  return { PRICE, CHG, META, OW, agg, day, C, MT, SEC, fam, hist };
}

/* ---------- pieces ---------- */
function segs(cats, gross) {
  const list = CATS.filter((c) => cats[c.k] > 0).sort((a, b) => cats[b.k] - cats[a.k]);
  const bar = list.map((c) => `<i style="width:${((cats[c.k] / gross) * 100).toFixed(2)}%;background:${c.color}"></i>`).join('');
  const leg = list.map((c) => { const w = (cats[c.k] / gross) * 100; return `<div class="row" style="gap:8px;min-width:0"><i class="dot" style="background:${c.color}"></i><div class="col" style="min-width:0"><span class="small" style="color:#A7B6C4">${c.name} · ${w < 1 ? w.toFixed(1) : Math.round(w)}%</span><b class="num t14">${short(cats[c.k])}</b></div></div>`; }).join('');
  return `<div class="bar">${bar}</div><div class="legend">${leg}</div>`;
}
const curSeg = () => `<div class="seg" role="group" aria-label="מטבע"><button data-a="cur" data-v="ILS" class="${ui.cur === 'ILS' ? 'on' : ''}">₪</button><button data-a="cur" data-v="USD" class="${ui.cur === 'USD' ? 'on' : ''}">$</button></div>`;
const pill = (L, extra = '') => `<span class="pill" style="background:${L.bg};color:${L.fg}">${L.label}${extra}</span>`;
function insCard(r, withOwner, OW) {
  const L = LEVEL[r.level] || LEVEL.idea;
  return `<div class="ins"><div class="row" style="gap:6px">${pill(L)}${withOwner ? `<span class="small muted">${esc(OW[r.owner]?.name)}</span>` : ''}</div><b class="t15">${esc(r.title)}</b><p>${esc(r.body ?? r.text)}</p></div>`;
}
const spark = (hist, accent) => `<div class="spark">${hist.map((x, i, a) => { const vs = a.map((y) => y.v); const mn = Math.min(...vs), mx = Math.max(...vs); const h = a.length < 2 || mx === mn ? 60 : 12 + (88 * (x.v - mn)) / (mx - mn); return `<i style="height:${h.toFixed(1)}%;background:${i === a.length - 1 ? accent : '#2C3B4D'}"></i>`; }).join('')}</div>`;
function histLabel(hist) { if (hist.length < 2) return 'הגרף יתמלא מיום ליום — עדכון אוטומטי כל בוקר'; const d = hist[hist.length - 1].v - hist[0].v; const f = (s) => s.split('-').reverse().slice(0, 2).join('.'); return `${hist.length} ימים · ${signed(d)} מאז ${f(hist[0].d)}`; }

/* ---------- screens ---------- */
function home(X) {
  const { fam, OW, agg, hist } = X;
  const maxNet = Math.max(...D.owners.map((o) => agg[o.id].net));
  const owners = D.owners.map((o) => {
    const a = agg[o.id]; const plp = a.cCost ? ((a.cVal - a.cCost) / a.cCost) * 100 : null;
    const sub = [o.role_label]; if (a.warn) sub.push(a.warn + ' לבדוק'); if (a.missing) sub.push(a.missing + ' בלי שווי');
    return `<button class="ownercard" data-a="owner" data-v="${esc(o.id)}"><div class="row" style="width:100%"><div class="avatar" style="width:44px;height:44px;font-size:${o.initial.length > 1 ? 15 : 19}px;background:${esc(o.color)}">${esc(o.initial)}</div><div class="grow col"><b style="font-size:16px">${esc(o.name)}</b><span class="small muted">${esc(sub.join(' · '))}</span></div><div class="end"><b class="num" style="font-size:16px;font-weight:800">${short(a.net)}</b><span class="num small" style="font-weight:600;color:${a.cVal ? tone(plp) : '#93A1B2'}">${a.cVal ? 'קריפטו ' + pct(plp) : 'אין קריפטו'}</span></div></div><div class="thin"><i style="width:${Math.max(2, (a.net / maxNet) * 100).toFixed(1)}%;background:${esc(o.color)}"></i></div></button>`;
  }).join('');
  const alerts = D.insights.filter((r) => r.level === 'bad' || r.level === 'warn').sort((a, b) => ORDER[a.level] - ORDER[b.level] || a.sort - b.sort).slice(0, 4).map((r) => insCard(r, true, OW)).join('');
  return `
  <div class="between"><div class="col"><span class="s13 muted">מעודכן ${esc(D.asof)}</span><h1>הון משפחת עטר</h1></div>${curSeg()}</div>
  <div class="dgrid"><div class="dmain">
  <section class="hero"><span class="s13" style="color:#A9D9CB;font-weight:600">הון נטו · כל המשפחה והחברות</span>
    <b class="num big" style="font-size:42px">${money(fam.net)}</b>
    <div class="row" style="gap:8px;flex-wrap:wrap">
      <span class="pill num" style="font-size:12px;background:rgba(75,227,184,.14);color:#4BE3B8">אישי ${short(fam.personal)}</span>
      <span class="pill num" style="font-size:12px;background:rgba(255,255,255,.07);color:#C9D3DE">חברות ${short(fam.companies)}</span>
      <span class="pill num" style="font-size:12px;background:rgba(255,138,122,.12);color:#FF9C8E">משכנתאות ${short(fam.debt)}</span>
    </div>${segs(fam.cats, fam.gross)}</section>
  <button class="ownercard" data-a="tab" data-v="market" style="gap:10px;border-radius:22px;padding:16px">
    <div class="between" style="width:100%"><span class="small" style="font-weight:800;color:#4BE3B8">הניתוח של היום</span><span class="num s13" style="font-weight:800;color:${tone(fam.day)}">${signed(fam.day)} · ${pct((fam.day / (fam.net - fam.day)) * 100)}</span></div>
    <b style="font-size:16px;line-height:1.4">${esc(D.analysis.headline)}</b>${spark(hist, '#4BE3B8')}
    <span class="small muted">${esc(histLabel(hist))} · לניתוח המלא ›</span></button>
  </div><div class="dside">
  <div class="between"><h2>דורש תשומת לב</h2><button class="linkbtn" data-a="tab" data-v="ins">כל התובנות</button></div>
  <div class="col gap10">${alerts}</div></div></div>
  <div class="between"><h2>בני המשפחה</h2><span class="small muted">הקישו לפירוט</span></div>
  <div class="col gap10 owners">${owners}</div>`;
}

function person(X) {
  const { OW, agg, C, MT, SEC, fam, PRICE, META } = X;
  const o = OW[ui.owner]; const a = agg[o.id];
  const cr = C.filter((h) => h.owner === o.id).sort((x, y) => y.value - x.value);
  const fu = D.funds.filter((f) => f.owner === o.id);
  const as = D.assets.filter((r) => r.owner === o.id).map((r) => ({ ...r, cat: r.category })).concat(MT.filter((m) => m.owner === o.id).map((m) => { const pl = ((m.value - m.cost_ils) / m.cost_ils) * 100; return { item: m.item, note: `${m.note} · נקנו ב-₪${Math.round(m.cost_ils).toLocaleString('en-US')} · ${pl >= 0 ? '+' : '−'}${Math.abs(pl).toFixed(1)}% מהקנייה`, value_ils: m.value, status: m.status, as_of: m.as_of, cat: 'metals' }; }));
  const se = SEC.filter((s) => s.owner === o.id);
  const ins = D.insights.filter((r) => r.owner === o.id).sort((x, y) => ORDER[x.level] - ORDER[y.level] || x.sort - y.sort);
  const ex = o.id === 'karin' && ME && ME.admin && D.exp ? D.exp : null;
  const subs = [['crypto', 'קריפטו', cr.length], ['exp', 'הוצאות', ex ? (ex.alerts || []).length : 0], ['assets', 'נכסים', as.length], ['funds', 'קופות', fu.length], ['sec', 'ניירות ערך', se.length], ['ins', 'תובנות', ins.length]].filter((t) => t[2] > 0);
  const cur = subs.some((t) => t[0] === ui.sub) ? ui.sub : subs[0] && subs[0][0];
  let body = '';
  if (cur === 'crypto') {
    const plp = a.cCost ? ((a.cVal - a.cCost) / a.cCost) * 100 : 0;
    body = `<div class="tiles"><div class="tile"><span class="small muted">שווי</span><b class="num t15">${short(a.cVal)}</b></div><div class="tile"><span class="small muted">עלות</span><b class="num t15">${short(a.cCost)}</b></div><div class="tile"><span class="small muted">רווח/הפסד</span><b class="num t15" style="color:${tone(plp)}">${pct(plp)}</b><span class="num" style="font-size:11px;color:${tone(plp)}">${money(a.cVal - a.cCost)}</span></div></div>
    <div class="card list">${cr.map((h) => { const m = META[h.symbol] || {}; const pp = +h.cost_ils ? ((h.value - h.cost_ils) / h.cost_ils) * 100 : null; return `<div class="li"><div class="badge" style="background:${esc(m.color || '#A6B3C2')}">${esc(h.symbol)}</div><div class="grow col"><b class="t15">${esc(m.name_he || h.symbol)}</b><span class="num small muted">${qty(h.qty)} ${esc(h.symbol)} · ${uprice(PRICE[h.symbol] || 0)}</span></div><div class="end"><b class="num t15">${money(h.value)}</b><span class="num small" style="font-weight:700;color:${tone(pp)}">${pct(pp)} · ${money(h.value - h.cost_ils)}</span></div></div>`; }).join('')}</div>`;
  } else if (cur === 'exp') {
    const sp = (ex.spent / ex.salary) * 100; const bc = sp > 100 ? '#FF8A7A' : sp > 85 ? '#E9C46A' : '#4BE3B8';
    body = `<div class="panel"><div class="between"><span class="s13 muted" style="font-weight:600">הוצאות ${esc(ex.month)} · עד ${esc(ex.asof)}</span><span class="num small muted">${Math.round(sp)}% מהמשכורת</span></div>
      <b class="num big" style="font-size:34px">${money(ex.spent)}</b><div class="progress"><i style="width:${Math.min(100, sp).toFixed(1)}%;background:${bc}"></i></div>
      <span class="s13 soft" style="line-height:1.5">${esc(ex.forecast)} · משכורת ${money(ex.salary)} · בכרטיסים ${money(ex.cards)}</span>
      <span class="s13 muted" style="line-height:1.5">${esc(ex.base)}</span>
      <div class="between" style="padding-top:10px;border-top:1px solid var(--line)"><span class="s13 muted">כרית ביטחון בעו״ש · ${esc(ex.cushionGoal)}</span><b class="num t15">${money(ex.cushion)}</b></div></div>
      <span class="s13 muted" style="font-weight:800">חיובים קרובים</span>
      <div class="card list">${(ex.cycles || []).map((r) => `<div class="li"><div class="date">${esc(r[1])}</div><div class="grow col"><b class="t14">${esc(r[0])}</b><span class="small muted">${esc(r[3])}</span></div><b class="num t15">${money(r[2])}</b></div>`).join('')}</div>
      <span class="s13 muted" style="font-weight:800">החד־פעמיים הגדולים של החודש</span>
      <div class="card list">${(ex.big || []).map((r) => `<div class="li"><div class="grow col"><b class="t14">${esc(r[0])}</b><span class="small muted">${esc(r[1])}</span></div><b class="num t15">${money(r[2])}</b></div>`).join('')}</div>
      <span class="s13 muted" style="font-weight:800">מה עלה בבדיקה השבועית</span>
      ${(ex.alerts || []).map((r) => insCard({ level: r[0], title: r[1], body: r[2] }, false, OW)).join('')}`;
  } else if (cur === 'assets') {
    body = `<div class="card list">${as.map((r) => { const st = STATUS[r.status] || STATUS.ok; const c = CAT[r.cat]; const debt = r.cat === 'debt'; return `<div class="li top"><div class="badge" style="background:${debt ? 'rgba(255,138,122,.16)' : '#1B2531'};color:${debt ? '#FF9C8E' : c ? c.color : '#C9D3DE'};font-size:12px">${debt ? '−' : c ? c.short : ''}</div><div class="grow col gap6" style="gap:3px"><b class="t15" style="line-height:1.3">${esc(r.item)}</b><span class="small muted" style="line-height:1.45">${esc(r.note || '')}</span>${pill(st, ' · ' + esc(r.as_of || ''))}</div><b class="num t15" style="white-space:nowrap;color:${r.value_ils != null && r.value_ils < 0 ? '#FF9C8E' : '#EEF3F8'}">${money(r.value_ils == null ? null : +r.value_ils)}</b></div>`; }).join('')}</div>`;
  } else if (cur === 'funds') {
    body = `<div class="card list">${fu.map((f) => `<div class="li"><div class="badge" style="background:#1E2A44;color:#7EA6FF">${ic('bank', 20)}</div><div class="grow col"><b class="t15">${esc(f.provider)}</b><span class="small muted">${esc(f.kind)} · נכון ל-${esc(f.as_of)}</span></div><b class="num t15">${money(+f.balance_ils)}</b></div>`).join('')}</div>`;
  } else if (cur === 'sec') {
    body = `<span class="s13 muted">המחירים מתעדכנים כל בוקר מהבורסה</span><div class="card list">${se.map((s) => { const pp = ((s.value - s.cost_ils) / s.cost_ils) * 100; return `<div class="li"><div class="grow col"><b class="t14">${esc(s.name)}</b><span class="small muted">${esc(s.type_label)} · מחיר ${esc(s.as_of)} · עלות ${money(+s.cost_ils)}</span></div><div class="end"><b class="num t15">${money(s.value)}</b><span class="num small" style="font-weight:700;color:${tone(pp)}">${pct(pp)} · ${money(s.value - s.cost_ils)}</span></div></div>`; }).join('')}</div>`;
  } else if (cur === 'ins') {
    body = ins.map((r) => insCard(r, false, OW)).join('');
  }
  let subline = 'ברוטו ' + short(a.gross); if (a.debt) subline += ' · משכנתא ' + short(a.debt); if (a.missing) subline += ' · ' + a.missing + ' נכס בלי שווי';
  return `
  <div class="between"><button class="back" data-a="back" aria-label="חזרה למשפחה">${ic('back', 18)} משפחה</button>${curSeg()}</div>
  <div class="row" style="gap:14px"><div class="avatar" style="width:56px;height:56px;border-radius:18px;font-size:${o.initial.length > 1 ? 18 : 24}px;background:${esc(o.color)}">${esc(o.initial)}</div><div class="col"><h1 style="font-size:26px">${esc(o.name)}</h1><span class="s13 muted">${esc(o.role_label)} · ${Math.round((a.net / fam.net) * 100)}% מההון המשפחתי</span></div></div>
  <div class="panel"><span class="s13 muted" style="font-weight:600">הון נטו</span><b class="num big" style="font-size:38px;font-weight:800">${money(a.net)}</b><span class="s13 muted">${esc(subline)}</span>${segs(a.cats, a.gross || 1)}</div>
  <div class="chips">${subs.map((t) => `<button class="chip ${t[0] === cur ? 'on' : ''}" data-a="sub" data-v="${t[0]}">${t[1]} <span style="opacity:.7;font-weight:500">${t[2]}</span></button>`).join('')}</div>
  <div class="col gap10 ${cur === 'ins' ? 'insgrid' : 'pbody'}">${body}</div>`;
}

function cryptoTab(X) {
  const { C, OW, agg, META } = X;
  const owners = D.owners.filter((o) => agg[o.id].cVal > 0);
  const chips = [['all', 'כולם']].concat(owners.map((o) => [o.id, o.name]));
  const by = {}; let tv = 0, tc = 0;
  C.forEach((h) => { if (ui.cf !== 'all' && h.owner !== ui.cf) return; const b = by[h.symbol] || (by[h.symbol] = { q: 0, v: 0, c: 0, who: [] }); b.q += +h.qty; b.v += h.value; b.c += +h.cost_ils; if (!b.who.includes(OW[h.owner].name)) b.who.push(OW[h.owner].name); tv += h.value; tc += +h.cost_ils; });
  const tp = tc ? ((tv - tc) / tc) * 100 : 0;
  const rows = Object.keys(by).sort((x, y) => by[y].v - by[x].v).map((k) => { const b = by[k]; const m = META[k] || {}; const pp = b.c ? ((b.v - b.c) / b.c) * 100 : null; return `<div class="li"><div class="badge" style="background:${esc(m.color || '#A6B3C2')}">${esc(k)}</div><div class="grow col"><b class="t15">${esc(m.name_he || k)}</b><span class="num small muted">${qty(b.q)} ${esc(k)} · ${esc(b.who.length > 2 ? b.who.length + ' בעלים' : b.who.join(', '))}</span></div><div class="end"><b class="num t15">${money(b.v)}</b><span class="num small" style="font-weight:700;color:${tone(pp)}">${pct(pp)}</span></div></div>`; }).join('');
  return `
  <div class="between"><h1>קריפטו</h1>${curSeg()}</div>
  <div class="panel"><span class="s13 muted" style="font-weight:600">${ui.cf === 'all' ? 'כל הקריפטו של המשפחה' : 'הקריפטו של ' + esc(OW[ui.cf].name)}</span><b class="num big" style="font-size:38px;font-weight:800">${money(tv)}</b>
    <div class="row" style="gap:8px;flex-wrap:wrap"><span class="pill num" style="font-size:13px;background:${tp >= 0 ? 'rgba(75,227,184,.14)' : 'rgba(255,138,122,.14)'};color:${tone(tp)}">${pct(tp)} · ${money(tv - tc)}</span><span class="num small muted">עלות ${money(tc)}</span></div></div>
  <div class="chips">${chips.map((c) => `<button class="chip ${ui.cf === c[0] ? 'on' : ''}" data-a="cf" data-v="${esc(c[0])}">${esc(c[1])}</button>`).join('')}</div>
  <div class="card list">${rows}</div>`;
}

function marketTab(X) {
  const { fam, day, OW, hist, META } = X;
  const prev = D.hist.length > 1 ? +D.hist[D.hist.length - 2].fx : null; const fxc = prev ? ((D.fx - prev) / prev) * 100 : null;
  const macro = [['דולר/שקל', '₪' + D.fx.toFixed(3), fxc == null ? 'שער יציג' : pct(fxc), fxc == null ? '#93A1B2' : tone(fxc)], ['זהב · אונקיה', '$' + (+D.gold.price).toLocaleString('en-US', { maximumFractionDigits: 2 }), pct(+D.gold.chg), tone(+D.gold.chg)], ['כסף · אונקיה', '$' + (+D.silver.price).toFixed(2), pct(+D.silver.chg), tone(+D.silver.chg)]];
  const ownersDay = D.owners.filter((o) => Math.abs(day[o.id]) >= 1).map((o) => `<span class="num row small" style="gap:6px;font-weight:700;padding:4px 10px 4px 4px;border-radius:14px;background:#0F161E;border:1px solid var(--line)"><i class="avatar" style="width:20px;height:20px;border-radius:7px;font-size:10px;font-style:normal;background:${esc(o.color)}">${esc(o.initial)}</i>${esc(o.name)} <span style="color:${tone(day[o.id])}">${signed(day[o.id])}</span></span>`).join('');
  const points = (D.analysis.points || []).map((p) => insCard({ level: p.level, title: p.title, body: p.text }, false, OW)).join('');
  const list = D.prices.map((p) => { const ip = +p.price_usd * D.fx; return `<div class="li"><div class="badge" style="width:36px;height:36px;border-radius:12px;font-size:10px;background:${esc(p.color)}">${esc(p.symbol)}</div><div class="grow col"><b class="t15">${esc(p.name_he)}</b><span class="num small muted">₪${ip >= 100 ? Math.round(ip).toLocaleString('en-US') : ip >= 1 ? ip.toFixed(2) : ip.toFixed(4)}</span></div><div class="end"><b class="num t15">${uprice(p.price_usd)}</b><span class="num small" style="font-weight:700;color:${p.chg_24h == null ? '#93A1B2' : tone(+p.chg_24h)}">${p.chg_24h == null ? 'אין נתון' : pct(+p.chg_24h)}</span></div></div>`; }).join('');
  return `
  <div class="between"><div class="col"><h1>שוק וניתוח</h1><span class="s13 muted">מעודכן ${esc(D.asof)} · מתעדכן אוטומטית כל בוקר</span></div>${curSeg()}</div>
  <div class="dgrid"><div class="dmain">
  <div class="panel"><span class="s13 muted" style="font-weight:600">השינוי ב-24 שעות · קריפטו ומתכות</span>
    <div class="row" style="gap:10px;align-items:baseline;flex-wrap:wrap"><b class="num big" style="font-size:32px;font-weight:800;color:${tone(fam.day)}">${signed(fam.day)}</b><span class="num t14" style="color:${tone(fam.day)}">${pct((fam.day / (fam.net - fam.day)) * 100)} מההון</span></div>
    ${spark(hist, '#4BE3B8')}<span class="small muted">${esc(histLabel(hist))}</span><div class="row" style="flex-wrap:wrap;gap:8px">${ownersDay}</div></div>
  <h2>${esc(D.analysis.headline)}</h2>${points}<span class="muted" style="font-size:11.5px">מידע וניתוח בלבד, לא ייעוץ השקעות.</span>
  </div><div class="dside"><h2>שערים</h2><div class="tiles">${macro.map((m) => `<div class="tile"><span class="small muted">${m[0]}</span><b class="num" style="font-size:16px;font-weight:800">${m[1]}</b><span class="num small" style="font-weight:700;color:${m[3]}">${m[2]}</span></div>`).join('')}</div>
  <div class="card list">${list}</div></div></div>`;
}

function insTab(X) {
  const { OW } = X;
  const chips = [['all', 'הכל']].concat(D.owners.map((o) => [o.id, o.name]));
  const list = D.insights.filter((r) => ui.inf === 'all' || r.owner === ui.inf).sort((a, b) => ORDER[a.level] - ORDER[b.level] || a.sort - b.sort);
  const nb = D.insights.filter((r) => r.level === 'bad').length, nw = D.insights.filter((r) => r.level === 'warn').length;
  return `<div class="col"><h1>תובנות</h1><span class="s13 muted">${nb} דחופים · ${nw} לבדוק · ${D.insights.length} בסך הכל</span></div>
  <div class="chips">${chips.map((c) => `<button class="chip ${ui.inf === c[0] ? 'on' : ''}" data-a="inf" data-v="${esc(c[0])}">${esc(c[1])}</button>`).join('')}</div>
  <div class="col gap10 insgrid">${list.map((r) => insCard(r, true, OW)).join('')}</div>`;
}

let members = null;
function meTab() {
  const admin = ME && ME.admin;
  const mem = admin && members ? members.map((m) => `<div class="li"><div class="grow col"><b class="t14">${esc(m.display_name || '')}</b><span class="small muted" style="direction:ltr;text-align:right">${esc(m.email)}</span></div><span class="pill" style="background:${m.role === 'admin' ? 'rgba(75,227,184,.14)' : 'rgba(255,255,255,.07)'};color:${m.role === 'admin' ? '#6FEBC6' : '#C9D3DE'}">${m.role === 'admin' ? 'מנהלת' : 'צפייה'}</span></div>`).join('') : '';
  return `<div class="col"><h1>החשבון שלי</h1><span class="s13 muted">${esc(ME?.name || '')}</span></div>
  ${admin ? `<div class="col gap10"><h2>ניהול גישה</h2><span class="s13 muted" style="line-height:1.5">רק מי שברשימה יכול להירשם. מוסיפים כל אחד רק כשהוא מוכן להירשם מיד.</span>
    <div class="card list">${mem || '<div class="li"><span class="muted s13">טוען…</span></div>'}</div>
    <form class="card pad col gap10" data-form="add" onsubmit="return false">
      <div class="field"><label for="am-name">שם</label><input id="am-name" name="name" autocomplete="off" required></div>
      <div class="field"><label for="am-email">אימייל</label><input id="am-email" name="email" type="email" autocomplete="off" required></div>
      <button class="primary" data-a="addmember">הוספה לרשימה</button>
      ${ui.msg ? `<div class="msg ${ui.msg.ok ? 'ok' : 'err'}">${esc(ui.msg.t)}</div>` : ''}
    </form></div>` : ''}
  <div class="card pad col gap6"><b class="t15">התקנה במסך הבית</b><ol style="margin:0;padding-inline-start:20px;color:var(--soft);font-size:14px;line-height:1.7"><li>אייפון: בספארי ← כפתור השיתוף ← ״הוספה למסך הבית״</li><li>אנדרואיד: בכרום ← ⋮ ← ״הוספה למסך הבית״</li></ol></div>
  <button class="primary" style="background:#1B2531;color:#FF9C8E" data-a="logout">התנתקות</button>`;
}

function nav() {
  const it = [['home', 'בית', 'home'], ['crypto', 'קריפטו', 'coin'], ['market', 'שוק', 'market'], ['ins', 'תובנות', 'bulb'], ['me', 'חשבון', 'user']];
  return `<nav class="nav" aria-label="ניווט"><div class="nav-brand"><img src="icon-192.png" alt=""><b>הון משפחתי</b></div>${it.map((t) => `<button data-a="tab" data-v="${t[0]}" class="${!ui.owner && ui.tab === t[0] ? 'on' : ''}" aria-label="${t[1]}">${ic(t[2])}${t[1]}</button>`).join('')}</nav>`;
}

function installSheet() {
  const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  let dismissed = false; try { dismissed = localStorage.getItem('hon-install') === '1'; } catch (e) {}
  if (standalone || dismissed || !/Mobi|Android|iPhone/i.test(navigator.userAgent)) return '';
  return `<div class="sheet" role="dialog" aria-label="הוספה למסך הבית"><b style="font-size:17px">הוספה למסך הבית</b><span class="s13 muted">כך האפליקציה תיפתח במסך מלא, כמו כל אפליקציה בטלפון.</span><ol><li>אייפון: בספארי ← כפתור השיתוף ← ״הוספה למסך הבית״</li><li>אנדרואיד: בכרום ← ⋮ ← ״הוספה למסך הבית״</li></ol><button class="primary" data-a="dismiss-install">הבנתי</button></div>`;
}

/* ---------- auth screens ---------- */
const EYE_OPEN = '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>';
const EYE_OFF = '<path d="M3 3l18 18"/><path d="M10.6 5.1A10.8 10.8 0 0 1 12 5c6.4 0 10 7 10 7a17.6 17.6 0 0 1-3.2 4.2M6.6 6.6C3.8 8.3 2 12 2 12s3.6 7 10 7a10 10 0 0 0 5.4-1.6"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/>';
const EYE = `<button type="button" class="eye" data-a="eye" aria-label="הצגת הסיסמה" aria-pressed="false"><svg class="ic" width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">${EYE_OPEN}</svg></button>`;
function authView() {
  const m = ui.authMode;
  const title = { login: 'כניסה', signup: 'הרשמה ראשונה', forgot: 'איפוס סיסמה', newpass: 'סיסמה חדשה' }[m];
  const fields = m === 'newpass'
    ? `<div class="field"><label for="pw">סיסמה חדשה (לפחות 10 תווים)</label><div class="pw"><input id="pw" type="password" autocomplete="new-password" minlength="10" required>${EYE}</div></div>`
    : `<div class="field"><label for="em">אימייל</label><input id="em" type="email" autocomplete="email" inputmode="email" required></div>` +
      (m === 'forgot' ? '' : `<div class="field"><label for="pw">סיסמה${m === 'signup' ? ' (לפחות 10 תווים)' : ''}</label><div class="pw"><input id="pw" type="password" autocomplete="${m === 'signup' ? 'new-password' : 'current-password'}" ${m === 'signup' ? 'minlength="10"' : ''} required>${EYE}</div></div>`);
  return `<div class="auth"><div class="auth-art"><img class="brand" src="splash.jpg" alt="GoldChain Wealth"></div><div class="auth-form">
    <div class="col" style="gap:2px"><h1 style="font-size:28px">הון משפחתי</h1><span class="muted">${title} · לבני המשפחה בלבד</span></div>
    <form class="col gap14" data-form="auth" onsubmit="return false">${fields}
      <button class="primary" data-a="auth-submit" ${ui.busy ? 'disabled' : ''}>${{ login: 'כניסה', signup: 'יצירת חשבון', forgot: 'שליחת קישור לאיפוס', newpass: 'שמירת הסיסמה' }[m]}</button></form>
    ${ui.msg ? `<div class="msg ${ui.msg.ok ? 'ok' : 'err'}">${esc(ui.msg.t)}</div>` : ''}
    ${m === 'newpass' ? '' : `<div class="between">${m !== 'login' ? '<button class="ghost" data-a="mode" data-v="login">יש לי חשבון</button>' : '<button class="ghost" data-a="mode" data-v="signup">הרשמה ראשונה</button>'}${m !== 'forgot' ? '<button class="ghost" style="color:#4BE3B8" data-a="mode" data-v="forgot">שכחתי סיסמה</button>' : ''}</div>`}
  </div></div>`;
}

function denied() {
  return `<div class="auth"><div class="auth-art"><img class="brand" src="splash.jpg" alt="GoldChain Wealth"></div><div class="auth-form"><h1>אין גישה</h1><p class="muted" style="line-height:1.6">החשבון מחובר, אבל עדיין אין לו הרשאה לנתונים. אם זה עתה נרשמת — אשר/י את מייל האימות ונסה/י שוב. אחרת, פנו לקרין.</p><button class="primary" data-a="reload">ניסיון נוסף</button><button class="ghost" data-a="logout">התנתקות</button></div></div>`;
}

/* ---------- render ---------- */
function render() {
  const scrollY = window.scrollY;
  if (ui.authMode === 'newpass' || !session) { $app.innerHTML = authView(); return; }
  if (!ME || !ME.family) { $app.innerHTML = denied(); return; }
  if (!D) { $app.innerHTML = `<div class="scroll"><div class="skel" style="height:60px"></div><div class="skel" style="height:240px"></div><div class="skel" style="height:140px"></div><div class="skel" style="height:300px"></div></div>${nav()}`; return; }
  const X = compute();
  let html;
  if (ui.owner) html = person(X);
  else if (ui.tab === 'crypto') html = cryptoTab(X);
  else if (ui.tab === 'market') html = marketTab(X);
  else if (ui.tab === 'ins') html = insTab(X);
  else if (ui.tab === 'me') html = meTab();
  else html = home(X);
  $app.innerHTML = `<main class="scroll">${html}</main>${nav()}${installSheet()}`;
  return scrollY;
}
const go = (keepScroll) => { const y = window.scrollY; render(); window.scrollTo(0, keepScroll ? y : 0); };

/* ---------- actions ---------- */
let session = null;
async function refreshAll() {
  const { data } = await sb.rpc('whoami');
  ME = data || { family: false };
  if (ME.family) { try { D = await loadData(); } catch (e) { console.error(e); } }
  go();
}

$app.addEventListener('click', async (e) => {
  const b = e.target.closest('[data-a]'); if (!b) return;
  const a = b.dataset.a, v = b.dataset.v;
  if (a === 'cur') { ui.cur = v; return go(true); }
  if (a === 'tab') { ui.tab = v; ui.owner = null; ui.msg = null; if (v === 'me' && ME && ME.admin) loadMembers(); return go(); }
  if (a === 'owner') { ui.owner = v; ui.sub = null; return go(); }
  if (a === 'back') { ui.owner = null; return go(); }
  if (a === 'sub') { ui.sub = v; return go(true); }
  if (a === 'cf') { ui.cf = v; return go(true); }
  if (a === 'inf') { ui.inf = v; return go(true); }
  if (a === 'mode') { ui.authMode = v; ui.msg = null; return go(); }
  if (a === 'reload') return refreshAll();
  if (a === 'dismiss-install') { try { localStorage.setItem('hon-install', '1'); } catch (er) {} return go(true); }
  if (a === 'logout') { await sb.auth.signOut(); session = null; D = null; ME = null; ui.authMode = 'login'; ui.tab = 'home'; return go(); }
  if (a === 'eye') { const i = document.getElementById('pw'); const show = i.type === 'password'; i.type = show ? 'text' : 'password'; b.setAttribute('aria-pressed', String(show)); b.setAttribute('aria-label', show ? 'הסתרת הסיסמה' : 'הצגת הסיסמה'); b.querySelector('svg').innerHTML = show ? EYE_OFF : EYE_OPEN; i.focus(); return; }
  if (a === 'auth-submit') return submitAuth();
  if (a === 'addmember') return addMember();
});

async function submitAuth() {
  const em = document.getElementById('em')?.value.trim(), pw = document.getElementById('pw')?.value || '';
  ui.busy = true; ui.msg = null; go(true);
  try {
    if (ui.authMode === 'login') {
      const { error } = await sb.auth.signInWithPassword({ email: em, password: pw });
      if (error) throw new Error(/confirm/i.test(error.message) ? 'צריך קודם לאשר את מייל האימות.' : 'אימייל או סיסמה שגויים.');
    } else if (ui.authMode === 'signup') {
      if (pw.length < 10) throw new Error('הסיסמה צריכה להיות לפחות 10 תווים.');
      const { error } = await sb.auth.signUp({ email: em, password: pw, options: { emailRedirectTo: SITE } });
      if (error) throw new Error(/authoriz|מורשית|Database error/i.test(error.message) ? 'הכתובת הזו לא מורשית. פנו לקרין.' : 'ההרשמה לא הצליחה. נסו שוב.');
      ui.msg = { ok: true, t: 'שלחנו מייל אימות. יש לאשר אותו ואז להיכנס.' }; ui.authMode = 'login';
    } else if (ui.authMode === 'forgot') {
      await sb.auth.resetPasswordForEmail(em, { redirectTo: SITE });
      ui.msg = { ok: true, t: 'אם הכתובת רשומה, נשלח אליה קישור לאיפוס.' };
    } else if (ui.authMode === 'newpass') {
      if (pw.length < 10) throw new Error('הסיסמה צריכה להיות לפחות 10 תווים.');
      const { error } = await sb.auth.updateUser({ password: pw });
      if (error) throw new Error('לא הצלחנו לשמור. נסו שוב.');
      ui.authMode = 'login'; ui.msg = null;
    }
  } catch (err) { ui.msg = { ok: false, t: err.message }; }
  ui.busy = false; go(true);
}

async function loadMembers() {
  const { data } = await sb.from('family_members').select('*').order('role').order('email');
  members = data || []; if (ui.tab === 'me') go(true);
}
async function addMember() {
  const name = document.getElementById('am-name').value.trim(), email = document.getElementById('am-email').value.trim();
  if (!name || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { ui.msg = { ok: false, t: 'צריך שם ואימייל תקין.' }; return go(true); }
  const { error } = await sb.rpc('admin_add_member', { _email: email, _name: name, _role: 'member' });
  ui.msg = error ? { ok: false, t: 'ההוספה נכשלה.' } : { ok: true, t: `${name} נוסף/ה. עכשיו אפשר לשלוח לו/ה את הקישור.` };
  await loadMembers();
}

sb.auth.onAuthStateChange((evt, s) => {
  session = s;
  if (evt === 'PASSWORD_RECOVERY') { ui.authMode = 'newpass'; return go(); }
  if (evt === 'SIGNED_IN' || evt === 'INITIAL_SESSION') { if (s) refreshAll(); else go(); }
  if (evt === 'SIGNED_OUT') go();
});

if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
