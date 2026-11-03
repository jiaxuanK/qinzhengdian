/* ============================================================
   gate-config.js · 进殿口令配置（网页版防窥门）
   - HASH = sha256(SALT + ':' + 口令)，改口令只需换这串哈希
   - 生成方式：node -e "console.log(require('crypto')
       .createHash('sha256').update('qzd.v1' + ':' + '新口令').digest('hex'))"
   - 桌面版不加载口令门（ui/gate.js 自动跳过）
   ============================================================ */
window.QZD_GATE = {
  HASH: 'f9e324e0db73e62790acf6c1de0becbbe19928066922f2cc8e8d162ea9e97869',
  SALT: 'qzd.v1'
};
