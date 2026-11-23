# Narration + score + foley for מי שילם?  Run from the library root:  .venv/bin/python <project>/audio.py <project>
# Karin's narration on top; vibraphone / upright / pizzicato score ducks ~16 dB under it; foley tied to the picture's events.
import sys, os, json, subprocess, re
import numpy as np, soundfile as sf
from scipy.signal import resample_poly
sys.path.insert(0, '.')
from core.audio import sampler as S
from core.audio.sfx import SR, add, limit, lp, hp, bp, noise, brown, t_, env_exp, click, clack, thump, whoosh

P = sys.argv[1]
EV = json.load(open(os.path.join(P, 'events.json')))['ev']
TL = next(e for e in EV if e['type'] == 'timeline'); DUR = TL['DUR']; BT = TL['B']; END = TL['END']
N = int(round(DUR * SR)); S.seed(23)
ev = lambda k: [e for e in EV if e['type'] == k]

# ---- narration ----
vo = np.zeros(N, np.float32); VLEN = {}
for e in ev('vo'):
    x, sr = sf.read(os.path.join(P, 'vo', e['id'] + '.wav'), dtype='float32')
    if x.ndim > 1: x = x.mean(1)
    if sr != SR: x = resample_poly(x, SR, sr).astype(np.float32)
    VLEN[e['id']] = len(x) / SR; a = int(e['t'] * SR); b = min(N, a + len(x)); vo[a:b] += x[:b - a]
vo /= np.abs(vo).max() + 1e-9
act = np.zeros(N, np.float32)
for e in ev('vo'): act[int(max(0, e['t'] - .12) * SR):int(min(DUR, e['t'] + VLEN[e['id']] + .05) * SR)] = 1
k = int(.45 * SR); duck = np.convolve(act, np.ones(k) / k, 'same').clip(0, 1); music_gain = 10 ** (-16 * duck / 20)

# ---- score (D major-ish, light): upright chords per beat, vibraphone per landing glyph, pizzicato search, glock on accents ----
sc = []
def n(t, inst, p, d, v, pan=0): sc.append((t, inst, p, d, v, pan, 1))
def chord(t, ps, d, v, inst='upright', strum=.03):
    for i, p in enumerate(ps): n(t + i * strum, inst, p, d, v, .1)
CH = [['D3', 'A3', 'F#4', 'A4'], ['B2', 'F#3', 'D4', 'A4'], ['G2', 'D3', 'B3', 'D4'], ['E3', 'B3', 'D4', 'G4'],
      ['D3', 'A3', 'E4', 'A4'], ['G2', 'D3', 'B3', 'F#4'], ['B2', 'F#3', 'D4', 'F#4'], ['D3', 'A3', 'F#4', 'A4']]
for i, (a, b) in enumerate(BT):
    if i == 4: continue   # the mid-hook: near-silence, one glock hit
    chord(a, CH[i], b - a + .4, .3 if i != 5 else .36)
for i, (a, b) in enumerate(BT): n(max(0, a - .15), 'cellos', ['D2', 'B1', 'G1', 'E2', 'D2', 'G1', 'B1', 'D2'][i], b - a + .6, .14)
# the pile grows: pizzicato stabs; passers-by: light shaker-like pizz walk
for e in ev('pile'): n(e['t'], 'violins_pizz', 'B4', .25, .32, -.2); n(e['t'], 'contrabass_pizz', 'E2', .4, .3)
for e in ev('pass'): n(e['t'], 'violins_pizz', 'F#5', .2, .2, .3)
for e in ev('hook'): n(e['t'], 'glockenspiel', 'A6', 1.4, .26, 0); n(e['t'], 'vibraphone_hard', 'A4', 1.6, .26, 0)
for e in ev('arrive'): n(e['t'], 'vibraphone', 'D6', .9, .22, .25)
for e in ev('one'): n(e['t'], 'glockenspiel', 'F#6', 1.0, .2, .2)
for e in ev('pop'): n(e['t'], 'vibraphone', 'E5', .5, .16, -.2)
for e in ev('land'):
    n(e['t'], 'vibraphone', ['A4', 'F#4', 'D5', 'E4', 'B4', 'D4'][e['j'] % 6], .9, .2, .2)
    if e['accent']: n(e['t'], 'glockenspiel', ['D6', 'A5', 'F#6'][e['j'] % 3], 1.0, .15, .25)
for e in ev('chime'):
    for j, p in enumerate(['D5', 'F#5', 'A5', 'D6']): n(e['t'] + j * .07, 'vibraphone_hard', p, 1.2, .3, .25)
for e in ev('approve'): n(e['t'], 'glockenspiel', 'D6', 1.2, .22, .2); n(e['t'] + .09, 'glockenspiel', 'F#6', 1.2, .2, .2)
for e in ev('end'): chord(e['t'], ['D3', 'A3', 'D4', 'F#4', 'A4'], 3.6, .32, strum=.05); n(e['t'] + .1, 'vibraphone', 'D5', 3, .25)
mus = S.render(sc, dur=DUR + 3); mus = S.room(mus, size=.4, mix=.18)
mus = mus[:N] if len(mus) >= N else np.pad(mus, ((0, N - len(mus)), (0, 0)))

# ---- foley ----
fx = np.zeros((N, 2), np.float32)
def put(x, t, g=1., pan=0.): add(fx, np.asarray(x, np.float32), t, g, pan)
def nz(x): m = np.abs(x).max(); return x / m if m > 0 else x
room = nz(lp(brown(DUR + 1), 500)) * .8 + .15 * nz(bp(noise(DUR + 1), 300, 1800))
L = min(N, len(room)); e_ = np.minimum(1, np.minimum(np.arange(L) / (.6 * SR), (L - np.arange(L)) / (.6 * SR)))
fx[:L, 0] += room[:L] * e_ * .035; fx[:L, 1] += np.roll(room, 777)[:L] * e_ * .035
def ting(f, d=.9): tt = t_(d); return nz(np.sin(2 * np.pi * f * tt) * np.exp(-tt / .18) + .5 * np.sin(2 * np.pi * f * 2.76 * tt) * np.exp(-tt / .06))
for e in ev('whoosh'): put(whoosh(.7, .7), e['t'], .03, 0)
for e in ev('step'): put(thump(.12, 140), e['t'], .022, 0)
for e in ev('pile'): put(thump(.25, 110), e['t'], .05, -.1)
for e in ev('paper'): s = nz(bp(noise(.45), 1500, 6500)) * np.sin(np.pi * t_(.45) / .45); put(s, e['t'], .03, .1)
for e in ev('approve'): put(click(1.4, .7), e['t'], .05, .2)

# ---- mix + loudness (≈ −16 LUFS here; mux brings it to −14) ----
m = act[:N] > 0
vr = 20 * np.log10(np.sqrt(np.mean((vo[m] * .9) ** 2)) + 1e-9); mr0 = 20 * np.log10(np.sqrt(np.mean((mus[m] * music_gain[m, None]) ** 2)) + 1e-9)
MG = 10 ** ((vr - 16.5 - mr0) / 20)
mix = np.stack([vo, vo], 1) * .9 + mus * music_gain[:, None] * MG + fx * (1 - .45 * duck[:, None])
fade = int(.3 * SR); mix[-fade:] *= np.linspace(1, 0, fade)[:, None]
def measure(x):
    tmp = os.path.join(P, '.measure.wav'); sf.write(tmp, x.astype(np.float32), SR)
    out = subprocess.run(['ffmpeg', '-hide_banner', '-nostats', '-i', tmp, '-af', 'ebur128=peak=true', '-f', 'null', '-'], capture_output=True, text=True).stderr
    os.remove(tmp); return float(re.findall(r'I:\s+(-?[\d.]+) LUFS', out)[-1]), float(re.findall(r'Peak:\s+(-?[\d.]+) dBFS', out)[-1])
raw = mix.copy(); ceil = -2.4
for _ in range(6):
    I, tp = measure(raw); mix = limit(raw * 10 ** ((-16 - I) / 20), 10 ** (ceil / 20)); I, tp = measure(mix)
    if tp <= -1.6: break
    ceil -= .5
sf.write(os.path.join(P, 'mix.wav'), mix[:N].astype(np.float32), SR)
print(f'mix.wav {N / SR:.2f}s  {I:.1f} LUFS  tp {tp:.1f}')
open(os.path.join(P, 'CREDITS.music'), 'w').write('\n'.join(S.credits(sorted({e[1] for e in sc}))) + '\n')
