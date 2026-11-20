/* ============================================================
   systems/pomodoro.js · 专注计时引擎（正计时）
   奏折＝专注任务：计时绑定「奏折（可再指定小目标）」，不设固定时长。
   - 奖励严格按已专注分钟累计（OUTPUT_PER_MIN × 分钟）
   - 完成并退出：全额结算，并把小目标标记完成
   - 放弃：按已专注时长的一半计入（资源、奏折进度同步回收）
   - 每次结算记录一次专注场次
   离线补算有宽限，防止关掉页面刷时长。
   ============================================================ */
(function(){
  var CFG = QZD.config;
  var P = CFG.POMODORO;
  var IO = QZD.stateIO;
  var F = QZD.formulas;

  var pendingSec = 0;   /* 不足一秒的零头，攒够再结算 */
  var lastAt = Date.now();

  function po(){
    if(!QZD.state.pomodoro || typeof QZD.state.pomodoro !== 'object'){
      QZD.state.pomodoro = { status:'idle', gained:{ qinZheng:0, jinQian:0, guoJin:0 },
                             morningBoost:false, signBonus:null };
    }
    return QZD.state.pomodoro;
  }
  function active(){
    return po().status === 'running' || po().status === 'paused';
  }

  function gainedOf(){
    var p = po();
    if(!p.gained) p.gained = { qinZheng: 0, jinQian: 0, guoJin: 0 };
    if(typeof p.gained.qinZheng !== 'number') p.gained.qinZheng = 0;
    if(typeof p.gained.jinQian !== 'number') p.gained.jinQian = 0;
    if(typeof p.gained.guoJin !== 'number') p.gained.guoJin = 0;
    return p.gained;
  }

  function realizedMinutes(){
    return F.minutesFromGain(gainedOf().qinZheng);
  }

  /* 本次专注的实际秒数（不含暂停，不设上限） */
  function activeSec(now){
    var p = po();
    if(!p.startedAt) return 0;
    var stop = now;
    if(p.status === 'paused' && p.pauseStartedAt) stop = Math.min(stop, p.pauseStartedAt);
    var sec = (stop - p.startedAt) / 1000 - (p.pausedTotalSec || 0);
    return Math.max(0, sec);
  }

  /* 写入分钟：资源（按分钟）+ 奏折进度 + 小目标分钟 + 每日专注总时长 */
  function applyMinutes(min){
    var out = { claimed: [], finishedMemorial: false, memorial: null };
    if(!(min > 0)) return out;

    /* 11-19 越久越赚：按本场已记账分钟作 before，取分段累进的增量收益。
       before 用勤政值反推（分段逆），保证逐秒调用与刷新补算都不重复计。 */
    var gain = F.gainForMinutes(min, F.minutesFromGain(gainedOf().qinZheng));
    /* 晨课本场：只把金钱乘倍率，勤政/国力照常。
       倍率绑在 p.morningBoost（本场标记），不按钟点，跨过 7:30 仍生效。 */
    if(po().morningBoost && gain.jinQian){
      var mr = (QZD.config.MORNING || {}).MONEY_RATE;
      gain.jinQian = gain.jinQian * (typeof mr === 'number' && mr > 0 ? mr : 1.5);
    }
    QZD.resources.add(gain);
    /* 巫祝天赋：每日首次专注 +1 勤政。单独入账、不写 p.gained，
       否则「按勤政反推分钟」的分段结算会把这 1 点当成专注时长。 */
    if(QZD.bloodTalent) QZD.bloodTalent.onFocusTick();
    /* P0：在线勤政的金钱产出按比例计提为「可拨内帑」（只记账，不动钱包） */
    if(QZD.privy) QZD.privy.capture(gain.jinQian);
    var g = gainedOf();
    g.qinZheng += gain.qinZheng;
    g.jinQian += gain.jinQian;
    g.guoJin += gain.guoJin;

    var p = po();
    if(p.boundMemorialId){
      var r = QZD.memorials.addMinutes(p.boundMemorialId, min);
      out.memorial = r.memorial;
      /* 小目标指定了具体条目时，分钟同时记到条目上 */
      if(p.boundSubtaskId) QZD.memorials.addSubFocusMin(p.boundSubtaskId, min);
    }
    if(QZD.study && QZD.study.addMinutesSilent){
      /* 分钟同时记到奏折所属课题，供钦天监按课题统计 */
      var bm = p.boundMemorialId ? QZD.memorials.find(p.boundMemorialId) : null;
      QZD.study.addMinutesSilent(min, bm ? bm.subjectId : null);
    }
    /* 帝阶累计专注：本代专注分钟（亡国/传代归零，升级不清零） */
    if(QZD.regime && QZD.regime.addFocus) QZD.regime.addFocus(min);
    return out;
  }

  function resetIdle(){
    var p = po();
    p.status = 'idle';
    p.mode = 'open';
    p.boundMemorialId = null;
    p.boundSubtaskId = null;
    p.title = '';
    p.durationMin = 0;
    p.startedAt = null;
    p.endsAt = null;
    p.lastTickAt = null;
    p.pauseCount = 0;
    p.pausedTotalSec = 0;
    p.pauseStartedAt = null;
    p.gained = { qinZheng: 0, jinQian: 0, guoJin: 0 };
    p.morningBoost = false;    /* 本场结束即清，下一场回归正常 1× */
    p.signBonus = null;
    p.companionRewardCount = 0;   /* 陪伴奖励每场重置 */
    pendingSec = 0;
    lastAt = Date.now();
  }

  function boundTitle(){
    var p = po();
    if(p.title) return p.title;
    var m = QZD.memorials.find(p.boundMemorialId);
    return m ? m.title : '';
  }

  /* 专注流水：每场结束记一条，供日程时间轴显示「在做什么任务」与连贯性。
     在 resetIdle 之前调用，此时 p.title/startedAt/memorialId 都还在。 */
  /* 从 [起, 止] 里挖掉所有暂停区间，得到「真正在专注」的片段。
     时间轴据此区分实心段（专注）与淡段（停摆），条长＝实际专注时间。 */
  function focusSpans(start, end, pauseSpans){
    var out = [], cur = start;
    (Array.isArray(pauseSpans) ? pauseSpans : []).forEach(function(ps){
      if(!ps) return;
      var a = Math.max(ps[0] || start, start);
      var b = Math.min(ps[1] == null ? end : ps[1], end);
      if(b <= a) return;
      if(a > cur) out.push([cur, a]);
      cur = Math.max(cur, b);
    });
    if(end > cur) out.push([cur, end]);
    return out;
  }

  function recordFocusLog(result, full, realMinutes, startAt){
    var p = po();
    var st = QZD.state.study;
    if(!st) return;
    if(!Array.isArray(st.focusLog)) st.focusLog = [];
    var now = Date.now();
    var mins = (typeof realMinutes === 'number' ? realMinutes : (result.minutes || 0));
    var bm = p.boundMemorialId ? QZD.memorials.find(p.boundMemorialId) : null;
    var s0 = startAt || p.startedAt || (now - mins * 60000);
    st.focusLog.push({
      date: IO.todayStr(new Date(now)),
      start: s0,
      end: now,
      minutes: Math.round(mins * 10) / 10,
      /* 专注片段（已挖掉暂停）：旧档没有此字段，绘制时会按 minutes 压缩 */
      spans: focusSpans(s0, now, p.pauseSpans),
      title: result.title || boundTitle() || '未命名专注',
      memorialId: p.boundMemorialId || null,
      subjectId: bm ? (bm.subjectId || null) : null,
      morning: !!p.morningBoost,
      full: !!full
    });
    var cap = (CFG.FOCUS && CFG.FOCUS.LOG_CAP) || 400;
    while(st.focusLog.length > cap) st.focusLog.shift();
  }

  function startCommon(){
    var now = Date.now();
    var p = po();
    p.pauseCount = 0;
    p.pausedTotalSec = 0;
    p.pauseStartedAt = null;
    p.pauseSpans = [];        /* 本场每次暂停的 [起, 止]（未恢复时止为 null） */
    p.gained = { qinZheng: 0, jinQian: 0, guoJin: 0 };
    p.morningBoost = false;    /* 新一场默认无晨课倍率，开场回调命中才置位 */
    p.signBonus = null;
    p.startedAt = now;
    p.lastTickAt = now;
    p.status = 'running';
    pendingSec = 0;
    lastAt = now;
    return p;
  }

  /* ---------- 结算：完成并退出（全额 + 标记小目标） ---------- */
  function settleFinish(){
    var p = po();
    var now = Date.now();
    var sec = activeSec(now);
    var remainMin = sec / 60 - realizedMinutes();
    if(remainMin > 1 / 120) applyMinutes(remainMin);

    var minutes = Math.round(sec / 60 * 10) / 10;
    var title = boundTitle();
    var memId = p.boundMemorialId, subId = p.boundSubtaskId;
    if(memId) QZD.memorials.addSession(memId, 1);
    if(memId && subId) QZD.memorials.setSubDone(memId, subId, true);

    IO.pushLog('pomodoro', '完成并退出 · ' + title + ' · ' + minutes +
      ' 分钟（全额结算，已计 1 次专注）');
    var result = {
      type: 'finished',
      full: true,
      minutes: minutes,
      title: title,
      sessions: 1,
      companionId: p.companionId || null,
      subtaskDone: !!subId,
      memorialId: memId || null,
      subtaskId: subId || null
    };
    /* 晨课收工：仅记一笔，标记与签约金随 resetIdle 清零（倍率只作用本场） */
    if(QZD.morning) QZD.morning.onFocusEnd({ minutes: minutes, companionId: p.companionId });
    recordFocusLog(result, true);   /* 日程时间轴：任务名 + 起止时间 + 连贯性 */
    resetIdle();
    IO.save();
    return result;
  }

  /* ---------- 结算：放弃（按已专注时长的一半） ---------- */
  function settleAbandon(auto){
    var p = po();
    var now = Date.now();
    var shouldSec = activeSec(now);
    /* 先把这段时间全额记上，再回收一半 —— 结果即「按五成计入」 */
    var remainSec = shouldSec - realizedMinutes() * 60;
    if(remainSec > 0.5) applyMinutes(remainSec / 60);

    var earnedMin = shouldSec / 60;
    var title = boundTitle();
    var memId = p.boundMemorialId;
    QZD.resources.reclaim(gainedOf(), P.ABANDON_RATIO);
    if(memId){
      QZD.memorials.removeMinutes(memId, earnedMin * P.ABANDON_RATIO);
      QZD.memorials.addSession(memId, 1);
    }

    IO.pushLog('pomodoro', '放弃 · ' + title + ' · 已专注 ' +
      (Math.round(earnedMin * 10) / 10) + ' 分钟，按五成计入' +
      (auto ? '（暂停超时）' : ''));
    var abandonStartAt = p.startedAt;   /* resetIdle 前留档，流水要记真实开场时间 */
    var result = {
      type: 'abandoned',
      full: false,
      auto: !!auto,
      minutes: earnedMin * P.ABANDON_RATIO,
      lastMinutes: earnedMin,
      title: title,
      sessions: 1,
      companionId: p.companionId || null,
      memorialId: memId || null
    };
    recordFocusLog(result, false, earnedMin, abandonStartAt);  /* 流水记实际时长（非五折后） */
    resetIdle();
    IO.save();
    return result;
  }

  QZD.pomodoro = {
    isActive: active,
    boundId: function(){ return po().boundMemorialId; },
    boundSubtaskId: function(){ return po().boundSubtaskId; },
    gained: gainedOf,
    /* 开场命中晨课时置位：本场金钱 ×1.5，直到本场结束（resetIdle 清理） */
    markMorning: function(signBonus){
      var p = po();
      p.morningBoost = true;
      p.signBonus = signBonus || null;
    },
    isMorning: function(){ return !!po().morningBoost; },
    realizedMinutes: realizedMinutes,
    activeSeconds: function(){ return activeSec(Date.now()); },
    elapsedSec: function(now){ return Math.floor(activeSec(now || Date.now())); },
    title: boundTitle,

    /* 专注陪伴奖励：每满 25 分钟可领一次免费相处（50分可领2次、75分领3次…）。
       用「已领次数」记账：下次门槛 = 25 × (已领次数+1)。 */
    companionRewardCount: function(){ return po().companionRewardCount || 0; },
    companionRewardReady: function(){
      var p = po();
      if(!p.companionId || !active()) return false;
      var step = P.COMPANION_REWARD_MIN || 25;
      var claimed = p.companionRewardCount || 0;
      return realizedMinutes() >= step * (claimed + 1);
    },
    /* 距离下一次可领还差几分钟（UI 显示用） */
    companionRewardRemaining: function(){
      var p = po();
      if(!p.companionId) return 0;
      var step = P.COMPANION_REWARD_MIN || 25;
      var claimed = p.companionRewardCount || 0;
      return Math.max(0, Math.ceil(step * (claimed + 1) - realizedMinutes()));
    },
    claimCompanionReward: function(){
      var p = po();
      if(!this.companionRewardReady()){
        return { ok:false, error:'再专注 ' + this.companionRewardRemaining() + ' 分钟才可相处' };
      }
      var c = QZD.harem.consortById(p.companionId);
      if(!c) return { ok:false, error:'陪妃不在后宫' };
      var g = QZD.harem.grantAffection(c.id, P.COMPANION_REWARD.favor, P.COMPANION_REWARD.dote);
      p.companionRewardCount = (p.companionRewardCount || 0) + 1;
      IO.save();
      return { ok:true, consort:c, favorGain:g.favorGain, doteGain:g.doteGain,
               count:p.companionRewardCount };
    },

    pauseRemainingSec: function(now){
      now = now || Date.now();
      var p = po();
      var used = p.pausedTotalSec || 0;
      if(p.status === 'paused' && p.pauseStartedAt) used += (now - p.pauseStartedAt) / 1000;
      return Math.max(0, P.MAX_PAUSE_SEC - used);
    },

    canPause: function(){
      return po().status === 'running' && po().pauseCount < P.MAX_PAUSE_COUNT;
    },

    /* 开始专注：绑奏折，subId 可空（不指定具体小目标） */
    startOpen: function(memorialId, subId, companionId){
      if(active()) return { ok: false, error: '已有专注正在进行' };
      var m = QZD.memorials.find(memorialId);
      if(!m) return { ok: false, error: '奏折不存在' };
      if(m.status === 'banjie') return { ok: false, error: '奏折已办结' };

      var sub = null;
      if(subId){
        sub = QZD.memorials.findSubById(subId);
        if(!sub || sub.memorial.id !== m.id) return { ok: false, error: '小目标不存在' };
        if(sub.sub.done) return { ok: false, error: '该小目标已完成' };
      }

      if(m.status === 'daipi' || m.status === 'gezhi') QZD.memorials.setStatus(m.id, 'pizhong');

      var p = startCommon();
      p.mode = 'open';
      p.boundMemorialId = m.id;
      p.boundSubtaskId = sub ? sub.sub.id : null;
      p.title = sub ? (m.title + ' · ' + sub.sub.title) : m.title;
      p.companionId = companionId || null;
      p.companionRewardCount = 0;
      p.durationMin = 0;
      p.endsAt = null;

      IO.pushLog('pomodoro', '开始专注 · ' + p.title);
      IO.save();
      return { ok: true };
    },

    /* 兼容旧名 */
    start: function(memorialId, subId, companionId){
      return this.startOpen(memorialId, subId, companionId);
    },

    pause: function(){
      var p = po();
      if(p.status !== 'running') return { ok: false, error: '当前不在专注中' };
      if(p.pauseCount >= P.MAX_PAUSE_COUNT) return { ok: false, error: '暂停次数已用尽（' + P.MAX_PAUSE_COUNT + ' 次）' };
      p.pauseCount += 1;
      p.pauseStartedAt = Date.now();
      p.status = 'paused';
      if(!Array.isArray(p.pauseSpans)) p.pauseSpans = [];
      p.pauseSpans.push([p.pauseStartedAt, null]);   /* 恢复时补上止点 */
      pendingSec = 0;
      lastAt = p.pauseStartedAt;
      IO.pushLog('pomodoro', '专注暂歇 · 第 ' + p.pauseCount + ' 次暂停');
      IO.save();
      return { ok: true };
    },

    resume: function(){
      var p = po();
      if(p.status !== 'paused') return { ok: false, error: '当前不在暂停中' };
      var now = Date.now();
      var deltaSec = (now - p.pauseStartedAt) / 1000;
      if((p.pausedTotalSec || 0) + deltaSec > P.MAX_PAUSE_SEC){
        return { ok: false, abandoned: true, result: settleAbandon(true) };
      }
      p.pausedTotalSec = (p.pausedTotalSec || 0) + deltaSec;
      /* 补齐最近一次未闭合的暂停区间，供时间轴区分「专注」与「停摆」 */
      if(Array.isArray(p.pauseSpans) && p.pauseSpans.length){
        for(var si = p.pauseSpans.length - 1; si >= 0; si--){
          if(p.pauseSpans[si][1] == null){ p.pauseSpans[si][1] = now; break; }
        }
      }
      p.pauseStartedAt = null;
      p.status = 'running';
      lastAt = now;
      pendingSec = 0;
      IO.pushLog('pomodoro', '专注继续');
      IO.save();
      return { ok: true };
    },

    /* 放弃 */
    abandon: function(){ return settleAbandon(false); },
    /* 完成并退出 */
    finishAndExit: function(){
      var p = po();
      if(p.status !== 'running' && p.status !== 'paused') return { ok: false, error: '当前不在专注中' };
      return settleFinish();
    },

    /* 启动时补齐：只补到「最后一次心跳 + 宽限」，防止关页面刷时长 */
    restore: function(){
      var p = po();
      if(p.status === 'finished' || p.status === 'abandoned'){
        resetIdle();
        IO.save();
        return null;
      }
      if(!active()) return null;
      var now = Date.now();
      lastAt = now;
      pendingSec = 0;

      var grace = ((CFG.FOCUS && CFG.FOCUS.OPEN_OFFLINE_GRACE_SEC) || 120) * 1000;
      var ref = p.lastTickAt ? Math.min(now, p.lastTickAt + grace) : now;
      var gap = activeSec(ref) / 60 - realizedMinutes();
      if(gap > 0.0001) applyMinutes(gap);
      p.lastTickAt = now;

      if(p.status === 'paused' && p.pauseStartedAt &&
         (p.pausedTotalSec || 0) + (now - p.pauseStartedAt) / 1000 > P.MAX_PAUSE_SEC){
        return settleAbandon(true);
      }
      IO.save();
      return null;
    },

    /* 每秒调用；返回本秒需要播报的事件（无事件则 null） */
    tick: function(now){
      now = now || Date.now();
      var p = po();

      if(p.status === 'finished' || p.status === 'abandoned'){
        resetIdle();
        IO.save();
        return null;
      }

      if(p.status === 'paused'){
        if(p.pauseStartedAt && (p.pausedTotalSec || 0) + (now - p.pauseStartedAt) / 1000 > P.MAX_PAUSE_SEC){
          return settleAbandon(true);
        }
        lastAt = now;
        pendingSec = 0;
        return null;
      }

      if(p.status !== 'running'){
        lastAt = now;
        pendingSec = 0;
        return null;
      }

      var dt = (now - lastAt) / 1000;
      lastAt = now;
      p.lastTickAt = now;   /* 心跳，供离线宽限使用 */
      if(dt > 0) pendingSec += dt;

      var applied = null;
      if(pendingSec >= 1){
        var whole = Math.floor(pendingSec);
        pendingSec -= whole;
        applied = applyMinutes(whole / 60);
      }
      if(applied && applied.memorial) return { type: 'minute', memorial: applied.memorial };
      return null;
    }
  };
})();
