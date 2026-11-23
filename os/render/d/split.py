#!/usr/bin/env python3
"""Split layout reel (ref: amichai.ai, Karin 23.11.2026): top half light — big changing title + content panel
(situation shots / system jumps); bottom half — Karin's HeyGen avatar full width; blue caption pill on the seam.
usage: python3 d/split.py cfg.json avatar.mp4 out.mp4
cfg: {"segs":[{src,ss,dur,ins?,cy?}], "ov": dir from d/split_ov.mjs, "titles":[[t0,t1],...] (abs secs per t<i>),
      "caps":[[t0,t1],...] (per c<i>), "end":{"at"}, "vo", "avss": seconds to cut from the avatar start so its lips match the VO
      (= HeyGen lead-in minus the 0.3s VO delay), "avy": avatar crop top at 1080 width}"""
import json, subprocess, sys, os
from PIL import Image, ImageDraw
cfg = json.load(open(sys.argv[1])); av = sys.argv[2]; out = sys.argv[3]; tmp = cfg.get("tmp", "/tmp/split_build"); os.makedirs(tmp, exist_ok=True)
def run(a): subprocess.run(a, check=True)
PX, PY, PW, PH = 40, 250, 1000, 630   # content panel in the top half
m = Image.new("L", (PW, PH), 0); ImageDraw.Draw(m).rounded_rectangle([0, 0, PW - 1, PH - 1], 40, fill=255); m.save(f"{tmp}/mp.png")
segs = []; t = 0.0
for i, s in enumerate(cfg["segs"]):
    d = s["dur"]; o = f"{tmp}/p{i}.mp4"
    if s.get("ins"):  # system jump: square crop of the card, centred on its own dark panel
        vf = f"crop=1080:1080:0:90,scale={PH}:{PH},pad={PW}:{PH}:({PW}-{PH})/2:0:color=0x15121f"
    else:
        vf = f"scale={PW}:-2,crop={PW}:{PH}:0:(ih-{PH})*{s.get('cy', 0.35)}"
    run(["ffmpeg", "-v", "error", "-y", "-ss", str(s.get("ss", 0)), "-i", s["src"], "-vf", f"trim=0:{d},setpts=PTS-STARTPTS,fps=30,{vf},setsar=1,format=yuv420p",
         "-t", str(d), "-an", "-c:v", "libx264", "-preset", "veryfast", "-crf", "18", o])
    segs.append(o); t += d
T = t
open(f"{tmp}/l.txt", "w").write("".join(f"file '{s}'\n" for s in segs))
run(["ffmpeg", "-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", f"{tmp}/l.txt", "-c", "copy", f"{tmp}/panel.mp4"])
ov = cfg["ov"]
def lag(a, b):  # seconds by which the avatar's own audio (a) lags the VO file (b)
    import numpy as np
    def pcm(f):
        r = subprocess.run(["ffmpeg", "-v", "error", "-i", f, "-ac", "1", "-ar", "8000", "-f", "f32le", "-"], capture_output=True, check=True).stdout
        return np.frombuffer(r, np.float32)
    x, y = pcm(a), pcm(b); n = min(len(x), len(y)); x = x[:n] - x[:n].mean(); y = y[:n] - y[:n].mean()
    c = np.fft.irfft(np.fft.rfft(x, 2 * n) * np.conj(np.fft.rfft(y, 2 * n))); k = int(np.argmax(c)); k = k if k < n else k - 2 * n
    return k / 8000
if cfg.get("avss", "auto") == "auto":
    L = lag(av, cfg["vo"]); cfg["avss"] = round(L - 0.3, 3); print("avatar lag", L, "-> cut", cfg["avss"])
ins = ["-f", "lavfi", "-i", f"color=c=0xf4f2ee:s=1080x1920:r=30:d={T}", "-i", f"{tmp}/panel.mp4", "-ss", str(cfg.get("avss", 0)), "-i", av,
       "-loop", "1", "-i", f"{tmp}/mp.png", "-loop", "1", "-i", f"{ov}/end.png", "-i", cfg["vo"]]
n = 6; fc = (f"[1:v]format=rgba[p];[3:v]format=gray[pm];[p][pm]alphamerge[pa];"
             f"[2:v]fps=30,scale=1080:-2,crop=1080:960:0:{cfg.get('avy', 60)},tpad=stop_mode=clone:stop_duration=10[a];"
             f"[0:v][a]overlay=0:960:shortest=0[v0];[v0][pa]overlay={PX}:{PY}[v1]")
last = "[v1]"; k = 0
for kind in ("titles", "caps"):
    for i, (a, b) in enumerate(cfg[kind]):
        ins += ["-loop", "1", "-i", f"{ov}/{kind[0]}{i}.png"]
        fc += f";{last}[{n}:v]overlay=0:0:enable='between(t,{a},{b})'[x{k}]"; last = f"[x{k}]"; n += 1; k += 1
fc += f";[4:v]format=rgba,fade=t=in:st={cfg['end']['at']}:d=0.35:alpha=1[e];{last}[e]overlay=0:0,trim=0:{T},format=yuv420p[vout];[5:a]adelay=300|300,apad[aout]"
run(["ffmpeg", "-v", "error", "-y", *ins, "-filter_complex", fc, "-map", "[vout]", "-map", "[aout]", "-t", str(T),
     "-c:v", "libx264", "-preset", "medium", "-crf", "20", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "160k", "-movflags", "+faststart", out])
print(out, round(T, 2))
