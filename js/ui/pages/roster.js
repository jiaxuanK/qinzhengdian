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
    var idle = list.filter(function(m){ return !m.fielded; }).length;
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
      '<span class="card-note">金钱 ' + K.COST_JIN + ' / 次 · 榜下 ' + K.CANDIDATES +
        ' 人 · 文采每 ' + M.LIT_PER_SHENGWANG + ' 点声望 +1</span></div>' +
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
    var ob = (M.ORIGIN_BONUS || {})[m.origin];
    var originBadge = ob
      ? ' <span class="badge rank" title="' + UI.fmt.escape(ob.desc || '') + '">' +
          UI.fmt.escape(ob.label || m.origin) + '</span>' : '';

    return '<div class="talent-card' + (m.fielded ? ' fielded' : '') + '">' +
      '<div class="portrait-wrap">' + QZD.portrait.svg(m.id, m.name) + '</div>' +
      '<div class="talent-main">' +
        '<div class="talent-name">' + UI.fmt.escape(m.name) +
          (m.fromPrince ? ' <span class="badge rank">皇子</span>' : '') +
          originBadge +
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
        '<button class="btn ghost danger" data-dismiss="' + m.id + '">' +
          (m.fromPrince ? '致仕归宗' : '致 仕') + '</button></div>' +
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
    /* 11-19 消费倍率透明：明确显示"打卡 X% · 消费 ×N"，把隐形倍率变成看得懂的规则 */
    var ckScore = QZD.checkin && QZD.checkin.todayStat ? QZD.checkin.todayStat().score : 100;
    var costMult = QZD.study && QZD.study.multiplier ? QZD.study.multiplier() : 1;

    return '<section class="card">' +
      '<div class="card-head"><span class="card-title">选秀</span></div>' +
      /* 两条注释合并到标题下方一行，避免手机端拆成两段换行 */
      '<p class="card-note" style="margin:2px 0 6px">单抽 ' + single + ' 金 · 十连 ' + ten +
        ' 金（9折）· 今日打卡 ' + ckScore + '% · 消费 ×' + costMult +
        '；抽出后勾选入宫，一人不选即放弃</p>' +
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

  /* ---------- 侍寝统一入口（用户决策：只从「相 处」进） ----------
     名册不再有独立「召 幸」按钮。相处弹窗里的「侍寝」项点选后，
     先补原来那层确认（受孕率 / 耗勤政 / 增量 / 临盆），确认才真正召幸。
     受孕链路（单次判孕 / 有孕禁召 / 喜讯 / 两屏过场）一条不删。 */
  function doSummon(c, mid, mode){
    var res = QZD.harem.summon(c.id, mid);
    if(!res.ok){ UI.toast(res.error); return; }
    if(res.isSleep){
      /* 榻前描写直接叠在昭幸大屏的立绘上（取代台词气泡），过场不再重复。
         双轨：以现成整段为主，按比例混入一段六频道组合叙事（story.pickBedScenes）。 */
      var scenes = [];
      if(QZD.story && QZD.story.pickBedScenes){
        var hourNow = new Date().getHours();
        var isMorning = hourNow >= 6 && hourNow < 7.5;
        scenes = QZD.story.pickBedScenes(res.consort, hourNow, {
          count: 3, returning: false, personalityBoost: 3,
          hiddenBoost: isMorning ? 4 : 2   /* 早上隐藏剧情权重更高 */
        }).scenes;
      }
      /* 合并一屏：次晨/隔日/喜讯作为幕后内容交给大屏演完，不再另弹过场窗 */
      var curtains = (QZD.story && QZD.story.sleepCurtains)
        ? QZD.story.sleepCurtains(res) : { morning:'', after:'', goodNews:'' };
      UI.favorScreen(res.consort, res.dialogue, {
        scenes: scenes, morning: curtains.morning,
        after: curtains.after, goodNews: curtains.goodNews,
        labels: curtains.labels
      });
      /* 喜讯 toast 保留（大屏里也有喜讯幕，双重反馈无妨） */
      if(res.success) UI.toast('喜讯 · 「' + res.consort.name + '」有孕');
    }else if(QZD.story){
      QZD.story.presentMode(res.consort, res, mode);
    }
    UI.onStateChanged();
  }
  function confirmSleep(c, mid, mode){
    var rate = Math.round(QZD.harem.rateOf(c) * 100);
    var costQin = QZD.harem.summonCostOf(c, mode);   /* 侍寝按 costMult 计价 */
    UI.confirm(
      '<p>寝宫召幸「<b>' + UI.fmt.escape(c.name) + '</b>」 · ' +
        UI.fmt.escape(QZD.harem.rankTitle(c)) + '</p>' +
      '<p class="card-note">耗勤政值 ' + costQin + ' · 受孕率 ' + rate + '%</p>' +
      '<p class="card-note">昭幸后「' + UI.fmt.escape(c.name) + '」宠爱 +' +
        QZD.config.DOTE.PER_SUMMON + '、喜爱按性格 +' +
        Math.round(QZD.config.FAVOR.PER_SUMMON * QZD.harem.personalityCoef(c.personality)) +
        '，对话将更亲昵</p>' +
      '<p class="card-note">有孕后约 ' + H.PREGNANCY_MIN + ' 分钟临盆，诞下皇子。</p>',
      function(){ doSummon(c, mid, mode); },
      { title: '寝 宫', okText: '召 幸' }
    );
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
          ' <span class="badge ' + tagCls + '">' + tagName + '</span>' +
          bloodChip(c) + '</span>' +
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
    var st = QZD.harem.pregnancyStage ? QZD.harem.pregnancyStage(p, Date.now()) : null;
    var pct = st ? st.pct : 0, remain = st ? st.remainMin : 0;
    var H = QZD.config.HAREM;
    var visits = (p.visits || []).length;
    var guide = ({ 初孕:'文采', 中期:'理政', 临盆:'用兵' })[st ? st.name : ''] || '';
    var hours = Math.floor(remain / 60), mins = remain % 60;
    return '<div class="preg-line">' +
      '<div class="bar"><i style="width:' + pct + '%"></i></div>' +
      '<span>' + (st ? st.name : '孕期') + ' · 约 ' + hours + '时' + mins + '分后临盆' +
        (guide ? ' · 此刻探视长' + guide : '') +
        ' · 已探视 ' + visits + '/' + (H.VISIT_MAX || 6) + '</span>' +
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

  /* 血脉可见性：默认显示（用户 21:06 定）。
     若想恢复「身份只在事件里自然带出」，把 config.BLOOD.SHOW_IN_ROSTER 设为 false。
     凡俗不显示，避免满屏「凡俗」；已识破与未识破用不同标记区分。 */
  function bloodChip(c){
    var B = QZD.config.BLOOD;
    if(!B || B.SHOW_IN_ROSTER === false) return '';
    var key = c.blood || 'ren';
    if(key === 'ren') return '';
    var entry = (B.LIST || []).filter(function(x){ return x.key === key; })[0];
    var name = entry ? entry.name : key;
    var tip = entry && entry.sign ? entry.sign : '';
    return ' <span class="badge" style="background:rgba(168,132,44,.16);' +
      'color:var(--daiqing);border:1px solid rgba(168,132,44,.35)" ' +
      'title="' + UI.fmt.escape(tip) + '">' + UI.fmt.escape(name) +
      (c.veil ? ' · 已识破' : ' · 未明') + '</span>';
  }

  /* 血脉天赋正面展示：未识破只给问号，识破后把整数点效果写在卡片上（手机也看得见） */
  function bloodTalentLine(c){
    if(!QZD.bloodTalent || !c.blood || c.blood === 'ren') return '';
    var t = QZD.bloodTalent.describe(c, !!c.veil);
    if(!t) return '';
    return '<div class="blood-talent-line">' + UI.fmt.escape(t) + '</div>';
  }

  /* L2 可见性：她自己的日子（才艺成长 / 私房钱 / 自购 / 心愿） */
  function lifeLine(c){
    if(!QZD.life) return '';
    var d = QZD.life.of(c), bits = [];
    if(d.skills && d.skills.length){
      bits.push('习 ' + d.skills.map(function(s){
        return s.name + ' ' + s.level + '级' + (s.name === d.primary ? '（主修）' : '');
      }).join('、'));
    }else{
      bits.push('习 ' + d.hobby + ' · ' + d.level + ' 级');
    }
    bits.push('私房钱 ' + d.purse);
    if(d.last){
      bits.push('自购 ' + d.last.name + (d.last.byEmperor ? '（陛下所添）' : ''));
    }
    var tail = '';
    if(d.wish) tail = '　<span style="color:var(--teng)">心愿 · ' + UI.fmt.escape(d.wish) + '</span>';
    if(d.rustiness > 0) tail += '　<span style="opacity:.6">久未见，略生疏</span>';
    return '<div class="persona-meta">' + UI.fmt.escape(bits.join(' · ')) + tail + '</div>';
  }

  /* S1 可见性：她认领的专属故事线（换个人就没有） */
  function storyLine(c){
    if(!QZD.story) return '';
    var d = QZD.story.of(c), inti = d.intimacy;
    var head = '<div class="persona-meta">情感 <b style="color:var(--daiqing)">' +
      UI.fmt.escape(inti.name) + '</b>（' + inti.score + '）' +
      (d.address ? ' · 唤「' + UI.fmt.escape(d.address) + '」' : '') +
      (d.phrase ? ' · 只她会说「' + UI.fmt.escape(d.phrase) + '」' : '') +
      '</div>';
    if(!d.lines.length) return head;
    var names = d.lines.map(function(x){
      return UI.fmt.escape(x.name) + ' <small style="opacity:.6">第 ' + x.stage + '/' + x.total + ' 章</small>';
    }).join(' · ');
    return head + '<div class="persona-meta" style="color:var(--daiqing)">' +
      '故事 ' + names +
      (d.milestones ? '　<small style="opacity:.6">共 ' + d.milestones + ' 段记忆</small>' : '') +
      '</div>';
  }

  /* 宠爱 / 喜爱 双迷你条（候选 / 在宫妃嫔共用） */
  function personaLine(c){
    var fmax = (QZD.harem && QZD.harem.favorMaxOf)
      ? QZD.harem.favorMaxOf(c) : ((QZD.config.FAVOR && QZD.config.FAVOR.MAX) || 100);
    var dmax = (QZD.harem && QZD.harem.doteMaxOf)
      ? QZD.harem.doteMaxOf(c) : ((QZD.config.DOTE && QZD.config.DOTE.MAX) || 100);
    var f = c.favor || 0;
    var d = c.dote || 0;
    var fp = Math.max(0, Math.min(100, Math.round(f / fmax * 100)));
    var dp = Math.max(0, Math.min(100, Math.round(d / dmax * 100)));
    return '<div class="persona-row">' +
      '<span class="mini-pair">' +
        '<span class="mini-item"><span class="mini-tag dote">宠</span>' +
          '<span class="favor-mini" title="宠爱 ' + d + ' / 上限 ' + dmax + '"><span class="favor-mini-fill dote" style="width:' + dp + '%"></span></span>' +
          '<span class="favor-mini-val">' + d + '<i>/' + dmax + '</i></span></span>' +
        '<span class="mini-item"><span class="mini-tag">爱</span>' +
          '<span class="favor-mini" title="喜爱 ' + f + ' / 上限 ' + fmax + '"><span class="favor-mini-fill" style="width:' + fp + '%"></span></span>' +
          '<span class="favor-mini-val">' + f + '<i>/' + fmax + '</i></span></span>' +
      '</span>' +
    '</div>';
  }

  /* 妃子生育的皇子数（含已致仕/归宗的，按 motherId 计） */
  function childCountOf(c){
    var list = QZD.state.princes || [];
    var n = 0;
    for(var i = 0; i < list.length; i++){
      if(list[i] && list[i].motherId === c.id) n++;
    }
    return n;
  }

  /* 皇后更衣：文件夹名即装扮名，来自 js/outfit-manifest.js */
  function openOutfitDialog(){
    if(!QZD.queen){ UI.toast('换装模块未加载'); return; }
    var all = QZD.queen.outfits(), cur = QZD.queen.current();
    if(!all.length){
      UI.modal({
        title: '皇后更衣',
        body: '<p>尚未找到皇后图片。请把图片按下面结构放好，再点「重新扫描装扮」：</p>' +
          '<p class="card-note">assets/images/皇后/常服/01.jpg<br>assets/images/皇后/朝服/01.jpg</p>',
        cancelText: '关闭'
      });
      return;
    }
    var cards = all.map(function(o){
      var on = o.name === cur.name;
      return '<button class="outfit-item' + (on ? ' active' : '') + '" data-wear="' +
        UI.fmt.escape(o.name) + '">' +
        (o.cover ? '<img src="' + UI.fmt.escape(o.cover) + '" alt="" loading="lazy">' :
          '<span class="outfit-ph">暂无立绘</span>') +
        '<b>' + UI.fmt.escape(o.name) + '</b><small>' + (o.images || []).length + ' 张' +
        (on ? ' · 当前穿着' : '') + '</small></button>';
    }).join('');
    UI.modal({
      title: '皇后更衣 · ' + UI.fmt.escape(cur.name || '未选'),
      wide: true,
      cancelText: '关闭',
      body: '<p class="card-note">装扮来自「皇后」目录下的文件夹；换上后名册、陪伴、剧情里的立绘都会跟着变。</p>' +
        '<div class="outfit-grid">' + cards + '</div>' +
        '<p class="card-note">' + (cur.manual ? '当前为手动选择' : '当前为自动换装') +
        ' · 加了新的装扮文件夹后：</p>' +
        '<button class="btn ghost" data-outfit-refresh>重新扫描装扮</button>',
      ok: false
    });
  }

  function consortCard(c){
    var rate = Math.round(QZD.harem.rateOf(c) * 100);
    var costQin = QZD.harem.summonCostOf(c, { costMult: 2 });   /* 侍寝价（残留展示计算） */
    var jin = QZD.state.resources.qinZheng;
    var title = QZD.harem.rankTitle(c);
    /* 11-19 质子妃：暂不可召幸，改显迎回按钮（名额+成本双门槛；够条件才可点） */
    var isHostage = !!(QZD.regime && QZD.regime.isHostage && QZD.regime.isHostage(c.id));
    var isQueen = !!c.isQueen;
    var rescueBtn = '';
    if(isHostage && QZD.regime){
      var rk = Math.max(0, Math.min(QZD.harem.rankOf ? QZD.harem.rankOf(c) : (c.rank||0), 5));
      var rcCost = ((QZD.config.REGIME && QZD.config.REGIME.RESCUE_COST) || [])[rk] || { jinQian:150, guoJin:25 };
      var slots = QZD.regime.rankInfo().slots;
      var canAfford = QZD.state.resources.jinQian + 1e-9 >= rcCost.jinQian &&
                      QZD.state.resources.guoJin + 1e-9 >= rcCost.guoJin;
      var canRescue = slots > 0 && canAfford;
      rescueBtn = '<button class="btn primary" data-rescue="' + c.id + '"' +
        (canRescue ? '' : ' disabled') + ' title="迎回需 1 名额 + ' + rcCost.jinQian +
        '金/' + rcCost.guoJin + '国力；名额随帝阶晋升获得">' +
        '迎 归 · ' + rcCost.jinQian + '金/' + rcCost.guoJin + '国力' +
        (slots <= 0 ? '（无名额）' : (canAfford ? '' : '（资源不足）')) + '</button>';
    }
    /* 侍寝统一从「相 处」进入（用户决策）：名册不再放独立「召 幸」按钮，
       避免两个入口通往同一件事、也避免绕过确认弹窗误点直接判一次喜讯。 */
    var action = c.pregnant ? '<span class="badge buff">有孕在身</span>' : '';

    var rankBtn;
    if(isQueen){
      rankBtn = '<button class="btn ghost" disabled>位极中宫</button>';
    }else if(QZD.harem.isMaxRank(c)){
      rankBtn = '<button class="btn ghost" disabled>已至贵妃</button>';
    }else{
      var rc = QZD.harem.ennobleCost(c);
      var need = QZD.harem.promoteNeed ? QZD.harem.promoteNeed(c) : null;
      var ready = QZD.harem.promoteReady ? QZD.harem.promoteReady(c) : true;
      var cap = QZD.harem.doteMaxOf ? QZD.harem.doteMaxOf(c) : 100;
      var needTxt = need ? ('晋 ' + need.title + '：宠爱需达 ' + need.dote +
        ' / 上限 ' + cap + '（现 ' + Math.round(c.dote || 0) +
        '）· 喜爱不计入') : '';
      rankBtn = '<button class="btn ghost" data-ennoble="' + c.id + '"' +
        (ready ? '' : ' disabled') + ' title="' + UI.fmt.escape(needTxt) + '">' +
        (ready ? ('册 封 · ' + rc.jin + '金/' + rc.sw + '望') : '宠爱未满') + '</button>';
    }

    var multiPose = (Array.isArray(c.poses) && c.poses.length > 1);
    var wishBtn = '';
    if(QZD.life){
      var lv = QZD.life.of(c);
      if(lv.wish){
        var enough = (QZD.state.resources.jinQian + 1e-9 >= lv.wishCost);
        wishBtn = '<button class="btn ghost" data-grant-wish="' + c.id + '"' +
          (enough ? '' : ' disabled') + '>偿心愿 · ' + lv.wishCost + ' 金</button>';
      }
    }
    /* 孕期探视：花她的勤政值，按阶段引导皇子先天 */
    var visitBtn = '';
    if(c.pregnant && QZD.harem.visitPregnant){
      var vp = QZD.harem.pregnancyStage(c.pregnant, Date.now());
      var vmax = (QZD.config.HAREM && QZD.config.HAREM.VISIT_MAX) || 6;
      var vcost = (QZD.config.HAREM && QZD.config.HAREM.VISIT_COST_QIN) || 8;
      var vfull = (c.pregnant.visits || []).length >= vmax;
      var vGuide = ({ 初孕:'文采', 中期:'理政', 临盆:'用兵' })[vp ? vp.name : ''] || '先天';
      visitBtn = '<button class="btn ghost" data-visit="' + c.id + '"' +
        ((vfull || jin + 1e-9 < vcost) ? ' disabled' : '') + ' title="' +
        (vfull ? '探视已足' : ('花 ' + vcost + ' 勤政，此刻长' + vGuide)) +
        '">探 视</button>';
    }
    var storyBtn = QZD.story
      ? '<button class="btn ghost" data-story="' + c.id + '">她的故事</button>' : '';
    /* 成长：用她自己的私房钱学新才艺（打扮→容貌、习舞→体质、诗书→才情） */
    var learnBtn = '';
    if(QZD.life){
      var ln = QZD.life.of(c);
      if(ln.learnable && ln.learnable.length){
        var canLearn = ln.purse + 1e-9 >= ln.learnCost;
        learnBtn = '<button class="btn ghost" data-learn="' + c.id + '"' +
          (canLearn ? '' : ' disabled') + ' title="' +
          (canLearn ? '用她的私房钱习一门新才艺' : '她私房钱不足，先开殿拨银') +
          '">习 艺</button>';
      }
    }
    /* 唯一主入口：12 种相处方式（含侍寝）都从这里进 */
    var modeBtn = (QZD.story && QZD.config.SUMMON_MODES)
      ? '<button class="btn primary" data-modes="' + c.id + '" ' +
        'title="侍寝亦在此处，点选后会先确认">相 处</button>' : '';
    return '<div class="talent-card consort' + (c.pregnant ? ' pregnant' : '') + '">' +
      '<div class="portrait-wrap fem consort-pic' + (multiPose ? ' multi' : '') + '"' +
        (multiPose ? ' data-cycle-pose="' + c.id + '" title="点击更换立绘（' +
          ((c.poseIndex || 0) + 1) + '/' + c.poses.length + '）"' : '') + '>' +
        (c.video
          ? QZD.portrait.video(c.video, c.name)
          : QZD.portrait.svg(c.id, c.name, { kind: 'female', img: c.img, model: c.model })) + '</div>' +
      '<div class="talent-main">' +
        '<div class="talent-name">' + UI.fmt.escape(c.name) + ' ' + personaChip(c) +
          (isQueen ? ' <span class="badge queen">皇后</span>' : '') +
          (c.rare ? ' <span class="badge rare">绝色</span>' : '') +
          bloodChip(c) +
          ' <span class="badge rank">' + UI.fmt.escape(isQueen ? '中宫' : title) + '</span>' +
          (c.pregnant ? ' <span class="badge buff">有孕</span>' : '') +
          (isHostage ? ' <span class="badge" style="background:#8a6d3b;color:#fff">质子·藩邦</span>' : '') + '</div>' +
        '<div class="attr-row">' +
          attrItem('容貌', c.yan, 'lit') +
          attrItem('体质', c.ti, 'gov') +
          attrItem('才情', c.cai, 'war') +
        '</div>' +
        personaMeta(c) +
        bloodTalentLine(c) +
        lifeLine(c) +
        storyLine(c) +
        personaLine(c) +
        '<div class="talent-foot">' +
          (childCountOf(c) ? '<b class="child-count">诞皇子 ' + childCountOf(c) + ' 人</b> · ' : '') +
          '受孕率 ' + rate + '% · 召幸耗勤政 ' + costQin +
          (jin + 1e-9 < costQin && !c.pregnant ? '（勤政不足）' : '') +
          (multiPose ? ' · 姿态 <span data-pose-label="' + c.id + '">' +
            ((c.poseIndex || 0) + 1) + '/' + c.poses.length + '</span>（点立绘换）' : '') + '</div>' +
        pregnancyLine(c) +
      '</div>' +
      '<div class="talent-action consort-actions">' +
        (isHostage
          ? rescueBtn + storyBtn     /* 质子：只给迎归 + 她的故事，其余相处动作隐去 */
          : (isQueen ? '<button class="btn ghost" data-queen-outfit>更 衣</button>' : '') +
            modeBtn + action + rankBtn + visitBtn + learnBtn +
            '<button class="btn ghost" data-gift="consort:' + c.id + '">赏 赐</button>' +
            wishBtn + storyBtn) + '</div>' +
    '</div>';
  }

  /* 妃嫔按位分筛选：'all' 或 'r<rank>' */
  var rankFilter = 'all';

  function rankChips(all){
    var titles = (CFG.RANK && CFG.RANK.TITLES) || ['才人'];
    var counts = {}, queenCount = 0;
    all.forEach(function(c){
      if(c && c.isQueen){ queenCount++; return; }  /* 皇后位极中宫，不计入贵妃等普通位分 */
      var r = Math.max(0, Math.min(titles.length - 1, c.rank || 0));
      counts[r] = (counts[r] || 0) + 1;
    });
    var chips = ['<button class="tab' + (rankFilter === 'all' ? ' active' : '') +
      '" data-rfilter="all">全部 ' + all.length + '</button>'];
    if(queenCount){
      chips.push('<button class="tab' + (rankFilter === 'queen' ? ' active' : '') +
        '" data-rfilter="queen">皇后 ' + queenCount + '</button>');
    }
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
      if(rankFilter === 'queen'){
        list = all.filter(function(c){ return !!(c && c.isQueen); });
      }else{
        var idx = parseInt(String(rankFilter).slice(1), 10);
        if(isNaN(idx)) idx = 0;
        list = all.filter(function(c){ return !(c && c.isQueen) && (c.rank || 0) === idx; });
      }
      if(!list.length){ rankFilter = 'all'; list = all; }  /* 该位分无人时自动回到全部 */
    }
    var note = '共 ' + all.length + ' 人 · 有孕 ' + QZD.harem.pregnantCount() +
      (QZD.story ? ' · 已生故事 ' + QZD.story.state().history.length + ' 段' : '') +
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
    var g = QZD.harem.princeGrowth ? QZD.harem.princeGrowth(p, Date.now())
      : { key:'adult', name:'成年', pct:100, remainMin:0, eduDone:true, idx:-1 };
    var adult = g.key === 'adult';
    var growWhy = adult ? '' : ('皇子尚在' + g.name + '，约 ' + g.remainMin + ' 分钟后成年');
    var trainBtn = '<button class="btn ghost" data-train-prince="' + p.id + '"' +
      ((!adult || jin + 1e-9 < trainCost) ? ' disabled' : '') +
      (adult ? '' : ' title="' + UI.fmt.escape(growWhy) + '"') +
      '>培养 · ' + trainCost + ' 金</button>';
    var minBtn = '<button class="btn primary" data-prince-minister="' + p.id + '"' +
      ((!adult || sw + 1e-9 < (R.MINISTER_COST_SW || 0)) ? ' disabled' : '') +
      (adult ? '' : ' title="' + UI.fmt.escape(growWhy) + '"') + '>入朝 · ' +
      (R.MINISTER_COST_SW || 0) + ' 望</button>';
    /* 成年前每阶段一次教养：这是等待期的可玩动作，成年后才能培养/入朝 */
    var eduBtn = '';
    if(!adult){
      var eduCost = ((R.GROW_EDU_COST || [])[g.idx]) || (60 + Math.max(0, g.idx) * 40);
      var eduName = ({ lit:'文采', gov:'理政', war:'用兵' })[g.attr] || '资质';
      eduBtn = '<button class="btn ghost" data-educate-prince="' + p.id + '"' +
        ((g.eduDone || jin + 1e-9 < eduCost) ? ' disabled' : '') + ' title="' +
        (g.eduDone ? '此阶段已教养过' : ('花 ' + eduCost + ' 金，长' + eduName)) +
        '">' + (g.eduDone ? '已教养' : ('教养 · ' + eduCost + ' 金')) + '</button>';
    }
    /* 致仕按钮：醒目的独立入口，资质不合意时一眼能找到 */
    var retireBtn = '<button class="btn danger sm" data-prince-retire="' + p.id +
      '" title="资质不合意可致仕归宗，按已投入培养金返还五成，之后可复起">致仕归宗</button>';
    var growLine = '<div class="preg-line prince-growth">' +
      '<div class="bar"><i style="width:' + g.pct + '%"></i></div>' +
      '<span>' + g.name +
        (adult ? ' · 已成年前往朝堂' : (' · 约 ' + g.remainMin + ' 分钟后入' +
          (g.next === '成年' ? '成年' : g.next) + ' · 此阶段可教养' +
          (g.eduDone ? '（已教养）' : '一次'))) +
      '</span></div>';

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
        growLine +
      '</div>' +
      '<div class="talent-action prince-actions">' +
        eduBtn + trainBtn + minBtn + retireBtn + '</div>' +
    '</div>';
  }

  /* 致仕折叠区：显示已致仕皇子的资质，可复起 */
  function retiredPrincesPanel(){
    var list = QZD.harem.retiredPrinces();
    if(!list.length) return '';
    var rows = list.map(function(p){
      return '<div class="retired-prince-row">' +
        '<span class="rp-name">' + UI.fmt.escape(p.name) + '</span>' +
        '<span class="rp-attr">兵 ' + (p.war || 0) + ' · 政 ' + (p.gov || 0) +
          ' · 文 ' + (p.lit || 0) + '</span>' +
        '<button class="btn ghost sm" data-prince-restore="' + p.id + '">复起</button>' +
      '</div>';
    }).join('');
    return '<section class="card retired-princes">' +
      '<div class="card-head"><span class="card-title">已致仕宗室</span>' +
        '<span class="card-note">' + list.length + ' 人 · 归宗闲居，可复起入册</span></div>' +
      '<div class="rp-list">' + rows + '</div>' +
      '<p class="page-foot" style="margin-top:8px">致仕返还已投入培养金的五成；复起免费，' +
        '但不会二次补发已领过的返还。</p>' +
    '</section>';
  }

  function princesPanel(){
    var list = QZD.harem.activePrinces();
    if(!list.length && !QZD.harem.retiredPrinces().length){
      return '<section class="card">' +
        '<div class="card-head"><span class="card-title">皇 子</span>' +
        '<span class="card-note">尚无皇子</span></div>' +
        '<div class="empty">皇嗣未立<span class="card-note">寝宫召幸，有孕临盆后录入名册</span>' +
          '<div class="btn-row" style="justify-content:center;margin-top:14px">' +
            '<button class="btn primary" data-mtab="consorts">前往寝宫</button>' +
          '</div></div>' +
      '</section>';
    }
    var main = list.length
      ? '<section class="card">' +
          '<div class="card-head"><span class="card-title">皇 子</span>' +
          '<span class="card-note">在册 ' + list.length + ' 人 · 资质量于帝父与生母</span></div>' +
          '<div class="talent-list">' + list.map(princeCard).join('') + '</div>' +
        '</section>'
      : '<section class="card"><div class="card-head"><span class="card-title">皇 子</span>' +
          '<span class="card-note">在册 0 人 · 已致仕者见下方</span></div>' +
          '<div class="empty">目前无在册皇子</div></section>';
    return main + retiredPrincesPanel();
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
    /* 名册是 court 群组的子页：UI.current() 返回一级页 court，
       UI.currentTab() 才返回子页 roster。用错前者会导致点了标签不重绘（卡住）。
       两个都认，兼容名册作为独立一级页的旧入口。 */
    var top = QZD.ui.current ? QZD.ui.current() : '';
    var sub = QZD.ui.currentTab ? QZD.ui.currentTab() : '';
    if(top === 'roster' || sub === 'roster') QZD.ui.renderPage();
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

    /* 皇后换装：打开更衣弹窗 / 选中装扮 / 重新扫描目录 */
    var qOpen = e.target.closest('[data-queen-outfit]');
    if(qOpen){ openOutfitDialog(); return; }
    var qRescan = e.target.closest('[data-outfit-refresh]');
    if(qRescan){
      if(QZD.assetsRefresh) QZD.assetsRefresh.refresh();
      else UI.toast('当前版本不支持热刷新，请运行 npm run gen:outfits 后刷新页面');
      return;
    }
    var wear = e.target.closest('[data-wear]');
    if(wear){
      if(!QZD.queen) return;
      var wr = QZD.queen.setOutfit(wear.getAttribute('data-wear'));
      if(!wr.ok){ UI.toast(wr.error); return; }
      document.querySelectorAll('.modal-mask').forEach(function(m){ if(m.parentNode) m.parentNode.removeChild(m); });
      UI.toast('皇后已换上「' + wr.name + '」');
      UI.renderPage();
      return;
    }

    /* 11-19 迎回质子妃：确认后扣名额+资源、清除质子态 */
    var rescueBtn = e.target.closest('[data-rescue]');
    if(rescueBtn){
      var rid = rescueBtn.getAttribute('data-rescue');
      var rc = QZD.harem.consortById ? QZD.harem.consortById(rid) : null;
      var rname = rc ? rc.name : '此妃';
      UI.modal({
        title:'迎 ' + rname + ' 归宫',
        body:'<p>她远在藩邦为质。迎归需 <b>1 个名额</b>与对应金钱、国力；' +
          '名额随帝阶晋升获得，攒着不过期。接不接、何时接，皆由你定。</p>',
        okText:'迎归', cancelText:'再等等',
        onOk:function(){
          var rr = QZD.regime.rescue(rid);
          if(!rr.ok){ UI.toast(rr.error || '暂不能迎归'); return false; }
          UI.toast('迎归成功 · ' + rname + ' 已回宫');
          UI.renderPage();
        }
      });
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
      var curTab = QZD.ui.current ? QZD.ui.current() : '';
      if(curTab === 'roster') QZD.ui.renderPage();
      return;
    }

    /* 孕期探视：花勤政值，按当前阶段给皇子先天引导 */
    var visitEl = e.target.closest('[data-visit]');
    if(visitEl){
      if(visitEl.disabled) return;
      var vc = QZD.harem.consortById(visitEl.getAttribute('data-visit'));
      if(!vc || !QZD.harem.visitPregnant) return;
      var vr = QZD.harem.visitPregnant(vc.id);
      if(!vr.ok){ UI.toast(vr.error); return; }
      var vname = ({ lit:'文采', gov:'理政', war:'用兵' })[vr.attr] || '先天';
      var vbonus = (QZD.config.HAREM && QZD.config.HAREM.VISIT_ATTR_BONUS) || 3;
      var vmax = (QZD.config.HAREM && QZD.config.HAREM.VISIT_MAX) || 6;
      UI.toast('探视「' + vr.name + '」· ' + vr.stage + ' · 皇子先天' + vname +
        ' +' + vbonus + '（' + vr.visits + '/' + vmax + '）');
      UI.onStateChanged();
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
        '<p>「' + m0.name + '」致仕' + (m0.fromPrince ? '归宗' : '归乡') + '？</p>' +
        '<p class="card-note">三维合计 ' + sum + ' · 可返还金钱约 ' + est + ' · 声望约 ' + estSw +
        (m0.fielded ? ' · 当前上阵中，将自动撤下' : '') + '</p>' +
        (m0.fromPrince
          ? '<p class="card-note">他是皇子出身，致仕后回到「已致仕宗室」，日后可复起，不会消失。</p>'
          : ''),
        function(){
          var r = QZD.ministers.dismiss(m0.id);
          if(!r.ok){ UI.toast(r.error); return; }
          UI.toast('「' + r.name + '」致仕' + (r.prince ? '归宗' : '') +
            ' · 金钱 +' + r.gain.jinQian + ' · 声望 +' + r.gain.shengWang);
          UI.onStateChanged();
        },
        { title: '致仕', okText: m0.fromPrince ? '准其归宗' : '准其归乡' }
      );
      return;
    }

    /* 批量遣散闲置大臣（未上阵的） */
    var dismissIdleBtn = e.target.closest('[data-dismiss-idle]');
    if(dismissIdleBtn){
      var idleCount = QZD.ministers.list().filter(function(m){ return !m.fielded; }).length;
      if(!idleCount){
        UI.toast('没有可遣散的闲置大臣');
        return;
      }
      UI.confirm(
        '<p>遣散全部 <b>' + idleCount + '</b> 位闲置大臣（未上阵者）？</p>' +
        '<p class="card-note">按各自三维返还金钱与声望；上阵中的大臣保留；皇子出身者归宗入已致仕名册，不消失。</p>',
        function(){
          var r = QZD.ministers.dismissIdle();
          if(!r.ok){ UI.toast(r.error); return; }
          UI.toast('遣散 ' + r.count + ' 人' + (r.backToPrince ? '（皇子 ' + r.backToPrince + ' 归宗）' : '') +
            ' · 金钱 +' + r.gain.jinQian + ' · 声望 +' + r.gain.shengWang);
          UI.onStateChanged();
        },
        { title: '遣散闲置', okText: '全部遣散' }
      );
      return;
    }

    /* L2：陛下替她偿心愿 —— 由国库代付，关键节点玩家在场 */
    var grantBtn = e.target.closest('[data-grant-wish]');
    if(grantBtn){
      if(grantBtn.disabled || !QZD.life) return;
      var wid = grantBtn.getAttribute('data-grant-wish');
      var wc = QZD.harem.consortById(wid);
      if(!wc) return;
      var wd = QZD.life.of(wc);
      var gf = (QZD.config.LIFE && QZD.config.LIFE.GRANT_FAVOR) || 3;
      UI.confirm(
        '<p>「' + UI.fmt.escape(wc.name) + '」攒着钱想买 <b>' + UI.fmt.escape(wd.wish) +
          '</b>，眼下私房钱 ' + wd.purse + ' 尚不够。</p>' +
        '<p class="card-note">由国库代付 ' + wd.wishCost + ' 金钱 · ' +
          UI.fmt.escape(wd.hobby) + ' 另有进益 · 喜爱 +' + gf +
          '。日常小物她自己买，这一件由陛下添，才算你在场。</p>',
        function(){
          var r = QZD.life.grantWish(wid);
          if(!r.ok){ UI.toast(r.error); return; }
          UI.toast('已替「' + r.name + '」添了' + r.item + ' · 国库 −' + r.cost + ' 金');
          UI.onStateChanged();
        },
        { title: '偿其心愿', okText: '准 · 由国库支 ' + wd.wishCost + ' 金' }
      );
      return;
    }

    /* 成长：用她的私房钱习一门新才艺（打扮→容貌、习舞→体质、诗书→才情） */
    var learnEl = e.target.closest('[data-learn]');
    if(learnEl){
      if(learnEl.disabled || !QZD.life) return;
      var cid = learnEl.getAttribute('data-learn');
      var lc = QZD.harem.consortById(cid);
      if(!lc) return;
      var ld = QZD.life.of(lc);
      var attrLabel = { yan:'容貌', ti:'体质', cai:'才情' };
      var skillAttr = (QZD.config.LIFE && QZD.config.LIFE.SKILL_ATTR) || {};
      var rows = (ld.learnable || []).map(function(n){
        var a = skillAttr[n] || '';
        return '<button class="btn ghost" data-pick-skill="' + UI.fmt.escape(n) + '" ' +
          'style="margin:3px 4px 3px 0">习 ' + UI.fmt.escape(n) +
          (a ? '（长' + (attrLabel[a] || a) + '）' : '') + '</button>';
      }).join('') || '<span class="card-note">六艺皆通，无可再学</span>';
      var known = (ld.skills || []).map(function(s){
        var on = s.name === ld.primary;
        return '<button class="btn ' + (on ? 'primary' : 'ghost') + '" data-primary-skill="' +
          UI.fmt.escape(s.name) + '" style="margin:3px 4px 3px 0">' +
          (on ? '✓ ' : '') + UI.fmt.escape(s.name) + ' ' + s.level + '级</button>';
      }).join('');
      var mm = UI.modal({
        title: '习艺 · ' + lc.name,
        body:
          '<p class="card-note">她现有私房钱 <b>' + ld.purse + '</b> 金；每学一门花 ' +
            ld.learnCost + ' 金（从她的私房钱出，不动国库）。</p>' +
          '<p class="card-note">专注时只练<b>主修</b>那一门：练什么长什么——打扮长容貌、' +
            '习舞长体质、诗书长才情。点下方已学才艺可切换主修。</p>' +
          '<div class="card-note" style="margin-top:10px">已习（点选主修）：</div>' +
          '<div>' + known + '</div>' +
          '<div class="card-note" style="margin-top:8px">可学新才艺：</div>' +
          '<div style="margin-top:4px">' + rows + '</div>',
        ok: false, cancelText: '算了'
      });
      mm.root.addEventListener('click', function(ev2){
        var pick = ev2.target.closest && ev2.target.closest('[data-pick-skill]');
        if(pick){
          var r = QZD.life.learnSkill(cid, pick.getAttribute('data-pick-skill'));
          if(!r.ok){ UI.toast(r.error); return; }
          mm.close();
          UI.toast('「' + r.name + '」习得' + r.skill + ' · 私房钱 −' + r.cost);
          UI.onStateChanged();
          return;
        }
        var pri = ev2.target.closest && ev2.target.closest('[data-primary-skill]');
        if(pri){
          var r2 = QZD.life.setPrimary(cid, pri.getAttribute('data-primary-skill'));
          if(!r2.ok){ UI.toast(r2.error); return; }
          mm.close();
          UI.toast('「' + r2.name + '」改以' + r2.primary + '为主修');
          UI.onStateChanged();
        }
      });
      return;
    }

    /* S1：她的故事 —— 已认领的独占线 + 共同记忆 */
    var storyBtnEl = e.target.closest('[data-story]');
    if(storyBtnEl){
      if(QZD.story) QZD.story.show(storyBtnEl.getAttribute('data-story'));
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

    /* S2：相处方式 —— 12 种，按才艺与情感浓度筛选，每种都是剧情入口 */
    var modesBtn = e.target.closest('[data-modes]');
    if(modesBtn){
      var mc = QZD.harem.consortById(modesBtn.getAttribute('data-modes'));
      if(!mc || !QZD.story) return;
      var inti = QZD.formulas.intimacyOf(mc);
      var IT = QZD.config.INTIMACY || {};
      var allModes = QZD.config.SUMMON_MODES || [];
      /* 入口收拢（默认）：只给「侍寝」与「才艺（随机一样）」两项。
         数据仍是 12 种、文案一条没少；SUMMON_UI.COMPACT=false 可恢复原列表。 */
      var COMPACT = !(QZD.config.SUMMON_UI && QZD.config.SUMMON_UI.COMPACT === false);
      function lockOf(m){
        var traitOK = !m.trait || m.trait === '-' ||
          (Array.isArray(m.trait) ? m.trait.indexOf(mc.trait) >= 0 : m.trait === mc.trait);
        var tierOK = inti.index >= (m.minTier || 0);
        /* 有孕禁侍寝，但其它相处方式照常可用 */
        var pregBlock = !!(m.sleep && mc.pregnant);
        return { locked: pregBlock || traitOK === false || tierOK === false,
          why: pregBlock ? '有孕在身，暂不宜召幸'
             : (traitOK === false ? '需 ' + (Array.isArray(m.trait) ? m.trait.join('/') : m.trait)
             : (tierOK === false ? '需 ' + ((IT.TIERS && IT.TIERS[m.minTier] || {}).name || '更亲近') : '')) };
      }
      /* 她的才艺由选秀时定下的 trait 决定，不由玩家挑、也不随机：
         善琴→听琴、善棋→对弈、善书→共读、善画→赏画、善舞→观舞、
         能诗→和诗（专属）、通医→问诊、精绣→缝衣。
         若该模式因情感浓度未解锁，只如实提示，不替换成她会做之外的事。 */
      function herArt(){
        var arts = allModes.filter(function(m){
          return !m.sleep && m.trait && m.trait !== '-';
        });
        var own = arts.filter(function(m){
          return Array.isArray(m.trait) ? m.trait.indexOf(mc.trait) >= 0 : m.trait === mc.trait;
        });
        if(!own.length) return null;
        /* 专属优先：模式的 trait 只此一项（如「和诗」只属能诗），
           避免「能诗」被共享的「共读」抢走 */
        var exclusive = own.filter(function(m){
          return !Array.isArray(m.trait) || m.trait.length === 1;
        });
        return exclusive[0] || own[0];
      }
      /* 旧档无 trait / 特质无对应技艺时，退到通用相处（奉茶） */
      function generalArt(){
        return allModes.filter(function(m){
          return !m.sleep && (!m.trait || m.trait === '-');
        })[0] || null;
      }
      var rows;
      if(COMPACT){
        var sm = allModes.filter(function(m){ return m.sleep; })[0];
        var sl = sm ? lockOf(sm) : { locked: true, why: '缺配置' };
        var art = herArt() || generalArt();
        var al = art ? lockOf(art) : { locked: true, why: '缺配置' };
        rows = '';
        if(sm){
          rows += '<button class="pick-row" data-mode="sleep"' + (sl.locked ? ' disabled' : '') + '>' +
            '<span class="pick-name">侍 寝 <small class="card-note">（判喜讯）</small></span>' +
            '<span class="pick-sub">屏退左右，罗帐落下 · 耗勤政 ' +
              QZD.harem.summonCostOf(mc, sm) +
              (sl.locked ? ' · 未解锁：' + UI.fmt.escape(sl.why) : '') + '</span></button>';
        }
        rows += '<button class="pick-row" data-mode="arts"' + (al.locked ? ' disabled' : '') + '>' +
          '<span class="pick-name">' +
            (art ? (art.trait && art.trait !== '-' ? '才 艺 · ' + UI.fmt.escape(art.name)
                                                   : '相 处 · ' + UI.fmt.escape(art.name))
                 : '相 处') +
            ' <small class="card-note">（按她的特质）</small></span>' +
          '<span class="pick-sub">' +
            (art ? UI.fmt.escape(art.desc) + ' · 耗勤政 ' + QZD.harem.summonCostOf(mc, art) +
                   (al.locked ? ' · 未解锁：' + UI.fmt.escape(al.why) : '')
                 : '暂无可用') +
          '</span></button>';
      }else{
        rows = allModes.map(function(m){
          var L = lockOf(m);
          return '<button class="pick-row" data-mode="' + UI.fmt.escape(m.id) + '"' +
            (L.locked ? ' disabled' : '') + '>' +
            '<span class="pick-name">' + UI.fmt.escape(m.name) +
              (m.sleep ? ' <small class="card-note">（侍寝 · 判喜讯）</small>' : '') + '</span>' +
            '<span class="pick-sub">' + UI.fmt.escape(m.desc) +
              ' · 耗勤政 ' + QZD.harem.summonCostOf(mc, m) +
              (L.locked ? ' · 未解锁：' + UI.fmt.escape(L.why) : '') + '</span></button>';
        }).join('');
      }
      var mm = QZD.ui.modal({
        title: '与「' + UI.fmt.escape(mc.name) + '」相处',
        body: '<p class="card-note" style="margin:0 0 8px">情感浓度 <b>' +
          UI.fmt.escape(inti.name) + '</b>（' + inti.score + '）· ' +
          UI.fmt.escape(inti.label) + '　侍寝耗勤政 ' +
          QZD.harem.summonCostOf(mc, allModes.filter(function(x){ return x.sleep; })[0]) +
          '（×2），日常陪伴更省。' +
          (COMPACT
            ? '侍寝会先确认再行；才艺按她的特质自动选（选秀时已定）。'
            : '侍寝在末项，点选后会先确认再行。') + '</p>' +
          '<div style="max-height:320px;overflow:auto">' + rows + '</div>',
        ok: false, cancelText: '改日'
      });
      mm.root.addEventListener('click', function(ev){
        var b = ev.target.closest && ev.target.closest('[data-mode]');
        if(!b || b.disabled) return;
        var mid = b.getAttribute('data-mode');
        /* 才艺入口：按她的特质直接执行，不再随机、不再让玩家挑 */
        if(mid === 'arts'){
          var pickArt = herArt() || generalArt();
          if(!pickArt){ UI.toast('暂无可用的相处方式'); return; }
          var pl = lockOf(pickArt);
          if(pl.locked){ UI.toast('该项未解锁：' + pl.why); return; }
          mm.close();
          doSummon(mc, pickArt.id, pickArt);
          return;
        }
        var mode = allModes.filter(function(x){ return x.id === mid; })[0];
        if(!mode) return;
        mm.close();
        if(mode.sleep){
          /* 侍寝：补一层确认，确认后才判喜讯，避免误点直接扣勤政 */
          confirmSleep(mc, mid, mode);
        }else{
          doSummon(mc, mid, mode);
        }
      });
      return;
    }

    /* 原独立「召 幸」按钮的分支已移除：侍寝统一走上方「相 处」弹窗里的
       侍寝项（confirmSleep → doSummon），受孕链路与两屏过场原样保留。 */

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

    var eduBtnEl = e.target.closest('[data-educate-prince]');
    if(eduBtnEl){
      if(eduBtnEl.disabled) return;
      var ep = QZD.harem.educatePrince(eduBtnEl.getAttribute('data-educate-prince'));
      if(!ep.ok){ UI.toast(ep.error); return; }
      UI.toast('教养「' + ep.prince.name + '」· ' + ep.stage + ' · ' +
        ep.attrName + ' +' + ep.gain + '（耗金 ' + ep.cost + '）');
      UI.onStateChanged();
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

    var retBtn = e.target.closest('[data-prince-retire]');
    if(retBtn){
      var rid = retBtn.getAttribute('data-prince-retire');
      var rp = QZD.harem.activePrinces().filter(function(x){ return x.id === rid; })[0];
      if(!rp) return;
      var refund = QZD.formulas.princeTrainInvested(rp.trainCount) *
        (CFG.PRINCE.RETIRE_REFUND_RATIO || 0);
      var already = Math.floor(Number(rp.retireRefunded) || 0);
      var willGet = Math.max(0, Math.floor(refund) - already);
      UI.confirm(
        '<p>令皇子「' + UI.fmt.escape(rp.name) + '」致仕归宗？</p>' +
        '<p class="card-note">他将退出在册名册，移入「已致仕宗室」；日后可复起。' +
          '按已投入培养金返还 <b>' + willGet + '</b> 金' +
          (willGet === 0 ? '（尚未培养或已领过返还）' : '') + '。</p>',
        function(){
          var r = QZD.harem.retirePrince(rid);
          if(!r.ok){ UI.toast(r.error); return false; }
          UI.toast('皇子「' + r.prince.name + '」致仕 · 返还 ' + r.refund + ' 金');
          UI.onStateChanged();
        },
        { title: '致 仕', okText: '令其致仕' }
      );
      return;
    }

    var restBtn = e.target.closest('[data-prince-restore]');
    if(restBtn){
      var restoreId = restBtn.getAttribute('data-prince-restore');
      var rr = QZD.harem.restorePrince(restoreId);
      if(!rr.ok){ UI.toast(rr.error); return; }
      UI.toast('皇子「' + rr.prince.name + '」复起入册');
      UI.onStateChanged();
      return;
    }
  });
})();
