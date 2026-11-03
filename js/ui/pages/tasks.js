/* ============================================================
   ui/pages/tasks.js · 今日勤政
   今日概览（专注总时长 / 场次） + 每日打卡（三档 + 热力图）
   + 御案奏折（新建 / 拆小目标 / 开始专注 / 办结）
   ============================================================ */
(function(){
  var CFG = QZD.config;
  var UI = QZD.ui;
  var ESC = function(t){ return UI.fmt.escape(t); };

  /* ---------- 1. 今日概览 ---------- */
  function overviewCard(){
    var st = QZD.study.snapshot();
    var ck = st.checkin || { total: 0, done: 0, half: 0, score: 0, allDone: false };
    var penalty = (ck.total && !ck.allDone)
      ? '<b class="penalty-tag">今日打卡未满，选秀 / 召幸 / 珍宝 消费 ×' + st.multiplier + '</b>'
      : (ck.allDone
          ? '<span class="badge ok">今日打卡已满</span>'
          : '<span class="card-note">还没有打卡目标，先立一个吧</span>');

    return '<section class="card study-card">' +
      '<div class="card-head"><span class="card-title">今 日 概 览</span>' +
      '<span class="card-note">专注时长与次数由计时器自动记录</span></div>' +
      '<div class="realm-stats">' +
        '<div class="realm-stat hot"><span>今日专注</span><b><span id="tk-focus">' + st.doneMin + '</span> 分</b></div>' +
        '<div class="realm-stat"><span>本周累计</span><b><span id="tk-week">' + st.week + '</span> 分</b></div>' +
        '<div class="realm-stat"><span>专注次数</span><b><span id="tk-sessions">' + st.sessionCount + '</span> 次</b></div>' +
        '<div class="realm-stat' + (st.streak ? ' hot' : '') + '"><span>连续达标</span><b>' +
          st.streak + ' 天</b></div>' +
      '</div>' +
      '<p class="today-line" style="margin-top:10px">打卡得分 <b>' + ck.score + '</b> · 完成 ' +
        '<span id="tk-checkin">' + ck.done + ' / ' + ck.total + '</span>' +
        (ck.half ? '（半 ' + ck.half + '）' : '') + '</p>' +
      '<div class="task-progress"><div class="bar"><i id="tk-checkin-bar" style="width:' + ck.score + '%"></i></div>' +
        '<span>' + ck.score + '%</span></div>' +
      '<p class="today-line" style="margin-top:8px">' + penalty + '</p>' +
      '<div class="field"><label>今日学习内容（选填）</label>' +
        '<input id="study-subject" maxlength="24" placeholder="如：光学 第三章" value="' +
          ESC(st.subject) + '"></div>' +
      '<div class="btn-row"><button class="btn ghost" data-act="study-subject-save">保存内容</button></div>' +
    '</section>';
  }

  /* ---------- 2. 打卡目标 ---------- */
  function levelButtons(g){
    var levels = QZD.checkin.LEVELS;
    return '<div class="ci-levels">' + levels.map(function(l){
      return '<button class="ci-lv ' + l.cls + (g.level === l.value ? ' active' : '') +
        '" data-ci-level="' + g.id + '|' + l.value + '">' + l.name + '</button>';
    }).join('') + '</div>';
  }

  function goalRow(g){
    var full = QZD.checkin.rewardOf(2).gain;
    var rewardTxt = Object.keys(full).map(function(k){
      var n = { qinZheng: '勤政', jinQian: '金钱', guoJin: '国力', shengWang: '声望' }[k] || k;
      return n + ' ' + full[k];
    }).join(' / ');
    return '<div class="ci-row' + (g.level === 2 ? ' done' : '') + '">' +
      '<div class="ci-main">' +
        '<span class="ci-title">' + ESC(g.title) + '</span>' +
        '<span class="ci-reward">完成可赏 ' + rewardTxt + '</span>' +
      '</div>' +
      levelButtons(g) +
      '<button class="ci-del" data-ci-del="' + g.id + '" title="删除目标">×</button>' +
    '</div>';
  }

  function checkinCard(){
    var list = QZD.checkin.list();
    var st = QZD.checkin.todayStat();
    var presets = (QZD.checkin.PRESETS || []).map(function(p){
      return '<button class="chip sm" data-ci-preset="' + ESC(p) + '">' + ESC(p) + '</button>';
    }).join('');

    var body = list.length
      ? list.map(goalRow).join('')
      : '<div class="empty">今日还没有目标<span class="card-note">从下面加一个，比如「早睡」</span></div>';

    return '<section class="card">' +
      '<div class="card-head"><span class="card-title">每 日 打 卡</span>' +
      '<span class="card-note">' + st.done + ' / ' + st.total + ' 完成 · 得分 ' + st.score +
        (st.allDone ? ' · 全部达成' : '') + '</span></div>' +
      body +
      (presets ? '<div class="chip-row" style="margin-top:10px">' + presets + '</div>' : '') +
      '<div class="ci-add">' +
        '<input id="ci-new" maxlength="' + (CFG.CHECKIN.TITLE_MAX || 16) +
          '" placeholder="添加今日目标，如：早睡 / 运动 30 分">' +
        '<button class="btn primary" data-ci-add>加 入</button>' +
      '</div>' +
      '<p class="page-foot" style="margin-top:8px">三档评判：未完成不给、完成一半给五成、完成给全额；改档会按差额补发或回收。</p>' +
    '</section>';
  }

  /* ---------- 3. 热力图 ---------- */
  function heatmapCard(){
    return '<section class="card">' +
      '<div class="card-head"><span class="card-title">打 卡 热 力 图</span>' +
      '<span class="card-note">颜色越深，当日完成度越高</span></div>' +
      UI.heatmap.render(UI.heatmapMode) +
    '</section>';
  }

  /* 御案奏折已并入本页：新建/拆小目标/开始专注/办结都在这里 */
  function memorialBlock(){
    return (UI.memorialBlock && UI.memorialBlock.render) ? UI.memorialBlock.render() : '';
  }

  /* ---------- 本周三事 ---------- */
  function planCard(){
    var goals = QZD.plan ? QZD.plan.goals() : [];
    var esc = UI.fmt.escape;
    var body;
    if(goals.length){
      body = '<div class="plan-goals">' + goals.map(function(g){
        return '<label class="plan-goal' + (g.done ? ' done' : '') + '">' +
          '<input type="checkbox" data-plan-toggle="' + g.id + '"' + (g.done ? ' checked' : '') + '>' +
          '<span>' + esc(g.text) + '</span>' +
        '</label>';
      }).join('') + '</div>' +
      '<div class="btn-row" style="margin-top:8px">' +
        '<button class="chip sm" data-plan-reset>重设本周三事</button>' +
      '</div>';
    }else{
      body = '<div class="plan-new">' +
        '<input id="plan-1" maxlength="60" placeholder="本周一定要完成的第一件事">' +
        '<input id="plan-2" maxlength="60" placeholder="第二件（可留空）">' +
        '<input id="plan-3" maxlength="60" placeholder="第三件（可留空）">' +
      '</div>' +
      '<div class="btn-row" style="margin-top:8px">' +
        '<button class="btn primary" data-plan-save>记下本周三事</button>' +
      '</div>';
    }
    return '<section class="card">' +
      '<div class="card-head"><span class="card-title">本 周 三 事</span>' +
      '<span class="card-note">' + (goals.filter(function(g){ return g.done; }).length + ' / ' + goals.length) +
        ' · 周一自动换页</span></div>' +
      body +
    '</section>';
  }

  /* ---------- 科研成就 ---------- */
  function achvCard(){
    var s = QZD.state || {};
    var anyDone = (s.memorials || []).some(function(m){ return m.status === 'banjie'; });
    var days = {};
    ((s.plan && s.plan.progress) || []).forEach(function(p){
      if(p && p.at) days[QZD.stateIO.todayStr(new Date(p.at))] = 1;
    });
    var dcount = Object.keys(days).length;
    var rd = (QZD.reading && QZD.reading.stats) ? QZD.reading.stats().done : 0;
    var sess = (s.study && s.study.sessionCount) || 0;
    var list = [
      { name: '首折办结', lit: anyDone },
      { name: '7 天有进展', lit: dcount >= 7 },
      { name: '精读 10 篇', lit: rd >= 10 },
      { name: '专注 10 次', lit: sess >= 10 }
    ];
    var lit = list.filter(function(x){ return x.lit; }).length;
    return '<section class="card">' +
      '<div class="card-head"><span class="card-title">科 研 成 就</span>' +
      '<span class="card-note">' + lit + ' / ' + list.length + '</span></div>' +
      '<div class="achv-row">' + list.map(function(x){
        return '<span class="achv' + (x.lit ? ' lit' : '') + '">' + x.name + '</span>';
      }).join('') + '</div>' +
    '</section>';
  }

  /* ---------- 临近期限（DDL） ---------- */
  function fmtDay(ts){
    var d = new Date(ts);
    function p(n){ return n < 10 ? '0' + n : '' + n; }
    return (d.getMonth() + 1) + '/' + p(d.getDate());
  }
  function ddlCard(){
    if(!QZD.memorials || !QZD.memorials.dueList) return '';
    var due = QZD.memorials.dueList(7);
    var items = due.overdue.concat(due.soon);
    if(!items.length) return '';
    var esc = UI.fmt.escape;
    return '<section class="card">' +
      '<div class="card-head"><span class="card-title">临 近 期 限</span>' +
      '<span class="card-note">逾期 ' + due.overdue.length + ' · 7 天内 ' + due.soon.length + '</span></div>' +
      '<div class="ddl-list">' + items.slice(0, 8).map(function(x){
        var cls = x.days < 0 ? 'over' : (x.days <= 3 ? 'soon' : '');
        var label = x.days < 0 ? ('逾期 ' + Math.abs(x.days) + ' 天')
                  : (x.days === 0 ? '今天截止' : ('剩 ' + x.days + ' 天'));
        return '<div class="ddl-row">' +
          '<span class="ddl-name">' + esc(x.title) + '</span>' +
          '<span class="ddl-badge ' + cls + '">' + label + '</span>' +
          '<span class="ddl-date">' + fmtDay(x.dueAt) + '</span>' +
        '</div>';
      }).join('') + '</div>' +
    '</section>';
  }

  /* 今日勤政分三栏：概要 / 奏折 / 打卡，避免单页过长 */
  var TASK_TABS = [
    { id: 'brief',   name: '概要' },
    { id: 'memo',    name: '奏折' },
    { id: 'checkin', name: '打卡' }
  ];
  var taskTab = 'brief';

  UI.register('tasks', function(){
    var bar = '<div class="tab-row wrap">' + TASK_TABS.map(function(t){
      return '<button class="tab' + (t.id === taskTab ? ' active' : '') +
        '" data-ttab="' + t.id + '">' + t.name + '</button>';
    }).join('') + '</div>';

    var body;
    if(taskTab === 'memo') body = memorialBlock();
    else if(taskTab === 'checkin') body = checkinCard() + heatmapCard();
    else body = overviewCard() + planCard() + achvCard() + ddlCard();

    return bar + body +
      '<p class="page-foot">打卡次日 0 时归档并清空；专注时长、次数与打卡得分永久留档，供热力图统计。</p>';
  });

  /* 专注进行中只更新数字，绝不重建 DOM（否则输入框会每秒被清空） */
  QZD.tasks = {
    tick: function(){
      var st = QZD.study.snapshot();
      var ck = st.checkin || { total: 0, done: 0, score: 0 };
      var map = {
        'tk-focus': st.doneMin,
        'tk-week': st.week,
        'tk-sessions': st.sessionCount,
        'tk-checkin': ck.done + ' / ' + ck.total
      };
      Object.keys(map).forEach(function(id){
        var el = document.getElementById(id);
        if(el) el.textContent = map[id];
      });
      var bar = document.getElementById('tk-checkin-bar');
      if(bar) bar.style.width = (ck.score || 0) + '%';
    }
  };

  /* ---------- 事件 ---------- */
  document.addEventListener('click', function(e){
    /* 今日勤政页内分栏 */
    var tt = e.target.closest('[data-ttab]');
    if(tt){
      var id = tt.getAttribute('data-ttab');
      for(var i = 0; i < TASK_TABS.length; i++) if(TASK_TABS[i].id === id) taskTab = id;
      UI.renderPage();
      return;
    }

    /* 本周三事：保存 / 重设 */
    if(e.target.closest('[data-plan-save]')){
      var vals = ['plan-1', 'plan-2', 'plan-3'].map(function(id){
        var el = document.getElementById(id);
        return el ? el.value : '';
      });
      var pr = QZD.plan.setGoals(vals);
      if(!pr.ok){ UI.toast(pr.error); return; }
      UI.toast('已记下本周三事');
      UI.onStateChanged();
      return;
    }
    if(e.target.closest('[data-plan-reset]')){
      QZD.plan.clearGoals();
      UI.onStateChanged();
      return;
    }

    var lvBtn = e.target.closest('[data-ci-level]');
    if(lvBtn){
      var pid = String(lvBtn.getAttribute('data-ci-level')).split('|');
      var r = QZD.checkin.setLevel(pid[0], Number(pid[1]));
      if(!r.ok){ UI.toast(r.error); return; }
      var d = r.delta || {};
      var keys = Object.keys(d);
      if(keys.length){
        var n = { qinZheng: '勤政', jinQian: '金钱', guoJin: '国力', shengWang: '声望' };
        UI.toast(keys.map(function(k){
          var v = d[k];
          return (n[k] || k) + (v > 0 ? ' +' : ' ') + v;
        }).join(' · '));
      }
      UI.onStateChanged();
      return;
    }

    if(e.target.closest('[data-ci-add]')){
      var inp = document.getElementById('ci-new');
      var res = QZD.checkin.addGoal(inp ? inp.value : '');
      if(!res.ok){ UI.toast(res.error); return; }
      UI.toast('已加入目标 · ' + res.goal.title);
      UI.onStateChanged();
      return;
    }

    var preset = e.target.closest('[data-ci-preset]');
    if(preset){
      var r2 = QZD.checkin.addGoal(preset.getAttribute('data-ci-preset'));
      if(!r2.ok){ UI.toast(r2.error); return; }
      UI.onStateChanged();
      return;
    }

    var del = e.target.closest('[data-ci-del]');
    if(del){
      var r3 = QZD.checkin.removeGoal(del.getAttribute('data-ci-del'));
      if(!r3.ok) UI.toast(r3.error);
      UI.onStateChanged();
      return;
    }

    var heat = e.target.closest('[data-heat]');
    if(heat){
      UI.heatmap.setMode(heat.getAttribute('data-heat'));
      UI.renderPage();
      return;
    }

    var wk = e.target.closest('[data-weekly]');
    if(wk){
      var report = QZD.weekly.build();
      UI.modal({
        title: '📜 呈递周折 · 学习周报（最近 7 天）',
        body: '<pre class="weekly-text">' + UI.fmt.escape(report) + '</pre>' +
          '<p class="card-note">可复制后发给导师；也可导出数据交给 AI 整理（或等每周定时任务自动生成）。</p>' +
          '<div class="btn-row" style="margin-top:8px">' +
            '<button class="btn ghost sm" data-weekly-export>导出数据 (JSON)</button>' +
            '<button class="btn ghost sm" data-weekly-ai>复制 AI 提示词</button>' +
            '<button class="btn ghost sm" data-weekly-next>采纳为下周三事</button>' +
          '</div>',
        ok: true,
        okText: '复制全文',
        onOk: function(){
          QZD.weekly.copyText(report, function(ok){
            UI.toast(ok ? '周报已复制，可直接粘贴发送' : '复制失败，请手动选中文本复制');
          });
          return false;   /* 保持弹窗打开，可反复复制 */
        }
      });
      return;
    }

    /* 导出周报数据（桌面版落盘到 reports/，浏览器版下载 JSON） */
    if(e.target.closest('[data-weekly-export]')){
      QZD.weekly.exportFile(function(res){
        if(res && res.ok){
          UI.toast(res.download ? ('已下载 ' + res.name + '（桌面版可直接写入 reports/）') : ('已导出到 ' + res.path));
        }else{
          UI.toast('导出失败：' + ((res && res.error) || '未知错误'));
        }
      });
      return;
    }

    /* 复制含本周数据的 AI 提示词，粘贴给任意 AI 即可生成周报 */
    if(e.target.closest('[data-weekly-ai]')){
      QZD.weekly.copyText(QZD.weekly.aiPrompt(), function(ok){
        UI.toast(ok ? '已复制 AI 提示词（含本周数据），粘贴给 AI 即可生成周报' : '复制失败，请手动复制');
      });
      return;
    }

    /* 采纳周报建议 → 下周的三件事（周一自动生效） */
    if(e.target.closest('[data-weekly-next]')){
      var sug = QZD.weekly.suggestNextGoals();
      var nr = QZD.plan.setNextGoals(sug);
      if(!nr.ok){ UI.toast(nr.error); return; }
      UI.toast('已设为下周三事：' + sug.join(' / '));
      UI.onStateChanged();
      return;
    }

    if(e.target.closest('[data-act="study-subject-save"]')){
      var sj = document.getElementById('study-subject');
      QZD.study.setSubject(sj ? sj.value : '');
      UI.toast('已保存今日学习内容');
      UI.onStateChanged();
    }
  });

  /* 回车快捷提交 */
  document.addEventListener('keydown', function(e){
    if(e.key !== 'Enter') return;
    if(e.target && e.target.id === 'ci-new'){
      e.preventDefault();
      var b = document.querySelector('[data-ci-add]');
      if(b) b.click();
    }
  });

  /* 本周三事：勾选完成 */
  document.addEventListener('change', function(e){
    var cb = e.target.closest ? e.target.closest('[data-plan-toggle]') : null;
    if(!cb) return;
    QZD.plan.toggleGoal(cb.getAttribute('data-plan-toggle'));
    UI.onStateChanged();
  });
})();
