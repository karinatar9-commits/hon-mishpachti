#!/usr/bin/env python3
"""Format D reel ("טעות שעולה כסף") — full-screen shots + full-screen system jumps, one continuous VO.
usage: python3 d/build.py cfg.json out.mp4
cfg: {"segs":[{"src":"clip.mp4","ss":1.4,"dur":3.3,"ov":"/tmp/dov/hookA.png","ovOut":2.9}, ...],
      "end":{"png":"/tmp/dov/end.png","at":20.9}, "vo":"vo.mp4", "tmp":"/tmp/d_build"}
The last seg runs to the end; the end card fades in at end.at (absolute seconds). VO is delayed 0.3s."""
import json, subprocess, sys, os
cfg = json.load(open(sys.argv[1])); out = sys.argv[2]; tmp = cfg.get("tmp", "/tmp/d_build"); os.makedirs(tmp, exist_ok=True)
def run(a): subprocess.run(a, check=True)
V = "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,setsar=1,fps=30"
segs = []; t = 0.0
for i, s in enumerate(cfg["segs"]):
    d = s["dur"]; o = f"{tmp}/s{i}.mp4"
    ins = ["-ss", str(s.get("ss", 0)), "-i", s["src"]]
    fc = f"[0:v]trim=0:{d},setpts=PTS-STARTPTS,{V}[v]"; last = "[v]"; n = 1
    if s.get("ov"):
        ins += ["-loop", "1", "-t", str(d), "-i", s["ov"]]
        fo = f",fade=t=out:st={s['ovOut']}:d=0.3:alpha=1" if s.get("ovOut") else ""
        fc += f";[{n}:v]format=rgba,fade=t=in:st=0:d=0.2:alpha=1{fo}[o{n}];{last}[o{n}]overlay=0:0[w{n}]"; last = f"[w{n}]"; n += 1
    if i == len(cfg["segs"]) - 1 and cfg.get("end"):
        st = cfg["end"]["at"] - t
        ins += ["-loop", "1", "-t", str(d), "-i", cfg["end"]["png"]]
        fc += f";[{n}:v]format=rgba,fade=t=in:st={st}:d=0.35:alpha=1[e];{last}[e]overlay=0:0[w{n}]"; last = f"[w{n}]"; n += 1
    fc += f";{last}format=yuv420p[out]"
    run(["ffmpeg", "-v", "error", "-y", *ins, "-filter_complex", fc, "-map", "[out]", "-t", str(d), "-an", "-c:v", "libx264", "-preset", "veryfast", "-crf", "19", "-r", "30", o])
    segs.append(o); t += d
lst = f"{tmp}/list.txt"; open(lst, "w").write("".join(f"file '{s}'\n" for s in segs))
body = f"{tmp}/body.mp4"; run(["ffmpeg", "-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", lst, "-c", "copy", body])
run(["ffmpeg", "-v", "error", "-y", "-i", body, "-i", cfg["vo"], "-filter_complex", "[1:a]adelay=300|300,apad[a]", "-map", "0:v", "-map", "[a]", "-shortest",
     "-c:v", "libx264", "-preset", "medium", "-crf", "21", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "160k", "-movflags", "+faststart", out])
print(out, round(t, 2))
