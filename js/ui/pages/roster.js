/* 角色名册 · M3 名臣 / M4 妃嫔与皇子
   名臣：开科取士、钦点入朝、上阵加成
   妃嫔：选秀纳妃、寝宫召幸、受孕临盆
   皇子：出生名录与三维资质 */
(function(){
  var CFG = QZD.config;
  var UI = QZD.ui;
  var K = CFG.KEJU;
  var M = CFG.MINISTER;
  var X = CFG.XUANXIU;
  var H = CFG.HAREM;

  var TABS = [
    { id: 'ministers', name: '名臣' },
    { id: 'consorts',  name: '妃嫔' },
    { id: 'princes',   name: '皇子' }
  ];

  var activeTab = 'ministers';

  function attrItem(label, value, cls){
    return '<span class="attr ' + cls + '"><span>' + label + '</span><b>' + value + '</b></span>';
  }

  function govPercent(){
    return (Math.round(QZD.ministers.govBonus() * 1000) / 10).toFixed(1);
  }

  function tabsRow(){
    return '<div class="tab-row">' + TABS.map(function(t){
      return '<button class="tab' + (t.id === activeTab ? ' active' : '') + '" data-mtab="' + t.id + '">' +
        t.name + '</button>';
    }).join('') + '</div>';
  }

  /* ---------- 名臣 ---------- */
  function ministersSummary(){
    var list = QZD.ministers.list();
    var fielded = QZD.ministers.fieldedCount();
    var war = QZD.ministers.warBonus();
    var idle = list.filter(function(m){ return !m.fielded && !m.fromPrince; }).length;
    return '<section class="card">' +
      '<div class="card-head"><span class="card-title">名 册</span>' +
      '<span class="card-note">上阵最多 ' + M.FIELD_SLOTS + ' 人</span></div>' +
      '<div class="realm-stats">' +
        '<div class="realm-stat"><span>在朝名臣</span><b>' + list.length + '</b></div>' +
        '<div class="realm-stat"><span>上阵</span><b>' + fielded + ' / ' + M.FIELD_SLOTS + '</b></div>' +
        '<div class="realm-stat' + (war ? ' hot' : '') + '"><span>战力加成</span><b>+' + UI.fmt.num(war) + '</b></div>' +
        '<div class="realm-stat"><span>贡赋加成</span><b>+' + govPercent() + '%</b></div>' +
      '</div>' +
      (idle ? '<div class="btn-row" style="margin-top:10px">' +
        '<button class="btn ghost" data-dismiss-idle>遣散闲置 ' + idle + ' 人</button>' +
        '</div><p class="card-note" style="margin-top:6px">上阵仅 ' + M.FIELD_SLOTS +
        ' 个名额，闲置大臣可「致仕」换取金钱与声望（按三维合计折算）。</p>' : '') +
    '</section>';
  }

  function examPanel(){
    var pending = QZD.ministers.pending().length;
    var jin = QZD.state.resources.jinQian;
    var reason = pending
      ? '已有待录人才，请先钦点其一'
      : (jin + 1e-9 < K.COST_JIN ? '金钱不足（需 ' + K.COST_JIN + '）' : '');

    return '<section class="card">' +
      '<div class="card-head"><span class="card-title">科 举</span>' +
      '<span class="card-note">金钱 ' + K.COST_JIN + ' / 次 · 榜下 ' + K.CANDIDATES + ' 人</span></div>' +
      '<p class="today-line">开科一次耗 <b>' + K.COST_JIN + '</b> 金钱，取 ' + K.CANDIDATES +
        ' 人入榜，钦点其一入朝，余者归乡。文采每 ' + M.LIT_PER_SHENGWANG + ' 点，入朝声望 +1。</p>' +
      (reason ? '<p class="page-foot" style="margin-bottom:10px">' + reason + '</p>' : '') +
      '<div class="btn-row">' +
        '<button class="btn primary" data-keju' + (reason ? ' disabled' : '') + '>开 科</button>' +
      '</div>' +
    '</section>';
  }

  function candidateCard(c){
    return '<div class="talent-card">' +
      '<div class="portrait-wrap">' + QZD.portrait.svg(c.id, c.name) + '</div>' +
      '<div class="talent-main">' +
        '<div class="talent-name">' + UI.fmt.escape(c.name) + '</div>' +
        '<div class="attr-row">' +
          attrItem('用兵', c.war, 'war') +
          attrItem('理政', c.gov, 'gov') +
          attrItem('文采', c.lit, 'lit') +
        '</div>' +
        '<div class="talent-foot">入朝声望 +' + QZD.formulas.litShengWang(c.lit) + '</div>' +
      '</div>' +
      '<div class="talent-action">' +
        '<button class="btn primary" data-recruit="' + c.id + '">钦 点</button>' +
      '</div>' +
    '</div>';
  }

  function pendingPanel(){
    var list = QZD.ministers.pending();
    if(!list.length) return '';
    return '<section class="card">' +
      '<div class="card-head"><span class="card-title">待录人才</span>' +
      '<span class="card-note">已付科考银 · 钦点其一</span></div>' +
      '<div class="talent-list">' + list.map(candidateCard).join('') + '</div>' +
    '</section>';
  }

  function ministerCard(m){
    var action = m.fielded
      ? '<button class="btn ghost" data-field="' + m.id + '">撤 下</button>'
      : '<button class="btn primary" data-field="' + m.id + '">上 阵</button>';

    return '<div class="talent-card' + (m.fielded ? ' fielded' : '') + '">' +
      '<div class="portrait-wrap">' + QZD.portrait.svg(m.id, m.name) + '</div>' +
      '<div class="talent-main">' +
        '<div class="talent-name">' + UI.fmt.escape(m.name) +
          (m.fielded ? ' <span class="badge ok">上阵中</span>' : '') + '</div>' +
        '<div class="attr-row">' +
          attrItem('用兵', m.war, 'war') +
          attrItem('理政', m.gov, 'gov') +
          attrItem('文采', m.lit, 'lit') +
        '</div>' +
        '<div class="talent-foot">上阵加成 · 战力 +' + UI.fmt.num((m.war || 0) * M.WAR_PER_POINT) +
          ' · 贡赋 +' + (Math.round((m.gov || 0) * M.GOV_PER_POINT * 1000) / 10).toFixed(1) + '%</div>' +
      '</div>' +
      '<div class="talent-action">' + action +
        '<button class="btn ghost" data-gift="minister:' + m.id + '">赏 赐</button>' +
        '<button class="btn ghost danger" data-dismiss="' + m.id + '">致 仕</button></div>' +
    '</div>';
  }

  function ministersPanel(){
    var list = QZD.ministers.list();
    if(!list.length){
      return '<section class="card">' +
        '<div class="card-head"><span class="card-title">在朝名臣</span>' +
        '<span class="card-note">尚无一人</span></div>' +
        '<div class="empty">名册空空<span class="card-note">开科取士，钦点人才入朝</span></div>' +
      '</section>';
    }
    return '<section class="card">' +
      '<div class="card-head"><span class="card-title">在朝名臣</span>' +
      '<span class="card-note">共 ' + list.length + ' 人 · 上阵 ' +
        QZD.ministers.fieldedCount() + ' / ' + M.FIELD_SLOTS + '</span></div>' +
      '<div class="talent-list">' + list.map(ministerCard).join('') + '</div>' +
    '</section>';
  }

  /* ---------- 妃嫔 ---------- */
  function haremSummary(){
    var list = QZD.harem.list();
    var pregnant = QZD.harem.pregnantCount();
    var princeCount = QZD.harem.princes().length;
    var bonus = (QZD.state.emperor.renXin || 0) * H.RENXIN_PER_LEVEL;
    return '<section class="card">' +
      '<div class="card-head"><span class="card-title">后 宫</span>' +
      '<span class="card-note">不限人数 · 孕期 ' + H.PREGNANCY_MIN + ' 分钟</span></div>' +
      '<div class="realm-stats">' +
        '<div class="realm-stat"><span>在宫妃嫔</span><b>' + list.length + '</b></div>' +
        '<div class="realm-stat' + (pregnant ? ' hot' : '') + '"><span>有孕</span><b>' + pregnant + '</b></div>' +
        '<div class="realm-stat"><span>皇子</span><b>' + princeCount + '</b></div>' +
        '<div class="realm-stat' + (bonus ? ' hot' : '') + '"><span>受孕加成</span><b>+' +
          Math.round(bonus * 100) + '%</b></div>' +
      '</div>' +
    '</section>';
  }

  /* ---------- 抽卡选秀面板（单抽 / 十连，抽到即入宫） ---------- */
  function selectionPanel(){
    var jin = QZD.state.resources.jinQian;
    var G = QZD.config.GACHA || {};
    var single = QZD.harem.gachaCost(1);
    var ten = QZD.harem.gachaCost(10);
    var pRare = Math.round((G.P_RARE != null ? G.P_RARE : 0.06) * 100);
    var pUnc = Math.round((G.P_UNCOMMON != null ? G.P_UNCOMMON : 0.28) * 100);
    var pCom = Math.max(0, 100 - pRare - pUnc);
    var singleReason = jin + 1e-9 < single ? '金钱不足（需 ' + single + '）' : '';
    var tenReason = jin + 1e-9 < ten ? '金钱不足（需 ' + ten + '）' : '';

    return '<section class="card">' +
      '<div class="card-head"><span class="card-title">选 秀 · 抽 卡</span>' +
      '<span class="card-note">单抽 ' + single + ' 金 · 十连 ' + ten + ' 金（9 折）' +
        (single !== (G.PULL_COST || 120) ? ' · 未达标 ×2' : '') + '</span></div>' +
      '<p class="today-line">单抽 <b>' + single + '</b> 金钱抽一位候选秀女；十连 <b>' + ten +
        '</b> 金钱（单抽 9 折）连抽十位候选。<b>抽出后自行勾选入宫</b>，一人不选即放弃本次选秀。' +
        '名字、三维、性格、人设均随机；后宫不限人数，无需扩建。</p>' +
      '<div class="realm-stats">' +
        '<div class="realm-stat"><span>绝色</span><b>' + pRare + '%</b></div>' +
        '<div class="realm-stat"><span>稀有</span><b>' + pUnc + '%</b></div>' +
        '<div class="realm-stat"><span>普通</span><b>' + pCom + '%</b></div>' +
        '<div class="realm-stat"><span>稀世余</span><b>' + QZD.harem.rareRemaining().length + '</b></div>' +
      '</div>' +
      '<p class="card-note" style="margin-top:6px">绝色取稀世立绘（三维 90–120，动态 / 多姿态）；' +
        '稀有三维 70–120；普通三维 30–90。稀世立绘抽尽后绝色降级为稀有。</p>' +
      (singleReason ? '<p class="page-foot" style="margin-bottom:6px">' + singleReason + '</p>' : '') +
      (tenReason ? '<p class="page-foot" style="margin-bottom:6px">' + tenReason + '</p>' : '') +
      '<div class="btn-row">' +
        '<button class="btn primary" data-gacha="1"' + (singleReason ? ' disabled' : '') + '>单 抽</button>' +
        '<button class="btn ghost" data-gacha="10"' + (tenReason ? ' disabled' : '') + '>十 连</button>' +
      '</div>' +
    '</section>';
  }

  /* 抽卡结果弹窗：每人带立绘缩略图 + 档位 + 三维，可勾选入宫 */
  var lastGacha = null;

  function gachaRow(o, i){
    var tagCls = o.rarity === 'rare' ? 'rare' : (o.rarity === 'uncommon' ? 'ok' : '');
    var tagName = o.rarity === 'rare' ? '绝色' : (o.rarity === 'uncommon' ? '稀有' : '普通');
    var c = o.consort;
    var pic = QZD.portrait.svg(c.id, c.name,
      { kind: 'female', img: c.img, model: c.model });
    return '<div class="gacha-row pick-row' + (o.rarity === 'rare' ? ' is-rare' : '') + '" data-pick="' + i + '">' +
      '<div class="gacha-pic">' + pic + '</div>' +
      '<div class="gacha-info">' +
        '<span class="pick-name">' + UI.fmt.escape(c.name) +
          ' <span class="badge ' + tagCls + '">' + tagName + '</span></span>' +
        '<span class="pick-sub">容貌 ' + c.yan + ' · 体质 ' + c.ti + ' · 才情 ' + c.cai +
          ' · ' + QZD.harem.personalityName(c.personality) +
          (c.trait ? ' · ' + UI.fmt.escape(c.trait) : '') + '</span>' +
      '</div>' +
      '<div class="pick-check" aria-hidden="true"></div>' +
    '</div>';
  }

  function pickCount(mask){
    return mask.querySelectorAll('[data-pick].selected').length;
  }
  function refreshPickUI(mask, total){
    var n = pickCount(mask);
    var okBtn = mask.querySelector('[data-modal-ok]');
    if(okBtn) okBtn.textContent = n > 0 ? ('确认入宫 (' + n + ')') : '放弃选人';
    var hint = mask.querySelector('#gachaPickHint');
    if(hint) hint.textContent = '已选 ' + n + ' / ' + total;
  }

  function showGachaResult(res){
    lastGacha = res;
    var list = res.candidates || res.results || [];
    var total = list.length;
    var rows = list.map(gachaRow).join('');
    var rares = list.filter(function(o){ return o.rarity === 'rare'; }).length;
    var m = UI.modal({
      title: '选秀结果 · 抽得 ' + total + ' 名候选' + (rares ? ' · 绝色 ×' + rares : ''),
      body:
        '<p class="card-note" style="margin:0 2px 8px">点击勾选要入宫之人；<b>不勾选任何一人即视为放弃本次选秀</b>。' +
          '抽卡费 ' + res.cost + ' 金钱已扣除（放弃不退）。</p>' +
        '<div class="pick-list gacha-list" id="gachaPickList">' + rows + '</div>' +
        '<div class="gacha-foot">' +
          '<button class="btn ghost sm" data-pick-all>全选</button>' +
          '<span id="gachaPickHint" class="card-note">已选 0 / ' + total + '</span>' +
        '</div>',
      ok: true,
      okText: '确认入宫 (0)',
      onOk: function(mask){ return confirmGachaPick(mask); },
      cancelText: '放弃选人',
      onCancel: function(){ abandonGacha(); }
    });
    /* 行点击切换勾选；全选按钮切换全选/全不选 */
    m.root.addEventListener('click', function(e){
      var row = e.target.closest('[data-pick]');
      if(row){
        row.classList.toggle('selected');
        refreshPickUI(m.root, total);
        return;
      }
      if(e.target.closest('[data-pick-all]')){
        var all = m.root.querySelectorAll('[data-pick]');
        var turnOn = pickCount(m.root) !== all.length;
        Array.prototype.forEach.call(all, function(el){ el.classList.toggle('selected', turnOn); });
        refreshPickUI(m.root, total);
      }
    });
  }

  function confirmGachaPick(mask){
    if(!lastGacha) return true;
    var list = lastGacha.candidates || lastGacha.results || [];
    var total = list.length;
    var idx = [];
    mask.querySelectorAll('[data-pick].selected').forEach(function(el){
      idx.push(parseInt(el.getAttribute('data-pick'), 10));
    });
    var chosen = idx.map(function(i){ return list[i] ? list[i].consort : null; }).filter(Boolean);

    if(!chosen.length){
      abandonGacha();
      return true;   /* 关闭弹窗：放弃本次选秀 */
    }
    var r = QZD.harem.commitConsorts(chosen);
    if(!r.ok){ UI.toast(r.error); return false; }   /* 校验未过，保持打开 */
    UI.toast('入宫 ' + r.added + ' 人');
    UI.onStateChanged();
    return true;
  }

  function abandonGacha(){
    if(lastGacha) UI.toast('已放弃本次选秀（抽卡费 ' + lastGacha.cost + ' 不退还）');
    UI.onStateChanged();
  }

  function pregnancyLine(c){
    var p = c.pregnant;
    if(!p) return '';
    var now = Date.now();
    var total = Math.max(1, p.dueAt - p.conceivedAt);
    var pct = Math.max(0, Math.min(100, Math.floor((now - p.conceivedAt) / total * 100)));
    var remain = Math.max(0, Math.ceil((p.dueAt - now) / 60000));
    return '<div class="preg-line">' +
      '<div class="bar"><i style="width:' + pct + '%"></i></div>' +
      '<span>孕期 · 约 ' + remain + ' 分钟后临盆</span>' +
    '</div>';
  }

  /* 性格标签（与名字同行展示） */
  function personaChip(c){
    var pname = '温婉';
    var list = QZD.config.PERSONALITIES || [];
    for(var i = 0; i < list.length; i++){
      if(list[i].key === c.personality) pname = list[i].name;
    }
    return '<span class="persona-chip">' + UI.fmt.escape(pname) + '</span>';
  }

  /* 人设一行：年龄 · 籍贯 · 出身 · 特长 */
  function personaMeta(c){
    var bits = [];
    if(c.age) bits.push(c.age + '岁');
    if(c.hometown) bits.push(c.hometown);
    if(c.origin) bits.push(c.origin);
    if(c.trait) bits.push(c.trait);
    if(!bits.length) return '';
    return '<div class="persona-meta">' + UI.fmt.escape(bits.join(' · ')) + '</div>';
  }

  /* 宠爱 / 喜爱 双迷你条（候选 / 在宫妃嫔共用） */
  function personaLine(c){
    var fmax = (QZD.config.FAVOR && QZD.config.FAVOR.MAX) || 100;
    var dmax = (QZD.config.DOTE && QZD.config.DOTE.MAX) || 100;
    var f = c.favor || 0;
    var d = c.dote || 0;
    var fp = Math.max(0, Math.min(100, Math.round(f / fmax * 100)));
    var dp = Math.max(0, Math.min(100, Math.round(d / dmax * 100)));
    return '<div class="persona-row">' +
      '<span class="mini-pair">' +
        '<span class="mini-item"><span class="mini-tag dote">宠</span>' +
          '<span class="favor-mini"><span class="favor-mini-fill dote" style="width:' + dp + '%"></span></span>' +
          '<span class="favor-mini-val">' + d + '</span></span>' +
        '<span class="mini-item"><span class="mini-tag">爱</span>' +
          '<span class="favor-mini"><span class="favor-mini-fill" style="width:' + fp + '%"></span></span>' +
          '<span class="favor-mini-val">' + f + '</span></span>' +
      '</span>' +
    '</div>';
  }

  function consortCard(c){
    var rate = Math.round(QZD.harem.rateOf(c) * 100);
    var costQin = QZD.harem.summonCostOf(c);
    var jin = QZD.state.resources.qinZheng;
    var title = QZD.harem.rankTitle(c);
    var action;
    if(c.pregnant){
      action = '<span class="badge buff">有孕在身</span>';
    }else if(jin + 1e-9 < costQin){
      action = '<button class="btn primary" disabled>召 幸</button>';
    }else{
      action = '<button class="btn primary" data-summon="' + c.id + '">召 幸</button>';
    }

    var rankBtn;
    if(QZD.harem.isMaxRank(c)){
      rankBtn = '<button class="btn ghost" disabled>已至贵妃</button>';
    }else{
      var rc = QZD.harem.ennobleCost(c);
      rankBtn = '<button class="btn ghost" data-ennoble="' + c.id + '">册 封 · ' +
        rc.jin + '金/' + rc.sw + '望</button>';
    }

    var multiPose = (Array.isArray(c.poses) && c.poses.length > 1);
    return '<div class="talent-card consort' + (c.pregnant ? ' pregnant' : '') + '">' +
      '<div class="portrait-wrap fem consort-pic' + (multiPose ? ' multi' : '') + '"' +
        (multiPose ? ' data-cycle-pose="' + c.id + '" title="点击更换立绘（' +
          ((c.poseIndex || 0) + 1) + '/' + c.poses.length + '）"' : '') + '>' +
        (c.video
          ? QZD.portrait.video(c.video, c.name)
          : QZD.portrait.svg(c.id, c.name, { kind: 'female', img: c.img, model: c.model })) + '</div>' +
      '<div class="talent-main">' +
        '<div class="talent-name">' + UI.fmt.escape(c.name) + ' ' + personaChip(c) +
          (c.rare ? ' <span class="badge rare">绝色</span>' : '') +
          ' <span class="badge rank">' + UI.fmt.escape(title) + '</span>' +
          (c.pregnant ? ' <span class="badge buff">有孕</span>' : '') + '</div>' +
        '<div class="attr-row">' +
          attrItem('容貌', c.yan, 'lit') +
          attrItem('体质', c.ti, 'gov') +
          attrItem('才情', c.cai, 'war') +
        '</div>' +
        personaMeta(c) +
        personaLine(c) +
        '<div class="talent-foot">受孕率 ' + rate + '% · 召幸耗勤政 ' + costQin +
          (jin + 1e-9 < costQin && !c.pregnant ? '（勤政不足）' : '') +
          (multiPose ? ' · 姿态 <span data-pose-label="' + c.id + '">' +
            ((c.poseIndex || 0) + 1) + '/' + c.poses.length + '</span>（点立绘换）' : '') + '</div>' +
        pregnancyLine(c) +
      '</div>' +
      '<div class="talent-action consort-actions">' + action + rankBtn +
        '<button class="btn ghost" data-gift="consort:' + c.id + '">赏 赐</button></div>' +
    '</div>';
  }

  /* 妃嫔按位分筛选：'all' 或 'r<rank>' */
  var rankFilter = 'all';

  function rankChips(all){
    var titles = (CFG.RANK && CFG.RANK.TITLES) || ['才人'];
    var counts = {};
    all.forEach(function(c){
      var r = Math.max(0, Math.min(titles.length - 1, c.rank || 0));
      counts[r] = (counts[r] || 0) + 1;
    });
    var chips = ['<button class="tab' + (rankFilter === 'all' ? ' active' : '') +
      '" data-rfilter="all">全部 ' + all.length + '</button>'];
    titles.forEach(function(t, i){
      if(!counts[i]) return;
      chips.push('<button class="tab' + (rankFilter === 'r' + i ? ' active' : '') +
        '" data-rfilter="r' + i + '">' + t + ' ' + counts[i] + '</button>');
    });
    return '<div class="tab-row wrap" style="margin-bottom:10px">' + chips.join('') + '</div>';
  }

  function consortsPanel(){
    var all = QZD.harem.list();
    if(!all.length){
      return '<section class="card">' +
        '<div class="card-head"><span class="card-title">在宫妃嫔</span>' +
        '<span class="card-note">尚无一人</span></div>' +
        '<div class="empty">后宫空置<span class="card-note">选秀纳妃，择一入宫</span></div>' +
      '</section>';
    }
    var bar = rankChips(all);
    var list = all;
    if(rankFilter !== 'all'){
      var idx = parseInt(String(rankFilter).slice(1), 10);
      if(isNaN(idx)) idx = 0;
      list = all.filter(function(c){ return (c.rank || 0) === idx; });
      if(!list.length){ rankFilter = 'all'; list = all; }  /* 该位分无人时自动回到全部 */
    }
    var note = '共 ' + all.length + ' 人 · 有孕 ' + QZD.harem.pregnantCount() +
      (rankFilter === 'all' ? '' : ' · 当前 ' + list.length);
    return '<section class="card">' +
      '<div class="card-head"><span class="card-title">在宫妃嫔</span>' +
      '<span class="card-note">' + note + '</span></div>' +
      bar +
      '<div class="consort-grid">' + list.map(consortCard).join('') + '</div>' +
    '</section>';
  }

  /* ---------- 皇子 ---------- */
  var CN_NUM = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十', '十一', '十二'];

  function princeTitle(seq){
    if(seq === 1) return '皇长子';
    if(seq === 2) return '皇次子';
    return '皇' + (CN_NUM[seq] || seq) + '子';
  }

  function princeCard(p){
    var R = CFG.PRINCE;
    var n = Math.max(0, Number(p.trainCount) || 0);
    var trainCost = R.TRAIN_COST + n * R.TRAIN_STEP;
    var jin = QZD.state.resources.jinQian;
    var sw = QZD.state.resources.shengWang;
    var trainBtn = '<button class="btn ghost" data-train-prince="' + p.id + '"' +
      (jin + 1e-9 < trainCost ? ' disabled' : '') + '>培养 · ' + trainCost + ' 金</button>';
    var minBtn = '<button class="btn primary" data-prince-minister="' + p.id + '"' +
      (sw + 1e-9 < (R.MINISTER_COST_SW || 0) ? ' disabled' : '') + '>入朝 · ' +
      (R.MINISTER_COST_SW || 0) + ' 望</button>';

    return '<div class="talent-card">' +
      '<div class="portrait-wrap">' + QZD.portrait.svg(p.id, p.name, { kind: 'prince' }) + '</div>' +
      '<div class="talent-main">' +
        '<div class="talent-name">' + UI.fmt.escape(p.name) +
          ' <span class="badge ok">' + princeTitle(p.seq) + '</span></div>' +
        '<div class="attr-row">' +
          attrItem('用兵', p.war, 'war') +
          attrItem('理政', p.gov, 'gov') +
          attrItem('文采', p.lit, 'lit') +
        '</div>' +
        '<div class="talent-foot">生母 ' + UI.fmt.escape(p.motherName) +
          ' · 诞于 ' + UI.fmt.time(p.bornAt) + ' · 已培养 ' + n + ' 次</div>' +
      '</div>' +
      '<div class="talent-action prince-actions">' + trainBtn + minBtn + '</div>' +
    '</div>';
  }

  function princesPanel(){
    var list = QZD.harem.princes();
    if(!list.length){
      return '<section class="card">' +
        '<div class="card-head"><span class="card-title">皇 子</span>' +
        '<span class="card-note">尚无皇子</span></div>' +
        '<div class="empty">皇嗣未立<span class="card-note">寝宫召幸，有孕临盆后录入名册</span>' +
          '<div class="btn-row" style="justify-content:center;margin-top:14px">' +
            '<button class="btn primary" data-mtab="consorts">前往寝宫</button>' +
          '</div></div>' +
      '</section>';
    }
    return '<section class="card">' +
      '<div class="card-head"><span class="card-title">皇 子</span>' +
      '<span class="card-note">共 ' + list.length + ' 人 · 资质量于帝父与生母</span></div>' +
      '<div class="talent-list">' + list.map(princeCard).join('') + '</div>' +
    '</section>';
  }

  function render(){
    var body;
    if(activeTab === 'consorts'){
      body = haremSummary() + selectionPanel() + consortsPanel();
    }else if(activeTab === 'princes'){
      body = princesPanel();
    }else{
      body = ministersSummary() + examPanel() + pendingPanel() + ministersPanel();
    }
    return tabsRow() + body;
  }

  /* 名册挂载后钩子：把带 data-l2d 的容器交给 Live2D 加载器 */
  function mountRoster(root){
    if(!QZD.live2d) return;
    var nodes = root.querySelectorAll('[data-l2d]');
    for(var i = 0; i < nodes.length; i++){
      QZD.live2d.mount(nodes[i], {
        model: nodes[i].getAttribute('data-l2d'),
        label: nodes[i].getAttribute('data-label')
      });
    }
  }

  UI.register('roster', render, mountRoster);

  function setTab(id){
    for(var i = 0; i < TABS.length; i++){
      if(TABS[i].id === id){ activeTab = id; break; }
    }
    var cur = QZD.ui.currentTab ? QZD.ui.currentTab() : QZD.ui.current();
    if(cur === 'roster') QZD.ui.renderPage();
  }

  QZD.roster = {
    openTab: setTab,
    currentTab: function(){ return activeTab; }
  };

  document.addEventListener('click', function(e){
    var haremGate = e.target.closest('[data-harem]');
    if(haremGate){
      setTab('consorts');
      UI.show('roster');
      return;
    }

    var tab = e.target.closest('[data-mtab]');
    if(tab){
      setTab(tab.getAttribute('data-mtab'));
      return;
    }

    /* 妃嫔按位分筛选 */
    var rf = e.target.closest('[data-rfilter]');
    if(rf){
      rankFilter = rf.getAttribute('data-rfilter') || 'all';
      var curTab = QZD.ui.currentTab ? QZD.ui.currentTab() : QZD.ui.current();
      if(curTab === 'roster') QZD.ui.renderPage();
      return;
    }

    /* 抽卡选秀：单抽 / 十连，抽出候选待玩家勾选入宫 */
    var gachaBtn = e.target.closest('[data-gacha]');
    if(gachaBtn){
      if(gachaBtn.disabled) return;
      var n = parseInt(gachaBtn.getAttribute('data-gacha'), 10) || 1;
      var gcost = QZD.harem.gachaCost(n);
      if(n >= 10){
        UI.confirm(
          '<p>十连选秀：连抽十位候选秀女，共耗 <b>' + gcost + '</b> 金钱' +
          '（单抽 9 折）。抽出后请在结果中<b>勾选要入宫之人</b>，一人不选即放弃。</p>' +
          '<p class="card-note">绝色 ' + Math.round((QZD.config.GACHA ? QZD.config.GACHA.P_RARE : 0.06) * 100) +
          '% · 稀有 ' + Math.round((QZD.config.GACHA ? QZD.config.GACHA.P_UNCOMMON : 0.28) * 100) + '% · 其余普通。</p>',
          function(){
            var r = QZD.harem.gacha(n);
            if(!r.ok){ UI.toast(r.error); return; }
            showGachaResult(r);
          },
          { title: '十连选秀', okText: '耗 ' + gcost + ' 金钱抽选' }
        );
      }else{
        var res = QZD.harem.gacha(n);
        if(!res.ok){ UI.toast(res.error); return; }
        showGachaResult(res);
      }
      return;
    }

    /* 大臣致仕：遣散并返还资源 */
    var dismissBtn = e.target.closest('[data-dismiss]');
    if(dismissBtn){
      var m0 = QZD.ministers.ministerById(dismissBtn.getAttribute('data-dismiss'));
      if(!m0) return;
      var sum = (m0.war || 0) + (m0.gov || 0) + (m0.lit || 0);
      var est = Math.round(sum * 1.2), estSw = Math.round(sum * 0.15);
      UI.confirm(
        '<p>「' + m0.name + '」致仕归乡？</p>' +
        '<p class="card-note">三维合计 ' + sum + ' · 可返还金钱约 ' + est + ' · 声望约 ' + estSw +
        (m0.fielded ? ' · 当前上阵中，将自动撤下' : '') + '</p>',
        function(){
          var r = QZD.ministers.dismiss(m0.id);
          if(!r.ok){ UI.toast(r.error); return; }
          UI.toast('「' + r.name + '」致仕 · 金钱 +' + r.gain.jinQian + ' · 声望 +' + r.gain.shengWang);
          UI.onStateChanged();
        },
        { title: '致仕', okText: '准其归乡' }
      );
      return;
    }

    /* 批量遣散闲置大臣（未上阵的） */
    var dismissIdleBtn = e.target.closest('[data-dismiss-idle]');
    if(dismissIdleBtn){
      var idleCount = QZD.ministers.list().filter(function(m){
        return !m.fielded && !m.fromPrince;
      }).length;
      if(!idleCount){
        UI.toast('没有可遣散的闲置大臣');
        return;
      }
      UI.confirm(
        '<p>遣散全部 <b>' + idleCount + '</b> 位闲置大臣（未上阵者）？</p>' +
        '<p class="card-note">按各自三维返还金钱与声望；上阵中的大臣保留；皇子出身的不遣散。</p>',
        function(){
          var r = QZD.ministers.dismissIdle();
          if(!r.ok){ UI.toast(r.error); return; }
          UI.toast('遣散 ' + r.count + ' 人 · 金钱 +' + r.gain.jinQian + ' · 声望 +' + r.gain.shengWang);
          UI.onStateChanged();
        },
        { title: '遣散闲置', okText: '全部遣散' }
      );
      return;
    }

    /* 人物卡「赏赐」：列出此人可用的已购珍宝，点击即赏 */
    var giftBtn = e.target.closest('[data-gift]');
    if(giftBtn){
      var parts = (giftBtn.getAttribute('data-gift') || '').split(':');
      var gKind = parts[0], gId = parts[1] || '';
      var gName = '';
      if(gKind === 'consort'){
        var gc = QZD.harem.consortById(gId);
        if(!gc) return;
        gName = gc.name;
      }else{
        var gm = QZD.ministers.ministerById(gId);
        if(!gm) return;
        gName = gm.name;
      }

      var usable = QZD.treasury.itemsFor(gKind);
      if(!usable.length){
        UI.toast('尚无可用珍宝 · 先去珍宝阁购买');
        return;
      }

      var rows = usable.map(function(it){
        return '<button class="pick-row" data-gift-item="' + it.id + '">' +
          '<span class="pick-name">' + UI.fmt.escape(it.name) +
            ' <small class="card-note">×' + QZD.treasury.count(it.id) + '</small></span>' +
          '<span class="pick-sub">' + UI.fmt.escape(it.desc) + '</span>' +
        '</button>';
      }).join('');

      var gm2 = UI.modal({
        title: '赏赐 · ' + gName,
        body: '<div class="pick-list">' + rows + '</div>',
        ok: false,
        cancelText: '取消'
      });

      gm2.root.addEventListener('click', function(ev){
        var ib = ev.target.closest('[data-gift-item]');
        if(!ib) return;
        var iid = ib.getAttribute('data-gift-item');
        gm2.close();
        var r = QZD.treasury.use(iid, gId);
        if(!r.ok){ UI.toast(r.error); return; }
        UI.toast('已赏' + r.target + ' · ' + QZD.treasury.labelOf(r.item) + ' +' + r.delta);
        UI.onStateChanged();
      });
      return;
    }

    /* 点击立绘：切换该妃嫔的姿态 */
    var poseEl = e.target.closest('[data-cycle-pose]');
    if(poseEl){
      var pid = poseEl.getAttribute('data-cycle-pose');
      if(!pid) return;
      if(poseEl.__poseBusy) return;      /* 动画期间不重复触发 */
      poseEl.__poseBusy = true;

      function swapPose(){
        var pc = QZD.harem.cyclePose(pid);
        if(!pc){ poseEl.__poseBusy = false; return; }

        /* 只改这一张卡，不重绘整页 —— 其它妃子的立绘不会被牵连 */
        var img = poseEl.querySelector('img');
        if(img) img.src = pc.img;
        poseEl.setAttribute('title', '点击更换立绘（' +
          ((pc.poseIndex || 0) + 1) + '/' + pc.poses.length + '）');

        var lab = document.querySelector('[data-pose-label="' + pid + '"]');
        if(lab) lab.textContent = ((pc.poseIndex || 0) + 1) + '/' + pc.poses.length;

        /* 新图再缩放抖动一下 */
        void poseEl.offsetWidth;
        poseEl.classList.add('pose-in');
        poseEl.addEventListener('animationend', function h(){
          poseEl.classList.remove('pose-in');
          poseEl.removeEventListener('animationend', h);
        });
        UI.toast('立绘 · ' + ((pc.poseIndex || 0) + 1) + ' / ' + pc.poses.length);
        poseEl.__poseBusy = false;   /* 解锁，允许继续切下一张 */
      }

      /* 先让旧图抖动缩放，动画结束再换图 */
      poseEl.classList.remove('pose-in');
      poseEl.classList.add('shake');
      poseEl.addEventListener('animationend', function handler(){
        poseEl.classList.remove('shake');
        poseEl.removeEventListener('animationend', handler);
        swapPose();
      });
      return;
    }

    var examBtn = e.target.closest('[data-keju]');
    if(examBtn){
      if(examBtn.disabled) return;
      UI.confirm(
        '<p>开科一次耗 <b>' + K.COST_JIN + '</b> 金钱，榜下 ' + K.CANDIDATES + ' 人。</p>' +
        '<p class="card-note">钦点其一入朝，余者归乡。</p>',
        function(){
          var res = QZD.ministers.holdExam();
          if(!res.ok){ UI.toast(res.error); return; }
          UI.toast('开科取士 · 榜下 ' + res.candidates.length + ' 人');
          UI.onStateChanged();
        },
        { title: '开 科', okText: '耗 ' + K.COST_JIN + ' 金钱开科' }
      );
      return;
    }

    var recruitBtn = e.target.closest('[data-recruit]');
    if(recruitBtn){
      var r = QZD.ministers.recruit(recruitBtn.getAttribute('data-recruit'));
      if(!r.ok){ UI.toast(r.error); return; }
      UI.toast('「' + r.minister.name + '」入朝' + (r.shengWang ? ' · 声望 +' + r.shengWang : ''));
      UI.onStateChanged();
      return;
    }

    var fieldBtn = e.target.closest('[data-field]');
    if(fieldBtn){
      var f = QZD.ministers.toggleField(fieldBtn.getAttribute('data-field'));
      if(!f.ok){ UI.toast(f.error); return; }
      UI.toast(f.fielded
        ? '「' + f.minister.name + '」列于阵前'
        : '「' + f.minister.name + '」撤下阵前');
      UI.onStateChanged();
      return;
    }

    var summonBtn = e.target.closest('[data-summon]');
    if(summonBtn){
      var c = QZD.harem.consortById(summonBtn.getAttribute('data-summon'));
      if(!c) return;
      var rate = Math.round(QZD.harem.rateOf(c) * 100);
      var costQin = QZD.harem.summonCostOf(c);
      UI.confirm(
        '<p>寝宫召幸「<b>' + UI.fmt.escape(c.name) + '</b>」 · ' +
          UI.fmt.escape(QZD.harem.rankTitle(c)) + '</p>' +
        '<p class="card-note">耗勤政值 ' + costQin + ' · 受孕率 ' + rate + '%</p>' +
        '<p class="card-note">昭幸后「' + UI.fmt.escape(c.name) + '」宠爱 +' +
          QZD.config.DOTE.PER_SUMMON + '、喜爱按性格 +' + Math.round(QZD.config.FAVOR.PER_SUMMON * QZD.harem.personalityCoef(c.personality)) +
          '，对话将更亲昵</p>' +
        '<p class="card-note">有孕后约 ' + H.PREGNANCY_MIN + ' 分钟临盆，诞下皇子。</p>',
        function(){
          var res = QZD.harem.summon(c.id);
          if(!res.ok){ UI.toast(res.error); return; }
          UI.favorScreen(res.consort, res.dialogue);   /* 昭幸大屏：立绘 + 性格对话 + 喜爱 */
          if(res.success) UI.toast('喜讯 · 「' + res.consort.name + '」有孕');
          UI.onStateChanged();
        },
        { title: '寝 宫', okText: '召 幸' }
      );
      return;
    }

    var ennobleBtn = e.target.closest('[data-ennoble]');
    if(ennobleBtn){
      var ec = QZD.harem.consortById(ennobleBtn.getAttribute('data-ennoble'));
      if(!ec) return;
      var rcost = QZD.harem.ennobleCost(ec);
      var nextTitle = QZD.config.RANK.TITLES[QZD.harem.rankOf(ec) + 1];
      UI.confirm(
        '<p>册封「<b>' + UI.fmt.escape(ec.name) + '</b>」为「' +
          UI.fmt.escape(nextTitle) + '」</p>' +
        '<p class="card-note">耗金钱 ' + rcost.jin + ' · 声望 ' + rcost.sw + '</p>' +
        '<p class="card-note">晋位后召幸耗勤政 -' + QZD.config.RANK.SUMMON_CUT +
          '，宠爱 +' + QZD.config.RANK.DOTE_GAIN + '。</p>',
        function(){
          var r = QZD.harem.ennoble(ec.id);
          if(!r.ok){ UI.toast(r.error); return; }
          UI.toast('册封「' + r.consort.name + '」为「' + r.title + '」');
          UI.onStateChanged();
        },
        { title: '册 封', okText: '册 封' }
      );
      return;
    }

    var trainBtn = e.target.closest('[data-train-prince]');
    if(trainBtn){
      if(trainBtn.disabled) return;
      var tr = QZD.harem.trainPrince(trainBtn.getAttribute('data-train-prince'));
      if(!tr.ok){ UI.toast(tr.error); return; }
      UI.toast('培养皇子「' + tr.prince.name + '」 · 属性 +' + tr.gain);
      UI.onStateChanged();
      return;
    }

    var pmBtn = e.target.closest('[data-prince-minister]');
    if(pmBtn){
      if(pmBtn.disabled) return;
      var pid = pmBtn.getAttribute('data-prince-minister');
      var pcost = CFG.PRINCE.MINISTER_COST_SW || 0;
      UI.confirm(
        '<p>令皇子入朝为臣，耗 <b>' + pcost + '</b> 声望。</p>' +
        '<p class="card-note">入朝后可在「名臣」中上阵，提供战力与贡赋加成；皇子名册中将不再保留此人。</p>',
        function(){
          var r = QZD.harem.princeToMinister(pid);
          if(!r.ok){ UI.toast(r.error); return; }
          UI.toast('皇子「' + r.minister.name + '」入朝为臣');
          UI.onStateChanged();
        },
        { title: '入 朝', okText: '耗 ' + pcost + ' 声望入朝' }
      );
      return;
    }
  });
})();
