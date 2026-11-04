/* ============================================================
   sw.js · 勤政殿 PWA Service Worker
   ------------------------------------------------------------
   目标：把「勤政殿」装到手机桌面后，没网也能打开。
   策略：
     1) 导航请求（index.html / float.html）：network-first，
        优先拿线上最新版本；离线时回退到缓存的壳。
     2) 静态资源（js/css/图片）：stale-while-revalidate，
        先用缓存秒开，后台悄悄更新。
   注意：缓存是「加速 + 离线兜底」，不是唯一数据源；
        游戏存档在 localStorage，由浏览器持久化，与本 SW 无关。
   ============================================================ */

const VERSION = 'qzd-20261104-2205';
const SHELL_CACHE = `qzd-shell-${VERSION}`;
const ASSET_CACHE = `qzd-asset-${VERSION}`;

/* 应用外壳：离线时至少要有这些 */
const SHELL = [
  './',
  './index.html',
  './float.html',
  './manifest.webmanifest',
  './css/base.css',
  './css/layout.css',
  './css/pages.css',
  './assets/pwa/icon-192.png',
  './assets/pwa/icon-512.png',
  './assets/pwa/apple-touch-icon.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(SHELL_CACHE)
      /* 单个资源失败不应让整个安装失败 */
      .then((c) => Promise.allSettled(SHELL.map((u) => c.add(u))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => k !== SHELL_CACHE && k !== ASSET_CACHE)
            .map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

function isNavigation(req) {
  return req.mode === 'navigate'
      || (req.headers.get('accept') || '').includes('text/html');
}

self.addEventListener('fetch', (e) => {
  const req = e.request;

  /* 只处理 GET；POST 等直接放行 */
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;   /* 外链不拦 */

  /* ---- 导航：network-first，离线回退缓存 ---- */
  if (isNavigation(req)) {
    e.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(SHELL_CACHE).then((c) => c.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req)
          .then((hit) => hit || caches.match('./index.html'))
        )
    );
    return;
  }

  /* ---- 静态资源：stale-while-revalidate ---- */
  e.respondWith(
    caches.match(req).then((hit) => {
      const net = fetch(req)
        .then((res) => {
          if (res && res.status === 200 && res.type === 'basic') {
            const copy = res.clone();
            caches.open(ASSET_CACHE).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => hit);           /* 离线且没缓存 -> 交给浏览器报错 */
      return hit || net;
    })
  );
});
