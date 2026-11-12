// Karin OS — natural Hebrew voice for the talk screen.
// POST {text} (Karin's session, or x-cron-key for tests) -> audio/mpeg. Uses Microsoft's neural read-aloud voice
// (the same voice the video renderer uses, via the same protocol as the edge-tts package). Nothing is stored.
// The service needs browser-like headers on the WebSocket handshake, which the runtime's WebSocket cannot send,
// so the handshake and framing are done by hand over a TLS socket.
// @ts-nocheck
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-key", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (o: unknown, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });
const VER = "2-143.0.3650.75", HOST = "speech.platform.bing.com";
const enc = new TextEncoder(), dec = new TextDecoder();

function aalOk(token: string, user: any) {
  if (!(user?.factors || []).some((f: any) => f.status === "verified")) return true;
  try { let b = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"); b += "=".repeat((4 - b.length % 4) % 4); return JSON.parse(atob(b)).aal === "aal2"; } catch { return false; }
}
async function allowed(req: Request) {
  const k = req.headers.get("x-cron-key");
  if (k) { const { data } = await db.from("os_settings").select("value").eq("key", "cron_secret").maybeSingle(); if (data?.value?.k && data.value.k === k) return true; }
  const token = (req.headers.get("Authorization") || "").replace("Bearer ", "");
  const { data: u } = await db.auth.getUser(token);
  const email = u?.user?.email?.toLowerCase();
  const { data: fm } = await db.from("family_members").select("owner_id,role").eq("email", email || "-").maybeSingle();
  return !!fm && fm.owner_id === "karin" && fm.role === "admin" && aalOk(token, u?.user);
}
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");

class Sock {
  buf = new Uint8Array(0);
  constructor(public c: Deno.TlsConn) {}
  async fill() { const t = new Uint8Array(32768); const n = await this.c.read(t); if (n === null) throw new Error("socket closed"); const m = new Uint8Array(this.buf.length + n); m.set(this.buf); m.set(t.subarray(0, n), this.buf.length); this.buf = m; }
  async readN(n: number) { while (this.buf.length < n) await this.fill(); const out = this.buf.slice(0, n); this.buf = this.buf.slice(n); return out; }
  async readHead() { for (;;) { for (let i = 0; i + 3 < this.buf.length; i++) if (this.buf[i] === 13 && this.buf[i + 1] === 10 && this.buf[i + 2] === 13 && this.buf[i + 3] === 10) { const h = dec.decode(this.buf.subarray(0, i)); this.buf = this.buf.slice(i + 4); return h; } await this.fill(); } }
  async write(u: Uint8Array) { let o = 0; while (o < u.length) o += await this.c.write(u.subarray(o)); }
  async frame(op: number, payload: Uint8Array) {
    const n = payload.length, head: number[] = [0x80 | op];
    if (n < 126) head.push(0x80 | n); else if (n < 65536) head.push(0x80 | 126, n >> 8, n & 255); else head.push(0x80 | 127, 0, 0, 0, 0, (n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255);
    const mask = crypto.getRandomValues(new Uint8Array(4)); const out = new Uint8Array(head.length + 4 + n); out.set(head); out.set(mask, head.length);
    for (let i = 0; i < n; i++) out[head.length + 4 + i] = payload[i] ^ mask[i & 3];
    await this.write(out);
  }
  async next(): Promise<{ op: number; fin: boolean; data: Uint8Array }> {
    const h = await this.readN(2); const fin = !!(h[0] & 0x80), op = h[0] & 15; let n = h[1] & 127; const masked = !!(h[1] & 0x80);
    if (n === 126) { const e = await this.readN(2); n = (e[0] << 8) | e[1]; } else if (n === 127) { const e = await this.readN(8); n = e[4] * 16777216 + (e[5] << 16) + (e[6] << 8) + e[7]; }
    const mk = masked ? await this.readN(4) : null; const data = await this.readN(n); if (mk) for (let i = 0; i < n; i++) data[i] ^= mk[i & 3];
    return { op, fin, data };
  }
}

async function synth(text: string, voice: string, rate: string): Promise<Uint8Array> {
  const id = crypto.randomUUID().replace(/-/g, "");
  const path = `/consumer/speech/synthesize/readaloud/edge/v1?TrustedClientToken=${TOKEN}&ConnectionId=${id}&Sec-MS-GEC=${gecV2(Date.now() / 1000)}&Sec-MS-GEC-Version=${VER}`;
  const conn = await Deno.connectTls({ hostname: HOST, port: 443, alpnProtocols: ["http/1.1"] });
  const s = new Sock(conn); const timer = setTimeout(() => { try { conn.close(); } catch (_) { /* */ } }, 25000);
  try {
    const key = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(16))));
    const muid = [...crypto.getRandomValues(new Uint8Array(16))].map((b) => b.toString(16).padStart(2, "0")).join("").toUpperCase();
    await s.write(enc.encode([`GET ${path} HTTP/1.1`, `Host: ${HOST}`, "Upgrade: websocket", "Connection: Upgrade", `Sec-WebSocket-Key: ${key}`, "Sec-WebSocket-Version: 13",
      "Pragma: no-cache", "Cache-Control: no-cache", "Origin: chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold",
      "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0",
      "Accept-Encoding: gzip, deflate, br, zstd", "Accept-Language: en-US,en;q=0.9", `Cookie: muid=${muid};`, "", ""].join("\r\n")));
    const head = await s.readHead(); if (!/^HTTP\/1\.1 101/.test(head)) throw new Error("handshake: " + head.split("\r\n")[0]);
    const ts = new Date().toString();
    await s.frame(1, enc.encode(`X-Timestamp:${ts}\r\nContent-Type:application/json; charset=utf-8\r\nPath:speech.config\r\n\r\n{"context":{"synthesis":{"audio":{"metadataoptions":{"sentenceBoundaryEnabled":"false","wordBoundaryEnabled":"false"},"outputFormat":"audio-24khz-48kbitrate-mono-mp3"}}}}\r\n`));
    await s.frame(1, enc.encode(`X-RequestId:${id}\r\nContent-Type:application/ssml+xml\r\nX-Timestamp:${ts}Z\r\nPath:ssml\r\n\r\n<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='he-IL'><voice name='${voice}'><prosody pitch='+0Hz' rate='${rate}' volume='+0%'>${esc(text)}</prosody></voice></speak>`));
    const chunks: Uint8Array[] = []; let part: Uint8Array[] = [], pop = 0;
    for (;;) {
      const f = await s.next();
      if (f.op === 8) break;
      if (f.op === 9) { await s.frame(10, f.data); continue; }
      if (f.op === 10) continue;
      if (f.op !== 0) { pop = f.op; part = []; }
      part.push(f.data); if (!f.fin) continue;
      const n = part.reduce((a, c) => a + c.length, 0), msg = new Uint8Array(n); let o = 0; for (const c of part) { msg.set(c, o); o += c.length; }
      if (pop === 1) { if (dec.decode(msg).includes("Path:turn.end")) break; continue; }
      if (msg.length < 2) continue; const hl = (msg[0] << 8) | msg[1]; if (msg.length > hl + 2 && dec.decode(msg.subarray(2, 2 + hl)).includes("Path:audio")) chunks.push(msg.subarray(hl + 2));
    }
    const n = chunks.reduce((a, c) => a + c.length, 0), out = new Uint8Array(n); let o = 0; for (const c of chunks) { out.set(c, o); o += c.length; }
    return out;
  } finally { clearTimeout(timer); try { conn.close(); } catch (_) { /* */ } }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    if (!(await allowed(req))) return json({ error: "forbidden" }, 403);
    const body = await req.json().catch(() => ({}));
    const text = String(body.text || "").replace(/\s+/g, " ").trim().slice(0, 1800);
    if (!text) return json({ error: "no text" }, 400);
    const voice = /^he-IL-(Hila|Avri)Neural$/.test(body.voice || "") ? body.voice : "he-IL-HilaNeural";
    const rate = /^[+-]\d{1,2}%$/.test(body.rate || "") ? body.rate : "+0%";
    let audio: Uint8Array | null = null; const errs: string[] = [];
    // Karin's own cloned voice (ElevenLabs) comes first whenever the key and her voice id are set; the neural voice is the fallback
    const EL = Deno.env.get("ELEVEN_KEY") || "";
    if (EL && !body.generic) {
      try {
        const { data: st } = await db.from("os_settings").select("value").eq("key", "main").maybeSingle(); const m: any = st?.value || {};
        if (m.voiceId) {
          const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(m.voiceId)}?output_format=mp3_44100_128`, { method: "POST", headers: { "xi-api-key": EL, "content-type": "application/json" },
            body: JSON.stringify({ text, model_id: m.voiceModel || "eleven_v3", language_code: "he" }) });
          if (r.ok) { const u = new Uint8Array(await r.arrayBuffer()); if (u.length > 400) audio = u; else errs.push("clone: empty"); } else errs.push("clone: " + r.status + " " + (await r.text()).slice(0, 160));
        }
      } catch (e) { errs.push("clone: " + String((e as Error).message || e)); }
      if (audio) { if (body.probe) return json({ ok: true, bytes: audio.length, voice: "clone" }); return new Response(audio, { headers: { ...CORS, "Content-Type": "application/octet-stream", "Cache-Control": "no-store", "x-voice": "clone" } }); }
    }
    for (let i = 0; i < 2 && !audio; i++) { try { const a = await synth(text, voice, rate); if (a.length > 400) audio = a; else errs.push("empty"); } catch (e) { errs.push(String((e as Error).message || e)); } }
    if (!audio) return json({ error: "tts_failed", detail: errs }, 502);
    if (body.probe) return json({ ok: true, bytes: audio.length, head: [...audio.subarray(0, 4)], tried: errs });
    return new Response(audio, { headers: { ...CORS, "Content-Type": "application/octet-stream", "Cache-Control": "no-store" } });
  } catch (e) {
    return json({ error: String((e as Error).message || e) }, 500);
  }
});

// ---- Sec-MS-GEC v2 token (ported from the edge-tts package's drm module; checked against it value for value) ----

const TOKEN="6A5AA1D4EAFF4E9FB37E23D68491D6F4";
const INIT=[1779033703,3144134277,1013904242,2773480762,1359893119,2600822924,528734635,1541459225],STATE=[4255104674,2435071207,3192492180,3442351626,1811967817,79508907,4272990180,66059218],SCHED=[3945054110,358115615,2696978146,217723578,2787307148,3520959633,3235718560,4192668342,4039316851,1884868174,1904797190,15051571,3529027680,1920361828],RC=[1116352408,1899447441,3049323471,3921009573,961987163,1508970993,2453635748,2870763221,3624381080,310598401,607225278,1426881987,1925078388,2162078206,2614888103,3248222580,3835390401,4022224774,264347078,604807628,770255983,1249150122,1555081692,1996064986,2554220882,2821834349,2952996808,3210313671,3336571891,3584528711,113926993,338241895,666307205,773529912,1294757372,1396182291,1695183700,1986661051,2177026350,2456956037,2730485921,2820302411,3259730800,3345764771,3516065817,3600352804,4094571909,275423344,430227734,506948616,659060556,883997877,958139571,1322822218,1537002063,1747873779,1955562222,2024104815,2227730452,2361852424,2428436474,2756734187,3204031479,3329325298],CSC=[3895366065,3005677776,1155409094,2296378653,1005282748,693190712,3365689651,3005795295,2367603217,3557143765,827258325,652566332,3911487921,1618477510,4037392853,2192753147,101076211,4199654362,3665427040,545047652,3201434976,1010595059,2314848760,3536931681,905590982,3137643201,3410617286,3311559015];
const ADJ=0xC9DC06A7,S0A=0x059C0B80,S1A=0x000B92C0,CSF=0x82893933,CA0=0xF2F90B1A,CA1=0x0B1A0000;
const BC=RC.slice(0,14).concat([ADJ],RC.slice(15));
const rotr=(v,n)=>((v>>>n)|(v<<(32-n)))>>>0, rol16=v=>((v<<16)|(v>>>16))>>>0, mul=(a,b)=>Math.imul(a,b)>>>0;
const sg0=v=>(rotr(v,7)^rotr(v,18)^(v>>>3))>>>0, sg1=v=>(rotr(v,17)^rotr(v,19)^(v>>>10))>>>0;
function rounds(st,w,first){ let [a,b,c,d,e,f,g,h]=st; const K=first===14?BC:RC;
  for(let i=first||0;i<64;i++){ const t1=(h+(rotr(e,6)^rotr(e,11)^rotr(e,25))+(g^(e&(f^g)))+K[i]+w[i])>>>0, t2=((rotr(a,2)^rotr(a,13)^rotr(a,22))+((a&b)|(c&(a|b))))>>>0; h=g;g=f;f=e;e=(d+t1)>>>0;d=c;c=b;b=a;a=(t1+t2)>>>0; }
  return [a,b,c,d,e,f,g,h]; }
function expand(w,first){ for(let i=first||16;i<64;i++) w.push((sg1(w[i-2])+w[i-7]+sg0(w[i-15])+w[i-16])>>>0); }
function shaInit(d){ const w=new Array(14).fill(0); w.push(((d[0]<<16)|(d[1]<<8)|d[2])>>>0); w.push(((d[3]<<24)|(d[4]<<16)|(d[5]<<8)|d[6])>>>0);
  for(let i=16;i<30;i++){ let v=SCHED[i-16]; if(i-2>=14) v+=i===16?((sg1(w[i-2])^S1A)>>>0):sg1(w[i-2]); if(i-7>=14) v+=w[i-7]; if(i-15>=14) v+=i===29?((sg0(w[i-15])^S0A)>>>0):sg0(w[i-15]); w.push(v>>>0); }
  w.push((sg1(w[28])+w[23]+sg0(w[15])+w[14]+ADJ-RC[14])>>>0); expand(w,31);
  const k=rounds(STATE,w,14); return INIT.map((x,i)=>(x+k[i])>>>0); }
function shaDigest(d){ const len=57+d.length, pad=((55-len)%64+64)%64, p=new Uint8Array(d.length-7+1+pad+8); p.set(d.subarray(7)); p[d.length-7]=0x80; const bits=len*8; p[p.length-4]=(bits>>>24)&255; p[p.length-3]=(bits>>>16)&255; p[p.length-2]=(bits>>>8)&255; p[p.length-1]=bits&255;
  let st=shaInit(d.subarray(0,7)); for(let o=0;o<p.length;o+=64){ const w=[]; for(let i=0;i<16;i++) w.push(((p[o+i*4]<<24)|(p[o+i*4+1]<<16)|(p[o+i*4+2]<<8)|p[o+i*4+3])>>>0); expand(w); const k=rounds(st,w,0); st=st.map((x,i)=>(x+k[i])>>>0); }
  const out=new Uint8Array(32); st.forEach((v,i)=>{ out[i*4]=v>>>24; out[i*4+1]=(v>>>16)&255; out[i*4+2]=(v>>>8)&255; out[i*4+3]=v&255; }); return out; }
function cs64(d,dg){ const le=(b,o)=>((b[o])|(b[o+1]<<8)|(b[o+2]<<16)|(b[o+3]<<24))>>>0; const ka=(le(dg,0)|1)>>>0, kb=(le(dg,4)|1)>>>0, fa=[mul(ka,CSF),mul(kb,CSF)];
  const terms=[],offs=[]; for(let i=0;i<CSC.length/2;i++){ terms.push(mul(CSC[i*2],fa[i%2])); offs.push(CSC[i*2+1]); }
  const src=new Uint8Array(1+d.length); src.set(d,1); const pl=Math.ceil(src.length/4)*4, pd=new Uint8Array(pl); pd.set(src); const words=[]; for(let o=0;o<pl;o+=4) words.push(le(pd,o)); if(words.length%2) words.push(0);
  words.forEach((w,i)=>{ let t=mul(w,i%2===0?ka:kb), of=mul(rol16(w),i%2===0?0xEF0569FB:0xC31713DB); if(i===0){ t=(t+mul(CA0,fa[0]))>>>0; of=(of+CA1)>>>0; } terms.push(t); offs.push(of); });
  let sa=0,sl=0,st=0,ac=0; for(let i=0;i<terms.length;i+=2){ const x=terms[i],y=terms[i+1]; let t=rol16((offs[i]+x)>>>0), q=mul(t,0x76F50F34); sa=(sa+((mul(rol16(q),0xC3EFEA97)+q)>>>0))>>>0; t=rol16((offs[i+1]+y)>>>0); q=mul(t,0x1881CE3C); sl=(mul(rol16(q),0x35BD1EC9)+q)>>>0; sa=(sa+sl)>>>0;
    st=(mul(st,ka)+x)>>>0; st=mul(rol16(st),0xCF98B111); st=mul(rol16(st),0x87085B9F); st=mul(rol16(st),0x12CEB96D); st=mul(rol16(st),0x257E1D83); ac=(ac+st)>>>0; t=(mul(st,kb)+y)>>>0; t=mul(rol16(t),0xA27416F5); t=mul(rol16(t),0xD38396FF); st=mul(rol16(mul(rol16(t),0x7C932B89)),0xBFA49F69); ac=(ac+st)>>>0; }
  return [(sl^st)>>>0,(sa^ac)>>>0]; }
function gecV2(unix){ let t=Math.floor(unix)+11644473600; t-=t%300; const s=(BigInt(t)*10000000n).toString()+TOKEN, d=new TextEncoder().encode(s), dg=shaDigest(d), cs=cs64(d,dg);
  const hx=u=>[...u].map(b=>b.toString(16).padStart(2,"0")).join("").toUpperCase(), lew=v=>hx(new Uint8Array([v&255,(v>>>8)&255,(v>>>16)&255,v>>>24]));
  return lew(cs[0])+lew(cs[1])+"-"+hx(dg); }
