/* ============================================================
   systems/idea.js · 朱批灵感罐（科研 idea 随手记）
   B 档升级：
   - 孵化链路：孵化时可选「课题/议事厅议题/论文/独立落地」，存关联 ID
   - 未孵化 / 已孵化 分 tab 查看
   - 标签筛选 + 搜索
   - 统计：总数 / 孵化率 / 本周新增
   ============================================================ */
(function(){
  var IO = QZD.stateIO;

  function ideas(){
    if(!Array.isArray(QZD.state.ideas)) QZD.state.ideas = [];
    return QZD.state.ideas;
  }
  function uid(){ return 'i' + Date.now().toString(36) + Math.floor(Math.random() * 1000).toString(36); }

  function add(text, tag){
    text = String(text || '').trim().slice(0, 300);
    if(!text) return { ok: false, error: '灵感不能为空' };
    var it = {
      id: uid(),
      text: text,
      tag: String(tag || '').trim().slice(0, 16),
      hatched: false,
      hatchedAt: null,
      hatchedType: null,   /* 'subject' | 'meeting' | 'thesis' | 'other' */
      hatchedRef: null,    /* 关联对象 ID 或名称 */
      createdAt: Date.now()
    };
    ideas().unshift(it);
    IO.pushLog('idea', '朱批灵感 · ' + (it.tag ? ('[' + it.tag + '] ') : '') + text.slice(0, 20));
    IO.save();
    return { ok: true, idea: it };
  }

  function hatch(id, type, ref){
    var list = ideas();
    for(var i = 0; i < list.length; i++){
      if(list[i].id !== id) continue;
      list[i].hatched = true;
      list[i].hatchedAt = Date.now();
      list[i].hatchedType = type || 'other';
      list[i].hatchedRef = ref || null;
      IO.save();
      return { ok: true, idea: list[i] };
    }
    return { ok: false, error: '灵感不存在' };
  }

  function unhatch(id){
    var list = ideas();
    for(var i = 0; i < list.length; i++){
      if(list[i].id !== id) continue;
      list[i].hatched = false;
      list[i].hatchedAt = null;
      list[i].hatchedType = null;
      list[i].hatchedRef = null;
      IO.save();
      return { ok: true };
    }
    return { ok: false, error: '灵感不存在' };
  }

  function remove(id){
    var list = ideas();
    for(var i = 0; i < list.length; i++){
      if(list[i].id !== id) continue;
      list.splice(i, 1);
      IO.save();
      return { ok: true };
    }
    return { ok: false, error: '灵感不存在' };
  }

  function edit(id, patch){
    patch = patch || {};
    var list = ideas();
    for(var i = 0; i < list.length; i++){
      if(list[i].id !== id) continue;
      if(patch.text !== undefined) list[i].text = String(patch.text).trim();
      if(patch.tag !== undefined) list[i].tag = String(patch.tag).trim();
      IO.save();
      return { ok: true, idea: list[i] };
    }
    return { ok: false, error: '灵感不存在' };
  }

  function tags(){
    var list = ideas();
    var seen = {};
    var out = [];
    list.forEach(function(x){
      var t = (x.tag || '').trim();
      if(t && !seen[t]){ seen[t] = true; out.push(t); }
    });
    return out;
  }

  function filter(opts){
    opts = opts || {};
    var list = ideas();
    if(opts.hatched === true) list = list.filter(function(x){ return x.hatched; });
    else if(opts.hatched === false) list = list.filter(function(x){ return !x.hatched; });
    if(opts.tag) list = list.filter(function(x){ return x.tag === opts.tag; });
    if(opts.q){
      var q = String(opts.q).toLowerCase();
      list = list.filter(function(x){
        return (x.text || '').toLowerCase().indexOf(q) >= 0 ||
               (x.tag || '').toLowerCase().indexOf(q) >= 0;
      });
    }
    return list;
  }

  function stats(){
    var list = ideas();
    var hatched = 0;
    list.forEach(function(x){ if(x.hatched) hatched++; });
    /* 本周新增（按 7×24h 算） */
    var weekMs = 7 * 24 * 3600 * 1000;
    var weekNew = 0;
    var now = Date.now();
    list.forEach(function(x){ if(now - x.createdAt <= weekMs) weekNew++; });
    var hatchRate = list.length ? Math.round(hatched / list.length * 100) : 0;
    return { total: list.length, hatched: hatched, weekNew: weekNew, hatchRate: hatchRate };
  }

  /* 轻量关联：只设 hatchedType + hatchedRef，**不改变 hatched 状态**
     用于"灵感还在罐子里但属于某个大计" */
  function link(id, type, ref){
    var list = ideas();
    for(var i = 0; i < list.length; i++){
      if(list[i].id !== id) continue;
      list[i].hatchedType = type || null;
      list[i].hatchedRef = ref || null;
      IO.save();
      return { ok: true };
    }
    return { ok: false, error: '灵感不存在' };
  }
  function unlink(id){
    var list = ideas();
    for(var i = 0; i < list.length; i++){
      if(list[i].id !== id) continue;
      list[i].hatchedType = null;
      list[i].hatchedRef = null;
      IO.save();
      return { ok: true };
    }
    return { ok: false, error: '灵感不存在' };
  }

  QZD.idea = {
    list: ideas,
    add: add,
    edit: edit,
    hatch: hatch,
    unhatch: unhatch,
    link: link,
    unlink: unlink,
    remove: remove,
    tags: tags,
    filter: filter,
    stats: stats
  };
})();
