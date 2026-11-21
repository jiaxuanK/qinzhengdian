/* ============================================================
   systems/reading.js · 今日精读（文献队列）
   - 从 Zotero 导出的清单里粘贴文本导入（标题 + 链接，无需联网）
   - 每天抽一篇「今日精读」，读完打勾；周报统计本周精读篇数
   ============================================================ */
(function(){
  var IO = QZD.stateIO;

  function st(){ return QZD.state; }
  function R(){
    if(!st().reading || typeof st().reading !== 'object') st().reading = {};
    var r = st().reading;
    if(!Array.isArray(r.queue)) r.queue = [];
    if(typeof r.pickDate !== 'string') r.pickDate = '';
    if(r.pickId === undefined) r.pickId = null;
    return r;
  }
  function uid(){
    return 'rd' + Date.now().toString(36) + Math.floor(Math.random() * 1000).toString(36);
  }
  function normUrl(s){
    s = String(s || '').trim();
    if(!s) return '';
    if(/^(https?:|zotero:|mailto:)/i.test(s)) return s;
    if(/^10\.\d{4,9}\//.test(s)) return 'https://doi.org/' + s;
    if(/^[\w.-]+\.[a-z]{2,}([\/?#]|$)/i.test(s)) return 'https://' + s;
    return '';
  }
  function looksUrl(s){ return /^(https?:|zotero:|10\.\d{4,9}\/|[\w.-]+\.[a-z]{2,}[\/?#]?$)/i.test(String(s || '').trim()); }
  /* DOI 归一化：去 https://doi.org/ 前缀、去空白、小写，用于跨来源去重 */
  function normDoi(s){
    return String(s || '').trim().replace(/^https?:\/\/(dx\.)?doi\.org\//i, '').replace(/\s+/g, '').toLowerCase();
  }

  /* ============================================================
     文献逻辑图谱（logicGraph）
     - 节点：问题 / 假设 / 方法 / 证据 / 机制 / 结果 / 局限 / 结论 / 创新 / 课题关联
     - 边：回应 / 支撑 / 导致 / 对比 / 反驳 / 延伸 / 限定 / 证据来源
     - 新卡由 qzd-paper-import 显式输出；旧卡从五问字段自动补一张基础图
     ============================================================ */
  var NODE_TYPES = {
    question:'研究问题', hypothesis:'假设', method:'方法', evidence:'数据证据',
    mechanism:'机制', result:'结果', limitation:'局限', conclusion:'核心结论',
    innovation:'创新点', relevance:'课题关联'
  };
  var NODE_ORDER = ['question','hypothesis','method','evidence','mechanism',
                    'result','limitation','conclusion','innovation','relevance'];
  var EDGE_TYPES = {
    addresses:'回应', supports:'支撑', causes:'导致', contrasts:'对比',
    refutes:'反驳', extends:'延伸', limits:'限定', evidences:'证据来源'
  };
  function cleanText(s, max){
    return String(s == null ? '' : s).replace(/\s+/g, ' ').trim().slice(0, max || 300);
  }
  /* 显式图归一化：限长、去重、过滤悬空边，保证渲染端不会吃到脏数据 */
  function normGraph(g){
    if(!g || typeof g !== 'object') return null;
    var rawNodes = Array.isArray(g.nodes) ? g.nodes : [];
    if(!rawNodes.length) return null;
    var nodes = [], seen = {};
    rawNodes.slice(0, 24).forEach(function(n, i){
      if(!n || typeof n !== 'object') return;
      var id = cleanText(n.id, 40) || ('n' + (i + 1));
      if(seen[id]) return;
      seen[id] = true;
      var type = cleanText(n.type, 20).toLowerCase();
      if(!NODE_TYPES[type]) type = 'mechanism';
      nodes.push({
        id: id,
        type: type,
        label: cleanText(n.label, 12) || NODE_TYPES[type],
        text: cleanText(n.text, 300),
        evidence: cleanText(n.evidence, 60)
      });
    });
    if(!nodes.length) return null;
    var ids = {}, edges = [], eseen = {};
    nodes.forEach(function(n){ ids[n.id] = true; });
    (Array.isArray(g.edges) ? g.edges : []).slice(0, 60).forEach(function(e){
      if(!e || typeof e !== 'object') return;
      var from = cleanText(e.from, 40), to = cleanText(e.to, 40);
      if(!ids[from] || !ids[to] || from === to) return;
      var type = cleanText(e.type, 20).toLowerCase();
      if(!EDGE_TYPES[type]) type = 'supports';
      var key = from + '>' + to + '|' + type;
      if(eseen[key]) return;
      eseen[key] = true;
      edges.push({ from:from, to:to, type:type,
                   label:cleanText(e.label, 16) || EDGE_TYPES[type] });
    });
    return { nodes:nodes, edges:edges, auto:g.auto === true };
  }
  /* 旧卡基础图：只连字段里真实存在的内容，不替作者编假设或机制 */
  function buildAutoGraph(item){
    var nodes = [];
    function add(id, type, label, val, ev){
      var text = Array.isArray(val)
        ? val.map(function(x){ return typeof x === 'string' ? x : JSON.stringify(x); }).join('；')
        : String(val == null ? '' : val);
      text = cleanText(text, 300);
      if(!text) return false;
      nodes.push({ id:id, type:type, label:label, text:text, evidence:ev || '' });
      return true;
    }
    add('q_why', 'question', '研究问题', item.why);
    add('m_how', 'method', '方法', item.how);
    add('e_num', 'evidence', '关键数字', item.keyNumbers, '关键数字');
    add('e_fig', 'evidence', '关键图', item.keyFigures, '关键图');
    add('k_concept', 'mechanism', '概念链', item.concepts);
    add('r_what', 'result', '结果', item.what);
    add('l_limit', 'limitation', '局限', item.limitations);
    add('c_main', 'conclusion', '核心结论', item.conclusion);
    add('i_new', 'innovation', '创新点', item.innovation);
    add('x_rel', 'relevance', '课题关联', item.relevance);
    add('x_take', 'relevance', '可借鉴', item.takeaway);
    if(!nodes.length) return null;
    var has = {}, edges = [];
    nodes.forEach(function(n){ has[n.id] = true; });
    function link(from, to, type, label){
      if(has[from] && has[to]) edges.push({ from:from, to:to, type:type, label:label });
    }
    link('q_why', 'm_how', 'addresses', '用此法回应');
    link('m_how', 'e_num', 'evidences', '产出');
    link('m_how', 'e_fig', 'evidences', '产出');
    link('k_concept', 'm_how', 'supports', '概念支撑');
    link('e_num', 'r_what', 'supports', '数字支撑');
    link('e_fig', 'r_what', 'supports', '图示支撑');
    link('r_what', 'c_main', 'supports', '由此得出');
    link('l_limit', 'c_main', 'limits', '限定边界');
    link('c_main', 'i_new', 'extends', '凝为新意');
    link('c_main', 'x_rel', 'extends', '迁移到课题');
    link('x_rel', 'x_take', 'supports', '落成动作');
    return { nodes:nodes, edges:edges, auto:true };
  }
  /* 显式图优先；自动图每次按当前字段重算，避免后补字段后图还是旧的 */
  function graphOf(item){
    if(!item || typeof item !== 'object') return null;
    var explicit = normGraph(item.logicGraph);
    if(explicit && !explicit.auto) return explicit;
    return buildAutoGraph(item);
  }
  function graphMeta(){
    return { nodeTypes:NODE_TYPES, nodeOrder:NODE_ORDER, edgeTypes:EDGE_TYPES };
  }

  /* 解析粘贴文本：支持 Tab 分隔（Zotero 导出）或 "标题 | 链接"，也支持纯标题行 */
  function parseText(text){
    var out = [];
    String(text || '').split(/\r?\n/).forEach(function(line){
      var s = String(line || '').replace(/^\uFEFF/, '').trim();
      if(!s) return;
      if(/^["']?标题["']?\s*[\t|,]/.test(s) || /^["']?title["']?\s*[\t|,]/i.test(s)) return; /* 表头 */
      var fields;
      if(s.indexOf('\t') >= 0) fields = s.split('\t');
      else if(/\s\|\s/.test(s)) fields = s.split(/\s\|\s/);
      else fields = [s];
      fields = fields.map(function(x){
        return String(x || '').replace(/^"|"$/g, '').trim();
      }).filter(Boolean);
      if(!fields.length) return;
      var title = '', url = '';
      fields.forEach(function(f){
        if(!url && looksUrl(f)) url = normUrl(f);
        else if(!title) title = f;
      });
      if(!title && url) title = url;
      if(!title) return;
      if(/^(标题|title|url|链接)$/i.test(title)) return;
      out.push({ title: title.slice(0, 120), url: url });
    });
    return out;
  }

  function importText(text){
    var items = parseText(text);
    if(!items.length) return { ok: false, error: '没解析到条目，请粘贴「标题 + 链接」清单' };
    var r = R();
    var seen = {};
    r.queue.forEach(function(x){ seen[x.title] = true; });
    var added = 0;
    items.slice(0, 300).forEach(function(it){
      if(seen[it.title]) return;
      seen[it.title] = true;
      r.queue.push({ id: uid(), title: it.title, url: it.url, addedAt: Date.now(), doneAt: null });
      added++;
    });
    IO.save();
    return { ok: true, added: added, total: r.queue.length, parsed: items.length };
  }

  /* 导入 AI 生成的结构化文献卡（skill 输出的 JSON）。
     兼容数组或 {cards:[...]}；标题必填，其余字段可选（缺省不覆盖）。
     用标题去重：已存在则合并补全结构化字段，不重复入队。 */
  function importCards(payload){
    var arr = [];
    if(Array.isArray(payload)) arr = payload;
    else if(payload && Array.isArray(payload.cards)) arr = payload.cards;
    else if(typeof payload === 'string'){
      try {
        var parsed = JSON.parse(payload);
        arr = Array.isArray(parsed) ? parsed : (parsed.cards || []);
      }catch(e){ return { ok:false, error:'JSON 解析失败：' + e.message }; }
    }
    if(!arr.length) return { ok:false, error:'没有可导入的文献卡' };

    var FIELDS = ['authors','year','venue','doi','abstract','conclusion',
                  'keyNumbers','relevance','takeaway','bibtex','zoteroKey','source','tags',
                  'why','how','what','innovation','limitations','keyFigures','evidence',
                  'readDepth','concepts','studyNext','resources',
                  /* 对照阅读三件套：路线 / 高光批注 / 易误读点 */
                  'readingPath','highlights','pitfalls',
                  /* 论证网络：节点 + 关系边（单独归一化，见下方 logicGraph 分支） */
                  'logicGraph'];
    var r = R(), byTitle = {}, byDoi = {}, added = 0, merged = 0;
    r.queue.forEach(function(x){
      byTitle[x.title] = x;
      if(x.doi) byDoi[normDoi(x.doi)] = x;
    });
    arr.forEach(function(c){
      if(!c || typeof c !== 'object') return;
      var title = String(c.title || '').trim().slice(0, 120);
      if(!title) return;
      var url = normUrl(c.url || c.doi || '');
      var dk = normDoi(c.doi);
      var item = (dk && byDoi[dk]) || byTitle[title];
      if(!item){
        item = { id:uid(), title:title, url:url, addedAt:Date.now(), doneAt:null };
        r.queue.push(item);
        byTitle[title] = item;
        if(dk) byDoi[dk] = item;
        added++;
      }else{
        if(url && !item.url) item.url = url;
        byTitle[title] = item;
        merged++;
      }
      FIELDS.forEach(function(k){
        if(k === 'logicGraph') return;   /* 图单独做结构校验，不能整块塞原文 */
        if(c[k] !== undefined && c[k] !== null && c[k] !== '') item[k] = c[k];
      });
      /* 显式逻辑图覆盖自动图；未提供则按当前字段补一张，供旧卡也能看图 */
      if(c.logicGraph){
        var g = normGraph(c.logicGraph);
        if(g){ g.auto = false; item.logicGraph = g; }
      }
      if(!item.logicGraph) item.logicGraph = buildAutoGraph(item);
    });
    if(!added && !merged) return { ok:false, error:'没有有效条目（标题必填）' };
    IO.save();
    return { ok:true, added:added, merged:merged, total:r.queue.length };
  }

  function all(){ return R().queue; }
  function queued(){ return R().queue.filter(function(x){ return !x.doneAt; }); }

  /* 今日精读：同一天保持同一篇；换天才重新抽 */
  function todayPick(){
    var r = R(), today = IO.todayStr();
    var cur = null;
    if(r.pickId){
      r.queue.forEach(function(x){ if(x.id === r.pickId) cur = x; });
    }
    if(r.pickDate === today && cur && !cur.doneAt) return cur;
    var next = queued()[0] || null;
    if(!next) return null;
    r.pickDate = today;
    r.pickId = next.id;
    IO.save();
    return next;
  }

  /* 换一篇：在未读队列里切到下一条（不标记完成） */
  function nextPick(){
    var r = R(), q = queued();
    if(q.length < 2) return { ok: false, error: '队列中没有其它条目' };
    var idx = -1;
    for(var i = 0; i < q.length; i++) if(q[i].id === r.pickId) idx = i;
    var nxt = q[(idx + 1) % q.length];
    r.pickDate = IO.todayStr();
    r.pickId = nxt.id;
    IO.save();
    return { ok: true, item: nxt };
  }

  /* 指定某条为今日精读 */
  function setPick(id){
    var r = R(), found = null;
    r.queue.forEach(function(x){ if(x.id === id) found = x; });
    if(!found) return { ok: false, error: '条目不存在' };
    if(found.doneAt) return { ok: false, error: '这条已读完' };
    r.pickDate = IO.todayStr();
    r.pickId = id;
    IO.save();
    return { ok: true, item: found };
  }

  function markDone(id){
    var r = R();
    for(var i = 0; i < r.queue.length; i++){
      if(r.queue[i].id !== id) continue;
      r.queue[i].doneAt = Date.now();
      if(r.pickId === id) r.pickId = null;
      IO.pushLog('reading', '精读完成 · ' + r.queue[i].title);
      /* 鲛人天赋：精读完成给最高位的她加固定整数点喜爱，不碰专注经济 */
      var bt = QZD.bloodTalent ? QZD.bloodTalent.readingFavorBonus() : null;
      if(bt && bt.value > 0 && QZD.harem){
        var cap = QZD.harem.favorMaxOf(bt.consort);
        bt.consort.favor = Math.max(0, Math.min(cap, (bt.consort.favor || 0) + bt.value));
        IO.pushLog('reading', '血脉天赋 · ' + bt.consort.name + ' 喜爱 +' + bt.value);
      }
      IO.save();
      return { ok: true, item: r.queue[i] };
    }
    return { ok: false, error: '条目不存在' };
  }

  function remove(id){
    var r = R();
    for(var i = 0; i < r.queue.length; i++){
      if(r.queue[i].id !== id) continue;
      r.queue.splice(i, 1);
      if(r.pickId === id) r.pickId = null;
      IO.save();
      return { ok: true };
    }
    return { ok: false, error: '条目不存在' };
  }

  /* 已读文献：按读完时间倒序，供复盘区展示 */
  function done(){
    return R().queue.filter(function(x){ return !!x.doneAt; })
      .sort(function(a, b){ return (b.doneAt || 0) - (a.doneAt || 0); });
  }

  /* 重读：清掉 doneAt 移回未读队列；已读次数留痕，不丢复盘信息 */
  function reopen(id){
    var r = R();
    for(var i = 0; i < r.queue.length; i++){
      if(r.queue[i].id !== id) continue;
      if(!r.queue[i].doneAt) return { ok: false, error: '这条本来就在未读队列' };
      r.queue[i].rereadCount = (Number(r.queue[i].rereadCount) || 0) + 1;
      r.queue[i].doneAt = null;
      r.pickId = id;          /* 重读即设为今日精读 */
      r.pickDate = IO.todayStr();
      IO.pushLog('reading', '重读 · ' + r.queue[i].title);
      IO.save();
      return { ok: true, item: r.queue[i] };
    }
    return { ok: false, error: '条目不存在' };
  }

  function doneThisWeek(){
    var from = Date.now() - 7 * 86400000;
    return R().queue.filter(function(x){ return x.doneAt && x.doneAt >= from; });
  }

  function stats(){
    var all = R().queue;
    var done = all.filter(function(x){ return !!x.doneAt; }).length;
    return { total: all.length, queued: all.length - done, done: done, doneWeek: doneThisWeek().length };
  }

  QZD.reading = {
    parseText: parseText,
    importText: importText,
    importCards: importCards,
    graph: graphOf,
    graphMeta: graphMeta,
    list: all,
    queued: queued,
    done: done,
    reopen: reopen,
    todayPick: todayPick,
    nextPick: nextPick,
    setPick: setPick,
    markDone: markDone,
    remove: remove,
    doneThisWeek: doneThisWeek,
    stats: stats
  };
})();
