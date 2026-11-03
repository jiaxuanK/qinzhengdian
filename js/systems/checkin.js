/* ============================================================
   systems/checkin.js · 每日打卡小目标
   - 目标由用户自建（早睡 / 运动 / 读书…）
   - 三档评判：0 未完成 / 1 完成一半 / 2 完成
   - 资源按档位差额即时结算（升档补发、降档回收，不会重复发钱）
   - history 存每日得分，供热力图周/月/年视图使用
   ============================================================ */
(function(){
  var CFG = QZD.config;
  var C = CFG.CHECKIN || {};
  var LEVELS = C.LEVELS || [
    { value: 0, key: 'none', name: '未完成', ratio: 0,   cls: 'lv-none' },
    { value: 1, key: 'half', name: '一半',   ratio: 0.5, cls: 'lv-half' },
    { value: 2, key: 'done', name: '完成',   ratio: 1,   cls: 'lv-done' }
  ];

  function ck(){
    var s = QZD.state;
    if(!s.checkin || typeof s.checkin !== 'object') s.checkin = { date: todayStr(), goals: [], history: {}, buff: null };
    if(!Array.isArray(s.checkin.goals)) s.checkin.goals = [];
    if(!s.checkin.history || typeof s.checkin.history !== 'object') s.checkin.history = {};
    return s.checkin;
  }
  function todayStr(){ return QZD.stateIO.todayStr(); }
  function goals(){ return ck().goals; }

  function levelOf(v){
    for(var i = 0; i < LEVELS.length; i++){
      if(LEVELS[i].value === v) return LEVELS[i];
    }
    return LEVELS[0];
  }
  function levelMeta(v){ return levelOf(v); }

  /* 单个目标在某档位的奖励（向下取整，避免小数资源） */
  function rewardOf(level){
    var ratio = levelOf(level).ratio;
    var base = C.GOAL_REWARD || { qinZheng: 0, jinQian: 0, guoJin: 0 };
    var out = {};
    Object.keys(base).forEach(function(k){
      out[k] = Math.floor((base[k] || 0) * ratio);
    });
    return { ratio: ratio, gain: out };
  }

  function uid(){
    return 'g' + Date.now().toString(36) + Math.floor(Math.random() * 1000).toString(36);
  }

  function addGoal(title){
    var t = String(title || '').trim().slice(0, C.TITLE_MAX || 16);
    if(!t) return { ok: false, error: '请填写目标名称' };
    var list = goals();
    if(list.length >= (C.MAX_GOALS || 12)) return { ok: false, error: '今日目标已达上限（' + (C.MAX_GOALS || 12) + '）' };
    var lower = t.toLowerCase();
    for(var i = 0; i < list.length; i++){
      if(String(list[i].title).toLowerCase() === lower) return { ok: false, error: '已有同名目标' };
    }
    var g = { id: uid(), title: t, level: 0, granted: 0, createdAt: Date.now() };
    list.push(g);
    QZD.stateIO.pushLog('checkin', '立下今日目标 · ' + t);
    QZD.stateIO.save();
    return { ok: true, goal: g };
  }

  function removeGoal(id){
    var list = goals();
    for(var i = 0; i < list.length; i++){
      if(list[i].id !== id) continue;
      var g = list[i];
      /* 已发放的奖励按比例回收，避免删目标白拿资源 */
      if(g.granted > 0){
        var back = rewardOf(0);
        var had = rewardOf(g.granted === 1 ? 1 : 2);
        back.gain = had.gain;
        QZD.resources.remove(back.gain);
      }
      list.splice(i, 1);
      QZD.stateIO.pushLog('checkin', '撤下目标 · ' + g.title);
      QZD.stateIO.save();
      return { ok: true };
    }
    return { ok: false, error: '目标不存在' };
  }

  /* 三档切换：按差额结算，升档补发、降档回收 */
  function setLevel(id, level){
    level = (level === 1 || level === 2) ? level : 0;
    var list = goals();
    for(var i = 0; i < list.length; i++){
      if(list[i].id !== id) continue;
      var g = list[i];
      var next = rewardOf(level);
      var prev = rewardOf(g.granted || 0);
      var delta = {};
      var keys = Object.keys(next.gain);
      for(var k = 0; k < keys.length; k++){
        var key = keys[k];
        var d = (next.gain[key] || 0) - (prev.gain[key] || 0);
        if(d) delta[key] = d;
      }
      if(Object.keys(delta).length){
        var pos = {}, neg = {};
        Object.keys(delta).forEach(function(key){
          if(delta[key] > 0) pos[key] = delta[key];
          else neg[key] = -delta[key];
        });
        if(Object.keys(pos).length) QZD.resources.add(pos);
        if(Object.keys(neg).length) QZD.resources.remove(neg);
      }
      g.level = level;
      g.granted = level;
      if(level === 0){
        QZD.stateIO.pushLog('checkin', g.title + ' · 未完成');
      }else if(level === 1){
        QZD.stateIO.pushLog('checkin', g.title + ' · 完成一半，赏半');
      }else{
        QZD.stateIO.pushLog('checkin', g.title + ' · 完成，论功行赏');
      }
      QZD.stateIO.save();
      return { ok: true, goal: g, delta: delta };
    }
    return { ok: false, error: '目标不存在' };
  }

  /* 一组目标的完成度统计 */
  function scoreOf(list){
    list = Array.isArray(list) ? list : [];
    var total = list.length, done = 0, half = 0, ratioSum = 0;
    list.forEach(function(g){
      if(!g) return;
      var lv = (g.level === 1 || g.level === 2) ? g.level : 0;
      if(lv === 2) done++;
      else if(lv === 1) half++;
      ratioSum += levelOf(lv).ratio;
    });
    var score = total ? Math.round(ratioSum / total * 100) : 0;
    return { total: total, done: done, half: half, ratioSum: ratioSum, score: score };
  }

  function todayStat(){
    var st = scoreOf(goals());
    st.allDone = st.total > 0 && st.done === st.total;
    return st;
  }

  /* 归档某天：写入 history（热力图数据源） */
  function archiveDay(date, list, history){
    if(!date) return null;
    var st = scoreOf(list || []);
    var rec = { total: st.total, done: st.done, half: st.half, score: st.score };
    if(history) history[date] = rec;
    return rec;
  }

  /* 历史某天（缺省返回空记录） */
  function dayOf(date){
    var h = ck().history;
    return h[date] || { total: 0, done: 0, half: 0, score: 0 };
  }

  /* 所有有记录的日子（升序） */
  function historyKeys(){
    return Object.keys(ck().history).sort();
  }

  /* 今日目标未全部完成 → 消费 ×2（无目标不罚） */
  function multiplier(){
    var st = todayStat();
    if(!st.total) return 1;
    if(st.allDone) return 1;
    var ST = CFG.STUDY || {};
    return ST.PENALTY_MULT || 2;
  }

  /* 今日目标全部完成 → 当日征伐战力加成 */
  function buffValue(){
    var c = ck();
    /* 跨日自动失效：只有 date 为今天才生效 */
    if(c.date !== todayStr()) return 0;
    var st = todayStat();
    return st.allDone ? (C.ALL_DONE_BUFF || 0) : 0;
  }

  QZD.checkin = {
    LEVELS: LEVELS,
    PRESETS: C.PRESETS || [],
    list: goals,
    levelMeta: levelMeta,
    rewardOf: rewardOf,
    addGoal: addGoal,
    removeGoal: removeGoal,
    setLevel: setLevel,
    scoreOf: scoreOf,
    todayStat: todayStat,
    archiveDay: archiveDay,
    dayOf: dayOf,
    historyKeys: historyKeys,
    multiplier: multiplier,
    buffValue: buffValue
  };
})();
