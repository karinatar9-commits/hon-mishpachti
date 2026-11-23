#!/usr/bin/env python3
"""Movie-trailer reel: title cards on black, graded shots with letterbox, quick inserts, white flash cuts,
Karin's narration lines, a procedural trailer sound bed (drone, braams, hits, whooshes, riser, silence before the reveal).
usage: python3 live/trailer.py cfg.json out.mp4
cfg: {"vo":[wav..], "gap":[..], "t0":.3, "cards": dir, "beats":[[ [kind, src, ss, weight], ...] per narration line ],
      "silence_before": index of the line that starts after a held silence, "endhold": s}"""
import json, subprocess, sys, os
import numpy as np, soundfile as sf
cfg = json.load(open(sys.argv[1])); out = sys.argv[2]; tmp = cfg.get('tmp', '/tmp/trailer'); os.makedirs(tmp, exist_ok=True)
def run(a): subprocess.run(a, check=True)
SR = 44100
vos = []
for f in cfg['vo']:
    x, sr = sf.read(f, dtype='float32'); x = x if x.ndim == 1 else x.mean(1)
    if sr != SR:
        import scipy.signal as ss_; x = ss_.resample_poly(x, SR, sr).astype(np.float32)
    vos.append(x)
D = [len(x) / SR for x in vos]; T = []; t = cfg.get('t0', .3)
for i, d in enumerate(D): T.append(t); t += d + (cfg['gap'][i] if i < len(cfg['gap']) else 0)
END = T[-1] + D[-1] + .4; TOTAL = END + cfg.get('endhold', 4.2)
print('starts', [round(x, 2) for x in T], 'end', round(END, 2), 'total', round(TOTAL, 2))
# ---- picture: each narration line's span is split among its beats by weight; the last line is the end card ----
GRADE = "eq=contrast=1.18:brightness=-0.05:saturation=0.82,colorbalance=rs=-0.06:bs=0.08:rh=0.08:bh=-0.06,vignette=PI/4.5"
LB = "drawbox=x=0:y=0:w=1080:h=190:color=black:t=fill,drawbox=x=0:y=1730:w=1080:h=190:color=black:t=fill"
V = "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,setsar=1,fps=30"
segs = []; cuts = []; k = 0
for i, beats in enumerate(cfg['beats']):
    a = 0 if i == 0 else T[i]; b = T[i + 1] if i + 1 < len(T) else TOTAL
    if i == len(cfg['beats']) - 1 and len(T) > len(cfg['beats']): b = T[i + 1]
    W = sum(x[3] for x in beats); acc = a
    for j, (kind, src, ss, w) in enumerate(beats):
        d = (b - a) * w / W; o = f'{tmp}/b{k:02d}.mp4'; k += 1; cuts.append((acc, kind))
        if kind == 'card':
            n = int(round(d * 30))
            run(['ffmpeg', '-v', 'error', '-y', '-loop', '1', '-i', f"{cfg['cards']}/{src}.png", '-vf', f"scale=1188:2112,zoompan=z='1.0+0.06*on/{max(n,1)}':x='iw/2-iw/zoom/2':y='ih/2-ih/zoom/2':d={n}:s=1080x1920:fps=30,fade=t=in:st=0:d=0.12", '-frames:v', str(n), '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18', '-pix_fmt', 'yuv420p', o])
        else:
            vf = f"setpts={1/1.0}*PTS,{V},tpad=stop_mode=clone:stop_duration=6"
            vf += (',' + GRADE + ',' + LB) if kind == 'shot' else (',' + LB)
            vf += ",zoompan=z='1.0+0.0012*on':x='iw/2-iw/zoom/2':y='ih/2-ih/zoom/2':d=1:s=1080x1920:fps=30" if kind == 'shot' else ''
            run(['ffmpeg', '-v', 'error', '-y', '-ss', str(ss), '-i', src, '-vf', vf, '-t', str(d), '-an', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18', '-pix_fmt', 'yuv420p', '-r', '30', o])
        segs.append(o); acc += d
# end card for the remaining time
d = TOTAL - acc; o = f'{tmp}/b{k:02d}.mp4'; n = int(round(d * 30)); cuts.append((acc, 'end'))
run(['ffmpeg', '-v', 'error', '-y', '-loop', '1', '-i', f"{cfg['cards']}/end.png", '-vf', f"scale=1080:1920,fade=t=in:st=0:d=0.4", '-frames:v', str(n), '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18', '-pix_fmt', 'yuv420p', '-r', '30', o]); segs.append(o)
open(f'{tmp}/l.txt', 'w').write(''.join(f"file '{x}'\n" for x in segs))
run(['ffmpeg', '-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', f'{tmp}/l.txt', '-c', 'copy', f'{tmp}/body.mp4'])
# subtitles in the lower letterbox (not on cards)
ins = ['-i', f'{tmp}/body.mp4']; fc = ''; last = '[0:v]'
for i in range(len(T)):
    a, b = T[i] - .05, (T[i + 1] - .05 if i + 1 < len(T) else END)
    if i == len(T) - 1: break   # the CTA line plays over the end card
    ins += ['-loop', '1', '-t', str(TOTAL), '-i', f"{cfg['cards']}/sub{i}.png"]
    fc += (';' if fc else '') + f"{last}[{i + 1}:v]overlay=0:0:enable='between(t,{a:.3f},{b:.3f})'[s{i}]"; last = f'[s{i}]'
# white flash on chosen cuts
for (tc, kind) in cuts:
    if kind == 'card': fc += f";{last}drawbox=x=0:y=0:w=1080:h=1920:color=white@0.85:t=fill:enable='between(t,{tc:.3f},{tc + .05:.3f})'[w{int(tc*100)}]"; last = f'[w{int(tc*100)}]'
fc += f';{last}format=yuv420p[v]'
run(['ffmpeg', '-v', 'error', '-y', *ins, '-filter_complex', fc, '-map', '[v]', '-t', str(TOTAL), '-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-an', f'{tmp}/pic.mp4'])
# ---- sound ----
N = int(TOTAL * SR); rng = np.random.default_rng(7); tt = np.arange(N) / SR
def env(n, a, r): e = np.ones(n); A = int(a * SR); R = int(r * SR); e[:A] = np.linspace(0, 1, A) if A else 1; e[-R:] *= np.exp(-np.linspace(0, 6, R)); return e
def lp(x, f):  # one-pole low-pass
    from scipy.signal import lfilter
    a = np.exp(-2 * np.pi * f / SR); return lfilter([1 - a], [1, -a], x)
def braam(d=2.8, f=55):
    n = int(d * SR); t_ = np.arange(n) / SR; x = sum(np.sign(np.sin(2 * np.pi * f * m * t_ * (1 + .002 * m))) / m for m in (1, 1.5, 2, 3))
    x = np.tanh(1.6 * x) * env(n, .03, d * .9); return x / np.abs(x).max()
def hit(d=1.6):
    n = int(d * SR); t_ = np.arange(n) / SR; x = np.sin(2 * np.pi * (45 + 80 * np.exp(-t_ * 18)) * t_) * np.exp(-t_ * 3.2) + .3 * rng.standard_normal(n) * np.exp(-t_ * 30)
    return x / np.abs(x).max()
def whoosh(d=.7):
    n = int(d * SR); x = rng.standard_normal(n); x = lp(x, 1800) * np.sin(np.pi * np.arange(n) / n) ** 2; return x / np.abs(x).max()
def riser(d=3.0):
    n = int(d * SR); t_ = np.arange(n) / SR; x = rng.standard_normal(n) * (t_ / d) ** 2; f = 200 + 3000 * (t_ / d) ** 2
    y = x * np.sin(2 * np.pi * np.cumsum(f) / SR) * .5 + np.sin(2 * np.pi * np.cumsum(80 + 400 * (t_ / d) ** 3) / SR) * (t_ / d) ** 2 * .6
    return y / np.abs(y).max()
def tick(): n = int(.05 * SR); x = rng.standard_normal(n) * np.exp(-np.arange(n) / SR * 120); return x / np.abs(x).max()
mus = np.zeros(N, np.float32)
def put(x, t, g):
    a = int(t * SR); b = min(N, a + len(x)); 
    if a < N: mus[a:b] += (x[:b - a] * g).astype(np.float32)
drone = lp(rng.standard_normal(N), 120) * 6 + .5 * np.sin(2 * np.pi * 41.2 * tt)
drone = drone / np.abs(drone).max(); sil = cfg.get('silence_before', 5)
dm = np.ones(N); s0 = int((T[sil] - .7) * SR); s1 = int(T[sil] * SR); dm[s0:s1] = 0.02
put(drone * dm, 0, .22)
for (tc, kind) in cuts:
    if kind == 'card': put(braam(2.6, 55), tc, .55); put(hit(), tc, .5)
    elif kind in ('shot', 'ins'): put(whoosh(.5), max(0, tc - .3), .16)
put(riser(2.6), T[sil] - .7 - 2.6, .35)
put(hit(2.2), T[sil] - .02, .9); put(braam(3.5, 41.2), T[sil] - .02, .8)
for tk in np.arange(T[3], T[4] - .1, .5): put(tick(), tk, .12)
put(braam(4.0, 55), END, .6)
# narration with ducking
vo = np.zeros(N, np.float32)
for i, x in enumerate(vos): a = int(T[i] * SR); b = min(N, a + len(x)); vo[a:b] += x[:b - a]
vo /= np.abs(vo).max() + 1e-9
act = (np.abs(vo) > .02).astype(np.float32); k_ = int(.3 * SR); duck = np.convolve(act, np.ones(k_) / k_, 'same').clip(0, 1)
mix = vo * .9 + mus * (1 - .55 * duck)
mix = np.tanh(mix * 1.1) / np.tanh(1.1); mix /= np.abs(mix).max() / .89
fade = int(.4 * SR); mix[-fade:] *= np.linspace(1, 0, fade)
sf.write(f'{tmp}/mix.wav', np.stack([mix, mix], 1), SR)
run(['ffmpeg', '-v', 'error', '-y', '-i', f'{tmp}/pic.mp4', '-i', f'{tmp}/mix.wav', '-af', 'loudnorm=I=-14:TP=-1.5:LRA=11', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-ar', '44100', '-shortest', '-movflags', '+faststart', out])
print(out, round(TOTAL, 2))
