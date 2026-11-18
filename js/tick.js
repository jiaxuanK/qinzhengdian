/* ============================================================
   tick.js · 1 秒主循环
   跨天重置 / 番茄结算与实时产出 / 页面刷新 / 每 5 秒兜底存档
   ============================================================ */
(function(){
  QZD.tick = {
    timer: null,
    lastSaveAt: Date.now(),

    start: function(){
      if(this.timer) return;
      this.timer = setInterval(function(){ QZD.tick.step(); }, 1000);
    },

    /* 番茄结算事件的播报 */
    announce: function(ev){
      if(!ev) return;
      if(ev.type === 'finished'){
        /* L2：专注收工给妃子练习点（含陪伴加成） */
        if(QZD.life) QZD.life.onFocusEnd(ev.companionId);
        /* F1：专注收工回补国势安定度（危机时这是「回朝平乱」的主要路径） */
        if(QZD.dynasty) QZD.dynasty.onFocusEnd(ev.minutes);
        /* S1：收工也是剧情情境（内部按每日一次 + focusQuiet 自行约束） */
        if(QZD.story) QZD.story.onFocusEnd();
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
        if(QZD.life) QZD.life.onFocusEnd(ev.companionId);
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
      var changed = QZD.stateIO.checkDailyReset();
      var ev = QZD.pomodoro.tick(now);
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
