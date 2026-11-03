/* ============================================================
   systems/idea.js · 朱批灵感罐（科研 idea 随手记）
   - 一行灵感：文本 + 可选标签 + 时间戳；可标记「已孵化」(已落地)
   - 随手记、不纠结格式；统计总数与已孵化数
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
      createdAt: Date.now()
    };
    ideas().unshift(it);
    IO.pushLog('idea', '朱批灵感 · ' + (it.tag ? ('[' + it.tag + '] ') : '') + text.slice(0, 20));
    IO.save();
    return { ok: true, idea: it };
  }

  function toggle(id){
    var list = ideas();
    for(var i = 0; i < list.length; i++){
      if(list[i].id !== id) continue;
      list[i].hatched = !list[i].hatched;
      IO.save();
      return { ok: true, idea: list[i] };
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

  function stats(){
    var list = ideas();
    var hatched = 0;
    list.forEach(function(x){ if(x.hatched) hatched++; });
    return { total: list.length, hatched: hatched };
  }

  QZD.idea = {
    list: ideas,
    add: add,
    toggle: toggle,
    remove: remove,
    stats: stats
  };
})();
