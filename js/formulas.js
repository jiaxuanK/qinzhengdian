/* ============================================================
   formulas.js · 全部公式集中地（平衡性只改这里）
   铁律二：任何数值计算必须走这里，禁止散落魔法数字
   ============================================================ */
(function(){
  var P = QZD.config.POMODORO;
  var C = QZD.config.CONQUEST;
  var M = QZD.config.MINISTER;

  function fieldedMinisters(){
    var list = Array.isArray(QZD.state.ministers) ? QZD.state.ministers : [];
    return list.filter(function(m){ return !!(m && m.fielded); });
  }

  QZD.formulas = {
    /* 专注产出倍率：凝神每级 +2%（原 3%），作用于全部三资源 */
    focusRate: function(){
      return 1 + 0.02 * (QZD.state.emperor.ningShen || 0);
    },

    /* 每分钟产出（含凝神加成） */
    perMinuteGain: function(){
      var rate = this.focusRate();
      return {
        qinZheng: P.OUTPUT_PER_MIN.qinZheng * rate,
        jinQian: P.OUTPUT_PER_MIN.jinQian * rate,
        guoJin: P.OUTPUT_PER_MIN.guoJin * rate
      };
    },

    /* 指定分钟数的产出 */
    gainForMinutes: function(min){
      var g = this.perMinuteGain();
      var k = min > 0 ? min : 0;
      return { qinZheng: g.qinZheng * k, jinQian: g.jinQian * k, guoJin: g.guoJin * k };
    },

    /* 由已产出的勤政值反推已专注分钟数（用于刷新后补进度） */
    minutesFromGain: function(gained){
      var per = this.perMinuteGain().qinZheng;
      if(!per) return 0;
      return Math.max(0, (gained || 0) / per);
    },

    /* ---------- M2 征伐 ---------- */

    /* 上阵名臣带来的战力加成 */
    ministerWarBonus: function(){
      var sum = 0;
      fieldedMinisters().forEach(function(m){ sum += (m.war || 0); });
      return sum * M.WAR_PER_POINT;
    },

    /* 上阵名臣带来的贡赋倍率（1 为无加成，叠乘营造加成） */
    tributeMultiplier: function(){
      var sum = 0;
      fieldedMinisters().forEach(function(m){ sum += (m.gov || 0); });
      return (1 + sum * M.GOV_PER_POINT) *
        (1 + this.worksTributeBonus());
    },

    /* 文采换算的一次性入朝声望 */
    litShengWang: function(lit){
      return Math.floor((lit || 0) / M.LIT_PER_SHENGWANG);
    },

    /* ---------- M4 后宫 ---------- */

    /* 受孕率 = 体质 ×0.75 + 仁心每级 1.2%，封顶 65% */
    conceptionRate: function(ti){
      var H = QZD.config.HAREM;
      var rate = (ti || 0) / 100 * H.TI_BASE + (QZD.state.emperor.renXin || 0) * H.RENXIN_PER_LEVEL;
      return Math.min(H.CONCEPTION_CAP, Math.max(0, rate));
    },

    /* 皇子属性：帝父对应维度（0–10）×10 与生母属性取均值，再浮动 ±10 */
    princeAttr: function(emperorLevel, motherStat){
      var P = QZD.config.PRINCE;
      var base = ((emperorLevel || 0) * 10 + (motherStat || 0)) / 2;
      var roll = base + (Math.random() * 2 - 1) * P.VARIANCE;
      return Math.max(P.ATTR_MIN, Math.min(P.ATTR_MAX, Math.round(roll)));
    },

    /* 战力 = (国力 + 名臣战力加成) × (1 + 营造战力加成) × (1 + 当日征伐 BUFF) */
    combatPower: function(){
      var buff = QZD.checkin ? QZD.checkin.buffValue() : 0;
      return ((QZD.state.resources.guoJin || 0) + this.ministerWarBonus()) *
        (1 + this.worksPowerBonus()) * (1 + buff);
    },

    /* 出征军费（国力） */
    marchCost: function(city){
      return Math.ceil((city.defense || 0) * C.COST_RATIO);
    },

    /* 破城返还国力 */
    captureGuoJin: function(city){
      return Math.floor((city.defense || 0) * C.REWARD_RATIO);
    },

    /* ---------- M5 内政营造 ---------- */

    /* 各工程当前等级表 */
    worksLevels: function(){
      var w = QZD.state.works;
      return (w && w.levels) ? w.levels : {};
    },

    /* 营造产出（每分钟），按等级线性累加 */
    worksPerMinute: function(){
      var W = QZD.config.WORKS;
      var levels = this.worksLevels();
      var out = { jinQian: 0, guoJin: 0 };
      W.ITEMS.forEach(function(item){
        var lv = levels[item.id] || 0;
        if(!lv) return;
        var e = item.effect || {};
        out.jinQian += (e.jinQianPerMin || 0) * lv;
        out.guoJin += (e.guoJinPerMin || 0) * lv;
      });
      return out;
    },

    /* 营造带来的贡赋加成（分数，如 0.03 = +3%） */
    worksTributeBonus: function(){
      var W = QZD.config.WORKS;
      var levels = this.worksLevels();
      var sum = 0;
      W.ITEMS.forEach(function(item){
        var lv = levels[item.id] || 0;
        if(lv && item.effect && item.effect.tributePct) sum += item.effect.tributePct * lv;
      });
      return sum;
    },

    /* 营造带来的战力加成（分数） */
    worksPowerBonus: function(){
      var W = QZD.config.WORKS;
      var levels = this.worksLevels();
      var sum = 0;
      W.ITEMS.forEach(function(item){
        var lv = levels[item.id] || 0;
        if(lv && item.effect && item.effect.powerPct) sum += item.effect.powerPct * lv;
      });
      return sum;
    },

    /* 营造下一级造价：base × (1 + 当前等级 × COST_GROWTH) */
    worksCost: function(item){
      var W = QZD.config.WORKS;
      var lv = this.worksLevels()[item.id] || 0;
      var factor = 1 + lv * W.COST_GROWTH;
      return {
        jinQian: Math.round((item.cost.jinQian || 0) * factor),
        guoJin: Math.round((item.cost.guoJin || 0) * factor)
      };
    }
  };
})();
