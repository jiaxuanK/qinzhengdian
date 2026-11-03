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
    return '<div class="meet-card">' +
      '<div class="meet-head">' +
        '<div class="meet-title"><b>' + ESC(m.title) + '</b>' +
          '<span class="meet-date">' + ESC(m.date) + '</span>' +
          (open ? '<span class="badge">待办 ' + open + '</span>' : '') +
        '</div>' +
        '<button class="chip sm danger" data-meet-del="' + m.id + '">删除</button>' +
      '</div>' +
      (m.notes ? '<p class="meet-notes">' + ESC(m.notes) + '</p>' : '') +
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
