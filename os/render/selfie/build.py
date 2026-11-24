#!/usr/bin/env python3
"""Selfie-talk reel: Karin's real selfie footage (lip-synced to her narration) full screen 9:16, punch-in zoom on every beat,
section pill on top + big phrase captions on the chest.  usage: python3 selfie/build.py cfg.json ovdir out.mp4
cfg: src, vo, dur, base [w,h,x,y] crop, zoomc [w,h,x,y] crop for punch-ins, zoom [cut times], tops/caps [{t:[a,b]}] (PNGs from selfie/overlay.mjs)"""
import json, subprocess, sys
cfg = json.load(open(sys.argv[1])); ov = sys.argv[2]; out = sys.argv[3]; T = cfg["dur"]
cuts = cfg["zoom"] + [T]; fc = "[0:v]fps=30,tpad=stop_mode=clone:stop_duration=2,split=%d%s;" % (len(cuts) - 1, "".join(f"[s{i}]" for i in range(len(cuts) - 1)))
for i in range(len(cuts) - 1):
    w, h, x, y = cfg["zoomc"] if i % 2 else cfg["base"]
    fc += f"[s{i}]trim={cuts[i]}:{cuts[i+1]},setpts=PTS-STARTPTS,crop={w}:{h}:{x}:{y},scale=1080:1920:flags=lanczos,setsar=1[z{i}];"
fc += "".join(f"[z{i}]" for i in range(len(cuts) - 1)) + f"concat=n={len(cuts)-1}:v=1[v0]"
ins = ["-i", cfg["src"], "-i", cfg["vo"]]; n = 2; last = "[v0]"
for kind in ("tops", "caps"):
    for i, o in enumerate(cfg[kind]):
        a, b = o["t"]; ins += ["-loop", "1", "-t", str(T), "-i", f"{ov}/{kind[0]}{i}.png"]
        fd = f",fade=t=in:st={a}:d=0.12:alpha=1" if a > 0 else ""
        fc += f";[{n}:v]format=rgba{fd}[o{n}];{last}[o{n}]overlay=0:0:enable='between(t,{a},{b})'[x{n}]"; last = f"[x{n}]"; n += 1
fc += f";{last}trim=0:{T},format=yuv420p[vout];[1:a]apad,atrim=0:{T}[aout]"
subprocess.run(["ffmpeg", "-v", "error", "-y", *ins, "-filter_complex", fc, "-map", "[vout]", "-map", "[aout]", "-t", str(T), "-r", "30",
                "-c:v", "libx264", "-preset", "medium", "-crf", "19", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "160k", "-movflags", "+faststart", out], check=True)
print(out)
