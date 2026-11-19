/* 帝王总览：四资源 / 今日治学 / 批阅中奏折 / 六大宫门 */
(function(){
  var CFG = QZD.config;
  var UI = QZD.ui;
  var qlEditingId = null; /* 管理面板正在编辑的标签 id */

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
    var power = K.power();
    var totals = K.totals();
    var next = K.nextTarget();
    var pct = Math.round(owned / C.CITIES.length * 100);
    var buff = QZD.checkin.buffValue();

    return '<section class="card">' +
      '<div class="card-head"><span class="card-title">江 山</span>' +
      (buff
        ? '<span class="badge buff">战力 +' + Math.round(buff * 100) + '%</span>'
        : '<span class="card-note">宏图征伐</span>') + '</div>' +
      '<p class="today-line">战力 <b>' + UI.fmt.num(power) + '</b> · 属城 <b>' +
        owned + ' / ' + C.CITIES.length + '</b> · 贡赋 金+' + (totals.jinQian||0).toFixed(2) +
        '/分 国+' + (totals.guoJin||0).toFixed(2) + '/分</p>' +
      '<div class="bar"><i style="width:' + pct + '%"></i></div>' +
      (next
        ? '<p class="page-foot" style="margin:8px 4px 0">下一目标：「' + next.name +
          '」守备 ' + next.defense + ' · 战力达标即可出征</p>'
        : '<p class="page-foot" style="margin:8px 4px 0">十二城尽归版图，四海宾服。</p>') +
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

  /* ---------- 今日行动区：按当前状态给几条可点的下一步 ---------- */
  function actionPanel(){
    var items = [];
    var M = QZD.memorials, POMO = QZD.pomodoro || {};
    var st = QZD.study.snapshot();
    var nowActive = !!(POMO.isActive && POMO.isActive());

    /* 1. 正在专注 → 查看计时（不提供重复开始） */
    if(nowActive){
      var bound = POMO.boundId && POMO.boundId();
      items.push({ icon:'◷', title:'正在专注', sub:'已专注 ' + Math.round(POMO.realizedMinutes ? POMO.realizedMinutes() : st.doneMin) + ' 分',
                   act:'goto', target:'tasks', tone:'hot' });
    }else{
      /* 2. 有批阅中奏折 → 继续专注 */
      var pizhong = (QZD.state.memorials || []).filter(function(m){ return m.status === 'pizhong'; });
      /* 11-18：跳到奏折列表让用户自己选，不再直接 start 第一项
         （原来强制批阅设定的那一折，没有选择空间） */
      if(pizhong.length){
        items.push({ icon:'▸', title:'继续批阅', sub:'有 ' + pizhong.length + ' 折待续 · 点选其一',
                     act:'goto', target:'memorials', tone:'hot' });
      }else{
        items.push({ icon:'▸', title:'开始一场专注', sub:'新建奏折或继续未完的事',
                     act:'goto', target:'tasks', tone:'hot' });
      }
    }

    /* 3. 陪她一会儿（名册相处入口） */
    if(!nowActive){
      items.push({ icon:'❀', title:'陪她一会儿', sub:'相处、召幸都在这里',
                   act:'harem', target:'consorts', tone:'warm' });
    }

    /* 4. 打卡未立目标 */
    var ck = st.checkin || { total:0 };
    if(!ck.total){
      items.push({ icon:'✓', title:'立今日打卡', sub:'还没定目标，先立一个',
                   act:'goto', target:'checkin', tone:'plain' });
    }else if(!ck.allDone){
      items.push({ icon:'✓', title:'完成打卡', sub:ck.done + ' / ' + ck.total + ' 已达成',
                   act:'goto', target:'checkin', tone:'plain' });
    }

    /* 5. 记一条灵感（11-18：替换原「定本周三事」——那个入口价值低且落点是旧兼容页。
         灵感是科研核心资产、入口原本藏得深，放到今日行动随手记）
       已孵化/未孵化数量做副标题，引导去灵感罐 */
    var ideaStat = (QZD.idea && QZD.idea.stats) ? QZD.idea.stats() : { total:0, hatched:0 };
    var pendingIdea = Math.max(0, (ideaStat.total || 0) - (ideaStat.hatched || 0));
    items.push({ icon:'✎', title:'记一条灵感', sub: pendingIdea ? (pendingIdea + ' 条待孵化 · 点开记新的') : '闪念别丢，随手记下',
                 act:'goto', target:'idea', tone:'plain' });

    /* 6. 最急的期限（3天内/逾期） */
    if(M && M.dueList){
      var due = M.dueList(365).all.filter(function(x){ return x.days <= 3; });
      if(due.length){
        var u = due[0];
        items.push({ icon:'⏱', title:'最急期限', sub:u.title + ' · ' +
          (u.days < 0 ? ('逾期 ' + Math.abs(u.days) + ' 天') : (u.days === 0 ? '今天截止' : ('剩 ' + u.days + ' 天'))),
          act:'goto', target:'memorials', tone:'urgent' });
      }
    }

    items = items.slice(0, 4);
    return '<section class="card action-card">' +
      '<div class="card-head"><span class="card-title">今 日 行 动</span>' +
        '<span class="card-note">点一下直接去做</span></div>' +
      '<div class="action-grid">' + items.map(function(it){
        var attr = it.act === 'start' ? 'data-pomo-start="' + it.target + '"'
                 : (it.act === 'goto-tab' ? 'data-goto="tasks" data-ttab-go="' + it.target + '"'
                 : (it.act === 'harem' ? 'data-harem="' + it.target + '"'
                 : 'data-goto="' + it.target + '"'));
        return '<button class="action-item action-' + it.tone + '" ' + attr + '>' +
          '<span class="action-icon">' + it.icon + '</span>' +
          '<span class="action-text"><b>' + UI.fmt.escape(it.title) + '</b>' +
            '<i>' + UI.fmt.escape(it.sub) + '</i></span>' +
        '</button>';
      }).join('') + '</div>' +
    '</section>';
  }

  /* ---------- 周进度卡：66h目标环 + 本周三事完成环 ---------- */
  function weekProgressCard(){
    var wk = (QZD.study && QZD.study.weekMinutes) ? QZD.study.weekMinutes() : 0;
    var goal = 66 * 60;
    var wPct = Math.min(1, wk / goal);
    var goals = (QZD.plan && QZD.plan.goals) ? QZD.plan.goals() : [];
    var done = goals.filter(function(g){ return g.done; }).length;
    var gPct = goals.length ? done / goals.length : 0;

    function ring(pct, color, label, sub, target){
      var r = 34, c = 2 * Math.PI * r, off = c * (1 - pct);
      return '<div class="wp-ring" data-goto="' + target + '" role="button" tabindex="0" title="点击进入">' +
        '<svg viewBox="0 0 84 84" aria-label="' + label + '">' +
          '<circle cx="42" cy="42" r="' + r + '" fill="none" stroke="var(--line)" stroke-width="8"/>' +
          '<circle cx="42" cy="42" r="' + r + '" fill="none" stroke="' + color + '" stroke-width="8" ' +
            'stroke-linecap="round" stroke-dasharray="' + c.toFixed(1) + '" stroke-dashoffset="' + off.toFixed(1) +
            '" transform="rotate(-90 42 42)"/>' +
          '<text x="42" y="47" text-anchor="middle" font-size="17" font-weight="700" fill="var(--ink)">' +
            Math.round(pct * 100) + '%</text>' +
        '</svg>' +
        '<b>' + label + '</b><span>' + sub + '</span>' +
      '</div>';
    }
    /* 近 7 天专注迷你柱：一眼看节奏，哪天没做一目了然 */
    var hist = (QZD.state.study && QZD.state.study.history) || {};
    var today = new Date(); today.setHours(0, 0, 0, 0);
    var WD = ['日','一','二','三','四','五','六'];
    var days = [], maxMin = 1;
    for(var i = 6; i >= 0; i--){
      var d = new Date(today.getTime() - i * 86400000);
      var key = d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' +
                String(d.getDate()).padStart(2,'0');
      var v = Math.round(hist[key] || 0);
      if(v > maxMin) maxMin = v;
      days.push({ v:v, wd:WD[d.getDay()], today:i === 0 });
    }
    var miniBars = days.map(function(x){
      var h = Math.max(x.v ? 4 : 0, Math.round(x.v / maxMin * 46));
      return '<div class="wp-day' + (x.today ? ' is-today' : '') + '" title="' + x.v + ' 分">' +
        '<div class="wp-bar-track"><i style="height:' + h + 'px"></i></div>' +
        '<span>' + x.wd + '</span></div>';
    }).join('');
    var streak = (QZD.study && QZD.study.streak) ? QZD.study.streak() : 0;
    var leftMin = Math.max(0, 66 * 60 - wk);
    var leftH = Math.round(leftMin / 60 * 10) / 10;
    var avgMin = Math.round(wk / 7);
    /* 打卡：今日得分 + 近7天达标天数（history 里 score=100 算达标） */
    var ckToday = (QZD.checkin && QZD.checkin.todayStat) ? QZD.checkin.todayStat() : { score:0, done:0, total:0 };
    var ckHist = (QZD.state.checkin && QZD.state.checkin.history) || {};
    var ckDoneDays = days.filter(function(x, i){
      var d = new Date(today.getTime() - (6 - i) * 86400000);
      var key = d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' +
                String(d.getDate()).padStart(2,'0');
      return ckHist[key] && ckHist[key].score >= 100;
    }).length;
    /* 打卡做成第三个环，与专注/三事并排；完成度用今日得分 */
    var ckPct = Math.min(1, (ckToday.score || 0) / 100);
    var ckRingHtml = ring(ckPct, 'var(--zhu-green)', '今日打卡',
      (ckToday.done || 0) + ' / ' + (ckToday.total || 0) + ' 项', 'tasks');

    return '<section class="card">' +
      '<div class="card-head"><span class="card-title">本 周 进 度</span>' +
        '<span class="card-note">点环进入详情</span></div>' +
      '<div class="wp-row">' +
        ring(wPct, 'var(--teng)', '专注目标',
          Math.round(wk / 60 * 10) / 10 + ' / 66 h', 'chronos') +
        ring(gPct, 'var(--daiqing)', '本周三事',
          done + ' / ' + goals.length + ' 件', 'tasks') +
        ckRingHtml +
      '</div>' +
      '<div class="wp-extra">' +
        '<div class="wp-days"><div class="wp-days-title">近 7 天专注</div>' +
          '<div class="wp-days-row">' + miniBars + '</div></div>' +
        '<div class="wp-stats">' +
          '<div><span>连续达标</span><b>' + streak + ' 天</b></div>' +
          '<div><span>日均专注</span><b>' + avgMin + ' 分</b></div>' +
          '<div><span>7天打卡达标</span><b>' + ckDoneDays + ' 天</b></div>' +
          '<div><span>距 66h 还差</span><b>' + (leftMin ? leftH + ' h' : '已达标') + '</b></div>' +
        '</div>' +
      '</div>' +
    '</section>';
  }

  /* ---------- 速记进展：在总览直接记一句本周进展 ---------- */
  function quickProgressCard(){
    var recent = (QZD.plan && QZD.plan.recent) ? QZD.plan.recent(7).slice(0, 3) : [];
    var list = recent.length
      ? '<div class="qp-list">' + recent.map(function(p){
          var d = new Date(p.at);
          var md = (d.getMonth() + 1) + '/' + d.getDate();
          return '<div class="qp-row"><span>' + md + '</span><i>' +
            UI.fmt.escape(p.text) + '</i>' +
            (p.minutes ? '<b>' + Math.round(p.minutes) + '分</b>' : '') + '</div>';
        }).join('') + '</div>'
      : '<p class="card-note">还没有进展记录 · 写完一项就记一句，周报会自动带上</p>';
    return '<section class="card">' +
      '<div class="card-head"><span class="card-title">速 记 进 展</span>' +
        '<span class="card-note">记一句，周报自动带上</span></div>' +
      '<div class="qp-add">' +
        '<input id="qp-text" maxlength="200" placeholder="如：调通了行波电极的 S 参数仿真">' +
        '<button class="btn primary sm" data-qp-add>记 一 句</button>' +
      '</div>' + list +
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
        ledgerItem('tasks', '今日专注', st.doneMin + ' 分', '目标 ' + (CFG.STUDY.DAILY_TARGET_MIN || 120) + ' 分') +
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
      subjectStrip() +
    '</section>';
  }

  /* 累计课题分布彩条：复用课题统一配色，鼠标悬停看分钟，一眼看到时间花在哪 */
  function subjectStrip(){
    var bd = (QZD.study && QZD.study.subjectBreakdown) ? QZD.study.subjectBreakdown() : { rows:[] };
    if(!bd.rows || !bd.rows.length) return '';
    var seg = bd.rows.slice(0, 6).map(function(r){
      var color = QZD.study.subjectColor(r.id);
      return '<i class="ss-seg" style="width:' + r.pct + '%;background:' + color +
        '" title="' + UI.fmt.escape(r.name) + ' · ' + r.min + ' 分 · ' + r.pct + '%"></i>';
    }).join('');
    var top = bd.rows.slice(0, 3).map(function(r){
      return '<span class="ss-item"><i style="background:' + QZD.study.subjectColor(r.id) + '"></i>' +
        UI.fmt.escape(r.name) + ' ' + r.pct + '%</span>';
    }).join('');
    return '<div class="subject-strip">' +
      '<div class="ss-label">累计课题分布</div>' +
      '<div class="ss-track">' + seg + '</div>' +
      '<div class="ss-items">' + top + '</div>' +
    '</div>';
  }

  /* 帝王卡（紧凑）：小头像 + 名字 + 四维 + 四资源 + 江山简要，省空间 */
  function emperorPanel(s){
    var list = (QZD.ASSETS && QZD.ASSETS.emperor) || [];
    var cur = s.emperorPortrait || list[0] || '';
    var dims = CFG.DIMENSIONS.map(function(d){
      return '<span class="emp-chip" data-key="' + d.key + '">Lv.' + (s.emperor[d.key] || 0) + ' ' + d.name + '</span>';
    }).join('');
    var res = CFG.RESOURCES.map(function(r){
      return '<span class="emp-res"><i style="background:' + r.color + '"></i>' +
        r.name + ' <b id="ov-res-' + r.key + '">' +
        UI.fmt.num(s.resources[r.key]) + '</b></span>';
    }).join('');
    /* 江山简要：战力 / 属城 / 贡赋 */
    var realmMini = '';
    try {
      var K = QZD.conquest, C = CFG.CONQUEST;
      var owned = K.ownedList().length;
      var power = K.power();
      /* 11-18 收紧：贡赋详情在「江山」卡里已有，顶部不再重复；
         只留战力/属城，与四项资源合成 6 项＝3 列×2 行 */
      realmMini =
        '<span class="emp-res" style="border-left-color:var(--zhuqian)"><i style="background:var(--zhuqian)"></i>战力 <b>' + UI.fmt.num(power) + '</b></span>' +
        '<span class="emp-res"><i style="background:var(--dailan)"></i>属城 <b>' + owned + '/' + C.CITIES.length + '</b></span>';
    } catch(e){}
    return '<section class="card emperor-card compact">' +
      '<div class="emp-avatar" title="点击更换立绘">' +
        (cur
          ? '<div class="emperor-photo" style="background-image:url(\'' +
              UI.fmt.escape(cur) + '\')"></div>'
          : '<div class="emp-avatar-none">帝</div>') +
        '<button class="emp-avatar-edit" data-pick-emperor' + (list.length ? '' : ' disabled') +
          ' title="更换立绘">换</button>' +
      '</div>' +
      '<div class="emp-info">' +
        '<div class="emp-head">' +
          '<span class="emp-name">' + UI.fmt.escape(s.meta.emperorName) + '</span>' +
          '<span class="emp-dims">' + dims + '</span>' +
        '</div>' +
        /* 6 项数值合并到同一网格：桌面 3 列×2 行、手机也 3 列×2 行，
           国力与声望自然并排，不再各占一行 */
        '<div class="emp-res-row">' + res + realmMini + '</div>' +
        /* 11-19 帝阶：本代帝号 + 累计专注进度 + 可迎回名额；登录连登天数 */
        '<div class="emp-rank-line">' +
          (QZD.regime && QZD.regime.topbarText
            ? '<span title="帝阶只看本代累计专注；亡国或传代归零重爬">◈ ' +
                UI.fmt.escape(QZD.regime.topbarText()) + '</span>' : '') +
          (QZD.checkin && QZD.checkin.loginStat
            ? '<span class="emp-login-chip" title="每日首次打开自动签到；累计连登可领奖励">· 连登 ' +
                QZD.checkin.loginStat().streak + ' 天</span>' : '') +
        '</div>' +
      '</div>' +
    '</section>';
  }

  /* F1/F2 国势横幅：只在危机时出现，温和叙事 + 明确「可挽回」出口 */
  function dynastyBanner(){
    if(!QZD.dynasty) return '';
    var v = QZD.dynasty.view();
    if(!v.isCrisis) return '';
    var tips = {
      talk: '朝臣窃议，勤政数日即可平息。',
      omen: '御案已添《修省弭灾疏》，批阅即是修省。',
      border: '城郭无恙、仓廪尚实，回朝坐镇便足平复。',
      mourn: '六宫都在等你，没有半分怨色。',
      refuge: '国破潜邸，帝号待复。勤政数日即可再起——她们还在等你接回。'
    };
    return '<section class="card" style="border-left:4px solid #b3542e;background:#fff8f2">' +
      '<div class="card-head"><span class="card-title">国势 · ' + UI.fmt.escape(v.name) +
      '</span><span class="card-note">安定 ' + Math.round(v.stability) + '</span></div>' +
      '<p class="today-line">' + UI.fmt.escape(tips[v.level] || '勤政即可挽回。') + '</p>' +
      '<div class="bar"><i style="width:' + Math.max(0, Math.min(100, v.stability)) +
      '%;background:#b3542e"></i></div>' +
    '</section>';
  }

  /* 总览页：国势横幅 → 皇帝卡 → 今日行动 → 周进度 → 速记进展 → 科研台账(主视觉) → 其余
     宫门已移除：入口由顶部导航与今日行动区覆盖，不再占大块空间。 */
  /* 便捷门管理面板：增删改标签，网址可隐藏 */
  function showQuickLinksManager(){
    if(!QZD.quickLinks){ UI.toast('快捷栏系统未加载'); return; }
    var catList = (QZD.quickLinks.categories ? QZD.quickLinks.categories() : [])
      .filter(function(c){ return c.id !== 'all'; });
    /* 分类下拉按层级路径显示（无限层级），缩进用 · 前缀体现深浅 */
    function catIndent(c){
      var d = QZD.quickLinks.depthOf ? QZD.quickLinks.depthOf(c.id) : 0;
      return (d ? new Array(Math.min(d,6) + 1).join('· ') : '') + c.name;
    }
    var CAT_OPTS = catList.map(function(c){
      return '<option value="' + c.id + '">' + UI.fmt.escape(catIndent(c)) + '</option>'; }).join('');
    var CAT_PARENT_OPTS = '<option value="">（顶层）</option>' + catList.map(function(c){
      return '<option value="' + c.id + '">' + UI.fmt.escape(catIndent(c)) + '</option>'; }).join('');
    var COLOR_OPTS = '<option value="#A8573F">宫墙红</option><option value="#3E6B5C">黛青</option>' +
      '<option value="#4C6E8C">石青</option><option value="#7C6B94">藕荷</option>' +
      '<option value="#A8842C">藤黄</option>';
    var KIND_NAME = { web:'网页', file:'本地文件/程序', app:'App' };
    function selected(val, want){ return val === want ? ' selected' : ''; }
    function bodyHtml(){
      var links = QZD.quickLinks.list();
      var rows = links.map(function(l, i){
        var kind = QZD.quickLinks.kindOf(l.url);
        var head = '<div class="ql-edit-row">' +
          '<span class="ql-edit-dot" style="background:' + UI.fmt.escape(l.color || 'var(--daiqing)') + '"></span>' +
          '<span class="ql-edit-label">' + UI.fmt.escape(l.label) + '</span>' +
          '<span class="ql-edit-kind">' + KIND_NAME[kind] + '</span>' +
          '<span class="ql-edit-url" title="' + UI.fmt.escape(l.url) + '">' +
            (l.hideUrl ? '（已隐藏）' : UI.fmt.escape(l.url)) + '</span>' +
          '<button class="chip sm" data-ql-edit="' + UI.fmt.escape(l.id) + '">改</button>' +
          '<button class="chip sm" data-ql-vis="' + UI.fmt.escape(l.id) + '">' +
            (l.hideUrl ? '显' : '隐') + '</button>' +
          '<button class="chip sm" data-ql-up="' + UI.fmt.escape(l.id) + '"' + (i === 0 ? ' disabled' : '') + '>↑</button>' +
          '<button class="chip sm" data-ql-down="' + UI.fmt.escape(l.id) + '"' +
            (i === links.length - 1 ? ' disabled' : '') + '>↓</button>' +
          '<button class="chip sm danger" data-ql-del="' + UI.fmt.escape(l.id) + '">删</button>' +
        '</div>';
        /* 编辑态：原地展开可改标签/网址/分类/颜色 */
        var edit = qlEditingId === l.id
          ? '<div class="ql-edit-form">' +
              '<div class="field"><label>标签</label><input id="ql-ed-label" maxlength="16" value="' + UI.fmt.escape(l.label) + '"></div>' +
              '<div class="field"><label>网址 / 路径 / App协议</label><input id="ql-ed-url" value="' + UI.fmt.escape(l.url) + '"></div>' +
              '<div class="ql-edit-form-row">' +
                '<div class="field"><label>分类</label><select id="ql-ed-cat">' + CAT_OPTS.replace(/<option value="([^"]+)"/g, function(m, v){ return '<option value="' + v + '"' + selected(v, l.category); }) + '</select></div>' +
                '<div class="field"><label>颜色</label><select id="ql-ed-color">' + COLOR_OPTS.replace(/<option value="([^"]+)"/g, function(m, v){ return '<option value="' + v + '"' + selected(v, l.color); }) + '</select></div>' +
              '</div>' +
              '<button class="btn primary sm" data-ql-save="' + UI.fmt.escape(l.id) + '">保存</button>' +
              '<button class="btn ghost sm" data-ql-cancel>取消</button>' +
            '</div>'
          : '';
        return head + edit;
      }).join('') || '<p class="card-note">还没有标签，下面加一个</p>';
      return '<div class="ql-manager">' +
        '<div class="ql-cat-manage">' +
          '<div class="ql-cat-manage-title">分类管理（可无限分级）</div>' +
          '<div class="ql-cat-manage-row">' + catList.map(function(c){
            var d = QZD.quickLinks.depthOf ? QZD.quickLinks.depthOf(c.id) : 0;
            var indent = d ? new Array(Math.min(d,6) + 1).join('　') : '';
            return '<span class="ql-cat-tag">' + indent + UI.fmt.escape(c.name) +
              '<button class="ql-cat-x" data-ql-cat-ren="' + UI.fmt.escape(c.id) + '" title="改名">改</button>' +
              '<button class="ql-cat-x" data-ql-cat-par="' + UI.fmt.escape(c.id) + '" title="改上级">级</button>' +
              '<button class="ql-cat-x" data-ql-cat-del="' + UI.fmt.escape(c.id) + '" title="删除">×</button></span>';
          }).join('') + '</div>' +
          '<div class="ql-cat-add"><input id="ql-cat-new" maxlength="10" placeholder="新分类名"">' +
            '<select id="ql-cat-parent" title="上级分类">' + CAT_PARENT_OPTS + '</select>' +
            '<button class="chip sm" data-ql-cat-add>＋ 加子分类</button></div>' +
        '</div>' +
        '<p class="card-note">支持网页（自动补 https）、本机文件路径（D:\\tools\\app.exe）与 App 协议（obsidian://、vscode://）。</p>' +
        '<div class="ql-edit-list">' + rows + '</div>' +
        '<div class="ql-add-form">' +
          '<div class="ql-edit-form-row">' +
            '<div class="field"><label>新标签</label><input id="ql-new-label" maxlength="16" placeholder="如：Obsidian"></div>' +
            '<div class="field"><label>分类</label><select id="ql-new-cat">' + CAT_OPTS + '</select></div>' +
          '</div>' +
          '<div class="field"><label>网址 / 路径 / App协议</label><input id="ql-new-url" placeholder="example.com 或 D:\\tools\\app.exe 或 obsidian://"></div>' +
          '<div class="field"><label>颜色</label><select id="ql-new-color">' + COLOR_OPTS + '</select></div>' +
          '<button class="btn ghost sm" data-ql-add>＋ 添加标签</button>' +
        '</div>' +
      '</div>';
    }
    var mm = QZD.ui.modal({ title:'管理便捷门', body: bodyHtml(), ok:false, cancelText:'完成' });
    mm.root.addEventListener('click', function(ev){
      var t = ev.target;
      /* 分类增删改 */
      var catAdd = t.closest('[data-ql-cat-add]');
      if(catAdd){
        var ci = document.getElementById('ql-cat-new'), cp = document.getElementById('ql-cat-parent');
        var cr = QZD.quickLinks.addCategory(ci ? ci.value : '', cp ? cp.value : '');
        if(!cr.ok){ UI.toast(cr.error); return; }
        mm.close(); showQuickLinksManager(); return;
      }
      var catPar = t.closest('[data-ql-cat-par]');
      if(catPar){
        var pid = catPar.getAttribute('data-ql-cat-par');
        var pcur = QZD.quickLinks.catById ? QZD.quickLinks.catById(pid) : null;
        var opts = '(空＝顶层，或直接输入上级分类 id)\n当前：' + (pcur ? pcur.name : '?') +
          '\n可选上级 id：\n' + QZD.quickLinks.categories().filter(function(c){
            return c.id !== 'all' && c.id !== pid;
          }).map(function(c){ return '  ' + c.id + ' = ' + (QZD.quickLinks.pathOf ? QZD.quickLinks.pathOf(c.id) : c.name); }).join('\n');
        var np = window.prompt('改上级分类（-1 取消）：\n' + opts, pcur ? pcur.parentId : '');
        if(np === null || np === '-1') return;
        var pr = QZD.quickLinks.reparentCategory(pid, np.trim());
        if(!pr.ok){ UI.toast(pr.error); return; }
        mm.close(); showQuickLinksManager(); return;
      }
      var catRen = t.closest('[data-ql-cat-ren]');
      if(catRen){
        var rid = catRen.getAttribute('data-ql-cat-ren');
        var old = QZD.quickLinks.categories().filter(function(c){return c.id===rid;})[0];
        var nn = window.prompt('改分类名为：', old ? old.name : '');
        if(nn === null) return;
        var rr = QZD.quickLinks.renameCategory(rid, nn);
        if(!rr.ok){ UI.toast(rr.error); return; }
        mm.close(); showQuickLinksManager(); return;
      }
      var catDel = t.closest('[data-ql-cat-del]');
      if(catDel){
        var did = catDel.getAttribute('data-ql-cat-del');
        if(!window.confirm('删除该分类及其所有子分类？其下标签将归入「学习工作」。')) return;
        var dr = QZD.quickLinks.removeCategory(did);
        if(!dr.ok){ UI.toast(dr.error); return; }
        mm.close(); showQuickLinksManager(); return;
      }
      var add = t.closest('[data-ql-add]');
      if(add){
        var lab = document.getElementById('ql-new-label'), ur = document.getElementById('ql-new-url'),
            co = document.getElementById('ql-new-color'), ca = document.getElementById('ql-new-cat');
        var r = QZD.quickLinks.add(lab ? lab.value : '', ur ? ur.value : '',
          co ? co.value : '', ca ? ca.value : 'study');
        if(!r.ok){ UI.toast(r.error); return; }
        UI.toast('已添加 · ' + r.item.label);
        qlEditingId = null; mm.close(); showQuickLinksManager(); return;
      }
      var save = t.closest('[data-ql-save]');
      if(save){
        var sid = save.getAttribute('data-ql-save');
        var sl = document.getElementById('ql-ed-label'), su = document.getElementById('ql-ed-url'),
            sc = document.getElementById('ql-ed-color'), sa = document.getElementById('ql-ed-cat');
        var sr = QZD.quickLinks.update(sid, sl ? sl.value : '', su ? su.value : '',
          sc ? sc.value : '', null, sa ? sa.value : 'study');
        if(!sr.ok){ UI.toast(sr.error); return; }
        UI.toast('已保存 · ' + sr.item.label);
        qlEditingId = null; mm.close(); showQuickLinksManager(); return;
      }
      var edit = t.closest('[data-ql-edit]');
      if(edit){ qlEditingId = edit.getAttribute('data-ql-edit'); mm.close(); showQuickLinksManager(); return; }
      if(t.closest('[data-ql-cancel]')){ qlEditingId = null; mm.close(); showQuickLinksManager(); return; }
      var del = t.closest('[data-ql-del]');
      if(del){ QZD.quickLinks.remove(del.getAttribute('data-ql-del')); qlEditingId = null; mm.close(); showQuickLinksManager(); return; }
      var vis = t.closest('[data-ql-vis]');
      if(vis){
        var it = QZD.quickLinks.byId(vis.getAttribute('data-ql-vis'));
        if(it){ QZD.quickLinks.update(it.id, it.label, it.url, it.color, !it.hideUrl, it.category); }
        mm.close(); showQuickLinksManager(); return;
      }
      var up = t.closest('[data-ql-up]');
      if(up){ QZD.quickLinks.move(up.getAttribute('data-ql-up'), -1); mm.close(); showQuickLinksManager(); return; }
      var dn = t.closest('[data-ql-down]');
      if(dn){ QZD.quickLinks.move(dn.getAttribute('data-ql-down'), 1); mm.close(); showQuickLinksManager(); return; }
    });
  }

  /* 快捷栏：每个分类一个卡片框，框内放该类所有标签；点标签交系统打开 */
  function quickBar(){
    if(!QZD.quickLinks) return '';   /* 系统未加载（如精简桩）则不渲染整条 */
    var all = QZD.quickLinks.list() || [];
    var cats = (QZD.quickLinks && QZD.quickLinks.categories) ? QZD.quickLinks.categories()
             : [{id:'all',name:'全部'}];
    var kindMark = { web:'网', file:'件', app:'用' };
    var catColors = ['var(--daiqing)','var(--shi-qing)','var(--gong-red)',
                     'var(--zhu-green)','var(--teng)','var(--ou-he)'];
    function chipHtml(l){
      var color = l.color || 'var(--daiqing)';
      var kind = QZD.quickLinks.kindOf ? QZD.quickLinks.kindOf(l.url) : 'web';
      return '<button class="ql-chip" data-ql-open="' + UI.fmt.escape(l.id) + '"' +
        ' title="' + (l.hideUrl ? UI.fmt.escape(l.label) : UI.fmt.escape(l.url)) + '">' +
        '<i style="background:' + UI.fmt.escape(color) + '"></i>' +
        UI.fmt.escape(l.label) + '<small class="ql-kind">' + kindMark[kind] + '</small></button>';
    }
    /* 递归渲染分类树：每个分类框内先放直属标签，再嵌套子分类框（无限层级）。
       all 是虚拟"全部"，不单独成框。用 --depth 控制缩进。 */
    function groupHtml(cat, depth, colorIdx){
      var ls = all.filter(function(l){ return l.category === cat.id; });
      var kids = QZD.quickLinks.childrenOf ? QZD.quickLinks.childrenOf(cat.id) : [];
      var barColor = catColors[colorIdx % catColors.length];
      var inner = ls.map(chipHtml).join('');
      if(!inner) inner = '<span class="card-note">暂无标签</span>';
      /* 子分类递归，颜色序号随深度推进 */
      kids.forEach(function(k, ki){
        inner += groupHtml(k, depth + 1, colorIdx + ki + 1);
      });
      return '<div class="ql-group" style="--grp:' + barColor + ';--depth:' + depth + '">' +
        '<div class="ql-group-head"><b>' + UI.fmt.escape(cat.name) + '</b>' +
          '<span>' + ls.length + ' 项' + (kids.length ? ' · ' + kids.length + ' 子类' : '') + '</span></div>' +
        '<div class="ql-group-body">' + inner + '</div></div>';
    }
    var roots = QZD.quickLinks.childrenOf ? QZD.quickLinks.childrenOf('')
              : cats.filter(function(c){ return c.id !== 'all'; });
    var groups = roots.map(function(c, i){ return groupHtml(c, 0, i); }).join('');
    /* 未归类（分类被删后可能残留）兜底框 */
    var known = {}; cats.forEach(function(c){ known[c.id] = true; });
    var stray = all.filter(function(l){ return !known[l.category]; });
    if(stray.length){
      groups += '<div class="ql-group" style="--grp:var(--ink2)">' +
        '<div class="ql-group-head"><b>其它</b><span>' + stray.length + ' 项</span></div>' +
        '<div class="ql-group-body">' + stray.map(chipHtml).join('') + '</div></div>';
    }
    return '<section class="card ql-card">' +
      '<div class="card-head"><span class="card-title">便 捷 门</span>' +
        '<button class="chip sm" data-ql-manage>管理标签</button></div>' +
      '<div class="ql-groups">' + (groups ||
        '<span class="card-note">还没有分类，点「管理标签」添加一个</span>') + '</div>' +
    '</section>';
  }

  function overviewBody(){
    var s = QZD.state;
    /* 外层 wrapper 供 CSS 统一给各卡加顶部色条/层次；不改动各卡内部逻辑 */
    return '<div class="overview-page">' +
      quickBar() + dynastyBanner() + emperorPanel(s) +
      actionPanel() + weekProgressCard() + quickProgressCard() +
      researchPanel() + todayPanel(s) + memorialPanel(s) +
    '</div>';
  }

  UI.register('overview', overviewBody);
  /* 暴露给顶栏（每页可见）和 summary 页面复用 */
  QZD.ui._overviewBody = overviewBody;
  QZD.ui._emperorPanel = emperorPanel;
  /* 暴露子函数供 summary 页面拼概要 */
  QZD.ui._overviewParts = {
    quickBar: quickBar,
    dynastyBanner: dynastyBanner,
    actionPanel: actionPanel,
    weekProgressCard: weekProgressCard,
    quickProgressCard: quickProgressCard,
    researchPanel: researchPanel,
    todayPanel: todayPanel,
    realmPanel: realmPanel,
    memorialPanel: memorialPanel
  };

  document.addEventListener('click', function(e){
    /* 便捷门：点标签用系统浏览器打开 */
    var qo = e.target.closest('[data-ql-open]');
    if(qo){
      if(!QZD.quickLinks) return;
      var r = QZD.quickLinks.open(qo.getAttribute('data-ql-open'));
      if(!r.ok) UI.toast(r.error);
      return;
    }
    if(e.target.closest('[data-ql-manage]')){ showQuickLinksManager(); return; }
    /* 速记进展：直接存一条，不跳页 */
    var qp = e.target.closest('[data-qp-add]');
    if(qp){
      var input = document.getElementById('qp-text');
      var text = input ? input.value : '';
      if(!text || !text.trim()){ UI.toast('先写一句做了什么'); return; }
      var r = QZD.plan.addProgress({ text: text, title: '' });
      if(!r.ok){ UI.toast(r.error); return; }
      UI.toast('已记一句 · 周报会带上');
      UI.onStateChanged();
      return;
    }

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
