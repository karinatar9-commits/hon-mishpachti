#!/usr/bin/env python3
"""Selfie split reel (ref amichai): top = light area with a section pill + rounded panel of motion graphics (screen/screens.mjs video),
bottom = Karin's real lip-synced selfie footage, phrase captions over it.  usage: python3 selfie/split.py cfg.json ovdir panel.mp4 out.mp4"""
import json, subprocess, sys
from PIL import Image, ImageDraw
cfg = json.load(open(sys.argv[1])); ov, panel, out = sys.argv[2:5]; T = cfg["dur"]
PX, PY, PW, PH = cfg["panel"]; bw, bh, bx, by = cfg["bot"]; Y0 = 1920 - bh
m = Image.new("L", (PW, PH), 0); ImageDraw.Draw(m).rounded_rectangle([0, 0, PW - 1, PH - 1], 44, fill=255); m.save(f"{ov}/mask.png")
ins = ["-f", "lavfi", "-i", f"color=c=0xf4f2ee:s=1080x1920:r=30:d={T}", "-i", cfg["src"], "-i", panel, "-loop", "1", "-t", str(T), "-i", f"{ov}/mask.png", "-i", cfg["vo"]]
fc = (f"[1:v]fps=30,tpad=stop_mode=clone:stop_duration=2,crop={bw}:{bh}:{bx}:{by},setsar=1[b];[0:v][b]overlay=0:{Y0}[v0];"
      f"[2:v]fps=30,scale={PW}:{PH},format=rgba[p];[3:v]format=gray[pm];[p][pm]alphamerge[pa];[v0][pa]overlay={PX}:{PY}[v1]")
n = 5; last = "[v1]"
for kind in ("tops", "caps"):
    for i, o in enumerate(cfg[kind]):
        a, b = o["t"]; ins += ["-loop", "1", "-t", str(T), "-i", f"{ov}/{kind[0]}{i}.png"]
        fd = f",fade=t=in:st={a}:d=0.12:alpha=1" if a > 0 else ""
        fc += f";[{n}:v]format=rgba{fd}[o{n}];{last}[o{n}]overlay=0:0:enable='between(t,{a},{b})'[x{n}]"; last = f"[x{n}]"; n += 1
fc += f";{last}trim=0:{T},format=yuv420p[vout];[4:a]apad,atrim=0:{T}[aout]"
subprocess.run(["ffmpeg", "-v", "error", "-y", *ins, "-filter_complex", fc, "-map", "[vout]", "-map", "[aout]", "-t", str(T), "-r", "30",
                "-c:v", "libx264", "-preset", "medium", "-crf", "19", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "160k", "-movflags", "+faststart", out], check=True)
print(out)
