#!/usr/bin/env python3
"""Before/after split-screen reel (approved style, 17.11.2026).
usage: python3 build.py cfg.json out.mp4
cfg: {"hook":[l1,l2,l3], "beats":[5 labels], "end":[l1,l2,"line|line"], "pairs":[[top_bad.mp4, bottom_good.mp4] x5], "vo": "voice.mp3" (optional), "seg":4.3667, "inserts": {"0": "ins.mp4"} (optional)}
Top half = problem (בלי סוכן), bottom = with agent. Overlays come from overlays.mjs (PNG dir = cfg["ov"]).
No music. Voice = Karin's ElevenLabs voice, plain settings."""
import json, subprocess, sys, os
cfg = json.load(open(sys.argv[1])); out = sys.argv[2]; ov = cfg["ov"]; S = cfg.get("seg", 4.3667); tmp = cfg.get("tmp", "/tmp/ba_build")
os.makedirs(tmp, exist_ok=True)
def run(a): subprocess.run(a, check=True)
half = "scale=-2:940,crop=1080:940,setsar=1,fps=30"
segs = []
for i, (top, bot) in enumerate(cfg["pairs"]):
    o = f"{tmp}/seg{i}.mp4"
    fc = (f"color=c=0x0b0b14:s=1080x1920:d={S}:r=30[bg];[0:v]trim=0:{S},setpts=PTS-STARTPTS,{half}[t];[1:v]trim=0:{S},setpts=PTS-STARTPTS,{half}[b];"
          f"[bg][t]overlay=0:0[x];[x][b]overlay=0:980[y];[y][2:v]overlay=0:0[z];[z][3:v]overlay=0:0")
    ins = ["-i", top, "-i", bot, "-loop", "1", "-t", str(S), "-i", f"{ov}/frame.png", "-loop", "1", "-t", str(S), "-i", f"{ov}/b{i}.png"]
    if i == 0:  # hook card on top for the first 1.6s, fading out
        ins += ["-loop", "1", "-t", str(S), "-i", f"{ov}/hook.png"]
        fc += "[w];[4:v]format=rgba,fade=t=out:st=1.3:d=0.35:alpha=1[h];[w][h]overlay=0:0"
    run(["ffmpeg", "-v", "error", "-y", *ins, "-filter_complex", fc + ",format=yuv420p", "-t", str(S), "-an", "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", o])
    segs.append(o)
    ins = cfg.get("inserts", {}).get(str(i))  # optional full-screen "system at work" clip after this pair (from inserts.mjs)
    if ins:
        o2 = f"{tmp}/ins{i}.mp4"
        run(["ffmpeg", "-v", "error", "-y", "-i", ins, "-vf", "scale=1080:1920,setsar=1,fps=30,format=yuv420p", "-an", "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", o2])
        segs.append(o2)
# end card over the last pair
top, bot = cfg["pairs"][-1]; E = cfg.get("endlen", 4.1667); o = f"{tmp}/segE.mp4"
fc = (f"color=c=0x0b0b14:s=1080x1920:d={E}:r=30[bg];[0:v]trim=0:{E},setpts=PTS-STARTPTS,{half}[t];[1:v]trim=0:{E},setpts=PTS-STARTPTS,{half}[b];"
      f"[bg][t]overlay=0:0[x];[x][b]overlay=0:980[y];[2:v]format=rgba,fade=t=in:st=0:d=0.3:alpha=1[e];[y][e]overlay=0:0,format=yuv420p")
run(["ffmpeg", "-v", "error", "-y", "-ss", "1", "-i", top, "-ss", "1", "-i", bot, "-loop", "1", "-t", str(E), "-i", f"{ov}/end.png", "-filter_complex", fc, "-t", str(E), "-an", "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", o])
segs.append(o)
lst = f"{tmp}/list.txt"; open(lst, "w").write("".join(f"file '{s}'\n" for s in segs))
body = f"{tmp}/body.mp4"; run(["ffmpeg", "-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", lst, "-c", "copy", body])
if cfg.get("vo"):
    run(["ffmpeg", "-v", "error", "-y", "-i", body, "-i", cfg["vo"], "-filter_complex", "[1:a]adelay=300|300,apad[a]", "-map", "0:v", "-map", "[a]", "-shortest", "-c:v", "copy", "-c:a", "aac", "-b:a", "160k", out])
else:
    run(["ffmpeg", "-v", "error", "-y", "-i", body, "-f", "lavfi", "-i", "anullsrc=r=44100:cl=stereo", "-shortest", "-c:v", "copy", "-c:a", "aac", out])
small = out.replace(".mp4", "-ig.mp4")  # light copy for Instagram web upload
run(["ffmpeg", "-v", "error", "-y", "-i", out, "-vf", "scale=720:1280", "-c:v", "libx264", "-preset", "veryfast", "-crf", "24", "-c:a", "copy", small])
print(out, small)
