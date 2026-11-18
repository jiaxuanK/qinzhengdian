/* ============================================================
   ui/pages/chronos.js · 钦天监（效率分析）
   两个视角：
   - 按时辰：读 study.hourStats，24 小时分布图 + 高峰批语
   - 按课题：读 study.subjectStats，各课题投入分钟与占比 + 课题管理
   ============================================================ */
(function(){
  var UI = QZD.ui;
  /* HTML 属性值转义（title="..." 里不能裸放 "） */
  function escapeAttr(s){ return String(s).replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }

  /* 记住上次看的视图：存 state.settings.chronosView，切页/重开都停在原处 */
  function savedView(){
    var s = QZD.state && QZD.state.settings;
    var v = s && s.chronosView;
    var ok = ['hour', 'subject', 'trend', 'grid', 'timeline', 'heat'];
    return ok.indexOf(v) >= 0 ? v : 'hour';
  }
  var view = savedView();   /* 'hour'|'subject'|'trend'|'grid'|'timeline'|'heat' */
  var trendDays = 14;  /* 趋势窗口：7 / 14 / 30 天 */
  var subjectChartMode = 'pie';   /* 课题占比图：'pie' | 'bar'；只记内存，刷新回饼图 */
  var trendChartMode = 'line';    /* 趋势图：'line' | 'bar'；只记内存 */
  var vizGradSeq = 0;             /* SVG 渐变 id 自增：同页多图不撞 id */

  function data(){
    var hs = (QZD.state.study && QZD.state.study.hourStats) || {};
    var arr = [];
    var total = 0, max = 0;
    for(var h = 0; h < 24; h++){
      var v = Math.round(hs[h] || 0);
      arr.push({ h: h, v: v });
      total += v;
      if(v > max) max = v;
    }
    return { arr: arr, total: total, max: max };
  }

  function peakHours(arr){
    var sorted = arr.slice().filter(function(d){ return d.v > 0; })
      .sort(function(a, b){ return b.v - a.v; });
    return sorted.slice(0, 3).map(function(d){ return d.h; });
  }

  function chart(d){
    if(d.total <= 0){
      return '<div class="empty">钦天监尚无星象<span class="card-note">专注几次后，这里会显示你一天里最高效的时辰</span></div>';
    }
    var cols = d.arr.map(function(x){
      var pct = d.max > 0 ? Math.round(x.v / d.max * 100) : 0;
      var cls = '';
      if(x.v > 0 && x.v === d.max) cls = ' peak';
      return '<div class="hour-col">' +
        '<div class="hour-bar-wrap">' +
          '<div class="hour-bar' + cls + '" style="height:' + pct + '%" ' +
            'title="' + x.h + ' 时 · ' + x.v + ' 分"></div>' +
        '</div>' +
        '<span class="hour-label' + (x.h % 6 === 0 ? ' major' : '') + '">' + x.h + '</span>' +
      '</div>';
    }).join('');
    return '<div class="hour-chart">' + cols + '</div>';
  }

  function verdict(d){
    if(d.total <= 0) return '';
    var peaks = peakHours(d.arr);
    if(!peaks.length) return '';
    var names = peaks.map(function(h){
      return h + ' 时' + (h < 12 ? '（上午）' : (h < 18 ? '（下午）' : '（晚间）'));
    });
    var active = d.arr.filter(function(x){ return x.v > 0; }).length;
    var avg = Math.round(d.total / Math.max(1, active));
    var tip = '你最高效的时辰集中在 ' + names.join('、') +
      '。建议把最烧脑的推导 / 写作排在这些时段；其余时辰处理邮件、组会等轻量事务。';
    return '<div class="chronos-verdict">' +
      '<div class="realm-stats">' +
        '<div class="realm-stat hot"><span>累计专注</span><b>' + d.total + ' 分</b></div>' +
        '<div class="realm-stat"><span>活跃时辰</span><b>' + active + ' 个</b></div>' +
        '<div class="realm-stat"><span>高峰时辰</span><b>' + (peaks[0] + ' 时') + '</b></div>' +
        '<div class="realm-stat"><span>活跃时段均量</span><b>' + avg + ' 分</b></div>' +
      '</div>' +
      '<p class="today-line"><b>钦天监批语：</b>' + tip + '</p>' +
    '</div>';
  }

  /* ---------- 按课题 ---------- */
  /* 某周各课题分钟：从 focusLog 现算，不新增 schema。
     offsetWeeks=0 本周；1 = 上周（用于冲刺条同比）。 */
  function subjectWeek(offsetWeeks){
    var st = QZD.state.study || {};
    var logs = Array.isArray(st.focusLog) ? st.focusLog : [];
    var mon = mondayOf(new Date()).getTime() - (offsetWeeks || 0) * 7 * 86400000;
    var end = mon + 7 * 86400000;
    var out = {};
    logs.forEach(function(x){
      if(!x.start || x.start < mon || x.start >= end) return;
      var id = x.subjectId || 'none';
      out[id] = (out[id] || 0) + (x.minutes || 0);
    });
    return out;
  }
  function subjectPanel(){
    var b = QZD.study.subjectBreakdown();
    if(!b.rows.length){
      return '<div class="empty">尚无课题投入记录' +
        '<span class="card-note">先建课题，再把奏折挂到课题上，专注分钟会自动归类</span></div>';
    }
    var maxMin = b.rows[0].min || 1;
    var wk = subjectWeek(), wkTotal = 0, wkMax = 1;
    var lw = subjectWeek(1), lwMax = 1;
    Object.keys(wk).forEach(function(k){ wkTotal += wk[k]; if(wk[k] > wkMax) wkMax = wk[k]; });
    Object.keys(lw).forEach(function(k){ if(lw[k] > lwMax) lwMax = lw[k]; });
    var rows = b.rows.map(function(r){
      var w = Math.round(r.min / maxMin * 100);
      var wm = Math.round(wk[r.id] || 0);
      var lm = Math.round(lw[r.id] || 0);
      /* 本周条与上周条共用同一刻度（取两者最大值），才看得出一周之间的升降 */
      var scale = Math.max(wkMax, lwMax) || 1;
      var ww = Math.round(wm / scale * 100);
      var lwb = Math.round(lm / scale * 100);
      var col = subjectColor(r.id);
      /* 同比：上周为 0 时不编造百分比 */
      var cmp;
      if(lm <= 0 && wm <= 0) cmp = '<em class="sw-cmp flat">—</em>';
      else if(lm <= 0) cmp = '<em class="sw-cmp up">新起</em>';
      else {
        var d = Math.round((wm - lm) / lm * 100);
        var tone = d > 0 ? 'up' : (d < 0 ? 'down' : 'flat');
        cmp = '<em class="sw-cmp ' + tone + '">' + (d > 0 ? '↑' : (d < 0 ? '↓' : '＝')) +
          ' ' + Math.abs(d) + '%</em>';
      }
      return '<div class="sub-row">' +
        '<span class="sub-dot" style="background:' + col + '"></span>' +
        '<span class="sub-name" title="' + UI.fmt.escape(r.name) + '">' + UI.fmt.escape(r.name) + '</span>' +
        '<div class="sub-bar"><i style="width:' + w + '%;background:' + col + '"></i></div>' +
        '<span class="sub-val">' + r.min + ' 分 · ' + r.pct + '%</span>' +
        '<div class="sub-week" title="本周 ' + wm + ' 分 / 上周 ' + lm + ' 分">' +
          '<i class="sw-prev" style="width:' + lwb + '%"></i>' +
          '<i style="width:' + ww + '%;background:' + col + '"></i></div>' +
        '<span class="sub-week-val">本周 ' + wm + ' 分' + cmp + '</span>' +
      '</div>';
    }).join('');
    return '<p class="card-note" style="margin:2px 0 8px">长条＝累计占比 · 短条＝本周（实色）对比上周（浅底）· 颜色全视图统一</p>' +
      '<div class="sub-list">' + rows + '</div>' +
      '<p class="page-foot" style="margin-top:10px">累计合计 ' + b.total +
        ' 分钟 · 本周 ' + Math.round(wkTotal / 60 * 10) / 10 + ' 小时</p>';
  }

  function managePanel(){
    var list = QZD.study.subjects();
    var chips = list.length
      ? list.map(function(s){
          return '<span class="chip sm">' + UI.fmt.escape(s.name) +
            ' <button class="chip-x" data-subject-del="' + s.id + '" title="解散课题">×</button></span>';
        }).join('')
      : '<span class="card-note">还没有课题，先建一个</span>';
    return '<section class="card">' +
      '<div class="card-head"><span class="card-title">课 题 管 理</span>' +
        '<span class="card-note">如：硅光调制器 / VO₂ 薄膜 / 课程学习</span></div>' +
      '<div class="lib-add2">' +
        '<input id="subject-new" maxlength="20" placeholder="新课题名，回车即建">' +
        '<button class="btn primary" data-subject-add>新 建</button>' +
      '</div>' +
      '<div class="subj-chips">' + chips + '</div>' +
    '</section>';
  }

  function switchBar(){
    return '<div class="chronos-switch">' +
      '<button class="chip' + (view === 'hour' ? ' active' : '') + '" data-chronos-view="hour">按时辰</button>' +
      '<button class="chip' + (view === 'subject' ? ' active' : '') + '" data-chronos-view="subject">按课题</button>' +
      '<button class="chip' + (view === 'grid' ? ' active' : '') + '" data-chronos-view="grid">日程网格</button>' +
      '<button class="chip' + (view === 'timeline' ? ' active' : '') + '" data-chronos-view="timeline">今日时间轴</button>' +
      '<button class="chip' + (view === 'trend' ? ' active' : '') + '" data-chronos-view="trend">趋势与目标</button>' +
      '<button class="chip' + (view === 'heat' ? ' active' : '') + '" data-chronos-view="heat">专注热历</button>' +
    '</div>';
  }

  /* ---------- 饼状图：课题时间占比（SVG），配色与全视图统一 ---------- */
  function subjectColor(id){ return QZD.study.subjectColor(id); }
  function pieChart(b){
    if(!b.rows.length) return '';
    var total = b.total || 1;
    var cx = 90, cy = 90, r = 72, ir = 40;
    var angle = -Math.PI / 2, paths = '';
    b.rows.forEach(function(row, i){
      var frac = (row.min || 0) / total;
      var end = angle + frac * Math.PI * 2;
      var large = frac > 0.5 ? 1 : 0;
      var color = subjectColor(row.id);
      var tip = '<title>' + UI.fmt.escape(row.name) + ' · ' + row.min + ' 分 · ' + row.pct + '%</title>';
      /* 单项占满 100%：弧的起点=终点，SVG A 命令会退化成什么都不画（整块空白）。
         改用 circle 描边画完整圆环，避开退化；多项时仍走正常扇形路径。 */
      if(frac >= 0.9999){
        var rm = (r + ir) / 2, sw = r - ir;
        paths += '<circle cx="' + cx + '" cy="' + cy + '" r="' + rm +
          '" fill="none" stroke="' + color + '" stroke-width="' + sw +
          '" opacity=".9">' + tip + '</circle>';
        angle = end;
        return;
      }
      var x1 = cx + r * Math.cos(angle), y1 = cy + r * Math.sin(angle);
      var x2 = cx + r * Math.cos(end),   y2 = cy + r * Math.sin(end);
      var ix2 = cx + ir * Math.cos(end), iy2 = cy + ir * Math.sin(end);
      var ix1 = cx + ir * Math.cos(angle), iy1 = cy + ir * Math.sin(angle);
      paths += '<path d="M' + x1.toFixed(1) + ' ' + y1.toFixed(1) +
        ' A' + r + ' ' + r + ' 0 ' + large + ' 1 ' + x2.toFixed(1) + ' ' + y2.toFixed(1) +
        ' L' + ix2.toFixed(1) + ' ' + iy2.toFixed(1) +
        ' A' + ir + ' ' + ir + ' 0 ' + large + ' 0 ' + ix1.toFixed(1) + ' ' + iy1.toFixed(1) +
        ' Z" fill="' + color + '" stroke="var(--card)" stroke-width="1.5" opacity=".92">' + tip + '</path>';
      angle = end;
    });
    var legend = b.rows.slice(0, 8).map(function(row, i){
      return '<div class="pie-legend-row" title="' + UI.fmt.escape(row.name) + ' · ' +
        row.min + ' 分钟 · ' + row.pct + '%"><i style="background:' + subjectColor(row.id) + '"></i>' +
        '<span>' + UI.fmt.escape(row.name) + '</span><b>' + row.pct + '%</b></div>';
    }).join('');
    /* 甜甜圈中心放总量：总专注时长（小时），一屏看清规模 */
    var totalH = Math.round(total / 6) / 10;
    var center = '<text x="90" y="86" text-anchor="middle" font-size="20" font-weight="700" ' +
      'fill="var(--ink)">' + totalH + '</text>' +
      '<text x="90" y="104" text-anchor="middle" font-size="11" ' +
      'fill="var(--ink2)">小时合计</text>';
    return '<div class="pie-layout">' +
      '<svg viewBox="0 0 180 180" class="pie-svg" role="img" aria-label="课题时间占比饼状图">' +
        paths + center + '</svg>' +
      '<div class="pie-legend">' + legend + '</div></div>';
  }

  /* 课题占比柱状图：与饼图同数据同配色，横向条更利于比较长短 */
  function subjectBarChart(b){
    if(!b.rows.length) return '';
    var max = Math.max.apply(null, b.rows.map(function(r){ return r.min || 0; })) || 1;
    var rows = b.rows.slice(0, 8).map(function(row){
      var w = Math.max(2, Math.round((row.min || 0) / max * 100));
      var color = subjectColor(row.id);
      return '<div class="sb-row">' +
        '<span class="sb-name" title="' + UI.fmt.escape(row.name) + '">' + UI.fmt.escape(row.name) + '</span>' +
        '<div class="sb-track"><i style="width:' + w + '%;background:' + color + '"></i></div>' +
        '<b class="sb-val">' + row.min + '分</b><span class="sb-pct">' + row.pct + '%</span>' +
      '</div>';
    }).join('');
    return '<div class="sb-chart">' + rows + '</div>';
  }
  function subjectChartSwitch(){
    return '<div class="chart-switch">' +
      '<button class="chip sm' + (subjectChartMode === 'pie' ? ' active' : '') +
        '" data-subject-chart="pie">饼状</button>' +
      '<button class="chip sm' + (subjectChartMode === 'bar' ? ' active' : '') +
        '" data-subject-chart="bar">柱状</button>' +
    '</div>';
  }

  /* ---------- 趋势折线：近 N 天专注分钟（SVG） ---------- */
  function trendSeries(days, offset){
    /* offset=0 本周窗口；offset=7 取紧邻的上周同窗口（数据已固化在 history） */
    offset = offset || 0;
    var st = QZD.state.study || {};
    var hist = st.history || {};
    var out = [], now = new Date();
    now.setHours(0, 0, 0, 0);
    for(var i = days - 1; i >= 0; i--){
      var d = new Date(now.getTime());
      d.setDate(d.getDate() - i - offset);
      var key = QZD.stateIO.todayStr ? QZD.stateIO.todayStr(d)
              : d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
      var v = Math.round(hist[key] || 0);
      if(offset === 0 && i === 0) v = Math.round(st.doneMin || 0) || v;   /* 今天用实时值 */
      out.push({ key: key, v: v, label: (d.getMonth() + 1) + '/' + d.getDate() });
    }
    return out;
  }
  function trendChart(series, prev){
    var W = 620, H = 180, L = 34, R = 10, T = 16, B = 26;
    var max = 10;
    series.forEach(function(x){ if(x.v > max) max = x.v; });
    if(prev) prev.forEach(function(x){ if(x.v > max) max = x.v; });  /* 同一纵轴，两条可比 */
    max = Math.ceil(max / 30) * 30;
    var innerW = W - L - R, innerH = H - T - B;
    var step = series.length > 1 ? innerW / (series.length - 1) : 0;
    var pts = series.map(function(x, i){
      return { x: L + i * step, y: T + innerH - (x.v / max) * innerH };
    });
    var line = pts.map(function(p, i){ return (i ? 'L' : 'M') + p.x.toFixed(1) + ' ' + p.y.toFixed(1); }).join(' ');
    /* 上周同窗口：浅色虚线，按星期位置对齐叠加 */
    var prevLine = '';
    if(prev && prev.length){
      var ppts = prev.map(function(x, i){
        return { x: L + i * step, y: T + innerH - (x.v / max) * innerH };
      });
      prevLine = '<path d="' + ppts.map(function(p, i){
        return (i ? 'L' : 'M') + p.x.toFixed(1) + ' ' + p.y.toFixed(1);
      }).join(' ') + '" fill="none" stroke="var(--viz-muted)" stroke-width="1.5" ' +
        'stroke-dasharray="5 4" opacity=".85"/>';
    }
    var area = line + ' L' + (L + innerW) + ' ' + (T + innerH) + ' L' + L + ' ' + (T + innerH) + ' Z';
    var avg = series.reduce(function(a, x){ return a + x.v; }, 0) / Math.max(1, series.length);
    var avgY = T + innerH - (avg / max) * innerH;
    var grid = '';
    for(var g = 0; g <= 3; g++){
      var gy = T + innerH - g * innerH / 3;
      grid += '<line x1="' + L + '" y1="' + gy.toFixed(1) + '" x2="' + (W - R) + '" y2="' + gy.toFixed(1) +
        '" stroke="var(--viz-grid)" stroke-width="0.5"/>' +
        '<text x="' + (L - 6) + '" y="' + (gy + 4).toFixed(1) + '" text-anchor="end" font-size="11" fill="var(--viz-axis-text)">' +
        Math.round(max * g / 3) + '</text>';
    }
    /* 每个数据点包一层：透明命中区 + 悬停竖线（纯 CSS 显隐，无 JS 事件，开销最小） */
    var dots = pts.map(function(p, i){
      var x = series[i];
      var hit = pts.length > 1 ? Math.max(6, step) : 12;
      return '<g class="tz-pt">' +
        '<rect x="' + (p.x - hit / 2).toFixed(1) + '" y="' + T + '" width="' + hit.toFixed(1) +
          '" height="' + innerH + '" fill="transparent"/>' +
        '<line class="tz-guide" x1="' + p.x.toFixed(1) + '" y1="' + T + '" x2="' + p.x.toFixed(1) +
          '" y2="' + (T + innerH) + '" stroke="var(--viz-axis)" stroke-width="1" stroke-dasharray="3 3"/>' +
        '<circle cx="' + p.x.toFixed(1) + '" cy="' + p.y.toFixed(1) + '" r="2.6" fill="var(--daiqing)">' +
          '<title>' + x.label + ' · ' + x.v + ' 分</title></circle></g>';
    }).join('');
    var labels = series.map(function(x, i){
      if(series.length > 15 && i % 3 !== 0 && i !== series.length - 1) return '';
      return '<text x="' + (L + i * step).toFixed(1) + '" y="' + (H - 8) +
        '" text-anchor="middle" font-size="11" fill="var(--viz-axis-text)">' + x.label + '</text>';
    }).join('');
    /* 渐变面积：SVG linearGradient 走 GPU 合成，不使用模糊滤镜（省内存） */
    var gid = 'vizGrad' + (++vizGradSeq);
    var defs = '<defs><linearGradient id="' + gid + '" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0%" stop-color="var(--daiqing)" stop-opacity=".28"/>' +
      '<stop offset="100%" stop-color="var(--daiqing)" stop-opacity="0"/>' +
      '</linearGradient></defs>';
    return '<svg viewBox="0 0 ' + W + ' ' + H + '" class="trend-svg" role="img" aria-label="专注分钟趋势折线图">' +
      defs +
      grid +
      '<line x1="' + L + '" y1="' + avgY.toFixed(1) + '" x2="' + (W - R) + '" y2="' + avgY.toFixed(1) +
        '" stroke="var(--teng)" stroke-width="1" stroke-dasharray="4 4"/>' +
      '<path d="' + area + '" fill="url(#' + gid + ')"/>' +
      prevLine +
      '<path d="' + line + '" fill="none" stroke="var(--daiqing)" stroke-width="2" stroke-linejoin="round"/>' +
      dots + labels + '</svg>';
  }

  /* 趋势柱状图：同一纵轴，本周实柱 + 上周淡柱并列，阈值线保留 */
  function trendBarChart(series, prev){
    var W = 620, H = 180, L = 34, R = 10, T = 16, B = 26;
    var max = 10;
    series.forEach(function(x){ if(x.v > max) max = x.v; });
    if(prev) prev.forEach(function(x){ if(x.v > max) max = x.v; });
    max = Math.ceil(max / 30) * 30;
    var innerW = W - L - R, innerH = H - T - B;
    var slot = innerW / Math.max(1, series.length);
    var bw = Math.max(3, Math.min(18, slot * 0.32));
    var grid = '', g;
    for(g = 0; g <= 3; g++){
      var gy = T + innerH - g * innerH / 3;
      grid += '<line x1="' + L + '" y1="' + gy.toFixed(1) + '" x2="' + (W - R) + '" y2="' + gy.toFixed(1) +
        '" stroke="var(--viz-grid)" stroke-width="0.5"/>' +
        '<text x="' + (L - 6) + '" y="' + (gy + 4).toFixed(1) + '" text-anchor="end" font-size="11" fill="var(--viz-axis-text)">' +
        Math.round(max * g / 3) + '</text>';
    }
    var bars = '', labels = '';
    series.forEach(function(x, i){
      var cx = L + slot * i + slot / 2;
      var h = Math.max(1, (x.v / max) * innerH);
      bars += '<rect x="' + (cx - bw).toFixed(1) + '" y="' + (T + innerH - h).toFixed(1) +
        '" width="' + bw.toFixed(1) + '" height="' + h.toFixed(1) + '" rx="2" fill="var(--daiqing)" opacity=".85">' +
        '<title>' + x.label + ' · ' + x.v + ' 分</title></rect>';
      if(prev && prev[i]){
        var ph = Math.max(1, ((prev[i].v || 0) / max) * innerH);
        bars += '<rect x="' + cx.toFixed(1) + '" y="' + (T + innerH - ph).toFixed(1) +
          '" width="' + bw.toFixed(1) + '" height="' + ph.toFixed(1) + '" rx="2" fill="var(--viz-muted)" opacity=".45">' +
          '<title>' + x.label + ' 上周 · ' + (prev[i].v || 0) + ' 分</title></rect>';
      }
      if(series.length <= 15 || i % 3 === 0 || i === series.length - 1){
        labels += '<text x="' + cx.toFixed(1) + '" y="' + (H - 8) +
          '" text-anchor="middle" font-size="11" fill="var(--viz-axis-text)">' + x.label + '</text>';
      }
    });
    return '<svg viewBox="0 0 ' + W + ' ' + H + '" class="trend-svg" role="img" aria-label="专注分钟趋势柱状图">' +
      grid + bars + labels + '</svg>';
  }
  function trendChartSwitch(){
    return '<div class="chart-switch">' +
      '<button class="chip sm' + (trendChartMode === 'line' ? ' active' : '') +
        '" data-trend-chart="line">折线</button>' +
      '<button class="chip sm' + (trendChartMode === 'bar' ? ' active' : '') +
        '" data-trend-chart="bar">柱状</button>' +
    '</div>';
  }

  /* ---------- 周目标进度环：本周专注 ÷ 66h，按课题分色 ----------
     环的填充长度＝完成度；填充部分再按各课题本周分钟切成多段，各用课题色。
     配色复用 subjectColor，与网格/甘特/饼图/课题条完全一致。 */
  function goalRing(){
    var weekMin = QZD.study && QZD.study.weekMinutes ? QZD.study.weekMinutes() : 0;
    var GOAL = 66 * 60;
    var pct = Math.min(1, weekMin / GOAL);
    var r = 52, c = 2 * Math.PI * r;
    var h = Math.floor(weekMin / 60), m = weekMin % 60;

    var wk = subjectWeek();
    var segs = Object.keys(wk).map(function(id){ return { id:id, min:wk[id] }; })
      .filter(function(s){ return s.min > 0; })
      .sort(function(a, b){ return b.min - a.min; });
    var wkTotal = segs.reduce(function(a, s){ return a + s.min; }, 0);

    /* 填充弧按各课题占比分段；每段 stroke-dasharray=本段长+整圈空白，
       dashoffset 负推到起点。旧档无流水时 segs 为空 → 回退单一主色。 */
    var arcs = '', legend = '';
    if(segs.length && wkTotal > 0){
      var used = 0;
      segs.forEach(function(s){
        var frac = s.min / wkTotal;
        var segLen = c * pct * frac;
        var startLen = c * pct * (used / wkTotal);
        var col = subjectColor(s.id);
        arcs += '<circle cx="70" cy="70" r="' + r + '" fill="none" stroke="' + col +
          '" stroke-width="10" stroke-dasharray="' + segLen.toFixed(2) + ' ' + c.toFixed(2) +
          '" stroke-dashoffset="' + (-startLen).toFixed(2) + '" transform="rotate(-90 70 70)">' +
          '<title>' + UI.fmt.escape(QZD.study.subjectName(s.id)) + ' · 本周 ' +
          Math.round(s.min) + ' 分</title></circle>';
        used += s.min;
        legend += '<span class="goal-legend-item"><i style="background:' + col + '"></i>' +
          UI.fmt.escape(QZD.study.subjectName(s.id)) + ' ' + Math.round(s.min) + '分</span>';
      });
    }else if(pct > 0){
      arcs = '<circle cx="70" cy="70" r="' + r + '" fill="none" stroke="var(--daiqing)" stroke-width="10" ' +
        'stroke-dasharray="' + (c * pct).toFixed(2) + ' ' + c.toFixed(2) + '" transform="rotate(-90 70 70)"/>';
    }
    return '<div class="goal-ring-wrap">' +
      '<svg viewBox="0 0 140 140" class="goal-svg" role="img" aria-label="本周 66 小时目标进度（按课题分色）">' +
        '<circle cx="70" cy="70" r="' + r + '" fill="none" stroke="var(--viz-grid)" stroke-width="10"/>' +
        arcs +
        '<text x="70" y="66" text-anchor="middle" font-size="22" fill="var(--color-text-primary)">' + Math.round(pct * 100) + '%</text>' +
        '<text x="70" y="86" text-anchor="middle" font-size="11" fill="var(--color-text-secondary)">' + h + 'h' + m + 'm / 66h</text>' +
      '</svg>' +
      '<div class="goal-note">本周专注 · 目标 66 小时<br><span class="card-note">工作日 10h × 5 + 周末 8h × 2</span>' +
        (legend ? '<div class="goal-legend">' + legend + '</div>' : '') +
      '</div>' +
    '</div>';
  }

  /* ---------- 计划 vs 实际：三事完成度 / 66h 时间投入，并排看差距 ---------- */
  /* 本周逐日累计专注 vs 目标匀速线（66h/7天）：折线对比比两条进度条更直观 */
  function planVsActual(){
    var st = QZD.state.study || {};
    var hist = st.history || {};
    /* 本周 7 天（周一→周日），未来几天不画实际线 */
    var mon = mondayOf(new Date());
    var WEEK = ['一', '二', '三', '四', '五', '六', '日'];
    var todayIdx = Math.floor((Date.now() - mon.getTime()) / 86400000);
    if(todayIdx > 6) todayIdx = 6;
    var GOAL_DAY = 66 * 60 / 7;
    var daily = [], cum = 0, goalCum = 0;
    for(var i = 0; i < 7; i++){
      var d = new Date(mon.getTime()); d.setDate(mon.getDate() + i);
      var key = dateKey(d);
      var v = (i === todayIdx) ? Math.round(st.doneMin || 0) : Math.round(hist[key] || 0);
      if(i > todayIdx) v = null;   /* 未来：不画 */
      if(v != null) cum += v;
      goalCum += GOAL_DAY;
      daily.push({ i:i, label:'周' + WEEK[i], v:v, cum:(v != null ? cum : null), goal:goalCum });
    }
    var maxV = Math.max(GOAL_DAY * 7, cum) * 1.05;

    /* 折线 */
    var W = 480, H = 190, L = 38, R = 12, T = 14, B = 28;
    var innerW = W - L - R, innerH = H - T - B;
    function xy(idx, val){ return { x:L + idx * innerW/6, y:T + innerH - (val/maxV)*innerH }; }
    /* 目标线（虚线，全程） */
    var goalPts = daily.map(function(p, i){ var q = xy(i, p.goal); return (i?'L':'M')+q.x.toFixed(1)+' '+q.y.toFixed(1); }).join(' ');
    /* 实际累计线（只到今天） */
    var cumPts = daily.filter(function(p){ return p.cum != null; }).map(function(p){
      var q = xy(p.i, p.cum); return (p.i===0?'M':'L')+q.x.toFixed(1)+' '+q.y.toFixed(1);
    }).join(' ');
    var area = cumPts ? cumPts + ' L' + xy(todayIdx, 0).x.toFixed(1) + ' ' + (T+innerH) + ' L' + L + ' ' + (T+innerH) + ' Z' : '';
    var dots = daily.filter(function(p){ return p.cum != null; }).map(function(p){
      var q = xy(p.i, p.cum);
      return '<circle cx="'+q.x.toFixed(1)+'" cy="'+q.y.toFixed(1)+'" r="2.6" fill="var(--daiqing)"><title>'+
        p.label+' · 累计 '+Math.round(p.cum)+' 分</title></circle>';
    }).join('');
    var xlabels = daily.map(function(p){ var q = xy(p.i, 0);
      return '<text x="'+q.x.toFixed(1)+'" y="'+(H-8)+'" text-anchor="middle" font-size="11" fill="var(--viz-axis-text)">'+p.label+'</text>';
    }).join('');
    var grid = '';
    for(var g = 0; g <= 3; g++){
      var gy = T + innerH - g*innerH/3;
      grid += '<line x1="'+L+'" y1="'+gy.toFixed(1)+'" x2="'+(W-R)+'" y2="'+gy.toFixed(1)+
        '" stroke="var(--viz-grid)" stroke-width="0.5"/>'+
        '<text x="'+(L-5)+'" y="'+(gy+4).toFixed(1)+'" text-anchor="end" font-size="10" fill="var(--viz-axis-text)">'+
        Math.round(maxV*g/3/60)+'h</text>';
    }
    var chart = '<svg viewBox="0 0 '+W+' '+H+'" class="pva-svg" role="img" aria-label="本周累计专注与目标线对比">'+
      grid +
      '<path d="'+goalPts+'" fill="none" stroke="var(--teng)" stroke-width="1.5" stroke-dasharray="5 4"/>'+
      (area ? '<path d="'+area+'" fill="var(--daiqing)" opacity=".08"/>' : '')+
      '<path d="'+cumPts+'" fill="none" stroke="var(--daiqing)" stroke-width="2" stroke-linejoin="round"/>'+
      dots + xlabels + '</svg>';

    /* 三事完成度小环 */
    var goals = (QZD.plan && QZD.plan.goals) ? QZD.plan.goals() : [];
    var done = goals.filter(function(x){ return x.done; }).length;
    var planPct = goals.length ? Math.round(done/goals.length*100) : 0;
    var r = 30, cc = 2*Math.PI*r, off = cc*(1-planPct/100);
    var ring = '<svg viewBox="0 0 76 76" class="pva-ring" role="img" aria-label="三事完成度">'+
      '<circle cx="38" cy="38" r="'+r+'" fill="none" stroke="var(--viz-grid)" stroke-width="7"/>'+
      (goals.length ? '<circle cx="38" cy="38" r="'+r+'" fill="none" stroke="var(--daiqing)" stroke-width="7" '+
        'stroke-linecap="round" stroke-dasharray="'+cc.toFixed(1)+'" stroke-dashoffset="'+off.toFixed(1)+'" transform="rotate(-90 38 38)"/>' : '')+
      '<text x="38" y="42" text-anchor="middle" font-size="16" fill="var(--color-text-primary)">'+
        (goals.length ? planPct+'%' : '—')+'</text></svg>';

    var goalPct = Math.round(cum / (66*60) * 100);
    var gap = planPct - goalPct;
    var verdict = !goals.length
      ? '还没立本周三事 —— 先到「今日勤政 → 概要」定下这周要推进的事。'
      : (gap > 20 ? '三事完成得比时间投入快：在收尾，但本周专注还差一截。'
        : (gap < -20 ? '时间投进去了，三事没同步打勾 —— 可能忙在计划之外。'
        : '目标完成与时间投入基本同步，节奏稳。'));

    return '<div class="pva">' +
      '<div class="trend-legend" style="justify-content:flex-start;margin:0 0 2px">'+
        '<span><i class="tl-now"></i>实际累计</span><span><i class="tl-prev"></i>目标匀速（66h/周）</span></div>'+
      chart +
      '<div class="pva-foot">'+
        '<div class="pva-ring-wrap">'+ring+'<span>三事完成<br><b>'+done+' / '+goals.length+'</b></span></div>'+
        '<p class="pva-verdict">'+verdict+'</p>'+
      '</div>'+
    '</div>';
  }

  /* ---------- 中断原因环：从 study.abandonLog 聚合，看什么最常打断 ---------- */
  function abandonRing(){
    var log = (QZD.state.study && Array.isArray(QZD.state.study.abandonLog))
      ? QZD.state.study.abandonLog : [];
    if(!log.length){
      return '<div class="empty">还没有中断记录<span class="card-note">专注中途放弃时选一次原因，这里会告诉你什么最常打断你</span></div>';
    }
    var counts = {};
    log.forEach(function(x){ var r = x.reason || '未注明'; counts[r] = (counts[r] || 0) + 1; });
    var rows = Object.keys(counts).map(function(k){ return { name:k, n:counts[k] }; })
      .sort(function(a, b){ return b.n - a.n; });
    var total = log.length;
    /* 用一套固定色（与课题色区分，避免混淆），按次数分环。
       序列色统一走 viz token，不再写死 hex。 */
    var AG_COLORS = ['var(--viz-2)','var(--viz-5)','var(--viz-6)',
                     'var(--viz-3)','var(--viz-8)','var(--ink3)'];
    var cx = 70, cy = 70, r = 48, ir = 28, angle = -Math.PI / 2, paths = '';
    rows.forEach(function(row, i){
      var frac = row.n / total, end = angle + frac * Math.PI * 2;
      var col = AG_COLORS[i % AG_COLORS.length];
      if(frac >= 0.9999){
        var rm = (r + ir) / 2;
        paths += '<circle cx="' + cx + '" cy="' + cy + '" r="' + rm + '" fill="none" stroke="' +
          col + '" stroke-width="' + (r - ir) + '"><title>' + UI.fmt.escape(row.name) + ' · ' +
          row.n + ' 次</title></circle>';
      }else{
        var x1 = cx + r * Math.cos(angle), y1 = cy + r * Math.sin(angle);
        var x2 = cx + r * Math.cos(end), y2 = cy + r * Math.sin(end);
        var ix2 = cx + ir * Math.cos(end), iy2 = cy + ir * Math.sin(end);
        var ix1 = cx + ir * Math.cos(angle), iy1 = cy + ir * Math.sin(angle);
        var large = frac > 0.5 ? 1 : 0;
        paths += '<path d="M' + x1.toFixed(1) + ' ' + y1.toFixed(1) +
          ' A' + r + ' ' + r + ' 0 ' + large + ' 1 ' + x2.toFixed(1) + ' ' + y2.toFixed(1) +
          ' L' + ix2.toFixed(1) + ' ' + iy2.toFixed(1) +
          ' A' + ir + ' ' + ir + ' 0 ' + large + ' 0 ' + ix1.toFixed(1) + ' ' + iy1.toFixed(1) +
          ' Z" fill="' + col + '"><title>' + UI.fmt.escape(row.name) + ' · ' + row.n + ' 次</title></path>';
      }
      angle = end;
    });
    var legend = rows.slice(0, 6).map(function(row, i){
      return '<div class="ag-legend-row"><i style="background:' + AG_COLORS[i % AG_COLORS.length] + '"></i>' +
        '<span>' + UI.fmt.escape(row.name) + '</span><b>' + row.n + ' 次 · ' +
        Math.round(row.n / total * 100) + '%</b></div>';
    }).join('');
    return '<div class="ag-layout">' +
      '<svg viewBox="0 0 140 140" class="ag-svg" role="img" aria-label="中断原因分布环形图">' + paths +
        '<text x="70" y="67" text-anchor="middle" font-size="20" fill="var(--color-text-primary)">' + total + '</text>' +
        '<text x="70" y="84" text-anchor="middle" font-size="10" fill="var(--color-text-secondary)">次中断</text>' +
      '</svg>' +
      '<div class="ag-legend">' + legend + '</div></div>';
  }

  /* ---------- 今日焦点条：逾期 / 今日到期 / 三事 / 正在专注 ----------
     放在每个视图顶部，回答「现在该干什么」，而不是只看统计。
     只读三个系统（不写、不改 schema），刷新时重算。 */
  function focusCard(){
    var due = (QZD.memorials && QZD.memorials.dueList)
      ? QZD.memorials.dueList(2) : { all: [], overdue: [] };
    var end = new Date(); end.setHours(23, 59, 59, 999);
    var now = Date.now();
    var todayDue = (due.all || []).filter(function(x){
      return x.dueAt > now && x.dueAt <= end.getTime();
    }).length;
    var goals = (QZD.plan && QZD.plan.goals) ? QZD.plan.goals() : [];
    var done = goals.filter(function(g){ return g.done; }).length;
    var running = !!(QZD.pomodoro && QZD.pomodoro.isActive && QZD.pomodoro.isActive());
    function pill(cls, k, v){
      return '<span class="fc-pill ' + cls + '"><i>' + k + '</i><b>' + v + '</b></span>';
    }
    var h = '';
    var od = (due.overdue || []).length;
    if(od) h += pill('bad', '逾期', od);
    if(todayDue) h += pill('warn', '今日到期', todayDue);
    h += pill(goals.length && done === goals.length ? 'ok' : '', '本周三事', done + '/' + (goals.length || 0));
    if(running){
      h += pill('live', '正在专注', UI.fmt.escape(QZD.pomodoro.title() || '进行中'));
    }
    var calm = !od && !todayDue && !running && goals.length && done === goals.length;
    return '<div class="fc-bar">' + h +
      (calm ? '<span class="fc-tip">今日无紧急 · 课题可安心推进</span>' : '') + '</div>';
  }

  /* ---------- 本周星盘：外环＝66h 目标按课题分色填充，中心＝连续天数 ----------
     一眼回答三件事：本周走到哪了、还差多少、撑了几天。放趋势视图顶部。 */
  function starDial(){
    var st = QZD.state.study || {};
    var weekMin = QZD.study.weekMinutes ? QZD.study.weekMinutes() : 0;
    var GOAL = 66 * 60;
    var pct = Math.max(0, Math.min(1, weekMin / GOAL));
    var wk = subjectWeek();
    var rows = Object.keys(wk).map(function(k){
      return { id: k, min: wk[k], col: subjectColor(k) };
    }).filter(function(r){ return r.min > 0; })
      .sort(function(a, b){ return b.min - a.min; });
    var total = rows.reduce(function(a, r){ return a + r.min; }, 0);
    var cx = 130, cy = 122, r = 92;
    var angle = -Math.PI / 2, arcs = '';
    rows.forEach(function(row){
      var sweep = (total > 0 ? row.min / total : 0) * pct * Math.PI * 2;
      if(sweep > 0.0001){
        var end = angle + sweep;
        var x1 = cx + r * Math.cos(angle), y1 = cy + r * Math.sin(angle);
        var x2 = cx + r * Math.cos(end), y2 = cy + r * Math.sin(end);
        arcs += '<path d="M' + x1.toFixed(1) + ' ' + y1.toFixed(1) +
          ' A' + r + ' ' + r + ' 0 ' + (sweep > Math.PI ? 1 : 0) + ' 1 ' +
          x2.toFixed(1) + ' ' + y2.toFixed(1) +
          '" fill="none" stroke="' + row.col + '" stroke-width="16"/>';
        angle = end;
      }
    });
    var todayH = Math.round((st.doneMin || 0) / 60 * 10) / 10;
    var avgH = Math.round(GOAL / 7 / 60 * 10) / 10;
    var leftH = Math.max(0, Math.round((GOAL - weekMin) / 60 * 10) / 10);
    /* 外圈刻度：0 / 25 / 50 / 75%，让环上的进度有参照 */
    var ticks = '';
    for(var tk = 1; tk <= 3; tk++){
      var ta = -Math.PI / 2 + tk * Math.PI / 2;
      var tx1 = cx + (r + 10) * Math.cos(ta), ty1 = cy + (r + 10) * Math.sin(ta);
      var tx2 = cx + (r + 16) * Math.cos(ta), ty2 = cy + (r + 16) * Math.sin(ta);
      ticks += '<line x1="' + tx1.toFixed(1) + '" y1="' + ty1.toFixed(1) +
        '" x2="' + tx2.toFixed(1) + '" y2="' + ty2.toFixed(1) +
        '" stroke="var(--viz-axis)" stroke-width="1"/>';
    }
    var side = function(y, k, v, tone){
      return '<text x="300" y="' + y + '" font-size="13" fill="var(--ink2,#7C7869)">' + k +
        '</text><text x="640" y="' + y + '" text-anchor="end" font-size="17" font-weight="500" fill="' +
        (tone || 'var(--ink,#363A32)') + '">' + v + '</text>';
    };
    var legend = rows.slice(0, 4).map(function(row, i){
      return '<g transform="translate(' + (300 + (i % 2) * 175) + ',' + (196 + Math.floor(i / 2) * 24) + ')">' +
        '<rect width="9" height="9" rx="2" y="-9" fill="' + row.col + '"/>' +
        '<text x="14" y="0" font-size="11" fill="var(--ink2,#7C7869)">' +
          UI.fmt.escape(QZD.study.subjectName ? QZD.study.subjectName(row.id) : row.id) +
          ' · ' + Math.round(row.min) + ' 分</text></g>';
    }).join('');
    return '<svg viewBox="0 0 680 250" class="star-svg" role="img" aria-label="本周星盘">' +
      '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="none" stroke="var(--soft,#EFEBDD)" stroke-width="16"/>' +
      arcs +
      '<text x="130" y="114" text-anchor="middle" font-size="30" font-weight="500" fill="var(--ink,#363A32)">' +
        Math.round(weekMin / 60 * 10) / 10 + 'h</text>' +
      '<text x="130" y="136" text-anchor="middle" font-size="12" fill="var(--ink2,#7C7869)">本周 / 66h</text>' +
      '<text x="130" y="160" text-anchor="middle" font-size="13" fill="var(--daiqing,#3E6B5C)">连续 ' +
        (st.streak || 0) + ' 天</text>' +
      side(64, '今日专注', todayH + ' h') +
      side(106, '今日到期目标', avgH + ' h') +
      side(148, '距 66h 还差', leftH + ' h', leftH <= 0 ? 'var(--daiqing)' : 'var(--zhuqian)') +
      '<line x1="300" y1="176" x2="640" y2="176" stroke="var(--viz-axis)" stroke-width="0.5"/>' +
      ticks + legend + '</svg>';
  }

  /* ---------- 周报长图：把本周关键数据拼成一张可下载的 SVG ---------- */
  function weekLabel(){
    var mon = mondayOf(new Date());
    var sun = new Date(mon.getTime()); sun.setDate(mon.getDate() + 6);
    var p = function(n){ return (n < 10 ? '0' : '') + n; };
    return (mon.getMonth() + 1) + p(mon.getDate()) + '-' + (sun.getMonth() + 1) + p(sun.getDate());
  }
  function weeklyPosterSVG(){
    var st = QZD.state.study || {};
    var hist = st.history || {};
    var mon = mondayOf(new Date());
    var WEEK = ['一', '二', '三', '四', '五', '六', '日'];
    var todayIdx = Math.min(6, Math.floor((Date.now() - mon.getTime()) / 86400000));
    var weekMin = QZD.study.weekMinutes ? QZD.study.weekMinutes() : 0;
    var days = [], max = 1;
    for(var i = 0; i < 7; i++){
      var d = new Date(mon.getTime()); d.setDate(mon.getDate() + i);
      var key = dateKey(d);
      var v = (i === todayIdx) ? Math.round(st.doneMin || 0) : Math.round(hist[key] || 0);
      if(i > todayIdx) v = null;
      if(v != null && v > max) max = v;
      days.push({ label: '周' + WEEK[i], v: v, key: key });
    }
    var wk = subjectWeek();
    var subs = Object.keys(wk).map(function(k){
      return { name: k === 'none' ? '未分类' :
        (QZD.study.subjectName ? QZD.study.subjectName(k) : k), min: Math.round(wk[k]), col: subjectColor(k) };
    }).filter(function(r){ return r.min > 0; })
      .sort(function(a, b){ return b.min - a.min; });
    var subMax = subs.length ? subs[0].min : 1;
    var goals = (QZD.plan && QZD.plan.goals) ? QZD.plan.goals() : [];
    var goalRows = goals.length
      ? goals.map(function(g, i){
          return '<text x="46" y="' + (566 + i * 24) + '" font-size="13" fill="' +
            (g.done ? '#3E6B5C' : 'var(--ink2,#7C7869)') + '">' + (g.done ? '☑' : '☐') + ' ' +
            UI.fmt.escape(String(g.text || g.title || ('三事 ' + (i + 1)))).slice(0, 30) + '</text>';
        }).join('')
      : '<text x="46" y="566" font-size="13" fill="var(--ink2,#7C7869)">本周未立三事</text>';
    var logs = Array.isArray(st.focusLog) ? st.focusLog : [];
    var deepMin = 0, allMin = 0;
    logs.forEach(function(x){
      var m = Number(x.minutes) || 0;
      if(m <= 0) return;
      allMin += m; if(x.full) deepMin += m;
    });
    var deepPct = allMin > 0 ? Math.round(deepMin / allMin * 100) : 0;
    var bars = '', labels = '';
    days.forEach(function(x, i){
      var cx2 = 70 + i * 88;
      if(x.v != null){
        var h = Math.max(2, (x.v / max) * 110);
        bars += '<rect x="' + (cx2 - 20) + '" y="' + (300 - h) + '" width="40" height="' + h +
          '" rx="4" fill="var(--daiqing,#3E6B5C)" opacity=".85"><title>' + x.label + ' ' + x.v + ' 分</title></rect>' +
          '<text x="' + cx2 + '" y="' + (288 - h) + '" text-anchor="middle" font-size="11" fill="var(--ink2,#7C7869)">' +
          Math.round(x.v / 60 * 10) / 10 + 'h</text>';
      }
      labels += '<text x="' + cx2 + '" y="318" text-anchor="middle" font-size="12" fill="var(--ink2,#7C7869)">' +
        x.label + '</text>';
    });
    var subRows = subs.slice(0, 6).map(function(r, i){
      var y = 380 + i * 26;
      return '<rect x="46" y="' + (y - 9) + '" width="9" height="9" rx="2" fill="' + r.col + '"/>' +
        '<text x="62" y="' + y + '" font-size="12" fill="var(--ink,#363A32)">' +
        UI.fmt.escape(r.name).slice(0, 10) + '</text>' +
        '<rect x="190" y="' + (y - 8) + '" width="380" height="9" rx="4" fill="rgba(0,0,0,.06)"/>' +
        '<rect x="190" y="' + (y - 8) + '" width="' + Math.max(2, Math.round(r.min / subMax * 380)) +
        '" height="9" rx="4" fill="' + r.col + '"/>' +
        '<text x="586" y="' + y + '" text-anchor="end" font-size="12" fill="var(--ink2,#7C7869)">' +
        Math.round(r.min / 60 * 10) / 10 + ' h</text>';
    }).join('');
    var p = function(n){ return (n < 10 ? '0' : '') + n; };
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 680 640" width="680" role="img" ' +
        'aria-label="本周专注周报长图">' +
      '<rect width="680" height="640" fill="#F6F2E8"/>' +
      '<text x="40" y="52" font-size="20" font-weight="500" fill="#363A32">钦天监 · 本周星报</text>' +
      '<text x="640" y="52" text-anchor="end" font-size="12" fill="#7C7869">' + weekLabel() +
        ' · 目标 66h</text>' +
      '<text x="40" y="84" font-size="13" fill="#7C7869">本周 ' +
        Math.round(weekMin / 60 * 10) / 10 + ' h · 连续 ' + (st.streak || 0) + ' 天 · 今日 ' +
        Math.round((st.doneMin || 0) / 60 * 10) / 10 + ' h · 深度占比 ' + deepPct + '%</text>' +
      '<text x="40" y="140" font-size="13" fill="#7C7869">每日专注（小时）</text>' +
      bars + labels +
      '<text x="40" y="352" font-size="13" fill="#7C7869">课题投入</text>' +
      subRows +
      '<text x="40" y="544" font-size="13" fill="#7C7869">本周三事</text>' +
      goalRows +
      '<text x="40" y="620" font-size="10" fill="#9a9790">勤政殿 · 钦天监 ' +
        new Date().getFullYear() + '-' + p(new Date().getMonth() + 1) + '-' + p(new Date().getDate()) + '</text>' +
      '</svg>';
  }

  /* ---------- 中断时段：24 小时分布，找出每天最容易断的钟点 ----------
     读 abandonLog（{at, reason, minutes, title}）里的时刻，复用时辰柱样式。 */
  function abandonHours(){
    var log = (QZD.state.study && Array.isArray(QZD.state.study.abandonLog))
      ? QZD.state.study.abandonLog : [];
    var arr = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    var n = 0;
    log.forEach(function(x){
      if(!x || !x.at) return;
      var h = new Date(x.at).getHours();
      if(h >= 0 && h < 24){ arr[h]++; n++; }
    });
    if(!n) return '<div class="empty">还没有中断记录' +
      '<span class="card-note">专注中途放弃时选一次原因，这里会攒出你的「易断钟点」</span></div>';
    var max = 1;
    arr.forEach(function(v){ if(v > max) max = v; });
    var peak = arr.indexOf(max);
    var cols = arr.map(function(v, h){
      var pct = Math.round(v / max * 100);
      return '<div class="hour-col"><div class="hour-bar-wrap">' +
        '<div class="hour-bar' + (v === max && v > 0 ? ' peak' : '') +
        '" style="height:' + pct + '%" title="' + h + ' 时 · ' + v + ' 次中断"></div>' +
        '</div><span class="hour-label' + (h % 6 === 0 ? ' major' : '') + '">' + h + '</span></div>';
    }).join('');
    return '<div class="hour-chart">' + cols + '</div>' +
      '<p class="today-line" style="margin-top:8px"><b>易断钟点：</b>' + peak + ' 时（' +
        arr[peak] + ' 次，共 ' + n + ' 次中断）。这个点前后别排硬任务，' +
        '改做整理数据、跑仿真、回消息这类随时能停的事。</p>';
  }

  /* ---------- 深度 / 碎片：完整跑完的分钟占比 ----------
     focusLog.full 标记是否跑完整场；碎片多＝番茄定太长或环境易被打断。 */
  function depthRing(){
    var logs = (QZD.state.study && Array.isArray(QZD.state.study.focusLog))
      ? QZD.state.study.focusLog : [];
    var deepMin = 0, fragMin = 0, deepN = 0, fragN = 0;
    logs.forEach(function(x){
      var m = Number(x.minutes) || 0;
      if(m <= 0) return;
      if(x.full){ deepMin += m; deepN++; } else { fragMin += m; fragN++; }
    });
    var total = deepMin + fragMin;
    if(!total) return '<div class="empty">还没有完成的专注场次</div>';
    var pct = Math.round(deepMin / total * 100);
    var r = 48, c = 2 * Math.PI * r, off = c * (1 - pct / 100);
    var svg = '<svg viewBox="0 0 130 130" class="depth-svg" role="img" ' +
        'aria-label="完整跑完的专注分钟占比">' +
      '<circle cx="65" cy="65" r="' + r + '" fill="none" stroke="var(--soft,#EFEBDD)" stroke-width="14"/>' +
      (pct > 0 ? '<circle cx="65" cy="65" r="' + r + '" fill="none" stroke="var(--daiqing,#3E6B5C)" ' +
        'stroke-width="14" stroke-linecap="round" stroke-dasharray="' + c.toFixed(1) +
        '" stroke-dashoffset="' + off.toFixed(1) + '" transform="rotate(-90 65 65)"/>' : '') +
      '<text x="65" y="62" text-anchor="middle" font-size="22" fill="var(--ink,#363A32)">' + pct + '%</text>' +
      '<text x="65" y="80" text-anchor="middle" font-size="10" fill="var(--ink2,#7C7869)">深度</text></svg>';
    return '<div class="depth-layout">' + svg +
      '<div class="depth-list">' +
        '<div class="depth-item"><i class="di-deep"></i><span>完整跑完</span><b>' + deepN +
          ' 场 · ' + Math.round(deepMin) + ' 分</b></div>' +
        '<div class="depth-item"><i class="di-frag"></i><span>中途停下</span><b>' + fragN +
          ' 场 · ' + Math.round(fragMin) + ' 分</b></div>' +
        '<p class="card-note" style="margin:6px 0 0">深度占比＝完整跑完的分钟 ÷ 全部专注分钟。' +
          '碎片偏多，说明番茄定得太长，或这个时段容易被叫走。</p>' +
      '</div></div>';
  }

  /* ---------- 专注热历：近 53 周 × 7 天，颜色深浅＝当日分钟 ----------
     读 study.history（每日分钟），一眼看出断档、周末塌陷、冲刺期。 */
  function heatCalendar(){
    var st = QZD.state.study || {};
    var hist = st.history || {};
    var today = new Date(); today.setHours(0, 0, 0, 0);
    var todayKey = dateKey(today);
    var mon = mondayOf(today);
    var start = new Date(mon.getTime()); start.setDate(start.getDate() - 52 * 7);
    var WEEKS = 53, cell = 9, colW = 11, rowH = 11, L = 26, T = 16;
    var rects = '', months = '', lastM = -1, lastCol = -99;
    var startYear = start.getFullYear();
    var activeDays = 0, yearMin = 0, best = 0;
    for(var w = 0; w < WEEKS; w++){
      var d0 = new Date(start.getTime()); d0.setDate(d0.getDate() + w * 7);
      if(d0.getMonth() !== lastM && w - lastCol >= 3){
        /* 跨年后的月份带上年份（"26年11月"），否则首尾都是"11月"易误读 */
        var mLabel = (d0.getFullYear() !== startYear ? String(d0.getFullYear()).slice(2) + '年' : '') +
          (d0.getMonth() + 1) + '月';
        months += '<text x="' + (L + w * colW) + '" y="10" font-size="10" fill="var(--viz-axis-text)">' +
          mLabel + '</text>';
        lastM = d0.getMonth(); lastCol = w;
      }
      for(var r = 0; r < 7; r++){
        var d = new Date(d0.getTime()); d.setDate(d.getDate() + r);
        var key = dateKey(d);
        var x = L + w * colW, y = T + r * rowH;
        if(key > todayKey){
          rects += '<rect x="' + x + '" y="' + y + '" width="' + cell + '" height="' + cell +
            '" rx="2" fill="none"/>';
          continue;
        }
        var v = Math.round(hist[key] || 0);
        if(key === todayKey && st.doneMin) v = Math.round(st.doneMin) || v;
        if(v > 0){ activeDays++; yearMin += v; if(v > best) best = v; }
        var lv = v <= 0 ? 0 : (v < 30 ? 1 : (v < 60 ? 2 : (v < 120 ? 3 : (v < 180 ? 4 : 5))));
        var A = [0, .18, .36, .56, .78, 1][lv];
        /* 零分钟＝空心描边（"那天没工作"），有量才填充——与周网格同一套视觉语言 */
        var fill = lv === 0 ? 'transparent' : 'rgba(62,107,92,' + A + ')';
        var stroke = lv === 0 ? ' stroke="var(--viz-grid)" stroke-width="0.5"' : '';
        rects += '<rect x="' + x + '" y="' + y + '" width="' + cell + '" height="' + cell +
          '" rx="2" fill="' + fill + '"' + stroke + '>' +
          '<title>' + key + ' · ' + v + ' 分</title></rect>';
      }
    }
    var wk = ['一', '二', '三', '四', '五', '六', '日'], wl = '';
    [0, 2, 4, 6].forEach(function(i){
      wl += '<text x="' + (L - 6) + '" y="' + (T + i * rowH + 7) +
        '" text-anchor="end" font-size="10" fill="var(--ink2)">' + wk[i] + '</text>';
    });
    var Hh = T + 7 * rowH + 6;
    var legend = '<div class="hc-legend"><span>少</span>' +
      ['#EFEBDD', 'rgba(62,107,92,.18)', 'rgba(62,107,92,.36)', 'rgba(62,107,92,.56)',
       'rgba(62,107,92,.78)', 'rgba(62,107,92,1)']
        .map(function(c){ return '<i style="background:' + c + '"></i>'; }).join('') +
      '<span>多</span></div>';
    return '<div class="hc-wrap"><svg viewBox="0 0 640 ' + Hh + '" class="hc-svg" role="img" ' +
        'aria-label="近一年每天专注分钟热力图">' + months + wl + rects + '</svg></div>' +
      legend +
      '<div class="realm-stats" style="margin-top:10px">' +
        '<div class="realm-stat hot"><span>近一年投入</span><b>' + Math.round(yearMin / 60) + ' h</b></div>' +
        '<div class="realm-stat"><span>有记录天数</span><b>' + activeDays + ' 天</b></div>' +
        '<div class="realm-stat"><span>单日最高</span><b>' + best + ' 分</b></div>' +
        '<div class="realm-stat"><span>当前连续</span><b>' + (st.streak || 0) + ' 天</b></div>' +
      '</div>';
  }

  /* ---------- 单场时长分布：focusLog 分桶，看真实专注极限 ---------- */
  function durationDist(){
    var logs = (QZD.state.study && Array.isArray(QZD.state.study.focusLog))
      ? QZD.state.study.focusLog : [];
    var counts = [0, 0, 0, 0], total = 0, sum = 0, best = 0, full = 0;
    logs.forEach(function(x){
      var m = Number(x.minutes) || 0;
      if(m <= 0) return;
      total++; sum += m; if(m > best) best = m; if(x.full) full++;
      counts[m < 25 ? 0 : (m < 50 ? 1 : (m < 90 ? 2 : 3))]++;
    });
    if(!total){
      return '<div class="empty">还没有完成的专注场次' +
        '<span class="card-note">专注几次后，这里会告诉你的单场极限在哪</span></div>';
    }
    var labels = ['不足 25 分', '25–50 分', '50–90 分', '90 分以上'];
    var max = Math.max.apply(null, counts) || 1;
    var rows = counts.map(function(n, i){
      return '<div class="dur-row"><span class="dur-label">' + labels[i] + '</span>' +
        '<div class="dur-bar"><i style="width:' + Math.round(n / max * 100) + '%"></i></div>' +
        '<span class="dur-val">' + n + ' 场 · ' + Math.round(n / total * 100) + '%</span></div>';
    }).join('');
    return rows +
      '<div class="realm-stats" style="margin-top:10px">' +
        '<div class="realm-stat hot"><span>场次</span><b>' + total + '</b></div>' +
        '<div class="realm-stat"><span>平均</span><b>' + Math.round(sum / total * 10) / 10 + ' 分</b></div>' +
        '<div class="realm-stat"><span>最长</span><b>' + best + ' 分</b></div>' +
        '<div class="realm-stat"><span>完整率</span><b>' + Math.round(full / total * 100) + '%</b></div>' +
      '</div>' +
      '<p class="page-foot" style="margin-top:8px">样本为最近 ' + total +
        ' 场（存档上限 400 场）· 完整率＝未中途放弃的场次占比</p>';
  }

  /* ---------- 日程网格：本周 7 天 × 6-22 点，有专注才着色，空白=没工作 ---------- */
  function mondayOf(d){
    var x = new Date(d.getTime()); x.setHours(0, 0, 0, 0);
    var day = (x.getDay() + 6) % 7;
    x.setDate(x.getDate() - day);
    return x;
  }
  function dateKey(d){
    return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
  }
  /* ============================================================
     日程网格（苹果日历风格）· 纵向时间轴 + 横向 7 天 + height=时长%
     支持跨度切换：预设下拉 + input[type=time] 自定义起止
     ============================================================ */
  var _gridSpan = 'full';
  var _gridCustom = null;
  function gridSpanRange(){
    var spans = {
      full:  { H0: 6,  H1: 22 },
      am:    { H0: 6,  H1: 12 },
      pm:    { H0: 12, H1: 18 },
      ev:    { H0: 14, H1: 22 },
      night: { H0: 20, H1: 24 },
      '24h': { H0: 0,  H1: 24 },
      custom: _gridCustom || { H0: 6, H1: 22 }
    };
    if(_gridSpan === 'custom' && _gridCustom) return _gridCustom;
    return spans[_gridSpan] || spans.full;
  }
  function _hh2(h){ return ('0' + Math.floor(h)).slice(-2) + ':' + ((h%1)*60<10?'0':'') + Math.round((h%1)*60); }
  function spanDropdown(id){
    var opts = [
      ['full','全天 6–22'],['am','上午 6–12'],['pm','下午 12–18'],
      ['ev','下午-晚 14–22'],['night','深夜 20–24'],['24h','全日 0–24'],
      ['custom','自定义…']
    ];
    var rng = gridSpanRange();
    return '<label class="ag-span">跨度 <select data-grid-span="' + id + '">' +
      opts.map(function(o){ return '<option value="' + o[0] + '"' +
        (_gridSpan === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') +
      '</select></label>' +
      '<label class="ag-custom">起<input type="time" data-grid-start="' + id + '" value="' + _hh2(rng.H0) + '" step="1800"></label>' +
      '<label class="ag-custom">止<input type="time" data-grid-end="' + id + '" value="' + _hh2(rng.H1) + '" step="1800"></label>';
  }

  function weekGrid(){
    var st = QZD.state.study || {};
    var logs = Array.isArray(st.focusLog) ? st.focusLog : [];
    var mon = mondayOf(new Date());
    var days = ['一', '二', '三', '四', '五', '六', '日'];
    var rng = gridSpanRange();
    var H0 = rng.H0, H1 = rng.H1;
    var spanMin = (H1 - H0) * 60;   /* 总跨度分钟 */
    var dayMs = 86400000;

    /* 左侧时间刻度（每整小时标数字）+ 每 15min 细虚线 + 每 30min 中线 + 每小时实线 */
    var ticks = '';
    for(var h = H0; h <= H1; h++){
      var tp = (h - H0) / (H1 - H0) * 100;
      ticks += '<div class="ag-tick" style="top:' + tp + '%">' +
        ('0' + h).slice(-2) + ':00</div>';
    }
    var grid = '';
    /* 每 15 分钟一条（H0 到 H1，不含边界） */
    for(var h2 = H0; h2 < H1; h2 += 0.25){
      var gp = (h2 - H0) / (H1 - H0) * 100;
      if(gp <= 0 || gp >= 100) continue;
      var frac = h2 - Math.floor(h2);
      var cls;
      if(frac < 0.01) cls = ' major';        /* 整小时 → 实线粗 */
      else if(Math.abs(frac - 0.5) < 0.01) cls = ' mid';   /* 30min → 中虚线 */
      else cls = ' minor';                  /* 15/45min → 细虚线 */
      grid += '<div class="ag-grid-line' + cls +
        '" style="top:' + gp.toFixed(3) + '%"></div>';
    }

    var totalWeek = 0, colorIds = {};
    var todayKey = dateKey(new Date());

    var dayCols = days.map(function(label, i){
      var d = new Date(mon.getTime()); d.setDate(mon.getDate() + i);
      var k = dateKey(d);
      var isToday = k === todayKey;
      var weekend = i >= 5;

      /* 当天流水 */
      var dayLogs = logs.filter(function(x){ return x.date === k && x.start && x.end; })
        .sort(function(a, b){ return a.start - b.start; });
      var runs = mergeRuns(dayLogs.map(function(x){
        return { title:x.title || '专注', start:x.start, end:x.end,
                 minutes:x.minutes || 0, morning:x.morning,
                 subjectId:x.subjectId || null };
      }));

      /* 每个 run → 色块，按真实起止定位 */
      var blocks = runs.map(function(r){
        var dayStart = new Date(mon.getTime() + i * dayMs);
        dayStart.setHours(H0, 0, 0, 0);
        var segSpanMs = (H1 - H0) * 3600000;

        return runSegments(r).map(function(sg){
          var s = Math.max(sg.s, dayStart.getTime());
          var e = Math.min(sg.e, dayStart.getTime() + segSpanMs);
          if(e <= s) return '';
          var totalMinutes = spanMin;
          var sMin = (s - dayStart.getTime()) / 60000;
          var eMin = (e - dayStart.getTime()) / 60000;
          var top = Math.max(0, sMin / totalMinutes * 100);
          var height = Math.max(0.8, (eMin - sMin) / totalMinutes * 100);
          /* 视觉底线：1.2% ≈ 约 10px，让短时段也能点 */
          var minVisPct = 1.2;
          if(!sg.pause && height < minVisPct){
            /* 短时段：压缩到相邻时段之间的空隙，不放大 */
            height = minVisPct;
          }
          var col = sg.pause ? 'transparent' : subjectColor(r.subjectId);
          var morningMark = r.morning && !sg.pause
            ? '<i class="ag-morn-mark" title="晨课场次"></i>' : '';
          var tip = sg.pause
            ? UI.fmt.escape(r.title) + ' · 暂停 ' + Math.max(1, Math.round((sg.e - sg.s) / 60000)) + ' 分'
            : UI.fmt.escape(r.title) + ' · ' + hhmm(sg.s) + '–' + hhmm(sg.e) +
              ' · ' + QZD.study.subjectName(r.subjectId) +
              ' · ' + Math.round(r.minutes) + ' 分';
          var labelTxt = UI.fmt.escape(r.title);
          /* 11-18 补回：改显示时漏挂了 data-focus-subject，导致色块点不动（事件处理器一直在）。
             只给「专注段」挂，暂停斜纹段不可点；starts 是合并段内每一场的 start。 */
          var clickAttr = sg.pause ? '' :
            'data-focus-subject="' + r.starts.join(',') + '" ';
          return '<div class="ag-block' + (sg.pause ? ' pause' : '') + '" ' +
            clickAttr +
            'style="top:' + top.toFixed(2) + '%;height:' + height.toFixed(2) + '%;' +
            (sg.pause ? '' : 'background:' + col + ';') + '" ' +
            'title="' + escapeAttr(tip) + (sg.pause ? '' : ' · 点击改课题') + '">' +
            morningMark +
            '<span class="ag-block-label">' + labelTxt + '</span>' +
            '</div>';
        }).join('');
      }).join('');

      dayLogs.forEach(function(x){ colorIds[x.subjectId || 'none'] = 1; });
      totalWeek += dayLogs.reduce(function(a, x){ return a + (x.minutes || 0); }, 0);

      return '<div class="ag-col ' + (isToday ? 'today' : '') + (weekend ? ' weekend' : '') + '">' +
        '<div class="ag-col-head">' +
        '<span class="ag-day">' + label + '</span>' +
        (isToday ? '<span class="ag-today-dot"></span>' : '') +
        '</div>' +
        '<div class="ag-col-body">' + blocks + '</div></div>';
    }).join('');

    /* 图例 */
    var legendRows = Object.keys(colorIds).map(function(id){
      return '<span class="ag-legend-item"><i style="background:' + subjectColor(id) + '"></i>' +
        UI.fmt.escape(QZD.study.subjectName(id)) + '</span>';
    }).join('');
    var legend = legendRows
      ? '<div class="ag-legend">' + legendRows + '</div>' : '';

    var hint = logs.length
      ? '色块高度＝真实专注时长（短时段自动撑到可点击底线，hover 看精确数字），空白＝未工作，不扣分。跨度放大可清晰分辨 10min 级时段。'
      : '旧档尚无专注流水；开始一场专注后色块自动落位。';

    return '<div class="ag-wrap">' +
      '<div class="ag-header">' + spanDropdown('grid') +
      '<span class="ag-hint">当前跨度 ' + ('0'+H0).slice(-2) + ':00–' + ('0'+H1).slice(-2) +
      '（' + (H1 - H0) + 'h）· 本周合计 <b>' + Math.round(totalWeek / 60 * 10) / 10 + ' h</b></span>' +
      '</div>' +
      '<div class="ag-body">' +
      '<div class="ag-time-col">' + ticks + '</div>' +
      '<div class="ag-grid">' + grid + dayCols + '</div>' +
      '</div>' +
      legend +
      '<p class="page-foot" style="margin-top:10px">' + hint + '</p>';
  }

  function hhmm(ms){
    var d = new Date(ms);
    return ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2);
  }

  /* 把同任务且间隔 <5 分钟的相邻场次合并成一段（连贯性） */
  function mergeRuns(list){
    var out = [];
    list.forEach(function(x){
      var last = out[out.length - 1];
      if(last && last.title === x.title && last.subjectId === x.subjectId &&
         (x.start - last.end) <= 5 * 60000){
        last.end = Math.max(last.end, x.end);
        last.minutes = Math.round((last.minutes + x.minutes) * 10) / 10;
        last.morning = last.morning || x.morning;
        last.count = (last.count || 1) + 1;
        last.starts.push(x.start);   /* 改课题要作用到合并段内每一场 */
        /* 保留每一场的来源区间与专注片段：合并后仍能区分「专注」与「停摆」 */
        last.parts.push({ start: x.start, end: x.end, minutes: x.minutes || 0,
                          spans: Array.isArray(x.spans) ? x.spans : null });
      }else{
        out.push({ title:x.title, start:x.start, end:x.end, minutes:x.minutes,
                   morning:x.morning, subjectId:x.subjectId || null, count:1,
                   starts:[x.start],
                   parts: [{ start:x.start, end:x.end, minutes:x.minutes || 0,
                             spans: Array.isArray(x.spans) ? x.spans : null }] });
      }
    });
    return out;
  }

  /* ---------- 把一段专注拆成「实心专注」与「淡色停摆」片段 ----------
     新记录带 spans（已挖掉暂停）：实心段＝真正专注，淡段＝暂停/走神。
     旧档没有 spans：按结算分钟从起点压缩，长度严格＝实际专注时间。 */
  function runSegments(r){
    var out = [];
    var parts = (r.parts && r.parts.length) ? r.parts
      : [{ start:r.start, end:r.end, minutes:r.minutes, spans:r.spans }];
    parts.forEach(function(p){
      var prev = p.start, spans = p.spans;
      if(!spans || !spans.length){
        var span = Math.max(0, (p.end || 0) - (p.start || 0));
        var focusMs = Math.min(span, Math.max(0, (p.minutes || 0) * 60000));
        out.push({ s:p.start, e:p.start + focusMs, pause:false });
        if(span > focusMs) out.push({ s:p.start + focusMs, e:p.end, pause:true });
        return;
      }
      spans.forEach(function(sp){
        if(sp[0] > prev) out.push({ s:prev, e:sp[0], pause:true });
        out.push({ s:sp[0], e:sp[1], pause:false });
        prev = sp[1];
      });
      if(p.end > prev) out.push({ s:prev, e:p.end, pause:true });
    });
    return out;
  }

  /* ---------- 今日倍刻环：单圈 24h / 跨度可调 / SVG 圆弧色块 / 中心统计 ---------- */
  var _ringSpan = '24h';
  var _ringCustom = null;
  function ringSpanRange(){
    var spans = {
      '24h': { H0: 0,  H1: 24 },
      full:  { H0: 6,  H1: 22 },
      am:    { H0: 6,  H1: 12 },
      pm:    { H0: 12, H1: 18 },
      ev:    { H0: 14, H1: 22 },
      custom: _ringCustom || { H0: 6, H1: 22 }
    };
    if(_ringSpan === 'custom' && _ringCustom) return _ringCustom;
    return spans[_ringSpan] || spans['24h'];
  }
  function ringSpanDropdown(){
    var opts = [
      ['24h','全日 0–24'],['full','全天 6–22'],['am','上午 6–12'],
      ['pm','下午 12–18'],['ev','下午-晚 14–22'],['custom','自定义…']
    ];
    var rng = ringSpanRange();
    return '<label class="ag-span">跨度 <select data-ring-span>' +
      opts.map(function(o){ return '<option value="' + o[0] + '"' +
        (_ringSpan === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') +
      '</select></label>' +
      '<label class="ag-custom">起<input type="time" data-ring-start value="' + _hh2(rng.H0) + '" step="1800"></label>' +
      '<label class="ag-custom">止<input type="time" data-ring-end value="' + _hh2(rng.H1) + '" step="1800"></label>';
  }

  /* 把一天的时间转为"跨度内的分钟" */
  function msInSpan(ms, H0, H1){
    var d = new Date(ms);
    var h = d.getHours(), m = d.getMinutes();
    var mins = h * 60 + m;
    /* 处理跨日（0h 归 24） */
    if(mins < H0 * 60) mins += 1440;
    return mins - H0 * 60;
  }

  /* 生成一段圆弧 path d 属性，圆心 cx cy，半径 r，起止角（度），角度从顶部顺时针 */
  function arcPath(cx, cy, r, startDeg, endDeg){
    /* -90 让 0 度在正上方；顺时针增加 */
    var sa = (startDeg - 90) * Math.PI / 180;
    var ea = (endDeg   - 90) * Math.PI / 180;
    var sx = cx + r * Math.cos(sa), sy = cy + r * Math.sin(sa);
    var ex = cx + r * Math.cos(ea), ey = cy + r * Math.sin(ea);
    var large = (endDeg - startDeg) > 180 ? 1 : 0;
    return 'M ' + sx.toFixed(2) + ' ' + sy.toFixed(2) +
           ' A ' + r + ' ' + r + ' 0 ' + large + ' 1 ' +
           ex.toFixed(2) + ' ' + ey.toFixed(2);
  }

  function todayTimeline(){
    var st = QZD.state.study || {};
    var k = dateKey(new Date());
    var rng = ringSpanRange();
    var H0 = rng.H0, H1 = rng.H1;
    var spanMin = (H1 - H0) * 60;
    var spansFull24 = (_ringSpan === '24h');

    /* 今日流水 */
    var logs = (Array.isArray(st.focusLog) ? st.focusLog : []).filter(function(x){
      return x.date === k && (x.end || x.start);
    }).sort(function(a, b){ return (a.start || 0) - (b.start || 0); });

    var runs = mergeRuns(logs);
    var total = logs.reduce(function(a, x){ return a + (x.minutes || 0); }, 0);
    var longest = 0, maxGap = 0;
    runs.forEach(function(r){ if(r.minutes > longest) longest = r.minutes; });
    for(var i = 1; i < runs.length; i++){
      var gap = (runs[i].start - runs[i - 1].end) / 60000;
      if(gap > maxGap) maxGap = gap;
    }

    /* ---------- SVG 倍刻环 ----------
       viewBox 留 40px 边距给时间刻度文字，圆心在 (200,200) ---------- */
    var CX = 200, CY = 200, R_OUT = 150, R_INNER = 126;
    var R_MID = (R_OUT + R_INNER) / 2;  /* 色块居中的半径 = 138 */
    var STROKE_W = R_OUT - R_INNER;     /* 色块厚度 = 24px，更显眼 */

    /* 外环时钟式刻度：每 5min 一条短细线、每 30min 中线、每整小时长粗线、每 6h 打大字
       角度公式和色块完全一致 → 刻度和色块起点精确对齐 */
    var ringRuler = '';
    /* 跨度用分钟遍历，确保每 5min 一根线 */
    var startMin = H0 * 60, endMin = H1 * 60;
    var totalSpanMin = endMin - startMin;
    for(var m = startMin; m <= endMin; m += 5){
      var spanPosMin = m - startMin;
      var angle = spanPosMin / totalSpanMin * 360;
      var hVal = Math.floor(m / 60), mm = m % 60;
      var isHour = mm === 0;       /* 整小时 → 长粗线 + 可能打数字 */
      var isHalf = mm === 30;      /* 半小时 → 中等线 */
      var is5min = !isHour && !isHalf; /* 5min → 短细线 */
      var tickLen, tickW, tickOp;
      if(isHour){ tickLen = 10; tickW = 1.6; tickOp = 0.6; }
      else if(isHalf){ tickLen = 6; tickW = 1.1; tickOp = 0.45; }
      else { tickLen = 3; tickW = 0.7; tickOp = 0.28; }

      var sa2 = (angle - 90) * Math.PI / 180;
      var x1 = CX + R_OUT * Math.cos(sa2), y1 = CY + R_OUT * Math.sin(sa2);
      var x2 = CX + (R_OUT + tickLen) * Math.cos(sa2);
      var y2 = CY + (R_OUT + tickLen) * Math.sin(sa2);
      ringRuler += '<line x1="' + x1.toFixed(1) + '" y1="' + y1.toFixed(1) +
        '" x2="' + x2.toFixed(1) + '" y2="' + y2.toFixed(1) +
        '" stroke="var(--ink3,#9a9790)" stroke-width="' + tickW +
        '" stroke-opacity="' + tickOp + '"/>';

      /* 每整小时都标数字（跨度大时字密但完整，跨度小时字自然宽松）
         起点必标、终点不标（和起点重合） */
      if(isHour && hVal < H1){
        var tx = CX + (R_OUT + 26) * Math.cos(sa2);
        var ty = CY + (R_OUT + 26) * Math.sin(sa2) + 5;
        ringRuler += '<text x="' + tx.toFixed(0) + '" y="' + ty.toFixed(0) +
          '" text-anchor="middle" font-size="12" font-weight="500" ' +
          'fill="var(--ink2,#6b6862)" font-family:var(--font-body)">' +
          ('0' + hVal).slice(-2) + '</text>';
      }
    }

    /* 背景圆环 */
    var ringBack = '<circle cx="' + CX + '" cy="' + CY + '" r="' + R_MID +
      '" fill="none" stroke="var(--line)" stroke-width="' + STROKE_W + '" stroke-opacity="0.5"/>';

    /* 色块：每场专注拆专注段/停摆段 */
    var arcs = '';
    var visualFloorDeg = 1.0;
    runs.forEach(function(r){
      var col = subjectColor(r.subjectId);
      runSegments(r).forEach(function(sg){
        /* 把起止转为跨度内分钟 */
        var sMinSpan = msInSpan(sg.s, H0, H1);
        var eMinSpan = msInSpan(sg.e, H0, H1);
        if(eMinSpan <= sMinSpan) return;
        /* 处理跨 H1 的情况（比如 H0=14, H1=22, 专注跨到 24 点） */
        if(sMinSpan >= spanMin) return;
        eMinSpan = Math.min(eMinSpan, spanMin);

        var startDeg = sMinSpan / spanMin * 360;
        var endDeg   = eMinSpan / spanMin * 360;
        var durDeg   = endDeg - startDeg;
        if(durDeg <= 0) return;
        /* 视觉底线：短时段撑到 1° */
        var showDurDeg = Math.max(visualFloorDeg, durDeg);

        var d = arcPath(CX, CY, R_MID, startDeg, startDeg + showDurDeg);
        var fillAttr = sg.pause
          ? 'fill="none" stroke="var(--text-muted)" stroke-opacity="0.25" stroke-dasharray="4 3"'
          : 'fill="none" stroke="' + col + '" stroke-opacity="0.95"';
        var sw = STROKE_W;
        var tip = sg.pause
          ? UI.fmt.escape(r.title) + ' · 暂停 ' + Math.max(1, Math.round((sg.e - sg.s) / 60000)) + ' 分'
          : UI.fmt.escape(r.title) + ' · ' + hhmm(sg.s) + '–' + hhmm(sg.e) +
            ' · ' + QZD.study.subjectName(r.subjectId) +
            ' · ' + Math.round(r.minutes) + ' 分';
        arcs += '<path d="' + d + '" ' + fillAttr + ' stroke-width="' + sw +
          '" stroke-linecap="butt" class="ring-arc"' +
          ' title="' + escapeAttr(tip) + '" data-subject="' + (r.subjectId || '') + '"/>';
      });
    });

    /* 中心圆：今日专注总时长 + 进度（中心半径略放大，文字加粗更好看） */
    var totalMin = total;
    var goalMin = 360;
    var progressPct = Math.min(1, totalMin / goalMin);
    var centerR = 68;
    var circ = 2 * Math.PI * centerR;
    var centerArc = '<circle cx="' + CX + '" cy="' + CY + '" r="' + centerR +
      '" fill="var(--bg-soft)" stroke="var(--line)" stroke-width="1" opacity="0.7"/>';
    centerArc += '<circle cx="' + CX + '" cy="' + CY + '" r="' + centerR +
      '" fill="none" stroke="var(--line)" stroke-width="5" stroke-opacity="0.35"/>';
    centerArc += '<circle cx="' + CX + '" cy="' + CY + '" r="' + centerR +
      '" fill="none" stroke="var(--accent)" stroke-width="5" ' +
      'stroke-dasharray="' + (progressPct * circ).toFixed(1) + ' ' + circ.toFixed(1) +
      '" stroke-dashoffset="' + (circ / 4).toFixed(1) + '" stroke-linecap="round" ' +
      'transform="rotate(90 ' + CX + ' ' + CY + ')" opacity="0.85"/>';
    var centerText = '<text x="' + CX + '" y="' + (CY - 4) + '" text-anchor="middle" ' +
      'font-size="18" fill="var(--accent)" font-family:var(--font-head) font-weight="600">' +
      Math.round(totalMin / 60 * 10) / 10 + 'h</text>' +
      '<text x="' + CX + '" y="' + (CY + 16) + '" text-anchor="middle" ' +
      'font-size="11" fill="var(--ink2)" font-family:var(--font-body)">最长 ' +
      Math.round(longest) + ' 分</text>';

    /* viewBox 比圆心各多 80px，确保文字标签不被裁 */
    var svg = '<svg viewBox="0 0 400 400" class="ring-svg" preserveAspectRatio="xMidYMid meet">' +
      ringBack + ringRuler + arcs + centerArc + centerText +
      '</svg>';

    /* ---------- 时段明细列表 ---------- */
    var segsHtml = '';
    if(logs.length){
      segsHtml = runs.map(function(r){
        var col = subjectColor(r.subjectId);
        var morn = r.morning ? '<i class="ring-seg-morn" title="晨课"></i>' : '';
        return '<div class="ring-seg">' +
          '<span class="ring-seg-dot" style="background:' + col + '"></span>' +
          '<span class="ring-seg-time">' + hhmm(r.start) + '–' + hhmm(r.end) + '</span>' +
          '<span class="ring-seg-title">' + morn + UI.fmt.escape(r.title) + '</span>' +
          '<span class="ring-seg-subject">' + UI.fmt.escape(QZD.study.subjectName(r.subjectId)) + '</span>' +
          '<span class="ring-seg-min">' + Math.round(r.minutes) + ' 分</span>' +
        '</div>';
      }).join('');
    }else{
      segsHtml = '<p class="card-note">今日尚无专注记录。</p>';
    }

    var hint = logs.length
      ? '环上弧线长度＝真实专注时长（短时段撑到 1° 视觉底线，hover 看精确数字），跨度放大可清晰分辨 10min 级时段。中心圆进度表示今日 6h 目标完成率。'
      : '还没开始今天的第一场专注，环上空着的部分就是你的一天。';

    return '<div class="coherence">' +
        '<div class="coh-item"><span>今日专注</span><b>' + Math.round(total / 60 * 10) / 10 + ' h</b></div>' +
        '<div class="coh-item"><span>最长连续</span><b>' + Math.round(longest) + ' 分</b></div>' +
        '<div class="coh-item"><span>最长间断</span><b>' + (maxGap > 0 ? Math.round(maxGap) + ' 分' : '—') + '</b></div>' +
        '<div class="coh-item"><span>专注场次</span><b>' + logs.length + ' 场</b></div>' +
      '</div>' +
      '<div class="ring-wrap">' +
        '<div class="ring-topbar">' + ringSpanDropdown() +
        '<span class="ag-hint">跨度 ' + ('0'+H0).slice(-2) + ':00–' + ('0'+H1).slice(-2) +
        '（' + (H1 - H0) + 'h）</span></div>' +
        svg +
      '</div>' +
      '<div class="ring-segs">' + segsHtml + '</div>' +
      '<p class="page-foot" style="margin-top:10px">' + hint +
      '</p>';
  }

  /* ---------- KPI 卡行：本周投入 / 完成率 / 连续天数 / 今日进度 ---------- */
  function kpiRow(){
    var st = QZD.state.study || {};
    var week = QZD.study.weekMinutes ? QZD.study.weekMinutes() : 0;
    var streak = st.streak || 0;
    var todayMin = Math.round((st.history && st.history[dateKey(new Date())]) || st.doneMin || 0);
    var ck = QZD.state.checkin || {};
    var todayScore = (ck.history && ck.history[dateKey(new Date())] && ck.history[dateKey(new Date())].score) || 0;
    var goalH = 66;
    function card(label, val, sub, tone){
      return '<div class="kpi-card kpi-' + tone + '"><span class="kpi-label">' + label + '</span>' +
        '<b class="kpi-val">' + val + '</b><span class="kpi-sub">' + sub + '</span></div>';
    }
    return '<div class="kpi-grid">' +
      card('本周投入', Math.round(week / 60 * 10) / 10 + ' h', '目标 ' + goalH + ' h', 'blue') +
      card('今日打卡', todayScore + '%', todayScore >= 100 ? '已达标' : '未完成',
           todayScore >= 100 ? 'green' : 'green warn') +
      card('连续天数', streak + ' 天', '不断档', 'amber') +
      card('今日专注', Math.round(todayMin / 60 * 10) / 10 + ' h', todayMin + ' 分钟', 'violet') +
    '</div>';
  }

  /* ---------- 趋势与目标视图 ---------- */
  function trendPanel(){
    var series = trendSeries(trendDays);
    var prev = trendSeries(trendDays, 7);   /* 紧邻的上周同窗口 */
    var total = series.reduce(function(a, x){ return a + x.v; }, 0);
    var prevTotal = prev.reduce(function(a, x){ return a + x.v; }, 0);
    var active = series.filter(function(x){ return x.v > 0; }).length;
    var best = series.slice().sort(function(a, b){ return b.v - a.v; })[0];
    var switchDays = [7, 14, 30].map(function(n){
      return '<button class="chip sm' + (trendDays === n ? ' active' : '') + '" data-trend-days="' + n + '">' + n + ' 天</button>';
    }).join('');
    /* 环比：上周为 0 时不算百分比，避免出现「∞%」 */
    var cmp;
    if(prevTotal <= 0){
      cmp = '<span class="wk-cmp flat">上周同期无记录 · 本周从零起步</span>';
    }else{
      var delta = Math.round((total - prevTotal) / prevTotal * 100);
      var tone = delta > 0 ? 'up' : (delta < 0 ? 'down' : 'flat');
      var arrow = delta > 0 ? '↑' : (delta < 0 ? '↓' : '＝');
      cmp = '<span class="wk-cmp ' + tone + '">' + arrow + ' ' + Math.abs(delta) + '%</span>' +
        '<span class="wk-cmp-note">上周 ' + Math.round(prevTotal / 60 * 10) / 10 + ' h → 本周 ' +
        Math.round(total / 60 * 10) / 10 + ' h</span>';
    }
    return '' +
      '<section class="card">' +
        '<div class="card-head"><span class="card-title">本 周 星 盘</span>' +
          '<span class="card-note">走到哪 · 还差多少 · 撑了几天</span></div>' +
        starDial() +
      '</section>' +
      '<section class="card">' +
        '<div class="card-head"><span class="card-title">专注趋势</span>' +
          trendChartSwitch() +
          '<button class="chip sm" data-weekly-poster title="把本周数据拼成一张可保存的长图">长图</button>' +
        '</div>' +
        '<div class="chronos-switch">' + switchDays + '</div>' +
        '<div class="trend-legend"><span><i class="tl-now"></i>本窗口</span>' +
          '<span><i class="tl-prev"></i>上周同期</span></div>' +
        (trendChartMode === 'bar' ? trendBarChart(series, prev) : trendChart(series, prev)) +
        '<div class="wk-compare">' + cmp + '</div>' +
        '<div class="realm-stats" style="margin-top:10px">' +
          '<div class="realm-stat hot"><span>区间累计</span><b>' + Math.round(total / 60 * 10) / 10 + ' h</b></div>' +
          '<div class="realm-stat"><span>有记录天数</span><b>' + active + ' / ' + trendDays + '</b></div>' +
          '<div class="realm-stat"><span>最高一天</span><b>' + (best ? best.v + ' 分' : '—') + '</b></div>' +
        '</div>' +
      '</section>' +
      '<section class="card">' +
        '<div class="card-head"><span class="card-title">本周目标</span>' +
          '<span class="card-note">66 小时 · 差多少一眼可见</span></div>' +
        goalRing() +
      '</section>' +
      '<section class="card">' +
        '<div class="card-head"><span class="card-title">计划 vs 实际</span>' +
          '<span class="card-note">目标完成度与时间投入，差多少一眼可见</span></div>' +
        planVsActual() +
      '</section>' +
      '<section class="card">' +
        '<div class="card-head"><span class="card-title">中断原因</span>' +
          '<span class="card-note">什么最常打断你</span></div>' +
        abandonRing() +
      '</section>' +
      '<section class="card">' +
        '<div class="card-head"><span class="card-title">深度与碎片</span>' +
          '<span class="card-note">完整跑完的比例，比总时长更能说明质量</span></div>' +
        depthRing() +
      '</section>' +
      '<section class="card">' +
        '<div class="card-head"><span class="card-title">中断时段</span>' +
          '<span class="card-note">每天哪个钟点最容易被叫走</span></div>' +
        abandonHours() +
      '</section>';
  }

  UI.register('chronos', function(){
    var d = data();

    if(view === 'grid'){
      return '<section class="card">' +
        '<div class="card-head"><span class="card-title">本周日程网格</span>' +
          '<span class="card-note">有专注才着色，空白即未工作</span></div>' +
        switchBar() + focusCard() + kpiRow() +
        '<div class="week-grid">' + weekGrid() + '</div>' +
      '</section>' + managePanel();
    }

    if(view === 'timeline'){
      return '<section class="card">' +
        '<div class="card-head"><span class="card-title">今日时间轴</span>' +
          '<span class="card-note">今天每个时段的专注流水</span></div>' +
        switchBar() + focusCard() + kpiRow() + todayTimeline() +
      '</section>' + managePanel();
    }

    if(view === 'trend'){
      return '<section class="card">' +
        '<div class="card-head"><span class="card-title">趋势与目标</span>' +
          '<span class="card-note">看走势、看目标缺口</span></div>' +
        switchBar() + focusCard() + kpiRow() +
      '</section>' + trendPanel() + managePanel();
    }

    if(view === 'heat'){
      return '<section class="card">' +
        '<div class="card-head"><span class="card-title">专注热历</span>' +
          '<span class="card-note">近一年每天一格，颜色深浅即当日的量</span></div>' +
        switchBar() + focusCard() + heatCalendar() +
      '</section>' + managePanel();
    }

    if(view === 'subject'){
      var bd = QZD.study.subjectBreakdown();
      return '' +
        '<section class="card">' +
          '<div class="card-head"><span class="card-title">科研投入结构</span>' +
            '<span class="card-note">各课题累计专注时长与占比</span></div>' +
          switchBar() + focusCard() +
        '</section>' +
        '<section class="card">' +
          '<div class="card-head"><span class="card-title">课题时间占比 · ' +
            (subjectChartMode === 'bar' ? '柱状图' : '饼状图') + '</span>' +
            subjectChartSwitch() + '</div>' +
          (bd.rows.length
            ? (subjectChartMode === 'bar' ? subjectBarChart(bd) : pieChart(bd)) +
              '<div class="pie-detail-split"></div>' + subjectPanel()
            : '<div class="empty">尚无课题投入记录' +
              '<span class="card-note">开始一场专注后按课题自动归类</span></div>') +
        '</section>' + managePanel();
    }

    return '' +
      '<section class="card">' +
        '<div class="card-head"><span class="card-title">效率时段分析</span>' +
          '<span class="card-note">按专注时辰统计高峰</span></div>' +
        switchBar() + focusCard() +
        (d.total > 0 ? chart(d) : '<div class="empty">钦天监尚无星象<span class="card-note">专注几次后，这里会显示你一天里最高效的时辰</span></div>') +
      '</section>' +
      (d.total > 0 ? '<section class="card"><div class="card-head"><span class="card-title">批 语</span></div>' + verdict(d) + '</section>' : '') +
      '<section class="card">' +
        '<div class="card-head"><span class="card-title">单 场 时 长 分 布</span>' +
          '<span class="card-note">你的专注极限在哪，直接决定番茄该定多长</span></div>' +
        durationDist() +
      '</section>' +
      managePanel();
  });

  /* 重绘当前视图：若 chronos 被嵌在总览「钦天」tab 内，只重绘本页，
     不调 UI.show('chronos') 跳到独立页（否则总览两组导航消失）；
     独立页时才走 UI.show 更新 hash。 */
  function refreshChronos(){
    if(document.querySelector('[data-chronos-embed]')) UI.renderPage();
    else UI.show('chronos');
  }

  /* ---------- 跨度切换：日程网格 & 倍刻环各自记住自己的跨度 ---------- */
  document.addEventListener('change', function(e){
    var gs = e.target.closest('[data-grid-span]');
    if(gs){
      _gridSpan = gs.value;
      refreshChronos();
      return;
    }
    var rs = e.target.closest('[data-ring-span]');
    if(rs){
      _ringSpan = rs.value;
      refreshChronos();
      return;
    }
    /* 自定义起止时间：解析 HH:MM → 小时浮点数 */
    function parseHHMM(v){
      if(!v) return null;
      var p = v.split(':');
      if(p.length < 2) return null;
      return parseInt(p[0],10) + parseInt(p[1],10)/60;
    }
    var gs2 = e.target.closest('[data-grid-start]');
    if(gs2){
      var s = parseHHMM(gs2.value);
      var cur = gridSpanRange();
      _gridCustom = { H0: s, H1: cur.H1 };
      _gridSpan = 'custom';
      refreshChronos();
      return;
    }
    var ge = e.target.closest('[data-grid-end]');
    if(ge){
      var e2 = parseHHMM(ge.value);
      var cur2 = gridSpanRange();
      _gridCustom = { H0: cur2.H0, H1: e2 };
      _gridSpan = 'custom';
      refreshChronos();
      return;
    }
    var rs2 = e.target.closest('[data-ring-start]');
    if(rs2){
      var s2 = parseHHMM(rs2.value);
      var rcur = ringSpanRange();
      _ringCustom = { H0: s2, H1: rcur.H1 };
      _ringSpan = 'custom';
      refreshChronos();
      return;
    }
    var re2 = e.target.closest('[data-ring-end]');
    if(re2){
      var e3 = parseHHMM(re2.value);
      var rcur2 = ringSpanRange();
      _ringCustom = { H0: rcur2.H0, H1: e3 };
      _ringSpan = 'custom';
      refreshChronos();
      return;
    }
  });

  document.addEventListener('click', function(e){
    /* 周报长图：本周数据拼成 SVG，浏览器/桌面版都能直接下载 */
    var wp = e.target.closest('[data-weekly-poster]');
    if(wp){
      try {
        var blob = new Blob([weeklyPosterSVG()], { type: 'image/svg+xml;charset=utf-8' });
        var a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = '钦天监周报-' + weekLabel() + '.svg';
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(function(){ URL.revokeObjectURL(a.href); }, 2000);
        UI.toast('长图已生成，可在下载目录找到');
      } catch(err){ UI.toast('生成失败：' + err.message); }
      return;
    }
    var sw = e.target.closest('[data-chronos-view]');
    if(sw){
      view = sw.getAttribute('data-chronos-view');
      /* 记住这个视图：切页/重开都停在这里，不再退回「按时辰」 */
      if(QZD.state && QZD.state.settings){
        QZD.state.settings.chronosView = view;
        if(QZD.stateIO && QZD.stateIO.save) QZD.stateIO.save();
      }
      refreshChronos();
      return;
    }
    var sc = e.target.closest('[data-subject-chart]');
    if(sc){
      subjectChartMode = sc.getAttribute('data-subject-chart') === 'bar' ? 'bar' : 'pie';
      refreshChronos();
      return;
    }
    var tc = e.target.closest('[data-trend-chart]');
    if(tc){
      trendChartMode = tc.getAttribute('data-trend-chart') === 'bar' ? 'bar' : 'line';
      refreshChronos();
      return;
    }
    var td = e.target.closest('[data-trend-days]');
    if(td){
      trendDays = parseInt(td.getAttribute('data-trend-days'), 10) || 14;
      refreshChronos();
      return;
    }

    /* 点甘特条/图例：改这一场（或合并段内几场）的课题，颜色即时重绘 */
    var fsBtn = e.target.closest('[data-focus-subject]');
    if(fsBtn){
      var starts = (fsBtn.getAttribute('data-focus-subject') || '').split(',').map(Number).filter(Boolean);
      if(!starts.length) return;
      var log = (QZD.state.study.focusLog || []).filter(function(x){ return x && x.start === starts[0]; })[0];
      if(!log) return;
      var opts = '<option value="">未分类</option>' + QZD.study.subjects().map(function(s){
        return '<option value="' + s.id + '"' + (s.id === (log.subjectId || '') ? ' selected' : '') + '>' +
          UI.fmt.escape(s.name) + '</option>';
      }).join('');
      UI.modal({
        title: '改这场专注的课题',
        body: '<p class="card-note">' + UI.fmt.escape(log.title) + ' · ' +
          Math.round(log.minutes) + ' 分' + (starts.length > 1 ? '（连做 ' + starts.length + ' 场，一起改）' : '') +
          '</p><div class="field"><label for="fs-subject">归属课题</label>' +
          '<select id="fs-subject">' + opts + '</select></div>',
        ok: true, okText: '保存',
        onOk: function(mask){
          var sid = mask.querySelector('#fs-subject').value || null;
          var moved = 0;
          starts.forEach(function(st){ moved += QZD.study.setFocusSubject(st, sid) || 0; });
          QZD.stateIO.save();
          UI.toast('已改课题 · ' + QZD.study.subjectName(sid) +
            (moved ? '（同步 ' + Math.round(moved) + ' 分）' : ''));
          UI.onStateChanged();  /* 即时重绘甘特条/图例/饼图/课题条颜色 */
        }
      });
      return;
    }

    if(e.target.closest('[data-subject-add]')){
      var el = document.getElementById('subject-new');
      var r = QZD.study.addSubject(el ? el.value : '');
      if(!r.ok){ UI.toast(r.error); return; }
      UI.toast('已建课题 · ' + r.subject.name);
      UI.onStateChanged();
      return;
    }

    var del = e.target.closest('[data-subject-del]');
    if(del){
      var id = del.getAttribute('data-subject-del');
      UI.confirm('解散课题只会解除归属：已累计的分钟记为「已解散课题」，相关奏折退回未分类。确定？', function(){
        QZD.study.removeSubject(id);
        UI.onStateChanged();
        UI.toast('课题已解散');
      }, { okText: '确定解散' });
    }
  });

  document.addEventListener('keydown', function(e){
    if(e.key === 'Enter' && e.target && e.target.id === 'subject-new'){
      e.preventDefault();
      var b = document.querySelector('[data-subject-add]');
      if(b) b.click();
    }
  });
})();
