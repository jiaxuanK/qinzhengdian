/* 属地贡赋：属城一览 + 每分钟贡赋合计；贡赋按真实时间自动入账 */
(function(){
  var CFG = QZD.config;
  var C = CFG.CONQUEST;
  var UI = QZD.ui;

  function rate(num){
    return (Math.round((num || 0) * 100) / 100).toFixed(2);
  }

  function stat(label, value){
    return '<div class="realm-stat"><span>' + label + '</span><b>' + value + '</b></div>';
  }

  function ownedRow(item){
    var t = item.territory;
    var city = item.city;
    return '<div class="city-card owned">' +
      '<div class="city-top">' +
        '<div class="city-name">' + city.name +
          ' <span class="city-region">' + city.region + '</span></div>' +
        '<span class="badge ok">纳贡中</span>' +
      '</div>' +
      '<div class="city-meta">' +
        '<span>归附 <b>' + UI.fmt.time(t.capturedAt) + '</b></span>' +
        '<span>贡赋 金 +' + rate(city.tribute.jinQian) + '/分</span>' +
        '<span>国 +' + rate(city.tribute.guoJin) + '/分</span>' +
      '</div>' +
      '<div class="city-note">' + city.note + '</div>' +
    '</div>';
  }

  function render(){
    var K = QZD.conquest;
    var list = K.ownedList();
    var totals = K.totals();
    var next = K.nextTarget();

    var head = '<section class="card">' +
      '<div class="card-head"><span class="card-title">贡 赋</span>' +
      '<span class="card-note">仅勤政时入账</span></div>' +
      '<div class="realm-stats">' +
        stat('属城', list.length + ' / ' + C.CITIES.length) +
        stat('金钱 / 分', '+' + rate(totals.jinQian)) +
        stat('国力 / 分', '+' + rate(totals.guoJin)) +
      '</div>' +
      '<p class="today-line">属城贡赋只在勤政（番茄专注）期间入账；暂停或结束勤政即停止累积，离线不再补算。</p>' +
      '<p class="page-foot">' +
        (next
          ? '下一目标：「' + next.name + '」守备 ' + next.defense + '（' + next.region + '）'
          : '十二城尽归版图，四海宾服。') +
      '</p>' +
    '</section>';

    var body;
    if(!list.length){
      body = '<section class="card"><div class="empty">尚无属城' +
        '<span class="card-note">出征破城后，城池才会归入版图并开始纳贡</span></div>' +
        '<p class="page-foot" style="margin-top:10px">' +
          (next ? '首城「' + next.name + '」守备 ' + next.defense +
            '，需 ' + next.defense + ' 战力（约 ' + next.defense + ' 分钟专注）' : '') +
        '</p></section>';
    }else{
      body = '<section class="card">' +
        '<div class="card-head"><span class="card-title">已归版图</span>' +
        '<span class="card-note">共 ' + list.length + ' 城</span></div>' +
        '<div class="city-list">' + list.map(ownedRow).join('') + '</div>' +
      '</section>';
    }

    return head + body;
  }

  /* 属地贡赋并入「宏图征伐」页，作为其中一块 */
  UI.fiefBlock = { render: render };
})();
