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

  function po(){ return QZD.state.pomodoro; }
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

    var gain = F.gainForMinutes(min);
    QZD.resources.add(gain);
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
    pendingSec = 0;
    lastAt = Date.now();
  }

  function boundTitle(){
    var p = po();
    if(p.title) return p.title;
    var m = QZD.memorials.find(p.boundMemorialId);
    return m ? m.title : '';
  }

  function startCommon(){
    var now = Date.now();
    var p = po();
    p.pauseCount = 0;
    p.pausedTotalSec = 0;
    p.pauseStartedAt = null;
    p.gained = { qinZheng: 0, jinQian: 0, guoJin: 0 };
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
      subtaskDone: !!subId,
      memorialId: memId || null,
      subtaskId: subId || null
    };
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
    var result = {
      type: 'abandoned',
      full: false,
      auto: !!auto,
      minutes: earnedMin * P.ABANDON_RATIO,
      lastMinutes: earnedMin,
      title: title,
      sessions: 1,
      memorialId: memId || null
    };
    resetIdle();
    IO.save();
    return result;
  }

  QZD.pomodoro = {
    isActive: active,
    boundId: function(){ return po().boundMemorialId; },
    boundSubtaskId: function(){ return po().boundSubtaskId; },
    gained: gainedOf,
    realizedMinutes: realizedMinutes,
    activeSeconds: function(){ return activeSec(Date.now()); },
    elapsedSec: function(now){ return Math.floor(activeSec(now || Date.now())); },
    title: boundTitle,

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
