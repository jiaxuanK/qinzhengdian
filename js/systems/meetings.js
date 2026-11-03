/* ============================================================
   systems/meetings.js · 组会纪要与待办
   - 每条记录：日期 / 标题 / 纪要 / 待办清单
   - 待办可勾完成；周报会带上「本周组会待办」
   ============================================================ */
(function(){
  var IO = QZD.stateIO;

  function st(){ return QZD.state; }
  function list(){
    if(!Array.isArray(st().meetings)) st().meetings = [];
    return st().meetings;
  }
  function uid(){
    return 'mt' + Date.now().toString(36) + Math.floor(Math.random() * 1000).toString(36);
  }
  function find(id){
    var l = list();
    for(var i = 0; i < l.length; i++) if(l[i].id === id) return l[i];
    return null;
  }
  function normTodos(raw){
    var out = [];
    if(Array.isArray(raw)){
      raw.forEach(function(t){
        var s = String(t && t.text !== undefined ? t.text : t || '').trim();
        if(s) out.push({ id: uid() + '-' + out.length, text: s.slice(0, 120), done: !!(t && t.done) });
      });
      return out;
    }
    String(raw || '').split(/\r?\n/).forEach(function(t){
      var s = String(t || '').trim();
      if(s) out.push({ id: uid() + '-' + out.length, text: s.slice(0, 120), done: false });
    });
    return out;
  }

  function add(o){
    o = o || {};
    var date = String(o.date || '').trim() || IO.todayStr();
    if(!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { ok: false, error: '日期格式应为 YYYY-MM-DD' };
    var title = String(o.title || '').trim().slice(0, 60) || '组会';
    var notes = String(o.notes || '').trim().slice(0, 2000);
    var todos = normTodos(o.todos);
    if(!notes && !todos.length) return { ok: false, error: '纪要或待办至少填一项' };
    var m = { id: uid(), date: date, title: title, notes: notes, todos: todos, createdAt: Date.now() };
    list().unshift(m);
    IO.pushLog('meeting', '组会记录 · ' + title);
    IO.save();
    return { ok: true, meeting: m };
  }

  function remove(id){
    var l = list(), m = find(id);
    if(!m) return { ok: false, error: '记录不存在' };
    l.splice(l.indexOf(m), 1);
    IO.save();
    return { ok: true };
  }

  function addTodo(id, text){
    var m = find(id);
    if(!m) return { ok: false, error: '记录不存在' };
    var s = String(text || '').trim();
    if(!s) return { ok: false, error: '请填写待办' };
    if(!Array.isArray(m.todos)) m.todos = [];
    m.todos.push({ id: uid() + '-' + m.todos.length, text: s.slice(0, 120), done: false });
    IO.save();
    return { ok: true, meeting: m };
  }

  function toggleTodo(id, tid){
    var m = find(id);
    if(!m) return { ok: false, error: '记录不存在' };
    var todos = m.todos || [];
    for(var i = 0; i < todos.length; i++){
      if(todos[i].id !== tid) continue;
      todos[i].done = !todos[i].done;
      IO.save();
      return { ok: true, todo: todos[i] };
    }
    return { ok: false, error: '待办不存在' };
  }

  /* 把某条待办立为奏折（到今日勤政去推进），同一待办只立一次 */
  function todoToMemorial(id, tid){
    var m = find(id);
    if(!m) return { ok: false, error: '记录不存在' };
    var todos = m.todos || [], t = null;
    for(var i = 0; i < todos.length; i++) if(todos[i].id === tid) t = todos[i];
    if(!t) return { ok: false, error: '待办不存在' };
    if(t.memorialId) return { ok: false, error: '该待办已立过奏折' };
    if(!QZD.memorials) return { ok: false, error: '奏折模块未加载' };
    var MC = QZD.config.MEMORIAL || {};
    var tags = MC.TAGS || [{ key: 'wenjiao' }];
    var pris = MC.PRIORITIES || [{ key: 'changzou' }];
    var r = QZD.memorials.create({
      title: t.text,
      tag: tags[0].key,
      priority: pris[0].key,
      note: '来自 ' + m.date + ' 组会：' + m.title
    });
    if(!r.ok) return r;
    t.memorialId = r.memorial.id;
    IO.save();
    return { ok: true, memorial: r.memorial };
  }

  /* 全部未完成待办（新会→旧会） */
  function pendingTodos(){
    var out = [];
    list().forEach(function(m){
      (m.todos || []).forEach(function(t){
        if(!t.done) out.push({ meetingId: m.id, meetingTitle: m.title, date: m.date, id: t.id, text: t.text });
      });
    });
    return out;
  }

  /* 最近 n 天有记录的组会 */
  function recent(days){
    var n = Number(days) || 7;
    var from = Date.now() - n * 86400000;
    return list().filter(function(m){ return m.createdAt >= from; });
  }

  QZD.meetings = {
    list: list,
    find: find,
    add: add,
    remove: remove,
    addTodo: addTodo,
    toggleTodo: toggleTodo,
    todoToMemorial: todoToMemorial,
    pendingTodos: pendingTodos,
    recent: recent
  };
})();
