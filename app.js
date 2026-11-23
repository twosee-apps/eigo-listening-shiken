// 英語リスニング 第1弾の本体（2026-11-23・全体設計 v3 §2・§5・§6・型の仕様 §4-2・§5）。
// 素の JS（ビルドなし）。再生の作りは 04_試作\再生試作 を引き継ぐ＝audio 要素1つを使い回す・保存した音声は Blob で流す。
"use strict";
const APP_VER = "d59d360ab4";
const KEY = "eigo-listening-v1";
const PACK_ID = "shizuoka";
const MARKS = ["ア", "イ", "ウ", "エ"];
const ACCENTS = [
  { name: "シアン", c: "#22D3EE", i: "#06222A" },
  { name: "ライム", c: "#C6F432", i: "#1B2400" },
  { name: "オレンジ", c: "#FB923C", i: "#2B1503" },
];
const ICON = {
  bag: "👜", basketball: "🏀", bike: "🚲", bird: "🐦", book: "📕", bus: "🚌", cake: "🍰", cap: "🧢", cat: "🐈",
  cloudy: "☁️", cookies: "🍪", cup: "☕", curry: "🍛", dictionary: "📖", dog: "🐕", drinks: "🥤", english: "🔤",
  flowers: "💐", gloves: "🧤", jacket: "🧥", kendo: "🥋", "lunch box": "🍱", math: "➗", music: "🎵", notebook: "📓",
  pancakes: "🥞", "pencil case": "✏️", pizza: "🍕", rabbit: "🐇", rainy: "🌧️", "rice-balls": "🍙", sandwiches: "🥪",
  scarf: "🧣", science: "🔬", shoes: "👟", soccer: "⚽", sunny: "☀️", tennis: "🎾", textbook: "📘", train: "🚆",
  umbrella: "☂️", walk: "🚶", watch: "⌚", "water bottle": "🧴", windy: "🌬️",
};
const KINDS = [
  { key: "物を1つ選ぶ", label: "物を1つ選ぶ" },
  { key: "2つの性質", label: "2つの性質" },
  { key: "状況の絵", label: "状況の絵" },
  { key: "場面の中の人", label: "場面の中の人" },
  { key: "地図の4か所", label: "地図" },
  { key: "カレンダー", label: "カレンダー" },
  { key: "sz2", label: "スピーチ（記述）" },
];
// 再生の速さ（既定は入試の放送〈1.0倍〉より速い 1.3倍＝11/23 夕の依頼で 1.1倍から上げた・初めてなら 0.9倍くらいから・本番も同じ既定）。
// 既定は端末に書かない（S.settings.rate は利用者が選んだときだけ・rateMine の印つき）＝次に既定を変えても、選んでいない人には新しい既定が効く。
// 前の版は既定の 1.1 を書いていた＝印の無い 1.1 は「選んでいない」とみなして読み込みで外す（印の無い 1.1 以外の値は選んだ値として残す）。
// 範囲＝0.9〜2.0倍・0.1 刻みの12段（同じ日の追加の依頼＝右下のボタンからバーで選ぶ・字面の「1.1〜2.0・0.2 刻み」は 0.9 と 2.0 が選べない＝選択肢で聞いた答え）。
// 全体設計 v3 §3 の「上限 1.5（それより上は合成音声が崩れる）」より上も選べる＝選択肢の答え。1.6 倍以上の聞こえ方は実機で見る。
const RATES = Array.from({ length: 12 }, (_, i) => Math.round((0.9 + i * 0.1) * 10) / 10);
const RATE_DEFAULT = 1.3;
// 今日の3問＝対話2＋スピーチ1（同じ日の追加の依頼・選択肢の答え）
const TODAY_SZ1 = 2, TODAY_SZ2 = 1;
// ご意見・不具合の報告（アプリの中から受け口＝Google Apps Script のウェブアプリへ送る）。
// FEEDBACK_URL＝受け口の /exec。空のあいだは「送る」を出さず、端末に残すだけ。
// 送るのは利用者が押したときだけ・1件ずつ・URL には何も載せない（POST の本文）。種類の文言は Code.gs の KINDS と一字一致。
const FEEDBACK_URL = "https://script.google.com/macros/s/AKfycbxHeuV0mSIeXhw4huIgZM3hPXqRmoLTv4JlhpVbOn7rQCxPv6KgGkSKBzI8GcqSOxSP/exec";
const FB_KINDS_Q = ["答え・解説がおかしい", "音声がおかしい", "文字のまちがい", "その他"];
const FB_KINDS_SET = ["使い方が分からない", "動かない・おかしい", "こうしてほしい", "その他"];
const FB_MAX = 200;
// 画面の文（推敲した稿）
const TXT = {
  rateNote: "速さを変えていないときは、入試の放送（1.0倍）より速い 1.3倍で流れます。いまの聞き取りの力に合わせて、速さを調整してください。聞き取りにくいうちは 0.9倍くらいから始めて、慣れたら上げてください。",
  flowNote: "登録したスピーチを順番に流し、最後まで行ったら最初に戻ります（止めるまで続きます）。くり返しても次のスピーチに替わっても、速さは選んだままです。画面を消しても流れ続けるかは、スマホによって違います。",
  shadowNote: "英文を1つ流したあと、同じ長さだけ音が止まります。その間に、聞いたとおりにまねして言ってください。最後の文まで行くと、最初からくり返します。流すのは、解いて台本を確かめた問題だけです。",
  shadowEmpty: "まだ解いた問題がありません。練習で問題を解くと、ここに出ます。",
  approx: "この問題は音声から文の区切りを見つけられなかったので、区切る位置は目安です。",
  examRate: r => `選んだ速さのまま、途中で変えずに最後まで進みます（いまは ${r}倍）。入試の放送は 1.0倍です。点数は速さに関係なく本番の記録として残します。`,
  examEndRate: r => `速さ ${r}倍のまま最後まで解きました（入試の放送は 1.0倍）。`,
  fbNote: "名前・学校・連絡先は書かないでください。返事はできません。",
  fbWhatQ: "送るのは、種類・書いた文・問題の番号・アプリと問題の版・端末の種類（Android／iPhone／PC）だけです。",
  fbWhatSet: "送るのは、種類・書いた文・アプリと問題の版・端末の種類（Android／iPhone／PC）だけです。",
  fbCost: "送るときはインターネットを使うので、通信料がかかることがあります。",
  fbAudio: "先に、消音（マナーモード）になっていないか、音量が小さすぎないかを確かめてください。",
  fbPhQ: "どこがおかしいか（書かなくてもかまいません）",
  fbPhSet: "くわしい内容（書かなくてもかまいません）",
  fbPickKind: "どれに近いか、種類を1つ選んでください",
  fbOk: "届きました。ありがとう！",
  fbFail: "いまは送れませんでした。端末に残したので、つながったときに設定から送れます。",
  fbClosed: "いまは受付を休んでいます（端末に残しました）。",
  fbLimit: "今日の受付はいっぱいです。端末に残したので、明日また送ってください。",
  fbSaved: "端末に残しました（設定の「学習の記録」を書き出すと、一緒に入ります）。",
  fbCountLocal: n => `端末に残した報告 ${n}件（「学習の記録」を書き出すと、一緒に入ります）`,
  fbAllPart: n => `${n}件 届きました。残りは送れず、端末に残っています。つながったときにまた送れます。`,
  fbSavedLater: "端末に残しました。あとで設定の「まとめて送る」から送れます。",
  fbSending: "送っています…",
};

// ---------- 小さな道具 ----------
const $ = s => document.querySelector(s);
const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const abs = p => new URL(p, location.href).href;
function ymd(d = new Date()) { return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
function addDays(n) { const d = new Date(); d.setDate(d.getDate() + n); return ymd(d); }
function mondayYmd() { const d = new Date(); const w = (d.getDay() + 6) % 7; d.setDate(d.getDate() - w); return ymd(d); }
function fmt(x) { x = Math.max(0, x || 0); return Math.floor(x / 60) + ":" + String(Math.floor(x % 60)).padStart(2, "0"); }
function toast(msg, ms = 2600) {
  const t = document.createElement("div"); t.className = "toast"; t.textContent = msg; document.body.appendChild(t);
  setTimeout(() => t.remove(), ms);
}
function beep() {
  try {
    const C = window.AudioContext || window.webkitAudioContext; if (!C) return;
    beep.ctx = beep.ctx || new C();
    const o = beep.ctx.createOscillator(), g = beep.ctx.createGain();
    o.frequency.value = 880; g.gain.value = 0.0001;
    o.connect(g); g.connect(beep.ctx.destination);
    const t = beep.ctx.currentTime; g.gain.exponentialRampToValueAtTime(0.18, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);
    o.start(t); o.stop(t + 0.3);
  } catch (_) {}
}
function vibe(ms = 12) { try { navigator.vibrate && navigator.vibrate(ms); } catch (_) {} }

// ---------- 記録（端末の localStorage） ----------
function blank() { return { v: 1, settings: { accent: 0 }, rec: {}, flow: [], listen: {}, reports: [], today: null, pack: null }; }
// 前の版が書いた既定の 1.1（rateMine の印が無い）＝選んでいない＝外して今の既定に（上の RATE_DEFAULT の注）。読み込みと記録の取り込みの両方で
function fixOldRate(st) { if (st && typeof st === "object" && !st.rateMine && +st.rate === 1.1) delete st.rate; }
let S = (() => {
  try {
    const x = JSON.parse(localStorage.getItem(KEY) || "null");
    if (x && x.v === 1) {   // 欄の型が壊れていても起動はできるように、壊れた欄だけ空に戻す
      const s = Object.assign(blank(), x), b = blank();
      for (const k of ["settings", "rec", "listen"]) if (!s[k] || typeof s[k] !== "object" || Array.isArray(s[k])) s[k] = b[k];
      for (const k of ["flow", "reports"]) if (!Array.isArray(s[k])) s[k] = b[k];
      fixOldRate(s.settings);
      s.reports = fbFixAll(s.reports);
      return s;
    }
  } catch (_) {}
  return blank();
})();
let saveTimer = null;
// 間引きは「最初に頼まれてから 400ms 後に1回」（頼まれるたびに延ばさない＝再生中の 250ms ごとの聞いた時間でも書ける）
function save(now) {
  const go = () => { saveTimer = null; try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (_) { toast("記録を保存できませんでした（端末の空きを確かめてください）"); } };
  if (now) { clearTimeout(saveTimer); go(); }
  else if (!saveTimer) saveTimer = setTimeout(go, 400);
}
// ---------- ご意見・不具合の報告 ----------
// 1件の形：{rid, id(問題の番号 or ""), t, kind, text, pack, shell, from:"問題"|"設定", sent: 0|送った時刻}
function fbRid() {   // 受け口が二重に入れないための番号（20字・[0-9a-z]）
  const a = "0123456789abcdefghijklmnopqrstuvwxyz";
  let s = "";
  try { for (const x of crypto.getRandomValues(new Uint8Array(40))) { if (x < 252) s += a[x % 36]; if (s.length === 20) break; } } catch (_) {}
  while (s.length < 20) s += a[Math.floor(Math.random() * 36)];
  return s;
}
// 古い報告（rid が無い＝この仕組みより前の版で残したもの）と、記録の読み込みで入った報告を今の形にそろえる
function fbFix(r) {
  if (!r || typeof r !== "object" || Array.isArray(r)) return null;
  const x = Object.assign({}, r);
  if (typeof x.rid !== "string" || !/^[A-Za-z0-9_-]{8,40}$/.test(x.rid)) x.rid = fbRid();
  if (![...FB_KINDS_Q, ...FB_KINDS_SET].includes(x.kind)) x.kind = "その他";
  if (x.from !== "問題" && x.from !== "設定") x.from = "問題";
  x.id = typeof x.id === "string" ? x.id : "";
  x.text = String(x.text == null ? "" : x.text);
  x.t = Number(x.t) > 0 ? Number(x.t) : Date.now();
  x.pack = String(x.pack || ""); x.shell = String(x.shell || "");
  x.sent = Number(x.sent) > 0 ? Number(x.sent) : 0;
  return x;
}
function fbFixAll(list) { return (Array.isArray(list) ? list : []).map(fbFix).filter(Boolean); }
// 端末の種類は3つだけ（機種名は送らない）。iPad と、触れる Mac（iPadOS の Safari）は iPhone に入れる
function fbDev() {
  const ua = navigator.userAgent || "";
  if (/Android/i.test(ua)) return "Android";
  if (/iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return "iPhone";
  return "PC";
}
// 1件を送る（押したときだけ呼ぶ）。返り値＝"ok"｜"closed"｜"limit"｜"fail"（つながらない・15秒・受け口の不調）
// 文字列の body＝text/plain＝事前の問い合わせ（preflight）が出ない。資格情報は付けない。
async function fbSend(r) {
  if (!FEEDBACK_URL) return "fail";
  if (r.sent) return "ok";
  if (navigator.onLine === false) return "fail";
  const ctl = typeof AbortController === "function" ? new AbortController() : null;
  const timer = ctl ? setTimeout(() => ctl.abort(), 15000) : null;
  try {
    const body = { app: "sl-jhs", id: r.rid, from: r.from, kind: r.kind, text: (r.text.trim() || "（ひとことなし）").slice(0, FB_MAX), q: r.id || "", pack: r.pack, shell: r.shell, dev: fbDev(), t: r.t };
    const res = await fetch(FEEDBACK_URL, { method: "POST", body: JSON.stringify(body), credentials: "omit", cache: "no-store", redirect: "follow", signal: ctl ? ctl.signal : undefined });
    const j = await res.json();
    if (j && j.ok === true) { r.sent = Date.now(); save(true); return "ok"; }
    return j && (j.reason === "closed" || j.reason === "limit") ? j.reason : "fail";
  } catch (_) { return "fail"; }
  finally { if (timer) clearTimeout(timer); }
}
function fbMsg(res) { return { ok: TXT.fbOk, closed: TXT.fbClosed, limit: TXT.fbLimit }[res] || TXT.fbFail; }
function fbDate(t) { const d = new Date(t); return (d.getMonth() + 1) + "/" + d.getDate() + " " + String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0"); }
let fbBusy = false;   // まとめて送っている間

function applyAccent() {
  const a = ACCENTS[S.settings.accent] || ACCENTS[0];
  document.documentElement.style.setProperty("--ac", a.c);
  document.documentElement.style.setProperty("--ac-ink", a.i);
}

// 苦手の箱（全体設計 §5）：間違えた・「たぶん」で正解＝翌日、箱の中で「たぶん」正解＝3日後、「自信あり」で正解＝抜ける。
function record(id, ok, conf, mode, extra) {
  const r = S.rec[id] || (S.rec[id] = { n: 0, ok: 0, hist: [], box: null });
  r.n++; if (ok) r.ok++;
  r.last = Date.now(); r.lastOk = ok;
  r.hist.push(Object.assign({ t: r.last, ok, conf, mode }, extra || {}));
  if (r.hist.length > 20) r.hist = r.hist.slice(-20);
  if (!ok) r.box = { stage: 1, due: addDays(1) };
  else if (conf === "maybe") r.box = r.box ? { stage: 2, due: addDays(3) } : { stage: 1, due: addDays(1) };
  else if (conf === "sure") r.box = null;
  save(true);   // 答えの記録はその場で書き切る（閉じられても消えない）
}
function inBox(id) { const r = S.rec[id]; return !!(r && r.box); }
function isDue(id) { const r = S.rec[id]; return !!(r && r.box && r.box.due <= ymd()); }

// 聞いた時間（再生している間だけ数える）
let listenTick = null;
function addListen() {
  if (listenTick == null) return;
  const now = performance.now(), d = Math.min(2, (now - listenTick) / 1000); listenTick = now;
  const k = ymd(); S.listen[k] = (S.listen[k] || 0) + d; save();
}
function weekStats() {
  const mon = mondayYmd();
  let sec = 0; for (const [k, v] of Object.entries(S.listen)) if (k >= mon) sec += v;
  const t0 = new Date(mon + "T00:00:00").getTime();
  let n = 0; for (const r of Object.values(S.rec)) for (const h of r.hist) if (h.t >= t0) n++;
  return { min: Math.round(sec / 60), n };
}

// ---------- 問題パック ----------
let PACK = null, ITEMS = {}, REMOTE = null;
// キャッシュの名前はアプリ固有の頭（eigo-）をつける＝GitHub Pages の同じオリジンのほかのアプリ（再生試験の shell-v3 など）と消し合わない
const cacheName = ver => `eigo-pack-${PACK_ID}-${ver}`;
const isOurPackCache = k => k.startsWith(`eigo-pack-${PACK_ID}-`) || k.startsWith(`pack-${PACK_ID}-`);   // 後ろは頭をつける前の名前（開発中の保存）
async function loadPack() {
  if (S.pack && "caches" in window) {
    try {
      const c = await caches.open(S.pack.cache);
      const r = await c.match(abs(`packs/${PACK_ID}/pack.json`));
      if (r) { setPack(await r.json()); return; }
    } catch (_) {}
    S.pack = null; save(true);   // 保存が消えていた（iPhone は保証されない）＝取り直せる
  }
  const r = await fetch(`packs/${PACK_ID}/pack.json`, { cache: "no-cache" });
  if (!r.ok) throw new Error("pack.json " + r.status);
  setPack(await r.json());
}
function setPack(p) {
  PACK = p; ITEMS = {};
  for (const it of p.items) ITEMS[it.id] = it;
}
async function checkRemote() {
  // 電波はあるが通らない（弱い回線・ログイン前の Wi-Fi）でも待ち続けない＝5秒で切る
  const ac = "AbortController" in window ? new AbortController() : null;
  const t = ac ? setTimeout(() => ac.abort(), 5000) : null;
  try {
    const r = await fetch("packs/index.json", { cache: "no-store", signal: ac ? ac.signal : undefined });
    if (!r.ok) return;
    const ix = await r.json();
    REMOTE = (ix.packs || []).find(p => p.id === PACK_ID) || null;
  } catch (_) { REMOTE = null; } finally { clearTimeout(t); }
}
function audioFiles(p) {   // 重ねない（同じ音声を2問で使っても数が合うように）
  const out = new Set();
  for (const it of p.items) for (const a of Object.values(it.audio || {})) out.add(a.file);
  return [...out];
}
function audioBytes(p) {   // 音声ごとの大きさ（export_pack.py が pack.json に入れる）
  const out = {};
  for (const it of p.items) for (const a of Object.values(it.audio || {})) if (a.bytes) out[a.file] = a.bytes;
  return out;
}
// 保存してよい音声か（0バイト・HTML〈公衆 Wi-Fi のログイン画面など〉を保存しない）
// 大きさが pack.json の値と違う（途中で切れた・古い版の音声）も保存しない
async function goodAudio(r, bytes) {
  if (!r || !r.ok) return null;
  const type = (r.headers.get("Content-Type") || "").toLowerCase();
  if (type.includes("text/html")) return null;
  const b = await r.blob();
  if (!b.size) return null;
  return bytes && b.size !== bytes ? null : b;
}
// 保存（全体設計 §2＝全部そろってから切り替える・1本ずつ・途中で切れても続きから）
let saving = null;
async function savePack() {
  if (saving && !saving.failed) return;
  if (!("caches" in window)) { toast("このブラウザは保存に対応していません"); return; }
  saving = { done: 0, total: 0, err: null };
  render();
  try {
    await checkRemote();   // 毎回見直す（開いたあとに新しい版が出ていても取り直せる）
    if (!REMOTE) throw new Error("ネットにつながっていません");
    const name = cacheName(REMOTE.version);
    const c = await caches.open(name);
    const packUrl = abs(`packs/${PACK_ID}/pack.json`);
    let p = null;
    const old = await c.match(packUrl);
    if (old) { try { p = await old.json(); } catch (_) { p = null; } }
    if (!p) {
      const res = await fetch(`packs/${PACK_ID}/pack.json?fresh=1`, { cache: "reload" });
      if (!res.ok) throw new Error("pack.json " + res.status);
      const txt = await res.text();
      try { p = JSON.parse(txt); } catch (_) { throw new Error("問題のファイルが壊れています（もう一度）"); }
      await c.put(packUrl, new Response(txt, { headers: { "Content-Type": "application/json" } }));
    }
    if (p.version !== REMOTE.version) { await caches.delete(name); throw new Error("一覧と問題の版が合いません（少し待ってからもう一度）"); }
    const files = audioFiles(p), sizes = audioBytes(p);
    saving.total = files.length;
    for (const f of files) {
      const u = abs(`packs/${PACK_ID}/${f}`);
      const have = await c.match(u);
      if (!have || !(await goodAudio(have, sizes[f]))) {   // 前の保存が0バイト・途中で切れたなどで壊れていたら取り直す
        const b = await goodAudio(await fetch(`packs/${PACK_ID}/${f}?fresh=1`, { cache: "reload" }), sizes[f]);
        if (!b) throw new Error(f + " を取れませんでした");
        await c.put(u, new Response(b, { headers: { "Content-Type": "audio/mp4" } }));
      }
      saving.done++;
      if (saving.done % 5 === 0 || saving.done === files.length) paintSaving();
    }
    // 全部そろったかを1本ずつ数え直してから切り替える（数だけでは、余分なものと欠けが相殺する）
    let miss = 0;
    for (const f of files) if (!(await c.match(abs(`packs/${PACK_ID}/${f}`)))) miss++;
    if (miss) throw new Error("保存が " + miss + " 本足りません");
    // 済んだ印（sw.js は、この印があるキャッシュからだけ音声と pack.json を返す）
    await c.put(abs("packs/index.json"), new Response(JSON.stringify({ packs: [REMOTE] }), { headers: { "Content-Type": "application/json" } }));
    S.pack = { version: p.version, cache: name, files: files.length, at: Date.now() };
    save(true);
    for (const k of await caches.keys()) if (isOurPackCache(k) && k !== name) await caches.delete(k);
    let persisted = false;
    try { persisted = navigator.storage && navigator.storage.persist ? await navigator.storage.persist() : false; } catch (_) {}
    S.pack.persisted = persisted; save(true);
    usePack(p);
    saving = null;
    toast("オフラインで使えます（音声 " + files.length + " 本）");
  } catch (e) {
    saving.err = String(e.message || e);
    saving.failed = true;
  }
  if (inQuestion()) paintSaving(); else render();   // 問題・本番の途中は描き直さない（入力欄のフォーカスが飛ぶ）
}
// 問題・本番の途中に保存が終わったら、新しいパックへの切り替えは問題の外に出たときに（開いている問題が新しい版で消えていても落ちない）
let deferredPack = null;
const inQuestion = () => ["q", "exam", "examEnd", "flowPlay", "shadow"].includes(V.name);
const isLoopView = () => V.name === "flowPlay" || V.name === "shadow";
const hasPlayer = () => ["q", "exam", "flowPlay", "shadow"].includes(V.name);
function usePack(p) { if (inQuestion()) deferredPack = p; else setPack(p); }
function paintSaving() {
  const b = document.getElementById("saveBar"), t = document.getElementById("saveTxt");
  if (b && saving) b.style.width = (saving.total ? saving.done / saving.total * 100 : 0) + "%";
  if (t && saving) t.textContent = `保存中 ${saving.done} / ${saving.total || "…"}（画面を開いたままにしてください）`;
}

// ---------- 再生（audio 要素は1つ・保存した音声は Blob で流す） ----------
const au = $("#au");
let curFile = null, curUrl = null, pending = null, playTok = 0, srcAt = 0;
async function audioUrl(file) {
  const u = abs(`packs/${PACK_ID}/${file}`);
  if (S.pack && "caches" in window) {
    try {
      const r = await (await caches.open(S.pack.cache)).match(u);
      if (r) return URL.createObjectURL(await r.blob());
    } catch (_) {}
  }
  return u;   // まだ保存していない＝ネットから
}
function finish(v) { const p = pending; pending = null; if (p) p.res(v); }
// 読み込み前（readyState 0）に currentTime を入れると 0 秒に戻る端末がある＝替えたときは位置が入る所まで待つ（3秒で切る）
function whenMeta() {
  if (au.readyState >= 1) return Promise.resolve();
  return new Promise(res => {
    const done = () => { au.removeEventListener("loadedmetadata", done); au.removeEventListener("error", done); clearTimeout(t); res(); };
    const t = setTimeout(done, 3000);
    au.addEventListener("loadedmetadata", done); au.addEventListener("error", done);
  });
}
let lastSeg = false;   // いま鳴らしている（鳴らした）のが文のタップ＝区間だけ
async function playFile(file, from = 0, to = null) {
  const tok = ++playTok;
  finish(false);
  if (curFile !== file) {
    const url = await audioUrl(file);
    if (tok !== playTok) { if (url.startsWith("blob:")) URL.revokeObjectURL(url); return false; }
    if (curUrl && curUrl.startsWith("blob:")) URL.revokeObjectURL(curUrl);
    curUrl = url; curFile = file; au.src = url; srcAt = performance.now();
    if (from > 0) { await whenMeta(); if (tok !== playTok) return false; }
  }
  applyRate();   // src を替えると 1.0 に戻る端末がある＝鳴らすたびに入れ直す（loadedmetadata・play・ratechange でも）
  try { au.currentTime = from; } catch (_) {}
  lastSeg = to != null;
  return new Promise(res => {
    pending = { res, to, tok };
    if (to != null) watchSeg();
    const pr = au.play();
    // AbortError＝読み込み中に一時停止した（pause() が play() を打ち切った）＝失敗に数えない。約束は残し、▶ で続きから
    if (pr && pr.catch) pr.catch(err => { if (err && err.name === "AbortError") return; if (pending && pending.tok === tok) { failPlay(); } });
  });
}
// 鳴らせなかった（自動再生の制限・読み込みの失敗）＝約束を false で解き、次に押したときは読み込み直す（＋押した中で解錠し直す）
function failPlay(msg) {
  toast(msg || "再生できませんでした（もう一度押してください）");
  curFile = null; unlocked = false;
  finish(false);
}
function stopAudio() { playTok++; loopTok++; au.pause(); finish(false); }
// 区間の終わり（文のタップ・シャドーイング）は timeupdate（約 0.25 秒ごと）だけだと次の文の頭まで鳴る＝鳴っている間は 40ms ごとに見る
let segTimer = null;
function watchSeg() {
  clearInterval(segTimer);
  segTimer = setInterval(() => {
    if (!pending || pending.to == null) { clearInterval(segTimer); segTimer = null; return; }
    if (au.currentTime >= pending.to) { au.pause(); finish(true); }
  }, 40);
}

// ---------- 再生の速さ（端末に保存・次に開いても続く） ----------
const snapRate = x => Math.min(RATES[RATES.length - 1], Math.max(RATES[0], Math.round(x * 10) / 10));
// 前の版で選んだ 0.8 などは、いまの範囲の端へ寄せる（記録は壊さない）
function curRate() { const r = +S.settings.rate; return isFinite(r) && r > 0 ? snapRate(r) : RATE_DEFAULT; }
const fmtRate = r => r.toFixed(1);
// 声が高くならないように preservesPitch（と webkit・moz の名前）を立てる。実機で声が高くならないかは【未実測】（実機の試験待ち）
let rateFix = 0, rateFixT = null;
function applyRate() {
  const r = curRate();
  try { au.preservesPitch = true; au.webkitPreservesPitch = true; au.mozPreservesPitch = true; } catch (_) {}
  try {
    if (Math.abs(au.defaultPlaybackRate - r) > 0.001) au.defaultPlaybackRate = r;
    if (Math.abs(au.playbackRate - r) > 0.001) au.playbackRate = r;
  } catch (_) {}
}
au.addEventListener("loadedmetadata", applyRate);
au.addEventListener("play", applyRate);
// 端末が勝手に戻したら入れ直す（入れられない値で入れ直しが続かないよう、1秒に3回まで）
au.addEventListener("ratechange", () => {
  const r = curRate();
  if (Math.abs(au.playbackRate - r) < 0.001 && Math.abs(au.defaultPlaybackRate - r) < 0.001) return;
  if (++rateFix > 3) return;
  clearTimeout(rateFixT); rateFixT = setTimeout(() => { rateFix = 0; }, 1000);
  applyRate();
});
// 速さのバー（0.9〜2.0・0.1 刻み）。目盛りと今の値だけを大きく（つまみ 34px・今の値 30px・動かしている間は指の上に値の吹き出し）。
// 目盛りの字はつまみの中心と同じ位置に並べる（左右の余白＝つまみの半分）。1.0 の下に「入試」の印。
const rateP = r => (r - RATES[0]) / (RATES[RATES.length - 1] - RATES[0]);
function vRatePanel() {
  const r = curRate();
  return `<div class="rateui" style="--p:${rateP(r)}">
    <div class="rateval num"><b class="rateNow">${fmtRate(r)}</b><span>倍</span></div>
    <div class="rangewrap"><span class="bubble num" aria-hidden="true">${fmtRate(r)}</span>
      <input type="range" class="rate" data-rate min="${RATES[0]}" max="${RATES[RATES.length - 1]}" step="0.1" value="${r}" aria-label="再生の速さ" aria-valuetext="${fmtRate(r)}倍">
      <div class="ticks num" aria-hidden="true">${RATES.map(x => `<span class="${x === r ? "on" : ""}${x === 1 ? " std" : ""}" data-r="${x}">${fmtRate(x)}</span>`).join("")}</div></div>
    <p class="small" style="margin:0">${esc(TXT.rateNote)}</p></div>`;
}
// バーを動かしている間＝描き直さずに、その場で値・目盛り・右下のボタンを塗り替え、鳴っている音にもすぐ効かせる
function onRateInput(el, done) {
  const r = snapRate(+el.value);
  S.settings.rate = r; S.settings.rateMine = true; rateFix = 0; applyRate();
  const ui = el.closest(".rateui");
  if (ui) {
    ui.style.setProperty("--p", rateP(r));
    ui.querySelectorAll(".rateNow, .bubble").forEach(x => { x.textContent = fmtRate(r); });
    ui.querySelectorAll(".ticks span").forEach(x => x.classList.toggle("on", +x.dataset.r === r));
    ui.classList.toggle("drag", !done);
  }
  el.setAttribute("aria-valuetext", fmtRate(r) + "倍");
  document.querySelectorAll('[data-act="rate"]').forEach(b => { b.textContent = fmtRate(r) + "x"; });
  if (done) { save(true); if (V.name === "examIntro") render(); } else save();
}
au.addEventListener("timeupdate", () => {
  if (pending && pending.to != null && au.currentTime >= pending.to) { au.pause(); finish(true); }
  addListen(); paintPlayer();
});
au.addEventListener("ended", () => { finish(true); paintPlayer(); });
au.addEventListener("error", () => { if (pending) failPlay("音声を読み込めませんでした（もう一度押してください）"); });
// iPhone の自動再生の制限：押した中で同期に1回鳴らすと、その audio 要素はあとから操作の外でも鳴らせる（本番モード用）
const SILENT = (() => {   // 0.1 秒の無音の WAV（8kHz・8bit・モノラル）
  const n = 800, b = new Uint8Array(44 + n), v = new DataView(b.buffer);
  const w = (o, s) => { for (let i = 0; i < s.length; i++) b[o + i] = s.charCodeAt(i); };
  w(0, "RIFF"); v.setUint32(4, 36 + n, true); w(8, "WAVEfmt "); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, 8000, true); v.setUint32(28, 8000, true); v.setUint16(32, 1, true); v.setUint16(34, 8, true); w(36, "data"); v.setUint32(40, n, true);
  b.fill(128, 44);
  let s = ""; for (const x of b) s += String.fromCharCode(x);
  return "data:audio/wav;base64," + btoa(s);
})();
function unlockAudio() {
  try {
    const C = window.AudioContext || window.webkitAudioContext;
    if (C) { beep.ctx = beep.ctx || new C(); if (beep.ctx.resume) beep.ctx.resume(); }
  } catch (_) {}
  try {
    playTok++; finish(false);
    if (curUrl && curUrl.startsWith("blob:")) URL.revokeObjectURL(curUrl);
    curUrl = null; curFile = null;
    au.src = SILENT; srcAt = performance.now();
    const p = au.play(); if (p && p.catch) p.catch(() => {});
  } catch (_) {}
}
au.addEventListener("playing", () => { listenTick = performance.now(); paintPlayer(); });
au.addEventListener("pause", () => {
  addListen(); listenTick = null;
  // 本番中に外から止まった（着信・画面ロック・イヤホン抜け）＝一時停止の状態にして ▶ を出す（黙って止まったままにしない）
  if (V.name === "exam" && pending && !V.paused && !au.ended && !(pending.to != null && au.currentTime >= pending.to)) {
    V.paused = true;
    cue("止まりました。▶ で続けます");
    mountPlayer(vPlayer());
  }
  // 流し聞き・シャドーイングも同じ（外から止まったら ▶ を出す・▶ やロック画面の再生で続きから）
  // src を替えた直後の pause（替える前の音の分が遅れて届く）は外からの停止に数えない
  if (isLoopView() && pending && !V.paused && !au.ended && performance.now() - srcAt > 400 && !(pending.to != null && au.currentTime >= pending.to)) {
    V.paused = true;
    mountPlayer(vPlayer());
  }
  paintPlayer();
});

// 画面を消さない（本番・問題の間だけ）
let wake = null;
async function keepAwake(on) {
  try {
    if (on && "wakeLock" in navigator && !wake) { wake = await navigator.wakeLock.request("screen"); wake.addEventListener("release", () => { wake = null; }); }
    if (!on && wake) { await wake.release(); wake = null; }
  } catch (_) { wake = null; }
}
document.addEventListener("visibilitychange", () => { if (!document.hidden && (V.name === "q" || V.name === "exam" || V.name === "shadow")) keepAwake(true); });

// ---------- 画面の状態 ----------
let V = { name: "home" };
let TAB = "home";
let rateOpen = false;   // 下のプレイヤーの速さの箱を開いているか
let reloadPending = false;   // 新しい版の画面が届いた（問題・本番の途中だった）＝問題の外に出たら読み込み直す
function go(v) {
  if (reloadPending && !["q", "exam", "examEnd", "end", "flowPlay", "shadow"].includes(v.name)) { location.reload(); return; }
  if (deferredPack && !["q", "exam", "examEnd", "flowPlay", "shadow"].includes(v.name)) { setPack(deferredPack); deferredPack = null; }
  rateOpen = false;
  V = v; window.scrollTo(0, 0); render();
}

// 今日の3問＝sz1 2問（期限が来た苦手→まだ解いていない→いちばん前に解いた）＋sz2 1セット
function pickToday() {
  const t = S.today;
  const isSz1 = id => ITEMS[id].type === "sz1-pick";
  if (t && t.date === ymd() && Array.isArray(t.ids) && t.ids.every(id => ITEMS[id])) {
    const n1 = t.ids.filter(isSz1).length;
    if (n1 === TODAY_SZ1 && t.ids.length - n1 === TODAY_SZ2) return t;
  }
  const sz1 = PACK.items.filter(i => i.type === "sz1-pick").map(i => i.id);
  const sz2 = PACK.items.filter(i => i.type === "sz2-fill").map(i => i.id);
  // 前の形（今日の5問）の途中の記録が今日の分に残っていたら、済んだ問題を先に残して3問に数え直す（解いた記録・苦手の箱はそのまま）
  const done = t && t.date === ymd() && Array.isArray(t.ids) && Array.isArray(t.done) ? t.done.filter(id => ITEMS[id] && t.ids.includes(id)) : [];
  const choose = (pool, n, keep) => {
    const due = pool.filter(isDue).sort((a, b) => S.rec[a].box.due.localeCompare(S.rec[b].box.due));
    const fresh = mixKinds(pool.filter(id => !S.rec[id]));
    const old = pool.filter(id => S.rec[id] && !isDue(id)).sort((a, b) => S.rec[a].last - S.rec[b].last);
    const out = keep.slice(0, n);
    for (const id of [...due, ...fresh, ...old]) { if (out.length >= n) break; if (!out.includes(id) && !done.includes(id)) out.push(id); }
    return out;
  };
  const ids = [...choose(sz1, TODAY_SZ1, done.filter(isSz1)), ...choose(sz2, TODAY_SZ2, done.filter(id => !isSz1(id)))];
  S.today = { date: ymd(), ids, done: done.filter(id => ids.includes(id)) };
  save();
  return S.today;
}
function mixKinds(ids) {   // 型が続かないように並べ替える
  const by = {};
  for (const id of ids) (by[ITEMS[id].pattern || "sz2"] ||= []).push(id);
  const out = []; let left = true;
  while (left) { left = false; for (const k of Object.keys(by)) if (by[k].length) { out.push(by[k].shift()); left = true; } }
  return out;
}
function pickKind(kind, n) {
  const pool = PACK.items.filter(i => kind === "sz2" ? i.type === "sz2-fill" : i.pattern === kind).map(i => i.id);
  const fresh = pool.filter(id => !S.rec[id]);
  const box = pool.filter(id => inBox(id));
  const old = pool.filter(id => S.rec[id] && !inBox(id)).sort((a, b) => S.rec[a].last - S.rec[b].last);
  const out = [];
  for (const id of [...fresh, ...box, ...old]) { if (!out.includes(id)) out.push(id); if (out.length >= n) break; }
  return out;
}
function startSession(ids, mode, label) {
  if (!ids.length) { toast("この中の問題はありません"); return; }
  go({ name: "q", mode, label, ids, i: 0, results: [], st: freshQ() });
  keepAwake(true);
}
function freshQ() { return { sel: null, done: false, plays: 0, qplays: 0, inputs: {}, grade: null, self: {}, paper: !!S.settings.paper, fb: null, flowAsked: false }; }
// 報告の書きかけ（開いているか・選んだ種類・ひとこと）。問題では問題ごと、設定では設定の画面ごと
function fbState() {
  const host = V.name === "q" && V.st ? V.st : V;
  return host.fb || (host.fb = { open: false, kind: "", text: "" });
}
function fbTake() { const ta = $("#fbTxt"); if (ta) fbState().text = ta.value; }
// 書いた報告を1件にして、先に端末へ保存する（送れなくても消えない）。種類が無ければ聞いて null
function fbMake() {
  fbTake();
  const f = fbState(), inQ = V.name === "q";
  if (!f.kind) { toast(TXT.fbPickKind); return null; }
  const r = { rid: fbRid(), id: inQ ? curItem().id : "", t: Date.now(), kind: f.kind, text: f.text.trim().slice(0, FB_MAX), pack: PACK.version, shell: APP_VER, from: inQ ? "問題" : "設定", sent: 0 };
  S.reports.push(r); save(true);
  Object.assign(f, { open: false, kind: "", text: "" });
  return r;
}

// ---------- 描画 ----------
// 下のプレイヤーを描き、その実際の高さを --plh に入れる（app.css の下の余白＝隠れて押せない所を作らない）
const plhObs = "ResizeObserver" in window ? new ResizeObserver(es => { for (const e of es) setPlh(e.target.offsetHeight); }) : null;
function setPlh(h) { document.documentElement.style.setProperty("--plh", h + "px"); }
function mountPlayer(html) {
  const host = $("#playerHost");
  if (plhObs) plhObs.disconnect();
  host.innerHTML = html;
  const p = host.firstElementChild;
  setPlh(p ? p.offsetHeight : 0);
  if (p && plhObs) plhObs.observe(p);
}
function render() {
  applyAccent();
  const app = $("#app");
  const tabs = $("#tabs");
  const inQ = hasPlayer();
  // 本番の結果画面でもタブを隠す＝タブで抜けて本番の成績が記録されずに消える道を塞ぐ
  const noTabs = inQ || V.name === "examEnd";
  tabs.classList.toggle("hide", noTabs);
  app.classList.toggle("noTab", noTabs);
  for (const b of tabs.querySelectorAll("button")) b.classList.toggle("on", b.dataset.tab === TAB);
  if (!PACK) { app.innerHTML = `<div class="stack"><div class="lab">LOADING</div><h1>読み込み中</h1><p class="sub" id="loadErr"></p></div>`; mountPlayer(""); return; }
  const html = { home: vHome, practice: vPractice, flow: vFlow, settings: vSettings, q: vQ, end: vEnd, examIntro: vExamIntro, exam: vExam, examEnd: vExamEnd, flowPlay: vFlowPlay, shadow: vShadow }[V.name]();
  app.innerHTML = html;
  mountPlayer(inQ ? vPlayer() : "");
  paintPlayer(); paintSaving();
}

function vSaveNotice() {
  if (S.pack && REMOTE && REMOTE.version !== S.pack.version) {
    return `<div class="notice ac stack"><b>新しい問題の版があります</b><span class="sub">更新すると全部を取り直します（約${Math.round(REMOTE.bytes / 1e6)}MB・Wi-Fi で）。学習の記録は消えません。</span>${saveBtn("更新する")}</div>`;
  }
  if (S.pack) return "";
  const ios = /iPhone|iPad|iPod/.test(navigator.userAgent);
  const standalone = matchMedia("(display-mode: standalone)").matches || navigator.standalone;
  return `<div class="notice ac stack">
    <b>はじめに：オフラインで使えるようにする</b>
    ${standalone ? "" : `<span class="sub">① 先に<b>ホーム画面に追加</b>（${ios ? "Safari の共有ボタン →「ホーム画面に追加」" : "Chrome のメニュー →「ホーム画面に追加」"}）。追加したアイコンから開き直してから ② を押すと、保存が消えにくくなります。</span>${installEvt ? `<button class="btn sm" data-act="install">ホーム画面に追加</button>` : ""}`}
    <span class="sub">② 問題と音声を端末に保存（約${REMOTE ? Math.round(REMOTE.bytes / 1e6) : 27}MB・Wi-Fi で・数分）。保存が終わるまでは、ネットにつないだまま使えます。</span>
    ${saveBtn("保存する")}
  </div>`;
}
function saveBtn(label) {
  if (saving && !saving.failed) return `<div class="stack"><div class="prog"><i id="saveBar"></i></div><span class="sub" id="saveTxt"></span></div>`;
  return `${saving && saving.failed ? `<span class="sub" style="color:var(--ng)">保存が止まりました：${esc(saving.err)}（もう一度押すと続きから）</span>` : ""}<button class="btn pri" data-act="save">${label}</button>`;
}

function vHome() {
  const t = pickToday();
  const left = t.ids.filter(id => !t.done.includes(id));
  const w = weekStats();
  const boxN = Object.keys(S.rec).filter(id => ITEMS[id] && inBox(id)).length;
  const dueN = Object.keys(S.rec).filter(id => ITEMS[id] && isDue(id)).length;
  return `<div class="stack">
    <div class="row"><div><div class="lab">LISTENING · SHIZUOKA</div><h1>今日の練習</h1></div><span class="gap"></span>
      <button class="btn sm ghost" data-act="settings" aria-label="設定">設定</button></div>
    ${vSaveNotice()}
    <div class="today">
      <div class="lab">TODAY</div>
      <div class="row"><span class="bignum">${t.ids.length - left.length}<span class="sub" style="font-size:20px"> / ${t.ids.length}</span></span><span class="gap"></span>
        <span class="sub">${dueN ? `復習 ${dueN}問を含む` : "対話 2問＋スピーチ 1セット"}</span></div>
      <button class="btn pri big" data-act="today">${left.length ? (left.length === t.ids.length ? "はじめる" : "つづける") : "もう1回（別の問題）"}</button>
    </div>
    <div class="stats">
      <div class="card"><div class="lab">THIS WEEK</div><b>${w.min}<span class="sub"> 分</span></b><span class="sub">聞いた時間</span></div>
      <div class="card"><div class="lab">SOLVED</div><b>${w.n}<span class="sub"> 問</span></b><span class="sub">今週解いた数</span></div>
    </div>
    ${boxN ? `<button class="card tap kind" data-act="box" style="min-height:0;width:100%"><div class="row" style="width:100%"><div><div class="lab">REVIEW</div><b>苦手の箱 ${boxN}問</b></div><span class="gap"></span><span class="sub">${dueN ? `今日 ${dueN}問` : "期限はまだ"}</span></div></button>` : ""}
  </div>`;
}

function vPractice() {
  const count = k => {
    const pool = PACK.items.filter(i => k === "sz2" ? i.type === "sz2-fill" : i.pattern === k);
    return { all: pool.length, done: pool.filter(i => S.rec[i.id]).length };
  };
  const best = no => { const b = (S.exams || {})[no]; return b ? `${b.best}<span class="sub">/14</span>` : `<span class="sub">—</span>`; };
  return `<div class="stack">
    <div><div class="lab">PRACTICE</div><h1>練習</h1></div>
    <h2>本番の形で通す（約10分）</h2>
    <p class="sub" style="margin:0">放送と同じ順番・回数・間で進みます。対話4問＋スピーチ3問＝14点。</p>
    <div class="exams">${PACK.exams.map(e => `<button class="exam" data-act="exam" data-no="${e.no}"><span class="lab">NO.</span><b>${e.no}</b><span class="num">${best(e.no)}</span></button>`).join("")}</div>
    <h2 style="margin-top:8px">形式ごとに5問</h2>
    <div class="grid2">${KINDS.map(k => { const c = count(k.key); return `<button class="card tap kind" data-act="kind" data-kind="${esc(k.key)}"><b>${esc(k.label)}</b><span class="num sub">${c.done} / ${c.all}</span></button>`; }).join("")}</div>
  </div>`;
}

function vFlow() {
  const wk = Date.now() - 7 * 864e5;
  const reg = (S.flow || []).filter(id => ITEMS[id]);
  const recent = reg.filter(id => S.rec[id] && S.rec[id].last >= wk);
  const list = recent.length ? recent : reg;
  // シャドーイングに出すのは解いた問題だけ（解いたら台本と解説が出る＝台本を確かめた）。新しく解いた順
  const solved = type => Object.keys(S.rec).filter(id => ITEMS[id] && ITEMS[id].type === type).sort((a, b) => S.rec[b].last - S.rec[a].last);
  const sp = solved("sz2-fill"), dl = solved("sz1-pick");
  const row = (id, who) => `<button class="r rbtn" data-act="shadow" data-id="${esc(id)}"><span>${esc(id)}・${esc(who)}</span><span class="sub">${ymd(new Date(S.rec[id].last)).slice(5)}　›</span></button>`;
  return `<div class="stack">
    <div><div class="lab">LISTEN AGAIN</div><h1>流し聞き</h1></div>
    <div class="card stack">
      <h2>聞き方の順番</h2>
      <p class="ja" style="margin:0">意味の分からない英語を流すだけでは、聞く力はあまり伸びません。<b>解く → 台本で確かめる → 音に重ねて読む（オーバーラッピング）→ 少し遅れて追いかけて言う（シャドーイング）</b>の順が効きます。ここで流すのは、解いて台本を確かめたスピーチだけです。</p>
    </div>
    <div class="card stack"><h2>再生の速さ</h2>${vRatePanel()}</div>
    <h2>流し聞き（登録したスピーチ ${list.length}本）</h2>
    <p class="sub" style="margin:0">${esc(TXT.flowNote)}</p>
    ${list.length ? `<button class="btn pri big" data-act="flowStart">流す（くり返し）</button><div class="textlist">${list.map(id => `<div class="r"><span>${esc(id)}・${esc(ITEMS[id].speaker.name)}</span><span class="sub">${S.rec[id] ? ymd(new Date(S.rec[id].last)).slice(5) : ""}</span></div>`).join("")}</div>`
      : `<p class="sub">スピーチの問題を解いて解説を見たときに「聞き流しに登録」を押すと、ここに入ります。</p>`}
    <h2 style="margin-top:8px">シャドーイング</h2>
    <p class="sub" style="margin:0">${esc(TXT.shadowNote)}</p>
    ${sp.length || dl.length ? `${sp.length ? `<div class="lab">SPEECH · スピーチ</div><div class="textlist">${sp.map(id => row(id, ITEMS[id].speaker.name)).join("")}</div>` : ""}
      ${dl.length ? `<div class="lab">DIALOG · 対話</div><div class="textlist">${dl.map(id => row(id, ITEMS[id].speakers.map(s => s.name).join(" と "))).join("")}</div>` : ""}`
      : `<p class="sub">${esc(TXT.shadowEmpty)}</p>`}
  </div>`;
}

// ---------- 流し聞きとシャドーイング（くり返し＝止めるまで・速さは毎回入れ直す＝applyRate） ----------
let loopTok = 0;
async function loopWait(sec) {   // 一時停止の間は数えない
  const tok = loopTok; let left = sec * 1000;
  while (left > 0) {
    await new Promise(r => setTimeout(r, 100));
    if (tok !== loopTok) throw new Error("stop");
    if (!V.paused) left -= 100;
  }
}
async function untilResumed() { const tok = loopTok; while (V.paused) { await new Promise(r => setTimeout(r, 100)); if (tok !== loopTok) throw new Error("stop"); } }
function setMedia(title, album) {   // ロック画面・通知の表示（Media Session）。画面を消したときの動きは【未実測】（実機の試験待ち）
  try {
    if (!("mediaSession" in navigator)) return;
    navigator.mediaSession.metadata = new MediaMetadata({ title, artist: "英語リスニング", album });
    if (!setMedia.done) {
      setMedia.done = true;
      navigator.mediaSession.setActionHandler("play", () => { if (isLoopView() && V.paused) ACT.play(); else au.play().catch(() => {}); });
      navigator.mediaSession.setActionHandler("pause", () => { if (isLoopView() && !V.paused) ACT.play(); else au.pause(); });
      try { navigator.mediaSession.setActionHandler("nexttrack", () => { if (V.name === "flowPlay") ACT.flowNext(); }); } catch (_) {}
    }
  } catch (_) {}
}
// 流し聞き：登録したスピーチを順に流し、最後まで行ったら最初へ（止めるまで）
async function runFlow() {
  const tok = ++loopTok, E = V;
  try {
    for (;;) {
      const it = ITEMS[E.ids[E.i]];
      setMedia(`${it.id}・${it.speaker.name}`, "流し聞き");
      paintLoop();
      const ok = await playFile(it.audio.speech.file);
      if (tok !== loopTok) return;
      if (!ok) { E.paused = true; E.stalled = true; mountPlayer(vPlayer()); paintPlayer(); await untilResumed(); E.stalled = false; continue; }   // 鳴らせなかった＝▶ で同じスピーチを頭から
      await loopWait(1.5);
      E.i = (E.i + 1) % E.ids.length;
      if (E.i === 0) E.round++;
    }
  } catch (e) { if (String(e.message) !== "stop") toast("止まりました：" + e.message); }
}
// シャドーイングの文の区切り。対話は区間（segments）のまま。スピーチは区間が1本なので、音声の文の間（1.5 秒の無音）から取る＝問題のパックは変えない。
// 物差し＝-40dB・0.9 秒（ffmpeg silencedetect で 40本とも「文の数−1」と一致した値・2026-11-23）。数が合わなければ字数で割った目安。
const SENT_CACHE = {};
function splitSentences(t) {   // Mr. Mt. などで切らない
  const out = []; let cur = "";
  for (const w of String(t).trim().split(/\s+/)) {
    cur = cur ? cur + " " + w : w;
    if (/[.!?]["')]?$/.test(w) && !/^(Mr|Mrs|Ms|Mt|Dr|St)\.$/.test(w)) { out.push(cur); cur = ""; }
  }
  if (cur) out.push(cur);
  return out;
}
async function silenceGaps(file) {
  const url = await audioUrl(file);
  try {
    const buf = await (await fetch(url)).arrayBuffer();
    const C = window.AudioContext || window.webkitAudioContext;
    beep.ctx = beep.ctx || new C();
    const ab = await new Promise((res, rej) => { const p = beep.ctx.decodeAudioData(buf, res, rej); if (p && p.then) p.then(res, rej); });
    const d = ab.getChannelData(0), sr = ab.sampleRate, win = Math.max(1, Math.round(sr * 0.01)), thr = 0.01, minRun = 0.9;
    const gaps = []; let run = null;
    for (let i = 0; i * win < d.length; i++) {
      let m = 0; for (let j = i * win, e = Math.min(d.length, j + win); j < e; j++) { const v = d[j] < 0 ? -d[j] : d[j]; if (v > m) m = v; }
      const t = i * win / sr;
      if (m < thr) { if (run == null) run = t; }
      else if (run != null) { if (t - run >= minRun && run > 0.3) gaps.push([run, t]); run = null; }
    }
    return gaps;   // 終わりの無音は数えない（最後まで無音のまま＝run が残る）
  } finally { if (url.startsWith("blob:")) URL.revokeObjectURL(url); }
}
async function sentencesOf(it) {
  if (it.type === "sz1-pick") return it.audio.main.segments.map(s => ({ text: s.text, who: s.who, start: Math.max(0, s.start - 0.05), end: s.start + s.sec + 0.1 }));
  const a = it.audio.speech;
  if (SENT_CACHE[a.file]) return SENT_CACHE[a.file];
  const texts = splitSentences(it.speech);
  let gaps = null;
  try { gaps = await silenceGaps(a.file); } catch (_) {}
  let out;
  if (gaps && gaps.length === texts.length - 1) {
    out = texts.map((text, k) => ({ text, start: k ? gaps[k - 1][1] - 0.1 : 0, end: k < gaps.length ? gaps[k][0] + 0.1 : a.sec }));
  } else {
    const lens = texts.map(t => t.length + 20), sum = lens.reduce((x, y) => x + y, 0);
    let acc = 0.2;
    out = texts.map((text, k) => { const start = acc; acc += (a.sec - 0.2) * lens[k] / sum; return { text, start, end: acc, approx: true }; });
  }
  return (SENT_CACHE[a.file] = out);
}
// シャドーイング：文を1つ流す → その文の長さぶん（いまの速さで）待つ → 次の文。最後まで行ったら最初から（止めるまで）
async function runShadow() {
  const tok = ++loopTok, E = V;
  try {
    if (!E.sents) {
      E.phase = "prep"; paintLoop();
      const sents = await sentencesOf(ITEMS[E.id]);
      if (tok !== loopTok) return;
      E.sents = sents; render();
    }
    const it = ITEMS[E.id], file = mainFile(it);
    setMedia(`${it.id}・シャドーイング`, "シャドーイング");
    for (;;) {
      for (; E.k < E.sents.length; E.k++) {
        const s = E.sents[E.k];
        E.phase = "listen"; paintLoop();
        const ok = await playFile(file, s.start, s.end);
        if (tok !== loopTok) return;
        if (!ok) { E.paused = true; E.stalled = true; mountPlayer(vPlayer()); paintPlayer(); await untilResumed(); E.stalled = false; E.k--; continue; }
        E.phase = "say"; paintLoop();
        await loopWait(Math.max(1, (s.end - s.start) / curRate()));
      }
      E.k = 0; E.round++;
      E.phase = "listen"; paintLoop();
      await loopWait(1.5);
    }
  } catch (e) { if (String(e.message) !== "stop") toast("止まりました：" + e.message); }
}
function vFlowPlay() {
  const E = V;
  return `<div class="stack"><div class="qhead"><button class="close" data-act="loopStop" aria-label="やめる">✕</button>
    <span class="pos">流し聞き</span><span class="gap"></span><span class="sub num" id="loopRound"></span></div>
    <div>${E.ids.map((id, i) => `<button class="ln${i === E.i ? " now" : ""}" data-act="flowJump" data-i="${i}"><span class="w">${esc(ITEMS[id].speaker.name)}</span>${esc(id)}</button>`).join("")}</div></div>`;
}
function vShadow() {
  const E = V, it = ITEMS[E.id];
  const nameOf = w => (it.speakers ? (it.speakers.find(s => s.id === w) || {}).name : it.speaker.name) || "Question";
  const body = E.sents
    ? `${E.sents.some(s => s.approx) ? `<p class="small" style="margin:0">${esc(TXT.approx)}</p>` : ""}<div class="lyrics">${E.sents.map((s, k) => `<button class="ln" data-act="shadowJump" data-k="${k}">${s.who ? `<span class="w">${esc(nameOf(s.who))}</span>` : ""}${esc(s.text)}</button>`).join("")}</div>`
    : `<p class="sub">文の区切りを調べています…</p>`;
  return `<div class="stack"><div class="qhead"><button class="close" data-act="loopStop" aria-label="やめる">✕</button>
    <span class="pos">シャドーイング</span><span class="sub">${esc(it.id)}</span><span class="gap"></span><span class="sub num" id="loopRound"></span></div>
    <div class="cue" id="shCue"></div>${body}</div>`;
}
// 描き直さずに、いまの文・済んだ文・合図だけ塗り替える
function paintLoop() {
  const E = V;
  const r = document.getElementById("loopRound"); if (r) r.textContent = E.round > 1 ? `${E.round}周目` : "";
  if (E.name === "flowPlay") document.querySelectorAll(".ln").forEach((b, i) => b.classList.toggle("now", i === E.i));
  if (E.name === "shadow") {
    const c = document.getElementById("shCue");
    if (c) c.textContent = E.phase === "say" ? "まねして言う" : E.phase === "prep" ? "" : "聞く";
    document.querySelectorAll(".lyrics .ln").forEach((b, k) => { b.classList.toggle("now", k === E.k); b.classList.toggle("past", k < E.k); });
    const now = document.querySelector(".lyrics .ln.now");
    if (now && now !== paintLoop.last) { paintLoop.last = now; try { now.scrollIntoView({ block: "center", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" }); } catch (_) {} }
  }
  paintPlayer();
}

function vSettings() {
  const st = S.pack ? `保存済み（版 ${esc(S.pack.version)}・音声 ${S.pack.files} 本・${S.pack.persisted ? "消えにくい保存" : "端末の都合で消えることがある保存"}）` : "まだ保存していない（ネットから読んでいます）";
  return `<div class="stack">
    <div class="row"><button class="btn sm" data-act="back">← 戻る</button></div>
    <div><div class="lab">SETTINGS</div><h1>設定</h1></div>
    <div class="card stack"><h2>アクセントの色</h2>
      <div class="colors">${ACCENTS.map((a, i) => `<button data-act="accent" data-i="${i}" style="background:${a.c}" aria-label="${a.name}" aria-pressed="${S.settings.accent === i}"></button>`).join("")}</div></div>
    <div class="card stack"><h2>再生の速さ</h2>${vRatePanel()}</div>
    <div class="card stack"><h2>オフラインの保存</h2><span class="sub">${st}</span>${S.pack ? `<button class="btn sm" data-act="resave">保存し直す</button>` : ""}${vSaveNotice()}</div>
    <div class="card stack"><h2>学習の記録</h2>
      <span class="sub">機種を替えるときや、保存が消えたときのために書き出せます（端末の中だけに入っています）。</span>
      <div class="row"><button class="btn sm" data-act="export">書き出す</button><button class="btn sm" data-act="importOpen">読み込む</button></div>
      <div id="ioBox"></div></div>
    ${vFbCard()}
    <p class="small">問題・音声はすべてオリジナル（過去の入試の文・音声は使っていません）。音声は合成音声です。アプリの版 ${APP_VER}／問題の版 ${esc(PACK.version)}</p>
  </div>`;
}

// ----- 図（型の仕様 §5＝4枚のカード／図1枚＋ア〜エ） -----
function vFigure(it, st, locked) {
  const ans = st.done ? it.answer : null;
  const cls = m => (ans ? (m === ans ? " ok" : (m === st.sel ? " ng" : "")) : "");
  if (it.figure_kind === "four-cards") {
    return `<div class="choices">${MARKS.map(m => {
      const c = it.choices[m];
      const ic = c.icon ? (ICON[c.icon] || "") : "";
      const pic = !ic && c.props ? propSvg(it, c) : "";
      return `<button class="choice${cls(m)}${pic ? " haspic" : ""}" data-act="pick" data-m="${m}" aria-pressed="${st.sel === m}" aria-label="${m}：${esc(c.label_ja)}" ${locked ? "disabled" : ""}><span class="mk">${m}</span>${ic ? `<span class="ic" aria-hidden="true">${ic}</span>` : ""}${pic}<span class="lb">${esc(c.label_ja)}</span></button>`;
    }).join("")}</div>`;
  }
  const f = it.figure || {};
  let body = "";
  if (f.kind === "calendar") body = calendarSvg(f);
  else if (f.kind === "scene") {
    const ppl = [...f.people].sort((a, b) => a.pos - b.pos);
    body = `<div class="items row4">${ppl.map(p => `<div class="it"><span class="mk">${p.mark}</span><span class="person" aria-hidden="true">🧍</span>${esc(p.desc_ja)}</div>`).join("")}</div>`;
  } else if (f.kind === "map" && f.grid) {
    body = mapSvg(f, st.done ? it.answer : null, st.sel);
  } else if (f.kind === "map") {
    body = `<div class="items" style="grid-template-columns:1fr 1fr">${f.places.map(p => `<div class="it" style="text-align:left"><span class="mk" style="display:inline;margin-right:6px">${p.mark}</span><b>${esc(p.name_ja)}</b><br><span class="sub">${esc(p.where_ja)}</span></div>`).join("")}</div>`;
  }
  return `<div class="fig"><div class="ttl">${esc(f.title_ja || "")}</div>${body}</div>
    <div class="marks">${MARKS.map(m => `<button class="choice${cls(m)}" data-act="pick" data-m="${m}" aria-pressed="${st.sel === m}" ${locked ? "disabled" : ""}>${m}</button>`).join("")}</div>`;
}
function calendarSvg(f) {
  const days = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][f.month - 1];
  const first = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(f.first_weekday);
  const markOf = {}; for (const [m, d] of Object.entries(f.marks)) markOf[d] = m;
  const W = 46, H = 38, top = 30;
  const rows = Math.ceil((first + days) / 7);
  let s = `<svg viewBox="0 0 ${W * 7} ${top + H * rows + 4}" role="img" aria-label="${f.month}月のカレンダー">`;
  ["日", "月", "火", "水", "木", "金", "土"].forEach((d, i) => { s += `<text x="${i * W + W / 2}" y="18" text-anchor="middle" font-size="13" fill="${i === 0 || i === 6 ? "var(--ng)" : "var(--sub)"}">${d}</text>`; });
  for (let d = 1; d <= days; d++) {
    const k = first + d - 1, x = (k % 7) * W, y = top + Math.floor(k / 7) * H;
    const m = markOf[d];
    if (m) s += `<circle cx="${x + W / 2}" cy="${y + H / 2 - 2}" r="15" fill="none" stroke="var(--ac)" stroke-width="2"/><text x="${x + W - 6}" y="${y + 11}" text-anchor="end" font-size="11" font-weight="700" fill="var(--ac)">${m}</text>`;
    s += `<text x="${x + W / 2}" y="${y + H / 2 + 3}" text-anchor="middle" font-size="15" fill="var(--t)" font-family="ui-monospace,Consolas,monospace">${d}</text>`;
  }
  return s + `</svg>`;
}

// ----- 地図（座標の欄＝grid・streets・landmarks・places[].at・start から描く・2026-11-23） -----
// 印の建物名は答える前は出さない（show_name の印＝対話が目印に使う印だけ出す）。答えたあとは全部の名前を出す（ans＝正解の印）。
// 地図の地面は明るい色に固定（ダークモードでも読める）。字は表示で 13px 前後になる大きさ（1ます 44・横7ます）。
function mapSvg(f, ans, sel) {
  const S = 44, [W, H] = f.grid;
  const cx = c => c[0] * S + S / 2, cy = c => c[1] * S + S / 2;
  const fit = (t, w, max) => Math.min(max, Math.floor((w - 6) / Math.max(1, [...t].length)));
  const lab = (t, x0, y, fs, col = "#1E293B", w = 700) => { const half = [...t].length * fs / 2 + 2, x = Math.max(half, Math.min(W * S - half, x0)); return `<text x="${x}" y="${y}" dy="0.35em" text-anchor="middle" font-size="${fs}" font-weight="${w}" fill="${col}" stroke="#F8FAFC" stroke-width="3" paint-order="stroke">${esc(t)}</text>`; };   // 字が図の外へ出ないよう横の位置を寄せる
  const marksIn = new Set(f.places.filter(p => p.in).map(p => p.at.join(",")));
  let s = `<svg class="map" viewBox="0 0 ${W * S} ${H * S}" role="img" aria-label="${esc(f.title_ja || "地図")}・目印：${esc([...f.landmarks.map(l => l.name_ja), ...f.places.filter(p => p.show_name).map(p => p.name_ja)].join("・"))}">`;
  s += `<rect width="${W * S}" height="${H * S}" rx="8" fill="#F8FAFC"/>`;
  for (const st of f.streets) {
    const [x1, y1] = st.from, [x2, y2] = st.to;
    const x = Math.min(x1, x2) * S, y = Math.min(y1, y2) * S, w = (Math.abs(x2 - x1) + 1) * S, h = (Math.abs(y2 - y1) + 1) * S;
    s += `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#CBD5E1"/>`;
  }
  for (const st of f.streets) if (st.name_ja && st.from[1] === st.to[1]) s += lab(st.name_ja, (Math.min(st.from[0], st.to[0]) + Math.abs(st.to[0] - st.from[0]) / 2) * S + S / 2, st.from[1] * S + S / 2, 12, "#475569", 600);
  for (const l of f.landmarks) {
    const w = (l.w || 1) * S, h = (l.h || 1) * S, x = l.at[0] * S, y = l.at[1] * S;
    s += `<rect x="${x + 3}" y="${y + 3}" width="${w - 6}" height="${h - 6}" rx="6" fill="#E2E8F0" stroke="#64748B" stroke-width="1.5"/>`;
    // 中に印があるときは、名前を印の無いますへ寄せる
    const free = [];
    for (let i = 0; i < (l.w || 1); i++) for (let j = 0; j < (l.h || 1); j++) if (!marksIn.has(`${l.at[0] + i},${l.at[1] + j}`)) free.push([l.at[0] + i, l.at[1] + j]);
    const lx = free.length ? free.reduce((a, c) => a + cx(c), 0) / free.length : x + w / 2;
    const ly = free.length ? free.reduce((a, c) => a + cy(c), 0) / free.length : y + h - 9;
    const room = free.length ? Math.max(S, (free.length > 1 && free.every(c => c[1] === free[0][1]) ? free.length * S : S)) : w;
    s += lab(l.name_ja, lx, ly, fit(l.name_ja, room, 14));
  }
  for (const p of f.places) {
    const x = p.at[0] * S, y = p.at[1] * S, named = p.show_name;
    if (!p.stop && !p.in) s += `<rect x="${x + 3}" y="${y + 3}" width="${S - 6}" height="${S - 6}" rx="6" fill="${named ? "#E2E8F0" : "#FFFFFF"}" stroke="${named ? "#64748B" : "#334155"}" stroke-width="1.5"/>`;
    const showName = named || ans;
    const ccy = showName && !p.stop ? y + 16 : y + S / 2;
    const fill = ans ? (p.mark === ans ? "#16A34A" : (p.mark === sel ? "#EA580C" : "#1E293B")) : "#1E293B";
    s += `<circle cx="${x + S / 2}" cy="${ccy}" r="${showName && !p.stop ? 12 : 14}" fill="${fill}" stroke="#FFFFFF" stroke-width="2"/>`;
    s += `<text x="${x + S / 2}" y="${ccy}" dy="0.35em" text-anchor="middle" font-size="${showName && !p.stop ? 14 : 16}" font-weight="800" fill="#FFFFFF">${p.mark}</text>`;
    if (showName) s += lab(p.name_ja, x + S / 2, p.stop ? y + S + 2 : y + S - 9, named ? Math.max(11, fit(p.name_ja, S, 12)) : 11, named ? "#1E293B" : "#0F172A", named ? 700 : 600);
  }
  if (f.start) {
    const [x, y] = [cx(f.start.at), cy(f.start.at)];
    const rot = { N: 0, E: 90, S: 180, W: 270 }[f.start.facing] || 0;
    s += `<g transform="translate(${x} ${y}) rotate(${rot})"><polygon points="0,-17 12,6 4,3 4,15 -4,15 -4,3 -12,6" fill="#DC2626" stroke="#FFFFFF" stroke-width="1.5"/></g>`;
    s += lab("現在地", x + (f.start.at[0] + 1 < W ? S * 0.95 : -S * 0.95), y, 11, "#DC2626");
  }
  return s + `</svg>`;
}

// ----- 2つの性質の絵（選択肢の props から描く・問題のデータは変えない） -----
// 物の形は質問文の名詞で決め、色・大きさ・柄・中身は props から。知らない形・値が1つでもあれば "" を返す＝文字のカードのまま。
const PCOL = { black: "#23272E", white: "#F3F4F6", brown: "#9A6A3F", blue: "#3B82F6", pink: "#F472B6", green: "#22C55E", red: "#EF4444" };
const PEMO = { dog: "🐕", cat: "🐈", guitar: "🎸", birds: "🐦", fish: "🐟", stars: "⭐", hearts: "❤️", animals: "🦁", space: "🪐",
  "Mt. Fuji": "🗻", sea: "🌊", "rice ball": "🍙", sandwich: "🥪", strawberry: "🍓", chocolate: "🍫", sleeping: "💤", "playing with a ball": "⚽" };
const PBASE = [[/T-shirt/i, "shirt"], [/lunch box/i, "lunchbox"], [/for lunch/i, "tray"], [/poster/i, "poster"], [/ice cream/i, "icecream"],
  [/picture/i, "frame"], [/umbrella/i, "umbrella"], [/\bcup\b/i, "cup"], [/\bbook\b/i, "book"], [/\bbike\b/i, "bike"], [/\bcake\b/i, "cake"],
  [/\bshow\b/i, "ticket"], [/\bbag\b/i, "bag"], [/\bdog\b/i, "dog"]];
const PKNOWN = { color: v => PCOL[v], size: v => v === "big" || v === "small", picture: v => PEMO[v], pattern: v => PEMO[v], topic: v => PEMO[v],
  animal: v => PEMO[v], action: v => PEMO[v], kind: v => PEMO[v], food: v => PEMO[v], words: v => v === "English" || v === "Japanese",
  language: v => v === "English" || v === "Japanese", flavor: v => v === "vanilla" || v === "chocolate", container: v => v === "cone" || v === "cup",
  drink: v => v === "orange juice" || v === "milk", basket: v => v === "yes" || v === "no", day: v => v === "Saturday" || v === "Sunday",
  time: v => v === "morning" || v === "afternoon" };
function propSvg(it, c) {
  const p = c.props || {};
  const base = (PBASE.find(([re]) => re.test(it.question || "")) || [])[1];
  if (!base || !Object.keys(p).length || Object.entries(p).some(([k, v]) => !PKNOWN[k] || !PKNOWN[k](v))) return "";
  const fill = PCOL[p.color] || "#C9CED6";
  const ln = `stroke="#4B5563" stroke-width="1.6" stroke-linejoin="round"`;   // 下地は明るい灰（app.css .pic）＝黒も白も縁で見える
  const emo = (e, x, y, s = 22) => e ? `<text x="${x}" y="${y}" font-size="${s}" text-anchor="middle" dominant-baseline="central">${e}</text>` : "";
  const sc = p.size === "small" ? 0.66 : 1;
  let g = "";
  switch (base) {
    case "shirt": g = `<path d="M34 14 L22 20 L12 32 L22 40 L28 35 L28 68 L72 68 L72 35 L78 40 L88 32 L78 20 L66 14 Q50 24 34 14Z" fill="${fill}" ${ln}/>${emo(PEMO[p.picture], 50, 46, 22)}`; break;
    case "bag": g = `<path d="M38 30 Q38 14 50 14 Q62 14 62 30" fill="none" stroke="${fill}" stroke-width="4"/><path d="M38 30 Q38 14 50 14 Q62 14 62 30" fill="none" ${ln} stroke-width="1"/><rect x="24" y="28" width="52" height="42" rx="7" fill="${fill}" ${ln}/>`; break;
    case "lunchbox": g = `<rect x="18" y="26" width="64" height="42" rx="8" fill="${fill}" ${ln}/><line x1="18" y1="38" x2="82" y2="38" ${ln}/><rect x="44" y="34" width="12" height="8" rx="2" fill="#E8EAED" opacity=".8"/>`; break;
    case "umbrella": { const e = PEMO[p.pattern]; g = `<path d="M10 44 Q50 2 90 44 Q80 38 70 44 Q60 38 50 44 Q40 38 30 44 Q20 38 10 44Z" fill="${fill}" ${ln}/><path d="M50 44 L50 70 Q50 76 44 76 Q39 76 39 71" fill="none" stroke="#4B5563" stroke-width="3" stroke-linecap="round"/>${emo(e, 30, 32, 13)}${emo(e, 50, 24, 13)}${emo(e, 70, 32, 13)}`; break; }
    case "cup": g = `<path d="M24 22 L70 22 L66 70 Q66 74 62 74 L32 74 Q28 74 28 70Z" fill="${fill}" ${ln}/><path d="M69 32 Q84 32 82 46 Q80 58 67 56" fill="none" stroke="#4B5563" stroke-width="4"/>${emo(PEMO[p.picture], 47, 47, 22)}`; break;
    case "book": { const t = p.language === "Japanese" ? "えほん" : "BOOK"; g = `<rect x="26" y="10" width="50" height="64" rx="4" fill="#4B5563" ${ln}/><rect x="26" y="10" width="7" height="64" fill="#374151"/><text x="54" y="26" font-size="${p.language === "Japanese" ? 10 : 11}" font-weight="700" text-anchor="middle" fill="#F3F4F6">${t}</text>${emo(PEMO[p.topic], 54, 50, 24)}`; break; }
    case "bike": g = `<circle cx="26" cy="56" r="15" fill="none" stroke="${fill}" stroke-width="4"/><circle cx="74" cy="56" r="15" fill="none" stroke="${fill}" stroke-width="4"/><path d="M26 56 L42 32 L66 32 L74 56 M42 32 L50 56 L66 32 M50 56 L26 56 M66 32 L64 22 L72 20 M42 32 L40 26 L34 26" fill="none" stroke="${fill}" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>${p.color === "white" || p.color === "black" ? `<path d="M26 56 L42 32 L66 32 L74 56" fill="none" ${ln} stroke-width=".8"/>` : ""}${p.basket === "yes" ? `<path d="M62 12 L82 12 L79 24 L65 24Z" fill="#C8A26B" ${ln}/>` : ""}`; break;
    case "cake": { const ch = p.kind === "chocolate"; g = `<g transform="translate(50 74) scale(${sc}) translate(-50 -74)"><rect x="20" y="36" width="60" height="38" rx="5" fill="${ch ? "#6B3E26" : "#FDF2F8"}" ${ln}/><path d="M20 46 Q35 52 50 46 Q65 52 80 46" fill="none" stroke="${ch ? "#3B2416" : "#F9A8D4"}" stroke-width="3"/>${emo(ch ? "🍫" : "🍓", 50, 28, 22)}</g>`; break; }
    case "dog": g = `<g transform="translate(50 72) scale(${sc}) translate(-50 -72)"><ellipse cx="52" cy="48" rx="24" ry="13" fill="${fill}" ${ln}/><circle cx="26" cy="34" r="11" fill="${fill}" ${ln}/><path d="M19 27 L16 40 L23 36Z" fill="${fill}" ${ln}/><rect x="34" y="56" width="6" height="16" rx="2" fill="${fill}" ${ln}/><rect x="64" y="56" width="6" height="16" rx="2" fill="${fill}" ${ln}/><path d="M76 44 Q88 34 86 26" fill="none" stroke="${fill}" stroke-width="4" stroke-linecap="round"/><circle cx="23" cy="33" r="1.6" fill="${p.color === "black" ? "#E8EAED" : "#111"}"/></g>`; break;
    case "poster": { const jp = p.words === "Japanese"; g = `<rect x="22" y="8" width="56" height="68" rx="3" fill="#F3F4F6" ${ln}/>${emo(PEMO[p.picture], 50, 36, 28)}<text x="50" y="66" font-size="${jp ? 10 : 9}" font-weight="800" text-anchor="middle" fill="#1F2937">${jp ? "ようこそ" : "WELCOME"}</text>`; break; }
    case "frame": g = `<rect x="12" y="12" width="76" height="60" rx="3" fill="#2A303B" stroke="#C8A26B" stroke-width="4"/>${emo(PEMO[p.animal], 40, 44, 28)}${emo(PEMO[p.action], 66, 40, 18)}`; break;
    case "icecream": { const sc2 = p.flavor === "chocolate" ? "#7B4A2E" : "#F6EBCB"; g = p.container === "cone"
      ? `<path d="M36 40 L50 76 L64 40Z" fill="#D9A55B" ${ln}/><circle cx="50" cy="32" r="16" fill="${sc2}" ${ln}/>`
      : `<path d="M30 44 L70 44 L64 72 L36 72Z" fill="#E5E7EB" ${ln}/><path d="M34 44 Q34 26 50 26 Q66 26 66 44Z" fill="${sc2}" ${ln}/>`; break; }
    case "tray": g = `<rect x="8" y="58" width="84" height="12" rx="6" fill="#4B5563"/>${emo(PEMO[p.food], 34, 44, 30)}<path d="M62 26 L80 26 L77 58 L65 58Z" fill="${p.drink === "milk" ? "#F3F4F6" : "#FB923C"}" ${ln}/>`; break;
    case "ticket": g = `<path d="M10 22 L90 22 L90 36 Q84 40 90 44 L90 62 L10 62 L10 44 Q16 40 10 36Z" fill="#F3F4F6" ${ln}/><text x="38" y="48" font-size="16" font-weight="800" text-anchor="middle" fill="#1F2937">${p.day === "Saturday" ? "SAT" : "SUN"}</text><line x1="60" y1="26" x2="60" y2="58" stroke="#9CA3AF" stroke-dasharray="3 3"/>${emo(p.time === "morning" ? "🌅" : "🌇", 75, 42, 18)}`; break;
  }
  if (!g) return "";
  // 大きさ（big／small）は形ごとに縮める（cake・dog は中で縮めた）
  if (p.size && base !== "cake" && base !== "dog") g = `<g transform="translate(50 74) scale(${sc}) translate(-50 -74)">${g}</g>`;
  return `<svg class="pic" viewBox="0 0 100 80" aria-hidden="true">${g}</svg>`;
}

// ----- 問題画面 -----
function curItem() { return ITEMS[V.ids[V.i]]; }
function mainFile(it) { return it.type === "sz1-pick" ? it.audio.main.file : it.audio.speech.file; }
function vQ() {
  const it = curItem(), st = V.st;
  const head = `<div class="qhead"><button class="close" data-act="quit" aria-label="やめる">✕</button>
    <span class="pos">${V.i + 1} / ${V.ids.length}</span><span class="sub">${esc(V.label)}</span><span class="gap"></span>
    <div class="dots" aria-label="聞いた回数">${[0, 1].map(k => `<i class="${(it.type === "sz1-pick" ? st.plays : st.plays) > k ? "on" : ""}"></i>`).join("")}</div></div>`;
  return head + (it.type === "sz1-pick" ? vSz1(it, st) : vSz2(it, st));
}
function speakersLine(it) { return `<div class="who">${it.speakers.map(s => `<b>${esc(s.name)}</b>`).join(" と ")} の会話</div>`; }
function vSz1(it, st) {
  let out = `<div class="stack">${speakersLine(it)}
    ${!st.plays && !st.done ? `<p class="sub" style="margin:0">先に絵を見てから、下の ▶ で会話と質問を聞きます（本番は2回）。</p>` : ""}
    ${vFigure(it, st, st.done)}`;
  if (st.done) out += vExplainSz1(it, st);
  return out + `</div>`;
}
function vExplainSz1(it, st) {
  const ok = st.sel === it.answer;
  const lines = it.audio.main.segments;
  const nameOf = w => (it.speakers.find(s => s.id === w) || {}).name || "Question";
  return `<div class="sheet">
    <div class="res ${ok ? "ok" : "ng"}">${ok ? "正解" : "不正解"}<span class="sub" style="font-size:14px;margin-left:10px">正解は ${it.answer}${st.conf ? `・${st.conf === "sure" ? "自信あり" : "たぶん"}` : ""}</span></div>
    <div class="lab">SCRIPT · 文を押すとその文だけ聞けます</div>
    <div>${lines.map((s, k) => `<button class="ln${s.kind === "question" ? " q" : ""}" data-act="line" data-k="${k}"><span class="w">${esc(nameOf(s.who))}</span>${esc(s.text)}</button>`).join("")}</div>
    <div class="lab">解説</div><p class="ja" style="margin:0">${esc(it.explanation_ja)}</p>
    ${it.distractors ? `<div class="lab">ほかの選択肢</div><div class="small">${MARKS.filter(m => it.distractors[m]).map(m => `${m}：${esc(it.distractors[m])}`).join("<br>")}</div>` : ""}
    <p class="small" style="margin:0">くわしい解説（3段）は準備中です。</p>
    ${vReport(it, st)}
  </div>`;
}
function vReport(it, st) {
  const f = fbState();
  if (!f.open) return `<button class="btn sm ghost" data-act="report">この問題おかしい</button>`;
  return vFbForm(f, FB_KINDS_Q);
}
// 報告の書く欄（問題と設定で同じ形・種類だけ違う）。チップで描き直してもひとことは f.text から戻す
function vFbForm(f, kinds) {
  const inSet = V.name === "settings";
  return `<div class="stack fbf">
    <div class="fbk" role="group" aria-label="種類">${kinds.map((k, i) => `<button class="fbc" data-act="fbKind" data-k="${i}" aria-pressed="${f.kind === k}">${esc(k)}</button>`).join("")}</div>
    ${f.kind === "音声がおかしい" ? `<p class="small fbwarn" style="margin:0">${esc(TXT.fbAudio)}</p>` : ""}
    <textarea id="fbTxt" maxlength="${FB_MAX}" placeholder="${esc(inSet ? TXT.fbPhSet : TXT.fbPhQ)}">${esc(f.text)}</textarea>
    <p class="small" style="margin:0">${esc(TXT.fbNote)}${FEEDBACK_URL ? "<br>" + esc(inSet ? TXT.fbWhatSet : TXT.fbWhatQ) + "<br>" + esc(TXT.fbCost) : ""}</p>
    <div class="row">${FEEDBACK_URL ? `<button class="btn sm pri" data-act="fbGo">送る</button>` : ""}<button class="btn sm${FEEDBACK_URL ? "" : " pri"}" data-act="fbSave">端末に残す</button><button class="btn sm ghost" data-act="${inSet ? "fbOpen" : "report"}">閉じる</button></div>
  </div>`;
}
// 設定のカード：書く・まだ送っていない報告（1件ずつ消せる＝2回押し）・まとめて送る・送った件数
function vFbCard() {
  const f = fbState();
  const wait = S.reports.filter(r => !r.sent), sent = S.reports.length - wait.length;
  const cut = s => (s.length > 40 ? s.slice(0, 40) + "…" : s);
  const list = wait.slice().reverse().map(r => `<li class="fbi"><div><span class="sub num">${esc(fbDate(r.t))}${r.id ? "・" + esc(r.id) : ""}</span><br><b>${esc(r.kind)}</b>${r.text.trim() ? "：" + esc(cut(r.text.trim())) : ""}</div><button class="btn sm ghost" data-act="fbDel" data-rid="${esc(r.rid)}">消す</button></li>`).join("");
  return `<div class="card stack"><h2>ご意見・不具合の報告</h2>
    <span class="sub">${FEEDBACK_URL ? `まだ送っていない報告 ${wait.length}件・送った報告 ${sent}件` : esc(TXT.fbCountLocal(wait.length))}</span>
    ${f.open ? vFbForm(f, FB_KINDS_SET) : `<div class="row"><button class="btn sm" data-act="fbOpen">書く</button>${FEEDBACK_URL && wait.length ? `<button class="btn sm pri" data-act="fbAll" ${fbBusy ? "disabled" : ""}>${fbBusy ? esc(TXT.fbSending) : "まとめて送る"}</button>` : ""}</div>`}
    ${wait.length ? `<ul class="fbl">${list}</ul>` : ""}
  </div>`;
}

// 記述（型の仕様 §3・§5）
function vSz2(it, st) {
  const g = st.grade;
  let out = `<div class="stack"><div class="who"><b>${esc(it.speaker.name)}</b> のスピーチ</div>
    ${!st.done ? `<p class="sub" style="margin:0">本番は「質問を1回 → スピーチを2回」。下の「質問」で先読み、▶ でスピーチ。</p>` : ""}
    ${!st.done ? `<label class="paper"><input type="checkbox" data-act="paper" ${st.paper ? "checked" : ""}>紙に書いて、あとで模範解答を見て自己採点する</label>` : ""}
    <div class="qset">${it.questions.map(q => vQBlock(it, q, st)).join("")}</div>`;
  if (st.done) out += vExplainSz2(it, st);
  return out + `</div>`;
}
function frameHtml(q, st, qi) {
  let k = 0;
  return esc(q.frame).replace(/\(\s*[①②]\s*\)/g, () => {
    const key = qi + "-" + k, b = q.blanks[k]; k++;
    const res = st.grade && st.grade[key];
    const wide = q.no === 3 ? " wide" : "";
    if (st.paper && !st.done) return `<span class="num">（　${k === 1 ? "①" : "②"}　）</span>`;
    if (st.paper && st.done) return `<span class="num">（ <b>${esc(b.answer)}</b> ）</span>`;
    return `<input class="${wide}${res ? (res.ok ? " ok" : " ng") : ""}" data-in="${key}" value="${esc(st.inputs[key] || "")}" autocapitalize="none" autocorrect="off" autocomplete="off" spellcheck="false" ${st.done ? "readonly" : ""} aria-label="質問${q.no}の空欄${k}">`;
  });
}
function vQBlock(it, q, st) {
  const qi = q.no;
  let tail = "";
  if (st.done) {
    const r = qResult(it, q, st);
    const keys = q.blanks.map((_, k) => qi + "-" + k);
    const anyNg = keys.some(k => !(st.grade[k] || {}).ok);
    tail = `<div class="verdict ${r.pt ? "ok" : "ng"}">${r.pt ? "正解（2点）" : r.half ? "片方正解（このアプリでは0点・本番は学校により部分点があるかも）" : st.paper ? "自己採点してください" : "照合で合わない（模範解答を見て自己採点できます）"}${st.self[qi] != null ? "・自己採点" : ""}</div>`;
    if (!st.paper) tail += `<div class="model">模範解答：${q.blanks.map(b => `<b>${esc(b.answer)}</b>`).join(" ／ ")}${keys.map(k => st.grade[k] && st.grade[k].near ? `<br>綴りが近い：<b>${esc(st.inputs[k])}</b>（ここが違う）` : "").join("")}</div>`;
    if (anyNg || st.paper) tail += `<div class="self"><span class="sub">模範解答と同じ意味なら：</span><button class="btn sm${st.self[qi] === true ? " pri" : ""}" data-act="self" data-q="${qi}" data-v="1">合っていた</button><button class="btn sm${st.self[qi] === false ? " pri" : ""}" data-act="self" data-q="${qi}" data-v="0">違っていた</button></div>`;
  }
  return `<div class="qq"><div class="lab">QUESTION ${q.no}</div><div class="q">${esc(q.q)}</div><div class="frame">${frameHtml(q, st, qi)}</div>${tail}</div>`;
}
function vExplainSz2(it, st) {
  const sc = sz2Score(it, st);
  const inFlow = (S.flow || []).includes(it.id);
  return `<div class="sheet">
    <div class="res ${sc.pt === 6 ? "ok" : "ng"}">${sc.pt} / 6 点<span class="sub" style="font-size:14px;margin-left:10px">${sc.pending ? "自己採点のこりあり" : ""}</span></div>
    <div class="lab">SCRIPT</div>
    <button class="ln" data-act="line" data-part="speech" data-k="0">${esc(it.speech)}</button>
    <div class="lab">解説</div><p class="ja" style="margin:0">${esc(it.explanation_ja)}</p>
    <p class="small" style="margin:0">くわしい解説（3段）は準備中です。</p>
    <div class="notice"><b>聞き流しに登録しますか</b><br><span class="sub">台本で意味を確かめたスピーチだけを、あとで流し聞きできます。</span><br>
      <button class="btn sm${inFlow ? " pri" : ""}" data-act="flowReg" style="margin-top:8px">${inFlow ? "登録しました" : "登録する"}</button></div>
    ${vReport(it, st)}
  </div>`;
}

// 採点（型の仕様 §5＝大文字小文字・末尾の記号・短縮形を同じに扱う）
const CONTR = { "don't": "do not", "doesn't": "does not", "didn't": "did not", "can't": "can not", "cannot": "can not", "won't": "will not",
  "isn't": "is not", "aren't": "are not", "wasn't": "was not", "weren't": "were not", "couldn't": "could not", "wouldn't": "would not",
  "shouldn't": "should not", "haven't": "have not", "hasn't": "has not", "hadn't": "had not", "i'm": "i am", "it's": "it is",
  "that's": "that is", "they're": "they are", "we're": "we are", "you're": "you are", "i'll": "i will", "we'll": "we will",
  "they'll": "they will", "she'll": "she will", "he'll": "he will", "i've": "i have", "we've": "we have", "they've": "they have",
  "you'll": "you will", "it'll": "it will", "you've": "you have", "let's": "let us", "needn't": "need not" };
// 's は is と has、'd は would と had の両方に取れる＝両方を試す
const CONTR2 = { "'s": ["is", "has"], "'d": ["would", "had"] };
const S_WORDS = new Set(["he", "she", "it", "that", "there", "here", "what", "who", "where", "when", "how"]);
const D_WORDS = new Set(["i", "you", "he", "she", "we", "they", "it", "that"]);
function normBase(s) {
  // NFKC＝全角の ３・ｔｈｒｅｅ を半角に
  let t = String(s || "").normalize("NFKC").toLowerCase().replace(/[‘’`´]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, " ").trim();
  t = t.replace(/^[("']+|[.,!?;:)"']+$/g, "").trim();
  return t.split(" ").map(w => CONTR[w] || w).join(" ");
}
function norms(s) {   // 取りうる読みを全部（多くても 8 通り）
  let outs = [""];
  for (const w of normBase(s).split(" ")) {
    const m = /^([a-z]+)('s|'d)$/.exec(w);
    const alts = m && (m[2] === "'s" ? S_WORDS : D_WORDS).has(m[1]) ? CONTR2[m[2]].map(x => m[1] + " " + x) : [w];
    const next = [];
    for (const o of outs) for (const a of alts) next.push(o ? o + " " + a : a);
    outs = next.slice(0, 8);
  }
  return outs;
}
const norm = s => norms(s)[0];
function lev(a, b) {
  const m = a.length, n = b.length; if (Math.abs(m - n) > 3) return 9;
  let p = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) { const c = [i]; for (let j = 1; j <= n; j++) c[j] = Math.min(p[j] + 1, c[j - 1] + 1, p[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); p = c; }
  return p[n];
}
// 綴りが近い＝語の数が同じで、違う語が1つだけ・その語が4字以上で差が1字（8字以上は2字）。
// her と his・east と west のような語の取り違えは「近い」と言わない
function nearMiss(x, a) {
  const xs = x.split(" "), as = a.split(" ");
  if (xs.length !== as.length) return false;
  const diff = xs.map((w, i) => [w, as[i]]).filter(([w, v]) => w !== v);
  if (diff.length !== 1) return false;
  const [w, v] = diff[0];
  return v.length >= 4 && lev(w, v) <= (v.length >= 8 ? 2 : 1);
}
function gradeBlank(input, blank, isQ3) {
  const raw = String(input || "").trim();
  if (!raw) return { ok: false };
  const acc = [...new Set([blank.answer, ...(blank.accept || [])].filter(Boolean).flatMap(norms))];
  let xs = norms(raw);
  // 質問3の Because の書き足し（「Because, she …」のカンマも）＝外した形と外さない形の両方を比べる
  if (isQ3) xs = [...xs, ...xs.filter(x => /^because,? /.test(x)).map(x => x.replace(/^because,? /, ""))];
  xs = xs.filter(Boolean);
  if (xs.some(x => acc.includes(x))) return { ok: true };
  return { ok: false, near: xs.some(x => acc.some(a => nearMiss(x, a))) };
}
function gradeSz2(it, st) {
  st.grade = {};
  for (const q of it.questions) q.blanks.forEach((b, k) => { const key = q.no + "-" + k; st.grade[key] = st.paper ? { ok: false } : gradeBlank(st.inputs[key], b, q.no === 3); });
}
function qResult(it, q, st) {
  const oks = q.blanks.map((_, k) => !!(st.grade[q.no + "-" + k] || {}).ok);
  const all = oks.every(Boolean);
  const half = q.blanks.length === 2 && oks.some(Boolean) && !all;   // 自己採点のあとも注記は残す
  if (st.self[q.no] != null) return { pt: st.self[q.no] ? 2 : 0, half: half && !st.self[q.no] };
  return { pt: all ? 2 : 0, half };
}
function sz2Score(it, st) {
  let pt = 0, pending = 0;
  for (const q of it.questions) {
    const r = qResult(it, q, st); pt += r.pt;
    if (!r.pt && st.self[q.no] == null) pending++;
  }
  return { pt, pending };
}

// ----- 下のプレイヤー -----
function vPlayer() {
  const wave = `<div class="wave" aria-hidden="true">${"<i></i>".repeat(14)}</div>`;
  if (V.name === "exam") {
    return `<div class="player" id="player"><div class="in">${wave}<div class="ctl">
      <button class="btn sm" data-act="examQuit">やめる</button>
      <button class="play" data-act="examPause" aria-label="一時停止">${V.paused ? playIcon() : pauseIcon()}</button>
      <span class="chip num" style="display:grid;place-items:center" aria-label="速さ（本番の途中では変えない）">${fmtRate(V.rate || curRate())}x</span></div>
      <div class="time" id="ptime"></div></div></div>`;
  }
  const rateChip = `<button class="chip num" data-act="rate" aria-expanded="${rateOpen}" aria-label="再生の速さ">${fmtRate(curRate())}x</button>`;
  const rateBox = rateOpen ? `<div class="ratebox">${vRatePanel()}</div>` : "";
  if (isLoopView()) {
    const left = V.name === "flowPlay"
      ? `<div class="row" style="gap:8px"><button class="chip" data-act="back5">−5秒</button><button class="chip" data-act="flowNext">次へ</button></div>`
      : `<button class="chip" data-act="shadowAgain">この文をもう一度</button>`;
    return `<div class="player" id="player"><div class="in">${rateBox}${wave}<div class="ctl">${left}
      <button class="play" data-act="play" aria-label="再生・一時停止">${V.paused ? playIcon() : pauseIcon()}</button>${rateChip}</div>
      <div class="time" id="ptime"></div></div></div>`;
  }
  const it = curItem(), st = V.st;
  let decide = "";
  if (!st.done) {
    if (it.type === "sz1-pick" && st.sel) decide = `<div class="decide"><button class="btn" data-act="answer" data-c="maybe">たぶん</button><button class="btn sure" data-act="answer" data-c="sure">自信あり</button></div>`;
    if (it.type === "sz2-fill") decide = `<div class="decide"><button class="btn" data-act="answer" data-c="maybe">${st.paper ? "答えを見る（たぶん）" : "たぶん"}</button><button class="btn sure" data-act="answer" data-c="sure">${st.paper ? "答えを見る（自信あり）" : "自信あり"}</button></div>`;
  } else {
    decide = `<div class="decide"><button class="btn sure" data-act="next">${V.i + 1 < V.ids.length ? "次へ" : "結果を見る"}</button></div>`;
  }
  const qChip = it.type === "sz2-fill" ? `<button class="chip" data-act="playQ">質問</button>` : "";
  return `<div class="player" id="player"><div class="in">${rateBox}${decide}${wave}
    <div class="ctl"><div class="row" style="gap:8px"><button class="chip" data-act="back5">−5秒</button>${qChip}</div>
      <button class="play" data-act="play" aria-label="再生">${playIcon()}</button>${rateChip}</div>
    <div class="time" id="ptime"></div></div></div>`;
}
const playIcon = () => `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 4.5v15l13-7.5z"/></svg>`;
const pauseIcon = () => `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 4h4v16H6zM14 4h4v16h-4z"/></svg>`;
function paintPlayer() {
  const p = document.getElementById("player"); if (!p) return;
  const playing = !au.paused && !au.ended;
  p.classList.toggle("playing", playing);
  const b = p.querySelector('[data-act="play"]');
  // 流し聞き・シャドーイングは、文と文の間（音が止まっている）も動いている＝ボタンは一時停止の状態で決める
  if (b) b.innerHTML = (isLoopView() ? !V.paused : playing) ? pauseIcon() : playIcon();
  const t = document.getElementById("ptime");
  const mine = (V.name === "q" || V.name === "flowPlay") && curFile && Object.values(curItem().audio || {}).some(a => a.file === curFile);
  if (!t) return;
  if (V.name === "exam") t.textContent = V.cue || "";
  else if (V.name === "flowPlay") t.textContent = `${V.i + 1} / ${V.ids.length}　` + (mine ? fmt(au.currentTime) + " / " + fmt(au.duration) : "");
  else if (V.name === "shadow") t.textContent = V.sents ? `文 ${Math.min(V.k + 1, V.sents.length)} / ${V.sents.length}` : "";
  else t.textContent = mine ? fmt(au.currentTime) + " / " + fmt(au.duration) : "";
}

// ----- 解いたあとの結果 -----
function vEnd() {
  const r = V.results, ok = r.filter(x => x.ok).length;
  return `<div class="stack">
    <div class="lab">RESULT</div><h1>${ok} / ${r.length}<span class="sub" style="font-size:16px"> 正解</span></h1>
    <div class="textlist">${r.map(x => `<div class="r"><span>${esc(x.id)}</span><span style="color:${x.ok ? "var(--ac)" : "var(--ng)"}">${x.ok ? "正解" : x.pt != null ? x.pt + "/6" : "不正解"}</span></div>`).join("")}</div>
    <button class="btn pri big" data-act="home">ホームへ</button>
  </div>`;
}

// ---------- 本番モード（型の仕様 §4-2＝令和8年度の放送の順と秒数） ----------
function vExamIntro() {
  const e = PACK.exams.find(x => x.no === V.no);
  return `<div class="stack">
    <div class="row"><button class="btn sm" data-act="back">← 戻る</button></div>
    <div><div class="lab">EXAM · NO.${e.no}</div><h1>本番の形で通す</h1></div>
    <div class="card stack"><span class="ja">(1) 対話を聞いて絵を選ぶ 4問：会話と質問を<b>2回</b>ずつ。答える時間は約6秒。<br>(2) スピーチ 3問：質問を1回読んだあと、スピーチを<b>2回</b>。答える時間は約20秒。<br>全部で約10分。途中で止められるのは一時停止だけです。</span></div>
    <div class="card stack"><h2>再生の速さ</h2><p class="small" style="margin:0">${esc(TXT.examRate(fmtRate(curRate())))}</p>${vRatePanel()}</div>
    <label class="paper"><input type="checkbox" data-act="paper" ${S.settings.paper ? "checked" : ""}>(2) は紙に書いて、あとで自己採点する</label>
    <button class="btn pri big" data-act="examStart">はじめる</button>
  </div>`;
}
function vExam() {
  const E = V;
  if (E.part === 1) {
    const it = ITEMS[E.e.sz1[E.k]];
    return `<div class="stack"><div class="qhead"><span class="pos">(1) ${"ABCD"[E.k]}</span><span class="sub">本番 NO.${E.e.no}</span><span class="gap"></span></div>
      <div class="cue">${esc(E.cue || "")}</div>${speakersLine(it)}${vFigure(it, E.st[it.id], false)}</div>`;
  }
  const it = ITEMS[E.e.sz2];
  return `<div class="stack"><div class="qhead"><span class="pos">(2)</span><span class="sub">本番 NO.${E.e.no}</span><span class="gap"></span></div>
    <div class="cue">${esc(E.cue || "")}</div><div class="who"><b>${esc(it.speaker.name)}</b> のスピーチ</div>
    <div class="qset">${it.questions.map(q => `<div class="qq"><div class="lab">QUESTION ${q.no}</div><div class="q">${esc(q.q)}</div><div class="frame">${frameHtml(q, E.st[it.id], q.no)}</div></div>`).join("")}</div>
    ${E.finished ? `<button class="btn pri big" data-act="examGrade">答え合わせ</button>` : ""}</div>`;
}
let examTok = 0;
async function wait(sec) {
  const tok = examTok; let left = sec * 1000;
  while (left > 0) {
    await new Promise(r => setTimeout(r, 100));
    if (tok !== examTok) throw new Error("stop");
    if (!V.paused) left -= 100;
  }
}
// 一時停止は au.pause() だけ＝playFile の約束は「終わりまで鳴った」で解ける（pause では解けない）
// 鳴らせなかったときは先へ進まず一時停止にする（▶ で同じ音声を頭から鳴らし直す）＝無音のまま本番が進まない
async function examPlay(file) {
  const tok = examTok;
  for (;;) {
    const ok = await playFile(file);
    if (tok !== examTok) throw new Error("stop");
    if (ok) return;
    V.paused = true; V.retry = true;
    cue("音が出ませんでした。▶ で続けます");
    mountPlayer(vPlayer()); paintPlayer();
    while (V.paused) { await new Promise(r => setTimeout(r, 100)); if (tok !== examTok) throw new Error("stop"); }
    V.retry = false;
  }
}
function cue(s, b) { V.cue = s; if (b) beep(); const c = document.querySelector(".cue"); if (c) c.textContent = s; paintPlayer(); }
async function runExam() {
  const E = V, tok = ++examTok;
  try {
    E.part = 1; render();
    cue("会話と質問は2回くり返します", false); await wait(3);
    for (E.k = 0; E.k < 4; E.k++) {
      const it = ITEMS[E.e.sz1[E.k]];
      render();
      cue(`${"ABCD"[E.k]}　1回目`, true); await wait(1.6);
      cue(`${"ABCD"[E.k]}　1回目`); await examPlay(it.audio.main.file);
      await wait(2.1);   // 型の仕様 §4-2：1回目の質問の終わりから2回目の対話まで約4.2秒（合図を含む）
      cue(`${"ABCD"[E.k]}　2回目`, true); await wait(2.1);
      await examPlay(it.audio.main.file);
      cue("答える時間"); await wait(6.1);
    }
    const it = ITEMS[E.e.sz2];
    E.part = 2; render();
    cue("質問を読みます（質問1〜3）", true); await wait(1.6);
    await examPlay(it.audio.q.file); await wait(4.1);
    cue("スピーチ　1回目", true); await wait(1.6);
    await examPlay(it.audio.speech.file);
    cue("（2回目まで約20秒）"); await wait(20.1);
    cue("スピーチ　2回目", true); await wait(1.6);
    await examPlay(it.audio.speech.file);
    cue("答える時間（約20秒）"); await wait(20.2);
    cue("終わり"); E.finished = true; render();
  } catch (e) { if (String(e.message) !== "stop") toast("止まりました：" + e.message); }
  if (tok === examTok) keepAwake(false);
}
function examGrade() {
  const E = V, res = [];
  let p1 = 0;
  for (const id of E.e.sz1) {
    const it = ITEMS[id], st = E.st[id], ok = st.sel === it.answer;
    if (ok) p1 += 2;
    st.done = true; record(id, ok, "exam", "exam");
    res.push({ id, ok });
  }
  const it2 = ITEMS[E.e.sz2], st2 = E.st[it2.id];
  st2.done = true; gradeSz2(it2, st2);
  go({ name: "examEnd", e: E.e, st: E.st, p1, res, saved: false, rate: E.rate });
  if (saveExam(V)) render();   // 自己採点の残りが無ければ、答え合わせの時点で全部記録
}
function vExamEnd() {
  const E = V, it2 = ITEMS[E.e.sz2], st2 = E.st[it2.id];
  const sc = sz2Score(it2, st2), total = E.p1 + sc.pt;
  return `<div class="stack">
    <div class="lab">EXAM · NO.${E.e.no} · RESULT</div>
    <h1>${total}<span class="sub" style="font-size:18px"> / 14 点</span></h1>
    ${E.rate ? `<p class="sub" style="margin:0">${esc(TXT.examEndRate(fmtRate(E.rate)))}</p>` : ""}
    <div class="stats"><div class="card"><div class="lab">(1) 対話</div><b>${E.p1}<span class="sub"> / 8</span></b><span class="sub">正答率 ${Math.round(E.p1 / 8 * 100)}%</span></div>
      <div class="card"><div class="lab">(2) スピーチ</div><b>${sc.pt}<span class="sub"> / 6</span></b><span class="sub">${sc.pending ? "自己採点のこり " + sc.pending : "正答率 " + Math.round(sc.pt / 6 * 100) + "%"}</span></div></div>
    <h2>(1) の答え</h2>
    <div class="textlist">${E.res.map((x, k) => `<div class="r"><span>${"ABCD"[k]}・${esc(x.id)}</span><span style="color:${x.ok ? "var(--ac)" : "var(--ng)"}">${x.ok ? "正解" : "不正解（正解 " + ITEMS[x.id].answer + "）"}</span></div>`).join("")}</div>
    <h2>(2) の答え</h2>
    <div class="qset">${it2.questions.map(q => vQBlock(it2, q, st2)).join("")}</div>
    ${E.saved ? `<p class="sub" style="margin:0">記録しました。</p>` : `<p class="sub" style="margin:0;color:var(--ng)">自己採点が残っています（あと ${sc.pending}）。質問ごとに「合っていた／違っていた」を押すと記録します。</p>`}
    <button class="btn big${E.saved ? " pri" : ""}" data-act="examSave" ${E.saved ? "" : "disabled"}>練習へ戻る</button>
    <p class="small">間違えた問題は「苦手の箱」に入ります（本番で正解しても箱からは抜けません。抜けるのは練習で「自信あり」で正解したとき）。解説は練習で同じ問題を解くと見られます。</p>
  </div>`;
}

// 解いた sz2 をまだ記録していなければ記録する（「次へ」でも ✕ でも＝自己採点の残りは0点として）
function recordPendingSz2() {
  if (V.name !== "q") return;
  const it = curItem(), st = V.st;
  if (it.type !== "sz2-fill" || !st.done || st.recorded) return;
  const sc = sz2Score(it, st);
  record(it.id, sc.pt === 6, st.conf, V.mode, { pt: sc.pt });
  st.recorded = true;
  const r = V.results.find(x => x.id === it.id); if (r) Object.assign(r, { ok: sc.pt === 6, pt: sc.pt });
}
// 本番の (2) と本番の成績を記録する（自己採点の残りが無いときだけ・1回だけ）
// force＝閉じるときなど、残りを0点として記録する（記録が消えるよりよい）
function saveExam(E, force) {
  const it2 = ITEMS[E.e.sz2], st2 = E.st[it2.id], sc = sz2Score(it2, st2);
  if ((sc.pending && !force) || E.saved) return false;
  record(it2.id, sc.pt === 6, "exam", "exam", { pt: sc.pt });
  S.exams = S.exams || {};
  const total = E.p1 + sc.pt, prev = S.exams[E.e.no];
  S.exams[E.e.no] = { best: Math.max(total, prev ? prev.best : 0), last: total, n: (prev ? prev.n : 0) + 1, t: Date.now(), rate: E.rate || 1 };   // 点数は速さに関係なく本番の記録・速さは残しておく
  E.saved = true; save(true);
  return true;
}

// ---------- 押したときの動き ----------
const ACT = {
  async save() { await savePack(); },
  // 保存し直す＝消さずに、1本ずつ大きさを照らして壊れたものだけ取り直す（途中で切れても、いまの保存で使い続けられる）。
  // 壊れた・切れたの判定は savePack の goodAudio（0バイト・HTML・pack.json の大きさと違う）。古い版は全部そろってから消す
  async resave() { await savePack(); },
  install() { if (installEvt) { installEvt.prompt(); installEvt = null; render(); } },
  settings() { go({ name: "settings" }); },
  back() { go({ name: TAB }); },
  home() { TAB = "home"; keepAwake(false); go({ name: "home" }); },
  accent(d) { S.settings.accent = +d.i; save(); render(); },
  today() {
    let t = pickToday();
    let left = t.ids.filter(id => !t.done.includes(id));
    if (!left.length) { S.today = null; t = pickToday(); left = t.ids; }
    startSession(left, "today", "今日の3問");
  },
  box() {
    const ids = Object.keys(S.rec).filter(id => ITEMS[id] && inBox(id)).sort((a, b) => S.rec[a].box.due.localeCompare(S.rec[b].box.due)).slice(0, 5);
    startSession(ids, "box", "苦手の箱");
  },
  kind(d) { startSession(pickKind(d.kind, d.kind === "sz2" ? 1 : 5), "practice", (KINDS.find(k => k.key === d.kind) || {}).label); },
  quit() { recordPendingSz2(); stopAudio(); keepAwake(false); go({ name: TAB }); },
  pick(d) {
    if (V.name === "exam") { const it = ITEMS[V.e.sz1[V.k]]; V.st[it.id].sel = d.m; vibe(); render(); return; }
    if (V.st.done) return; V.st.sel = d.m; vibe(); render();
  },
  async play() {
    if (isLoopView()) {   // 流し聞き・シャドーイング＝一時停止と続き
      V.paused = !V.paused;
      if (V.paused) au.pause();
      else if (V.stalled) unlockAudio();   // 鳴らせなかったあと＝押した中で解錠してから、同じ所を鳴らし直す（ループが続ける）
      else if (pending) { const p = au.play(); if (p && p.catch) p.catch(() => { if (pending) failPlay(); }); }
      mountPlayer(vPlayer()); paintPlayer();
      return;
    }
    if (!au.paused && curFile) { au.pause(); return; }   // curFile が空＝解錠の無音が鳴っているだけ（止めずに問題の音声へ）
    const it = curItem(), st = V.st;
    const file = mainFile(it);
    // 途中で止めた続き（文のタップのあとは続きではなく頭から）
    if (curFile === file && !lastSeg && au.currentTime > 0 && !au.ended && au.currentTime < (au.duration || 1e9) - 0.2) { au.play().catch(() => failPlay()); return; }
    st.plays++; render();
    await playFile(file);
  },
  async playQ() { const it = curItem(); V.st.qplays++; await playFile(it.audio.q.file); },
  back5() {   // いまの問題の音声を鳴らしているときだけ
    const it = curItem();
    if (!curFile || !Object.values(it.audio || {}).some(a => a.file === curFile)) return;
    au.currentTime = Math.max(0, au.currentTime - 5); if (au.paused) au.play().catch(() => failPlay());
  },
  rate() { rateOpen = !rateOpen; mountPlayer(vPlayer()); paintPlayer(); },
  // 速さを選ぶ＝端末に保存（次に開いても続く）・鳴っている音にもすぐ効かせる
  setRate(d) {
    const r = +d.r; if (!RATES.includes(r)) return;
    S.settings.rate = r; S.settings.rateMine = true; save(true); rateFix = 0; applyRate();
    if (hasPlayer()) { mountPlayer(vPlayer()); paintPlayer(); } else render();
  },
  flowStart() {
    const wk = Date.now() - 7 * 864e5;
    const reg = (S.flow || []).filter(id => ITEMS[id]);
    const recent = reg.filter(id => S.rec[id] && S.rec[id].last >= wk);
    const ids = recent.length ? recent : reg;
    if (!ids.length) { toast("登録したスピーチがありません"); return; }
    unlockAudio();   // 押した中で同期に（iPhone の自動再生の制限）
    go({ name: "flowPlay", ids, i: 0, round: 1, paused: false });
    runFlow();
  },
  flowJump(d) { V.i = +d.i; V.paused = false; unlockAudio(); runFlow(); mountPlayer(vPlayer()); },
  flowNext() { V.i = (V.i + 1) % V.ids.length; if (V.i === 0) V.round++; V.paused = false; unlockAudio(); runFlow(); mountPlayer(vPlayer()); },
  shadow(d) {
    if (!ITEMS[d.id]) return;
    unlockAudio();
    go({ name: "shadow", id: d.id, ids: [d.id], i: 0, k: 0, round: 1, paused: false, sents: null, phase: "prep" });
    keepAwake(true);
    runShadow();
  },
  shadowJump(d) { if (!V.sents) return; V.k = +d.k; V.paused = false; unlockAudio(); runShadow(); mountPlayer(vPlayer()); },
  shadowAgain() { if (!V.sents) return; V.paused = false; unlockAudio(); runShadow(); mountPlayer(vPlayer()); },
  loopStop() { stopAudio(); keepAwake(false); TAB = "flow"; go({ name: "flow" }); },
  async line(d) {
    const it = curItem();
    if (it.type === "sz1-pick") {
      const s = it.audio.main.segments[+d.k];
      document.querySelectorAll(".ln").forEach((b, k) => b.classList.toggle("now", k === +d.k));
      await playFile(it.audio.main.file, Math.max(0, s.start - 0.05), s.start + s.sec + 0.1);
    } else await playFile(it.audio.speech.file);
  },
  answer(d) {
    const it = curItem(), st = V.st;
    stopAudio();
    st.conf = d.c; st.done = true;
    if (it.type === "sz1-pick") {
      const ok = st.sel === it.answer; vibe(ok ? 20 : 8);
      record(it.id, ok, d.c, V.mode);
      V.results.push({ id: it.id, ok });
    } else {
      gradeSz2(it, st);
      const sc = sz2Score(it, st);
      V.results.push({ id: it.id, ok: sc.pt === 6, pt: sc.pt, pending: sc.pending });
      if (!sc.pending) { record(it.id, sc.pt === 6, d.c, V.mode, { pt: sc.pt }); st.recorded = true; }
    }
    if (V.mode === "today" && S.today && !S.today.done.includes(it.id)) { S.today.done.push(it.id); save(); }
    render();
  },
  self(d) {
    const st = V.name === "examEnd" ? V.st[ITEMS[V.e.sz2].id] : V.st;
    if (V.name === "examEnd" && V.saved) return;   // 記録したあとは変えない
    if (V.name === "q" && st.recorded) { toast("記録したあとは変えられません"); return; }
    st.self[+d.q] = d.v === "1";
    if (V.name === "examEnd") saveExam(V);   // 残りが無くなったら、その場で記録
    render();
  },
  report() { const f = fbState(); fbTake(); f.open = !f.open; render(); },   // 問題の「この問題おかしい」と「閉じる」
  fbOpen() { const f = fbState(); fbTake(); f.open = !f.open; render(); },   // 設定の「書く」と「閉じる」
  fbKind(d) {
    const kinds = V.name === "settings" ? FB_KINDS_SET : FB_KINDS_Q;
    const k = kinds[+d.k]; if (!k) return;
    fbTake(); fbState().kind = k; render();
  },
  fbSave() { if (fbMake()) { toast(FEEDBACK_URL ? TXT.fbSavedLater : TXT.fbSaved, 3500); render(); } },
  async fbGo() {
    const r = fbMake(); if (!r) return;
    render(); toast(TXT.fbSending, 1500);
    const res = await fbSend(r);
    toast(fbMsg(res), res === "ok" ? 2600 : 4500);
    if (V.name === "settings") render();
  },
  async fbAll() {
    if (fbBusy || !FEEDBACK_URL) return;
    const list = S.reports.filter(r => !r.sent); if (!list.length) return;
    fbBusy = true; render();
    let n = 0, res = "ok";
    for (const r of list) { res = await fbSend(r); if (res !== "ok") break; n++; }   // closed・limit・つながらないで止める
    fbBusy = false;
    // 途中で止まったとき：つながらない＝残りの知らせ／受付の休み・上限＝届いた件数のあとにその知らせ
    toast(res === "ok" ? `${n}件 ${TXT.fbOk}` : n && res === "fail" ? TXT.fbAllPart(n) : (n ? `${n}件 届きました。` : "") + fbMsg(res), 4500);
    if (V.name === "settings") render();
  },
  fbDel(d, el) {   // 2回押しで消す（3秒たつと戻る）
    if (el.dataset.sure !== "1") { el.dataset.sure = "1"; el.textContent = "もう一度押すと消えます"; setTimeout(() => { el.dataset.sure = ""; el.textContent = "消す"; }, 3000); return; }
    S.reports = S.reports.filter(r => r.rid !== d.rid); save(true); render();
  },
  flowReg() {
    const id = curItem().id; S.flow = S.flow || [];
    if (!S.flow.includes(id)) S.flow.push(id); save(); render();
  },
  paper(d, el) {
    S.settings.paper = el.checked; save();
    if (V.name === "q") V.st.paper = el.checked;
    render();
  },
  next() {
    recordPendingSz2();   // 自己採点のあとで記録する
    stopAudio();
    if (V.i + 1 < V.ids.length) { V.i++; V.st = freshQ(); window.scrollTo(0, 0); render(); }
    else { keepAwake(false); go({ name: "end", results: V.results }); }
  },
  exam(d) { go({ name: "examIntro", no: +d.no }); },
  examStart() {
    const e = PACK.exams.find(x => x.no === V.no);
    const st = {}; for (const id of [...e.sz1, e.sz2]) st[id] = freshQ();
    st[e.sz2].paper = !!S.settings.paper;
    unlockAudio();   // 押した中で同期に（iPhone の自動再生の制限・合図の音の AudioContext も）
    go({ name: "exam", e, st, part: 1, k: 0, paused: false, cue: "", rate: curRate() });   // 速さは始めたときの値（本番の途中では変えない）
    keepAwake(true);
    runExam();
  },
  examPause() {
    V.paused = !V.paused;
    if (V.paused) au.pause();
    else if (V.retry) unlockAudio();   // 鳴らし直しの前に、押した中で解錠し直す
    else if (pending) { const p = au.play(); if (p && p.catch) p.catch(() => { if (pending) failPlay(); }); }   // 戻せなかった＝examPlay が一時停止にして鳴らし直す
    mountPlayer(vPlayer()); paintPlayer();
  },
  examQuit(d, el) {
    if (el.dataset.sure !== "1") { el.dataset.sure = "1"; el.textContent = "本当にやめる"; setTimeout(() => { el.dataset.sure = ""; el.textContent = "やめる"; }, 3000); return; }
    examTok++; stopAudio(); keepAwake(false); go({ name: "practice" });
  },
  examGrade() { examGrade(); },
  examSave() {
    saveExam(V);
    if (!V.saved) { toast("自己採点が残っています（質問ごとに「合っていた／違っていた」を押してください）"); return; }
    TAB = "practice"; go({ name: "practice" });
  },
  export() {
    const data = JSON.stringify({ app: "eigo-listening", ver: 1, exported: new Date().toISOString(), appVer: APP_VER, pack: PACK.version,
      settings: S.settings, rec: S.rec, flow: S.flow, listen: S.listen, reports: S.reports, exams: S.exams || {} });
    let link = "";
    if (ACT.export.url) URL.revokeObjectURL(ACT.export.url);
    try { const u = ACT.export.url = URL.createObjectURL(new Blob([data], { type: "application/json" })); link =`<a class="btn sm" href="${u}" download="listening-record-${ymd()}.json" style="display:inline-grid;place-items:center;text-decoration:none">ファイルに保存</a>`; } catch (_) {}
    $("#ioBox").innerHTML = `<div class="stack"><textarea readonly id="ioTxt">${esc(data)}</textarea><div class="row">${link}<button class="btn sm" data-act="copy">コピー</button></div></div>`;
  },
  async copy() { try { await navigator.clipboard.writeText($("#ioTxt").value); toast("コピーしました"); } catch (_) { $("#ioTxt").select(); toast("選んだ状態にしました。長押しでコピーしてください"); } },
  importOpen() {
    $("#ioBox").innerHTML = `<div class="stack"><input type="file" accept="application/json,.json" id="ioFile"><textarea id="ioTxt" placeholder="書き出した中身を貼り付け"></textarea><button class="btn sm pri" data-act="importGo">読み込む（今の記録と入れ替え）</button></div>`;
    $("#ioFile").addEventListener("change", async e => { const f = e.target.files[0]; if (f) $("#ioTxt").value = await f.text(); });
  },
  importGo(d, el) {
    let x; try { x = JSON.parse($("#ioTxt").value); } catch (_) { toast("読めませんでした（JSON の形ではありません）"); return; }
    const obj = v => v != null && typeof v === "object" && !Array.isArray(v);
    if (!obj(x) || x.app !== "eigo-listening") { toast("このアプリの記録ではありません"); return; }
    if (x.ver !== 1) { toast("記録の形の版が違います（版 " + esc(x.ver) + "）"); return; }
    const bad = [["rec", obj], ["listen", obj], ["settings", obj], ["exams", obj], ["flow", Array.isArray], ["reports", Array.isArray]]
      .filter(([k, f]) => x[k] !== undefined && !f(x[k])).map(([k]) => k);
    if (!obj(x.rec) || bad.length) { toast("記録が壊れています（" + (bad.join("・") || "rec") + "）"); return; }
    if (Object.values(x.rec).some(r => !obj(r) || !Array.isArray(r.hist))) { toast("記録が壊れています（rec の中身）"); return; }
    if (el.dataset.sure !== "1") { el.dataset.sure = "1"; el.textContent = "もう一度押すと入れ替えます"; return; }
    fixOldRate(x.settings);   // 前の版で書き出した既定の 1.1 は「選んでいない」＝いまの速さを残す
    Object.assign(S, { settings: Object.assign(S.settings, x.settings || {}), rec: x.rec || {}, flow: x.flow || [], listen: x.listen || {}, reports: fbFixAll(x.reports), exams: x.exams || {}, today: null });
    save(true); toast("読み込みました"); render();
  },
};

// iPhone の自動再生の制限：練習の ▶ は play() の前に保存からの読み出し（await）を挟む＝押した操作の外と見なされうる。
// 最初に押したとき（と、鳴らせなかったあとの次の1回）に同期で解錠しておく（推定＝実機で確かめる）
let unlocked = false;
document.addEventListener("click", () => { if (!unlocked && !pending) { unlocked = true; unlockAudio(); } }, true);
document.addEventListener("click", e => {
  // 速さのバーは、右下のボタンをもう一度押すか、バーの外を押すと閉じる（外を押した操作はそのまま効かせる）
  if (rateOpen && !e.target.closest('.ratebox, [data-act="rate"]')) { rateOpen = false; mountPlayer(vPlayer()); paintPlayer(); }
  const tab = e.target.closest("[data-tab]");
  if (tab) { TAB = tab.dataset.tab; stopAudio(); go({ name: TAB }); return; }
  const el = e.target.closest("[data-act]");
  if (!el || el.disabled) return;
  const f = ACT[el.dataset.act];
  if (f && el.type !== "checkbox") { e.preventDefault(); f(el.dataset, el); }
});
document.addEventListener("change", e => {
  const el = e.target;
  if (el.matches('input[type="checkbox"][data-act]')) ACT[el.dataset.act](el.dataset, el);
  if (el.matches("input[data-rate]")) onRateInput(el, true);
});
document.addEventListener("input", e => {
  if (e.target.matches && e.target.matches("input[data-rate]")) { onRateInput(e.target, false); return; }
  if (e.target.id === "fbTxt") { fbState().text = e.target.value; return; }   // チップで描き直しても消えないように
  const el = e.target.closest("[data-in]"); if (!el) return;
  const st = V.name === "exam" ? V.st[V.e.sz2] : V.st;
  if (st) st.inputs[el.dataset.in] = el.value;
});

// ホーム画面への追加（Android の Chrome）
let installEvt = null;
window.addEventListener("beforeinstallprompt", e => { e.preventDefault(); installEvt = e; if (V.name === "home" || V.name === "settings") render(); });

// ---------- はじまり ----------
(async () => {
  applyAccent();
  render();
  if ("serviceWorker" in navigator) {
    // 新しい版の画面（SHELL の名前が変わった sw.js）が入ったら、問題や本番の途中でなければ読み込み直す。
    // 最初の1回（まだ持ち主がいない）は入れ替えではないので読み込み直さない。名前は tools\bump_shell.py が中身から決める。
    const hadController = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (!hadController || reloadPending) return;
      reloadPending = true;
      if (inQuestion()) toast("新しい版が届きました（ホームに戻ると入れ替わります）", 4000);   // 本番の結果画面も＝記録の前に読み込み直さない
      else location.reload();
    });
    try {
      const reg = await navigator.serviceWorker.register("sw.js", { updateViaCache: "none" });
      // ホーム画面のアプリは開きっぱなしで更新の確認が走りにくい＝表に戻ったときに確かめる
      document.addEventListener("visibilitychange", () => { if (!document.hidden) reg.update().catch(() => {}); });
    } catch (_) {}
  }
  try {
    await loadPack();
    render();
  } catch (e) {
    // 保存が無い・消えていた＝ネットから。それも駄目なら案内
    const el = $("#loadErr"); if (el) el.textContent = "問題を読み込めませんでした。最初の1回はネットにつないで開いてください（" + (e.message || e) + "）";
  }
  // 新しい版の確かめは後追い（保存済みなら、つながらない回線でも待たずに開く）
  await checkRemote();
  if (PACK && (V.name === "home" || V.name === "settings")) render();
})();

// 閉じる・裏に回るときに、残っている記録を書き切る（自己採点の残りは0点として）
window.addEventListener("pagehide", () => {
  try {
    if (V.name === "examEnd" && !V.saved) saveExam(V, true);
    recordPendingSz2();
  } catch (_) {}
  save(true);
});
document.addEventListener("visibilitychange", () => { if (document.hidden) save(true); });
