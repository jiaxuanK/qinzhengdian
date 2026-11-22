/* ============================================================
   ui/pages/tasks.js · 今日勤政
   今日概览（专注总时长 / 场次） + 每日打卡（三档 + 热力图）
   + 御案奏折（新建 / 拆小目标 / 开始专注 / 办结）
   ============================================================ */
(function(){
  var CFG = QZD.config;
  var UI = QZD.ui;
  var ESC = function(t){ return UI.fmt.escape(t); };
  var dashMode = 'ring';   /* 仪表盘今日专注：'ring' 环 | 'bar' 条；只记内存 */

  /* ---------- 1. 今日概览 ---------- */
  function overviewCard(){
    var st = QZD.study.snapshot();
    var ck = st.checkin || { total: 0, done: 0, half: 0, score: 0, allDone: false };
    var penalty = (ck.total && !ck.allDone)
      ? '<span class="penalty-tag">今日打卡未满 · 选秀/召幸/珍宝 消费 ×' + st.multiplier + '</span>'
      : (ck.allDone
          ? '<span class="badge ok">今日打卡已满 ✓</span>'
          : '<span class="card-note">还没有打卡目标，先立一个吧</span>');

    return '<section class="card study-card tint-gold">' +
      '<div class="card-head"><span class="card-title">今 日 概 览</span>' + penalty + '</div>' +
      '<div class="realm-stats">' +
        '<div class="realm-stat hot"><span>今日专注</span><b><span id="tk-focus">' + st.doneMin + '</span><span class="unit">分</span></b></div>' +
        '<div class="realm-stat"><span>专注次数</span><b><span id="tk-sessions">' + st.sessionCount + '</span><span class="unit">次</span></b></div>' +
        '<div class="realm-stat' + (st.streak ? ' hot' : '') + '"><span>连续达标</span><b>' +
          st.streak + '<span class="unit">天</span></b></div>' +
        '<div class="realm-stat"><span>打卡得分</span><b><span id="tk-checkin">' + ck.done + '/' + ck.total + '</span></b></div>' +
      '</div>' +
      (ck.total ? '<div class="bar" style="margin-top:8px"><i id="tk-checkin-bar" style="width:' + ck.score + '%"></i></div>' : '') +
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
    /* 日期范围徽章 */
    var rangeBadge = '';
    if(g.startDate && g.endDate && g.startDate !== g.endDate){
      rangeBadge = '<span class="ci-range" title="' + ESC(g.startDate) + ' 至 ' + ESC(g.endDate) + '">' +
        ESC(g.startDate.slice(5)) + ' → ' + ESC(g.endDate.slice(5)) + '</span>';
    } else if(g.startDate && g.startDate !== QZD.stateIO.todayStr()){
      rangeBadge = '<span class="ci-range">' + ESC(g.startDate.slice(5)) + '</span>';
    }
    return '<div class="ci-row' + (g.level === 2 ? ' done' : '') + '">' +
      '<div class="ci-main">' +
        '<span class="ci-title">' + ESC(g.title) + rangeBadge + '</span>' +
        '<span class="ci-reward">完成可赏 ' + rewardTxt + '</span>' +
      '</div>' +
      levelButtons(g) +
      '<button class="ci-del" data-ci-del="' + g.id + '" title="删除目标">×</button>' +
    '</div>';
  }

  function checkinCard(){
    var allList = QZD.checkin.list();
    /* 今日生效的目标 */
    var list = allList.filter(function(g){ return QZD.checkin.isActiveToday(g); });
    var st = QZD.checkin.todayStat();
    var presets = (QZD.checkin.PRESETS || []).map(function(p){
      return '<button class="chip sm" data-ci-preset="' + ESC(p) + '">' + ESC(p) + '</button>';
    }).join('');

    var body = list.length
      ? list.map(goalRow).join('')
      : '<div class="empty">今日还没有生效的目标<span class="card-note">从下面加一个，比如「早睡」</span></div>';

    return '<section class="card tint-green">' +
      '<div class="card-head"><span class="card-title">习 惯 打 卡</span>' +
      '<span class="card-note">' + st.done + ' / ' + st.total + ' 完成 · 得分 ' + st.score +
        (st.allDone ? ' · 全部达成' : '') +
        (allList.length > list.length ? ' · 另有 ' + (allList.length - list.length) + ' 个长期目标今日未生效' : '') +
      '</span></div>' +
      body +
      (presets ? '<div class="chip-row" style="margin-top:10px">' + presets + '</div>' : '') +
      '<div class="ci-add" style="flex-wrap:wrap">' +
        '<input id="ci-new" maxlength="' + (CFG.CHECKIN.TITLE_MAX || 16) +
          '" placeholder="添加目标，如：早睡 / 运动 30 分" style="flex:1;min-width:160px">' +
        '<input id="ci-start" type="date" style="width:130px" title="开始日期">' +
        '<span style="color:#8a8574;font-size:11px">至</span>' +
        '<input id="ci-end" type="date" style="width:130px" title="结束日期（留空=单日）">' +
        '<button class="btn primary" data-ci-add>加 入</button>' +
      '</div>' +
      '<p class="page-foot" style="margin-top:8px">不填日期 → 仅今日；填起止 → 每天自动出现该目标，过期自动隐藏。</p>' +
    '</section>';
  }

  /* ---------- 3. 热力图 ---------- */
  function heatmapCard(){
    return '<section class="card tint-qing">' +
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
    /* 11-21 串线：三事升格「周主线」，自动聚合挂靠奏折 + 速记，算完成度 */
    var byGoal = (QZD.plan && QZD.plan.progressByGoal) ? QZD.plan.progressByGoal(7) : {};
    var memByGoal = (QZD.memorials && QZD.memorials.byGoal) ? QZD.memorials.byGoal() : {};
    var body;
    if(goals.length){
      /* 升级1：整体完成度大环（按每件三事的完成比例平均） */
      var sumPct = 0;
      goals.forEach(function(g){
        var mb = memByGoal[g.id] || { total:0, done:0 };
        sumPct += (g.done || (mb.total > 0 && mb.done === mb.total)) ? 100
                : (mb.total ? mb.done / mb.total * 100 : 0);
      });
      var overall = Math.round(sumPct / goals.length);
      var R = 30, CIRC = 2 * Math.PI * R, OFF = CIRC * (1 - overall / 100);
      var ringHtml = '<div class="plan-overall">' +
        '<svg viewBox="0 0 72 72" aria-label="周主线整体完成度 ' + overall + '%">' +
          '<circle cx="36" cy="36" r="' + R + '" fill="none" stroke="var(--line)" stroke-width="7"/>' +
          '<circle cx="36" cy="36" r="' + R + '" fill="none" stroke="var(--daiqing)" stroke-width="7" ' +
            'stroke-linecap="round" stroke-dasharray="' + CIRC.toFixed(1) + '" stroke-dashoffset="' + OFF.toFixed(1) +
            '" transform="rotate(-90 36 36)"/>' +
          '<text x="36" y="41" text-anchor="middle" font-size="17" font-weight="700" fill="var(--ink)">' + overall + '%</text>' +
        '</svg>' +
        '<div class="plan-overall-note"><b>本周主线</b><span>整体完成度</span></div>' +
      '</div>';

      /* 升级3：周中提醒（周三/周五，有未完成且无进展的三事） */
      var dow = (new Date().getDay() + 6) % 7;   /* 周一=0 */
      var warn = '';
      if(dow === 2 || dow === 4){
        var stale = goals.filter(function(g){
          var done = g.done || (function(){ var mb=memByGoal[g.id]||{total:0,done:0}; return mb.total>0&&mb.done===mb.total; })();
          return !done && !(byGoal[g.id] || []).length;
        });
        if(stale.length) warn = '<div class="plan-warn">周中提醒：还有 ' + stale.length +
          ' 件主线既没进展也没挂奏折，趁周末前推进一下。' +
          stale.map(function(g){ return esc(g.text); }).join(' / ') + '</div>';
      }

      /* 大计下拉选项（升级4）：挂靠到大计节点，完成三事时在节点留痕迹 */
      var goalNodes = (QZD.goals && QZD.goals.list) ? QZD.goals.list() : [];
      /* 每项三事的选中态不同，故在 map 内各自生成；这里只留空壳占位避免重复计算 */
      function nodeOptions(selId){
        return goalNodes.map(function(n){
          return '<option value="' + esc(n.id) + '"' + (n.id === selId ? ' selected' : '') + '>' +
            esc(n.title) + '</option>';
        }).join('');
      }

      body = ringHtml + warn + '<div class="plan-goals">' + goals.map(function(g){
        var mb = memByGoal[g.id] || { total:0, done:0, focusMin:0 };
        var notes = (byGoal[g.id] || []).length;
        var pct = mb.total ? Math.round(mb.done / mb.total * 100) : 0;
        var autoDone = mb.total > 0 && mb.done === mb.total;
        var isDone = g.done || autoDone;
        var node = (QZD.goals && QZD.goals.find && g.goalNodeId) ? QZD.goals.find(g.goalNodeId) : null;
        var note = (mb.total || notes)
          ? '<em class="plan-gprog">' + mb.done + '/' + mb.total + ' 折' +
            (mb.focusMin ? ' · ' + mb.focusMin + '分' : '') +
            (notes ? ' · ' + notes + '进展' : '') + '</em>'
          : '<em class="plan-gprog plain">未挂靠奏折</em>';
        var tools = '<div class="plan-gtools">' +
          '<button type="button" class="chip sm" data-plan-attach="' + esc(g.id) + '" title="挂靠奏折">＋挂折</button>' +
          '<select class="plan-node-sel" data-plan-node="' + esc(g.id) + '" title="关联千秋大计">' +
            '<option value="">链大计</option>' + nodeOptions(g.goalNodeId || '') +
          '</select></div>';
        return '<div class="plan-goal' + (isDone ? ' done' : '') + '">' +
          '<label class="plan-glabel">' +
            '<input type="checkbox" data-plan-toggle="' + g.id + '"' + (isDone ? ' checked' : '') + '>' +
            '<span>' + esc(g.text) + '</span>' + note +
          '</label>' +
          (mb.total ? '<i class="plan-gbar"><b style="width:' + pct + '%"></b></i>' : '') +
          tools + '</div>';
      }).join('') + '</div>' +
      '<p class="card-note" style="margin:6px 0 0">「＋挂折」把已有奏折挂到主线；「链大计」关联长期目标。挂靠奏折全办结即自动完成。</p>' +
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
    return '<section class="card tint-he">' +
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
    return '<section class="card tint-gold">' +
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
    var all = QZD.memorials.dueList(365).all;   /* 只要有期限就提示，不限 7 天 */
    var esc = UI.fmt.escape;
    if(!all.length){
      return '<section class="card tint-red">' +
        '<div class="card-head"><span class="card-title">期 限</span>' +
          '<span class="card-note">奏折设了截止日就会出现在这里</span></div>' +
        '<p class="card-note">目前没有设截止日的奏折。新建/编辑奏折时填截止日，这里会按紧急程度提示。</p>' +
      '</section>';
    }
    /* 紧急程度 6 档：越近数字越大、颜色越醒目（红→橙→金→青→灰）。
       全部显示，不截断；时间远近直接体现在 day-num 的字号与颜色上。 */
    function levelOf(days){
      if(days < 0)  return 'over';      /* 逾期：红底白字 */
      if(days === 0) return 'today';    /* 今天：红 */
      if(days <= 3)  return 'soon';     /* 3天内：橙 */
      if(days <= 7)  return 'week';     /* 一周内：金 */
      if(days <= 30) return 'month';    /* 一月内：青 */
      return 'far';                     /* 更远：灰 */
    }
    var cnt = { over:0, today:0, soon:0, week:0, month:0, far:0 };
    all.forEach(function(x){ cnt[levelOf(x.days)]++; });
    return '<section class="card tint-red">' +
      '<div class="card-head"><span class="card-title">期 限 · 全部 ' + all.length + ' 项</span>' +
        '<span class="card-note">逾期 ' + cnt.over + ' · 今天 ' + cnt.today +
          ' · 3天内 ' + cnt.soon + ' · 一周内 ' + cnt.week +
          ' · 一月内 ' + cnt.month + ' · 更远 ' + cnt.far + '</span></div>' +
      '<div class="ddl-list">' + all.map(function(x){
        var lv = levelOf(x.days);
        var num = x.days < 0 ? Math.abs(x.days) : x.days;
        var unit = x.days < 0 ? '天前逾期' : (x.days === 0 ? '今天' : '天后');
        var label = x.days < 0 ? ('逾期 ' + Math.abs(x.days) + ' 天')
                  : (x.days === 0 ? '今天截止' : ('剩 ' + x.days + ' 天'));
        return '<div class="ddl-row ddl-' + lv + '">' +
          '<span class="ddl-daynum ddl-' + lv + '"><b>' + num + '</b><i>' + unit + '</i></span>' +
          '<span class="ddl-name" title="' + esc(label) + '">' + esc(x.title) + '</span>' +
          '<span class="ddl-badge ' + lv + '">' + label + '</span>' +
          '<span class="ddl-date">' + fmtDay(x.dueAt) + '</span>' +
        '</div>';
      }).join('') + '</div>' +
    '</section>';
  }

  /* ---------- 期限前瞻：苹果日历式月历，格子内叠 DDL / 打卡 / 专注 ---------- */
  function ddlForecastCard(){
    var esc = UI.fmt.escape;
    var today = new Date(); today.setHours(0, 0, 0, 0);

    /* 1. 收集 deadline（奏折 + 大计） */
    var all = [];
    if(QZD.memorials && QZD.memorials.dueList){
      var memAll = QZD.memorials.dueList(365).all || [];
      memAll.forEach(function(x){ all.push({ dueAt: x.dueAt, title: x.title, _src: '奏折' }); });
    }
    if(QZD.goals && QZD.goals.list){
      QZD.goals.list().forEach(function(g){
        if(!g.deadline) return;
        var dlStr = g.deadline;
        if(/^\d{4}-\d{2}$/.test(dlStr)) dlStr = dlStr + '-01';
        var dlMs = new Date(dlStr + 'T23:59:59').getTime();
        if(isNaN(dlMs)) return;
        all.push({ dueAt: dlMs, title: g.title, _src: '大计' });
      });
    }
    /* 没有截止日也要留着这张卡：格子里的专注分钟和打卡圆点本身就有价值，
       不能因为「还没设期限」就把整张日历藏起来。 */

    /* 按日分桶 + 逾期 */
    var buckets = {}, overdue = [];
    all.forEach(function(x){
      if(x.dueAt < today.getTime()){ overdue.push(x); return; }
      var d = new Date(x.dueAt); d.setHours(0, 0, 0, 0);
      var key = QZD.stateIO.todayStr(d);
      (buckets[key] = buckets[key] || []).push(x);
    });

    /* 打卡 / 专注历史 */
    var ckHist = (QZD.state.checkin && QZD.state.checkin.history) || {};
    var stHist = (QZD.state.study && QZD.state.study.history) || {};

    /* 月历：覆盖今天所在月（含前后补齐到整周） */
    var y = today.getFullYear(), m = today.getMonth();
    var first = new Date(y, m, 1);
    var lead = (first.getDay() + 6) % 7;              /* 周一为首列 */
    var gridStart = new Date(y, m, 1 - lead);
    var todayKey = QZD.stateIO.todayStr(today);
    var WEEK = ['一', '二', '三', '四', '五', '六', '日'];
    var head = '<div class="dfl-weekhead">' + WEEK.map(function(w){ return '<span>'+w+'</span>'; }).join('') + '</div>';

    var cells = '', maxN = 1;
    Object.keys(buckets).forEach(function(k){ if(buckets[k].length > maxN) maxN = buckets[k].length; });
    for(var i = 0; i < 42; i++){
      var d = new Date(gridStart.getTime()); d.setDate(d.getDate() + i);
      var key = QZD.stateIO.todayStr(d);
      var inMonth = d.getMonth() === m;
      var items = buckets[key] || [];
      var isToday = key === todayKey;
      var isWeekend = (d.getDay() === 0 || d.getDay() === 6);
      var ck = ckHist[key];
      var min = Math.round(stHist[key] || 0);
      var cls = 'dfl-cell' + (inMonth ? '' : ' out') + (isToday ? ' today' : '') + (isWeekend ? ' weekend' : '');

      /* DDL 条：沿用 dfl-bar + busy/warn 三档，保留撞车语义 */
      var bar = '';
      if(items.length){
        var titles = items.map(function(x){
          return (x._src === '大计' ? '【计】' : '') + x.title;
        }).join('、');
        var lv = items.length >= 3 ? ' busy' : (items.length === 2 ? ' warn' : '');
        var w = Math.max(34, Math.round(items.length / maxN * 100));
        bar = '<div class="dfl-bar' + lv + '" style="width:'+w+'%" title="'+esc(titles)+'">' +
          esc(items[0].title) + '</div>';
      }
      var marks = '';
      if(ck && (ck.score > 0 || ck.done)){
        marks += '<span class="dfl-ck" title="打卡 '+ (ck.score||'') +'分">●</span>';
      }
      if(min > 0) marks += '<span class="dfl-min" title="专注 '+min+' 分">'+min+'m</span>';
      var tipText = (d.getMonth()+1)+'/'+d.getDate() +
        (items.length ? ' · '+items.length+' 项期限' : '') +
        (min ? ' · 专注'+min+'分' : '') + (ck ? ' · 已打卡' : '');

      cells += '<div class="'+cls+'" title="'+esc(tipText)+'">' +
        '<span class="dfl-d">'+d.getDate()+'</span>' + bar +
        '<span class="dfl-marks">'+marks+'</span></div>';
    }

    var overdueHead = '';
    if(overdue.length){
      overdueHead = '<div class="dfl-overdue"><b>' + overdue.length + ' 项已逾期</b> · ' +
        esc(overdue.slice(0, 3).map(function(x){
          return (x._src === '大计' ? '【计】' : '') + x.title;
        }).join('、')) + (overdue.length > 3 ? ' 等' : '') + '</div>';
    }
    var busyDays = Object.keys(buckets).filter(function(k){ return buckets[k].length >= 3; }).length;
    var tip = !all.length
      ? '还没有设截止日；格子里的数字是当天专注分钟，圆点是打卡。'
      : (busyDays
        ? '未来两周有 ' + busyDays + ' 天堆了 3 项以上，提前拆一下免得到期扎堆。'
        : '未来两周期限分布平稳，没有明显撞车。');
    var goalsCount = all.filter(function(x){ return x._src === '大计'; }).length;
    if(goalsCount) tip += '（含 ' + goalsCount + ' 项大计 deadline）';

    return '<section class="card tint-qing">' +
      '<div class="card-head"><span class="card-title">期限前瞻 · 日历</span>' +
        '<span class="card-note">期限 / 打卡 / 专注 一眼看</span></div>' +
      overdueHead +
      '<div class="dfl-month">' + (m+1) + ' 月</div>' +
      '<div class="dfl-cal">' + head + '<div class="dfl-grid">' + cells + '</div></div>' +
      '<p class="pva-verdict">' + tip + '</p>' +
    '</section>';
  }

  /* ---------- 今日仪表盘：周几 / 今日应专注 / 最近期限 ---------- */
  var WEEK_CN = ['日', '一', '二', '三', '四', '五', '六'];
  function todayDashCard(){
    var now = new Date();
    var day = now.getDay();
    var weekend = (day === 0 || day === 6);
    var shouldH = weekend ? 8 : 10;   /* 工作日 10h × 5 + 周末 8h × 2 = 66h */
    var md = (now.getMonth() + 1) + ' 月 ' + now.getDate() + ' 日';
    var esc = UI.fmt.escape;

    /* 距周末：周六/周日算周末进行中；否则算到周六还有几天 */
    var toSat = (6 - day + 7) % 7;
    var weekendInfo = weekend
      ? { num: '享', unit: '受周末', note: '好好歇一天，明早再开工' }
      : { num: toSat, unit: '天', note: toSat <= 1 ? '就在眼前，稳住最后一段' : '稳稳推进，周末就在前头' };

    /* 今日实际专注 → 相对应专注时长的完成环 */
    var doneMin = (QZD.study && QZD.study.snapshot) ? QZD.study.snapshot().doneMin : 0;
    var goalMin = shouldH * 60;
    var pct = Math.min(1, doneMin / goalMin);
    var rr = 30, circ = 2 * Math.PI * rr, off = circ * (1 - pct);
    var ringColor = pct >= 1 ? 'var(--daiqing)' : (pct >= 0.5 ? 'var(--teng)' : '#b3542e');
    var ring =
      '<svg viewBox="0 0 76 76" class="dash-ring" role="img" aria-label="今日专注进度">' +
        '<circle cx="38" cy="38" r="' + rr + '" fill="none" stroke="var(--line)" stroke-width="8"/>' +
        '<circle cx="38" cy="38" r="' + rr + '" fill="none" stroke="' + ringColor +
          '" stroke-width="8" stroke-linecap="round" stroke-dasharray="' + circ.toFixed(1) +
          '" stroke-dashoffset="' + off.toFixed(1) + '" transform="rotate(-90 38 38)"/>' +
        '<text x="38" y="43" text-anchor="middle" font-size="17" font-weight="700" ' +
          'fill="var(--ink)">' + Math.round(pct * 100) + '%</text>' +
      '</svg>';
    /* 条形版：同样的百分比，横向长条更省地方，刻度分段 */
    var barHtml =
      '<div class="dash-bar-view" role="img" aria-label="今日专注进度">' +
        '<div class="dash-bar-top"><b>' + Math.round(pct * 100) + '%</b>' +
          '<span class="card-note">今日 ' + doneMin + ' / ' + goalMin + ' 分</span></div>' +
        '<div class="dash-bar-track">' +
          '<i class="dash-bar-fill" style="width:' + (pct * 100).toFixed(1) + '%;background:' + ringColor + '"></i>' +
        '</div>' +
        '<div class="dash-bar-ticks"><span>0</span><span>半程</span><span>' + shouldH + 'h</span></div>' +
      '</div>';
    var progressView = dashMode === 'bar' ? barHtml : ring;
    var dashSwitch =
      '<div class="chart-switch dash-mode-switch">' +
        '<button class="chip sm' + (dashMode === 'ring' ? ' active' : '') +
          '" data-dash-mode="ring">环</button>' +
        '<button class="chip sm' + (dashMode === 'bar' ? ' active' : '') +
          '" data-dash-mode="bar">条</button>' +
      '</div>';
    var doneH = Math.floor(doneMin / 60), doneM = Math.round(doneMin % 60);
    var ringNote = doneMin > 0
      ? ('已专注 ' + (doneH ? doneH + 'h' : '') + doneM + 'm / ' + shouldH + 'h')
      : '尚未开始 · 去专注一场';

    /* 最近期限：dueList 已按 dueAt 排序，取第一个（逾期优先，其次最近） */
    var nextHtml = '<span class="dash-ddl-none">近期没有设期限的奏折</span>';
    if(QZD.memorials && QZD.memorials.dueList){
      var due = QZD.memorials.dueList(365);
      var pick = due.overdue[0] || due.soon[0] || due.all[0];
      if(pick){
        var cls = pick.days < 0 ? 'over' : (pick.days <= 3 ? 'soon' : '');
        var num, unit;
        if(pick.days < 0){ num = Math.abs(pick.days); unit = '天'; cls='over'; }
        else if(pick.days === 0){ num = '今'; unit = '天截止'; cls='over'; }
        else { num = pick.days; unit = '天'; }
        var prefix = pick.days < 0 ? '已逾期' : (pick.days === 0 ? '' : '还有');
        var more = (due.overdue.length + due.soon.length) > 1
          ? '另有 ' + (due.overdue.length + due.soon.length - 1) + ' 项临近' : '';
        nextHtml = '<div class="dash-ddl-title">' + esc(pick.title) + '</div>' +
          '<div class="dash-ddl-num ' + cls + '"><em>' + prefix + '</em><b>' + num + '</b><span>' + unit + '</span>' +
            '</div>' +
          (more ? '<span class="dash-ddl-more">' + more + '</span>' : '');
      }
    }

    return '<section class="card today-dash">' +
      '<div class="dash-cell dash-date">' +
        '<div class="dash-label">今天</div>' +
        '<div class="dash-big dash-weekday">周' + WEEK_CN[day] + '</div>' +
        '<div class="dash-sub">' + md + (weekend ? ' · 周末' : ' · 工作日') + '</div>' +
      '</div>' +
      '<div class="dash-cell dash-should">' +
        '<div class="dash-label">今日应专注</div>' +
        '<div class="dash-big"><b>' + shouldH + '</b><span> 小时</span></div>' +
        '<div class="dash-sub">工作日 10h · 周末 8h</div>' +
      '</div>' +
      '<div class="dash-cell dash-progress">' +
        '<div class="dash-label">今日进度 ' + dashSwitch + '</div>' +
        '<div class="dash-ring-wrap">' + progressView + '</div>' +
        '<div class="dash-sub">' + ringNote + '</div>' +
      '</div>' +
      '<div class="dash-cell dash-weekend">' +
        '<div class="dash-label">距周末</div>' +
        '<div class="dash-big"><b>' + weekendInfo.num + '</b><span> ' + weekendInfo.unit + '</span></div>' +
        '<div class="dash-sub">' + weekendInfo.note + '</div>' +
      '</div>' +
      '<div class="dash-cell dash-ddl">' +
        '<div class="dash-label">最近期限</div>' +
        nextHtml +
      '</div>' +
    '</section>';
  }

  /* ======== 注册三个独立页面 ======== */

  /* 概览：顶部 tab 切换 今日 / 本周 / 钦天 */
  var _ovTab = 'today';
  UI.register('ov', function(){
    /* 外部入口（御书房烛台）请求切到某个概览 tab：消费一次性标记，
       避免之后每次进概览都被强制切走。 */
    if(UI.pendingOvTab === 'chronos' || UI.pendingOvTab === 'today' || UI.pendingOvTab === 'week'){
      _ovTab = UI.pendingOvTab;
      UI.pendingOvTab = null;
    }
    var s = QZD.state;
    var OV = QZD.ui._overviewParts || {};
    function G(fn){ try { return fn ? fn() : ''; } catch(e){ return ''; } }
    function Gs(fn){ try { return fn ? fn(s) : ''; } catch(e){ return ''; } }
    var chronosFn = UI.page('chronos');
    var tabs = '<div class="tab-row ov-tabs">' +
      '<button class="tab' + (_ovTab === 'today' ? ' active' : '') + '" data-ovtab="today">今日</button>' +
      '<button class="tab' + (_ovTab === 'week' ? ' active' : '') + '" data-ovtab="week">本周</button>' +
      '<button class="tab' + (_ovTab === 'chronos' ? ' active' : '') + '" data-ovtab="chronos">钦天</button>' +
    '</div>';
    var body;
    if(_ovTab === 'chronos'){
      /* 11-18：包一层 embed 标记，让 chronos 内部的视图/跨度切换只重绘、
         不调 UI.show('chronos') 跳走（否则总览两组导航消失、像被锁定） */
      body = chronosFn
        ? '<div data-chronos-embed="1">' + chronosFn() + '</div>'
        : '<div class="empty">钦天监未加载</div>';
    }else if(_ovTab === 'week'){
      body =
        G(OV.weekProgressCard) +
        ddlForecastCard() +
        planCard() +
        G(OV.quickProgressCard);
    }else{
      body =
        todayDashCard() +
        overviewCard() +
        ddlCard() +
        ddlForecastCard() +
        G(OV.researchPanel) +
        achvCard();
    }
    return '<div class="overview-page">' +
      G(OV.dynastyBanner) +
      tabs + body +
    '</div>';
  });

  /* 歇一歇：随时可进的节拍呼吸（不依赖专注状态） */
  function restCard(){
    return '<section class="card rest-card">' +
      '<div class="card-head"><span class="card-title">歇 一 歇</span>' +
        '<span class="card-note">吸 4 秒 · 停 2 秒 · 呼 6 秒</span></div>' +
      '<div class="rest-card-body">' +
        '<div class="rest-card-ring"><i></i><b>呼</b></div>' +
        '<div class="rest-card-txt"><p>脑子发热的时候，停下来按节奏呼吸几分钟。不记收益，只管放松。</p>' +
          '<button type="button" class="btn primary" data-rest-open>进入呼吸</button></div>' +
      '</div>' +
    '</section>';
  }

  /* 速行：快捷入口/按钮/跳转 —— 排序=最常用→次常用→工具类 */
  UI.register('quick', function(){
    var OV = QZD.ui._overviewParts || {};
    function G(fn){ try { return fn ? fn() : ''; } catch(e){ return ''; } }
    return '<div class="overview-page">' +
      G(OV.actionPanel) +       /* 1. 今日行动（最顶，每天第一件事）*/
      restCard() +              /* 2. 歇一歇：节拍呼吸放松 */
      G(OV.quickProgressCard) + /* 3. 速记进展（输入+提交）*/
      G(OV.quickBar) +          /* 4. 网络快捷跳转（web/file/app 三类）*/
    '</div>';
  });

  /* 奏折：从今日勤政拆出 */
  UI.register('memorials', function(){
    return memorialBlock();
  });

  /* 习惯打卡：独立页面 */
  UI.register('checkin', function(){
    return checkinCard() + heatmapCard() +
      '<p class="page-foot">打卡次日 0 时归档并清空；专注时长、次数与打卡得分永久留档，供热力图统计。</p>';
  });

  /* 专注台：科研台主入口 */
  UI.register('pomodoro', function(){
    var POMO = QZD.pomodoro || {};
    var st = QZD.study.snapshot();
    var nowActive = !!(POMO.isActive && POMO.isActive());
    var s = QZD.state;
    var pizhong = (s.memorials || []).filter(function(m){ return m.status === 'pizhong'; });

    /* 开始专注按钮区 */
    var startBtn = nowActive
      ? '<button class="btn primary big" disabled>◷ 专注进行中 · ' + Math.round(POMO.realizedMinutes ? POMO.realizedMinutes() : 0) + ' 分</button>'
      : '<button class="btn primary big" data-focus-new="1">▸ 开始一场专注</button>';

    /* 进行中奏折列表 */
    var pizhongHtml = '';
    if(pizhong.length){
      pizhongHtml = '<div class="card"><div class="card-title">进行中的奏折</div>' +
        pizhong.map(function(m){
          var pr = QZD.memorials.progress(m);
          var canStart = !nowActive && !(POMO.isActive && POMO.isActive());
          return '<div class="mem-card" style="padding:10px 14px;margin-bottom:8px">' +
            '<b>' + UI.fmt.escape(m.title) + '</b>' +
            '<span style="color:var(--ink-muted);margin-left:8px">' +
              (pr.total ? '小目标 ' + pr.done + '/' + pr.total : '专注 ' + pr.focusMin + ' 分') +
            '</span>' +
            '<button class="btn ' + (canStart ? 'primary' : 'ghost') + '" style="float:right" ' +
              (canStart ? 'data-focus-continue="' + m.id + '"' : 'disabled') + '>' +
              (canStart ? '继续专注' : '专注中') +
            '</button>' +
          '</div>';
        }).join('') + '</div>';
    }

    /* 专注统计卡 */
    var weekHist = (s.study && s.study.history) || {};
    var today = new Date(); today.setHours(0,0,0,0);
    var WD = ['日','一','二','三','四','五','六'];
    function dateStr(d){ return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); }
    var bars = [];
    var maxMin = 60;
    for(var i=6; i>=0; i--){
      var d = new Date(today.getTime() - i*86400000);
      var key = dateStr(d);
      var mins = (weekHist[key] && weekHist[key].min) || 0;
      bars.push('<div style="flex:1;text-align:center">' +
        '<div style="height:40px;display:flex;align-items:flex-end;justify-content:center">' +
          '<div style="width:6px;height:' + Math.max(2, mins/maxMin*38) + 'px;background:var(--daiqing);border-radius:2px"></div>' +
        '</div>' +
        '<small style="color:var(--ink-muted)">' + WD[d.getDay()] + '</small>' +
        '<div style="font-size:10px;color:var(--ink-muted)">' + mins + '</div>' +
      '</div>');
    }

    return '<div class="overview-page">' +
      /* 主卡：开始专注 */
      '<div class="card" style="text-align:center;padding:28px">' +
        '<div style="font-size:14px;color:var(--ink-muted);margin-bottom:6px">今日专注</div>' +
        '<div style="font-size:42px;font-weight:700;color:var(--daiqing);font-variant-numeric:tabular-nums">' +
          st.doneMin + '<span style="font-size:16px;color:var(--ink-muted);margin-left:6px">分钟</span></div>' +
        '<div style="color:var(--ink-muted);margin:8px 0 16px">' +
          '本周累计 <b>' + st.week + '</b> 分 · 连续 <b>' + (st.streak || 0) + '</b> 天达标</div>' +
        startBtn +
      '</div>' +

      /* 近 7 天迷你柱 */
      '<div class="card"><div class="card-title">近 7 天专注</div>' +
        '<div style="display:flex;gap:8px;padding:8px 0">' + bars.join('') + '</div>' +
      '</div>' +

      /* 进行中奏折 */
      pizhongHtml +

      /* 提示 */
      '<p class="page-foot">专注开始后弹出悬浮正计时窗；可绑定陪伴妃嫔；完成自动结算勤政值与金钱。</p>' +
    '</div>';
  });
  UI.register('tasks', function(){
    var body = todayDashCard() + ddlCard() + overviewCard() + planCard() + achvCard() + ddlForecastCard() +
      memorialBlock() + checkinCard() + heatmapCard();
    return body +
      '<p class="page-foot">此页面为旧版兼容，推荐从「朕 → 概要」或「大计 → 奏折」进入。</p>';
  });

  /* 专注进行中只更新数字，绝不重建 DOM（否则输入框会每秒被清空） */
  QZD.tasks = {
    tick: function(){
      var st = QZD.study.snapshot();
      var ck = st.checkin || { total: 0, done: 0, score: 0 };
      var map = {
        'tk-focus': st.doneMin,
        'tk-sessions': st.sessionCount,
        'tk-checkin': ck.done + '/' + ck.total
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
    /* 概览 tab：今日 / 本周 */
    var ovt = e.target.closest('[data-ovtab]');
    if(ovt){
      _ovTab = ovt.getAttribute('data-ovtab');
      UI.renderPage();
      return;
    }
    /* 仪表盘 环⇄条 切换（只记内存） */
    var dm = e.target.closest('[data-dash-mode]');
    if(dm){
      dashMode = dm.getAttribute('data-dash-mode') === 'bar' ? 'bar' : 'ring';
      UI.renderPage();
      return;
    }
    /* 11-18：data-ttab-go 遗留 handler 已删——它引用导航重构后不存在的
       TASK_TABS/taskTab，点击会抛错导致跳转异常。现改用 data-goto 直达目标页。 */

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
    /* 升级2：＋挂折 —— 弹出奏折列表，勾选挂到这条主线 */
    var attachBtn = e.target.closest('[data-plan-attach]');
    if(attachBtn){
      var gid = attachBtn.getAttribute('data-plan-attach');
      var mems = (QZD.memorials && QZD.memorials.find) ? (QZD.state.memorials || []) : [];
      var actives = mems.filter(function(m){ return m && m.status !== 'banjie'; });
      if(!actives.length){ UI.toast('没有可挂靠的在办奏折'); return; }
      var rows = actives.map(function(m){
        var checked = m.goalId === gid;
        return '<label class="plan-attach-row"><input type="checkbox" data-attach-mem="' + UI.fmt.escape(m.id) +
          '"' + (checked ? ' checked' : '') + '> <span>' + UI.fmt.escape(m.title) + '</span></label>';
      }).join('');
      UI.modal({
        title: '挂靠奏折到本周主线',
        body: '<p class="card-note">勾选要挂到这条主线的奏折（可多选，取消勾选即脱离）</p>' +
          '<div class="plan-attach-list">' + rows + '</div>',
        ok: true, okText: '保存挂靠',
        onOk: function(mask){
          var changed = 0;
          mask.querySelectorAll('[data-attach-mem]').forEach(function(cb){
            var mid = cb.getAttribute('data-attach-mem');
            var hit = QZD.memorials.find(mid);
            if(!hit) return;
            var want = cb.checked ? gid : null;
            if((hit.goalId || null) === want) return;
            QZD.memorials.update(mid, { goalId: want });
            changed++;
          });
          UI.toast(changed ? ('已挂靠/调整 ' + changed + ' 折') : '无改动');
          UI.onStateChanged();
        }
      });
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
      var sInp = document.getElementById('ci-start');
      var eInp = document.getElementById('ci-end');
      var startDate = sInp ? sInp.value : '';
      var endDate = eInp ? eInp.value : '';
      /* 只有开始没有结束 → 单日 */
      if(startDate && !endDate) endDate = startDate;
      /* 结束早于开始 → 交换 */
      if(startDate && endDate && endDate < startDate){ var t = startDate; startDate = endDate; endDate = t; }
      var res = QZD.checkin.addGoal(inp ? inp.value : '', startDate, endDate);
      if(!res.ok){ UI.toast(res.error); return; }
      var label = (res.goal.startDate !== res.goal.endDate)
        ? '已加入目标 · ' + res.goal.title + '（' + res.goal.startDate + ' 至 ' + res.goal.endDate + '）'
        : '已加入目标 · ' + res.goal.title;
      UI.toast(label);
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
    if(cb){
      var gid = cb.getAttribute('data-plan-toggle');
      var wasOn = (QZD.plan.goals() || []).filter(function(g){ return g.id === gid; })[0];
      var r = QZD.plan.toggleGoal(gid);
      /* 升级4：三事手动勾完成时，给关联的大计节点留一条达成痕迹（不覆盖自动进度） */
      if(r.ok && r.goal && r.goal.done && wasOn && !wasOn.done && r.goal.goalNodeId){
        var node = QZD.goals && QZD.goals.find ? QZD.goals.find(r.goal.goalNodeId) : null;
        if(node && QZD.goals.addLink){
          /* ref 用三事 id 保证每个主线留独立痕迹（addLink 按 type+ref 去重） */
          var has = (node.links || []).some(function(lk){ return lk.type === 'custom' && lk.ref === gid; });
          if(!has) QZD.goals.addLink(node.id, 'custom', gid, '本周主线达成 · ' + r.goal.text);
          UI.toast('主线达成 · 已记入大计「' + node.title + '」');
        }
      }
      UI.onStateChanged();
      return;
    }
    /* 升级4：链大计下拉 */
    var ns = e.target.closest ? e.target.closest('[data-plan-node]') : null;
    if(ns){
      var nid = ns.getAttribute('data-plan-node');
      var rr = QZD.plan.setGoalNode(nid, ns.value || null);
      UI.toast(rr.ok ? (ns.value ? '已链到大计' : '已取消大计关联') : (rr.error || '操作失败'));
      UI.onStateChanged();
    }
  });
})();
