/* ============================================================
   ui/pomodoro.js · 专注浮层 + 开始弹窗
   奏折＝专注任务：开始弹窗只选陪伴妃嫔；浮层为正计时，
   「完成并退出」全额结算，「暂离」按五成结算。
   浮层支持：拖拽移动、拖右下角缩放、收起为小浮标、开关缩放动画。
   系统级悬浮（双保险）：
     · 优先用 Document Picture-in-Picture（Chrome/Edge 116+，
       变成系统级独立小窗，最小化主窗口仍可见）；
     · 不支持时降级为 window.open 独立浏览器窗口（Firefox/Safari
       及所有浏览器均支持，它本就是独立 OS 窗口，主窗口缩小/最小化
       不会带走它，同样满足"缩小网页后也悬浮"）。
   ============================================================ */
(function(){
  var UI = QZD.ui;
  var P = QZD.config.POMODORO;
  var F = QZD.formulas;

  var COMPACT_KEY = 'qzd_pomo_compact';
  var pomoCompact = false;
  try { pomoCompact = localStorage.getItem(COMPACT_KEY) === '1'; } catch(e){}
  var structSig = '';
  var pipWin = null;                 /* Document Picture-in-Picture 窗口 */
  var popWin = null;                 /* window.open 独立悬浮窗 */
  var pipOpening = false;            /* 防止快速双击开多个独立窗 */
  var HAS_PIP = (typeof window !== 'undefined') && ('documentPictureInPicture' in window);

  function pad(n){ return n < 10 ? '0' + n : '' + n; }
  function clock(sec){
    sec = Math.max(0, Math.round(sec));
    var h = Math.floor(sec / 3600);
    var m = Math.floor((sec % 3600) / 60);
    var s = sec % 60;
    return h > 0 ? (h + ':' + pad(m) + ':' + pad(s)) : (pad(m) + ':' + pad(s));
  }

  function boundTitle(){
    var p = QZD.state.pomodoro;
    if(p.title) return p.title;
    var m = QZD.memorials.find(p.boundMemorialId);
    return m ? m.title : '（奏折已撤）';
  }

  function companionPickerHtml(selectedId){
    var list = (QZD.harem && QZD.harem.list) ? QZD.harem.list() : [];
    var html = '<div class="comp-pick">';
    html += '<button type="button" class="comp-avatar none' +
      (selectedId === null ? ' active' : '') + '" data-companion="none">' +
      '<span class="comp-none-txt">独自</span></button>';
    list.forEach(function(c){
      var pic = QZD.portrait.svg(c.id, c.name, { kind: 'female', img: c.img, model: c.model });
      html += '<button type="button" class="comp-avatar' +
        (selectedId === c.id ? ' active' : '') + '" data-companion="' + c.id +
        '" title="' + UI.fmt.escape(c.name) + '">' + pic +
        '<span class="comp-name">' + UI.fmt.escape(c.name) + '</span></button>';
    });
    html += '</div>';
    if(!list.length){
      html += '<p class="card-note" style="margin-top:6px">后宫尚无妃嫔，可先至「后宫」选秀。</p>';
    }
    return html;
  }

  function bindCompanion(mask, onPick){
    var nodes = mask.root.querySelectorAll('[data-companion]');
    Array.prototype.forEach.call(nodes, function(btn){
      btn.addEventListener('click', function(){
        Array.prototype.forEach.call(nodes, function(b){ b.classList.remove('active'); });
        btn.classList.add('active');
        var v = btn.getAttribute('data-companion');
        onPick(v === 'none' ? null : v);
      });
    });
  }

  /* ---------- 开始专注：绑奏折（可指定小目标） ---------- */
  function openMemorial(memorialId, subId){
    if(QZD.pomodoro.isActive()){ UI.toast('已有专注正在进行'); return; }
    var m = QZD.memorials.find(memorialId);
    if(!m){ UI.toast('奏折不存在'); return; }
    if(m.status === 'banjie'){ UI.toast('奏折已办结'); return; }

    var sub = null;
    if(subId){
      var hit = QZD.memorials.findSubById(subId);
      if(!hit || hit.memorial.id !== m.id){ UI.toast('小目标不存在'); return; }
      if(hit.sub.done){ UI.toast('该小目标已完成'); return; }
      sub = hit.sub;
    }

    var selectedCompanion = null;
    var mask = UI.modal({
      title: '开始专注',
      body: '<p class="card-note" style="margin-bottom:12px">奏折：<b>' +
          UI.fmt.escape(m.title) + '</b>' +
          (sub ? '<br>小目标：<b>' + UI.fmt.escape(sub.title) + '</b>' : '') + '</p>' +
        '<p class="today-line">正计时：不设固定时长，做完点「完成并退出」全额结算。</p>' +
        '<div class="field" style="margin-top:12px"><label>妃嫔陪伴（可选）</label>' +
        companionPickerHtml(selectedCompanion) + '</div>' +
        '<p class="card-note">每分钟自动记录专注时长与资源；放弃按五成计入。</p>',
      ok: true,
      okText: '开始专注',
      onOk: function(){
        var res = QZD.pomodoro.startOpen(memorialId, subId || null, selectedCompanion);
        if(!res.ok){ UI.toast(res.error); return false; }
        UI.toast('专注开始 · 做完点「完成并退出」');
        UI.onStateChanged();
      }
    });

    bindCompanion(mask, function(v){ selectedCompanion = v; });
  }

  /* ---------- 浮层 ---------- */
  function persistCompact(){
    try { localStorage.setItem(COMPACT_KEY, pomoCompact ? '1' : '0'); } catch(e){}
  }

  /* 当前浮动的宿主文档：PiP > 独立窗 > 主页面 */
  function floatHost(){
    if(pipWin && !pipWin.closed) return 'pip';
    if(popWin && !popWin.closed) return 'pop';
    return null;
  }
  function currentHost(){
    var h = floatHost();
    if(h === 'pip') return pipWin.document;
    if(h === 'pop') return popWin.document;
    return document;
  }

  function buildCard(p, paused){
    var mem = QZD.memorials.find(p.boundMemorialId);
    var comp = p.companionId ? QZD.harem.consortById(p.companionId) : null;
    var compHtml = '';
    if(comp){
      var cp = QZD.portrait.svg(comp.id, comp.name, { kind: 'female', img: comp.img, model: comp.model });
      compHtml =
        '<div class="pomo-companion" data-pomo-companion title="轻点妃嫔，听她问候">' +
          '<div class="pomo-comp-avatar">' + cp + '</div>' +
          '<div class="pomo-comp-info">' +
            '<span class="pomo-comp-name">' + UI.fmt.escape(comp.name) + '</span>' +
            '<span class="pomo-comp-tag" id="pomo-comp-tag">轻点问候</span>' +
          '</div>' +
        '</div>';
    }
    var floating = !!floatHost();
    var floatBtnTitle = floating ? '回到页面' : '开独立悬浮窗（缩小主窗口仍可见）';
    var floatBtnIcon = floating ? '▣' : '⧉';
    var headBtns =
      '<span class="pomo-head-btns">' +
        '<button type="button" class="pomo-ico" data-pomo="float" title="' + floatBtnTitle + '">' +
          floatBtnIcon + '</button>' +
        '<button type="button" class="pomo-ico" data-pomo="collapse" title="' + (pomoCompact ? '展开' : '收起') + '">' +
          (pomoCompact ? '▢' : '—') + '</button>' +
      '</span>';
    return '' +
      '<div class="pomo-card' + (paused ? ' paused' : '') + (pomoCompact ? ' compact' : '') + '" id="pomo-card">' +
        '<div class="pomo-head">' +
          '<span class="pomo-title">' + (paused ? '已暂停' : '专注中') + '</span>' +
          '<span class="badge ok">正计时</span>' + headBtns +
        '</div>' +
        '<p class="pomo-mem">' + UI.fmt.escape(boundTitle()) + '</p>' +
        '<div class="pomo-clock" id="pomo-clock">00:00</div>' +
        '<p class="pomo-sub" id="pomo-sub"></p>' +
        compHtml +
        '<div class="pomo-gains">' +
          '<span class="g-qin" id="pomo-g-qin">勤政+0</span>' +
          '<span class="g-jin" id="pomo-g-jin">金钱+0</span>' +
          '<span class="g-guo" id="pomo-g-guo">国力+0</span>' +
        '</div>' +
        '<p class="pomo-cum" id="pomo-cum"></p>' +
        '<div class="pomo-btns">' +
          '<button class="btn primary" data-pomo="finish">完成并退出</button>' +
          '<button class="btn ghost" data-pomo="abandon">暂 离</button>' +
        '</div>' +
        '<p class="pomo-note">完成＝全额 · 暂离＝五成</p>' +
      '</div>';
  }

  function setText(scope, sel, txt){
    var el = scope.querySelector(sel);
    if(el) el.textContent = txt;
  }

  function updateLive(host){
    var card = host.getElementById('pomo-card');
    if(!card) return;
    var p = QZD.state.pomodoro;
    var elapsed = QZD.pomodoro.elapsedSec(Date.now());
    var perMin = F.perMinuteGain();
    var mem = QZD.memorials.find(p.boundMemorialId);
    setText(card, '#pomo-clock', clock(elapsed));
    setText(card, '#pomo-sub', '本次已专注 ' + Math.floor(elapsed / 60) + ' 分钟' +
      (mem ? ' · 此折累计 ' + Math.round((mem.focusMin || 0) + QZD.pomodoro.realizedMinutes()) +
        ' 分 / ' + ((mem.sessions || 0) + 1) + ' 次' : ''));
    setText(card, '#pomo-g-qin', '勤政+' + Math.floor(perMin.qinZheng * elapsed / 60));
    setText(card, '#pomo-g-jin', '金钱+' + Math.floor(perMin.jinQian * elapsed / 60));
    setText(card, '#pomo-g-guo', '国力+' + Math.floor(perMin.guoJin * elapsed / 60));
    setText(card, '#pomo-cum', mem ? ('此折累计 ' +
      Math.round((mem.focusMin || 0) + QZD.pomodoro.realizedMinutes()) + ' 分 · ' +
      ((mem.sessions || 0) + 1) + ' 次') : '');
  }

  function startDrag(e){
    if(e.button !== 0) return;
    if(e.target.closest('[data-pomo]')) return; /* 点按钮不拖 */
    var head = e.currentTarget;
    var card = head.parentElement;
    var rootEl = card ? card.parentElement : null;          /* 页面内 = #pomo-root；浮窗内不挂拖拽 */
    if(!rootEl || rootEl === card.ownerDocument.body) return;
    var rect = rootEl.getBoundingClientRect();
    var offX = e.clientX - rect.left;
    var offY = e.clientY - rect.top;
    function move(ev){
      rootEl.style.left = (ev.clientX - offX) + 'px';
      rootEl.style.top = (ev.clientY - offY) + 'px';
      rootEl.style.right = 'auto';
      rootEl.style.bottom = 'auto';
    }
    function up(){
      document.removeEventListener('mousemove', move);
      document.removeEventListener('mouseup', up);
      document.body.style.userSelect = '';
    }
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', move);
    document.addEventListener('mouseup', up);
  }

  function bindCard(card, inFloat){
    card.onclick = function(e){
      try {
        var floatBtn = e.target.closest('[data-pomo="float"]');
        if(floatBtn){ toggleFloat(); return; }

      var collapseBtn = e.target.closest('[data-pomo="collapse"]');
      if(collapseBtn){ pomoCompact = !pomoCompact; persistCompact(); render(); return; }

      var compEl = e.target.closest('[data-pomo-companion]');
      if(compEl){
        var cid = QZD.state.pomodoro.companionId;
        var cc = cid ? QZD.harem.consortById(cid) : null;
        if(cc){
          var line = cc.name + '：' + QZD.harem.companionGreeting(cc);
          var tag = card.ownerDocument.getElementById('pomo-comp-tag');
          if(tag){
            tag.textContent = line;               /* 问候语在名字条内浮现 */
            if(tag._revertT) clearTimeout(tag._revertT);
            tag._revertT = setTimeout(function(){
              tag.textContent = '轻点问候';
            }, 5000);
          }
          /* 浮窗内问候已在名字条浮现，不再往主窗口弹 toast，避免重复 */
          if(card.ownerDocument === document) UI.toast(line);
        }
        return;
      }

      var btn = e.target.closest('[data-pomo]');
      if(!btn) return;
      var act = btn.getAttribute('data-pomo');

      /* 在独立浮窗里：直接完成/暂离，不必切回主窗口点确认 */
      var inFloatHost = (card.ownerDocument !== document);

      if(act === 'finish'){
        /* 页面内 / 浮窗内一致：点击即收工，不再弹确认框。
           注意：finishAndExit 成功时返回结算结果（无 ok 字段），仅失败时才是 {ok:false,error}，
           所以只能判 res.ok === false，判 !res.ok 会把成功误判成失败、导致卡片永不关闭！ */
        try {
          var res = QZD.pomodoro.finishAndExit();
          if(!res || res.ok === false){
            UI.toast((res && res.error) || '当前不在专注中');
            return;
          }
          UI.toast('已收工 · ' + (res.title || '') + ' · ' + res.minutes +
            ' 分钟，全额结算' + (res.subtaskDone ? '，小目标已完成' : ''));
          notifyFinish(res);
          render();               /* 立即收浮层 / 关悬浮窗 */
          UI.onStateChanged();
          if(res.type === 'finished'){
            setTimeout(function(){ promptProgress(res); }, 80);
          }
        } catch(err){
          UI.toast('收工异常：' + ((err && err.message) ? err.message : err));
          render();
        }
        return;
      }

      if(act === 'abandon'){
        if(inFloatHost){
          var r2 = QZD.pomodoro.abandon();
          UI.toast(r2.type === 'abandoned' ? '已退出 · 按五成计入（独立窗）' : '专注已结束');
          render();   /* 关闭独立窗 + 清空页面浮层 */
          return;
        }
        UI.confirm(
          '<p>提前退出？</p>' +
          '<p class="card-note">已专注时长<b>按五成</b>计入（资源与奏折进度同步减半），' +
            '仍记 1 次专注；小目标保持未完成。</p>',
          function(){
            try {
              var res = QZD.pomodoro.abandon();
              UI.toast(res.type === 'abandoned' ? '已退出 · 按五成计入' : '专注已结束');
              render();               /* 先收浮层，保证窗口一定关上 */
              UI.onStateChanged();
              if(res.type === 'abandoned') setTimeout(function(){ promptAbandonReason(res); }, 80);
            } catch(err){
              UI.toast('退出异常：' + ((err && err.message) ? err.message : err));
              render();
            }
          },
          { title: '暂离', okText: '确定退出' }
        );
      }
      } catch(err){
        UI.toast('操作异常：' + ((err && err.message) ? err.message : err));
      }
    };
    if(!inFloat){
      var head = card.querySelector('.pomo-head');
      if(head) head.addEventListener('mousedown', startDrag);
    }
  }

  /* ---------- 系统级悬浮：PiP 优先，否则 window.open 独立窗 ---------- */
  function copyStyles(pip){
    try{
      Array.prototype.forEach.call(document.styleSheets, function(s){
        var node = s.ownerNode;
        if(!node || !node.cloneNode) return;
        try { pip.document.head.appendChild(node.cloneNode(true)); } catch(e){}
      });
    }catch(e){}
  }

  function pipSupported(){
    try {
      return !!(window.documentPictureInPicture &&
                typeof window.documentPictureInPicture.requestSession === 'function');
    } catch(e){ return false; }
  }

  function pipSupported(){
    try {
      return !!(window.documentPictureInPicture &&
                typeof window.documentPictureInPicture.requestSession === 'function');
    } catch(e){ return false; }
  }

  /* 自检用的状态描述：区分「API不存在 / API在但方法被剥 / 可用」 */
  function pipState(){
    try {
      var dpi = window.documentPictureInPicture;
      if(!dpi) return 'API不存在';
      var t = typeof dpi.requestSession;
      return t === 'function' ? '可用（置顶）' : 'API在但不可调(' + t + ')';
    } catch(e){ return '探测异常'; }
  }

  /* 悬浮窗尺寸：高度≈屏幕可用高度的 1/3.6（小巧但卡片可正常显示），
     宽高比保持 320:440；300px 是卡片内容能完整放下下限 */
  function floatSize(){
    var sh = (window.screen && window.screen.availHeight) ? window.screen.availHeight : 1080;
    var h = Math.max(300, Math.round(sh / 3.6));
    var w = Math.round(h * 320 / 440);
    return { w: w, h: h };
  }

  function enterPip(){
    try {
      var dpi = window.documentPictureInPicture;
      if(!dpi){
        UI.toast('当前环境无画中画 API（' + (location.protocol === 'file:' ? 'file:// 打开所致' : '浏览器未提供') + '），改用独立窗口');
        enterPop();
        return;
      }
      if(pipWin && !pipWin.closed) return;
      if(pipOpening) return;
      pipOpening = true;
      var s = floatSize(), w = s.w, h = s.h;
      var pr = null;
      try {
        /* 乐观尝试：只要 API 对象在就真调一次（部分构建里 typeof 探测不可靠） */
        pr = dpi.requestSession({ width: w, height: h });
      } catch(e){
        pipOpening = false;
        UI.toast('画中画被浏览器禁用（' + ((e && e.message) || e) + '），改用独立窗口');
        enterPop();
        return;
      }
      if(!pr || typeof pr.then !== 'function'){
        pipOpening = false;
        UI.toast('画中画不可调用，改用独立窗口');
        enterPop();
        return;
      }
      pr.then(function(pip){
          pipWin = pip;
          pip.document.title = '勤政殿 · 专注';
          pip.document.body.style.margin = '0';
          pip.document.body.style.minHeight = '100vh';
          pip.document.body.style.background = 'var(--bg, #f4efe6)';
          pip.document.body.style.display = 'flex';
          pip.document.body.style.alignItems = 'flex-start';
          pip.document.body.style.justifyContent = 'center';
          pip.document.body.style.padding = '14px';
          copyStyles(pip);
          pip._timer = pip.setInterval(function(){
            if(pipWin === pip) updateLive(pip.document);
          }, 1000);
          pip.addEventListener('pagehide', function(){
            if(pip._timer) pip.clearInterval(pip._timer);
            pipWin = null;
            structSig = '';
            render();
          });
          structSig = '';
          render();
          pipOpening = false;
          UI.toast('已开系统悬浮 · 主窗口缩小也跟着你');
        });
      pr.catch(function(err){
        pipOpening = false;
        UI.toast('画中画被拒绝，改用独立窗口：' + ((err && err.message) ? err.message : err));
        enterPop();
      });
    } catch(err){
      pipOpening = false;
      UI.toast('画中画开启异常，改用独立窗口：' + ((err && err.message) ? err.message : err));
      enterPop();
    }
  }

  function exitPip(){
    if(pipWin && !pipWin.closed){
      if(pipWin._timer) pipWin.clearInterval(pipWin._timer);
      try { pipWin.close(); } catch(e){}
    }
    pipWin = null;
    structSig = '';
    render();
  }

  /* window.open 独立窗口：打开项目内的 float.html，
     所有浏览器可用，主窗口最小化/缩小仍可见；同源下 CSS 与立绘均能加载，
     且不依赖 document.write（部分 Chrome 下 write 会抛异常）。 */
  function enterPop(){
    try {
      /* 已有弹窗：先关掉再重开，保证 float.html 与样式永远最新（旧窗会变成僵尸窗） */
      if(popWin && !popWin.closed){
        try { popWin.close(); } catch(e){}
        popWin = null; structSig = '';
      }
      if(pipWin && !pipWin.closed){ exitPip(); return; }
      var s = floatSize(), w = s.w, h = s.h;
      /* 打开时自动贴到屏幕右下角（dock 感） */
      var dockLeft = Math.max(0, (window.screen && window.screen.availWidth ? window.screen.availWidth : 1920) - w - 12);
      var dockTop  = Math.max(0, (window.screen && window.screen.availHeight ? window.screen.availHeight : 1080) - h - 12);
      /* 令牌 + 时间戳：时间戳强制绕过缓存取最新文件；
         令牌写入本窗口，孤儿弹窗（主页面刷新前的残留）校验失败会自动关闭 */
      var token = String(Date.now()) + '-' + Math.floor(Math.random() * 1e6);
      window.__qzdFloatToken = token;
      var wn = null;
      try {
        wn = window.open('float.html?t=' + token, 'qzd_pomo_float',
          'width=' + w + ',height=' + h + ',left=' + dockLeft + ',top=' + dockTop + ',' +
          'menubar=no,toolbar=no,location=no,status=no,resizable=yes,scrollbars=no');
      } catch(oe){
        UI.toast('浏览器拦截了弹窗（' + ((oe && oe.message) || oe) + '）：请在地址栏允许本站点弹窗后重试');
        return;
      }
      if(!wn){
        UI.toast('弹窗被拦截：请在浏览器允许本站点弹窗后重试');
        return;
      }
      popWin = wn;
      structSig = '';
      /* 轮询等待独立窗 body 就绪后再挂载卡片（float.html 自带 CSS，无需 document.write） */
      var tries = 0;
      (function mount(){
        if(popWin !== wn) return;
        tries++;
        try {
          var root = wn.document && wn.document.body;
          if(!root){
            if(tries < 80){ setTimeout(mount, 30); }
            else { UI.toast('悬浮窗加载超时，已留在页面内'); try{ wn.close(); }catch(_){} popWin=null; render(); }
            return;
          }
          render();   /* 卡片挂进独立窗（render 会以 popWin.document 为宿主） */
          wn._timer = wn.setInterval(function(){
            if(popWin === wn) updateLive(wn.document);
          }, 1000);
          wn.addEventListener('beforeunload', function(){
            if(wn._timer) wn.clearInterval(wn._timer);
            popWin = null; structSig = ''; render();
          });
          UI.toast('已开独立悬浮窗 · 缩小主窗口也跟着你');
        } catch(re){
          UI.toast('悬浮窗挂载失败（' + ((re && re.message) || re) + '），已留在页面内');
          try { wn.close(); } catch(_){}
          popWin = null;
          render();
        }
      })();
    } catch(err){
      popWin = null;
      UI.toast('悬浮窗开启异常：' + ((err && err.message) ? err.message : err) +
        '（请允许弹窗后用本页地址打开）');
      render();
    }
  }

  function exitPop(){
    if(popWin && !popWin.closed){
      if(popWin._timer) popWin.clearInterval(popWin._timer);
      try { popWin.close(); } catch(e){}
    }
    popWin = null;
    structSig = '';
    render();
  }

  function toggleFloat(){
    var h = floatHost();
    if(h === 'pip'){ exitPip(); return; }
    if(h === 'pop'){ exitPop(); return; }
    /* 只要 API 对象存在就尝试画中画（enterPip 内部失败会自动降级独立窗） */
    var hasDpi = false;
    try { hasDpi = !!window.documentPictureInPicture; } catch(e){ hasDpi = false; }
    if(hasDpi){ enterPip(); }
    else { enterPop(); }
  }

  /* ---------- 渲染（区分页面 / PiP / 独立窗 三个宿主） ---------- */
  function render(){
    applyZen();
    var p = QZD.state.pomodoro;
    var running = p.status === 'running';
    var paused = p.status === 'paused';
    if(!running && !paused){
      try {
        if(pipWin && !pipWin.closed){
          if(pipWin._timer) pipWin.clearInterval(pipWin._timer);
          try { pipWin.close(); } catch(e){}
        }
        if(popWin && !popWin.closed){
          if(popWin._timer) popWin.clearInterval(popWin._timer);
          try { popWin.close(); } catch(e){}
        }
      } catch(e){ /* 任何取属性/关窗异常都不应阻断后续清屏 */ }
      pipWin = null; popWin = null;
      var mr0 = document.getElementById('pomo-root');
      if(mr0){ mr0.innerHTML = ''; mr0.onclick = null; }
      structSig = '';
      return;
    }
    var host = currentHost();
    var root = (host === document)
      ? document.getElementById('pomo-root')
      : (host.getElementById('pomo-root') || host.body);
    var sig = (paused ? 'P' : 'R') + '|' + (p.companionId || '') + '|' +
      (pomoCompact ? 'C' : '') + '|' + boundTitle() + '|' + (floatHost() || 'PAGE');
    if(sig !== structSig || !root.querySelector('#pomo-card')){
      /* 只关闭「其它」宿主，避免两处都挂着计时窗；
         绝不能关当前正在渲染的宿主（否则窗口刚开就被自己关掉） */
      var curHost = floatHost();
      if(curHost !== 'pip' && pipWin && !pipWin.closed){ if(pipWin._timer) pipWin.clearInterval(pipWin._timer); try { pipWin.close(); } catch(e){} pipWin = null; }
      if(curHost !== 'pop' && popWin && !popWin.closed){ if(popWin._timer) popWin.clearInterval(popWin._timer); try { popWin.close(); } catch(e){} popWin = null; }
      var mr = document.getElementById('pomo-root');
      if(mr) mr.innerHTML = '';
      root.innerHTML = buildCard(p, paused);
      /* 浮窗宿主（PiP / 独立窗）里相对图片地址可能无法加载：
         http(s) 下改成绝对地址；file:// 同源保持相对即可（其 origin 为 "null" 不能拼 URL） */
      if(host !== document){
        var o = location.origin;
        var abs = (typeof o === 'string' && o.indexOf('http') === 0);
        Array.prototype.forEach.call(root.querySelectorAll('img'), function(im){
          var s = im.getAttribute('src');
          if(abs && s && s.indexOf('://') === -1 && s.charAt(0) !== '/' && s.indexOf('data:') !== 0){
            im.src = o + '/' + s.replace(/^\.\//, '');
          }
        });
      }
      var card = root.querySelector('#pomo-card');
      bindCard(card, host !== document);
      if(card) card.classList.add('zoom-in');
      structSig = sig;
    }
    updateLive(host);
  }

  /* 系统通知：番茄收工（桌面版走原生通知，浏览器版退化为页面通知） */
  function notifyFinish(res){
    var title = '已收工 · ' + (res.title || '专注');
    var body = (res.minutes || 0) + ' 分钟，全额结算' + (res.subtaskDone ? '，小目标已完成' : '');
    try {
      if(window.QZDNative && window.QZDNative.notify){
        window.QZDNative.notify({ title: title, body: body });
        return;
      }
      if(window.Notification && Notification.permission === 'granted'){
        new Notification(title, { body: body });
      }
    } catch(e){ /* 忽略 */ }
  }

  /* 中断原因：记入 study.abandonLog，周报统计 */
  function logAbandon(res, reason){
    try {
      var st = QZD.state && QZD.state.study;
      if(!st) return;
      if(!Array.isArray(st.abandonLog)) st.abandonLog = [];
      st.abandonLog.push({
        at: Date.now(), reason: reason,
        minutes: Math.round((res.minutes || 0) * 10) / 10,
        title: res.title || ''
      });
      while(st.abandonLog.length > 200) st.abandonLog.shift();
      QZD.stateIO.save();
    } catch(e){ /* 忽略 */ }
  }

  function promptAbandonReason(res){
    var reasons = ['被打断', '太难/卡住', '走神', '临时有事'];
    var m = UI.modal({
      title: '为什么中断？',
      body: '<p class="card-note">记一下原因（可跳过）。周报会统计你最容易在哪类事情上中断。</p>' +
        '<div class="btn-row">' + reasons.map(function(r){
          return '<button class="chip sm" data-abandon-reason="' + r + '">' + r + '</button>';
        }).join('') + '</div>',
      ok: false,
      cancelText: '跳过'
    });
    if(m && m.root){
      m.root.addEventListener('click', function(e){
        var b = e.target.closest('[data-abandon-reason]');
        if(!b) return;
        logAbandon(res, b.getAttribute('data-abandon-reason'));
        UI.toast('已记录中断原因');
        m.close();
      });
    }
  }

  /* 专注模式：开启且正在专注时收起侧栏 */
  function applyZen(){
    try {
      var on = !!(QZD.state && QZD.state.settings && QZD.state.settings.zen && QZD.pomodoro.isActive());
      document.body.classList.toggle('zen', on);
    } catch(e){ /* 忽略 */ }
  }

  /* 每日第一次收工给一句御批（按当日累计专注） */
  function imperialLine(){
    var st = QZD.state && QZD.state.study;
    if(!st) return '';
    var today = QZD.stateIO.todayStr();
    if(st.imperialDate === today) return '';
    var min = st.doneMin || 0, bank;
    if(min >= 120)      bank = ['今日勤勉，朕心甚慰。', '勤政如此，江山可期。'];
    else if(min >= 60)  bank = ['尚可。持之以恒，必有进境。', '今日尚勤，勿骄勿怠。'];
    else if(min >= 30)  bank = ['略见成效，然未足也。', '半日之功，明日再进一步。'];
    else                bank = ['今日略显懈怠，明日补之。', '起步虽晚，犹未为迟。'];
    st.imperialDate = today;
    try { QZD.stateIO.save(); } catch(e){}
    return bank[Math.floor(Math.random() * bank.length)];
  }

  /* 收工后记一句「本次进展」：进周报「本周进展」；可跳过 */
  function promptProgress(res){
    if(!QZD.plan || !QZD.plan.addProgress) return;
    var imp = imperialLine();
    UI.modal({
      title: '本次进展',
      body: (imp ? '<p class="imperial">御批：' + imp + '</p>' : '') +
        '<p class="card-note">用一句话记下这次做了什么（可跳过）。会进周报的「本周进展」。</p>' +
        '<div class="field"><textarea id="pomo-progress" rows="3" maxlength="200" ' +
          'placeholder="如：CPW 电极宽度扫到 40μm，50Ω 出现在 1.8mm 附近"></textarea></div>',
      ok: true,
      okText: '保存',
      cancelText: '跳过',
      onOk: function(){
        var el = document.getElementById('pomo-progress');
        var text = el ? String(el.value || '').trim() : '';
        if(text){
          QZD.plan.addProgress({
            text: text,
            minutes: res.minutes,
            memorialId: res.memorialId || null,
            title: res.title || ''
          });
          UI.toast('进展已记录');
        }
        UI.onStateChanged();
      }
    });
  }

  /* 页面上的「开始批阅 / 继续」按钮 */
  document.addEventListener('click', function(e){
    var btn = e.target.closest('[data-pomo-start]');
    if(btn) openMemorial(btn.getAttribute('data-pomo-start'), null);
  });

  /* 小目标级别的「专注」按钮 */
  document.addEventListener('click', function(e){
    var btn = e.target.closest('[data-focus-sub]');
    if(!btn) return;
    var parts = String(btn.getAttribute('data-focus-sub')).split('|');
    openMemorial(parts[0], parts[1]);
  });

  UI.pomo = { render: render, openMemorial: openMemorial, toggleFloat: toggleFloat,
              togglePip: toggleFloat, hasPip: function(){ return HAS_PIP; } };
})();
