/* 珍宝阁：货架购买 / 我的珍藏 / 赏赐妃嫔·臣子·自服 */
(function(){
  var UI = QZD.ui;

  function money(){ return QZD.state.resources.jinQian || 0; }

  function itemCard(it){
    var owned = QZD.treasury.count(it.id);
    var price = QZD.treasury.priceOf(it);
    var can = money() + 1e-9 >= price;
    return '<div class="item-card">' +
      '<div class="item-top">' +
        '<span class="item-tag">' + UI.fmt.escape(it.tag) + '</span>' +
        '<span class="item-name">' + UI.fmt.escape(it.name) + '</span>' +
        (owned ? '<span class="item-owned">持有 ×' + owned + '</span>' : '') +
      '</div>' +
      '<div class="item-desc">' + UI.fmt.escape(it.desc) + '</div>' +
      '<div class="item-foot">' +
        '<span class="item-price">金钱 ' + price +
          (price !== it.price ? ' <b class="penalty-tag">×2</b>' : '') + '</span>' +
        '<button class="btn primary" data-buy-item="' + it.id + '"' +
          (can ? '' : ' disabled') + '>购 买</button>' +
      '</div>' +
    '</div>';
  }

  function bagRow(it){
    var n = QZD.treasury.count(it.id);
    return '<div class="bag-row">' +
      '<span class="item-tag">' + UI.fmt.escape(it.tag) + '</span>' +
      '<span class="bag-name">' + UI.fmt.escape(it.name) + '</span>' +
      '<span class="bag-desc">' + UI.fmt.escape(it.desc) + '</span>' +
      '<span class="bag-count">×' + n + '</span>' +
      '<button class="btn ghost" data-use-item="' + it.id + '">使 用</button>' +
    '</div>';
  }

  UI.register('treasure', function(){
    var all = QZD.treasury.list();
    var owned = all.filter(function(it){ return QZD.treasury.count(it.id) > 0; });

    return '<section class="card">' +
      '<div class="card-head"><span class="card-title">珍 宝 阁</span>' +
      '<span class="card-note">金钱 ' + UI.fmt.num(money()) + '</span></div>' +
      '<p class="today-line">购丹药与珍宝，可赏赐妃嫔、臣子，或自服以增益四维。' +
        (QZD.study && !QZD.study.isMet()
          ? ' <b class="penalty-tag">未达学习目标，消费 ×' + QZD.study.multiplier() + '</b>'
          : '') + '</p>' +
    '</section>' +

    '<section class="card">' +
      '<div class="card-head"><span class="card-title">货 架</span>' +
      '<span class="card-note">共 ' + all.length + ' 种</span></div>' +
      '<div class="item-grid">' + all.map(itemCard).join('') + '</div>' +
    '</section>' +

    '<section class="card">' +
      '<div class="card-head"><span class="card-title">我的珍藏</span>' +
      '<span class="card-note">' + owned.length + ' 种</span></div>' +
      (owned.length
        ? '<div class="bag-list">' + owned.map(bagRow).join('') + '</div>'
        : '<div class="empty">尚无珍藏<span class="card-note">先在货架购买丹药或珍宝</span></div>') +
    '</section>';
  });

  function doUse(id, targetId){
    var r = QZD.treasury.use(id, targetId);
    if(!r.ok){ UI.toast(r.error); return; }
    UI.toast('已赏' + r.target + ' · ' + QZD.treasury.labelOf(r.item) + ' +' + r.delta);
    UI.onStateChanged();
  }

  function pickTarget(id){
    var it = QZD.treasury.itemById(id);
    if(!it) return;

    /* 按属性归属取受赏对象：谁有这个属性就能赏给谁 */
    var receivers = QZD.treasury.receiversOf(it);
    if(!receivers.length){
      var kind = QZD.treasury.kindOf(it.attr);
      UI.toast(kind === 'consort' ? '后宫尚无妃嫔可赏'
        : kind === 'minister' ? '朝中尚无大臣可赏'
        : '此物无对应属性');
      return;
    }

    /* 只有陛下一个受赏对象时直接自服，不弹窗 */
    if(receivers.length === 1 && receivers[0].kind === 'emperor'){
      doUse(id, null);
      return;
    }

    var rows = receivers.map(function(x){
      return '<button class="pick-row" data-target-id="' + x.id + '" data-kind="' + x.kind + '">' +
        '<span class="pick-name">' + UI.fmt.escape(x.name) + '</span>' +
        '<span class="pick-sub">' + UI.fmt.escape(x.sub) + '</span>' +
      '</button>';
    }).join('');

    var m = UI.modal({
      title: '赏赐 · ' + it.name + '（' + QZD.treasury.labelOf(it) + ' +' + (it.amount || 0) + '）',
      body: '<div class="pick-list">' + rows + '</div>',
      ok: false,
      cancelText: '取消'
    });

    m.root.addEventListener('click', function(e){
      var b = e.target.closest('[data-target-id]');
      if(!b) return;
      var tid = b.getAttribute('data-target-id');
      m.close();
      doUse(id, tid || null);
    });
  }

  document.addEventListener('click', function(e){
    var buyBtn = e.target.closest('[data-buy-item]');
    if(buyBtn){
      if(buyBtn.disabled) return;
      var r = QZD.treasury.buy(buyBtn.getAttribute('data-buy-item'));
      if(!r.ok){ UI.toast(r.error); return; }
      UI.toast('购得「' + r.item.name + '」· 持有 ×' + r.count);
      UI.onStateChanged();
      return;
    }

    var useBtn = e.target.closest('[data-use-item]');
    if(useBtn){ pickTarget(useBtn.getAttribute('data-use-item')); return; }
  });
})();
