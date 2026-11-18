/* ============================================================
   ui/pages/thesis.js · 修书进度 2.0
   
   每本书 = 一棵可任意嵌套的章节树（复用大计谱系树逻辑）
   两个子 tab：🌳 谱系树 / 🔗 链路图
   ============================================================ */
(function(){
  var UI = QZD.ui;
  var ESC = function(t){ return UI.fmt.escape(t); };

  var depthColors = ['var(--daiqing)', 'var(--shi-qing)', 'var(--zhu-green)', 'var(--ou-he)'];

  function bar(pct, cls){
    return '<div class="mini-bar' + (cls ? ' ' + cls : '') + '"><i style="width:' +
      Math.max(0, Math.min(100, pct)) + '%"></i><span>' + Math.max(0, Math.min(100, pct)) + '%</span></div>';
  }

  /* ---------- 章节树节点（与大计 treeNode 同构）---------- */
  function secNode(tid, sid, depth){
    var s = QZD.thesis.findSection(tid, sid);
    if(!s) return '';
    var kids = QZD.thesis.childrenOf(tid, sid);
    var pct = QZD.thesis.sectionProgress(tid, sid);
    var color = depthColors[Math.min(depth, depthColors.length - 1)];

    /* 该章节关联的灵感（hatchedType='thesis', ref='tid|sid'）*/
    var secRef = tid + '|' + sid;
    var myIdeas = QZD.idea.list().filter(function(i){ return i.hatchedType === 'thesis' && i.hatchedRef === secRef; });
    var ideaChips = myIdeas.map(function(i){
      var display = i.tag || (i.text || '').slice(0, 10);
      return '<span class="chip sm idea-chip" style="margin:2px" data-idea-edit="' + ESC(i.id) + '" data-sec-idea-unlink="' + ESC(i.id) + '" title="点击查看灵感内容 · 点×取消关联">' +
        '🧠 ' + ESC(display) + '<b style="color:#A8573F;margin-left:4px;cursor:pointer;opacity:.5">×</b></span>';
    }).join('');
    /* 始终显示：让任何章节（包括叶子孙章节）都能加灵感 */
    var ideasBlock = '<div class="gt-chips" style="margin:2px 0">' +
        '<span style="font-size:10px;color:#8a7130;margin-right:2px">🧠</span>' +
        (ideaChips || '<span style="font-size:10px;color:#9a9790">（无）</span>') +
        '<button class="chip sm" style="margin-left:2px;font-size:10px;padding:1px 6px" data-sec-idea-add="' + ESC(secRef) + '">＋</button>' +
      '</div>';

    var isLeaf = kids.length === 0;
    var currentInput = isLeaf && s.target
      ? '<div class="sec-edit">' +
          '<input type="range" min="0" max="' + (s.target || 100) + '" step="1" ' +
            'value="' + (s.current || 0) + '" data-sec-current="' + tid + '|' + sid + '">' +
          '<input type="number" min="0" max="' + (s.target || 100) + '" step="1" ' +
            'value="' + (s.current || 0) + '" data-sec-current="' + tid + '|' + sid + '" ' +
            'style="width:50px;margin-left:6px" title="当前完成量">' +
          '<span class="sec-of">/ ' + (s.target || 0) + '</span>' +
        '</div>'
      : (isLeaf
          ? '<div class="sec-edit"><span class="sec-of">无目标，点「编辑」加</span></div>'
          : '<div class="sec-edit" style="color:#8a8574;font-size:11px">含 ' + kids.length + ' 个子章节</div>');

    var kidsHTML = kids.length ? kids.map(function(c){ return secNode(tid, c.id, depth + 1); }).join('') : '';

    return '<div class="gt-node-wrapper">' +
      '<div class="gt-node' + (kids.length ? ' gt-has-children' : '') + '">' +
        (depth > 0 ? '<span class="gt-vline"></span>' : '') +
        '<div class="gt-node-inner" style="border-left:3px solid ' + color + '">' +
          '<div class="gt-row">' +
            '<div class="gt-title" style="color:' + color + '">' +
              (kids.length ? '<span class="gt-toggle">▾</span>' : '<span class="gt-leaf">·</span>') +
              ESC(s.name) + (s.target ? ' <span style="font-size:10px;color:#8a8574;font-weight:400">(' + (s.current||0) + '/' + s.target + ')</span>' : '') +
            '</div>' +
            '<div class="gt-tools">' +
              '<button class="chip sm" data-sec-edit="' + tid + '|' + sid + '">编辑</button>' +
              '<button class="chip sm" data-sec-add="' + tid + '|' + sid + '">＋子</button>' +
              '<button class="chip sm danger" data-sec-del="' + tid + '|' + sid + '">删</button>' +
            '</div>' +
          '</div>' +
          bar(pct, pct >= 100 ? 'ok' : (isLeaf ? 'hot' : '')) +
          ideasBlock +
        '</div>' +
      '</div>' +
      kidsHTML +
    '</div>';
  }

  /* ---------- 一本书的完整树 ---------- */
  function thesisTree(t){
    var roots = QZD.thesis.rootsOf(t.id);
    var overall = QZD.thesis.progress(t);

    /* 关联灵感 chip 行 */
    var myIdeas = QZD.idea.list().filter(function(i){ return i.hatchedType === 'thesis' && i.hatchedRef === t.id; });
    var ideaChips = myIdeas.map(function(i){
      var display = i.tag || (i.text || '').slice(0, 10);
      return '<span class="chip sm idea-chip" style="margin:2px" data-idea-edit="' + ESC(i.id) + '" data-thesis-idea-unlink="' + ESC(i.id) + '" title="点击查看灵感内容 · 点×取消关联">' +
        '🧠 ' + ESC(display) + '<b style="color:#A8573F;margin-left:4px;cursor:pointer;opacity:.5">×</b></span>';
    }).join('');
    var ideasBlock = '<div class="gt-chips" style="margin:6px 0">' +
      '<span style="font-size:11px;color:#8a7130;margin-right:4px">🧠 灵感</span>' +
      (ideaChips || '<span style="font-size:11px;color:#9a9790">（未关联）</span>') +
      '<button class="chip sm" style="margin-left:4px" data-thesis-idea-add="' + ESC(t.id) + '">＋灵感</button>' +
    '</div>';

    var secsHTML = roots.length
      ? roots.map(function(r){ return secNode(t.id, r.id, 0); }).join('')
      : '<div class="card-note" style="margin:8px 0">尚无章节，先加根章节（如「引言」「方法」）</div>';

    var isDone = overall >= 100;
    var burnBtn = isDone
      ? '<button class="chip sm" data-thesis-burn="' + t.id + '">收书入档</button>'
      : '<button class="chip sm danger" data-thesis-del="' + t.id + '">焚书</button>';

    return '<div class="thesis-card" data-id="' + t.id + '">' +
      '<div class="thesis-head">' +
        '<div class="thesis-title">' + ESC(t.title) + '</div>' +
        '<div class="thesis-ops">' + burnBtn + '</div>' +
      '</div>' +
      bar(overall, isDone ? 'ok' : 'hot') +
      ideasBlock +
      '<div class="thesis-sections">' + secsHTML + '</div>' +
      '<div class="sec-add" style="margin-top:10px">' +
        '<span style="font-size:11px;color:#8a8574">＋根章节：</span>' +
        '<input class="sec-name-in" maxlength="40" placeholder="章节名" data-sec-name-root="' + t.id + '">' +
        '<input class="sec-target-in" type="number" min="0" step="1" placeholder="目标量(0=父)" data-sec-target-root="' + t.id + '">' +
        '<button class="btn ghost sm" data-sec-add-root="' + t.id + '">加</button>' +
      '</div>' +
    '</div>';
  }

  /* ---------- SVG 链路图 ---------- */
  function svgLink(list){
    var nodes = [];
    var edges = [];
    var ideaNodes = [];   /* 侧挂灵感：小圆点 + 完整文字，不进 BFS 列布局 */
    var ideaEdges = [];   /* 虚线边：从 thesis/sec 节点到灵感节点 */
    var nodeMap = {};

    list.forEach(function(t){
      var tnode = { id:'thesis:'+t.id, type:'thesis', label:t.title, size:30, color:'#363A32', _t:t };
      nodeMap['thesis:'+t.id] = tnode;
      nodes.push(tnode);
      QZD.thesis.rootsOf(t.id).forEach(function(r){
        addSec(t.id, r.id, 1);
        edges.push({ from:'thesis:'+t.id, to:'sec:'+t.id+':'+r.id, type:'spawn' });
      });

      /* 书级灵感（hatchedType='thesis', ref=t.id）*/
      var bookIdeas = QZD.idea.list().filter(function(i){ return i.hatchedType === 'thesis' && i.hatchedRef === t.id; });
      bookIdeas.forEach(function(it, idx){
        var ix = tnode.x !== undefined ? tnode.x : 0;  /* 先占位，BFS 后补 */
        ideaNodes.push({ id:'idea:thesis:'+t.id+':'+idx, type:'idea', label:'🧠 '+(it.tag||(it.text||'')).slice(0,14), size:4, color:'#A8842C', _ideaId:it.id, _ref:t.id, _parent:'thesis:'+t.id, _parentDepth:0, _order:idx });
      });
    });

    function addSec(tid, sid, depth){
      var s = QZD.thesis.findSection(tid, sid);
      if(!s) return;
      var nid = 'sec:'+tid+':'+sid;
      if(nodeMap[nid]) return;
      var isLeaf = QZD.thesis.childrenOf(tid, sid).length === 0;
      var color = isLeaf ? '#5E7A4A' : '#3E6B5C';
      var obj = { id:nid, type:'sec', label:s.name, size:(depth > 2 ? 12 : 18), color:color, _d:depth, _leaf:isLeaf };
      nodeMap[nid] = obj;
      nodes.push(obj);
      QZD.thesis.childrenOf(tid, sid).forEach(function(c){
        addSec(tid, c.id, depth + 1);
        edges.push({ from:nid, to:'sec:'+tid+':'+c.id, type:'parent' });
      });

      /* 章节级灵感（hatchedType='thesis', ref='tid|sid'）*/
      var secRef = tid + '|' + sid;
      var secIdeas = QZD.idea.list().filter(function(i){ return i.hatchedType === 'thesis' && i.hatchedRef === secRef; });
      secIdeas.forEach(function(it, idx){
        ideaNodes.push({ id:'idea:sec:'+tid+':'+sid+':'+idx, type:'idea', label:'🧠 '+(it.tag||(it.text||'')).slice(0,14), size:4, color:'#A8842C', _ideaId:it.id, _ref:secRef, _parent:nid, _parentDepth:depth, _order:idx });
      });
    }

    if(nodes.length === 0){
      return '<div class="lk-empty-box" style="padding:40px;text-align:center">' +
        '<div class="lk-empty-title" style="font-size:14px;color:#8a8574">尚无修书</div></div>';
    }

    /* BFS depth */
    var depth = {};
    nodes.forEach(function(n){ if(n.id.indexOf('thesis:') === 0) depth[n.id] = 0; else depth[n.id] = 99; });
    var changed = true;
    while(changed){
      changed = false;
      edges.forEach(function(e){
        if(depth[e.from] !== undefined && (depth[e.to] === undefined || depth[e.to] > depth[e.from] + 1)){
          depth[e.to] = depth[e.from] + 1; changed = true;
        }
      });
    }
    nodes.forEach(function(n){ n._d = depth[n.id] || 0; });

    /* 列布局 */
    var colX = [60, 260, 460, 660, 860, 1060];
    var cols = {};
    nodes.forEach(function(n){
      if(!cols[n._d]) cols[n._d] = [];
      cols[n._d].push(n);
    });
    var maxD = Math.max.apply(null, Object.keys(cols).map(function(k){ return +k; }));
    var W = colX[Math.min(maxD, colX.length - 1)] + 120;
    var Y_GAP = 70;
    Object.keys(cols).forEach(function(k){
      cols[+k].forEach(function(n, i){
        n.x = colX[Math.min(+k, colX.length - 1)];
        n.y = 60 + Y_GAP * i;
      });
    });
    var maxColH = Math.max.apply(null, Object.values(cols).map(function(c){ return c.length; }));
    var H = Math.max(200, 80 + maxColH * Y_GAP);

    /* ======= 侧挂灵感节点位置：从父节点右侧排起，围绕父节点 y 居中 ======= */
    /* 先按 parent 分组，统计每个节点有多少侧挂 */
    var ideaByParent = {};
    ideaNodes.forEach(function(ideanode){
      if(!ideaByParent[ideanode._parent]) ideaByParent[ideanode._parent] = [];
      ideaByParent[ideanode._parent].push(ideanode);
    });
    Object.keys(ideaByParent).forEach(function(pid){
      var pn = nodeMap[pid];
      if(!pn) return;
      var list = ideaByParent[pid];
      var rowH = 20;
      var total = list.length;
      var topOffset = total === 1 ? 0 : -((total - 1) * rowH) / 2;
      var parentSize = pn.size || 20;
      list.forEach(function(ideanode, idx){
        ideanode.x = pn.x + parentSize + 18;
        ideanode.y = pn.y + topOffset + (idx * rowH);
        ideaEdges.push({ from: pid, to: ideanode.id, type:'hatched' });
      });
    });

    /* SVG 尺寸扩展以容纳右侧灵感文字 */
    ideaNodes.forEach(function(ideanode){
      var needX = ideanode.x + 140;
      if(needX > W) W = needX;
    });
    ideaNodes.forEach(function(ideanode){
      var below = ideanode.y + 10;
      if(below > H) H = below + 20;
    });
    ideaNodes.forEach(function(ideanode){
      if(ideanode.y - 20 < 60) ideanode.y = 60 + Math.random() * 10;
    });

    /* 短距离直线：父节点到侧挂灵感 */
    function edgePathNear(a, b){
      if(!a || !b) return '';
      var dx = b.x - a.x, dy = b.y - a.y;
      var dist = Math.sqrt(dx*dx + dy*dy) || 1;
      var rA = a.size + 3;
      var sx = a.x + (dx/dist) * rA, sy = a.y + (dy/dist) * rA;
      /* 侧挂节点 size 很小（4），直接连到坐标，让渲染的小圆点盖住末端 */
      return 'M' + sx + ' ' + sy + ' L' + b.x + ' ' + b.y;
    }

    /* 边贝塞尔（结构边）*/
    function edgePath(a, b){
      if(!a || !b) return '';
      var dx = b.x - a.x, dy = b.y - a.y;
      var dist = Math.sqrt(dx*dx + dy*dy) || 1;
      var rA = a.size + 4, rB = b.size + 4;
      var sx = a.x + (dx/dist) * rA, sy = a.y + (dy/dist) * rA;
      var ex = b.x - (dx/dist) * rB, ey = b.y - (dy/dist) * rB;
      if(Math.abs(dy) < 4 && Math.abs(dx) < 10) return '';
      var midX = (sx + ex) / 2;
      return 'M' + sx + ' ' + sy + ' C' + midX + ' ' + sy + ', ' + midX + ' ' + ey + ', ' + ex + ' ' + ey;
    }

    var edgeColor = { spawn:'#DAD3C0', parent:'#3E6B5C', hatched:'#A8842C' };
    var edgeSVG = edges.map(function(e){
      var a = nodeMap[e.from], b = nodeMap[e.to];
      if(!a || !b) return '';
      return '<path class="lk-edge" d="' + edgePath(a, b) + '"' +
        ' stroke="' + edgeColor[e.type] + '"' +
        ' stroke-width="' + (e.type === 'parent' ? '2' : '1.2') + '" fill="none"' +
        ' stroke-opacity="' + (e.type === 'spawn' ? '0.3' : '0.7') + '"/>';
    }).join('');

    /* 灵感虚线边 */
    edgeSVG += ideaEdges.map(function(e){
      var a = nodeMap[e.from], b = nodeMap[e.to];
      if(!a || !b) return '';
      return '<path class="lk-edge lk-edge-dashed" d="' + edgePathNear(a, b) + '"' +
        ' stroke="' + edgeColor.hatched + '"' +
        ' stroke-width="1" fill="none" stroke-dasharray="3 3"' +
        ' stroke-opacity="0.55" stroke-linecap="round"/>';
    }).join('');

    /* 把 ideaNodes 也注册进 nodeMap，供 edgePathNear 查 */
    ideaNodes.forEach(function(ideanode){ nodeMap[ideanode.id] = ideanode; });

    /* 节点渲染 */
    function truncate(label, r, fontSize){
      var maxW = r * 1.7;
      var out = '';
      for(var i = 0; i < label.length; i++){
        var ch = label[i];
        var w = (/[\u4e00-\u9fff]/.test(ch) ? fontSize : fontSize * 0.55);
        if((out.length * fontSize * 0.8) + w > maxW) break;
        out += ch;
      }
      return out + (out.length < label.length ? '…' : '');
    }

    var nodeSVG = nodes.map(function(n){
      var fontSize = Math.max(8, Math.min(12, Math.round(n.size / 3)));
      var labelText = truncate(n.label, n.size, fontSize);
      return '<g class="lk-node" transform="translate(' + n.x + ',' + n.y + ')">' +
        '<circle r="' + n.size + '" fill="' + n.color + '"/>' +
        '<text text-anchor="middle" y="' + (fontSize / 3) + '" font-size="' + fontSize + '" font-weight="600" fill="#FFFFFF">' + ESC(labelText) + '</text>' +
      '</g>';
    }).join('');

    /* 灵感侧挂节点渲染：小圆点 + 完整文字 + data-idea-edit 可点击 */
    var ideaNodeSVG = ideaNodes.map(function(ideanode){
      var ideaId = ideanode._ideaId || '';
      return '<g class="lk-node lk-node-idea" transform="translate(' + ideanode.x + ',' + ideanode.y + ')"' +
        (ideaId ? ' data-idea-edit="' + ESC(ideaId) + '"' : '') +
        ' style="cursor:pointer" title="' + ESC(ideanode.label || '') + ' · 点击编辑灵感">' +
        '<circle cx="0" cy="0" r="4" fill="#A8842C" stroke="#8a7130" stroke-width="1"/>' +
        '<text x="10" y="3" font-size="11" font-weight="500" fill="#A8842C">' + ESC(ideanode.label || '') + '</text>' +
      '</g>';
    }).join('');

    var defs = '<defs><marker id="lk-arrow-thesis" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">' +
      '<path d="M 0 0 L 10 5 L 0 10 z" fill="#3E6B5C"/></marker></defs>';

    return '<svg viewBox="0 0 ' + W + ' ' + H + '" class="lk-svg lk-svg-tree">' +
      defs + edgeSVG + nodeSVG + ideaNodeSVG + '</svg>';
  }

  /* ---------- 主注册 ---------- */
  var _subTab = 'doing';  /* 谱系 / 链路 */
  var _statusTab = 'doing'; /* 在修 / 已成 / 收档 */

  UI.register('thesis', function(){
    var raw = QZD.thesis.list();
    var archived = QZD.thesis.archived();

    function isDone(t){ return QZD.thesis.progress(t) >= 100; }

    var doing = raw.filter(function(t){ return !isDone(t); });
    var done = raw.filter(isDone);

    var statusTabs = '<div class="tab-row" style="margin-bottom:10px">' +
      '<button class="tab' + (_statusTab === 'doing' ? ' active' : '') + '" data-th-status="doing">在修 · ' + doing.length + '</button>' +
      '<button class="tab' + (_statusTab === 'done' ? ' active' : '') + '" data-th-status="done">已成 · ' + done.length + '</button>' +
      '<button class="tab' + (_statusTab === 'archived' ? ' active' : '') + '" data-th-status="archived">收档 · ' + archived.length + '</button>' +
    '</div>';

    var subTabs = '<div class="tab-row" style="margin-bottom:14px">' +
      '<button class="tab' + (_subTab === 'tree' ? ' active' : '') + '" data-th-sub="tree">🌳 谱系树</button>' +
      '<button class="tab' + (_subTab === 'link' ? ' active' : '') + '" data-th-sub="link">🔗 链路图</button>' +
    '</div>';

    var list = _statusTab === 'archived' ? archived : (_statusTab === 'done' ? done : doing);

    var body;
    if(_statusTab === 'archived'){
      body = list.length
        ? list.map(function(t){
            return '<div class="thesis-card" style="opacity:.85">' +
              '<div class="thesis-head"><div class="thesis-title">' + ESC(t.title) + '</div>' +
              '<div class="thesis-ops"><button class="chip sm" data-thesis-restore="' + t.id + '">取出</button></div></div>' +
              bar(100, 'ok') + '</div>';
          }).join('')
        : '<div class="empty">书阁空空</div>';
    }else if(_subTab === 'link'){
      body = svgLink(list);
    }else{
      body = '' +
        (_statusTab === 'doing' ?
          '<section class="card"><div class="card-head"><span class="card-title">立 书</span>' +
          '<span class="card-note">章节支持任意嵌套（大章 → 节 → 小节 …）</span></div>' +
          '<div class="thesis-new">' +
            '<input id="thesis-title" maxlength="80" placeholder="书名 / 题目">' +
            '<button class="btn primary" data-thesis-add>立 书</button>' +
          '</div></section>' : '') +
        (list.length
          ? '<section class="card"><div class="card-head"><span class="card-title">' +
              (_statusTab === 'done' ? '已 成 之 书' : '在 修 之 书') +
              '</span><span class="card-note">' + list.length + ' 部</span></div>' +
            list.map(thesisTree).join('') + '</section>'
          : '<div class="empty">还没有书</div>');
    }

    return statusTabs + subTabs + body;
  });

  /* ---------- 事件委托 ---------- */
  document.addEventListener('click', function(e){
    var st = e.target.closest('[data-th-status]');
    if(st){ _statusTab = st.getAttribute('data-th-status'); UI.renderPage(); return; }
    var sb = e.target.closest('[data-th-sub]');
    if(sb){ _subTab = sb.getAttribute('data-th-sub'); UI.renderPage(); return; }

    if(e.target.closest('[data-thesis-add]')){
      var r = QZD.thesis.add(document.getElementById('thesis-title').value);
      if(!r.ok){ UI.toast(r.error); return; }
      UI.onStateChanged();
      return;
    }
    var delT = e.target.closest('[data-thesis-del]');
    if(delT){
      UI.confirm('确定焚毁该书及其全部章节？', function(){
        QZD.thesis.remove(delT.getAttribute('data-thesis-del'));
        UI.onStateChanged();
      });
      return;
    }
    var burnT = e.target.closest('[data-thesis-burn]');
    if(burnT){ QZD.thesis.archive(burnT.getAttribute('data-thesis-burn')); UI.toast('已收书入档'); UI.onStateChanged(); return; }
    var restoreT = e.target.closest('[data-thesis-restore]');
    if(restoreT){ QZD.thesis.restore(restoreT.getAttribute('data-thesis-restore')); UI.onStateChanged(); return; }

    /* 加根章节 */
    var addRoot = e.target.closest('[data-sec-add-root]');
    if(addRoot){
      var tid = addRoot.getAttribute('data-sec-add-root');
      var nameEl = document.querySelector('[data-sec-name-root="' + tid + '"]');
      var tgtEl = document.querySelector('[data-sec-target-root="' + tid + '"]');
      var r2 = QZD.thesis.addSection(tid, nameEl ? nameEl.value : '', tgtEl ? tgtEl.value : '', null);
      if(!r2.ok){ UI.toast(r2.error); return; }
      UI.onStateChanged();
      return;
    }

    /* 加子章节（data-sec-add = tid|sid）*/
    var addS = e.target.closest('[data-sec-add]');
    if(addS){
      var p = addS.getAttribute('data-sec-add').split('|');
      UI.modal({
        title: '新增子章节',
        body: '<div class="field"><label>章节名</label><input id="sc-name" maxlength="40"></div>' +
             '<div class="field"><label>目标量（0 = 父节点，不含叶子数值）</label><input id="sc-tgt" type="number" min="0" step="1"></div>',
        ok: true, okText: '添加',
        onOk: function(){
          var nm = document.getElementById('sc-name').value.trim();
          if(!nm){ UI.toast('请填写章节名'); return false; }
          QZD.thesis.addSection(p[0], nm, document.getElementById('sc-tgt').value, p[1]);
          UI.onStateChanged();
        }
      });
      return;
    }

    /* 删章节（递归删子树）*/
    var delS = e.target.closest('[data-sec-del]');
    if(delS){
      var parts = delS.getAttribute('data-sec-del').split('|');
      UI.confirm('删除该章节及其全部子章节？', function(){
        QZD.thesis.removeSection(parts[0], parts[1]);
        UI.onStateChanged();
      });
      return;
    }

    /* 编辑章节（name / target / current）*/
    var editS = e.target.closest('[data-sec-edit]');
    if(editS){
      var pe = editS.getAttribute('data-sec-edit').split('|');
      var sec = QZD.thesis.findSection(pe[0], pe[1]);
      if(!sec){ UI.toast('章节不存在'); return; }
      var hasKids = QZD.thesis.childrenOf(pe[0], pe[1]).length > 0;
      var curField = hasKids
        ? ''
        : '<div class="field"><label>当前完成量' + (sec.target ? '（最大 ' + sec.target + '）' : '') + '</label>' +
            '<input id="se-cur" type="number" min="0" step="1" value="' + (sec.current || 0) + '">' +
          '</div>';
      UI.modal({
        title: '编辑章节',
        body: '<div class="field"><label>章节名</label><input id="se-name" maxlength="40" value="' + ESC(sec.name) + '"></div>' +
             '<div class="field"><label>目标量（0 = 父节点，靠子章节聚合）</label><input id="se-tgt" type="number" min="0" step="1" value="' + (sec.target || 0) + '"></div>' +
             curField,
        ok: true, okText: '保存',
        onOk: function(){
          var nm = document.getElementById('se-name').value;
          var tgt = document.getElementById('se-tgt').value;
          var r = QZD.thesis.updateSection(pe[0], pe[1], { name: nm, target: tgt });
          if(!r.ok){ UI.toast(r.error); return false; }
          if(!hasKids){
            var cur = document.getElementById('se-cur').value;
            var r2 = QZD.thesis.setSection(pe[0], pe[1], cur);
            if(!r2.ok){ UI.toast(r2.error); return false; }
          }
          UI.onStateChanged();
          return true;
        }
      });
      return;
    }

    /* ＋灵感 —— 弹 modal 关联已有或快捷新建 */
    var ideaAdd = e.target.closest('[data-thesis-idea-add]');
    if(ideaAdd){
      var tid = ideaAdd.getAttribute('data-thesis-idea-add');
      var availIdeas = QZD.idea.list().filter(function(i){ return !i.hatchedType || !i.hatchedRef; });
      var modalBody =
        (availIdeas.length
          ? '<div class="field"><label>选择已有灵感</label>' +
            '<select id="ti-add-select" style="max-width:280px">' +
              '<option value="">—— 选一条关联 ——</option>' +
              availIdeas.map(function(i){ return '<option value="' + ESC(i.id) + '">[' + ESC(i.tag||'') + '] ' + ESC(i.text.slice(0,26)) + '</option>'; }).join('') +
            '</select></div>'
          : '<div style="font-size:11px;color:#8a8574;margin:6px 0">当前没有待孵化的灵感，直接新建吧</div>') +
        '<div style="margin-top:10px;display:flex;gap:4px">' +
          '<input id="ti-quick" placeholder="新建灵感并关联…" style="flex:1;padding:4px 8px;border:1px solid var(--line);border-radius:4px;font-size:12px">' +
          '<input id="ti-quick-tag" placeholder="标签" maxlength="10" style="width:70px;padding:4px 6px;border:1px solid var(--line);border-radius:4px;font-size:12px">' +
          '<button class="btn primary" style="padding:4px 10px;font-size:12px" data-ti-quick-add="' + ESC(tid) + '">＋</button>' +
        '</div>';
      UI.modal({ title: '关联灵感 · 修书', body: modalBody });
      /* 绑定 select change */
      setTimeout(function(){
        var sel = document.getElementById('ti-add-select');
        if(sel){
          sel.addEventListener('change', function(){
            if(sel.value){
              QZD.idea.link(sel.value, 'thesis', tid);
              UI.onStateChanged();
            }
          });
        }
      }, 20);
      return;
    }

    /* 灵感 chip × —— 取消关联（只有点 × 才拦截 return；点 chip 本身 fall through 给 data-idea-edit）*/
    var ideaUnlink = e.target.closest('[data-thesis-idea-unlink]');
    if(ideaUnlink){
      if(e.target.tagName === 'B' || e.target.matches('b')){
        QZD.idea.unlink(ideaUnlink.getAttribute('data-thesis-idea-unlink'));
        UI.onStateChanged();
        return;
      }
    }

    /* modal 里快捷新建灵感并关联 */
    var quickAdd = e.target.closest('[data-ti-quick-add]');
    if(quickAdd){
      var curTid = quickAdd.getAttribute('data-ti-quick-add');
      var qtext = (document.getElementById('ti-quick').value || '').trim();
      var qtag = (document.getElementById('ti-quick-tag').value || '').trim();
      if(!qtext){ UI.toast('写点什么'); return; }
      var r = QZD.idea.add(qtext, qtag);
      if(r.ok){ QZD.idea.link(r.id, 'thesis', curTid); }
      UI.onStateChanged();
      return;
    }

    /* 章节 ＋灵感 —— modal 关联已有或快捷新建 */
    var secIdeaAdd = e.target.closest('[data-sec-idea-add]');
    if(secIdeaAdd){
      var secRef = secIdeaAdd.getAttribute('data-sec-idea-add'); /* tid|sid */
      var availIdeas = QZD.idea.list().filter(function(i){ return !i.hatchedType || !i.hatchedRef; });
      var modalBody =
        (availIdeas.length
          ? '<div class="field"><label>选择已有灵感</label>' +
            '<select id="si-add-select" style="max-width:280px">' +
              '<option value="">—— 选一条关联 ——</option>' +
              availIdeas.map(function(i){ return '<option value="' + ESC(i.id) + '">[' + ESC(i.tag||'') + '] ' + ESC(i.text.slice(0,26)) + '</option>'; }).join('') +
            '</select></div>'
          : '<div style="font-size:11px;color:#8a8574;margin:6px 0">当前没有待孵化的灵感，直接新建吧</div>') +
        '<div style="margin-top:10px;display:flex;gap:4px">' +
          '<input id="si-quick" placeholder="新建灵感并关联到该章节…" style="flex:1;padding:4px 8px;border:1px solid var(--line);border-radius:4px;font-size:12px">' +
          '<input id="si-quick-tag" placeholder="标签" maxlength="10" style="width:70px;padding:4px 6px;border:1px solid var(--line);border-radius:4px;font-size:12px">' +
          '<button class="btn primary" style="padding:4px 10px;font-size:12px" data-si-quick-add="' + ESC(secRef) + '">＋</button>' +
        '</div>';
      UI.modal({ title: '关联灵感 · 章节', body: modalBody });
      setTimeout(function(){
        var sel = document.getElementById('si-add-select');
        if(sel){
          sel.addEventListener('change', function(){
            if(sel.value){
              QZD.idea.link(sel.value, 'thesis', secRef);
              UI.onStateChanged();
            }
          });
        }
      }, 20);
      return;
    }

    /* 章节 chip × —— 取消关联（只有点 × 才拦截 return；点 chip 本身 fall through 给 data-idea-edit）*/
    var secIdeaUnlink = e.target.closest('[data-sec-idea-unlink]');
    if(secIdeaUnlink){
      if(e.target.tagName === 'B' || e.target.matches('b')){
        QZD.idea.unlink(secIdeaUnlink.getAttribute('data-sec-idea-unlink'));
        UI.onStateChanged();
        return;
      }
    }

    /* modal 里快捷新建灵感并关联到章节 */
    var secQuickAdd = e.target.closest('[data-si-quick-add]');
    if(secQuickAdd){
      var secRef2 = secQuickAdd.getAttribute('data-si-quick-add');
      var sqtext = (document.getElementById('si-quick').value || '').trim();
      var sqtag = (document.getElementById('si-quick-tag').value || '').trim();
      if(!sqtext){ UI.toast('写点什么'); return; }
      var r2 = QZD.idea.add(sqtext, sqtag);
      if(r2.ok){ QZD.idea.link(r2.id, 'thesis', secRef2); }
      UI.onStateChanged();
      return;
    }

    /* 更章节数值（叶子 only）*/
    var upS = e.target.closest('[data-sec-current]');
    if(upS){
      var p2 = upS.getAttribute('data-sec-current').split('|');
      /* 这个是 input 元素本身，change 事件处理更合适 */
      return;
    }
  });

  /* input change —— 章节 current 更新（range 松开 / number 回车） */
  document.addEventListener('change', function(e){
    if(e.target && e.target.matches && e.target.matches('[data-sec-current]')){
      var p = e.target.getAttribute('data-sec-current').split('|');
      var r = QZD.thesis.setSection(p[0], p[1], e.target.value);
      if(!r.ok){ UI.toast(r.error); return; }
      /* 同步另一个兄弟 input（range ↔ number） */
      var bro = e.target.parentElement && e.target.parentElement.querySelector(
        e.target.type === 'range' ? 'input[type=number]' : 'input[type=range]');
      if(bro && bro !== e.target) bro.value = e.target.value;
      UI.onStateChanged();
    }
  });
  /* range input —— 拖动时实时更新（只改兄弟 number，不 save） */
  document.addEventListener('input', function(e){
    if(e.target && e.target.type === 'range' && e.target.matches && e.target.matches('[data-sec-current]')){
      var bro = e.target.parentElement && e.target.parentElement.querySelector('input[type=number]');
      if(bro) bro.value = e.target.value;
    }
  });

  /* Enter 立书 */
  document.addEventListener('keydown', function(e){
    if(e.key === 'Enter' && e.target && e.target.id === 'thesis-title'){
      e.preventDefault();
      var b = document.querySelector('[data-thesis-add]');
      if(b) b.click();
    }
  });
})();
