/* ============================================================
   ui/pages/goals.js · 千秋大计（长期目标树）
   树形：顶层大计 → 子目标（可多层）；叶节点自身进度，非叶取子节点均值
   ============================================================ */
(function(){
  var UI = QZD.ui;
  var ESC = function(t){ return UI.fmt.escape(t); };

  function bar(pct, cls){
    return '<div class="mini-bar' + (cls ? ' ' + cls : '') + '"><i style="width:' +
      Math.max(0, Math.min(100, pct)) + '%"></i><span>' + Math.max(0, Math.min(100, pct)) + '%</span></div>';
  }

  function nodeCard(n, depth){
    var ch = QZD.goals.children(n.id);
    var eff = QZD.goals.effective(n);
    var inner =
      '<div class="goal-row">' +
        '<div class="goal-info">' +
          '<span class="goal-title">' + ESC(n.title) + '</span>' +
          (n.deadline ? '<span class="goal-deadline">⏳ ' + ESC(n.deadline) + '</span>' : '') +
        '</div>' +
        '<div class="goal-ops">' +
          '<button class="chip sm" data-goal-child="' + n.id + '">＋子目标</button>' +
          '<button class="chip sm" data-goal-edit="' + n.id + '">改名</button>' +
          '<button class="chip sm danger" data-goal-del="' + n.id + '">删</button>' +
        '</div>' +
      '</div>' +
      '<div class="goal-prog">' + bar(eff, 'hot') + '</div>';

    if(!ch.length){
      inner +=
        '<div class="goal-leaf">' +
          '<input type="range" min="0" max="100" step="1" value="' + (n.progress || 0) +
            '" data-goal-range="' + n.id + '" title="拖动设定自身进度（0–100%）">' +
          '<span class="goal-range-val">' + (n.progress || 0) + '%</span>' +
        '</div>';
    }else{
      inner += '<div class="goal-children-note">含 ' + ch.length + ' 个子目标 · 有效进度=子目标均值</div>';
    }

    var kids = '';
    ch.forEach(function(c){ kids += nodeCard(c, depth + 1); });

    return '<div class="goal-node' + (ch.length ? ' has-child' : '') + '">' +
      '<div class="goal-box" style="margin-left:' + (depth * 20) + 'px">' + inner + '</div>' +
      kids +
    '</div>';
  }

  UI.register('goals', function(){
    var roots = QZD.goals.roots();
    var body = roots.length
      ? roots.map(function(r){ return nodeCard(r, 0); }).join('')
      : '<div class="empty">千秋大计尚空，立下你的第一个目标吧<span class="card-note">顶层是读博 / 人生大计，往下拆成可执行的子目标</span></div>';
    return '' +
      '<section class="card">' +
        '<div class="card-head"><span class="card-title">千 秋 大 计 · 长期目标树</span>' +
          '<span class="card-note">层层拆解，进度自动汇总</span></div>' +
        '<div class="thesis-new">' +
          '<input id="goal-title" maxlength="60" placeholder="新建顶层目标，如：博士顺利毕业">' +
          '<button class="btn primary" data-goal-add>立 计</button>' +
        '</div>' +
        '<p class="card-note" style="margin-top:8px">提示：点「＋子目标」可层层下钻；叶节点拖动滑块设进度，父节点自动取均值。</p>' +
      '</section>' +
      '<section class="card">' +
        '<div class="card-head"><span class="card-title">目 标 树</span>' +
          '<span class="card-note">' + QZD.goals.list().length + ' 个节点</span></div>' +
        body +
      '</section>';
  });

  function openChild(parentId){
    UI.modal({
      title: '新增子目标',
      body:
        '<div class="field"><label>子目标名称</label><input id="gc-title" maxlength="60" placeholder="如：发表一篇一作"></div>' +
        '<div class="field"><label>截止（选填）</label><input id="gc-deadline" maxlength="20" placeholder="如：2027-06"></div>',
      ok: true, okText: '添加',
      onOk: function(){
        var title = document.getElementById('gc-title').value;
        if(!title.trim()){ UI.toast('请填写子目标名称'); return false; }
        var r = QZD.goals.add(title, parentId);
        if(!r.ok){ UI.toast(r.error); return false; }
        if(document.getElementById('gc-deadline').value.trim()){
          QZD.goals.setDeadline(r.node.id, document.getElementById('gc-deadline').value);
        }
        UI.onStateChanged();
      }
    });
  }

  function openRename(id){
    var n = QZD.goals.find(id);
    if(!n) return;
    UI.modal({
      title: '改名',
      body: '<div class="field"><label>目标名称</label><input id="gr-title" maxlength="60" value="' + ESC(n.title) + '"></div>',
      ok: true, okText: '保存',
      onOk: function(){
        var r = QZD.goals.updateTitle(id, document.getElementById('gr-title').value);
        if(!r.ok){ UI.toast(r.error); return false; }
        UI.onStateChanged();
      }
    });
  }

  document.addEventListener('click', function(e){
    if(e.target.closest('[data-goal-add]')){
      var r = QZD.goals.add(document.getElementById('goal-title').value);
      if(!r.ok){ UI.toast(r.error); return; }
      UI.onStateChanged();
      return;
    }
    var child = e.target.closest('[data-goal-child]');
    if(child){ openChild(child.getAttribute('data-goal-child')); return; }
    var ren = e.target.closest('[data-goal-edit]');
    if(ren){ openRename(ren.getAttribute('data-goal-edit')); return; }
    var del = e.target.closest('[data-goal-del]');
    if(del){
      UI.confirm('删除该目标及其全部子目标？', function(){
        QZD.goals.remove(del.getAttribute('data-goal-del'));
        UI.onStateChanged();
      });
      return;
    }
  });

  /* 滑块拖动结束 → 更新自身进度（叶节点） */
  document.addEventListener('change', function(e){
    var rng = e.target.closest('[data-goal-range]');
    if(rng){
      var id = rng.getAttribute('data-goal-range');
      QZD.goals.setProgress(id, rng.value);
      UI.onStateChanged();
    }
  });

  document.addEventListener('keydown', function(e){
    if(e.key === 'Enter' && e.target && e.target.id === 'goal-title'){
      e.preventDefault();
      var b = document.querySelector('[data-goal-add]');
      if(b) b.click();
    }
  });
})();
