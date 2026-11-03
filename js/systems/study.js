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
    rows.forEach(function(r){ r.pct = total > 0 ? Math.round(r.min / total * 100) : 0; });
    rows.sort(function(a, b){ return b.min - a.min; });
    return { total: Math.round(total), rows: rows };
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
    subjectBreakdown: subjectBreakdown
  };
})();
