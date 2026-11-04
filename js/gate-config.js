/* ============================================================
   gate-config.js · 进殿口令配置（网页版防窥门）
   - HASH = sha256(SALT + ':' + 口令)，改口令只需换这串哈希
   - 生成方式：node -e "console.log(require('crypto')
       .createHash('sha256').update('qzd.v1' + ':' + '新口令').digest('hex'))"
   - 桌面版不加载口令门（ui/gate.js 自动跳过）
   ============================================================ */
window.QZD_GATE = {
  HASH: 'd4f7db7812cb0e0003c5dfac567ac8808b88c8bcb7706a33c23203a7e517197c',
  SALT: 'qzd.v1'
};
