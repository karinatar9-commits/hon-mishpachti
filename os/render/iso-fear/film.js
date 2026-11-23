// לא לפחד — the same isometric studio: an owner afraid of "the AI thing" while work piles up and other businesses
// walk past already using it; then the agent's lit paths carry the pile away, and nothing leaves without her approval.
// 1080×1920, 30 fps. World in metres: x down-right, y down-left, z up.
import { iso, tri, C, TOPS, LEGS, W, H, onPlane, quad, fillPoly, rect, tracePath, phraseLayout, floorType, phraseBox, drawPerson,
  font, mix, hex, css, clamp, lerp, seg, ss, eo, eio, TAU } from './kit.js';

// ---------------- narration (Karin's voice) ----------------
export const LINES = [
  'מפחדים מבינה מלאכותית? הנה שלושה צעדים שיגרמו לה לעבוד בשבילכם.',
  'בלי קוד, בלי להחליף אף אחד, ובלי להישאר מאחור כשכולם כבר שם.',
  'צעד ראשון: מתחילים ממשימה אחת שגוזלת לכם זמן כל יום. ככה רואים תוצאה כבר בשבוע הראשון.',
  'צעד שני: האישור נשאר אצלכם. הסוכן מכין, אתם מאשרים, ושום דבר לא יוצא בלי שראיתם.',
  'והצעד השלישי הוא זה שהכי חוסך כסף.',
  'מחברים את הסוכן למערכות שכבר יש לכם. לא מחליפים כלום, רק מפסיקים לעבוד בשבילן.',
  'משימה אחת, אישור שלכם, ומה שכבר יש בעסק. ככה זה עובד בשבילכם.',
  'תגיבו: מתחילים, ואשלח לכם מיפוי חינמי של המשימות שאפשר להעביר לסוכן כבר השבוע.',
];
export const VO_DUR = [4.789, 4.617, 7.101, 7.037, 2.974, 5.826, 5.357, 5.772];
const GAPS = [.25, .3, .3, .45, .55, .3, .3];     // .45 before the mid-hook, .55: the near-silence before step three
export const VO = []; { let t = .45; VO_DUR.forEach((d, i) => { VO.push(+t.toFixed(3)); t += d + (GAPS[i] ?? 0); }); }
const B = i => [VO[i], i < 7 ? VO[i + 1] : VO[7] + VO_DUR[7] + .3];
const END = VO[7] + VO_DUR[7] + .35;
export const DUR = +(END + 5.5).toFixed(2);
const at_ = (i, f) => VO[i] + VO_DUR[i] * f;      // a moment inside line i

// ---------------- palette, people ----------------
const P = {
  floor: '#F2E5CE', grid: '#E7D6B9', wall: '#F4ECDD', wood: '#C79B6E', counter: '#3D6B59', counterLt: '#A7C2B2',
  tray: '#CEC7BA', dark: '#3A3E3B', paper: '#FBF6EC', street: '#EAE2D3', note: ['#E9C77A', '#A7C2B2', '#EDBFA9', '#D3C29E'],
};
const OWNER = { h: 1.68, top: TOPS[0], legs: LEGS[0], hairLong: true };
const PASS = [{ h: 1.74, top: TOPS[1], legs: LEGS[1] }, { h: 1.66, top: TOPS[3], legs: LEGS[3], hairLong: true }, { h: 1.78, top: TOPS[2], legs: LEGS[2] }];

// ---------------- the place ----------------
const DOOR = [3.0, 4.3];
const SHELF = { y0: 3.0, y1: 5.8 };
const FOLD = [3.25, 3.8, 4.35, 4.9, 5.45];
const HUB = [4.0, 4.3];
const BR = {   // the agent's three branches: hub → station (axis-aligned)
  phone: [[4.0, 4.3], [4.0, 2.3], [2.25, 2.3]],
  shelf: [[4.0, 4.3], [.8, 4.3]],
  board: [[4.0, 4.3], [4.0, 2.3], [7.5, 2.3], [7.5, .55]],
};
const DESK_SPOT = [5.3, 5.4], BACK_SPOT = [5.3, 5.95];

function floor(g) {
  fillPoly(g, quad(rect(-6, 16, 10.25, 12.6), -.01), P.street);           // the street outside the near wall
  fillPoly(g, quad(rect(0, 10, 0, 10), 0), P.floor);
  g.save(); g.strokeStyle = P.grid; g.lineWidth = Math.max(1, iso.cam.k * .012);
  for (let i = 1; i < 10; i++) { g.beginPath(); g.moveTo(...iso.P(i, 0, 0)); g.lineTo(...iso.P(i, 10, 0)); g.stroke(); g.beginPath(); g.moveTo(...iso.P(0, i, 0)); g.lineTo(...iso.P(10, i, 0)); g.stroke(); }
  g.restore();
  fillPoly(g, quad(rect(DOOR[0] + .1, DOOR[1] - .1, 8.9, 10), .002), '#E8D9BF');
}
function backWalls(g) {
  iso.boxNow(-.25, -.25, 0, .25, 10.25, 2.7, tri(P.wall, .05, .12));
  iso.boxNow(0, -.25, 0, 10, .25, 2.7, tri(P.wall, .05, .12));
  onPlane(g, 1.2, 0, 2.2, 'xz', g2 => { g2.fillStyle = '#CFE0DA'; g2.fillRect(0, 0, 2.6, 1.2); g2.fillStyle = P.wall; g2.fillRect(1.27, 0, .06, 1.2); });
  const rem = ss(seg(t_, ARRIVE.board, ARRIVE.board + .4));
  onPlane(g, 6.3, 0, 2.15, 'xz', g2 => {
    g2.fillStyle = '#B58A5E'; g2.fillRect(0, 0, 2.4, 1.25); g2.fillStyle = '#D7B48A'; g2.fillRect(.06, .06, 2.28, 1.13);
    [[.2, .15], [.75, .1], [1.3, .2], [1.75, .12], [.35, .62], [.95, .58], [1.55, .66]].forEach(([u, v], i) => { g2.fillStyle = i === 3 ? hex(mix(P.note[i % 4], C.accent, rem)) : P.note[i % 4]; g2.fillRect(u, v, .42, .4); });
  });
}
function nearWalls() {
  iso.box(10, 0, 0, .25, 10.25, .45, tri(P.wall, .05, .12), { bias: -.2 });
  iso.box(0, 10, 0, DOOR[0], .25, .45, tri(P.wall, .05, .12), { bias: -.2 });
  iso.box(DOOR[1], 10, 0, 10 - DOOR[1], .25, .45, tri(P.wall, .05, .12), { bias: -.2 });
}
let t_ = 0;
function shelf(g, t) {
  iso.boxNow(0, SHELF.y0, 0, .5, SHELF.y1 - SHELF.y0, 1.7, tri(P.counter));
  const lit = ss(seg(t, ARRIVE.shelf, ARRIVE.shelf + .35));
  FOLD.forEach((y, i) => onPlane(g, .5, y + .22, 1.45, 'yz', g2 => {
    const l = i === 2 ? lit : 0; g2.fillStyle = hex(mix(P.paper, C.accent, l * .85)); g2.fillRect(0, 0, .44, 1.0);
    g2.fillStyle = hex(mix('#D9CDB6', '#FBE3D8', l)); g2.fillRect(.06, .12, .32, .06); g2.fillRect(.06, .26, .22, .06);
  }));
}
function furniture() {
  iso.box(.9, 7.2, 0, 1.4, 1.1, .95, tri(P.counter));
  iso.box(4.2, 3.8, 0, 2.3, 1.1, .75, tri(P.wood));
  iso.box(5.55, 4.05, .75, .62, .44, .03, tri(P.dark), { bias: -.4 });
  iso.box(1.1, .9, 0, 1.1, .8, .8, tri(P.wood));
  iso.box(1.45, 1.1, .8, .26, .42, .03, tri(P.dark), { bias: -.4 });
}

// ---------------- the pile of work on the desk, and the three tasks the agent carries away ----------------
const PILE = [[4.45, 4.0], [4.95, 4.05], [4.5, 4.45], [5.0, 4.5], [4.7, 4.25], [4.6, 4.2], [4.9, 4.3]];   // stack spots (x, y) on the desk
const PILE_N = t => 2 + Math.floor(5 * eo(seg(t, B(1)[0] + .2, at_(2, .3))) + .001);    // the work piles up as step one starts
const FLY = { phone: [at_(5, .05), 6], shelf: [at_(5, .3), 5], board: [at_(5, .55), 4] };   // [start, which pile item]
const FLYD = 1.15;
const ARRIVE = { phone: FLY.phone[0] + FLYD, shelf: FLY.shelf[0] + FLYD, board: FLY.board[0] + FLYD };
const pathPt = (pts, u) => { const L = [0]; for (let i = 1; i < pts.length; i++) L.push(L[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1])); const s = u * L[L.length - 1]; let i = 1; while (i < L.length - 1 && L[i] < s) i++; const f = (s - L[i - 1]) / (L[i] - L[i - 1] || 1); return [lerp(pts[i - 1][0], pts[i][0], f), lerp(pts[i - 1][1], pts[i][1], f)]; };
function pile(t) {
  const n = PILE_N(t);
  for (let i = 0; i < Math.min(n, PILE.length); i++) {
    let gone = false;
    for (const k in FLY) if (FLY[k][1] === i && t >= FLY[k][0]) gone = true;
    if (gone) continue;
    const [x, y] = PILE[i], z = .75 + (i >= 4 ? .14 * (i - 3) : 0), pop = eo(seg(t, B(1)[0] + .2 + (i - 2) * .45, B(1)[0] + .5 + (i - 2) * .45));
    const one = i === 1 && t > at_(2, .22) ? ss(seg(t, at_(2, .22), at_(2, .22) + .35)) : 0;   // step one: one task lights up
    iso.box(x - .26, y - .2, z + (i < 2 ? 0 : (1 - pop) * .6) + one * .25, .52, .4, .14, tri(hex(mix(P.paper, C.accent, one))), { bias: -.2 + i * .01 });
  }
  for (const k in FLY) {   // tasks in flight along the agent's branch
    const [t0, i] = FLY[k]; if (t < t0 || t > t0 + FLYD + .35) continue;
    const u = eio(seg(t, t0, t0 + FLYD)), [sx, sy] = PILE[i], pts = [[sx, sy], ...BR[k]];
    const [x, y] = pathPt(pts, u), z = lerp(.9, k === 'board' ? 1.6 : k === 'shelf' ? 1.75 : .85, u) + Math.sin(u * Math.PI) * .9, fade = 1 - ss(seg(t, t0 + FLYD, t0 + FLYD + .3));
    if (fade > 0) iso.box(x - .22, y - .16, z, .44, .32, .12, tri(hex(mix(P.paper, C.accent, .55))), { bias: 3 });
  }
}
function branches(g, t) {
  const g0 = B(5)[0] - .05, fade = 1 - ss(seg(t, B(7)[0] - .2, B(7)[0] + .3)); if (t < g0 || fade <= 0) return;
  g.save(); g.globalAlpha = fade; g.strokeStyle = C.accent; g.lineCap = 'round'; g.lineJoin = 'round'; g.lineWidth = iso.cam.k * .14;
  ['shelf', 'phone', 'board'].forEach((k, j) => { const u = eio(seg(t, g0 + j * .35, g0 + 1.4 + j * .35)); if (u > 0) tracePath(g, BR[k].map(p => iso.P(p[0], p[1], .01)), u); });
  g.fillStyle = C.accent; const [hx, hy] = iso.P(HUB[0], HUB[1], .01); g.beginPath(); g.arc(hx, hy, iso.cam.k * .2 * eo(seg(t, g0 - .1, g0 + .2)), 0, TAU); g.fill();
  g.restore();
}

// ---------------- people ----------------
function ownerPos(t) {
  const back = eio(seg(t, at_(0, .08), at_(0, .45))), fwd = eio(seg(t, B(3)[0] + 1.0, B(3)[0] + 1.6));
  const y = lerp(lerp(DESK_SPOT[1], BACK_SPOT[1], back), DESK_SPOT[1], fwd);
  const walking = (t > at_(0, .08) && t < at_(0, .45)) || (t > B(3)[0] + 1.0 && t < B(3)[0] + 1.6);
  return { x: DESK_SPOT[0], y, walking, ph: (t - at_(0, .08)) * 7 };
}
// passers-by in the street (other businesses already "there"), each with a small lit card beside them
const STREET = PASS.map((p, i) => ({ p, t0: at_(1, .35) + i * .6, y: 11.35 + (i % 2) * .5 }));
function passers(t) {
  for (const s of STREET) {
    const x = .3 + (t - s.t0) * 1.7; if (t < s.t0 || x > 13 || t > B(2)[0] + .2) continue;
    iso.bill(x, s.y, 0, gg => drawPerson(gg, s.p, { walking: true, phase: (t - s.t0) * 7.5 }), { r: 2, cull: false });
    iso.box(x + .15, s.y - .2, 1.55 + Math.sin((t - s.t0) * 4) * .05, .34, .26, .05, tri(C.accent), { bias: 1, cull: false });
  }
}
function spot(g, t) {
  const a = ss(seg(t, B(3)[0] + .3, B(3)[0] + .7)) * (1 - ss(seg(t, B(4)[0] + .2, B(4)[0] + .6))); if (a <= 0) return;
  const tr = eio(seg(t, B(3)[0] + .3, B(3)[0] + 1.0));
  g.save(); g.globalAlpha = a; g.strokeStyle = C.accent; g.lineWidth = iso.cam.k * .07; g.setLineDash([iso.cam.k * .22, iso.cam.k * .12]);
  const [x, y] = DESK_SPOT; tracePath(g, quad(rect(x - .5, x + .5, y - .4, y + .45).concat([[x - .5, y - .4]]), .01), tr);
  g.restore();
}
const CARD = { t0: B(3)[0] + .1, at: B(3)[0] + 1.0, ok: at_(3, .62), out0: at_(3, .78), out1: B(4)[0] + .5 };
function card(t) {
  if (t < CARD.t0 || t > CARD.out1 + .1) return;
  const A = [.8, 4.3, 1.75], Bp = [DESK_SPOT[0] - .65, DESK_SPOT[1] + .1, 1.35], Dp = [3.65, 11.0, 1.1];
  let x, y, z;
  if (t < CARD.at) { const u = eio(seg(t, CARD.t0, CARD.at)); [x, y, z] = [lerp(A[0], Bp[0], u), lerp(A[1], Bp[1], u), lerp(A[2], Bp[2], u) + Math.sin(u * Math.PI) * .7]; }
  else if (t < CARD.out0) [x, y, z] = Bp;
  else { const u = eio(seg(t, CARD.out0, CARD.out1)); [x, y, z] = [lerp(Bp[0], Dp[0], u), lerp(Bp[1], Dp[1], u), lerp(Bp[2], Dp[2], u) + Math.sin(u * Math.PI) * .6]; }
  iso.box(x - .3, y - .22, z, .6, .44, .05, tri(hex(mix(P.paper, C.accent, ss(seg(t, CARD.ok, CARD.ok + .25))))), { bias: 3 });
}

// ---------------- floor type ----------------
const heb = s => [...s].reverse().join('');
function phrase(o) {
  const lines = o.lines.map(l => l.map(([s, k]) => [k.startsWith('n') ? s : heb(s), k]).reverse());
  const Pp = { ...o, lines }; const L = phraseLayout(Pp);
  for (let li = 0; li < lines.length; li++) { const cs = L.filter(c => c.li === li), ts = cs.map(c => c.tc).sort((a, b) => a - b); cs.reverse().forEach((c, i) => c.tc = ts[i]); }
  return { P: Pp, L };
}
const PH = {
  steps: phrase({ x: 3.95, y: 9.7, t0: at_(0, .45), t1: B(1)[0] + .5, step: .12, scale: .9, lines: [[['3', 'na'], [' צעדים', 'B']]] }),
  nofear: phrase({ x: 3.95, y: 9.6, t0: at_(1, .05), t1: B(2)[0] - .05, step: .11, scale: .85, lines: [[['בלי ', 'B'], ['לפחד', 'A']]] }),
  one: phrase({ x: 8.7, y: 9.6, t0: at_(2, .18), t1: B(3)[0] - .05, step: .11, scale: .72, lines: [[['משימה ', 'B'], ['אחת', 'A']]] }),
  ok: phrase({ x: 8.7, y: 9.6, t0: at_(3, .3), t1: B(4)[0] - .05, step: .14, scale: .95, lines: [[['אישור', 'A']]] }),
  three: phrase({ x: 8.7, y: 9.2, t0: B(4)[0] + .25, t1: B(5)[0] + .2, step: .1, scale: 1.7, lines: [[['3', 'na']]] }),
  have: phrase({ x: 8.7, y: 9.7, t0: at_(5, .12), t1: B(6)[0] - .05, step: .1, scale: .66, lines: [[['מה שכבר ', 'B'], ['יש', 'A']]] }),
  foryou: phrase({ x: 8.7, y: 9.6, t0: at_(6, .55), t1: B(7)[0] - .05, step: .12, scale: .8, lines: [[['בשבילכם', 'A']]] }),
  start: phrase({ x: 8.7, y: 9.6, t0: B(7)[0] + .2, t1: DUR + 1, step: .12, scale: .8, lines: [[['מתחילים', 'A']]] }),
};

// ---------------- camera ----------------
const K = (x, y, z, k) => ({ x, y, z, k });
const CAMS = [
  [0, K(4.4, 7.4, .8, 128)], [B(0)[1] - .2, K(4.5, 7.3, .8, 136)],   // hook: close on the owner and her floor word, slow push
  [B(1)[0] + .6, K(4.2, 7.9, .8, 96)], [B(1)[1], K(4.3, 7.8, .8, 94)],  // reason to stay: pull back, the street through the cut wall
  [B(2)[0] + .5, K(6.2, 6.3, .8, 132)], [B(2)[1], K(6.2, 6.2, .8, 138)], // step one: the pile and its one lit task
  [B(3)[0] + .5, K(6.0, 6.6, .8, 104)], [B(3)[1], K(6.0, 6.5, .8, 104)], // step two: approval at her desk
  [B(4)[0] + .4, K(7.3, 7.6, .6, 112)], [B(4)[1], K(7.3, 7.5, .6, 118)], // mid-hook: push on the big 3
  [B(5)[0] + .5, K(4.8, 5.0, .9, 84)], [B(5)[1], K(4.8, 4.9, .9, 86)],     // step three: wide, the branches carry the pile away
  [B(6)[0] + .6, K(5.2, 5.6, .9, 82)], [B(6)[1], K(5.2, 5.6, .9, 82)],
  [B(7)[0] + .8, K(5.6, 6.0, .9, 90)], [DUR, K(5.6, 6.0, .9, 86)],
];
export function camAt(t) {
  let i = 0; while (i < CAMS.length - 2 && CAMS[i + 1][0] <= t) i++;
  const [ta, a] = CAMS[i], [tb, b] = CAMS[i + 1], u = eio(seg(t, ta, tb));
  return { x: lerp(a.x, b.x, u), y: lerp(a.y, b.y, u), z: lerp(a.z, b.z, u), k: Math.exp(lerp(Math.log(a.k), Math.log(b.k), u)) };
}
const VSHIFT = 40;

// ---------------- screen-space: bubbles, subtitles, end card ----------------
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
const win = (t, a, b) => ss(seg(t, a, a + .25)) * (1 - ss(seg(t, b - .25, b)));
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
const ENDTX = ['תגיבו "מתחילים"', 'goldchain-ai.com', 'ותקבלו מיפוי חינמי של המשימות'];
function endCard(g, t) {
  const a = ss(seg(t, END, END + .45)); if (a <= 0) return;
  g.save(); g.globalAlpha = a; const y = 1470 + (1 - eo(a)) * 40;
  g.fillStyle = 'rgba(250,245,236,.95)'; g.beginPath(); g.roundRect(90, y, W - 180, 330, 18); g.fill();
  g.textAlign = 'center'; g.textBaseline = 'middle'; g.direction = 'rtl';
  g.fillStyle = C.ink; g.font = font(700, 56); g.fillText(ENDTX[0], W / 2, y + 70);
  g.direction = 'ltr'; g.fillStyle = C.accent; g.font = font(700, 66); g.fillText(ENDTX[1], W / 2, y + 168);
  g.direction = 'rtl'; g.fillStyle = C.soft; g.font = font(500, 44); g.fillText(ENDTX[2], W / 2, y + 262);
  g.restore();
}

// ---------------- render ----------------
const scr = (x, y, z) => iso.P(x, y, z);
export function render(g, t, Q) {
  t_ = t; iso.g = g; const c = camAt(t); iso.cam = { ...c, z: c.z - VSHIFT / c.k };
  g.fillStyle = C.bg; g.fillRect(0, 0, W, H);
  floor(g); branches(g, t); spot(g, t);
  for (const k in PH) floorType(g, t, PH[k].P, PH[k].L);
  backWalls(g); shelf(g, t);
  furniture(); pile(t); card(t); passers(t); nearWalls();
  const op = ownerPos(t);
  iso.bill(op.x, op.y, 0, gg => drawPerson(gg, OWNER, { walking: op.walking, phase: op.ph }), { r: 2 });
  iso.flush();
  const [ox, oy] = scr(op.x, op.y, OWNER.h + .25);
  // fears: three bubbles over her, one per word
  bubble(g, ox, oy, '?', win(t, B(0)[0] + .2, at_(0, .7)), true);
  bubble(g, ox - 150, oy - 10, 'קוד?', win(t, at_(1, .02), B(2)[0] + .1));
  bubble(g, ox + 110, oy - 105, 'יחליף אותי?', win(t, at_(1, .25), B(2)[0] + .1));
  // what the agent did, at each station as the task lands
  const st = { phone: [1.65, 1.3, 1.25, 'לקוח נענה'], shelf: [.5, 4.4, 2.0, 'חשבונית סודרה'], board: [6.6, 0, 2.6, 'תזכורת נשלחה'] };
  for (const k in st) { const [x, y, z, s] = st[k], [sx, sy] = scr(x, y, z); bubble(g, sx, sy, s, win(t, ARRIVE[k] - .05, B(6)[0] + .3)); }
  bubble(g, ox, oy, 'מאשרת', win(t, CARD.ok - .15, CARD.out0 + .5), true);
  if (!Q?.has('nosub')) subtitles(g, t);
  endCard(g, t);
}

// ---------------- events, texts ----------------
export function events() {
  const ev = [{ t: 0, type: 'timeline', DUR, VO, B: [0, 1, 2, 3, 4, 5, 6, 7].map(B), END }];
  LINES.forEach((s, i) => ev.push({ t: VO[i], type: 'vo', id: 't' + (i + 1) }));
  for (const k in PH) { const L = PH[k].L; [...L].sort((a, b) => a.tc - b.tc).forEach((c, j) => ev.push({ t: c.tc, type: 'land', accent: c.col === C.accent, j })); }
  for (let i = 2; i < 7; i++) ev.push({ t: B(1)[0] + .2 + (i - 2) * .45 + .25, type: 'pile' });
  [B(0)[0] + .2, at_(1, .02), at_(1, .25)].forEach(t => ev.push({ t, type: 'pop' }));
  STREET.forEach(s => ev.push({ t: s.t0 + 1.2, type: 'pass' }));
  ev.push({ t: B(5)[0] - .05, type: 'chime' }, { t: B(4)[0] + .25, type: 'hook' });
  for (const k in FLY) ev.push({ t: FLY[k][0], type: 'whoosh' }, { t: ARRIVE[k], type: 'arrive' });
  ev.push({ t: CARD.t0, type: 'paper' }, { t: CARD.ok, type: 'approve' }, { t: CARD.out0, type: 'paper' }, { t: at_(2, .22), type: 'one' }, { t: END, type: 'end' });
  ev.push({ t: at_(0, .1), type: 'step' }, { t: at_(0, .3), type: 'step' }, { t: B(3)[0] + 1.05, type: 'step' }, { t: B(3)[0] + 1.4, type: 'step' });
  return ev.sort((a, b) => a.t - b.t);
}
export function texts(t) {
  const out = []; const c = camAt(t); iso.cam = { ...c, z: c.z - VSHIFT / c.k };
  for (const k in PH) { const { P: Pp, L } = PH[k]; const first = Math.min(...L.map(x => x.tc)); if (t >= first && t < Pp.t1 + .3) out.push({ id: k, text: L.map(x => x.ch).join(''), ...phraseBox(Pp, L) }); }
  if (t >= END) out.push({ id: 'end', text: ENDTX.join(' '), x0: 90, y0: 1470, x1: W - 90, y1: 1800 });
  return out;
}
