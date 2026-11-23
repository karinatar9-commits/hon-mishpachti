// רחוב העסקים — one street of four small shops, towers behind. Three neighbours already run an agent (lit paths,
// customers in and out, "done" bubbles); our owner doesn't: a tower of paper on her desk and a queue outside that
// starts walking to the neighbour. Then the same three steps light her shop too. 1080×1920, 30 fps, metres.
import { iso, tri, C, TOPS, LEGS, W, H, onPlane, quad, fillPoly, rect, tracePath, phraseLayout, floorType, phraseBox, drawPerson,
  font, mix, hex, css, clamp, lerp, seg, ss, eo, eio, TAU } from './kit.js';

// ---------------- narration (Karin's voice) ----------------
export const LINES = [
  'הפחד מבינה מלאכותית עולה לכם יותר כסף מהבינה המלאכותית עצמה.',
  'תנו לי שלושים שניות, ותראו איך הופכים אותה לעובד הכי זול בעסק, בשלושה צעדים.',
  'צעד ראשון: מתחילים ממשימה אחת שגוזלת לכם זמן כל יום. ככה רואים תוצאה כבר בשבוע הראשון.',
  'צעד שני: האישור נשאר אצלכם. הסוכן מכין, אתם מאשרים, ושום דבר לא יוצא בלי שראיתם.',
  'והצעד השלישי הוא זה שהכי חוסך כסף.',
  'מחברים את הסוכן למערכות שכבר יש לכם. לא מחליפים כלום, רק מפסיקים לעבוד בשבילן.',
  'משימה אחת, אישור שלכם, ומה שכבר יש בעסק. ככה זה עובד בשבילכם.',
  'תגיבו: מתחילים, ואשלח לכם מיפוי חינמי של המשימות שאפשר להעביר לסוכן כבר השבוע.',
];
export const VO_DUR = [4.423, 5.288, 7.101, 7.037, 2.974, 5.826, 5.357, 5.772];
const GAPS = [.2, .3, .3, .45, .55, .3, .3];
export const VO = []; { let t = .15; VO_DUR.forEach((d, i) => { VO.push(+t.toFixed(3)); t += d + (GAPS[i] ?? 0); }); }
const B = i => [VO[i], i < 7 ? VO[i + 1] : VO[7] + VO_DUR[7] + .3];
const END = VO[7] + VO_DUR[7] + .35;
export const DUR = +(END + 5.5).toFixed(2);
const at_ = (i, f) => VO[i] + VO_DUR[i] * f;

// ---------------- palette ----------------
const P = {
  street: '#E6DDCC', kerb: '#DCD0BA', floor: ['#F2E5CE', '#EFE3D0', '#F3E7D2', '#EDE2CF'], grid: '#E4D3B6', wall: '#F4ECDD',
  wood: '#C79B6E', dark: '#3A3E3B', paper: '#FBF6EC', shelf: '#3D6B59', note: ['#E9C77A', '#A7C2B2', '#EDBFA9', '#D3C29E'],
  tower: ['#A7C2B2', '#C9BFAE', '#B9C9C0', '#D6CBB8', '#9FB5A9'], win: '#F6EFE0', winLit: '#F2D08A', awning: ['#3D6B59', '#B9824F', '#7F98AE', '#8C8199'],
};

// ---------------- the street ----------------
const SW = 8, SD = 7, GAP = 1.4, NS = 4, OURS = 1;
const X = i => i * (SW + GAP);
const DOOR = i => [X(i) + 2.3, X(i) + 3.6];
const DESK = i => ({ x: X(i) + 3.4, y: 2.5, w: 2.2, d: 1.0 });
const SPOT = i => [X(i) + 4.5, 4.05];                // owner's standing spot (camera side of the desk)
const STA = i => ({ phone: [X(i) + 1.5, 1.8], shelf: [X(i) + .8, 3.0], board: [X(i) + 6.0, .7] });
const HUB = i => [X(i) + 3.0, 3.0];
const BR = i => ({
  phone: [HUB(i), [X(i) + 3.0, 1.8], [X(i) + 2.1, 1.8]],
  shelf: [HUB(i), [X(i) + .8, 3.0]],
  board: [HUB(i), [X(i) + 3.0, 1.8], [X(i) + 6.0, 1.8], [X(i) + 6.0, .7]],
});
const OWNERS = [{ h: 1.74, top: TOPS[1], legs: LEGS[1] }, { h: 1.68, top: TOPS[0], legs: LEGS[0], hairLong: true }, { h: 1.7, top: TOPS[3], legs: LEGS[3], hairLong: true }, { h: 1.78, top: TOPS[2], legs: LEGS[2] }];
const CUST = [{ h: 1.72, top: TOPS[1], legs: LEGS[2] }, { h: 1.64, top: TOPS[3], legs: LEGS[0], hairLong: true }, { h: 1.8, top: TOPS[2], legs: LEGS[1] }, { h: 1.66, top: TOPS[0], legs: LEGS[3], hairLong: true }, { h: 1.75, top: TOPS[3], legs: LEGS[1] }];

// towers behind the shops (the city of businesses), deterministic
const TOWERS = []; { let x = -8; let k = 0; while (x < X(NS) + 4) { const w = 3.5 + (k * 37 % 5) * .5, h = 9 + (k * 53 % 7) * 2.2, y = -6 - (k * 29 % 4) * 2.2; TOWERS.push({ x, y, w, d: 3.5 + (k % 3), h, c: P.tower[k % 5], k }); x += w + .8 + (k * 13 % 3) * .4; k++; } }
function towers(g, t) {
  for (const T of TOWERS) {
    iso.box(T.x, T.y - T.d, 0, T.w, T.d, T.h, tri(T.c, .18, .2), {
      cull: false, decal: () => {
        const rows = Math.floor((T.h - 1) / 1.4), cols = Math.max(2, Math.floor(T.w / 1.1));
        onPlane(g, T.x, T.y, T.h - .6, 'xz', g2 => { for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) { const lit = (T.k * 7 + r * 3 + c * 5) % 9 < 3 && Math.sin(t * .8 + r + c + T.k) > -.3; g2.fillStyle = lit ? P.winLit : P.win; g2.fillRect(.35 + c * 1.1, r * 1.4, .6, .8); } });
      },
    });
  }
}
function street(g) {
  fillPoly(g, quad(rect(-12, X(NS) + 10, -20, SD + 7), -.02), P.street);
  fillPoly(g, quad(rect(-12, X(NS) + 10, SD + .25, SD + .55), -.01), P.kerb);
  for (let i = 0; i < NS; i++) {
    fillPoly(g, quad(rect(X(i), X(i) + SW, 0, SD), 0), P.floor[i]);
    g.save(); g.strokeStyle = P.grid; g.lineWidth = Math.max(1, iso.cam.k * .01);
    for (let a = 1; a < SW; a++) { g.beginPath(); g.moveTo(...iso.P(X(i) + a, 0, 0)); g.lineTo(...iso.P(X(i) + a, SD, 0)); g.stroke(); }
    for (let a = 1; a < SD; a++) { g.beginPath(); g.moveTo(...iso.P(X(i), a, 0)); g.lineTo(...iso.P(X(i) + SW, a, 0)); g.stroke(); }
    g.restore();
  }
}
function shopBack(g, t, i) {
  iso.boxNow(X(i) - .2, -.2, 0, .2, SD + .2, 2.7, tri(P.wall, .05, .12));
  iso.boxNow(X(i), -.2, 0, SW, .2, 2.7, tri(P.wall, .05, .12));
  // awning band on the back wall top in the shop's colour, pin board, window
  onPlane(g, X(i), 0, 2.7, 'xz', g2 => { g2.fillStyle = P.awning[i]; g2.fillRect(0, 0, SW, .28); });
  onPlane(g, X(i) + .9, 0, 2.2, 'xz', g2 => { g2.fillStyle = '#CFE0DA'; g2.fillRect(0, 0, 2.2, 1.1); });
  const rem = i === OURS ? ss(seg(t, ARR.board, ARR.board + .4)) : 1;
  onPlane(g, X(i) + 5.0, 0, 2.15, 'xz', g2 => {
    g2.fillStyle = '#B58A5E'; g2.fillRect(0, 0, 2.2, 1.2); g2.fillStyle = '#D7B48A'; g2.fillRect(.06, .06, 2.08, 1.08);
    [[.15, .12], [.65, .1], [1.2, .18], [1.6, .12], [.3, .6], [.9, .58], [1.45, .64]].forEach(([u, v], j) => { g2.fillStyle = j === 3 ? hex(mix(P.note[j % 4], C.accent, rem)) : P.note[j % 4]; g2.fillRect(u, v, .38, .36); });
  });
  // shelf on the left wall with five folders; the agent's folder lights
  iso.boxNow(X(i), 1.8, 0, .45, 2.4, 1.6, tri(P.shelf));
  const lit = i === OURS ? ss(seg(t, ARR.shelf, ARR.shelf + .35)) : .5 + .5 * Math.sin(t * 2 + i);
  [2.0, 2.45, 2.9, 3.35, 3.8].forEach((y, j) => onPlane(g, X(i) + .45, y + .18, 1.38, 'yz', g2 => {
    const l = j === 2 ? lit : 0; g2.fillStyle = hex(mix(P.paper, C.accent, l * .85)); g2.fillRect(0, 0, .36, .9);
  }));
}
function shopFront(i) {
  iso.box(X(i) + SW, 0, 0, .2, SD + .2, .45, tri(P.wall, .05, .12), { bias: -.2 });
  iso.box(X(i), SD, 0, DOOR(i)[0] - X(i), .2, .45, tri(P.wall, .05, .12), { bias: -.2 });
  iso.box(DOOR(i)[1], SD, 0, X(i) + SW - DOOR(i)[1], .2, .45, tri(P.wall, .05, .12), { bias: -.2 });
}
function furniture(i) {
  const D = DESK(i);
  iso.box(D.x, D.y, 0, D.w, D.d, .75, tri(P.wood));
  iso.box(D.x + 1.3, D.y + .25, .75, .58, .4, .03, tri(P.dark), { bias: -.4 });
  iso.box(X(i) + .9, .6, 0, 1.0, .7, .8, tri(P.wood));
  iso.box(X(i) + 1.2, .8, .8, .24, .38, .03, tri(P.dark), { bias: -.4 });
}

// ---------------- the agent: lit branches (neighbours always, ours from step three) ----------------
function branches(g, t, i, u, a = 1) {
  if (u <= 0 || a <= 0) return;
  g.save(); g.globalAlpha = a; g.strokeStyle = C.accent; g.lineCap = 'round'; g.lineJoin = 'round'; g.lineWidth = Math.max(2, iso.cam.k * .12);
  if (i !== OURS) { g.setLineDash([iso.cam.k * .35, iso.cam.k * .22]); g.lineDashOffset = -t * iso.cam.k * 1.6; }
  ['shelf', 'phone', 'board'].forEach((k, j) => { const v = clamp(u * 1.6 - j * .3); if (v > 0) tracePath(g, BR(i)[k].map(p => iso.P(p[0], p[1], .01)), eio(v)); });
  g.setLineDash([]); g.fillStyle = C.accent; const [hx, hy] = iso.P(...HUB(i), .01); g.beginPath(); g.arc(hx, hy, iso.cam.k * .18, 0, TAU); g.fill();
  g.restore();
}

// ---------------- our desk: a tower of paper (crashes in at the start), one task lights, the tower flies away ----------------
const PILE = [];   // [dx, dy, level]
for (let lv = 0; lv < 9; lv++) PILE.push([.35 + (lv % 2) * .5, .3 + (lv % 3) * .15, lv]);
const FLY = { phone: [at_(5, .05), 8], shelf: [at_(5, .28), 7], board: [at_(5, .5), 6] };
const FLYD = 1.1;
const ARR = { phone: FLY.phone[0] + FLYD, shelf: FLY.shelf[0] + FLYD, board: FLY.board[0] + FLYD };
const CLEAR = at_(5, .72);        // the rest of the tower files itself away
const pathPt = (pts, u) => { const L = [0]; for (let i = 1; i < pts.length; i++) L.push(L[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1])); const s = u * L[L.length - 1]; let i = 1; while (i < L.length - 1 && L[i] < s) i++; const f = (s - L[i - 1]) / (L[i] - L[i - 1] || 1); return [lerp(pts[i - 1][0], pts[i][0], f), lerp(pts[i - 1][1], pts[i][1], f)]; };
function pile(t) {
  const D = DESK(OURS);
  PILE.forEach(([dx, dy, lv], j) => {
    for (const k in FLY) if (FLY[k][1] === j && t >= FLY[k][0]) return;
    const gone = j < 6 ? ss(seg(t, CLEAR + j * .12, CLEAR + .35 + j * .12)) : 0; if (gone >= 1) return;
    const pop = ss(seg(t, .02 + j * .07, .28 + j * .07)), bounce = Math.abs(Math.sin(seg(t, .28 + j * .07, .55 + j * .07) * Math.PI)) * .1 * (t < .55 + j * .07 ? 1 : 0);
    const one = j === 8 && t > at_(2, .22) ? ss(seg(t, at_(2, .22), at_(2, .22) + .35)) : 0;
    const z = .75 + lv * .16 + (1 - pop) * 5 + bounce + one * .3 + gone * 2.5;
    iso.box(D.x + dx - .25, D.y + dy - .18, z, .5, .36, .14, tri(hex(mix(P.paper, C.accent, Math.max(one, gone * .6)))), { bias: lv * .05 });
  });
  for (const k in FLY) {
    const [t0, j] = FLY[k]; if (t < t0 || t > t0 + FLYD + .3) continue;
    const u = eio(seg(t, t0, t0 + FLYD)), [dx, dy, lv] = PILE[j], pts = [[D.x + dx, D.y + dy], ...BR(OURS)[k]];
    const [x, y] = pathPt(pts, u), z = lerp(.75 + lv * .16, 1.4, u) + Math.sin(u * Math.PI) * .9;
    if (t < t0 + FLYD + .25) iso.box(x - .25, y - .18, z, .5, .36, .14, tri(hex(mix(P.paper, C.accent, .6))), { bias: 3 });
  }
}

// ---------------- people ----------------
const bill = (p, x, y, walking, phase, a = 1) => iso.bill(x, y, 0, gg => { gg.globalAlpha *= a; drawPerson(gg, p, { walking, phase }); }, { r: 2, cull: false });
function walkAlong(pts, t0, speed) { const L = [0]; for (let i = 1; i < pts.length; i++) L.push(L[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1])); return { pts, L, t0, t1: t0 + L[L.length - 1] / speed, speed }; }
function posOn(r, t) { const s = clamp((t - r.t0) * r.speed, 0, r.L[r.L.length - 1]); let i = 1; while (i < r.L.length - 1 && r.L[i] < s) i++; const f = (s - r.L[i - 1]) / (r.L[i] - r.L[i - 1] || 1); return { x: lerp(r.pts[i - 1][0], r.pts[i][0], f), y: lerp(r.pts[i - 1][1], r.pts[i][1], f), walking: t > r.t0 && t < r.t1, s }; }
// neighbours' customers: a loop — street → door → counter → wait → out and away along the street
function neighbourCustomers(t, i) {
  const door = (DOOR(i)[0] + DOOR(i)[1]) / 2, period = 7.5;
  for (let c = 0; c < 2; c++) {
    const ph = ((t + c * period / 2 + i * 1.3) % period + period) % period, p = CUST[(i + c) % CUST.length];
    let x, y, w = true;
    if (ph < 1.6) { x = door - 4 + ph * 2.5; y = SD + 1.6; }                       // walk in along the street
    else if (ph < 3.2) { x = door; y = lerp(SD + 1.6, 5.0, (ph - 1.6) / 1.6); }    // through the door to the counter (away from camera)
    else if (ph < 4.4) { x = door; y = 5.0; w = false; }                           // served
    else if (ph < 5.6) { x = lerp(door, door + 2.6, (ph - 4.4) / 1.2); y = 5.0; } // across to the side
    else { x = door + 2.6 + (ph - 5.6) * 2.2; y = lerp(5.0, 5.0, 0); }
    const a = ph > 6.8 ? 1 - (ph - 6.8) / .7 : ph < .3 ? ph / .3 : 1;
    bill(p, x, y, w, t * 7 + c);
  }
}
// our queue: five people waiting outside the door; two give up and walk to the neighbour; the rest come in at step three
const QX = i => DOOR(OURS)[1] + .3 + i * .8, QY = SD + 1.5;
const LEAVE = [walkAlong([[QX(4), QY], [QX(4), QY + .9], [DOOR(2)[0] + .6, QY + .9], [DOOR(2)[0] + .6, 5.0]], at_(1, .12), 2.2),
  walkAlong([[QX(3), QY], [QX(3), QY + .9], [DOOR(2)[0] + 1.0, QY + .9], [DOOR(2)[0] + 1.0, 5.6]], at_(1, .32), 2.2)];
const ENTER = [0, 1, 2].map(i => walkAlong([[QX(i), QY], [DOOR(OURS)[0] + .6 + i * .3, QY], [DOOR(OURS)[0] + .6 + i * .3, 5.0 + i * .5]], at_(5, .55) + i * .35, 1.8));
function ourQueue(t) {
  for (let i = 0; i < 5; i++) {
    let x = QX(i), y = QY, w = false;
    if (i >= 3) { const r = LEAVE[4 - i]; if (t >= r.t0) { const q = posOn(r, t); x = q.x; y = q.y; w = q.walking; } }
    else if (t >= ENTER[i].t0) { const q = posOn(ENTER[i], t); x = q.x; y = q.y; w = q.walking; }
    bill(CUST[i], x, y, w, t * 7 + i);
  }
}
function ownerPos(t) {
  const [sx, sy] = SPOT(OURS);
  const back = eio(seg(t, at_(0, .08), at_(0, .4))), fwd = eio(seg(t, B(3)[0] + 1.0, B(3)[0] + 1.6));
  return { x: sx, y: lerp(lerp(sy, sy + .6, back), sy, fwd), walking: (t > at_(0, .08) && t < at_(0, .4)) || (t > B(3)[0] + 1.0 && t < B(3)[0] + 1.6), ph: t * 7 };
}
const CARD = { t0: B(3)[0] + .1, at: B(3)[0] + 1.0, ok: at_(3, .62), out0: at_(3, .78), out1: B(4)[0] + .5 };
function card(t) {
  if (t < CARD.t0 || t > CARD.out1 + .1) return;
  const [sx, sy] = SPOT(OURS), A = [X(OURS) + .8, 3.0, 1.65], Bp = [sx - .6, sy + .1, 1.3], Dp = [(DOOR(OURS)[0] + DOOR(OURS)[1]) / 2, SD + 2.5, 1.1];
  let x, y, z;
  if (t < CARD.at) { const u = eio(seg(t, CARD.t0, CARD.at)); [x, y, z] = [lerp(A[0], Bp[0], u), lerp(A[1], Bp[1], u), lerp(A[2], Bp[2], u) + Math.sin(u * Math.PI) * .7]; }
  else if (t < CARD.out0) [x, y, z] = Bp;
  else { const u = eio(seg(t, CARD.out0, CARD.out1)); [x, y, z] = [lerp(Bp[0], Dp[0], u), lerp(Bp[1], Dp[1], u), lerp(Bp[2], Dp[2], u) + Math.sin(u * Math.PI) * .6]; }
  iso.box(x - .3, y - .22, z, .6, .44, .05, tri(hex(mix(P.paper, C.accent, ss(seg(t, CARD.ok, CARD.ok + .25))))), { bias: 3 });
}
function spot(g, t) {
  const a = ss(seg(t, B(3)[0] + .3, B(3)[0] + .7)) * (1 - ss(seg(t, B(4)[0] + .2, B(4)[0] + .6))); if (a <= 0) return;
  const [x, y] = SPOT(OURS);
  g.save(); g.globalAlpha = a; g.strokeStyle = C.accent; g.lineWidth = iso.cam.k * .07; g.setLineDash([iso.cam.k * .22, iso.cam.k * .12]);
  tracePath(g, quad(rect(x - .5, x + .5, y - .4, y + .45).concat([[x - .5, y - .4]]), .01), eio(seg(t, B(3)[0] + .3, B(3)[0] + 1.0)));
  g.restore();
}

// ---------------- floor words inside our shop (right side, clear floor) ----------------
const heb = s => [...s].reverse().join('');
function phrase(o) {
  const lines = o.lines.map(l => l.map(([s, k]) => [k.startsWith('n') ? s : heb(s), k]).reverse());
  const Pp = { ...o, lines }; const L = phraseLayout(Pp);
  for (let li = 0; li < lines.length; li++) { const cs = L.filter(c => c.li === li), ts = cs.map(c => c.tc).sort((a, b) => a - b); cs.reverse().forEach((c, i) => c.tc = ts[i]); }
  return { P: Pp, L };
}
const FX = X(OURS) + 7.7, FY = 6.8;
const PH = {
  one: phrase({ x: FX, y: FY, t0: at_(2, .18), t1: B(3)[0] - .05, step: .11, scale: .6, lines: [[['משימה ', 'B'], ['אחת', 'A']]] }),
  ok: phrase({ x: FX, y: FY, t0: at_(3, .3), t1: B(4)[0] - .05, step: .14, scale: .8, lines: [[['אישור', 'A']]] }),
  three: phrase({ x: FX, y: FY - .4, t0: B(4)[0] + .25, t1: B(5)[0] + .2, step: .1, scale: 1.3, lines: [[['3', 'na']]] }),
  start: phrase({ x: FX, y: FY, t0: B(7)[0] + .2, t1: DUR + 1, step: .12, scale: .65, lines: [[['מתחילים', 'A']]] }),
};

// ---------------- camera ----------------
const K = (x, y, z, k) => ({ x, y, z, k });
const O = X(OURS);
const CAMS = [
  [0, K(O + 4.4, 3.2, 1.2, 80)], [.7, K(O + 4.5, 3.4, 1.4, 128)], [at_(0, .55), K(O + 4.6, 3.6, 1.4, 132)],   // hook: snap into the paper tower
  [B(0)[1] - .1, K(O + 4.5, 2.5, 2.5, 40)],                                                                     // reveal: the street, the towers, the lit neighbours
  [at_(1, .2), K(O + 6.5, 5.6, 1, 62)], [B(1)[1], K(X(2) + 2.5, 5.2, 1, 70)],                                   // the queue gives up and walks next door
  [B(2)[0] + .6, K(O + 4.6, 3.8, 1.2, 104)], [B(2)[1], K(O + 4.6, 3.8, 1.2, 108)],                             // step one: our desk
  [B(3)[0] + .5, K(O + 4.8, 4.4, 1, 100)], [B(3)[1], K(O + 4.8, 4.5, 1, 100)],                                 // step two: approval
  [B(4)[0] + .4, K(O + 6.4, 5.6, .6, 104)], [B(4)[1], K(O + 6.4, 5.6, .6, 110)],                               // mid-hook: the 3
  [B(5)[0] + .5, K(O + 4.4, 3.6, 1, 74)], [B(5)[1], K(O + 4.6, 4.2, 1, 72)],                                   // step three: her branches light, the queue comes in
  [B(6)[0] + .9, K(O + 4.5, 2.5, 2.5, 38)], [B(6)[1], K(O + 4.5, 2.5, 2.5, 37)],                               // summary: the whole street lit
  [B(7)[0] + .8, K(O + 5.0, 4.4, 1.2, 70)], [DUR, K(O + 5.0, 4.4, 1.2, 66)],
];
export function camAt(t) {
  let i = 0; while (i < CAMS.length - 2 && CAMS[i + 1][0] <= t) i++;
  const [ta, a] = CAMS[i], [tb, b] = CAMS[i + 1], u = eio(seg(t, ta, tb));
  return { x: lerp(a.x, b.x, u), y: lerp(a.y, b.y, u), z: lerp(a.z, b.z, u), k: Math.exp(lerp(Math.log(a.k), Math.log(b.k), u)) };
}
const VSHIFT = -60;

// ---------------- screen-space: bubbles, headline, subtitles, end card ----------------
function bubble(g, x, y, text, a, accent = false, size = 40) {
  if (a <= 0) return;
  g.save(); g.globalAlpha = a; g.font = font(700, size); g.direction = 'rtl';
  const w = Math.max(62, g.measureText(text).width + 40), h = size * 1.7, s = lerp(.7, 1, eo(a));
  g.translate(x, y); g.scale(s, s);
  g.fillStyle = accent ? C.accent : P.paper; g.beginPath(); g.roundRect(-w / 2, -h - 20, w, h, 20); g.fill();
  g.beginPath(); g.moveTo(-12, -22); g.lineTo(6, -22); g.lineTo(-5, -2); g.closePath(); g.fill();
  g.fillStyle = accent ? '#fff' : C.ink; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, 0, -h / 2 - 18);
  g.restore();
}
const win = (t, a, b) => ss(seg(t, a, a + .25)) * (1 - ss(seg(t, b - .25, b)));
const HL = [['הפחד הזה', 'עולה לכם כסף'], ['הלקוחות שלכם', 'הולכים לשכנים'], ['צעד 1', 'משימה אחת'], ['צעד 2', 'האישור אצלכם'],
  ['והצעד השלישי', 'הכי חוסך כסף'], ['צעד 3', 'מה שכבר יש לכם'], ['ככה זה', 'עובד בשבילכם'], ['תגיבו', '"מתחילים"']];
const hlIndex = t => { let i = 0; while (i < 7 && t >= B(i + 1)[0] - .05) i++; return i; };
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
    const t0 = VO[i] - .05, t1 = i < 7 ? VO[i + 1] - .05 : VO[i] + VO_DUR[i] + .3; if (t < t0 || t >= t1) return;
    g.save(); g.font = font(500, 46); g.direction = 'rtl'; const ls = wrap(g, s, 900), lh = 62, w = Math.max(...ls.map(l => g.measureText(l).width)) + 48, h = ls.length * lh + 26;
    g.fillStyle = 'rgba(250,245,236,.92)'; g.beginPath(); g.roundRect(W / 2 - w / 2, SUBY, w, h, 10); g.fill();
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
  g.fillStyle = C.ink; g.font = font(700, 58); g.fillText(ENDTX[0], W / 2, y + 70);
  g.direction = 'ltr'; g.fillStyle = C.accent; g.font = font(700, 66); g.fillText(ENDTX[1], W / 2, y + 168);
  g.direction = 'rtl'; g.fillStyle = C.soft; g.font = font(500, 42); g.fillText(ENDTX[2], W / 2, y + 262);
  g.restore();
}

// ---------------- render ----------------
const NB_SAY = ['נענה', 'נשלח', 'שולם', 'נקבע'];
export function render(g, t, Q) {
  iso.g = g; const c = camAt(t); iso.cam = { ...c, z: c.z - VSHIFT / c.k };
  g.fillStyle = C.bg; g.fillRect(0, 0, W, H);
  street(g);
  for (let i = 0; i < NS; i++) if (i !== OURS) branches(g, t, i, 1);
  branches(g, t, OURS, seg(t, B(5)[0] - .05, B(5)[0] + 1.3));
  spot(g, t);
  for (const k in PH) floorType(g, t, PH[k].P, PH[k].L);
  towers(g, t); iso.flush();
  for (let i = 0; i < NS; i++) shopBack(g, t, i);
  for (let i = 0; i < NS; i++) { furniture(i); shopFront(i); if (i !== OURS) { bill(OWNERS[i], SPOT(i)[0], SPOT(i)[1], false, 0); neighbourCustomers(t, i); } }
  pile(t); card(t); ourQueue(t);
  const op = ownerPos(t); bill(OWNERS[OURS], op.x, op.y, op.walking, op.ph);
  iso.flush();
  // neighbours' "done" bubbles, cycling
  for (let i = 0; i < NS; i++) if (i !== OURS) { const [sx, sy] = iso.P(SPOT(i)[0], SPOT(i)[1], 2.1), ph = (t + i * .9) % 2.4; bubble(g, sx, sy, NB_SAY[(Math.floor((t + i * .9) / 2.4) + i) % 4], ss(seg(ph, 0, .25)) * (1 - ss(seg(ph, 1.9, 2.2))), true, 34); }
  // our owner's fears and our queue's impatience
  const [ox, oy] = iso.P(op.x, op.y, 1.95);
  bubble(g, ox - 140, oy, 'קוד?', win(t, at_(0, .2), B(1)[0] + .3));
  bubble(g, ox + 120, oy - 90, 'יחליף אותי?', win(t, at_(0, .38), B(1)[0] + .3));
  bubble(g, ox - 40, oy - 180, 'יקר?', win(t, at_(0, .56), B(1)[0] + .3));
  const [qx, qy] = iso.P(QX(1), QY, 2.0); bubble(g, qx, qy, 'עוד מחכים…', win(t, .9, at_(1, .5)) + win(t, B(2)[0], B(5)[0]) * .0);
  const [lx, ly] = iso.P(LEAVE[0].pts[2][0], LEAVE[0].pts[2][1], 2.0); bubble(g, lx, ly, 'הולכים לשכנים', win(t, at_(1, .45), B(2)[0] + .3));
  const st = { phone: [STA(OURS).phone[0], 1.8, 1.6, 'לקוח נענה'], shelf: [X(OURS) + .5, 3.0, 2.0, 'חשבונית סודרה'], board: [X(OURS) + 6.0, 0, 2.6, 'תזכורת נשלחה'] };
  for (const k in st) { const [x, y, z, s] = st[k], [sx, sy] = iso.P(x, y, z); bubble(g, sx, sy, s, win(t, ARR[k] - .05, B(6)[0] + .5), false, 36); }
  bubble(g, ox, oy - 10, 'מאשרת', win(t, CARD.ok - .15, CARD.out0 + .5), true);
  headline(g, t);
  if (!Q?.has('nosub')) subtitles(g, t);
  endCard(g, t);
}

// ---------------- events, texts ----------------
export function events() {
  const ev = [{ t: 0, type: 'timeline', DUR, VO, B: [0, 1, 2, 3, 4, 5, 6, 7].map(B), END }];
  LINES.forEach((s, i) => ev.push({ t: VO[i], type: 'vo', id: 't' + (i + 1) }));
  for (const k in PH) [...PH[k].L].sort((a, b) => a.tc - b.tc).forEach((c, j) => ev.push({ t: c.tc, type: 'land', accent: c.col === C.accent, j }));
  for (let j = 0; j < 9; j++) ev.push({ t: .28 + j * .07, type: 'pile' });
  for (let i = 0; i < 8; i++) ev.push({ t: B(i)[0], type: 'title', i });
  [at_(0, .2), at_(0, .38), at_(0, .56)].forEach(t => ev.push({ t, type: 'pop' }));
  LEAVE.forEach(r => ev.push({ t: r.t0, type: 'pass' }));
  ev.push({ t: B(5)[0] - .05, type: 'chime' }, { t: B(4)[0] + .25, type: 'hook' }, { t: B(0)[1] - .3, type: 'whoosh' });
  for (const k in FLY) ev.push({ t: FLY[k][0], type: 'whoosh' }, { t: ARR[k], type: 'arrive' });
  ev.push({ t: CARD.t0, type: 'paper' }, { t: CARD.ok, type: 'approve' }, { t: CARD.out0, type: 'paper' }, { t: at_(2, .22), type: 'one' }, { t: END, type: 'end' });
  for (let t = 1.0; t < DUR - 1; t += 2.4) ev.push({ t, type: 'nb' });
  return ev.sort((a, b) => a.t - b.t);
}
export function texts(t) {
  const out = []; const c = camAt(t); iso.cam = { ...c, z: c.z - VSHIFT / c.k };
  for (const k in PH) { const { P: Pp, L } = PH[k]; const first = Math.min(...L.map(x => x.tc)); if (t >= first && t < Pp.t1 + .3) out.push({ id: k, text: L.map(x => x.ch).join(''), ...phraseBox(Pp, L) }); }
  if (t < END) { const i = hlIndex(t); out.push({ id: 'hl' + i, text: HL[i].join(' '), x0: 60, y0: 120, x1: W - 60, y1: 340, pass: true }); }
  if (t >= END) out.push({ id: 'end', text: ENDTX.join(' '), x0: 90, y0: 1470, x1: W - 90, y1: 1800 });
  return out;
}
