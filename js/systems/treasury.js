/* ============================================================
   systems/treasury.js · 珍宝阁：购买 / 持有 / 赏赐
   物品可作用于：妃嫔（容貌/体质/才情/喜爱/宠爱）、
                 臣子（用兵/理政/文采）、帝王（四维）
   ============================================================ */
(function(){
  var CFG = QZD.config;

  function inv(){
    if(!QZD.state.items || typeof QZD.state.items !== 'object' || Array.isArray(QZD.state.items)){
      QZD.state.items = {};
    }
    return QZD.state.items;
  }

  function list(){ return CFG.ITEMS || []; }

  function itemById(id){
    var arr = list();
    for(var i = 0; i < arr.length; i++){
      if(arr[i].id === id) return arr[i];
    }
    return null;
  }

  function count(id){ return inv()[id] || 0; }

  /* 未达成当日学习目标时，珍宝价格按倍率上浮 */
  function priceOf(item){
    return Math.round(item.price * (QZD.study ? QZD.study.multiplier() : 1));
  }

  function clamp(v, lo, hi){ return Math.max(lo, Math.min(hi, v)); }

  /* ---------- 属性归属：谁有这个属性，就能赏给谁 ----------
     不按 item.target 死板配对，按「对象是否有该属性」判定：
     妃嫔有 容貌/体质/才情/喜爱/宠爱；大臣有 用兵/理政/文采；帝王有 四维。 */
  var ATTR_KIND = {
    yan:'consort', ti:'consort', cai:'consort', favor:'consort', dote:'consort',
    war:'minister', gov:'minister', lit:'minister',
    ningShen:'emperor', yuLue:'emperor', mingDe:'emperor', renXin:'emperor'
  };

  function kindOf(attr){ return ATTR_KIND[attr] || null; }

  /* 该物品能赏给谁：返回 [{kind, id, name, sub}]，按「有这个属性」筛选 */
  function receiversOf(item){
    var kind = kindOf(item.attr), out = [];
    if(kind === 'emperor'){
      out.push({ kind:'emperor', id:'', name:'朕（陛下）',
        sub: labelOf(item) + ' ' + ((QZD.state.emperor || {})[item.attr] || 0) + ' / 10' });
    }else if(kind === 'consort'){
      QZD.harem.list().forEach(function(c){
        out.push({ kind:'consort', id:c.id, name:c.name,
          sub: (c.age || '?') + '岁 · ' + labelOf(item) + ' ' + (c[item.attr] || 0) });
      });
    }else if(kind === 'minister'){
      QZD.ministers.list().forEach(function(m){
        out.push({ kind:'minister', id:m.id, name:m.name,
          sub: '用兵 ' + (m.war || 0) + ' · 理政 ' + (m.gov || 0) + ' · 文采 ' + (m.lit || 0) });
      });
    }
    return out;
  }

  /* 反向：某类对象能用哪些已购珍宝（角色页「赏赐」入口用） */
  function itemsFor(kind){
    var m = inv();
    return list().filter(function(it){
      return kindOf(it.attr) === kind && (m[it.id] || 0) > 0;
    });
  }

  function labelOf(item){
    var map = {
      yan:'容貌', ti:'体质', cai:'才情', favor:'喜爱', dote:'宠爱',
      war:'用兵', gov:'理政', lit:'文采',
      ningShen:'凝神', yuLue:'御略', mingDe:'明德', renXin:'仁心'
    };
    return map[item.attr] || item.attr;
  }

  function targetName(item, targetId){
    var kind = kindOf(item.attr);
    if(kind === 'emperor') return '陛下';
    if(kind === 'consort'){
      var c = QZD.harem.consortById(targetId);
      return c ? '「' + c.name + '」' : '妃嫔';
    }
    if(kind === 'minister'){
      var m = QZD.ministers.ministerById(targetId);
      return m ? '「' + m.name + '」' : '大臣';
    }
    return '对象';
  }

  /* 应用效果，返回实际增量（封顶后可能为 0）。
     受赏对象由属性归属决定：有这个属性就能受赏。 */
  function apply(item, targetId){
    var amt = item.amount || 0, before = 0, after = 0;
    var kind = kindOf(item.attr);

    if(kind === 'emperor'){
      var e = QZD.state.emperor;
      before = e[item.attr] || 0;
      e[item.attr] = clamp(before + amt, 0, 10);
      after = e[item.attr];
    }else if(kind === 'consort'){
      var c = QZD.harem.consortById(targetId);
      if(!c) return { ok: false, error: '妃嫔不在后宫' };
      var hi;
      if(item.attr === 'favor') hi = (CFG.FAVOR && CFG.FAVOR.MAX) || 100;
      else if(item.attr === 'dote') hi = (CFG.DOTE && CFG.DOTE.MAX) || 100;
      else hi = (CFG.XUANXIU && CFG.XUANXIU.ATTR_MAX) || 120;
      before = c[item.attr] || 0;
      c[item.attr] = clamp(before + amt, 0, hi);
      after = c[item.attr];
    }else if(kind === 'minister'){
      var m = QZD.ministers.ministerById(targetId);
      if(!m) return { ok: false, error: '大臣不在朝中' };
      before = m[item.attr] || 0;
      m[item.attr] = clamp(before + amt, 0, 120);
      after = m[item.attr];
    }else{
      return { ok: false, error: '此物无对应属性' };
    }
    return { ok: true, delta: after - before, value: after };
  }

  function buy(id){
    var item = itemById(id);
    if(!item) return { ok: false, error: '物品不存在' };
    var price = priceOf(item);
    var money = QZD.state.resources.jinQian || 0;
    if(money + 1e-9 < price) return { ok: false, error: '金钱不足（需 ' + price + '）' };

    QZD.resources.remove({ jinQian: price });
    var m = inv();
    m[id] = (m[id] || 0) + 1;
    QZD.stateIO.pushLog('treasury', '购得「' + item.name + '」 · 耗金钱 ' + price);
    QZD.stateIO.save();
    return { ok: true, item: item, price: price, count: m[id] };
  }

  function use(id, targetId){
    var item = itemById(id);
    if(!item) return { ok: false, error: '物品不存在' };
    var m = inv();
    if((m[id] || 0) < 1) return { ok: false, error: '此物已用尽' };

    /* 帝王四维类：无需选人，直接自服 */
    if(kindOf(item.attr) === 'emperor') targetId = null;

    var r = apply(item, targetId);
    if(!r.ok) return r;

    m[id] = (m[id] || 0) - 1;
    if(m[id] <= 0) delete m[id];

    QZD.stateIO.pushLog('treasury', '赏「' + item.name + '」予' + targetName(item, targetId) +
      ' · ' + labelOf(item) + ' +' + r.delta);
    QZD.stateIO.save();
    return { ok: true, item: item, delta: r.delta, value: r.value, target: targetName(item, targetId) };
  }

  QZD.treasury = {
    list: list,
    itemById: itemById,
    count: count,
    priceOf: priceOf,
    labelOf: labelOf,
    kindOf: kindOf,
    receiversOf: receiversOf,
    itemsFor: itemsFor,
    buy: buy,
    use: use
  };
})();
