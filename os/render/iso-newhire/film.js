// העובד החדש — a small office where the new employee's desk is always empty, yet work keeps flying off it.
// The team guesses who it is; the twist: an AI agent working inside the office's own systems. 1080×1920, 30 fps, metres.
import { iso, tri, C, TOPS, LEGS, W, H, onPlane, quad, fillPoly, rect, tracePath, phraseLayout, floorType, phraseBox, drawPerson,
  font, mix, hex, css, clamp, lerp, seg, ss, eo, eio, TAU } from './kit.js';

export const LINES = [
  'גייסתי לעסק עובד חדש. הוא עונה ללקוחות תוך דקה, ואף אחד בצוות לא ראה אותו אף פעם.',
  'לקוח שואל כמה זה עולה, ותוך דקה כבר יש לו הצעת מחיר. חשבונית? כבר יצאה.',
  'הצוות התחיל לנחש. אולי זה הבן של הבוס? אולי פרילנסר מחו״ל?',
  'אבל הדבר הכי מוזר: הוא לא מבקש העלאה, ולא לוקח חופש.',
  'והוא אף פעם לא שולח כלום בלי שאני מאשרת.',
  'אז הנה הסוד: העובד החדש הוא סוכן בינה מלאכותית, והוא עובד בתוך המערכות שכבר יש לי.',
  'רוצים עובד כזה? תגיבו: עובד, ואשלח לכם מה הוא יכול לעשות אצלכם.',
];
export const VO_DUR = [6.100, 5.895, 5.385, 4.293, 3.006, 6.216, 4.956];
const GAPS = [.25, .3, .45, .3, .6, .3];          // .6: the held breath before the reveal
export const VO = []; { let t = .15; VO_DUR.forEach((d, i) => { VO.push(+t.toFixed(3)); t += d + (GAPS[i] ?? 0); }); }
const NL = LINES.length;
const B = i => [VO[i], i < NL - 1 ? VO[i + 1] : VO[NL - 1] + VO_DUR[NL - 1] + .3];
const END = VO[NL - 1] + VO_DUR[NL - 1] + .35;
export const DUR = +(END + 6.2).toFixed(2);
const at_ = (i, f) => VO[i] + VO_DUR[i] * f;

const P = { floor: '#F2E5CE', grid: '#E7D6B9', wall: '#F4ECDD', wood: '#C79B6E', shelf: '#3D6B59', chair: '#A7C2B2', dark: '#3A3E3B', paper: '#FBF6EC', note: ['#E9C77A', '#A7C2B2', '#EDBFA9', '#D3C29E'] };
const DOOR = [3.0, 4.3];
// desks: [x, y, w, d]
const GHOST = [5.6, 3.9, 1.8, 1.0], DA = [1.6, 3.9, 1.8, 1.0], DB = [1.6, 6.9, 1.8, 1.0], DO = [5.6, 7.0, 1.8, 1.0];
const GC = [GHOST[0] + .9, GHOST[1] + .5];          // centre of the empty desk
const ST = { phone: [1.6, 1.6], shelf: [.7, 6.0], board: [7.3, .6], owner: [DO[0] + .9, DO[1] + .5] };
const BR = { phone: [GC, [GC[0], 2.2], [1.6, 2.2]], shelf: [GC, [GC[0], 6.0], [.75, 6.0]], board: [GC, [GC[0], 2.2], [7.3, 2.2], [7.3, .6]], owner: [GC, [GC[0], DO[1] - .2]] };
const PEOPLE = { a: { h: 1.74, top: TOPS[1], legs: LEGS[1] }, b: { h: 1.66, top: TOPS[3], legs: LEGS[3], hairLong: true }, owner: { h: 1.68, top: TOPS[0], legs: LEGS[0], hairLong: true } };

function floor(g) {
  fillPoly(g, quad(rect(0, 10, 0, 10), 0), P.floor);
  g.save(); g.strokeStyle = P.grid; g.lineWidth = Math.max(1, iso.cam.k * .012);
  for (let i = 1; i < 10; i++) { g.beginPath(); g.moveTo(...iso.P(i, 0, 0)); g.lineTo(...iso.P(i, 10, 0)); g.stroke(); g.beginPath(); g.moveTo(...iso.P(0, i, 0)); g.lineTo(...iso.P(10, i, 0)); g.stroke(); }
  g.restore();
  // a soft pool of light under the empty desk, the only warm spot in the room
  const [cx, cy] = iso.P(GC[0], GC[1] + .9, 0); const r = iso.cam.k * 1.6; const gr = g.createRadialGradient(cx, cy, 0, cx, cy, r);
  gr.addColorStop(0, 'rgba(237,191,169,.55)'); gr.addColorStop(1, 'rgba(237,191,169,0)'); g.fillStyle = gr; g.beginPath(); g.ellipse(cx, cy, r, r * .58, 0, 0, TAU); g.fill();
}
function walls(g, t) {
  iso.boxNow(-.25, -.25, 0, .25, 10.25, 2.7, tri(P.wall, .05, .12));
  iso.boxNow(0, -.25, 0, 10, .25, 2.7, tri(P.wall, .05, .12));
  onPlane(g, 2.6, 0, 2.2, 'xz', g2 => { g2.fillStyle = '#CFE0DA'; g2.fillRect(0, 0, 2.4, 1.2); g2.fillStyle = P.wall; g2.fillRect(1.17, 0, .06, 1.2); });
  const rem = ss(seg(t, ARR.board, ARR.board + .4));
  onPlane(g, 6.3, 0, 2.15, 'xz', g2 => { g2.fillStyle = '#B58A5E'; g2.fillRect(0, 0, 2.2, 1.2); g2.fillStyle = '#D7B48A'; g2.fillRect(.06, .06, 2.08, 1.08);
    [[.15, .12], [.65, .1], [1.2, .18], [1.6, .12], [.3, .6], [.9, .58], [1.45, .64]].forEach(([u, v], j) => { g2.fillStyle = j === 3 ? hex(mix(P.note[j % 4], C.accent, rem)) : P.note[j % 4]; g2.fillRect(u, v, .38, .36); }); });
  iso.boxNow(0, 4.8, 0, .45, 2.4, 1.6, tri(P.shelf));
  const lit = ss(seg(t, ARR.shelf, ARR.shelf + .3));
  [5.0, 5.45, 5.9, 6.35, 6.8].forEach((y, j) => onPlane(g, .45, y + .18, 1.38, 'yz', g2 => { g2.fillStyle = hex(mix(P.paper, C.accent, j === 2 ? lit * .85 : 0)); g2.fillRect(0, 0, .36, .9); }));
}
function nearWalls() {
  iso.box(10, 0, 0, .25, 10.25, .45, tri(P.wall, .05, .12), { bias: -.2 });
  iso.box(0, 10, 0, DOOR[0], .25, .45, tri(P.wall, .05, .12), { bias: -.2 });
  iso.box(DOOR[1], 10, 0, 10 - DOOR[1], .25, .45, tri(P.wall, .05, .12), { bias: -.2 });
}
function desk(D, screenGlow = 0) {
  iso.box(D[0], D[1], 0, D[2], D[3], .75, tri(P.wood));
  iso.box(D[0] + .6, D[1] + .25, .75, .58, .42, .03, tri(P.dark), { bias: -.4 });
  // laptop lid standing at the far edge; the empty desk's screen glows in the accent
  iso.box(D[0] + .6, D[1] + .2, .78, .58, .04, .38, tri(hex(mix(P.dark, C.accent, screenGlow))), { bias: -.3 });
}
function chair(x, y) { iso.box(x, y, 0, .5, .5, .45, tri(P.chair)); iso.box(x, y + .45, .45, .5, .08, .55, tri(P.chair), { bias: -.2 }); }
function furniture(t) {
  const pulse = .55 + .35 * Math.sin(t * 3.2), reveal = ss(seg(t, B(5)[0] - .1, B(5)[0] + .5));
  desk(GHOST, Math.min(1, pulse + reveal)); chair(GC[0] - .25, GHOST[1] + 1.25);
  desk(DA); desk(DB); desk(DO);
  iso.box(1.1, .9, 0, 1.1, .8, .8, tri(P.wood)); iso.box(1.45, 1.1, .8, .26, .42, .03, tri(P.dark), { bias: -.4 });
}

// ---------------- work flying off the empty desk ----------------
const FLYD = 1.0;
const FLY = [
  { k: 'shelf', t: at_(0, .3) }, { k: 'phone', t: at_(1, .32) }, { k: 'shelf', t: at_(1, .72) },
  { k: 'board', t: at_(3, .3) }, { k: 'owner', t: B(4)[0] + .05, hold: true },
];
const ARR = { shelf: at_(1, .72) + FLYD, board: at_(3, .3) + FLYD };
const pathPt = (pts, u) => { const L = [0]; for (let i = 1; i < pts.length; i++) L.push(L[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1])); const s = u * L[L.length - 1]; let i = 1; while (i < L.length - 1 && L[i] < s) i++; const f = (s - L[i - 1]) / (L[i] - L[i - 1] || 1); return [lerp(pts[i - 1][0], pts[i][0], f), lerp(pts[i - 1][1], pts[i][1], f)]; };
const APPROVE = at_(4, .55);
function flying(t) {
  for (const f of FLY) {
    const end = f.hold ? APPROVE + .9 : f.t + FLYD + .2; if (t < f.t || t > end) continue;
    const u = eio(seg(t, f.t, f.t + FLYD)), [x, y] = pathPt(BR[f.k], u), z = .95 + Math.sin(u * Math.PI) * 1.1 + (f.hold ? .35 * u : 0);
    const ok = f.hold ? ss(seg(t, APPROVE, APPROVE + .25)) : 0;
    iso.box(x - .26, y - .2, z, .52, .38, .05, tri(hex(mix(P.paper, C.accent, f.hold ? ok : .25))), { bias: 3 });
  }
}
function branches(g, t) {
  const u = seg(t, B(5)[0] - .05, B(5)[0] + 1.4); if (u <= 0) return;
  g.save(); g.strokeStyle = C.accent; g.lineCap = 'round'; g.lineJoin = 'round'; g.lineWidth = iso.cam.k * .13;
  ['phone', 'shelf', 'board', 'owner'].forEach((k, j) => { const v = clamp(u * 1.8 - j * .25); if (v > 0) tracePath(g, BR[k].map(p => iso.P(p[0], p[1], .01)), eio(v)); });
  g.fillStyle = C.accent; const [hx, hy] = iso.P(GC[0], GC[1] + .7, .01); g.beginPath(); g.arc(hx, hy, iso.cam.k * .2, 0, TAU); g.fill();
  g.restore();
}

// ---------------- people ----------------
function walkAlong(pts, t0, speed) { const L = [0]; for (let i = 1; i < pts.length; i++) L.push(L[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1])); return { pts, L, t0, t1: t0 + L[L.length - 1] / speed, speed }; }
function posOn(r, t) { const s = clamp((t - r.t0) * r.speed, 0, r.L[r.L.length - 1]); let i = 1; while (i < r.L.length - 1 && r.L[i] < s) i++; const f = (s - r.L[i - 1]) / (r.L[i] - r.L[i - 1] || 1); return { x: lerp(r.pts[i - 1][0], r.pts[i][0], f), y: lerp(r.pts[i - 1][1], r.pts[i][1], f), walking: t > r.t0 && t < r.t1 }; }
const RA = walkAlong([[2.5, 5.4], [4.9, 5.4]], at_(2, .02), 1.6);            // to the empty desk, across
const RB = walkAlong([[2.5, 8.4], [5.0, 8.4], [5.0, 6.3]], at_(2, .1), 1.8);  // across, then up toward the desk
const bill = (p, x, y, walking, ph) => iso.bill(x, y, 0, gg => drawPerson(gg, p, { walking, phase: ph }), { r: 2 });
const SPOT = [ST.owner[0], DO[1] + 1.45];
function people(t) {
  const a = posOn(RA, t), b = posOn(RB, t);
  bill(PEOPLE.a, a.x, a.y, a.walking, t * 7); bill(PEOPLE.b, b.x, b.y, b.walking, t * 7 + 1);
  bill(PEOPLE.owner, SPOT[0], SPOT[1], false, 0);
  return { a, b };
}
function spot(g, t) {
  const a = ss(seg(t, B(4)[0], B(4)[0] + .4)) * (1 - ss(seg(t, B(5)[0], B(5)[0] + .4))); if (a <= 0) return;
  g.save(); g.globalAlpha = a; g.strokeStyle = C.accent; g.lineWidth = iso.cam.k * .07; g.setLineDash([iso.cam.k * .22, iso.cam.k * .12]);
  const [x, y] = SPOT; tracePath(g, quad(rect(x - .5, x + .5, y - .4, y + .45).concat([[x - .5, y - .4]]), .01), eio(seg(t, B(4)[0], B(4)[0] + .7)));
  g.restore();
}

// ---------------- floor words ----------------
const heb = s => [...s].reverse().join('');
function phrase(o) {
  const lines = o.lines.map(l => l.map(([s, k]) => [k.startsWith('n') ? s : heb(s), k]).reverse());
  const Pp = { ...o, lines }; const L = phraseLayout(Pp);
  for (let li = 0; li < lines.length; li++) { const cs = L.filter(c => c.li === li), ts = cs.map(c => c.tc).sort((a, b) => a - b); cs.reverse().forEach((c, i) => c.tc = ts[i]); }
  return { P: Pp, L };
}
const PH = {
  zero: phrase({ x: 9.0, y: 9.2, t0: at_(3, .35), t1: B(4)[0] - .05, step: .1, scale: 1.6, lines: [[['0', 'na']]] }),
  agent: phrase({ x: 9.0, y: 9.6, t0: at_(5, .3), t1: DUR + 1, step: .12, scale: .95, lines: [[['סוכן', 'A']]] }),
};

// ---------------- camera ----------------
const K = (x, y, z, k) => ({ x, y, z, k });
const CAMS = [
  [0, K(6.4, 4.6, .9, 84)], [.6, K(6.5, 4.8, 1.0, 132)], [at_(0, .6), K(6.4, 4.9, 1.0, 136)],   // hook: snap onto the empty chair
  [B(0)[1] - .2, K(4.6, 4.6, .9, 82)], [B(1)[1], K(4.6, 4.8, .9, 84)],                              // work flies: to the phone, the shelf
  [B(2)[0] + .5, K(5.6, 5.4, .9, 112)], [B(2)[1], K(5.6, 5.5, .9, 118)],                            // the team gathers round the empty desk
  [B(3)[0] + .4, K(7.6, 7.2, .7, 104)], [B(3)[1], K(7.6, 7.3, .7, 110)],                            // "0"
  [B(4)[0] + .4, K(6.5, 7.6, .9, 112)], [B(4)[1], K(6.5, 7.6, .9, 116)],                            // the owner approves
  [B(5)[0] + .3, K(5, 5, .9, 80)], [B(5)[1], K(5, 5.2, .9, 82)],                                    // reveal: the whole office wired to the empty desk
  [B(6)[0] + .6, K(5.4, 5.8, .9, 86)], [DUR, K(5.4, 5.8, .9, 82)],
];
export function camAt(t) {
  let i = 0; while (i < CAMS.length - 2 && CAMS[i + 1][0] <= t) i++;
  const [ta, a] = CAMS[i], [tb, b] = CAMS[i + 1], u = eio(seg(t, ta, tb));
  return { x: lerp(a.x, b.x, u), y: lerp(a.y, b.y, u), z: lerp(a.z, b.z, u), k: Math.exp(lerp(Math.log(a.k), Math.log(b.k), u)) };
}
const VSHIFT = -40;

// ---------------- screen-space ----------------
function bubble(g, x, y, text, a, accent = false, size = 42) {
  if (a <= 0) return;
  g.save(); g.globalAlpha = a; g.font = font(700, size); g.direction = 'rtl';
  const w = Math.max(62, g.measureText(text).width + 40), h = size * 1.7, s = lerp(.7, 1, eo(a));
  g.translate(x, y); g.scale(s, s);
  g.fillStyle = accent ? C.accent : P.paper; g.beginPath(); g.roundRect(-w / 2, -h - 20, w, h, 20); g.fill();
  g.beginPath(); g.moveTo(-12, -22); g.lineTo(6, -22); g.lineTo(-5, -2); g.closePath(); g.fill();
  g.fillStyle = accent ? '#fff' : C.ink; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, 0, -h / 2 - 18);
  g.restore();
}
const win = (t, a, b) => ss(seg(t, a, a + .22)) * (1 - ss(seg(t, b - .22, b)));
const HL = [['העובד החדש', 'שאף אחד לא ראה'], ['תוך דקה', 'הצעת מחיר יצאה'], ['הצוות מנחש:', 'מי זה?!'], ['הכי מוזר', 'לא מבקש העלאה'],
  ['אבל אף פעם', 'בלי אישור שלי'], ['הסוד:', 'סוכן בינה מלאכותית'], ['רוצים עובד כזה?', 'תגיבו "עובד"']];
const hlIndex = t => { let i = 0; while (i < NL - 1 && t >= B(i + 1)[0] - .05) i++; return i; };
function headline(g, t) {
  if (t >= END) return; const i = hlIndex(t);
  const t0 = i === 0 ? -1 : B(i)[0] - .05, u = eo(seg(t, t0, t0 + .22)), sc = lerp(1.18, 1, u);
  const grd = g.createLinearGradient(0, 0, 0, 470); grd.addColorStop(0, 'rgba(241,232,216,.96)'); grd.addColorStop(.72, 'rgba(241,232,216,.82)'); grd.addColorStop(1, 'rgba(241,232,216,0)');
  g.fillStyle = grd; g.fillRect(0, 0, W, 470);
  g.save(); g.translate(W / 2, 250); g.scale(sc, sc); g.globalAlpha = u; g.textAlign = 'center'; g.textBaseline = 'middle'; g.direction = 'rtl';
  g.fillStyle = C.ink; g.font = font(700, 66); g.fillText(HL[i][0], 0, -95);
  let fs = 150; g.font = font(900, fs); while (g.measureText(HL[i][1]).width > W - 90) { fs -= 6; g.font = font(900, fs); }
  g.fillStyle = C.accent; g.fillText(HL[i][1], 0, 40);
  g.restore();
}
function wrap(g, s, maxW) { const words = s.split(' '), out = []; let cur = ''; for (const w of words) { const n = cur ? cur + ' ' + w : w; if (g.measureText(n).width > maxW && cur) { out.push(cur); cur = w; } else cur = n; } if (cur) out.push(cur); return out; }
const SUBY = 1560;
function subtitles(g, t) {
  LINES.forEach((s, i) => {
    const t0 = VO[i] - .05, t1 = i < NL - 1 ? VO[i + 1] - .05 : VO[i] + VO_DUR[i] + .3; if (t < t0 || t >= t1) return;
    g.save(); g.font = font(500, 46); g.direction = 'rtl'; const ls = wrap(g, s, 900), lh = 62, w = Math.max(...ls.map(l => g.measureText(l).width)) + 48, h = ls.length * lh + 26;
    g.fillStyle = 'rgba(250,245,236,.92)'; g.beginPath(); g.roundRect(W / 2 - w / 2, SUBY, w, h, 10); g.fill();
    g.fillStyle = C.ink; g.textAlign = 'center'; g.textBaseline = 'middle'; ls.forEach((l, j) => g.fillText(l, W / 2, SUBY + 13 + lh * (j + .5)));
    g.restore();
  });
}
const ENDTX = ['רוצים עובד כזה? תגיבו "עובד"', 'goldchain-ai.com', 'ואשלח לכם מה הוא יכול לעשות אצלכם'];
function endCard(g, t) {
  const a = ss(seg(t, END, END + .45)); if (a <= 0) return;
  g.save(); g.globalAlpha = a; const y = 1470 + (1 - eo(a)) * 40;
  g.fillStyle = 'rgba(250,245,236,.95)'; g.beginPath(); g.roundRect(70, y, W - 140, 330, 18); g.fill();
  g.textAlign = 'center'; g.textBaseline = 'middle'; g.direction = 'rtl';
  g.fillStyle = C.ink; g.font = font(700, 52); g.fillText(ENDTX[0], W / 2, y + 70);
  g.direction = 'ltr'; g.fillStyle = C.accent; g.font = font(700, 66); g.fillText(ENDTX[1], W / 2, y + 168);
  g.direction = 'rtl'; g.fillStyle = C.soft; g.font = font(500, 40); g.fillText(ENDTX[2], W / 2, y + 262);
  g.restore();
}

// ---------------- render ----------------
export function render(g, t, Q) {
  iso.g = g; const c = camAt(t); iso.cam = { ...c, z: c.z - VSHIFT / c.k };
  g.fillStyle = C.bg; g.fillRect(0, 0, W, H);
  floor(g); branches(g, t); spot(g, t);
  for (const k in PH) floorType(g, t, PH[k].P, PH[k].L);
  walls(g, t);
  furniture(t); flying(t); nearWalls();
  const pp = people(t);
  iso.flush();
  const P3 = (x, y, z) => iso.P(x, y, z);
  // the empty desk speaks
  const [gx, gy] = P3(GC[0], GC[1], 1.7);
  bubble(g, gx, gy, 'נענה תוך דקה', win(t, at_(0, .32), at_(0, .85)), true);
  const [px, py] = P3(ST.phone[0], ST.phone[1], 1.5);
  bubble(g, px, py, 'כמה זה עולה?', win(t, B(1)[0] + .05, at_(1, .45)));
  bubble(g, px, py, 'הצעת מחיר נשלחה', win(t, at_(1, .32) + FLYD, at_(1, .9)), true);
  const [sx, sy] = P3(.5, 6.0, 2.0);
  bubble(g, sx, sy, 'חשבונית יצאה', win(t, ARR.shelf - .05, B(2)[0] + .4), true);
  // the team guesses
  const [ax, ay] = P3(pp.a.x, pp.a.y, 1.95), [bx, by] = P3(pp.b.x, pp.b.y, 1.95);
  bubble(g, ax, ay, 'הבן של הבוס?', win(t, at_(2, .3), B(3)[0] + .2));
  bubble(g, bx, by, 'פרילנסר מחו״ל?', win(t, at_(2, .62), B(3)[0] + .2));
  bubble(g, gx, gy, 'העלאה? לא צריך', win(t, at_(3, .2), at_(3, .75)), true);
  bubble(g, gx, gy, 'חופש? לא צריך', win(t, at_(3, .62), B(4)[0] + .1), true);
  const [ox, oy] = P3(SPOT[0], SPOT[1], 1.95);
  bubble(g, ox, oy, 'מאשרת', win(t, APPROVE - .1, B(5)[0] - .1), true);
  bubble(g, ax, ay, 'וואו', win(t, at_(5, .35), B(6)[0] + .3));
  bubble(g, bx, by, 'רגע, מה?!', win(t, at_(5, .22), B(6)[0] + .3));
  headline(g, t);
  if (!Q?.has('nosub')) subtitles(g, t);
  endCard(g, t);
}

export function events() {
  const ev = [{ t: 0, type: 'timeline', DUR, VO, B: [...Array(NL).keys()].map(B), END }];
  LINES.forEach((s, i) => ev.push({ t: VO[i], type: 'vo', id: 't' + (i + 1) }));
  for (const k in PH) [...PH[k].L].sort((a, b) => a.tc - b.tc).forEach((c, j) => ev.push({ t: c.tc, type: 'land', accent: c.col === C.accent, j }));
  for (let i = 0; i < NL; i++) ev.push({ t: B(i)[0], type: 'title', i });
  for (const f of FLY) ev.push({ t: f.t, type: 'whoosh' }, { t: f.t + FLYD, type: 'arrive' });
  [at_(0, .32), at_(1, .05), at_(2, .3), at_(2, .62), at_(3, .2), at_(3, .62), at_(5, .22), at_(5, .35)].forEach(t => ev.push({ t, type: 'pop' }));
  ev.push({ t: B(5)[0] - .05, type: 'chime' }, { t: B(3)[0] + .1, type: 'hook' }, { t: APPROVE, type: 'approve' }, { t: B(4)[0], type: 'paper' }, { t: END, type: 'end' });
  ev.push({ t: RA.t0, type: 'step' }, { t: RA.t0 + .5, type: 'step' }, { t: RB.t0, type: 'step' }, { t: RB.t0 + .5, type: 'step' });
  return ev.sort((a, b) => a.t - b.t);
}
export function texts(t) {
  const out = []; const c = camAt(t); iso.cam = { ...c, z: c.z - VSHIFT / c.k };
  for (const k in PH) { const { P: Pp, L } = PH[k]; const first = Math.min(...L.map(x => x.tc)); if (t >= first && t < Pp.t1 + .3) out.push({ id: k, text: L.map(x => x.ch).join(''), ...phraseBox(Pp, L) }); }
  if (t < END) { const i = hlIndex(t); out.push({ id: 'hl' + i, text: HL[i].join(' '), x0: 60, y0: 120, x1: W - 60, y1: 340, pass: true }); }
  if (t >= END) out.push({ id: 'end', text: ENDTX.join(' '), x0: 70, y0: 1470, x1: W - 70, y1: 1800 });
  return out;
}
