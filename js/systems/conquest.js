/* ============================================================
   systems/conquest.js · M2 宏图征伐 + 属地贡赋
   确定性结算：战力 ≥ 守备即可出征（必胜），出征扣军费
   贡赋按真实时间实时入账，离线补算最多 8 小时
   ============================================================ */
(function(){
  var C = QZD.config.CONQUEST;

  function state(){ return QZD.state; }

  function territories(){
    if(!Array.isArray(QZD.state.territories)) QZD.state.territories = [];
    return QZD.state.territories;
  }

  function cityById(id){
    for(var i = 0; i < C.CITIES.length; i++){
      if(C.CITIES[i].id === id) return C.CITIES[i];
    }
    return null;
  }

  function territoryOf(id){
    var list = territories();
    for(var i = 0; i < list.length; i++){
      if(list[i].cityId === id) return list[i];
    }
    return null;
  }

  /* 每秒结算所有属城贡赋；span 超过上限的部分丢弃 */
  function settle(now){
    now = now || Date.now();
    var capMs = C.OFFLINE_CAP_HOURS * 3600 * 1000;
    var mult = QZD.formulas.tributeMultiplier();   /* 名臣理政加成 */
    var gained = { jinQian: 0, guoJin: 0 };
    var list = territories();

    /* 属地贡赋只在勤政（专注）期间入账；暂停/停止勤政时只推进时间戳，不产出 */
    if(!QZD.pomodoro || !QZD.pomodoro.isActive()){
      for(var g = 0; g < list.length; g++){ list[g].lastAt = now; }
      return { jinQian: 0, guoJin: 0 };
    }

    for(var i = 0; i < list.length; i++){
      var t = list[i];
      var city = cityById(t.cityId);
      if(!city) continue;
      if(!t.lastAt || t.lastAt > now) t.lastAt = now;

      var span = now - t.lastAt;
      if(span < 1000) continue;              /* 不足 1 秒不推进，避免精度损耗 */

      var eff = Math.min(span, capMs);
      t.lastAt = now;
      gained.jinQian += city.tribute.jinQian * mult * eff / 60000;
      gained.guoJin += city.tribute.guoJin * mult * eff / 60000;
    }

    QZD.resources.add(gained);
    return gained;
  }

  function fmtDec(n){
    return (Math.round((n || 0) * 10) / 10).toFixed(1);
  }

  QZD.conquest = {
    cityById: cityById,
    territoryOf: territoryOf,

    owned: function(id){ return !!territoryOf(id); },

    ownedList: function(){
      return territories().map(function(t){
        return { territory: t, city: cityById(t.cityId) };
      }).filter(function(x){ return !!x.city; });
    },

    /* 当前战力（含当日 BUFF） */
    power: function(){ return QZD.formulas.combatPower(); },

    cost: function(city){ return QZD.formulas.marchCost(city); },

    /* 每分钟贡赋合计（含名臣理政加成） */
    totals: function(){
      var mult = QZD.formulas.tributeMultiplier();
      var out = { jinQian: 0, guoJin: 0 };
      territories().forEach(function(t){
        var city = cityById(t.cityId);
        if(!city) return;
        out.jinQian += city.tribute.jinQian;
        out.guoJin += city.tribute.guoJin;
      });
      out.jinQian *= mult;
      out.guoJin *= mult;
      return out;
    },

    /* 下一座未克城池（按表中顺序） */
    nextTarget: function(){
      for(var i = 0; i < C.CITIES.length; i++){
        if(!territoryOf(C.CITIES[i].id)) return C.CITIES[i];
      }
      return null;
    },

    /* 出征可行性：给人看的拒绝理由 */
    inspect: function(city){
      if(territoryOf(city.id)) return { ok: false, reason: '已归版图' };
      var power = QZD.formulas.combatPower();
      if(power + 1e-9 < city.defense){
        return { ok: false, reason: '战力尚缺 ' + Math.ceil(city.defense - power), power: power };
      }
      var cost = QZD.formulas.marchCost(city);
      if(state().resources.guoJin + 1e-9 < cost){
        return { ok: false, reason: '国力不足军费', power: power, cost: cost };
      }
      return { ok: true, power: power, cost: cost };
    },

    march: function(id){
      var city = cityById(id);
      if(!city) return { ok: false, error: '城池不存在' };
      if(territoryOf(id)) return { ok: false, error: '该城已归版图' };

      var power = QZD.formulas.combatPower();
      if(power + 1e-9 < city.defense){
        return { ok: false, error: '战力不足，尚缺 ' + Math.ceil(city.defense - power) };
      }

      var cost = QZD.formulas.marchCost(city);
      if(state().resources.guoJin + 1e-9 < cost){
        return { ok: false, error: '国力不足以支付军费（需 ' + cost + '）' };
      }

      QZD.resources.remove({ guoJin: cost });
      var reward = {
        guoJin: QZD.formulas.captureGuoJin(city),
        shengWang: city.shengWang
      };
      QZD.resources.add(reward);

      var now = Date.now();
      territories().push({ cityId: city.id, capturedAt: now, lastAt: now });

      QZD.stateIO.pushLog('conquest',
        '御驾亲征，克复「' + city.name + '」 · 国力 +' + reward.guoJin + ' · 声望 +' + reward.shengWang);
      QZD.stateIO.save();
      return { ok: true, city: city, cost: cost, reward: reward, power: power };
    },

    /* 启动补算：页面关闭期间按真实时间补贡赋（封顶 8 小时） */
    restore: function(){
      var gained = settle(Date.now());
      if(gained.jinQian + gained.guoJin > 0){
        QZD.stateIO.pushLog('conquest',
          '属城贡赋入账 · 金钱 +' + fmtDec(gained.jinQian) + ' · 国力 +' + fmtDec(gained.guoJin));
        QZD.stateIO.save();
        return gained;
      }
      return null;
    },

    settle: settle
  };
})();
