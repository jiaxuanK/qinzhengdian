/* ============================================================
   ui/pages/goals.js · 千秋大计 3.0
   
   两个 Tab：
     🌳 谱系树 —— 大计父子树状结构，每个节点挂灵感标签 chip
     🔗 链路图 —— 大计父子 SVG + 绑定课题（灵感不再是独立节点）
   
   灵感关联操作全部在**详情弹层**里（新建/关联/取消关联）
   删除了独立的灵感罐 sidebar
   ============================================================ */
(function(){
  var UI = QZD.ui;
  var ESC = function(t){ return UI.fmt.escape(t); };

  var depthColors = ['var(--daiqing)', 'var(--shi-qing)', 'var(--zhu-green)', 'var(--ou-he)'];

  function bar(pct, cls){
    return '<div class="mini-bar' + (cls ? ' ' + cls : '') + '"><i style="width:' +
      Math.max(0, Math.min(100, pct)) + '%"></i><span>' + Math.max(0, Math.min(100, pct)) + '%</span></div>';
  }
  function daysBadge(n){
    var dl = QZD.goals.daysLeft(n);
    if(dl === null) return '';
    if(dl < 0) return '<span class="chip sm danger">逾期 ' + (-dl) + '天</span>';
    if(dl === 0) return '<span class="chip sm danger">今天到期</span>';
    return '<span class="chip sm">剩 ' + dl + ' 天</span>';
  }

  /* ---------- 谱系节点 ---------- */
  function treeNode(n, depth, _selectedGoalId){
    var ch = QZD.goals.children(n.id);
    var eff = QZD.goals.effective(n);
    var color = depthColors[Math.min(depth, depthColors.length - 1)];
    var isSelected = _selectedGoalId === n.id;
    var ideasLinked = QZD.idea.list().filter(function(i){ return i.hatchedType === 'goal' && i.hatchedRef === n.id; });
    var subjects = (n.subjectIds || []).map(function(sid){
      var s = (QZD.study && QZD.study.subjects) ? QZD.study.subjects().filter(function(x){ return x.id === sid; })[0] : null;
      return s ? s.name : sid;
    }).filter(Boolean);

    /* 灵感 chip —— 显示标签优先，点文字编辑，点 × 取消关联 */
    var ideaChips = ideasLinked.map(function(i){
      var display = i.tag || (i.text || '').slice(0, 10);
      return '<span class="chip sm idea-chip" data-idea-edit="' + ESC(i.id) + '" title="点击编辑灵感">' +
        '🧠 ' + ESC(display) + '<b data-unlink="' + ESC(i.id) + '" data-goal-id="' + ESC(n.id) + '" title="取消关联" onclick="event.stopPropagation()">×</b></span>';
    }).join('');

    /* 课题 chip */
    var subjChips = subjects.map(function(name){
      return '<span class="chip sm subj-chip">📖 ' + ESC(name) + '</span>';
    }).join('');

    /* 关联标签 chip（按 type 分色）*/
    var linkChips = (n.links || []).map(function(l, idx){
      var icon = QZD.goals.linkIcon(l.type);
      var lc = QZD.goals.linkColor(l.type);
      return '<span class="chip sm" style="background:' + lc.chipBg + ';color:' + lc.chipText + '"' +
        ' data-goal-link-remove="' + ESC(n.id) + '|' + ESC(l.type) + '|' + ESC(l.ref) + '" ' +
        'title="类型：' + ESC(l.type) + '">' + icon + ' ' + ESC(l.label) +
        '<b style="color:#A8573F;margin-left:4px;cursor:pointer;opacity:.5" title="取消" onclick="event.stopPropagation()">×</b></span>';
    }).join('');

    var kidsHTML = ch.length ? ch.map(function(c){ return treeNode(c, depth + 1, _selectedGoalId); }).join('') : '';

    return '<div class="gt-node-wrapper">' +
      '<div class="gt-node' + (ch.length ? ' gt-has-children' : '') + '"' +
        (isSelected ? ' style="outline:2px solid ' + color + ';outline-offset:-2px;background:rgba(0,0,0,.02)"' : '') + '>' +
        /* 竖线（只给子节点）*/
        (depth > 0 ? '<span class="gt-vline"></span>' : '') +
        '<div class="gt-node-inner" style="border-left:3px solid ' + color + '">' +
          '<div class="gt-row">' +
            '<div class="gt-title" data-gt-pick="' + ESC(n.id) + '" style="color:' + color + '">' +
              /* 树展开图标 */
              (ch.length ? '<span class="gt-toggle">▾</span>' : '<span class="gt-leaf">·</span>') +
              ESC(n.title) +
            '</div>' +
            '<div class="gt-tools">' +
              '<button class="chip sm" data-goal-detail="' + n.id + '">详情</button>' +
              '<button class="chip sm" data-goal-link-add="' + n.id + '" title="加关联标签（奏折/修书/议事/常课等）">＋关联</button>' +
              '<button class="chip sm" data-goal-child="' + n.id + '">＋子</button>' +
              '<button class="chip sm danger" data-goal-del="' + n.id + '">删</button>' +
            '</div>' +
          '</div>' +
          /* 进度 + 倒计时 */
          '<div class="gt-meta">' +
            bar(eff) +
            daysBadge(n) +
          '</div>' +
          /* chip 行 */
          ((ideaChips || subjChips || linkChips) ?
            '<div class="gt-chips">' + ideaChips + subjChips + linkChips + '</div>' : '') +
        '</div>' +
      '</div>' +
      /* 子节点（递归）*/
      kidsHTML +
    '</div>';
  }

  /* ---------- SVG 链路图（大计父子 + 绑定课题 + 侧挂灵感）---------- */
  function svgLink(){
    var goalNodes = [];
    var subjectNodes = [];
    var ideaNodes = [];
    var linkNodes = [];    /* 关联标签侧挂节点 */
    var nodeMap = {};
    var edges = [];  /* 只含 parent / binds / spawn 用于 BFS */
    var ideaEdges = [];  /* hatched_to 单独存，不参与 BFS */
    var linkEdges = [];  /* links 虚线边 */

    var goalRoots = QZD.goals.roots();

    /* 先只构图大计父子 + 课题（不碰灵感）*/
    var addG = function(gid){
      if(nodeMap['goal:'+gid]) return;
      var g = QZD.goals.find(gid);
      if(!g) return;
      var obj = { id:'goal:'+gid, type:'goal', label:g.title, size:28, color:'#3E6B5C', _parent:g.parentId };
      nodeMap['goal:'+gid] = obj;
      goalNodes.push(obj);
      (g.subjectIds || []).forEach(function(sid){
        if(nodeMap['subject:'+sid]) return;
        var subj = (QZD.study && QZD.study.subjects) ? QZD.study.subjects().filter(function(s){ return s.id === sid; })[0] : null;
        if(!subj) return;
        var so = { id:'subject:'+sid, type:'subject', label:subj.name||sid, size:20, color:'#2F6B78', _goalId:gid };
        nodeMap['subject:'+sid] = so;
        subjectNodes.push(so);
        edges.push({ from:'goal:'+gid, to:'subject:'+sid, type:'binds' });
      });
      QZD.goals.children(gid).forEach(function(c){
        addG(c.id);
        edges.push({ from:'goal:'+gid, to:'goal:'+c.id, type:'parent' });
      });
    };
    goalRoots.forEach(function(r){ addG(r.id); edges.push({ from:'root', to:'goal:'+r.id, type:'spawn' }); });

    /* 根节点 */
    var rootNode = { id:'root', type:'root', label:'勤政殿', size:36, color:'#363A32' };
    nodeMap['root'] = rootNode;

    if(goalNodes.length === 0){
      return '<div class="lk-empty-box" style="padding:40px;text-align:center">' +
        '<div class="lk-empty-title" style="font-size:14px;color:#8a8574">暂无大计</div></div>';
    }

    /* BFS depth — 只含 root/goal/subject */
    var allStructNodes = [rootNode].concat(goalNodes, subjectNodes);
    var depth = {};
    depth['root'] = 0;
    var q = ['root'];
    while(q.length){
      var cur = q.shift();
      edges.filter(function(e){ return e.from === cur; }).forEach(function(e){
        if(depth[e.to] === undefined){ depth[e.to] = depth[cur] + 1; q.push(e.to); }
      });
    }
    allStructNodes.forEach(function(n){ n._d = depth[n.id] || 0; });

    /* 列布局前先算每个大计有多少侧挂标签 → 决定纵向占位 */
    goalNodes.forEach(function(g){
      var gidRaw = g.id.replace(/^goal:/, '');
      var ideaCnt = QZD.idea.list().filter(function(i){ return i.hatchedType === 'goal' && i.hatchedRef === gidRaw; }).length;
      var linkCnt = 0;
      var g2 = QZD.goals.find(gidRaw);
      if(g2 && g2.links) linkCnt = g2.links.length;
      g._sideLabelCount = ideaCnt + linkCnt;
      /* 纵向需求 = 标签数 × 22px（行高）+ 大计节点本身 56px + 上下 padding */
      g._yDemand = Math.max(90, (g._sideLabelCount + 1) * 22 + 56 + 16);
    });

    /* 列布局：root col0, goal col1+, subject 和父 goal 同列 */
    var colX = [80, 280, 480, 680, 880, 1080];
    var cols = {};
    allStructNodes.forEach(function(n){
      var d = depth[n.id] !== undefined ? depth[n.id] : 99;
      if(!cols[d]) cols[d] = [];
      cols[d].push(n);
    });
    var maxD = Math.max.apply(null, Object.keys(cols).map(function(k){ return +k; }));
    var W = colX[Math.min(maxD, colX.length - 1)] + 160;
    var colH = {};
    var START_Y = 80;
    Object.keys(cols).forEach(function(k){
      var colIdx = +k;
      var colNodes = cols[colIdx];
      colH[colIdx] = colNodes.length;
      /* 每列独立排布，让每个节点有自己的纵向需求空间 */
      var curY = START_Y;
      colNodes.forEach(function(n){
        n.x = colX[Math.min(colIdx, colX.length - 1)];
        n.y = curY;
        /* 让下一个节点的起点 = 当前节点 y + max(基础间距, 当前节点的纵向需求) */
        var demand = n._yDemand || 90;
        curY += demand;
      });
    });
    /* SVG 总高 */
    var totalRows = Object.keys(cols).reduce(function(m, k){ return Math.max(m, cols[+k].length); }, 0);
    var H = Math.max(320, START_Y * 2 + totalRows * 110);

    /* 灵感 + links 合并为一组侧挂标签，围绕大计节点纵向居中排列 */
    goalNodes.forEach(function(g){
      var gidRaw = g.id.replace(/^goal:/, '');
      var g2 = QZD.goals.find(gidRaw);
      var myIdeas = QZD.idea.list().filter(function(i){ return i.hatchedType === 'goal' && i.hatchedRef === gidRaw; });
      var myLinks = (g2 && g2.links) ? g2.links : [];
      var rowH = 22;
      var totalSide = myIdeas.length + myLinks.length;
      /* 居中：所有标签围绕 g.y 上下展开 */
      var topOffset = totalSide === 1 ? 0 : -((totalSide - 1) * rowH) / 2;
      var rowIdx = 0;

      /* 先渲染灵感标签，startX 紧贴节点 */
      myIdeas.forEach(function(it){
        var iy = g.y + topOffset + (rowIdx * rowH);
        var ix = g.x + g.size + 22;
        var fullLabel = '🧠 ' + (it.tag || (it.text || '')).slice(0, 12);
        var io = {
          id:'idea:'+it.id, type:'idea',
          label: fullLabel, size:4, color:'#A8842C',
          x: ix, y: iy, _parentGoalId: g.id, _idea: it
        };
        nodeMap['idea:'+it.id] = io;
        ideaNodes.push(io);
        ideaEdges.push({ from:'goal:'+g.id, to:'idea:'+it.id, type:'hatched_to' });
        rowIdx++;
      });

      /* links 标签排在灵感下方（同一 x 列，跟着 rowIdx 走）+ 递归展开目标自身的灵感 */
      myLinks.forEach(function(l, idx){
        var iy = g.y + topOffset + (rowIdx * rowH);
        var ix = g.x + g.size + 22;
        var icon = QZD.goals.linkIcon(l.type);
        var lc = QZD.goals.linkColor(l.type);
        var fullLabel = icon + ' ' + (l.label || '');
        var lo = {
          id:'link:' + gidRaw + ':' + idx,
          type:'link',
          label: fullLabel,
          size: 4,
          _linkType: l.type,
          _dotColor: lc.dot,
          _textColor: lc.text,
          color: lc.dot,
          x: ix, y: iy
        };
        nodeMap[lo.id] = lo;
        linkNodes.push(lo);
        linkEdges.push({ from:'goal:'+g.id, to: lo.id, type:'link' });
        rowIdx++;

        /* 递归展开：目标自身关联的灵感（hatchedType === l.type && hatchedRef === l.ref）
           作为二级侧挂：从 link 节点继续往右 + 虚线边 */
        if(l.ref && ['thesis','memorial','meeting'].indexOf(l.type) >= 0){
          var targetIdeas = QZD.idea.list().filter(function(i){ return i.hatchedType === l.type && i.hatchedRef === l.ref; });
          targetIdeas.forEach(function(tit){
            var tiy = g.y + topOffset + (rowIdx * rowH);
            var tix = ix + 16;  /* 在 link 标签更右侧（跟 label 右沿对齐）*/
            var tfullLabel = '🧠 ' + (tit.tag || (tit.text || '')).slice(0, 12);
            var tio = {
              id:'idea-link:' + gidRaw + ':' + idx + ':' + tit.id,
              type:'idea', label: tfullLabel, size:4, color:'#A8842C',
              x: tix, y: tiy, _parentLinkId: lo.id, _idea: tit
            };
            nodeMap[tio.id] = tio;
            ideaNodes.push(tio);
            ideaEdges.push({ from: lo.id, to: tio.id, type:'hatched_to' });
            rowIdx++;
          });
        }
      });
    });

    /* 扩展 W 以容纳最右侧的灵感/links（文字标签给足余量）*/
    var maxSideX = Math.max(
      ideaNodes.length ? Math.max.apply(null, ideaNodes.map(function(n){ return n.x + 200; })) : 0,
      linkNodes.length ? Math.max.apply(null, linkNodes.map(function(n){ return n.x + 240; })) : 0
    );
    if(maxSideX > W) W = maxSideX;

    /* 画边 —— 先画结构边（parent/spawn/binds），再画虚线灵感边 */
    function edgePath(a, b){
      if(!a || !b) return '';
      var dx = b.x - a.x, dy = b.y - a.y;
      var dist = Math.sqrt(dx*dx + dy*dy) || 1;
      var rA = a.size + 5, rB = b.size + 5;
      var sx = a.x + (dx/dist) * rA, sy = a.y + (dy/dist) * rA;
      var ex = b.x - (dx/dist) * rB, ey = b.y - (dy/dist) * rB;
      if(Math.abs(dy) < 6 && Math.abs(dx) < 12) return '';
      var midX = (sx + ex) / 2;
      return 'M' + sx + ' ' + sy + ' C' + midX + ' ' + sy + ', ' + midX + ' ' + ey + ', ' + ex + ' ' + ey;
    }
    function edgePathNear(a, b){
      /* 短距离直线（灵感 / links 侧挂标签用）*/
      if(!a || !b) return '';
      var dx = b.x - a.x, dy = b.y - a.y;
      var dist = Math.sqrt(dx*dx + dy*dy) || 1;
      /* 侧挂标签节点（size<=4）直接连到节点坐标，让渲染的小圆点盖住末端 */
      var rA = a.size + 5;
      var rB = (b.size <= 6) ? 0 : (b.size + 5);
      var sx = a.x + (dx/dist) * rA, sy = a.y + (dy/dist) * rA;
      var ex = b.x - (dx/dist) * rB, ey = b.y - (dy/dist) * rB;
      return 'M' + sx + ' ' + sy + ' L' + ex + ' ' + ey;
    }

    var edgeColor = { spawn: '#DAD3C0', parent: '#A8842C', binds: '#2F6B78', hatched_to: '#A8842C', link: '#4C6E8C' };
    var edgeSVG = edges.map(function(e){
      var a = nodeMap[e.from], b = nodeMap[e.to];
      if(!a || !b) return '';
      return '<path class="lk-edge" d="' + edgePath(a, b) + '"' +
        ' stroke="' + edgeColor[e.type] + '"' +
        ' stroke-width="' + (e.type === 'parent' ? '2' : '1.5') + '" fill="none"' +
        ' stroke-opacity="' + (e.type === 'spawn' ? '0.35' : '0.8') + '"' +
        ' marker-end="url(#lk-arrow-' + e.type + ')"/>';
    }).join('');
    /* 灵感虚线边 */
    edgeSVG += ideaEdges.map(function(e){
      var a = nodeMap[e.from], b = nodeMap[e.to];
      if(!a || !b) return '';
      return '<path class="lk-edge lk-edge-dashed" d="' + edgePathNear(a, b) + '"' +
        ' stroke="' + edgeColor[e.type] + '"' +
        ' stroke-width="1.2" fill="none"' +
        ' stroke-dasharray="4 3"' +
        ' stroke-opacity="0.7" stroke-linecap="round"/>';
    }).join('');
    /* links 虚线边（跟节点圆点同色）*/
    edgeSVG += linkEdges.map(function(e){
      var a = nodeMap[e.from], b = nodeMap[e.to];
      if(!a || !b) return '';
      var strokeCol = b._dotColor || b.color || edgeColor.link;
      return '<path class="lk-edge lk-edge-dashed" d="' + edgePathNear(a, b) + '"' +
        ' stroke="' + strokeCol + '"' +
        ' stroke-width="1" fill="none"' +
        ' stroke-dasharray="3 3"' +
        ' stroke-opacity="0.55" stroke-linecap="round"/>';
    }).join('');

    /* 节点渲染：文字进圆内 */
    /* 先算 label 截断长度：用 size 估圆内能放多少字 */
    function truncateForCircle(label, r, fontSize){
      var maxW = r * 1.7;  /* 圆内可用宽度（留 padding）*/
      /* 估每字宽度：中文约等于 fontSize，英文约 0.5 */
      var out = '';
      for(var i = 0; i < label.length; i++){
        var ch = label[i];
        var w = (/[\u4e00-\u9fff\u3000-\u303f\uff00-\uffef]/.test(ch) ? fontSize : fontSize * 0.55);
        if((out.length * fontSize * 0.8) + w > maxW) break;
        out += ch;
      }
      return out + (out.length < label.length ? '…' : '');
    }

    var nodeSVG = '';
    allStructNodes.forEach(function(n){
      var isRoot = n.id === 'root';
      /* 根据圆大小选字体大小 */
      var fontSize = Math.max(8, Math.min(12, Math.round(n.size / 3)));
      var labelText = truncateForCircle(n.label || '', n.size, fontSize);
      /* 根节点白色文字，其他节点也白色（在深色圆上）*/
      nodeSVG += '<g class="lk-node lk-node-' + n.type + '" transform="translate(' + n.x + ',' + n.y + ')">' +
        '<circle r="' + (n.size + 6) + '" fill="none" stroke="' + n.color + '" stroke-opacity="0.12" stroke-width="2"/>' +
        '<circle r="' + n.size + '" fill="' + n.color + '"' + (isRoot ? ' stroke="#fff" stroke-width="3" stroke-opacity="0.4"' : '') + '/>' +
        '<text text-anchor="middle" y="' + (fontSize / 3) + '" font-size="' + fontSize + '" font-weight="' + (isRoot ? '700' : '600') + '" fill="#FFFFFF">' + ESC(labelText) + '</text>' +
      '</g>';
    });
    /* 灵感侧挂标签：小圆点前缀 + 完整文字（不截断）+ data-idea-edit 可点击 */
    ideaNodes.forEach(function(n){
      var fontSize = 11;
      var ideaId = (n._idea && n._idea.id) || '';
      nodeSVG += '<g class="lk-node lk-node-idea" transform="translate(' + n.x + ',' + n.y + ')"' +
        (ideaId ? ' data-idea-edit="' + ESC(ideaId) + '"' : '') +
        ' style="cursor:pointer" title="' + ESC(n.label || '') + ' · 点击编辑灵感">' +
        '<circle cx="0" cy="0" r="4" fill="' + n.color + '" stroke="#8a7130" stroke-width="1"/>' +
        '<text x="10" y="3" font-size="' + fontSize + '" font-weight="500" fill="#8a7130">' + ESC(n.label || '') + '</text>' +
      '</g>';
    });
    /* links 侧挂标签：小圆点前缀 + 完整文字，按 type 分色 */
    linkNodes.forEach(function(n){
      var fontSize = 11;
      var dotColor = n._dotColor || n.color;
      var txtColor = n._textColor || dotColor;
      var strokeDark = n._linkType === 'memorial' ? '#8a3a28' :
                       n._linkType === 'thesis'   ? '#1e4a54' :
                       n._linkType === 'meeting'  ? '#5d4d70' :
                       n._linkType === 'checkin'  ? '#3f5732' :
                       n._linkType === 'reading'  ? '#8a7130' : '#3a5570';
      nodeSVG += '<g class="lk-node lk-node-link" transform="translate(' + n.x + ',' + n.y + ')" title="' + ESC(n._linkType || '') + '">' +
        '<circle cx="0" cy="0" r="4" fill="' + dotColor + '" stroke="' + strokeDark + '" stroke-width="1"/>' +
        '<text x="10" y="3" font-size="' + fontSize + '" font-weight="500" fill="' + txtColor + '">' + ESC(n.label || '') + '</text>' +
      '</g>';
    });

    var defs = '<defs>' +
      Object.keys(edgeColor).map(function(t){
        return '<marker id="lk-arrow-' + t + '" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">' +
          '<path d="M 0 0 L 10 5 L 0 10 z" fill="' + edgeColor[t] + '"/></marker>';
      }).join('') +
    '</defs>';

    return '<svg viewBox="0 0 ' + W + ' ' + H + '" class="lk-svg lk-svg-tree">' +
      defs + edgeSVG + nodeSVG + '</svg>';
  }

  /* ---------- 主注册 ---------- */
  UI.register('goals', function(){
    var roots = QZD.goals.roots();
    var treeHTML = roots.length
      ? roots.map(function(r){ return treeNode(r, 0, null); }).join('')
      : '<div class="empty">千秋大计尚空 · 立新计吧</div>';

    var myIdeas = QZD.idea.list().filter(function(i){ return i.hatchedType === 'goal' && i.hatchedRef; });

    var statBarHTML = '<div class="realm-stats">' +
      '<div class="realm-stat"><span>大计根</span><b>' + QZD.goals.stats().roots + '</b></div>' +
      '<div class="realm-stat"><span>总节点</span><b>' + QZD.goals.stats().total + '</b></div>' +
      '<div class="realm-stat hot"><span>平均进度</span><b>' + QZD.goals.stats().avgProgress + '%</b></div>' +
      '<div class="realm-stat"><span>关联灵感</span><b>' + myIdeas.length + '</b></div>' +
    '</div>';

    return '' +
      statBarHTML +
      '<div class="gw-main">' +
        '<div class="gw-right" style="flex:1">' +
          '<div class="gw-tabs">' +
            '<button class="gw-tab gw-tab-active" data-gw-tab="tree">🌳 谱系树</button>' +
            '<button class="gw-tab" data-gw-tab="link">🔗 链路图</button>' +
          '</div>' +
          '<div class="gw-panel gw-panel-tree">' +
            '<div class="thesis-new">' +
              '<input id="goal-title" maxlength="60" placeholder="立大计，如：博士顺利毕业">' +
              '<button class="btn primary" data-goal-add>立 计</button>' +
            '</div>' +
            treeHTML +
          '</div>' +
          '<div class="gw-panel gw-panel-link" style="display:none">' + svgLink() + '</div>' +
        '</div>' +
      '</div>';
  });

  /* ---------- 详情弹层（含灵感关联区）---------- */
  function openDetail(id){
    var n = QZD.goals.find(id);
    if(!n) return;
    document.querySelectorAll('.modal-mask').forEach(function(m){ if(m.parentNode) m.parentNode.removeChild(m); });

    var subjects = QZD.study ? QZD.study.subjects() : [];
    var eff = QZD.goals.effective(n);
    var hasChildren = QZD.goals.children(id).length > 0;
    var isLeaf = !hasChildren;

    var myIdeas = QZD.idea.list().filter(function(i){ return i.hatchedType === 'goal' && i.hatchedRef === id; });
    var availIdeas = QZD.idea.list().filter(function(i){ return !i.hatchedType || !i.hatchedRef; });

    var ideasBlock = '<div style="margin:10px 0;padding:10px;background:rgba(168,132,44,.05);border-radius:6px">' +
      '<div style="font-size:12px;color:#8a7130;margin-bottom:6px;font-weight:600">🧠 关联灵感 (' + myIdeas.length + ')</div>' +
      (myIdeas.length ? myIdeas.map(function(i){
        var display = i.tag || (i.text || '').slice(0, 12);
        return '<span class="chip sm idea-chip" style="margin:3px">' + ESC(display) +
          '<button data-detail-unlink="' + ESC(i.id) + '" style="margin-left:4px;color:#8a4537;border:none;background:none;cursor:pointer">×</button></span>';
      }).join(' ') : '<span style="font-size:11px;color:#9a9790">暂无</span>') +
      (availIdeas.length ?
        '<div style="margin-top:8px"><select id="ig-add-select" style="max-width:280px">' +
          '<option value="">＋选灵感关联…</option>' +
          availIdeas.map(function(i){ return '<option value="' + ESC(i.id) + '">[' + ESC(i.tag||'') + '] ' + ESC(i.text.slice(0,26)) + '</option>'; }).join('') +
        '</select></div>' : '') +
      '<div style="margin-top:8px;display:flex;gap:4px">' +
        '<input id="ig-quick" placeholder="新建灵感并关联…" style="flex:1;padding:4px 8px;border:1px solid var(--line);border-radius:4px;font-size:12px">' +
        '<input id="ig-quick-tag" placeholder="标签" maxlength="10" style="width:70px;padding:4px 6px;border:1px solid var(--line);border-radius:4px;font-size:12px">' +
        '<button class="btn primary" style="padding:4px 10px;font-size:12px" data-ig-quick-add>＋</button>' +
      '</div>' +
    '</div>';

    var subjHTML = subjects.length ?
      '<div style="margin:8px 0"><p style="font-size:12px;color:#8a8574;margin:4px 0">绑定课题：</p>' +
      subjects.map(function(s){
        var checked = (n.subjectIds || []).indexOf(s.id) >= 0 ? ' checked' : '';
        return '<label style="display:inline-flex;align-items:center;gap:3px;margin:2px 4px;font-size:11px">' +
          '<input type="checkbox" class="gd-subj" value="' + ESC(s.id) + '"' + checked + '>' + ESC(s.name) + '</label>';
      }).join('') + '</div>' : '';

    var progressBlock;
    if(isLeaf){
      /* 叶子节点：可手动拖进度 */
      progressBlock =
        bar(eff) +
        '<div style="margin-top:6px;display:flex;align-items:center;gap:8px">' +
          '<input id="gd-progress" type="range" min="0" max="100" value="' + (n.progress || 0) + '"' + (n.manual ? '' : ' disabled') + ' style="flex:1">' +
          '<input id="gd-progress-num" type="number" min="0" max="100" value="' + (n.progress || 0) + '" style="width:50px;padding:2px 4px;border:1px solid var(--line);border-radius:3px;font-size:12px">' +
          '<span style="font-size:11px;color:#8a8574">%</span>' +
          '<label style="font-size:11px;color:#8a7130;margin-left:4px">' +
            '<input type="checkbox" id="gd-manual"' + (n.manual ? ' checked' : '') + '> 手动覆盖</label>' +
        '</div>' +
        (n.manual
          ? '<p style="font-size:10px;color:#8a8574;margin-top:4px">手动覆盖中 · 勾掉恢复自动（专注分钟）</p>'
          : '<p style="font-size:10px;color:#8a8574;margin-top:4px">自动（专注分钟 ' + (n.targetMinutes ? '/ '+n.targetMinutes+'min' : '') + '）</p>');
    } else {
      /* 有子节点：只读显示 */
      progressBlock =
        bar(eff) +
        '<p style="font-size:10px;color:#8a8574;margin-top:4px">含 ' + QZD.goals.children(id).length + ' 个子大计 · 进度自动聚合子节点</p>';
    }

    var body = ideasBlock +
      '<div class="field"><label>目标名称</label><input id="gd-title" value="' + ESC(n.title) + '" maxlength="60"></div>' +
      '<div style="margin:8px 0;padding:10px;background:#f4efe6;border-radius:6px">' + progressBlock + '</div>' +
      '<div class="field"><label>目标总专注分钟</label><input id="gd-target" type="number" min="0" value="' + (n.targetMinutes || 0) + '"></div>' +
      subjHTML +
      '<div class="field"><label>截止</label><input id="gd-deadline" type="date" value="' + ESC(n.deadline || '') + '"></div>';

    window.__goalDetailId = id;  /* 保存给快捷关联用 */
    UI.modal({
      title: '大计详情 · ' + ESC(n.title),
      body: body,
      ok: true, okText: '保存',
      onOk: function(){
        QZD.goals.updateTitle(id, document.getElementById('gd-title').value);
        QZD.goals.setTargetMinutes(id, parseInt(document.getElementById('gd-target').value, 10) || 0);
        var sids = [];
        document.querySelectorAll('.gd-subj:checked').forEach(function(c){ if(sids.length < 5) sids.push(c.value); });
        QZD.goals.setSubjects(id, sids);
        QZD.goals.setDeadline(id, document.getElementById('gd-deadline').value.trim());
        /* 进度：只有叶子节点允许手动 */
        if(isLeaf){
          var manual = document.getElementById('gd-manual').checked;
          if(manual){
            var p = parseInt(document.getElementById('gd-progress').value, 10);
            if(isNaN(p)) p = parseInt(document.getElementById('gd-progress-num').value, 10) || 0;
            QZD.goals.setProgress(id, p);
          } else if(n.manual){
            QZD.goals.setManual(id, false);
          }
        }
        UI.onStateChanged();
      }
    });

    /* 实时联动：勾上"手动覆盖"立刻启用 slider */
    setTimeout(function(){
      var cb = document.getElementById('gd-manual');
      var sl = document.getElementById('gd-progress');
      if(cb && sl){
        cb.addEventListener('change', function(){
          sl.disabled = !cb.checked;
        });
      }
    }, 20);
  }

  /* ---------- 事件委托 ---------- */
  document.addEventListener('click', function(e){
    /* Tab 切换 */
    var tab = e.target.closest('[data-gw-tab]');
    if(tab){
      document.querySelectorAll('.gw-tab').forEach(function(t){ t.classList.remove('gw-tab-active'); });
      tab.classList.add('gw-tab-active');
      var which = tab.getAttribute('data-gw-tab');
      document.querySelector('.gw-panel-tree').style.display = which === 'tree' ? '' : 'none';
      var linkPanel = document.querySelector('.gw-panel-link');
      linkPanel.style.display = which === 'link' ? '' : 'none';
      if(which === 'link') linkPanel.innerHTML = svgLink();
      return;
    }
    /* 详情 */
    var det = e.target.closest('[data-goal-detail]');
    if(det){ openDetail(det.getAttribute('data-goal-detail')); return; }
    /* 新建顶层大计 */
    if(e.target.closest('[data-goal-add]')){
      var title = (document.getElementById('goal-title').value || '').trim();
      if(!title){ UI.toast('请填写大计名称'); return; }
      if(!QZD.goals.add(title).ok){ UI.toast('失败'); return; }
      document.getElementById('goal-title').value = '';
      UI.onStateChanged();
      return;
    }
    /* 子目标 */
    var child = e.target.closest('[data-goal-child]');
    if(child){
      UI.modal({
        title: '新增子目标',
        body: '<div class="field"><label>名称</label><input id="gc-title" maxlength="60"></div>' +
             '<div class="field"><label>截止(选填)</label><input id="gc-deadline" type="date"></div>',
        ok: true, okText: '添加',
        onOk: function(){
          var t = document.getElementById('gc-title').value.trim();
          if(!t) return false;
          var r = QZD.goals.add(t, child.getAttribute('data-goal-child'));
          if(!r.ok){ UI.toast(r.error); return false; }
          var dl = document.getElementById('gc-deadline').value.trim();
          if(dl) QZD.goals.setDeadline(r.node.id, dl);
          UI.onStateChanged();
        }
      });
      return;
    }
    /* 删除 */
    var del = e.target.closest('[data-goal-del]');
    if(del){
      UI.confirm('删除该大计及其全部子目标？', function(){
        QZD.goals.remove(del.getAttribute('data-goal-del'));
        UI.onStateChanged();
      });
      return;
    }

    /* 加关联标签 */
    var linkAdd = e.target.closest('[data-goal-link-add]');
    if(linkAdd){
      var gid = linkAdd.getAttribute('data-goal-link-add');
      var typeOptions = [
        { v:'memorial', name:'奏折 📋' },
        { v:'thesis',   name:'修书 📖' },
        { v:'meeting',  name:'议事 💬' },
        { v:'checkin',  name:'常课 ✅' },
        { v:'reading',  name:'阅读 📚' },
        { v:'custom',   name:'自定义 🏷️' }
      ];

      /* 根据 type 实时拉候选（每次刷新 select 内容）*/
      function fetchCandidates(type){
        try {
          if(type === 'memorial' && QZD.memorials && QZD.memorials.active){
            return QZD.memorials.active().slice(0, 10);
          }
          if(type === 'thesis' && QZD.thesis){
            return QZD.thesis.list().slice(0, 10);
          }
          if(type === 'meeting' && QZD.meetings){
            return QZD.meetings.list().slice(0, 10);
          }
          if(type === 'checkin' && QZD.state.checkin){
            return (QZD.state.checkin.goals || []).slice(0, 10);
          }
          if(type === 'reading' && QZD.state.reading){
            return (QZD.state.reading.queue || []).slice(0, 10);
          }
        } catch(ex){}
        return [];
      }

      /* 根据类型渲染 select 的 options 列表 */
      function renderSelectOptions(type){
        if(type === 'custom'){
          return '<option value="">—— 自定义标签（无需选择）——</option>';
        }
        var cand = fetchCandidates(type);
        if(!cand.length){
          return '<option value="">—— 该类型暂无记录（手动输入标题）——</option>';
        }
        return '<option value="">—— 手动输入标题 ——</option>' +
          cand.map(function(c){
            return '<option value="' + ESC(c.id || '') + '">' + ESC(c.title || c.name || '') + '</option>';
          }).join('');
      }

      UI.modal({
        title: '加关联标签',
        body: '<div class="field"><label>类型</label><select id="gl-type">' +
          typeOptions.map(function(o){ return '<option value="'+o.v+'">'+o.name+'</option>'; }).join('') +
          '</select></div>' +
          '<div class="field"><label>已有记录</label>' +
          '<select id="gl-select">' + renderSelectOptions('memorial') + '</select></div>' +
          '<div class="field"><label>标签文字</label>' +
          '<input id="gl-label" maxlength="24" placeholder="留空则自动从已有记录解析" style="width:100%"></div>',
        ok: true, okText: '关联',
        onOk: function(){
          var tp = document.getElementById('gl-type').value;
          var sel = document.getElementById('gl-select').value;
          var lab = document.getElementById('gl-label').value.trim();
          /* custom 类型：sel 强制空（不用 id，只存 label）*/
          var finalRef = (tp === 'custom') ? '' : sel;
          var r = QZD.goals.addLink(gid, tp, finalRef, lab);
          if(!r.ok){ UI.toast(r.error); return false; }
          UI.onStateChanged();
          return true;
        }
      });

      /* 绑定联动：类型切换时，select 候选自动刷新 */
      setTimeout(function(){
        var tpSel = document.getElementById('gl-type');
        var recSel = document.getElementById('gl-select');
        if(tpSel && recSel){
          tpSel.addEventListener('change', function(){
            recSel.innerHTML = renderSelectOptions(tpSel.value);
            document.getElementById('gl-label').value = ''; /* 换类型清空手动输入 */
          });
        }
      }, 20);
      return;
    }

    /* 删关联标签（chip 上的 ×）*/
    var linkRm = e.target.closest('[data-goal-link-remove]');
    if(linkRm){
      var parts = linkRm.getAttribute('data-goal-link-remove').split('|');
      /* 触发点击的 b 标签在最里面，要找 linkRm 这个 span 的 b 子元素，但事件冒泡已经到 span 了 */
      /* 这里 parts 是 [gid, type, ref] */
      if(e.target.tagName === 'B' || e.target.matches('b')){
        var r2 = QZD.goals.removeLink(parts[0], parts[1], parts[2]);
        if(!r2.ok){ UI.toast(r2.error); return; }
        UI.onStateChanged();
      }
      return;
    }

    /* 详情内：取消灵感关联 */
    var dUnlink = e.target.closest('[data-detail-unlink]');
    if(dUnlink){ QZD.idea.unlink(dUnlink.getAttribute('data-detail-unlink')); UI.onStateChanged(); return; }

    /* 详情内：快捷新建灵感并关联 */
    var quickAdd = e.target.closest('[data-ig-quick-add]');
    if(quickAdd){
      var qtext = (document.getElementById('ig-quick').value || '').trim();
      var qtag = (document.getElementById('ig-quick-tag').value || '').trim();
      var curGoalId = window.__goalDetailId;
      if(!curGoalId){ UI.toast('请先打开大计详情'); return; }
      if(!qtext){ UI.toast('写点什么'); return; }
      var r = QZD.idea.add(qtext, qtag);
      if(r.ok){
        QZD.idea.link(r.id, 'goal', curGoalId);
      }
      document.getElementById('ig-quick').value = '';
      document.getElementById('ig-quick-tag').value = '';
      UI.onStateChanged();
      /* UI.onStateChanged 会重建 DOM，modal 可能没了。需要重开详情 */
      var keepOpen = curGoalId;
      setTimeout(function(){ openDetail(keepOpen); }, 50);
      return;
    }

    /* 灵感 chip 取消关联 */
    var unlink = e.target.closest('[data-unlink]');
    if(unlink){ QZD.idea.unlink(unlink.getAttribute('data-unlink')); UI.onStateChanged(); return; }

    /* 点链路图里的灵感节点 → 弹详情 */
    var svgNode = e.target.closest('[data-node-id]');
    if(svgNode && svgNode.getAttribute('data-node-id').indexOf('idea:') === 0){
      var ideaId = svgNode.getAttribute('data-node-id').replace(/^idea:/, '');
      openIdeaEditor(ideaId);
      return;
    }

    /* 点灵感 chip → 编辑 */
    var edit = e.target.closest('[data-idea-edit]');
    if(edit){ openIdeaEditor(edit.getAttribute('data-idea-edit')); return; }
  });

  /* ---------- 灵感编辑弹层 ---------- */
  function openIdeaEditor(ideaId){
    var idea = QZD.idea.list().filter(function(x){ return x.id === ideaId; })[0];
    if(!idea) return;
    document.querySelectorAll('.modal-mask').forEach(function(m){ if(m.parentNode) m.parentNode.removeChild(m); });
    UI.modal({
      title: '编辑灵感',
      body:
        '<div class="field"><label>标签</label><input id="ie-tag" value="' + ESC(idea.tag || '') + '" maxlength="16"></div>' +
        '<div class="field"><label>内容</label><textarea id="ie-text" rows="3" maxlength="200" style="width:100%;padding:8px;border:1px solid var(--line);border-radius:4px;font-size:12px;font-family:inherit">' + ESC(idea.text || '') + '</textarea></div>' +
        '<div style="display:flex;gap:6px;margin-top:8px">' +
          '<button class="chip sm danger" id="ie-remove">🗑 删除此灵感（会从所有大计解除关联）</button>' +
        '</div>',
      ok: true, okText: '保存',
      onOk: function(){
        QZD.idea.edit(ideaId, {
          tag: document.getElementById('ie-tag').value,
          text: document.getElementById('ie-text').value
        });
        UI.onStateChanged();
      }
    });
    /* 删除按钮绑定 */
    setTimeout(function(){
      var rm = document.getElementById('ie-remove');
      if(rm) rm.addEventListener('click', function(){
        UI.confirm('确认删除此灵感？所有关联的大计会自动解除', function(){
          QZD.idea.remove(ideaId);
          UI.onStateChanged();
        });
      });
    }, 20);
  }

  /* 从当前详情弹层提取大计 id */
  function idFromModal(){
    /* 简化：打开详情时把 id 存在 window.__goalDetailId */
    return window.__goalDetailId || null;
  }

  /* Enter 提交 */
  document.addEventListener('keydown', function(e){
    if(e.key === 'Enter'){
      if(e.target && e.target.id === 'goal-title'){
        e.preventDefault(); document.querySelector('[data-goal-add]')?.click();
      }
    }
  });

  /* change 事件委托 —— 下拉选灵感关联 */
  document.addEventListener('change', function(e){
    if(e.target && e.target.id === 'ig-add-select' && e.target.value){
      var curGoalId = window.__goalDetailId;
      if(!curGoalId){ e.target.value = ''; return; }
      var ideaId = e.target.value;
      var curVal = ideaId;
      QZD.idea.link(ideaId, 'goal', curGoalId);
      UI.onStateChanged();
      var keepOpen = curGoalId;
      setTimeout(function(){ openDetail(keepOpen); }, 50);
    }
  });
})();
