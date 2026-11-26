#!/usr/bin/env python3
"""Composite an animated screen (screens.mjs) into a green-screen laptop plate, with mirror reflection, slow push-in,
series header and end CTA. usage: python3 compose.py plate.png screen.mp4 ovdir vo.mp3 out.mp4 [cta_len=3.2]
Plate: 9:16 still with a pure-green laptop screen and its reflection on a glossy surface (any size, scaled to 1080x1920)."""
import os, sys, subprocess, json, numpy as np
from PIL import Image
plate, screen, ov, vo, out = sys.argv[1:6]; CTA = float(sys.argv[6]) if len(sys.argv) > 6 else 3.2
tmp = "/tmp/compose"; subprocess.run(["mkdir", "-p", tmp])
im = np.asarray(Image.open(plate).convert("RGB").resize((1080, 1920), Image.LANCZOS)).astype(float)
g = im[:, :, 1] - np.maximum(im[:, :, 0], im[:, :, 2])
ys, xs = np.nonzero(g > 60); rows = np.unique(ys); gaps = np.where(np.diff(rows) > 5)[0]
cut = rows[gaps[0]] + 3 if len(gaps) else 1920
def quad(sel, grow=8):
    x, y = xs[sel], ys[sel]; s, d = x + y, x - y
    pts = np.array([(x[s.argmin()], y[s.argmin()]), (x[d.argmax()], y[d.argmax()]), (x[d.argmin()], y[d.argmin()]), (x[s.argmax()], y[s.argmax()])], float)
    c = pts.mean(0); pts = c + (pts - c) * (1 + grow / np.linalg.norm(pts - c, axis=1))[:, None]
    return ":".join(f"{v:.1f}" for p in pts for v in p)
a = np.clip((g - 20) / 60, 0, 1)
# despill: plate with green screen areas darkened so soft edges don't glow green
clean = im.copy(); clean[:, :, 1] = np.minimum(clean[:, :, 1], np.maximum(clean[:, :, 0], clean[:, :, 2]) + 10)
Image.fromarray(clean.astype(np.uint8)).save(f"{tmp}/plate.png")
top = a.copy(); top[cut:] = 0; Image.fromarray((top * 255).astype(np.uint8)).save(f"{tmp}/mt.png")
bot = a.copy(); bot[:cut] = 0; Image.fromarray((bot * 255).astype(np.uint8)).save(f"{tmp}/mb.png")
qt = quad(ys < cut); has_ref = len(gaps) > 0; qb = quad(ys > cut) if has_ref else None
dur = float(subprocess.check_output(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", screen]))
T = dur + CTA
W = "scale=1080:1920,setsar=1"
fc = (f"[1:v]tpad=stop_mode=clone:stop_duration={CTA},{W},perspective={qt}:sense=destination,format=rgba[s];[2:v]format=gray,scale=1080:1920[mt];[s][mt]alphamerge[sa];"
      f"[0:v][sa]overlay=0:0[l1];")
last = "l1"
if has_ref:
    fc += (f"[1:v]tpad=stop_mode=clone:stop_duration={CTA},vflip,{W},perspective={qb}:sense=destination,eq=brightness=-0.12:saturation=0.8,boxblur=2,format=rgba[r];"
           f"[3:v]format=gray,scale=1080:1920,lut=y=val*0.38[mb];[r][mb]alphamerge[ra];[l1][ra]overlay=0:0[l2];"); last = "l2"
z = f"1+0.06*min(on/{T*30},1)"
fc += (f"[{last}]scale=2160:3840,zoompan=z='{z}':x='iw/2-(iw/zoom/2)':y='ih*0.55-(ih/zoom*0.55)':d=1:s=1080x1920:fps=30[zv];"
       f"[4:v]format=rgba,{'' if os.environ.get('HEAD_FROM0') else 'fade=t=in:st=0.3:d=0.4:alpha=1,'}fade=t=out:st={dur-0.3}:d=0.3:alpha=1[hd];[zv][hd]overlay=0:0[h];"
       f"[5:v]format=rgba,fade=t=in:st={dur}:d=0.35:alpha=1[ct];[h][ct]overlay=0:0,format=yuv420p[v];"
       f"[6:a]adelay=300|300,apad[a]")
cmd = ["ffmpeg", "-v", "error", "-y", "-loop", "1", "-framerate", "30", "-t", str(T), "-i", f"{tmp}/plate.png", "-i", screen,
       "-loop", "1", "-t", str(T), "-i", f"{tmp}/mt.png", "-loop", "1", "-t", str(T), "-i", f"{tmp}/mb.png",
       "-loop", "1", "-t", str(T), "-i", f"{ov}/head.png", "-loop", "1", "-t", str(T), "-i", f"{ov}/cta.png", "-i", vo,
       "-filter_complex", fc, "-map", "[v]", "-map", "[a]", "-t", str(T), "-c:v", "libx264", "-preset", "medium", "-crf", "20", "-c:a", "aac", "-b:a", "160k", out]
subprocess.run(cmd, check=True); print(out)
