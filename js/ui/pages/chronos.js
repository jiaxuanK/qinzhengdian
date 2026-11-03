/* ============================================================
   ui/pages/chronos.js · 钦天监（效率分析）
   两个视角：
   - 按时辰：读 study.hourStats，24 小时分布图 + 高峰批语
   - 按课题：读 study.subjectStats，各课题投入分钟与占比 + 课题管理
   ============================================================ */
(function(){
  var UI = QZD.ui;
  var view = 'hour';   /* 'hour' | 'subject' */

  function data(){
    var hs = (QZD.state.study && QZD.state.study.hourStats) || {};
    var arr = [];
    var total = 0, max = 0;
    for(var h = 0; h < 24; h++){
      var v = Math.round(hs[h] || 0);
      arr.push({ h: h, v: v });
      total += v;
      if(v > max) max = v;
    }
    return { arr: arr, total: total, max: max };
  }

  function peakHours(arr){
    var sorted = arr.slice().filter(function(d){ return d.v > 0; })
      .sort(function(a, b){ return b.v - a.v; });
    return sorted.slice(0, 3).map(function(d){ return d.h; });
  }

  function chart(d){
    if(d.total <= 0){
      return '<div class="empty">钦天监尚无星象<span class="card-note">专注几次后，这里会显示你一天里最高效的时辰</span></div>';
    }
    var cols = d.arr.map(function(x){
      var pct = d.max > 0 ? Math.round(x.v / d.max * 100) : 0;
      var cls = '';
      if(x.v > 0 && x.v === d.max) cls = ' peak';
      return '<div class="hour-col">' +
        '<div class="hour-bar-wrap">' +
          '<div class="hour-bar' + cls + '" style="height:' + pct + '%" ' +
            'title="' + x.h + ' 时 · ' + x.v + ' 分"></div>' +
        '</div>' +
        '<span class="hour-label' + (x.h % 6 === 0 ? ' major' : '') + '">' + x.h + '</span>' +
      '</div>';
    }).join('');
    return '<div class="hour-chart">' + cols + '</div>';
  }

  function verdict(d){
    if(d.total <= 0) return '';
    var peaks = peakHours(d.arr);
    if(!peaks.length) return '';
    var names = peaks.map(function(h){
      return h + ' 时' + (h < 12 ? '（上午）' : (h < 18 ? '（下午）' : '（晚间）'));
    });
    var active = d.arr.filter(function(x){ return x.v > 0; }).length;
    var avg = Math.round(d.total / Math.max(1, active));
    var tip = '你最高效的时辰集中在 ' + names.join('、') +
      '。建议把最烧脑的推导 / 写作排在这些时段；其余时辰处理邮件、组会等轻量事务。';
    return '<div class="chronos-verdict">' +
      '<div class="realm-stats">' +
        '<div class="realm-stat hot"><span>累计专注</span><b>' + d.total + ' 分</b></div>' +
        '<div class="realm-stat"><span>活跃时辰</span><b>' + active + ' 个</b></div>' +
        '<div class="realm-stat"><span>高峰时辰</span><b>' + (peaks[0] + ' 时') + '</b></div>' +
        '<div class="realm-stat"><span>活跃时段均量</span><b>' + avg + ' 分</b></div>' +
      '</div>' +
      '<p class="today-line"><b>钦天监批语：</b>' + tip + '</p>' +
    '</div>';
  }

  /* ---------- 按课题 ---------- */
  function subjectPanel(){
    var b = QZD.study.subjectBreakdown();
    if(!b.rows.length){
      return '<div class="empty">尚无课题投入记录' +
        '<span class="card-note">先建课题，再把奏折挂到课题上，专注分钟会自动归类</span></div>';
    }
    var maxMin = b.rows[0].min || 1;
    var rows = b.rows.map(function(r){
      var w = Math.round(r.min / maxMin * 100);
      return '<div class="sub-row">' +
        '<span class="sub-name" title="' + UI.fmt.escape(r.name) + '">' + UI.fmt.escape(r.name) + '</span>' +
        '<div class="sub-bar"><i style="width:' + w + '%"></i></div>' +
        '<span class="sub-val">' + r.min + ' 分 · ' + r.pct + '%</span>' +
      '</div>';
    }).join('');
    return '<div class="sub-list">' + rows + '</div>' +
      '<p class="page-foot" style="margin-top:10px">合计 ' + b.total +
        ' 分钟 · 占比按各课题累计专注计算</p>';
  }

  function managePanel(){
    var list = QZD.study.subjects();
    var chips = list.length
      ? list.map(function(s){
          return '<span class="chip sm">' + UI.fmt.escape(s.name) +
            ' <button class="chip-x" data-subject-del="' + s.id + '" title="解散课题">×</button></span>';
        }).join('')
      : '<span class="card-note">还没有课题，先建一个</span>';
    return '<section class="card">' +
      '<div class="card-head"><span class="card-title">课 题 管 理</span>' +
        '<span class="card-note">如：硅光调制器 / VO₂ 薄膜 / 课程学习</span></div>' +
      '<div class="lib-add2">' +
        '<input id="subject-new" maxlength="20" placeholder="新课题名，回车即建">' +
        '<button class="btn primary" data-subject-add>新 建</button>' +
      '</div>' +
      '<div class="subj-chips">' + chips + '</div>' +
    '</section>';
  }

  function switchBar(){
    return '<div class="chronos-switch">' +
      '<button class="chip' + (view === 'hour' ? ' active' : '') + '" data-chronos-view="hour">按时辰</button>' +
      '<button class="chip' + (view === 'subject' ? ' active' : '') + '" data-chronos-view="subject">按课题</button>' +
    '</div>';
  }

  UI.register('chronos', function(){
    var d = data();

    if(view === 'subject'){
      return '' +
        '<section class="card">' +
          '<div class="card-head"><span class="card-title">钦 天 监 · 科研投入结构</span>' +
            '<span class="card-note">各课题累计专注时长与占比</span></div>' +
          switchBar() + subjectPanel() +
        '</section>' + managePanel();
    }

    return '' +
      '<section class="card">' +
        '<div class="card-head"><span class="card-title">钦 天 监 · 效率时段分析</span>' +
          '<span class="card-note">按专注发生的时辰统计，找准你的一日高峰</span></div>' +
        switchBar() +
        (d.total > 0 ? chart(d) : '<div class="empty">钦天监尚无星象<span class="card-note">专注几次后，这里会显示你一天里最高效的时辰</span></div>') +
      '</section>' +
      (d.total > 0 ? '<section class="card"><div class="card-head"><span class="card-title">批 语</span></div>' + verdict(d) + '</section>' : '') +
      managePanel();
  });

  document.addEventListener('click', function(e){
    var sw = e.target.closest('[data-chronos-view]');
    if(sw){
      view = sw.getAttribute('data-chronos-view');
      UI.show('chronos');
      return;
    }

    if(e.target.closest('[data-subject-add]')){
      var el = document.getElementById('subject-new');
      var r = QZD.study.addSubject(el ? el.value : '');
      if(!r.ok){ UI.toast(r.error); return; }
      UI.toast('已建课题 · ' + r.subject.name);
      UI.onStateChanged();
      return;
    }

    var del = e.target.closest('[data-subject-del]');
    if(del){
      var id = del.getAttribute('data-subject-del');
      UI.confirm('解散课题只会解除归属：已累计的分钟记为「已解散课题」，相关奏折退回未分类。确定？', function(){
        QZD.study.removeSubject(id);
        UI.onStateChanged();
        UI.toast('课题已解散');
      }, { okText: '确定解散' });
    }
  });

  document.addEventListener('keydown', function(e){
    if(e.key === 'Enter' && e.target && e.target.id === 'subject-new'){
      e.preventDefault();
      var b = document.querySelector('[data-subject-add]');
      if(b) b.click();
    }
  });
})();
