/* ============================================================
   systems/mindmap.js · 11-22 记录导图数据聚合
   - buildStudyMap() 学习向：速记进展 + 专注历史 + 课题 + 本周三事 + 奏折
   - buildLogMap()   游戏发展向：起居注流水（主题 / 时间 / 国运阶段）
   输出统一树节点：{ id, label, sub, color, children:[...], leaf, full }
   纯数据、零 DOM、零渲染，供 ui/pages/mindmap.js 消费。
   ============================================================ */
(function(){
  var LOG_META = {
    system:{ n:'系统', c:'#7C6B94' }, daily:{ n:'每日', c:'#A8842C' },
    dynasty:{ n:'朝政', c:'#2F6B78' }, harem:{ n:'后宫', c:'#94678A' },
    conquest:{ n:'征战', c:'#A8573F' }, checkin:{ n:'常课', c:'#5E7A4A' },
    meeting:{ n:'议事', c:'#4C6E8C' }, thesis:{ n:'修书', c:'#2F6B78' },
    memorial:{ n:'奏折', c:'#A8573F' }, story:{ n:'故事', c:'#7C6B94' },
    life:{ n:'日常', c:'#5E7A4A' }, other:{ n:'其它', c:'#6F6B5F' }
  };
  function meta(t){ return LOG_META[t] || LOG_META.other; }
  function md(ts){ if(!ts) return ''; var d = new Date(ts); return (d.getMonth()+1) + '-' + d.getDate(); }
  function dayKey(ts){ var d = new Date(ts); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); }
  function leaf(id, text, full, color){ return { id:id, label:text, full:full || text, color:color, leaf:true }; }
  function trunc(s, n){ s = String(s || ''); return s.length > n ? s.slice(0, n) + '…' : s; }

  /* ---------- 学习导图 ---------- */
  function buildStudyMap(dim){
    dim = dim || 'goal';
    var st = QZD.state || {};
    var goals = (QZD.plan && QZD.plan.goals) ? QZD.plan.goals() : [];
    var progress = (QZD.plan && QZD.plan.recent) ? QZD.plan.recent(7) : [];
    var history = (st.study && st.study.history) || {};
    var subjDaily = (st.study && st.study.subjectDaily) || {};
    var subjects = (QZD.study && QZD.study.subjects) ? QZD.study.subjects() : [];
    var subjName = {}; subjects.forEach(function(s){ subjName[s.id] = s.name; });
    var root = { id:'root', label:'学习记录', sub:'速记 + 专注 + 目标', color:'#3e6b5c', children:[] };

    if(dim === 'goal'){
      /* 按本周三事：每件事挂速记 + 挂靠奏折 */
      goals.forEach(function(g){
        var gr = { id:'g-'+g.id, label:trunc(g.text,14), sub:'', color:'#1D9E75', children:[] };
        var gp = progress.filter(function(p){ return p.goalId === g.id; });
        gp.forEach(function(p,i){ gr.children.push(leaf('p-'+g.id+i, trunc(p.text,18), p.text + (p.minutes ? ' · '+p.minutes+'分' : ''), '#1D9E75')); });
        var mems = (QZD.memorials && QZD.memorials.byGoal) ? (QZD.memorials.byGoal()[g.id] || { items:[] }) : { items:[] };
        (mems.items || []).forEach(function(m,i){ gr.children.push(leaf('m-'+g.id+i, '📋 '+trunc(m.title,16), m.title + ' · ' + (m.status==='banjie'?'已办结':'在办'), '#A8573F')); });
        gr.sub = gr.children.length + ' 条关联';
        root.children.push(gr);
      });
      var loose = progress.filter(function(p){ return !p.goalId; });
      if(loose.length){
        var g2 = { id:'g-loose', label:'未挂靠速记', sub:loose.length+' 条', color:'#999', children:[] };
        loose.forEach(function(p,i){ g2.children.push(leaf('p-loose'+i, trunc(p.text,18), p.text, '#999')); });
        root.children.push(g2);
      }
    } else if(dim === 'subject'){
      /* 按课题：专注分钟 + 该课题相关速记 */
      subjects.forEach(function(s){
        var total = 0;
        Object.keys(subjDaily).forEach(function(d){ total += (subjDaily[d][s.id] || 0); });
        if(!total) return;
        var gr = { id:'s-'+s.id, label:trunc(s.name,14), sub:Math.round(total)+' 分专注', color:'#378ADD', children:[] };
        Object.keys(subjDaily).sort().reverse().forEach(function(d){
          var min = subjDaily[d][s.id] || 0;
          if(min) gr.children.push(leaf('sd-'+s.id+d, md(d)+' · '+min+'分', s.name+' · '+d+' 专注 '+min+' 分', '#378ADD'));
        });
        root.children.push(gr);
      });
      var none = progress.filter(function(p){ return !p.subjectId; });
      if(none.length){
        var g2 = { id:'s-none', label:'未归课题速记', sub:none.length+' 条', color:'#999', children:[] };
        none.forEach(function(p,i){ g2.children.push(leaf('pn'+i, trunc(p.text,18), p.text, '#999')); });
        root.children.push(g2);
      }
    } else {
      /* 按时间：每日专注 + 当日速记 */
      var byDay = {};
      Object.keys(history).forEach(function(d){ byDay[d] = byDay[d] || { min:0, notes:[] }; byDay[d].min = history[d] || 0; });
      progress.forEach(function(p){ var k = dayKey(p.at); byDay[k] = byDay[k] || { min:0, notes:[] }; byDay[k].notes.push(p); });
      Object.keys(byDay).sort().reverse().forEach(function(d){
        var b = byDay[d];
        var gr = { id:'d-'+d, label:md(d), sub:b.min+' 分 · '+b.notes.length+' 速记', color:'#BA7517', children:[] };
        if(b.min) gr.children.push(leaf('dm-'+d, '专注 '+b.min+' 分', d+' 专注合计 '+b.min+' 分', '#BA7517'));
        b.notes.forEach(function(p,i){ gr.children.push(leaf('dn-'+d+i, '✎ '+trunc(p.text,16), p.text + (p.minutes?' · '+p.minutes+'分':''), '#3e6b5c')); });
        root.children.push(gr);
      });
    }
    return root;
  }

  /* ---------- 起居注导图（游戏发展） ---------- */
  function buildLogMap(dim){
    dim = dim || 'theme';
    var logs = (QZD.state && QZD.state.logs) ? QZD.state.logs.slice().reverse() : [];
    var root = { id:'root', label:'起居注', sub:'游戏发展脉络', color:'#7C6B94', children:[] };
    if(!logs.length) return root;

    if(dim === 'theme'){
      /* 按主题：四大类 → 具体类型 → 记录 */
      var groups = {
        '朝堂政务':['dynasty','meeting','system'],
        '宫闱人事':['harem','story','life'],
        '征伐四方':['conquest'],
        '勤政治学':['checkin','memorial','thesis','daily','other']
      };
      Object.keys(groups).forEach(function(bn){
        var b = { id:'b-'+bn, label:bn, color:'#378ADD', children:[] };
        groups[bn].forEach(function(t){
          var items = logs.filter(function(l){ return (l.type || 'other') === t; });
          if(!items.length) return;
          var m = meta(t);
          var gr = { id:'t-'+t, label:m.n, sub:items.length+' 条', color:m.c, children:[] };
          items.slice(0,20).forEach(function(l,i){ gr.children.push(leaf('l-'+t+i, md(l.ts)+' '+trunc(l.text,16), l.text, m.c)); });
          if(items.length > 20) gr.children.push(leaf('l-'+t+'more', '…另有 '+(items.length-20)+' 条', '该类型共 '+items.length+' 条', m.c));
          b.children.push(gr);
        });
        if(b.children.length) root.children.push(b);
      });
    } else if(dim === 'time'){
      /* 按日期聚合 */
      var byDay = {};
      logs.forEach(function(l){ var k = dayKey(l.ts); (byDay[k] = byDay[k] || []).push(l); });
      Object.keys(byDay).sort().reverse().forEach(function(d){
        var items = byDay[d];
        var gr = { id:'d-'+d, label:md(d), sub:items.length+' 条', color:'#BA7517', children:[] };
        items.slice(0,20).forEach(function(l,i){ gr.children.push(leaf('ld-'+d+i, meta(l.type).n+' '+trunc(l.text,14), l.text, meta(l.type).c)); });
        if(items.length>20) gr.children.push(leaf('ld-'+d+'m','…另有 '+(items.length-20)+' 条','当日共 '+items.length+' 条','#BA7517'));
        root.children.push(gr);
      });
    } else {
      /* 按国运阶段：危机/复国/太平（依据事件关键词 + 时间倒序） */
      var phases = [
        { id:'restore', label:'拨乱反正', test:/拨乱反正|光复|复安|龙颜再临/, color:'#3B6D11' },
        { id:'crisis', label:'国势危机', test:/议论|灾异|边患|忧色|国破|潜邸|城破/, color:'#A32D2D' },
        { id:'growth', label:'勤政成长', test:/专注|办结|打卡|帝阶|晋级|晨课/, color:'#2F6B78' },
        { id:'daily', label:'日常起居', test:/.*/, color:'#8a8477' }
      ];
      var used = {};
      phases.forEach(function(ph){
        var items = logs.filter(function(l){ return !used[l.ts+l.text] && ph.test.test(l.text || ''); });
        items.forEach(function(l){ used[l.ts+l.text] = true; });
        if(!items.length) return;
        var gr = { id:'ph-'+ph.id, label:ph.label, sub:items.length+' 条', color:ph.color, children:[] };
        items.slice(0,20).forEach(function(l,i){ gr.children.push(leaf('ph-'+ph.id+i, md(l.ts)+' '+trunc(l.text,16), l.text, ph.color)); });
        if(items.length>20) gr.children.push(leaf('ph-'+ph.id+'m','…另有 '+(items.length-20)+' 条','共 '+items.length+' 条',ph.color));
        root.children.push(gr);
      });
    }
    return root;
  }

  QZD.mindmap = {
    buildStudyMap: buildStudyMap,
    buildLogMap: buildLogMap,
    logMeta: LOG_META
  };
})();
