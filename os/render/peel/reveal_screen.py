#!/usr/bin/env python3
"""Format F "behind the scenes" (Karin 19.11): fingers pinch on a dark laptop screen and open it up; whatever turns
chroma green reveals the agent's screen *behind the scenes*. The content video is warped onto the laptop screen's
quad (taken from the frame where the green covers the most area), so it stays locked to the screen while it opens.
usage: python3 peel/reveal_screen.py plate.mp4 content.mp4 out.mp4 [content_start_s=0]"""
import sys, subprocess, numpy as np, cv2
plate, content, out = sys.argv[1:4]; c0 = float(sys.argv[4]) if len(sys.argv) > 4 else 0
cap = cv2.VideoCapture(plate); fps = cap.get(cv2.CAP_PROP_FPS) or 24; W, H = int(cap.get(3)), int(cap.get(4))
frames = []
while True:
    ok, fr = cap.read()
    if not ok: break
    frames.append(fr)
def key(fr):
    f = fr.astype(np.float32); b, g, r = f[..., 0], f[..., 1], f[..., 2]
    hsv = cv2.cvtColor(fr, cv2.COLOR_BGR2HSV); hh, ss, vv = [hsv[..., i].astype(np.float32) for i in range(3)]
    a1 = ((hh >= 24) & (hh <= 90) & (vv > 45)).astype(np.float32) * np.clip((ss - 55) / 50, 0, 1)
    gm = g - np.maximum(r, b); a2 = np.clip((gm - 10) / 18, 0, 1) * (vv > 90) * (hh >= 28) * (hh <= 88)
    a = np.maximum(a1, a2); hard = (a > 0.5).astype(np.uint8)
    k, lab, st, _ = cv2.connectedComponentsWithStats(hard)
    if k <= 1: return a * 0, None
    i = 1 + st[1:, cv2.CC_STAT_AREA].argmax()
    keep = cv2.dilate((lab == i).astype(np.uint8), np.ones((11, 11), np.uint8))
    return cv2.GaussianBlur(cv2.dilate(a, np.ones((3, 3), np.uint8)) * keep, (0, 0), 0.8), (lab == i).astype(np.uint8)
alphas, blobs = zip(*[key(f) for f in frames])
areas = [b.sum() if b is not None else 0 for b in blobs]; best = int(np.argmax(areas))
cnt = max(cv2.findContours(blobs[best], cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)[0], key=cv2.contourArea)
hull = cv2.convexHull(cnt); q = None
for eps in np.linspace(0.01, 0.08, 15):
    ap = cv2.approxPolyDP(hull, eps * cv2.arcLength(hull, True), True)
    if len(ap) == 4: q = ap.reshape(4, 2).astype(np.float32); break
if q is None: q = cv2.boxPoints(cv2.minAreaRect(cnt)).astype(np.float32)
s, d = q.sum(1), q[:, 0] - q[:, 1]; q = np.array([q[s.argmin()], q[d.argmax()], q[s.argmax()], q[d.argmin()]], np.float32)
c = q.mean(0); q = c + (q - c) * 1.04
print('screen quad', q.round(1).tolist(), 'from frame', best, 'area', areas[best])
cc = cv2.VideoCapture(content); cfps = cc.get(cv2.CAP_PROP_FPS) or 30; cc.set(cv2.CAP_PROP_POS_MSEC, c0 * 1000)
CW, CH = int(cc.get(3)), int(cc.get(4)); M = cv2.getPerspectiveTransform(np.float32([[0, 0], [CW, 0], [CW, CH], [0, CH]]), q)
ff = subprocess.Popen(["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "bgr24", "-s", f"{W}x{H}", "-r", str(fps), "-i", "-",
                       "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "17", "-preset", "medium", out], stdin=subprocess.PIPE)
cur = None; tnext = 0
for k, fr in enumerate(frames):
    t = k / fps
    while cur is None or tnext <= t:
        ok, cf = cc.read()
        if ok: cur = cf
        tnext += 1 / cfps
        if not ok: break
    warp = cv2.warpPerspective(cur, M, (W, H), flags=cv2.INTER_LINEAR).astype(np.float32)
    f = fr.astype(np.float32); f[..., 1] = np.minimum(f[..., 1], np.maximum(f[..., 0], f[..., 2]) + 6)
    A = alphas[k][..., None]; glow = cv2.GaussianBlur(alphas[k], (0, 0), 7)[..., None] * np.array([60, 25, 5], np.float32)
    f = f * (1 - A) + warp * A + glow * (1 - A)
    ff.stdin.write(np.clip(f, 0, 255).astype(np.uint8).tobytes())
ff.stdin.close(); ff.wait(); print(out, len(frames))
