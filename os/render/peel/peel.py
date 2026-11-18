#!/usr/bin/env python3
"""Format F ("הצצה"): map a scrolling agent-activity strip onto a chroma-green strip held by hands.
usage: python3 peel/peel.py plate.mp4 strip.png out.mp4 [speed_px_per_s=900]
Per frame: key pure green, find the strip quad (largest green blob -> 4 corners), warp the visible window
of the strip image (scrolling right->left for Hebrew) into it, despill and composite. Output has no audio."""
import sys, subprocess, numpy as np, cv2
plate, strip, out = sys.argv[1:4]; speed = float(sys.argv[4]) if len(sys.argv) > 4 else 900
S = cv2.imread(strip); SH, SW = S.shape[:2]
cap = cv2.VideoCapture(plate); fps = cap.get(cv2.CAP_PROP_FPS) or 24
W, H = int(cap.get(3)), int(cap.get(4))
ff = subprocess.Popen(["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "bgr24", "-s", f"{W}x{H}", "-r", str(fps), "-i", "-",
                       "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "17", "-preset", "medium", out], stdin=subprocess.PIPE)
def order(p):
    s, d = p.sum(1), p[:, 0] - p[:, 1]
    return np.array([p[s.argmin()], p[d.argmax()], p[s.argmax()], p[d.argmin()]], np.float32)  # TL TR BR BL
k = 0; prev = None
while True:
    ok, fr = cap.read()
    if not ok: break
    f = fr.astype(np.float32); b, g, r = f[..., 0], f[..., 1], f[..., 2]
    gm = g - np.maximum(r, b); a = np.clip((gm - 25) / 55, 0, 1)
    hard = (gm > 50).astype(np.uint8)
    n, lab, st, _ = cv2.connectedComponentsWithStats(hard)
    if n > 1:
        i = 1 + st[1:, cv2.CC_STAT_AREA].argmax(); blob = (lab == i).astype(np.uint8)
        if st[i, cv2.CC_STAT_AREA] > 400:
            cnt = max(cv2.findContours(blob, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)[0], key=cv2.contourArea)
            hull = cv2.convexHull(cnt); q = None
            for eps in np.linspace(0.01, 0.1, 19):
                ap = cv2.approxPolyDP(hull, eps * cv2.arcLength(hull, True), True)
                if len(ap) == 4: q = order(ap.reshape(4, 2).astype(np.float32)); break
            if q is None: q = order(cv2.boxPoints(cv2.minAreaRect(cnt)).astype(np.float32))
            c = q.mean(0); q = c + (q - c) * 1.03  # grow slightly to cover soft edges
            prev = q
    if prev is not None and a.max() > 0.2:
        q = prev; wq = (np.linalg.norm(q[1] - q[0]) + np.linalg.norm(q[2] - q[3])) / 2; hq = (np.linalg.norm(q[3] - q[0]) + np.linalg.norm(q[2] - q[1])) / 2
        vw = int(np.clip(SH * wq / max(hq, 1), SH, SW))
        x1 = int(max(0, SW - vw - k / fps * speed)); win = S[:, x1:x1 + vw]
        if win.shape[1] < vw: win = np.concatenate([win, S[:, :vw - win.shape[1]]], 1)
        M = cv2.getPerspectiveTransform(np.float32([[0, 0], [vw, 0], [vw, SH], [0, SH]]), q)
        warp = cv2.warpPerspective(win, M, (W, H), flags=cv2.INTER_LINEAR).astype(np.float32)
        glow = cv2.GaussianBlur(a, (0, 0), 6)[..., None] * 0.25 * np.array([255, 120, 60], np.float32)  # soft blue glow
        clean = f.copy(); clean[..., 1] = np.minimum(g, np.maximum(r, b) + 8)
        A = a[..., None]; f = clean * (1 - A) + warp * A + glow * (1 - A)
    ff.stdin.write(np.clip(f, 0, 255).astype(np.uint8).tobytes()); k += 1
ff.stdin.close(); ff.wait(); print(out, k, "frames")
