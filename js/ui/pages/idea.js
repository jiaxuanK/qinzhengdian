/* ============================================================
   ui/pages/idea.js · 朱批灵感罐（B 档升级）
   - 未孵化 / 已孵化 分 tab
   - 标签筛选 + 搜索框
   - 孵化弹层（选课题/议题/论文/独立）
   - 孵化后卡片朱批效果
   ============================================================ */
(function(){
  var UI = QZD.ui;
  var ESC = function(t){ return UI.fmt.escape(t); };

  function statBar(){
    var s = QZD.idea.stats();
    return '<div class="realm-stats">' +
      '<div class="realm-stat"><span>灵感总数</span><b>' + s.total + '</b></div>' +
      '<div class="realm-stat hot"><span>已孵化</span><b>' + s.hatched + '</b></div>' +
      '<div class="realm-stat"><span>孵化率</span><b>' + s.hatchRate + '%</b></div>' +
      '<div class="realm-stat"><span>本周新增</span><b>' + s.weekNew + '</b></div>' +
    '</div>';
  }

  function tagChips(activeTag){
    var tags = QZD.idea.tags();
    var chips = '<button class="chip sm' + (!activeTag ? ' ok' : '') + '" data-idea-tag="">全部</button>';
    tags.forEach(function(t){
      chips += '<button class="chip sm' + (activeTag === t ? ' ok' : '') + '" data-idea-tag="' + ESC(t) + '">' + ESC(t) + '</button>';
    });
    return '<div class="idea-tags">' + chips + '</div>';
  }

  function fmtTime(ts){
    var t = new Date(ts);
    return (t.getMonth() + 1) + '.' + t.getDate() + ' ' +
      ('0' + t.getHours()).slice(-2) + ':' + ('0' + t.getMinutes()).slice(-2);
  }

  function hatchLabel(type, ref){
    var typeNames = {
      subject: '课题', meeting: '议事厅', thesis: '文渊阁',
      goal: '千秋大计', memorial: '奏折', checkin: '常课', reading: '阅读',
      custom: '自定义', other: '独立落地'
    };
    var name = typeNames[type] || type || '已孵化';
    if(ref){
      /* 解析 ref 成可读名称：按 type 分别处理 */
      var targetName = '';
      try {
        if(type === 'goal'){
          var g = QZD.goals.find(ref);
          if(g) targetName = g.title;
        } else if(type === 'thesis'){
          /* ref 可能是 'tid'（书级）或 'tid|sid'（章节级）*/
          var parts = String(ref).split('|');
          var t = QZD.thesis.find ? QZD.thesis.find(parts[0]) : null;
          if(parts.length > 1){
            var sec = t && QZD.thesis.findSection ? QZD.thesis.findSection(parts[0], parts[1]) : null;
            if(sec) targetName = (t ? t.title + ' · ' : '') + sec.name;
          } else if(t){
            targetName = t.title;
          }
        } else if(type === 'memorial'){
          var m = QZD.memorials.find ? QZD.memorials.find(ref) : null;
          if(m) targetName = m.title;
        } else if(type === 'meeting'){
          var mt = QZD.meetings.find ? QZD.meetings.find(ref) : null;
          if(mt) targetName = mt.title;
        }
      } catch(e){ /* 解析失败则用 ref 原文 */ }
      name += targetName ? ' · ' + targetName : ' · ' + ref;
    }
    return name;
  }

  function ideaCard(it){
    var hatched = it.hatched;
    var time = fmtTime(it.createdAt);
    var hatchBadge = '';
    if(hatched){
      var hAt = it.hatchedAt ? (' · ' + fmtTime(it.hatchedAt)) : '';
      hatchBadge = '<span class="idea-hatched">' + ESC(hatchLabel(it.hatchedType, it.hatchedRef)) + hAt + '</span>';
    }
    return '<div class="idea-card' + (hatched ? ' hatched' : '') + '" data-idea-card="' + it.id + '">' +
      '<div class="idea-main">' +
        (it.tag ? '<span class="idea-tag">' + ESC(it.tag) + '</span>' : '') +
        '<span class="idea-text">' + ESC(it.text) + '</span>' +
        hatchBadge +
        '<span class="idea-time">' + time + '</span>' +
      '</div>' +
      '<div class="idea-ops">' +
        '<button class="chip sm" data-idea-edit="' + it.id + '">改</button>' +
        (hatched
          ? '<button class="chip sm" data-idea-unhatch="' + it.id + '">取消孵化</button>'
          : '<button class="chip sm ok" data-idea-hatch="' + it.id + '">孵化</button>') +
        '<button class="chip sm danger" data-idea-del="' + it.id + '">删</button>' +
      '</div>' +
    '</div>';
  }

  /* 编辑弹层 */
  function openEditDialog(id){
    var it = QZD.idea.list().filter(function(x){ return x.id === id; })[0];
    if(!it) return;
    document.querySelectorAll('.modal-mask, .modal-backdrop').forEach(function(m){ if(m.parentNode) m.parentNode.removeChild(m); });
    UI.modal({
      title: '朱批修改',
      body:
        '<div class="field"><label>标签</label><input id="ie-tag" value="' + ESC(it.tag || '') + '" maxlength="16"></div>' +
        '<div class="field"><label>内容</label><textarea id="ie-text" rows="4" maxlength="300" style="width:100%;padding:8px;border:1px solid var(--line);border-radius:4px;font-size:12px;font-family:inherit">' + ESC(it.text || '') + '</textarea></div>' +
        (it.hatched ? '<p style="font-size:11px;color:#8a8574;margin-top:6px">当前状态：已孵化（' + ESC(hatchLabel(it.hatchedType, it.hatchedRef)) + '）</p>' : ''),
      ok: true, okText: '保存',
      onOk: function(){
        var tag = document.getElementById('ie-tag').value.trim();
        var text = document.getElementById('ie-text').value.trim();
        if(!text){ UI.toast('内容不能空'); return false; }
        QZD.idea.edit(id, { tag: tag, text: text });
        UI.onStateChanged();
      }
    });
  }

  /* 孵化弹层 */
  function openHatchDialog(id){
    var it = QZD.idea.list().filter(function(x){ return x.id === id; })[0];
    if(!it) return;
    var subjects = QZD.study ? QZD.study.subjects() : [];
    var meetings = QZD.meetings ? QZD.meetings.list() : [];
    var thesisList = QZD.thesis ? QZD.thesis.list() : [];
    var opts = '';
    if(subjects.length){
      opts += '<optgroup label="课题">';
      subjects.forEach(function(s){ opts += '<option value="subject|' + ESC(s.id) + '">' + ESC(s.name) + '</option>'; });
      opts += '</optgroup>';
    }
    if(meetings.length){
      opts += '<optgroup label="议事厅议题">';
      meetings.forEach(function(m){ opts += '<option value="meeting|' + ESC(m.id) + '">' + ESC(m.title) + '</option>'; });
      opts += '</optgroup>';
    }
    if(thesisList.length){
      opts += '<optgroup label="论文">';
      thesisList.forEach(function(th){ opts += '<option value="thesis|' + ESC(th.id) + '">' + ESC(th.title || th.id) + '</option>'; });
      opts += '</optgroup>';
    }
    opts += '<option value="other|">独立想法（写进灵感罐不关联）</option>';

    var html = '<div class="modal-backdrop" data-idea-hatch-cancel>' +
      '<div class="modal idea-hatch">' +
        '<h3>孵化这条灵感</h3>' +
        '<p class="idea-hatch-text">「' + ESC(it.text.slice(0, 80)) + (it.text.length > 80 ? '…' : '') + '」</p>' +
        '<p class="card-note">它落地成了什么？</p>' +
        '<select id="idea-hatch-ref" style="width:100%;padding:6px 10px;margin:8px 0">' + opts + '</select>' +
        '<div style="display:flex;gap:8px;justify-content:flex-end;margin-top:10px">' +
          '<button class="btn ghost" data-idea-hatch-cancel>取消</button>' +
          '<button class="btn primary" data-idea-hatch-ok="' + id + '">确 认 孵 化</button>' +
        '</div>' +
      '</div>' +
    '</div>';
    var overlay = document.createElement('div');
    overlay.innerHTML = html;
    document.body.appendChild(overlay);
  }

  /* 状态（tab + 搜索 + 标签） */
  var _tab = 'pending';   /* 'pending' | 'hatched' */
  var _tag = '';
  var _q = '';

  function renderList(){
    var tabFilter = { hatched: _tab === 'hatched' };
    if(_tag) tabFilter.tag = _tag;
    if(_q) tabFilter.q = _q;
    var list = QZD.idea.filter(tabFilter);
    var body = list.length
      ? list.map(ideaCard).join('')
      : '<div class="empty">这里空空如也<span class="card-note">' +
          (_tab === 'hatched' ? '记下的灵感都还没孵化，点卡片上的「孵化」按钮' : '落笔第一条灵感吧') +
        '</span></div>';
    return '' +
      '<section class="card">' +
        '<div class="card-head"><span class="card-title">朱 批 灵 感 罐 · 科研灵感随手记</span>' +
          '<span class="card-note">一行一念，可标记已落地</span></div>' +
        statBar() +
      '</section>' +
      '<section class="card">' +
        '<div class="card-head"><span class="card-title">落 笔</span></div>' +
        '<div class="idea-add">' +
          '<textarea id="idea-text" maxlength="300" rows="2" placeholder="此刻的灵感 / 猜想 / 待办点子…（Ctrl+Enter 秒存）"></textarea>' +
          '<div class="idea-add2">' +
            '<input id="idea-tag" maxlength="16" placeholder="标签（选填），如：实验/写作/课题">' +
            '<button class="btn primary" data-idea-add>朱 批</button>' +
          '</div>' +
        '</div>' +
      '</section>' +
      '<section class="card">' +
        '<div class="card-head">' +
          '<span class="card-title">灵 感 罐</span>' +
          '<div style="display:flex;gap:6px;margin-left:auto">' +
            '<input id="idea-search" placeholder="🔍 搜索…" value="' + ESC(_q) + '" style="padding:3px 8px;font-size:12px;border:1px solid #d8d2c4;border-radius:3px;background:#faf7f0">' +
          '</div>' +
        '</div>' +
        '<div class="idea-tabs">' +
          '<button class="chip sm' + (_tab === 'pending' ? ' ok' : '') + '" data-idea-tab="pending">待孵化 (' + QZD.idea.filter({hatched:false}).length + ')</button>' +
          '<button class="chip sm' + (_tab === 'hatched' ? ' ok' : '') + '" data-idea-tab="hatched">已孵化 (' + QZD.idea.filter({hatched:true}).length + ')</button>' +
        '</div>' +
        tagChips(_tag) +
        body +
      '</section>';
  }

  UI.register('idea', renderList);

  /* ---- 事件 ---- */
  document.addEventListener('click', function(e){
    var add = e.target.closest('[data-idea-add]');
    if(add){
      var r = QZD.idea.add(
        document.getElementById('idea-text').value,
        document.getElementById('idea-tag').value
      );
      if(!r.ok){ UI.toast(r.error); return; }
      document.getElementById('idea-text').value = '';
      UI.onStateChanged();
      return;
    }
    var del = e.target.closest('[data-idea-del]');
    if(del){
      QZD.idea.remove(del.getAttribute('data-idea-del'));
      UI.onStateChanged();
      return;
    }
    var edit = e.target.closest('[data-idea-edit]');
    if(edit){ openEditDialog(edit.getAttribute('data-idea-edit')); return; }
    var card = e.target.closest('[data-idea-card]');
    if(card){
      /* 点卡片本身（不是按钮）→ 开编辑弹层查看/修改 */
      if(!e.target.closest('button') && !e.target.closest('a')){
        openEditDialog(card.getAttribute('data-idea-card'));
      }
      return;
    }
    var h = e.target.closest('[data-idea-hatch]');
    if(h){ openHatchDialog(h.getAttribute('data-idea-hatch')); return; }
    var uh = e.target.closest('[data-idea-unhatch]');
    if(uh){ QZD.idea.unhatch(uh.getAttribute('data-idea-unhatch')); UI.onStateChanged(); return; }
    var tab = e.target.closest('[data-idea-tab]');
    if(tab){ _tab = tab.getAttribute('data-idea-tab'); UI.onStateChanged(); return; }
    var tg = e.target.closest('[data-idea-tag]');
    if(tg){ _tag = tg.getAttribute('data-idea-tag'); UI.onStateChanged(); return; }

    /* 孵化弹层内部 */
    var hk = e.target.closest('[data-idea-hatch-ok]');
    if(hk){
      var id = hk.getAttribute('data-idea-hatch-ok');
      var sel = document.getElementById('idea-hatch-ref');
      if(sel){
        var v = sel.value;
        var parts = v.split('|');
        var refName = sel.options[sel.selectedIndex] ? sel.options[sel.selectedIndex].textContent : '';
        QZD.idea.hatch(id, parts[0], parts[1] || refName);
      } else {
        QZD.idea.hatch(id, 'other', null);
      }
      var bd = document.querySelector('.modal-backdrop[data-idea-hatch-cancel]');
      if(bd) bd.remove();
      UI.onStateChanged();
      return;
    }
    var ca = e.target.closest('[data-idea-hatch-cancel]');
    if(ca){ var bd2 = document.querySelector('.modal-backdrop'); if(bd2) bd2.remove(); return; }
  });

  document.addEventListener('input', function(e){
    if(e.target.id === 'idea-search'){
      _q = e.target.value.trim();
      UI.onStateChanged();
    }
  });

  /* Ctrl/⌘+Enter 秒存 */
  document.addEventListener('keydown', function(e){
    if((e.ctrlKey || e.metaKey) && e.key === 'Enter' &&
       e.target && e.target.id === 'idea-text'){
      e.preventDefault();
      var b = document.querySelector('[data-idea-add]');
      if(b) b.click();
    }
    if(e.key === 'Escape'){
      var bd = document.querySelector('.modal-backdrop');
      if(bd){ bd.remove(); e.preventDefault(); }
    }
  });
})();
