/* ============================================================
   systems/privy.js · P0 开殿分配（内帑 / 妃子私房钱）
   ------------------------------------------------------------
   资金架构：
   - resources.jinQian 是【唯一主账户＝国库】，选秀 / 珍宝 / 册封 /
     营造 / 科举等所有消耗都从它扣（沿用既有代码，一行不改）
   - 在线勤政赚到的钱直接进国库；privy.balance 只做「本次收益」记账
   - 登录时由玩家选一个【固定金额档位】，从国库拨给妃子 purse
     （她们自己的账，隔离）；其余原封不动留在国库，本来就能花
   - 不用比例：档位不随国库 / 收益增长而水涨船高，数字可预期
   - 实拨额受两重上限：不超过本次勤政收益、不超过国库余额
   - 离线不计提；未分配则额度保留、不扣钱、不阻塞、不催
   - 妃子池内部分配：等额保底 + 位份/宠爱/喜爱加权，总额守恒
   ============================================================ */
(function(){
  var CFG = QZD.config.PRIVY || {};

  function P(){
    var s = QZD.state;
    if(!s.privy || typeof s.privy !== 'object') s.privy = {};
    var p = s.privy;
    if(typeof p.balance !== 'number' || !isFinite(p.balance)) p.balance = 0;
    if(typeof p.pendingDays !== 'number') p.pendingDays = 0;
    if(typeof p.tierId !== 'string' || !tierById(p.tierId)){
      p.tierId = CFG.DEFAULT_TIER || 'usual';
    }
    if(typeof p.totalCaptured !== 'number') p.totalCaptured = 0;
    if(typeof p.totalAllocated !== 'number') p.totalAllocated = 0;
    if(typeof p.lastSettledDate !== 'string') p.lastSettledDate = '';
    if(typeof p.lastShownDate !== 'string') p.lastShownDate = '';
    if(typeof p.lastCountedDate !== 'string') p.lastCountedDate = '';
    return p;
  }

  function tiers(){ return CFG.TIERS || []; }
  function tierById(id){
    var ts = tiers(), i;
    for(i = 0; i < ts.length; i++) if(ts[i].id === id) return ts[i];
    for(i = 0; i < ts.length; i++) if(ts[i].id === (CFG.DEFAULT_TIER || 'usual')) return ts[i];
    return ts[0] || { id: 'usual', name: '常例', amount: 100, note: '' };
  }
  function today(){ return QZD.stateIO.todayStr(); }
  function esc(s){
    return String(s == null ? '' : s).replace(/[&<>"']/g, function(ch){
      return '&#' + ch.charCodeAt(0) + ';';
    });
  }
  function isOnline(){
    return (typeof document === 'undefined') || document.visibilityState === 'visible';
  }
  function list(){
    return (QZD.harem && QZD.harem.list) ? QZD.harem.list().filter(Boolean) : [];
  }
  function weight(c){
    /* 宠爱按「当前位分上限」归一化，避免上限提高后权重虚高（满宠始终是满权重） */
    var doteCap = (QZD.harem && QZD.harem.doteMaxOf)
      ? QZD.harem.doteMaxOf(c) : 100;
    var favorCap = (QZD.harem && QZD.harem.favorMaxOf)
      ? QZD.harem.favorMaxOf(c) : 100;
    return 1 + (CFG.W_RANK || 0.15) * (c.rank || 0)
             + (CFG.W_DOTE || 0.20) * ((c.dote || 0) / doteCap)
             + (CFG.W_FAVOR || 0.10) * ((c.favor || 0) / favorCap);
  }
  function titles(){ return (QZD.config.RANK && QZD.config.RANK.TITLES) || []; }

  /* 按权重把总额 total 分给 cs，返回与 cs 等长的整数数组，合计恒等于 total */
  function split(total, cs){
    var n = cs.length, out = [];
    if(!n || total <= 0) return cs.map(function(){ return 0; });
    var g = (CFG.GUARANTEE || 0.20) * total / n;
    var pool = total * (1 - (CFG.GUARANTEE || 0.20));
    var sum = 0, i;
    for(i = 0; i < n; i++) sum += weight(cs[i]);
    for(i = 0; i < n; i++) out.push(Math.floor(g + pool * weight(cs[i]) / sum));
    var rest = total - out.reduce(function(a, b){ return a + b; }, 0);
    var best = 0;
    for(i = 1; i < n; i++) if(weight(cs[i]) > weight(cs[best])) best = i;
    if(rest > 0) out[best] += rest;
    return out;
  }

  /* 在线勤政结算：钱已进国库，这里只记「这次有多少收益可分配」，全额记账 */
  function capture(jinQianGain){
    if(!(jinQianGain > 0) || !isOnline()) return 0;
    var p = P();
    p.balance += jinQianGain;
    p.totalCaptured += jinQianGain;
    return jinQianGain;
  }

  function pending(){
    var p = P();
    return { balance: Math.floor(p.balance), pendingDays: p.pendingDays, has: p.balance >= 1 };
  }

  /* 建议分配值（不写状态）：档位金额，但不得超过本次收益与国库余额 */
  function suggest(tierId){
    var p = P();
    var tier = tierById(tierId || p.tierId);
    var G = Math.max(0, Math.floor(p.balance));
    var wallet = Math.max(0, Math.floor((QZD.state.resources &&
      QZD.state.resources.jinQian) || 0));
    var cs = list();
    var cap = Math.min(G, wallet);
    var want = tier.amount * cs.length;      /* 每人金额 × 在册人数 */
    var F = Math.min(want, cap);
    var vals = split(F, cs);
    var per = cs.map(function(c, i){
      return {
        id: c.id,
        name: c.name || '妃嫔',
        rank: c.rank || 0,
        rankName: titles()[c.rank || 0] || '',
        dote: c.dote || 0,
        favor: c.favor || 0,
        purse: c.purse || 0,
        suggest: vals[i]
      };
    });
    return { G: G, cap: cap, tier: tier, want: want, F: F, netKeep: G - F,
             walletAfter: wallet - F, n: cs.length,
             perConsort: per, pendingDays: p.pendingDays };
  }

  /* 执行分配：只从国库（jinQian）拨 F 给妃子；其余根本不动 */
  function allocate(tierId){
    var p = P();
    var s = suggest(tierId);
    if(s.G < 1) return { ok: false, error: '暂无可拨内帑' };
    if(s.F < 1) return { ok: false, error: '国库金钱不足，额度保留到下次' };

    var cs = list();
    var vals = split(s.F, cs);
    var details = [];
    QZD.resources.remove({ jinQian: s.F });
    cs.forEach(function(c, i){
      var v = vals[i] || 0;
      c.purse = (c.purse || 0) + v;
      details.push({ id: c.id, name: c.name, value: v });
    });

    p.balance = 0;                 /* 本次收益处理完毕，余款本来就在国库 */
    p.pendingDays = 0;
    p.tierId = s.tier.id;
    p.totalAllocated += s.F;
    p.lastSettledDate = today();
    p.lastShownDate = today();

    QZD.stateIO.pushLog('privy', '开殿分配 · ' + s.tier.name + ' · 勤政收益 ' + s.G +
      ' · 拨妃子 ' + s.F + '（' + cs.length + ' 人）· 本次净留国库 ' + s.netKeep);
    QZD.stateIO.save();
    return { ok: true, tier: s.tier, G: s.G, F: s.F, netKeep: s.netKeep,
             n: cs.length, details: details };
  }

  /* 暂不分配：额度原样保留，只标记今日已弹过，不扣钱、不催 */
  function skip(){
    var p = P();
    p.lastShownDate = today();
    QZD.stateIO.save();
  }

  /* 面板：固定金额档位 + 每人建议值 + 一键照准 */
  function showPanel(){
    var s0 = suggest();
    if(s0.G < 1 || !QZD.ui || !QZD.ui.modal) return;
    var activeId = s0.tier.id;

    var tierBtns = tiers().map(function(t){
      return '<button type="button" data-privy-tier="' + esc(t.id) + '" ' +
        'style="flex:1;padding:6px 4px;border:1px solid rgba(128,128,128,.35);' +
        'border-radius:6px;background:transparent;cursor:pointer;font-size:12px">' +
        '<b>' + esc(t.name) + '</b><br><span style="opacity:.75">每人 ' + t.amount + '</span></button>';
    }).join('');

    var body =
      '<p style="margin:0 0 8px">本次勤政收益 <b>' + s0.G + '</b> · 在册 <b>' + s0.n + '</b> 人' +
        (s0.pendingDays > 1 ? ' · 待分配 <b>' + s0.pendingDays + '</b> 日' : '') +
        '　<span style="opacity:.65">（仅来自在线勤政，离线不增）</span></p>' +
      '<div style="display:flex;gap:6px;margin:10px 0" data-privy-tiers>' + tierBtns + '</div>' +
      '<div style="display:flex;gap:18px;margin:8px 0 12px">' +
        '<span>拨出 <b data-privy-f>' + s0.F + '</b></span>' +
        '<span>本次净留国库 <b data-privy-k>' + s0.netKeep + '</b></span>' +
        '<span style="opacity:.65" data-privy-note>' + esc(s0.tier.note) + '</span>' +
      '</div>' +
      '<div style="max-height:180px;overflow:auto;font-size:13px" data-privy-rows></div>' +
      '<p style="opacity:.6;font-size:12px;margin:10px 0 0">' +
        '档位是每人金额，妃子池总额＝每人 × 在册人数；不随国库增长，实拨不超过本次收益与国库余额。' +
        '国库＝你的金钱主账户，所有消耗都从这里出；妃子私房钱是她们自己的账。' +
        '不分配则不扣钱、额度留到下次。</p>';

    var m = QZD.ui.modal({
      title: '开殿 · 内帑分配',
      body: body,
      ok: true,
      okText: '照准',
      cancelText: '暂不分配',
      onCancel: function(){ skip(); },
      onOk: function(){
        var res = allocate(activeId);
        if(!res.ok){ if(QZD.ui.toast) QZD.ui.toast(res.error); return false; }
        if(QZD.ui.toast) QZD.ui.toast('已照准 · ' + res.tier.name + ' · 拨妃子 ' + res.F +
          ' · 本次净留国库 ' + res.netKeep);
        if(QZD.ui.onStateChanged) QZD.ui.onStateChanged();
        return true;
      }
    });

    function markTier(id){
      var btns = m.root.querySelectorAll('[data-privy-tier]');
      for(var i = 0; i < btns.length; i++){
        var on = btns[i].getAttribute('data-privy-tier') === id;
        btns[i].style.background = on ? 'rgba(151,196,89,.45)' : 'transparent';
        btns[i].style.borderColor = on ? '#639922' : 'rgba(128,128,128,.35)';
      }
    }
    function refresh(id){
      activeId = id;
      var s = suggest(id);
      markTier(id);
      var f = m.root.querySelector('[data-privy-f]');
      var k = m.root.querySelector('[data-privy-k]');
      var note = m.root.querySelector('[data-privy-note]');
      if(f) f.textContent = s.F;
      if(k) k.textContent = s.netKeep;
      if(note) note.textContent = s.tier.note || '';
      var rows = m.root.querySelector('[data-privy-rows]');
      if(rows){
        rows.innerHTML = s.perConsort.map(function(x){
          return '<div style="display:flex;justify-content:space-between;align-items:center;' +
                 'padding:4px 0;border-bottom:1px solid rgba(128,128,128,.18)">' +
                   '<span>' + esc(x.name) +
                     '<small style="opacity:.6;margin-left:6px">' + esc(x.rankName) + '</small></span>' +
                   '<b>' + x.suggest + '</b>' +
                 '</div>';
        }).join('') || '<p style="opacity:.65;margin:6px 0">后宫尚无所出，本次收益全留国库。</p>';
      }
    }

    m.root.addEventListener('click', function(e){
      var btn = e.target.closest && e.target.closest('[data-privy-tier]');
      if(!btn) return;
      refresh(btn.getAttribute('data-privy-tier'));
    });
    refresh(activeId);
  }

  /* 启动时调用：每日首次登录累计待分配天数，且当天只弹一次 */
  function onLaunch(){
    var p = P(), t = today();
    if(p.lastCountedDate !== t){
      p.lastCountedDate = t;
      if(p.balance >= 1){
        p.pendingDays = Math.min((p.pendingDays || 0) + 1, CFG.MAX_PENDING_DAYS || 30);
      }
      QZD.stateIO.save();
    }
    if(p.balance >= 1 && p.lastShownDate !== t){
      p.lastShownDate = t;
      QZD.stateIO.save();
      setTimeout(showPanel, 350);
    }
  }

  QZD.privy = {
    capture: capture,
    pending: pending,
    suggest: suggest,
    allocate: allocate,
    skip: skip,
    onLaunch: onLaunch,
    showPanel: showPanel
  };
})();
