/* ============================================================
   systems/ministers.js · M3 科举 + 名臣任免
   开科一次耗金钱，榜下三人；钦点其一入朝，余者归乡
   待录人才写入存档，刷新不丢；上阵最多 3 人
   ============================================================ */
(function(){
  var K = QZD.config.KEJU;
  var M = QZD.config.MINISTER;

  function state(){ return QZD.state; }

  function ministers(){
    if(!Array.isArray(QZD.state.ministers)) QZD.state.ministers = [];
    return QZD.state.ministers;
  }

  function keju(){
    if(!QZD.state.keju || !Array.isArray(QZD.state.keju.candidates)){
      QZD.state.keju = { candidates: [] };
    }
    return QZD.state.keju;
  }

  function findById(list, id){
    for(var i = 0; i < list.length; i++){
      if(list[i].id === id) return list[i];
    }
    return null;
  }

  function fielded(){
    return ministers().filter(function(m){ return !!m.fielded; });
  }

  function randInt(min, max){
    return min + Math.floor(Math.random() * (max - min + 1));
  }

  function pick(arr){
    return arr[Math.floor(Math.random() * arr.length)];
  }

  /* 姓名去重：不重复于在朝名臣与当前榜下人才 */
  function usedNames(){
    var used = {};
    ministers().forEach(function(m){ used[m.name] = true; });
    keju().candidates.forEach(function(c){ used[c.name] = true; });
    return used;
  }

  function makeCandidate(used){
    var name = '';
    for(var i = 0; i < 200; i++){
      name = pick(K.SURNAMES) + pick(K.GIVEN);
      if(!used[name]) break;
    }
    used[name] = true;
    return {
      id: 'keju-' + Date.now().toString(36) + '-' + randInt(100000, 999999).toString(36),
      name: name,
      war: randInt(K.ATTR_MIN, K.ATTR_MAX),
      gov: randInt(K.ATTR_MIN, K.ATTR_MAX),
      lit: randInt(K.ATTR_MIN, K.ATTR_MAX),
      createdAt: Date.now()
    };
  }

  /* 开科：已有待录人才则拒绝，金钱在开科时一次性扣除 */
  function holdExam(){
    if(keju().candidates.length){
      return { ok: false, error: '已有待录人才，请先钦点其一' };
    }
    if(state().resources.jinQian + 1e-9 < K.COST_JIN){
      return { ok: false, error: '金钱不足，开科需 ' + K.COST_JIN };
    }

    QZD.resources.remove({ jinQian: K.COST_JIN });

    var used = usedNames();
    var list = [];
    for(var i = 0; i < K.CANDIDATES; i++) list.push(makeCandidate(used));
    keju().candidates = list;

    QZD.stateIO.pushLog('keju', '开科取士，榜下 ' + list.length + ' 人 · 耗金钱 ' + K.COST_JIN);
    QZD.stateIO.save();
    return { ok: true, cost: K.COST_JIN, candidates: list };
  }

  /* 钦点：榜下人才入朝，其余归乡；文采换算一次性声望 */
  function recruit(id){
    var c = findById(keju().candidates, id);
    if(!c) return { ok: false, error: '该人才已不在榜下' };

    var gain = QZD.formulas.litShengWang(c.lit);
    var m = {
      id: c.id,
      name: c.name,
      war: c.war,
      gov: c.gov,
      lit: c.lit,
      createdAt: Date.now(),
      fielded: false,
      tourLeft: M.TOUR_LIMIT || 8    /* 11-19 消耗回路：可出征次数 */
    };
    ministers().push(m);
    keju().candidates = [];
    if(gain > 0) QZD.resources.add({ shengWang: gain });

    QZD.stateIO.pushLog('keju', '钦点「' + c.name + '」入朝 · 用兵 ' + c.war +
      ' · 理政 ' + c.gov + ' · 文采 ' + c.lit + (gain > 0 ? ' · 声望 +' + gain : ''));
    QZD.stateIO.save();
    return { ok: true, minister: m, shengWang: gain };
  }

  /* 上阵 / 撤下：上阵名额上限 3 人 */
  function toggleField(id){
    var m = findById(ministers(), id);
    if(!m) return { ok: false, error: '名臣不在朝中' };

    if(m.fielded){
      m.fielded = false;
      QZD.stateIO.pushLog('roster', '「' + m.name + '」撤下阵前');
      QZD.stateIO.save();
      return { ok: true, fielded: false, minister: m };
    }

    if(fielded().length >= M.FIELD_SLOTS){
      return { ok: false, error: '上阵名额已满（' + M.FIELD_SLOTS + ' 人）' };
    }
    /* 11-19：任期耗尽者不可再上阵，须致仕让贤 */
    if(typeof m.tourLeft === 'number' && m.tourLeft <= 0)
      return { ok: false, error: '「' + m.name + '」任期已尽，须致仕归乡' };
    m.fielded = true;
    QZD.stateIO.pushLog('roster', '「' + m.name + '」列于阵前');
    QZD.stateIO.save();
    return { ok: true, fielded: true, minister: m };
  }

  /* 致仕：遣散多余大臣，按三维返还部分金钱与声望（上阵者先自动撤下） */
  function retireRefund(m){
    var K = M.RETIRE || {};
    var sum = (m.war || 0) + (m.gov || 0) + (m.lit || 0);
    return {
      jinQian:  Math.round(sum * (K.JIN_PER_POINT != null ? K.JIN_PER_POINT : 1.2)),
      shengWang: Math.round(sum * (K.SW_PER_POINT  != null ? K.SW_PER_POINT  : 0.15))
    };
  }

  /* 皇子出身的名臣致仕：还原为皇子，置入「已致仕宗室」——不凭空消失、可复起。
     优先用入朝时存的 princeMeta；旧档没存则用现有字段降级还原（生母未知）。 */
  function restoreToPrince(m){
    if(!Array.isArray(QZD.state.princes)) QZD.state.princes = [];
    var meta = m.princeMeta || {};
    var prince = {
      id: m.princeId || ('prince-restored-' + Date.now().toString(36)),
      name: m.name,
      seq: meta.seq || (QZD.state.princes.length + 1),
      motherId: meta.motherId || '',
      motherName: meta.motherName || '生母不详',
      bornAt: meta.bornAt || m.createdAt || Date.now(),
      war: m.war || 0, gov: m.gov || 0, lit: m.lit || 0,
      trainCount: meta.trainCount || 0,
      retired: true, retiredAt: Date.now(),
      retireRefunded: 0,          /* 回归时未领皇子致仕返还；如再致仕不重复 */
      wasMinister: true
    };
    QZD.state.princes.push(prince);
    return prince;
  }

  function dismiss(id){
    var list = ministers(), idx = -1;
    for(var i = 0; i < list.length; i++){ if(list[i].id === id){ idx = i; break; } }
    if(idx < 0) return { ok: false, error: '大臣不在朝中' };
    var m = list[idx];

    var gain = retireRefund(m);
    list.splice(idx, 1);
    QZD.resources.add(gain);
    var prince = null;
    if(m.fromPrince) prince = restoreToPrince(m);
    QZD.stateIO.pushLog('roster', '「' + m.name + '」致仕' +
      (prince ? '归宗（皇子名册·已致仕）' : '归乡') + ' · 三维 ' +
      ((m.war||0) + (m.gov||0) + (m.lit||0)) + ' · 得金钱 ' + gain.jinQian + ' · 声望 ' + gain.shengWang);
    QZD.stateIO.save();
    return { ok: true, name: m.name, gain: gain, prince: prince };
  }

  /* 批量：遣散全部未上阵大臣（上阵的保留） */
  function dismissIdle(){
    var list = ministers();
    var idle = list.filter(function(m){ return !m.fielded; });   /* 皇子出身的闲置名臣也可遣散 */
    if(!idle.length) return { ok: false, error: '没有可遣散的闲置大臣' };

    var total = { jinQian: 0, shengWang: 0 }, backToPrince = 0;
    for(var i = 0; i < idle.length; i++){
      var g = retireRefund(idle[i]);
      total.jinQian += g.jinQian;
      total.shengWang += g.shengWang;
      if(idle[i].fromPrince){ restoreToPrince(idle[i]); backToPrince++; }
    }
    for(var j = list.length - 1; j >= 0; j--){
      if(!list[j].fielded) list.splice(j, 1);
    }
    QZD.resources.add(total);
    QZD.stateIO.pushLog('roster', '遣散闲置大臣 ' + idle.length + ' 人' +
      (backToPrince ? '（皇子 ' + backToPrince + ' 人归宗）' : '') + ' · 得金钱 ' +
      total.jinQian + ' · 声望 ' + total.shengWang);
    QZD.stateIO.save();
    return { ok: true, count: idle.length, gain: total, backToPrince: backToPrince };
  }

  /* 11-19 消耗回路：每次出征后磨损所有上阵名臣。
     用兵/理政各 −TOUR_WEAR（下限0）、任期 −1；任期用尽或用兵归 0 → 自动致仕归乡。
     文采不消耗（入朝时已一次性换声望，无可二次收费）。 */
  function wearFromSortie(){
    var worn = [], retired = [], wear = M.WEAR_PER_SORTIE || 10;
    fielded().forEach(function(m){
      /* 旧档名臣无任期：首次磨损时补初始化，避免永远不耗尽 */
      if(typeof m.tourLeft !== 'number') m.tourLeft = M.TOUR_LIMIT || 8;
      m.war = Math.max(0, (m.war || 0) - wear);
      m.gov = Math.max(0, (m.gov || 0) - wear);
      if(typeof m.tourLeft === 'number') m.tourLeft -= 1;
      worn.push({ id:m.id, name:m.name, war:m.war, gov:m.gov, tourLeft:m.tourLeft });
    });
    /* 收集耗尽者再致仕，避免遍历中改数组 */
    var spent = fielded().filter(function(m){
      return (typeof m.tourLeft === 'number' && m.tourLeft <= 0) || (m.war || 0) <= 0;
    }).map(function(m){ return m.id; });
    spent.forEach(function(id){
      var d = dismiss(id);
      if(d.ok) retired.push(d.name);
    });
    QZD.stateIO.save();
    return { ok:true, worn:worn, retired:retired };
  }

  QZD.ministers = {
    list: ministers,
    fielded: fielded,
    wearFromSortie: wearFromSortie,
    fieldedCount: function(){ return fielded().length; },
    slots: M.FIELD_SLOTS,
    pending: function(){ return keju().candidates; },
    candidateById: function(id){ return findById(keju().candidates, id); },
    ministerById: function(id){ return findById(ministers(), id); },
    warBonus: function(){ return QZD.formulas.ministerWarBonus(); },
    govBonus: function(){ return QZD.formulas.tributeMultiplier() - 1; },
    holdExam: holdExam,
    recruit: recruit,
    toggleField: toggleField,
    dismiss: dismiss,
    dismissIdle: dismissIdle
  };
})();
