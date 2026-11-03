/* ============================================================
   systems/plan.js · 本周三事 + 专注进展流水
   - 本周三事：每周一自动换页，最多 3 条，可勾完成
   - 进展流水：每次专注收工顺手记一句「这次做了什么」，
     供周报「完成事项 / 本周进展」使用
   ============================================================ */
(function(){
  var IO = QZD.stateIO;

  function st(){ return QZD.state; }
  function P(){
    if(!st().plan || typeof st().plan !== 'object') st().plan = {};
    var p = st().plan;
    if(typeof p.weekKey !== 'string') p.weekKey = '';
    if(!Array.isArray(p.goals)) p.goals = [];
    if(!Array.isArray(p.progress)) p.progress = [];
    if(!Array.isArray(p.nextGoals)) p.nextGoals = [];
    return p;
  }
  function ds(d){ return IO.todayStr(d); }
  function mondayOf(d){
    var x = new Date(d.getTime()); x.setHours(0, 0, 0, 0);
    var day = (x.getDay() + 6) % 7;          /* 周一 = 0 */
    x.setDate(x.getDate() - day);
    return x;
  }
  function weekKey(){ return ds(mondayOf(new Date())); }

  /* 跨周自动换页：清空本周目标；若上周预留了「下周三事」则自动接上 */
  function ensureWeek(){
    var p = P(), wk = weekKey();
    if(p.weekKey !== wk){
      p.weekKey = wk;
      if(p.nextGoals.length){
        p.goals = p.nextGoals.map(function(t, i){
          return { id: 'wg' + Date.now().toString(36) + i, text: String(t).slice(0, 60), done: false };
        });
        p.nextGoals = [];
      }else{
        p.goals = [];
      }
      IO.save();
    }
    return p;
  }

  function goals(){ return ensureWeek().goals; }

  function setGoals(texts){
    var p = ensureWeek();
    var list = (texts || []).map(function(t){ return String(t || '').trim(); }).filter(Boolean).slice(0, 3);
    if(!list.length) return { ok: false, error: '至少填写一件事' };
    p.goals = list.map(function(t, i){
      return { id: 'wg' + Date.now().toString(36) + i, text: t.slice(0, 60), done: false };
    });
    IO.save();
    return { ok: true, goals: p.goals };
  }

  /* 预留下周三事：换周时自动接上（周报「采纳建议」用） */
  function setNextGoals(texts){
    var p = P();
    var list = (texts || []).map(function(t){ return String(t || '').trim(); }).filter(Boolean).slice(0, 3);
    if(!list.length) return { ok: false, error: '没有可采纳的建议' };
    p.nextGoals = list;
    IO.save();
    return { ok: true, goals: list };
  }
  function nextGoals(){ return P().nextGoals.slice(); }

  function clearGoals(){
    var p = ensureWeek();
    p.goals = [];
    IO.save();
    return { ok: true };
  }

  function toggleGoal(id){
    var p = ensureWeek();
    for(var i = 0; i < p.goals.length; i++){
      if(p.goals[i].id !== id) continue;
      p.goals[i].done = !p.goals[i].done;
      IO.save();
      return { ok: true, goal: p.goals[i] };
    }
    return { ok: false, error: '目标不存在' };
  }

  /* 记一条专注进展（专注收工后调用） */
  function addProgress(o){
    o = o || {};
    var text = String(o.text || '').trim().slice(0, 200);
    if(!text) return { ok: false, error: '请填写本次进展' };
    var p = P();
    p.progress.push({
      at: Date.now(),
      text: text,
      minutes: Math.round((Number(o.minutes) || 0) * 10) / 10,
      memorialId: o.memorialId || null,
      subjectId: o.subjectId || null,
      title: String(o.title || '').slice(0, 60)
    });
    while(p.progress.length > 200) p.progress.shift();
    IO.save();
    return { ok: true };
  }

  /* 最近 n 天进展（新→旧） */
  function recent(days){
    var n = Number(days) || 7;
    var from = Date.now() - n * 86400000;
    return P().progress.filter(function(x){ return x.at >= from; })
      .sort(function(a, b){ return b.at - a.at; });
  }

  QZD.plan = {
    weekKey: weekKey,
    goals: goals,
    setGoals: setGoals,
    setNextGoals: setNextGoals,
    nextGoals: nextGoals,
    clearGoals: clearGoals,
    toggleGoal: toggleGoal,
    addProgress: addProgress,
    progress: function(){ return P().progress; },
    recent: recent
  };
})();
