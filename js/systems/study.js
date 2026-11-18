/* ============================================================
   systems/study.js · 专注时长记录器
   - 只负责记录：每日专注总时长 / 历史（热力图与统计用）
   - 是否达标、是否惩罚，统一由 checkin（每日打卡）判定
   ============================================================ */
(function(){
  var CFG = QZD.config;
  var S = CFG.STUDY || {};

  function today(){ return QZD.stateIO.todayStr(); }
  function dayStr(d){ return QZD.stateIO.todayStr(d); }

  function dayMs(s){
    var p = String(s).split('-');
    return new Date(+p[0], (+p[1]) - 1, +p[2]).getTime();
  }
  function prevDay(s){
    var p = String(s).split('-');
    var d = new Date(+p[0], (+p[1]) - 1, +p[2]);
    d.setDate(d.getDate() - 1);
    return dayStr(d);
  }

  function study(){
    if(!QZD.state.study || typeof QZD.state.study !== 'object') QZD.state.study = {};
    return QZD.state.study;
  }

  /* 跨日：把昨日分钟留在 history，重置今日计数 */
  function ensure(){
    var st = study();
    var t = today();
    if(!st.history || typeof st.history !== 'object') st.history = {};
    if(!st.hourStats || typeof st.hourStats !== 'object') st.hourStats = {};
    if(!st.date) st.date = t;

    if(st.date !== t){
      st.history[st.date] = Math.round(st.doneMin || 0);
      st.date = t;
      st.doneMin = 0;
      st.sessionCount = 0;
    }
    return st;
  }

  /* 记录专注分钟（每秒钟级调用，不写日志、不存档，由调用方统一保存）
     subjectId：本次专注归属的课题，缺省归入「未分类」 */
  function addMinutesSilent(min, subjectId){
    var st = ensure();
    min = Number(min) || 0;
    if(min <= 0) return st;
    st.doneMin = (st.doneMin || 0) + min;
    st.history[st.date] = Math.round(st.doneMin);
    /* 按当前小时分桶，累计专注分钟（供热力图式时段分析） */
    if(!st.hourStats || typeof st.hourStats !== 'object') st.hourStats = {};
    var h = new Date().getHours();
    st.hourStats[h] = (st.hourStats[h] || 0) + min;
    /* 按「日期 × 小时」分桶（供钦天监日程网格 / 今日时间轴） */
    if(!st.dayHour || typeof st.dayHour !== 'object') st.dayHour = {};
    var dh = st.date;
    if(!st.dayHour[dh] || typeof st.dayHour[dh] !== 'object') st.dayHour[dh] = {};
    st.dayHour[dh][h] = (st.dayHour[dh][h] || 0) + min;
    /* 按课题分桶（供钦天监看科研投入结构） */
    if(!st.subjectStats || typeof st.subjectStats !== 'object') st.subjectStats = {};
    var key = subjectId || 'none';
    st.subjectStats[key] = (st.subjectStats[key] || 0) + min;
    /* 按「日期 × 课题」分桶（供周报看本周课题投入） */
    if(!st.subjectDaily || typeof st.subjectDaily !== 'object') st.subjectDaily = {};
    var day = st.date;
    if(!st.subjectDaily[day] || typeof st.subjectDaily[day] !== 'object') st.subjectDaily[day] = {};
    st.subjectDaily[day][key] = (st.subjectDaily[day][key] || 0) + min;
    return st;
  }

  /* 兼容旧调用：记录分钟 + 计一次专注场次 */
  function addMinutes(min){
    var st = addMinutesSilent(min);
    if(min > 0) st.sessionCount = (st.sessionCount || 0) + 1;
    QZD.stateIO.save();
    return st;
  }

  /* 每次专注结算（完成或退出）计一场 */
  function bumpSession(){
    var st = ensure();
    st.sessionCount = (st.sessionCount || 0) + 1;
    return st.sessionCount;
  }

  /* 某天专注分钟（热力图 tooltip 用） */
  function dayMinutes(date){
    var st = ensure();
    if(date === st.date) return Math.round(st.doneMin || 0);
    return Math.round(st.history[date] || 0);
  }

  /* 达标判定改由打卡系统负责 */
  function isMet(){
    if(!QZD.checkin) return true;
    var st = QZD.checkin.todayStat();
    return st.total === 0 || st.allDone;   /* 没有目标就没有惩罚 */
  }

  function multiplier(){
    if(QZD.checkin) return QZD.checkin.multiplier();
    return 1;
  }

  /* 连续达标天数：以打卡满分为准，从今天（或昨天）往前数 */
  function streak(){
    if(!QZD.checkin) return 0;
    var ck = QZD.state.checkin;
    var hist = (ck && ck.history) || {};
    var t = today();
    var cur = t;
    var n = 0;
    /* 今天还没满分时，从昨天开始数，避免早上断签 */
    var todayScore = (ck && QZD.checkin.scoreOf(ck.goals).score) || 0;
    if(todayScore < 100) cur = prevDay(t);

    for(var guard = 0; guard < 400; guard++){
      var rec = hist[cur];
      if(!rec || rec.score < 100) break;
      n++;
      cur = prevDay(cur);
    }
    return n;
  }

  function weekMinutes(){
    var st = ensure();
    var now = dayMs(today());
    var sum = 0;
    Object.keys(st.history).forEach(function(k){
      var d = dayMs(k);
      if(d <= now && now - d <= 6 * 86400000) sum += (st.history[k] || 0);
    });
    return Math.round(sum);
  }

  function setSubject(text){
    var st = ensure();
    st.subject = String(text || '').trim().slice(0, 24);
    QZD.stateIO.save();
    return st.subject;
  }

  /* ---------- 课题（科研项目）维度 ---------- */
  function subjects(){
    var st = study();
    if(!Array.isArray(st.subjects)) st.subjects = [];
    return st.subjects;
  }

  function subjectUid(){
    return 's' + Date.now().toString(36) + Math.floor(Math.random() * 1000).toString(36);
  }

  function addSubject(name){
    name = String(name || '').trim().slice(0, 20);
    if(!name) return { ok: false, error: '课题名不可为空' };
    var list = subjects();
    for(var i = 0; i < list.length; i++){
      if(list[i].name === name) return { ok: false, error: '该课题已存在' };
    }
    if(list.length >= 12) return { ok: false, error: '课题最多 12 个，先清理不用的' };
    var s = { id: subjectUid(), name: name };
    list.push(s);
    QZD.stateIO.save();
    return { ok: true, subject: s };
  }

  function removeSubject(id){
    var list = subjects();
    for(var i = 0; i < list.length; i++){
      if(list[i].id !== id) continue;
      var name = list[i].name;
      list.splice(i, 1);
      /* 已投入的分钟不删：在分布里显示为「已解散课题」，避免历史总时长凭空消失 */
      /* 挂着该课题的奏折退回未分类，不连带删奏折 */
      (QZD.state.memorials || []).forEach(function(m){
        if(m.subjectId === id) m.subjectId = null;
      });
      if(QZD.stateIO.pushLog) QZD.stateIO.pushLog('study', '解散课题 · ' + name);
      QZD.stateIO.save();
      return { ok: true };
    }
    return { ok: false, error: '课题不存在' };
  }

  /* 各课题累计专注分钟，按多少排序；无记录的课题不出现 */
  function subjectBreakdown(){
    var st = study();
    var ss = st.subjectStats || {};
    var nameOf = {};
    subjects().forEach(function(s){ nameOf[s.id] = s.name; });

    var rows = [], total = 0;
    Object.keys(ss).forEach(function(k){
      var v = ss[k] || 0;
      if(v <= 0) return;
      total += v;
      rows.push({
        id: k,
        name: k === 'none' ? '未分类' : (nameOf[k] || '已解散课题'),
        min: Math.round(v)
      });
    });
    /* 用取整后的显示值算占比，保证「分钟合计」与百分比自洽
       （否则 0.68分→显示1分、total=0.68，会算出 147%） */
    var shownTotal = rows.reduce(function(a, r){ return a + r.min; }, 0);
    rows.forEach(function(r){ r.pct = shownTotal > 0 ? Math.round(r.min / shownTotal * 100) : 0; });
    rows.sort(function(a, b){ return b.min - a.min; });
    /* 把舍入误差归到最小的一项，保证合计正好 100% */
    if(rows.length > 1){
      var sum = rows.reduce(function(a, r){ return a + r.pct; }, 0);
      rows[rows.length - 1].pct = Math.max(0, rows[rows.length - 1].pct + (100 - sum));
    }
    return { total: shownTotal, rows: rows };
  }

  /* 课题稳定配色：按 id 逐字符哈希取色，增删课题不串色。
     未分类(none)、空 id、已解散课题统一用中性灰，避免为「幽灵课题」占用专色。 */
  function subjectColor(id){
    var pal = CFG.SUBJECT_COLORS || [];
    var none = CFG.SUBJECT_COLOR_NONE || '#9a9790';
    if(!id || id === 'none' || !pal.length) return none;
    /* 已解散的课题 id 不在现有列表里 → 中性灰 */
    var known = false, list = subjects();
    for(var i = 0; i < list.length; i++) if(list[i].id === id){ known = true; break; }
    if(!known) return none;
    var h = 0;
    for(var j = 0; j < id.length; j++) h = (h * 31 + id.charCodeAt(j)) >>> 0;
    return pal[h % pal.length];
  }
  /* id → 展示名（含 none / 已解散）；图例与进度条共用，避免各视图各写一份 */
  function subjectName(id){
    if(!id || id === 'none') return '未分类';
    var list = subjects();
    for(var i = 0; i < list.length; i++) if(list[i].id === id) return list[i].name;
    return '已解散课题';
  }

  /* 迁移某奏折已记的专注分钟：从旧课题挪到新课题。
     focusLog 每一条带 memorialId + 当时的 subjectId + date + minutes，
     据此把 subjectStats / subjectDaily 里属于该奏折的分钟精确搬移。
     聚合表本身没有 memorialId 维度，只能靠流水定位——这是唯一可靠来源。
     返回本次迁移的分钟数（供 UI 提示）。 */
  function moveMemorialMinutes(memorialId, newSubjectId){
    var st = ensure();
    var logs = Array.isArray(st.focusLog) ? st.focusLog : [];
    var newKey = newSubjectId || 'none';
    var moved = 0;
    if(!st.subjectStats || typeof st.subjectStats !== 'object') st.subjectStats = {};
    if(!st.subjectDaily || typeof st.subjectDaily !== 'object') st.subjectDaily = {};

    logs.forEach(function(x){
      if(!x || x.memorialId !== memorialId) return;
      var min = Number(x.minutes) || 0;
      if(min <= 0) return;
      var oldKey = x.subjectId || 'none';
      var day = x.date || QZD.stateIO.todayStr(new Date(x.end || Date.now()));
      /* 流水本身也更新归属，避免下次重复迁移时仍指向旧课题 */
      x.subjectId = newSubjectId || null;
      if(oldKey === newKey) return;   /* 同课题无需搬 */
      st.subjectStats[oldKey] = Math.max(0, (st.subjectStats[oldKey] || 0) - min);
      st.subjectStats[newKey] = (st.subjectStats[newKey] || 0) + min;
      if(st.subjectDaily[day]){
        st.subjectDaily[day][oldKey] = Math.max(0, (st.subjectDaily[day][oldKey] || 0) - min);
        st.subjectDaily[day][newKey] = (st.subjectDaily[day][newKey] || 0) + min;
      }
      moved += min;
    });
    return Math.round(moved * 10) / 10;
  }

  /* 改单条专注流水的课题归属（时间轴条目改课题用）。
     用 start 时间戳定位该条，把它的分钟从旧课题搬到新课题，同步 subjectStats/subjectDaily。
     start 相同视为同一场（focusLog 里 start 唯一）。返回迁移分钟数。 */
  function setFocusSubject(startTs, newSubjectId){
    var st = ensure();
    var logs = Array.isArray(st.focusLog) ? st.focusLog : [];
    var newKey = newSubjectId || 'none';
    var moved = 0;
    if(!st.subjectStats || typeof st.subjectStats !== 'object') st.subjectStats = {};
    if(!st.subjectDaily || typeof st.subjectDaily !== 'object') st.subjectDaily = {};
    logs.forEach(function(x){
      if(!x || x.start !== startTs) return;
      var min = Number(x.minutes) || 0;
      var oldKey = x.subjectId || 'none';
      var day = x.date;
      x.subjectId = newSubjectId || null;
      if(oldKey === newKey) return;
      st.subjectStats[oldKey] = Math.max(0, (st.subjectStats[oldKey] || 0) - min);
      st.subjectStats[newKey] = (st.subjectStats[newKey] || 0) + min;
      if(day && st.subjectDaily[day]){
        st.subjectDaily[day][oldKey] = Math.max(0, (st.subjectDaily[day][oldKey] || 0) - min);
        st.subjectDaily[day][newKey] = (st.subjectDaily[day][newKey] || 0) + min;
      }
      moved += min;
    });
    return Math.round(moved * 10) / 10;
  }

  function shouldBreak(){
    var st = ensure();
    var every = S.BREAK_EVERY || 2;
    return st.sessionCount > 0 && st.sessionCount % every === 0;
  }

  function snapshot(){
    var st = ensure();
    var ck = QZD.checkin ? QZD.checkin.todayStat() : { total: 0, done: 0, score: 0, allDone: false };
    return {
      date: st.date,
      doneMin: Math.round(st.doneMin || 0),
      week: weekMinutes(),
      streak: streak(),
      subject: st.subject || '',
      sessionCount: st.sessionCount || 0,
      checkin: ck,
      multiplier: multiplier(),
      met: !!ck.allDone
    };
  }

  QZD.study = {
    addMinutes: addMinutes,
    addMinutesSilent: addMinutesSilent,
    bumpSession: bumpSession,
    dayMinutes: dayMinutes,
    isMet: isMet,
    multiplier: multiplier,
    streak: streak,
    weekMinutes: weekMinutes,
    setSubject: setSubject,
    shouldBreak: shouldBreak,
    snapshot: snapshot,
    /* 课题维度 */
    subjects: subjects,
    addSubject: addSubject,
    removeSubject: removeSubject,
    subjectColor: subjectColor,
    subjectName: subjectName,
    moveMemorialMinutes: moveMemorialMinutes,
    setFocusSubject: setFocusSubject,
    subjectBreakdown: subjectBreakdown
  };
})();
