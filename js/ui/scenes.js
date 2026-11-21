/* ============================================================
   scenes.js · 三页顶部场景横幅（11-21 图片版）
   总览=金銮殿(时辰调色) / 政务=御书房桌面 / 朝野=虚构舆图
   图片底图 + 透明热区，data-scene-go 点击委托复用 UI.show。
   等比画布 aspect-ratio:4.3 → 桌面/手机共用一套热区百分比。
   ============================================================ */
(function(){
  var UI = QZD.ui = QZD.ui || {};
  var S = UI.scenes = {};

  var IMG = {
    hall: 'assets/scenes/hall_desk.webp',
    desk: 'assets/scenes/desk_desk.webp',
    map:  'assets/scenes/map_desk.webp'
  };

  /* 热区：[页面id, left%, top%, width%, height%, 说明]
     坐标按 4.3:1 原图实测，等比缩放后两端通用。 */
  var HOT = {
    desk: [
      ['memorials',  7.5,  6, 20, 34, '奏折堆 · 奏折页'],
      ['thesis',    29,    4, 23, 38, '摊开文书 · 修书'],
      ['checkin',   58,    3, 11, 42, '玉玺 · 常课御批'],
      ['library',   71,    6, 24, 36, '典籍 · 文渊'],
      ['goals',      3,   52, 27, 44, '宏图卷轴 · 宏图'],
      ['meetings',  38,   55, 16, 40, '砚笔 · 议事'],
      ['chronos',   60,   50,  9, 46, '烛台 · 钦天监'],
      ['idea',      76,   52, 22, 45, '宝匣 · 灵感罐']
    ],
    hall: [
      ['memorials', 45,   44, 11, 26, '御座 · 奏折'],
      ['roster',    15,   62, 30, 32, '朝班 · 名册'],
      ['conquest',  16,   12, 10, 52, '帅旗 · 征伐'],
      ['settings',  81,   14, 10, 66, '纪年碑 · 历代年表']
    ],
    map: [
      ['roster',    26,   33, 15, 28, '宫阙 · 名册'],
      ['conquest',  66,   28, 15, 28, '敌城 · 征伐'],
      ['works',     48,    8, 14, 26, '在建城楼 · 营造']
    ]
  };

  function hotspots(list){
    return list.map(function(h){
      return '<div class="sc-hot" data-scene-go="' + h[0] + '"' +
        ' style="left:' + h[1] + '%;top:' + h[2] + '%;width:' + h[3] + '%;height:' + h[4] + '%"' +
        ' title="' + h[5] + '"></div>';
    }).join('');
  }

  /* 金銮殿专属：日月叠层（图片里留白，动态元素用 SVG 画）
     .sc-sun/.sc-moon 由 css/scenes.css 按 body[data-ambient] 切透明度与位移 */
  function skyLayer(){
    return '<svg class="sc-sky-svg" viewBox="0 0 860 200" preserveAspectRatio="xMidYMid slice"' +
      ' aria-hidden="true">' +
      '<circle class="sc-sun" cx="690" cy="42" r="17" fill="#F5C34E"/>' +
      '<circle class="sc-sun-halo" cx="690" cy="42" r="27" fill="#F5C34E" opacity=".18"/>' +
      '<path class="sc-moon" d="M716 26 A17 17 0 1 0 716 58 A13.5 13.5 0 1 1 716 26 Z" fill="#F3EFD8"/>' +
      '</svg>';
  }

  /* 舆图动态叠层：城池旗帜 / 营造地物 / 计数文字随游戏进度变化。
     用户只要求舆图去掉时辰天气，进度反馈属数据展示，保留。 */
  var WORK_MARKS = [
    { id:'hegong',    name:'河工堤防', shape:'levee',   color:'#4C7A8C', pos:[22,74] },
    { id:'changping', name:'常平仓',   shape:'granary', color:'#9A7B36', pos:[30,84] },
    { id:'yantie',    name:'盐铁司',   shape:'forge',   color:'#A85A32', pos:[38,70] },
    { id:'junxie',    name:'军械监',   shape:'arsenal', color:'#7A4A38', pos:[55,82] },
    { id:'yichuan',   name:'驿传所',   shape:'post',    color:'#4C6E8C', pos:[62,70] },
    { id:'zhuqian',   name:'铸钱局',   shape:'mint',    color:'#3E6B5C', pos:[70,80] }
  ];
  function workLevel(id){
    var w = QZD.state && QZD.state.works;
    return (w && w.levels && w.levels[id]) || 0;
  }
  function workShape(w){
    var c = w.color;
    switch(w.shape){
      case 'levee':   return '<path d="M-11 5 h22 v5 h-22 Z" fill="'+c+'"/><path d="M-11 1 q5 -4 10 0 q5 -4 10 0" fill="none" stroke="'+c+'" stroke-width="1.5"/>';
      case 'granary': return '<path d="M-9 10 v-11 h18 v11 Z" fill="'+c+'"/><path d="M-11 -1 L0 -9 L11 -1 Z" fill="'+c+'"/><rect x="-3" y="2" width="6" height="8" fill="rgba(50,40,25,.3)"/>';
      case 'forge':   return '<path d="M-9 10 v-10 h18 v10 Z" fill="'+c+'"/><rect x="-2" y="-10" width="4" height="7" fill="'+c+'"/><path d="M-4 2 q4 -9 8 0" fill="#E08A3C"/>';
      case 'arsenal': return '<path d="M-10 10 L7 -7 M-7 -7 L10 10" stroke="'+c+'" stroke-width="2.5"/><path d="M7 -7 l4 -3 l-1 5 Z M-7 -7 l-4 -3 l1 5 Z" fill="'+c+'"/>';
      case 'post':    return '<path d="M-9 10 v-9 h18 v9 Z" fill="'+c+'"/><path d="M-11 1 L0 -7 L11 1 Z" fill="'+c+'"/><path d="M11 -7 v-6 l6 2 l-6 2" fill="'+c+'"/><rect x="-2" y="3" width="4" height="7" fill="rgba(50,40,25,.3)"/>';
      case 'mint':    return '<circle cx="0" cy="1" r="9" fill="'+c+'"/><rect x="-3" y="-2" width="6" height="6" fill="#EFE7D2"/>';
    }
    return '';
  }
  function mapOverlay(){
    var consorts = (QZD.state && QZD.state.consorts) || [];
    var territories = (QZD.state && QZD.state.territories) || [];
    var ownedN = territories.length;
    var builtN = WORK_MARKS.filter(function(w){ return workLevel(w.id) > 0; }).length;
    var out = '';
    /* 工程地物：按百分比定位（SVG 用 viewBox 0 0 100 100 百分比坐标系） */
    WORK_MARKS.forEach(function(w){
      var lv = workLevel(w.id);
      if(!lv) return;
      out += '<g class="sc-work" transform="translate(' + w.pos[0] + ',' + w.pos[1] + ') scale(.5)">' +
        workShape(w) +
        '<circle cx="10" cy="-9" r="5" fill="#F3EFD8" stroke="' + w.color + '"/>' +
        '<text x="10" y="-6" text-anchor="middle" font-size="9" font-family="serif" fill="'+w.color+'">'+lv+'</text>' +
        '<title>'+w.name+' · Lv.'+lv+'</title></g>';
    });
    /* 已控城池旗帜 */
    var flags = '';
    for(var i=0;i<Math.min(ownedN,8);i++){
      var x = 44 + i*2.2;
      flags += '<path d="M'+x+' 34 v-8 l5 1.5 l-5 2 Z"/>';
    }
    out += '<g class="sc-flags" fill="#A8573F" transform="scale(1 1)"><title>已控城池旗帜 '+ownedN+'</title>'+flags+'</g>';
    /* 计数文字 */
    out += '<text x="3" y="92" class="sc-map-count" fill="#6E6858" font-size="4" font-family="serif">' +
      '已控城池 ' + ownedN + ' · 营造 ' + builtN + '/6 · 后宫 ' + consorts.length + '</text>';
    return '<svg class="sc-map-overlay" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">' + out + '</svg>';
  }

  function build(kind){
    return '<div class="scene-banner scene-banner-' + kind + ' scene-' + kind + '">' +
      '<img class="scene-img" src="' + IMG[kind] + '" alt="" aria-hidden="true">' +
      (kind === 'hall' ? skyLayer() : '') +
      (kind === 'map' ? mapOverlay() : '') +
      '<div class="scene-hots">' + hotspots(HOT[kind]) + '</div>' +
      '</div>';
  }

  S.banner = function(pageId){
    var kind = (pageId === 'overview' || pageId === 'summary' || pageId === 'ov') ? 'hall'
             : (pageId === 'research' || pageId === 'tasks' || pageId === 'memorials' ||
                pageId === 'thesis' || pageId === 'library' || pageId === 'meetings' ||
                pageId === 'goals' || pageId === 'checkin' || pageId === 'chronos') ? 'desk'
             : (pageId === 'court' || pageId === 'roster' || pageId === 'conquest' ||
                pageId === 'works' || pageId === 'treasure' || pageId === 'logs') ? 'map'
             : '';
    return kind ? build(kind) : '';
  };

  /* 入口点击委托：一次绑定，事件冒泡到 document */
  document.addEventListener('click', function(e){
    var t = e.target && e.target.closest ? e.target.closest('[data-scene-go]') : null;
    if(!t) return;
    var go = t.getAttribute('data-scene-go');
    if(!go || !UI.show) return;
    UI.show(go);
  });

  QZD.scenes = S;
})();
