/* ============================================================
   systems/link.js · 三元链（灵感 → 大计 → 课题）
   
   双模式：
     全景 —— 按分支并排展示（灵感分支 / 大计分支 / 孤立课题）
     聚焦 —— 点某节点后只显示它的祖先链 + 全部后代
   
   树结构：
     Root → 灵感 [spawn]  → 孵化目标 [hatched_to]
     Root → 顶级大计 [spawn] → 子大计 [parent]
     大计 → 课题 [binds]
   ============================================================ */
(function(){

  /* ---------- 构建图：nodes + edges ---------- */
  function buildGraph(){
    var nodes = [];
    var edges = [];
    var nodeIds = {};

    function addNode(n){
      if(nodeIds[n.id]) return nodeIds[n.id];
      nodeIds[n.id] = n;
      nodes.push(n);
      return n;
    }
    function addEdge(from, to, type){
      if(!from || !to) return;
      edges.push({ from: from, to: to, type: type });
    }

    addNode({ id: 'root', type: 'root', label: '勤政殿', size: 44, meta: {} });

    /* 1. 灵感 → 全部是 root 的直接子（深度 1）*/
    var allIdeas = (QZD.idea && QZD.idea.list) ? QZD.idea.list() : [];
    allIdeas.forEach(function(it){
      addNode({
        id: 'idea:' + it.id,
        type: 'idea',
        label: it.tag ? '[' + it.tag + '] ' + it.text.slice(0, 14) : it.text.slice(0, 14),
        size: it.hatched ? 26 : 22,
        meta: { hatched: it.hatched, hatchedType: it.hatchedType, hatchedRef: it.hatchedRef, idea: it }
      });
      addEdge('root', 'idea:' + it.id, 'spawn');

      /* 关联/孵化 → hatched_to 边
         hatchedType 只要存在就画（不管 hatched=true/false）
         hatched=true 表示真正孵化成大计/课题
         hatched=false 表示只是关联（灵感还是灵感）*/
      if(it.hatchedType && it.hatchedRef){
        var tid = null;
        if(it.hatchedType === 'subject')  tid = 'subject:' + it.hatchedRef;
        else if(it.hatchedType === 'goal') tid = 'goal:' + it.hatchedRef;
        else if(it.hatchedType === 'thesis') tid = 'thesis:' + it.hatchedRef;
        else if(it.hatchedType === 'meeting') tid = 'meeting:' + it.hatchedRef;
        if(tid){
          addNode({ id: tid, type: it.hatchedType, label: (it.hatchedRef && it.hatchedRef.slice ? it.hatchedRef.slice(0,14) : String(it.hatchedRef).slice(0,14)), size: 24, meta: {} });
          addEdge('idea:' + it.id, tid, 'hatched_to');
        }
      }
    });

    /* 2. 大计 + 父子 + 绑定课题 */
    if(QZD.goals && QZD.goals.list){
      var goalList = QZD.goals.list();
      goalList.forEach(function(g){
        addNode({
          id: 'goal:' + g.id,
          type: 'goal',
          label: g.title.slice(0, 14),
          size: 30,
          meta: { progress: QZD.goals.effective(g), daysLeft: QZD.goals.daysLeft(g), goal: g }
        });
      });
      goalList.forEach(function(g){
        if(g.parentId && g.parentId !== g.id){
          /* 子大计 → 父大计 */
          addEdge('goal:' + g.parentId, 'goal:' + g.id, 'parent');
        } else {
          /* 顶级大计 → root（只在没被 hatched_to 连进来时）*/
          var hatchedToThis = edges.some(function(e){ return e.to === 'goal:' + g.id && e.type === 'hatched_to'; });
          if(!hatchedToThis) addEdge('root', 'goal:' + g.id, 'spawn');
        }
        /* 绑定课题 */
        if(g.subjectIds && g.subjectIds.length){
          g.subjectIds.forEach(function(sid){
            addEdge('goal:' + g.id, 'subject:' + sid, 'binds');
          });
        }
      });
    }

    /* 3. 课题 */
    /* 先收集被哪些大计绑定了 → 这些节点由 goal 添加，不加 spawn */
    var boundSubjectIds = {};
    goalList.forEach(function(g){
      if(g.subjectIds && g.subjectIds.length) g.subjectIds.forEach(function(s){ boundSubjectIds[s] = true; });
    });
    if(QZD.study && QZD.study.subjects){
      var studyState = QZD.state.study || {};
      QZD.study.subjects().forEach(function(s){
        var mins = (studyState.subjectStats && studyState.subjectStats[s.id]) || 0;
        var existing = nodeIds['subject:' + s.id];
        if(existing){
          existing.label = s.name.slice(0, 14);
          existing.meta.minutes = mins;
          existing.size = Math.max(22, Math.min(38, 22 + Math.log2(Math.max(1, mins/10)) * 3));
        } else {
          addNode({
            id: 'subject:' + s.id,
            type: 'subject',
            label: s.name.slice(0, 14),
            size: Math.max(22, Math.min(38, 22 + Math.log2(Math.max(1, mins/10)) * 3)),
            meta: { minutes: mins, subject: s }
          });
          /* 只有**没被任何大计绑定**的课题才从 root 派生（孤立节点）
             被绑的课题由 binds 边连到大计，属于大计分支 */
          if(!boundSubjectIds[s.id]) addEdge('root', 'subject:' + s.id, 'spawn');
        }
      });
    }

    /* 4. 论文 / 议题 → root 派生 */
    if(QZD.thesis && QZD.thesis.list){
      QZD.thesis.list().forEach(function(th){
        var tid = 'thesis:' + (th.id || th.title || String(th));
        addNode({ id: tid, type: 'thesis', label: (th.title || '论文').slice(0, 14), size: 22, meta: { thesis: th } });
        addEdge('root', tid, 'spawn');
      });
    }
    if(QZD.meetings && QZD.meetings.list){
      QZD.meetings.list().forEach(function(m){
        var mid = 'meeting:' + m.id;
        addNode({ id: mid, type: 'meeting', label: (m.title || '议题').slice(0, 14), size: 22, meta: { meeting: m } });
        addEdge('root', mid, 'spawn');
      });
    }

    /* 统计 */
    var stats = {
      totalNodes: nodes.length,
      totalEdges: edges.length,
      ideas: nodes.filter(function(n){ return n.type === 'idea'; }).length,
      goals: nodes.filter(function(n){ return n.type === 'goal'; }).length,
      subjects: nodes.filter(function(n){ return n.type === 'subject'; }).length,
      hatchedIdeas: nodes.filter(function(n){ return n.type === 'idea' && n.meta && n.meta.hatched; }).length,
      boundGoals: nodes.filter(function(n){ return n.type === 'goal' && n.meta && n.meta.goal && n.meta.goal.subjectIds && n.meta.goal.subjectIds.length; }).length,
      focusMinutes: nodes.reduce(function(s, n){ return s + ((n.meta && n.meta.minutes) || 0); }, 0)
    };

    return { nodes: nodes, edges: edges, stats: stats };
  }

  /* ---------- 树辅助函数 ---------- */

  /* 建父子索引（从 edges） */
  function buildIndex(graph){
    var nodeMap = {};
    var children = {};   /* id → [{node, edge}] */
    var parents = {};    /* id → [{node, edge}]（可能多个父）*/
    graph.nodes.forEach(function(n){
      nodeMap[n.id] = n;
      children[n.id] = [];
      parents[n.id] = [];
    });
    graph.edges.forEach(function(e){
      if(!nodeMap[e.from] || !nodeMap[e.to]) return;
      children[e.from].push({ node: nodeMap[e.to], edge: e });
      parents[e.to].push({ node: nodeMap[e.from], edge: e });
    });
    return { nodeMap: nodeMap, children: children, parents: parents };
  }

  /* 所有 root 直接子节点 = 顶级灵感 + 顶级大计 + 孤立课题 + 论文 + 议题 */
  function topLevel(graph){
    var idx = buildIndex(graph);
    return idx.children['root'].map(function(c){ return c.node; });
  }

  /* 分支：一个顶级节点 + 它所有后代（递归） */
  function branchOf(graph, topNodeId){
    var idx = buildIndex(graph);
    var visited = {};
    var result = [];
    function walk(nid){
      if(visited[nid]) return;
      visited[nid] = true;
      var n = idx.nodeMap[nid];
      if(n) result.push(n);
      (idx.children[nid] || []).forEach(function(c){ walk(c.node.id); });
    }
    walk(topNodeId);
    return result;
  }

  /* 祖先链（往上走到 root） */
  function ancestorsOf(graph, nodeId){
    var idx = buildIndex(graph);
    var chain = [];
    var cur = idx.nodeMap[nodeId];
    var visited = {};
    while(cur && !visited[cur.id] && cur.id !== 'root'){
      visited[cur.id] = true;
      chain.unshift(cur);
      var parent = (idx.parents[cur.id] || [])[0];
      cur = parent ? parent.node : null;
    }
    if(idx.nodeMap['root']) chain.unshift(idx.nodeMap['root']);
    return chain;
  }

  /* 后代树（递归所有子） */
  function descendantsOf(graph, nodeId){
    var idx = buildIndex(graph);
    var visited = {};
    var result = [];
    function walk(nid){
      if(visited[nid]) return;
      visited[nid] = true;
      var n = idx.nodeMap[nid];
      if(n && n.id !== nodeId) result.push(n);
      (idx.children[nid] || []).forEach(function(c){ walk(c.node.id); });
    }
    walk(nodeId);
    return result;
  }

  /* subtree = 祖先链 ∪ 后代树（聚焦模式只显示这些） */
  function subtreeOf(graph, nodeId){
    var set = {};
    ancestorsOf(graph, nodeId).forEach(function(n){ set[n.id] = n; });
    descendantsOf(graph, nodeId).forEach(function(n){ set[n.id] = n; });
    if(set[nodeId]) return Object.values(set);
    return ancestorsOf(graph, nodeId);  /* 只有祖先的情况 */
  }

  /* ---------- 布局：两种模式 ---------- */
  function layout(graph, opts){
    opts = opts || {};
    var focusId = opts.focusId || null;
    var W = opts.width || 1100;
    var H = opts.height || 800;
    var cx = W / 2;

    /* 每次 layout 前清旧坐标 */
    graph.nodes.forEach(function(n){ n.x = undefined; n.y = undefined; });

    var idx = buildIndex(graph);

    /* ========== 模式 1：全景（按分支并排）========== */
    if(!focusId){
      var topNodes = topLevel(graph);  /* root 的直接子们 */
      if(topNodes.length === 0){
        /* 空态：只有 root */
        var rootN = idx.nodeMap['root'];
        if(rootN){ rootN.x = cx; rootN.y = 80; }
        graph._titleNode = rootN;
        graph._panels = [];
        graph._mode = 'panorama';
        return graph;
      }

      /* 每个分支算总高度（节点数 × gap） */
      var nodeGap = 58;
      var panelW = 140;
      var panelPad = 30;

      var panels = topNodes.map(function(top){
        var nodes = branchOf(graph, top.id);
        return { top: top, nodes: nodes, height: Math.max(1, nodes.length) * nodeGap + 40 };
      });

      var totalW = panels.length * panelW + (panels.length - 1) * panelPad + 120;
      var rootY = 80;
      var panelTopY = rootY + 60;
      if(opts.width && opts.height){
        /* 有显式尺寸 → 约束面板间距 */
        totalW = opts.width;
        totalH = opts.height;
        panelPad = Math.max(10, (totalW - 120 - panels.length * panelW) / Math.max(1, panels.length - 1));
      } else {
        /* 自适应宽度 */
        totalH = panelTopY + Math.max.apply(null, panels.map(function(p){ return p.height; })) + 60;
      }
      var panelStep = panelW + panelPad;
      var totalPanelsWidth = panels.length * panelStep - panelPad;
      var offset = Math.max(0, (totalW - totalPanelsWidth) / 2);

      /* root 放最上方正中 */
      var rootN = idx.nodeMap['root'];
      if(rootN){
        rootN.x = cx;
        rootN.y = rootY;
      }

      /* 分配每个 panel（分支）—— 从 offset 起始，每个 panel 中心 = offset + panelW/2 */
      var panelStartX = offset + panelW / 2;
      panels.forEach(function(p, i){
        var panelCenterX = panelStartX + i * panelStep;
        p.x = panelCenterX;
        /* 给分支内每个节点算坐标 */
        p.nodes.forEach(function(n, j){
          n.x = panelCenterX;
          n.y = panelTopY + j * nodeGap;
        });
        /* 第一个节点（顶级灵感/大计）加 root→panel 的 spawn 边 — 不用加，edges 里已经有了 */
      });

      graph._panels = panels;
      graph._titleNode = rootN;
      graph._totalW = totalW;
      graph._totalH = totalH;
      graph._mode = 'panorama';
      return graph;
    }

    /* ========== 模式 2：聚焦 ========== */
    var nodeMap = idx.nodeMap;
    var focus = nodeMap[focusId];
    if(!focus){
      /* focus 找不到 → fallback panorama */
      return layout(graph, opts);
    }

    var subNodes = subtreeOf(graph, focusId);
    var subIds = {};
    subNodes.forEach(function(n){ subIds[n.id] = true; });

    /* 用 BFS depth + 子树宽度 布局 */
    var depthMap = {};
    var depthChildren = {};
    subNodes.forEach(function(n){ depthChildren[n.id] = []; });

    /* 只看 subtree 内的 edges */
    var subEdges = graph.edges.filter(function(e){ return subIds[e.from] && subIds[e.to]; });

    /* 父子关系 */
    var sc = {}, sp = {};
    subNodes.forEach(function(n){ sc[n.id] = []; sp[n.id] = null; });
    subEdges.forEach(function(e){
      sc[e.from].push(e.to);
      sp[e.to] = e.from;
    });

    /* BFS depth（root=0 或 focus=0？ 用 focus=1，祖先链往上加负depth？简化：BFS从focus向下 + 从root向上算）*/
    depthMap['root'] = 0;
    /* 从 root 向下 */
    var q = ['root'];
    while(q.length){
      var cur = q.shift();
      (sc[cur] || []).forEach(function(cid){
        if(depthMap[cid] === undefined || depthMap[cid] < depthMap[cur] + 1){
          depthMap[cid] = depthMap[cur] + 1;
          q.push(cid);
        }
      });
    }
    /* focus 可能没连到 root？强行找祖先 */
    if(depthMap[focusId] === undefined){
      /* fallback：focus depth=0，所有后代 +1 +1... */
      depthMap[focusId] = 0;
      q = [focusId];
      while(q.length){
        var cur2 = q.shift();
        (sc[cur2] || []).forEach(function(cid){
          if(depthMap[cid] === undefined){
            depthMap[cid] = depthMap[cur2] + 1;
            q.push(cid);
          }
        });
      }
    }

    /* 按 depth 列 */
    var depthCols = [];
    subNodes.forEach(function(n){
      var d = depthMap[n.id] !== undefined ? depthMap[n.id] : 99;
      n._depth = d;
      if(!depthCols[d]) depthCols[d] = [];
      depthCols[d].push(n);
    });

    var colGap = 220;
    var nodeYGap = 70;
    var maxDepth = depthCols.length;
    var maxPerCol = Math.max(1, ...depthCols.map(function(a){ return a.length; }));
    var totalW = Math.max(600, maxDepth * colGap + 200);
    var totalH = Math.max(400, maxPerCol * nodeYGap + 120);

    if(opts.width && opts.height){ totalW = opts.width; totalH = opts.height; }

    depthCols.forEach(function(arr, d){
      var colCenterX = 100 + d * colGap;
      arr.forEach(function(n, i){
        n.x = colCenterX;
        if(arr.length === 1) n.y = totalH / 2;
        else n.y = 80 + (totalH - 140) * i / (arr.length - 1);
      });
    });

    /* 隐藏不在 subtree 里的节点 */
    graph.nodes.forEach(function(n){
      n._hidden = !subIds[n.id];
    });

    graph._panels = [];
    graph._titleNode = nodeMap['root'] || null;
    graph._totalW = totalW;
    graph._totalH = totalH;
    graph._mode = 'focus';
    graph._focusId = focusId;
    return graph;
  }

  QZD.link = {
    build: buildGraph,
    layout: layout,
    helpers: {
      topLevel: topLevel,
      branchOf: branchOf,
      ancestorsOf: ancestorsOf,
      descendantsOf: descendantsOf,
      subtreeOf: subtreeOf
    }
  };
})();
