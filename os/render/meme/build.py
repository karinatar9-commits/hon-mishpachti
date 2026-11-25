#!/usr/bin/env python3
"""Meme-sketch reel (Karin 25.11): clips keep their native sound; each clip is scaled to 1080x1920 and pushed down by
`shift` px so the white caption bar (overlay PNG, top 420px) doesn't hide faces. No narration.
usage: python3 meme/build.py cfg.json out.mp4
cfg: {"shift":250, "segs":[{"src":"a.mp4","ss":1.0,"dur":6.9,"ov":"/tmp/memeov/s1.png","ov2":"/tmp/memeov/s2b.png","ov2At":3.2}]}"""
import json, subprocess, sys
cfg = json.load(open(sys.argv[1])); out = sys.argv[2]; sh = cfg.get("shift", 250)
ins, fc, vl, al = [], [], [], []; n = 0
for i, s in enumerate(cfg["segs"]):
    ins += ["-ss", str(s["ss"]), "-t", str(s["dur"]), "-i", s["src"]]; v = n; n += 1
    fc.append(f"[{v}:v]scale=1080:1920,setsar=1,fps=30,pad=1080:{1920+sh}:0:{sh}:white,crop=1080:1920:0:0[b{i}]"); last = f"b{i}"
    for k, key in enumerate(("ov", "ov2")):
        if s.get(key):
            ins += ["-loop", "1", "-t", str(s["dur"]), "-i", s[key]]; o = n; n += 1
            en = f":enable='gte(t,{s[key+'At']})'" if key == "ov2" else ""
            fc.append(f"[{last}][{o}:v]overlay=0:0{en}[w{i}{k}]"); last = f"w{i}{k}"
    fc.append(f"[{last}]format=yuv420p[v{i}]"); fc.append(f"[{v}:a]aresample=48000,asetpts=PTS-STARTPTS,afade=t=in:d=0.05[a{i}]")
    vl.append(f"[v{i}][a{i}]")
fc.append("".join(vl) + f"concat=n={len(cfg['segs'])}:v=1:a=1[v][a]")
subprocess.run(["ffmpeg", "-v", "error", "-y", *ins, "-filter_complex", ";".join(fc), "-map", "[v]", "-map", "[a]", "-c:v", "libx264", "-preset", "medium",
                "-crf", "19", "-c:a", "aac", "-b:a", "160k", "-movflags", "+faststart", out], check=True)
print(out)
