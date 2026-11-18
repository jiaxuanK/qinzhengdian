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
  var CFG = QZD.config;
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
        /* 晨课：早上开场发签约金（已到账）+ 本场金钱倍率 + 弹特殊剧情 */
        if(QZD.morning){
          var mr = QZD.morning.onFocusStart({ companionId: selectedCompanion });
          if(mr.ok){
            QZD.pomodoro.markMorning(mr.sign);
            var sg = mr.sign || {};
            UI.toast('晨课 · 签约金 国库 +' + (sg.jinQian || 0) +
              ' · 勤政 +' + (sg.qinZheng || 0) + ' · 本场钱银 ×' + mr.rate);
            if(mr.scene && QZD.story && QZD.story.queuePresent){
              QZD.story.queuePresent({ kind: 'morning', scene: mr.scene,
                consortId: mr.consortId || '', consortName: mr.consort ? mr.consort.name : '' });
            }
          }else{
            UI.toast('专注开始 · 做完点「完成并退出」');
          }
        }else{
          UI.toast('专注开始 · 做完点「完成并退出」');
        }
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
      var ready = QZD.pomodoro.companionRewardReady();
      var count = QZD.pomodoro.companionRewardCount ? QZD.pomodoro.companionRewardCount() : 0;
      var need = (CFG.POMODORO.COMPANION_REWARD_MIN || 25);
      var remain = QZD.pomodoro.companionRewardRemaining ? QZD.pomodoro.companionRewardRemaining() : need;
      var tagTxt = ready ? ('可领 · 与她相处（第 ' + (count + 1) + ' 次）')
                         : ('距下次相处还差 ' + remain + ' 分' + (count ? ' · 已领 ' + count + ' 次' : ''));
      var doing = QZD.harem.companionDoing ? QZD.harem.companionDoing(comp) : '';
      compHtml =
        '<div class="pomo-companion' + (ready ? ' reward-ready' : '') + '" data-pomo-companion ' +
          'title="' + (ready ? '已满 25 分，点击免费相处一次' : '轻点看她在做什么') + '">' +
          '<div class="pomo-comp-avatar">' + cp +
            (ready ? '<span class="pomo-comp-badge">可相处</span>' : '') + '</div>' +
          '<div class="pomo-comp-info">' +
            '<span class="pomo-comp-name">' + UI.fmt.escape(comp.name) + '</span>' +
            '<span class="pomo-comp-doing" id="pomo-comp-doing">' + UI.fmt.escape(doing) + '</span>' +
            '<span class="pomo-comp-tag" id="pomo-comp-tag">' + tagTxt + '</span>' +
          '</div>' +
        '</div>';
    }
    var floating = !!floatHost();
    var floatBtnTitle = floating ? '回到页面' : '开独立悬浮窗（缩小主窗口仍可见）';
    var floatBtnIcon = floating ? '▣' : '⧉';
    var headBtns =
      '<span class="pomo-head-btns">' +
        '<button type="button" class="pomo-ico" data-pomo="reset-size" title="恢复卡片默认大小（拖小后可点此还原）">⤢</button>' +
        '<button type="button" class="pomo-ico" data-pomo="zen" title="沉浸全屏（Esc 退出）">◉</button>' +
        '<button type="button" class="pomo-ico" data-pomo="idea" title="记下此刻灵感（不中断专注）">💡</button>' +
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

    /* 陪伴奖励状态：每满 25 分点亮一次入口，不重建整卡（避免输入框/拖拽丢失） */
    var comp = p.companionId ? QZD.harem.consortById(p.companionId) : null;
    if(comp){
      var ready = QZD.pomodoro.companionRewardReady && QZD.pomodoro.companionRewardReady();
      var count = QZD.pomodoro.companionRewardCount ? QZD.pomodoro.companionRewardCount() : 0;
      var remain = QZD.pomodoro.companionRewardRemaining ? QZD.pomodoro.companionRewardRemaining() : 25;
      var tag = card.querySelector('#pomo-comp-tag');
      if(tag) setText(card, '#pomo-comp-tag', ready
        ? ('可领 · 与她相处（第 ' + (count + 1) + ' 次）')
        : ('距下次相处还差 ' + remain + ' 分' + (count ? ' · 已领 ' + count + ' 次' : '')));
      var wrap = card.querySelector('.pomo-companion');
      if(wrap && wrap.classList) wrap.classList.toggle('reward-ready', !!ready);
      if(ready && wrap && !wrap.querySelector('.pomo-comp-badge')){
        var av = wrap.querySelector('.pomo-comp-avatar');
        if(av){ var b = card.ownerDocument.createElement('span'); b.className='pomo-comp-badge'; b.textContent='可相处'; av.appendChild(b); }
      }
      if(!ready && wrap){
        var badge = wrap.querySelector('.pomo-comp-badge');
        if(badge && badge.parentNode) badge.parentNode.removeChild(badge);
      }
    }
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

  /* 专注时速记灵感：轻量模态框，Ctrl+Enter 秒存，Esc 关闭，不中断专注计时 */
  function openQuickIdea(){
    if(!QZD.idea){ UI.toast('灵感罐系统未加载'); return; }
    /* 已有打开的速记框？关掉 */
    var old = document.querySelector('.modal-backdrop[data-quick-idea]');
    if(old){ old.remove(); }
    var html = '<div class="modal-backdrop" data-quick-idea>' +
      '<div class="modal quick-idea" style="min-width:280px">' +
        '<h3 style="margin:0 0 6px;font-size:14px">💡 记下此刻灵感</h3>' +
        '<textarea id="quick-idea-text" maxlength="300" rows="3" placeholder="别让它溜走…（Ctrl/⌘+Enter 秒存）" style="width:100%;padding:8px;font-size:13px;border:1px solid #d8d2c4;border-radius:6px;background:#faf7f0;font-family:inherit;resize:vertical"></textarea>' +
        '<div style="display:flex;gap:6px;margin-top:6px">' +
          '<input id="quick-idea-tag" maxlength="16" placeholder="标签（选填）" style="flex:1;padding:5px 8px;font-size:12px;border:1px solid #d8d2c4;border-radius:4px;background:#faf7f0">' +
          '<button class="btn primary" id="quick-idea-save" style="padding:5px 12px;font-size:12px">落 笔</button>' +
        '</div>' +
      '</div>' +
    '</div>';
    var overlay = document.createElement('div');
    overlay.innerHTML = html;
    document.body.appendChild(overlay);
    /* 自动 focus textarea */
    setTimeout(function(){
      var ta = document.getElementById('quick-idea-text');
      if(ta){ ta.focus(); }
    }, 50);
    /* 事件 */
    var onKey = function(e){
      if(e.key === 'Escape'){ overlay.remove(); document.removeEventListener('keydown', onKey); }
      if((e.ctrlKey || e.metaKey) && e.key === 'Enter'){
        e.preventDefault(); doQuickIdea();
      }
    };
    document.addEventListener('keydown', onKey);
    overlay.addEventListener('click', function(e){
      if(e.target === overlay){ overlay.remove(); document.removeEventListener('keydown', onKey); }
      if(e.target.id === 'quick-idea-save') doQuickIdea();
    });
    function doQuickIdea(){
      var text = document.getElementById('quick-idea-text').value;
      var tag = document.getElementById('quick-idea-tag').value;
      var r = QZD.idea.add(text, tag);
      if(!r.ok){ UI.toast(r.error); return; }
      overlay.remove();
      document.removeEventListener('keydown', onKey);
      UI.toast('已入灵感罐 · 专注不中断');
    }
  }

  function bindCard(card, inFloat){
    card.onclick = function(e){
      try {
        var floatBtn = e.target.closest('[data-pomo="float"]');
        if(floatBtn){ toggleFloat(); return; }

        var ideaBtn = e.target.closest('[data-pomo="idea"]');
        if(ideaBtn){ openQuickIdea(); return; }

      var collapseBtn = e.target.closest('[data-pomo="collapse"]');
      if(collapseBtn){ pomoCompact = !pomoCompact; persistCompact(); render(); return; }

      /* 恢复默认大小：清掉用户 resize 拖出来的 inline 宽高，并退出紧凑模式 */
      var resetBtn = e.target.closest('[data-pomo="reset-size"]');
      if(resetBtn){
        var resetCard = document.getElementById('pomo-card');
        if(resetCard){ resetCard.style.width = ''; resetCard.style.height = ''; }
        if(pomoCompact){ pomoCompact = false; persistCompact(); }
        render();
        UI.toast('已恢复专注卡默认大小');
        return;
      }

      var compEl = e.target.closest('[data-pomo-companion]');
      if(compEl){
        var cid = QZD.state.pomodoro.companionId;
        var cc = cid ? QZD.harem.consortById(cid) : null;
        if(cc){
          /* 满 25 分：领奖 + 弹出一段相处剧情（不打断专注计时） */
          if(QZD.pomodoro.companionRewardReady()){
            var r = QZD.pomodoro.claimCompanionReward();
            if(r.ok){
              var lines = CFG.COMPANION_REWARD_LINES || [];
              var text = lines.length ? lines[Math.floor(Date.now()/60000) % lines.length] : '';
              var body = '<p style="font-size:14px;line-height:1.9">' + UI.fmt.escape(text) + '</p>' +
                '<p class="card-note">本场第 ' + r.count + ' 次相处 · 免费 · 喜爱 +' +
                  r.favorGain + ' · 宠爱 +' + r.doteGain + '</p>' +
                '<p class="card-note">每再专注满 ' + (CFG.POMODORO.COMPANION_REWARD_MIN||25) +
                  ' 分可再领一次；计时照常进行，收起后继续专注。</p>';
              UI.modal({ title: '与「' + UI.fmt.escape(cc.name) + '」相处', body: body,
                         ok:false, cancelText:'继续专注' });
              if(card.ownerDocument === document) UI.toast('与 ' + cc.name + ' 相处 · 喜爱 +' + r.favorGain + ' 宠爱 +' + r.doteGain);
              render();
              return;
            }
          }
          /* 未满：旧问候 + 她此刻在做什么，轻互动 */
          var doing = QZD.harem.companionDoing ? QZD.harem.companionDoing(cc) : '';
          var line = cc.name + '：' + QZD.harem.companionGreeting(cc);
          var tag = card.ownerDocument.getElementById('pomo-comp-tag');
          if(tag){
            tag.textContent = line;               /* 问候语在名字条内浮现 */
            if(tag._revertT) clearTimeout(tag._revertT);
            tag._revertT = setTimeout(function(){
              var count = QZD.pomodoro.companionRewardCount ? QZD.pomodoro.companionRewardCount() : 0;
              var remain = QZD.pomodoro.companionRewardRemaining ? QZD.pomodoro.companionRewardRemaining() : 25;
              tag.textContent = QZD.pomodoro.companionRewardReady()
                ? ('可领 · 与她相处（第 ' + (count + 1) + ' 次）')
                : ('距下次相处还差 ' + remain + ' 分' + (count ? ' · 已领 ' + count + ' 次' : ''));
            }, 5000);
          }
          /* 把「她在做什么」也显示到 doing 行 */
          var dl = card.ownerDocument.getElementById('pomo-comp-doing');
          if(dl) dl.textContent = doing;
          if(card.ownerDocument === document) UI.toast(line);
        }
        return;
      }

      var btn = e.target.closest('[data-pomo]');
      if(!btn) return;
      var act = btn.getAttribute('data-pomo');

      /* 沉浸全屏：只读计时，不碰任何结算逻辑；收工/暂离时自动退出 */
      if(act === 'zen'){
        openZen();
        return;
      }

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
          if(r2 && r2.type === 'abandoned') setTimeout(function(){ promptAbandonReason(r2); }, 80);
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
    /* 固定合理尺寸：宽 320px 够显示完整卡片（companion + 时钟 + gains + 按钮），
       高 460px 留出边距 + 不遮挡太多屏幕内容；小屏自适应缩小 */
    var w = 320, h = 460;
    if(sh < 600){ h = Math.max(320, Math.round(sh * 0.7)); w = Math.round(h * 320 / 460); }
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
          /* 回退守卫：Electron / 画中画部分支持的环境里，
             copyStyles + render 可能静默失败 → 500ms 后如果 pip body 还是空的，
             主动关 pip 窗口，走 enterPop 独立窗 */
          pip._fallbackTimer = pip.setTimeout(function(){
            try {
              var b = pip.document && pip.document.body;
              if(b && (b.children.length === 0 || !b.querySelector('#pomo-card, .pomo-card'))){
                pip.clearTimeout(pip._fallbackTimer);
                pip._fallbackTimer = null;
                try { pip.close(); } catch(_){}
                pipWin = null;
                pipOpening = false;
                UI.toast('画中画环境空白，自动改用独立窗口');
                enterPop();
                return;
              }
            } catch(e){ /* pip 已关闭 */ }
          }, 600);

          pip._timer = pip.setInterval(function(){
            if(pipWin === pip) updateLive(pip.document);
          }, 1000);
          pip.addEventListener('pagehide', function(){
            if(pip._timer) pip.clearInterval(pip._timer);
            if(pip._fallbackTimer) pip.clearTimeout(pip._fallbackTimer);
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
      /* 修复：exitPip() 不再 return，避免 pipWin 僵尸状态阻塞 open
         （浏览器可能已关画中画但 JS 变量没清） */
      if(pipWin){
        try { exitPip(); } catch(_){}
      }
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
        wn = window.open('', 'qzd_pomo_float',
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
      /* 立刻 document.write 一个自包含 HTML */
      try {
        var pomoState = QZD.state.pomodoro || {};
        var cardHTML = buildCard(pomoState, !!pomoState.paused);
        /* 浮窗 document.write 出的页面基址是 about:blank，相对图片路径
           会解析成 about:blank/assets/... 加载失败、只剩 alt 文字。
           写入前把所有相对 src 转成基于主页面的绝对 URL。 */
        var baseHref = (location && location.href) ? location.href : '';
        cardHTML = cardHTML.replace(/\ssrc="([^"]+)"/g, function(m, src){
          if(/^(https?:|data:|blob:|\/\/)/i.test(src)) return m;
          try { return ' src="' + new URL(src, baseHref).href + '"'; }
          catch(e){ return m; }
        });
        wn.document.open();
        wn.document.write(
          '<!DOCTYPE html><html><head><meta charset="utf-8">' +
          '<meta name="viewport" content="width=device-width,initial-scale=1">' +
          '<title>勤政殿·专注</title>' +
          '<style>' +
          '*{box-sizing:border-box}html,body{margin:0;padding:10px;background:#f4efe6;color:#3d3a34;font-family:"STKaiti","楷体",serif}' +
          '#pomo-card{width:100%;max-width:300px;margin:0 auto;border:1px solid #d8d2c4;border-radius:10px;padding:14px;background:#faf7f0;box-shadow:0 2px 12px rgba(0,0,0,0.08)}' +
          '#pomo-card.paused{opacity:0.75}#pomo-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:6px}' +
          '#pomo-card .pomo-title{font-size:15px;color:#5a574f;font-weight:500}' +
          '#pomo-card .badge{font-size:9px;padding:1px 6px;border-radius:3px;background:#e8ddd0;color:#6b6558}' +
          '#pomo-card .badge.ok{background:#c3d4c0;color:#3d5a3a}' +
          '#pomo-card .pomo-head-btns{display:flex;gap:2px}' +
          '#pomo-card .pomo-ico{background:none;border:1px solid transparent;color:#8a8574;font-size:13px;cursor:pointer;padding:2px 4px;border-radius:3px}' +
          '#pomo-card .pomo-ico:hover{background:#efe8d6;border-color:#d8d2c4}' +
          '#pomo-card .pomo-mem{margin:4px 0;text-align:center;font-size:13px;color:#5a574f;line-height:1.4}' +
          '#pomo-card .pomo-clock{text-align:center;font-size:34px;font-weight:200;color:#2f3328;letter-spacing:2px;font-variant-numeric:tabular-nums;margin:8px 0 4px}' +
          '#pomo-card .pomo-sub{text-align:center;font-size:10px;color:#9a9790;margin:2px 0}' +
          '#pomo-card .pomo-companion{display:flex;align-items:center;gap:8px;margin-top:8px;padding:6px;background:#f4efe6;border-radius:6px}' +
          '#pomo-card .pomo-comp-avatar{position:relative}' +
          '#pomo-card .pomo-comp-avatar img, #pomo-card .pomo-comp-avatar svg{width:40px;height:48px;border-radius:50%;object-fit:cover}' +
          '#pomo-card .pomo-comp-info{flex:1;display:flex;flex-direction:column;gap:1px}' +
          '#pomo-card .pomo-comp-name{font-size:12px;color:#3d3a34;font-weight:500}' +
          '#pomo-card .pomo-comp-doing{font-size:10px;color:#8a8574}' +
          '#pomo-card .pomo-comp-tag{font-size:9px;color:#9a9790}' +
          '#pomo-card .pomo-gains{display:flex;justify-content:center;gap:10px;margin-top:10px;font-size:10px;color:#8a8574}' +
          '#pomo-card .pomo-gains span{padding:1px 4px;background:#f4efe6;border-radius:3px}' +
          '#pomo-card .pomo-cum{text-align:center;font-size:9px;color:#aaa599;margin-top:4px}' +
          '#pomo-card .pomo-btns{display:flex;justify-content:center;gap:6px;margin-top:10px}' +
          '#pomo-card .btn{padding:5px 12px;font-size:11px;border-radius:4px;cursor:pointer;border:1px solid #d8d2c4;background:#faf7f0;color:#3d3a34;font-family:inherit}' +
          '#pomo-card .btn.primary{background:#2f3328;color:#f4efe6;border-color:#2f3328}' +
          '#pomo-card .btn.primary:hover{background:#4a4f42}' +
          '#pomo-card .btn.ghost{background:transparent}' +
          '#pomo-card .btn.ghost:hover{background:#efe8d6}' +
          '#pomo-card .pomo-note{text-align:center;font-size:9px;color:#bbb5a8;margin-top:6px}' +
          '#pomo-card img.portrait{width:40px;height:48px;border-radius:50%;object-fit:cover}' +
          '</style></head><body>' +
          cardHTML +
          '</body></html>'
        );
        wn.document.close();
        UI.toast('已开独立悬浮窗');
      } catch(re){
        /* 如果 document.write 也失败（极端情况），至少写个静态占位 */
        try {
          wn.document.open();
          wn.document.write('<html><head><meta charset="utf-8"><title>专注</title>' +
            '<style>body{font-family:serif;background:#f4efe6;padding:20px;text-align:center;color:#3d3a34}' +
            '.t{font-size:36px;font-weight:300;font-variant-numeric:tabular-nums;margin:20px 0}</style></head><body>' +
            '<div class="companion">专注中…</div><div class="t" id="pomo-time">00:00</div>' +
            '</body></html>');
          wn.document.close();
          UI.toast('已开独立悬浮窗（基础模式）');
        } catch(_){
          UI.toast('完全无法打开悬浮窗，已留在页面内');
          try { wn.close(); } catch(_){}
          popWin = null;
          return;
        }
      }
      /* 每秒更新时间显示 */
      wn._timer = wn.setInterval(function(){
        if(popWin !== wn || wn.closed){ wn.clearInterval(wn._timer); return; }
        var p = QZD.state.pomodoro;
        if(!p) return;
        try {
          var el = wn.document.querySelector('#pomo-card .pomo-time');
          if(el) el.textContent = formatMMSS(p.elapsed);
          /* companion text 也更新 */
          var el2 = wn.document.querySelector('#pomo-card .pomo-title');
          if(el2) el2.textContent = p.boundTitle || '';
        } catch(_){}
      }, 1000);
      wn.addEventListener('beforeunload', function(){
        if(wn._timer) wn.clearInterval(wn._timer);
        popWin = null; structSig = ''; render();
      });
      render();  /* 主页面自己也要显示卡片 */
      return;    /* 后续代码都不执行（旧的 mount 逻辑废弃） */
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

  /* ---------- 沉浸全屏（P3）：暗底 + 大字计时 + 缓慢呼吸环，无闪烁 ----------
     自己挂 interval 每秒只改 #zen-clock 的文本，不重建 DOM；
     Esc / 点退出按钮 / 收工或暂离（isActive 变 false）都会自动关闭。 */
  var zenTimer = null;
  function ensureZenNode(){
    var el = document.getElementById('zen-overlay');
    if(el) return el;
    el = document.createElement('div');
    el.id = 'zen-overlay';
    el.className = 'zen-overlay';
    el.style.display = 'none';
    el.innerHTML =
      '<div class="zen-ring"></div>' +
      '<div class="zen-clock" id="zen-clock">00:00</div>' +
      '<div class="zen-title" id="zen-title"></div>' +
      '<button type="button" class="zen-exit" data-zen-exit>退出沉浸（Esc）</button>';
    document.body.appendChild(el);
    el.addEventListener('click', function(e){
      if(e.target.closest('[data-zen-exit]')) closeZen();
    });
    return el;
  }
  function openZen(){
    if(!QZD.pomodoro.isActive()){ UI.toast('先开始一场专注，再进入沉浸'); return; }
    var el = ensureZenNode();
    var t = document.getElementById('zen-title');
    if(t) t.textContent = boundTitle() || '专注中';
    el.style.display = 'flex';
    var c = document.getElementById('zen-clock');
    if(c) c.textContent = clock(QZD.pomodoro.elapsedSec(Date.now()));
    if(zenTimer) clearInterval(zenTimer);
    zenTimer = setInterval(function(){
      if(!document.getElementById('zen-clock') || !QZD.pomodoro.isActive()){ closeZen(); return; }
      document.getElementById('zen-clock').textContent = clock(QZD.pomodoro.elapsedSec(Date.now()));
    }, 1000);
  }
  function closeZen(){
    var el = document.getElementById('zen-overlay');
    if(el) el.style.display = 'none';
    if(zenTimer){ clearInterval(zenTimer); zenTimer = null; }
  }
  document.addEventListener('keydown', function(e){
    if(e.key === 'Escape') closeZen();
  });

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

  /* 专注台页面：开始新专注（先新建奏折）*/
  document.addEventListener('click', function(e){
    var btn = e.target.closest('[data-focus-new]');
    if(!btn) return;
    if(QZD.pomodoro.isActive()){ UI.toast('已有专注正在进行'); return; }
    /* 新建一个批阅中的奏折 */
    var m = QZD.memorials.add({ title: '专注', tag: 'hanlin' });
    QZD.memorials.setStatus(m.id, 'pizhong');
    openMemorial(m.id, null);
  });

  /* 专注台页面：继续某个奏折的专注 */
  document.addEventListener('click', function(e){
    var btn = e.target.closest('[data-focus-continue]');
    if(!btn) return;
    openMemorial(btn.getAttribute('data-focus-continue'), null);
  });

  UI.pomo = { render: render, openMemorial: openMemorial, toggleFloat: toggleFloat,
              togglePip: toggleFloat, hasPip: function(){ return HAS_PIP; } };
})();
