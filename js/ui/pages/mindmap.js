/* ============================================================
   ui/pages/mindmap.js · 11-22 记录导图（两张独立图）
   - study-map 学习导图：速记 + 专注 + 课题 + 三事 + 奏折
   - log-map   起居注导图：游戏发展脉络（主题/时间/国运阶段）
   横向树 SVG，节点可展开收起、悬停看原文、维度切换，文字不重叠。
   ============================================================ */
(function(){
  var UI = QZD.ui;
  var COL = { root:150, branch:150, group:178, leaf:320 };
  var GAP = 46, PAD = 40;
  var state = { studyDim:'goal', logDim:'theme', collapsed:{} };
  var activeKind = 'study';   /* 当前渲染的导图类型，供事件处理用 */

  function esc(s){ return String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
  function xAt(d){ return PAD + (d===0?0:d===1?185:d===2?375:PAD+560); }
  function boxW(n){ return n.leaf?COL.leaf:(n._depth===0?COL.root:(n._depth===1?COL.branch:COL.group)); }

  function layout(tree){
    var nodes=[], edges=[], leafY=PAD;
    function assign(n, depth){
      n._depth = depth;
      var isCol = state.collapsed[n.id] && n.children && n.children.length;
      if(!n.children || !n.children.length || isCol){ n._y=leafY; leafY+=GAP; }
      else { n.children.forEach(function(c){ assign(c,depth+1); }); n._y=(n.children[0]._y+n.children[n.children.length-1]._y)/2; }
    }
    assign(tree,0);
    function walk(n){
      nodes.push(n);
      var isCol = state.collapsed[n.id] && n.children && n.children.length;
      if(n.children && !isCol) n.children.forEach(function(c){ edges.push({from:n,to:c,color:c.color||'#888'}); walk(c); });
    }
    walk(tree);
    return { nodes:nodes, edges:edges, H:Math.max(300, leafY+PAD) };
  }

  function svgGraph(tree){
    var L=layout(tree), nodes=L.nodes, edges=L.edges;
    var W=1120, H=L.H;
    var colors=[]; edges.forEach(function(e){ if(colors.indexOf(e.color)<0) colors.push(e.color); });
    var s='<defs>';
    colors.forEach(function(c,i){ s+='<marker id="mm-ar'+i+'" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="'+c+'"/></marker>'; });
    s+='</defs>';
    edges.forEach(function(e){
      var mi=colors.indexOf(e.color), x1=xAt(e.from._depth)+boxW(e.from), y1=e.from._y, x2=xAt(e.to._depth), y2=e.to._y, mx=(x1+x2)/2;
      s+='<path class="mm-edge" stroke="'+e.color+'" stroke-width="1.6" fill="none" opacity=".5" marker-end="url(#mm-ar'+mi+')" d="M'+x1+' '+y1+' C'+mx+' '+y1+','+mx+' '+y2+','+x2+' '+y2+'"/>';
    });
    nodes.forEach(function(n){
      var x=xAt(n._depth), y=n._y, w=boxW(n), h=n.leaf?30:38;
      var fill=n._depth===0?'#3e6b5c':(n.leaf?'#fff':'#fbf8f1');
      var stroke=n._depth===0?'#3e6b5c':n.color;
      s+='<g class="mm-node" data-id="'+esc(n.id)+'" style="cursor:'+((n.children&&n.children.length)?'pointer':'default')+'">';
      s+='<rect x="'+x+'" y="'+(y-h/2)+'" width="'+w+'" height="'+h+'" rx="9" fill="'+fill+'" stroke="'+stroke+'" stroke-width="'+(n.leaf?0.8:1.4)+'"/>';
      if(n._depth===0){ s+='<text x="'+(x+w/2)+'" y="'+(y+5)+'" text-anchor="middle" font-size="14" font-weight="700" fill="#fff">'+esc(n.label)+'</text>'; }
      else if(n.leaf){
        s+='<circle cx="'+(x+12)+'" cy="'+y+'" r="3.5" fill="'+n.color+'"/>';
        s+='<text x="'+(x+23)+'" y="'+(y+4)+'" font-size="11.5" fill="#4a453c">'+esc(n.label)+'</text>';
      } else {
        s+='<text x="'+(x+12)+'" y="'+(n.sub?y-2:y+4)+'" font-size="12.5" font-weight="600" fill="#2d2a25">'+esc(n.label)+'</text>';
        if(n.sub) s+='<text x="'+(x+12)+'" y="'+(y+12)+'" font-size="10.5" fill="#8a8477">'+esc(n.sub)+'</text>';
        var has=n.children&&n.children.length;
        s+='<text x="'+(x+w-14)+'" y="'+(y+4)+'" text-anchor="end" font-size="14" fill="'+n.color+'">'+(has?(state.collapsed[n.id]?'+':'−'):'')+'</text>';
      }
      s+='</g>';
    });
    return '<svg class="mm-svg" viewBox="0 0 '+W+' '+H+'" width="'+W+'" height="'+H+'">'+s+'</svg>';
  }

  function modes(kind, cur){
    var list = kind==='study'
      ? [['goal','按三事'],['subject','按课题'],['time','按时间']]
      : [['theme','按主题'],['time','按时间'],['phase','国运阶段']];
    return '<div class="mm-modes">' + list.map(function(x){
      return '<button class="chip'+(cur===x[0]?' active':'')+'" data-mm-mode="'+kind+'|'+x[0]+'">'+x[1]+'</button>';
    }).join('') + '</div>';
  }

  function page(kind){
    activeKind = kind;
    var tree = kind==='study' ? QZD.mindmap.buildStudyMap(state.studyDim) : QZD.mindmap.buildLogMap(state.logDim);
    var cur = kind==='study' ? state.studyDim : state.logDim;
    var title = kind==='study' ? '学 习 导 图' : '起 居 注 导 图';
    var sub = kind==='study' ? '速记 · 专注 · 课题 · 三事 · 奏折' : '游戏发展脉络 · 按主题/时间/国运';
    var empty = (!tree.children || !tree.children.length)
      ? '<div class="empty">还没有记录<span class="card-note">记录几笔后，导图会自动长出来</span></div>' : '';
    return '<section class="card">' +
      '<div class="card-head"><span class="card-title">'+title+'</span><span class="card-note">'+sub+'</span></div>' +
      modes(kind, cur) +
      '<p class="card-note">点方块展开/收起 · 悬停看原文 · 横向布局文字不重叠</p>' +
      (empty || '<div class="mm-wrap">'+svgGraph(tree)+'</div>') +
    '</section>';
  }

  UI.register('study-map', function(){ return page('study'); });
  UI.register('log-map', function(){ return page('log'); });

  /* 11-22 第三张图：自己填写的导图（可增删改） */
  function myPage(){
    activeKind = 'my';
    var tree = QZD.notemap.toTree();
    var empty = (!tree.children || !tree.children.length)
      ? '<div class="empty">导图还是空的<span class="card-note">点下面「＋加一个主题」开始，之后可在节点上加子分支</span></div>' : '';
    var nodeCount = QZD.notemap.nodes().length;
    return '<section class="card">' +
      '<div class="card-head"><span class="card-title">我 的 导 图</span>' +
        '<span class="card-note">自己填写 · ' + nodeCount + ' 个节点 · 无限层级</span></div>' +
      '<div class="mm-modes">' +
        '<button class="chip primary" data-mm-add="">＋ 加一个主题</button>' +
        (nodeCount ? '<button class="chip" data-mm-reset>清空导图</button>' : '') +
      '</div>' +
      '<p class="card-note">点节点：改文字 / 加子分支 / 移动 / 删除 · 点 ＋ − 展开收起</p>' +
      (empty || '<div class="mm-wrap">'+svgGraph(tree)+'</div>') +
    '</section>';
  }
  UI.register('my-map', myPage);

  /* 自定义导图节点编辑弹窗 */
  function openMyNode(id){
    var isNew = !id;
    var n = isNew ? null : QZD.notemap.find(id);
    if(!isNew && !n) return;
    var kids = isNew ? [] : QZD.notemap.childrenOf(id).map(function(c){ return c; });
    var allNodes = QZD.notemap.nodes().filter(function(x){ return !isNew && x.id !== id && kids.indexOf(x) < 0 && QZD.notemap.descendants(id).indexOf(x) < 0; });
    var parentOpts = '<option value="">（顶级主题）</option>' + allNodes.map(function(x){
      return '<option value="'+esc(x.id)+'"'+(n && n.parentId===x.id?' selected':'')+'>'+esc(x.text.slice(0,16))+'</option>';
    }).join('');
    var body = '<div class="field"><label for="mn-text">内容</label>' +
      '<input id="mn-text" maxlength="120" value="'+esc(n?n.text:'')+'" placeholder="比如：这周要解决的核心问题"></div>' +
      '<div class="field"><label for="mn-parent">上级节点</label><select id="mn-parent">'+parentOpts+'</select></div>' +
      (isNew ? '' : '<p class="card-note">下级节点 '+kids.length+' 个 · 修改上级会整支搬移，不能挂到自己的分支下。</p>');
    var foot = isNew ? '' : '<button class="chip danger" data-mm-del="'+esc(id)+'" style="float:left;margin-top:6px">删除此节点及子节点</button>';
    var modal = UI.modal({
      title: isNew ? '加一个节点' : '编辑节点',
      body: body + '<div style="clear:both"></div>' + foot,
      ok:true, okText: isNew?'添加':'保存',
      onOk: function(mask){
        var text = mask.querySelector('#mn-text').value;
        var parent = mask.querySelector('#mn-parent').value || '';
        var r;
        if(isNew) r = QZD.notemap.add(text, parent);
        else { r = QZD.notemap.edit(id, text); if(r.ok && n.parentId !== parent) r = QZD.notemap.move(id, parent); }
        if(!r.ok){ UI.toast(r.error); return false; }
        UI.toast(isNew?'已添加节点':'已保存'); UI.onStateChanged();
      }
    });
    var del = modal.root.querySelector('[data-mm-del]');
    if(del) del.onclick = function(){
      UI.confirm('删除这个节点及其所有子节点？', function(){
        modal.close();
        var r = QZD.notemap.remove(id);
        if(r.ok){ UI.toast('已删除 '+r.removed+' 个节点'); UI.onStateChanged(); }
      });
    };
  }

  document.addEventListener('click', function(e){
    if(activeKind==='my'){
      if(e.target.closest('[data-mm-add]')){ openMyNode(null); return; }
      if(e.target.closest('[data-mm-reset]')){
        UI.confirm('清空整张导图？所有节点都会删除，不可撤销。', function(){
          QZD.notemap.nodes().slice().forEach(function(n){ QZD.notemap.remove(n.id); });
          UI.toast('导图已清空'); UI.onStateChanged();
        });
        return;
      }
      var ng = e.target.closest ? e.target.closest('.mm-node') : null;
      if(ng){
        var nid = ng.getAttribute('data-id');
        if(nid && nid !== 'root'){
          var nn = QZD.notemap.find(nid);
          var hasKids = QZD.notemap.childrenOf(nid).length;
          /* 点 ± 号=折叠；点节点主体=编辑 */
          var isToggle = (e.target.tagName === 'text' || (e.target.textContent||'').match(/^[+−]$/));
          if(isToggle && hasKids){ QZD.notemap.toggleCollapse(nid); UI.onStateChanged(); }
          else openMyNode(nid);
        } else if(nid === 'root'){ openMyNode(null); }
        return;
      }
    }
    var b = e.target.closest ? e.target.closest('[data-mm-mode]') : null;
    if(b){
      var v = b.getAttribute('data-mm-mode').split('|');
      if(v[0]==='study') state.studyDim=v[1]; else state.logDim=v[1];
      state.collapsed={}; UI.renderPage(); return;
    }
    var g = e.target.closest ? e.target.closest('.mm-node') : null;
    if(g){
      var id = g.getAttribute('data-id');
      var tree = activeKind==='log' ? QZD.mindmap.buildLogMap(state.logDim) : QZD.mindmap.buildStudyMap(state.studyDim);
      function find(n){ if(n.id===id) return n; var r=null; (n.children||[]).forEach(function(c){ if(!r) r=find(c); }); return r; }
      var node = find(tree);
      if(node && node.children && node.children.length){ state.collapsed[id]=!state.collapsed[id]; UI.renderPage(); }
    }
  });
  var tipEl=null;
  document.addEventListener('mouseover', function(e){
    var g = e.target.closest ? e.target.closest('.mm-node') : null;
    if(!g) return;
    var id=g.getAttribute('data-id');
    var tree = activeKind==='log' ? QZD.mindmap.buildLogMap(state.logDim) : QZD.mindmap.buildStudyMap(state.studyDim);
    function find(n){ if(n.id===id) return n; var r=null; (n.children||[]).forEach(function(c){ if(!r) r=find(c); }); return r; }
    var node=find(tree);
    if(node && node.full){
      if(!tipEl){ tipEl=document.createElement('div'); tipEl.className='mm-tip'; document.body.appendChild(tipEl); }
      tipEl.textContent=node.full; tipEl.style.opacity=1;
    }
  });
  document.addEventListener('mouseout', function(e){
    var g=e.target.closest ? e.target.closest('.mm-node') : null;
    if(g && tipEl) tipEl.style.opacity=0;
  });
})();
