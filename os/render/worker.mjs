// Karin OS video renderer — runs inside GitHub Actions. Asks the os-content function for
// the next job (auth: GitHub OIDC), renders each scene with headless Chrome + ffmpeg,
// uploads the MP4 + cover through signed URLs, and reports back.
import puppeteer from 'puppeteer';
import { spawn, execFileSync } from 'node:child_process';
import fs from 'node:fs'; import path from 'node:path'; import os from 'node:os';

const FN = 'https://tcnnmbmooynevstasgaj.supabase.co/functions/v1/os-content';
const FPS = 30, W = 1080, H = 1920;
const RUN_UNTIL = Date.now() + (+process.env.WORKER_MINUTES || 9) * 60000;
const dir = path.dirname(new URL(import.meta.url).pathname);

async function oidc() {
  const r = await fetch(process.env.ACTIONS_ID_TOKEN_REQUEST_URL + '&audience=karin-os-render', { headers: { Authorization: 'bearer ' + process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN } });
  return (await r.json()).value;
}
async function api(body) {
  const r = await fetch(FN, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-gh-oidc': await oidc() }, body: JSON.stringify(body) });
  const j = await r.json(); if (!r.ok) throw new Error(JSON.stringify(j)); return j;
}
function ff(args) { execFileSync('ffmpeg', ['-y', '-loglevel', 'error', ...args], { stdio: 'inherit' }); }
function pipeFF(args) { const p = spawn('ffmpeg', ['-y', '-loglevel', 'error', ...args], { stdio: ['pipe', 'inherit', 'inherit'] }); const done = new Promise((res, rej) => p.on('close', c => c ? rej(new Error('ffmpeg ' + c)) : res())); return { p, done }; }
// ---- narration: one MP3 per scene (Microsoft neural Hebrew voice via edge-tts), silent fallback ----
function probe(f) { try { return +execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]).toString().trim() || 0; } catch { return 0; } }
function tts(text, voice, out) {
  if (process.env.TTS_FAKE) { ff(['-f', 'lavfi', '-i', `sine=frequency=330:duration=${Math.max(1.2, text.split(/\s+/).length / 2.6).toFixed(2)}`, '-ar', '44100', out]); return; }
  execFileSync('edge-tts', ['--voice', voice, '--rate=+6%', '--text', text, '--write-media', out], { stdio: ['ignore', 'ignore', 'inherit'], timeout: 60000 });
}
function narrate(job, tmp) {
  const voice = job.voice_name || 'he-IL-HilaNeural'; let ok = 0, want = 0;
  job.script.scenes.forEach((sc, i) => {
    const text = String(sc.vo || '').replace(/[\u{1F000}-\u{1FFFF}\u2600-\u27BF]/gu, '').trim(); if (!text) return;
    want++;
    const f = path.join(tmp, `vo${i}.mp3`);
    for (let a = 0; a < 2 && !sc._vo; a++) { try { tts(text, voice, f); const d = probe(f); if (d > 0.3) { sc._vo = f; sc.dur = Math.min(14, Math.max(+sc.dur || 3, d + 0.55)); ok++; } } catch (e) { console.error('tts', i, String(e.message || e).slice(0, 120)); } }
  });
  return { ok, want };
}
function audioTrack(job, tmp) {
  const parts = job.script.scenes.map((sc, i) => {
    const o = path.join(tmp, `a${i}.wav`), d = (Math.round(sc.dur * FPS) / FPS).toFixed(3);
    if (sc._vo) ff(['-i', sc._vo, '-af', 'adelay=250|250,apad', '-t', d, '-ar', '44100', '-ac', '2', o]);
    else ff(['-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=stereo', '-t', d, o]);
    return o;
  });
  const list = path.join(tmp, 'alist.txt'); fs.writeFileSync(list, parts.map(s => `file '${s}'`).join('\n'));
  const out = path.join(tmp, 'voice.wav'); ff(['-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', out]); return out;
}

const ENC = ['-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-pix_fmt', 'yuv420p', '-r', String(FPS)];

async function render(page, job) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'v-'));
  let warn = '';
  if (job.voice) { const r = narrate(job, tmp); if (r.want && !r.ok) warn = 'הקריינות לא נוצרה הפעם — הסרטון יצא בלי קול. אפשר ללחוץ "רינדור מחדש".'; else if (r.ok < r.want) warn = `קריינות חלקית: ${r.ok} מתוך ${r.want} סצנות.`; }
  const info = await page.evaluate(j => window.__init(j), job);
  await page.evaluate(() => window.__fonts());
  // warm every scene once so lazily-loaded glyphs (emoji, weights) are ready before frames are captured
  for (let i = 0; i < info.durs.length; i++) await page.evaluate((i) => window.__seek(i, 5, false), i);
  await page.evaluate(() => document.fonts.ready); await new Promise(r => setTimeout(r, 300));
  const segs = [];
  for (let i = 0; i < info.durs.length; i++) {
    const n = Math.round(info.durs[i] * FPS), seg = path.join(tmp, `s${i}.mp4`);
    const sc = job.script.scenes[i];
    if (sc.type === 'ai' && sc.clip_url) {
      const clip = path.join(tmp, `c${i}.mp4`);
      fs.writeFileSync(clip, Buffer.from(await (await fetch(sc.clip_url)).arrayBuffer()));
      const ov = path.join(tmp, `o${i}`); fs.mkdirSync(ov);
      for (let f = 0; f < n; f++) { await page.evaluate((i, t) => window.__seek(i, t, true), i, f / FPS); fs.writeFileSync(path.join(ov, `${String(f).padStart(5, '0')}.png`), await page.screenshot({ type: 'png', omitBackground: true })); }
      ff(['-stream_loop', '-1', '-i', clip, '-framerate', String(FPS), '-i', path.join(ov, '%05d.png'),
        '-filter_complex', `[0:v]scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},fps=${FPS}[b];[b][1:v]overlay=0:0`, '-frames:v', String(n), '-an', ...ENC, seg]);
    } else {
      const { p, done } = pipeFF(['-f', 'image2pipe', '-framerate', String(FPS), '-i', '-', ...ENC, seg]);
      for (let f = 0; f < n; f++) { await page.evaluate((i, t) => window.__seek(i, t, false), i, f / FPS); const buf = await page.screenshot({ type: 'jpeg', quality: 92 }); if (!p.stdin.write(buf)) await new Promise(r => p.stdin.once('drain', r)); }
      p.stdin.end(); await done;
    }
    segs.push(seg);
  }
  const list = path.join(tmp, 'list.txt'); fs.writeFileSync(list, segs.map(s => `file '${s}'`).join('\n'));
  const out = path.join(tmp, 'out.mp4'), cover = path.join(tmp, 'cover.jpg');
  if (job.script.scenes.some(s => s._vo)) ff(['-f', 'concat', '-safe', '0', '-i', list, '-i', audioTrack(job, tmp), '-map', '0:v', '-map', '1:a', '-shortest', ...ENC, '-c:a', 'aac', '-b:a', '160k', '-movflags', '+faststart', out]);
  else ff(['-f', 'concat', '-safe', '0', '-i', list, '-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=stereo', '-shortest', ...ENC, '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', out]);
  await page.evaluate(() => window.__seek(0, 1.8, false));
  fs.writeFileSync(cover, await page.screenshot({ type: 'jpeg', quality: 90 }));
  return { out, cover, warn };
}

async function put(url, file, type) {
  const r = await fetch(url, { method: 'PUT', headers: { 'Content-Type': type, 'x-upsert': 'true' }, body: fs.readFileSync(file) });
  if (!r.ok) throw new Error('upload ' + r.status + ' ' + await r.text());
}

const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || undefined, args: ['--no-sandbox', '--font-render-hinting=none'] });
const page = await browser.newPage();
await page.setViewport({ width: W, height: H, deviceScaleFactor: 1 });
await page.goto('file://' + path.join(dir, 'template.html'), { waitUntil: 'networkidle0' });
while (Date.now() < RUN_UNTIL) {
  let job = null;
  try { job = (await api({ mode: 'render_next' })).job; } catch (e) { console.error('next', e.message); }
  if (!job) { await new Promise(r => setTimeout(r, 20000)); continue; }
  console.log('rendering', job.id, 'v' + job.version, job.format);
  try {
    await page.reload({ waitUntil: 'networkidle0' });
    if (job.format === 'carousel') {
      await page.setViewport({ width: W, height: 1350, deviceScaleFactor: 1 });
      const info = await page.evaluate(j => window.__init(j), job);
      await page.evaluate(() => window.__fonts());
      for (let i = 0; i < info.durs.length; i++) await page.evaluate((i) => window.__seek(i, 5, false), i);
      await new Promise(r => setTimeout(r, 400));
      const n = Math.min(10, info.durs.length), shots = [];
      for (let i = 0; i < n; i++) { await page.evaluate((i) => window.__seek(i, 2.5, false), i); shots.push(await page.screenshot({ type: 'jpeg', quality: 92 })); }
      const up = await api({ mode: 'render_upload', id: job.id, version: job.version, slides: n });
      for (let i = 0; i < n; i++) { const f = path.join(os.tmpdir(), `sl${i}.jpg`); fs.writeFileSync(f, shots[i]); await put(up.slides[i], f, 'image/jpeg'); }
      const cf = path.join(os.tmpdir(), 'cv.jpg'); fs.writeFileSync(cf, shots[0]); await put(up.cover, cf, 'image/jpeg');
      await api({ mode: 'render_done', id: job.id, version: job.version, slides: n });
      await page.setViewport({ width: W, height: H, deviceScaleFactor: 1 });
      console.log('done carousel', job.id); continue;
    }
    const { out, cover, warn } = await render(page, job);
    const up = await api({ mode: 'render_upload', id: job.id, version: job.version });
    await put(up.video, out, 'video/mp4'); await put(up.cover, cover, 'image/jpeg');
    await api({ mode: 'render_done', id: job.id, version: job.version, warn });
    console.log('done', job.id, warn);
  } catch (e) { console.error(e); await api({ mode: 'render_fail', id: job.id, error: String(e.message || e) }).catch(() => {}); }
}
await browser.close();
