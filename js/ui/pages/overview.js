/* 帝王总览：四资源 / 今日治学 / 批阅中奏折 / 六大宫门 */
(function(){
  var CFG = QZD.config;
  var UI = QZD.ui;

  function resRow(s){
    return CFG.RESOURCES.map(function(r){
      return '<div class="pill">' +
        '<i class="dot" style="background:' + r.color + '"></i>' +
        '<span class="pill-name">' + r.name + '</span>' +
        '<b class="pill-val" id="ov-res-' + r.key + '">' + UI.fmt.num(s.resources[r.key]) + '</b>' +
      '</div>';
    }).join('');
  }

  /* 纵向资源列（皇帝卡右侧，每项一行） */
  function resCol(s){
    return CFG.RESOURCES.map(function(r){
      return '<div class="pill">' +
        '<i class="dot" style="background:' + r.color + '"></i>' +
        '<span class="pill-name">' + r.name + '</span>' +
        '<b class="pill-val" id="ov-res-' + r.key + '">' + UI.fmt.num(s.resources[r.key]) + '</b>' +
      '</div>';
    }).join('');
  }

  /* 今日专注总时长直接读 study 记录（不再依赖任务） */
  function todayFocus(){
    var st = QZD.study.snapshot();
    return st.doneMin;
  }

  function todayPanel(s){
    var st = QZD.study.snapshot();
    var ck = st.checkin || { total: 0, done: 0, score: 0, allDone: false };
    return '<section class="card">' +
      '<div class="card-head"><span class="card-title">今日治学</span>' +
      '<span class="card-note">打卡次日 0 时归档</span></div>' +
      '<p class="today-line">今日专注 <b id="ov-focus">' + UI.fmt.num(st.doneMin) + '</b> 分钟 · ' +
      '打卡 <b id="ov-taskdone">' + ck.done + ' / ' + ck.total + '</b> 完成</p>' +
      '<div class="bar"><i id="ov-taskbar" style="width:' + ck.score + '%"></i></div>' +
    '</section>';
  }

  function rate(num){
    return (Math.round((num || 0) * 100) / 100).toFixed(2);
  }

  function realmPanel(s){
    var K = QZD.conquest;
    var C = CFG.CONQUEST;
    var owned = K.ownedList().length;
    var totals = K.totals();
    var power = K.power();
    var buff = QZD.checkin.buffValue();
    var next = K.nextTarget();
    var pct = Math.round(owned / C.CITIES.length * 100);
    var war = QZD.formulas.ministerWarBonus();
    var mult = QZD.formulas.tributeMultiplier();
    var fielded = QZD.ministers.fieldedCount();
    var wPer = QZD.works.perMinute();
    var wTribute = QZD.works.tributeBonus();
    var wPower = QZD.works.powerBonus();

    return '<section class="card">' +
      '<div class="card-head"><span class="card-title">江 山</span>' +
      (buff
        ? '<span class="badge buff">战力 +' + Math.round(buff * 100) + '%</span>'
        : '<span class="card-note">宏图征伐 · M2</span>') + '</div>' +
      '<p class="today-line">战力 <b>' + UI.fmt.num(power) + '</b> · 属城 <b>' +
        owned + ' / ' + C.CITIES.length + '</b> · 贡赋 金 +' + rate(totals.jinQian) +
        '/分 · 国 +' + rate(totals.guoJin) + '/分</p>' +
      '<div class="bar"><i style="width:' + pct + '%"></i></div>' +
      '<p class="page-foot" style="margin:10px 4px 0">名臣上阵 ' + fielded + ' 人 · 战力 +' +
        UI.fmt.num(war) + ' · 贡赋 ×' + (Math.round(mult * 100) / 100).toFixed(2) + '</p>' +
      '<p class="page-foot" style="margin-top:6px">营造 金 +' + rate(wPer.jinQian) +
        '/分 · 国 +' + rate(wPer.guoJin) + '/分 · 贡赋 +' + Math.round(wTribute * 100) +
        '% · 战力 +' + Math.round(wPower * 100) + '%</p>' +
      '<p class="page-foot" style="margin-top:6px">' +
        (next
          ? '下一目标：「' + next.name + '」守备 ' + next.defense + ' · 战力达标即可出征'
          : '十二城尽归版图，四海宾服。') +
      '</p>' +
    '</section>';
  }

  function memorialPanel(s){
    var M = QZD.memorials;
    var POMO = QZD.pomodoro;
    var now = Date.now();
    var list = (s.memorials || []).filter(function(m){
      if(m.status === 'pizhong') return true;
      return m.status === 'banjie' && m.id === M.flash.id && now < M.flash.until;
    }).sort(function(a, b){ return b.createdAt - a.createdAt; }).slice(0, 3);

    var body;
    if(!list.length){
      body = '<div class="empty">尚无批阅中的奏折<span class="card-note">到「今日勤政」新建奏折并开始专注</span></div>';
    }else{
      body = '<div class="mem-list">' + list.map(function(m){
        var pr = M.progress(m);
        var flashing = m.id === M.flash.id && now < M.flash.until;
        var action;
        if(m.status === 'banjie'){
          action = '<span class="badge ok">已办结</span>';
        }else if(POMO.isActive() && POMO.boundId() === m.id){
          action = '<button class="btn ghost" disabled>专注中</button>';
        }else if(POMO.isActive()){
          action = '<button class="btn ghost" disabled>另有专注中</button>';
        }else{
          action = '<button class="btn primary" data-pomo-start="' + m.id + '">继续专注</button>';
        }
        return '<div class="mem-card' + (flashing ? ' flash' : '') + '">' +
          '<div class="mem-top">' +
            '<div class="mem-title">' + UI.fmt.escape(m.title) + '</div>' +
            '<div class="mem-actions">' + action + '</div>' +
          '</div>' +
          '<div class="mem-badges">' +
            '<span class="badge tag">' + M.tagName(m.tag) + '</span>' +
            '<span class="badge ' + M.priorityCls(m.priority) + '">' + M.priorityName(m.priority) + '</span>' +
            '<span class="badge status-' + m.status + '">' + M.statusName(m.status) + '</span>' +
            '<span class="badge">累计 ' + pr.focusMin + ' 分 · ' + pr.sessions + ' 次</span>' +
          '</div>' +
          '<div class="mem-progress">' +
            '<div class="bar"><i style="width:' + pr.pct + '%"></i></div>' +
            '<span>' + (pr.total ? '小目标 ' + pr.done + ' / ' + pr.total : '专注 ' + pr.focusMin + ' 分钟') + '</span>' +
          '</div>' +
        '</div>';
      }).join('') + '</div>';
    }
    return '<section class="card">' +
      '<div class="card-head"><span class="card-title">批阅中的奏折</span></div>' +
      body +
    '</section>';
  }

  /* 科研台账：今日 / 本周 / 长期一屏看完，点任一项跳到对应页面 */
  function ledgerItem(goto, k, v, sub, barPct){
    return '<div class="ledger-item" data-goto="' + goto + '" role="button" tabindex="0">' +
      '<span class="ledger-k">' + k + '</span>' +
      '<b class="ledger-v">' + v + '</b>' +
      (barPct === undefined ? '' : '<div class="bar"><i style="width:' + barPct + '%"></i></div>') +
      '<span class="ledger-s">' + sub + '</span>' +
    '</div>';
  }

  function researchPanel(){
    var st = QZD.study.snapshot();

    /* 多部书稿合并算整体进度：Σ当前量 / Σ目标量 */
    var cur = 0, tgt = 0, books = QZD.thesis ? QZD.thesis.list() : [];
    books.forEach(function(t){
      (t.sections || []).forEach(function(x){ cur += (x.current || 0); tgt += (x.target || 0); });
    });
    var thPct = tgt > 0 ? Math.round(cur / tgt * 100) : 0;

    var idea = QZD.idea ? QZD.idea.stats() : { total: 0, hatched: 0 };

    var roots = QZD.goals ? QZD.goals.roots() : [];
    var gSum = 0;
    roots.forEach(function(n){ gSum += QZD.goals.effective(n); });
    var gPct = roots.length ? Math.round(gSum / roots.length) : 0;

    /* 高峰时段：hourStats 里累计最长的那一小时 */
    var hs = (QZD.state.study && QZD.state.study.hourStats) || {};
    var peakH = null, peakV = 0;
    Object.keys(hs).forEach(function(k){
      if((hs[k] || 0) > peakV){ peakV = hs[k]; peakH = parseInt(k, 10); }
    });

    return '<section class="card">' +
      '<div class="card-head"><span class="card-title">科 研 台 账</span>' +
      '<span class="card-note">点任一项进入对应衙门</span></div>' +
      '<div class="ledger-grid">' +
        ledgerItem('tasks', '今日专注', st.doneMin + ' 分', '本周累计 ' + st.week + ' 分') +
        ledgerItem('library', '文渊阁', 'Zotero',
          '文献由 Zotero 统一管理') +
        ledgerItem('thesis', '修书进度', thPct + '%',
          (books.length ? books.length + ' 部书稿' : '尚未立书'), thPct) +
        ledgerItem('idea', '灵感待孵化', String(idea.total - idea.hatched),
          '共 ' + idea.total + ' 条 · 已孵化 ' + idea.hatched) +
        ledgerItem('goals', '千秋大计', gPct + '%',
          (roots.length ? roots.length + ' 个方向' : '尚未立目标'), gPct) +
        ledgerItem('chronos', '高效时段',
          (peakH === null ? '—' : peakH + ':00'),
          (peakH === null ? '数据不足' : '累计 ' + Math.round(peakV) + ' 分')) +
      '</div>' +
    '</section>';
  }

  function gateGrid(){
    var unlocked = {
      keju:      { attr: 'data-goto="roster"',   hint: '开科取士 · 已解锁' },
      xiuxiu:    { attr: 'data-harem="consorts"', hint: '选秀纳妃 · 已解锁' },
      zhenbao:   { attr: 'data-goto="treasure"', hint: '珍宝丹药 · 已解锁' },
      junbei:    { attr: 'data-goto="works"',    hint: '营造工程 · 已解锁' },
      qingong:   { attr: 'data-harem="consorts"', hint: '召幸承嗣 · 已解锁' }
    };
    return '<section class="card">' +
      '<div class="card-head"><span class="card-title">宫门</span>' +
      '<span class="card-note">五门皆启</span></div>' +
      '<div class="gates">' + CFG.GATES.map(function(g){
        var u = unlocked[g.id];
        if(u){
          return '<div class="gate unlocked" ' + u.attr + ' role="button" tabindex="0">' +
            '<b>' + g.name + '</b><span>' + u.hint + '</span></div>';
        }
        return '<div class="gate"><b>' + g.name + '</b><span>未解锁</span></div>';
      }).join('') + '</div>' +
    '</section>';
  }

  /* 皇帝立绘：king 文件夹内可自由更换 */
  function emperorPanel(s){
    var list = (QZD.ASSETS && QZD.ASSETS.emperor) || [];
    var cur = s.emperorPortrait || list[0] || '';
    return '<section class="card emperor-card">' +
      '<div class="emperor-face">' +
        (cur
          /* 用背景图而非 <img>：总览每秒重绘时不会重新加载图片造成闪烁 */
          ? '<div class="emperor-photo" style="background-image:url(\'' +
              UI.fmt.escape(cur) + '\')"></div>'
          : '<div class="empty" style="padding:12px">未找到 king 立绘</div>') +
      '</div>' +
      '<div class="emperor-main">' +
        '<div class="emperor-name">' + UI.fmt.escape(s.meta.emperorName) +
          ' <span class="badge rank">皇帝</span></div>' +
        '<div class="emperor-res"><div class="emperor-res-list">' + resCol(s) + '</div></div>' +
        '<p class="page-foot">' + (list.length
          ? '共 ' + list.length + ' 张立绘 · 可自由更换'
          : '在 assets/images/king/ 放图后运行 node scripts/gen_manifest.js') + '</p>' +
        '<div class="btn-row">' +
          '<button class="btn ghost" data-pick-emperor' + (list.length ? '' : ' disabled') +
            '>更换立绘</button>' +
        '</div>' +
      '</div>' +
    '</section>';
  }

  /* 总览页：皇帝卡 → 今日 → 科研台账 → 江山 → 奏折 → 宫门 */
  function overviewBody(){
    var s = QZD.state;
    return emperorPanel(s) +
      todayPanel(s) + researchPanel() + realmPanel(s) + memorialPanel(s) + gateGrid();
  }

  UI.register('overview', overviewBody);

  document.addEventListener('click', function(e){
    var btn = e.target.closest('[data-pick-emperor]');
    if(!btn || btn.disabled) return;

    var list = (QZD.ASSETS && QZD.ASSETS.emperor) || [];
    if(!list.length) return;

    var body = '<div class="emp-pick">' + list.map(function(src, i){
      return '<button class="emp-thumb' + (src === QZD.state.emperorPortrait ? ' active' : '') +
        '" data-emp-src="' + UI.fmt.escape(src) + '">' +
        '<img src="' + UI.fmt.escape(src) + '" alt="立绘' + (i + 1) + '"></button>';
    }).join('') + '</div>';

    var m = UI.modal({ title: '更换皇帝立绘', body: body, ok: false, cancelText: '关闭' });
    m.root.addEventListener('click', function(ev){
      var t = ev.target.closest('[data-emp-src]');
      if(!t) return;
      QZD.state.emperorPortrait = t.getAttribute('data-emp-src');
      QZD.stateIO.save();
      /* 直接换背景图，不重建页面 —— 更换就是更换，不闪也不加动画 */
      var ph = document.querySelector('.emperor-photo');
      if(ph) ph.style.backgroundImage = "url('" + QZD.state.emperorPortrait + "')";
      m.close();
      UI.toast('皇帝立绘已更换');
    });
  });

  /* 每秒只更新数字，不重建 DOM —— 皇帝立绘因此完全不会闪 */
  QZD.overview = {
    tick: function(){
      var s = QZD.state;
      var f = document.getElementById('ov-focus');
      if(f) f.textContent = UI.fmt.num(todayFocus());

      var td = document.getElementById('ov-taskdone');
      var bar = document.getElementById('ov-taskbar');
      if(td || bar){
        var ck = QZD.checkin.todayStat();
        if(td) td.textContent = ck.done + ' / ' + ck.total;
        if(bar) bar.style.width = ck.score + '%';
      }

      CFG.RESOURCES.forEach(function(r){
        var el = document.getElementById('ov-res-' + r.key);
        if(el) el.textContent = UI.fmt.num(s.resources[r.key]);
      });
    }
  };
})();
