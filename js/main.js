/* ============================================================
   main.js · 启动链路：探测存储 → 读档/建档 → 跨天判定 → 渲染 → 起 tick
   ============================================================ */
(function(){
  function fmtDec(n){ return (Math.round((n || 0) * 10) / 10).toFixed(1); }

  function startAfterAssets(){
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
  var genR = null;
  if(QZD.regime && QZD.regime.checkGeneration) genR = QZD.regime.checkGeneration();
  /* 御极纪：7 天传代本身也是一章；新代起每条帝王线重新可演 */
  if(genR && genR.ok && QZD.emperorStory)
    QZD.emperorStory.onEvent('generation', { generation: genR.generation });

  /* 11-19 登录打卡：每日首次打开自动签到（须先于国势结算，
     让 settle 的今日登录分档读得到 state.login.lastDate） */
  var loginR = null;
  if(QZD.checkin && QZD.checkin.onLogin) loginR = QZD.checkin.onLogin();
  /* 御极纪：登录给帝王自己的剧情，与妃子线并行、共用弹窗队列 */
  if(QZD.emperorStory && loginR && loginR.ok){
    QZD.emperorStory.onEvent('login', {
      streak: loginR.streak, total: loginR.total
    });
  }

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
  }

  function start(){
    QZD.stateIO.load();
    /* 本机图包存在独立 IndexedDB，刷新后 blob: 地址会失效；
       必须在渲染前重新生成并覆盖 QZD.ASSETS，否则新抽的妃子没有立绘。 */
    var picsAllowed = !QZD.state.settings || QZD.state.settings.userpicsEnabled !== false;
    if(picsAllowed && QZD.userpics && QZD.userpics.count && QZD.userpics.applyToGame){
      var counted = QZD.userpics.count();
      if(!counted || !counted.then){ startAfterAssets(); return; }
      /* 国内 WebView 里 IDB 偶发挂起：最多等 1.5s，绝不卡住进殿。 */
      return Promise.race([
        counted,
        new Promise(function(res){ setTimeout(function(){ res(0); }, 1500); })
      ]).then(function(n){
        if(!n) return null;
        return QZD.userpics.applyToGame();
      }).then(function(){ startAfterAssets(); }).catch(function(){ startAfterAssets(); });
    }
    /* 清档后图包保留但暂不生效：恢复公开清单，等用户手动应用或重新导入。 */
    if(QZD.userpics && QZD.userpics.unbindFromGame) QZD.userpics.unbindFromGame();
    startAfterAssets();
  }

  /* 探测存储 → localStorage 可用则同步启动；被禁则先异步回读 IndexedDB 镜像再启动 */
  QZD.stateIO.probe();
  if(QZD.stateIO.backend() === 'local'){
    start();
  }else{
    QZD.stateIO.hydrate(start);
  }
})();
