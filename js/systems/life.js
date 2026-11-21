/* ============================================================
   systems/life.js · L2 妃子的自主生活
   - 每位妃子有私房钱 purse、主爱好（来自 trait）、练习点与等级
   - 周结算：她按爱好自己买小物（扣自己的钱、写起居注），攒不够就记下心愿
   - 练习点：页面在线每日 +1 / 专注收工每场 +1 / 陪伴那位再 +1
     整周未上线仅保底 +1 —— 在线明显更快，但离线不是惩罚性清零
   - 生疏 rustiness：离线累积（上限 7），陪伴一场 −2；只影响在线点，不扣钱/属性/好感
   - 回归小结：连续离线 ≥2 天后首次登录，给一句「她在自己过日子」的具体描述
   ============================================================ */
(function(){
  var CFG = QZD.config.LIFE || {};

  function S(){
    var s = QZD.state;
    if(!s.life || typeof s.life !== 'object') s.life = {};
    var g = s.life;
    if(typeof g.lastSeenDate !== 'string') g.lastSeenDate = '';
    if(typeof g.lastSettledWeek !== 'string') g.lastSettledWeek = '';
    if(typeof g.lastSummary !== 'string') g.lastSummary = '';
    return g;
  }
  function L(c){
    if(!c.life || typeof c.life !== 'object') c.life = {};
    var l = c.life;
    if(typeof l.hobby !== 'string' || !l.hobby) l.hobby = c.trait || '善琴';
    if(typeof l.points !== 'number' || !isFinite(l.points)) l.points = 0;
    if(typeof l.level !== 'number') l.level = 0;
    if(typeof l.weekPoints !== 'number') l.weekPoints = 0;
    if(!Array.isArray(l.purchases)) l.purchases = [];
    if(typeof l.wish !== 'string') l.wish = '';
    if(typeof l.rustiness !== 'number') l.rustiness = 0;
    if(typeof c.purse !== 'number') c.purse = 0;

    /* 成长：多项才艺，每项独立 points/level。旧档只有 hobby+points+level，
       一次性迁到 skills[hobby]，之后所有练习都走 skills，主 hobby 仍保留兼容旧显示。 */
    if(!l.skills || typeof l.skills !== 'object' || Array.isArray(l.skills)) l.skills = {};
    if(!l.skills[l.hobby]){
      l.skills[l.hobby] = { points: l.points || 0, level: l.level || 0 };
    }
    /* 主修：专注/陪伴只练这一项，练什么长什么（默认主 hobby）。
       旧档无此字段时补上，不影响既有进度。 */
    if(typeof l.primary !== 'string' || !l.skills[l.primary]) l.primary = l.hobby;
    return l;
  }
  function levelOfPoints(n){
    return Math.max(0, Math.min(CFG.MAX_LEVEL || 10,
      Math.floor((n || 0) / (CFG.POINTS_PER_LEVEL || 10))));
  }
  function today(){ return QZD.stateIO.todayStr(); }
  function list(){
    return (QZD.harem && QZD.harem.list) ? QZD.harem.list().filter(Boolean) : [];
  }
  function weekKey(){
    return (QZD.plan && QZD.plan.weekKey) ? QZD.plan.weekKey() : today();
  }
  function dayGap(a, b){
    if(!a || !b) return 0;
    var x = Date.parse(a + 'T00:00:00'), y = Date.parse(b + 'T00:00:00');
    if(!isFinite(x) || !isFinite(y)) return 0;
    return Math.max(0, Math.round((y - x) / 86400000));
  }
  function itemFor(c, skillName){
    var arr = CFG.ITEMS || [], i, best = null;
    var name = skillName || L(c).hobby;
    /* 同一才艺可能有多档小物（如善扮：脂粉/香膏/新衣衫）。
       选她私房钱买得起、且练习收益最高的那件；都买不起就返回最便宜的记心愿。 */
    for(i = 0; i < arr.length; i++){
      if(arr[i].trait !== name) continue;
      if((c.purse || 0) + 1e-9 >= arr[i].cost &&
         (!best || (arr[i].practice || 0) > (best.practice || 0))) best = arr[i];
      if(!best && arr[i].cost != null) best = arr[i];   /* 兜底：最便宜那件用于心愿 */
    }
    return best;
  }
  function addPoints(c, n, skillName){
    var l = L(c);
    var name = skillName || l.primary || l.hobby;
    n = (Number(n) || 0) + (QZD.bloodTalent ? QZD.bloodTalent.hobbyPointBonus(c) : 0);
    if(n <= 0) return;
    /* 总点（兼容旧字段） */
    l.points += n;
    l.weekPoints += n;
    /* 该项才艺点 + 升级 → 绑定属性 +1 */
    var sk = l.skills[name] || (l.skills[name] = { points: 0, level: 0 });
    sk.points += n;
    var newLevel = levelOfPoints(sk.points);
    if(newLevel > sk.level){
      sk.level = newLevel;
      var attr = (CFG.SKILL_ATTR || {})[name];
      if(attr && c[attr] != null){
        var cap = CFG.ATTR_MAX || 120;
        var before = c[attr];
        c[attr] = Math.min(cap, (c[attr] || 0) + (CFG.ATTR_PER_LEVEL || 1));
        if(c[attr] !== before){
          QZD.stateIO.pushLog('life', '「' + c.name + '」' + name + ' 精进至 ' + newLevel +
            ' 级 · ' + attrName(attr) + ' ' + before + '→' + c[attr]);
        }
      }
    }
    /* 主 hobby 的 level 仍同步，兼容旧显示 */
    if(name === l.hobby) l.level = sk.level;
  }
  function attrName(k){
    return ({ yan:'容貌', ti:'体质', cai:'才情' })[k] || k;
  }

  /* 周结算：离线保底 + 她自己买东西（只在换周时跑一次） */
  function settleWeek(){
    var g = S(), wk = weekKey();
    if(g.lastSettledWeek === wk) return { ok: false, reason: '本周已结算' };
    var first = !g.lastSettledWeek;   /* 首次运行只初始化周标记，不补离线点 */
    g.lastSettledWeek = wk;
    var cs = list(), bought = 0;
    cs.forEach(function(c){
      var l = L(c);
      var wasIdle = (l.weekPoints === 0);
      if(wasIdle && !first) addPoints(c, CFG.OFFLINE_WEEKLY || 1);

      var item = itemFor(c);
      if(!item) return;
      if(c.purse >= item.cost){
        c.purse -= item.cost;
        l.purchases.push({ at: Date.now(), id: item.id, name: item.name, cost: item.cost });
        while(l.purchases.length > 30) l.purchases.shift();
        addPoints(c, item.practice || 0);
        l.wish = '';
        QZD.stateIO.pushLog('life', '「' + c.name + '」以私房钱购' + item.name +
          ' · ' + l.hobby + ' 进益 · 私房钱余 ' + Math.floor(c.purse));
        bought++;
      }else{
        l.wish = item.name;   /* 攒钱想买，供后续剧情 / 玩家赠予 */
      }
      l.weekPoints = 0;
    });
    QZD.stateIO.save();
    return { ok: true, week: wk, n: cs.length, bought: bought };
  }

  /* 专注收工：按本场时长给练习点（每满 25 分钟 +1，封顶 4），保底 1。
     陪伴那位再 +1 并消解生疏。★ 时长来自 pomodoro 的 ev.minutes，
     与专注经济同源但不改任何产出——只喂养妃子成长。 */
  function focusPoints(minutes){
    var per = CFG.FOCUS_MIN_PER_POINT || 25, cap = CFG.FOCUS_MAX_POINTS || 4;
    var byTime = Math.floor((Number(minutes) || 0) / per);
    return Math.max(CFG.FOCUS_BASE || 1, Math.min(cap, byTime));
  }
  function onFocusEnd(companionId, minutes){
    var cs = list(), pts = focusPoints(minutes);
    cs.forEach(function(c){ addPoints(c, pts); });
    if(companionId){
      for(var i = 0; i < cs.length; i++){
        if(cs[i].id !== companionId) continue;
        addPoints(cs[i], CFG.COMPANION_BONUS || 1);
        var l = L(cs[i]);
        l.rustiness = Math.max(0, l.rustiness - (CFG.RUSTINESS_CLEAR || 2));
        break;
      }
    }
    QZD.stateIO.save();
    return { ok: true, n: cs.length, points: pts, companionId: companionId || null };
  }

  /* 回归小结：挑一位有痕迹的妃子，说一句具体的话 */
  function summary(){
    var cs = list();
    if(!cs.length) return '';
    var pick = cs[0], i;
    for(i = 0; i < cs.length; i++){
      var li = L(cs[i]);
      if(li.purchases && li.purchases.length){ pick = cs[i]; break; }
    }
    var l = L(pick);
    var last = l.purchases.length ? l.purchases[l.purchases.length - 1] : null;
    var txt = '你不在的这几日，' + pick.name + '仍在练' + l.hobby;
    if(l.level > 0) txt += '，已到 ' + l.level + ' 级';
    if(last) txt += '，还添了' + last.name;
    else if(l.wish) txt += '，仍攒着钱想买' + l.wish;
    return txt + '。';
  }

  /* 学艺：用她自己的私房钱学一样新才艺（不动国库）。已会的不能重复学。
     ★ 只扣 consort.purse —— 陛下先前拨给她的钱，玩家是「引导」而非另掏腰包。 */
  function learnSkill(id, skillName){
    var cs = list(), c = null, i;
    for(i = 0; i < cs.length; i++) if(cs[i].id === id){ c = cs[i]; break; }
    if(!c) return { ok: false, error: '妃嫔不在后宫' };
    var l = L(c);
    var names = CFG.SKILL_NAMES || [];
    if(names.indexOf(skillName) < 0) return { ok: false, error: '并无这门才艺' };
    if(l.skills[skillName]) return { ok: false, error: '「' + c.name + '」已习得' + skillName };
    var cost = CFG.LEARN_COST || 30;
    if((c.purse || 0) + 1e-9 < cost)
      return { ok: false, error: '她私房钱不足（需 ' + cost + '，请先开殿拨银）' };
    c.purse -= cost;
    l.skills[skillName] = { points: 0, level: 0 };
    addPoints(c, CFG.LEARN_START_POINTS || 2, skillName);   /* 入门送几点，立刻见 0 级→有进度 */
    QZD.stateIO.pushLog('life', '「' + c.name + '」以私房钱 ' + cost + ' 从师习' + skillName +
      '（' + attrName((CFG.SKILL_ATTR || {})[skillName] || '') + '之道）');
    QZD.stateIO.save();
    return { ok: true, name: c.name, skill: skillName, cost: cost,
             level: l.skills[skillName].level, purse: Math.floor(c.purse) };
  }

  /* 定主修：专注时只练这一门，练什么长什么。免费切换，不花钱。 */
  function setPrimary(id, skillName){
    var cs = list(), c = null, i;
    for(i = 0; i < cs.length; i++) if(cs[i].id === id){ c = cs[i]; break; }
    if(!c) return { ok: false, error: '妃嫔不在后宫' };
    var l = L(c);
    if(!l.skills[skillName]) return { ok: false, error: '她尚未习得' + skillName };
    l.primary = skillName;
    QZD.stateIO.save();
    return { ok: true, name: c.name, primary: skillName };
  }

  /* 心愿：她攒不够钱的那件小物，由陛下从国库代付（关键节点玩家在场） */
  function wishItem(c){
    var l = L(c);
    if(!l.wish) return null;
    var arr = CFG.ITEMS || [], i;
    for(i = 0; i < arr.length; i++) if(arr[i].name === l.wish) return arr[i];
    return itemFor(c);
  }
  function grantWish(id){
    var cs = list(), c = null, i;
    for(i = 0; i < cs.length; i++) if(cs[i].id === id){ c = cs[i]; break; }
    if(!c) return { ok: false, error: '妃嫔不在后宫' };
    var l = L(c), item = wishItem(c);
    if(!l.wish || !item) return { ok: false, error: '她眼下并无未了的心愿' };
    var cost = item.cost;
    var wallet = (QZD.state.resources && QZD.state.resources.jinQian) || 0;
    if(wallet + 1e-9 < cost) return { ok: false, error: '国库金钱不足（需 ' + cost + '）' };
    QZD.resources.remove({ jinQian: cost });
    l.purchases.push({ at: Date.now(), id: item.id, name: item.name,
                       cost: cost, byEmperor: true });
    while(l.purchases.length > 30) l.purchases.shift();
    addPoints(c, (item.practice || 0) + (CFG.GRANT_BONUS || 2));
    var fmax = (QZD.harem && QZD.harem.favorMaxOf)
      ? QZD.harem.favorMaxOf(c) : ((QZD.config.FAVOR && QZD.config.FAVOR.MAX) || 100);
    var gain = CFG.GRANT_FAVOR || 3;
    c.favor = Math.max(0, Math.min(fmax, (c.favor || 0) + gain));
    l.wish = '';
    QZD.stateIO.pushLog('life', '陛下替「' + c.name + '」添了' + item.name +
      ' · 国库出 ' + cost + ' 金 · ' + l.hobby + ' 进益 · 喜爱 +' + gain);
    QZD.stateIO.save();
    return { ok: true, name: c.name, item: item.name, cost: cost,
             level: l.level, favor: c.favor };
  }

  /* 只读视图：给名册卡片用（不写入状态） */
  function of(c){
    var l = L(c), last = l.purchases.length ? l.purchases[l.purchases.length - 1] : null;
    var skills = [];
    Object.keys(l.skills).forEach(function(name){
      var sk = l.skills[name];
      if(sk && (sk.points > 0 || sk.level > 0)){
        skills.push({ name: name, level: sk.level, points: sk.points,
                      attr: (CFG.SKILL_ATTR || {})[name] || '',
                      attrName: attrName((CFG.SKILL_ATTR || {})[name] || '') });
      }
    });
    skills.sort(function(a, b){ return b.level - a.level || b.points - a.points; });
    return {
      hobby: l.hobby, level: l.level, points: l.points, skills: skills,
      primary: l.primary || l.hobby,
      learnCost: CFG.LEARN_COST || 30,
      learnable: (CFG.SKILL_NAMES || []).filter(function(n){ return !l.skills[n]; }),
      purse: Math.floor(c.purse || 0), purchases: l.purchases.length,
      last: last, wish: l.wish, rustiness: l.rustiness,
      wishCost: (l.wish ? (wishItem(c) || {}).cost : 0) || 0
    };
  }

  /* 启动：换周结算 → 每日在线点 / 生疏 → 回归小结 */
  function onLaunch(){
    var g = S(), t = today(), cs = list();
    var gap = dayGap(g.lastSeenDate, t);
    settleWeek();

    if(g.lastSeenDate !== t){
      g.lastSeenDate = t;
      cs.forEach(function(c){
        var l = L(c);
        if(gap > 1){
          l.rustiness = Math.min(CFG.RUSTINESS_MAX || 7,
            l.rustiness + Math.min(gap - 1, CFG.RUSTINESS_MAX || 7));
        }
        /* 生疏时今日在线点减半（温和、可逆，不扣任何已有资源） */
        addPoints(c, l.rustiness > 0 ? 0 : (CFG.ONLINE_DAILY || 1));
      });
      QZD.stateIO.save();
    }

    if(gap >= 2 && cs.length){
      var txt = summary();
      g.lastSummary = txt;
      QZD.stateIO.pushLog('life', txt);
      QZD.stateIO.save();
      if(QZD.ui && QZD.ui.toast) setTimeout(function(){ QZD.ui.toast(txt); }, 700);
    }
    return { gap: gap, n: cs.length, summary: g.lastSummary };
  }

  QZD.life = {
    onLaunch: onLaunch,
    onFocusEnd: onFocusEnd,
    settleWeek: settleWeek,
    summary: summary,
    grantWish: grantWish,
    learnSkill: learnSkill,
    setPrimary: setPrimary,
    focusPoints: focusPoints,
    of: of,
    state: S
  };
})();
