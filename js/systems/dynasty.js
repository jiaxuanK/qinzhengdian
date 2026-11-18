/* ============================================================
   systems/dynasty.js · F1/F2/F3 温和版国势危机
   - F1 安定度槽（0–100）：缺席缓降（有下限），专注 / 打卡 / 办结奏折回补
   - F2 分级事件：按阈值下降逐级触发（朝臣议论 / 灾异 / 边患 / 六宫忧色）
       全程不删档、不清资源、不动妃子与皇子
   - F3 拨乱反正：从危机回到安定线，给一次性奖励 + 叙事（出口比惩罚更爽）
   - 所有变化可挽回；遵守 focusQuiet（专注中不弹随机事件）
   ============================================================ */
(function(){
  var CFG = QZD.config.DYNASTY || {};
  var LEVELS = CFG.LEVELS || [];

  function S(){
    var s = QZD.state;
    if(!s.dynasty || typeof s.dynasty !== 'object') s.dynasty = {};
    var d = s.dynasty;
    if(typeof d.stability !== 'number' || !isFinite(d.stability)) d.stability = CFG.INITIAL || 80;
    if(typeof d.level !== 'string') d.level = 'calm';
    if(typeof d.lastSettledDate !== 'string') d.lastSettledDate = '';
    if(!Array.isArray(d.fired)) d.fired = [];
    if(typeof d.crisisDays !== 'number') d.crisisDays = 0;
    if(typeof d.wasCrisis !== 'boolean') d.wasCrisis = false;
    if(typeof d.restoredAt !== 'number') d.restoredAt = 0;
    if(typeof d.deepestLevel !== 'string' || !d.deepestLevel) d.deepestLevel = 'calm';
    return d;
  }
  function today(){ return QZD.stateIO.todayStr(); }
  function quiet(){
    return !!(QZD.state.settings && QZD.state.settings.focusQuiet &&
              QZD.pomodoro && QZD.pomodoro.isActive && QZD.pomodoro.isActive());
  }
  function dayGap(a, b){
    if(!a || !b) return 0;
    var x = Date.parse(a + 'T00:00:00'), y = Date.parse(b + 'T00:00:00');
    if(!isFinite(x) || !isFinite(y)) return 0;
    return Math.max(0, Math.round((y - x) / 86400000));
  }
  function clamp(v){
    return Math.max(CFG.MIN || 0, Math.min(CFG.MAX || 100, v));
  }

  /* 安定度 → 级别 id：LEVELS 的 below 从高到低（80/60/40/20/0），
     取第一个 stability >= below 的级别。v 越高越太平。 */
  function levelOf(v){
    for(var i = 0; i < LEVELS.length; i++){
      if(v >= LEVELS[i].below) return LEVELS[i].id;
    }
    return LEVELS.length ? LEVELS[LEVELS.length - 1].id : 'calm';
  }
  function levelIndex(id){
    for(var i = 0; i < LEVELS.length; i++) if(LEVELS[i].id === id) return i;
    return 0;
  }
  function levelName(id){
    for(var i = 0; i < LEVELS.length; i++) if(LEVELS[i].id === id) return LEVELS[i].name;
    return '海晏河清';
  }
  /* 危机级别：talk 及更深（用于 UI 横幅 / 危机中回补，判定放宽） */
  function isCrisis(id){ return levelIndex(id) >= levelIndex('talk') && id !== 'calm'; }
  /* 值得发「拨乱反正」资源奖励的危机级别：本次最深须到过 REWARD_MIN_LEVEL（默认 omen）
     浅危机（只到 talk）回归只写叙事不给钱，堵住「缺席一天+一场专注」反复刷奖励 */
  function rewardWorthy(id){
    var min = CFG.REWARD_MIN_LEVEL || 'omen';
    return levelIndex(id) >= levelIndex(min);
  }

  function toast(txt){
    if(quiet()) return;
    if(QZD.ui && QZD.ui.toast) QZD.ui.toast(txt);
  }
  function log(txt){ if(QZD.stateIO && QZD.stateIO.pushLog) QZD.stateIO.pushLog('dynasty', txt); }

  /* 自动生一条灾异奏折（带去重：同一次 omen 危机只生成一次） */
  function raiseOmens(){
    var d = S();
    if(QZD.state.__omenMemorialId) return;
    var M = (CFG.EVENTS && CFG.EVENTS.omen && CFG.EVENTS.omen.memorial) || null;
    if(!M || !QZD.memorials || !QZD.memorials.create) return;
    var r = QZD.memorials.create({
      title: M.title || '修省弭灾疏', tag: M.tag || 'important',
      priority: M.priority || 'urgent',
      note: '钦天监因天象微异所上，御案自动生成。批阅它即是「修省」。'
    });
    if(r && r.ok && r.memorial) QZD.state.__omenMemorialId = r.memorial.id;
  }

  /* 分级事件：只在「下降」到新级别时触发未触发过的级别 */
  function fireDown(fromIdx, toIdx){
    var d = S();
    /* 从浅到深，逐级触发 to 及之间尚未触发的级别 */
    for(var i = 1; i <= toIdx; i++){
      var id = LEVELS[i] && LEVELS[i].id;
      if(!id) continue;
      if(d.fired.indexOf(id) >= 0) continue;
      d.fired.push(id);
      var ev = (CFG.EVENTS || {})[id] || {};
      if(ev.log) log(ev.log);
      if(id === 'omen') raiseOmens();
      if(ev.toast) toast(ev.toast);
    }
  }

  /* 回归到安定：F3 拨乱反正（一次性，每个危机周期一次）
     只有本次危机到过 rewardWorthy 级别（默认 omen）才发资源；浅危机只写叙事。 */
  function tryRestore(){
    var d = S();
    if(!d.wasCrisis) return false;
    if(d.stability < (CFG.CALM_LINE || 80)) return false;
    var worthy = rewardWorthy(d.deepestLevel || d.level);
    d.wasCrisis = false;
    d.fired = [];
    d.deepestLevel = 'calm';
    delete QZD.state.__omenMemorialId;
    d.restoredAt = Date.now();
    if(worthy){
      var reward = CFG.RESTORE_REWARD || {};
      if(QZD.resources && QZD.resources.add) QZD.resources.add(reward);
      if(CFG.RESTORE_LOG) log(CFG.RESTORE_LOG);
      toast(CFG.RESTORE_TOAST || '拨乱反正 · 四海复安');
    }else{
      /* 浅危机回归：人心回稳，但无国难可「拨乱反正」，不发资源 */
      if(CFG.SHALLOW_RESTORE_LOG) log(CFG.SHALLOW_RESTORE_LOG);
      toast(CFG.SHALLOW_RESTORE_TOAST || '朝议渐息');
    }
    return true;
  }

  /* 统一改安定度：改完做级别判定与事件/回归 */
  function applyDelta(delta){
    var d = S(), before = clamp(d.stability);
    var after = clamp(before + delta);
    d.stability = Math.round(after * 100) / 100;
    var newId = levelOf(d.stability);
    var newIdx = levelIndex(newId), oldIdx = levelIndex(d.level);
    if(isCrisis(newId)){
      if(!d.wasCrisis) d.wasCrisis = true;
      /* 记录本次危机周期到达过的最深级别（只往深处刷新，回升不覆盖） */
      if(newIdx > levelIndex(d.deepestLevel)) d.deepestLevel = newId;
    }
    if(newIdx > oldIdx) fireDown(oldIdx, newIdx);   /* 下降：触发分级事件 */
    d.level = newId;
    if(newIdx <= levelIndex('calm')) tryRestore();  /* 回到海晏河清：拨乱反正 */
    return { before: before, after: d.stability, level: newId, delta: delta };
  }

  /* F1 日结算：缺席缓降 / 危机中当日有勤政则自然回补。每日只跑一次。 */
  function settle(){
    var d = S(), t = today();
    if(d.lastSettledDate === t) return { ok: false, reason: '今日已结算' };
    var first = !d.lastSettledDate;
    var gap = dayGap(d.lastSettledDate, t);
    d.lastSettledDate = t;
    var hadDeeds = hasDeedsToday();
    var delta = 0;
    if(!first && gap > (CFG.DECAY_GRACE_DAYS || 1)){
      var days = gap - (CFG.DECAY_GRACE_DAYS || 1);
      delta -= days * (CFG.IDLE_DECAY_PER_DAY || 6);
      d.crisisDays += days;
    }else if(!first && hadDeeds && isCrisis(d.level)){
      delta += CFG.CRISIS_RECOVER || 4;   /* 危机中回来勤政：温和回升 */
    }
    var r = applyDelta(delta);
    QZD.stateIO.save();
    return { ok: true, first: first, gap: gap, hadDeeds: hadDeeds, delta: delta, level: r.level };
  }

  /* 当日是否有任何勤政记录（专注分钟 / 打卡 / 办结奏折） */
  function hasDeedsToday(){
    var t = today(), st = QZD.state;
    if(st.study && st.study.date === t && (st.study.doneMin || 0) > 0) return true;
    if(st.checkin && st.checkin.date === t && (st.checkin.goals || []).length) return true;
    if(Array.isArray(st.memorials)){
      for(var i = 0; i < st.memorials.length; i++){
        var m = st.memorials[i];
        if(m && m.status === 'banjie' && m.finishedAt &&
           new Date(m.finishedAt).toDateString() === new Date().toDateString()) return true;
      }
    }
    return false;
  }

  /* 专注收工回补：按分钟，带单场上限 */
  function onFocusEnd(minutes){
    var min = Math.max(0, minutes || 0);
    var gain = Math.min((CFG.FOCUS_GAIN_CAP || 10), min * (CFG.FOCUS_GAIN_PER_MIN || 0.25));
    if(gain <= 0) return { ok: false };
    var r = applyDelta(gain);
    QZD.stateIO.save();
    return { ok: true, gain: r.delta, level: r.level };
  }
  /* 当日打卡全完成回补（由 tick 跨日归档前调用，或每日一次） */
  function onCheckinDone(){
    var d = S();
    var key = 'dynasty_checkin_' + today();
    if(QZD.state[key]) return { ok: false };
    QZD.state[key] = true;
    var r = applyDelta(CFG.CHECKIN_GAIN || 3);
    QZD.stateIO.save();
    return { ok: true, gain: r.delta, level: r.level };
  }
  /* 办结一封奏折回补 */
  function onMemorialDone(){
    var r = applyDelta(CFG.MEMORIAL_GAIN || 2);
    QZD.stateIO.save();
    return { ok: true, gain: r.delta, level: r.level };
  }

  /* 只读视图：给顶栏 / 总览横幅用 */
  function view(){
    var d = S();
    return {
      stability: d.stability, level: d.level, name: levelName(d.level),
      isCrisis: isCrisis(d.level), wasCrisis: d.wasCrisis,
      deepestLevel: d.deepestLevel, rewardWorthy: rewardWorthy(d.deepestLevel),
      crisisDays: d.crisisDays, fired: d.fired.slice()
    };
  }

  /* 开机：先日结算（缺席缓降），不弹模态窗，只用 toast */
  function onLaunch(){ return settle(); }

  QZD.dynasty = {
    onLaunch: onLaunch, settle: settle,
    onFocusEnd: onFocusEnd, onCheckinDone: onCheckinDone, onMemorialDone: onMemorialDone,
    view: view, levelOf: levelOf, levelName: levelName,
    state: S, applyDelta: applyDelta   /* applyDelta 暴露给测试确定性覆盖 */
  };
})();
