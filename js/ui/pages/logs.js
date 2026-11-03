/* 归档起居注：倒序展示 logs 流水 */
(function(){
  var UI = QZD.ui;

  UI.register('logs', function(){
    var list = (QZD.state.logs || []).slice().reverse();

    if(!list.length){
      return '<section class="card"><div class="empty">起居注尚空</div></section>';
    }

    return '<section class="card">' +
      '<div class="card-head"><span class="card-title">归档起居注</span>' +
      '<span class="card-note">共 ' + list.length + ' 条</span></div>' +
      '<ul class="log-list">' + list.map(function(l){
        return '<li class="log-item">' +
          '<span class="log-time">' + UI.fmt.time(l.ts) + '</span>' +
          '<span>' + UI.fmt.escape(l.text) + '</span>' +
        '</li>';
      }).join('') + '</ul>' +
    '</section>';
  });
})();
