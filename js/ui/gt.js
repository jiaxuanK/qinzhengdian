/* ============================================================
   js/ui/gt.js · 谱系树共享渲染器
   
   统一 DOM 结构：gt-node-wrapper → gt-node → gt-node-inner
   供 大计 goals.js / 修书 thesis.js / 奏折 memorials.js 共用
   ============================================================ */
(function(){
  var C = QZD.config;

  /* 内联 escape，不依赖任何外部 UI 对象 */
  function escape(s){
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  /* 默认深度染色（CSS 变量） */
  var DEPTH_COLORS = ['var(--daiqing)', 'var(--shi-qing)', 'var(--zhu-green)', 'var(--ou-he)'];

  /**
   * 渲染一个谱系树节点（三层 DOM，CSS 类控制样式）
   * 
   * @param {Object} opts
   *   - title:       string  显示标题（纯文本，会 escape）
   *   - titleHTML:   string  显示标题（HTML，不 escape，优先级高于 title）
   *   - depth:       number  深度（0=根，不缩进）
   *   - color:       string  左边框颜色，不传则用 DEPTH_COLORS[depth]
   *   - hasChildren: bool    是否有子节点（决定显示 ▾ 还是 ·）
   *   - pct:         number  进度百分比（0-100）
   *   - pctCls:      string  mini-bar 附加类名（'ok' / 'hot' / ''）
   *   - ops:         string  右侧操作按钮 HTML
   *   - meta:        string  底部 chip 行 HTML
   *   - kidsHTML:    string  递归子节点 HTML
   *   - leftPad0:    bool    depth=0 时是否 padding-left:0（根层对齐）
   * @returns {string} HTML
   */
  function node(opts){
    var o = opts || {};
    var depth = o.depth || 0;
    var color = o.color || DEPTH_COLORS[Math.min(depth, DEPTH_COLORS.length - 1)];
    var hasKids = !!o.hasChildren;
    var titleTag = hasKids
      ? '<span class="gt-toggle">▾</span>'
      : '<span class="gt-leaf">·</span>';
    var barHTML = (typeof o.pct === 'number')
      ? '<div class="mini-bar' + (o.pctCls ? ' ' + o.pctCls : '') + '"><i style="width:' + Math.max(0, Math.min(100, o.pct)) + '%"></i><span>' + Math.max(0, Math.min(100, o.pct)) + '%</span></div>'
      : '';
    var metaHTML = o.meta ? '<div class="gt-meta">' + o.meta + '</div>' : '';
    var wrapperStyle = (depth === 0 && o.leftPad0 !== false)
      ? 'padding-left:0'
      : '';
    var titleContent = o.titleHTML != null
      ? o.titleHTML  // 直接用 HTML，不 escape
      : escape(String(o.title || ''));

    return '<div class="gt-node-wrapper"' + (wrapperStyle ? ' style="' + wrapperStyle + '"' : '') + '>' +
      '<div class="gt-node' + (hasKids ? ' gt-has-children' : '') + '">' +
        (depth > 0 ? '<span class="gt-vline"></span>' : '') +
        '<div class="gt-node-inner" style="border-left:3px solid ' + color + '">' +
          '<div class="gt-row">' +
            '<div class="gt-title" style="color:' + color + '">' +
              titleTag +
              titleContent +
            '</div>' +
            (o.ops ? '<div class="gt-tools">' + o.ops + '</div>' : '') +
          '</div>' +
          barHTML +
          metaHTML +
        '</div>' +
      '</div>' +
      (o.kidsHTML || '') +
    '</div>';
  }

  QZD.gt = { node: node, DEPTH_COLORS: DEPTH_COLORS };
})();
