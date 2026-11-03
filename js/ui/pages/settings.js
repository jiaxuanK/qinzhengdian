/* 设置：帝王自称 / 存档信息 / 导出 / 导入 / 清档 */
(function(){
  var UI = QZD.ui;
  var CFG = QZD.config;

  function kvRow(k, v){
    return '<div class="setting-row"><span class="k">' + k + '</span><span class="v">' + v + '</span></div>';
  }

  UI.register('settings', function(){
    var s = QZD.state;
    var backend = QZD.stateIO.backend() === 'local' ? 'localStorage（本地存档）' : '仅内存（刷新即丢失）';

    return '<section class="card">' +
      '<div class="card-head"><span class="card-title">帝王设置</span></div>' +
      '<div class="field">' +
        '<label for="emperor-name">帝王自称</label>' +
        '<input id="emperor-name" maxlength="12" value="' + UI.fmt.escape(s.meta.emperorName) + '">' +
      '</div>' +
      '<div class="btn-row"><button class="btn primary" data-act="save-name">保存自称</button></div>' +
      '<div class="setting-row"><span class="k">专注时免打扰</span><span class="v">' +
        (s.settings && s.settings.focusQuiet ? '已开启（勤政中不弹随机事件）' : '已关闭') + '</span></div>' +
      '<div class="btn-row"><button class="btn ghost" data-act="toggle-quiet">' +
        (s.settings && s.settings.focusQuiet ? '关闭免打扰' : '开启免打扰') + '</button></div>' +
      '<div class="setting-row"><span class="k">专注时收起侧栏</span><span class="v">' +
        (s.settings && s.settings.zen ? '已开启（专注中隐藏左侧导航）' : '已关闭') + '</span></div>' +
      '<div class="btn-row"><button class="btn ghost" data-act="toggle-zen">' +
        (s.settings && s.settings.zen ? '关闭专注模式' : '开启专注模式') + '</button></div>' +
      '<div class="setting-row"><span class="k">快捷键</span><span class="v">空格 暂停 · F2 浮窗 · N 灵感 · ? 说明</span></div>' +
      '<div class="btn-row"><button class="btn ghost" data-act="hotkeys">查看快捷键</button></div>' +
    '</section>' +

    '<section class="card">' +
      '<div class="card-head"><span class="card-title">存档</span></div>' +
      (function(){
        var hasSave = false;
        try { hasSave = !!localStorage.getItem(CFG.SAVE_KEY); } catch(e){ /* memory 后端时视为无 */ }
        if(!(window.QZDNative && window.QZDNative.isDesktop) || hasSave) return '';
        return '<div class="card-note" style="margin-bottom:10px">🖥️ 桌面版首次启动，存档是全新的。' +
          '想沿用浏览器版进度：先在浏览器版「设置 → 导出存档」拿到 JSON，再点下面「导入存档」选择它即可。</div>';
      })() +
      kvRow('存档键', CFG.SAVE_KEY) +
      kvRow('结构版本', s.meta.schemaVersion) +
      kvRow('存档方式', backend) +
      kvRow('建档时间', UI.fmt.time(s.meta.createdAt)) +
      kvRow('最近存档', UI.fmt.time(s.meta.lastSavedAt)) +
      kvRow('每日重置', s.meta.lastDailyReset) +
      '<div class="btn-row" style="margin-top:16px">' +
        '<button class="btn ghost" data-act="export">导出存档</button>' +
        '<button class="btn ghost" data-act="import">导入存档</button>' +
        '<button class="btn danger" data-act="wipe">清档重开</button>' +
        '<input type="file" id="import-file" accept=".json,application/json" hidden>' +
      '</div>' +
    '</section>' +

    '<section class="card">' +
      '<div class="card-head"><span class="card-title">自动备份</span></div>' +
      (function(){
        var desktop = !!(window.QZDNative && window.QZDNative.isDesktop && window.QZDNative.backupSave);
        var last = (QZD.backup && QZD.backup.lastDate) ? QZD.backup.lastDate() : '';
        return '<p style="margin:0 0 10px;font-size:12px;color:var(--ink2)">桌面版每天首次启动，自动把存档备份到 ' +
            '<code>reports/backup-日期.json</code>（只保留最近 7 份），并同步导出 ' +
            '<code>weekly-latest.json</code> 供每周定时任务读取。</p>' +
          kvRow('最近备份', last || '尚未备份') +
          '<div class="btn-row" style="margin-top:10px">' +
            '<button class="btn primary" data-act="backup-now">立即备份</button>' +
          '</div>' +
          (desktop ? '' : '<p style="margin:8px 0 0;font-size:11px;color:var(--ink2)">浏览器版没有文件权限，请用上方「导出存档」手动保存。</p>');
      })() +
    '</section>' +

    '<section class="card">' +
      '<div class="card-head"><span class="card-title">立绘素材</span></div>' +
      (function(){
        var A = QZD.ASSETS || { emperor: [], rare: [], pool: [] };
        var ec = (A.emperor || []).length, rc = (A.rare || []).length, pc = (A.pool || []).length;
        var desktop = !!(window.QZDNative && window.QZDNative.isDesktop);
        return '<p style="margin:0 0 12px;font-size:12px;color:var(--ink2)">往 <code>assets/images/</code> 丢新图即新增普通/稀有妃嫔；新建子文件夹（放多张图）即新增一位绝色妃嫔。改完点下面按钮刷新，无需开终端。</p>' +
          kvRow('当前素材', '帝王 ' + ec + ' · 绝色 ' + rc + ' · 普通池 ' + pc) +
          '<div class="btn-row"><button class="btn primary" data-act="refresh-assets">刷新立绘素材</button></div>' +
          '<p style="margin:8px 0 0;font-size:11px;color:var(--ink2)">' +
            (desktop
              ? '桌面版：直接扫描目录并重写清单，立即生效（下次启动也保留）。'
              : '浏览器版无法自动运行程序：点按钮后请选择 assets/images 里的图片（文件夹模式失效时可直接多选图片文件）；或双击游戏目录下的 <code>gen_assets.bat</code> 一键生成（推荐，最省事）；想点按钮全自动请改用桌面版 <code>npm start</code>。取消选择不会有提示。') +
          '</p>';
      })() +
    '</section>' +

    '<section class="card">' +
      '<div class="card-head"><span class="card-title">测试工具</span></div>' +
      '<p style="margin:0 0 12px;font-size:12px;color:var(--ink2)">仅供调试 / 体验，正式游玩请勿使用。</p>' +
      '<div class="btn-row">' +
        '<button class="btn ghost" data-act="debug-money">＋500 金钱</button>' +
        '<button class="btn ghost" data-act="debug-guo">＋200 国力</button>' +
        '<button class="btn ghost" data-act="debug-res-all">＋全套资源</button>' +
      '</div>' +
      '<div class="btn-row">' +
        '<button class="btn ghost" data-act="debug-dims">＋全套四维</button>' +
      '</div>' +
    '</section>';
  });

  /* 事件委托：只在设置页存在这些 data-act 节点 */
  document.addEventListener('click', function(e){
    var btn = e.target.closest('[data-act]');
    if(!btn) return;
    var act = btn.getAttribute('data-act');

    if(act === 'save-name'){
      var input = document.getElementById('emperor-name');
      var name = (input.value || '').trim();
      if(!name){ UI.toast('自称不能为空'); return; }
      QZD.state.meta.emperorName = name.slice(0, 12);
      QZD.stateIO.save();
      UI.toast('自称已保存');
    }else if(act === 'toggle-quiet'){
      var on = !(QZD.state.settings && QZD.state.settings.focusQuiet);
      QZD.state.settings = QZD.state.settings || {};
      QZD.state.settings.focusQuiet = on;
      QZD.stateIO.save();
      UI.onStateChanged();
      UI.toast(on ? '专注时免打扰已开启' : '已关闭专注免打扰');
    }else if(act === 'toggle-zen'){
      QZD.state.settings = QZD.state.settings || {};
      QZD.state.settings.zen = !QZD.state.settings.zen;
      QZD.stateIO.save();
      UI.onStateChanged();
      if(UI.pomo) UI.pomo.render();
      UI.toast(QZD.state.settings.zen ? '专注时将收起侧栏' : '已关闭专注模式');
    }else if(act === 'hotkeys'){
      if(UI.hotkeys && UI.hotkeys.help) UI.hotkeys.help();
    }else if(act === 'export'){
      QZD.stateIO.exportFile();
      UI.toast('存档已导出');
    }else if(act === 'import'){
      document.getElementById('import-file').click();
    }else if(act === 'wipe'){
      UI.confirm('清档将删除全部进度且不可恢复。确定重开山河吗？', function(){
        QZD.stateIO.wipe();
        UI.onStateChanged();
        UI.toast('已清档重开');
      }, { okText: '确定清档' });
    }else if(act === 'debug-money'){
      QZD.resources.add({ jinQian: 500 });
      QZD.stateIO.save();
      UI.onStateChanged();
      UI.toast('已＋500 金钱（测试）');
    }else if(act === 'debug-guo'){
      QZD.resources.add({ guoJin: 200 });
      QZD.stateIO.save();
      UI.onStateChanged();
      UI.toast('已＋200 国力（测试）');
    }else if(act === 'debug-res-all'){
      QZD.resources.add({ qinZheng: 200, jinQian: 500, guoJin: 200, shengWang: 50 });
      QZD.stateIO.save();
      UI.onStateChanged();
      UI.toast('已＋全套资源（测试）');
    }else if(act === 'debug-dims'){
      var e4 = QZD.state.emperor;
      ['ningShen','yuLue','mingDe','renXin'].forEach(function(k){
        e4[k] = Math.max(0, Math.min(10, (e4[k] || 0) + 3));
      });
      QZD.stateIO.save();
      UI.onStateChanged();
      UI.toast('已＋全套四维（测试）');
    }else if(act === 'refresh-assets'){
      if(QZD.assetsRefresh && QZD.assetsRefresh.refresh) QZD.assetsRefresh.refresh();
    }else if(act === 'backup-now'){
      if(!QZD.backup || !QZD.backup.run){ UI.toast('备份模块未加载'); return; }
      UI.toast('正在备份…');
      QZD.backup.run(function(res){
        UI.toast(res && res.ok ? '已备份到 reports/（保留最近 7 份）'
                               : '备份失败：' + ((res && res.error) || '未知错误'));
        UI.onStateChanged();
      });
    }
  });

  document.addEventListener('change', function(e){
    if(e.target.id !== 'import-file') return;
    var file = e.target.files && e.target.files[0];
    if(!file) return;
    var input = e.target;

    UI.confirm('导入将覆盖当前全部进度，确定继续？', function(){
      QZD.stateIO.importFile(file, function(ok, msg){
        input.value = '';
        if(ok) UI.onStateChanged();
        UI.toast(msg);
      });
    }, {
      okText: '确定导入',
      onCancel: function(){ input.value = ''; }
    });
  });
})();
