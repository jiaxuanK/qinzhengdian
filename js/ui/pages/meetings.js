/* ============================================================
   ui/pages/meetings.js · 议事厅（组会纪要与待办）
   ============================================================ */
(function(){
  var UI = QZD.ui;
  var ESC = function(t){ return UI.fmt.escape(t); };

  function todoRow(mid, t){
    var act = t.memorialId
      ? '<span class="badge sm">已立奏折</span>'
      : '<button class="chip sm" data-meet-tomemorial="' + mid + '|' + t.id + '">立奏折</button>';
    return '<div class="meet-todo-row">' +
      '<label class="meet-todo' + (t.done ? ' done' : '') + '">' +
        '<input type="checkbox" data-meet-todo="' + mid + '" data-tid="' + t.id + '"' + (t.done ? ' checked' : '') + '>' +
        '<span>' + ESC(t.text) + '</span>' +
      '</label>' + act +
    '</div>';
  }

  function meetCard(m){
    var todos = m.todos || [];
    var open = todos.filter(function(t){ return !t.done; }).length;
    /* 关联灵感（hatchedType='meeting', ref=m.id）*/
    var myIdeas = QZD.idea.list().filter(function(i){ return i.hatchedType === 'meeting' && i.hatchedRef === m.id; });
    var ideaChips = myIdeas.map(function(i){
      var display = i.tag || (i.text || '').slice(0, 10);
      return '<span class="chip sm idea-chip" style="margin:2px" data-idea-edit="' + ESC(i.id) + '" data-meet-idea-unlink="' + ESC(i.id) + '" title="点击查看灵感内容 · 点×取消关联">' +
        '🧠 ' + ESC(display) + '<b style="color:#A8573F;margin-left:4px;cursor:pointer;opacity:.5">×</b></span>';
    }).join('');
    var ideasBlock = '<div class="meet-ideas" style="margin:4px 0;display:flex;flex-wrap:wrap;align-items:center;gap:2px">' +
      '<span style="font-size:11px;color:#8a7130;margin-right:2px">🧠</span>' +
      (ideaChips || '<span style="font-size:11px;color:#9a9790">（未关联）</span>') +
      '<button class="chip sm" style="margin-left:4px;font-size:11px;padding:1px 6px" data-meet-idea-add="' + ESC(m.id) + '">＋灵感</button>' +
    '</div>';
    return '<div class="meet-card">' +
      '<div class="meet-head">' +
        '<div class="meet-title"><b>' + ESC(m.title) + '</b>' +
          '<span class="meet-date">' + ESC(m.date) + '</span>' +
          (open ? '<span class="badge">待办 ' + open + '</span>' : '') +
        '</div>' +
        '<button class="chip sm danger" data-meet-del="' + m.id + '">删除</button>' +
      '</div>' +
      (m.notes ? '<p class="meet-notes">' + ESC(m.notes) + '</p>' : '') +
      ideasBlock +
      (todos.length ? '<div class="meet-todos">' + todos.map(function(t){ return todoRow(m.id, t); }).join('') + '</div>' : '') +
      '<div class="meet-addtodo">' +
        '<input data-meet-todoinput="' + m.id + '" maxlength="120" placeholder="加一条待办，回车提交">' +
        '<button class="chip sm" data-meet-addtodo="' + m.id + '">＋ 待办</button>' +
      '</div>' +
    '</div>';
  }

  UI.register('meetings', function(){
    var list = QZD.meetings.list();
    var pending = QZD.meetings.pendingTodos();
    var week = QZD.meetings.recent(7);

    var pendingHtml = pending.length
      ? pending.map(function(t){
          return '<div class="meet-pend">' +
            '<span class="meet-pend-text">' + ESC(t.text) + '</span>' +
            '<span class="card-note">' + ESC(t.date) + ' · ' + ESC(t.meetingTitle) + '</span>' +
          '</div>';
        }).join('')
      : '<div class="empty">暂无未完成待办<span class="card-note">组会后把要做的事记进来，下次组会前就能看到</span></div>';

    var listHtml = list.length
      ? list.map(meetCard).join('')
      : '<div class="empty">还没有组会记录<span class="card-note">点上面「记录组会」，粘贴纪要并列出待办</span></div>';

    return '' +
      '<section class="card">' +
        '<div class="card-head"><span class="card-title">议 事 厅</span>' +
          '<span class="card-note">组会纪要与待办</span></div>' +
        '<div class="realm-stats">' +
          '<div class="realm-stat"><span>组会记录</span><b>' + list.length + '</b></div>' +
          '<div class="realm-stat' + (pending.length ? ' hot' : '') + '"><span>未完成待办</span><b>' + pending.length + '</b></div>' +
          '<div class="realm-stat"><span>近 7 天</span><b>' + week.length + '</b></div>' +
        '</div>' +
        '<div class="btn-row" style="margin-top:10px">' +
          '<button class="btn primary" data-meet-add>记录组会</button>' +
        '</div>' +
      '</section>' +
      '<section class="card">' +
        '<div class="card-head"><span class="card-title">待 办 总 览</span>' +
          '<span class="card-note">全部未完成</span></div>' +
        pendingHtml +
      '</section>' +
      '<section class="card">' +
        '<div class="card-head"><span class="card-title">历 次 组 会</span>' +
          '<span class="card-note">共 ' + list.length + ' 次</span></div>' +
        listHtml +
      '</section>';
  });

  function todayStr(){
    var d = new Date();
    function p(n){ return n < 10 ? '0' + n : '' + n; }
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
  }

  function openAdd(){
    UI.modal({
      title: '记录组会',
      body:
        '<div class="field"><label>日期</label><input id="meet-date" type="date" value="' + todayStr() + '"></div>' +
        '<div class="field"><label>标题</label><input id="meet-title" maxlength="60" placeholder="如：组会 · 硅光调制器进度"></div>' +
        '<div class="field"><label>纪要</label><textarea id="meet-notes" rows="4" maxlength="2000" placeholder="老师说了什么、结论、下一步"></textarea></div>' +
        '<div class="field"><label>待办（一行一条）</label><textarea id="meet-todos" rows="3" maxlength="1200" placeholder="补 50Ω 电极仿真&#10;看完 3 篇 VO2 文献"></textarea></div>',
      ok: true,
      okText: '保存',
      onOk: function(){
        var r = QZD.meetings.add({
          date: (document.getElementById('meet-date') || {}).value,
          title: (document.getElementById('meet-title') || {}).value,
          notes: (document.getElementById('meet-notes') || {}).value,
          todos: (document.getElementById('meet-todos') || {}).value
        });
        if(!r.ok){ UI.toast(r.error); return false; }
        UI.toast('已记录组会');
        UI.onStateChanged();
      }
    });
  }

  document.addEventListener('click', function(e){
    if(e.target.closest('[data-meet-add]')){ openAdd(); return; }

    var del = e.target.closest('[data-meet-del]');
    if(del){
      var id = del.getAttribute('data-meet-del');
      UI.confirm('删除这条组会记录？待办也会一并删除。', function(){
        QZD.meetings.remove(id);
        UI.onStateChanged();
      });
      return;
    }

    var toMem = e.target.closest('[data-meet-tomemorial]');
    if(toMem){
      var parts = String(toMem.getAttribute('data-meet-tomemorial')).split('|');
      var mr = QZD.meetings.todoToMemorial(parts[0], parts[1]);
      if(!mr.ok){ UI.toast(mr.error); return; }
      UI.toast('已立为奏折：' + mr.memorial.title);
      UI.onStateChanged();
      return;
    }

    var addTodo = e.target.closest('[data-meet-addtodo]');
    if(addTodo){
      var mid = addTodo.getAttribute('data-meet-addtodo');
      var input = document.querySelector('[data-meet-todoinput="' + mid + '"]');
      var r = QZD.meetings.addTodo(mid, input ? input.value : '');
      if(!r.ok){ UI.toast(r.error); return; }
      UI.onStateChanged();
      return;
    }

    /* ＋灵感 —— modal 关联已有或快捷新建 */
    var ideaAdd = e.target.closest('[data-meet-idea-add]');
    if(ideaAdd){
      var mid = ideaAdd.getAttribute('data-meet-idea-add');
      var availIdeas = QZD.idea.list().filter(function(i){ return !i.hatchedType || !i.hatchedRef; });
      var modalBody =
        (availIdeas.length
          ? '<div class="field"><label>选择已有灵感</label>' +
            '<select id="mi-add-select" style="max-width:280px">' +
              '<option value="">—— 选一条关联 ——</option>' +
              availIdeas.map(function(i){ return '<option value="' + ESC(i.id) + '">[' + ESC(i.tag||'') + '] ' + ESC(i.text.slice(0,26)) + '</option>'; }).join('') +
            '</select></div>'
          : '<div style="font-size:11px;color:#8a8574;margin:6px 0">当前没有待孵化的灵感，直接新建吧</div>') +
        '<div style="margin-top:10px;display:flex;gap:4px">' +
          '<input id="mi-quick" placeholder="新建灵感并关联…" style="flex:1;padding:4px 8px;border:1px solid var(--line);border-radius:4px;font-size:12px">' +
          '<input id="mi-quick-tag" placeholder="标签" maxlength="10" style="width:70px;padding:4px 6px;border:1px solid var(--line);border-radius:4px;font-size:12px">' +
          '<button class="btn primary" style="padding:4px 10px;font-size:12px" data-mi-quick-add="' + ESC(mid) + '">＋</button>' +
        '</div>';
      UI.modal({ title: '关联灵感 · 议事', body: modalBody });
      setTimeout(function(){
        var sel = document.getElementById('mi-add-select');
        if(sel){
          sel.addEventListener('change', function(){
            if(sel.value){ QZD.idea.link(sel.value, 'meeting', mid); UI.onStateChanged(); }
          });
        }
      }, 20);
      return;
    }

    /* chip × —— 取消关联（只有点 × 才拦截 return；点 chip 本身 fall through 给 data-idea-edit）*/
    var ideaUnlink = e.target.closest('[data-meet-idea-unlink]');
    if(ideaUnlink){
      if(e.target.tagName === 'B' || e.target.matches('b')){
        QZD.idea.unlink(ideaUnlink.getAttribute('data-meet-idea-unlink'));
        UI.onStateChanged();
        return;
      }
    }

    /* modal 里快捷新建灵感 */
    var quickAdd = e.target.closest('[data-mi-quick-add]');
    if(quickAdd){
      var qmid = quickAdd.getAttribute('data-mi-quick-add');
      var qtext = (document.getElementById('mi-quick').value || '').trim();
      var qtag = (document.getElementById('mi-quick-tag').value || '').trim();
      if(!qtext){ UI.toast('写点什么'); return; }
      var r = QZD.idea.add(qtext, qtag);
      if(r.ok){ QZD.idea.link(r.id, 'meeting', qmid); }
      UI.onStateChanged();
      return;
    }
  });

  /* 勾选待办 */
  document.addEventListener('change', function(e){
    var cb = e.target.closest('[data-meet-todo]');
    if(!cb) return;
    QZD.meetings.toggleTodo(cb.getAttribute('data-meet-todo'), cb.getAttribute('data-tid'));
    UI.onStateChanged();
  });

  /* 待办输入框回车提交 */
  document.addEventListener('keydown', function(e){
    if(e.key !== 'Enter') return;
    var inp = e.target.closest ? e.target.closest('[data-meet-todoinput]') : null;
    if(!inp) return;
    e.preventDefault();
    var mid = inp.getAttribute('data-meet-todoinput');
    var r = QZD.meetings.addTodo(mid, inp.value);
    if(!r.ok){ UI.toast(r.error); return; }
    UI.onStateChanged();
  });
})();
