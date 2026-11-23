// מי שילם? — an isometric people scene about a Bit payment nobody can place, and the agent that places it.
// 1080×1920, 30 fps. World in metres: x down-right, y down-left, z up. One small studio, near walls cut low.
import { iso, tri, C, TOPS, LEGS, W, H, onPlane, quad, fillPoly, rect, tracePath, phraseLayout, floorType, phraseBox, drawPerson,
  font, mix, hex, css, clamp, lerp, seg, ss, eo, eio, TAU } from './kit.js';

// ---------------- narration: one line per beat (Karin's voice), line lengths after trimming ----------------
export const LINES = [
  'נכנסו לכם אלף שמונה מאות וחמישים שקל בביט.',
  'יופי! רק שאלה קטנה: ממי?',
  'אין שם, אין חשבונית, ואין לכם מושג על מה.',
  'בסוף החודש רואה החשבון שואל, ואתם מחפשים בוואטסאפ, במייל ובפתקים.',
  'סוכן בינה מלאכותית תופס כל תשלום ברגע שהוא נכנס,',
  'מוצא את החשבונית הפתוחה, ומסמן: שולם.',
  'ואם אין התאמה, הוא מכין ללקוח הודעה, ושולח רק אחרי שאישרתם.',
  'שלחו את זה לבעל עסק שעדיין מחפש מי שילם.',
];
const VO_DUR = [3.099, 2.730, 3.350, 5.216, 3.616, 3.267, 4.668, 3.084];
const GAPS = [.25, .25, .3, .55, .25, .3, .3];   // .55 before the turn: the near-silence before the path starts
export const VO = []; { let t = .45; VO_DUR.forEach((d, i) => { VO.push(+t.toFixed(3)); t += d + (GAPS[i] ?? 0); }); }
const B = i => [VO[i], i < 7 ? VO[i + 1] : VO[7] + VO_DUR[7] + .3];   // beat i spans its line and the gap after it
const END = VO[7] + VO_DUR[7] + .35;                                   // end card in
export const DUR = +(END + 5.0).toFixed(2);

// ---------------- palette for this place ----------------
const P = {
  floor: '#F2E5CE', grid: '#E7D6B9', wall: '#F4ECDD', wallTop: '#E9DCC5', wood: '#C79B6E', counter: '#3D6B59', counterLt: '#A7C2B2',
  tray: '#CEC7BA', coin: '#E2AE3A', dark: '#3A3E3B', paper: '#FBF6EC', note: ['#E9C77A', '#A7C2B2', '#EDBFA9', '#D3C29E'],
};
const OWNER = { h: 1.68, top: TOPS[0], legs: LEGS[0], hairLong: true };
const ACCT = { h: 1.76, top: TOPS[2], legs: LEGS[2] };

// ---------------- the place ----------------
const DOOR = [3.0, 4.3];        // gap in the near wall at y = 10 (x range)
const TRAY = { x: 1.6, y: 7.75, z: 1.03 };
const SHELF = { y0: 3.0, y1: 5.8 };
const FOLD = [3.25, 3.8, 4.35, 4.9, 5.45];      // folder centres on the shelf front (y)
const HIT = 2;                                   // the open invoice that matches
const PATH = [[1.6, 7.0], [1.6, 4.35], [.75, 4.35]];   // agent path on the floor: tray → shelf (axis-aligned)
const SPOT = [6.9, 1.15];                        // where the owner stands to approve

function floor(g) {
  fillPoly(g, quad(rect(0, 10, 0, 10), 0), P.floor);
  g.save(); g.strokeStyle = P.grid; g.lineWidth = Math.max(1, iso.cam.k * .012);
  for (let i = 1; i < 10; i++) { g.beginPath(); g.moveTo(...iso.P(i, 0, 0)); g.lineTo(...iso.P(i, 10, 0)); g.stroke(); g.beginPath(); g.moveTo(...iso.P(0, i, 0)); g.lineTo(...iso.P(10, i, 0)); g.stroke(); }
  g.restore();
  fillPoly(g, quad(rect(DOOR[0] + .1, DOOR[1] - .1, 8.9, 10), .002), '#E8D9BF');   // door mat
}
function backWalls(g) {
  iso.boxNow(-.25, -.25, 0, .25, 10.25, 2.7, tri(P.wall, .05, .12));
  iso.boxNow(0, -.25, 0, 10, .25, 2.7, tri(P.wall, .05, .12));
  // window on the far wall, pin board (notes) on the far wall
  onPlane(g, 1.2, 0, 2.2, 'xz', g2 => { g2.fillStyle = '#CFE0DA'; g2.fillRect(0, 0, 2.6, 1.2); g2.fillStyle = P.wall; g2.fillRect(1.27, 0, .06, 1.2); });
  onPlane(g, 6.3, 0, 2.15, 'xz', g2 => {
    g2.fillStyle = '#B58A5E'; g2.fillRect(0, 0, 2.4, 1.25); g2.fillStyle = '#D7B48A'; g2.fillRect(.06, .06, 2.28, 1.13);
    [[.2, .15], [.75, .1], [1.3, .2], [1.75, .12], [.35, .62], [.95, .58], [1.55, .66]].forEach(([u, v], i) => { g2.fillStyle = P.note[i % 4]; g2.fillRect(u, v, .42, .4); });
  });
}
function nearWalls() {
  iso.box(10, 0, 0, .25, 10.25, .45, tri(P.wall, .05, .12), { bias: -.2 });
  iso.box(0, 10, 0, DOOR[0], .25, .45, tri(P.wall, .05, .12), { bias: -.2 });
  iso.box(DOOR[1], 10, 0, 10 - DOOR[1], .25, .45, tri(P.wall, .05, .12), { bias: -.2 });
}
function shelf(g, t) {
  iso.boxNow(0, SHELF.y0, 0, .5, SHELF.y1 - SHELF.y0, 1.7, tri(P.counter));
  // folders on the shelf's +x face (x = .5): order lighting runs across them, then the match stays lit
  const scan = seg(t, B(5)[0] - .1, B(5)[0] + .9), hold = ss(seg(t, B(5)[0] + .9, B(5)[0] + 1.2));
  FOLD.forEach((y, i) => {
    const lit = i === HIT ? Math.max(hold, ss(1 - Math.abs(scan * 5 - i - .5) * 1.6)) : ss(1 - Math.abs(scan * 5 - i - .5) * 1.6) * (scan > 0 && scan < 1 ? 1 : 0);
    onPlane(g, .5, y + .22, 1.45, 'yz', g2 => {
      g2.fillStyle = hex(mix(P.paper, C.accent, lit * .85)); g2.fillRect(0, 0, .44, 1.0);
      g2.fillStyle = hex(mix('#D9CDB6', '#FBE3D8', lit)); g2.fillRect(.06, .12, .32, .06); g2.fillRect(.06, .26, .22, .06);
    });
  });
}
function furniture(g, t) {
  // counter by the door with the tray
  iso.box(.9, 7.2, 0, 1.4, 1.1, .95, tri(P.counter));
  iso.box(1.2, 7.45, .95, .8, .6, .08, tri(P.tray), { bias: -.4 });
  // owner's desk with a laptop
  iso.box(4.2, 3.8, 0, 2.3, 1.1, .75, tri(P.wood));
  iso.box(5.0, 4.05, .75, .62, .44, .03, tri(P.dark), { bias: -.4 });
  // phone stand in the back-left corner
  iso.box(1.1, .9, 0, 1.1, .8, .8, tri(P.wood));
  iso.box(1.45, 1.1, .8, .26, .42, .03, tri(P.dark), { bias: -.4 });
}
function coin(t) {
  const a = B(0)[0] - .15, u = seg(t, a, a + .55);
  if (t < a) return;
  const bounce = u < 1 ? 0 : Math.abs(Math.sin((t - a - .55) * 18)) * .12 * Math.exp(-(t - a - .55) * 9);
  const z = lerp(4.2, TRAY.z, u * u) + bounce;
  iso.cyl(TRAY.x, TRAY.y, z, .2, .06, tri(P.coin), { bias: 2 });
}

// ---------------- people ----------------
const route = (pts, t0, speed = 1.6) => { const L = [0]; for (let i = 1; i < pts.length; i++) L.push(L[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1])); return { pts, L, t0, t1: t0 + L[L.length - 1] / speed, speed }; };
const at = (r, t) => {
  const s = clamp((t - r.t0) * r.speed, 0, r.L[r.L.length - 1]); let i = 1; while (i < r.L.length - 1 && r.L[i] < s) i++;
  const f = (s - r.L[i - 1]) / (r.L[i] - r.L[i - 1] || 1); return { x: lerp(r.pts[i - 1][0], r.pts[i][0], f), y: lerp(r.pts[i - 1][1], r.pts[i][1], f), walking: t > r.t0 && t < r.t1, s };
};
const SEARCH = route([[5.3, 5.4], [3.4, 5.4], [3.4, 2.5], [1.7, 2.5], [1.7, 2.45]], B(3)[0] + .35, 2.6);
const SEARCH2 = route([[1.7, 2.45], [6.9, 2.45], [6.9, 1.15]], SEARCH.t1 + .55, 2.6);
const STEP = route([[6.9, 1.15], [6.9, 1.15]], 0);
const ACCT_IN = route([[3.65, 10.7], [3.65, 7.0], [6.3, 7.0]], B(3)[0] - .5, 2.2);
function ownerPos(t) {
  if (t < SEARCH.t0) return { x: 5.3, y: 5.4, walking: false, s: 0 };
  if (t < SEARCH2.t0) return at(SEARCH, t);
  return at(SEARCH2, t);
}
function person(p, pos, phase) { iso.bill(pos.x, pos.y, 0, gg => drawPerson(gg, p, { walking: pos.walking, phase }), { r: 2 }); }

// ---------------- floor type (Hebrew read right to left: glyphs laid in reverse, landing from the first letter) ----------------
const heb = s => [...s].reverse().join('');
function phrase(o) {
  const lines = o.lines.map(l => l.map(([s, k]) => [k.startsWith('n') ? s : heb(s), k]).reverse());
  const Pp = { ...o, lines }; const L = phraseLayout(Pp);
  for (let li = 0; li < lines.length; li++) { const cs = L.filter(c => c.li === li), ts = cs.map(c => c.tc).sort((a, b) => a - b); cs.reverse().forEach((c, i) => c.tc = ts[i]); }
  return { P: Pp, L };
}
const PH = {
  amount: phrase({ x: 3.95, y: 9.75, t0: B(0)[0] + .35, t1: B(1)[0] + .2, step: .1, scale: .95, lines: [[['1,850₪', 'na']]] }),
  who: phrase({ x: 3.95, y: 9.2, t0: B(1)[0] + 1.3, t1: B(2)[0] - .1, step: .14, scale: 1.05, lines: [[['ממי', 'B'], ['?', 'A']]] }),
  noname: phrase({ x: 3.95, y: 9.55, t0: B(2)[0] + .2, t1: B(3)[0] - .05, step: .13, scale: .85, lines: [[['אין שם', 'B']]] }),
  month: phrase({ x: 8.7, y: 9.6, t0: B(3)[0] + .15, t1: B(4)[0] - .1, step: .1, scale: .78, lines: [[['סוף החודש', 'B']]] }),
  caught: phrase({ x: 8.7, y: 9.5, t0: B(4)[0] + .45, t1: B(5)[0] - .05, step: .13, scale: .9, lines: [[['נתפס', 'B']]] }),
  paid: phrase({ x: 8.7, y: 9.5, t0: B(5)[0] + 1.6, t1: B(6)[0] - .05, step: .15, scale: 1.05, lines: [[['שולם', 'A']]] }),
  ok: phrase({ x: 8.7, y: 9.6, t0: B(6)[0] + 2.1, t1: B(7)[0] - .05, step: .14, scale: .95, lines: [[['אישור', 'A']]] }),
  end: phrase({ x: 8.7, y: 9.6, t0: B(7)[0] + .3, t1: DUR + 1, step: .11, scale: .78, lines: [[['מי שילם', 'B'], ['?', 'A']]] }),
};

// ---------------- camera ----------------
const K = (x, y, z, k) => ({ x, y, z, k });
const CAMS = [
  [0, K(2.3, 8.0, .6, 142)], [B(0)[1] - .3, K(2.4, 7.8, .6, 151)],     // 1: close on the tray, slow push
  [B(1)[0] + .9, K(3.5, 6.9, .7, 118)], [B(2)[1] - .2, K(3.6, 6.8, .7, 113)], // 2–3: ease back to tray + owner
  [B(3)[0] + .5, K(5, 5, .9, 82)],                                 // 4: rise to wide (the whole studio)
  [B(3)[1], K(5, 5, .9, 82)],
  [B(4)[0] + .6, K(4.0, 6.0, .7, 98)],                             // 5–6: push toward tray → shelf path, floor stage in view
  [B(5)[1], K(4.2, 5.8, .7, 101)],
  [B(6)[0] + .6, K(7.1, 4.7, .8, 98)],                             // 7: travel to the owner at the pin board
  [B(6)[1], K(7.1, 4.9, .8, 96)],
  [B(7)[0] + .8, K(5, 5, .9, 82)],                                 // 8: step back wide
  [DUR, K(5, 5, .9, 79)],
];
export function camAt(t) {
  let i = 0; while (i < CAMS.length - 2 && CAMS[i + 1][0] <= t) i++;
  const [ta, a] = CAMS[i], [tb, b] = CAMS[i + 1], u = eio(seg(t, ta, tb));
  return { x: lerp(a.x, b.x, u), y: lerp(a.y, b.y, u), z: lerp(a.z, b.z, u), k: Math.exp(lerp(Math.log(a.k), Math.log(b.k), u)) };
}
const VSHIFT = 40;   // the scene sits a little above centre, leaving the lower third for subtitles

// ---------------- screen-space pieces: speech bubbles, the search counter, subtitles, end card ----------------
function bubble(g, x, y, text, a, accent = false) {
  if (a <= 0) return;
  g.save(); g.globalAlpha = a; g.font = font(700, 44); g.direction = 'rtl';
  const w = Math.max(70, g.measureText(text).width + 44), h = 74, s = lerp(.7, 1, eo(a));
  g.translate(x, y); g.scale(s, s);
  g.fillStyle = P.paper; g.beginPath(); g.roundRect(-w / 2, -h - 22, w, h, 22); g.fill();
  g.beginPath(); g.moveTo(-14, -24); g.lineTo(6, -24); g.lineTo(-6, -2); g.closePath(); g.fill();
  g.fillStyle = accent ? C.accent : C.ink; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, 0, -h / 2 - 20);
  g.restore();
}
function headAt(pos, p) { const [sx, sy] = iso.P(pos.x, pos.y, p.h + .25); return [sx, sy]; }
function counter(g, t, pos) {
  const a = ss(seg(t, SEARCH.t0, SEARCH.t0 + .3)) * (1 - ss(seg(t, B(4)[0] - .1, B(4)[0] + .2))); if (a <= 0) return;
  const hrs = Math.min(3, Math.floor(seg(t, SEARCH.t0 + .2, SEARCH2.t1) * 3.999));
  const [sx, sy] = headAt(pos, OWNER);
  bubble(g, sx, sy - 6, `${hrs} שעות חיפוש`, a);
}
function wrap(g, s, maxW) { const words = s.split(' '), out = []; let cur = ''; for (const w of words) { const n = cur ? cur + ' ' + w : w; if (g.measureText(n).width > maxW && cur) { out.push(cur); cur = w; } else cur = n; } if (cur) out.push(cur); return out; }
const SUBY = 1560;
function subtitles(g, t) {
  LINES.forEach((s, i) => {
    const t0 = VO[i] - .05, t1 = i < 7 ? VO[i + 1] - .05 : VO[i] + VO_DUR[i] + .3; if (t < t0 || t >= t1) return;
    g.save(); g.font = font(500, 46); g.direction = 'rtl'; const ls = wrap(g, s, 900), lh = 62, w = Math.max(...ls.map(l => g.measureText(l).width)) + 48, h = ls.length * lh + 26;
    g.fillStyle = 'rgba(250,245,236,.9)'; g.beginPath(); g.roundRect(W / 2 - w / 2, SUBY, w, h, 10); g.fill();
    g.fillStyle = C.ink; g.textAlign = 'center'; g.textBaseline = 'middle'; ls.forEach((l, j) => g.fillText(l, W / 2, SUBY + 13 + lh * (j + .5)));
    g.restore();
  });
}
const ENDTX = ['רוצים כזה בעסק שלכם?', 'goldchain-ai.com', 'ייעוץ · וואטסאפ בביו'];
function endCard(g, t) {
  const a = ss(seg(t, END, END + .45)); if (a <= 0) return;
  g.save(); g.globalAlpha = a; const y = 1470 + (1 - eo(a)) * 40;
  g.fillStyle = 'rgba(250,245,236,.95)'; g.beginPath(); g.roundRect(90, y, W - 180, 330, 18); g.fill();
  g.textAlign = 'center'; g.textBaseline = 'middle'; g.direction = 'rtl';
  g.fillStyle = C.ink; g.font = font(700, 58); g.fillText(ENDTX[0], W / 2, y + 70);
  g.direction = 'ltr'; g.fillStyle = C.accent; g.font = font(700, 66); g.fillText(ENDTX[1], W / 2, y + 168);
  g.direction = 'rtl'; g.fillStyle = C.soft; g.font = font(500, 44); g.fillText(ENDTX[2], W / 2, y + 262);
  g.restore();
}

// ---------------- the agent: a lit path on the floor, the message card, the approval spot ----------------
function agentPath(g, t) {
  const grow = eio(seg(t, B(4)[0] + .05, B(4)[0] + 1.6)), fade = 1 - ss(seg(t, B(5)[1] - .4, B(5)[1]));
  if (grow <= 0 || fade <= 0) return;
  g.save(); g.globalAlpha = fade; g.strokeStyle = C.accent; g.lineCap = 'round'; g.lineJoin = 'round'; g.lineWidth = iso.cam.k * .16;
  tracePath(g, PATH.map(p => iso.P(p[0], p[1], .01)), grow);
  if (grow >= 1) { const [hx, hy] = iso.P(PATH[2][0] - .05, PATH[2][1], .01); g.fillStyle = C.accent; g.beginPath(); g.arc(hx, hy, iso.cam.k * .16, 0, TAU); g.fill(); }
  g.restore();
}
function spot(g, t) {
  const a = ss(seg(t, B(6)[0] + .9, B(6)[0] + 1.3)) * (1 - ss(seg(t, B(7)[0] - .2, B(7)[0] + .2))); if (a <= 0) return;
  const tr = eio(seg(t, B(6)[0] + .9, B(6)[0] + 1.6));
  g.save(); g.globalAlpha = a; g.strokeStyle = C.accent; g.lineWidth = iso.cam.k * .07; g.setLineDash([iso.cam.k * .22, iso.cam.k * .12]);
  tracePath(g, quad(rect(SPOT[0] - .5, SPOT[0] + .5, SPOT[1] - .45, SPOT[1] + .45).concat([[SPOT[0] - .5, SPOT[1] - .45]]), .01), tr);
  g.restore();
}
// the message card: rises from the matched-shelf top, glides to the owner, waits, turns accent when approved, leaves by the door
const CARD = { t0: B(6)[0] + .3, at: B(6)[0] + 1.5, ok: B(6)[0] + 2.4, out0: B(6)[0] + 3.0, out1: B(7)[0] + .2 };
function card(t) {
  if (t < CARD.t0 || t > CARD.out1 + .1) return;
  let x, y, z;
  const A = [.7, 4.35, 1.75], Bp = [SPOT[0] - .1, SPOT[1] + .55, 1.35], Dp = [3.65, 10.9, 1.1];
  if (t < CARD.at) { const u = eio(seg(t, CARD.t0, CARD.at)); [x, y, z] = [lerp(A[0], Bp[0], u), lerp(A[1], Bp[1], u), lerp(A[2], Bp[2], u) + Math.sin(u * Math.PI) * .8]; }
  else if (t < CARD.out0) { [x, y, z] = [Bp[0], Bp[1], Bp[2] + Math.sin((t - CARD.at) * 3) * .03]; }
  else { const u = eio(seg(t, CARD.out0, CARD.out1)); [x, y, z] = [lerp(Bp[0], Dp[0], u), lerp(Bp[1], Dp[1], u), lerp(Bp[2], Dp[2], u) + Math.sin(u * Math.PI) * .6]; }
  const okU = ss(seg(t, CARD.ok, CARD.ok + .25));
  iso.box(x - .3, y - .22, z, .6, .44, .05, tri(hex(mix(P.paper, C.accent, okU))), { bias: 3 });
}

// ---------------- render ----------------
export function render(g, t, Q) {
  iso.g = g; const c = camAt(t); iso.cam = { ...c, z: c.z - VSHIFT / c.k };
  g.fillStyle = C.bg; g.fillRect(0, 0, W, H);
  floor(g);
  agentPath(g, t); spot(g, t);
  for (const k in PH) floorType(g, t, PH[k].P, PH[k].L);
  backWalls(g); shelf(g, t);
  furniture(g, t); coin(t); card(t); nearWalls();
  const op = ownerPos(t); person(OWNER, op, op.s * 4.2);
  const ap = at(ACCT_IN, t); if (t > ACCT_IN.t0) person(ACCT, ap, ap.s * 4.2);
  iso.flush();
  // speech bubbles
  const [ox, oy] = headAt(op, OWNER);
  bubble(g, ox, oy, '?', ss(seg(t, B(1)[0] + .1, B(1)[0] + .4)) * (1 - ss(seg(t, B(2)[1] - .3, B(2)[1]))), true);
  if (t > ACCT_IN.t1 - .2) { const [ax, ay] = headAt(ap, ACCT); bubble(g, ax, ay, 'על מה זה?', ss(seg(t, ACCT_IN.t1 - .1, ACCT_IN.t1 + .2)) * (1 - ss(seg(t, B(4)[0] - .1, B(4)[0] + .2)))); }
  counter(g, t, op);
  bubble(g, ox, oy, 'אישרתי', ss(seg(t, CARD.ok - .15, CARD.ok + .1)) * (1 - ss(seg(t, CARD.out0 + .3, CARD.out0 + .6))), true);
  if (!Q?.has('nosub')) subtitles(g, t);
  endCard(g, t);
}

// ---------------- events for the mix, texts for the reading check ----------------
export function events() {
  const ev = [{ t: 0, type: 'timeline', DUR, VO, B: [0, 1, 2, 3, 4, 5, 6, 7].map(B), END }];
  LINES.forEach((s, i) => ev.push({ t: VO[i], type: 'vo', id: 't' + (i + 1) }));
  ev.push({ t: B(0)[0] + .4, type: 'coin' });
  for (const k in PH) { const ts = PH[k].L.map(c => c.tc).sort((a, b) => a - b); ts.forEach((tc, j) => ev.push({ t: tc, type: 'land', accent: PH[k].L.find(c => c.tc === tc).col === C.accent, j })); }
  for (const r of [SEARCH, SEARCH2, ACCT_IN]) for (let t = r.t0 + .2; t < r.t1; t += .72 / r.speed * 1.3) ev.push({ t, type: 'step', fast: r !== ACCT_IN });
  ev.push({ t: ACCT_IN.t0 + .1, type: 'door' }, { t: B(4)[0] + .05, type: 'chime' }, { t: B(5)[0] + 1.05, type: 'match' }, { t: B(5)[0] + 1.6, type: 'stamp' });
  ev.push({ t: CARD.t0, type: 'paper' }, { t: CARD.ok, type: 'approve' }, { t: CARD.out0, type: 'paper' }, { t: CARD.out1 - .1, type: 'door' }, { t: END, type: 'end' });
  return ev.sort((a, b) => a.t - b.t);
}
export function texts(t) {
  const out = [];
  render.__g ||= new OffscreenCanvas(W, H).getContext('2d');
  const c = camAt(t); iso.cam = { ...c, z: c.z - VSHIFT / c.k };
  for (const k in PH) { const { P: Pp, L } = PH[k]; const first = Math.min(...L.map(x => x.tc)); if (t >= first && t < Pp.t1 + .3) { const b = phraseBox(Pp, L); out.push({ id: k, text: L.map(x => x.ch).join(''), ...b }); } }
  if (t >= END) out.push({ id: 'end', text: ENDTX.join(' '), x0: 90, y0: 1470, x1: W - 90, y1: 1800 });
  return out;
}
