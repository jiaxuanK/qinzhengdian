/* ============================================================
   systems/morning.js · 晨课（6:00–7:30 在线收工的专属奖励与剧情）
   ------------------------------------------------------------
   设计铁律：
     1) 只在真实在线收工判定（由 tick.announce 的 finished 事件调用）；
     2) 每晨仅一次：用 state.study.history[今日] 是否已 >0 判重——
        注意这是"当日已有专注分钟"；晨课发生在当天第一场收工时，
        此时 history[今日] 尚未写入（study.addMinutes 在 announce 之后），
        故另用 state.study.morningDone 日期戳判重（旧档没有则补，零 schema 风险）。
     3) 过时不候：错过只是拿不到额外奖励，本金与既有收益一分不扣，不惩罚；
     4) 不改 schema：morningDone 存在 state.study 下，normalize 自动补默认值。
   ============================================================ */
(function(){
  var CFG = QZD.config;

  function C(){ return CFG.MORNING || {}; }
  function st(){ return QZD.state; }
  function study(){ return QZD.state.study || (QZD.state.study = {}); }

  function today(){
    return QZD.stateIO.todayStr ? QZD.stateIO.todayStr() : new Date().toISOString().slice(0, 10);
  }

  /* 当前是否在晨课窗口 [6:00, 7:30)。小时可取小数（7:15 = 7.25）。 */
  function inWindow(hour, c){
    c = c || C();
    var h = (typeof hour === 'number') ? hour : new Date().getHours() + new Date().getMinutes() / 60;
    return h >= (c.START_HOUR || 6) && h < (c.END_HOUR != null ? c.END_HOUR : 7.5);
  }

  /* 今日是否已领过晨课 */
  function doneToday(){
    return study().morningDone === today();
  }

  /* 挑一位妃子出晨间剧情：优先陪伴者，其次好感达标里最亲近的 */
  function pickConsort(companionId){
    var c = C(), list = (st().consorts || []).slice();
    if(!list.length) return null;
    var byId = list.filter(function(x){ return x.id === companionId; })[0];
    if(byId) return byId;
    var min = c.STORY_FAVOR_MIN || 20;
    var ok = list.filter(function(x){ return (x.favor || 0) >= min; });
    if(!ok.length) ok = list;
    ok.sort(function(a, b){ return (b.favor || 0) - (a.favor || 0); });
    return ok[0];
  }

  /* 晨间剧情：接进现成 fragment 引擎，按妃子的性格/才艺/血脉分叉。
     早上专属概率更高：hiddenBoost 提高血脉暗涌与掉马甲边缘段的权重；
     再叠一段昨夜余韵（after/side），让晨课与 bed 线接起来。 */
  function pickScene(consort){
    var c = C(), out = [];
    var hour = (c.START_HOUR || 6) + 0.3;
    if(QZD.story && QZD.story.fragment && consort){
      /* 昨夜痕迹（side/after）：把晨课与榻前线接上 */
      var trace = QZD.story.fragment({ tag: 'after', hour: 10, consort: consort,
        at: Date.now(), returning: false, allowCooldownFallback: true,
        hiddenBoost: 3 });
      if(trace && trace.text) out.push(trace.text);
      /* 晨间片段：morning 池 6 段，按性格/门槛先筛后抽 */
      var mf = QZD.story.fragment({ tag: 'morning', hour: hour, consort: consort,
        at: Date.now() + 1, returning: false, allowCooldownFallback: true,
        personalityBoost: 3 });
      if(mf && mf.text) out.push(mf.text);
      /* 隐藏剧情（方案一）：从 bed 池抽一段 hidden——血脉暗涌 / 掉马甲边缘 /
         别扭升级。复用现成 12 段，凡俗抽不到血脉段（fragment 内已守）。 */
      /* 第三段：从 bed 池取「清晨向」的段（晨起、理鬓、帘光），
         血脉/掉马甲的隐藏段仍加权更高；requireHourWindow 保证只取标了时段的段，
         不会把「榻前」夜戏塞进晨课。 */
      var hid = QZD.story.fragment({ tag: 'bed', hour: hour, consort: consort,
        at: Date.now() + 2, returning: false, allowCooldownFallback: true,
        hiddenBoost: 6, requireHourWindow: true });
      if(hid && hid.text) out.push(hid.text);
    }
    /* 兜底：story 引擎不在时退回静态文案，保证晨课永远有剧情 */
    if(!out.length){
      var scenes = c.SCENES || [];
      if(scenes.length){
        var t = today(), sum = 0;
        for(var i = 0; i < t.length; i++) sum += t.charCodeAt(i);
        out.push(scenes[sum % scenes.length]);
      }
    }
    var ending = c.REWARD_ENDING || '';
    return out.join('') + (ending ? (out.length > 1 ? ' ' : '') + ending : '');
  }

  /* 开场入口：早上开始专注那一刻调用——发签约金 + 弹剧情 + 打本场倍率标记。
     签约金当场到手（含金钱+勤政），是本场的一部分；倍率绑「这一场」，
     只要不结束就一直 1.5×，哪怕超过 7:30。每日只触发一次。 */
  function onFocusStart(ev){
    ev = ev || {};
    var c = C();
    var hour = (typeof ev.hour === 'number') ? ev.hour
             : new Date().getHours() + new Date().getMinutes() / 60;
    if(!inWindow(hour, c)) return { ok: false, reason: 'window' };
    if(study().morningStarted === today()) return { ok: false, reason: 'done' };

    var consort = pickConsort(ev.companionId);
    var sign = {};
    var sb = c.SIGN_BONUS || {};
    Object.keys(sb).forEach(function(k){ sign[k] = sb[k] || 0; });
    if(QZD.resources && QZD.resources.add) QZD.resources.add(sign);
    /* 陪伴妃子额外宠爱/喜爱（不改变受孕链路） */
    if(consort && (c.FAVOR_BONUS || c.DOTE_BONUS)){
      var favorCap = (QZD.harem && QZD.harem.favorMaxOf)
        ? QZD.harem.favorMaxOf(consort) : ((QZD.config.FAVOR || {}).MAX || 100);
      consort.favor = Math.min(favorCap, (consort.favor || 0) + (c.FAVOR_BONUS || 0));
      var doteCap = (QZD.harem && QZD.harem.doteMaxOf)
        ? QZD.harem.doteMaxOf(consort) : ((QZD.config.DOTE || {}).MAX || 100);
      consort.dote = Math.min(doteCap, (consort.dote || 0) + (c.DOTE_BONUS || 0));
      sign._consort = consort.name;
    }

    var scene = pickScene(consort);
    if(consort) scene = '「' + consort.name + '」· ' + scene;

    study().morningStarted = today();
    if(QZD.stateIO.pushLog) QZD.stateIO.pushLog('morning',
      '晨课开场 · 签约金入库，本场钱银倍率 ×' + (c.MONEY_RATE || 1.5));
    if(QZD.stateIO.save) QZD.stateIO.save();

    return { ok: true, sign: sign, scene: scene, consort: consort,
             consortId: consort ? consort.id : '', hour: hour,
             rate: c.MONEY_RATE || 1.5 };
  }

  /* 收工/退出：只清标记（由 pomodoro 负责），此处补一条起居注。
     倍率与签约金都已在本场生效，不再另发奖励。 */
  function onFocusEnd(ev){
    ev = ev || {};
    var c = C();
    if(study().morningStarted !== today()) return { ok: false, reason: 'notStarted' };
    if(doneToday()) return { ok: false, reason: 'done' };
    study().morningDone = today();
    if(QZD.stateIO.pushLog) QZD.stateIO.pushLog('morning', c.LOG || '晨课告成。');
    if(QZD.stateIO.save) QZD.stateIO.save();
    return { ok: true };
  }

  /* 只读视图，供 UI 显示今日晨课状态 */
  function view(){
    return {
      inWindow: inWindow(),
      done: doneToday(),
      startHour: C().START_HOUR || 6,
      endHour: C().END_HOUR != null ? C().END_HOUR : 7.5
    };
  }

  QZD.morning = {
    onFocusStart: onFocusStart,
    onFocusEnd: onFocusEnd,
    inWindow: inWindow,
    doneToday: doneToday,
    view: view,
    pickConsort: pickConsort,
    pickScene: pickScene
  };
})();
