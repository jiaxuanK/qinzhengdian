/* 归档起居注：倒序展示 logs 流水
   细分类型：system / daily / dynasty / harem / conquest / checkin / meeting / story / life
   每种配 emoji + 颜色 chip，按日期分组。 */
(function(){
  var UI = QZD.ui;
  var filter = 'all';
  var lastTopTs = 0;   /* 11-19：仅最新日志变化时才淡入，避免每次渲染全表重播 */

  /* 类型定义：emoji + 中文名 + CSS 颜色（chip 背景 + chip 字色）*/
  var TYPES = {
    system:   { icon:'⚙️', name:'系统',   bg:'rgba(124,107,148,.10)', fg:'#7C6B94' },
    daily:    { icon:'🌅', name:'每日',   bg:'rgba(168,132,44,.12)', fg:'#A8842C' },
    dynasty:  { icon:'🏛️', name:'朝政',   bg:'rgba(47,107,120,.10)', fg:'#2F6B78' },
    harem:    { icon:'🌸', name:'后宫',   bg:'rgba(148,103,138,.12)', fg:'#94678A' },
    conquest: { icon:'⚔️', name:'征战',   bg:'rgba(168,87,63,.12)',  fg:'#A8573F' },
    checkin:  { icon:'✅', name:'常课',   bg:'rgba(94,122,74,.10)',  fg:'#5E7A4A' },
    meeting:  { icon:'💬', name:'议事',   bg:'rgba(76,110,140,.10)', fg:'#4C6E8C' },
    thesis:   { icon:'📖', name:'修书',   bg:'rgba(47,107,120,.10)', fg:'#2F6B78' },
    memorial: { icon:'📋', name:'奏折',   bg:'rgba(168,87,63,.12)',  fg:'#A8573F' },
    story:    { icon:'📜', name:'故事',   bg:'rgba(124,107,148,.12)',fg:'#7C6B94' },
    life:     { icon:'☕', name:'日常',   bg:'rgba(94,122,74,.10)',  fg:'#5E7A4A' },
    other:    { icon:'📌', name:'其它',   bg:'rgba(120,116,105,.10)',fg:'#6F6B5F' }
  };
  function typeInfo(t){ return TYPES[t] || TYPES.other; }
  function kindOf(l){ return (TYPES[l.type]) ? l.type : 'other'; }

  /* 筛选按钮列表：从实际数据里出现的类型动态生成（+ all）*/
  function filterButtons(all){
    var present = {};
    all.forEach(function(l){ present[kindOf(l)] = true; });
    var list = [{ id:'all', name:'全部' }];
    /* 按预设顺序排，未预设的放后面 */
    var PRESET = ['system','daily','dynasty','harem','conquest','checkin','meeting','thesis','memorial','story','life'];
    PRESET.forEach(function(t){ if(present[t]) list.push({ id:t, name:typeInfo(t).icon + ' ' + typeInfo(t).name }); });
    Object.keys(present).forEach(function(t){
      if(PRESET.indexOf(t) < 0) list.push({ id:t, name:typeInfo(t).icon + ' ' + typeInfo(t).name });
    });
    return list;
  }

  function fmtLog(l){
    var s = UI.fmt.escape(l.text);
    if(l.type === 'story'){
      s = s.replace(/（因由：([^）]*)）/g,
        '<div style="opacity:.6;font-size:12px;margin-top:3px">因由 · $1</div>');
    }
    return s;
  }

  /* 把时间戳归到"今日 / 昨日 / 星期N / M月D日"分组 */
  function groupKey(ts){
    var now = new Date(); now.setHours(0,0,0,0);
    var d = new Date(ts); d.setHours(0,0,0,0);
    var diff = Math.round((now - d) / 86400000);
    var WEEK = ['日','一','二','三','四','五','六'];
    if(diff === 0) return '今日';
    if(diff === 1) return '昨日';
    if(diff < 7) return '本周周' + WEEK[d.getDay()];
    return (d.getMonth()+1) + '月' + d.getDate() + '日';
  }

  UI.register('logs', function(){
    var all = (QZD.state.logs || []).slice().reverse();
    var newTs = all.length ? all[0].ts : 0;
    var freshTop = (newTs && newTs !== lastTopTs);   /* 本页首次打开也算「新」 */
    lastTopTs = newTs;

    if(!all.length){
      return '<section class="card"><div class="empty">起居注尚空<span class="card-note">做些事就会开始记录——开殿、每日重置、后宫/朝政/征战……</span></div></section>';
    }

    /* 动态算各类型计数 */
    var counts = { all: all.length };
    Object.keys(TYPES).forEach(function(t){ counts[t] = 0; });
    all.forEach(function(l){ var k = kindOf(l); counts[k] = (counts[k] || 0) + 1; });

    var fbtns = filterButtons(all);
    var chips = '<div class="tab-row wrap" style="margin-bottom:10px">' +
      fbtns.map(function(f){
        var cnt = f.id === 'all' ? counts.all : (counts[f.id] || 0);
        return '<button class="tab' + (filter === f.id ? ' active' : '') +
          '" data-log-filter="' + f.id + '">' + f.name + ' ' + cnt + '</button>';
      }).join('') + '</div>';

    var list = all.filter(function(l){
      return filter === 'all' || kindOf(l) === filter;
    });

    /* 按日期分组 */
    var groups = {};
    list.forEach(function(l){
      var g = groupKey(l.ts);
      if(!groups[g]) groups[g] = [];
      groups[g].push(l);
    });
    var groupHTML = Object.keys(groups).map(function(g){
      var items = groups[g].map(function(l){
        var ti = typeInfo(l.type);
        var chipStyle = 'background:' + ti.bg + ';color:' + ti.fg +
          ';border:1px solid ' + ti.fg + '33;font-weight:600';
        return '<li class="log-item' + (freshTop && l === all[0] ? ' log-new' : '') + '">' +
          '<span class="log-time">' + UI.fmt.time(l.ts) + '</span>' +
          '<span class="log-type-chip" style="' + chipStyle + '">' + ti.icon + ' ' + UI.fmt.escape(ti.name) + '</span>' +
          '<span class="log-text">' + fmtLog(l) + '</span>' +
        '</li>';
      }).join('');
      return '<div class="log-group"><div class="log-group-title">' + UI.fmt.escape(g) +
        '</div><ul class="log-list">' + items + '</ul></div>';
    }).join('');

    return '<section class="card">' +
      '<div class="card-head"><span class="card-title">归档起居注</span>' +
      '<span class="card-note">共 ' + all.length + ' 条 · 当前 ' + list.length + ' 条</span></div>' +
      chips +
      (list.length ? groupHTML : '<div class="empty">这一类还没有记录</div>') +
    '</section>';
  });

  document.addEventListener('click', function(e){
    var b = e.target.closest && e.target.closest('[data-log-filter]');
    if(!b) return;
    filter = b.getAttribute('data-log-filter') || 'all';
    var cur = QZD.ui.currentTab ? QZD.ui.currentTab() : QZD.ui.current();
    if(cur === 'logs') QZD.ui.renderPage();
  });
})();
