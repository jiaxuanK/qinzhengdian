/* ============================================================
   main.js · 启动链路：探测存储 → 读档/建档 → 跨天判定 → 渲染 → 起 tick
   ============================================================ */
(function(){
  function fmtDec(n){ return (Math.round((n || 0) * 10) / 10).toFixed(1); }

  QZD.stateIO.probe();
  QZD.stateIO.load();
  QZD.stateIO.checkDailyReset();

  /* 刷新 / 误关页面后按真实时间补齐番茄结算 */
  var restored = QZD.pomodoro.restore();

  /* 属城贡赋按真实时间补算（离线封顶 8 小时） */
  var tribute = QZD.conquest.restore();

  /* 后宫孕期按真实时间补算：离线期间到期的皇子立即临盆 */
  var births = QZD.harem.restore();

  /* 营造产出按真实时间补算（离线封顶 8 小时） */
  var workshop = QZD.works.restore();

  QZD.ui.init();
  QZD.ui.refreshHeader();

  /* P0：每日首次登录弹一次内帑分配（不阻塞、可跳过） */
  if(QZD.privy) QZD.privy.onLaunch();

  /* L2：换周结算 / 在线练习点 / 回归小结 */
  if(QZD.life) QZD.life.onLaunch();

  /* S1：旧档追认 + 开机情境判定（只给 toast，不弹模态窗） */
  if(QZD.story) QZD.story.onLaunch();

  /* 11-19 传代检查：跨周（周日24:00）自动改元继统、归档年表、周期和亲。
     须先于其他结算，让新代的帝阶/质子态就位。 */
  if(QZD.regime && QZD.regime.checkGeneration) QZD.regime.checkGeneration();

  /* 11-19 登录打卡：每日首次打开自动签到（须先于国势结算，
     让 settle 的今日登录分档读得到 state.login.lastDate） */
  var loginR = null;
  if(QZD.checkin && QZD.checkin.onLogin) loginR = QZD.checkin.onLogin();

  /* F1/F2/F3：国势日结算（缺席缓降 / 分级事件 / 拨乱反正，只给 toast） */
  if(QZD.dynasty) QZD.dynasty.onLaunch();

  /* 登录打卡反馈：累登里程碑给明确 toast，普通签到给轻提示 */
  if(loginR && loginR.ok){
    if(loginR.gained){
      QZD.ui.toast('签到 · 连登 ' + loginR.streak + ' 天 · ' + loginR.gained.text);
    }else{
      QZD.ui.toast('签到成功 · 连登 ' + loginR.streak + ' 天');
    }
  }

  /* 桌面版：每天首次启动自动备份存档 + 导出周报数据 */
  if(QZD.backup) QZD.backup.autoRun();
  if(restored) QZD.tick.announce(restored);
  if(births) QZD.tick.announce({ type: 'birth', births: births });
  if(workshop){
    QZD.ui.toast('营造产出入账 · 金钱 +' + fmtDec(workshop.jinQian) +
      ' · 国力 +' + fmtDec(workshop.guoJin));
  }
  if(tribute){
    QZD.ui.toast('属城贡赋入账 · 金钱 +' + fmtDec(tribute.jinQian) +
      ' · 国力 +' + fmtDec(tribute.guoJin));
  }
  QZD.tick.start();

  /* 页面切走时立即存档 */
  document.addEventListener('visibilitychange', function(){
    if(document.visibilityState === 'hidden') QZD.stateIO.save();
  });
})();
