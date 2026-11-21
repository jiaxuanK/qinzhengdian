/* ============================================================
   tick.js · 1 秒主循环
   跨天重置 / 番茄结算与实时产出 / 页面刷新 / 每 5 秒兜底存档
   ============================================================ */
(function(){
  /* 11-19 时辰氛围：按真实小时切 body[data-ambient]，只在跨时段时写一次 DOM，
     不跑独立定时器（挂在 2s 主循环里比对小时），零额外开销。 */
  var lastAmbient = '';
  function ambientOf(h){
    if(h >= 5 && h < 8) return 'dawn';
    if(h >= 8 && h < 17) return 'day';
    if(h >= 17 && h < 20) return 'dusk';
    return 'night';
  }
  function updateAmbient(){
    try {
      var a = ambientOf(new Date().getHours());
      if(a !== lastAmbient){ document.body.setAttribute('data-ambient', a); lastAmbient = a; }
    } catch(e){}
  }

  QZD.tick = {
    timer: null,
    lastSaveAt: Date.now(),

    start: function(){
      updateAmbient();   /* 首启立即上色 */
      if(this.timer) return;
      /* 11-19 省 CPU：1s → 2s。pomodoro.tick 按真实经过时间(dt)累计分钟，
         不是按调用次数，降频不丢专注分钟；暂停超时也是秒级宽限，不受影响。
         主卡计时显示 2s 刷新一次，秒数跳动肉眼几乎无感。 */
      this.timer = setInterval(function(){ QZD.tick.step(); }, 2000);
    },

    /* 番茄结算事件的播报 */
    announce: function(ev){
      if(!ev) return;
      if(ev.type === 'finished'){
        /* L2：专注收工给妃子练习点（含陪伴加成） */
        if(QZD.life) QZD.life.onFocusEnd(ev.companionId, ev.minutes);
        /* F1：专注收工回补国势安定度（危机时这是「回朝平乱」的主要路径） */
        if(QZD.dynasty) QZD.dynasty.onFocusEnd(ev.minutes);
        /* S1：收工也是剧情情境（内部按每日一次 + focusQuiet 自行约束） */
        if(QZD.story) QZD.story.onFocusEnd();
        /* 御极纪：本代专注分钟 / 周专注达到门槛时，讲帝王自己的长进 */
        if(QZD.emperorStory)
          QZD.emperorStory.onEvent('focus', { minutes: ev.minutes });
        var cnt = QZD.study ? QZD.study.bumpSession() : 0;
        var mins = (Math.round((ev.minutes || 0) * 10) / 10);
        var text = ev.mode === 'open'
          ? ('小目标达成，收工 · ' + mins + ' 分钟（全额结算）')
          : ((ev.late ? '昨日勤政，已入档 · ' : '勤政已毕 · ') + Math.floor(ev.minutes || 0) + ' 分钟');
        QZD.ui.toast(text);
        /* 晨课的签约金/剧情/倍率都在开场处理，收工只由 pomodoro.settleFinish 记一笔，
           此处不再发奖或弹窗，避免重复。 */
        if(QZD.study && QZD.study.shouldBreak()){
          QZD.ui.toast('已连续专注 ' + cnt + ' 场 · 起身活动 5 分钟');
        }
      }else if(ev.type === 'abandoned'){
        if(QZD.life) QZD.life.onFocusEnd(ev.companionId, ev.minutes);
        if(QZD.dynasty) QZD.dynasty.onFocusEnd(ev.minutes);
        if(QZD.story) QZD.story.onFocusEnd();
        QZD.ui.toast('专注中止 · 按五成结算' + (ev.auto ? '（暂停超时）' : ''));
        if(QZD.study) QZD.study.bumpSession();
      }else if(ev.type === 'progress'){
        if(ev.claimed && ev.claimed.length){
          QZD.ui.toast('任务已赏：' + ev.claimed.map(function(p){ return p.name; }).join('、'));
        }
        if(ev.finishedMemorial && ev.memorial){
          /* F1：办结奏折回补国势安定度 */
          if(QZD.dynasty) QZD.dynasty.onMemorialDone();
          /* 御极纪：奏折办结是帝王线入口（专注中不弹，由 announce 的 quiet 门控） */
          if(QZD.emperorStory)
            QZD.emperorStory.onEvent('memorial', { memorialId: ev.memorial.id });
          QZD.ui.toast('奏折「' + ev.memorial.title + '」已办结');
        }
      }else if(ev.type === 'birth'){
        (ev.births || []).forEach(function(b){
          QZD.ui.toast('喜得皇子「' + b.prince.name + '」 · 生母 ' + b.mother.name);
        });
      }
    },

    step: function(){
      var now = Date.now();
      updateAmbient();
      var changed = QZD.stateIO.checkDailyReset();
      var ev = QZD.pomodoro.tick(now);
      /* 11-19 注：conquest/works 的 settle 非专注时虽不产钱，但会把 lastAt
         推进到 now——跳过会导致下次专注时把整段离开时间算成产出。故保留调用。
         省 CPU 交给 P1 的 2s 降频（已砍半），此处不做危险优化。 */
      var tribute = QZD.conquest.settle(now);
      var births = QZD.harem.settle(now);
      QZD.works.settle(now);

      /* 专注免打扰：勤政进行中不弹随机事件 / 任务进度 / 临盆提示 */
      var quiet = !!(QZD.state.settings && QZD.state.settings.focusQuiet &&
                     QZD.pomodoro.isActive());

      /* S1：跨日也是一次剧情情境（与开机同日时由 lastRollDate 去重） */
      if(changed && QZD.story) QZD.story.roll();

      if(ev && !(quiet && ev.type === 'progress')) this.announce(ev);
      if(births && births.length && !quiet) this.announce({ type: 'birth', births: births });

      if(changed || ev || (births && births.length)){
        QZD.ui.onStateChanged();
      }else{
        QZD.ui.refreshHeader();
        var live = QZD.pomodoro.isActive() || tribute.jinQian > 0 || tribute.guoJin > 0 ||
          QZD.harem.hasPregnant();
        if(live) QZD.ui.refreshLive();
      }

      if(now - this.lastSaveAt >= QZD.config.SAVE_INTERVAL_MS){
        this.lastSaveAt = now;
        QZD.stateIO.save();
      }
    }
  };
})();
