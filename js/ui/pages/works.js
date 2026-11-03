/* 内政营造：六项工程升级，产出与加成长期滚存 */
(function(){
  var CFG = QZD.config;
  var W = CFG.WORKS;
  var UI = QZD.ui;

  function stat(label, value, cls){
    return '<div class="realm-stat' + (cls ? ' ' + cls : '') + '">' +
      '<span>' + label + '</span><b>' + value + '</b></div>';
  }

  function dec(n){ return (Math.round((n || 0) * 100) / 100).toFixed(2); }

  /* 每级效果文案 */
  function levelEffect(item){
    var e = item.effect || {};
    var parts = [];
    if(e.jinQianPerMin) parts.push('金钱 +' + dec(e.jinQianPerMin) + '/分');
    if(e.guoJinPerMin) parts.push('国力 +' + dec(e.guoJinPerMin) + '/分');
    if(e.tributePct) parts.push('贡赋 +' + dec(e.tributePct * 100) + '%');
    if(e.powerPct) parts.push('战力 +' + dec(e.powerPct * 100) + '%');
    return parts.join(' · ') || '—';
  }

  /* 当前等级累计效果 */
  function totalEffect(item){
    var lv = QZD.works.levelOf(item.id);
    if(!lv) return '尚未营造';
    var e = item.effect || {};
    var parts = [];
    if(e.jinQianPerMin) parts.push('金钱 +' + dec(e.jinQianPerMin * lv) + '/分');
    if(e.guoJinPerMin) parts.push('国力 +' + dec(e.guoJinPerMin * lv) + '/分');
    if(e.tributePct) parts.push('贡赋 +' + dec(e.tributePct * lv * 100) + '%');
    if(e.powerPct) parts.push('战力 +' + dec(e.powerPct * lv * 100) + '%');
    return parts.join(' · ');
  }

  function itemCard(item){
    var lv = QZD.works.levelOf(item.id);
    var max = W.MAX_LEVEL;
    var check = QZD.works.canBuild(item.id);
    var cost = check.cost || QZD.works.costOf(item.id);

    var action;
    if(lv >= max){
      action = '<span class="badge ok">已满级</span>';
    }else if(check.ok){
      action = '<button class="btn primary" data-build="' + item.id + '">营 造</button>';
    }else{
      action = '<button class="btn ghost" disabled title="' + UI.fmt.escape(check.reason) + '">' +
        UI.fmt.escape(check.reason) + '</button>';
    }

    return '<div class="work-card' + (lv ? ' built' : '') + '">' +
      '<div class="work-top">' +
        '<div class="work-name">' + item.name +
          ' <span class="work-dept">' + item.dept + '</span>' +
          ' <span class="badge ' + (lv ? 'ok' : 'tag') + '">Lv.' + lv + ' / ' + max + '</span></div>' +
        '<div class="work-action">' + action + '</div>' +
      '</div>' +
      '<div class="work-meta">' +
        '<span>每级 ' + levelEffect(item) + '</span>' +
        '<span>当前 ' + totalEffect(item) + '</span>' +
      '</div>' +
      '<div class="work-cost">造价 金钱 <b>' + cost.jinQian + '</b> · 国力 <b>' + cost.guoJin + '</b>' +
        (lv >= max ? '' : ' · 共 ' + max + ' 级') + '</div>' +
      '<div class="work-note">' + item.note + '</div>' +
    '</div>';
  }

  UI.register('works', function(){
    var per = QZD.works.perMinute();
    var tribute = QZD.works.tributeBonus();
    var power = QZD.works.powerBonus();
    var total = QZD.works.totalLevels();

    var head = '<section class="card">' +
      '<div class="card-head"><span class="card-title">营 造 概 览</span>' +
      '<span class="card-note">产出按真实时间入账 · 离线封顶 ' + W.OFFLINE_CAP_HOURS + ' 小时</span></div>' +
      '<div class="realm-stats">' +
        stat('营造总级', total) +
        stat('金钱产出', '+' + dec(per.jinQian) + '/分', per.jinQian ? 'hot' : '') +
        stat('国力产出', '+' + dec(per.guoJin) + '/分', per.guoJin ? 'hot' : '') +
        stat('贡赋 / 战力', '+' + dec(tribute * 100) + '% / +' + dec(power * 100) + '%',
          (tribute || power) ? 'hot' : '') +
      '</div>' +
      '<p class="page-foot" style="margin-top:8px">营造即时扣金钱与国力，等级越高造价越高；贡赋加成与名臣理政加成叠乘。</p>' +
    '</section>';

    return head + '<section class="card">' +
      '<div class="card-head"><span class="card-title">工 程 营 造</span>' +
      '<span class="card-note">共 ' + W.ITEMS.length + ' 项 · 每项最高 ' + W.MAX_LEVEL + ' 级</span></div>' +
      '<div class="work-list">' + W.ITEMS.map(itemCard).join('') + '</div>' +
    '</section>';
  });

  document.addEventListener('click', function(e){
    var btn = e.target.closest('[data-build]');
    if(!btn || btn.disabled) return;

    var id = btn.getAttribute('data-build');
    var item = QZD.works.itemById(id);
    if(!item) return;
    var check = QZD.works.canBuild(id);
    if(!check.ok){ UI.toast(check.reason); return; }

    var lv = QZD.works.levelOf(id);
    var cost = check.cost;
    UI.confirm(
      '<p>营造「<b>' + item.name + '</b>」· Lv.' + lv + ' → Lv.' + (lv + 1) + '</p>' +
      '<p class="card-note">耗 金钱 ' + cost.jinQian + ' · 国力 ' + cost.guoJin + '</p>' +
      '<p class="card-note">每级效果：' + levelEffect(item) + '</p>' +
      '<p class="card-note">营造后不可撤销。</p>',
      function(){
        var res = QZD.works.build(id);
        if(!res.ok){ UI.toast(res.error); return; }
        UI.toast('「' + res.item.name + '」升至 Lv.' + res.level);
        UI.onStateChanged();
      },
      { title: '营 造', okText: '动 工' }
    );
  });
})();
