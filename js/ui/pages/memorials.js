﻿/* ============================================================
   ui/pages/memorials.js · 御案奏折（唯一的专注入口）
   新建 / 筛选 / 拆小目标 / 开始专注 / 办结 / 搁置 / 删除
   奏折本身不计时，小目标才开正计时。
   ============================================================ */
(function(){
  var CFG = QZD.config;
  var C = CFG.MEMORIAL;
  var F = CFG.FOCUS || {};
  var UI = QZD.ui;
  var M = QZD.memorials;
  var POMO = QZD.pomodoro;

  var filter = 'all';
  var memView = 'list';   /* list | board | quad | link —— 列表 / 状态看板 / 重要紧急四象限 / 链路图 */

  function optionList(list, selected){
    return list.map(function(item){
      return '<option value="' + item.key + '"' + (item.key === selected ? ' selected' : '') + '>' +
        item.name + '</option>';
    }).join('');
  }

  function boundNow(m){
    return POMO.isActive() && POMO.boundId() === m.id;
  }

  function cardActions(m){
    if(m.status === 'banjie') return '<span class="badge ok">已办结</span>';

    if(boundNow(m)){
      return '<button class="btn ghost" disabled>专注中…</button>';
    }
    if(POMO.isActive()){
      return '<button class="btn ghost" disabled>另有专注进行中</button>';
    }

    var editBtn = '<button class="btn ghost sm" data-mem="edit" data-id="' + m.id +
      '">编辑</button>';
    var btns = '';
    if(m.status === 'daipi'){
      btns += '<button class="btn primary" data-pomo-start="' + m.id + '">开始专注</button>' +
        editBtn +
        '<button class="btn danger" data-mem="delete" data-id="' + m.id + '">删除</button>';
    }else if(m.status === 'pizhong'){
      btns += '<button class="btn primary" data-pomo-start="' + m.id + '">继续专注</button>' +
        editBtn +
        '<button class="btn ghost" data-mem="gezhi" data-id="' + m.id + '">搁置</button>' +
        '<button class="btn ghost" data-mem="finish" data-id="' + m.id + '">办结</button>';
    }else if(m.status === 'gezhi'){
      btns += '<button class="btn ghost" data-mem="restore" data-id="' + m.id + '">恢复</button>' +
        editBtn +
        '<button class="btn ghost" data-mem="finish" data-id="' + m.id + '">办结</button>';
    }
    return btns;
  }

  function subRow(m, sb, depth, rendered){
    rendered = rendered || {};
    var focusing = boundNow(m) && QZD.state.pomodoro.boundSubtaskId === sb.id;
    var kids = M.subChildrenOf(m, sb.id);
    var pct = sb.done ? 100 : 0;
    var ind = (depth * 24) + 'px';
    rendered[sb.id] = true;  /* 关键：递归也要标记，防止孤立项兜底重复 */

    var ops = '';
    if(m.status !== 'banjie'){
      ops += '<button class="chip sm" data-sub-rename="' + m.id + '|' + sb.id + '" title="重命名">改</button>';
      ops += '<button class="chip sm" data-sub-addchild="' + m.id + '|' + sb.id + '">＋子</button>';
      if(!focusing) ops += '<button class="chip sm" data-focus-sub="' + m.id + '|' + sb.id + '">专注</button>';
      ops += '<button class="chip sm danger" data-sub-del="' + m.id + '|' + sb.id + '">删</button>';
    }
    var meta = '';
    if(sb.focusMin) meta += '<span class="chip sm">专注 ' + sb.focusMin + ' 分</span>';
    if(sb.dueAt && !sb.done){
      var days = Math.ceil((sb.dueAt - Date.now()) / 86400000);
      meta += '<span class="chip sm' + (days < 0 ? ' danger' : '') + '">' +
        (days < 0 ? '逾期 ' + Math.abs(days) + ' 天' : '剩 ' + days + ' 天') + '</span>';
    }
    if(focusing) meta += '<span class="chip sm" style="background:var(--teng);color:#fff">专注中</span>';

    var kidsHTML = kids.length
      ? kids.map(function(c){ return subRow(m, c, depth + 1, rendered); }).join('')
      : '';

    return '<div class="mem-sub-card" style="margin-left:' + ind + '">' +
      '<div class="mem-top">' +
        '<div class="mem-title" style="font-size:13px">' +
          '<button class="fs-check' + (sb.done ? ' on' : '') + '" data-sub-toggle="' + m.id + '|' + sb.id +
            '" title="' + (sb.done ? '标记未完成' : '标记完成') + '" style="margin-right:4px">' +
            (sb.done ? '✓' : '') + '</button>' +
          UI.fmt.escape(sb.title) +
        '</div>' +
        '<div class="mem-actions">' + ops + '</div>' +
      '</div>' +
      '<div class="mini-bar' + (sb.done ? ' ok' : ' hot') + '" style="height:4px;margin:2px 0"><i style="width:' + pct + '%"></i></div>' +
      (meta ? '<div class="chip-row" style="margin:2px 0">' + meta + '</div>' : '') +
      kidsHTML +
    '</div>';
  }

  /* 递归渲染小目标树：subRow 内部已递归子节点，这里只负责根层 + 孤立项兜底 */
  function subsTree(m){
    var out = '', rendered = {};
    function walk(parentId, depth){
      M.subChildrenOf(m, parentId).forEach(function(sb){
        out += subRow(m, sb, depth, rendered);
      });
    }
    walk('', 0);
    /* 兜底：parentId 异常（孤儿）的小目标也渲染出来，depth=0 */
    (m.subtasks || []).forEach(function(sb){
      if(!rendered[sb.id]) out += subRow(m, sb, 0, rendered);
    });
    return out;
  }

  /* 课题下拉：还没有课题时只有「未分类」，并提示去钦天监建。
     selectId 可指定，供「新建」与「改挂课题」两个弹窗各自使用，避免 id 冲突。 */
  function subjectOptions(selected, selectId){
    selectId = selectId || 'mem-subject';
    var list = (QZD.study && QZD.study.subjects) ? QZD.study.subjects() : [];
    var opts = '<option value="">未分类</option>' + list.map(function(s){
      return '<option value="' + s.id + '"' + (s.id === selected ? ' selected' : '') + '>' +
        UI.fmt.escape(s.name) + '</option>';
    }).join('');
    var hint = list.length
      ? ''
      : '<p class="card-note" style="margin:4px 0 0">还没有课题 · 到「钦天监」页新建，专注分钟会按课题自动归类</p>';
    return '<select id="' + selectId + '">' + opts + '</select>' + hint;
  }

  function subjectName(id){
    var hit = '';
    ((QZD.study && QZD.study.subjects && QZD.study.subjects()) || []).forEach(function(s){
      if(s.id === id) hit = s.name;
    });
    return hit;
  }

  function memNode(m){
    var p = M.progress(m);
    var flashing = m.id === M.flash.id && Date.now() < M.flash.until;
    var ddl = '';
    if(m.dueAt && m.status !== 'banjie'){
      var days = Math.ceil((m.dueAt - Date.now()) / 86400000);
      var dl = days < 0 ? ('逾期 ' + Math.abs(days) + ' 天') : (days === 0 ? '今天截止' : ('剩 ' + days + ' 天'));
      ddl = '<span class="chip sm' + (days < 0 ? ' danger' : '') + '">' + dl + '</span>';
    }
    var subjChips = subjectName(m.subjectId)
      ? '<span class="chip sm">📚 ' + UI.fmt.escape(subjectName(m.subjectId)) + '</span>'
      : '';

    var ops = cardActions(m);

    /* 关联灵感（hatchedType='memorial', ref=m.id）*/
    var myIdeas = QZD.idea.list().filter(function(i){ return i.hatchedType === 'memorial' && i.hatchedRef === m.id; });
    var ideaChips = myIdeas.map(function(i){
      var display = i.tag || (i.text || '').slice(0, 10);
      return '<span class="chip sm idea-chip" data-idea-edit="' + UI.fmt.escape(i.id) + '" data-mem-idea-unlink="' + UI.fmt.escape(i.id) + '" title="点击查看灵感内容 · 点×取消关联">' +
        '🧠 ' + UI.fmt.escape(display) + '<b style="color:#A8573F;margin-left:4px;cursor:pointer;opacity:.5">×</b></span>';
    }).join('');
    var ideasBlock = '<div class="chip-row" style="margin:2px 0">' +
      '<span style="font-size:11px;color:#8a7130;margin-right:2px">🧠</span>' +
      (ideaChips || '<span style="font-size:11px;color:#9a9790">（未关联）</span>') +
      '<button class="chip sm" style="margin-left:4px;font-size:11px;padding:1px 6px" data-mem-idea-add="' + UI.fmt.escape(m.id) + '">＋灵感</button>' +
    '</div>';

    var subsHTML = subsTree(m);
    var subsEmpty = (!m.subtasks || m.subtasks.length === 0)
      ? '<div class="card-note" style="margin:4px 0 4px 28px">尚无小目标，先拆一条</div>'
      : '';

    var addInput = m.status !== 'banjie'
      ? '<div class="sec-add" style="margin-top:6px">' +
          '<input class="fs-new" id="ms-new-' + m.id + '" maxlength="' + (F.SUB_TITLE_MAX || 24) + '" placeholder="＋拆小目标">' +
          '<input class="fs-due-new" id="ms-due-' + m.id + '" type="date" title="小目标截止日（可选）">' +
          '<button class="btn ghost sm" data-sub-add="' + m.id + '">加</button>' +
        '</div>'
      : '';

    /* 重要性/紧急性的 cls 从 config 直接取 */
    var tagCls = (C.TAGS.filter(function(t){ return t.key === m.tag; })[0] || {}).cls || '';
    var priCls = M.priorityCls(m.priority);

    return '<div class="mem-card' + (flashing ? ' flash' : '') + '">' +
      '<div class="mem-top">' +
        '<div class="mem-title">' +
          '<span class="mc-tag ' + tagCls + '">' + UI.fmt.escape(M.tagName(m.tag)) + '</span>' +
          '<span class="mc-pri ' + priCls + '">' + UI.fmt.escape(M.priorityName(m.priority)) + '</span>' +
          UI.fmt.escape(m.title) +
        '</div>' +
        '<div class="mem-actions">' + ops + '</div>' +
      '</div>' +
      '<div class="mini-bar' + (p.pct >= 100 ? ' ok' : ' hot') + '" style="margin:4px 0"><i style="width:' + p.pct + '%"></i><span>' + p.pct + '%</span></div>' +
      '<div class="chip-row" style="margin:4px 0">' +
        '<span class="chip sm status-' + m.status + '">' + M.statusName(m.status) + '</span>' +
        subjChips + ddl +
        '<span class="chip sm">累 ' + p.focusMin + ' 分 · ' + p.sessions + ' 次</span>' +
      '</div>' +
      ideasBlock +
      subsEmpty +
      subsHTML +
      addInput +
    '</div>';
  }

  /* 看板/四象限用的紧凑卡片：标题 + 重要/紧急徽章 + 状态 + 进度 + 快捷操作 */
  function miniCard(m){
    var p = M.progress(m);
    var q = M.quadrantOf(m);
    var qn = (C.QUADRANTS.filter(function(x){ return x.key === q; })[0] || {}).name || '';
    var editable = (m.status !== 'banjie');

    /* 看板子任务：从根层递归走，保证嵌套顺序正确 */
    function miniSubRow(sb, depth){
      var kids = M.subChildrenOf(m, sb.id);
      var d = depth || 0;
      var html = '<div class="kb-sub' + (sb.done ? ' done' : '') + '"' +
          (d ? ' style="margin-left:' + (d * 12) + 'px"' : '') + '>' +
        '<button class="kb-sub-check" data-sub-toggle="' + m.id + '|' + sb.id + '" title="切换完成">' +
          (sb.done ? '✓' : '') + '</button>' +
        '<span class="kb-sub-title" title="' + UI.fmt.escape(sb.title) + '">' + UI.fmt.escape(sb.title) + '</span>' +
        (sb.focusMin ? '<span class="kb-sub-min">' + sb.focusMin + '分</span>' : '') +
        (m.status === 'banjie' ? '' :
          '<button class="ci-add-sub" data-sub-addchild="' + m.id + '|' + sb.id + '" title="加子项">＋</button>') +
        '<button class="ci-del" data-sub-del="' + m.id + '|' + sb.id + '" title="删除（含子项）">×</button>' +
      '</div>';
      if(kids.length){
        html += kids.map(function(c){ return miniSubRow(c, d + 1); }).join('');
      }
      return html;
    }
    var subs = M.subChildrenOf(m, '').map(function(sb){ return miniSubRow(sb, 0); }).join('');
    /* 兜底：孤立项 */
    var rendered = {};
    function markAll(sb){ rendered[sb.id] = true; M.subChildrenOf(m, sb.id).forEach(markAll); }
    M.subChildrenOf(m, '').forEach(markAll);
    (m.subtasks || []).forEach(function(sb){
      if(!rendered[sb.id]) subs += miniSubRow(sb, 0);
    });
    var addRow = editable
      ? '<div class="kb-sub-add"><input class="fs-new" id="ms-new-' + m.id +
          '" maxlength="' + (F.SUB_TITLE_MAX || 24) + '" placeholder="拆一个小目标">' +
        '<input class="fs-due-new" id="ms-due-' + m.id + '" type="date" title="截止日（可选）">' +
        '<button class="btn ghost sm" data-sub-add="' + m.id + '">+</button></div>'
      : '';
    var mTagCls = (C.TAGS.filter(function(t){ return t.key === m.tag; })[0] || {}).cls || '';
    var mPriCls = M.priorityCls(m.priority);
    return '<div class="kb-card kb-' + q + '">' +
      '<div class="kb-title" title="' + UI.fmt.escape(m.title) + '">' + UI.fmt.escape(m.title) + '</div>' +
      '<div class="kb-badges">' +
        '<span class="badge ' + mTagCls + '">' + M.tagName(m.tag) + '</span>' +
        '<span class="badge ' + mPriCls + '">' + M.priorityName(m.priority) + '</span>' +
        '<span class="badge status-' + m.status + ' sm">' + M.statusName(m.status) + '</span>' +
      '</div>' +
      (p.total ? '<div class="bar sm" style="margin:6px 0"><i style="width:' + p.pct + '%"></i></div>' : '') +
      (subs || '') + addRow +
      '<div class="kb-foot"><span class="card-note">' + qn + (p.total ? ' · 小目标 ' + p.done + '/' + p.total : '') + '</span>' +
        cardActions(m).replace(/class="btn ([^"]+)"/g, 'class="btn $1 sm"') + '</div>' +
    '</div>';
  }

  /* 状态看板：待批 / 批阅中 / 搁置+办结 三~四列 */
  function boardPanel(list){
    var cols = [
      { key: 'daipi', name: '待批阅', set: list.filter(function(m){ return m.status === 'daipi'; }) },
      { key: 'pizhong', name: '批阅中', set: list.filter(function(m){ return m.status === 'pizhong'; }) },
      { key: 'gezhi', name: '搁置', set: list.filter(function(m){ return m.status === 'gezhi'; }) },
      { key: 'banjie', name: '已办结', set: list.filter(function(m){ return m.status === 'banjie'; }) }
    ];
    return '<div class="kb-board">' + cols.map(function(c){
      return '<div class="kb-col"><div class="kb-col-head">' + c.name +
        ' <span class="card-note">' + c.set.length + '</span></div>' +
        (c.set.length ? c.set.map(miniCard).join('') : '<div class="kb-empty">空</div>') +
        '</div>';
    }).join('') + '</div>';
  }

  /* 四象限：重要×紧急，按 q1~q4 分格 */
  function quadPanel(list){
    return '<div class="kb-quad">' + C.QUADRANTS.map(function(q){
      var set = list.filter(function(m){ return M.quadrantOf(m) === q.key; });
      return '<div class="kb-qcell kb-' + q.cls + '"><div class="kb-qhead">' +
        '<b>' + q.name + '</b><span class="card-note">' + q.desc + ' · ' + set.length + '</span></div>' +
        (set.length ? set.map(miniCard).join('') : '<div class="kb-empty">空</div>') +
        '</div>';
    }).join('') + '</div>';
  }

  function viewBar(){
    var defs = [{ key: 'list', name: '列表' }, { key: 'board', name: '看板' }, { key: 'quad', name: '四象限' }];
    return '<div class="chronos-switch">' + defs.map(function(v){
      return '<button class="chip' + (memView === v.key ? ' active' : '') +
        '" data-mem-view="' + v.key + '">' + v.name + '</button>';
    }).join('') + '</div>';
  }

  /* ---------- SVG 链路图 ---------- */
  function svgLink(list){
    console.log('[memorials svgLink] list.length=', list.length);
    var nodes = [];
    var edges = [];
    var nodeMap = {};
    var colX = [60, 260, 460, 660, 860, 1060, 1260];
    var Y_GAP = 64;
    var curY = 30;  /* 全局 Y 游标 */

    /* 给某奏折下所有节点分配坐标（列布局，返回占用高度） */
    function layoutMem(m){
      var mnode = nodeMap['mem:'+m.id];
      if(!mnode) return 0;
      var depthMap = {};  /* depth -> [nodes] */
      /* BFS 收集这个奏折下的所有节点 */
      var q = [{id:'mem:'+m.id, d:0}];
      var seen = {};
      while(q.length){
        var cur = q.shift();
        if(seen[cur.id]) continue;
        seen[cur.id] = true;
        var n = nodeMap[cur.id];
        if(!n) continue;
        if(!depthMap[cur.d]) depthMap[cur.d] = [];
        depthMap[cur.d].push(n);
        /* 找子节点 */
        edges.forEach(function(e){
          if(e.from === cur.id && nodeMap[e.to]){
            q.push({id: e.to, d: cur.d + 1});
          }
        });
      }
      /* 计算这棵子树要多高（按最多节点那层算） */
      var maxCount = 1;
      Object.keys(depthMap).forEach(function(k){
        maxCount = Math.max(maxCount, depthMap[+k].length);
      });
      var subH = maxCount * Y_GAP;
      /* 分配 X（列）和 Y */
      Object.keys(depthMap).forEach(function(k){
        var d = +k;
        var col = depthMap[d];
        col.forEach(function(n, i){
          n.x = colX[Math.min(d, colX.length - 1)];
          n.y = curY + Y_GAP / 2 + Y_GAP * i;
        });
      });
      curY += subH + 20;  /* 奏折之间留 20px 间隙 */
      return subH + 20;
    }

    list.forEach(function(m){
      var p = M.progress(m);
      var mnode = { id:'mem:'+m.id, type:'mem', label:m.title, size:28,
        color: m.status === 'banjie' ? '#5E7A4A' : (m.status === 'pizhong' ? '#A8573F' : '#363A32'),
        _pct: p.pct, _status: m.status };
      nodeMap['mem:'+m.id] = mnode;
      nodes.push(mnode);

      (m.subtasks || []).filter(function(sb){ return !sb.parentId; }).forEach(function(sb){
        addSubNode(m.id, sb.id, 1);
        edges.push({ from:'mem:'+m.id, to:'sub:'+m.id+':'+sb.id, type:'spawn' });
      });
    });

    function addSubNode(mid, sid, depth){
      var sb = M.findSub(mid, sid);
      if(!sb) return;
      var nid = 'sub:'+mid+':'+sid;
      if(nodeMap[nid]) return;
      var m = M.find(mid);
      var kids = m ? M.subChildrenOf(m, sid) : [];
      var isLeaf = kids.length === 0;
      var color = sb.done ? '#5E7A4A' : (isLeaf ? '#3E6B5C' : '#2F6B78');
      var obj = { id:nid, type:'sub', label:sb.title, size:(depth > 2 ? 11 : 16), color:color,
        _d:depth, _leaf:isLeaf, _done:sb.done };
      nodeMap[nid] = obj;
      nodes.push(obj);
      kids.forEach(function(c){
        addSubNode(mid, c.id, depth + 1);
        edges.push({ from:nid, to:'sub:'+mid+':'+c.id, type:'parent' });
      });
    }

    if(nodes.length === 0){
      return '<div class="lk-empty-box" style="padding:40px;text-align:center">' +
        '<div class="lk-empty-title" style="font-size:14px;color:#8a8574">尚无奏折</div></div>';
    }

    /* 布局：每个奏折单独占一块 */
    list.forEach(function(m){ layoutMem(m); });

    var maxD = 0;
    nodes.forEach(function(n){
      var id = n.id;
      var d = id.indexOf('mem:') === 0 ? 0 : (n._d || 0);
      maxD = Math.max(maxD, d);
    });
    var W = colX[Math.min(maxD, colX.length - 1)] + 140;
    var H = curY + 30;

    /* 贝塞尔边 */
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

    var edgeColor = { spawn:'#DAD3C0', parent:'#3E6B5C' };
    var edgeSVG = edges.map(function(e){
      var a = nodeMap[e.from], b = nodeMap[e.to];
      if(!a || !b) return '';
      return '<path class="lk-edge" d="' + edgePath(a, b) + '"' +
        ' stroke="' + edgeColor[e.type] + '"' +
        ' stroke-width="' + (e.type === 'parent' ? '1.8' : '1') + '" fill="none"' +
        ' stroke-opacity="' + (e.type === 'spawn' ? '0.3' : '0.7') + '"/>';
    }).join('');

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

    var ESC = UI.fmt.escape;
    var nodeSVG = nodes.map(function(n){
      var fontSize = Math.max(7, Math.min(11, Math.round(n.size / 3)));
      var labelText = truncate(n.label, n.size, fontSize);
      var badge = n.type === 'mem' && n._pct != null
        ? '<text y="' + (n.size + 12) + '" font-size="8" fill="#8a8574" text-anchor="middle">' + n._pct + '%</text>'
        : '';
      return '<g class="lk-node" transform="translate(' + n.x + ',' + n.y + ')">' +
        '<circle r="' + n.size + '" fill="' + n.color + '"/>' +
        '<text text-anchor="middle" y="' + (fontSize / 3) + '" font-size="' + fontSize + '" font-weight="600" fill="#FFFFFF">' + ESC(labelText) + '</text>' +
        badge +
      '</g>';
    }).join('');

    var defs = '<defs><marker id="lk-arrow-mem" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">' +
      '<path d="M 0 0 L 10 5 L 0 10 z" fill="#3E6B5C"/></marker></defs>';

    return '<svg viewBox="0 0 ' + W + ' ' + H + '" class="lk-svg lk-svg-tree">' +
      defs + edgeSVG + nodeSVG + '</svg>';
  }

  function openCreate(){
    UI.modal({
      title: '新建奏折',
      body:
        '<div class="field"><label for="mem-title">奏折标题（≤ ' + C.TITLE_MAX + ' 字）</label>' +
          '<input id="mem-title" maxlength="' + C.TITLE_MAX + '" placeholder="如：COMSOL 行波电极仿真"></div>' +
        '<div class="field"><label for="mem-tag">重要性</label>' +
          '<select id="mem-tag">' + optionList(C.TAGS, C.TAGS[0].key) + '</select></div>' +
        '<div class="field"><label for="mem-subject">所属课题（可选）</label>' +
          subjectOptions() + '</div>' +
        '<div class="field"><label for="mem-priority">紧急性</label>' +
          '<select id="mem-priority">' + optionList(C.PRIORITIES, C.PRIORITIES[0].key) + '</select></div>' +
        '<div class="field"><label for="mem-due">截止日（可选）</label>' +
          '<input id="mem-due" type="date"></div>' +
        '<div class="field"><label for="mem-note">备注（可选）</label>' +
          '<textarea id="mem-note" rows="3" maxlength="200" placeholder="文献 / 仿真内容 / 验收标准"></textarea></div>' +
        '<p class="card-note">不设目标时长：奏折不绑定番茄钟，随时开始、做完办结。填了截止日会在「今日勤政」显示倒计时。</p>',
      ok: true,
      okText: '落案',
      onOk: function(mask){
        var res = M.create({
          title: mask.querySelector('#mem-title').value,
          tag: mask.querySelector('#mem-tag').value,
          priority: mask.querySelector('#mem-priority').value,
          subjectId: mask.querySelector('#mem-subject').value,
          dueAt: (mask.querySelector('#mem-due') || {}).value || null,
          note: mask.querySelector('#mem-note').value
        });
        if(!res.ok){ UI.toast(res.error); return false; }
        UI.toast('奏折已落案');
        UI.onStateChanged();
      }
    });
  }

  function dateInputVal(ts){
    if(!ts) return '';
    var d = new Date(ts);
    function p(n){ return n < 10 ? '0' + n : '' + n; }
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
  }
  /* 编辑奏折：所有初始值都可改，保存后经 onStateChanged 全视图同步 */
  function openEdit(id){
    var m = M.find(id);
    if(!m) return;
    UI.modal({
      title: '修订奏折',
      body:
        '<div class="field"><label for="ed-title">标题（≤ ' + C.TITLE_MAX + ' 字）</label>' +
          '<input id="ed-title" maxlength="' + C.TITLE_MAX + '" value="' + UI.fmt.escape(m.title) + '"></div>' +
        '<div class="field"><label for="ed-tag">重要性</label>' +
          '<select id="ed-tag">' + optionList(C.TAGS, m.tag) + '</select></div>' +
        '<div class="field"><label for="ed-subject">所属课题</label>' +
          subjectOptions(m.subjectId || '', 'ed-subject') + '</div>' +
        '<div class="field"><label for="ed-priority">紧急性</label>' +
          '<select id="ed-priority">' + optionList(C.PRIORITIES, m.priority) + '</select></div>' +
        '<div class="field"><label for="ed-due">截止日（留空即取消）</label>' +
          '<input id="ed-due" type="date" value="' + dateInputVal(m.dueAt) + '"></div>' +
        '<div class="field"><label for="ed-note">备注</label>' +
          '<textarea id="ed-note" rows="3" maxlength="200">' + UI.fmt.escape(m.note || '') + '</textarea></div>' +
        '<p class="card-note">改动会同步到所有视图；若改了课题，已记分钟会一并迁到新课题。</p>',
      ok: true, okText: '保存修订',
      onOk: function(mask){
        var res = M.update(id, {
          title: mask.querySelector('#ed-title').value,
          tag: mask.querySelector('#ed-tag').value,
          priority: mask.querySelector('#ed-priority').value,
          subjectId: mask.querySelector('#ed-subject').value,
          dueAt: mask.querySelector('#ed-due').value || null,
          note: mask.querySelector('#ed-note').value
        });
        if(!res.ok){ UI.toast(res.error); return false; }
        UI.toast('奏折已修订' + (res.movedMin ? ' · 同步迁移 ' + Math.round(res.movedMin) + ' 分' : ''));
        UI.onStateChanged();
      }
    });
  }

  function render(){
    var list = M.active(filter);
    var chips = [{ key: 'all', name: '全部' }].concat(C.TAGS);
    var chipHtml = chips.map(function(t){
      return '<button type="button" class="chip' + (filter === t.key ? ' active' : '') +
        '" data-mem-filter="' + t.key + '">' + t.name + '</button>';
    }).join('');

    var body;
    if(!list.length){
      body = '<div class="empty">御案空空，尚无奏折<span class="card-note">点右上角「新建奏折」落案</span></div>';
    }else if(memView === 'board'){
      body = boardPanel(list);
    }else if(memView === 'quad'){
      body = quadPanel(list);
    }else{
      body = '<div class="thesis-new" style="margin-bottom:10px">' +
        '<span class="card-note" style="margin-right:8px">在奏折下拆小目标 · 小目标支持无限嵌套</span>' +
      '</div>' +
      list.map(memNode).join('');
    }

    return '<section class="card">' +
      '<div class="card-head"><span class="card-title">御案奏折</span>' +
        '<button class="btn primary" data-mem="new">+ 新建奏折</button></div>' +
      '<p class="today-line">奏折就是专注任务：本身不计时，拆出小目标后点「专注」开始正计时；' +
        '奖励严格按专注分钟累计，放弃按五成计入。</p>' +
      '<div class="chip-row" style="margin:10px 0 8px">' + chipHtml + '</div>' +
      '<div style="margin-bottom:12px">' + viewBar() + '</div>' +
      body +
    '</section>' +
    '<p class="page-foot">办结的奏折移入归档起居注 · 累计分钟与专注次数会保留在奏折上</p>';
  }

  function pairOf(v){
    var a = String(v || '').split('|');
    return { mem: a[0], sub: a[1] };
  }

  /* 奏折页已并入「今日勤政」，这里只提供可嵌入区块 + 全局事件委托 */
  document.addEventListener('click', function(e){
      var chip = e.target.closest('[data-mem-filter]');
      if(chip){
        filter = chip.getAttribute('data-mem-filter');
        UI.renderPage();
        return;
      }

      var viewChip = e.target.closest('[data-mem-view]');
      if(viewChip){
        memView = viewChip.getAttribute('data-mem-view');
        UI.renderPage();
        return;
      }

      /* ＋灵感 —— modal 关联已有或快捷新建 */
      var ideaAdd = e.target.closest('[data-mem-idea-add]');
      if(ideaAdd){
        var mid = ideaAdd.getAttribute('data-mem-idea-add');
        var availIdeas = QZD.idea.list().filter(function(i){ return !i.hatchedType || !i.hatchedRef; });
        var modalBody =
          (availIdeas.length
            ? '<div class="field"><label>选择已有灵感</label>' +
              '<select id="mi2-add-select" style="max-width:280px">' +
                '<option value="">—— 选一条关联 ——</option>' +
                availIdeas.map(function(i){ return '<option value="' + UI.fmt.escape(i.id) + '">[' + UI.fmt.escape(i.tag||'') + '] ' + UI.fmt.escape(i.text.slice(0,26)) + '</option>'; }).join('') +
              '</select></div>'
            : '<div style="font-size:11px;color:#8a8574;margin:6px 0">当前没有待孵化的灵感，直接新建吧</div>') +
          '<div style="margin-top:10px;display:flex;gap:4px">' +
            '<input id="mi2-quick" placeholder="新建灵感并关联…" style="flex:1;padding:4px 8px;border:1px solid var(--line);border-radius:4px;font-size:12px">' +
            '<input id="mi2-quick-tag" placeholder="标签" maxlength="10" style="width:70px;padding:4px 6px;border:1px solid var(--line);border-radius:4px;font-size:12px">' +
            '<button class="btn primary" style="padding:4px 10px;font-size:12px" data-mi2-quick-add="' + UI.fmt.escape(mid) + '">＋</button>' +
          '</div>';
        UI.modal({ title: '关联灵感 · 奏折', body: modalBody });
        setTimeout(function(){
          var sel = document.getElementById('mi2-add-select');
          if(sel){
            sel.addEventListener('change', function(){
              if(sel.value){ QZD.idea.link(sel.value, 'memorial', mid); UI.onStateChanged(); }
            });
          }
        }, 20);
        return;
      }

      /* chip × —— 取消关联（只有点 × 才拦截 return；点 chip 本身 fall through 给 data-idea-edit）*/
      var ideaUnlink = e.target.closest('[data-mem-idea-unlink]');
      if(ideaUnlink){
        if(e.target.tagName === 'B' || e.target.matches('b')){
          QZD.idea.unlink(ideaUnlink.getAttribute('data-mem-idea-unlink'));
          UI.onStateChanged();
          return;
        }
      }

      /* modal 里快捷新建灵感 */
      var quickAdd = e.target.closest('[data-mi2-quick-add]');
      if(quickAdd){
        var qmid = quickAdd.getAttribute('data-mi2-quick-add');
        var qtext = (document.getElementById('mi2-quick').value || '').trim();
        var qtag = (document.getElementById('mi2-quick-tag').value || '').trim();
        if(!qtext){ UI.toast('写点什么'); return; }
        var r = QZD.idea.add(qtext, qtag);
        if(r.ok){ QZD.idea.link(r.id, 'memorial', qmid); }
        UI.onStateChanged();
        return;
      }

      /* 小目标增删改 */
      var subAdd = e.target.closest('[data-sub-add]');
      if(subAdd){
        var mid = subAdd.getAttribute('data-sub-add');
        var input = document.getElementById('ms-new-' + mid);
        var dueInput = document.getElementById('ms-due-' + mid);
        var rAdd = M.addSub(mid, input ? input.value : '', dueInput ? dueInput.value : null);
        if(!rAdd.ok){ UI.toast(rAdd.error); return; }
        UI.onStateChanged();
        return;
      }

      /* 在某个小目标下再加一级子项（prompt 输入，避免多级输入框 id 冲突） */
      var subChild = e.target.closest('[data-sub-addchild]');
      if(subChild){
        var pc = pairOf(subChild.getAttribute('data-sub-addchild'));
        var hitP = M.findSubById(pc.sub);
        UI.toast('在「' + (hitP ? hitP.sub.title : '?') + '」下加子项');
        var childTitle = window.prompt('在「' + (hitP ? hitP.sub.title : '') + '」下新增子项：', '');
        if(childTitle === null){ UI.toast('已取消'); return; }
        if(!String(childTitle).trim()){ UI.toast('请填子项名'); return; }
        var rc = M.addSub(pc.mem, childTitle, null, pc.sub);
        UI.toast(rc.ok ? '✓ 已添加子项' : '✗ ' + rc.error);
        if(!rc.ok) return;
        UI.onStateChanged();
        return;
      }

      /* 点小目标的 DDL 标签：改它的独立截止日 */
      var subDue = e.target.closest('[data-sub-due]');
      if(subDue){
        var pd = pairOf(subDue.getAttribute('data-sub-due'));
        var hit = M.findSubById(pd.sub);
        if(!hit) return;
        UI.modal({
          title: '小目标截止日',
          body: '<p class="card-note">' + UI.fmt.escape(hit.sub.title) + '</p>' +
            '<div class="field"><label for="sd-date">截止日（留空取消）</label>' +
            '<input id="sd-date" type="date" value="' + dateInputVal(hit.sub.dueAt) + '"></div>',
          ok: true, okText: '保存',
          onOk: function(mask){
            var r = M.setSubDue(pd.mem, pd.sub, mask.querySelector('#sd-date').value || null);
            if(!r.ok){ UI.toast(r.error); return false; }
            UI.toast(r.sub.dueAt ? ('已设 · ' + dateInputVal(r.sub.dueAt).slice(5)) : '已取消截止日');
            UI.onStateChanged();
          }
        });
        return;
      }

      var subToggle = e.target.closest('[data-sub-toggle]');
      if(subToggle){
        var p1 = pairOf(subToggle.getAttribute('data-sub-toggle'));
        var cur = M.findSubById(p1.sub);
        var next = cur ? !cur.sub.done : true;
        var rT = M.setSubDone(p1.mem, p1.sub, next);
        if(!rT.ok){ UI.toast(rT.error); return; }
        if(next) UI.toast('小目标达成 · ' + rT.sub.title);
        UI.onStateChanged();
        return;
      }

      var subDel = e.target.closest('[data-sub-del]');
      if(subDel){
        var p2 = pairOf(subDel.getAttribute('data-sub-del'));
        M.removeSub(p2.mem, p2.sub);
        UI.onStateChanged();
        return;
      }

      var subRen = e.target.closest('[data-sub-rename]');
      if(subRen){
        var pr = pairOf(subRen.getAttribute('data-sub-rename'));
        var hitR = M.findSubById(pr.sub);
        var newTitle = window.prompt('重命名小目标：', hitR ? hitR.sub.title : '');
        if(newTitle === null) return;
        var rr = M.renameSub(pr.mem, pr.sub, newTitle);
        if(!rr.ok){ UI.toast(rr.error); return; }
        UI.onStateChanged();
        return;
      }

      var btn = e.target.closest('[data-mem]');
      if(!btn) return;
      var act = btn.getAttribute('data-mem');
      var id = btn.getAttribute('data-id');

      if(act === 'new'){ openCreate(); return; }

      if(act === 'edit'){ openEdit(id); return; }

      if(act === 'subject'){
        var sm = M.find(id);
        if(!sm) return;
        UI.modal({
          title: '改挂课题 · ' + UI.fmt.escape(sm.title),
          body:
            '<div class="field"><label for="mem-subject-edit">所属课题（可选 · 未分类即留空）</label>' +
              subjectOptions(sm.subjectId || '', 'mem-subject-edit') + '</div>' +
            '<p class="card-note">改归属时会把这折已记的专注分钟一并迁到新课题，各图表同步更新；没想好归类，随时可回来调整。</p>',
          ok: true,
          okText: '保存',
          onOk: function(mask){
            var sid = mask.querySelector('#mem-subject-edit').value || null;
            var r = M.setSubject(id, sid);
            if(!r.ok){ UI.toast(r.error); return false; }
            var mv = r.movedMin ? (' · 同步迁移 ' + Math.round(r.movedMin) + ' 分钟历史') : '';
            UI.toast((sid ? ('已改挂 · ' + subjectName(sid)) : '已改为未分类') + mv);
            UI.onStateChanged();
          }
        });
        return;
      }

      if(act === 'delete'){
        var m = M.find(id);
        UI.confirm('确定撤下奏折「' + (m ? UI.fmt.escape(m.title) : '') + '」吗？其小目标与专注记录一并删除。', function(){
          var r = M.remove(id);
          if(!r.ok) UI.toast(r.error);
          else UI.toast('奏折已撤下');
          UI.onStateChanged();
        });
        return;
      }

      if(act === 'finish'){
        var mf = M.find(id);
        var pp = mf ? M.progress(mf) : { total: 0, done: 0 };
        var warn = (pp.total && pp.done < pp.total)
          ? '<p class="card-note">还有 ' + (pp.total - pp.done) + ' 个小目标未完成，仍要办结吗？</p>' : '';
        UI.confirm('<p>办结「' + (mf ? UI.fmt.escape(mf.title) : '') + '」？</p>' + warn, function(){
          var r = M.finish(id);
          if(!r.ok) UI.toast(r.error);
          else UI.toast('奏折已办结');
          UI.onStateChanged();
        }, { okText: '办结' });
        return;
      }

      if(act === 'gezhi'){
        var r2 = M.setStatus(id, 'gezhi');
        if(!r2.ok) UI.toast(r2.error);
        else{
          QZD.stateIO.pushLog('memorial', '奏折搁置：' + r2.memorial.title);
          UI.toast('奏折已搁置');
          UI.onStateChanged();
        }
        return;
      }

      if(act === 'restore'){
        var r3 = M.setStatus(id, 'pizhong');
        if(!r3.ok) UI.toast(r3.error);
        else UI.toast('奏折已恢复');
        UI.onStateChanged();
      }
  });

  UI.memorialBlock = { render: render };

  /* 小目标输入框回车提交 */
  document.addEventListener('keydown', function(e){
    if(e.key !== 'Enter') return;
    var id = e.target && e.target.id;
    if(!id || id.indexOf('ms-new-') !== 0) return;
    e.preventDefault();
    var mid = id.slice('ms-new-'.length);
    var b = document.querySelector('[data-sub-add="' + mid + '"]');
    if(b) b.click();
  });
})();
