/* ============================================================
   ui/render.js · 统一渲染入口
   读 state → 刷 DOM；导航、页头、页面路由、弹窗、toast 都在这里
   ============================================================ */
(function(){
  var CFG = QZD.config;
  var UI = QZD.ui = QZD.ui || {};

  var pages = {};     /* id → 渲染函数，返回 HTML 字符串 */
  var hooks = {};     /* id → 挂载后回调（需要时再绑事件） */
  var groups = {};    /* 分组 id → [{id,name}] 页内标签 */
  var groupOf = {};   /* 子页 id → 所属分组 id */
  var groupTab = {};  /* 分组 id → 当前子页 id */
  var current = 'overview';

  UI.register = function(id, renderFn, mountFn){
    pages[id] = renderFn;
    if(mountFn) hooks[id] = mountFn;
  };

  /* 注册分组页：一个一级入口 + 若干页内标签（子页仍需各自 register） */
  UI.registerGroup = function(gid, tabs, defTab){
    if(!tabs || !tabs.length) return;
    groups[gid] = tabs;
    tabs.forEach(function(t){ groupOf[t.id] = gid; });
    if(!groupTab[gid]) groupTab[gid] = defTab || tabs[0].id;
    pages[gid] = function(){
      var cur = groupTab[gid];
      var bar = '<div class="tab-row wrap page-tabs">' + tabs.map(function(t){
        return '<button class="tab' + (t.id === cur ? ' active' : '') +
          '" data-gtab="' + t.id + '">' + t.name + '</button>';
      }).join('') + '</div>';
      var fn = pages[cur];
      return bar + (fn ? fn() : '<div class="empty">页面不存在</div>');
    };
  };

  function currentKey(){
    return groups[current] ? groupTab[current] : current;
  }

  UI.fmt = {
    /* 资源内部浮点，展示时取整；1e-9 抵消逐秒累加的浮点误差 */
    num: function(n){ return Math.floor((n || 0) + 1e-9).toLocaleString('en-US'); },
    time: function(ts){
      if(!ts) return '—';
      var d = new Date(ts);
      return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) +
             ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
    },
    escape: function(str){
      return String(str == null ? '' : str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    }
  };

  function pad(n){ return n < 10 ? '0' + n : '' + n; }

  function navName(id){
    for(var i = 0; i < CFG.NAV.length; i++){
      if(CFG.NAV[i].id === id) return CFG.NAV[i].name;
    }
    return '';
  }

  /* ---------- 页头：标题 + 四维 + 存储告警 ---------- */
  UI.refreshHeader = function(){
    var s = QZD.state;
    var title = document.getElementById('page-title');
    if(title) title.textContent = navName(current);
    var dims = document.getElementById('dims');
    if(dims){
      dims.innerHTML = CFG.DIMENSIONS.map(function(d){
        return '<span class="dim">' + d.name + ' Lv.' + (s.emperor[d.key] || 0) + '</span>';
      }).join('');
    }
    var warn = document.getElementById('storage-warn');
    if(warn) warn.classList.toggle('show', QZD.stateIO.backend() !== 'local');
  };

  /* ---------- 导航 ---------- */
  function buildNav(){
    var nav = document.getElementById('nav');
    nav.innerHTML = CFG.NAV.map(function(item){
      return '<button class="nav-item" data-page="' + item.id + '">' + item.name + '</button>';
    }).join('');
    nav.addEventListener('click', function(e){
      var btn = e.target.closest('[data-page]');
      if(btn) UI.show(btn.getAttribute('data-page'));
    });
  }

  function markActive(){
    var items = document.querySelectorAll('.nav-item');
    for(var i = 0; i < items.length; i++){
      items[i].classList.toggle('active', items[i].getAttribute('data-page') === current);
    }
  }

  /* ---------- 页面路由 ---------- */
  /* 旧链接兼容：御案奏折 → 今日勤政；属地贡赋 → 宏图征伐 */
  var PAGE_ALIAS = { memorials: 'tasks', fiefs: 'conquest' };

  UI.show = function(id){
    if(PAGE_ALIAS[id]) id = PAGE_ALIAS[id];
    /* 子页 → 先切到所属分组的对应标签 */
    if(groupOf[id]){
      var g = groupOf[id];
      groupTab[g] = id;
      id = g;
    }
    if(!pages[id]) id = 'overview';
    current = id;
    var want = '#' + id + (groups[id] ? '/' + groupTab[id] : '');
    if(location.hash !== want) location.hash = want;
    markActive();
    UI.refreshHeader();
    UI.renderPage();
    if(UI.pomo) UI.pomo.render();
  };

  UI.renderPage = function(){
    var root = document.getElementById('page-root');
    var fn = pages[current];
    var html = fn ? fn() : '<div class="empty">页面不存在</div>';
    if(!root) return;
    root.innerHTML = html;
    var key = currentKey();
    if(hooks[current]) hooks[current](root);
    else if(key !== current && hooks[key]) hooks[key](root);
  };

  UI.current = function(){ return current; };
  UI.currentTab = currentKey;
  UI.page = function(id){ return pages[id] || null; };

  UI.onStateChanged = function(){
    UI.refreshHeader();
    UI.renderPage();
    if(UI.pomo) UI.pomo.render();
  };

  /* 轻量刷帧：只更新真正每秒变化的内容，不重建整页。
     注意：roster 内含 Live2D 画布，若每秒 innerHTML 重建会销毁 WebGL 上下文；
     tasks 页含输入框与奏折列表，重建会清空正在输入的内容 —— 两者都禁止整页重绘 */
  UI.refreshLive = function(){
    var focusing = QZD.pomodoro && QZD.pomodoro.isActive();
    if(current === 'overview'){
      /* 总览只局部更新数字，绝不重建 DOM（避免立绘闪烁） */
      if(QZD.overview && QZD.overview.tick) QZD.overview.tick();
    }else if(current === 'tasks' && QZD.tasks && QZD.tasks.tick){
      /* 今日勤政页含输入框与奏折列表：只更新数字，绝不重建 DOM */
      QZD.tasks.tick();
    }
    if(UI.pomo) UI.pomo.render();
  };

  function parseTarget(){
    var raw = location.hash.replace(/^#/, '') || 'overview';
    var seg = raw.split('/');
    return seg[1] || seg[0] || 'overview';
  }

  UI.init = function(){
    /* 注册分组页：必须等所有子页 register 完（main.js 最后执行） */
    (CFG.GROUPS || []).forEach(function(g){
      UI.registerGroup(g.id, g.tabs, g.tabs && g.tabs[0] && g.tabs[0].id);
    });
    buildNav();
    /* 页面内跳转：data-goto 跳页面，data-gtab 切分组标签 */
    document.addEventListener('click', function(e){
      var btn = e.target.closest('[data-goto]');
      if(btn){ UI.show(btn.getAttribute('data-goto')); return; }
      var tab = e.target.closest('[data-gtab]');
      if(tab) UI.show(tab.getAttribute('data-gtab'));
    });
    window.addEventListener('hashchange', function(){
      UI.show(parseTarget());
    });
    UI.show(parseTarget());
  };

  /* ---------- 弹窗 ---------- */
  UI.modal = function(opts){
    opts = opts || {};
    var mask = document.createElement('div');
    mask.className = 'modal-mask';

    var foot = opts.ok
      ? '<button class="btn ghost" data-modal-cancel>' + (opts.cancelText || '取消') + '</button>' +
        '<button class="btn primary" data-modal-ok>' + (opts.okText || '确定') + '</button>'
      : '<button class="btn ghost" data-modal-cancel>关闭</button>';

    mask.innerHTML =
      '<div class="dialog" role="dialog">' +
        '<h3 class="dialog-title">' + (opts.title || '') + '</h3>' +
        '<div class="dialog-body">' + (opts.body || '') + '</div>' +
        '<div class="dialog-foot">' + foot + '</div>' +
      '</div>';

    document.getElementById('modal-root').appendChild(mask);

    function close(){
      if(mask.parentNode) mask.parentNode.removeChild(mask);
    }
    function cancel(){
      close();
      if(opts.onCancel) opts.onCancel();
    }

    mask.addEventListener('click', function(e){
      if(e.target === mask) cancel();
      else if(e.target.closest('[data-modal-cancel]')) cancel();
      else if(e.target.closest('[data-modal-ok]')){
        /* onOk 返回 false 表示校验未过，弹窗保持打开 */
        var keep = false;
        if(opts.onOk) keep = opts.onOk(mask) === false;
        if(!keep) close();
      }
    });

    return { close: close, root: mask };
  };

  UI.confirm = function(text, onOk, opts){
    opts = opts || {};
    UI.modal({
      title: opts.title || '请确认',
      body: text,
      ok: true,
      okText: opts.okText || '确定',
      onOk: onOk,
      onCancel: opts.onCancel
    });
  };

  /* ---------- toast ---------- */
  UI.toast = function(text){
    var host = document.getElementById('toast-root');
    var el = document.createElement('div');
    el.className = 'toast';
    el.textContent = text;
    host.appendChild(el);
    setTimeout(function(){ el.classList.add('out'); }, 1800);
    setTimeout(function(){ if(el.parentNode) el.parentNode.removeChild(el); }, 2200);
  };

  /* ---------- 昭幸大屏：大立绘（上）+ 性格对话（下）+ 双进度条 ---------- */
  UI.favorScreen = function(consort, dlg){
    if(!dlg || !consort) return;
    var mask = document.createElement('div');
    mask.className = 'favor-mask';
    var portraitHtml = consort.video
      ? QZD.portrait.video(consort.video, consort.name)
      : QZD.portrait.svg(consort.id, consort.name,
          { kind: 'female', img: consort.img, model: consort.model });
    var hasPoses = Array.isArray(consort.poses) && consort.poses.length > 1;
    var poseHtml = '';
    if(hasPoses){
      poseHtml = '<div class="favor-poses">' + consort.poses.map(function(p, i){
        return '<button class="pose-dot' + (i === (consort.poseIndex || 0) ? ' active' : '') +
          '" data-pose="' + i + '" title="姿态 ' + (i + 1) + '"></button>';
      }).join('') + '</div>';
    }

    mask.innerHTML =
      '<div class="favor-screen" role="dialog" aria-modal="true">' +
        '<div class="favor-portrait" data-favor-portrait title="' +
          (hasPoses ? '轻点立绘，抖一下换个姿态' : '轻点立绘，换一句') + '">' +
          '<div class="favor-pic">' + portraitHtml + '</div>' +
          '<div class="favor-scrim"></div>' +
          poseHtml +
          '<div class="favor-overlay">' +
            '<div class="favor-bubble-wrap">' +
              '<div class="favor-bubble"><span class="favor-say-name">' +
                UI.fmt.escape(consort.name) + '：</span>' +
                '<span data-favor-bubble></span></div>' +
            '</div>' +
          '</div>' +
        '</div>' +
        '<button class="favor-close" aria-label="关闭" title="关闭">×</button>' +
      '</div>';

    /* 打字机：逐字显示台词 */
    function typeInto(el, text, speed){
      if(!el) return;
      if(el.__typer) clearInterval(el.__typer);
      el.textContent = '';
      var i = 0;
      el.__typer = setInterval(function(){
        i++;
        el.textContent = text.slice(0, i);
        if(i >= text.length){ clearInterval(el.__typer); el.__typer = null; }
      }, speed || 30);
    }
    /* 点击立绘：抖一下；抖完执行 done（多姿态切换用） */
    function shake(done){
      var pic = mask.querySelector('.favor-pic');
      if(!pic){ if(done) done(); return; }
      if(pic.__shaking) return;          /* 抖动未结束时不重复触发 */
      pic.__shaking = true;
      pic.classList.remove('shake');
      void pic.offsetWidth;
      pic.classList.add('shake');
      pic.addEventListener('animationend', function handler(){
        pic.classList.remove('shake');
        pic.__shaking = false;
        pic.removeEventListener('animationend', handler);
        if(done) done();
      });
    }

    /* 应用某个姿态：换图 + 同步圆点 */
    function applyPose(pc){
      if(!pc) return;
      consort.img = pc.img;
      consort.poseIndex = pc.poseIndex;
      var imgEl = mask.querySelector('.favor-pic img');
      if(imgEl) imgEl.src = pc.img;
      /* 新图再缩放抖动一下 */
      var pic = mask.querySelector('.favor-pic');
      if(pic){
        pic.classList.remove('pose-shake');
        void pic.offsetWidth;
        pic.classList.add('pose-shake');
        pic.addEventListener('animationend', function h(){
          pic.classList.remove('pose-shake');
          pic.removeEventListener('animationend', h);
        });
      }
      var ds = mask.querySelectorAll('[data-pose]');
      for(var i = 0; i < ds.length; i++){
        ds[i].classList.toggle('active',
          Number(ds[i].getAttribute('data-pose')) === pc.poseIndex);
      }
    }

    typeInto(mask.querySelector('[data-favor-bubble]'), dlg.text, 28);

    /* 换一句：重抽同层级台词 + 抖动 + 重新打字 */
    function regreet(){
      if(!QZD.harem.buildDialogue) return;
      var nd = QZD.harem.buildDialogue(consort, !!dlg.pregnant);
      typeInto(mask.querySelector('[data-favor-bubble]'), nd.text, 28);
      shake();
    }

    mask.addEventListener('click', function(e){
      if(e.target === mask || e.target.closest('.favor-close') || e.target.closest('[data-favor-close]')){
        var bb = mask.querySelector('[data-favor-bubble]');
        if(bb && bb.__typer) clearInterval(bb.__typer);
        if(mask.parentNode) mask.parentNode.removeChild(mask);
        return;
      }
      /* 顶部圆点：直接跳到指定姿态 */
      var poseBtn = e.target.closest('[data-pose]');
      if(poseBtn){
        applyPose(QZD.harem.setPose(consort.id, Number(poseBtn.getAttribute('data-pose'))));
        return;
      }

      /* 点击立绘：先抖动；多姿态则抖完换下一张，否则换一句台词 */
      if(e.target.closest('[data-favor-portrait]') && !e.target.closest('.favor-overlay')){
        if(hasPoses){
          shake(function(){ applyPose(QZD.harem.cyclePose(consort.id)); });
        }else{
          regreet();
        }
      }
    });
    document.getElementById('modal-root').appendChild(mask);
  };
})();
