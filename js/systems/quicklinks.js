/* ============================================================
   systems/quicklinks.js · 网页快捷栏
   只存「标签 + 网址」，点击交系统浏览器打开（QZDNative.openExternal），
   游戏本体不加载网页、不占内存。用户可在游戏内增删改。
   ============================================================ */
(function(){
  function state(){ return QZD.state; }
  function list(){
    if(!Array.isArray(state().quickLinks)) state().quickLinks = [];
    return state().quickLinks;
  }
  function byId(id){
    var ls = list();
    for(var i = 0; i < ls.length; i++) if(ls[i].id === id) return ls[i];
    return null;
  }
  function uid(){ return 'ql-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 6); }

  /* 允许的 App 深链协议（与 electron/main.js 白名单一致） */
  var APP_SCHEMES = ['zotero','obsidian','vscode','cursor','notion','discord',
    'ms-word','ms-excel','ms-powerpoint','ms-edge','steam','spotify',
    'weixin','dingtalk','feishu'];
  var APP_RE = new RegExp('^(' + APP_SCHEMES.join('|') + '):', 'i');

  /* URL 规整：
     - file: / 已知 app 协议 / http(s) 原样保留
     - 裸 Windows 路径（C:\... 或 D:/...）→ file:///D:/...
     - 其它协议（javascript: 等）拒绝；普通域名补 https
     - 本地路径可用 |app| 前缀强制按 app 打开（file:// 指向 exe） */
  function normalizeUrl(raw){
    var s = String(raw == null ? '' : raw).trim();
    if(!s) return '';
    if(/^https?:\/\//i.test(s) || /^file:\/\//i.test(s)) return s;
    if(APP_RE.test(s)) return s;
    /* 裸盘符路径 → file:/// */
    if(/^[a-zA-Z]:[\\/]/.test(s)){
      return 'file:///' + s.replace(/\\/g, '/');
    }
    /* 危险/未知协议拒绝，不能盲目补 https（javascript: 会被伪装成合法网址） */
    if(/^[a-z][a-z0-9+.-]*:/i.test(s)) return '';
    return 'https://' + s;
  }
  function safeUrl(url){
    var s = String(url || '');
    return /^https?:\/\//i.test(s) || /^file:\/\//i.test(s) || APP_RE.test(s);
  }
  /* 类型推断：'web' | 'file' | 'app'，供 UI 分类显示 */
  function kindOf(url){
    var s = String(url || '');
    if(/^file:\/\//i.test(s)) return 'file';
    if(APP_RE.test(s)) return 'app';
    return 'web';
  }

  /* 分类存在 state.quickCategories，可无限层级嵌套：{ id, name, parentId }。
     parentId 为父分类 id、空串表示顶层；all 为虚拟"全部"不作归属、恒为根。
     旧档无 parentId → normalize 补空串，视为顶层，兼容。 */
  function categories(){
    var cs = (state() && state().quickCategories);
    if(!Array.isArray(cs) || !cs.length) return [{ id:'all', name:'全部', parentId:'' }];
    return cs;
  }
  function catById(id){
    var cs = categories();
    for(var i = 0; i < cs.length; i++) if(cs[i].id === id) return cs[i];
    return null;
  }
  function parentOf(c){ return (c && typeof c.parentId === 'string' && c.parentId) ? c.parentId : ''; }
  /* 直接子分类（按原顺序） */
  function childrenOf(parentId){
    var pid = parentId || '';
    return categories().filter(function(c){ return c.id !== 'all' && parentOf(c) === pid; });
  }
  /* 层级深度：沿 parentId 上溯，带环保护（防脏数据死循环） */
  function depthOf(id){
    var d = 0, seen = {}, cur = catById(id);
    while(cur && parentOf(cur) && d < 20){
      var p = parentOf(cur);
      if(seen[p]) break;
      seen[p] = true; cur = catById(p); d++;
    }
    return d;
  }
  /* 面包屑名称，如「学习工作 / 论文 / 硅光」，供下拉按层级显示 */
  function pathOf(id){
    var names = [], seen = {}, cur = catById(id), d = 0;
    while(cur && d < 20){
      names.unshift(cur.name);
      if(!parentOf(cur)) break;
      if(seen[parentOf(cur)]) break;
      seen[parentOf(cur)] = true; cur = catById(parentOf(cur));
    }
    return names.join(' / ');
  }
  /* 某分类及其所有后代的 id（删除时一并处理） */
  function subtreeIds(id){
    var out = [id], changed = true;
    while(changed){
      changed = false;
      categories().forEach(function(c){
        if(out.indexOf(parentOf(c)) >= 0 && out.indexOf(c.id) < 0){ out.push(c.id); changed = true; }
      });
    }
    return out;
  }
  function validCat(c){
    var cs = categories();
    return cs.some(function(x){ return x.id === c && x.id !== 'all'; }) ? c : 'study';
  }
  /* 新增分类：可指定父分类 parentId（空/省略＝顶层）；同名兄弟分类拒绝 */
  function addCategory(name, parentId){
    name = String(name == null ? '' : name).trim().slice(0, 10);
    if(!name) return { ok:false, error:'请填分类名' };
    var pid = parentId ? String(parentId) : '';
    if(pid && !catById(pid)) return { ok:false, error:'上级分类不存在' };
    var cs = categories();
    if(cs.some(function(c){ return c.name === name && parentOf(c) === pid; }))
      return { ok:false, error:'同级已有同名分类' };
    var item = { id: 'cat-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2,5),
                 name: name, parentId: pid };
    cs.push(item);
    state().quickCategories = cs;
    QZD.stateIO.save();
    return { ok:true, category:item };
  }
  function renameCategory(id, name){
    if(id === 'all') return { ok:false, error:'「全部」不可改' };
    name = String(name == null ? '' : name).trim().slice(0, 10);
    if(!name) return { ok:false, error:'请填分类名' };
    var cs = categories(), found = catById(id);
    if(!found) return { ok:false, error:'分类不存在' };
    if(cs.some(function(c){ return c.id !== id && c.name === name && parentOf(c) === parentOf(found); }))
      return { ok:false, error:'同级已有同名分类' };
    found.name = name;
    state().quickCategories = cs;
    QZD.stateIO.save();
    return { ok:true, category:found };
  }
  /* 改上级：把分类连同子树挂到新父下，禁止挂到自身子树（防环） */
  function reparentCategory(id, newParentId){
    if(id === 'all') return { ok:false, error:'「全部」不可移动' };
    var cur = catById(id);
    if(!cur) return { ok:false, error:'分类不存在' };
    var pid = newParentId ? String(newParentId) : '';
    if(pid === id || subtreeIds(id).indexOf(pid) >= 0)
      return { ok:false, error:'不能移到自己的子分类下' };
    if(pid && !catById(pid)) return { ok:false, error:'上级分类不存在' };
    cur.parentId = pid;
    QZD.stateIO.save();
    return { ok:true, category:cur };
  }
  /* 删除分类：连其所有子分类一起删，旗下标签归入 study，不允许删 all */
  function removeCategory(id){
    if(id === 'all') return { ok:false, error:'「全部」不可删' };
    if(!catById(id)) return { ok:false, error:'分类不存在' };
    var gone = subtreeIds(id);
    state().quickCategories = categories().filter(function(c){ return gone.indexOf(c.id) < 0; });
    var affected = 0;
    list().forEach(function(l){ if(gone.indexOf(l.category) >= 0){ l.category = 'study'; affected++; } });
    QZD.stateIO.save();
    return { ok:true, affected:affected, removed:gone.length };
  }

  function add(label, url, color, category){
    label = String(label == null ? '' : label).trim().slice(0, 16);
    var u = normalizeUrl(url);
    if(!label) return { ok:false, error:'请填标签' };
    if(!u) return { ok:false, error:'请填网址或路径' };
    if(!safeUrl(u)) return { ok:false, error:'网址/路径格式不对' };
    var item = { id: uid(), label: label, url: u,
                 color: typeof color === 'string' ? color : '',
                 category: validCat(category), hideUrl: true };
    list().push(item);
    QZD.stateIO.save();
    return { ok:true, item:item };
  }

  function update(id, label, url, color, hideUrl, category){
    var it = byId(id);
    if(!it) return { ok:false, error:'标签不存在' };
    label = String(label == null ? '' : label).trim().slice(0, 16);
    if(!label) return { ok:false, error:'请填标签' };
    var u = normalizeUrl(url);
    if(!u || !safeUrl(u)) return { ok:false, error:'网址/路径格式不对' };
    it.label = label; it.url = u;
    if(typeof color === 'string') it.color = color;
    if(typeof hideUrl === 'boolean') it.hideUrl = hideUrl;
    if(category != null) it.category = validCat(category);
    QZD.stateIO.save();
    return { ok:true, item:it };
  }

  function remove(id){
    var ls = list();
    for(var i = 0; i < ls.length; i++){
      if(ls[i].id === id){ ls.splice(i, 1); QZD.stateIO.save(); return { ok:true }; }
    }
    return { ok:false, error:'标签不存在' };
  }

  function move(id, dir){
    var ls = list(), idx = -1;
    for(var i = 0; i < ls.length; i++) if(ls[i].id === id) idx = i;
    if(idx < 0) return { ok:false, error:'标签不存在' };
    var to = idx + (dir < 0 ? -1 : 1);
    if(to < 0 || to >= ls.length) return { ok:false, error:'已到边界' };
    var tmp = ls[idx]; ls[idx] = ls[to]; ls[to] = tmp;
    QZD.stateIO.save();
    return { ok:true };
  }

  /* 打开：系统浏览器（桌面版用原生桥，浏览器降级 window.open） */
  function open(id){
    var it = byId(id);
    if(!it || !safeUrl(it.url)) return { ok:false, error:'网址无效' };
    try{
      if(typeof window !== 'undefined' && window.QZDNative && window.QZDNative.openExternal){
        window.QZDNative.openExternal(it.url);
      }else{
        window.open(it.url, '_blank', 'noopener,noreferrer');
      }
      QZD.stateIO.pushLog && QZD.stateIO.pushLog('other', '打开网页 · ' + it.label);
      return { ok:true, url:it.url };
    }catch(e){ return { ok:false, error:'打开失败：' + (e && e.message ? e.message : '未知错误') }; }
  }

  QZD.quickLinks = {
    list: list, byId: byId, add: add, update: update, remove: remove,
    move: move, open: open, normalizeUrl: normalizeUrl, safeUrl: safeUrl,
    kindOf: kindOf, categories: categories, catById: catById,
    childrenOf: childrenOf, depthOf: depthOf, pathOf: pathOf, subtreeIds: subtreeIds,
    addCategory: addCategory, renameCategory: renameCategory,
    reparentCategory: reparentCategory, removeCategory: removeCategory
  };
})();
