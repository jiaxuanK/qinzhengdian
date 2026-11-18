/* ============================================================
   systems/thesis.js · 修书进度（论文 / 综述 / 报告写作进度）
   
   数据模型：
     一本书 = 一个 thesis，含若干 chapter（根章节）
     每个 chapter 可有子章节（parentId 指向父节点），任意嵌套深度
     叶子章节：有 current / target（进度数值）
     父章节：进度 = 子章节加权平均（自动聚合）
   
   接口（与 goals 系统对齐，便于 UI 层复用谱系树逻辑）：
     thesis.add(title) / remove(id)
     thesis.rootsOf(tid)        → 某本书的根章节
     thesis.childrenOf(tid,sid) → 某章节的子章节
     thesis.findSection(tid,sid) → 按 id 找章节
     thesis.sectionProgress(tid,sid) → 章节聚合进度
     thesis.progress(t)          → 整本书进度
     thesis.addSection(tid, name, target, parentSid?)
     thesis.removeSection(tid, sid)
     thesis.setSection(tid, sid, current)
     thesis.archive / restore / archived
   ============================================================ */
(function(){
  var IO = QZD.stateIO;

  function theses(){
    if(!Array.isArray(QZD.state.theses)) QZD.state.theses = [];
    return QZD.state.theses;
  }
  function uid(p){ return p + Date.now().toString(36) + Math.floor(Math.random() * 1000).toString(36); }

  /* ---------- 书本 ---------- */
  function find(id){
    var list = theses();
    for(var i = 0; i < list.length; i++) if(list[i].id === id) return list[i];
    return null;
  }

  function add(title){
    title = String(title || '').trim().slice(0, 80);
    if(!title) return { ok: false, error: '请填写书名 / 题目' };
    var t = { id: uid('t'), title: title, sections: [], createdAt: Date.now() };
    theses().unshift(t);
    IO.pushLog('thesis', '立修书 · ' + title);
    IO.save();
    return { ok: true, thesis: t };
  }

  function remove(id){
    var list = theses();
    for(var i = 0; i < list.length; i++){
      if(list[i].id !== id) continue;
      var t = list[i].title;
      list.splice(i, 1);
      IO.pushLog('thesis', '焚修书 · ' + t);
      IO.save();
      return { ok: true };
    }
    return { ok: false, error: '修书不存在' };
  }

  /* ---------- 章节树 ---------- */
  function findSection(tid, sid){
    var t = find(tid);
    if(!t) return null;
    var list = t.sections || [];
    for(var i = 0; i < list.length; i++) if(list[i].id === sid) return list[i];
    return null;
  }

  function childrenOf(tid, sid){
    var t = find(tid);
    if(!t) return [];
    var list = t.sections || [];
    return list.filter(function(s){ return (s.parentId || null) === (sid || null); });
  }

  function rootsOf(tid){ return childrenOf(tid, null); }

  function addSection(tid, name, target, parentSid){
    var t = find(tid);
    if(!t) return { ok: false, error: '未找到该修书' };
    name = String(name || '').trim().slice(0, 40);
    if(!name) return { ok: false, error: '请填写章节名' };
    target = Math.max(0, Math.min(999999, parseFloat(target) || 0));
    /* target=0 表示父节点（无叶子数值，靠子节点聚合）*/
    var s = { id: uid('s'), name: name, parentId: parentSid || null, current: 0, target: target };
    if(!Array.isArray(t.sections)) t.sections = [];
    t.sections.push(s);
    IO.save();
    return { ok: true, section: s };
  }

  function removeSection(tid, sid){
    var t = find(tid);
    if(!t) return { ok: false, error: '未找到该修书' };
    /* 递归删子树 */
    function collectIds(sid){
      var ids = [sid];
      (t.sections || []).filter(function(s){ return s.parentId === sid; })
        .forEach(function(c){ ids = ids.concat(collectIds(c.id)); });
      return ids;
    }
    var toDel = collectIds(sid);
    t.sections = (t.sections || []).filter(function(s){ return toDel.indexOf(s.id) < 0; });
    IO.save();
    return { ok: true };
  }

  /* 设置叶子章节当前量 */
  function setSection(tid, sid, current){
    var s = findSection(tid, sid);
    if(!s) return { ok: false, error: '章节不存在' };
    /* 只有叶子（无 children）且 target>0 才能设数值 */
    var t = find(tid);
    var hasChildren = (t.sections || []).some(function(x){ return x.parentId === sid; });
    if(hasChildren) return { ok: false, error: '父章节不设数值，由子章节聚合' };
    var v = Math.max(0, Math.min(s.target || 0, parseFloat(current) || 0));
    s.current = v;
    IO.save();
    return { ok: true, section: s };
  }

  /* ---------- 进度计算 ---------- */
  function sectionProgress(tid, sid){
    var t = find(tid);
    if(!t) return 0;
    var s = findSection(tid, sid);
    if(!s) return 0;
    var kids = (t.sections || []).filter(function(x){ return x.parentId === sid; });
    if(kids.length === 0 && s.target > 0){
      /* 叶子：自身 current/target */
      return Math.round((s.current || 0) / s.target * 100);
    }
    if(kids.length === 0) return 0;
    /* 父：子节点加权平均（按 target）*/
    var num = 0, den = 0;
    kids.forEach(function(c){
      var cp = sectionProgress(tid, c.id) / 100;
      var cw = c.target || 1;
      num += cp * cw;
      den += cw;
    });
    return den > 0 ? Math.round(num / den * 100) : 0;
  }

  /* 整本书进度 = 所有根章节加权 */
  function progress(t){
    if(!t) return 0;
    var roots = rootsOf(t.id);
    if(roots.length === 0) return 0;
    var num = 0, den = 0;
    roots.forEach(function(r){
      var rp = sectionProgress(t.id, r.id) / 100;
      var rw = r.target || 1;
      num += rp * rw;
      den += rw;
    });
    return den > 0 ? Math.round(num / den * 100) : 0;
  }

  /* ---------- 归档 ---------- */
  function archived(){
    if(!Array.isArray(QZD.state.thesisArchived)) QZD.state.thesisArchived = [];
    return QZD.state.thesisArchived;
  }
  function archive(id){
    var list = theses();
    for(var i = 0; i < list.length; i++){
      if(list[i].id !== id) continue;
      var t = list.splice(i, 1)[0];
      t.archivedAt = Date.now();
      archived().unshift(t);
      IO.pushLog('thesis', '收书入档 · ' + t.title);
      IO.save();
      return { ok: true };
    }
    return { ok: false, error: '修书不存在' };
  }
  function restore(id){
    var list = archived();
    for(var i = 0; i < list.length; i++){
      if(list[i].id !== id) continue;
      var t = list.splice(i, 1)[0];
      delete t.archivedAt;
      theses().unshift(t);
      IO.save();
      return { ok: true };
    }
    return { ok: false, error: '档案中未找到' };
  }

  QZD.thesis = {
    list: theses,
    find: find,
    add: add,
    remove: remove,
    addSection: addSection,
    removeSection: removeSection,
    setSection: setSection,
    updateSection: function(tid, sid, patch){
      var s = findSection(tid, sid);
      if(!s) return { ok: false, error: '章节不存在' };
      if(patch.name !== undefined){
        var nm = String(patch.name).trim().slice(0, 40);
        if(!nm) return { ok: false, error: '章节名不能为空' };
        s.name = nm;
      }
      if(patch.target !== undefined){
        var t = Math.max(0, Math.min(999999, parseFloat(patch.target) || 0));
        s.target = t;
      }
      IO.save();
      return { ok: true, section: s };
    },
    progress: progress,
    findSection: findSection,
    rootsOf: rootsOf,
    childrenOf: childrenOf,
    sectionProgress: sectionProgress,
    archived: archived,
    archive: archive,
    restore: restore
  };
})();
