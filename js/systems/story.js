/* ============================================================
   systems/story.js · S1 剧情系统骨架
   ------------------------------------------------------------
   规则（对应评审稿第十二章）：
   - 条件决定「谁有资格」，概率只决定「哪天发生」
   - 每天至多一次判定、至多推进 1 个节点；条件满足即入池，
     attempts 按天累计，达 PITY 必中（不会让故事线碎掉）
   - 首章命中写死 ownerId，此后该线所有节点只由她触发（首触认领）
   - 每人 1 主线 + 2 支线；未认领线优先分给尚无主线的妃子
   - 旧档一次性追认，避免老妃子像失忆
   - 只在开机 / 专注收工 / 跨日跑，focusQuiet 专注中不弹
   - 节点写入她的 memory[]、里程碑、起居注（含「因由」），
     终章可解锁专属称呼（不可逆）
   ============================================================ */
(function(){
  var CFG  = QZD.config.STORY || {};
  var LINES = QZD.config.STORY_LINES || [];

  function S(){
    var s = QZD.state;
    if(!s.story || typeof s.story !== 'object') s.story = {};
    var g = s.story;
    if(typeof g.version !== 'number') g.version = 1;
    if(!g.lines || typeof g.lines !== 'object' || Array.isArray(g.lines)) g.lines = {};
    if(!Array.isArray(g.history)) g.history = [];
    if(!g.attempts || typeof g.attempts !== 'object' || Array.isArray(g.attempts)) g.attempts = {};
    if(typeof g.retroDone !== 'boolean') g.retroDone = false;
    if(typeof g.lastRollDate !== 'string') g.lastRollDate = '';
    if(typeof g.lastNodeDate !== 'string') g.lastNodeDate = '';
    if(typeof g.lastSeenDate !== 'string') g.lastSeenDate = '';
    if(typeof g.lastReunionDate !== 'string') g.lastReunionDate = '';
    if(typeof g.forceUsedDate !== 'string') g.forceUsedDate = '';
    if(!Array.isArray(g.recentFragments)) g.recentFragments = [];
    if(!g.fragmentOwner || typeof g.fragmentOwner !== 'object' || Array.isArray(g.fragmentOwner)){
      g.fragmentOwner = {};
    }
    /* 已出现过的片段 id 集合（用于「未见过优先」加权与覆盖率统计）。
       旧档无此字段 → 补空对象；不预填 recentFragments，让老玩家也能把库轮一遍。 */
    if(!g.seen || typeof g.seen !== 'object' || Array.isArray(g.seen)) g.seen = {};
    if(!g.lastSummon || typeof g.lastSummon !== 'object') g.lastSummon = null;
    return g;
  }
  function intimacy(c){
    return (QZD.formulas && QZD.formulas.intimacyOf)
      ? QZD.formulas.intimacyOf(c)
      : { score: 0, index: 0, key: 'sheng', name: '生疏', label: '' };
  }
  /* 景物按情境 + 时辰取，不再每场都写死雨打芭蕉 */
  function scene(tag, ctx){
    var bank = QZD.config.SCENE_BANK || {};
    var keys = [];
    if(tag) keys.push(tag);
    /* only=true：只取指定词库，不再叠时辰景物。
       榻前片段已写足屋外景，过场只补一句室内定格，避免雨/花景重复。 */
    if(!(ctx && ctx.only)){
      if(ctx && ctx.hour != null && (ctx.hour >= 19 || ctx.hour < 6)) keys.push('light');
      else keys.push('bloom');
    }
    var pool = [];
    keys.forEach(function(k){ pool = pool.concat(bank[k] || []); });
    if(!pool.length) pool = bank.rain || [];
    if(!pool.length) return '';
    var seed = (ctx && ctx.at ? ctx.at : Date.now()) + (ctx && ctx.consort && ctx.consort.id
      ? ctx.consort.id.length : 0);
    return pool[seed % pool.length];
  }
  function esc(s){
    return String(s == null ? '' : s).replace(/[&<>"']/g, function(ch){
      return '&#' + ch.charCodeAt(0) + ';';
    });
  }
  function today(){ return QZD.stateIO.todayStr(); }
  function list(){
    return (QZD.harem && QZD.harem.list) ? QZD.harem.list().filter(Boolean) : [];
  }
  function dayGap(a, b){
    if(!a || !b) return 0;
    var x = Date.parse(a + 'T00:00:00'), y = Date.parse(b + 'T00:00:00');
    if(!isFinite(x) || !isFinite(y)) return 0;
    return Math.max(0, Math.round((y - x) / 86400000));
  }
  /* 只读地取 life 数据：L2 未加载或旧档时也不报错 */
  function lifeOf(c){
    var l = (c && c.life && typeof c.life === 'object') ? c.life : {};
    return {
      hobby: l.hobby || c.trait || '善琴',
      level: typeof l.level === 'number' ? l.level : 0,
      points: typeof l.points === 'number' ? l.points : 0,
      purchases: Array.isArray(l.purchases) ? l.purchases : [],
      wish: typeof l.wish === 'string' ? l.wish : ''
    };
  }
  function lineById(id){
    for(var i = 0; i < LINES.length; i++) if(LINES[i].id === id) return LINES[i];
    return null;
  }
  function owned(st, c){
    var main = 0, side = 0, ids = [];
    Object.keys(st.lines).forEach(function(k){
      var rec = st.lines[k];
      if(!rec || rec.ownerId !== c.id) return;
      var ln = lineById(k);
      if(!ln) return;
      if(ln.kind === 'main') main++; else side++;
      ids.push(k);
    });
    return { main: main, side: side, total: main + side, ids: ids };
  }
  function inList(v, x){
    if(v == null) return true;
    return (Array.isArray(v) ? v : [v]).indexOf(x) >= 0;
  }

  /* ---------- 志怪血脉：共振异象 / 分叉终章 ----------
     凡俗（旧档默认）永远走不到这里；血脉不写进名册与台词，
     只在剧情事件里以「异象」自然带出，藏几章由性格决定。 */
  function bloodOf(c){ return c.blood || 'ren'; }
  function veilAt(c){
    var B = QZD.config.BLOOD || {};
    var v = (B.VEIL_AT || {})[c.personality || 'wen'];
    return typeof v === 'number' ? v : 2;
  }
  function resonanceFor(c){
    var arr = QZD.config.BLOOD_RESONANCE || [];
    for(var i = 0; i < arr.length; i++){
      if(arr[i].blood === bloodOf(c) && arr[i].trait === c.trait) return arr[i];
    }
    return null;
  }
  function endingFor(c){
    var E = QZD.config.BLOOD_ENDINGS || {};
    var g = (E.map || {})[bloodOf(c)];
    return g && (E.groups || {})[g] ? E.groups[g] : null;
  }

  /* 条件匹配：全部满足才算入池。条件写成可读情境，不是黑箱权重 */
  function matchWhen(when, c, ctx, st){
    if(!when) return true;
    var w = when, l = lifeOf(c), i;
    if(w.isQueen != null && !!c.isQueen !== !!w.isQueen) return false;
    if(w.trait && !inList(w.trait, c.trait)) return false;
    if(w.notTrait && inList(w.notTrait, c.trait)) return false;
    /* 志怪血脉：blood/notBlood 决定「谁有资格」，veil 决定「藏到第几章」。
       旧档无字段时按凡俗处理，凡俗永不进入任何志怪线。 */
    var blood = c.blood || 'ren';
    if(w.blood && !inList(w.blood, blood)) return false;
    if(w.notBlood && inList(w.notBlood, blood)) return false;
    if(w.veil != null && !!c.veil !== !!w.veil) return false;
    if(w.personality && !inList(w.personality, c.personality)) return false;
    if(w.origin && !inList(w.origin, c.origin)) return false;
    if(w.hometown && !inList(w.hometown, c.hometown)) return false;
    if(w.hobbyLevelMin != null && l.level < w.hobbyLevelMin) return false;
    if(w.pointsMin != null && l.points < w.pointsMin) return false;
    if(w.purchasesMin != null && l.purchases.length < w.purchasesMin) return false;
    if(w.lastPurchaseId){
      var last = l.purchases.length ? l.purchases[l.purchases.length - 1] : null;
      if(!last || last.id !== w.lastPurchaseId) return false;
    }
    if(w.purseMin != null && (c.purse || 0) < w.purseMin) return false;
    if(w.purseMax != null && (c.purse || 0) > w.purseMax) return false;
    if(w.hasWish != null && !!l.wish !== !!w.hasWish) return false;
    if(w.favorMin != null && (c.favor || 0) < w.favorMin) return false;
    if(w.doteMin != null && (c.dote || 0) < w.doteMin) return false;
    if(w.rankMin != null && (c.rank || 0) < w.rankMin) return false;
    if(w.rankMax != null && (c.rank || 0) > w.rankMax) return false;
    if(w.pregnant != null && !!c.pregnant !== !!w.pregnant) return false;
    if(w.linesOwnedMin != null && owned(st, c).total < w.linesOwnedMin) return false;
    if(w.streakMin != null){
      var study = QZD.state.study || {};
      if((study.streak || 0) < w.streakMin) return false;
    }
    if(w.gapDaysMin != null && ctx.gapDays < w.gapDaysMin) return false;
    if(w.gapDaysMax != null && ctx.gapDays > w.gapDaysMax) return false;
    var dLevel = ctx.dynastyLevel || 'calm';
    var dStab = (typeof ctx.stability === 'number' ? ctx.stability : 80);
    if(w.dynastyLevel && !inList(w.dynastyLevel, dLevel)) return false;
    if(w.stabilityMin != null && dStab < w.stabilityMin) return false;
    if(w.stabilityMax != null && dStab > w.stabilityMax) return false;
    if(w.returning != null && !!ctx.returning !== !!w.returning) return false;
    if(w.focusDone != null && !!ctx.focusDone !== !!w.focusDone) return false;
    if(w.hour){
      var night = (ctx.hour >= 19 || ctx.hour < 6);
      if(w.hour === 'night' && !night) return false;
      if(w.hour === 'day' && night) return false;
    }
    return true;
  }

  function buildCtx(source, extra){
    var st = S(), t = today(), gap = dayGap(st.lastSeenDate, t);
    var study = QZD.state.study || {};
    var dyn = QZD.state.dynasty || {};
    var quiet = !!(QZD.state.settings && QZD.state.settings.focusQuiet &&
                   QZD.pomodoro && QZD.pomodoro.isActive && QZD.pomodoro.isActive());
    var ctx = {
      at: Date.now(), date: t, source: source || 'launch',
      hour: new Date().getHours(),
      gapDays: gap, returning: gap >= 2,
      focusDone: (study.date === t && (study.doneMin || 0) > 0),
      /* 国势接入剧情条件：边患 / 拨乱反正时可与血脉、才艺组合 */
      stability: (typeof dyn.stability === 'number' ? dyn.stability : 80),
      dynastyLevel: dyn.level || 'calm',
      quiet: quiet
    };
    if(extra){
      for(var k in extra) if(Object.prototype.hasOwnProperty.call(extra, k)) ctx[k] = extra[k];
    }
    st.lastSeenDate = t;
    return ctx;
  }

  function weightedPick(arr, rnd){
    if(!arr.length) return null;
    var sum = 0, i;
    for(i = 0; i < arr.length; i++) sum += (arr[i].weight || 1);
    var r = rnd() * sum;
    for(i = 0; i < arr.length; i++){
      r -= (arr[i].weight || 1);
      if(r <= 0) return arr[i];
    }
    return arr[arr.length - 1];
  }

  /* 组装今日候选：每条线一个条目，内含所有合格的妃子 */
  function candidates(ctx, st){
    var cs = list(), out = [];
    LINES.forEach(function(line){
      var rec = st.lines[line.id];
      var node, pool, claimed;
      if(rec){
        node = line.nodes[rec.stage];       /* 已认领 → 下一章 */
        if(!node) return;                   /* 已终章 */
        pool = cs.filter(function(c){ return c.id === rec.ownerId; });
        claimed = true;
      }else{
        node = line.nodes[0];
        if(!node || !node.claim) return;
        pool = cs;
        claimed = false;
      }
      var ok = [];
      pool.forEach(function(c){
        var own = owned(st, c);
        if(!claimed){
          if(line.kind === 'main' && own.main >= (CFG.MAX_MAIN || 1)) return;
          if(line.kind !== 'main' && own.side >= (CFG.MAX_SIDE || 2)) return;
        }
        if(!matchWhen(node.when, c, ctx, st)) return;
        var w = 1 + (c.favor || 0) / 200;
        if(!claimed && own.main === 0) w *= 2;      /* 未认领线优先给尚无主线者 */
        /* 主动相处是一次强情境：优先把故事给她，但不绝对排除别人 */
        if(ctx.summonConsortId && c.id === ctx.summonConsortId) w *= 3;
        ok.push({ consort: c, weight: w });
      });
      if(!ok.length) return;
      out.push({
        lineId: line.id, line: line, node: node, claimed: claimed, consorts: ok,
        weight: (line.kind === 'main' ? 1.5 : 1) * (claimed ? 1 : 1.2)
      });
    });
    return out;
  }

  function applyNode(pick, ctx, st){
    var line = pick.line, node = pick.node, c = pick.consort;
    var isClaim = !pick.claimed && !!node.claim;
    var stage;
    if(isClaim){
      st.lines[line.id] = {
        ownerId: c.id, stage: 1, flags: {}, chances: 0,
        claimedAt: ctx.at, lastAt: ctx.at
      };
      stage = 1;
    }else{
      var rec = st.lines[line.id];
      rec.stage = (rec.stage || 0) + 1;
      rec.lastAt = ctx.at;
      stage = rec.stage;
    }
    st.attempts[line.id] = 0;

    /* 志怪分叉：终章按血脉落点替换正文 / 因由 / 专属奖励（凡俗不触发） */
    var text = node.text, reason = node.reason, reward = node.reward, omen = '';
    if(node.endingBy === 'blood'){
      var end = endingFor(c);
      if(end){
        text = end.text || text;
        reason = end.reason || reason;
        reward = end.reward || reward;
      }
    }
    /* 异象：血脉默认隐藏，按性格藏够章数才露；露的那一章把共振格
       的「反常现象」附在剧情之后，不点破身份、不改名册、不进台词。 */
    if(bloodOf(c) !== 'ren' && !c.veil && stage >= veilAt(c)){
      c.veil = true;
      var res = resonanceFor(c);
      if(res && res.text) omen = res.text;
    }

    /* 专属剧情可指定场合换装（如就寝/朝会），玩家手动选过装扮后不覆盖 */
    if(node.outfit && QZD.queen && QZD.queen.autoDress) QZD.queen.autoDress(node.outfit);

    /* 她的共同记忆 + 里程碑 */
    if(!Array.isArray(c.memory)) c.memory = [];
    c.memory.push({ at: ctx.at, lineId: line.id, lineName: line.name,
                    nodeId: node.id, stage: stage, text: text, reason: reason,
                    omen: omen });
    while(c.memory.length > (CFG.MAX_MEMORY || 40)) c.memory.shift();
    c.milestones = (typeof c.milestones === 'number' ? c.milestones : 0) + 1;
    /* 终章奖励：专属称呼 / 口癖 / 姿态，一律不可逆、不可转移 */
    if(reward){
      if(reward.address && !c.address) c.address = reward.address;
      if(reward.phrase && !c.phrase) c.phrase = reward.phrase;
      if(reward.pose && !c.storyPose) c.storyPose = reward.pose;
    }

    /* 全局历史 + 起居注（带因由，回看时知道为何发生） */
    st.history.push({ at: ctx.at, lineId: line.id, nodeId: node.id,
                      consortId: c.id, consortName: c.name, stage: stage,
                      reason: reason });
    while(st.history.length > (CFG.MAX_HISTORY || 60)) st.history.shift();
    QZD.stateIO.pushLog('story',
      '「' + c.name + '」· ' + line.name + ' 第 ' + stage + ' 章 · ' +
      (isClaim ? '首触认领' : '专属续章') + ' —— ' + text +
      '（因由：' + reason + '）' +
      (reward && reward.address ? ' · 得专属称呼「' + reward.address + '」' : '') +
      (reward && reward.phrase ? ' · 此后只她会说「' + reward.phrase + '」' : '') +
      (omen ? '　【异象】' + omen : ''));

    st.lastNodeDate = ctx.date;
    QZD.stateIO.save();
    return {
      ok: true, lineId: line.id, lineName: line.name, nodeId: node.id,
      consortId: c.id, consortName: c.name, stage: stage,
      total: line.nodes.length, text: text, reason: reason, omen: omen,
      claimed: isClaim, address: (reward && reward.address) || null,
      phrase: (reward && reward.phrase) || null,
      pose: (reward && reward.pose) || null
    };
  }

  /* 每日一次判定：条件满足 → attempts 累计 → 保底或概率 → 抽线抽人
     force=true 用于「主动相处」这类玩家付出过一次行动的情境，跳过概率，
     但仍遵守每日一次与 focusQuiet，不变成刷剧情。 */
  function roll(ctx, rnd, force){
    var st = S();
    ctx = ctx || buildCtx('roll');
    rnd = rnd || Math.random;
    if(ctx.quiet) return { ok: false, reason: '专注中，故事暂且不扰' };
    if(st.lastRollDate === ctx.date){
      /* 主动相处每日可再推进一次；自然判定仍严格每日一次 */
      if(force && st.forceUsedDate !== ctx.date){
        st.forceUsedDate = ctx.date;
      }else{
        return { ok: false, reason: '今日已试过，明日再来' };
      }
    }
    var cs = candidates(ctx, st);
    if(!cs.length){
      /* 无候选不消耗当天机会：此后选秀入宫 / 完成专注仍可再试 */
      QZD.stateIO.save();
      return { ok: false, reason: '今日无人合得上情境' };
    }
    st.lastRollDate = ctx.date;
    if(force) st.forceUsedDate = ctx.date;
    cs.forEach(function(x){
      st.attempts[x.lineId] = (st.attempts[x.lineId] || 0) + 1;
    });
    var pity = CFG.PITY || 4;
    var forced = cs.filter(function(x){ return st.attempts[x.lineId] >= pity; });
    var pool = force ? cs : (forced.length ? forced : (rnd() < (CFG.BASE_CHANCE || 0.55) ? cs : []));
    if(!pool.length){
      QZD.stateIO.save();
      return { ok: false, reason: '条件已在，只是今日未逢其时', attempts: st.attempts };
    }
    var linePick = weightedPick(pool, rnd);
    var consortPick = weightedPick(linePick.consorts, rnd);
    var res = applyNode({
      line: linePick.line, node: linePick.node,
      claimed: linePick.claimed, consort: consortPick.consort
    }, ctx, st);
    /* S2：剧情交给对话框呈现（会等其它弹窗关闭），不打断专注与分配面板 */
    queuePresent(res);
    /* 没有弹窗能力时退回 toast，保证仍有反馈 */
    if(QZD.ui && QZD.ui.toast && !QZD.ui.modal){
      var short = res.text.length > 26 ? res.text.slice(0, 26) + '…' : res.text;
      QZD.ui.toast('「' + res.consortName + '」· ' + res.lineName +
        ' 第 ' + res.stage + ' 章 · ' + short);
    }
    return res;
  }

  /* ---------- S2 情景片段池 ----------
     按 情境 tag × 才艺 × 性格 × 浓度档 条件先筛；7 天冷却不重复；
     claim 的片段首触认领后归该妃专属，别人再也抽不到。 */
  /* 时段键：与 INTIMACY_TIME 边界一致（5–11 清晨 / 11–17 日中 / 其余入夜）。
     供片段的 hourWindow 过滤用；未传 hour 时不生效。 */
  function hourKey(hour){
    if(hour == null) return null;
    var h = Number(hour);
    if(isNaN(h)) return null;
    return (h >= 5 && h < 11) ? 'dawn' : ((h >= 11 && h < 17) ? 'noon' : 'night');
  }

  function fragment(ctx){
    var st = S(), now = Date.now(), arr = QZD.config.STORY_FRAGMENTS || [];
    var cd = (CFG.FRAGMENT_COOLDOWN_DAYS || 7) * 86400000;
    var inti = intimacy(ctx.consort || {});
    var hkey = hourKey(ctx.hour);
    /* match 的硬条件（tag / 情境 / 才艺 / 性格 / 浓度 / 专属认领）任何情况都生效；
       冷却是软条件，只有 allowCooldownFallback 时可在池空后忽略。 */
    function match(f, ignoreCooldown){
      if(ctx.tag && f.tag !== ctx.tag) return false;
      if(f.scene === 'return' && !ctx.returning) return false;
      if(f.trait && (!ctx.consort || f.trait !== ctx.consort.trait)) return false;
      if(f.personality && (!ctx.consort || f.personality !== ctx.consort.personality)) return false;
      /* 血脉段只给对应血脉；凡俗（含旧档默认）永远抽不到志怪隐藏剧情 */
      if(f.blood && (!ctx.consort || (ctx.consort.blood || 'ren') !== f.blood)) return false;
      if(f.hidden && ctx.allowHidden === false) return false;
      if(ctx.onlyHidden && !f.hidden) return false;   /* 只要隐藏段，抽不到就返回 null */
      if(f.minTier != null && inti.index < f.minTier) return false;
      /* 位分门槛：高位专属剧情（如贵妃的夜）只给达到该位分的妃嫔。
         未标 minRank 的片段不受影响，旧池照旧。 */
      if(f.minRank != null || f.maxRank != null){
        var crank = (ctx.consort && typeof ctx.consort.rank === 'number') ? ctx.consort.rank : 0;
        if(f.minRank != null && crank < f.minRank) return false;
        /* 上限：让「中位专属」不被高位独占，如 minRank2+maxRank3 只给婕妤~嫔 */
        if(f.maxRank != null && crank > f.maxRank) return false;
      }
      /* 时段过滤：只对显式标了 hourWindow 的片段生效；未标注的旧片段照旧放行。
         这样意识流段能按时辰出现（清晨不写雪夜、日中不写月色），又不打断原有文案池。 */
      if(f.hourWindow && hkey){
        var wins = Array.isArray(f.hourWindow) ? f.hourWindow : [f.hourWindow];
        if(wins.indexOf(hkey) < 0) return false;
      }
      /* 只取标注了时段的段：晨课借 bed 池时用，避免把未标时段的「榻前」段
         塞进清晨场景（未标注的旧段照旧可被其它入口抽到）。 */
      if(ctx.requireHourWindow && !f.hourWindow) return false;
      var owner = st.fragmentOwner[f.id];
      if(owner && (!ctx.consort || owner !== ctx.consort.id)) return false;
      if(!ignoreCooldown){
        for(var i = 0; i < st.recentFragments.length; i++){
          var r = st.recentFragments[i];
          if(r.id === f.id && now - r.at < cd) return false;
        }
      }
      return true;
    }
    var pool = arr.filter(function(f){ return match(f, false); });
    if(!pool.length && ctx.allowCooldownFallback){
      /* 侍寝是固定场景，不该因为「7 天内都用过」而整屏空白。
         冷却全满时允许回退，但优先取最久没出现的那一半，尽量不连着重复。 */
      pool = arr.filter(function(f){ return match(f, true); });
      if(pool.length > 1){
        var lastAt = {};
        st.recentFragments.forEach(function(r){ lastAt[r.id] = r.at; });
        pool.sort(function(a, b){ return (lastAt[a.id] || 0) - (lastAt[b.id] || 0); });
        pool = pool.slice(0, Math.max(1, Math.ceil(pool.length / 2)));
      }
    }
    if(!pool.length) return null;
    /* 性格加权：让「这一位妃子专属的别扭/羞涩」在低浓度也常被抽到。
       只加权重不独占，仍是条件先筛后抽，且只对显式传参的侍寝榻前生效。 */
    if(ctx.personalityBoost && ctx.consort && pool.length){
      var boosted = [];
      pool.forEach(function(f){
        boosted.push(f);
        if(f.personality === ctx.consort.personality){
          for(var k = 0; k < ctx.personalityBoost; k++) boosted.push(f);
        }
      });
      pool = boosted;
    }
    /* 隐藏段加权：侍寝/晨课时给血脉暗涌、掉马甲边缘更高权重。
       只加权不独占——仍由硬条件先筛，凡俗抽不到血脉段，普通段仍有机会。 */
    if(ctx.hiddenBoost && pool.length){
      var hb = [];
      pool.forEach(function(f){
        hb.push(f);
        if(f.hidden){
          for(var k = 0; k < ctx.hiddenBoost; k++) hb.push(f);
        }
      });
      pool = hb;
    }
    /* 未见过优先：把「从没出现过」的段加权，让 131 段的床帏库能轮转，
       而不是那十几段反复上场。只加权不独占；见过的段仍可再抽到（怀旧向也可关掉）。
       注意顺序：放在 personality/hidden 加权之后，三者叠乘生效。 */
    /* 注意：本文件顶部 var CFG = QZD.config.STORY，CFG 就是 STORY 本体，
       不要再写 CFG.STORY（会永远取默认值、开关失效）。 */
    var nb = CFG.NOVELTY_BOOST;
    if(nb == null) nb = 4;
    if(nb > 0 && pool.length){
      if(!st.seen || typeof st.seen !== 'object') st.seen = {};
      var nv = [];
      pool.forEach(function(f){
        nv.push(f);
        if(!st.seen[f.id]){ for(var k = 0; k < nb; k++) nv.push(f); }
      });
      pool = nv;
    }
    var rnd = ctx.rnd || Math.random;
    var f = pool[Math.floor(rnd() * pool.length) % pool.length];
    if(!st.seen || typeof st.seen !== 'object') st.seen = {};
    st.seen[f.id] = 1;   /* 记下已出现，下次不再享受未见加权 */
    st.recentFragments.push({
      id: f.id, at: now, tag: ctx.tag || '',
      consortId: ctx.consort ? ctx.consort.id : ''
    });
    /* 冷却记录按「冷却期」裁剪，而不是固定 40 条：
       片段池已扩到 100+ 段，固定 40 会把仍处冷却期的记录挤掉，
       导致同一段在 7 天内重复。上限给足（400）只作极端兜底。 */
    var keepMs = (CFG.FRAGMENT_COOLDOWN_DAYS || 7) * 86400000 + 86400000;
    st.recentFragments = st.recentFragments.filter(function(r){
      return now - r.at < keepMs;
    });
    while(st.recentFragments.length > 400) st.recentFragments.shift();
    if(f.claim && ctx.consort && !st.fragmentOwner[f.id]){
      st.fragmentOwner[f.id] = ctx.consort.id;
      QZD.stateIO.pushLog('story', '「' + ctx.consort.name + '」认领了一段只属于她的情境');
    }
    QZD.stateIO.save();
    return f;
  }

  /* ---------- 组合叙事：六频道按主意象绑定拼接 ----------
     频道顺序 = 景起 → 人承(神态) → 动作 → 意识 → 对白 → 器物收。
     先定一个 motif，六个频道都只取同意象零件，拼成一整段——
     低成本放大内容丰富度（各频道零件数相乘），又不会意象打架。
     ctx.channels 可指定频道子集（测试/小场景用），默认全六频道。
     条件筛选复用 minTier/personality/hourWindow；相邻零件做措辞去重。 */
  var MOTIFS_BY_HOUR = {
    dawn: ['mist','flower','rain'],
    noon: ['leaf','flower','tide'],
    night:['rain','tide','moon','flower']
  };
  var COMPOSE_CHANNELS = ['scene','mien','act','mind','speech','side'];
  function repeatPhrase(a, b){
    for(var i = 0; i < a.length - 3; i++){
      var seg = a.substr(i, 4);
      if(b.indexOf(seg) >= 0) return seg;
    }
    return '';
  }
  function composeScene(ctx){
    ctx = ctx || {};
    var parts = QZD.config.STORY_PARTS || [];
    var rnd = ctx.rnd || Math.random;
    var inti = ctx.consort ? intimacy(ctx.consort) : { index: 0 };
    var hk = hourKey(ctx.hour);
    var tier = inti.index || 0;
    /* 1. 定主意象：显式指定 > 时段倾向 > 全部 */
    var candidates = [];
    if(ctx.motif) candidates = [ctx.motif];
    else if(hk && MOTIFS_BY_HOUR[hk]) candidates = MOTIFS_BY_HOUR[hk];
    else candidates = ['rain','tide','flower','moon','leaf','mist'];
    /* 2. 频道条件筛选 */
    var channels = (Array.isArray(ctx.channels) && ctx.channels.length) ? ctx.channels : COMPOSE_CHANNELS;
    function poolOf(channel, motif){
      return parts.filter(function(p){
        if(p.channel !== channel || p.motif !== motif) return false;
        if(p.personality && (!ctx.consort || p.personality !== ctx.consort.personality)) return false;
        if(p.minTier != null && tier < p.minTier) return false;
        if(p.hourWindow && hk && p.hourWindow.indexOf(hk) < 0) return false;
        return true;
      });
    }
    /* 选一个「所有指定频道都有零件」的意象 */
    var usable = candidates.filter(function(m){
      return channels.every(function(c){ return poolOf(c, m).length > 0; });
    });
    if(!usable.length) return null;
    var motif = usable[Math.floor(rnd() * usable.length) % usable.length];
    /* 3. 逐频道抽零件，与已选句子做措辞去重（换下一个候选，最多一轮） */
    var chosen = {}, picked = [];
    for(var ci = 0; ci < channels.length; ci++){
      var ch = channels[ci], pool = poolOf(ch, motif);
      var idx = Math.floor(rnd() * pool.length) % pool.length;
      var txt = pool[idx].text;
      for(var t = 0; t < pool.length && picked.some(function(x){ return repeatPhrase(x, txt); }); t++){
        idx = (idx + 1) % pool.length; txt = pool[idx].text;
      }
      chosen[ch] = txt; picked.push(txt);
    }
    /* 4. 拼接分层：景起。→ 神态+动作(逗号连成一句)。→ 意识。→ 对白。→ 器物收。
         有句子起伏，不像六个零件逗号串到底的流水账。缺省频道(null)自动跳过。 */
    function seg(ch){ return chosen[ch] ? chosen[ch].replace(/[。！？，]$/, '') : ''; }
    var sScene = seg('scene'), sMien = seg('mien'), sAct = seg('act'),
        sMind = seg('mind'), sSpeech = seg('speech'), sSide = seg('side');
    var pieces = [];
    if(sScene) pieces.push(sScene + '。');                       /* 景起，独立成句 */
    var human = [sMien, sAct].filter(Boolean).join('，');
    if(human) pieces.push(human + '。');                          /* 神态+动作，一句 */
    if(sMind) pieces.push(sMind + '。');                          /* 意识，一句 */
    if(sSpeech) pieces.push(sSpeech + '。');                      /* 对白后补句号，与器物收分开 */
    if(sSide) pieces.push(sSide + '。');                          /* 器物收尾 */
    /* 兜底：若调用方给了非标准频道组合，按顺序用逗号串，保证不丢内容 */
    if(!pieces.length){
      channels.forEach(function(ch, i){
        var x = seg(ch); if(!x) return;
        pieces.push(x + (i === channels.length - 1 ? '。' : '，'));
      });
    }
    var text = pieces.join('');
    return { text: text, motif: motif, channels: chosen };
  }

  /* 双轨抽取：侍寝榻前的 N 段描写，主体仍走现成整段 fragment()，
     按 config.STORY.COMPOSE_CHANCE 概率把其中一段换成组合叙事段。
     相知档概率减半（大段大戏优先）；组合段失败则回退整段，绝不空屏。
     可注入 rnd 供测试；不改 recentFragments 之外的任何状态。 */
  function pickBedScenes(consort, hour, opts){
    opts = opts || {};
    var rnd = opts.rnd || Math.random;
    var n = opts.count || 3;
    var inti = consort ? intimacy(consort) : { index: 0 };
    var deep = (inti.index || 0) >= 3;
    var sc = CFG.STORY || {};
    var chance = deep
      ? (sc.COMPOSE_CHANCE_DEEP != null ? sc.COMPOSE_CHANCE_DEEP : 0.15)
      : (sc.COMPOSE_CHANCE != null ? sc.COMPOSE_CHANCE : 0.30);
    var useCompose = chance > 0 && rnd() < chance;
    var out = [], texts = {}, composed = null;
    /* 组合段放在第二段的位置：第一段仍是熟悉的整段开场，不突兀 */
    for(var i = 0; i < n; i++){
      var txt = null;
      if(useCompose && i === 1){
        var c = composeScene({ consort: consort, hour: hour, rnd: rnd });
        if(c){ txt = c.text; composed = c; }
      }
      if(!txt){
        var f = fragment({ tag:'bed', consort: consort, hour: hour, at:(opts.at || Date.now()) + i,
          returning: !!opts.returning, allowCooldownFallback: true,
          personalityBoost: opts.personalityBoost || 3, hiddenBoost: opts.hiddenBoost || 0, rnd: rnd });
        if(f) txt = f.text;
      }
      if(txt && !texts[txt]){ texts[txt] = true; out.push(txt); }
    }
    return { scenes: out, composed: composed, usedCompose: !!composed };
  }

  /* ---------- S2 呈现队列 ----------
     剧情只在收工 / 开机 / 跨日给；若有昭幸大屏或分配面板在前，等它关闭再弹。
     一次只弹一个，均可用「记下 / 略过」随时关掉，绝不阻塞。 */
  function showWhenFree(fn, delay){
    var tries = 0;
    function attempt(){
      if(typeof document !== 'undefined' && document.querySelector &&
         document.querySelector('.favor-mask, .modal-mask')){
        if(tries++ < 20){ setTimeout(attempt, 500); return; }
      }
      fn();
    }
    setTimeout(attempt, delay == null ? 500 : delay);
  }
  var presentQueue = [], draining = false, sleepBusy = 0;
  function queuePresent(res){
    if(!res) return;
    presentQueue.push(res);
    drain();
  }
  function drain(){
    if(draining || !presentQueue.length) return;
    draining = true;
    showWhenFree(function(){
      /* 侍寝过场正在显示时，剧情窗让位，等它关掉再弹，避免两窗叠加 */
      if(sleepBusy > 0){
        draining = false;
        setTimeout(drain, 600);
        return;
      }
      var r = presentQueue.shift();
      draining = false;
      if(r){
        if(r.kind === 'morning') presentMorning(r);
        else present(r);
      }
      if(presentQueue.length) setTimeout(drain, 400);
    }, 900);
  }
  function flush(){
    if(presentQueue.length) drain();
  }

  function para(text, cls){
    return '<p style="line-height:1.85;margin:0 0 10px' +
      (cls ? ';' + cls : '') + '">' + esc(text) + '</p>';
  }
  function picOf(c){
    return (QZD.portrait && QZD.portrait.svg)
      ? QZD.portrait.svg(c.id, c.name,
          { kind: 'female', img: c.img, model: c.model }) : '';
  }

  /* 剧情节点对话框：立绘 + 情境 + 因由 + 正文 + 终章奖励 */
  function present(res){
    var c = (QZD.harem && QZD.harem.consortById) ? QZD.harem.consortById(res.consortId) : null;
    if(!c || !QZD.ui || !QZD.ui.modal) return;
    var inti = intimacy(c);
    var sc = scene(inti.index >= 2 ? 'rain' : 'bloom',
                   { at: Date.now(), hour: new Date().getHours(), consort: c });
    var reward = '';
    if(res.address || res.phrase || res.pose){
      var bits = [];
      if(res.address) bits.push('此后只唤她「' + res.address + '」');
      if(res.phrase) bits.push('此后只她会说「' + res.phrase + '」');
      if(res.pose) bits.push('专属姿态 · ' + res.pose);
      reward = '<div style="margin-top:10px;padding:8px 10px;border-radius:6px;' +
        'background:rgba(168,132,44,.10);font-size:12px">' + esc(bits.join(' · ')) + '</div>';
    }
    var body =
      '<div style="display:flex;gap:12px;align-items:flex-start;margin-bottom:10px">' +
        '<div style="width:76px;height:96px;overflow:hidden;border-radius:6px;flex:none">' +
          picOf(c) + '</div>' +
        '<div style="font-size:12px;line-height:1.9">' +
          '<div><b>' + esc(res.consortName) + '</b> · ' +
            esc((QZD.config.RANK && QZD.config.RANK.TITLES || [])[c.rank || 0] || '') +
            '　<span style="opacity:.7">' + esc(inti.name) + '（' + inti.score + '）</span></div>' +
          '<div style="opacity:.7">' + (res.claimed ? '首触认领 · 此后这条线只属于她' : '专属续章') +
            '　因由：' + esc(res.reason || '') + '</div>' +
          (sc ? '<div style="opacity:.55;font-style:italic">' + esc(sc) + '</div>' : '') +
        '</div></div>' +
      para(res.text) +
      (res.omen ? '<div style="margin-top:10px;padding:8px 10px;border-radius:6px;' +
                   'background:rgba(168,132,44,.08);font-size:12px;line-height:1.8">' +
                   '<span style="opacity:.6">是夜另有一桩说不清的小事　</span>' +
                   esc(res.omen) + '</div>' : '') +
      reward;
    QZD.ui.modal({
      title: esc(res.lineName) + ' · 第 ' + res.stage + ' / ' + res.total + ' 章',
      body: body, ok: false, cancelText: '记下'
    });
  }

  /* 晨课呈现：天光景 + 妃子立绘 + 专属剧情 + 奖励落点。
     走队列（queuePresent），与侍寝过场/剧情窗互不叠加。 */
  function presentMorning(res){
    if(!res || !QZD.ui || !QZD.ui.modal) return;
    var name = res.consortName || '';
    var c = (res.consortId && QZD.harem && QZD.harem.consortById)
      ? QZD.harem.consortById(res.consortId) : null;
    if(!c && name && QZD.harem && QZD.harem.consortById){
      var hit = (QZD.state.consorts || []).filter(function(x){ return x.name === name; })[0];
      if(hit) c = QZD.harem.consortById(hit.id);
    }
    var body = '<p style="opacity:.7;font-size:12px;margin:0 0 8px">晨课 · 天光初透 · 每晨仅一次，过时不候</p>' +
      (c ? '<div style="display:flex;gap:12px;align-items:flex-start;margin-bottom:10px">' +
           '<div style="width:76px;height:96px;overflow:hidden;border-radius:6px;flex:none">' +
             picOf(c) + '</div>' +
           '<div style="font-size:12px;line-height:1.9"><b>' + esc(name) + '</b>' +
             '　<span style="opacity:.7">晨光里第一眼见到的人</span></div></div>' : '') +
      para(res.scene || '') +
      '<p style="opacity:.6;font-size:12px;margin:0">签约金已入库 · 本场钱银 ×' +
        esc(String((QZD.config.MORNING || {}).MONEY_RATE || 1.5)) +
      '，直到本次专注结束</p>';
    QZD.ui.modal({ title: '晨课 · 天光', body: body, ok: false, cancelText: '记下' });
  }

  /* 相处方式呈现：情景片段 + 她的一句 + 原性格对话 */
  function presentMode(consort, res, mode){
    if(!consort || !QZD.ui || !QZD.ui.modal) return;
    var inti = intimacy(consort);
    /* 相处方式（奉茶/共读/听琴…）的池很小（daily 5 / study 2 / night 4），
       按 mode.pools 或 SUMMON_TAG_POOLS 依次取：前池有新鲜段就用，枯竭再退到后池
       （只有最后一个池允许冷却回退），既不整段空白，也不硬凑不合适的段。
       夜话配置了 night→bed→side，夜间也能读到 bed 池适合夜里的段。 */
    function poolsOf(m){
      if(m && Array.isArray(m.pools) && m.pools.length) return m.pools;
      var map = QZD.config.SUMMON_TAG_POOLS || {};
      var key = (m && m.scene) ? m.scene : 'daily';
      return map[key] || (key === 'bed' ? ['bed'] : ['night']);
    }
    var pools = poolsOf(mode), f = null;
    for(var pi = 0; pi < pools.length && !f; pi++){
      f = fragment({ tag: pools[pi], consort: consort,
                     hour: new Date().getHours(), at: Date.now() + pi,
                     returning: false, personalityBoost: 2,
                     allowCooldownFallback: pi === pools.length - 1 });
    }
    var body =
      '<div style="font-size:12px;opacity:.7;margin-bottom:8px">' +
        esc(mode.name) + ' · ' + esc(mode.desc) + '　情感浓度 ' +
        esc(inti.name) + '（' + inti.score + '）</div>' +
      (f ? para(f.text) : '') +
      (mode.line ? para(mode.line) : '') +
      para(res && res.dialogue ? res.dialogue.text : '') +
      '<p style="opacity:.6;font-size:12px;margin:0">喜爱 +' +
        esc(String(res && res.favorGain || 0)) + ' · 宠爱 +' +
        esc(String(res && res.doteGain || 0)) + '　这一场也已记入起居注。</p>';
    QZD.ui.modal({ title: '与「' + esc(consort.name) + '」' + esc(mode.name),
                   body: body, ok: false, cancelText: '收起' });
  }

  /* 侍寝过场（评审稿第二十/二十一章的完整过场链，第二十八轮补戏份）：
     入夜 → 榻前（多变体，低浓度也有「靠近 → 僵住 → 掩饰出错」的张力）
     → 罗帐落下 / 帐钩轻晃 / 灯影隔一层暖色 → 文字淡出
     → 侧面映照（side：只写更漏、灯影、气息、器物位移，不写行为）
     → 次晨（morning）→ 喜讯 → 隔日余韵（after：她因昨夜而变，不点破因由）。
     四段都走片段池：硬条件先筛，7 天冷却不重复，冷却全满时回退保证绝不空白。
     边界：正面亲密过程始终淡出不写一字；侧面只写「帐外能感知的」，
     高浓度专属段仍只在认领后可用。两屏结构不变，避免与方案呈现对不上。 */
  /* 侍寝分幕文本（供昭幸大屏一屏演完）：次晨 / 隔日余韵 / 喜讯。
     与 presentSleep 同源抽取，保证内容一致；不写正面过程。 */
  /* 按开始时刻选时段方案：清晨 / 日中 / 入夜（夜间跨 0 点用 29 表示次日5点） */
  function timePlan(hour){
    var plans = QZD.config.INTIMACY_TIME || [];
    for(var i = 0; i < plans.length; i++){
      var p = plans[i], from = p.from, to = p.to;
      var h = hour;
      if(to > 24 && h < 6) h += 24;   /* 夜间方案：凌晨算作前一夜 */
      if(h >= from && h < to) return p;
    }
    return plans[plans.length - 1] || null;
  }
  function sleepCurtains(res){
    var c = res && res.consort;
    if(!c) return { morning:'', after:'', goodNews:'', labels:{} };
    var now = Date.now(), returning = !!(res && res.returning);
    var hour = new Date(now).getHours();
    var plan = timePlan(hour);
    var night = plan && plan.key === 'night';
    function pick(tag, hr){
      return fragment({ tag: tag, hour: hr, consort: c, at: now,
                        returning: returning, allowCooldownFallback: true,
                        personalityBoost: 2 });
    }
    /* 夜间沿用原片段池（"天欲明"等原句不改）；白天用该时段的兜底，避免白天冒出"天欲明" */
    var mf = night ? pick('morning', 6) : null;
    var af = night ? pick('after', 10) : null;
    var morning = mf ? mf.text : ((plan && plan.morningFallback) ||
      '日头渐高，她起身理了理鬓发，檐下的光已经移到了案脚。');
    var afterText = af ? af.text : ((plan && plan.afterFallback) ||
      '她照旧来奉茶，盏却搁偏了半寸，伸手去正，正了两回才妥。');
    var goodNews = res.success
      ? '三日后院正请脉，说是喜脉。她怔了一怔，手先按在小腹上，随即又放下来，' +
        '像是怕人瞧见；抬眼时眼角蒙了层水汽，偏还端着：「陛下……这是真的？」起居注当日记了一笔。'
      : '';
    return { morning: morning, after: afterText, goodNews: goodNews,
             labels: (plan && plan.labels) || {} };
  }

  function presentSleep(res, opts){
    var c = res && res.consort;
    if(!c || !QZD.ui || !QZD.ui.modal) return;
    opts = opts || {};
    var skipBed = !!opts.skipBed;   /* 榻前段已在昭幸大屏立绘上显示过，此处不重复 */
    var now = Date.now(), hour = new Date().getHours();
    var returning = !!(res && res.returning);
    function pick(tag, hr, boost){
      return fragment({ tag: tag, hour: hr, consort: c, at: now,
                        returning: returning, allowCooldownFallback: true,
                        personalityBoost: boost || 0 });
    }
    /* 榻前给性格专属段 3 倍权重：生疏档也有「这一位」的别扭法，
       但仍保留通用段机会，不做成写死。 */
    var bf = pick('bed', hour, 3), sf = pick('side', 1);
    var mf = pick('morning', 6), af = pick('after', 10);
    var bedText = bf ? bf.text :
      '掀帘进去时，她已靠在榻里侧，衾角拉到胸口，鬓发散在枕上，一支簪子搁在案头没收。' +
      '听见脚步，她没起身，只把眼抬了抬，又垂下去，颊上先红了。帐子半垂，灯从外头透进来，' +
      '把她的侧影描得很软；帐钩被袖风带得轻晃，窗外的雨一记一记打在海棠上。';
    var sideText = sf ? sf.text :
      '更漏过了三刻。帐钩不再晃，灯影却矮下去一截。案上那支簪子滑到了砚边，' +
      '静静搁着，没人去拾；窗外雨声把什么都盖住了，只余檐溜一滴，又一滴。';
    var morning = mf ? mf.text :
      '天欲明时雨停了。灯芯积了长长一截，也没人去剪；罗帐还垂着，只被晨风掀起一角。' +
      '她仍在榻里侧，侧身支着颐，鬓发散在枕上，见陛下醒了，先把眼垂下去。';
    var afterText = af ? af.text :
      '次日她照旧来奉茶，盏却搁偏了半寸，伸手去正，正了两回才妥。' +
      '抬眼正碰上陛下的目光，先把眼垂下去，耳根红了一片；案上昨夜的灯芯，谁也没去剪。';
    /* 室内定格：从词表里挑一句榻前正文没写过的，避免「衾角拉到胸口」连出两遍。
       全都撞上就干脆不显示——榻前片段本身已写足帐/衾/枕/簪。 */
    var indoor = '';
    var bank = (QZD.config.SCENE_BANK || {}).indoor || [];
    if(bank.length){
      var seed = (now + (c.id ? c.id.length : 0)) % bank.length;
      for(var bi = 0; bi < bank.length; bi++){
        var word = bank[(seed + bi) % bank.length];
        var parts = String(word).split(/[，、]/), clash = false;
        for(var pi = 0; pi < parts.length; pi++){
          var key = parts[pi].slice(0, 5);
          if(key.length >= 4 && bedText.indexOf(key) >= 0){ clash = true; break; }
        }
        if(!clash){ indoor = word; break; }
      }
    }
    var goodNews = res.success
      ? para('三日后院正请脉，说是喜脉。她怔了一怔，手先按在小腹上，随即又放下来，' +
             '像是怕人瞧见；抬眼时眼角蒙了层水汽，偏还端着：「陛下……这是真的？」起居注当日记了一笔。')
      : '';
    /* 过场镜头句：榻前片段若已写过罗帐/帐钩，就缩成短提示，
       不让「罗帐落下，帐钩轻晃」连着出现两遍。 */
    var curtain = (!skipBed && /罗帐落下|帐钩|帐子半垂|帐子还挂/.test(bedText))
      ? '—— 罗帐落下 · 帘幕渐合 ——'
      : '罗帐落下，帐钩轻晃，灯影隔了一层暖色。';
    function step0(){
      return '<p style="opacity:.7;font-size:12px">入夜 · 屏退左右 · 更漏一刻</p>' +
        (skipBed ? '' : para(bedText) +
        (indoor ? '<div style="text-align:center;padding:2px 0 8px;opacity:.45;font-size:12px;font-style:italic">' +
                   esc(indoor) + '</div>' : '')) +
        '<div style="text-align:center;padding:12px 0;opacity:.6;font-style:italic">' +
          esc(curtain) + '</div>' +
        '<div style="text-align:center;padding:8px 0 12px;opacity:.45;font-style:italic;font-size:13px">' +
          '—— 文字淡出 ——</div>' +
        '<p style="opacity:.55;font-size:12px;margin:0 0 8px">（正面过程不落一字，只以更漏、灯影、器物记之。）</p>' +
        '<div style="border-top:1px solid rgba(168,132,44,.25);padding-top:10px">' +
          '<p style="opacity:.6;font-size:12px;margin:0 0 6px">夜半 · 帐影</p>' +
          para(sideText) + '</div>';
    }
    function step1(){
      return '<p style="opacity:.7;font-size:12px">次晨 · 天欲明</p>' +
        para(morning) + goodNews +
        '<div style="border-top:1px solid rgba(168,132,44,.25);margin-top:10px;padding-top:10px">' +
          '<p style="opacity:.6;font-size:12px;margin:0 0 6px">隔日 · 余韵</p>' +
          para(afterText) + '</div>' +
        '<p style="opacity:.55;font-size:12px;margin:0">' +
          (skipBed
            ? '（榻前光景，已在方才那幅立绘上说过。）'
            : '（昨夜榻前光景，已在入夜那屏说过。）') + '</p>';
    }
    sleepBusy++;
    var released = false;
    function release(){
      if(released) return;
      released = true;
      sleepBusy = Math.max(0, sleepBusy - 1);
    }
    /* 兜底：弹窗若被异常移除，60 秒后自动解除让位，避免剧情窗永久排队 */
    setTimeout(release, 60000);
    showWhenFree(function(){
      var step = 0;
      var m = QZD.ui.modal({
        title: '入夜 · 寝宫 · 榻前', body: step0(),
        ok: true, okText: '帘幕渐合', cancelText: '略过',
        onOk: function(root){
          if(step === 0){
            step = 1;
            var t = root.querySelector('.dialog-title');
            var b = root.querySelector('.dialog-body');
            var btn = root.querySelector('[data-modal-ok]');
            if(t) t.textContent = '次晨 · 天欲明';
            if(b) b.innerHTML = step1();
            if(btn) btn.textContent = '记下';
            return false;            /* 保持弹窗打开，切到第二屏 */
          }
          release();                 /* 第二屏点「记下」关闭 */
          return true;
        },
        onCancel: function(){ release(); }
      });
      return m;
    }, 600);
  }

  /* 主动相处：记情境 + 强制推进一次剧情（仍受每日一次与 focusQuiet 约束） */
  function onSummon(c, modeId, sceneTag){
    var st = S();
    st.lastSummon = { consortId: c.id, modeId: modeId, scene: sceneTag, at: Date.now() };
    QZD.stateIO.save();
    var ctx = buildCtx('summon', {
      focusDone: false, summonMode: modeId, summonConsortId: c.id
    });
    return roll(ctx, Math.random, true);
  }

  /* 旧档追认：给老妃子各认领一条支线（主线留给玩家真实触发，保持稀缺） */
  function retro(){
    var st = S();
    if(st.retroDone){ return { ok: false, reason: '已追认' }; }
    st.retroDone = true;
    var cs = list(), used = {}, count = 0;
    var sides = LINES.filter(function(l){ return l.kind !== 'main'; });
    cs.forEach(function(c){
      if(count >= (CFG.RETRO_MAX || 2)) return;
      var pick = null, i;
      /* 优先挑首章 trait / origin 与她相符的线 */
      for(i = 0; i < sides.length; i++){
        var l = sides[i];
        if(st.lines[l.id] || used[l.id]) continue;
        var w = l.nodes[0].when || {};
        if((w.trait && inList(w.trait, c.trait)) ||
           (w.origin && inList(w.origin, c.origin))) { pick = l; break; }
      }
      if(!pick){
        for(i = 0; i < sides.length; i++){
          if(!st.lines[sides[i].id] && !used[sides[i].id]){ pick = sides[i]; break; }
        }
      }
      if(!pick) return;
      used[pick.id] = true;
      st.lines[pick.id] = {
        ownerId: c.id, stage: 1, flags: {}, chances: 0,
        claimedAt: Date.now(), lastAt: Date.now(), retro: true
      };
      if(!Array.isArray(c.memory)) c.memory = [];
      c.memory.push({ at: Date.now(), lineId: pick.id, lineName: pick.name,
                      nodeId: 'retro', stage: 0, retro: true,
                      text: pick.intro || '她似乎在等什么',
                      reason: '入宫旧事，今始追记' });
      while(c.memory.length > (CFG.MAX_MEMORY || 40)) c.memory.shift();
      count++;
    });
    if(count){
      QZD.stateIO.pushLog('story', '旧事追记 · ' + count + ' 位旧人各有一段未说完的故事');
    }
    QZD.stateIO.save();
    return { ok: true, count: count };
  }

  /* 启动：追认 → 久别重逢计数 → 组装开机情境 → 判定 */
  function onLaunch(){
    var st = S(), t = today(), gap = dayGap(st.lastSeenDate, t);
    retro();
    /* 连续离线 ≥2 天：在册妃子各记一次重逢，喂给情感浓度（每天最多一次） */
    if(gap >= 2 && st.lastReunionDate !== t){
      st.lastReunionDate = t;
      list().forEach(function(c){
        c.reunions = Math.min(5, (typeof c.reunions === 'number' ? c.reunions : 0) + 1);
      });
      QZD.stateIO.save();
    }
    var ctx = buildCtx('launch', { returning: gap >= 2, gapDays: gap });
    return roll(ctx);
  }

  /* 专注收工：显式带 focusDone，不打断开殿面板 */
  function onFocusEnd(){
    var ctx = buildCtx('focus', { focusDone: true });
    return roll(ctx);
  }

  /* 给 UI：某妃已认领的线与章节进度、共同记忆、专属称呼 */
  function of(c){
    var st = S(), out = [];
    Object.keys(st.lines).forEach(function(k){
      var rec = st.lines[k];
      if(!rec || rec.ownerId !== c.id) return;
      var ln = lineById(k);
      if(!ln) return;
      out.push({ id: k, name: ln.name, kind: ln.kind, intro: ln.intro,
                 stage: rec.stage || 0, total: ln.nodes.length,
                 retro: !!rec.retro, lastAt: rec.lastAt || 0 });
    });
    return { lines: out, memory: Array.isArray(c.memory) ? c.memory : [],
             milestones: c.milestones || 0, reunions: c.reunions || 0,
             address: c.address || '', phrase: c.phrase || '',
             pose: c.storyPose || '', intimacy: intimacy(c) };
  }

  /* 她的故事：只读展示，不做选择（S2 再做对话框） */
  function show(consortId){
    var c = (QZD.harem && QZD.harem.consortById) ? QZD.harem.consortById(consortId) : null;
    if(!c || !QZD.ui || !QZD.ui.modal) return;
    var d = of(c);
    var head = '<p style="margin:0 0 10px;opacity:.75">' +
      '情感浓度 <b>' + esc(d.intimacy.name) + '</b>（' + d.intimacy.score + '） · ' +
      (d.address ? '专属称呼「' + esc(d.address) + '」 · ' : '') +
      '共同记忆 ' + d.memory.length + ' 则 · 里程碑 ' + d.milestones +
      ' · 重逢 ' + d.reunions + ' 回</p>' +
      (d.phrase ? '<p style="margin:0 0 8px;font-size:12px;opacity:.7">只她会说：「' +
        esc(d.phrase) + '」</p>' : '') +
      (d.pose ? '<p style="margin:0 0 8px;font-size:12px;opacity:.7">专属姿态 · ' +
        esc(d.pose) + '</p>' : '');
    var lines = d.lines.length
      ? d.lines.map(function(x){
          return '<div style="padding:6px 0;border-bottom:1px solid rgba(128,128,128,.18)">' +
            '<b>' + esc(x.name) + '</b> <small style="opacity:.6">' +
            (x.kind === 'main' ? '主线' : '支线') + ' · 第 ' + x.stage + ' / ' + x.total + ' 章' +
            (x.retro ? ' · 旧事追认' : '') + '</small>' +
            '<div style="opacity:.65;font-size:12px;margin-top:2px">' + esc(x.intro || '') + '</div></div>';
        }).join('')
      : '<p style="opacity:.6">她还没有认领任何故事。条件到了，自会与她遇上。</p>';
    var mem = d.memory.length
      ? d.memory.slice().reverse().map(function(m){
          return '<div style="padding:8px 0;border-bottom:1px solid rgba(128,128,128,.18)">' +
            '<div style="font-size:12px;opacity:.6;margin-bottom:3px">' +
            esc(m.lineName || '旧事') + (m.stage ? ' · 第 ' + m.stage + ' 章' : '') +
            '　因由：' + esc(m.reason || '') + '</div>' +
            '<div style="line-height:1.75">' + esc(m.text || '') + '</div>' +
            (m.omen ? '<div style="margin-top:5px;font-size:12px;opacity:.7;' +
                       'line-height:1.7">是夜另有一桩说不清的小事　' +
                       esc(m.omen) + '</div>' : '') + '</div>';
        }).join('')
      : '';
    QZD.ui.modal({
      title: '「' + esc(c.name) + '」的故事',
      body: head + '<div style="max-height:140px;overflow:auto">' + lines + '</div>' +
        (mem ? '<h4 style="margin:14px 0 4px;font-size:13px">共同记忆</h4>' +
               '<div style="max-height:280px;overflow:auto;font-size:13px">' + mem + '</div>' : ''),
      ok: false, cancelText: '合上'
    });
  }

  QZD.story = {
    roll: roll, onLaunch: onLaunch, onFocusEnd: onFocusEnd, onSummon: onSummon,
    retro: retro, of: of, show: show, state: S,
    /* S2 呈现层 */
    fragment: fragment, present: present, presentMode: presentMode,
    presentSleep: presentSleep, sleepCurtains: sleepCurtains, queuePresent: queuePresent,
    flush: flush, intimacy: intimacy, scene: scene,
    /* 组合叙事双轨（景物+神态+动作+意识+对白+侧写六频道） */
    composeScene: composeScene, pickBedScenes: pickBedScenes,
    /* 测试/调试用：不改状态地看今日候选；applyNode 供精确验证分叉落点 */
    candidates: function(ctx){ return candidates(ctx || buildCtx('inspect'), S()); },
    applyNode: applyNode
  };
})();
