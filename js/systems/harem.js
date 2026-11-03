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

  function princes(){
    if(!Array.isArray(QZD.state.princes)) QZD.state.princes = [];
    return QZD.state.princes;
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
  function personalityDesc(key){
    var list = QZD.config.PERSONALITIES || [];
    for(var i = 0; i < list.length; i++){
      if(list[i].key === key) return list[i].desc || '';
    }
    return '';
  }

  /* 专注陪伴问候：按性格从 HAREM_COMPANION 随机取一句（只读，不改数值） */
  function companionGreeting(c){
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
  function rankTitle(c){ return rankList()[rankOf(c)]; }
  function isMaxRank(c){ return rankOf(c) >= rankList().length - 1; }
  function ennobleCost(c){
    var R = QZD.config.RANK;
    var r = rankOf(c);
    return {
      jin: R.COST_JIN + r * R.COST_JIN_STEP,
      sw: R.COST_SW + r * R.COST_SW_STEP
    };
  }
  function ennoble(id){
    var c = findById(consorts(), id);
    if(!c) return { ok: false, error: '妃嫔不在后宫' };
    if(isMaxRank(c)) return { ok: false, error: '已至贵妃，无可再封' };
    var cost = ennobleCost(c);
    if((state().resources.jinQian || 0) + 1e-9 < cost.jin){
      return { ok: false, error: '金钱不足（册封需 ' + cost.jin + '）' };
    }
    if((state().resources.shengWang || 0) + 1e-9 < cost.sw){
      return { ok: false, error: '声望不足（册封需 ' + cost.sw + '）' };
    }
    QZD.resources.remove({ jinQian: cost.jin, shengWang: cost.sw });
    c.rank = rankOf(c) + 1;
    var D = QZD.config.DOTE;
    c.dote = Math.max(0, Math.min(D.MAX, (c.dote || 0) + (QZD.config.RANK.DOTE_GAIN || 0)));
    QZD.stateIO.pushLog('harem', '册封「' + c.name + '」为「' + rankTitle(c) +
      '」 · 耗金钱 ' + cost.jin + ' · 声望 ' + cost.sw);
    QZD.stateIO.save();
    return { ok: true, consort: c, title: rankTitle(c), cost: cost };
  }
  /* 位份越高，召幸耗勤政越少（不低于 SUMMON_MIN） */
  function summonCostOf(c){
    var R = QZD.config.RANK;
    var base = Math.max(R.SUMMON_MIN, H.SUMMON_COST_QIN - rankOf(c) * R.SUMMON_CUT);
    return Math.round(base * (QZD.study ? QZD.study.multiplier() : 1));
  }

  /* ---------- 皇子消耗：培养 / 入朝为臣 ---------- */
  function trainPrince(id){
    var p = findById(princes(), id);
    if(!p) return { ok: false, error: '皇子不存在' };
    var R = QZD.config.PRINCE;
    var n = Math.max(0, Math.floor(Number(p.trainCount) || 0));
    var cost = R.TRAIN_COST + n * R.TRAIN_STEP;
    if((state().resources.jinQian || 0) + 1e-9 < cost){
      return { ok: false, error: '金钱不足（培养需 ' + cost + '）' };
    }
    QZD.resources.remove({ jinQian: cost });
    var keys = ['war', 'gov', 'lit'];
    var key = pick(keys);
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
    var p = findById(princes(), id);
    if(!p) return { ok: false, error: '皇子不存在' };
    var cost = QZD.config.PRINCE.MINISTER_COST_SW || 0;
    if((state().resources.shengWang || 0) + 1e-9 < cost){
      return { ok: false, error: '声望不足（入朝需 ' + cost + '）' };
    }
    if(cost > 0) QZD.resources.remove({ shengWang: cost });
    if(!Array.isArray(state().ministers)) state().ministers = [];
    var m = {
      id: 'min-' + p.id,
      name: p.name,
      war: p.war || 0,
      gov: p.gov || 0,
      lit: p.lit || 0,
      createdAt: Date.now(),
      fielded: false,
      fromPrince: true
    };
    state().ministers.push(m);
    var idx = princes().indexOf(p);
    if(idx >= 0) princes().splice(idx, 1);
    QZD.stateIO.pushLog('harem', '皇子「' + p.name + '」入朝为臣 · 耗声望 ' + cost +
      ' · 用兵 ' + m.war + ' · 理政 ' + m.gov + ' · 文采 ' + m.lit);
    QZD.stateIO.save();
    return { ok: true, minister: m, cost: cost };
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
    return {
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
      favor: randInt(R.FAVOR_MIN || 25, R.FAVOR_MAX || 45),
      dote: ((QZD.config.DOTE ? QZD.config.DOTE.INIT : 0) + 10),
      rank: 0,
      joinedAt: Date.now(),
      pregnant: null
    };
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

  /* 单抽：返回 {rarity, consort}（consort 为候选结构，入宫时才转正）。
     usedRare 为本次抽卡已出现的绝色 key 集合，避免同一抽卡内重复绝色（即便尚未入宫） */
  function rollOnce(used, usedImg, usedRare){
    var G = QZD.config.GACHA || {};
    var rarity = rollRarity();

    /* 绝色：优先取稀世立绘；已抽尽则降级为稀有 */
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
    var c = makeCandidate(used);
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

  function makeCandidate(used){
    var name = '';
    for(var i = 0; i < 200; i++){
      name = pick(X.SURNAMES) + pick(X.GIVEN);
      if(!used[name]) break;
    }
    used[name] = true;
    var F = QZD.config.FAVOR;
    var initFavor = randInt(F.INIT_MIN != null ? F.INIT_MIN : F.INIT,
                            F.INIT_MAX != null ? F.INIT_MAX : F.INIT);
    return {
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
      favor: initFavor,                                  /* 入宫初始喜爱度（随机） */
      dote: (QZD.config.DOTE ? QZD.config.DOTE.INIT : 0),/* 入宫初始宠爱度（帝→妃） */
      createdAt: Date.now()
    };
  }

  /* 召幸：耗勤政值，提升喜爱度，生成性格对话；有孕者不可再召 */
  function summon(id){
    var c = findById(consorts(), id);
    if(!c) return { ok: false, error: '妃嫔不在后宫' };
    if(c.pregnant) return { ok: false, error: '有孕在身，暂不宜召幸' };
    var costQin = summonCostOf(c);
    if(state().resources.qinZheng + 1e-9 < costQin){
      return { ok: false, error: '勤政值不足（需 ' + costQin + '）' };
    }

    QZD.resources.remove({ qinZheng: costQin });
    /* 喜爱度提升（妃→帝）：基础值再乘该性格的好感系数，封顶 MAX */
    var F = QZD.config.FAVOR, D = QZD.config.DOTE;
    var coef = personalityCoef(c.personality);
    var favorGain = Math.round(F.PER_SUMMON * coef);
    c.favor = Math.max(0, Math.min(F.MAX, (c.favor || 0) + favorGain));
    /* 宠爱度提升（帝→妃）：昭幸即宠，封顶 MAX */
    c.dote = Math.max(0, Math.min(D.MAX, (c.dote || 0) + D.PER_SUMMON));

    var rate = QZD.formulas.conceptionRate(c.ti);
    var pregnant = Math.random() < rate;
    var dlg = buildDialogue(c, pregnant);

    if(pregnant){
      var now = Date.now();
      c.pregnant = { conceivedAt: now, dueAt: now + H.PREGNANCY_MIN * 60000 };
      QZD.stateIO.pushLog('harem', '召幸「' + c.name + '」，喜讯有孕 · 喜爱 +' +
        favorGain + ' · 宠爱 +' + D.PER_SUMMON + ' · 受孕率 ' + Math.round(rate * 100) + '%');
    }else{
      QZD.stateIO.pushLog('harem', '召幸「' + c.name + '」，未得喜讯 · 喜爱 +' +
        favorGain + ' · 宠爱 +' + D.PER_SUMMON + ' · 受孕率 ' + Math.round(rate * 100) + '%');
    }
    QZD.stateIO.save();
    return { ok: true, success: pregnant, rate: rate, consort: c, dialogue: dlg,
             dueAt: c.pregnant ? c.pregnant.dueAt : null };
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
    return {
      id: 'prince-' + Date.now().toString(36) + '-' + randInt(100000, 999999).toString(36),
      name: name,
      seq: seq,
      motherId: mother.id,
      motherName: mother.name,
      bornAt: bornAt,
      war: QZD.formulas.princeAttr(e.yuLue, mother.ti),
      gov: QZD.formulas.princeAttr(e.mingDe, mother.cai),
      lit: QZD.formulas.princeAttr(e.ningShen, mother.cai)
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
    });
    if(born.length) QZD.stateIO.save();
    return born;
  }

  function restore(){
    var born = settle(Date.now());
    return born.length ? born : null;
  }

  QZD.harem = {
    list: consorts,
    princes: princes,
    consortById: function(id){ return findById(consorts(), id); },
    summonCost: H.SUMMON_COST_QIN,
    personalityName: personalityName,
    personalityCoef: personalityCoef,
    personalityDesc: personalityDesc,
    companionGreeting: companionGreeting,
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
    ennobleCost: ennobleCost,
    ennoble: ennoble,
    summonCostOf: summonCostOf,
    trainPrince: trainPrince,
    princeToMinister: princeToMinister,
    /* 稀世妃嫔 / 姿态切换 */
    rareRemaining: rareRemaining,
    rareCost: rareCost,
    recruitRare: recruitRare,
    gacha: gacha,
    gachaCost: gachaCost,
    commitConsorts: commitConsorts,
    setPose: setPose,
    cyclePose: cyclePose
  };
})();
