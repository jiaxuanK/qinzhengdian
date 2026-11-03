/* ============================================================
   ui/live2d.js · Live2D 立绘加载器（p2lrt 后端，pixi 可扩展）
   前提：游戏须通过 http(s) 打开（见 start.bat / GitHub Pages），
   因运行时需 fetch 模型与 wasm；file:// 下会被同源策略拦截。
   模型来源：用 psd2live（https://github.com/tsunehimatoi/psd2live）
   把分层 PSD 绑骨导出 .p2lrt，放入 vendor/live2d/ 并写入 consort.model。
   注意：本文件是"骨架 + 占位回退"。真实渲染需放入运行时（见 vendor/live2d/README）。
   ============================================================ */
(function(){
  var UI = QZD.ui = QZD.ui || {};
  var BACKEND = 'p2lrt';        // 'p2lrt' | 'pixi'
  var RUNTIME_READY = false;
  var instances = [];            // 已挂载实例，便于卸载，避免 WebGL 上下文泄漏

  /* 占位：运行时或模型缺失时显示，保持名册视觉不破 */
  function placeholder(container, label){
    container.innerHTML =
      '<div class="portrait-fallback" role="img" aria-label="' + (label || '立绘') + '">' +
        '<div class="pf-initial">' + ((label || '妃').slice(0, 1)) + '</div>' +
        '<div class="pf-tag">立绘待载入</div>' +
      '</div>';
  }

  /* 动态加载运行时脚本（仅一次） */
  function ensureRuntime(cb){
    if(RUNTIME_READY){ cb(true); return; }
    var src = BACKEND === 'p2lrt'
      ? 'vendor/live2d/p2lrt-player.js'
      : 'vendor/live2d/pixi-live2d-display.js';
    var s = document.createElement('script');
    s.src = src;
    s.onload = function(){ RUNTIME_READY = true; cb(true); };
    s.onerror = function(){
      console.warn('[live2d] 运行时未找到：' + src + ' —— 见 vendor/live2d/README.md');
      cb(false);
    };
    document.head.appendChild(s);
  }

  /* 真正挂载（后端相关；失败时回退占位） */
  function mountBackend(container, modelPath, done){
    try{
      if(BACKEND === 'p2lrt' && window.P2L){
        /* p2lrt 网页播放器约定全局：window.P2L.create(container, modelUrl) */
        var inst = window.P2L.create(container, modelPath);
        if(inst){ instances.push(inst); done(inst); return; }
      }
      /* 其他后端（pixi）在此扩展 */
      done(null);
    }catch(err){
      console.warn('[live2d] 加载失败，回退占位：', err);
      done(null);
    }
  }

  QZD.live2d = {
    /* 入口：名册页 mount 钩子对每个 [data-l2d] 调用 */
    mount: function(container, opts){
      opts = opts || {};
      var model = opts.model;
      var label = opts.label || '';
      if(!model){ placeholder(container, label); return null; }

      ensureRuntime(function(ok){
        if(!ok){ placeholder(container, label); return; }
        mountBackend(container, model, function(inst){
          if(!inst){ placeholder(container, label); }
        });
      });
      return null;
    },
    /* 名册重渲染前清理旧实例，避免 WebGL 上下文泄漏 */
    unmountAll: function(){
      for(var i = 0; i < instances.length; i++){
        try{ if(instances[i] && instances[i].destroy) instances[i].destroy(); }catch(e){}
      }
      instances = [];
    }
  };
})();
