/* ============================================================
   Service Worker · 勤政殿 PWA
   策略：预缓存关键文件 + cache-first 静态资源 + network-first 存档 API
   版本号每次改 SW 时递增，浏览器会自动更新。
   ============================================================ */
var CACHE_NAME = 'qzd-20261118-1758';

/* 预缓存：首次安装就拉进缓存的核心文件 */
var PRECACHE_URLS = [
  './',
  './index.html',
  './manifest.json',
  './js/state.js',
  './js/config.js',
  './js/systems/idea.js',
  './js/systems/goals.js',
  './js/systems/memorials.js',
  './js/systems/meetings.js',
  './js/systems/thesis.js',
  './js/systems/chronos.js',
  './js/systems/link.js',
  './js/systems/archive.js',
  './js/systems/checkin.js',
  './js/systems/quicklinks.js',
  './js/systems/study.js',
  './js/systems/resources.js',
  './js/systems/harem.js',
  './js/systems/story.js',
  './js/systems/dynasty.js',
  './js/systems/conquest.js',
  './js/systems/tasks.js',
  './js/systems/morning.js',
  './js/systems/life.js',
  './js/systems/roster.js',
  './js/ui/render.js',
  './js/ui/portrait.js',
  './js/ui/live2d.js',
  './js/ui/pomodoro.js',
  './js/ui/heatmap.js',
  './js/ui/assets-refresh.js',
  './js/ui/pages/overview.js',
  './js/ui/pages/memorials.js',
  './js/ui/pages/goals.js',
  './js/ui/pages/thesis.js',
  './js/ui/pages/meetings.js',
  './js/ui/pages/library.js',
  './js/ui/pages/chronos.js',
  './js/ui/pages/logs.js',
  './js/ui/pages/settings.js',
  './css/base.css',
  './css/pages.css',
  './css/layout.css',
  './assets/pwa/icon-192.png',
  './assets/pwa/icon-512.png',
  './assets/icon.ico'
];

self.addEventListener('install', function(event){
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache){
      return cache.addAll(PRECACHE_URLS).catch(function(e){
        /* 有些文件可能带 ?v=N 版本号，预缓存失败不致命 */
        console.warn('[SW] precache partial fail:', e.message);
      });
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', function(event){
  event.waitUntil(
    caches.keys().then(function(keys){
      return Promise.all(
        keys.filter(function(k){ return k !== CACHE_NAME; })
            .map(function(k){ return caches.delete(k); })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', function(event){
  var req = event.request;
  var url = new URL(req.url);

  /* 只处理 http(s) 请求（跳过 chrome-extension:// 等）*/
  if(url.protocol !== 'http:' && url.protocol !== 'https:' && url.protocol !== 'file:') return;

  /* HTML 入口：network-first（保证最新 index.html），失败回缓存 */
  if(req.mode === 'navigate' || (req.headers.get('accept') || '').indexOf('text/html') >= 0){
    event.respondWith(
      fetch(req).then(function(res){
        var copy = res.clone();
        caches.open(CACHE_NAME).then(function(c){ c.put(req, copy); });
        return res;
      }).catch(function(){
        return caches.match(req).then(function(r){ return r || caches.match('./index.html'); });
      })
    );
    return;
  }

  /* 静态资源：cache-first（JS/CSS/图片一旦缓存就不重复拉）*/
  event.respondWith(
    caches.match(req).then(function(cached){
      if(cached) return cached;
      return fetch(req).then(function(res){
        /* 只缓存成功响应 */
        if(res && res.status === 200 && res.type === 'basic'){
          var copy = res.clone();
          caches.open(CACHE_NAME).then(function(c){ c.put(req, copy); });
        }
        return res;
      }).catch(function(){
        /* 离线时返回空图占位（不报错）*/
        if(url.pathname.match(/\.(png|jpg|jpeg|gif|ico|svg|mp4)$/i)){
          return new Response('', { status: 204 });
        }
      });
    })
  );
});

/* PWA 安装提示：拦截 beforeinstallprompt（留空，让浏览器自己处理）*/
self.addEventListener('message', function(event){
  if(event.data === 'SKIP_WAITING') self.skipWaiting();
});
