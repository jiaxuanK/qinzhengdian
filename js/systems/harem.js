/* ============================================================
   systems/harem.js · M4 选秀 + 后宫 + 受孕 + 皇子
   选秀改为抽卡（单抽 / 十连），抽卡收费、后宫不限人数
   召幸耗勤政值，受孕率 = 体质 + 仁心加成；孕期到期自动临盆
   ============================================================ */
(function(){
  var X = QZD.config.XUANXIU;
  var H = QZD.config.HAREM;
  var P = QZD.config.PRINCE;

  function state(){ return QZD.state; }

  function consorts(){
    if(!Array.isArray(QZD.state.consorts)) QZD.state.consorts = [];
    return QZD.state.consorts;
  }

  /* 全部皇子（含已致仕）——存档数组、名号去重、序号计算都用它 */
  function princes(){
    if(!Array.isArray(QZD.state.princes)) QZD.state.princes = [];
    return QZD.state.princes;
  }
  /* 活跃皇子（未致仕）——培养 / 入朝 / 名册主列表用它 */
  function activePrinces(){
    return princes().filter(function(p){ return !p || !p.retired; });
  }
  /* 已致仕皇子——名册折叠区用它 */
  function retiredPrinces(){
    return princes().filter(function(p){ return !!(p && p.retired); });
  }

  function xuanxiu(){
    if(!QZD.state.xuanxiu || !Array.isArray(QZD.state.xuanxiu.candidates)){
      QZD.state.xuanxiu = { candidates: [] };
    }
    return QZD.state.xuanxiu;
  }

  function findById(list, id){
    for(var i = 0; i < list.length; i++){
      if(list[i].id === id) return list[i];
    }
    return null;
  }

  function randInt(min, max){
    return min + Math.floor(Math.random() * (max - min + 1));
  }

  function pick(arr){
    return arr[Math.floor(Math.random() * arr.length)];
  }

  /* 性格查询：key -> 中文名 / 好感系数 / 人设描述（带兜底） */
  function personalityName(key){
    var list = QZD.config.PERSONALITIES || [];
    for(var i = 0; i < list.length; i++){
      if(list[i].key === key) return list[i].name;
    }
    return '温婉';
  }
  function personalityCoef(key){
    var list = QZD.config.PERSONALITIES || [];
    for(var i = 0; i < list.length; i++){
      if(list[i].key === key) return (typeof list[i].coef === 'number') ? list[i].coef : 1;
    }
    return 1;
  }
  /* 通用小额好感/宠爱授予（供专注陪伴奖励等非召幸场景用）。
     favor 按性格系数、两者都封顶；不判受孕、不扣资源、不动侍寝链路。 */
  /* 专注陪伴时她自己正在做的事：按 life 爱好取一句短描写 */
  function companionDoing(c){
    if(!c) return QZD.config.COMPANION_DOING_DEFAULT || '';
    if(c.isQueen && QZD.config.QUEEN && QZD.config.QUEEN.DOING) return QZD.config.QUEEN.DOING;
    var hobby = (c.life && c.life.hobby) || c.trait || '';
    var bank = QZD.config.COMPANION_DOING || {};
    return bank[hobby] || QZD.config.COMPANION_DOING_DEFAULT || '';
  }
  function grantAffection(id, favor, dote){
    var c = findById(consorts(), id);
    if(!c) return { ok:false, error:'妃嫔不存在' };
    var F = QZD.config.FAVOR, D = QZD.config.DOTE;
    var fg = Math.max(0, Math.round((favor || 0) * personalityCoef(c.personality)));
    fg += QZD.bloodTalent ? QZD.bloodTalent.companionFavorBonus(c) : 0;
    var dg = Math.max(0, Math.round(dote || 0));
    c.favor = Math.max(0, Math.min(favorMaxOf(c), (c.favor || 0) + fg));
    c.dote = Math.max(0, Math.min(doteMaxOf(c), (c.dote || 0) + dg));
    QZD.stateIO.save();
    return { ok:true, favorGain:fg, doteGain:dg, consort:c };
  }
  function personalityDesc(key){
    var list = QZD.config.PERSONALITIES || [];
    for(var i = 0; i < list.length; i++){
      if(list[i].key === key) return list[i].desc || '';
    }
    return '';
  }

  /* 专注陪伴问候：按性格从 HAREM_COMPANION 随机取一句（只读，不改数值） */
  function companionGreeting(c){
    if(c && c.isQueen){
      var Q = QZD.config.QUEEN || {};
      var bankQ = Q.GREETINGS || [];
      if(bankQ.length) return pick(bankQ);
    }
    var key = (c && c.personality) || 'wen';
    var bank = (QZD.config.HAREM_COMPANION && QZD.config.HAREM_COMPANION[key]) || [];
    return bank.length ? pick(bank) : '陛下……';
  }

  /* ---------- 位份（册封） ---------- */
  function rankList(){
    return (QZD.config.RANK && QZD.config.RANK.TITLES) || ['才人'];
  }
  function rankOf(c){
    var max = rankList().length - 1;
    var r = (c && typeof c.rank === 'number') ? c.rank : 0;
    return Math.max(0, Math.min(max, Math.floor(r)));
  }
  function rankTitle(c){
    if(c && c.isQueen) return (QZD.config.QUEEN || {}).TITLE || '皇后';
    return rankList()[rankOf(c)];
  }
  function isMaxRank(c){
    if(c && c.isQueen) return true;   /* 皇后位份已到顶，不走册封 */
    return rankOf(c) >= rankList().length - 1;
  }
  /* 当前位分下的宠爱上限：按 rank 取 DOTE_CAP，缺配置回退 DOTE.MAX */
  function doteMaxOf(c){
    var R = QZD.config.RANK || {}, caps = R.DOTE_CAP;
    var r = rankOf(c);
    var base = (Array.isArray(caps) && caps[r] != null) ? caps[r]
      : ((QZD.config.DOTE && QZD.config.DOTE.MAX) || 100);
    return base + (QZD.bloodTalent ? QZD.bloodTalent.doteCapBonus(c) : 0);
  }
  /* 当前位分下的喜爱上限：按 rank 取 FAVOR_CAP，缺配置回退 FAVOR.MAX。
     喜爱是她对你的心意，不作晋封条件，但满级后随位分提高、进度条同步更新。 */
  function favorMaxOf(c){
    var R = QZD.config.RANK || {}, caps = R.FAVOR_CAP;
    var r = rankOf(c);
    if(Array.isArray(caps) && caps[r] != null) return caps[r];
    return (QZD.config.FAVOR && QZD.config.FAVOR.MAX) || 100;
  }
  function ennobleCost(c){
    var R = QZD.config.RANK;
    var r = rankOf(c);
    return {
      jin: R.COST_JIN + r * R.COST_JIN_STEP,
      sw: R.COST_SW + r * R.COST_SW_STEP
    };
  }
  /* 晋封门槛：只看宠爱——需宠爱练到「当前位分上限 × PROMOTE_RATIO」（默认九成）。
     门槛跟随宠爱上限逐级提高；喜爱是她对你的心意，不作晋封条件。
     已至顶级返回 null；保留 favor 字段只为兼容旧调用，恒为 0。 */
  function promoteNeed(c){
    if(!c || isMaxRank(c)) return null;
    var R = QZD.config.RANK || {};
    var ratio = (typeof R.PROMOTE_RATIO === 'number') ? R.PROMOTE_RATIO : 0.9;
    ratio = Math.max(0, Math.min(1, ratio));
    var gate = Math.ceil(doteMaxOf(c) * ratio);
    var next = rankOf(c) + 1;
    return { rank: next, title: rankList()[next],
             favor: 0, dote: gate };
  }
  /* 是否已满足晋封条件：宠爱达当前上限的门槛比例即可（喜爱不作晋封门槛） */
  function promoteReady(c){
    if(!c || isMaxRank(c)) return false;
    return (c.dote || 0) >= promoteNeed(c).dote;
  }
  function ennoble(id){
    var c = findById(consorts(), id);
    if(!c) return { ok: false, error: '妃嫔不在后宫' };
    if(isMaxRank(c)) return { ok: false, error: '已至贵妃，无可再封' };
    if(!promoteReady(c)){
      var gate = promoteNeed(c).dote;
      return { ok: false, error: '宠爱未满：需练到 ' + gate +
        '（现 ' + Math.round(c.dote || 0) + '）方可晋封' };
    }
    var cost = ennobleCost(c);
    if((state().resources.jinQian || 0) + 1e-9 < cost.jin){
      return { ok: false, error: '金钱不足（册封需 ' + cost.jin + '）' };
    }
    if((state().resources.shengWang || 0) + 1e-9 < cost.sw){
      return { ok: false, error: '声望不足（册封需 ' + cost.sw + '）' };
    }
    QZD.resources.remove({ jinQian: cost.jin, shengWang: cost.sw });
    c.rank = rankOf(c) + 1;   /* 先升级：上限随位分提高 */
    c.dote = Math.max(0, Math.min(doteMaxOf(c), (c.dote || 0) + (QZD.config.RANK.DOTE_GAIN || 0)));
    QZD.stateIO.pushLog('harem', '册封「' + c.name + '」为「' + rankTitle(c) +
      '」 · 耗金钱 ' + cost.jin + ' · 声望 ' + cost.sw);
    QZD.stateIO.save();
    /* 事件剧情：册封当下强推，不随每日 roll */
    if(QZD.story && QZD.story.onEvent) QZD.story.onEvent('promote', c);
    return { ok: true, consort: c, title: rankTitle(c), cost: cost };
  }
  /* 位份越高，召幸耗勤政越少（不低于 SUMMON_MIN）。
     mode 传入时按该相处方式 costMult 计价（侍寝×2、日常陪伴×0.6 等）；
     不传 mode（底层 summon(id) 旧契约）时按 ×1，保证受孕链路与旧测试不变。 */
  function summonCostOf(c, mode){
    var R = QZD.config.RANK;
    var base = Math.max(R.SUMMON_MIN, H.SUMMON_COST_QIN - rankOf(c) * R.SUMMON_CUT);
    var mult = (mode && typeof mode.costMult === 'number' && mode.costMult > 0)
      ? mode.costMult : 1;
    return Math.round(base * mult * (QZD.study ? QZD.study.multiplier() : 1));
  }

  /* ---------- 皇子成长：襁褓 → 孩童 → 少年 → 成年 ----------
     按 bornAt + 真实分钟推算，离线照样长大；旧档无 bornAt 直接成年，
     不让历史存档里的皇子突然被锁住。 */
  function princeGrowth(p, now){
    if(!p) return null;
    var R = QZD.config.PRINCE || {};
    var stages = Array.isArray(R.GROWTH) ? R.GROWTH : [];
    var adult = { key:'adult', name:'成年', pct:100, remainMin:0, attr:'',
                  idx:-1, next:'', eduDone:true, stages:stages };
    if(!stages.length || !p.bornAt || p.retired) return adult;
    var elapsed = Math.max(0, ((now || Date.now()) - Number(p.bornAt)) / 60000);
    for(var i = 0; i < stages.length; i++){
      var st = stages[i], need = Math.max(1, Number(st.min) || 0);
      if(elapsed < need){
        var done = p.growthEdu || {};
        return { key:st.key, name:st.name, pct:Math.floor(elapsed / need * 100),
                 remainMin:Math.ceil(need - elapsed), attr:st.attr, idx:i,
                 next:(stages[i + 1] && stages[i + 1].name) || '成年',
                 eduDone:!!done[st.key], stages:stages };
      }
      elapsed -= need;
    }
    return adult;
  }

  /* 主循环调用：阶段变化时落一次起居注，不弹窗 */
  function settlePrinceGrowth(now){
    now = now || Date.now();
    var changed = [];
    princes().forEach(function(p){
      if(!p || p.retired) return;
      var g = princeGrowth(p, now);
      if(!p.stage){ p.stage = g.key; return; }   /* 旧档静默补字段 */
      if(p.stage === g.key) return;
      var from = p.stage;
      p.stage = g.key;
      changed.push({ prince:p, from:from, to:g.key });
      QZD.stateIO.pushLog('harem', '皇子「' + p.name + '」长成' + g.name +
        (g.key === 'adult' ? ' · 可培养、可入朝为臣' : ' · 可教养一次'));
    });
    if(changed.length) QZD.stateIO.save();
    return changed;
  }

  /* 教养：成年前每阶段一次，花金钱换该阶段对应属性 +N */
  function educatePrince(id){
    var p = findById(activePrinces(), id);
    if(!p) return { ok:false, error:'皇子不存在' };
    var g = princeGrowth(p, Date.now());
    if(g.key === 'adult') return { ok:false, error:'皇子已成年，改由培养精进' };
    var done = p.growthEdu || (p.growthEdu = {});
    if(done[g.key]) return { ok:false, error:'此阶段已教养过' };
    var R = QZD.config.PRINCE || {};
    var costs = R.GROW_EDU_COST || [60, 100, 140];
    var cost = Number(costs[g.idx]) || (60 + g.idx * 40);
    if((state().resources.jinQian || 0) + 1e-9 < cost)
      return { ok:false, error:'金钱不足（教养需 ' + cost + '）' };
    QZD.resources.remove({ jinQian:cost });
    done[g.key] = true;
    var gain = R.GROW_EDU_ATTR || 3, cap = R.ATTR_MAX || 120;
    var attrName = ({ lit:'文采', gov:'理政', war:'用兵' })[g.attr] || '资质';
    if(g.attr && p[g.attr] != null) p[g.attr] = Math.min(cap, (p[g.attr] || 0) + gain);
    QZD.stateIO.pushLog('harem', '教养皇子「' + p.name + '」· ' + g.name +
      ' · ' + attrName + ' +' + gain + ' · 耗金钱 ' + cost);
    QZD.stateIO.save();
    return { ok:true, prince:p, stage:g.name, attr:g.attr, attrName:attrName,
             gain:gain, cost:cost };
  }

  /* ---------- 皇子消耗：培养 / 入朝为臣 ---------- */
  function trainPrince(id){
    var p = findById(activePrinces(), id);
    if(!p) return { ok: false, error: '皇子不存在' };
    var g = princeGrowth(p, Date.now());
    if(g.key !== 'adult')
      return { ok: false, error: '皇子尚在' + g.name + '，约 ' + g.remainMin + ' 分钟后成年' };
    var R = QZD.config.PRINCE;
    var n = Math.max(0, Math.floor(Number(p.trainCount) || 0));
    var cost = R.TRAIN_COST + n * R.TRAIN_STEP;
    if((state().resources.jinQian || 0) + 1e-9 < cost){
      return { ok: false, error: '金钱不足（培养需 ' + cost + '）' };
    }
    /* 只从「未满」的三维里培养；都满则无可再练 */
    var keys = ['war', 'gov', 'lit'].filter(function(k){
      return (p[k] || 0) < R.ATTR_MAX;
    });
    if(!keys.length) return { ok: false, error: '三维已至上限，无可再培养' };
    /* 优先加「当前最低」的一项，让文武均衡；并列时随机其一。
       TRAIN_PREFER_LOWEST=false 则纯随机（保留旧手感）。 */
    var key;
    if(R.TRAIN_PREFER_LOWEST !== false){
      var minV = Math.min.apply(null, keys.map(function(k){ return p[k] || 0; }));
      var lows = keys.filter(function(k){ return (p[k] || 0) === minV; });
      key = lows[Math.floor(Math.random() * lows.length) % lows.length];
    }else{
      key = pick(keys);
    }
    QZD.resources.remove({ jinQian: cost });
    var gain = randInt(R.TRAIN_GAIN_MIN, R.TRAIN_GAIN_MAX);
    p[key] = Math.min(R.ATTR_MAX, (p[key] || 0) + gain);
    p.trainCount = n + 1;
    var label = key === 'war' ? '用兵' : (key === 'gov' ? '理政' : '文采');
    QZD.stateIO.pushLog('harem', '培养皇子「' + p.name + '」 · ' + label + ' +' + gain +
      ' · 耗金钱 ' + cost);
    QZD.stateIO.save();
    return { ok: true, prince: p, key: key, gain: gain, cost: cost };
  }
  function princeToMinister(id){
    var p = findById(activePrinces(), id);
    if(!p) return { ok: false, error: '皇子不存在' };
    var g = princeGrowth(p, Date.now());
    if(g.key !== 'adult')
      return { ok: false, error: '皇子尚在' + g.name + '，成年后方可入朝' };
    var cost = QZD.config.PRINCE.MINISTER_COST_SW || 0;
    if((state().resources.shengWang || 0) + 1e-9 < cost){
      return { ok: false, error: '声望不足（入朝需 ' + cost + '）' };
    }
    if(cost > 0) QZD.resources.remove({ shengWang: cost });
    if(!Array.isArray(state().ministers)) state().ministers = [];
    var ob = (QZD.config.MINISTER && QZD.config.MINISTER.ORIGIN_BONUS &&
              QZD.config.MINISTER.ORIGIN_BONUS.prince) || {};
    var m = {
      id: 'min-' + p.id,
      name: p.name,
      war: (p.war || 0) + (ob.war || 0),
      gov: p.gov || 0,
      lit: (p.lit || 0) + (ob.lit || 0),
      createdAt: Date.now(),
      fielded: false,
      fromPrince: true,
      origin: 'prince',
      /* 保留皇子身份快照，供日后致仕回归名册（旧档无此字段则致仕时降级还原） */
      princeId: p.id,
      princeMeta: {
        motherId: p.motherId, motherName: p.motherName, bornAt: p.bornAt,
        seq: p.seq, trainCount: p.trainCount,
        /* 宗室加成只属于「名臣」身份；归宗时用原始资质还原，防反复入朝叠加 */
        baseWar: p.war, baseGov: p.gov, baseLit: p.lit,
        growthEdu: p.growthEdu || {}
      }
    };
    state().ministers.push(m);
    var idx = princes().indexOf(p);
    if(idx >= 0) princes().splice(idx, 1);
    QZD.stateIO.pushLog('harem', '皇子「' + p.name + '」入朝为臣 · 耗声望 ' + cost +
      ' · 用兵 ' + m.war + ' · 理政 ' + m.gov + ' · 文采 ' + m.lit);
    QZD.stateIO.save();
    return { ok: true, minister: m, cost: cost };
  }

  /* 致仕：标记 retired，不真删；按累计培养投入返还五成。
     防刷：只返还「本次新增投入」——eligible = 投入×比例，扣掉已返还 retireRefunded；
     复起后再培养，投入变多，下次致仕才补差额，反复致仕/复起无法凭空生钱。 */
  function retirePrince(id){
    var p = findById(activePrinces(), id);
    if(!p) return { ok: false, error: '皇子不存在或已致仕' };
    var R = QZD.config.PRINCE;
    var invested = QZD.formulas.princeTrainInvested(p.trainCount);
    var eligible = Math.floor(invested * (R.RETIRE_REFUND_RATIO || 0));
    var already = Math.max(0, Math.floor(Number(p.retireRefunded) || 0));
    var refund = Math.max(0, eligible - already);
    p.retired = true;
    p.retiredAt = Date.now();
    p.retireRefunded = already + refund;
    if(refund > 0) QZD.resources.add({ jinQian: refund });
    QZD.stateIO.pushLog('harem', '皇子「' + p.name + '」致仕归宗 · 返还培养金 ' + refund +
      ' · 原用兵 ' + (p.war || 0) + ' 理政 ' + (p.gov || 0) + ' 文采 ' + (p.lit || 0));
    QZD.stateIO.save();
    return { ok: true, prince: p, refund: refund };
  }

  /* 复起：撤销致仕标记，回到活跃名册；retireRefunded 不清，防反复领返还 */
  function restorePrince(id){
    var p = findById(retiredPrinces(), id);
    if(!p) return { ok: false, error: '皇子未致仕' };
    p.retired = false;
    p.restoredAt = Date.now();
    QZD.stateIO.pushLog('harem', '皇子「' + p.name + '」复起入册');
    QZD.stateIO.save();
    return { ok: true, prince: p };
  }

  /* 喜爱度层级：low<33 / mid 33–65 / high≥66 */
  function favorTier(f){
    if(f >= 66) return 'high';
    if(f >= 33) return 'mid';
    return 'low';
  }

  /* ---------- 稀世妃嫔（assets/images 每个文件夹 = 一人多姿态） ---------- */
  function rareEntries(){
    return (QZD.ASSETS && QZD.ASSETS.rare) || [];
  }
  function rareOwned(){
    var m = {};
    consorts().forEach(function(c){ if(c.rareKey) m[c.rareKey] = true; });
    return m;
  }
  function rareRemaining(){
    var owned = rareOwned();
    return rareEntries().filter(function(r){ return !owned[r.folder]; });
  }
  function rareCost(){
    var R = QZD.config.RARE || {};
    return Math.round((R.COST_JIN || 800) * (QZD.study ? QZD.study.multiplier() : 1));
  }

  /* 由稀世条目构造一位绝色妃嫔（三维 90–120，多姿态 / 动态立绘） */
  function makeRareConsort(entry){
    var R = QZD.config.RARE || {};
    var poses = (entry.poses || []).slice();
    var c = {
      id: 'rare-' + Date.now().toString(36) + '-' + randInt(100000, 999999).toString(36),
      name: entry.name || '绝色',
      yan: randInt(R.ATTR_MIN || 90, R.ATTR_MAX || 120),
      ti:  randInt(R.ATTR_MIN || 90, R.ATTR_MAX || 120),
      cai: randInt(R.ATTR_MIN || 90, R.ATTR_MAX || 120),
      img: poses[0] || null,
      video: entry.video || null,
      poses: poses,
      poseIndex: 0,
      rare: true,
      rareKey: entry.folder,
      personality: entry.personality || 'wen',
      age: randInt(17, 24),
      hometown: pick((QZD.config.XUANXIU || {}).HOMETOWNS || ['江南']),
      origin: '稀世采选',
      trait: pick((QZD.config.XUANXIU || {}).TRAITS || ['善舞']),
      blood: rollBlood('rare'),      /* 绝色 90% 带血脉 */
      veil: false,
      favor: randInt(R.FAVOR_MIN || 25, R.FAVOR_MAX || 45),
      dote: ((QZD.config.DOTE ? QZD.config.DOTE.INIT : 0) + 10),
      rank: 0,
      joinedAt: Date.now(),
      pregnant: null
    };
    if(QZD.bloodTalent) QZD.bloodTalent.initConsort(c);   /* 绝色血脉同样吃初始天赋 */
    return c;
  }

  function recruitRare(){
    var R = QZD.config.RARE || {};
    var pool = rareRemaining();
    if(!pool.length) return { ok: false, error: '稀世妃嫔已尽入宫中' };

    var cost = rareCost();
    if((state().resources.jinQian || 0) + 1e-9 < cost){
      return { ok: false, error: '金钱不足（需 ' + cost + '）' };
    }

    var consort = makeRareConsort(pick(pool));
    QZD.resources.remove({ jinQian: cost });
    consorts().push(consort);

    QZD.stateIO.pushLog('harem', '稀世选秀，「' + consort.name + '」入宫 · 耗金钱 ' + cost +
      ' · 绝色之姿' + (consort.video ? ' · 动态立绘' : ' · 姿态 ' + (consort.poses || []).length + ' 张'));
    QZD.stateIO.save();
    return { ok: true, consort: consort, cost: cost, remaining: rareRemaining().length };
  }

  /* ---------- 抽卡选秀：单抽 / 十连 ----------
     规则：名字 / 三维 / 性格 / 人设全部随机；按概率分三档——
     绝色（P_RARE，取稀世立绘）> 稀有（P_UNCOMMON，三维 70–120）> 普通（其余，三维 30–90）。
     抽卡只收费（单抽 / 十连），后宫不限人数，不再有席位与扩宫。 */
  function gachaCost(n){
    var G = QZD.config.GACHA || {};
    var unit = (G.PULL_COST != null ? G.PULL_COST : (X.COST_JIN || 120));
    var count = Math.max(1, Math.floor(Number(n) || 1));
    var discount = (count >= 10 && G.TEN_DISCOUNT != null) ? G.TEN_DISCOUNT : 1;
    return Math.round(unit * count * discount * (QZD.study ? QZD.study.multiplier() : 1));
  }

  function rollRarity(){
    var G = QZD.config.GACHA || {};
    var pRare = (G.P_RARE != null ? G.P_RARE : 0.06);
    var pUnc  = (G.P_UNCOMMON != null ? G.P_UNCOMMON : 0.28);
    var r = Math.random();
    if(r < pRare) return 'rare';
    if(r < pRare + pUnc) return 'uncommon';
    return 'common';
  }

  /* 志怪血脉：凡人是默认，血脉是惊喜。
     三档概率——绝色 90% / 稀有 30% / 普通 10%（config.BLOOD 可调）。
     旧档无此字段时由 normalize 补 'ren'，永不追溯。 */
  function rollBlood(tier){
    var B = QZD.config.BLOOD || {};
    var p = tier === 'rare'   ? (B.RARE_RATE != null ? B.RARE_RATE : 0.9)
          : tier === 'uncommon' ? (B.UNCOMMON_RATE != null ? B.UNCOMMON_RATE : 0.3)
          : (B.COMMON_RATE != null ? B.COMMON_RATE : 0.1);
    if(Math.random() >= p) return 'ren';
    var pool = (B.LIST || []).filter(function(b){ return b.key && b.key !== 'ren'; });
    if(!pool.length) return 'ren';
    var total = 0, i;
    for(i = 0; i < pool.length; i++) total += (pool[i].weight || 1);
    var r = Math.random() * total;
    for(i = 0; i < pool.length; i++){
      r -= (pool[i].weight || 1);
      if(r <= 0) return pool[i].key;
    }
    return pool[pool.length - 1].key;
  }

  /* 单抽：返回 {rarity, consort}（consort 为候选结构，入宫时才转正）。
     usedRare 为本次抽卡已出现的绝色 key 集合，避免同一抽卡内重复绝色（即便尚未入宫） */
  function rollOnce(used, usedImg, usedRare){
    var G = QZD.config.GACHA || {};
    var rarity = rollRarity();
    var bloodTier = rarity;   /* 血脉概率按「原始」档位，立绘降级不改血脉 */

    /* 绝色：优先取稀世立绘；已抽尽则降级为稀有（血仍按绝色 90%） */
    if(rarity === 'rare'){
      var pool = rareRemaining().filter(function(r){ return !usedRare || !usedRare[r.folder]; });
      if(pool.length){
        var entry = pick(pool);
        if(usedRare) usedRare[entry.folder] = true;
        return { rarity: 'rare', consort: makeRareConsort(entry) };
      }
      rarity = 'uncommon';
    }

    var lo = rarity === 'uncommon' ? (G.UNCOMMON_MIN || 70) : (G.COMMON_MIN || 30);
    var hi = rarity === 'uncommon' ? (G.UNCOMMON_MAX || 120) : (G.COMMON_MAX || 90);
    var c = makeCandidate(used, bloodTier);
    c.yan = randInt(lo, hi);
    c.ti  = randInt(lo, hi);
    c.cai = randInt(lo, hi);
    c.img = pickPortrait(usedImg);
    if(c.img) usedImg[c.img] = true;
    return { rarity: rarity, consort: c };
  }

  /* 由候选结构构造正式妃嫔（入宫才调用） */
  function finalizeConsort(src){
    return {
      id: src.id,
      name: src.name,
      yan: src.yan, ti: src.ti, cai: src.cai,
      img: src.img || null,
      video: src.video || null,
      poses: src.poses || null,
      poseIndex: 0,
      rare: !!src.rare,
      rareKey: src.rareKey || null,
      personality: src.personality,
      age: src.age,
      hometown: src.hometown,
      origin: src.origin,
      trait: src.trait,
      blood: src.blood || 'ren',     /* 候选→正式必须透传，否则血脉丢失 */
      veil: !!src.veil,
      favor: src.favor,
      dote: (src.dote != null) ? src.dote : (QZD.config.DOTE ? QZD.config.DOTE.INIT : 0),
      rank: 0,
      joinedAt: Date.now(),
      pregnant: null
    };
  }

  /* 抽卡：仅生成候选，扣抽卡费，不入宫。
     返回 { ok, cost, candidates:[{rarity, consort}] } */
  function gacha(n){
    var count = Math.max(1, Math.min(10, Math.floor(Number(n) || 1)));
    var cost = gachaCost(count);
    if((state().resources.jinQian || 0) + 1e-9 < cost){
      return { ok: false, error: '金钱不足（需 ' + cost + '）' };
    }
    QZD.resources.remove({ jinQian: cost });

    var used = usedNames(), usedImg = {}, usedRare = {}, out = [];
    for(var k = 0; k < count; k++){
      var r = rollOnce(used, usedImg, usedRare);
      used[r.consort.name] = true;
      out.push({ rarity: r.rarity, consort: finalizeConsort(r.consort) });
    }

    var rares = out.filter(function(o){ return o.rarity === 'rare'; }).length;
    var uns   = out.filter(function(o){ return o.rarity === 'uncommon'; }).length;
    QZD.stateIO.pushLog('harem', (count >= 10 ? '十连' : '单抽') + '选秀，抽得 ' + count +
      ' 名候选（绝色 ' + rares + ' · 稀有 ' + uns + '）· 耗金钱 ' + cost + '（待择人入宫）');
    QZD.stateIO.save();
    return { ok: true, cost: cost, candidates: out };
  }

  /* 确认入宫：把候选中的若干位转正（按玩家勾选）。后宫不限人数。
     传空数组 = 放弃本次选秀（不入宫、不退抽卡费）。
     返回 { ok, added, error } */
  function commitConsorts(list){
    list = list || [];
    if(!list.length) return { ok: true, added: 0, abandoned: true };

    var rares = 0;
    list.forEach(function(c){
      consorts().push(c);
      if(c.rare) rares++;
    });
    QZD.stateIO.pushLog('harem', '选秀入宫 ' + list.length + ' 人（绝色 ' + rares + '）');
    QZD.stateIO.save();
    return { ok: true, added: list.length };
  }

  /* 切换某位妃嫔当前展示的姿态 */
  function setPose(id, idx){
    var c = findById(consorts(), id);
    if(!c || !Array.isArray(c.poses) || !c.poses.length) return null;
    var n = c.poses.length;
    idx = ((Math.round(idx) % n) + n) % n;
    c.poseIndex = idx;
    c.img = c.poses[idx];
    QZD.stateIO.save();
    return c;
  }
  function cyclePose(id){
    var c = findById(consorts(), id);
    if(!c) return null;
    return setPose(id, (c.poseIndex || 0) + 1);
  }

  /* 生成昭幸对话：性格 × 喜爱层级 为底，再叠加 撩人句 + 特长 / 才情 / 宠爱 */
  function buildDialogue(c, pregnant){
    var key = c.personality || 'wen';
    var tier = favorTier(c.favor || 0);
    var CFG = QZD.config;

    var bank = (CFG.HAREM_DIALOGUE && CFG.HAREM_DIALOGUE[key] &&
                CFG.HAREM_DIALOGUE[key][tier]) || [];
    var parts = [bank.length ? pick(bank) : '陛下……'];

    /* 撩人短句：中高亲密必加，低亲密五成概率 */
    var fl = (CFG.FLIRT_DIALOGUE && CFG.FLIRT_DIALOGUE[key]) || [];
    if(fl.length && (tier !== 'low' || Math.random() < 0.5)){
      parts.push(pick(fl));
    }

    /* 属性附加语：特长 / 才情 / 宠爱 各生成一条备选 */
    var caiTier = (c.cai >= 90) ? 'high' : (c.cai >= 60 ? 'mid' : 'low');
    var doteTier = (c.dote >= 66) ? 'high' : (c.dote >= 33 ? 'mid' : 'low');

    var pool = [];
    var tb = c.trait && CFG.TRAIT_DIALOGUE && CFG.TRAIT_DIALOGUE[c.trait];
    if(tb && tb.length) pool.push(pick(tb));
    if(CFG.CAI_DIALOGUE && CFG.CAI_DIALOGUE[caiTier]) pool.push(pick(CFG.CAI_DIALOGUE[caiTier]));
    if(CFG.DOTE_DIALOGUE && CFG.DOTE_DIALOGUE[doteTier]) pool.push(pick(CFG.DOTE_DIALOGUE[doteTier]));

    if(pool.length){
      parts.push(pick(pool));
      if(tier === 'high' && pool.length > 1 && Math.random() < 0.6){
        var second = pick(pool);
        if(second !== parts[parts.length - 1]) parts.push(second);
      }
    }

    /* 高喜爱 / 高宠爱：再补一句更贴近的私语 */
    if((tier === 'high' || doteTier === 'high') && CFG.INTIMATE_LINES &&
       CFG.INTIMATE_LINES.length && Math.random() < 0.55){
      parts.push(pick(CFG.INTIMATE_LINES));
    }

    return {
      personality: personalityName(key),
      personaKey: key,
      personaDesc: personalityDesc(key),
      favor: c.favor || 0,
      dote: c.dote || 0,
      tier: tier,
      trait: c.trait || '',
      caiTier: caiTier,
      doteTier: doteTier,
      pregnant: !!pregnant,
      text: parts.join(' ')
    };
  }

  /* 妃嫔立绘素材池分配：优先取池中未被在屏妃嫔 / 待选秀女使用的图（不撞图）；
     池耗尽则允许复用。exclude 用于同一批选秀内互相排除。无图则返回 null。 */
  function pickPortrait(exclude){
    /* 优先用自动清单（scripts/gen_manifest.js 扫 assets/images 生成），
       未生成时退回 config.PORTRAIT_POOL 手写清单 */
    var pool = (QZD.ASSETS && QZD.ASSETS.pool && QZD.ASSETS.pool.length)
      ? QZD.ASSETS.pool
      : (QZD.config.PORTRAIT_POOL || []);
    if(!pool.length) return null;
    var used = {};
    consorts().forEach(function(c){ if(c.img) used[c.img] = true; });
    xuanxiu().candidates.forEach(function(c){ if(c.img) used[c.img] = true; });
    if(exclude) Object.keys(exclude).forEach(function(k){ used[k] = true; });
    var avail = pool.filter(function(p){ return !used[p]; });
    var src = avail.length ? avail : pool;
    return src[Math.floor(Math.random() * src.length)];
  }

  function usedNames(){
    var used = {};
    consorts().forEach(function(c){ used[c.name] = true; });
    xuanxiu().candidates.forEach(function(c){ used[c.name] = true; });
    return used;
  }

  function makeCandidate(used, tier){
    var name = '';
    for(var i = 0; i < 200; i++){
      name = pick(X.SURNAMES) + pick(X.GIVEN);
      if(!used[name]) break;
    }
    used[name] = true;
    var F = QZD.config.FAVOR;
    var initFavor = randInt(F.INIT_MIN != null ? F.INIT_MIN : F.INIT,
                            F.INIT_MAX != null ? F.INIT_MAX : F.INIT);
    var c = {
      id: 'xiu-' + Date.now().toString(36) + '-' + randInt(100000, 999999).toString(36),
      name: name,
      yan: randInt(X.ATTR_MIN, X.ATTR_MAX),
      ti: randInt(X.ATTR_MIN, X.ATTR_MAX),
      cai: randInt(X.ATTR_MIN, X.ATTR_MAX),
      img: null,
      personality: pick(QZD.config.PERSONALITIES).key,   /* 随机性格（决定昭幸口吻） */
      age: randInt(X.AGE_MIN, X.AGE_MAX),                /* 年龄 */
      hometown: pick(X.HOMETOWNS),                       /* 籍贯 */
      origin: pick(X.ORIGINS),                           /* 出身 */
      trait: pick(X.TRAITS),                             /* 特长 */
      blood: rollBlood(tier || 'common'),                /* 血脉概率按档位：普通10% / 稀有30% */
      veil: false,                                       /* 血脉默认隐藏 */
      favor: initFavor,                                  /* 入宫初始喜爱度（随机） */
      dote: (QZD.config.DOTE ? QZD.config.DOTE.INIT : 0),/* 入宫初始宠爱度（帝→妃） */
      createdAt: Date.now()
    };
    if(QZD.bloodTalent) QZD.bloodTalent.initConsort(c);   /* 血脉天赋：初始属性整数点 */
    return c;
  }

  /* 召幸：耗勤政值，提升喜爱度，生成性格对话；有孕者不可侍寝。
     S2 扩展 summon(id, modeId)：不传 modeId 时与原逻辑【完全一致】
     （侍寝 / 受孕判定 / 有孕禁召 / 喜爱宠爱增量 / 喜讯起居注一条不删）；
     传入相处方式时改为「相处」：各给不同增量、不判受孕，且都是剧情触发入口。 */
  function summon(id, modeId){
    var c = findById(consorts(), id);
    if(!c) return { ok: false, error: '妃嫔不在后宫' };

    var modes = QZD.config.SUMMON_MODES || [], mode = null, i;
    for(i = 0; i < modes.length; i++) if(modes[i].id === modeId){ mode = modes[i]; break; }
    var isSleep = !mode || !!mode.sleep;      /* 未指定 = 原侍寝 */
    var modeName = mode ? mode.name : '侍寝';
    var sceneTag = mode ? mode.scene : 'bed';

    if(c.pregnant && isSleep) return { ok: false, error: '有孕在身，暂不宜召幸' };
    /* 11-19 质子妃：流落藩邦、不可召幸；迎回后移除标记即恢复 */
    if(QZD.regime && QZD.regime.isHostage && QZD.regime.isHostage(id))
      return { ok: false, error: '此妃现为质子，远在藩邦，暂不可召幸' };
    var costQin = summonCostOf(c, mode);   /* 侍寝×2、日常陪伴×0.6 等；不传 mode 仍×1 */
    if(state().resources.qinZheng + 1e-9 < costQin){
      return { ok: false, error: '勤政值不足（需 ' + costQin + '）' };
    }

    /* 相处方式门槛：才艺 + 情感浓度；侍寝始终开放，保住受孕链路 */
    if(mode && !isSleep){
      var IT = QZD.config.INTIMACY || {};
      var inti = (QZD.formulas && QZD.formulas.intimacyOf)
        ? QZD.formulas.intimacyOf(c) : { index: 0, name: '生疏' };
      if(inti.index < (mode.minTier || 0)){
        var need = (IT.TIERS && IT.TIERS[mode.minTier] || {}).name || '更亲近';
        return { ok: false, error: '情分未到「' + need + '」，此刻不宜' + mode.name };
      }
      if(mode.trait && mode.trait !== '-'){
        var traits = Array.isArray(mode.trait) ? mode.trait : [mode.trait];
        if(traits.indexOf(c.trait) < 0){
          return { ok: false, error: '「' + c.name + '」不擅' + traits.join(' / ') + '，换一种相处罢' };
        }
      }
    }

    QZD.resources.remove({ qinZheng: costQin });
    /* 喜爱度提升（妃→帝）：基础值再乘该性格的好感系数，封顶当前位分喜爱上限 */
    var F = QZD.config.FAVOR, D = QZD.config.DOTE;
    var coef = personalityCoef(c.personality);
    var favorGain = isSleep ? Math.round(F.PER_SUMMON * coef) : Math.round((mode.favor || 0) * coef);
    var doteGain  = isSleep ? D.PER_SUMMON : (mode.dote || 0);
    doteGain += QZD.bloodTalent ? QZD.bloodTalent.summonDoteBonus(c) : 0;
    c.favor = Math.max(0, Math.min(favorMaxOf(c), (c.favor || 0) + favorGain));
    c.dote = Math.max(0, Math.min(doteMaxOf(c), (c.dote || 0) + doteGain));

    var rate = QZD.formulas.conceptionRate(c.ti);
    var pregnant = false;
    if(isSleep) pregnant = Math.random() < rate;   /* 受孕只在侍寝判定 */
    var dlg = buildDialogue(c, pregnant);
    if(mode && !isSleep && mode.line) dlg.text = mode.line + ' ' + dlg.text;
    dlg.modeId = mode ? mode.id : 'sleep';
    dlg.modeName = modeName;
    dlg.scene = sceneTag;
    dlg.isSleep = isSleep;

    if(pregnant){
      var now = Date.now();
      c.pregnant = { conceivedAt: now, dueAt: now + H.PREGNANCY_MIN * 60000 };
      QZD.stateIO.pushLog('harem', '召幸「' + c.name + '」，喜讯有孕 · 喜爱 +' +
        favorGain + ' · 宠爱 +' + doteGain + ' · 受孕率 ' + Math.round(rate * 100) + '%');
      /* 事件剧情：喜讯当下强推（孕期仅30分钟，随机 roll 几乎必错过） */
      if(QZD.story && QZD.story.onEvent) QZD.story.onEvent('conceive', c);
    }else if(isSleep){
      QZD.stateIO.pushLog('harem', '召幸「' + c.name + '」，未得喜讯 · 喜爱 +' +
        favorGain + ' · 宠爱 +' + doteGain + ' · 受孕率 ' + Math.round(rate * 100) + '%');
    }else{
      QZD.stateIO.pushLog('harem', '与「' + c.name + '」' + modeName + ' · 喜爱 +' +
        favorGain + ' · 宠爱 +' + doteGain + '（不判喜讯）');
    }
    QZD.stateIO.save();

    /* S2：每种相处方式都是剧情触发入口 */
    if(QZD.story && QZD.story.onSummon) QZD.story.onSummon(c, dlg.modeId, sceneTag);

    return { ok: true, success: pregnant, rate: rate, consort: c, dialogue: dlg,
             dueAt: c.pregnant ? c.pregnant.dueAt : null,
             modeId: dlg.modeId, modeName: modeName, scene: sceneTag,
             isSleep: isSleep, favorGain: favorGain, doteGain: doteGain };
  }

  /* 孕期阶段：早(0–1/3) 引导文采 lit、中(1/3–2/3) 引导理政 gov、晚(2/3–1) 引导用兵 war */
  var VISIT_STAGES = [
    { key:'early', name:'初孕', attr:'lit', lo:0,   hi:1/3 },
    { key:'mid',   name:'中期', attr:'gov', lo:1/3, hi:2/3 },
    { key:'late',  name:'临盆', attr:'war', lo:2/3, hi:1.01 }
  ];
  function pregnancyStage(p, now){
    if(!p || !p.dueAt) return null;
    var total = Math.max(1, p.dueAt - (p.conceivedAt || (p.dueAt - QZD.config.HAREM.PREGNANCY_MIN * 60000)));
    var t = Math.max(0, Math.min(1, ((now || Date.now()) - (p.conceivedAt || 0)) / total));
    var name = t < 1/3 ? '初孕' : (t < 2/3 ? '中期' : '临盆');
    return { t: t, pct: Math.floor(t * 100), name: name,
             remainMin: Math.max(0, Math.ceil((p.dueAt - (now || Date.now())) / 60000)),
             visits: (p.visits || []).length };
  }
  /* 探视：花勤政值，按当前阶段引导皇子一项先天。
     ★ 孕期 10h，探视是把「等待」变成「经营」的核心动作。 */
  function visitPregnant(id){
    var c = findById(consorts(), id);
    if(!c || !c.pregnant) return { ok: false, error: '她并未有孕' };
    var H = QZD.config.HAREM, p = c.pregnant;
    var visits = Array.isArray(p.visits) ? p.visits : (p.visits = []);
    if(visits.length >= (H.VISIT_MAX || 6)) return { ok: false, error: '探视已足，静待临盆罢' };
    var cost = H.VISIT_COST_QIN || 8;
    if((state().resources.qinZheng || 0) + 1e-9 < cost)
      return { ok: false, error: '勤政值不足（探视需 ' + cost + '）' };
    QZD.resources.remove({ qinZheng: cost });
    var st = pregnancyStage(p, Date.now());
    var stage = VISIT_STAGES.filter(function(s){ return s.name === st.name; })[0];
    visits.push({ at: Date.now(), stage: stage.key, attr: stage.attr });
    QZD.stateIO.pushLog('harem', '探视「' + c.name + '」· ' + stage.name +
      '陪伴，皇子先天' + ({ lit:'文采', gov:'理政', war:'用兵' })[stage.attr] +
      '有望 +' + (H.VISIT_ATTR_BONUS || 3) + ' · 耗勤政 ' + cost);
    QZD.stateIO.save();
    return { ok: true, name: c.name, stage: stage.name, attr: stage.attr,
             visits: visits.length, cost: cost };
  }

  function makePrince(mother, bornAt){
    var used = {};
    princes().forEach(function(p){ used[p.name] = true; });
    var seq = princes().length + 1;
    var name = '';
    for(var i = 0; i < 200; i++){
      name = pick(P.GIVEN);
      if(!used[name]) break;
    }
    if(used[name]) name = pick(P.GIVEN) + seq;

    var e = state().emperor;
    var H = QZD.config.HAREM;
    var bonus = { war:0, gov:0, lit:0 };
    /* 探视加成：每次按当时阶段给对应属性 +N，封顶 PRINCE.ATTR_MAX */
    (mother.pregnant && mother.pregnant.visits ? mother.pregnant.visits : []).forEach(function(v){
      if(v && bonus[v.attr] != null) bonus[v.attr] += (H.VISIT_ATTR_BONUS || 3);
    });
    var cap = QZD.config.PRINCE.ATTR_MAX || 120;
    return {
      id: 'prince-' + Date.now().toString(36) + '-' + randInt(100000, 999999).toString(36),
      name: name,
      seq: seq,
      motherId: mother.id,
      motherName: mother.name,
      bornAt: bornAt,
      war: Math.min(cap, QZD.formulas.princeAttr(e.yuLue, mother.ti) + bonus.war),
      gov: Math.min(cap, QZD.formulas.princeAttr(e.mingDe, mother.cai) + bonus.gov),
      lit: Math.min(cap, QZD.formulas.princeAttr(e.ningShen, mother.cai) + bonus.lit),
      visitCount: Object.keys(bonus).reduce(function(s,k){ return s + (bonus[k] ? 1 : 0); }, 0),
      /* 出生即入襁褓，24h 后成年；每段教养一次 */
      stage: 'infant',
      growthEdu: {}
    };
  }

  /* 每秒检查孕期；到期者临盆，可一次补算多胎（含离线） */
  function settle(now){
    now = now || Date.now();
    var born = [];
    consorts().forEach(function(c){
      var p = c.pregnant;
      if(!p || !p.dueAt || now < p.dueAt) return;
      var prince = makePrince(c, p.dueAt);
      princes().push(prince);
      c.pregnant = null;
      born.push({ mother: c, prince: prince });
      QZD.stateIO.pushLog('harem', '寝宫喜讯，「' + c.name + '」诞下皇子「' +
        prince.name + '」 · 用兵 ' + prince.war + ' · 理政 ' + prince.gov + ' · 文采 ' + prince.lit);
      /* 事件剧情：诞子当刻强推，不随每日 roll；专注中只落数据不弹窗 */
      if(QZD.story && QZD.story.onEvent){
        var quiet = !!(QZD.pomodoro && QZD.pomodoro.isActive &&
          QZD.pomodoro.isActive() && QZD.state.settings && QZD.state.settings.focusQuiet);
        QZD.story.onEvent('birth', c, { quiet: quiet });
      }
    });
    if(born.length) QZD.stateIO.save();
    /* 皇子阶段推进：与临盆同一主循环，离线也按到期时刻补算 */
    settlePrinceGrowth(now);
    return born;
  }

  function restore(){
    var born = settle(Date.now());
    return born.length ? born : null;
  }

  QZD.harem = {
    list: consorts,
    princes: princes,
    activePrinces: activePrinces,
    retiredPrinces: retiredPrinces,
    consortById: function(id){ return findById(consorts(), id); },
    summonCost: H.SUMMON_COST_QIN,
    personalityName: personalityName,
    personalityCoef: personalityCoef,
    personalityDesc: personalityDesc,
    companionGreeting: companionGreeting,
    companionDoing: companionDoing,
    grantAffection: grantAffection,
    buildDialogue: buildDialogue,
    rateOf: function(c){ return QZD.formulas.conceptionRate(c ? c.ti : 0); },
    pregnantCount: function(){
      return consorts().filter(function(c){ return !!c.pregnant; }).length;
    },
    hasPregnant: function(){
      return consorts().some(function(c){ return !!c.pregnant; });
    },
    summon: summon,
    settle: settle,
    restore: restore,
    /* 位份 / 皇子消耗 */
    rankTitle: rankTitle,
    rankOf: rankOf,
    isMaxRank: isMaxRank,
    doteMaxOf: doteMaxOf,
    favorMaxOf: favorMaxOf,
    promoteNeed: promoteNeed,
    promoteReady: promoteReady,
    ennobleCost: ennobleCost,
    ennoble: ennoble,
    summonCostOf: summonCostOf,
    trainPrince: trainPrince,
    pregnancyStage: pregnancyStage,
    visitPregnant: visitPregnant,
    princeGrowth: princeGrowth,
    settlePrinceGrowth: settlePrinceGrowth,
    educatePrince: educatePrince,
    princeToMinister: princeToMinister,
    retirePrince: retirePrince,
    restorePrince: restorePrince,
    /* 稀世妃嫔 / 姿态切换 */
    rareRemaining: rareRemaining,
    rareCost: rareCost,
    recruitRare: recruitRare,
    gacha: gacha,
    gachaCost: gachaCost,
    commitConsorts: commitConsorts,
    /* 供回归测试精确验证「候选→正式」血脉透传与稀世概率 */
    finalizeConsort: finalizeConsort,
    makeCandidate: makeCandidate,
    makeRareConsort: makeRareConsort,
    setPose: setPose,
    cyclePose: cyclePose
  };
})();
