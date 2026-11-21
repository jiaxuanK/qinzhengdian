/* ============================================================
   ui/pages/library.js · 文渊阁
   - 文献统一由 Zotero 管理，本页不再重复录入，只做跳转
   - 今日精读：粘贴 Zotero 清单导入队列，每天抽一篇打勾
   ============================================================ */
(function(){
  var UI = QZD.ui;
  var ESC = function(t){ return UI.fmt.escape(t); };
  function hasCard(x){
    return !!(x && (x.conclusion || x.abstract || x.takeaway || x.keyNumbers ||
      x.why || x.how || x.what || x.innovation || x.limitations ||
      (Array.isArray(x.keyFigures) && x.keyFigures.length) ||
      (Array.isArray(x.highlights) && x.highlights.length) ||
      (QZD.reading && QZD.reading.graph && !!QZD.reading.graph(x))));
  }
  function oneLine(s){ return String(s || '').replace(/\s+/g, ' ').slice(0, 120); }
  var DEPTH_LABEL = { 'full-text':'全文精读', 'abstract-only':'仅摘要', 'secondhand-notes':'二手笔记' };

  /* 关键词高亮：从 tags + concepts 收集，长的排前面（避免"电极"先切碎"行波电极"）。
     先转义再匹配——关键词也转义，含 < & 的字符不会破坏 HTML；用 split/join 而非正则，免注入。 */
  function keywordsOf(item){
    var raw = [].concat(Array.isArray(item.tags) ? item.tags : [],
                        Array.isArray(item.concepts) ? item.concepts : []);
    var seen = {}, out = [];
    raw.forEach(function(k){
      var s = String(k == null ? '' : k).trim();
      if(s.length < 2 || seen[s]) return;   /* 单字太碎，跳过 */
      seen[s] = true; out.push(s);
    });
    return out.sort(function(a, b){ return b.length - a.length; });
  }
  function highlight(text, kws){
    var s = ESC(text == null ? '' : text);
    if(!kws || !kws.length) return s;
    /* 一次性正则匹配所有关键词（长词优先），避免多次 split 把已插的标记当文本再切。
       关键词先转义 HTML、再转义正则元字符；在转义后的文本上匹配，含 < & 的词也安全。 */
    var pats = kws.map(function(k){
      return ESC(k).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }).filter(Boolean);
    if(!pats.length) return s;
    var re = new RegExp('(' + pats.join('|') + ')', 'g');
    return s.replace(re, '<mark class="kw">$1</mark>');
  }
  function keywordsHtml(item){
    var kws = keywordsOf(item);
    if(!kws.length) return '';
    return '<p class="card-kw"><span class="card-kw-label">关键词</span>' +
      kws.map(function(k){ return '<span class="card-kw-chip">' + ESC(k) + '</span>'; }).join('') +
      '</p>';
  }

  /* 对照阅读路线：按顺序读哪一节/看哪张图，带定位 */
  function pathHtml(item, kws){
    var arr = item.readingPath;
    if(!Array.isArray(arr) || !arr.length) return '';
    var lis = arr.map(function(s){
      var t = String(s == null ? '' : s);
      /* 「定位｜说明」写法：竖线前当定位标签 */
      var cut = t.indexOf('｜');
      if(cut > 0 && cut < 24){
        return '<li><span class="loc">' + ESC(t.slice(0, cut)) + '</span>' +
               highlight(t.slice(cut + 1), kws) + '</li>';
      }
      return '<li>' + highlight(t, kws) + '</li>';
    }).join('');
    return '<div class="card-path"><b>对照阅读路线</b><ol>' + lis + '</ol></div>';
  }

  /* 高光与批注：原文句（q）+ 定位（at）+ 我的批注（note） */
  function highlightsHtml(item, kws){
    var arr = item.highlights;
    if(!Array.isArray(arr) || !arr.length) return '';
    var blocks = arr.map(function(h){
      if(!h || typeof h !== 'object'){
        return '<div class="card-hl-item"><span class="card-hl-q">' +
               highlight(h, kws) + '</span></div>';
      }
      var q = h.q || h.quote || '';
      var at = h.at || h.locator || '';
      var note = h.note || h.annotation || '';
      return '<div class="card-hl-item">' +
        (q ? '<span class="card-hl-q">' + highlight(q, kws) + '</span>' : '') +
        (at ? '<span class="card-hl-at">' + ESC(at) + '</span>' : '') +
        (note ? '<span class="card-hl-note">' + highlight(note, kws) + '</span>' : '') +
        '</div>';
    }).join('');
    return '<div class="card-block card-hl-list"><b>高光与批注</b>' + blocks + '</div>';
  }

  /* 易误读点：图表口径、单位、条件不一致的地方 */
  function pitfallsHtml(item, kws){
    var arr = item.pitfalls;
    if(!arr) return '';
    var text = Array.isArray(arr) ? arr.map(function(x){ return '· ' + x; }).join('\n') : String(arr);
    return '<div class="card-block card-warn"><b>易误读点</b><p>' +
      highlight(text, kws).replace(/\n/g, '<br>') + '</p></div>';
  }

  /* ============================================================
     论证网络：把节点按「问题→假设→方法→证据→机制→结果→局限→结论→创新→课题」
     分列排布，箭头写清关系。图下再列节点全文与连边清单，手机上不必横向拖也能读。
     ============================================================ */
  var LG_NODE_COLOR = {
    question:'#8B6FC5', hypothesis:'#B07A9E', method:'#3E7B8C', evidence:'#587B4A',
    mechanism:'#9C6B1E', result:'#3E6B5C', limitation:'#A45B4B', conclusion:'#B8862C',
    innovation:'#6D6BB5', relevance:'#9A6B8C'
  };
  var LG_EDGE_COLOR = {
    addresses:'#3E7B8C', supports:'#587B4A', causes:'#9C6B1E', contrasts:'#A45B4B',
    refutes:'#B14141', extends:'#6D6BB5', limits:'#A45B4B', evidences:'#8A94A6'
  };
  function wrapText(s, per, maxLines){
    var lines = [], line = '', w = 0;
    function flush(){ if(line){ lines.push(line); line = ''; w = 0; } }
    for(var i = 0; i < s.length; i++){
      var ch = s.charAt(i);
      var cw = /[\x00-\xff]/.test(ch) ? 0.55 : 1;
      if(w + cw > per) flush();
      line += ch; w += cw;
    }
    flush();
    if(lines.length > maxLines){
      lines = lines.slice(0, maxLines);
      var last = lines[maxLines - 1];
      lines[maxLines - 1] = last.slice(0, Math.max(1, per - 1)) + '…';
    }
    return lines;
  }
  function logicGraphHtml(item, kws){
    if(!QZD.reading || !QZD.reading.graph) return '';
    var g = QZD.reading.graph(item);
    if(!g || !g.nodes || !g.nodes.length) return '';
    var meta = QZD.reading.graphMeta ? QZD.reading.graphMeta() : { nodeTypes:{}, nodeOrder:[], edgeTypes:{} };
    var NODE_W = 186, GAP = 42, PAD = 18, LINE = 15, per = 15;
    var groups = {}, byId = {}, byLabel = {};
    g.nodes.forEach(function(n){
      (groups[n.type] = groups[n.type] || []).push(n);
      byId[n.id] = n;
      byLabel[n.id] = n.label;
    });
    var order = (meta.nodeOrder || []).slice();
    Object.keys(groups).forEach(function(t){ if(order.indexOf(t) < 0) order.push(t); });
    var cols = order.filter(function(t){ return groups[t] && groups[t].length; });
    var boxes = [], maxY = PAD;
    cols.forEach(function(type, ci){
      var x = PAD + ci * (NODE_W + GAP), y = PAD;
      groups[type].forEach(function(n){
        var lines = wrapText(n.text || '（无正文）', per, 5);
        var h = Math.max(58, 48 + (lines.length - 1) * LINE);
        boxes.push({ n:n, x:x, y:y, w:NODE_W, h:h, lines:lines });
        y += h + 16;
      });
      maxY = Math.max(maxY, y);
    });
    var W = Math.max(320, PAD * 2 + cols.length * NODE_W + Math.max(0, cols.length - 1) * GAP);
    var H = Math.max(190, maxY + PAD);
    var paths = [];
    g.edges.forEach(function(e){
      var a = boxes.filter(function(b){ return b.n.id === e.from; })[0];
      var b = boxes.filter(function(b){ return b.n.id === e.to; })[0];
      if(!a || !b) return;
      var sx = a.x + a.w, sy = a.y + Math.min(a.h / 2, 30);
      var tx = b.x, ty = b.y + Math.min(b.h / 2, 30);
      var color = LG_EDGE_COLOR[e.type] || '#8A94A6', midX, midY;
      var d;
      if(tx > sx + 12){
        var c = Math.max(26, (tx - sx) / 2);
        d = 'M' + sx + ' ' + sy + ' C' + (sx + c) + ' ' + sy + ',' + (tx - c) + ' ' + ty + ',' + tx + ' ' + ty;
        midX = (sx + tx) / 2; midY = (sy + ty) / 2 - 5;
      }else{
        var lift = Math.min(64, 20 + Math.abs(tx - sx) * 0.4);
        d = 'M' + sx + ' ' + sy + ' C' + (sx + 55) + ' ' + (sy - lift) + ',' +
            (tx - 55) + ' ' + (ty - lift) + ',' + tx + ' ' + ty;
        midX = (sx + tx) / 2; midY = Math.min(sy, ty) - lift / 2 - 4;
      }
      paths.push('<path d="' + d + '" fill="none" stroke="' + color +
        '" stroke-width="1.5" marker-end="url(#lgArrow)" opacity=".85"/>');
      paths.push('<text x="' + midX + '" y="' + midY + '" text-anchor="middle" font-size="9" ' +
        'style="fill:' + color + ';paint-order:stroke;stroke:var(--card);stroke-width:3px">' +
        ESC((e.label || '').slice(0, 6)) + '</text>');
    });
    var rects = boxes.map(function(b){
      var color = LG_NODE_COLOR[b.n.type] || '#8A94A6';
      var name = b.n.label || meta.nodeTypes[b.n.type] || b.n.type;
      var body = b.lines.map(function(ln, i){
        return '<tspan x="' + (b.x + 11) + '" dy="' + (i ? LINE : 0) + '">' + ESC(ln) + '</tspan>';
      }).join('');
      return '<g><title>' + ESC(b.n.text) + (b.n.evidence ? '｜' + ESC(b.n.evidence) : '') + '</title>' +
        '<rect x="' + b.x + '" y="' + b.y + '" width="' + b.w + '" height="' + b.h + '" rx="8" ' +
          'style="fill:var(--card);stroke:' + color + '" stroke-width="1.4"/>' +
        '<rect x="' + b.x + '" y="' + (b.y + 8) + '" width="3" height="' + (b.h - 16) + '" rx="1.5" fill="' + color + '"/>' +
        '<text x="' + (b.x + 11) + '" y="' + (b.y + 19) + '" font-size="10" font-weight="700" style="fill:' + color + '">' +
          ESC(name) + '</text>' +
        '<text x="' + (b.x + 11) + '" y="' + (b.y + 38) + '" font-size="11" style="fill:var(--ink2)">' + body + '</text>' +
        '</g>';
    });
    var svg = '<svg class="lg-svg" viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" height="' + H +
      '" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="文献论证网络">' +
      '<defs><marker id="lgArrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" ' +
        'orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" fill="#9A9790"/></marker></defs>' +
      paths.join('') + rects.join('') + '</svg>';
    var legend = cols.map(function(t){
      return '<span><i style="background:' + (LG_NODE_COLOR[t] || '#8A94A6') + '"></i>' +
        ESC(meta.nodeTypes[t] || t) + '</span>';
    }).join('');
    var nodesHtml = g.nodes.map(function(n){
      var color = LG_NODE_COLOR[n.type] || '#8A94A6';
      return '<li><span class="lg-dot" style="background:' + color + '"></span>' +
        '<b>' + ESC(n.label) + '</b>' +
        (n.evidence ? '<span class="lg-ev">' + ESC(n.evidence) + '</span>' : '') +
        '<p>' + highlight(n.text, kws) + '</p></li>';
    }).join('');
    var edgesHtml = g.edges.length ? g.edges.map(function(e){
      var color = LG_EDGE_COLOR[e.type] || '#8A94A6';
      return '<li>' + ESC(byLabel[e.from] || e.from) +
        ' <span style="color:' + color + '">—' + ESC(e.label) + '→</span> ' +
        ESC(byLabel[e.to] || e.to) + '</li>';
    }).join('') : '<li class="lg-none">这张卡还没有显式连边，上面是按字段顺序生成的骨架。</li>';
    return '<div class="logic-graph">' +
      '<p class="card-note">从左到右是论证推进方向；箭头上的小字是两件事之间的关系。' +
        (g.auto ? '本图由卡片字段自动生成，点开原文核对后再由 qzd-paper-import 生成完整版。' : '') + '</p>' +
      '<div class="lg-scroll">' + svg + '</div>' +
      '<div class="lg-legend">' + legend + '</div>' +
      '<div class="lg-detail"><div class="lg-col"><b>节点全文</b><ol>' + nodesHtml + '</ol></div>' +
      '<div class="lg-col"><b>关系连边</b><ul>' + edgesHtml + '</ul></div></div>' +
      '</div>';
  }
  function openGraph(id){
    var item = null;
    (QZD.reading.list() || []).forEach(function(x){ if(x.id === id) item = x; });
    if(!item) return;
    var g = QZD.reading.graph(item);
    if(!g || !g.nodes || !g.nodes.length){ UI.toast('这张卡还没有结构化内容，画不出逻辑图'); return; }
    UI.modal({
      title: '逻辑图谱 · ' + String(item.title || '').slice(0, 34),
      body: logicGraphHtml(item, keywordsOf(item)),
      ok: false, cancelText: '关闭', wide: true
    });
  }

  /* 问 DeepSeek：把题目/DOI/结论拼成提问模板，复制后开网页。
     模板就是 4 行，用户粘进对话框直接补问题即可。 */
  function askPrompt(item){
    var lines = ['我在精读一篇论文，有几个问题想请教。', ''];
    if(item.title) lines.push('题目：' + item.title);
    var meta = [item.venue, item.year].filter(Boolean).join(' ');
    if(meta) lines.push('出处：' + meta);
    if(item.doi) lines.push('DOI：' + item.doi);
    if(item.conclusion) lines.push('卡片里的核心结论：' + item.conclusion);
    lines.push('', '我的问题：', '1. ');
    return lines.join('\n');
  }
  function copyText(text, onDone){
    if(typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText){
      navigator.clipboard.writeText(text).then(function(){ onDone(true); },
        function(){ onDone(false); });
      return;
    }
    var ok = false;
    try{
      var ta = document.createElement('textarea');
      ta.value = text; document.body.appendChild(ta); ta.select();
      ok = document.execCommand('copy');
      document.body.removeChild(ta);
    }catch(e){ ok = false; }
    onDone(ok);
  }

  /* 点「问 DeepSeek」：先把模板摊在弹窗里（能看见、能选、能手动复制），再给跳转按钮。
     不再依赖「静默复制成功」——剪贴板被拦时用户至少能看到提示词。 */
  function askBox(id){
    var item = null;
    (QZD.reading.list() || []).forEach(function(x){ if(x.id === id) item = x; });
    if(!item) return;
    var prompt = askPrompt(item);
    var url = (QZD.config && QZD.config.DEEPSEEK_URL) || 'https://chat.deepseek.com/';
    UI.modal({
      title: '问 DeepSeek · ' + ESC(String(item.title || '').slice(0, 34)),
      body: '<textarea class="ask-box" id="ask-box" spellcheck="false">' + ESC(prompt) + '</textarea>' +
        '<p class="card-note" id="ask-hint">正在复制…若失败，点文本框按 Ctrl+A、Ctrl+C。</p>' +
        '<p class="card-ask"><a class="btn primary" href="' + ESC(url) +
          '" target="_blank" rel="noopener">打开 DeepSeek ↗</a>' +
          '<span class="card-ask-hint">在新页面 Ctrl+V，光标已留在「1.」后面</span></p>',
      ok: false,
      cancelText: '关闭'
    });
    var box = document.getElementById('ask-box');
    if(box){
      try { box.focus(); box.select(); } catch(e){}
    }
    copyText(prompt, function(ok){
      var hint = document.getElementById('ask-hint');
      if(!hint) return;
      hint.textContent = ok
        ? '已复制到剪贴板：去新页面直接 Ctrl+V。没粘上的话，点文本框 Ctrl+A、Ctrl+C。'
        : '自动复制被系统拦了：点文本框按 Ctrl+A、Ctrl+C 复制，再点下面的按钮。';
    });
  }

  /* 文献卡详情弹窗：五问主线 + 证据 + 学习视角，缺哪块就不显示哪块 */
  function openCard(id){
    var item = null;
    (QZD.reading.list() || []).forEach(function(x){ if(x.id === id) item = x; });
    if(!item) return;
    var meta = [item.authors, item.year, item.venue].filter(Boolean).join(' · ');
    var rows = [];
    var kws = keywordsOf(item);
    var chips = [];
    if(DEPTH_LABEL[item.readDepth]) chips.push(DEPTH_LABEL[item.readDepth]);
    if(chips.length){
      rows.push('<p class="card-chips">' + chips.map(function(t){
        return '<span class="chip sm">' + ESC(t) + '</span>';
      }).join(' ') + '</p>');
    }
    /* 卡顶醒目关键词区：tags + concepts 合并去重，正文里这些词也会高亮 */
    rows.push(keywordsHtml(item));
    if(meta || item.doi){
      rows.push('<p class="card-note">' + ESC(meta) +
        (item.doi ? (meta ? ' · ' : '') + 'DOI ' + ESC(item.doi) : '') + '</p>');
    }
    function block(label, val){
      if(!val) return '';
      var text;
      if(Array.isArray(val)){
        text = val.map(function(x){ return '· ' + (typeof x === 'string' ? x : JSON.stringify(x)); }).join('\n');
      }else{
        text = String(val);
      }
      return '<div class="card-block"><b>' + label + '</b><p>' +
        highlight(text, kws).replace(/\n/g, '<br>') + '</p></div>';
    }
    rows.push(block('摘要', item.abstract));
    rows.push(block('为什么做', item.why));
    rows.push(block('怎么做', item.how));
    rows.push(block('做了什么', item.what));
    rows.push(block('核心结论', item.conclusion));
    rows.push(block('创新点', item.innovation));
    rows.push(block('关键数字', item.keyNumbers));
    rows.push(block('关键图', item.keyFigures));
    rows.push(pathHtml(item, kws));
    rows.push(highlightsHtml(item, kws));
    rows.push(pitfallsHtml(item, kws));
    rows.push(block('局限', item.limitations));
    rows.push(block('与我课题的关联', item.relevance));
    rows.push(block('可借鉴点', item.takeaway));
    rows.push(block('概念链', item.concepts));
    rows.push(block('下一步', item.studyNext));
    if(Array.isArray(item.resources) && item.resources.length){
      var res = item.resources.map(function(r){
        if(!r || typeof r !== 'object') return '';
        var label = String(r.text || r.title || '').trim();
        if(!label) return '';
        var kind = { paper:'论文', book:'书', popular:'科普' }[r.kind] || '';
        return '· ' + (kind ? kind + '｜' : '') + ESC(label) +
          (r.link ? ' <a href="' + ESC(r.link) + '" target="_blank" rel="noopener">↗</a>' : '');
      }).filter(Boolean);
      if(res.length) rows.push('<div class="card-block"><b>延伸资源</b><p>' + res.join('<br>') + '</p></div>');
    }
    if(item.evidence) rows.push('<p class="card-note">证据位置：' + ESC(item.evidence) + '</p>');
    if(item.url) rows.push('<p class="card-note"><a href="' + ESC(item.url) +
      '" target="_blank" rel="noopener">打开原文 ↗</a></p>');
    if(item.zoteroKey){
      rows.push('<p class="card-note"><a href="zotero://select/items/' + ESC(item.zoteroKey) +
        '">在 Zotero 中打开 ↗</a></p>');
    }
    rows.push('<p class="card-ask">' +
      (QZD.reading.graph(item) ? '<button class="btn primary sm" data-card-graph="' + ESC(item.id) +
        '">看逻辑图 ↗</button>' : '') +
      '<button class="btn ghost" data-card-ask="' + ESC(item.id) + '">问 DeepSeek ↗</button>' +
      '<span class="card-ask-hint">弹出提问模板，复制后开网页（本机剪贴板可能被拦，见弹窗内提示）</span></p>');
    UI.modal({
      title: item.title,
      body: rows.join('') || '<p class="card-note">这张卡只有标题，未带结构化信息。</p>',
      ok: false, cancelText: '关闭', wide: true
    });
  }

  function zoteroCard(){
    return '<section class="card">' +
      '<div class="card-head"><span class="card-title">文 渊 阁</span>' +
        '<span class="card-note">文献统一由 Zotero 管理</span></div>' +
      '<div class="btn-row zotero-actions">' +
        '<a class="btn primary" href="zotero://select/library">Zotero 桌面端</a>' +
        '<a class="btn ghost" href="https://www.zotero.org/my/library" target="_blank" rel="noopener">Zotero 网页版 ↗</a>' +
        '<a class="btn ghost" href="' + ESC((QZD.config && QZD.config.DEEPSEEK_URL) || 'https://chat.deepseek.com/') +
          '" target="_blank" rel="noopener">DeepSeek 网页版 ↗</a>' +
        '<button class="btn ghost" data-card-import>导入文献卡</button>' +
      '</div>' +
      '<input type="file" id="card-file" accept=".json,application/json" style="display:none">' +
      '<p class="card-note" style="margin-top:8px">导入流程：AI 用 qzd-paper-import skill 生成 .json 卡 → 点「导入文献卡」选取（含结论/数字/课题关联）；.bib 可拖进 Zotero。</p>' +
    '</section>';
  }

  function readCard(){
    if(!QZD.reading) return '';
    var st = QZD.reading.stats();
    var pick = QZD.reading.todayPick();
    var q = QZD.reading.queued();

    var pickHtml;
    if(pick){
      var title = pick.url
        ? '<a href="' + ESC(pick.url) + '" target="_blank" rel="noopener">' + ESC(pick.title) + ' ↗</a>'
        : ESC(pick.title);
      pickHtml = '<div class="read-card">' +
        '<div class="read-title">' + title + '</div>' +
        '<div class="read-meta">今日精读 · 队列还剩 ' + q.length + ' 篇</div>' +
        (hasCard(pick) ? '<p class="card-note" style="margin-top:7px">' + ESC(oneLine(pick.conclusion || pick.takeaway || '')) + '</p>' : '') +
        '<div class="btn-row" style="margin-top:8px">' +
          '<button class="btn primary sm" data-read-done="' + pick.id + '">读完了</button>' +
          (hasCard(pick) ? '<button class="btn ghost sm" data-card-view="' + pick.id + '">看卡片</button>' : '') +
          (q.length > 1 ? '<button class="btn ghost sm" data-read-next>换一篇</button>' : '') +
        '</div>' +
      '</div>';
    }else{
      pickHtml = '<div class="read-card">' +
        '<div class="read-title">队列是空的</div>' +
        '<div class="read-meta">把 Zotero 里想读的清单粘贴到下方导入</div>' +
      '</div>';
    }

    var rows = q.slice(0, 8).map(function(x){
      return '<div class="read-row">' +
        '<span class="read-name">' + ESC(x.title) + '</span>' +
        (hasCard(x) ? '<button class="chip sm" data-card-view="' + x.id + '">看卡</button>' : '') +
        (x.id !== (pick && pick.id) ? '<button class="chip sm" data-read-pick="' + x.id + '">设为今日</button>' : '') +
        '<button class="chip sm danger" data-read-del="' + x.id + '">移除</button>' +
      '</div>';
    }).join('');

    /* 已读复盘区：数据一直在，这里按读完时间倒序列出，可看卡、可重读移回队列 */
    var doneList = QZD.reading.done();
    var doneHtml = '';
    if(doneList.length){
      var dRows = doneList.slice(0, 30).map(function(x){
        var when = x.doneAt ? UI.fmt.time(x.doneAt).slice(0, 10) : '';
        return '<div class="read-row done">' +
          '<span class="read-name">' + ESC(x.title) + '</span>' +
          (hasCard(x) ? '<button class="chip sm" data-card-view="' + x.id + '">看卡</button>' : '') +
          (x.rereadCount ? '<span class="chip sm">重读 ' + x.rereadCount + '</span>' : '') +
          '<span class="read-done-date">' + when + '</span>' +
          '<button class="chip sm" data-read-reopen="' + x.id + '">重读</button>' +
          '<button class="chip sm danger" data-read-del="' + x.id + '">移除</button>' +
        '</div>';
      }).join('');
      doneHtml = '<details class="read-done-fold">' +
        '<summary>已读复盘 · ' + doneList.length + ' 篇（点开查看）</summary>' +
        '<div class="read-queue done-list">' + dRows + '</div>' +
        '<p class="card-note" style="margin-top:6px">读完的文献一直留着，点「重读」移回未读队列并设为今日精读。</p>' +
      '</details>';
    }

    return '<section class="card">' +
      '<div class="card-head"><span class="card-title">今 日 精 读</span>' +
        '<span class="card-note">队列 ' + st.queued + ' · 已读 ' + st.done + ' · 本周 ' + st.doneWeek + '</span></div>' +
      pickHtml +
      (rows ? '<div class="read-queue">' + rows + '</div>' : '') +
      doneHtml +
      '<div class="read-import">' +
        '<textarea id="read-import-text" placeholder="粘贴 Zotero 清单：每行「标题 + Tab + 链接」，或「标题 | 链接」；也可只贴标题"></textarea>' +
        '<div class="btn-row" style="margin-top:7px">' +
          '<button class="btn ghost sm" data-read-import>导入清单</button>' +
        '</div>' +
      '</div>' +
    '</section>';
  }

  UI.register('library', function(){
    return zoteroCard() + readCard();
  });

  /* 读完后顺手记一条灵感（可跳过） */
  function promptIdea(item){
    if(!QZD.idea || !item) return;
    UI.modal({
      title: '读完《' + item.title + '》',
      body: '<p class="card-note">顺手记一条灵感（可跳过），会进「灵感罐」。</p>' +
        '<div class="field"><textarea id="read-idea" rows="3" maxlength="200" ' +
          'placeholder="这篇最有用的点是什么？可以怎么用到我的课题上？"></textarea></div>',
      ok: true,
      okText: '记下',
      cancelText: '跳过',
      onOk: function(){
        var ta = document.getElementById('read-idea');
        var txt = ta ? String(ta.value || '').trim() : '';
        if(txt){
          QZD.idea.add(txt, '文献');
          UI.toast('已记入灵感罐');
        }
        UI.onStateChanged();
      }
    });
  }

  document.addEventListener('click', function(e){
    /* 导入 AI 生成的结构化文献卡（.json） */
    if(e.target.closest('[data-card-import]')){
      var fi = document.getElementById('card-file');
      if(fi){ fi.value = ''; fi.click(); }
      return;
    }
    /* 看文献卡详情 */
    var cv = e.target.closest('[data-card-view]');
    if(cv){ openCard(cv.getAttribute('data-card-view')); return; }

    /* 论证网络：整篇文章的逻辑关联图 */
    var gv = e.target.closest('[data-card-graph]');
    if(gv){ openGraph(gv.getAttribute('data-card-graph')); return; }

    /* 问 DeepSeek：摊开模板（可选中复制）+ 跳转按钮 */
    var ask = e.target.closest('[data-card-ask]');
    if(ask){ askBox(ask.getAttribute('data-card-ask')); return; }

    if(e.target.closest('[data-read-import]')){
      var ta = document.getElementById('read-import-text');
      var r = QZD.reading.importText(ta ? ta.value : '');
      if(!r.ok){ UI.toast(r.error); return; }
      UI.toast('已导入 ' + r.added + ' 篇（跳过重复）');
      UI.onStateChanged();
      return;
    }
    var done = e.target.closest('[data-read-done]');
    if(done){
      var d = QZD.reading.markDone(done.getAttribute('data-read-done'));
      if(!d.ok){ UI.toast(d.error); return; }
      UI.toast('已读完 · ' + d.item.title);
      UI.onStateChanged();
      promptIdea(d.item);
      return;
    }
    if(e.target.closest('[data-read-next]')){
      var n = QZD.reading.nextPick();
      if(!n.ok){ UI.toast(n.error); return; }
      UI.onStateChanged();
      return;
    }
    var pickBtn = e.target.closest('[data-read-pick]');
    if(pickBtn){
      var s = QZD.reading.setPick(pickBtn.getAttribute('data-read-pick'));
      if(!s.ok){ UI.toast(s.error); return; }
      UI.onStateChanged();
      return;
    }
    var reopenBtn = e.target.closest('[data-read-reopen]');
    if(reopenBtn){
      var ro = QZD.reading.reopen(reopenBtn.getAttribute('data-read-reopen'));
      if(!ro.ok){ UI.toast(ro.error); return; }
      UI.toast('已移回未读 · 重读「' + ro.item.title + '」');
      UI.onStateChanged();
      return;
    }
    var del = e.target.closest('[data-read-del]');
    if(del){
      QZD.reading.remove(del.getAttribute('data-read-del'));
      UI.onStateChanged();
      return;
    }
  });

  /* 文献卡文件选择：读 JSON → 导入 */
  document.addEventListener('change', function(e){
    if(!e.target || e.target.id !== 'card-file') return;
    var f = e.target.files && e.target.files[0];
    if(!f) return;
    var reader = new FileReader();
    reader.onload = function(){
      var res;
      try { res = QZD.reading.importCards(String(reader.result || '')); }
      catch(err){ UI.toast('导入失败：' + (err && err.message ? err.message : err)); return; }
      if(!res || !res.ok){ UI.toast((res && res.error) || '导入失败'); return; }
      UI.toast('文献卡导入 · 新增 ' + res.added + ' · 补全 ' + res.merged);
      UI.onStateChanged();
    };
    reader.onerror = function(){ UI.toast('读取文件失败'); };
    reader.readAsText(f, 'utf-8');
  });
})();
