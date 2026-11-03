/* ============================================================
   systems/works.js · M5 内政营造
   六项工程逐级营造：耗金钱与国力，换来每分钟产出与加成
   产出按真实时间结算，离线补算封顶 8 小时
   ============================================================ */
(function(){
  var CFG = QZD.config;
  var W = CFG.WORKS;

  function state(){ return QZD.state; }

  function works(){
    if(!QZD.state.works || typeof QZD.state.works !== 'object') QZD.state.works = {};
    var w = QZD.state.works;
    if(!w.levels || typeof w.levels !== 'object') w.levels = {};
    if(!w.lastAt) w.lastAt = Date.now();
    return w;
  }

  function itemById(id){
    for(var i = 0; i < W.ITEMS.length; i++){
      if(W.ITEMS[i].id === id) return W.ITEMS[i];
    }
    return null;
  }

  function levelOf(id){
    return works().levels[id] || 0;
  }

  function costOf(id){
    var item = itemById(id);
    return item ? QZD.formulas.worksCost(item) : { jinQian: 0, guoJin: 0 };
  }

  function canBuild(id){
    var item = itemById(id);
    if(!item) return { ok: false, reason: '工程不存在' };
    if(levelOf(id) >= W.MAX_LEVEL) return { ok: false, reason: '已至最高等级' };

    var cost = costOf(id);
    var res = state().resources;
    if((res.jinQian || 0) + 1e-9 < cost.jinQian){
      return { ok: false, reason: '金钱不足（需 ' + cost.jinQian + '）', cost: cost };
    }
    if((res.guoJin || 0) + 1e-9 < cost.guoJin){
      return { ok: false, reason: '国力不足（需 ' + cost.guoJin + '）', cost: cost };
    }
    return { ok: true, cost: cost, item: item, level: levelOf(id) };
  }

  function build(id){
    var check = canBuild(id);
    if(!check.ok) return { ok: false, error: check.reason };

    QZD.resources.remove(check.cost);
    var level = levelOf(id) + 1;
    works().levels[id] = level;

    QZD.stateIO.pushLog('works', '营造「' + check.item.name + '」· 升至 ' + level +
      ' 级 · 耗金钱 ' + check.cost.jinQian + ' · 国力 ' + check.cost.guoJin);
    QZD.stateIO.save();
    return { ok: true, item: check.item, level: level, cost: check.cost };
  }

  /* 每秒结算营造产出；span 超过离线上限的部分丢弃 */
  function settle(now){
    now = now || Date.now();
    var w = works();
    if(!w.lastAt || w.lastAt > now) w.lastAt = now;

    /* 营造产出同样只在勤政期间入账，避免挂机收益 */
    if(!QZD.pomodoro || !QZD.pomodoro.isActive()){
      w.lastAt = now;
      return { jinQian: 0, guoJin: 0 };
    }

    var span = now - w.lastAt;
    if(span < 1000) return { jinQian: 0, guoJin: 0 };

    var capMs = W.OFFLINE_CAP_HOURS * 3600 * 1000;
    var eff = Math.min(span, capMs);
    w.lastAt = now;

    var per = QZD.formulas.worksPerMinute();
    var gained = {
      jinQian: per.jinQian * eff / 60000,
      guoJin: per.guoJin * eff / 60000
    };
    QZD.resources.add(gained);
    return gained;
  }

  function fmtDec(n){ return (Math.round((n || 0) * 10) / 10).toFixed(1); }

  /* 启动补算：关闭期间营造产出按真实时间入账 */
  function restore(){
    var gained = settle(Date.now());
    if(gained.jinQian + gained.guoJin > 0){
      QZD.stateIO.pushLog('works', '营造产出入账 · 金钱 +' + fmtDec(gained.jinQian) +
        ' · 国力 +' + fmtDec(gained.guoJin));
      QZD.stateIO.save();
      return gained;
    }
    return null;
  }

  function totalLevels(){
    var levels = works().levels;
    var sum = 0;
    for(var k in levels){
      if(levels.hasOwnProperty(k)) sum += levels[k] || 0;
    }
    return sum;
  }

  QZD.works = {
    items: function(){ return W.ITEMS; },
    itemById: itemById,
    levelOf: levelOf,
    costOf: costOf,
    canBuild: canBuild,
    build: build,
    settle: settle,
    restore: restore,
    totalLevels: totalLevels,
    maxLevel: W.MAX_LEVEL,
    perMinute: function(){ return QZD.formulas.worksPerMinute(); },
    tributeBonus: function(){ return QZD.formulas.worksTributeBonus(); },
    powerBonus: function(){ return QZD.formulas.worksPowerBonus(); }
  };
})();
