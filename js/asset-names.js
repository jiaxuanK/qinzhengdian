/* ============================================================
   asset-names.js · 占位/代号文件夹的「自动雅名」分配器
   ------------------------------------------------------------
   解决的问题：玩家把立绘丢进 assets/images/新建文件夹 (2) 或 a、c、d
   这类代号文件夹时，清单原本会把文件夹名直接当妃嫔名字，名册里就出现
   "新建文件夹 (12)" 这种怪名。本模块在【生成清单时】自动分配一个雅名。

   三条设计约束：
   1) 位分不能当名字：才人/美人/婕妤/嫔/妃/贵妃 是 config.RANK.TITLES，
      名字池里一个都不含（否则册封后"位分：婕妤，名字：婕妤"会撞车）。
   2) 名字必须稳定：存档用 rareKey = folder 认人，name 只是显示。
      若每次刷新随机，同一位妃子会改名 / 串档。故用【按 folder 稳定哈希】。
   3) 只改显示名，不改 folder：磁盘文件夹名、a8f 锁图哈希、存档键全都不动。
      正式中文名文件夹（朝云 / 钰 / 洛神…）保持原名，不受影响。

   两端共用：Node（scripts/gen_manifest.js、Electron 主进程）与浏览器
   （js/ui/assets-refresh.js）都加载本文件，UMD 写法，无第三方依赖。
   ============================================================ */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;       // Node / Electron
  if (root) { root.QZD = root.QZD || {}; root.QZD.assetNames = api; }            // 浏览器（window 优先）
})(typeof window !== 'undefined' ? window
   : (typeof globalThis !== 'undefined' ? globalThis : this), function () {
  'use strict';

  /* 雅名池：60 个两字名。
     刻意排除：① 位分（才人/美人/婕妤/嫔/妃/贵妃）
                ② 已正式命名的角色（洛神/甄宓/西施/王嫱/飞燕/玉环/师师/小小/
                   如是/疏影/青黛/绛雪/朝云/清商/霓裳/惊鸿/钰）
                ③ state.js 旧档迁移表里的旧名（横波/绿珠/红拂/琴操）
     想换名字，直接改这个数组即可（新加文件夹会自动从池里取）。 */
  var NAME_POOL = [
    '念奴', '弄玉', '采薇', '佩玖', '含章', '知微', '听澜', '栖迟', '杜若', '辛夷',
    '白芷', '秋兰', '流萤', '纤月', '烟渚', '疏桐', '南枝', '寒英', '微霰', '惊鹊',
    '星杓', '云杪', '汀兰', '沅芷', '澧兰', '洛灵', '拈花', '浣纱', '沉香', '檀心',
    '素娥', '绛珠', '碧痕', '秋水', '盈盈', '袅袅', '娉婷', '嫣然', '莞尔', '粲然',
    '静姝', '令仪', '蓁蓁', '燕婉', '淑慎', '惠然', '洵美', '皎月', '凝霜', '映雪',
    '清扬', '子衿', '婉如', '琼琚', '舜华', '扶苏', '忘忧', '木槿', '蘅芜', '荇菜'
  ];

  /* 位分表（只用于防呆断言，绝不进名字池） */
  var FORBIDDEN = ['才人', '美人', '婕妤', '嫔', '妃', '贵妃'];

  /* 哪些文件夹算「代号/占位」，需要自动命名。
     支持：新建文件夹 / 新建文件夹 (2) / 未命名… / 单字母 a、c、d / 纯数字 1、02 */
  function isPlaceholder(folder) {
    var f = String(folder || '').trim();
    if (!f || /^king$/i.test(f)) return false;              // king 是帝王目录
    if (/^新建文件夹/.test(f)) return true;
    if (/^未命名/.test(f)) return true;
    if (/^[a-zA-Z]\d*$/.test(f)) return true;               // a / c / d / a1
    if (/^\d{1,3}$/.test(f)) return true;                   // 1 / 02 / 003
    return false;
  }

  /* 稳定哈希：同一个字符串永远得到同一个数（与 state.js seededIdx 同款）。 */
  function seededIdx(key, len) {
    var s = String(key || ''), h = 0;
    for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    return len ? h % len : 0;
  }

  /* 给一组文件夹分配名字，返回 { 占位folder: 雅名 }。
     - 按文件夹名排序后依次分配 → 结果确定、可复现；
     - 正式中文名（非占位）先登记进 used，避免雅名和已有角色撞名；
     - 哈希撞车时线性顺延找空位，保证同批内不重名；
     - 新编号排在末尾（新建文件夹 (17) / e），因此不会改动已有名字。 */
  function assignNames(folders) {
    var list = (folders || []).slice();
    var used = Object.create(null);
    var map = Object.create(null);
    var i;

    list.forEach(function (f) {
      if (!isPlaceholder(f)) used[f] = true;              // 正式角色名先占位
    });

    var holders = list.filter(isPlaceholder).sort(function (a, b) {
      return String(a).localeCompare(String(b), 'zh-Hans-CN', { numeric: true });
    });

    for (i = 0; i < holders.length; i++) {
      var f = holders[i];
      var start = seededIdx(f, NAME_POOL.length);
      var picked = null;
      for (var k = 0; k < NAME_POOL.length; k++) {
        var cand = NAME_POOL[(start + k) % NAME_POOL.length];
        if (!used[cand]) { picked = cand; break; }
      }
      if (picked) { map[f] = picked; used[picked] = true; }
      else map[f] = f;                                     // 池耗尽（>60 个代号）时退回原名
    }
    return map;
  }

  /* 单个文件夹取名字（给不方便一次性传全量列表的调用方用）。 */
  function nameOf(folder) {
    if (!isPlaceholder(folder)) return folder;
    return NAME_POOL[seededIdx(folder, NAME_POOL.length)];
  }

  return {
    NAME_POOL: NAME_POOL,
    FORBIDDEN: FORBIDDEN,
    isPlaceholder: isPlaceholder,
    seededIdx: seededIdx,
    assignNames: assignNames,
    nameOf: nameOf
  };
});
