#!/usr/bin/env python3
"""Format F, reference look (Karin 18.11): the peeled strip is a window onto a hidden layer that stays fixed
behind the screen (like the city lights in the reference), so moving/stretching the strip reveals different parts.
usage: python3 peel/reveal.py plate.mp4 layer.png out.mp4 [opacity=0.93]"""
import sys, subprocess, numpy as np, cv2
plate, layer, out = sys.argv[1:4]; op = float(sys.argv[4]) if len(sys.argv) > 4 else 0.93
cap = cv2.VideoCapture(plate); fps = cap.get(cv2.CAP_PROP_FPS) or 24; W, H = int(cap.get(3)), int(cap.get(4))
L = cv2.resize(cv2.imread(layer), (W, H), interpolation=cv2.INTER_AREA).astype(np.float32)
ff = subprocess.Popen(["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "bgr24", "-s", f"{W}x{H}", "-r", str(fps), "-i", "-",
                       "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "17", "-preset", "medium", out], stdin=subprocess.PIPE)
n = 0
while True:
    ok, fr = cap.read()
    if not ok: break
    f = fr.astype(np.float32); b, g, r = f[..., 0], f[..., 1], f[..., 2]
    hsv = cv2.cvtColor(fr, cv2.COLOR_BGR2HSV); hh, ss, vv = [hsv[..., i].astype(np.float32) for i in range(3)]
    a = ((hh >= 24) & (hh <= 90) & (vv > 50)).astype(np.float32) * np.clip((ss - 60) / 50, 0, 1)
    hard = (a > 0.6).astype(np.uint8); k, lab, st, _ = cv2.connectedComponentsWithStats(hard)
    big = [i for i in range(1, k) if st[i, cv2.CC_STAT_AREA] > 150]
    keep = cv2.dilate(np.isin(lab, big).astype(np.uint8), np.ones((9, 9), np.uint8)) if big else np.zeros_like(hard)
    a = cv2.GaussianBlur(cv2.dilate(a, np.ones((3, 3), np.uint8)) * keep, (0, 0), 0.8)
    shade = np.clip(vv / max(np.percentile(vv[a > 0.6], 90), 1), 0.55, 1.15)[..., None] if (a > 0.6).any() else 1  # keep the strip's own light falloff
    clean = f.copy(); clean[..., 1] = np.minimum(g, np.maximum(r, b) + 6)
    A = (a * op)[..., None]
    glow = cv2.GaussianBlur(a, (0, 0), 9)[..., None] * np.array([90, 40, 10], np.float32)
    f = clean * (1 - A) + (L * shade) * A + glow * (1 - A)
    ff.stdin.write(np.clip(f, 0, 255).astype(np.uint8).tobytes()); n += 1
ff.stdin.close(); ff.wait(); print(out, n)
