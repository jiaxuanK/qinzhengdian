/* ============================================================
   ui/pages/idea.js · 朱批灵感罐（科研 idea 随手记）
   随手录入一行灵感 + 标签；可标记「已孵化」；可删除
   ============================================================ */
(function(){
  var UI = QZD.ui;
  var ESC = function(t){ return UI.fmt.escape(t); };

  function statBar(){
    var s = QZD.idea.stats();
    return '<div class="realm-stats">' +
      '<div class="realm-stat"><span>灵感总数</span><b>' + s.total + '</b></div>' +
      '<div class="realm-stat hot"><span>已孵化</span><b>' + s.hatched + '</b></div>' +
      '<div class="realm-stat"><span>待孵化</span><b>' + (s.total - s.hatched) + '</b></div>' +
    '</div>';
  }

  function ideaCard(it){
    var t = new Date(it.createdAt);
    var time = (t.getMonth() + 1) + '.' + t.getDate() + ' ' +
      ('0' + t.getHours()).slice(-2) + ':' + ('0' + t.getMinutes()).slice(-2);
    return '<div class="idea-card' + (it.hatched ? ' hatched' : '') + '">' +
      '<div class="idea-main">' +
        (it.tag ? '<span class="idea-tag">' + ESC(it.tag) + '</span>' : '') +
        '<span class="idea-text">' + ESC(it.text) + '</span>' +
        '<span class="idea-time">' + time + '</span>' +
      '</div>' +
      '<div class="idea-ops">' +
        '<button class="chip sm' + (it.hatched ? ' ok' : '') + '" data-idea-hatch="' + it.id + '">' +
          (it.hatched ? '已孵化' : '标记孵化') + '</button>' +
        '<button class="chip sm danger" data-idea-del="' + it.id + '">删</button>' +
      '</div>' +
    '</div>';
  }

  UI.register('idea', function(){
    var list = QZD.idea.list();
    var body = list.length
      ? list.map(ideaCard).join('')
      : '<div class="empty">灵感罐空空，记下第一个想法吧<span class="card-note">想到就记，别让它溜走</span></div>';
    return '' +
      '<section class="card">' +
        '<div class="card-head"><span class="card-title">朱 批 灵 感 罐 · 科研灵感随手记</span>' +
          '<span class="card-note">一行一念，可标记已落地</span></div>' +
        statBar() +
      '</section>' +
      '<section class="card">' +
        '<div class="card-head"><span class="card-title">落 笔</span></div>' +
        '<div class="idea-add">' +
          '<textarea id="idea-text" maxlength="300" rows="2" placeholder="此刻的灵感 / 猜想 / 待办点子…"></textarea>' +
          '<div class="idea-add2">' +
            '<input id="idea-tag" maxlength="16" placeholder="标签（选填），如：实验/写作/课题">' +
            '<button class="btn primary" data-idea-add>朱 批</button>' +
          '</div>' +
        '</div>' +
      '</section>' +
      '<section class="card">' +
        '<div class="card-head"><span class="card-title">灵 感 罐</span>' +
          '<span class="card-note">' + list.length + ' 条</span></div>' +
        body +
      '</section>';
  });

  document.addEventListener('click', function(e){
    if(e.target.closest('[data-idea-add]')){
      var r = QZD.idea.add(
        document.getElementById('idea-text').value,
        document.getElementById('idea-tag').value
      );
      if(!r.ok){ UI.toast(r.error); return; }
      UI.onStateChanged();
      return;
    }
    var del = e.target.closest('[data-idea-del]');
    if(del){
      QZD.idea.remove(del.getAttribute('data-idea-del'));
      UI.onStateChanged();
      return;
    }
    var h = e.target.closest('[data-idea-hatch]');
    if(h){
      QZD.idea.toggle(h.getAttribute('data-idea-hatch'));
      UI.onStateChanged();
      return;
    }
  });

  /* Ctrl/⌘+Enter 快捷落笔 */
  document.addEventListener('keydown', function(e){
    if((e.ctrlKey || e.metaKey) && e.key === 'Enter' &&
       e.target && e.target.id === 'idea-text'){
      e.preventDefault();
      var b = document.querySelector('[data-idea-add]');
      if(b) b.click();
    }
  });
})();
