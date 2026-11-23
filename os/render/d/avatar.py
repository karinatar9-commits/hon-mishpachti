#!/usr/bin/env python3
"""Avatar layout reel: situation/system box on top, Karin's HeyGen avatar small at the bottom (Karin, 23.11.2026).
usage: python3 d/avatar.py cfg.json avatar.mp4 out.mp4
cfg: same segs as d/build.py ({"src","ss","dur"}; insert clips = 1080x1920 from ba/inserts.mjs, marked "ins":true),
     "ov": dir from d/av_overlay.mjs, "hook":"hookA", "labels":{"<seg index>":"l2"}, "end":{"at":secs}, "vo", "avy": avatar crop top (px at 960 width).
Audio = Karin's original VO (delayed 0.3s); the avatar was lip-synced in HeyGen to the same file."""
import json, subprocess, sys, os
from PIL import Image, ImageDraw
cfg = json.load(open(sys.argv[1])); av = sys.argv[2]; out = sys.argv[3]; tmp = cfg.get("tmp", "/tmp/av_build"); os.makedirs(tmp, exist_ok=True)
def run(a): subprocess.run(a, check=True)
BX, BY, BS = 60, 290, 960           # box
AX, AY, AW, AH = 60, 1300, 960, 590  # avatar frame
def mask(w, h, r, p):
    m = Image.new("L", (w, h), 0); ImageDraw.Draw(m).rounded_rectangle([0, 0, w - 1, h - 1], r, fill=255); m.save(p)
mask(BS, BS, 48, f"{tmp}/mbox.png"); mask(AW, AH, 48, f"{tmp}/mav.png")
segs = []; t = 0.0; times = []
for i, s in enumerate(cfg["segs"]):
    d = s["dur"]; o = f"{tmp}/b{i}.mp4"
    if s.get("ins"): crop = f"crop=1080:1080:0:100,scale={BS}:{BS}"
    else: crop = f"scale={BS}:-2,crop={BS}:{BS}:0:(ih-{BS})*{s.get('cy', 0.4)}"
    run(["ffmpeg", "-v", "error", "-y", "-ss", str(s.get("ss", 0)), "-i", s["src"], "-vf", f"trim=0:{d},setpts=PTS-STARTPTS,fps=30,{crop},setsar=1,format=yuv420p",
         "-t", str(d), "-an", "-c:v", "libx264", "-preset", "veryfast", "-crf", "18", o])
    segs.append(o); times.append((t, t + d)); t += d
T = t
open(f"{tmp}/l.txt", "w").write("".join(f"file '{s}'\n" for s in segs))
run(["ffmpeg", "-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", f"{tmp}/l.txt", "-c", "copy", f"{tmp}/box.mp4"])
ov = cfg["ov"]; endat = cfg["end"]["at"]; avy = cfg.get("avy", 120)
ins = ["-f", "lavfi", "-i", f"color=c=0x0d0b18:s=1080x1920:r=30:d={T}", "-i", f"{tmp}/box.mp4", "-i", av,
       "-loop", "1", "-i", f"{tmp}/mbox.png", "-loop", "1", "-i", f"{tmp}/mav.png",
       "-loop", "1", "-i", f"{ov}/{cfg['hook']}.png", "-loop", "1", "-i", f"{ov}/frame.png", "-loop", "1", "-i", f"{ov}/end.png", "-i", cfg["vo"]]
labs = cfg.get("labels", {}); n0 = 9
for k, name in labs.items(): ins += ["-loop", "1", "-i", f"{ov}/{name}.png"]
fc = (f"[1:v]format=rgba[bx];[3:v]format=gray,scale={BS}:{BS}[mb];[bx][mb]alphamerge[bxa];"
      f"[2:v]fps=30,scale={AW}:-2,crop={AW}:{AH}:0:{avy},tpad=stop_mode=clone:stop_duration=10,format=rgba[a];[4:v]format=gray,scale={AW}:{AH}[ma];[a][ma]alphamerge[aa];"
      f"[0:v][bxa]overlay={BX}:{BY}:shortest=0[v1];[v1][aa]overlay={AX}:{AY}[v2];[v2][6:v]overlay=0:0[v3];"
      f"[5:v]format=rgba,fade=t=out:st={cfg.get('hookOut', 2.95)}:d=0.3:alpha=1[h];[v3][h]overlay=0:0:enable='lt(t,{cfg.get('hookOut', 2.95) + 0.35})'[v4]")
last = "[v4]"
for j, (k, name) in enumerate(labs.items()):
    a, b = times[int(k)]
    fc += f";{last}[{n0 + j}:v]overlay=0:0:enable='between(t,{a},{b})'[l{j}]"; last = f"[l{j}]"
fc += f";[7:v]format=rgba,fade=t=in:st={endat}:d=0.35:alpha=1[e];{last}[e]overlay=0:0,trim=0:{T},format=yuv420p[vout];[8:a]adelay=300|300,apad[aout]"
run(["ffmpeg", "-v", "error", "-y", *ins, "-filter_complex", fc, "-map", "[vout]", "-map", "[aout]", "-t", str(T),
     "-c:v", "libx264", "-preset", "medium", "-crf", "20", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "160k", "-movflags", "+faststart", out])
print(out, round(T, 2))
