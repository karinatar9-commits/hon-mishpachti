#!/usr/bin/env python3
"""Live-action reel: full-screen shots + system inserts, Karin's narration lines placed at fixed starts, a top headline
per line from frame one, a subtitle pill per line, an end card. usage: python3 live/build.py cfg.json out.mp4
cfg: {"vo":[wav...], "gap":[...], "t0":.15, "segs":[{"src","ss","dur","speed"?}], "ov": dir, "endhold": 3.8}"""
import json, subprocess, sys, os
cfg = json.load(open(sys.argv[1])); out = sys.argv[2]; tmp = cfg.get('tmp', '/tmp/live_build'); os.makedirs(tmp, exist_ok=True)
def run(a): subprocess.run(a, check=True)
def dur(f): return float(subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f], capture_output=True, text=True).stdout)
D = [dur(f) for f in cfg['vo']]; T = []; t = cfg.get('t0', .15)
for i, d in enumerate(D): T.append(t); t += d + (cfg['gap'][i] if i < len(cfg['gap']) else 0)
END = T[-1] + D[-1] + .35; TOTAL = END + cfg.get('endhold', 3.8)
print('starts', [round(x, 2) for x in T], 'end', round(END, 2), 'total', round(TOTAL, 2))
V = 'scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,setsar=1,fps=30'
segs = []; acc = 0
for i, s in enumerate(cfg['segs']):
    d = s['dur'] if s['dur'] != 'rest' else TOTAL - acc
    sp = s.get('speed', 1); o = f'{tmp}/s{i}.mp4'
    run(['ffmpeg', '-v', 'error', '-y', '-ss', str(s.get('ss', 0)), '-i', s['src'], '-vf', f'setpts={sp}*PTS,{V},tpad=stop_mode=clone:stop_duration=6', '-t', str(d), '-an', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18', o])
    segs.append(o); acc += d
open(f'{tmp}/l.txt', 'w').write(''.join(f"file '{x}'\n" for x in segs))
run(['ffmpeg', '-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', f'{tmp}/l.txt', '-c', 'copy', f'{tmp}/body.mp4'])
ov = cfg['ov']; ins = ['-i', f'{tmp}/body.mp4']; fc = ''; last = '[0:v]'; n = 1
def add(png, a, b, fade=False):
    global fc, last, n
    ins.extend(['-loop', '1', '-t', str(TOTAL), '-i', png])
    src = f'[{n}:v]' if not fade else f'[{n}:v]format=rgba,fade=t=in:st={a}:d=0.35:alpha=1[f{n}];[f{n}]'
    fc += (';' if fc else '') + (f'[{n}:v]format=rgba,fade=t=in:st={a}:d=0.35:alpha=1[f{n}];' if fade else '') + f"{last}{f'[f{n}]' if fade else f'[{n}:v]'}overlay=0:0:enable='between(t,{a:.3f},{b:.3f})'[x{n}]"
    last = f'[x{n}]'; n += 1
for i in range(len(D)):
    a = 0 if i == 0 else T[i] - .05; b = (T[i + 1] - .05) if i + 1 < len(D) else END
    add(f'{ov}/hl{i}.png', a, b)
    add(f'{ov}/sub{i}.png', T[i] - .05, (T[i + 1] - .05) if i + 1 < len(D) else T[i] + D[i] + .3)
add(f'{ov}/end.png', END, TOTAL + 1, fade=True)
# narration: each line placed at its start
for i, f in enumerate(cfg['vo']): ins += ['-i', f]
na = len(cfg['vo']); first = n
amix = ''.join(f'[{first + i}:a]adelay={int(T[i] * 1000)}|{int(T[i] * 1000)}[a{i}];' for i in range(na)) + ''.join(f'[a{i}]' for i in range(na)) + f'amix=inputs={na}:normalize=0,apad[aout]'
fc += f';{last}format=yuv420p[vout];' + amix
run(['ffmpeg', '-v', 'error', '-y', *ins, '-filter_complex', fc, '-map', '[vout]', '-map', '[aout]', '-t', str(TOTAL), '-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-c:a', 'aac', '-b:a', '160k', '-ar', '44100', '-movflags', '+faststart', out])
print(out)
