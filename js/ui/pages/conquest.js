/* 宏图征伐：12 城分四档，战力达守备即可出征（确定性必胜） */
(function(){
  var CFG = QZD.config;
  var C = CFG.CONQUEST;
  var UI = QZD.ui;

  function stat(label, value, cls){
    return '<div class="realm-stat' + (cls ? ' ' + cls : '') + '">' +
      '<span>' + label + '</span><b>' + value + '</b></div>';
  }

  function rate(num){
    return (Math.round((num || 0) * 100) / 100).toFixed(2);
  }

  function cityCard(city){
    var K = QZD.conquest;
    var owned = K.owned(city.id);
    var info = K.inspect(city);
    var cost = QZD.formulas.marchCost(city);
    var reward = QZD.formulas.captureGuoJin(city);

    var action;
    if(owned){
      action = '<span class="badge ok">已归版图</span>';
    }else if(info.ok){
      action = '<button class="btn primary" data-march="' + city.id + '">出 征</button>';
    }else{
      action = '<button class="btn ghost" disabled>' + info.reason + '</button>';
    }

    return '<div class="city-card' + (owned ? ' owned' : '') + '">' +
      '<div class="city-top">' +
        '<div class="city-name">' + city.name +
          ' <span class="city-region">' + city.region + '</span></div>' +
        '<div class="city-action">' + action + '</div>' +
      '</div>' +
      '<div class="city-meta">' +
        '<span>守备 <b>' + city.defense + '</b></span>' +
        '<span>军费 国力 <b>' + cost + '</b></span>' +
        '<span>破城 国力 +' + reward + ' · 声望 +' + city.shengWang + '</span>' +
      '</div>' +
      '<div class="city-note">' + city.note +
        ' · 贡赋 金 +' + rate(city.tribute.jinQian) + '/分 · 国 +' + rate(city.tribute.guoJin) + '/分</div>' +
    '</div>';
  }

  function tierCard(tier){
    var cities = C.CITIES.filter(function(c){ return c.tier === tier.tier; });
    var owned = cities.filter(function(c){ return QZD.conquest.owned(c.id); }).length;
    return '<section class="card">' +
      '<div class="card-head"><span class="card-title">' + tier.name + '</span>' +
      '<span class="card-note">' + tier.note + ' · 已克 ' + owned + ' / ' + cities.length + '</span></div>' +
      '<div class="city-list">' + cities.map(cityCard).join('') + '</div>' +
    '</section>';
  }

  UI.register('conquest', function(){
    var K = QZD.conquest;
    var power = K.power();
    var buff = QZD.checkin.buffValue();
    var ownedCount = K.ownedList().length;
    var next = K.nextTarget();
    var nextPct = next ? Math.min(100, Math.floor(power / next.defense * 100)) : 100;
    var gap = next ? Math.max(0, Math.ceil(next.defense - power)) : 0;

    var head = '<section class="card">' +
      '<div class="card-head"><span class="card-title">兵 势</span>' +
      '<span class="card-note">1 国力 = 1 战力</span></div>' +
      '<div class="realm-stats">' +
        stat('当前战力', UI.fmt.num(power)) +
        stat('国力', UI.fmt.num(QZD.state.resources.guoJin)) +
        stat('属城', ownedCount + ' / ' + C.CITIES.length) +
        stat('战力 BUFF', buff ? '+' + Math.round(buff * 100) + '%' : '无', buff ? 'hot' : '') +
      '</div>' +
      (next
        ? '<p class="today-line">下一目标「' + next.name + '」 · 战力 ' +
          UI.fmt.num(power) + ' / ' + next.defense +
          (gap ? '（尚差 ' + gap + '）' : '（已可出征）') + '</p>' +
          '<div class="bar"><i style="width:' + nextPct + '%"></i></div>'
        : '<p class="today-line">十二城尽归版图，四海宾服。</p>') +
      '<p class="page-foot" style="margin-top:10px">战力 ≥ 守备即可出征，必胜。军费为守备的 ' +
        Math.round(C.COST_RATIO * 100) + '%，破城返还守备的 ' +
        Math.round(C.REWARD_RATIO * 100) + '% 国力。</p>' +
    '</section>';

    /* 属地贡赋并入本页：先「兵势」，再「可征之城」，最后「已归版图 + 贡赋合计」 */
    var fief = (UI.fiefBlock && UI.fiefBlock.render) ? UI.fiefBlock.render() : '';
    return head + C.TIERS.map(tierCard).join('') + fief;
  });

  /* 出征二次确认 */
  document.addEventListener('click', function(e){
    var btn = e.target.closest('[data-march]');
    if(!btn || btn.disabled) return;

    var city = QZD.conquest.cityById(btn.getAttribute('data-march'));
    if(!city) return;
    var info = QZD.conquest.inspect(city);
    if(!info.ok){
      UI.toast(info.reason);
      return;
    }

    UI.confirm(
      '<div class="city-confirm">' +
        '<p>御驾亲征「<b>' + city.name + '</b>」</p>' +
        '<p class="card-note">守备 ' + city.defense + ' · 当前战力 ' + UI.fmt.num(info.power) +
        ' · 军费国力 ' + info.cost + '</p>' +
        '<p class="card-note">克城后：国力 +' + QZD.formulas.captureGuoJin(city) +
        ' · 声望 +' + city.shengWang + '，并开始收取贡赋。</p>' +
      '</div>',
      function(){
        var res = QZD.conquest.march(city.id);
        if(!res.ok){
          UI.toast(res.error);
          return;
        }
        UI.toast('克复「' + city.name + '」 · 声望 +' + res.reward.shengWang);
        UI.onStateChanged();
      },
      { title: '出 征', okText: '御驾亲征' }
    );
  });
})();
