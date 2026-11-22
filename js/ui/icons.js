/* ============================================================
   ui/icons.js · 11-22 单色线性 SVG 图标库
   - 统一 24x24 viewBox、stroke=currentColor、1.8 线宽、圆角端点
   - 语义命名，作为全游戏线性图标的单一数据源
   - 用法：QZD.icons.get('book')  → <svg>...</svg> 字符串
          QZD.icons.span('book') → 带 .ico 类的 <span> 包裹
   - 纯字符串、零依赖、零运行时开销
   ============================================================ */
(function(){
  var P = {
    /* 导航 / 一级 */
    overview: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M9 9v11"/>',
    court:    '<path d="M3 21h18M4 21V10l8-6 8 6v11M9 21v-6h6v6M4 12h16"/>',
    map:      '<path d="M3 6l6-3 6 3 6-3v15l-6 3-6-3-6 3z"/><path d="M9 3v15M15 6v15"/>',
    /* 分组标签 */
    gauge:    '<path d="M12 21a9 9 0 1 0-9-9"/><path d="M12 12l5-4"/><path d="M3 12h2M12 3v2"/>',
    bolt:     '<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>',
    bulb:     '<path d="M9 18h6M10 22h4"/><path d="M12 2a7 7 0 0 0-4 12v3h8v-3a7 7 0 0 0-4-12z"/>',
    gear:     '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M19.1 4.9L17 7M7 17l-2.1 2.1"/>',
    target:   '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5"/>',
    scroll:   '<path d="M6 3h11a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/><path d="M8 8h8M8 12h8M8 16h5"/>',
    check:    '<path d="M20 6L9 17l-5-5"/>',
    book:     '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>',
    chat:     '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
    archive:  '<rect x="3" y="4" width="18" height="4" rx="1"/><path d="M5 8v12h14V8M10 12h4"/>',
    people:   '<circle cx="9" cy="8" r="3"/><path d="M3 21v-2a6 6 0 0 1 12 0v2M16 5a3 3 0 0 1 0 6M17 21v-2a6 6 0 0 0-2-4.5"/>',
    sword:    '<path d="M14.5 3.5l6 6M4 20l6-6M13 5l6 6-9 9-6-6zM3 21l3-3"/>',
    hammer:   '<path d="M14 4l6 6M15 5L6 14l4 4 9-9zM4 20l4-4"/>',
    gem:      '<path d="M6 3h12l4 6-10 12L2 9z"/><path d="M2 9h20M6 3l3 6M18 3l-3 6"/>',
    /* 标题语义 */
    ink:      '<path d="M12 2C9 6 7 9 7 13a5 5 0 0 0 10 0c0-4-2-7-5-11z"/><path d="M9 20h6"/>',
    crown:    '<path d="M3 7l4 4 5-7 5 7 4-4-2 12H5z"/>',
    flag:     '<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>',
    pen:      '<path d="M12 19l7-7 3 3-7 7-3-3zM18 13l-1.5-7.5L3 2l3.5 13.5L14 18z"/><path d="M3 2l9 9"/>',
    chart:    '<path d="M3 3v18h18"/><path d="M7 16l4-5 3 3 5-7"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
    trophy:   '<path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M7 6H4v2a3 3 0 0 0 3 3M17 6h3v2a3 3 0 0 1-3 3"/>',
    clock:    '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/>',
    bar:      '<path d="M3 3v18h18"/><rect x="7" y="12" width="3" height="6"/><rect x="12" y="8" width="3" height="10"/><rect x="17" y="5" width="3" height="13"/>',
    layers:   '<path d="M12 3l9 5-9 5-9-5z"/><path d="M3 13l9 5 9-5M3 17l9 5 9-5"/>',
    shield:   '<path d="M12 2l8 4v6c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6z"/>',
    compass:  '<circle cx="12" cy="12" r="9"/><path d="M15.5 8.5l-2 5-5 2 2-5z"/>',
    sparkle:  '<path d="M12 2l2 6 6 2-6 2-2 6-2-6-6-2 6-2z"/><path d="M19 16l1 3 3 1-3 1-1 3-1-3-3-1 3-1z"/>',
    branch:   '<circle cx="6" cy="5" r="2.5"/><circle cx="18" cy="12" r="2.5"/><circle cx="6" cy="19" r="2.5"/><path d="M6 7.5v9M8.5 5H14a4 4 0 0 1 4 4M8.5 19H14a4 4 0 0 0 4-4"/>',
    flame:    '<path d="M12 22c4 0 7-3 7-7 0-4-3-7-7-13-1 5-7 7-7 13 0 4 3 7 7 7z"/>',
    eye:      '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/>',
    link:     '<path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-2 2"/><path d="M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l2-2"/>',
    box:      '<path d="M3 8l9-5 9 5v8l-9 5-9-5z"/><path d="M3 8l9 5 9-5M12 13v8"/>',
    money:    '<circle cx="12" cy="12" r="9"/><path d="M15 9c-.5-1.5-1.5-2-3-2-2 0-3 1-3 2.5 0 3.5 6 1.5 6 5 0 1.5-1 2.5-3 2.5-1.5 0-2.5-.5-3-2M12 6v2M12 16v2"/>',
    export:   '<path d="M12 3v12M8 7l4-4 4 4M4 15v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4"/>',
    save:     '<path d="M5 3h12l3 3v15H4V3z"/><path d="M8 3v6h8V3M8 21v-7h8v7"/>',
    image:    '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8.5" cy="9.5" r="1.5"/><path d="M21 16l-6-6-9 9"/>',
    tools:    '<path d="M14 6a4 4 0 0 1 5 5l-7 7-5-5z"/><path d="M4 4l5 5M3 21l6-6"/>',
    history:  '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5M12 7v5l3 3"/>',
    cart:     '<circle cx="9" cy="20" r="1.5"/><circle cx="18" cy="20" r="1.5"/><path d="M2 3h3l3 12h11l2-8H6"/>',
    heart:    '<path d="M12 21S3 14 3 8a5 5 0 0 1 9-3 5 5 0 0 1 9 3c0 6-9 13-9 13z"/>',
    star:     '<path d="M12 3l3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1z"/>',
    moon:     '<path d="M21 12.5A9 9 0 1 1 11.5 3a7 7 0 0 0 9.5 9.5z"/>',
    sunrise:  '<path d="M12 2v3M5 7l2 2M19 7l-2 2M2 18h20M12 9a6 6 0 0 1 6 6H6a6 6 0 0 1 6-6z"/>',
    /* 按钮动作 */
    plus:     '<path d="M12 5v14M5 12h14"/>',
    edit:     '<path d="M11 4H4v16h16v-7"/><path d="M18.5 2.5a2 2 0 0 1 3 3L12 15l-4 1 1-4z"/>',
    trash:    '<path d="M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14"/>',
    play:     '<path d="M6 3l14 9-14 9z"/>',
    pause:    '<path d="M8 4v16M16 4v16"/>',
    done:     '<path d="M20 6L9 17l-5-5"/>',
    back:     '<path d="M9 14L4 9l5-5M4 9h11a5 5 0 0 1 0 10h-3"/>',
    info:     '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7h.01"/>',
    search:   '<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>',
    refresh:  '<path d="M20 12a8 8 0 0 1-14 5M4 12a8 8 0 0 1 14-5"/><path d="M4 17v5h5M20 7V2h-5"/>'
  };

  function get(name){
    var body = P[name] || P.info;
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" ' +
      'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + body + '</svg>';
  }
  function span(name, cls){
    return '<span class="ico' + (cls ? ' ' + cls : '') + '">' + get(name) + '</span>';
  }

  QZD.icons = { get: get, span: span, names: function(){ return Object.keys(P); } };
})();
