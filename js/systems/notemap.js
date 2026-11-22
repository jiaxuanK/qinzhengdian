/* ============================================================
   systems/notemap.js · 11-22 自定义思维导图（用户自己填写内容）
   - 扁平节点 {id,text,parentId,collapsed}，无限层级（与奏折子任务同款）
   - CRUD：add / edit / remove（连子） / move / toggleCollapse
   - toTree() 转成 mindmap 渲染器吃的树 {id,label,sub,color,children,full}
   - 纯数据层，零 DOM
   ============================================================ */
(function(){
  var IO = QZD.stateIO;
  var PALETTE = ['#3e6b5c','#378ADD','#1D9E75','#BA7517','#A8573F','#7C6B94'];

  function nodes(){
    if(!Array.isArray(QZD.state.notemap)) QZD.state.notemap = [];
    return QZD.state.notemap;
  }
  function uid(){ return 'n' + Date.now().toString(36) + Math.floor(Math.random()*1000).toString(36); }
  function find(id){
    var list = nodes();
    for(var i=0;i<list.length;i++) if(list[i].id === id) return list[i];
    return null;
  }
  function childrenOf(parentId){
    return nodes().filter(function(n){ return (n.parentId || '') === (parentId || ''); });
  }
  function descendants(id, out){
    out = out || [];
    childrenOf(id).forEach(function(c){ out.push(c); descendants(c.id, out); });
    return out;
  }

  /* 新增节点：parentId 为空=顶级；depth 决定配色 */
  function add(text, parentId){
    text = String(text || '').trim().slice(0, 120);
    if(!text) return { ok:false, error:'内容不能为空' };
    if(parentId && !find(parentId)) return { ok:false, error:'上级节点不存在' };
    var depth = 0, cur = parentId;
    while(cur){ var p = find(cur); if(!p) break; depth++; cur = p.parentId; }
    var n = { id:uid(), text:text, parentId:parentId || '', collapsed:false, depth:depth };
    nodes().push(n);
    IO.save();
    return { ok:true, node:n };
  }

  function edit(id, text){
    var n = find(id);
    if(!n) return { ok:false, error:'节点不存在' };
    text = String(text || '').trim().slice(0, 120);
    if(!text) return { ok:false, error:'内容不能为空' };
    n.text = text;
    IO.save();
    return { ok:true, node:n };
  }

  /* 删除节点 + 所有子孙 */
  function remove(id){
    if(!find(id)) return { ok:false, error:'节点不存在' };
    var gone = descendants(id).map(function(n){ return n.id; });
    gone.push(id);
    QZD.state.notemap = nodes().filter(function(n){ return gone.indexOf(n.id) < 0; });
    IO.save();
    return { ok:true, removed:gone.length };
  }

  /* 移动节点到新上级（防环：不能挂到自己的子孙下） */
  function move(id, newParentId){
    var n = find(id);
    if(!n) return { ok:false, error:'节点不存在' };
    if(newParentId){
      if(!find(newParentId)) return { ok:false, error:'目标上级不存在' };
      var kids = descendants(id).map(function(x){ return x.id; });
      if(newParentId === id || kids.indexOf(newParentId) >= 0) return { ok:false, error:'不能移到自己的分支下' };
    }
    n.parentId = newParentId || '';
    IO.save();
    return { ok:true, node:n };
  }

  function toggleCollapse(id){
    var n = find(id);
    if(!n) return { ok:false, error:'节点不存在' };
    n.collapsed = !n.collapsed;
    IO.save();
    return { ok:true, collapsed:n.collapsed };
  }

  function trunc(s, n){ s = String(s||''); return s.length > n ? s.slice(0,n)+'…' : s; }

  /* 转成 mindmap 渲染器的树；无节点时返回空根 */
  function toTree(){
    var root = { id:'root', label:'我的导图', sub:'自己填写 · 无限层级', color:'#3e6b5c', children:[] };
    function build(parentId){
      return childrenOf(parentId).map(function(n, i){
        var kids = childrenOf(n.id);
        var node = {
          id: n.id,
          label: trunc(n.text, 16),
          full: n.text,
          color: PALETTE[(n.depth || 0) % PALETTE.length],
          sub: kids.length ? kids.length + ' 个子节点' : ''
        };
        if(!n.collapsed && kids.length) node.children = build(n.id);
        return node;
      });
    }
    root.children = build('');
    return root;
  }

  QZD.notemap = {
    nodes: nodes, find: find, childrenOf: childrenOf,
    add: add, edit: edit, remove: remove, move: move, toggleCollapse: toggleCollapse,
    toTree: toTree, descendants: descendants
  };
})();
