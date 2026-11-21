/* ============================================================
   systems/emperor_story.js · 御极纪（帝王自己的事件剧情）
   - 与妃子线分开：登录 / 专注收工 / 奏折办结 / 帝阶晋升 /
     安定起落 / 拨乱反正 / 7 天传代时强推
   - 每条线「每一代只演一次」，传代后 seen 的代号自然过期
   - 条件直接读帝王四维、本代专注、周专注、连登、本代奏折数、安定度
   - 奖励走每代一次的小额正反馈，不碰 66h 周目标主经济
   ============================================================ */
(function(){
  var CFG = QZD.config.EMPEROR_STORY || {};
  var LINES = CFG.LINES || [];

  function S(){
    var st = QZD.state;
    if(!st.emperorStory || typeof st.emperorStory !== 'object') st.emperorStory = {};
    var e = st.emperorStory;
    if(typeof e.version !== 'number') e.version = 1;
    if(!e.seen || typeof e.seen !== 'object') e.seen = {};
    if(!Array.isArray(e.history)) e.history = [];
    return e;
  }
  function today(){ return QZD.stateIO.todayStr(); }
  function dayGap(a, b){
    if(!a || !b) return 0;
    var x = Date.parse(a + 'T00:00:00'), y = Date.parse(b + 'T00:00:00');
    if(!isFinite(x) || !isFinite(y)) return 0;
    return Math.max(0, Math.round((y - x) / 86400000));
  }
  function regime(){ return QZD.state.regime || {}; }
  function generation(){ return regime().generation || 1; }
  /* 本代第几天：按 generationStart 算，封顶 7 天；跨周传代后重新从 1 起 */
  function dayIndex(){
    var start = regime().generationStart || today();
    return Math.max(1, Math.min(7, dayGap(start, today()) + 1));
  }
  function memCountThisGen(){
    var start = regime().generationStart || '';
    var from = start ? Date.parse(start + 'T00:00:00') : -Infinity;
    var n = 0;
    (QZD.state.memorials || []).forEach(function(m){
      if(!m || m.status !== 'banjie' || !m.finishedAt) return;
      var t = Date.parse(m.finishedAt);
      if(isFinite(t) && t >= from) n++;
    });
    return n;
  }
  function quiet(){
    return !!(QZD.state.settings && QZD.state.settings.focusQuiet &&
              QZD.pomodoro && QZD.pomodoro.isActive && QZD.pomodoro.isActive());
  }
  function inList(v, x){
    if(v == null) return true;
    return (Array.isArray(v) ? v : [v]).indexOf(x) >= 0;
  }
  function extend(base, extra){
    var out = {}, k;
    for(k in base) if(Object.prototype.hasOwnProperty.call(base, k)) out[k] = base[k];
    if(extra) for(k in extra) if(Object.prototype.hasOwnProperty.call(extra, k)) out[k] = extra[k];
    return out;
  }
  function buildCtx(type, extra){
    var st = QZD.state, dyn = st.dynasty || {};
    return extend({
      event: type, at: Date.now(), date: today(),
      generation: generation(), dayIndex: dayIndex(),
      streak: (st.login && st.login.streak) || 0,
      rank: regime().rank || 1,
      focusMin: regime().focusMin || 0,
      focusWeekMin: (QZD.study && QZD.study.weekMinutes) ? QZD.study.weekMinutes() : 0,
      memorials: memCountThisGen(),
      stability: (typeof dyn.stability === 'number' ? dyn.stability : 80),
      dynastyLevel: dyn.level || 'calm',
      emperor: st.emperor || {}
    }, extra);
  }
  function match(when, c){
    if(!when) return true;
    if(when.event && when.event !== c.event) return false;
    if(when.dayIndexMin != null && c.dayIndex < when.dayIndexMin) return false;
    if(when.dayIndexMax != null && c.dayIndex > when.dayIndexMax) return false;
    if(when.generationMin != null && c.generation < when.generationMin) return false;
    if(when.streakMin != null && c.streak < when.streakMin) return false;
    if(when.rankMin != null && c.rank < when.rankMin) return false;
    if(when.focusMinMin != null && c.focusMin < when.focusMinMin) return false;
    if(when.focusWeekMinMin != null && c.focusWeekMin < when.focusWeekMinMin) return false;
    if(when.memorialsMin != null && c.memorials < when.memorialsMin) return false;
    if(when.stabilityMin != null && c.stability < when.stabilityMin) return false;
    if(when.stabilityMax != null && c.stability > when.stabilityMax) return false;
    if(when.dynastyLevel && !inList(when.dynastyLevel, c.dynastyLevel)) return false;
    if(when.attrMin){
      var k;
      for(k in when.attrMin){
        if(!Object.prototype.hasOwnProperty.call(when.attrMin, k)) continue;
        if((c.emperor[k] || 0) < when.attrMin[k]) return false;
      }
    }
    return true;
  }
  var ATTR_NAME = { ningShen:'凝神', yuLue:'御略', mingDe:'明德', renXin:'仁心' };
  function attrNote(line){
    var w = line.when && line.when.attrMin, bits = [], k;
    if(!w) return '';
    for(k in w){
      if(!Object.prototype.hasOwnProperty.call(w, k)) continue;
      bits.push((ATTR_NAME[k] || k) + ' ' + w[k] + ' 境');
    }
    return bits.length ? ('此章由 ' + bits.join(' · ') + ' 引出') : '';
  }
  function applyReward(reward){
    var out = { resources:null, log:'' };
    if(!reward) return out;
    out.log = reward.log || '';
    if(reward.resources && QZD.resources && QZD.resources.add){
      var has = false, k;
      for(k in reward.resources){
        if(Object.prototype.hasOwnProperty.call(reward.resources, k) && reward.resources[k]){
          has = true; break;
        }
      }
      if(has){ QZD.resources.add(reward.resources); out.resources = reward.resources; }
    }
    return out;
  }
  function resText(resources){
    if(!resources) return '';
    var map = { qinZheng:'勤政', jinQian:'金钱', guoJin:'国力', shengWang:'声望' };
    var bits = [], k;
    for(k in resources){
      if(Object.prototype.hasOwnProperty.call(resources, k) && resources[k])
        bits.push((map[k] || k) + ' +' + resources[k]);
    }
    return bits.join(' · ');
  }

  /* 事件强推：只取第一条本代未演、且条件齐全的线；不进妃子随机池 */
  function onEvent(type, extra){
    if(!CFG.ENABLED) return { ok:false, reason:'御极纪已关闭' };
    if(quiet()) return { ok:false, reason:'专注中，御极纪暂且不扰', quiet:true };
    extra = extra || {};
    var st = S(), c = buildCtx(type, extra), line = null, i;
    for(i = 0; i < LINES.length; i++){
      var L = LINES[i];
      if(L.event !== type) continue;
      if(st.seen[L.id] === c.generation) continue;
      if(!match(L.when, c)) continue;
      line = L; break;                 /* 配置顺序 = 优先级，特殊在前、通用在后 */
    }
    if(!line) return { ok:false, reason:'本代暂无新的御极纪', event:type };
    st.seen[line.id] = c.generation;
    var reward = applyReward(line.reward);
    var res = {
      ok: true, kind: 'emperor', event: type,
      lineId: line.id, lineName: line.name,
      title: '御极纪 · ' + line.name,
      text: line.text, reason: line.reason || '',
      attrNote: attrNote(line), reward: reward,
      generation: c.generation, dayIndex: c.dayIndex,
      rank: c.rank, focusMin: c.focusMin, focusWeekMin: c.focusWeekMin,
      stability: c.stability, dynastyLevel: c.dynastyLevel,
      stage: 1, total: 1, at: c.at, queued: false
    };
    st.history.push({ at: c.at, generation: c.generation, dayIndex: c.dayIndex,
      event: type, lineId: line.id, lineName: line.name, reason: res.reason });
    while(st.history.length > 60) st.history.shift();
    QZD.stateIO.pushLog('story', '御极纪 · ' + line.name +
      '（第 ' + c.generation + ' 代 · 第 ' + c.dayIndex + ' 日） —— ' + line.text +
      (res.attrNote ? '　【' + res.attrNote + '】' : '') +
      (res.log ? '　' + res.log : ''));
    QZD.stateIO.save();
    if(QZD.story && QZD.story.queuePresent){
      QZD.story.queuePresent(res);
      res.queued = true;
    }else if(QZD.ui && QZD.ui.toast){
      QZD.ui.toast(res.title + ' · ' + res.text.slice(0, 24) + '…');
    }
    return res;
  }

  /* 呈现层：走剧情队列，不与妃子剧情窗叠加；不用立绘，写帝王自己的案头 */
  function esc(s){
    return String(s == null ? '' : s).replace(/[&<>"]/g, function(ch){
      return ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' })[ch];
    });
  }
  function para(text){
    return '<p style="line-height:1.85;margin:0 0 10px">' + esc(text) + '</p>';
  }
  function present(res){
    if(!res || !QZD.ui || !QZD.ui.modal) return;
    var meta = '第 ' + res.generation + ' 代 · 第 ' + res.dayIndex + ' 日';
    if(res.rank) meta += ' · 帝阶 ' + res.rank;
    if(res.stability != null) meta += ' · 安定 ' + Math.round(res.stability);
    var body = '<p style="opacity:.68;font-size:12px;margin:0 0 10px">' + esc(meta) + '</p>' +
      (res.reason ? '<p style="opacity:.75;font-size:12px;margin:0 0 8px">因由：' +
        esc(res.reason) + '</p>' : '') +
      para(res.text) +
      (res.attrNote ? '<div style="margin-top:10px;padding:8px 10px;border-radius:6px;' +
        'background:rgba(168,132,44,.10);font-size:12px">' + esc(res.attrNote) + '</div>' : '') +
      (res.reward && (res.reward.resources || res.reward.log)
        ? '<div style="margin-top:8px;font-size:12px;opacity:.8">' +
          esc(resText(res.reward.resources) + (res.reward.log ? '　' + res.reward.log : '')) +
          '</div>' : '');
    QZD.ui.modal({ title: res.title || '御极纪', body: body,
                   ok: false, cancelText: '记下' });
  }

  function status(){
    var st = S(), gen = generation(), seen = [], k;
    for(k in st.seen){
      if(Object.prototype.hasOwnProperty.call(st.seen, k) && st.seen[k] === gen) seen.push(k);
    }
    return { generation: gen, dayIndex: dayIndex(), seen: seen,
             history: st.history.slice(-20) };
  }

  QZD.emperorStory = {
    state: S, lines: LINES, onEvent: onEvent,
    present: present, status: status, dayIndex: dayIndex,
    buildCtx: buildCtx, match: match
  };
})();
