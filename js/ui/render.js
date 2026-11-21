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
          '" data-gtab="' + t.id + '">' +
          (t.icon ? '<span class="tab-icon">' + t.icon + '</span>' : '') +
          '<span>' + t.name + '</span></button>';
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

  /* ---------- 页头：标题 + 存储告警（帝王面板已固定，由 buildTopbar 管理） ---------- */
  UI.refreshHeader = function(){
    var title = document.getElementById('page-title');
    if(title) title.textContent = navName(current);
    var warn = document.getElementById('storage-warn');
    if(warn) warn.classList.toggle('show', QZD.stateIO.backend() !== 'local');
  };

  /* ---------- 导航 ---------- */
  function buildNav(){
    var nav = document.getElementById('nav');
    nav.innerHTML = CFG.NAV.map(function(item){
      return '<button class="nav-item" data-page="' + item.id + '">' +
        (item.icon ? '<span class="nav-icon">' + item.icon + '</span>' : '') +
        '<span>' + item.name + '</span></button>';
    }).join('');
    nav.addEventListener('click', function(e){
      var btn = e.target.closest('[data-page]');
      if(btn) UI.show(btn.getAttribute('data-page'));
    });
  }

  /* ---------- 固定顶栏：帝王面板（每页可见） ---------- */
  function buildTopbar(){
    var dims = document.getElementById('dims');
    if(!dims) return;
    try {
      if(QZD.ui._emperorPanel){
        dims.innerHTML = QZD.ui._emperorPanel(QZD.state);
      }
    } catch(e){ console.error('buildTopbar error:', e); }
  }
  function refreshTopbar(){
    /* 只更新资源数字，不重建 DOM；值没变则完全不触碰（省 CPU）。
       11-19 移除数字滚动：赚钱路径(overview.tick)本就绕过它、基本不生效，
       且每 2s 小幅跳动滚动反而晃眼，回归直接赋值。 */
    var s = QZD.state;
    CFG.RESOURCES.forEach(function(r){
      var el = document.getElementById('ov-res-' + r.key);
      var v = UI.fmt.num(s.resources[r.key]);
      if(el && el.textContent !== v) el.textContent = v;
    });
  }

  function markActive(){
    var items = document.querySelectorAll('.nav-item');
    for(var i = 0; i < items.length; i++){
      items[i].classList.toggle('active', items[i].getAttribute('data-page') === current);
    }
  }

  /* ---------- 页面路由 ---------- */
  /* 旧链接兼容：属地贡赋 → 宏图征伐 */
  var PAGE_ALIAS = { fiefs: 'conquest' };

  /* 检测是否在 PWA standalone 模式（桌面 Chrome 独立窗口 / iOS PWA）
     Chrome standalone PWA 里 location.hash = ... 有时会触发 Chrome 把 standalone
     session 切回浏览器 tab——所以 standalone 模式下跳过 hash 写入，只用内部 state。*/
  var IS_STANDALONE = (function(){
    try {
      if(window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) return true;
      if(window.navigator && window.navigator.standalone === true) return true; /* iOS */
    } catch(e){}
    return false;
  })();

  UI.show = function(id){
    if(PAGE_ALIAS[id]) id = PAGE_ALIAS[id];
    /* 子页 → 先切到所属分组的对应标签 */
    if(groupOf[id]){
      var g = groupOf[id];
      groupTab[g] = id;
      id = g;
    }
    if(!pages[id]) id = 'summary';
    current = id;
    var want = '#' + id + (groups[id] ? '/' + groupTab[id] : '');
    /* standalone 模式下跳过 hash（Chrome 会错误地开浏览器 tab）；
       但浏览器正文中允许写 hash（后退按钮 / 分享链接）*/
    if(!IS_STANDALONE && location.hash !== want) location.hash = want;
    markActive();
    UI.refreshHeader();
    UI.renderPage();
    if(UI.pomo) UI.pomo.render();
  };

  /* 11-19 省内存：立绘呼吸动画只在进入视口时播放（合成层按需创建）。
     单例观察器；无 IntersectionObserver 时给全部立绘补 .in-view 退化为原行为。 */
  var portraitObserver = null;
  function watchPortraits(root){
    var nodes = root.querySelectorAll('.portrait-svg, .portrait-fallback');
    if(!nodes.length) return;
    if(typeof IntersectionObserver === 'undefined'){
      for(var i = 0; i < nodes.length; i++) nodes[i].classList.add('in-view');
      return;
    }
    if(!portraitObserver){
      portraitObserver = new IntersectionObserver(function(entries){
        entries.forEach(function(en){
          en.target.classList.toggle('in-view', en.isIntersecting);
        });
      }, { rootMargin: '80px' });   /* 提前 80px 预热，滚动时不闪 */
    }
    for(var j = 0; j < nodes.length; j++) portraitObserver.observe(nodes[j]);
  }

  /* 11-21 图标体系：给卡片标题自动配图，位于 :before 竖标之后、文字之前。
     按「去空格标题」查表，命中即插入图标 span；不影响布局（竖标与文字间距已预留）。 */
  var TITLE_ICONS = {
    '今日治学':'📖', '江山':'🏯', '国势':'🏯', '批阅中的奏折':'📋', '今日行动':'⚡',
    '本周进度':'📊', '速记进展':'✍️', '科研台账':'🗂️', '便捷门':'🔗',
    '今日概览':'📊', '习惯打卡':'✅', '打卡热力图':'🔥', '本周三事':'🎯',
    '科研成就':'🏆', '期限':'⏰', '期限前瞻·日历':'📅', '歇一歇':'☕',
    '进行中的奏折':'📋', '近7天专注':'⏱️',
    '名册':'👥', '科举':'🏛️', '待录人才':'📥', '在朝名臣':'🎓', '后宫':'🌸',
    '选秀':'🎀', '在宫妃嫔':'🌺', '已致仕宗室':'👴', '皇子':'👶',
    '课题管理':'📚', '本周星盘':'✨', '周内进度带':'📈', '专注趋势':'📉',
    '勤政画像':'🛡️', '本周目标':'🎯', '计划vs实际':'⚖️', '中断原因':'⚠️',
    '深度与碎片':'🧩', '中断时段':'⏳', '帝王四维成长':'📈', '本周日程网格':'🗓️',
    '议事厅':'💬', '待办总览':'📝', '历次组会':'🗃️',
    '灵感罐':'💡', '落笔':'✒️',
    '文渊阁':'📚', '今日精读':'📖',
    '营造概览':'🔨', '工程营造':'🏗️',
    '期限前瞻':'📅', '畅想所':'🧠', '杂学':'📌', '珍宝阁':'💎',
    '征服':'⚔️', '属地':'🗺️', '征伐':'⚔️', '营造':'🔨', '珍宝':'💎', '起居':'📜',
    '数据导出':'📤', '完整存档':'💾', '今日时间轴':'🕐', '科研投入结构':'📊',
    '效率时段分析':'⏱️', '批语':'✍️', '周几×时辰':'🗓️', '单场时长分布':'⏳',
    '兵势':'⚔️', '贡赋':'💰', '已归版图':'🗺️', '归档起居注':'📜',
    '帝王设置':'⚙️', '存档信息':'💾', '自动备份':'🔄', '立绘素材':'🖼️',
    '测试工具':'🔧', '历代年表':'📜', '立书':'📖', '货架':'🛒', '我的珍藏':'💎'
  };
  /* 关键词兜底：标题含这些词时配图（顺序即优先级） */
  var TITLE_HINTS = [
    ['奏折','📋'], ['专注','⏱️'], ['打卡','✅'], ['日历','📅'], ['趋势','📈'],
    ['目标','🎯'], ['灵感','💡'], ['文献','📖'], ['精读','📖'], ['组会','💬'],
    ['方向','🗺️'], ['热区','🔥'], ['热力','🔥'], ['大计','🎯'], ['课题','📚']
  ];
  function decorateTitles(root){
    if(!root || !root.querySelectorAll) return;
    var nodes = root.querySelectorAll('.card-title');
    for(var i = 0; i < nodes.length; i++){
      var el = nodes[i];
      if(el.getAttribute('data-ico')) continue;               /* 已装饰 */
      var raw = (el.textContent || '').trim();
      var key = raw.replace(/\s+/g, '');
      var icon = TITLE_ICONS[key];
      if(!icon){
        for(var j = 0; j < TITLE_HINTS.length; j++){
          if(key.indexOf(TITLE_HINTS[j][0]) >= 0){ icon = TITLE_HINTS[j][1]; break; }
        }
      }
      if(!icon) continue;
      el.setAttribute('data-ico', '1');
      var span = document.createElement('span');
      span.className = 'title-ico';
      span.textContent = icon;
      /* 插到第一个文本节点前（:before 竖标由 CSS 生成，不受影响） */
      el.insertBefore(span, el.firstChild);
    }
  }

  /* 11-21 按钮图标：仅对明确的高频动作词加图标，保守 lists 避免满屏 emoji。
     只装饰纯文字按钮（含空格的中文短语），已有图标的不动。 */
  var BTN_ICONS = [
    ['新建奏折','📝'], ['立奏折','📝'], ['编辑','✏️'], ['删除','🗑️'], ['移除','✕'],
    ['继续专注','▶️'], ['开始专注','▶️'], ['办结','✓'], ['记一句','✍️'],
    ['保存','💾'], ['取消','↩️'], ['确认','✓'], ['详情','🔍'], ['购买','🛒'],
    ['采纳为下周三事','✅'], ['记录组会','💬'], ['读完了','📖'], ['设为今日','📌']
  ];
  function decorateButtons(root){
    if(!root || !root.querySelectorAll) return;
    var btns = root.querySelectorAll('button');
    for(var i = 0; i < btns.length; i++){
      var el = btns[i];
      if(el.getAttribute('data-ico')) continue;
      var raw = (el.textContent || '').trim();
      var key = raw.replace(/\s+/g, '');
      if(/[^\u4e00-\u9fa5]/.test(key)) continue;   /* 只处理纯中文按钮，跳过已带符号/emoji的 */
      var icon = null;
      for(var j = 0; j < BTN_ICONS.length; j++){
        if(key === BTN_ICONS[j][0]){ icon = BTN_ICONS[j][1]; break; }
      }
      if(!icon) continue;
      el.setAttribute('data-ico', '1');
      var span = document.createElement('span');
      span.className = 'btn-ico';
      span.textContent = icon;
      el.insertBefore(span, el.firstChild);
    }
  }

  UI.renderPage = function(){
    var root = document.getElementById('page-root');
    var fn = pages[current];
    try {
      var html = fn ? fn() : '<div class="empty">页面不存在</div>';
    } catch(e){
      console.error('[renderPage]', current, '->', currentKey(), e);
      var html = '<div class="empty">渲染出错：' + (e && e.message || e) + '</div>';
    }
    if(!root) return;
    /* 11-19 场景横幅：三个一级页面顶部各一条（金銮殿/御书房/舆图），
       金銮殿随时辰换色；纯 SVG + CSS，热区点击由 scenes.js 委托处理。 */
    var banner = (QZD.scenes && QZD.scenes.banner) ? QZD.scenes.banner(current) : '';
    root.innerHTML = banner + html;
    decorateTitles(root);
    decorateButtons(root);
    watchPortraits(root);
    var key = currentKey();
    if(hooks[current]) hooks[current](root);
    else if(key !== current && hooks[key]) hooks[key](root);
  };

  UI.current = function(){ return current; };
  UI.currentTab = currentKey;
  UI.page = function(id){ return pages[id] || null; };

  UI.onStateChanged = function(){
    UI.refreshHeader();
    refreshTopbar();
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
    var raw = location.hash.replace(/^#/, '') || 'summary';
    var seg = raw.split('/');
    return seg[1] || seg[0] || 'summary';
  }

  UI.init = function(){
    /* 注册分组页：必须等所有子页 register 完（main.js 最后执行） */
    (CFG.GROUPS || []).forEach(function(g){
      UI.registerGroup(g.id, g.tabs, g.tabs && g.tabs[0] && g.tabs[0].id);
    });
    buildNav();
    buildTopbar();
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
      : '<button class="btn ghost" data-modal-cancel>' + (opts.cancelText || '关闭') + '</button>';

    mask.innerHTML =
      '<div class="dialog' + (opts.wide ? ' wide' : '') + '" role="dialog">' +
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

  /* 公共：灵感编辑弹层（所有页面的 data-idea-edit 都调这个）*/
  UI.openIdeaEditor = function(ideaId){
    var idea = QZD.idea.list().filter(function(x){ return x.id === ideaId; })[0];
    if(!idea) return;
    document.querySelectorAll('.modal-mask').forEach(function(m){ if(m.parentNode) m.parentNode.removeChild(m); });
    var ESC = function(t){ return QZD.ui.fmt.escape(t); };
    UI.modal({
      title: '编辑灵感',
      body:
        '<div class="field"><label>标签</label><input id="ie-tag" value="' + ESC(idea.tag || '') + '" maxlength="16"></div>' +
        '<div class="field"><label>内容</label><textarea id="ie-text" rows="3" maxlength="200" style="width:100%;padding:8px;border:1px solid var(--line);border-radius:4px;font-size:12px;font-family:inherit">' + ESC(idea.text || '') + '</textarea></div>' +
        (idea.hatched
          ? '<p style="font-size:11px;color:#8a8574;margin-top:6px">当前关联：已挂到 ' +
              ESC(hatchLabelSimple(idea.hatchedType, idea.hatchedRef)) +
            '</p>'
          : '') +
        '<div style="display:flex;gap:6px;margin-top:8px">' +
          '<button class="chip sm danger" id="ie-remove">🗑 删除此灵感（会从所有模块解除关联）</button>' +
        '</div>',
      ok: true, okText: '保存',
      onOk: function(){
        QZD.idea.edit(ideaId, {
          tag: document.getElementById('ie-tag').value,
          text: document.getElementById('ie-text').value
        });
        UI.onStateChanged();
      }
    });
    setTimeout(function(){
      var rm = document.getElementById('ie-remove');
      if(rm) rm.addEventListener('click', function(){
        QZD.idea.remove(ideaId);
        document.querySelectorAll('.modal-mask').forEach(function(m){ if(m.parentNode) m.parentNode.removeChild(m); });
        UI.onStateChanged();
      });
    }, 20);
  };

  /* hatchLabel 简化版（避免循环依赖 pages/idea.js 没加载）*/
  function hatchLabelSimple(type, ref){
    if(!type) return '';
    var names = {
      subject:'课题', meeting:'议事厅', thesis:'文渊阁',
      goal:'千秋大计', memorial:'奏折', checkin:'常课', reading:'阅读',
      custom:'自定义', other:'独立落地'
    };
    return (names[type] || type) + (ref ? ' · ' + ref : '');
  }

  /* 公共 click 委托：data-idea-edit → 打开灵感编辑弹层
     因为 render.js 先于各页面绑定，所以它最先拿到事件并 return，
     各页面后续的 unlink handler 不受影响（点 × 才会 return）*/
  document.addEventListener('click', function(e){
    var edit = e.target.closest('[data-idea-edit]');
    if(edit){
      /* 排除 chip 内部的 × 按钮：那个走 unlink handler */
      if(!e.target.closest('b')){
        UI.openIdeaEditor(edit.getAttribute('data-idea-edit'));
        e.stopPropagation();
      }
      return;
    }
  }, false);

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

  /* ---------- 昭幸大屏：大立绘 + 叠在图上的文字（榻前片段或台词） ----------
     opts.scenes 为榻前片段数组时，文字层取代下方气泡、整段淡入；
     opts.morning/opts.after/opts.goodNews 提供时，大屏内点「下一幕」依次演
     榻前 → 罗帐淡出 → 次晨 → 喜讯，全程不关立绘（合并原过场窗）。
     点立绘换姿态与换段各自独立循环。不传 scenes 则沿用旧台词气泡。 */
  UI.favorScreen = function(consort, dlg, opts){
    if(!dlg || !consort) return;
    opts = opts || {};
    var scenes = Array.isArray(opts.scenes) && opts.scenes.length
      ? opts.scenes.slice() : null;
    var sceneIdx = 0;
    /* 时辰前缀按真实时间，避免白天侍寝也写「入夜」。只影响这行标签，文案池不动。 */
    function timeLabelOf(h){
      if(h >= 5 && h < 8) return '清晨 · 天光初透';
      if(h >= 8 && h < 11) return '上午 · 日上帘栊';
      if(h >= 11 && h < 13) return '日中 · 庭前昼静';
      if(h >= 13 && h < 17) return '午后 · 日影西斜';
      if(h >= 17 && h < 19) return '傍晚 · 暮色初合';
      if(h >= 19 && h < 23) return '入夜 · 灯下屏退左右';
      return '夜深 · 更漏沉沉';
    }
    /* 分幕：侍寝才有多幕，普通相处只有一屏。
       幕标签可由 opts.labels 覆盖（侍寝按开始时刻走清晨/日中/入夜不同时间线）。 */
    var LB = opts.labels || {};
    var curtains = [];
    if(scenes){
      curtains.push({ label: LB.first || '榻前', text: null });   /* text=null 表示当前 scene 段 */
      curtains.push({ label: LB.curtain || '罗帐落下',
        text: (LB.curtainText || '罗帐落下，帐钩轻晃，灯影隔了一层暖色。') + '\n\n—— 文字淡出 ——' });
      if(opts.morning) curtains.push({ label: LB.next || '次晨', text: opts.morning });
      if(opts.after)   curtains.push({ label: LB.after || '隔日', text: opts.after });
      if(opts.goodNews) curtains.push({ label: '喜讯', text: opts.goodNews });
    }
    var curtainIdx = 0;
    var mask = document.createElement('div');
    mask.className = 'favor-mask';
    var portraitHtml = consort.video
      ? QZD.portrait.video(consort.video, consort.name)
      : QZD.portrait.svg(consort.id, consort.name,
          { kind: 'female', img: consort.img, model: consort.model });
    var hasPoses = Array.isArray(consort.poses) && consort.poses.length > 1;
    var poseHtml = '';
    if(hasPoses){
      /* 姿态记忆可见：poseIndex 存档持久，这里显示「第 N 张」+圆点，
         换姿态后关掉大屏、下次再从存档读回，仍停在该张。 */
      poseHtml = '<div class="favor-poses">' +
        '<span class="favor-pose-count" data-pose-count>' +
          ((consort.poseIndex || 0) + 1) + ' / ' + consort.poses.length + '</span>' +
        consort.poses.map(function(p, i){
          return '<button class="pose-dot' + (i === (consort.poseIndex || 0) ? ' active' : '') +
            '" data-pose="' + i + '" title="姿态 ' + (i + 1) + '"></button>';
        }).join('') + '</div>';
    }

    mask.innerHTML =
      '<div class="favor-screen" role="dialog" aria-modal="true">' +
        '<div class="favor-portrait" data-favor-portrait title="' +
          (hasPoses ? '轻点立绘，跳下一幕并换姿态' : '轻点立绘，换一句') + '">' +
          '<div class="favor-pic">' + portraitHtml + '</div>' +
          '<div class="favor-scrim"></div>' +
          poseHtml +
          '<div class="favor-overlay">' +
            (scenes
              ? '<div class="favor-scene-time" data-favor-time>' + timeLabelOf(new Date().getHours()) + '</div>' +
                '<div class="favor-scene-wrap">' +
                '<div class="favor-scene" data-favor-scene></div></div>' +
                '<div class="favor-scene-hint" data-scene-hint>轻点立绘 · 跳下一幕' +
                '<span class="favor-scroll-tip"> · ↑↓ 可滑动</span></div>'
              : '<div class="favor-bubble-wrap">' +
                '<div class="favor-bubble"><span class="favor-say-name">' +
                  UI.fmt.escape(consort.name) + '：</span>' +
                  '<span data-favor-bubble></span></div>' +
                '</div>') +
          '</div>' +
        '</div>' +
        (curtains.length > 1
          ? '<button class="favor-next" data-favor-next>下一幕 · ' +
              UI.fmt.escape(curtains[1].label) + ' →</button>' : '') +
        '<button class="favor-close" aria-label="关闭" title="关闭">×</button>' +
      '</div>';

    /* 打字机：逐字显示台词。
       11-19：系统开启「减少动态效果」时直接显示全文，不跑定时器（省 CPU）。 */
    function typeInto(el, text, speed){
      if(!el) return;
      if(el.__typer) clearInterval(el.__typer);
      el.textContent = '';
      var reduce = false;
      try { reduce = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch(e){}
      if(reduce){ el.textContent = text || ''; return; }
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
      var cnt = mask.querySelector('[data-pose-count]');
      if(cnt && Array.isArray(consort.poses)){
        cnt.textContent = (pc.poseIndex + 1) + ' / ' + consort.poses.length;
      }
    }

    /* 榻前文字层：整段淡入（长文不逐字念，避免等太久）；换段时重播淡入 */
    function renderSceneText(text){
      var el = mask.querySelector('[data-favor-scene]');
      if(!el) return;
      el.classList.remove('scene-in');
      void el.offsetWidth;
      el.textContent = text;
      el.classList.add('scene-in');
      /* 换段后滚动条回到顶部：长文从头读，不残留在上一段的位置 */
      var wrap = mask.querySelector('.favor-scene-wrap');
      if(wrap) wrap.scrollTop = 0;
      updateScrollTip();
    }
    /* 内容超出时才点亮「↑↓ 可滑动」提示；滚到底部即熄灭，不必等滑完才发现 */
    function updateScrollTip(){
      var wrap = mask.querySelector('.favor-scene-wrap');
      var hint = mask.querySelector('[data-scene-hint]');
      if(!wrap || !hint) return;
      var more = wrap.scrollHeight - wrap.scrollTop - wrap.clientHeight > 6;
      if(more) hint.classList.add('scrollable');
      else hint.classList.remove('scrollable');
      if(!wrap.__tipBound){
        wrap.__tipBound = true;
        wrap.addEventListener('scroll', updateScrollTip);
      }
    }
    function showScene(i){
      if(!scenes) return;
      sceneIdx = i % scenes.length;
      if(curtainIdx === 0) renderSceneText(scenes[sceneIdx]);  /* 榻前：显示当前片段 */
    }
    /* 下一幕：榻前 → 罗帐淡出 → 次晨 → 喜讯，全程不关大屏。
       只负责幕/文字；姿态由 advancePose 独立推进，两者不绑定。 */
    function nextCurtain(){
      if(curtainIdx >= curtains.length - 1) return false;
      curtainIdx++;
      var cur = curtains[curtainIdx];
      if(curtainIdx === 0) showScene(sceneIdx);
      else renderSceneText(cur.text || '');
      var btn = mask.querySelector('[data-favor-next]');
      if(btn){
        if(curtainIdx >= curtains.length - 1) btn.style.display = 'none';
        else btn.textContent = '下一幕 · ' + curtains[curtainIdx + 1].label + ' →';
      }
      return true;
    }
    /* 换下一张立绘：姿态索引独立 +1 循环，与幕/文案一一解耦 */
    function advancePose(){
      if(hasPoses) applyPose(QZD.harem.cyclePose(consort.id));
    }
    if(scenes){
      showScene(0);
    }else{
      typeInto(mask.querySelector('[data-favor-bubble]'), dlg.text, 28);
    }

    /* 换一句/换一段：有片段则换下一段榻前描写（仅榻前幕有效）；否则重抽台词。
       抖动由点击处统一处理，这里只换内容。 */
    function regreet(){
      if(scenes){ if(curtainIdx === 0) showScene(sceneIdx + 1); return; }
      if(!QZD.harem.buildDialogue) return;
      var nd = QZD.harem.buildDialogue(consort, !!dlg.pregnant);
      typeInto(mask.querySelector('[data-favor-bubble]'), nd.text, 28);
    }

    mask.addEventListener('click', function(e){
      if(e.target === mask || e.target.closest('.favor-close') || e.target.closest('[data-favor-close]')){
        var bb = mask.querySelector('[data-favor-bubble]');
        if(bb && bb.__typer) clearInterval(bb.__typer);
        var sc = mask.querySelector('[data-favor-scene]');
        if(sc) sc.classList.remove('scene-in');
        if(mask.parentNode) mask.parentNode.removeChild(mask);
        return;
      }
      /* 顶部圆点：直接跳到指定姿态 */
      var poseBtn = e.target.closest('[data-pose]');
      if(poseBtn){
        applyPose(QZD.harem.setPose(consort.id, Number(poseBtn.getAttribute('data-pose'))));
        return;
      }

      /* 下一幕：幕/文字 +1，同时立绘也换下一张（图文解耦、不一一绑定，
         只是两个循环各往前走一格）。幕到头时按钮已隐藏，点不到。 */
      if(e.target.closest('[data-favor-next]')){
        advancePose();
        nextCurtain();
        return;
      }

      /* 点击立绘 = 跳下一幕 + 下一张立绘 + 换文案，三个动作各自独立循环：
         - 有姿态：先抖一下换下一张图；
         - 有多幕且未到头：幕 +1（次晨/喜讯等）；
           幕已到头（或无分幕）：换文案（榻前下一段 / 台词重抽），保证点下去总有变化。 */
      if(e.target.closest('[data-favor-portrait]') && !e.target.closest('.favor-overlay')){
        var advanceTextAndCurtain = function(){
          var stepped = curtains.length > 1 ? nextCurtain() : false;
          if(!stepped) regreet();   /* 幕到头/无分幕时走文案，避免点了无反应 */
        };
        if(hasPoses){
          shake(function(){
            applyPose(QZD.harem.cyclePose(consort.id));  /* 立绘独立 +1 */
            advanceTextAndCurtain();                       /* 幕 +1，到头换文案 */
          });
        }else{
          advanceTextAndCurtain();
        }
      }
    });
    document.getElementById('modal-root').appendChild(mask);
    /* 挂载后才量得到真实高度：此时再判一次是否需要「可滑动」提示 */
    if(scenes) updateScrollTip();
  };
})();
