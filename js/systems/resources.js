/* ============================================================
   systems/resources.js · 四资源结算
   内部一律浮点，UI 显示时再取整
   ============================================================ */
(function(){
  var KEYS = ['qinZheng', 'jinQian', 'guoJin', 'shengWang'];

  QZD.resources = {
    /* 增加资源（gain 只写存在的键） */
    add: function(gain){
      if(!gain) return;
      var r = QZD.state.resources;
      for(var i = 0; i < KEYS.length; i++){
        var k = KEYS[i];
        if(gain[k]) r[k] += gain[k];
      }
    },

    /* 回收资源，不足则归零（放弃结算用） */
    remove: function(gain){
      if(!gain) return;
      var r = QZD.state.resources;
      for(var i = 0; i < KEYS.length; i++){
        var k = KEYS[i];
        if(gain[k]) r[k] = Math.max(0, r[k] - gain[k]);
      }
    },

    /* 按比例回收 */
    reclaim: function(gain, ratio){
      if(!gain) return;
      var out = {};
      for(var i = 0; i < KEYS.length; i++){
        var k = KEYS[i];
        if(gain[k]) out[k] = gain[k] * (ratio || 0);
      }
      this.remove(out);
    }
  };
})();
