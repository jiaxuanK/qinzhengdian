/* ============================================================
   ui/pages/thesis.js · 修书进度（论文 / 综述 / 报告写作）
   每本书含若干章节，章节有「当前量 / 目标量」；整体进度 = Σ当前 / Σ目标
   ============================================================ */
(function(){
  var UI = QZD.ui;
  var ESC = function(t){ return UI.fmt.escape(t); };

  function bar(pct, cls){
    return '<div class="mini-bar' + (cls ? ' ' + cls : '') + '"><i style="width:' +
      Math.max(0, Math.min(100, pct)) + '%"></i><span>' + Math.max(0, Math.min(100, pct)) + '%</span></div>';
  }

  function thesisCard(t){
    var overall = QZD.thesis.progress(t);
    var secs = (t.sections || []).map(function(s){
      return '<div class="sec-row">' +
        '<span class="sec-name">' + ESC(s.name) + '</span>' +
        '<div class="sec-edit">' +
          '<input type="number" min="0" max="' + (s.target || 0) + '" step="1" ' +
            'value="' + (s.current || 0) + '" data-sec-current="' + t.id + '|' + s.id + '" ' +
            'title="当前完成量（≤ 目标 ' + (s.target || 0) + '）">' +
          '<span class="sec-of">/ ' + (s.target || 0) + '</span>' +
          '<button class="chip sm" data-sec-up="' + t.id + '|' + s.id + '">更</button>' +
          '<button class="chip sm danger" data-sec-del="' + t.id + '|' + s.id + '">删</button>' +
        '</div>' +
      '</div>';
    }).join('');

    return '<div class="thesis-card" data-id="' + t.id + '">' +
      '<div class="thesis-head">' +
        '<div class="thesis-title">' + ESC(t.title) + '</div>' +
        '<div class="thesis-ops">' +
          '<button class="chip sm danger" data-thesis-del="' + t.id + '">删书</button>' +
        '</div>' +
      '</div>' +
      '<div class="thesis-overall">' + bar(overall, 'hot') + '</div>' +
      (secs ? '<div class="thesis-sections">' + secs + '</div>'
            : '<div class="card-note" style="margin:6px 0">尚无章节，先在下方添加</div>') +
      '<div class="sec-add">' +
        '<input class="sec-name-in" maxlength="40" placeholder="新章节名" data-sec-name="' + t.id + '">' +
        '<input class="sec-target-in" type="number" min="1" step="1" placeholder="目标量" data-sec-target="' + t.id + '">' +
        '<button class="btn ghost sm" data-sec-add="' + t.id + '">加章节</button>' +
      '</div>' +
    '</div>';
  }

  UI.register('thesis', function(){
    var list = QZD.thesis.list();
    var body = list.length
      ? list.map(thesisCard).join('')
      : '<div class="empty">还没有在修的书<span class="card-note">论文 / 综述 / 报告都算「书」</span></div>';
    return '' +
      '<section class="card">' +
        '<div class="card-head"><span class="card-title">修 书 进 度 · 论文写作追踪</span>' +
          '<span class="card-note">章节「当前量 / 目标量」相加即整体进度</span></div>' +
        '<div class="thesis-new">' +
          '<input id="thesis-title" maxlength="80" placeholder="书名 / 题目（必填），如：博士开题报告">' +
          '<button class="btn primary" data-thesis-add>立 书</button>' +
        '</div>' +
      '</section>' +
      '<section class="card">' +
        '<div class="card-head"><span class="card-title">在 修 之 书</span>' +
          '<span class="card-note">' + list.length + ' 部</span></div>' +
        body +
      '</section>';
  });

  document.addEventListener('click', function(e){
    if(e.target.closest('[data-thesis-add]')){
      var r = QZD.thesis.add(document.getElementById('thesis-title').value);
      if(!r.ok){ UI.toast(r.error); return; }
      UI.onStateChanged();
      return;
    }
    var delT = e.target.closest('[data-thesis-del]');
    if(delT){
      UI.confirm('确定焚毁该书及其全部章节？', function(){
        QZD.thesis.remove(delT.getAttribute('data-thesis-del'));
        UI.onStateChanged();
      });
      return;
    }
    var addS = e.target.closest('[data-sec-add]');
    if(addS){
      var tid = addS.getAttribute('data-sec-add');
      var nameEl = document.querySelector('[data-sec-name="' + tid + '"]');
      var tgtEl = document.querySelector('[data-sec-target="' + tid + '"]');
      var r2 = QZD.thesis.addSection(tid, nameEl ? nameEl.value : '', tgtEl ? tgtEl.value : '');
      if(!r2.ok){ UI.toast(r2.error); return; }
      UI.onStateChanged();
      return;
    }
    var upS = e.target.closest('[data-sec-up]');
    if(upS){
      var parts = upS.getAttribute('data-sec-up').split('|');
      var inp = document.querySelector('[data-sec-current="' + upS.getAttribute('data-sec-up') + '"]');
      var r3 = QZD.thesis.setSection(parts[0], parts[1], inp ? inp.value : '');
      if(!r3.ok){ UI.toast(r3.error); return; }
      UI.toast('进度已更新');
      UI.onStateChanged();
      return;
    }
    var delS = e.target.closest('[data-sec-del]');
    if(delS){
      var p = delS.getAttribute('data-sec-del').split('|');
      QZD.thesis.removeSection(p[0], p[1]);
      UI.onStateChanged();
      return;
    }
  });

  document.addEventListener('keydown', function(e){
    if(e.key === 'Enter' && e.target && e.target.id === 'thesis-title'){
      e.preventDefault();
      var b = document.querySelector('[data-thesis-add]');
      if(b) b.click();
    }
  });
})();
