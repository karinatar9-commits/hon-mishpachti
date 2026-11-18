#!/usr/bin/env python3
"""Format B "הסוכן מעל הכתף" reel: full-screen 9:16 shots + transparent system-card overlay + Karin's VO + end card.
usage: python3 over/build.py cfg.json out.mp4
cfg (in addition to overlay.mjs keys): {"shots":[[file, start, len], ...], "ov":"/tmp/ov_dir", "vo":"voice.mp3", "endlen":3.5, "vodelay":0.3}
Shot lengths must sum to cfg["dur"]. Overlay frames come from over/overlay.mjs. No music."""
import json, subprocess, sys, os
cfg = json.load(open(sys.argv[1])); out = sys.argv[2]; ov = cfg["ov"]; tmp = cfg.get("tmp", "/tmp/over_build"); os.makedirs(tmp, exist_ok=True)
def run(a): subprocess.run(a, check=True)
V = "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,setsar=1,fps=30"
segs = []
for i, (f, ss, ln) in enumerate(cfg["shots"]):
    o = f"{tmp}/s{i}.mp4"; segs.append(o)
    run(["ffmpeg", "-v", "error", "-y", "-ss", str(ss), "-i", f, "-t", str(ln), "-vf", V + ",format=yuv420p", "-an", "-c:v", "libx264", "-preset", "veryfast", "-crf", "18", o])
lst = f"{tmp}/l.txt"; open(lst, "w").write("".join(f"file '{s}'\n" for s in segs))
run(["ffmpeg", "-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", lst, "-c", "copy", f"{tmp}/shots.mp4"])
D = cfg["dur"]; E = cfg.get("endlen", 3.5)
# overlay frames on shots
run(["ffmpeg", "-v", "error", "-y", "-i", f"{tmp}/shots.mp4", "-framerate", "30", "-i", f"{ov}/%04d.png", "-filter_complex", "[0:v][1:v]overlay=0:0:eof_action=pass,format=yuv420p", "-t", str(D), "-c:v", "libx264", "-preset", "veryfast", "-crf", "19", f"{tmp}/main.mp4"])
# end card over a still-moving tail of the last shot
lf, lss, lln = cfg["shots"][-1]
run(["ffmpeg", "-v", "error", "-y", "-ss", str(max(0, lss + lln - 1.2)), "-i", lf, "-loop", "1", "-t", str(E), "-i", f"{ov}/end.png", "-filter_complex",
     f"[0:v]{V},tpad=stop_mode=clone:stop_duration={E}[b];[1:v]format=rgba,fade=t=in:st=0:d=0.3:alpha=1[e];[b][e]overlay=0:0,format=yuv420p", "-t", str(E), "-an", "-c:v", "libx264", "-preset", "veryfast", "-crf", "19", f"{tmp}/end.mp4"])
open(lst, "w").write(f"file '{tmp}/main.mp4'\nfile '{tmp}/end.mp4'\n")
run(["ffmpeg", "-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", lst, "-c", "copy", f"{tmp}/body.mp4"])
d = int(cfg.get("vodelay", 0.3) * 1000)
if cfg.get("vo"):
    run(["ffmpeg", "-v", "error", "-y", "-i", f"{tmp}/body.mp4", "-i", cfg["vo"], "-filter_complex", f"[1:a]adelay={d}|{d},apad[a]", "-map", "0:v", "-map", "[a]", "-shortest", "-c:v", "copy", "-c:a", "aac", "-b:a", "160k", out])
else:
    run(["ffmpeg", "-v", "error", "-y", "-i", f"{tmp}/body.mp4", "-f", "lavfi", "-i", "anullsrc=r=44100:cl=stereo", "-shortest", "-c:v", "copy", "-c:a", "aac", out])
small = out.replace(".mp4", "-ig.mp4")
run(["ffmpeg", "-v", "error", "-y", "-i", out, "-vf", "scale=720:1280", "-c:v", "libx264", "-preset", "veryfast", "-crf", "24", "-c:a", "copy", small])
print(out, small)
