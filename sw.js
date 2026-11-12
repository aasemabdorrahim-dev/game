/* صراع الأرض - عامل الخدمة للعمل بدون إنترنت.
   ضع هذا الملف بجانب ملف اللعبة في نفس المجلد وبنفس الاسم: sw.js */
const CACHE = "saraa-alard-v1";
const PEER = [
  "https://cdn.jsdelivr.net/npm/peerjs@1.5.4/dist/peerjs.min.js",
  "https://unpkg.com/peerjs@1.5.4/dist/peerjs.min.js"
];

self.addEventListener("install", () => { self.skipWaiting(); });

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

async function save(url, mode) {
  const res = await fetch(new Request(url, { mode: mode, cache: "reload" }));
  if (res && (res.ok || res.type === "opaque")) {
    const c = await caches.open(CACHE);
    await c.put(url, res.clone());
  }
}

/* الصفحة تطلب حفظ نفسها ومكتبة الاتصال بعد أول فتح */
self.addEventListener("message", e => {
  const d = e.data || {};
  if (d.t === "precache" && d.page) {
    e.waitUntil(Promise.all([
      save(d.page, "same-origin").catch(() => {}),
      save(PEER[0], "no-cors").catch(() => {})
    ]));
  }
});

function withTimeout(p, ms) {
  return new Promise((ok, no) => {
    const t = setTimeout(() => no(new Error("timeout")), ms);
    p.then(v => { clearTimeout(t); ok(v); }, er => { clearTimeout(t); no(er); });
  });
}

/* الشبكة أولاً (لتصلك التحديثات)، وعند انقطاع الإنترنت تُفتح النسخة المحفوظة */
self.addEventListener("fetch", e => {
  const r = e.request;
  if (r.method !== "GET") return;
  const u = new URL(r.url);
  const isPage = r.mode === "navigate" && u.origin === self.location.origin;
  const isPeer = PEER.indexOf(r.url) >= 0;
  if (!isPage && !isPeer) return;
  const key = isPage ? u.origin + u.pathname : r.url;
  e.respondWith((async () => {
    try {
      const res = await withTimeout(fetch(r), isPage ? 4000 : 6000);
      if (res && (res.ok || res.type === "opaque")) {
        const c = await caches.open(CACHE);
        c.put(key, res.clone());
      }
      return res;
    } catch (err) {
      const c = await caches.open(CACHE);
      const hit = (await c.match(key)) || (isPeer ? await c.match(PEER[0]) : null);
      return hit || Response.error();
    }
  })());
});
