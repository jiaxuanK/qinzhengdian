/* ============================================================
   systems/queen.js · 皇后与换装（路径 A：整图替换）
   ------------------------------------------------------------
   装扮来自 js/outfit-manifest.js：assets/images/皇后/<装扮名>/01.jpg …
   文件夹名即游戏里显示的装扮名；往目录里加文件夹后，
   游戏内「刷新立绘素材」会重新生成清单（桌面版）；网页版选一次 images 目录即可热更新。
   ============================================================ */
(function(){
  var QZD = window.QZD || (globalThis && globalThis.QZD) || {};

  function qcfg(){ return QZD.config && QZD.config.QUEEN || {}; }
  function qstate(){
    if(!QZD.state) return null;
    if(!QZD.state.queen) QZD.state.queen = { outfit:'', poseIndex:0, auto:true };
    return QZD.state.queen;
  }
  function consorts(){
    if(!QZD.state) return [];
    if(!Array.isArray(QZD.state.consorts)) QZD.state.consorts = [];
    return QZD.state.consorts;
  }
  function get(){
    var id = qcfg().ID || 'queen';
    var cs = consorts();
    for(var i=0;i<cs.length;i++) if(cs[i] && cs[i].id === id) return cs[i];
    return null;
  }
  function outfits(){
    var m = QZD.QUEEN_OUTFITS;
    return (m && Array.isArray(m.outfits)) ? m.outfits : [];
  }
  function find(name){
    var all = outfits();
    for(var i=0;i<all.length;i++) if(all[i].name === name || all[i].folder === name) return all[i];
    return null;
  }

  /* 把当前装扮的图片写回皇后的 c.poses / c.img —— 复用现有妃子立绘通道，
     名册、陪伴、侍寝剧情等所有用 c.img 的地方自动生效，无需改渲染层。 */
  function refreshPortrait(){
    var c = get(), s = qstate();
    if(!c || !s) return null;
    var o = find(s.outfit) || outfits()[0] || null;
    if(!o) return null;                    /* 一张图都没有：保留旧档已有立绘 */
    c.poses = (o.images || []).slice();
    var len = c.poses.length;
    s.poseIndex = Math.max(0, Math.min(s.poseIndex || 0, Math.max(0, len - 1)));
    c.poseIndex = s.poseIndex;
    c.img = c.poses[s.poseIndex] || o.cover || '';
    return c;
  }

  /* name 为空 → 用清单第一套；manual=true（默认）表示玩家手动选择，之后不再自动换装 */
  function setOutfit(name, opts){
    opts = opts || {};
    var s = qstate();
    if(!s) return { ok:false, error:'存档未就绪' };
    var all = outfits();
    if(!all.length) return { ok:false, error:'尚未找到皇后图片。请把图片放进 assets/images/皇后/<装扮名>/ 后刷新素材' };
    var o = name ? find(name) : all[0];
    if(!o) return { ok:false, error:'装扮「' + String(name) + '」不存在' };
    s.outfit = o.name;
    s.poseIndex = 0;
    if(opts.manual !== false) s.auto = false;
    var c = refreshPortrait();
    if(QZD.stateIO && QZD.stateIO.save) QZD.stateIO.save();
    return { ok:true, name:o.name, count:(o.images||[]).length, consort:c };
  }

  /* 剧情里的自动换装：只认配置里的关键词，且玩家没手动选过才生效 */
  function autoDress(scene){
    var s = qstate();
    if(!s || s.auto === false || !scene) return false;
    var hints = (qcfg().OUTFIT_HINT || {})[scene] || [];
    if(!hints.length) return false;
    var hit = null;
    outfits().forEach(function(o){
      if(hit) return;
      for(var i=0;i<hints.length;i++){
        if(String(o.name).indexOf(hints[i]) >= 0){ hit = o; break; }
      }
    });
    if(!hit || hit.name === s.outfit) return false;
    return setOutfit(hit.name, { manual:false }).ok === true;
  }

  function resetAuto(){
    var s = qstate();
    if(!s) return { ok:false };
    s.auto = true;
    if(QZD.stateIO && QZD.stateIO.save) QZD.stateIO.save();
    return { ok:true };
  }

  function status(){
    var s = qstate(), c = get(), all = outfits();
    var o = (s && find(s.outfit)) || all[0] || null;
    return {
      name: o ? o.name : '',
      count: all.length,
      images: o ? (o.images || []).length : 0,
      manual: !!(s && s.auto === false),
      hasQueen: !!c
    };
  }

  QZD.queen = {
    get: get, outfits: outfits, find: find, current: status,
    refreshPortrait: refreshPortrait, setOutfit: setOutfit,
    autoDress: autoDress, resetAuto: resetAuto
  };
})();
