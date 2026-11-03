/* ============================================================
   systems/backup.js · 自动备份
   - 桌面版每天首次启动：把整份存档写入 reports/backup-YYYY-MM-DD.json
     （主进程只保留最近 7 份），并顺手导出 weekly-latest.json 供定时任务读取
   - 浏览器版无文件权限，只在设置页提示手动导出
   ============================================================ */
(function(){
  var KEY = 'qzd_last_backup';
  /* 运行时判断：preload 注入时机可能晚于本脚本加载 */
  function desktopNow(){
    return !!(window.QZDNative && window.QZDNative.isDesktop && window.QZDNative.backupSave);
  }

  function pad(n){ return n < 10 ? '0' + n : '' + n; }
  function today(){
    var d = new Date();
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }
  function lastDate(){
    try { return localStorage.getItem(KEY) || ''; } catch(e){ return ''; }
  }
  function markDone(){
    try { localStorage.setItem(KEY, today()); } catch(e){ /* 忽略 */ }
  }

  function run(done){
    if(!desktopNow()){
      if(done) done({ ok: false, error: '浏览器版无法自动备份，请用「导出完整存档」' });
      return;
    }
    var json = JSON.stringify(QZD.state, null, 2);
    window.QZDNative.backupSave({ name: 'backup-' + today() + '.json', json: json })
      .then(function(res){
        if(res && res.ok){
          markDone();
          /* 顺手导出周报最新数据，保证每周定时任务有东西可读 */
          try {
            if(QZD.weekly && QZD.weekly.exportJson && window.QZDNative.exportWeekly){
              window.QZDNative.exportWeekly({
                name: 'weekly-' + today() + '.json',
                json: QZD.weekly.exportJson()
              });
            }
          } catch(e){ /* 忽略 */ }
        }
        if(done) done(res || { ok: false, error: '未知错误' });
      }, function(err){
        if(done) done({ ok: false, error: String(err) });
      });
  }

  /* 每天只自动跑一次 */
  function autoRun(){
    if(!desktopNow()) return;
    if(lastDate() === today()) return;
    run(function(){});
  }

  QZD.backup = {
    autoRun: autoRun,
    run: run,
    lastDate: lastDate,
    isDesktop: desktopNow
  };
})();
