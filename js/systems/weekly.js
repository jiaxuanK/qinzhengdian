/* ============================================================
   systems/weekly.js · 呈递周折（科研学习周报一键生成）
   - 汇总最近 7 天：专注时长 / 每日打卡 / 办结奏折
   - 生成一段中性措辞、可直接发给导师（或存档）的周报文本
   - 依赖：study.dayMinutes / checkin.dayOf / state.memorials
   ============================================================ */
(function(){
  function ds(d){ return QZD.stateIO.todayStr(d); }
  function addDays(d, n){
    var x = new Date(d.getTime());
    x.setDate(x.getDate() + n);
    return x;
  }
  function fmtMD(d){ return (d.getMonth() + 1) + '.' + d.getDate(); }
  function fmtMin(m){
    m = Math.round(m);
    var h = Math.floor(m / 60), r = m % 60;
    return h > 0 ? (h + ' 小时' + (r ? ' ' + r + ' 分' : '')) : (r + ' 分钟');
  }

  /* 汇总最近 7 天数据 */
  function collect(){
    var today = new Date(); today.setHours(0, 0, 0, 0);
    var days = [];
    var focus = 0, bestDay = null, bestMin = 0;
    var ckDays = 0, ckScoreSum = 0, ckFull = 0;

    for(var i = 6; i >= 0; i--){
      var d = addDays(today, -i), key = ds(d);
      var f = (QZD.study && QZD.study.dayMinutes) ? (QZD.study.dayMinutes(key) || 0) : 0;
      var r = (QZD.checkin && QZD.checkin.dayOf) ? QZD.checkin.dayOf(key) : { score: 0, total: 0 };
      days.push({ d: d, key: key, focus: f, score: r.score || 0, total: r.total || 0, done: r.done || 0 });
      focus += f;
      if(f > bestMin){ bestMin = f; bestDay = d; }
      if(r.total && r.score > 0){ ckDays++; ckScoreSum += r.score; if(r.score >= 100) ckFull++; }
    }

    /* 本周办结的奏折 */
    var done = [];
    var arr = (QZD.state && Array.isArray(QZD.state.memorials)) ? QZD.state.memorials : [];
    arr.forEach(function(m){
      if(m.status === 'banjie' && m.finishedAt){
        var fd = new Date(m.finishedAt); fd.setHours(0, 0, 0, 0);
        if((today - fd) < 7 * 86400000 && fd <= today){
          done.push({ title: m.title, focusMin: Math.round(m.focusMin || 0),
                      sessions: m.sessions || 0, at: fmtMD(fd) });
        }
      }
    });

    /* 当前连胜（复用热力图统计） */
    var streak = 0;
    try {
      if(QZD.ui && QZD.ui.heatmap && QZD.ui.heatmap.meta) streak = QZD.ui.heatmap.meta().current || 0;
    } catch(e){ streak = 0; }

    /* 本周三事 / 专注进展 / 组会待办 / 精读（模块缺失时降级为空） */
    var goals = (QZD.plan && QZD.plan.goals) ? QZD.plan.goals() : [];
    var progress = (QZD.plan && QZD.plan.recent) ? QZD.plan.recent(7) : [];
    var pendingTodos = (QZD.meetings && QZD.meetings.pendingTodos) ? QZD.meetings.pendingTodos() : [];
    var readingDone = (QZD.reading && QZD.reading.doneThisWeek) ? QZD.reading.doneThisWeek() : [];

    /* 本周课题投入：按「日期×课题」聚合，再映射成课题名 */
    var subjNames = {};
    try {
      if(QZD.study && QZD.study.subjects) QZD.study.subjects().forEach(function(s){ subjNames[s.id] = s.name; });
    } catch(e){ subjNames = {}; }
    var sdaily = (QZD.state && QZD.state.study && QZD.state.study.subjectDaily) || {};
    var subjWeek = {};
    days.forEach(function(d){
      var bucket = sdaily[d.key];
      if(!bucket) return;
      Object.keys(bucket).forEach(function(k){
        var nm = (k === 'none') ? '未分类' : (subjNames[k] || '已删课题');
        subjWeek[nm] = (subjWeek[nm] || 0) + (bucket[k] || 0);
      });
    });

    /* 未办结事项（本周仍在办） */
    var running = ((QZD.state && QZD.state.memorials) || [])
      .filter(function(m){ return m.status !== 'banjie'; })
      .map(function(m){
        return { title: m.title, focusMin: Math.round(m.focusMin || 0),
                 status: m.status, dueAt: m.dueAt || null };
      })
      .sort(function(a, b){ return b.focusMin - a.focusMin; });

    /* 中断记录（近 7 天） */
    var from7 = Date.now() - 7 * 86400000;
    var abandons = ((QZD.state && QZD.state.study && Array.isArray(QZD.state.study.abandonLog))
      ? QZD.state.study.abandonLog : []).filter(function(x){ return x.at >= from7; });
    var abandonByReason = {};
    abandons.forEach(function(x){
      var r = x.reason || '未注明';
      abandonByReason[r] = (abandonByReason[r] || 0) + 1;
    });

    return { days: days, focus: focus, bestDay: bestDay, bestMin: bestMin,
             ckDays: ckDays, ckScoreSum: ckScoreSum, ckFull: ckFull,
             done: done, streak: streak,
             goals: goals, progress: progress,
             pendingTodos: pendingTodos, readingDone: readingDone,
             subjWeek: subjWeek, running: running,
             abandons: abandons, abandonByReason: abandonByReason };
  }

  /* 规则式小结（诚实、可执行，不吹） */
  function summaryLine(c){
    var tips = [];
    var avg = c.ckDays ? Math.round(c.ckScoreSum / c.ckDays) : 0;
    if(c.ckDays >= 6 && avg >= 80) tips.push('打卡非常稳定，继续保持');
    else if(c.ckDays <= 3) tips.push('打卡频率偏低，建议每晚固定时间复盘立目标');
    if(c.focus >= 600) tips.push('专注时长充实');
    else if(c.focus < 120) tips.push('专注时长偏少，建议每天先保证一个完整番茄');
    if(!tips.length) tips.push('节奏平稳，下周可尝试提高目标难度');
    return tips.join('；') + '。';
  }

  /* 生成周报文本 */
  function build(){
    var c = collect();
    var today = new Date();
    var start = addDays(today, -6);
    var L = [];
    L.push('【学习周报】' + fmtMD(start) + ' – ' + fmtMD(today));
    L.push('');
    L.push('一、专注');
    L.push('· 本周累计专注 ' + fmtMin(c.focus) + '，日均 ' + Math.round(c.focus / 7) + ' 分钟');
    if(c.bestDay) L.push('· 最高单日：' + fmtMD(c.bestDay) + '，' + fmtMin(c.bestMin));
    var subjKeys = Object.keys(c.subjWeek || {}).sort(function(a, b){ return c.subjWeek[b] - c.subjWeek[a]; });
    if(subjKeys.length){
      L.push('· 课题投入：' + subjKeys.slice(0, 6).map(function(k){
        return k + ' ' + fmtMin(c.subjWeek[k]);
      }).join(' · '));
    }
    L.push('');
    L.push('二、每日打卡');
    L.push('· 打卡 ' + c.ckDays + '/7 天' +
      (c.ckDays ? '，均分 ' + Math.round(c.ckScoreSum / c.ckDays) + '，满分 ' + c.ckFull + ' 天' : ''));
    if(c.streak > 1) L.push('· 当前连胜 ' + c.streak + ' 天');
    L.push('');
    L.push('三、本周完成事项');
    if(c.done.length){
      c.done.forEach(function(m){
        L.push('· ' + m.title + '（' + m.at + ' · 累计 ' + m.focusMin + ' 分 / ' + m.sessions + ' 次）');
      });
    }else{
      L.push('· 本周暂无办结事项');
    }
    L.push('');
    L.push('四、本周计划（三事）');
    if(c.goals && c.goals.length){
      c.goals.forEach(function(g){ L.push('· ' + (g.done ? '[已完成] ' : '[未完成] ') + g.text); });
      L.push('· 完成 ' + c.goals.filter(function(g){ return g.done; }).length + ' / ' + c.goals.length);
    }else{
      L.push('· 本周未设定计划');
    }
    L.push('');
    L.push('五、本周进展');
    if(c.progress && c.progress.length){
      c.progress.slice(0, 10).forEach(function(p){
        L.push('· ' + fmtMD(new Date(p.at)) + ' · ' + p.text + (p.minutes ? '（' + p.minutes + ' 分）' : ''));
      });
    }else{
      L.push('· 暂无专注进展记录');
    }
    L.push('');
    L.push('六、组会待办（未完成）');
    if(c.pendingTodos && c.pendingTodos.length){
      c.pendingTodos.slice(0, 10).forEach(function(t){
        L.push('· ' + t.text + '（' + t.date + ' 组会）');
      });
    }else{
      L.push('· 无未完成组会待办');
    }
    L.push('');
    L.push('七、文献精读');
    L.push('· 本周精读 ' + ((c.readingDone && c.readingDone.length) || 0) + ' 篇' +
      (c.readingDone && c.readingDone.length
        ? '：' + c.readingDone.slice(0, 5).map(function(x){ return x.title; }).join('；')
        : ''));
    L.push('');
    L.push('八、未完成事项');
    if(c.running && c.running.length){
      c.running.slice(0, 8).forEach(function(m){
        L.push('· ' + m.title + '（已投入 ' + m.focusMin + ' 分' +
          (m.dueAt ? ' · 截止 ' + fmtMD(new Date(m.dueAt)) : '') + '）');
      });
    }else{
      L.push('· 无未完成事项');
    }
    L.push('');
    L.push('九、中断与风险');
    if(c.abandons && c.abandons.length){
      var rs = Object.keys(c.abandonByReason || {}).map(function(k){
        return k + ' ' + c.abandonByReason[k] + ' 次';
      }).join('、');
      L.push('· 本周中断 ' + c.abandons.length + ' 次（' + rs + '）');
    }else{
      L.push('· 本周无中断记录');
    }
    L.push('');
    L.push('十、小结');
    L.push('· ' + summaryLine(c));
    return L.join('\n');
  }

  /* 基于本周数据给出「下周三事」建议（未完成三事 → 组会待办 → 兜底） */
  function suggestNextGoals(){
    var c = collect();
    var out = [];
    (c.goals || []).forEach(function(g){
      if(!g.done && out.length < 3 && out.indexOf(g.text) < 0) out.push(g.text);
    });
    (c.pendingTodos || []).forEach(function(t){
      if(out.length < 3 && out.indexOf(t.text) < 0) out.push(t.text);
    });
    if(!out.length){
      out.push('先补一个完整番茄：把最卡的问题写清楚');
      out.push('精读 1 篇文献并记一条灵感');
    }
    return out.slice(0, 3);
  }

  /* 复制到剪贴板（Clipboard API + execCommand 兜底） */
  function copyText(text, done){
    function legacy(){
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      var ok = false;
      try { ok = document.execCommand('copy'); } catch(e){}
      document.body.removeChild(ta);
      if(done) done(ok);
    }
    if(navigator.clipboard && navigator.clipboard.writeText){
      navigator.clipboard.writeText(text).then(function(){ if(done) done(true); }, legacy);
    }else legacy();
  }

  /* ---------- 数据快照：供 AI / 定时任务读取的结构化数据 ---------- */
  function pad2(n){ return n < 10 ? '0' + n : '' + n; }
  function snapshot(){
    var c = collect();
    var today = new Date(); today.setHours(0, 0, 0, 0);
    var start = addDays(today, -6);
    return {
      app: '勤政殿',
      kind: 'weekly-snapshot',
      version: 1,
      generatedAt: new Date().toISOString(),
      range: { start: ds(start), end: ds(today) },
      focus: {
        totalMin: Math.round(c.focus),
        dailyAvgMin: Math.round(c.focus / 7),
        best: c.bestDay ? { date: ds(c.bestDay), min: Math.round(c.bestMin) } : null,
        daily: c.days.map(function(d){ return { date: d.key, min: Math.round(d.focus) }; })
      },
      checkin: {
        days: c.ckDays,
        avgScore: c.ckDays ? Math.round(c.ckScoreSum / c.ckDays) : 0,
        fullDays: c.ckFull,
        streak: c.streak,
        daily: c.days.map(function(d){ return { date: d.key, score: d.score, total: d.total }; })
      },
      done: (c.done || []).map(function(m){
        return { title: m.title, focusMin: m.focusMin, sessions: m.sessions, at: m.at };
      }),
      plan: {
        goals: (c.goals || []).map(function(g){ return { text: g.text, done: !!g.done }; }),
        goalsDone: (c.goals || []).filter(function(g){ return g.done; }).length,
        goalsTotal: (c.goals || []).length
      },
      progress: (c.progress || []).map(function(p){
        return { at: p.at, text: p.text, minutes: p.minutes, title: p.title };
      }),
      meetings: {
        pendingTodos: (c.pendingTodos || []).map(function(t){
          return { text: t.text, date: t.date, meeting: t.meetingTitle };
        })
      },
      reading: {
        doneThisWeek: (c.readingDone || []).length,
        titles: (c.readingDone || []).slice(0, 10).map(function(x){ return x.title; })
      },
      subjects: Object.keys(c.subjWeek || {}).sort(function(a, b){
        return c.subjWeek[b] - c.subjWeek[a];
      }).map(function(k){ return { name: k, min: Math.round(c.subjWeek[k]) }; }),
      running: (c.running || []).map(function(m){
        return { title: m.title, focusMin: m.focusMin, dueAt: m.dueAt };
      }),
      abandons: {
        count: (c.abandons || []).length,
        byReason: c.abandonByReason || {}
      },
      tip: summaryLine(c),
      text: build()
    };
  }

  function exportJson(){ return JSON.stringify(snapshot(), null, 2); }

  function fileName(){
    var t = new Date();
    return 'weekly-' + t.getFullYear() + '-' + pad2(t.getMonth() + 1) + '-' + pad2(t.getDate()) + '.json';
  }

  /* 导出数据文件：桌面版落盘到 reports/（并更新 weekly-latest.json）；浏览器版触发下载 */
  function exportFile(done){
    var json = exportJson(), name = fileName();
    if(window.QZDNative && window.QZDNative.isDesktop && window.QZDNative.exportWeekly){
      window.QZDNative.exportWeekly({ name: name, json: json }).then(function(res){
        if(done) done(res && res.ok ? { ok: true, path: res.path } : { ok: false, error: (res && res.error) || '导出失败' });
      }, function(err){ if(done) done({ ok: false, error: String(err) }); });
      return;
    }
    try {
      var blob = new Blob([json], { type: 'application/json;charset=utf-8' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url; a.download = name; a.style.display = 'none';
      document.body.appendChild(a); a.click();
      setTimeout(function(){
        try { URL.revokeObjectURL(url); } catch(e){}
        if(a.parentNode) a.parentNode.removeChild(a);
      }, 1000);
      if(done) done({ ok: true, download: true, name: name });
    } catch(e){ if(done) done({ ok: false, error: String(e) }); }
  }

  /* 生成给 AI 的提示词（内嵌本周数据，复制后直接粘贴即可） */
  function aiPrompt(){
    var s = snapshot();
    return [
      '你是我的科研学习助理。下面是我最近 7 天的学习数据（JSON），请据此写一份中文「学习周报」。',
      '',
      '要求：',
      '1. 结构：本周概览 / 专注与课题分布 / 打卡与习惯 / 完成事项 / 本周三事对账 / 组会待办 / 文献精读 / 未完成事项 / 中断与风险 / 下周计划建议；',
      '2. 语气务实、不吹；所有数字必须与数据一致；数据不足处如实说明，不要编造；',
      '3. 控制在 400–600 字，可直接发给导师。',
      '',
      '数据：',
      JSON.stringify(s)
    ].join('\n');
  }

  QZD.weekly = {
    build: build,
    suggestNextGoals: suggestNextGoals,
    copyText: copyText,
    snapshot: snapshot,
    exportJson: exportJson,
    exportFile: exportFile,
    aiPrompt: aiPrompt
  };
})();
