/* ============================================================
   systems/blood_talent.js · 血脉专属天赋（整数点版）
   ------------------------------------------------------------
   原则（用户 11-19 校准）：不碰 66h 专注经济百分比，只用游戏已有的整数点维度。
   同类天赋只取「最高位一位妃子」生效，避免养一堆血脉叠成雪球。
   总开关 config.BLOOD.TALENTS_ENABLED = false 可一行关掉。
   ============================================================ */
(function(){
  function B(){ return (QZD.config && QZD.config.BLOOD) || {}; }
  function enabled(){ return B().TALENTS_ENABLED !== false; }
  function consorts(){
    if(!QZD.state) return [];
    if(!Array.isArray(QZD.state.consorts)) QZD.state.consorts = [];
    return QZD.state.consorts;
  }
  function entryOf(c){
    if(!enabled() || !c || !c.blood || c.blood === 'ren') return null;
    var list = B().LIST || [];
    for(var i=0;i<list.length;i++) if(list[i].key === c.blood) return list[i];
    return null;
  }
  function talentOf(c){
    var e = entryOf(c);
    return (e && e.talent) ? e.talent : null;
  }
  /* 同类取最高一位：位分 > 宠爱 > 喜爱，同分则由先遇到者获得 */
  function topOwner(type){
    var best = null, score = -1;
    consorts().forEach(function(c){
      var t = talentOf(c);
      if(!t || t.type !== type) return;
      var s = (c.rank || 0) * 100000 + (c.dote || 0) * 1000 + (c.favor || 0);
      if(s > score){ score = s; best = c; }
    });
    return best;
  }
  function forConsort(c, type){
    if(!c || !talentOf(c) || talentOf(c).type !== type) return 0;
    return topOwner(type) === c ? (Number(talentOf(c).value) || 0) : 0;
  }
  function clamp(n){ return Math.max(0, Math.min(120, Math.round(n))); }

  /* 入宫瞬间加成：只对新建妃子调用，旧档不追溯 */
  function initConsort(c){
    var t = talentOf(c);
    if(!t) return c;
    var v = Number(t.value) || 0;
    if(t.type === 'attr_cai') c.cai = clamp((Number(c.cai)||0) + v);
    else if(t.type === 'attr_yan') c.yan = clamp((Number(c.yan)||0) + v);
    else if(t.type === 'attr_ti') c.ti = clamp((Number(c.ti)||0) + v);
    else if(t.type === 'attr_all'){
      c.yan = clamp((Number(c.yan)||0) + v);
      c.ti  = clamp((Number(c.ti)||0)  + v);
      c.cai = clamp((Number(c.cai)||0) + v);
    }
    return c;
  }

  function doteCapBonus(c){ return forConsort(c, 'dote_cap'); }
  function summonDoteBonus(c){ return forConsort(c, 'summon_dote'); }
  function hobbyPointBonus(c){ return forConsort(c, 'hobby_point'); }

  /* 陪伴奖励：羽人 +1；夜间（19:00–06:00）再叠山鬼 +1 */
  function companionFavorBonus(c){
    var h = new Date().getHours(), night = (h >= 19 || h < 6);
    return forConsort(c, 'companion_favor') + (night ? forConsort(c, 'night_favor') : 0);
  }
  /* 精读完成：给鲛人（最高一位）加喜爱 */
  function readingFavorBonus(){
    var c = topOwner('reading_favor');
    return c ? { consort: c, value: Number(talentOf(c).value) || 0 } : null;
  }

  /* 每日首次专注：巫祝给 +1 勤政（非金钱/国力，不动 66h 产出基线）。
     记日期防重复；只在专注实际入账时调用。 */
  function onFocusTick(){
    if(!QZD.state) return 0;
    var c = topOwner('daily_qin');
    if(!c) return 0;
    if(!QZD.state.bloodTalent || typeof QZD.state.bloodTalent !== 'object'){
      QZD.state.bloodTalent = {};
    }
    var d = new Date(), key = d.getFullYear() + '-' + (d.getMonth()+1) + '-' + d.getDate();
    if(QZD.state.bloodTalent.dailyQinDate === key) return 0;
    var v = Number(talentOf(c).value) || 0;
    if(v > 0 && QZD.resources && QZD.resources.add) QZD.resources.add({ qinZheng: v });
    QZD.state.bloodTalent.dailyQinDate = key;
    return v;
  }

  /* 名册展示：未识破只显示问号，识破后显示可感知的整数点效果 */
  function describe(c, revealed){
    var t = talentOf(c);
    if(!t) return null;
    var e = entryOf(c);
    return revealed
      ? (t.label + (e && e.sign ? ' · ' + e.sign : ''))
      : '异象未明 · 所擅？？';
  }
  function list(){
    return (B().LIST || []).filter(function(e){ return e.talent; }).map(function(e){
      return { key:e.key, name:e.name, label:e.talent.label, type:e.talent.type, value:e.talent.value };
    });
  }

  QZD.bloodTalent = {
    enabled: enabled, talentOf: talentOf, describe: describe, list: list,
    initConsort: initConsort, doteCapBonus: doteCapBonus,
    summonDoteBonus: summonDoteBonus, companionFavorBonus: companionFavorBonus,
    hobbyPointBonus: hobbyPointBonus, readingFavorBonus: readingFavorBonus,
    onFocusTick: onFocusTick
  };
})();
