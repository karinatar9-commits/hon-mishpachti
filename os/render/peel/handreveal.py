#!/usr/bin/env python3
"""Format F — the reference technique (Karin 18.11): no physical strip at all. The hands mime a pinch/stretch/frame in
front of a dark laptop; we track the thumb and index fingertips of both hands (MediaPipe) and reveal a hidden image
through the quad they span: [left index, right index, right thumb, left thumb]. Pinched fingers -> a thin ribbon;
opening thumb and index -> the window grows taller. The hidden image is locked to the frame (like a picture behind
the screen), so moving the hands reveals different parts of it.
usage: python3 peel/handreveal.py plate.mp4 hidden.png out.mp4 [model=media/raw/mp_hand_landmarker.task] [min_px=6]"""
import sys, subprocess, numpy as np, cv2, mediapipe as mp
from mediapipe.tasks import python as mpt
from mediapipe.tasks.python import vision
plate, hidden, out = sys.argv[1:4]
model = sys.argv[4] if len(sys.argv) > 4 else 'media/raw/mp_hand_landmarker.task'; MINPX = float(sys.argv[5]) if len(sys.argv) > 5 else 6
cap = cv2.VideoCapture(plate); fps = cap.get(cv2.CAP_PROP_FPS) or 24; W, H = int(cap.get(3)), int(cap.get(4))
frames = []
while True:
    ok, fr = cap.read()
    if not ok: break
    frames.append(fr)
det = vision.HandLandmarker.create_from_options(vision.HandLandmarkerOptions(
    base_options=mpt.BaseOptions(model_asset_path=model), running_mode=vision.RunningMode.VIDEO, num_hands=2,
    min_hand_detection_confidence=0.3, min_hand_presence_confidence=0.3, min_tracking_confidence=0.3))
pts = []  # per frame: array [Li, Ri, Rt, Lt] (x,y) or None
for k, fr in enumerate(frames):
    res = det.detect_for_video(mp.Image(image_format=mp.ImageFormat.SRGB, data=cv2.cvtColor(fr, cv2.COLOR_BGR2RGB)), int(k * 1000 / fps))
    hs = [[(l.x * W, l.y * H) for l in h] for h in res.hand_landmarks]
    if len(hs) == 2:
        hs.sort(key=lambda h: h[0][0])  # by wrist x: screen-left hand first
        L, R = hs
        pts.append(np.array([L[8], R[8], R[4], L[4]], np.float32))
    else:
        pts.append(None)
# fill short gaps by interpolation, then smooth
idx = [i for i, p in enumerate(pts) if p is not None]
if not idx: sys.exit('no hands found')
for i in range(len(pts)):
    if pts[i] is None:
        prv = max([j for j in idx if j < i], default=None); nxt = min([j for j in idx if j > i], default=None)
        if prv is not None and nxt is not None and nxt - prv <= 8:
            t = (i - prv) / (nxt - prv); pts[i] = pts[prv] * (1 - t) + pts[nxt] * t
P = [p.copy() if p is not None else None for p in pts]
for i in range(len(P)):  # centered moving average over 5 frames
    win = [pts[j] for j in range(max(0, i - 2), min(len(pts), i + 3)) if pts[j] is not None]
    if pts[i] is not None and win: P[i] = np.mean(win, 0)
L = cv2.resize(cv2.imread(hidden), (W, H), interpolation=cv2.INTER_AREA).astype(np.float32)
L = L * np.array([1.08, 0.98, 0.92], np.float32)  # slight cool tint like the reference
ff = subprocess.Popen(["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "bgr24", "-s", f"{W}x{H}", "-r", str(fps), "-i", "-",
                       "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "17", "-preset", "medium", out], stdin=subprocess.PIPE)
S = 4  # supersampled mask for smooth edges
for k, fr in enumerate(frames):
    f = fr.astype(np.float32); q = P[k]
    if q is not None:
        q = q.copy()
        for top, bot in ((0, 3), (1, 2)):  # keep a minimum thickness at each end (pinched fingers)
            c = (q[top] + q[bot]) / 2; d = q[bot] - q[top]; n = np.linalg.norm(d)
            if n < MINPX:
                v = d / n if n > 1e-3 else np.array([0, 1], np.float32); q[top] = c - v * MINPX / 2; q[bot] = c + v * MINPX / 2
        # pull ends a few px inward so the window starts at the fingertips, not over them
        cl, cr = (q[0] + q[3]) / 2, (q[1] + q[2]) / 2; u = cr - cl; ul = np.linalg.norm(u)
        if ul > 20:
            u = u / ul * 4; q[0] += u; q[3] += u; q[1] -= u; q[2] -= u
            m = np.zeros((H * S, W * S), np.uint8); cv2.fillPoly(m, [np.round(q * S).astype(np.int32)], 255, cv2.LINE_AA)
            a = cv2.resize(m, (W, H), interpolation=cv2.INTER_AREA).astype(np.float32) / 255
            a = cv2.GaussianBlur(a, (0, 0), 0.7)[..., None]
            glow = cv2.GaussianBlur(a[..., 0], (0, 0), 5)[..., None] * np.array([70, 30, 5], np.float32)
            f = f * (1 - a) + L * a + glow * (1 - a)
    ff.stdin.write(np.clip(f, 0, 255).astype(np.uint8).tobytes())
ff.stdin.close(); ff.wait(); print(out, len(frames), 'frames,', len(idx), 'with both hands')
