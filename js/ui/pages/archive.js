/* ============================================================
   ui/pages/archive.js · 史馆档册（数据导出 / 备份）
   一键把各类数据导出为 CSV（或直接下载完整 JSON 存档）
   ============================================================ */
(function(){
  var UI = QZD.ui;

  function countOf(kind){
    switch(kind){
      case 'focus':   return Object.keys((QZD.state.study && QZD.state.study.history) || {}).length;
      case 'checkin': return Object.keys((QZD.state.checkin && QZD.state.checkin.history) || {}).length;
      case 'idea':    return QZD.idea.list().length;
      case 'thesis':  return QZD.thesis.list().length;
      case 'goals':   return QZD.goals.list().length;
      default: return 0;
    }
  }

  var ITEMS = [
    { key: 'focus',   name: '专注记录', desc: '每日专注分钟（study.history）', csv: 'focusCSV' },
    { key: 'checkin', name: '打卡记录', desc: '每日打卡得分明细', csv: 'checkinCSV' },
    { key: 'idea',    name: '灵感罐',   desc: '全部科研灵感', csv: 'ideaCSV' },
    { key: 'thesis',  name: '修书进度', desc: '论文章节进度明细', csv: 'thesisCSV' },
    { key: 'goals',   name: '目标树',   desc: '长期目标树（含层级与有效进度）', csv: 'goalCSV' }
  ];

  function row(it){
    return '<div class="arc-row">' +
      '<div class="arc-info">' +
        '<div class="arc-name">' + it.name + '</div>' +
        '<div class="arc-desc">' + it.desc + '</div>' +
      '</div>' +
      '<div class="arc-meta"><span class="arc-count">' + countOf(it.key) + ' 条</span></div>' +
      '<div class="arc-ops">' +
        '<button class="btn ghost sm" data-export="' + it.key + '">下载 CSV</button>' +
      '</div>' +
    '</div>';
  }

  UI.register('archive', function(){
    var rows = ITEMS.map(row).join('');
    return '' +
      '<section class="card">' +
        '<div class="card-head"><span class="card-title">史 馆 档 册 · 数据导出</span>' +
          '<span class="card-note">CSV 含 BOM，Excel 打开中文不乱码</span></div>' +
        '<div class="arc-list">' + rows + '</div>' +
      '</section>' +
      '<section class="card">' +
        '<div class="card-head"><span class="card-title">完 整 存 档</span>' +
          '<span class="card-note">JSON 全量备份，可在「设置」中导入还原</span></div>' +
        '<div class="arc-row">' +
          '<div class="arc-info">' +
            '<div class="arc-name">整座勤政殿存档</div>' +
            '<div class="arc-desc">含全部模块与游戏进度，定期备份防丢失</div>' +
          '</div>' +
          '<div class="arc-ops"><button class="btn primary" data-export="json">下载 JSON</button></div>' +
        '</div>' +
        '<p class="page-foot">导出仅读取本地存档，不上传任何数据；想换电脑时把 JSON 拷过去再从「设置 → 导入存档」载入即可。</p>' +
      '</section>';
  });

  document.addEventListener('click', function(e){
    var btn = e.target.closest('[data-export]');
    if(!btn) return;
    var key = btn.getAttribute('data-export');
    if(key === 'json'){
      QZD.stateIO.exportFile();
      UI.toast('已导出完整存档 JSON');
      return;
    }
    var it = null;
    ITEMS.forEach(function(x){ if(x.key === key) it = x; });
    if(!it) return;
    var fn = QZD.stateIO.todayStr() + '_勤政殿_' + it.name;
    var csv = QZD.archive[it.csv]();
    QZD.archive.download(fn + '.csv', csv);
    UI.toast('已导出 · ' + it.name);
  });
})();
