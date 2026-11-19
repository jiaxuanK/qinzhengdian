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
    /* S2 情感浓度：喜爱 / 宠爱 / 里程碑 / 重逢 合成 0~100，四档。
       只驱动文风与相处方式解锁，不影响任何资源产出。 */
    intimacyOf: function(c){
      var I = QZD.config.INTIMACY || {}, tiers = I.TIERS || [];
      var clamp = function(v){ return Math.max(0, Math.min(100, Number(v) || 0)); };
      var milestone = Math.min(5, Math.max(0, (c && c.milestones) || 0)) / 5 * 100;
      var reunion   = Math.min(5, Math.max(0, (c && c.reunions)   || 0)) / 5 * 100;
      var score = Math.round((I.W_FAVOR || 0.40) * clamp(c && c.favor) +
                            (I.W_DOTE  || 0.30) * clamp(c && c.dote) +
                            (I.W_MILESTONE || 0.20) * milestone +
                            (I.W_REUNION   || 0.10) * reunion);
      score = Math.max(0, Math.min(100, score));
      var idx = 0, t = tiers[0] || { key: 'sheng', name: '生疏', label: '' };
      for(var i = 0; i < tiers.length; i++){
        if(score >= tiers[i].min){ idx = i; t = tiers[i]; }
      }
      return { score: score, index: idx, key: t.key, name: t.name, label: t.label || '' };
    },

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

    /* 11-19 越久越赚：单场时长的「有效分钟」＝分段累进积分。
       cum(0-120)=×1，cum(120-240)=×1.2，cum(240+)=×1.5。 */
    cumEffMin: function(min){
      min = Math.max(0, min || 0);
      var tiers = (P.OUTPUT_TIERS && P.OUTPUT_TIERS.length)
        ? P.OUTPUT_TIERS : [{ untilMin: Infinity, mult: 1 }];
      var acc = 0, prev = 0;
      for(var i = 0; i < tiers.length; i++){
        var hi = Math.min(min, tiers[i].untilMin);
        if(hi > prev) acc += (hi - prev) * tiers[i].mult;
        if(min <= tiers[i].untilMin) break;
        prev = tiers[i].untilMin;
      }
      return acc;
    },
    /* 有效分钟 → 实际分钟（cumEffMin 的分段逆，供 minutesFromGain 用） */
    minFromEffMin: function(eff){
      eff = Math.max(0, eff || 0);
      var tiers = (P.OUTPUT_TIERS && P.OUTPUT_TIERS.length)
        ? P.OUTPUT_TIERS : [{ untilMin: Infinity, mult: 1 }];
      var acc = 0, prev = 0;
      for(var i = 0; i < tiers.length; i++){
        var span = (tiers[i].untilMin - prev) * tiers[i].mult;
        if(eff <= acc + span) return prev + (eff - acc) / tiers[i].mult;
        acc += span; prev = tiers[i].untilMin;
      }
      return prev + (eff - acc) / (tiers[tiers.length - 1].mult || 1);
    },

    /* 指定分钟数的产出（累积语义：从 0 到 min 的总收益，含分段累进）。
       before 可选：传入时返回 [before, before+min] 区间的增量收益。 */
    gainForMinutes: function(min, before){
      var g = this.perMinuteGain();
      var k = Math.max(0, min || 0), b = Math.max(0, before || 0);
      var eff = this.cumEffMin(b + k) - this.cumEffMin(b);
      return { qinZheng: g.qinZheng * eff, jinQian: g.jinQian * eff, guoJin: g.guoJin * eff };
    },

    /* 由已产出的勤政值反推已专注分钟数（分段逆，累进下也准确） */
    minutesFromGain: function(gained){
      var per = this.perMinuteGain().qinZheng;
      if(!per) return 0;
      return Math.max(0, this.minFromEffMin((gained || 0) / per));
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

    /* 皇子累计培养投入：第 i 次（从 0 起）花费 TRAIN_COST + i×TRAIN_STEP。
       培养 n 次的总投入 = n×TRAIN_COST + TRAIN_STEP×n×(n-1)/2。
       致仕返还按此投入 × RETIRE_REFUND_RATIO，避免只看次数的失真。 */
    princeTrainInvested: function(trainCount){
      var P = QZD.config.PRINCE;
      var n = Math.max(0, Math.floor(Number(trainCount) || 0));
      var step = Number(P.TRAIN_STEP) || 0;
      return n * (Number(P.TRAIN_COST) || 0) + step * n * (n - 1) / 2;
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
