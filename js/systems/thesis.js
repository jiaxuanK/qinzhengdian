/* ============================================================
   systems/thesis.js · 修书进度（论文 / 综述 / 报告写作进度）
   - 一本书(篇) = 一个 thesis，含若干章节(section)
   - 每章节有 当前量 / 目标量（字数或任意单位），整体进度 = Σ当前 / Σ目标
   - 章节可增删；进度即时结算
   ============================================================ */
(function(){
  var IO = QZD.stateIO;

  function theses(){
    if(!Array.isArray(QZD.state.theses)) QZD.state.theses = [];
    return QZD.state.theses;
  }
  function uid(p){ return p + Date.now().toString(36) + Math.floor(Math.random() * 1000).toString(36); }

  function add(title){
    title = String(title || '').trim().slice(0, 80);
    if(!title) return { ok: false, error: '请填写书名 / 题目' };
    var t = { id: uid('t'), title: title, sections: [], createdAt: Date.now() };
    theses().unshift(t);
    IO.pushLog('thesis', '立修书 · ' + title);
    IO.save();
    return { ok: true, thesis: t };
  }

  function find(id){
    var list = theses();
    for(var i = 0; i < list.length; i++) if(list[i].id === id) return list[i];
    return null;
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

  function addSection(tid, name, target){
    var t = find(tid);
    if(!t) return { ok: false, error: '未找到该修书' };
    name = String(name || '').trim().slice(0, 40);
    if(!name) return { ok: false, error: '请填写章节名' };
    target = Math.max(0, Math.min(999999, parseFloat(target) || 0));
    if(target <= 0) return { ok: false, error: '目标量需大于 0' };
    t.sections.push({ id: uid('s'), name: name, current: 0, target: target });
    IO.save();
    return { ok: true };
  }

  function removeSection(tid, sid){
    var t = find(tid);
    if(!t) return { ok: false, error: '未找到该修书' };
    for(var i = 0; i < t.sections.length; i++){
      if(t.sections[i].id === sid){
        t.sections.splice(i, 1);
        IO.save();
        return { ok: true };
      }
    }
    return { ok: false, error: '章节不存在' };
  }

  /* 设置某章节当前量（钳制在 0–目标量 之间） */
  function setSection(tid, sid, current){
    var t = find(tid);
    if(!t) return { ok: false, error: '未找到该修书' };
    for(var i = 0; i < t.sections.length; i++){
      if(t.sections[i].id !== sid) continue;
      var s = t.sections[i];
      var v = Math.max(0, Math.min(s.target || 0, parseFloat(current) || 0));
      s.current = v;
      IO.save();
      return { ok: true, section: s };
    }
    return { ok: false, error: '章节不存在' };
  }

  /* 整体进度（百分比，取整） */
  function progress(t){
    var cur = 0, tgt = 0;
    (t.sections || []).forEach(function(s){ cur += (s.current || 0); tgt += (s.target || 0); });
    return tgt > 0 ? Math.round(cur / tgt * 100) : 0;
  }

  QZD.thesis = {
    list: theses,
    find: find,
    add: add,
    remove: remove,
    addSection: addSection,
    removeSection: removeSection,
    setSection: setSection,
    progress: progress
  };
})();
