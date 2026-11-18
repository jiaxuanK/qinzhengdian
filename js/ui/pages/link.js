/* ============================================================
   ui/pages/link.js · 三元链可视化
   
   双模式：
     全景 —— 每个分支（顶级灵感/大计/孤立课题）并排垂直列
     聚焦 —— 点某节点后只显示它的祖先链 + 后代树
   ============================================================ */
(function(){
  var UI = QZD.ui;
  var ESC = function(t){ return UI.fmt.escape(t); };

  var NODE_COLOR = {
    root:    '#363A32',
    idea:    '#A8842C',   /* 藤黄 */
    goal:    '#3E6B5C',   /* 黛青 */
    subject: '#2F6B78',   /* 石青 */
    thesis:  '#7C6B94',   /* 紫 */
    meeting: '#5E7A4A'    /* 竹绿 */
  };
  var NODE_LABEL = { idea: '灵感', goal: '大计', subject: '课题', thesis: '论文', meeting: '议题' };

  var EDGE_COLOR = {
    spawn:      '#DAD3C0',
    hatched_to: '#3E6B5C',
    binds:      '#2F6B78',
    parent:     '#A8842C'
  };
  var EDGE_LABEL = { spawn: '分支', hatched_to: '孵化', binds: '绑定', parent: '父子' };

  function statRow(s){
    return '<div class="realm-stats">' +
      '<div class="realm-stat"><span>节点</span><b>' + s.totalNodes + '</b></div>' +
      '<div class="realm-stat"><span>灵感</span><b>' + s.ideas + '</b></div>' +
      '<div class="realm-stat"><span>大计</span><b>' + s.goals + '</b></div>' +
      '<div class="realm-stat"><span>课题</span><b>' + s.subjects + '</b></div>' +
      '<div class="realm-stat hot"><span>已孵化</span><b>' + s.hatchedIdeas + '</b></div>' +
      '<div class="realm-stat"><span>绑定大计</span><b>' + s.boundGoals + '</b></div>' +
      '<div class="realm-stat" style="color:#5E7A4A"><span>专注</span><b>' + s.focusMinutes + '</b>min</div>' +
    '</div>';
  }

  function truncate(str, n){
    if(!str) return '';
    str = String(str);
    return str.length > n ? str.slice(0, n) + '…' : str;
  }

  /* 边路径 */
  function edgePath(a, b){
    if(!a || !b) return '';
    var dx = b.x - a.x, dy = b.y - a.y;
    var dist = Math.sqrt(dx*dx + dy*dy) || 1;
    var rA = (a.size || 20) + 5, rB = (b.size || 20) + 5;
    var sx = a.x + (dx/dist) * rA, sy = a.y + (dy/dist) * rA;
    var ex = b.x - (dx/dist) * rB, ey = b.y - (dy/dist) * rB;
    /* 直线优先（同列/近），远时微贝塞尔 */
    if(Math.abs(dx) < 25){
      return 'M' + sx + ' ' + sy + ' L' + ex + ' ' + ey;
    }
    var midY = (sy + ey) / 2;
    return 'M' + sx + ' ' + sy + ' C' + sx + ' ' + midY + ', ' + ex + ' ' + midY + ', ' + ex + ' ' + ey;
  }

  /* 渲染 SVG（统一入口，根据 graph._mode 自动选风格）*/
  function svgGraph(graph){
    var nodes = graph.nodes;
    var edges = graph.edges;
    var W = graph._totalW || 1100;
    var H = graph._totalH || 800;
    var nodeMap = {};
    nodes.forEach(function(n){ nodeMap[n.id] = n; });
    var isFocus = graph._mode === 'focus';

    /* 边 */
    var edgeSVG = edges.map(function(e, i){
      var a = nodeMap[e.from], b = nodeMap[e.to];
      var color = EDGE_COLOR[e.type] || '#bbb';
      var opacity = e.type === 'spawn' ? 0.45 : 0.8;
      var strokeW = e.type === 'spawn' ? 1 : 1.8;
      /* 聚焦模式：被 hidden 节点涉及的边也隐藏 */
      if(isFocus && (a && a._hidden) && (b && b._hidden)) return '';
      return '<path class="lk-edge lk-edge-' + e.type + '" data-edge="' + i + '"' +
        ' data-from="' + ESC(e.from) + '" data-to="' + ESC(e.to) + '" data-type="' + ESC(e.type) + '"' +
        ' d="' + edgePath(a, b) + '"' +
        ' stroke="' + color + '" stroke-width="' + strokeW + '" fill="none"' +
        ' marker-end="url(#lk-arrow-' + e.type + ')"' +
        ' stroke-opacity="' + opacity + '" />';
    }).join('');

    /* 节点 */
    var nodeSVG = nodes.map(function(n){
      var isRoot = n.type === 'root';
      var color = NODE_COLOR[n.type] || '#888';
      var label = isRoot ? '勤政殿' : truncate(n.label || n.id, 13);
      var size = n.size || 20;
      var hidden = isFocus && n._hidden;
      var isFocusNode = graph._focusId === n.id;

      var textX = size + 10;
      var textAnchor = 'start';

      return '<g class="lk-node lk-node-' + n.type + (hidden ? ' lk-hidden' : '') +
        (isFocusNode ? ' lk-focus-node' : '') + '"' +
        ' data-node="' + ESC(n.id) + '" data-type="' + ESC(n.type) + '"' +
        ' transform="translate(' + n.x + ',' + n.y + ')">' +
        '<circle class="lk-ring" r="' + (size + 5) + '" fill="none" stroke="' + color + '" stroke-opacity="' + (isRoot ? '0.5' : '0.2') + '" stroke-width="' + (isRoot || isFocusNode ? '3' : '2') + '"/>' +
        '<circle class="lk-main" r="' + size + '" fill="' + color + '"' +
          (isRoot ? ' stroke="#fff" stroke-width="3" stroke-opacity="0.5"' : '') +
          (isFocusNode ? ' stroke="#FF6B35" stroke-width="3" stroke-opacity="0.8"' : '') + '/>' +
        '<circle r="' + (size * 0.55) + '" fill="none" stroke="#fff" stroke-opacity="0.25" stroke-width="1"/>' +
        '<text class="lk-text" x="' + textX + '" text-anchor="' + textAnchor + '"' +
          ' font-size="' + (isRoot ? '15' : '11') + '" font-weight="' + (isRoot || isFocusNode ? '700' : '500') + '"' +
          ' y="4" fill="#363A32">' + ESC(label) + '</text>' +
        (!isRoot ?
          '<text class="lk-type-tag" x="' + textX + '" text-anchor="' + textAnchor + '"' +
            ' font-size="9" y="17" fill="' + color + '" fill-opacity="0.7">' + NODE_LABEL[n.type] + '</text>'
        : '') +
      '</g>';
    }).join('');

    /* 箭头 + 定义 */
    var defs = '<defs>' +
      Object.keys(EDGE_COLOR).map(function(t){
        return '<marker id="lk-arrow-' + t + '" viewBox="0 0 10 10" refX="9" refY="5"' +
          ' markerWidth="' + (t === 'spawn' ? '5' : '7') + '" markerHeight="' + (t === 'spawn' ? '5' : '7') + '" orient="auto-start-reverse">' +
          '<path d="M 0 0 L 10 5 L 0 10 z" fill="' + EDGE_COLOR[t] + '"' + (t === 'spawn' ? ' fill-opacity="0.5"' : '') + '/></marker>';
      }).join('') +
    '</defs>';

    return '<svg viewBox="0 0 ' + W + ' ' + H + '" class="lk-svg lk-svg-tree" preserveAspectRatio="xMidYMin meet">' +
      defs + edgeSVG + nodeSVG + '</svg>';
  }

  /* 面包屑（聚焦模式）*/
  function breadcrumb(graph){
    if(graph._mode !== 'focus') return '';
    var ancestors = QZD.link.helpers.ancestorsOf(graph, graph._focusId);
    var crumbs = ancestors.map(function(n, i){
      var isLast = i === ancestors.length - 1;
      return '<span class="lk-crumb' + (isLast ? ' lk-crumb-last' : '') + '"' +
        (isLast ? '' : ' data-lk-focus="' + ESC(n.id) + '"') + '>' +
        (i > 0 ? ' › ' : '') + ESC(truncate(n.label || n.id, 12)) + '</span>';
    }).join('');
    return '<div class="lk-breadcrumb">' +
      '<button class="btn" data-lk-panorama="1" style="padding:4px 10px;font-size:12px">↺ 全景</button>' +
      crumbs +
    '</div>';
  }

  UI.register('link', function(){
    var graph;
    try {
      graph = QZD.link.build();
      QZD.link.layout(graph, { width: 1100, height: 800 });
    } catch(e) {
      console.warn('[link] build/layout 失败:', e);
      graph = { nodes: [], edges: [], stats: { totalNodes:0, totalEdges:0, ideas:0, goals:0, subjects:0, hatchedIdeas:0, boundGoals:0, focusMinutes:0 }, _mode: 'panorama' };
    }

    var s = graph.stats;
    var svg = svgGraph(graph);
    var modeBadge = graph._mode === 'focus'
      ? '<span class="lk-mode-badge lk-mode-focus">🔍 聚焦模式</span>'
      : '<span class="lk-mode-badge lk-mode-panorama">🗺 全景模式</span>';

    var emptyOverlay = (graph.nodes.length <= 1)
      ? '<div class="lk-empty-overlay"><div class="lk-empty-box">' +
        '<div class="lk-empty-title">图谱尚空</div>' +
        '<div class="lk-empty-sub">灵感孵化大计 → 大计绑定课题 → 链路自动生成</div>' +
        '<div class="lk-empty-btns">' +
          '<button class="btn" data-lk-goto="idea">🧠 灵感罐</button>' +
          '<button class="btn" data-lk-goto="goals">🎯 大计</button>' +
        '</div></div></div>'
      : '';

    /* 图例 */
    var legend = '<div class="lk-legend">' +
      Object.keys(NODE_COLOR).filter(function(t){ return t !== 'root'; }).map(function(t){
        return '<div class="lk-lg-item"><i style="background:' + NODE_COLOR[t] + '"></i> ' + NODE_LABEL[t] + '</div>';
      }).join('') +
      '<span class="lk-lg-sep"></span>' +
      Object.keys(EDGE_COLOR).map(function(t){
        return '<div class="lk-lg-item lk-lg-edge"><i style="border-color:' + EDGE_COLOR[t] + '"></i> ' + EDGE_LABEL[t] + '</div>';
      }).join('') +
    '</div>';

    return '' +
      '<section class="card">' +
        '<div class="card-head"><span class="card-title">三 元 链 · 灵感 → 大计 → 课题</span>' + modeBadge + '</div>' +
        statRow(s) +
      '</section>' +
      '<section class="card">' +
        '<div class="card-head">' + breadcrumb(graph) + legend + '</div>' +
        '<div class="lk-graph-wrap">' + svg + emptyOverlay + '</div>' +
        '<div class="lk-hint">💡 点击任意节点 → 放大查看该链路 · 祖先 + 后代 · 其他隐藏</div>' +
      '</section>';
  });

  /* 详情弹层 */
  function openNodeDetail(nodeId){
    var graph = QZD.link.build();
    QZD.link.layout(graph, {});
    var nodeMap = {};
    graph.nodes.forEach(function(n){ nodeMap[n.id] = n; });
    var node = nodeMap[nodeId];
    if(!node) return;

    var color = NODE_COLOR[node.type] || '#888';
    var meta = node.meta || {};

    var connected = graph.edges.filter(function(e){ return e.from === nodeId || e.to === nodeId; });
    var neighbors = connected.map(function(e){
      var other = e.from === nodeId ? e.to : e.from;
      var dir = e.from === nodeId ? '→' : '←';
      var n2 = nodeMap[other];
      return n2 ? '<a href="javascript:void(0)" data-lk-jump="' + ESC(other) + '" style="color:' + (NODE_COLOR[n2.type] || '#888') + '">' +
        dir + ' ' + ESC(n2.label || other) + '</a>' : '';
    }).filter(Boolean).join('<br>');

    var body = '<div style="border-left:3px solid ' + color + ';padding-left:12px">' +
      '<div style="font-size:15px;font-weight:700;color:' + color + ';margin-bottom:4px">' + ESC(node.label || node.id) + '</div>' +
      '<div style="font-size:11px;color:#9a9790;margin-bottom:12px">' + NODE_LABEL[node.type] + '</div></div>';

    if(node.type === 'idea'){
      body += '<div class="field"><label>标签</label><div>' + ESC((meta.idea || {}).tag || '无') + '</div></div>' +
        '<div class="field"><label>状态</label><div>' + (meta.hatched ? '✅ 已孵化 → ' + ESC(meta.hatchedType || '') : '🧪 待孵化') + '</div></div>' +
        '<div class="field"><label>孵化目标</label><div>' + ESC(meta.hatchedRef || '—') + '</div></div>';
    } else if(node.type === 'goal'){
      var goal = meta.goal || {};
      body += '<div class="field"><label>进度</label><div>' + Math.round(meta.progress || 0) + '%</div></div>' +
        '<div class="field"><label>剩余天数</label><div>' +
          (meta.daysLeft === null ? '无 deadline' :
           meta.daysLeft < 0 ? '逾期 ' + (-meta.daysLeft) + ' 天' :
           meta.daysLeft === 0 ? '今天到期' : '剩 ' + meta.daysLeft + ' 天') + '</div></div>' +
        '<div class="field"><label>父大计</label><div>' + ESC(goal.parentId || '顶级大计') + '</div></div>' +
        '<div class="field"><label>绑定课题</label><div>' + (goal.subjectIds && goal.subjectIds.length ? goal.subjectIds.length + ' 个' : '无') + '</div></div>';
    } else if(node.type === 'subject'){
      body += '<div class="field"><label>专注累计</label><div style="color:#5E7A4A">' + (meta.minutes || 0) + ' min</div></div>';
    }

    body += '<div class="field" style="margin-top:14px"><label>链路</label><div>' + neighbors + '</div></div>';

    body += '<div style="margin-top:16px;display:flex;gap:8px">' +
      '<button class="btn" data-lk-focus-btn="' + ESC(node.id) + '">🔍 聚焦此节点</button>' +
    '</div>';

    UI.modal({ title: NODE_LABEL[node.type] + ' · 详情', body: body, ok: false });
  }

  /* 事件委托（不再依赖 setupInteractions，统一走 click 委托）*/
  document.addEventListener('click', function(e){
    /* 节点点击 → 聚焦 */
    var nodeEl = e.target.closest('[data-lk-node]') || e.target.closest('.lk-node');
    if(nodeEl && nodeEl.getAttribute && nodeEl.getAttribute('data-node')){
      var id = nodeEl.getAttribute('data-node');
      /* Shift+点击：详情弹层；普通点击：聚焦 */
      if(e.shiftKey){
        openNodeDetail(id);
      } else {
        QZD.state._lkFocusId = id;
        UI.show('link');
      }
      return;
    }
    /* 详情弹层里的聚焦按钮 */
    var fbtn = e.target.closest('[data-lk-focus-btn]');
    if(fbtn){
      var fid = fbtn.getAttribute('data-lk-focus-btn');
      UI.modal({ title: '', body: '', ok: false });
      QZD.state._lkFocusId = fid;
      UI.show('link');
      return;
    }
    /* 面包屑跳转 */
    var crumb = e.target.closest('[data-lk-focus]');
    if(crumb){
      QZD.state._lkFocusId = crumb.getAttribute('data-lk-focus');
      UI.show('link');
      return;
    }
    /* 返回全景 */
    var pano = e.target.closest('[data-lk-panorama]');
    if(pano){
      QZD.state._lkFocusId = null;
      UI.show('link');
      return;
    }
    /* 详情内跳转 */
    var jump = e.target.closest('[data-lk-jump]');
    if(jump){
      var jid = jump.getAttribute('data-lk-jump');
      UI.modal({ title: '', body: '', ok: false });
      openNodeDetail(jid);
      return;
    }
    /* 空态跳转 */
    var goto = e.target.closest('[data-lk-goto]');
    if(goto){ UI.show(goto.getAttribute('data-lk-goto')); return; }
  });

  /* 让 UI.show('link') 传 focusId 给 layout */
  var _origShow = UI.show;
  UI.show = function(name){
    if(name === 'link'){
      /* 读取 QZD.state._lkFocusId，渲染时 layout 会用到 */
    }
    _origShow.apply(this, arguments);
  };

  /* 在 UI.register 的 renderFn 里读取 _lkFocusId —— 用 MutationObserver 或更简单：
     直接改 UI.renderPage，让它在渲染 link 页面后 setupInteractions（hover） */
  var _origRender = UI.renderPage;
  UI.renderPage = function(){
    _origRender();
    if(UI.current && UI.current() === 'link'){
      /* 重绘 focus mode：读取 _lkFocusId 重新 layout + SVG */
      var focusId = QZD.state._lkFocusId || null;
      setTimeout(function(){
        var graph = QZD.link.build();
        QZD.link.layout(graph, { focusId: focusId, width: 1100, height: 800 });
        var newSvg = svgGraph(graph);
        var wrap = document.querySelector('.lk-graph-wrap');
        if(wrap){
          var empty = wrap.querySelector('.lk-empty-overlay');
          wrap.innerHTML = newSvg;
          if(empty) wrap.appendChild(empty);
          /* 更新面包屑 */
          var header = document.querySelector('.card-head .lk-breadcrumb');
          if(header) header.remove();
          var newCrumb = '<div class="lk-breadcrumb">' +
            '<button class="btn" data-lk-panorama="1" style="padding:4px 10px;font-size:12px;margin-right:8px">↺ 全景</button>' +
            (focusId ? QZD.link.helpers.ancestorsOf(graph, focusId).map(function(n, i){
              return '<span class="lk-crumb' + (i === QZD.link.helpers.ancestorsOf(graph, focusId).length - 1 ? ' lk-crumb-last' : '') + '"' +
                (i === QZD.link.helpers.ancestorsOf(graph, focusId).length - 1 ? '' : ' data-lk-focus="' + n.id + '"') + '>' +
                (i > 0 ? ' › ' : '') + n.label + '</span>';
            }).join('') : '') +
          '</div>';
          var cardHead = document.querySelector('.card-head');
          if(cardHead && graph._mode === 'focus') cardHead.insertAdjacentHTML('afterbegin', newCrumb);
          setupSvgHover();
        }
      }, 20);
    }
  };

  /* 简化的 hover 高亮（不用 click 交互，click 统一事件委托）*/
  function setupSvgHover(){
    var svg = document.querySelector('.lk-svg');
    if(!svg) return;
    var nodeEls = svg.querySelectorAll('.lk-node:not(.lk-hidden)');
    nodeEls.forEach(function(el){
      el.style.cursor = 'pointer';
      el.addEventListener('mouseenter', function(){
        nodeEls.forEach(function(n){ n.style.opacity = '0.3'; });
        el.style.opacity = '1';
      });
      el.addEventListener('mouseleave', function(){
        nodeEls.forEach(function(n){ n.style.opacity = ''; });
      });
    });
  }
})();
