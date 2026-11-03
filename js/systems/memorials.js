/* ============================================================
   systems/memorials.js · 御案奏折（唯一的专注对象）
   奏折 = 大任务：本身不计时，可拆小目标（subtasks）；
   小目标可开正计时；专注分钟按分钟累计，奖励按分钟发。
   状态：待批阅 → 批阅中 → 已办结；批阅中可搁置。
   ============================================================ */
(function(){
  var CFG = QZD.config;
  var C = CFG.MEMORIAL;
  var F = CFG.FOCUS || {};

  function state(){ return QZD.state; }

  function metaOf(list, key){
    for(var i = 0; i < list.length; i++){
      if(list[i].key === key) return list[i];
    }
    return null;
  }

  function find(id){
    var list = state().memorials || [];
    for(var i = 0; i < list.length; i++){
      if(list[i].id === id) return list[i];
    }
    return null;
  }

  function nextId(){
    var base = Date.now();
    var id = 'mem_' + base;
    var n = 0;
    while(find(id)){
      n++;
      id = 'mem_' + base + '_' + n;
    }
    return id;
  }

  function uid(prefix){
    return prefix + Date.now().toString(36) + Math.floor(Math.random() * 1000).toString(36);
  }

  function subsOf(m){ return (m && Array.isArray(m.subtasks)) ? m.subtasks : []; }

  function findSub(m, subId){
    var subs = subsOf(m);
    for(var i = 0; i < subs.length; i++){
      if(subs[i].id === subId) return subs[i];
    }
    return null;
  }

  /* 按 id 全局定位小目标：返回 { memorial, sub } */
  function findSubById(subId){
    var list = state().memorials || [];
    for(var i = 0; i < list.length; i++){
      var sb = findSub(list[i], subId);
      if(sb) return { memorial: list[i], sub: sb };
    }
    return null;
  }

  /* 截止日：支持 'YYYY-MM-DD'（按当天 23:59 计）或时间戳 */
  function parseDue(v){
    if(v === null || v === undefined || v === '') return null;
    if(typeof v === 'number') return isFinite(v) ? v : null;
    var s = String(v).trim();
    if(/^\d{4}-\d{2}-\d{2}$/.test(s)){
      var p = s.split('-');
      return new Date(+p[0], +p[1] - 1, +p[2], 23, 59, 59).getTime();
    }
    var t = Date.parse(s);
    return isNaN(t) ? null : t;
  }

  /* 进度：小目标完成率 + 累计专注分钟 + 专注次数 */
  function progress(m){
    var subs = subsOf(m);
    var done = 0, subMin = 0;
    subs.forEach(function(s){
      if(s.done) done++;
      subMin += (s.focusMin || 0);
    });
    return {
      total: subs.length,
      done: done,
      pct: subs.length ? Math.round(done / subs.length * 100) : 0,
      focusMin: Math.round(((m.focusMin || subMin) || 0) * 10) / 10,
      sessions: m.sessions || 0,
      allDone: subs.length > 0 && done === subs.length
    };
  }

  QZD.memorials = {
    flash: { id: null, until: 0 },

    find: find,
    findSubById: findSubById,
    progress: progress,
    tagName: function(key){ var m = metaOf(C.TAGS, key); return m ? m.name : key; },
    priorityName: function(key){ var m = metaOf(C.PRIORITIES, key); return m ? m.name : key; },
    priorityCls: function(key){ var m = metaOf(C.PRIORITIES, key); return m ? m.cls : ''; },
    statusName: function(key){ var m = metaOf(C.STATUS, key); return m ? m.name : key; },

    /* 御案列表：归档奏折不显示；刚办结的奏折保留到闪光结束 */
    active: function(tag){
      var now = Date.now();
      return (state().memorials || []).filter(function(m){
        var flashing = m.id === this.flash.id && now < this.flash.until;
        if(m.status === 'banjie' && !flashing) return false;
        if(tag && tag !== 'all' && m.tag !== tag) return false;
        return true;
      }, this).sort(function(a, b){ return b.createdAt - a.createdAt; });
    },

    /* 仍在办、且未办结的奏折（今日页摘要用） */
    running: function(){
      return (state().memorials || []).filter(function(m){
        return m.status !== 'banjie';
      }).sort(function(a, b){ return b.updatedAt - a.updatedAt; });
    },

    validate: function(draft){
      var title = String(draft.title || '').trim();
      if(!title) return '奏折标题不可为空';
      if(title.length > C.TITLE_MAX) return '标题不得超过 ' + C.TITLE_MAX + ' 字';
      if(!metaOf(C.TAGS, draft.tag)) return '请选择所属官署';
      if(!metaOf(C.PRIORITIES, draft.priority)) return '请选择奏折优先级';
      return null;
    },

    /* 新建奏折：不再要求目标时长（没有固定番茄） */
    create: function(draft){
      var err = this.validate(draft);
      if(err) return { ok: false, error: err };
      var now = Date.now();
      var m = {
        id: nextId(),
        title: String(draft.title).trim(),
        note: String(draft.note || '').trim(),
        tag: draft.tag,
        priority: draft.priority,
        subjectId: draft.subjectId || null,
        dueAt: parseDue(draft.dueAt),
        status: 'daipi',
        createdAt: now,
        updatedAt: now,
        finishedAt: null,
        /* 专注相关 */
        subtasks: [],
        focusMin: 0,
        sessions: 0
      };
      state().memorials.push(m);
      QZD.stateIO.pushLog('memorial', '御案新落一折：' + m.title);
      QZD.stateIO.save();
      return { ok: true, memorial: m };
    },

    remove: function(id){
      var m = find(id);
      if(!m) return { ok: false, error: '奏折不存在' };
      if(m.status === 'pizhong') return { ok: false, error: '批阅中的奏折不可删除，请先搁置' };
      var list = state().memorials;
      list.splice(list.indexOf(m), 1);
      QZD.stateIO.pushLog('memorial', '御案撤下一折：' + m.title);
      QZD.stateIO.save();
      return { ok: true };
    },

    setStatus: function(id, status){
      var m = find(id);
      if(!m) return { ok: false, error: '奏折不存在' };
      if(m.status === 'banjie') return { ok: false, error: '奏折已办结' };
      if(status === 'gezhi' && m.status !== 'pizhong') return { ok: false, error: '仅批阅中的奏折可搁置' };
      if(status === 'gezhi' && QZD.pomodoro && QZD.pomodoro.isActive() && QZD.pomodoro.boundId() === m.id){
        return { ok: false, error: '奏折正在批阅，需先结束专注' };
      }
      if(status === 'pizhong' && (m.status !== 'daipi' && m.status !== 'gezhi')){
        return { ok: false, error: '当前状态不可批阅' };
      }
      m.status = status;
      m.updatedAt = Date.now();
      QZD.stateIO.save();
      return { ok: true, memorial: m };
    },

    /* 累计专注分钟（每分钟调用一次，不做办结判定） */
    addMinutes: function(id, min){
      var m = find(id);
      if(!m || !(min > 0)) return { memorial: m };
      if(typeof m.focusMin !== 'number') m.focusMin = 0;
      m.focusMin += min;
      m.updatedAt = Date.now();
      return { memorial: m };
    },

    /* 一次专注结束（完成或放弃都计一次） */
    addSession: function(id, n){
      var m = find(id);
      if(!m) return null;
      m.sessions = (m.sessions || 0) + (n || 1);
      QZD.stateIO.save();
      return m;
    },

    /* 放弃结算：已计入的分钟回吐一半（对应资源回收五成） */
    removeMinutes: function(id, min){
      var m = find(id);
      if(!m || !(min > 0)) return;
      if(typeof m.focusMin !== 'number') m.focusMin = 0;
      m.focusMin = Math.max(0, m.focusMin - min);
      m.updatedAt = Date.now();
    },

    /* ---------- 截止日（DDL） ---------- */
    parseDue: parseDue,
    setDue: function(id, v){
      var m = find(id);
      if(!m) return { ok: false, error: '奏折不存在' };
      m.dueAt = parseDue(v);
      m.updatedAt = Date.now();
      QZD.stateIO.save();
      return { ok: true, memorial: m };
    },
    /* 未办结且有截止日的奏折：overdue 已逾期 / soon 未来 days 天内 */
    dueList: function(days){
      var n = Number(days) || 7;
      var now = Date.now();
      var out = { overdue: [], soon: [], all: [] };
      (state().memorials || []).forEach(function(m){
        if(m.status === 'banjie' || !m.dueAt) return;
        var item = { id: m.id, title: m.title, dueAt: m.dueAt, days: Math.ceil((m.dueAt - now) / 86400000) };
        out.all.push(item);
        if(m.dueAt < now) out.overdue.push(item);
        else if(m.dueAt - now <= n * 86400000) out.soon.push(item);
      });
      out.overdue.sort(function(a, b){ return a.dueAt - b.dueAt; });
      out.soon.sort(function(a, b){ return a.dueAt - b.dueAt; });
      out.all.sort(function(a, b){ return a.dueAt - b.dueAt; });
      return out;
    },

    /* ---------- 小目标 ---------- */
    addSub: function(id, title){
      var m = find(id);
      if(!m) return { ok: false, error: '奏折不存在' };
      if(m.status === 'banjie') return { ok: false, error: '奏折已办结' };
      var name = String(title || '').trim().slice(0, F.SUB_TITLE_MAX || 24);
      if(!name) return { ok: false, error: '请填写小目标' };
      if(!Array.isArray(m.subtasks)) m.subtasks = [];
      if(m.subtasks.length >= (F.MAX_SUBS || 12)){
        return { ok: false, error: '小目标已达上限（' + (F.MAX_SUBS || 12) + '）' };
      }
      var sub = { id: uid('s'), title: name, done: false, doneAt: null, focusMin: 0 };
      m.subtasks.push(sub);
      m.updatedAt = Date.now();
      QZD.stateIO.pushLog('memorial', '拆出小目标 · ' + name);
      QZD.stateIO.save();
      return { ok: true, sub: sub, memorial: m };
    },

    removeSub: function(id, subId){
      var m = find(id);
      if(!m) return { ok: false, error: '奏折不存在' };
      var subs = subsOf(m);
      for(var i = 0; i < subs.length; i++){
        if(subs[i].id !== subId) continue;
        var s = subs[i];
        subs.splice(i, 1);
        m.updatedAt = Date.now();
        QZD.stateIO.pushLog('memorial', '删除小目标 · ' + s.title);
        QZD.stateIO.save();
        return { ok: true };
      }
      return { ok: false, error: '小目标不存在' };
    },

    setSubDone: function(id, subId, done){
      var m = find(id);
      if(!m) return { ok: false, error: '奏折不存在' };
      var s = findSub(m, subId);
      if(!s) return { ok: false, error: '小目标不存在' };
      s.done = !!done;
      s.doneAt = s.done ? Date.now() : null;
      m.updatedAt = Date.now();
      QZD.stateIO.pushLog('memorial', (s.done ? '小目标达成 · ' : '重开小目标 · ') + s.title);
      QZD.stateIO.save();
      return { ok: true, sub: s, memorial: m };
    },

    addSubFocusMin: function(subId, min){
      var hit = findSubById(subId);
      if(!hit || !(min > 0)) return null;
      hit.sub.focusMin = Math.round(((hit.sub.focusMin || 0) + min) * 10) / 10;
      return hit;
    },

    /* 改挂课题（null = 未分类）；只改归属，不动已有统计 */
    setSubject: function(id, subjectId){
      var m = find(id);
      if(!m) return { ok: false, error: '奏折不存在' };
      m.subjectId = subjectId || null;
      m.updatedAt = Date.now();
      QZD.stateIO.save();
      return { ok: true, memorial: m };
    },

    /* 手动办结（不再按目标时长自动办结） */
    finish: function(id){
      var m = find(id);
      if(!m) return { ok: false, error: '奏折不存在' };
      if(m.status === 'banjie') return { ok: false, error: '奏折已办结' };
      if(QZD.pomodoro && QZD.pomodoro.isActive() && QZD.pomodoro.boundId() === m.id){
        return { ok: false, error: '正在批阅此折，请先结束专注' };
      }
      m.status = 'banjie';
      m.finishedAt = Date.now();
      m.updatedAt = m.finishedAt;
      this.flash.id = m.id;
      this.flash.until = m.finishedAt + 1500;
      QZD.stateIO.pushLog('memorial', '奏折办结：' + m.title + ' · 累计专注 ' +
        Math.round(m.focusMin || 0) + ' 分 / ' + (m.sessions || 0) + ' 次');
      QZD.stateIO.save();
      return { ok: true, memorial: m };
    }
  };
})();
