/* 设置 —— 单页直排，不分内部 tab */
(function(){
  var UI = QZD.ui;
  var CFG = QZD.config;

  function kvRow(k, v){
    return '<div class="setting-row"><span class="k">' + k + '</span><span class="v">' + (v == null ? '—' : v) + '</span></div>';
  }
  /* 异步填充本机图包计数（IDB 计数是异步的，渲染后补填） */
  function updateUpicCount(){
    var el = document.getElementById('upic-count');
    if(!el) return;
    if(!QZD.userpics || !QZD.userpics.count){ el.textContent = '不支持'; return; }
    QZD.userpics.count().then(function(n){ el.textContent = n + ' 张（本机）'; });
  }
  function setUserpicsEnabled(on){
    QZD.state.settings = QZD.state.settings || {};
    QZD.state.settings.userpicsEnabled = !!on;
    if(QZD.stateIO && QZD.stateIO.save) QZD.stateIO.save();
  }

  UI.register('settings', function(){
    /* 本页 DOM 落地后异步补填图包计数（IDB 异步） */
    setTimeout(updateUpicCount, 0);
    var s = QZD.state || {};
    var meta = s.meta || {};
    var set = s.settings || {};
    var stateIO = QZD.stateIO || {};
    var backend = (stateIO.backend && stateIO.backend() === 'local') ? 'localStorage（本地存档）' : '仅内存（刷新即丢失）';
    var desktop = !!(window.QZDNative && window.QZDNative.isDesktop && window.QZDNative.backupSave);
    var hasSave = false;
    try { hasSave = !!localStorage.getItem(CFG.SAVE_KEY); } catch(e){}
    var last = (QZD.backup && QZD.backup.lastDate) ? QZD.backup.lastDate() : '';
    var A = QZD.ASSETS || { emperor: [], rare: [], pool: [] };
    var ec = (A.emperor || []).length, rc = (A.rare || []).length, pc = (A.pool || []).length;
    var fmtTime = UI.fmt && UI.fmt.time ? UI.fmt.time : function(v){ return v || '—'; };
    var fmtEsc = UI.fmt && UI.fmt.escape ? UI.fmt.escape : function(v){ return String(v == null ? '' : v); };

    return (
      /* ===== 帝王设置 ===== */
      '<section class="card">' +
        '<div class="card-head"><span class="card-title">帝 王 设 置</span></div>' +
        '<div class="field">' +
          '<label for="emperor-name">帝王自称</label>' +
          '<input id="emperor-name" maxlength="12" value="' + fmtEsc(meta.emperorName || '朕') + '">' +
        '</div>' +
        '<div class="btn-row"><button class="btn primary" data-act="save-name">保存自称</button></div>' +
        /* 11-18：状态与操作按钮合并到同一行（此前每项占两行，太长） */
        '<div class="setting-row"><span class="k">专注时免打扰</span><span class="setting-act">' +
          '<span class="v">' + (set.focusQuiet ? '已开启' : '已关闭') + '</span>' +
          '<button class="btn ghost sm" data-act="toggle-quiet">' +
          (set.focusQuiet ? '关闭' : '开启') + '</button></span></div>' +
        '<div class="setting-row"><span class="k">专注时收起侧栏</span><span class="setting-act">' +
          '<span class="v">' + (set.zen ? '已开启' : '已关闭') + '</span>' +
          '<button class="btn ghost sm" data-act="toggle-zen">' +
          (set.zen ? '关闭' : '开启') + '</button></span></div>' +
        '<div class="setting-row"><span class="k">快捷键</span><span class="setting-act">' +
          '<span class="v">空格 暂停 · N 灵感 · ? 说明</span>' +
          '<button class="btn ghost sm" data-act="hotkeys">查看</button></span></div>' +
      '</section>' +

      /* ===== 存档信息 ===== */
      '<section class="card">' +
        '<div class="card-head"><span class="card-title">存 档 信 息</span></div>' +
        (!(window.QZDNative && window.QZDNative.isDesktop) || hasSave ? ''
          : '<div class="card-note" style="margin-bottom:10px">🖥️ 桌面版首次启动，存档是全新的。' +
            '想沿用浏览器版进度：先在浏览器版「设置 → 导出存档」拿到 JSON，再点下面「导入存档」选择它即可。</div>') +
        kvRow('存档键', CFG.SAVE_KEY) +
        kvRow('结构版本', meta.schemaVersion) +
        kvRow('存档方式', backend) +
        kvRow('建档时间', fmtTime(meta.createdAt)) +
        kvRow('最近存档', fmtTime(meta.lastSavedAt)) +
        kvRow('每日重置', meta.lastDailyReset) +
        '<div class="btn-row" style="margin-top:16px">' +
          '<button class="btn ghost" data-act="export">导出存档</button>' +
          '<button class="btn ghost" data-act="import">导入存档</button>' +
          '<button class="btn danger" data-act="wipe">清档重开</button>' +
          '<input type="file" id="import-file" accept=".json,application/json" hidden>' +
        '</div>' +
      '</section>' +

      /* ===== 自动备份 ===== */
      '<section class="card">' +
        '<div class="card-head"><span class="card-title">自 动 备 份</span></div>' +
        '<p style="margin:0 0 10px;font-size:12px;color:var(--ink2)">桌面版每天首次启动，自动把存档备份到 ' +
          '<code>reports/backup-日期.json</code>（只保留最近 7 份），并同步导出 ' +
          '<code>weekly-latest.json</code> 供每周定时任务读取。</p>' +
        kvRow('最近备份', last || '尚未备份') +
        '<div class="btn-row" style="margin-top:10px">' +
          '<button class="btn primary" data-act="backup-now">立即备份</button>' +
        '</div>' +
        (desktop ? '' : '<p style="margin:8px 0 0;font-size:11px;color:var(--ink2)">浏览器版没有文件权限，请用「导出存档」手动保存。</p>') +
      '</section>' +

      /* ===== 自带图包（隐私：图只在本机，不随游戏发布） ===== */
      '<section class="card">' +
        '<div class="card-head"><span class="card-title">自 带 图 包</span>' +
          '<span class="card-note">图只存本机 · 别人看不到</span></div>' +
        '<p style="margin:0 0 12px;font-size:12px;color:var(--ink2)">游戏本体不含妃子图。点「导入图包」选你自己的图片文件夹，' +
        '按文件夹自动分组（一个文件夹=一位妃子，多图=多姿态）。图存在这台设备，不会上传。</p>' +
        kvRow('本机图包', '<span id="upic-count">读取中…</span>') +
        '<div class="btn-row" style="flex-wrap:wrap;gap:6px">' +
          '<button class="btn primary" data-act="import-pics">导入图包</button>' +
          '<button class="btn" data-act="apply-pics">应用本机图包</button>' +
          '<button class="btn" data-act="export-pics">导出备份</button>' +
          '<button class="btn" data-act="compact-pics">压缩现有图包</button>' +
          '<button class="btn ghost" data-act="clear-pics">清空图包</button>' +
        '</div>' +
        '<p style="margin:8px 0 0;font-size:11px;color:var(--ink2)">' +
          '换设备：先在旧设备「导出备份」存成文件，再到新设备「导入备份」恢复。' +
          '图包与存档分开存，清存档不会丢图。' +
        '</p>' +
        '<div class="btn-row" style="margin-top:8px">' +
          '<button class="btn ghost" data-act="import-pic-pack">导入备份文件</button>' +
        '</div>' +
      '</section>' +

      /* ===== 立绘素材（桌面版扫描 / 兼容旧流程） ===== */
      '<section class="card">' +
        '<div class="card-head"><span class="card-title">立 绘 素 材</span></div>' +
        '<p style="margin:0 0 12px;font-size:12px;color:var(--ink2)">往 <code>assets/images/</code> 丢新图即新增普通/稀有妃嫔；' +
        '新建子文件夹（放多张图）即新增一位绝色妃嫔。改完点下面按钮刷新，无需开终端。</p>' +
        kvRow('当前素材', '帝王 ' + ec + ' · 绝色 ' + rc + ' · 普通池 ' + pc) +
        '<div class="btn-row"><button class="btn primary" data-act="refresh-assets">刷新立绘素材</button></div>' +
        '<p style="margin:8px 0 0;font-size:11px;color:var(--ink2)">' +
          (desktop
            ? '桌面版：直接扫描目录并重写清单，立即生效。'
            : '浏览器版：点按钮后请选择 assets/images 里的图片；或双击 <code>gen_assets.bat</code> 一键生成（推荐）。') +
        '</p>' +
      '</section>' +

      /* ===== 测试工具 ===== */
      '<section class="card">' +
        '<div class="card-head"><span class="card-title">测 试 工 具</span></div>' +
        '<p class="card-note" style="margin:0 0 8px">仅供调试 / 体验，正式游玩请勿使用。</p>' +
        '<div class="btn-row debug-tools">' +
          '<button class="btn ghost" data-act="debug-money">＋500 金钱</button>' +
          '<button class="btn ghost" data-act="debug-guo">＋200 国力</button>' +
          '<button class="btn ghost" data-act="debug-res-all">＋全套资源</button>' +
          '<button class="btn ghost" data-act="debug-dims">＋全套四维</button>' +
        '</div>' +
      '</section>' +

      /* ===== 历代年表（11-19 传代沉淀，永久保存） ===== */
      '<section class="card">' +
        '<div class="card-head"><span class="card-title">历 代 年 表</span>' +
          '<span class="card-note">' + ((s.chronicle || []).length) + ' 代 · 每周日改元继统</span></div>' +
        (function(){
          var list = s.chronicle || [];
          if(!list.length) return '<p class="card-note">尚无传代记录。满七日后自动改元，历代功过将刻入此册。</p>';
          return '<div class="chronicle-list">' + list.slice().reverse().map(function(rec){
            var hosted = (rec.hosted || []).length, rescued = (rec.rescued || []).length;
            return '<div class="chronicle-row">' +
              '<div class="chronicle-head">第 ' + rec.generation + ' 代 · ' + fmtEsc(rec.finalRankName || '') +
                ' · ' + rec.focusMin + ' 分</div>' +
              '<div class="chronicle-epitaph">' + fmtEsc(rec.epitaph || '') + '</div>' +
              '<div class="chronicle-meta">' + fmtEsc(rec.span || '') +
                ' · 最深 ' + (rec.bestRank || 1) + ' 阶 · 光复 ' + (rec.restoreCount || 0) +
                ' / 亡国 ' + (rec.fallCount || 0) + ' · 质子 ' + hosted + ' / 迎回 ' + rescued + '</div>' +
            '</div>';
          }).join('') + '</div>';
        })() +
      '</section>'
    );
  });

  /* 事件委托 */
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
      UI.confirm('清档将删除全部进度且不可恢复；本机图包会保留但暂时解除绑定。确定重开山河吗？', function(){
        QZD.stateIO.wipe();
        if(QZD.userpics && QZD.userpics.unbindFromGame) QZD.userpics.unbindFromGame();
        UI.onStateChanged();
        UI.toast('已清档重开；图包保留，需重新应用才生效');
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
    }else if(act === 'apply-pics'){
      /* 清档后图包仍在，只是解除了绑定；手动点这里恢复。 */
      QZD.userpics.applyToGame().then(function(a){
        setUserpicsEnabled(true);
        UI.onStateChanged();
        UI.toast('已应用本机图包 · 绝色 ' + a.rare + ' · 普通 ' + a.pool);
        updateUpicCount();
      }).catch(function(err){ UI.toast('应用失败：' + (err && err.message || err)); });
    }else if(act === 'import-pics'){
      /* 选文件夹：webkitdirectory 多选，导入到本机图包库 */
      var inp = document.createElement('input');
      inp.type = 'file';
      inp.setAttribute('webkitdirectory','');
      inp.setAttribute('mozdirectory','');
      inp.multiple = true;
      inp.style.cssText = 'position:absolute;left:-9999px;top:-9999px;opacity:0';
      document.body.appendChild(inp);
      inp.addEventListener('change', function(){
        var fs = inp.files; inp.remove();
        if(!fs || !fs.length){ return; }
        UI.toast('正在导入 ' + fs.length + ' 个文件…');
        QZD.userpics.importFiles(fs).then(function(r){
          if(!r.ok){ UI.toast(r.error || '导入失败'); return; }
          return QZD.userpics.applyToGame().then(function(a){
            setUserpicsEnabled(true);
            UI.onStateChanged();
            UI.toast('已导入 ' + r.added + ' 张 · ' + (r.groups||[]).length + ' 组，图只存在本机');
            updateUpicCount();
          });
        }).catch(function(err){ UI.toast('导入失败：' + (err && err.message || err)); });
      });
      if(window.requestAnimationFrame) requestAnimationFrame(function(){ inp.click(); });
      else setTimeout(function(){ inp.click(); }, 0);
    }else if(act === 'import-pic-pack'){
      /* 恢复备份 JSON */
      var pin = document.createElement('input');
      pin.type = 'file'; pin.accept = '.json,application/json';
      pin.style.cssText = 'position:absolute;left:-9999px;top:-9999px;opacity:0';
      document.body.appendChild(pin);
      pin.addEventListener('change', function(){
        var f = pin.files && pin.files[0]; pin.remove();
        if(!f) return;
        var fr = new FileReader();
        fr.onload = function(){
          try{
            QZD.userpics.importPack(String(fr.result)).then(function(r){
              if(!r.ok){ UI.toast(r.error || '恢复失败'); return; }
              return QZD.userpics.applyToGame().then(function(){
                setUserpicsEnabled(true);
                UI.onStateChanged(); UI.toast('已恢复 ' + r.added + ' 张图'); updateUpicCount();
              });
            }).catch(function(e){ UI.toast('恢复失败：' + (e.message||e)); });
          }catch(err){ UI.toast('备份文件不是有效 JSON'); }
        };
        fr.readAsText(f);
      });
      if(window.requestAnimationFrame) requestAnimationFrame(function(){ pin.click(); });
      else setTimeout(function(){ pin.click(); }, 0);
    }else if(act === 'export-pics'){
      QZD.userpics.count().then(function(n){
        if(!n){ UI.toast('还没有导入图包'); return; }
        return QZD.userpics.exportPack().then(function(pack){
          var blob = new Blob([JSON.stringify(pack)], { type:'application/json' });
          var url = URL.createObjectURL(blob);
          var a = document.createElement('a');
          a.href = url; a.download = '勤政殿-图包备份-' + new Date().toISOString().slice(0,10) + '.json';
          document.body.appendChild(a); a.click(); a.remove();
          setTimeout(function(){ URL.revokeObjectURL(url); }, 1000);
          UI.toast('图包备份已导出（' + n + ' 张）');
        });
      });
    }else if(act === 'compact-pics'){
      UI.toast('正在压缩本机图包…');
      QZD.userpics.recompress().then(function(r){
        if(!r.ok){ UI.toast(r.error || '压缩失败'); return; }
        return QZD.userpics.applyToGame().then(function(){
          setUserpicsEnabled(true);
          UI.onStateChanged();
          var mb = Math.round((r.savedBytes || 0) / 1048576 * 10) / 10;
          UI.toast(r.changed ? ('已压缩 ' + r.changed + ' 张' + (mb > 0 ? '，约省 ' + mb + ' MB' : ''))
                             : '图包已经足够小');
          updateUpicCount();
        });
      }).catch(function(err){ UI.toast('压缩失败：' + (err && err.message || err)); });
    }else if(act === 'clear-pics'){
      UI.confirm('清空本机图包？所有你自己导入的妃子图会删除，不可恢复（除非有备份）。', function(){
        QZD.userpics.clear().then(function(){
          setUserpicsEnabled(false);
          UI.onStateChanged(); UI.toast('图包已清空'); updateUpicCount();
        });
      }, { okText:'确定清空' });
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
