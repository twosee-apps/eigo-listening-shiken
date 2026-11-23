// 英語リスニング 本体の Service Worker（04_試作\再生試作\sw.js の作りを引き継いだ）。
// - 画面のファイルは入れたときに保存（eigo-shell-<版>）。問題パックはアプリの「保存する」で eigo-pack-<パック>-<版> に入れる。
//   頭の eigo- ＝GitHub Pages の同じオリジンのほかのアプリ（再生試験の shell-v3 など）と消し合わない。
// - 保存した音声に Range 要求が来たら、保存した全体から切り出して 206 で返す（iPhone の Safari 対策）。
//   ふだんの再生はアプリが保存から Blob を作って流す（app.js の audioUrl）。206 はその手前の受け皿。
// - packs/index.json だけはネットを先に見る（新しい版に気づくため）。つながらなければ保存から。
const SHELL = "eigo-shell-8c0da07f7c";
const SHELL_FILES = ["./", "index.html", "app.css", "app.js", "manifest.webmanifest", "icon-192.png", "icon-512.png"];

self.addEventListener("install", e => {
  // ブラウザの HTTP キャッシュを通さずに取る（古い app.css を新しい版の名前で保存してしまわない）
  e.waitUntil((async () => {
    const c = await caches.open(SHELL);
    await c.addAll(SHELL_FILES.map(u => new Request(u, { cache: "reload" })));
    // 配信側がまだ古い app.js を返している（公開の直後）＝新しい名前で古い中身を保存しない。入れるのをやめ、次の確かめで入れ直す
    const js = await (await c.match("app.js")).text();
    if (!js.includes(`const APP_VER = "${SHELL.slice("eigo-shell-".length)}";`)) { await caches.delete(SHELL); throw new Error("app.js の版が SHELL と合わない"); }
    await self.skipWaiting();
  })());
});
self.addEventListener("activate", e => e.waitUntil((async () => {
  for (const k of await caches.keys()) if (k.startsWith("eigo-shell-") && k !== SHELL) await caches.delete(k);
  await self.clients.claim();
})()));

// 単一範囲だけを受ける（RFC 9110 §14.1.2）。合わない書式は null＝全体を 200 で返す。
function parseRange(h, size) {
  const m = /^bytes=(\d*)-(\d*)$/i.exec((h || "").trim());
  if (!m || (m[1] === "" && m[2] === "")) return null;
  let start, end;
  if (m[1] === "") {
    const n = parseInt(m[2], 10);
    if (n === 0) return { bad: true };
    start = Math.max(0, size - n); end = size - 1;
  } else {
    start = parseInt(m[1], 10);
    end = m[2] === "" ? size - 1 : Math.min(parseInt(m[2], 10), size - 1);
    if (m[2] !== "" && parseInt(m[2], 10) < start) return null;
  }
  if (start >= size) return { bad: true };
  return { start, end };
}

async function cachedAudio(req, cached) {
  const blob = await cached.blob();
  const size = blob.size;
  const type = cached.headers.get("Content-Type") || "audio/mp4";
  const head = req.method === "HEAD";
  const h = req.headers.get("range");
  const r = h ? parseRange(h, size) : null;
  if (!r) return new Response(head ? null : blob, { status: 200, headers: { "Content-Type": type, "Content-Length": String(size), "Accept-Ranges": "bytes" } });
  if (r.bad) return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
  return new Response(head ? null : blob.slice(r.start, r.end + 1, type), {
    status: 206,
    headers: { "Content-Type": type, "Content-Range": `bytes ${r.start}-${r.end}/${size}`, "Content-Length": String(r.end - r.start + 1), "Accept-Ranges": "bytes" },
  });
}

self.addEventListener("message", e => { if (e.data === "ping") e.source && e.source.postMessage({ sw: SHELL }); });

// 問題パックは「保存が済んだ印（packs/index.json）があるキャッシュ」だけから探す。
// 新しい版の保存の途中（古い版と途中の版が並ぶ）でも、途中の版を掴まない。済んだものが2つあれば新しいほう（後ろ）。
async function packMatch(url) {
  const names = (await caches.keys()).filter(k => k.startsWith("eigo-pack-")).reverse();
  for (const n of names) {
    const c = await caches.open(n);
    if (!(await c.match(self.location.origin + new URL("packs/index.json", self.registration.scope).pathname))) continue;
    const hit = await c.match(url);
    if (hit) return hit;
  }
  return null;
}

self.addEventListener("fetch", e => {
  const req = e.request;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (req.method !== "GET" && req.method !== "HEAD") return;
  if (req.method === "HEAD" && !url.pathname.endsWith(".m4a")) return;
  e.respondWith((async () => {
    if (url.searchParams.has("fresh")) return fetch(req, { cache: "reload" });   // 保存し直しは保存を通さない
    const key = url.origin + url.pathname;
    if (url.pathname.includes("/packs/")) {
      if (url.pathname.endsWith(".m4a")) {
        const hit = await packMatch(key);
        return hit ? cachedAudio(req, hit) : fetch(req);
      }
      // index.json と pack.json はネットが先（新しい版に気づく）・つながらなければ済んだ保存から
      try { const r = await fetch(req, { cache: "no-store" }); if (r.ok) return r; } catch (_) {}
      return (await packMatch(key)) || Response.error();
    }
    // 画面のファイルは、いまの版の SHELL からだけ（ほかの版の写しを掴まない）
    const hit = await (await caches.open(SHELL)).match(req, { ignoreSearch: true });
    return hit || fetch(req);
  })());
});
