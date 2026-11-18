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

  /* F1/F2/F3：国势日结算（缺席缓降 / 分级事件 / 拨乱反正，只给 toast） */
  if(QZD.dynasty) QZD.dynasty.onLaunch();

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
