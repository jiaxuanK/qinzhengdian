/* ============================================================
   systems/dynasty.js · 11-19 国运系统（原 F1/F2/F3 温和国势的升级版）
   - 安定度 0–80 系、无上下限（可为负、可 >80），取消旧 MIN/MAX 钳制
   - 11-21 校准：每日分档改为五档(未登录/零专注/<2h/2h~8h/达标)，回补削弱，
     让"每天工作很少"也能在一代7天内走完亡国→复国。数值全在 config.DYNASTY.DAILY_TIERS。
   - 各级惩罚叠加：持续型比例(战力/贡赋/回补) + 周期型资源罚(每12h，停留越久罚越多)
   - 潜邸(安定<10)：帝阶归零 + 持续侵略 + 掳妃(按位分递进，保底留1)
   - 复国：安定回 80 光复，属地归还 + 复国库银，每代限一次奖励
   - 代价照给但路永远留着：不删档、资源有保底、勤政即可复国
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
    /* 11-19 新字段 */
    if(typeof d.lastLoginDate !== 'string') d.lastLoginDate = '';
    if(typeof d.lastDeedDate !== 'string') d.lastDeedDate = '';
    if(typeof d.lastPenaltyAt !== 'number') d.lastPenaltyAt = 0;
    if(typeof d.noDeedDays !== 'number') d.noDeedDays = 0;
    if(typeof d.restoredGen !== 'number') d.restoredGen = 0;
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
  /* 11-19：取消上下限，只保证数值合法（安定可为负、可 >80） */
  function clamp(v){
    v = Number(v);
    return isFinite(v) ? Math.round(v * 100) / 100 : (CFG.INITIAL || 80);
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
    /* 11-19 每代限一次光复资源奖励：已领过则只写叙事不再发钱 */
    var gen = (QZD.state.regime && QZD.state.regime.generation) || 1;
    var already = (d.restoredGen === gen);
    if(already) worthy = false;
    d.wasCrisis = false;
    d.fired = [];
    d.deepestLevel = 'calm';
    delete QZD.state.__omenMemorialId;
    d.restoredAt = Date.now();
    if(worthy){
      d.restoredGen = gen;
      var reward = CFG.RESTORE_REWARD || {};
      if(QZD.resources && QZD.resources.add) QZD.resources.add(reward);
      if(CFG.RESTORE_LOG) log(CFG.RESTORE_LOG);
      toast(CFG.RESTORE_TOAST || '拨乱反正 · 四海复安');
    }else{
      /* 浅危机回归：人心回稳，但无国难可「拨乱反正」，不发资源 */
      if(CFG.SHALLOW_RESTORE_LOG) log(CFG.SHALLOW_RESTORE_LOG);
      toast(CFG.SHALLOW_RESTORE_TOAST || '朝议渐息');
    }
    /* 御极纪：拨乱反正比普通跨级更值得记一章 */
    if(QZD.emperorStory)
      QZD.emperorStory.onEvent('restore', { level: d.level, worthy: worthy });
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
    /* 御极纪：安定跨级才讲一段，不把每天的微小涨跌都变成弹窗 */
    if(QZD.emperorStory && newId !== oldId)
      QZD.emperorStory.onEvent('stability', {
        before: before, after: d.stability, level: newId, delta: delta
      });
    /* 11-19 首次跌入潜邸：帝阶归零（一次性，交给 regime 系统；未建时跳过） */
    if(newId === 'refuge' && oldIdx < levelIndex('refuge') && d.levelEnteredRefuge !== true){
      d.levelEnteredRefuge = true;
      if(QZD.regime && QZD.regime.onFall) QZD.regime.onFall();
    }
    if(newId !== 'refuge') d.levelEnteredRefuge = false;  /* 离开潜邸，下次可再触发 */
    if(newIdx <= levelIndex('calm')) tryRestore();  /* 回到海晏河清：拨乱反正 */
    return { before: before, after: d.stability, level: newId, delta: delta };
  }

  /* 11-21 每日表现分档：按当天"登录/专注/打卡"三维定档，数值从 DAILY_TIERS 读。
     五档：absent/idle/verylow(<2h)/low(2h~目标)/partial(达标没打卡全)/full(全达标)。
     目的：让"每天工作很少"也能在一代7天内走完亡国→复国（旧值太温和永不亡国）。 */
  function tierDelta(key){
    var list = CFG.DAILY_TIERS || [];
    for(var i = 0; i < list.length; i++) if(list[i] && list[i].key === key) return list[i].delta;
    return 0;
  }
  function todayTier(){
    var st = QZD.state, d = S(), t = today();
    var focusMin = (st.study && st.study.date === t) ? (st.study.doneMin || 0) : 0;
    /* 11-21：恢复「工作日10h + 周末8h = 66h/周」，按当天取目标。
       state.__testWeekend 仅供测试固定口径，正常游戏不设。 */
    var SC = QZD.config.STUDY || {};
    var dow = new Date().getDay();
    var isWeekend = (typeof st.__testWeekend === 'boolean')
      ? st.__testWeekend : (dow === 0 || dow === 6);
    var target = isWeekend ? (SC.WEEKEND_TARGET_MIN || 480) : (SC.DAILY_TARGET_MIN || 600);
    var veryLowLine = CFG.VERYLOW_LINE_MIN || 120;
    /* 今日登录以「登录打卡」为准（state.login.lastDate），旧档/测试桩退回 dynasty.lastLoginDate */
    var loggedIn = (st.login && typeof st.login.lastDate === 'string')
      ? (st.login.lastDate === t)
      : (d.lastLoginDate === t);
    var focusMet = focusMin >= target;
    var exceptionalLine = target * (CFG.EXCEPTIONAL_MULT || 1.5);
    var ck = (QZD.checkin && QZD.checkin.todayStat) ? QZD.checkin.todayStat() : { total:0, allDone:false };
    var ckAll = ck.total > 0 && ck.allDone;
    function tier(k){ return { key:k, delta:tierDelta(k) }; }
    if(!loggedIn && !hasDeedsToday()) return tier('absent');
    if(!focusMin) return tier('idle');
    if(focusMin < veryLowLine) return tier('verylow');
    if(!focusMet) return tier('low');
    if(ckAll && focusMin >= exceptionalLine) return tier('exceptional'); /* 超额：≥1.5倍日目标 */
    return ckAll ? tier('full') : tier('partial');
  }

  /* 11-19 周期罚：资源损失类每 12h 判定一次，停留越久罚越多。
     只罚当前级及更浅级对应的资源项（叠加），回升到更高级即停。 */
  function applyPeriodPenalty(){
    var d = S(), now = Date.now();
    var interval = (CFG.PENALTY_INTERVAL_HOURS || 12) * 3600 * 1000;
    if(d.lastPenaltyAt && now - d.lastPenaltyAt < interval) return { ran:false };
    d.lastPenaltyAt = now;
    var idx = levelIndex(d.level), P = CFG.PENALTY || {};
    var floor = CFG.FLOOR || { jinQian:100, guoJin:30 };
    var effects = [];
    /* 各级资源罚叠加（跌得越深，idx 越大，触发越多） */
    if(idx >= levelIndex('omen'))   effects.push({ res:'jinQian', pct:(P.OMEN||{}).jinPctPer12h || 0.08, name:'灾异耗国库' });
    if(idx >= levelIndex('border')){
      effects.push({ res:'guoJin', pct:(P.BORDER||{}).guoPctPer12h || 0.10, name:'边患耗国力' });
      /* 首次失地：交给上层 conquest 接线（此处只记标志，P6 接线） */
    }
    if(idx >= levelIndex('refuge')){
      effects.push({ res:'jinQian', pct:(P.REFUGE||{}).raidPctPer12h || 0.08, name:'潜邸掠国库' });
      effects.push({ res:'guoJin',  pct:(P.REFUGE||{}).raidPctPer12h || 0.08, name:'潜邸掠国力' });
    }
    if(!effects.length) return { ran:true, effects:[] };
    var take = { jinQian:0, guoJin:0 };
    effects.forEach(function(e){ take[e.res] += (QZD.state.resources[e.res] || 0) * e.pct; });
    /* 保底：扣后不低于 floor */
    var before = { jinQian:QZD.state.resources.jinQian, guoJin:QZD.state.resources.guoJin };
    var actual = {
      jinQian: Math.min(take.jinQian, Math.max(0, before.jinQian - (floor.jinQian||0))),
      guoJin:  Math.min(take.guoJin,  Math.max(0, before.guoJin  - (floor.guoJin||0)))
    };
    if(actual.jinQian || actual.guoJin){
      QZD.resources.remove(actual);
      log('国势·周期罚 · 国库 −' + Math.round(actual.jinQian) + ' · 国力 −' + Math.round(actual.guoJin));
    }
    /* 潜邸掳妃：每连续 2 个无勤政日掳 1 位（保底留 1）；交给 regime 系统处理 */
    if(idx >= levelIndex('refuge') && d.noDeedDays >= ((P.REFUGE||{}).hostageEveryNoDeedDays || 2)){
      if(QZD.regime && QZD.regime.takeHostage) QZD.regime.takeHostage();
      d.noDeedDays = 0;
    }
    return { ran:true, effects:effects, actual:actual };
  }

  /* 11-19 日结算：每日只跑一次；按表现分档扣安定 + 周期资源罚。
     弃坑多天后首次开机：中间 gap-1 天完全没登录，按 absent(-12/天)补扣，
     今天按当天表现分档。避免"开机即登录"把缺席天数吞掉。 */
  function settle(){
    var d = S(), t = today();
    if(d.lastSettledDate === t) return { ok:false, reason:'今日已结算' };
    var first = !d.lastSettledDate;
    var gap = dayGap(d.lastSettledDate, t);
    var hadDeeds = hasDeedsToday();
    /* 中间完全没登录的天数（首次结算的旧档不追溯） */
    var missedDays = first ? 0 : Math.max(0, gap - 1);
    var totalDelta = 0, tierKey;
    if(first){
      tierKey = 'full'; totalDelta = 0;               /* 旧档首次不追溯惩罚 */
    }else{
      if(missedDays > 0){
        totalDelta += missedDays * tierDelta('absent'); /* 缺席档：按 config 的 absent delta/天 */
        tierKey = 'absent×' + missedDays;
      }
      d.lastLoginDate = t;                             /* 今天登录：todayTier 前设，避免今天被误判缺席 */
      var todayT = todayTier();
      totalDelta += todayT.delta;
      tierKey = tierKey ? (tierKey + '+' + todayT.key) : todayT.key;
    }
    d.lastSettledDate = t;
    if(!first){
      if(hadDeeds) d.noDeedDays = 0;
      else d.noDeedDays = (d.noDeedDays || 0) + 1 + missedDays;
    }
    var r = applyDelta(totalDelta);
    var pen = applyPeriodPenalty();
    /* 11-21 超额成就：当日达 exceptional 档，记起居注 + toast（每代不重复刷屏，按日期去重） */
    if(!first && tierKey === 'exceptional'){
      log('今日勤政倍于常课，龙精虎猛。安定度大涨，朝野称颂。');
      toast('勤政卓异 · 超额达标 · 安定 +' + tierDelta('exceptional'));
    }
    QZD.stateIO.save();
    return { ok:true, first:first, tier:tierKey, hadDeeds:hadDeeds,
      delta:r.delta, level:r.level, penalty:pen, gap:gap, missedDays:missedDays };
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

  /* 即时回补缩放：忧色级(含更深) 回补 −25%（持续型 debuff，叠加） */
  function gainScale(){
    var P = CFG.PENALTY || {}, idx = levelIndex(S().level);
    return idx >= levelIndex('mourn') ? (1 - ((P.MOURN||{}).gainPct || 0.25)) : 1;
  }
  /* 即时回补：focus 与 memorial 各自独立封顶账本，互不挤占 */
  function addImmediate(amount, capKey){
    var key = 'dynasty_gain_' + capKey + '_' + today();
    if(!QZD.state[key] || QZD.state[key].date !== today()) QZD.state[key] = { date:today(), used:0 };
    var cap = (capKey === 'memorial') ? (CFG.MEMORIAL_GAIN_CAP || 6) : (CFG.FOCUS_GAIN_CAP || 12);
    var left = Math.max(0, cap - QZD.state[key].used);
    var gain = Math.min(left, amount) * gainScale();
    if(gain > 0){
      QZD.state[key].used += gain / (gainScale() || 1);
      applyDelta(gain);
    }
    return gain;
  }
  /* 专注收工回补：按分钟线性、每日封顶 +12；与每日分档取其一（分档在 settle 记） */
  function onFocusEnd(minutes){
    var min = Math.max(0, minutes || 0);
    var gain = addImmediate(min * (CFG.FOCUS_GAIN_PER_MIN || 0.4), 'focus');
    QZD.stateIO.save();
    return gain > 0 ? { ok:true, gain:gain, level:S().level } : { ok:false };
  }
  /* 打卡全完成：不再单独即时回补（已并入 settle 的 +10 档），仅保留兼容返回值 */
  function onCheckinDone(){ return { ok:true, note:'已从属每日分档' }; }
  /* 办结一封奏折回补：+2/封，每日封顶 +6 */
  function onMemorialDone(){
    var gain = addImmediate(CFG.MEMORIAL_GAIN || 2, 'memorial');
    QZD.stateIO.save();
    return { ok:true, gain:gain, level:S().level };
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
