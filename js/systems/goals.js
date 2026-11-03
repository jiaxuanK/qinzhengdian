/* ============================================================
   systems/goals.js · 千秋大计（长期目标树）
   - 树形结构：顶层大计(parentId=null) 可挂子目标，子目标还可再挂
   - 叶节点有自身进度(0–100)；非叶节点的「有效进度」= 直接子节点有效进度的均值
   - 删除节点级联删除其全部后代；进度/截止/标题可改
   ============================================================ */
(function(){
  var IO = QZD.stateIO;

  function tree(){
    if(!Array.isArray(QZD.state.goalTree)) QZD.state.goalTree = [];
    return QZD.state.goalTree;
  }
  function uid(){ return 'g' + Date.now().toString(36) + Math.floor(Math.random() * 1000).toString(36); }

  function find(id){
    var list = tree();
    for(var i = 0; i < list.length; i++) if(list[i].id === id) return list[i];
    return null;
  }
  function children(id){
    return tree().filter(function(n){ return n.parentId === id; });
  }
  function roots(){ return tree().filter(function(n){ return !n.parentId; }); }

  function add(title, parentId){
    title = String(title || '').trim().slice(0, 60);
    if(!title) return { ok: false, error: '请填写目标' };
    if(parentId){
      var p = find(parentId);
      if(!p) return { ok: false, error: '父目标不存在' };
    }
    var node = {
      id: uid(),
      parentId: parentId || null,
      title: title,
      progress: 0,
      deadline: '',
      done: false,
      createdAt: Date.now()
    };
    tree().push(node);
    IO.pushLog('goals', '立大计 · ' + title);
    IO.save();
    return { ok: true, node: node };
  }

  /* 级联删除：收集后代一并删除 */
  function remove(id){
    var list = tree();
    var toDel = {};
    (function collect(nid){
      toDel[nid] = true;
      children(nid).forEach(function(c){ collect(c.id); });
    })(id);
    for(var i = list.length - 1; i >= 0; i--){
      if(toDel[list[i].id]) list.splice(i, 1);
    }
    IO.save();
    return { ok: true };
  }

  function setProgress(id, p){
    var n = find(id);
    if(!n) return { ok: false, error: '目标不存在' };
    n.progress = Math.max(0, Math.min(100, Math.round(p) || 0));
    n.done = n.progress >= 100;
    IO.save();
    return { ok: true, node: n };
  }
  function setDeadline(id, d){
    var n = find(id);
    if(!n) return { ok: false, error: '目标不存在' };
    n.deadline = String(d || '').trim().slice(0, 20);
    IO.save();
    return { ok: true };
  }
  function updateTitle(id, t){
    var n = find(id);
    if(!n) return { ok: false, error: '目标不存在' };
    n.title = String(t || '').trim().slice(0, 60) || n.title;
    IO.save();
    return { ok: true };
  }

  /* 有效进度：叶节点取自身进度；非叶节点取直接子节点均值 */
  function effective(node){
    var ch = children(node.id);
    if(ch.length){
      var sum = 0;
      ch.forEach(function(c){ sum += effective(c); });
      return Math.round(sum / ch.length);
    }
    return node.progress || 0;
  }

  QZD.goals = {
    list: tree,
    roots: roots,
    children: children,
    find: find,
    add: add,
    remove: remove,
    setProgress: setProgress,
    setDeadline: setDeadline,
    updateTitle: updateTitle,
    effective: effective
  };
})();
