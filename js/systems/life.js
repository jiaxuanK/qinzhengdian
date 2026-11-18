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
    return l;
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
  function itemFor(c){
    var arr = CFG.ITEMS || [], i;
    for(i = 0; i < arr.length; i++) if(arr[i].trait === L(c).hobby) return arr[i];
    return null;
  }
  function addPoints(c, n){
    var l = L(c);
    l.points += n;
    l.weekPoints += n;
    l.level = Math.max(0, Math.min(CFG.MAX_LEVEL || 10,
      Math.floor(l.points / (CFG.POINTS_PER_LEVEL || 10))));
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

  /* 专注收工：所有妃子 +1，陪伴那位再 +1 并消解生疏 */
  function onFocusEnd(companionId){
    var cs = list();
    cs.forEach(function(c){ addPoints(c, CFG.FOCUS_BASE || 1); });
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
    return { ok: true, n: cs.length, companionId: companionId || null };
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
    return {
      hobby: l.hobby, level: l.level, points: l.points,
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
    of: of,
    state: S
  };
})();
