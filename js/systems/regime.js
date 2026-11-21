/* ============================================================
   systems/regime.js · 11-19 帝阶升级流（P2）
   - 唯一条件：本代累计专注分钟；各阶只是门槛不同
   - 累计专注升级时不清零；仅亡国 / 传代归零重爬
   - 每升一阶 +3 迎回名额（迎回消耗在 P3）
   - 旧档 focusMin 首次从 study.history 汇总补算
   遵守：帝阶只看专注，不掺入克城/光复等异质条件
   ============================================================ */
(function(){
  var C = QZD.config, R = C.REGIME || {};
  var RANKS = R.RANKS || [];

  function S(){
    var st = QZD.state;
    if(!st.regime || typeof st.regime !== 'object') st.regime = {};
    var g = st.regime;
    if(typeof g.generation !== 'number' || g.generation < 1) g.generation = 1;
    if(typeof g.rank !== 'number' || g.rank < 1) g.rank = 1;
    if(typeof g.focusMin !== 'number' || !isFinite(g.focusMin) || g.focusMin < 0){
      g.focusMin = backfillFocus();     /* 旧档从历史专注补算 */
    }
    if(typeof g.hostageSlots !== 'number' || g.hostageSlots < 0) g.hostageSlots = 0;
    if(typeof g.fallCount !== 'number' || g.fallCount < 0) g.fallCount = 0;
    if(!Array.isArray(g.hostages)) g.hostages = [];
    if(typeof g.bestRank !== 'number' || g.bestRank < 1) g.bestRank = g.rank;
    if(typeof g.restoreCount !== 'number' || g.restoreCount < 0) g.restoreCount = 0;
    if(typeof g.weekKey !== 'string') g.weekKey = '';
    if(typeof g.generationStart !== 'string' || !g.generationStart) g.generationStart = QZD.stateIO.todayStr();
    return g;
  }

  /* 旧档：从 study.history（每日专注分钟）汇总本代可追溯专注。
     只取最近 CYCLE_DAYS 天，作为"本代"合理近似；无记录返回 0。 */
  function backfillFocus(){
    var st = QZD.state, h = (st.study && st.study.history) || {};
    var days = R.CYCLE_DAYS || 7, sum = 0, now = Date.now();
    for(var i = 0; i < days; i++){
      var d = new Date(now - i * 86400000);
      var key = d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
      var v = h[key];
      if(typeof v === 'number' && isFinite(v)) sum += v;
    }
    return Math.max(0, Math.round(sum));
  }

  /* 由累计专注分钟算帝阶序号（1-based），返回 RANKS 索引+1 */
  function rankOf(focusMin){
    var min = Math.max(0, Number(focusMin) || 0), idx = 1;
    for(var i = 0; i < RANKS.length; i++){
      if(min >= (RANKS[i].min || 0)) idx = i + 1;
    }
    return Math.min(idx, RANKS.length || 1);
  }

  function rankDef(rank){
    var r = Math.max(1, Math.min(Number(rank) || 1, RANKS.length || 1));
    return RANKS[r - 1] || RANKS[0] || { id:'sizhi', name:'嗣位之君', min:0, slots:0 };
  }

  /* 专注收工累加（applyMinutes 逐分钟调用）。返回是否发生晋阶。 */
  function addFocus(min){
    var g = S(), add = Math.max(0, Number(min) || 0);
    if(!add) return { ok:false };
    g.focusMin = Math.round((g.focusMin + add) * 100) / 100;
    var newRank = rankOf(g.focusMin);
    var up = newRank > g.rank;
    if(up){
      var oldRank = g.rank;
      g.rank = newRank;
      if(newRank > g.bestRank) g.bestRank = newRank;
      /* 名额：按当前阶应有的累计名额，补足差额（升几阶补几阶的 +3） */
      var wantSlots = rankDef(newRank).slots || ((newRank - 1) * (R.SLOT_PER_RANK || 3));
      if(wantSlots > g.hostageSlots) g.hostageSlots = wantSlots;
      onRankUp(oldRank, newRank);
      QZD.stateIO.save();
      return { ok:true, rankUp:true, from:oldRank, to:newRank, rank:rankDef(newRank) };
    }
    return { ok:true, rankUp:false, rank:rankDef(g.rank) };
  }

  function onRankUp(from, to){
    var d = rankDef(to), name = d.name, slots = g_slots();
    var log = (R.RANK_UP_LOG || '{name}之位既定。').replace('{name}', name);
    var toast = (R.RANK_UP_TOAST || '帝阶晋升 · {name}').replace('{name}', name).replace('{slots}', slots);
    try { QZD.stateIO.pushLog('regime', log); } catch(e){}
    try { QZD.ui.toast(toast); } catch(e){}
    /* 御极纪：帝阶由本代累计专注推进，升阶时讲一段回头路 */
    if(QZD.emperorStory)
      QZD.emperorStory.onEvent('rank', { from: from, to: to });
  }
  function g_slots(){ try { return S().hostageSlots; } catch(e){ return 0; } }

  /* 亡国归零（dynasty.js applyDelta 首次跌入 refuge 时调用） */
  function onFall(){
    var g = S();
    var hadFocus = g.focusMin;
    g.rank = 1;
    g.focusMin = 0;
    g.hostageSlots = 0;
    g.fallCount = (g.fallCount || 0) + 1;
    try { QZD.stateIO.pushLog('regime', R.FALL_LOG || '帝号废黜，一切从头收拾。'); } catch(e){}
    try { QZD.ui.toast(R.FALL_TOAST || '国破 · 帝号废黜'); } catch(e){}
    QZD.stateIO.save();
    return { ok:true, lostFocus:hadFocus, fallCount:g.fallCount };
  }

  /* 周关键：本周一日期（与 plan.js 同口径），跨周即传代（周日 24:00 = 周一 0:00） */
  function weekKey(){
    var x = new Date(); x.setHours(0,0,0,0);
    var day = (x.getDay() + 6) % 7;   /* 周一 = 0 */
    x.setDate(x.getDate() - day);
    return x.getFullYear() + '-' + String(x.getMonth()+1).padStart(2,'0') + '-' + String(x.getDate()).padStart(2,'0');
  }

  /* 庙号史评：按本代成就自动评定（只记功过，不改数值） */
  function epitaph(info){
    var rules = R.EPITAPHS || [], pick = null;
    function match(when){
      if(when === 'bazhu_many_restore') return info.bestRank >= 5 && info.restoreCount >= 2;
      if(when === 'bazhu') return info.bestRank >= 5;
      if(when === 'tuqiang') return info.bestRank >= 4;
      if(when === 'many_fall') return info.fallCount >= 2;
      if(when === 'zhongxing') return info.bestRank >= 3;
      return false;
    }
    for(var i = 0; i < rules.length; i++) if(match(rules[i].when)){ pick = rules[i]; break; }
    if(!pick) pick = { title:'嗣主', text:'守成谨慎，史册留名。' };
    return pick.title + ' · ' + pick.text;
  }

  /* 传代：归档本代入年表 → 周期性外患(和亲质子) → 归零重爬。
     只重置身份，不动 fallCount / 妃子(含质子) / 资源 / 安定。 */
  function resetForNewGen(){
    var g = S(), st = QZD.state;
    /* 1. 归档本代功过入年表（永久保存） */
    var hosted = (g.hostages || []).map(function(h){
      var id = typeof h === 'string' ? h : (h && h.id);
      var c = (st.consorts || []).filter(function(x){ return x && x.id === id; })[0];
      return c ? c.name : '';
    }).filter(Boolean);
    var info = {
      generation: g.generation,
      span: (g.generationStart || '') + ' ~ ' + weekKey(),
      finalRank: rankDef(g.rank).id,
      finalRankName: rankDef(g.rank).name,
      focusMin: Math.round(g.focusMin),
      restoreCount: g.restoreCount || 0,
      fallCount: g.fallCount || 0,
      bestRank: g.bestRank || 1,
      hosted: hosted,
      rescued: [],           /* P4 简化：迎回名单可从起居注追溯，此处留空位 */
      epitaph: ''
    };
    info.epitaph = epitaph(info);
    if(!Array.isArray(st.chronicle)) st.chronicle = [];
    st.chronicle.push(info);

    /* 2. 归零重爬 */
    g.generation = (g.generation || 1) + 1;
    g.rank = 1;
    g.focusMin = 0;
    g.hostageSlots = 0;
    g.bestRank = 1;
    g.restoreCount = 0;
    g.weekKey = weekKey();
    g.generationStart = QZD.stateIO.todayStr();

    /* 3. 周期性外患：满勤用户安定恒满也照样留下"迎回"目标。
       叙事写成和亲/质子（非战败），不扣资源、不降安定。保底留 1 妃。 */
    var periodic = null;
    if(typeof takeHostage === 'function'){
      var before = (g.hostages || []).length;
      periodic = takeHostage();
      if(periodic && periodic.ok){
        var tpl = R.PERIODIC_HOSTAGE_LOG || '{name}赴藩为质。';
        try { QZD.stateIO.pushLog('regime', tpl.replace('{name}', periodic.consort.name)); } catch(e){}
        try { QZD.ui.toast((R.PERIODIC_HOSTAGE_TOAST || '{name}赴藩').replace('{name}', periodic.consort.name)); } catch(e){}
      }
    }
    try { QZD.ui.toast('改元继统 · 第 ' + g.generation + ' 代 · ' + info.epitaph.split(' · ')[0]); } catch(e){}
    QZD.stateIO.save();
    return { ok:true, generation:g.generation, archived:info, periodic:periodic };
  }

  /* 启动检查：跨周则自动传代（幂等） */
  function checkGeneration(){
    var g = S(), wk = weekKey();
    if(!g.weekKey){
      g.weekKey = wk;                 /* 首启/旧档：标记本周，不立即传代 */
      g.generationStart = QZD.stateIO.todayStr();
      QZD.stateIO.save();
      return { ok:false, reason:'本周已标记' };
    }
    if(g.weekKey === wk) return { ok:false, reason:'本周已传代' };
    return resetForNewGen();
  }

  /* ========== 11-19 质子妃 / 迎回（P3） ==========
     质子状态只存 regime.hostages（consort id + 掳走日期），不动 consort schema；
     好感/记忆/称呼全保留，只是暂不可召幸。迎回消耗名额 + 资源。 */

  function hostageIds(){
    var g = S();
    return (g.hostages || []).map(function(h){ return typeof h === 'string' ? h : (h && h.id); }).filter(Boolean);
  }
  function isHostage(id){
    return hostageIds().indexOf(id) >= 0;
  }
  /* 当前亡国次数对应的"可掳最高位分索引" */
  function maxHostageRank(){
    var g = S(), table = R.HOSTAGE_RANK_BY_FALL || [1,3,5];
    var fc = Math.max(1, g.fallCount || 1);
    return table[Math.min(fc, table.length) - 1];
  }
  /* 掳一位质子：选"位分≤上限、非质子、未孕"里位分最低、好感最低者；保底留 1 位。
     亡国与每周和亲都走这里，叙事由调用方给（和亲 vs 战败）。 */
  function takeHostage(){
    var g = S(), cs = QZD.state.consorts || [];
    var minKeep = R.HOSTAGE_KEEP_MIN || 1;
    var available = cs.filter(function(c){
      return c && !isHostage(c.id) && !c.pregnant;
    });
    if(available.length <= minKeep) return { ok:false, reason:'保底留 1 位妃子，不再掳' };
    var maxRank = maxHostageRank();
    var rankOf = (QZD.harem && QZD.harem.rankOf) || function(c){ return c.rank || 0; };
    var cand = available.filter(function(c){ return rankOf(c) <= maxRank; });
    if(!cand.length) return { ok:false, reason:'无可掳的低位妃' };
    /* 位分升序、好感升序——最不起眼、最不牵挂的先 */
    cand.sort(function(a,b){
      var ra = rankOf(a), rb = rankOf(b);
      if(ra !== rb) return ra - rb;
      return (a.favor||0) - (b.favor||0);
    });
    var victim = cand[0];
    g.hostages = g.hostages || [];
    g.hostages.push({ id:victim.id, at:Date.now(), gen:g.generation });
    var tpl = R.HOSTAGE_LOG || '{name}自请赴藩。';
    var text = tpl.replace('{name}', victim.name);
    try { QZD.stateIO.pushLog('regime', text); } catch(e){}
    try { QZD.ui.toast((R.HOSTAGE_TOAST || '{name}为质').replace('{name}', victim.name)); } catch(e){}
    QZD.stateIO.save();
    return { ok:true, consort:victim, text:text, hostageCount:g.hostages.length };
  }

  /* 迎回一位质子：需名额 + 资源；清除标记、好感+X、触发专属叙事 */
  function rescue(id){
    var g = S(), idx = -1;
    (g.hostages || []).forEach(function(h, i){
      var hid = typeof h === 'string' ? h : (h && h.id);
      if(hid === id) idx = i;
    });
    if(idx < 0) return { ok:false, error:'此妃不在质子名单' };
    if((g.hostageSlots || 0) < 1) return { ok:false, error:'迎回名额不足（晋阶可获得）' };
    var c = null, cs = QZD.state.consorts || [];
    for(var i = 0; i < cs.length; i++) if(cs[i] && cs[i].id === id){ c = cs[i]; break; }
    if(!c) return { ok:false, error:'妃子数据不存在' };
    var rankOf = (QZD.harem && QZD.harem.rankOf) || function(x){ return x.rank || 0; };
    var rk = Math.max(0, Math.min(rankOf(c), 5));
    var cost = ((R.RESCUE_COST || [])[rk]) || { jinQian:150, guoJin:25 };
    var res = QZD.state.resources;
    if(res.jinQian + 1e-9 < cost.jinQian) return { ok:false, error:'金钱不足（需 ' + cost.jinQian + '）' };
    if(res.guoJin + 1e-9 < cost.guoJin) return { ok:false, error:'国力不足（需 ' + cost.guoJin + '）' };
    /* 扣费 + 清标记 + 名额 -1 + 好感 +X */
    QZD.resources.remove({ jinQian:cost.jinQian, guoJin:cost.guoJin });
    g.hostages.splice(idx, 1);
    g.hostageSlots -= 1;
    c.favor = (c.favor || 0) + (R.RESCUE_FAVOR || 10);
    var text = (R.RESCUE_LOG || '{name}迎归。').replace('{name}', c.name);
    try { QZD.stateIO.pushLog('regime', text); } catch(e){}
    try { QZD.ui.toast((R.RESCUE_TOAST || '{name}迎归').replace('{name}', c.name)); } catch(e){}
    QZD.stateIO.save();
    return { ok:true, consort:c, cost:cost, favor:R.RESCUE_FAVOR || 10, text:text, slotsLeft:g.hostageSlots };
  }

  /* 只读：质子名单（含 consort 详情，供 UI 渲染） */
  function hostageList(){
    var cs = QZD.state.consorts || [], out = [];
    hostageIds().forEach(function(id){
      for(var i = 0; i < cs.length; i++){
        if(cs[i] && cs[i].id === id){ out.push(cs[i]); break; }
      }
    });
    return out;
  }

  /* 只读：当前帝阶信息 */
  function rankInfo(){
    var g = S(), rk = rankDef(g.rank);
    var next = g.rank < RANKS.length ? RANKS[g.rank] : null;
    return {
      generation: g.generation,
      rank: g.rank,
      rankId: rk.id,
      rankName: rk.name,
      focusMin: g.focusMin,
      need: next ? next.min : rk.min,
      nextName: next ? next.name : null,
      slots: g.hostageSlots,
      fallCount: g.fallCount,
      bestRank: g.bestRank
    };
  }

  /* 顶栏文案：帝号 + 进度 + 可迎回名额 */
  function topbarText(){
    var i = rankInfo();
    var prog = i.nextName
      ? (Math.round(i.focusMin) + '/' + i.need)
      : ('圆满 · ' + Math.round(i.focusMin) + '分');
    return '第' + i.generation + '代 · ' + i.rankName + ' · 专注 ' + prog + ' · 可迎回 ' + i.slots;
  }

  QZD.regime = {
    S: S,
    rankOf: rankOf,
    rankDef: rankDef,
    addFocus: addFocus,
    onFall: onFall,
    resetForNewGen: resetForNewGen,
    checkGeneration: checkGeneration,
    weekKey: weekKey,
    epitaph: epitaph,
    chronicle: function(){ return (QZD.state.chronicle || []).slice(); },
    takeHostage: takeHostage,
    isHostage: isHostage,
    hostageIds: hostageIds,
    hostageList: hostageList,
    maxHostageRank: maxHostageRank,
    rescue: rescue,
    rankInfo: rankInfo,
    topbarText: topbarText
  };
})();
