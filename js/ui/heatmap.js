/* ============================================================
   ui/heatmap.js · 打卡统计热力图
   周 / 月 / 年 三视图；按打卡得分分级着色
   ============================================================ */
(function(){
  var UI = QZD.ui;

  function ds(d){ return QZD.stateIO.todayStr(d); }
  function parse(s){
    var p = String(s).split('-');
    return new Date(+p[0], (+p[1]) - 1, +p[2]);
  }
  function addDays(d, n){
    var x = new Date(d.getTime());
    x.setDate(x.getDate() + n);
    return x;
  }
  function startOfDay(d){
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }
  var WEEK_CN = ['日', '一', '二', '三', '四', '五', '六'];

  function recOf(date){
    var r = QZD.checkin ? QZD.checkin.dayOf(date) : { score: 0, done: 0, half: 0, total: 0 };
    var f = (QZD.study && QZD.study.dayMinutes) ? QZD.study.dayMinutes(date) : 0;
    return { score: r.score || 0, done: r.done || 0, half: r.half || 0, total: r.total || 0, focus: f || 0 };
  }

  /* 得分 → 强度等级 0–5 */
  function lv(score){
    if(!score) return 0;
    if(score >= 100) return 5;
    if(score >= 76) return 4;
    if(score >= 51) return 3;
    if(score >= 26) return 2;
    return 1;
  }

  function tip(date, r){
    var parts = [date];
    if(r.total) parts.push('打卡 ' + r.done + '/' + r.total + (r.half ? '（半 ' + r.half + '）' : ''));
    else parts.push('无打卡');
    parts.push('得分 ' + r.score);
    parts.push('专注 ' + r.focus + ' 分');
    return parts.join(' · ');
  }

  function cell(date, r, cls){
    return '<div class="hm-cell lv-' + lv(r.score) + (cls ? ' ' + cls : '') + '" ' +
      'title="' + UI.fmt.escape(tip(date, r)) + '"></div>';
  }

  /* ---------- 周视图：最近 7 天，信息更详细 ---------- */
  function weekView(){
    var today = startOfDay(new Date());
    var cells = [];
    for(var i = 6; i >= 0; i--){
      var d = addDays(today, -i);
      var key = ds(d);
      var r = recOf(key);
      cells.push(
        '<div class="hm-week-day">' +
          '<span class="hm-week-wd">' + (i === 0 ? '今天' : '周' + WEEK_CN[d.getDay()]) + '</span>' +
          '<span class="hm-week-date">' + (d.getMonth() + 1) + '/' + d.getDate() + '</span>' +
          '<div class="hm-week-bar lv-' + lv(r.score) + '">' +
            '<i style="height:' + Math.max(4, r.score) + '%"></i>' +
          '</div>' +
          '<span class="hm-week-score">' + (r.total ? r.score : '—') + '</span>' +
          '<span class="hm-week-min">' + (r.focus ? r.focus + '分' : '') + '</span>' +
        '</div>'
      );
    }
    return '<div class="hm-week">' + cells.join('') + '</div>' +
      '<p class="hm-legend"><span class="hm-legend-label">打卡得分</span>' +
        '<i class="hm-swatch lv-0"></i><i class="hm-swatch lv-1"></i><i class="hm-swatch lv-2"></i>' +
        '<i class="hm-swatch lv-3"></i><i class="hm-swatch lv-4"></i><i class="hm-swatch lv-5"></i>' +
        '<span class="hm-legend-val">0 → 100</span></p>';
  }

  /* ---------- 月视图：当月日历 ---------- */
  function monthView(){
    var now = new Date();
    var first = new Date(now.getFullYear(), now.getMonth(), 1);
    var days = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    var lead = first.getDay();   /* 周日开头 */
    var todayKey = ds(now);

    var html = '<div class="hm-month-head">';
    WEEK_CN.forEach(function(w){ html += '<span>' + w + '</span>'; });
    html += '</div><div class="hm-month">';
    for(var i = 0; i < lead; i++) html += '<div class="hm-cell blank"></div>';
    for(var d = 1; d <= days; d++){
      var date = new Date(now.getFullYear(), now.getMonth(), d);
      var key = ds(date);
      var r = recOf(key);
      html += '<div class="hm-day lv-' + lv(r.score) + (key === todayKey ? ' today' : '') + '" ' +
        'title="' + UI.fmt.escape(tip(key, r)) + '">' + d + '</div>';
    }
    html += '</div>';
    return html +
      '<p class="hm-legend"><span class="hm-legend-label">打卡得分</span>' +
        '<i class="hm-swatch lv-0"></i><i class="hm-swatch lv-1"></i><i class="hm-swatch lv-2"></i>' +
        '<i class="hm-swatch lv-3"></i><i class="hm-swatch lv-4"></i><i class="hm-swatch lv-5"></i>' +
        '<span class="hm-legend-val">0 → 100</span></p>';
  }

  /* ---------- 年视图：近 53 周，GitHub 风格 ---------- */
  function yearView(){
    var today = startOfDay(new Date());
    /* 从今天所在周的周日往前推 52 周 */
    var start = addDays(today, -(52 * 7 + today.getDay()));

    var cols = [];
    var monthLabels = [];
    var lastMonth = -1;

    for(var w = 0; w < 53; w++){
      var col = '<div class="hm-week-col">';
      for(var d = 0; d < 7; d++){
        var day = addDays(start, w * 7 + d);
        var key = ds(day);
        var r = recOf(key);
        if(day > today){
          col += '<div class="hm-cell blank"></div>';
        }else{
          col += cell(key, r, key === ds(today) ? 'today' : '');
        }
      }
      col += '</div>';
      cols.push(col);

      var mid = addDays(start, w * 7 + 3);
      if(mid.getMonth() !== lastMonth){
        lastMonth = mid.getMonth();
        monthLabels.push({ col: w, name: (mid.getMonth() + 1) + '月' });
      }
    }

    var labelRow = '<div class="hm-year-months">';
    var cursor = 0;
    monthLabels.forEach(function(m){
      labelRow += '<span style="grid-column:' + (m.col + 1) + ' / span 4">' + m.name + '</span>';
    });
    labelRow += '</div>';

    return '<div class="hm-year-wrap">' +
      '<div class="hm-year-wd"><span>一</span><span>三</span><span>五</span></div>' +
      '<div class="hm-year">' +
        '<div class="hm-year-grid" style="grid-template-columns:repeat(53,1fr)">' +
          labelRow +
        '</div>' +
        '<div class="hm-year-cols">' + cols.join('') + '</div>' +
      '</div>' +
    '</div>' +
    '<p class="hm-legend"><span class="hm-legend-label">打卡得分</span>' +
      '<i class="hm-swatch lv-0"></i><i class="hm-swatch lv-1"></i><i class="hm-swatch lv-2"></i>' +
      '<i class="hm-swatch lv-3"></i><i class="hm-swatch lv-4"></i><i class="hm-swatch lv-5"></i>' +
      '<span class="hm-legend-val">0 → 100</span></p>';
  }

  /* 统计摘要（三种视图共用） */
  function summary(){
    var today = startOfDay(new Date());
    var sum30 = 0, days30 = 0, full30 = 0;
    for(var i = 29; i >= 0; i--){
      var r = recOf(ds(addDays(today, -i)));
      sum30 += r.score;
      if(r.total) days30++;
      if(r.score >= 100) full30++;
    }
    var totalMin = 0;
    for(var j = 29; j >= 0; j--){
      totalMin += recOf(ds(addDays(today, -j))).focus;
    }
    return {
      avg: days30 ? Math.round(sum30 / days30) : 0,
      days: days30,
      full: full30,
      focus: totalMin
    };
  }

  /* ---------- 连胜 / 累计 / 徽章 ---------- */
  /* 打卡日 = 当日得分 > 0（至少完成一个目标的一部分） */
  function isCkDay(r){ return r && (r.score > 0); }

  function meta(){
    var today = startOfDay(new Date());
    var keys = (QZD.checkin ? QZD.checkin.historyKeys() : []).filter(function(k){
      return isCkDay(recOf(k));
    }).sort();

    var totalDays = keys.length;
    var fullDays = 0;
    keys.forEach(function(k){ if(recOf(k).score >= 100) fullDays++; });

    /* 最长连胜：排序后逐日比较相邻是否恰差一天 */
    var longest = 0, run = 0, prev = null;
    keys.forEach(function(k){
      var d = parse(k);
      if(prev && (d - prev) === 86400000) run++;
      else run = 1;
      if(run > longest) longest = run;
      prev = d;
    });

    /* 当前连胜：从今天往回走；今天还没打卡则从昨天开始算 */
    var current = 0;
    var offset = isCkDay(recOf(ds(today))) ? 0 : 1;
    for(var i = offset; ; i++){
      if(isCkDay(recOf(ds(addDays(today, -i))))){ current++; }
      else break;
    }

    var st = { current: current, longest: Math.max(longest, current),
               totalDays: totalDays, fullDays: fullDays };

    var BADGES = [
      { name: '初窥门径', tip: '连胜 7 天',    ok: st.longest >= 7 },
      { name: '循序渐进', tip: '连胜 21 天',   ok: st.longest >= 21 },
      { name: '锲而不舍', tip: '连胜 30 天',   ok: st.longest >= 30 },
      { name: '雷打不动', tip: '连胜 100 天',  ok: st.longest >= 100 },
      { name: '积微成著', tip: '累计打卡 50 天', ok: st.totalDays >= 50 },
      { name: '百炼成钢', tip: '累计打卡 100 天', ok: st.totalDays >= 100 },
      { name: '精益求精', tip: '满分 10 次',   ok: st.fullDays >= 10 },
      { name: '止于至善', tip: '满分 50 次',   ok: st.fullDays >= 50 }
    ];
    st.badges = BADGES;
    return st;
  }

  function statsHtml(){
    var s = meta();
    var badges = s.badges.map(function(b){
      return '<span class="hm-badge' + (b.ok ? ' lit' : '') + '" title="' +
        b.tip + (b.ok ? ' · 已达成' : ' · 未达成') + '">' + b.name + '</span>';
    }).join('');
    return '<div class="hm-stats">' +
        '<div class="hm-stat hot"><b>' + s.current + '</b><span>当前连胜·天</span></div>' +
        '<div class="hm-stat"><b>' + s.longest + '</b><span>最长连胜·天</span></div>' +
        '<div class="hm-stat"><b>' + s.totalDays + '</b><span>累计打卡·天</span></div>' +
        '<div class="hm-stat"><b>' + s.fullDays + '</b><span>满分·次</span></div>' +
      '</div>' +
      '<div class="hm-badges">' + badges + '</div>';
  }

  function render(mode){
    mode = mode || UI.heatmapMode || 'week';
    var body = mode === 'month' ? monthView() : (mode === 'year' ? yearView() : weekView());
    var s = summary();
    var tabs = [
      { k: 'week', n: '周' },
      { k: 'month', n: '月' },
      { k: 'year', n: '年' }
    ].map(function(t){
      return '<button class="hm-tab' + (t.k === mode ? ' active' : '') +
        '" data-heat="' + t.k + '">' + t.n + '</button>';
    }).join('');

    return '<div class="hm-wrap">' +
      statsHtml() +
      '<div class="hm-head"><div class="hm-tabs">' + tabs + '</div>' +
        '<span class="hm-head-right">' +
          '<button type="button" class="hm-weekly" data-weekly="1" title="汇总最近 7 天，生成可发给导师的学习周报">📜 呈递周折</button>' +
          '<span class="hm-sum">近 30 天 · 打卡 ' + s.days + ' 天 · 满分 ' + s.full +
            ' 天 · 均分 ' + s.avg + ' · 专注 ' + s.focus + ' 分</span>' +
        '</span>' +
      '</div>' +
      body +
    '</div>';
  }

  UI.heatmapMode = 'week';
  UI.heatmap = {
    render: render,
    setMode: function(m){
      if(m === 'week' || m === 'month' || m === 'year') UI.heatmapMode = m;
      return UI.heatmapMode;
    },
    meta: meta
  };
})();
