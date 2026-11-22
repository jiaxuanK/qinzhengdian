/* ============================================================
   ui/assets-refresh.js · 游戏内「刷新立绘素材」
   ------------------------------------------------------------
   目标：玩家往 assets/images/ 丢新图/新文件夹后，不用切到终端跑
   npm run gen:assets，直接在游戏里点一下就生效。

   两条路径：
   1) 桌面版（Electron）：走 QZDNative.regenAssets → 主进程扫描目录、
      重写 assets-manifest.js 并返回新清单，渲染进程热更新 QZD.ASSETS。
   2) 浏览器版：浏览器沙箱不能扫描本地目录，故用隐藏的
      <input type=file webkitdirectory> 让用户选 assets/images 文件夹，
      前端按路径结构重建清单，仅在本次会话内生效（不写 localStorage）。
   ============================================================ */
(function(){
  var IMG_RE = /\.(jpe?g|png|webp|gif)$/i;
  var VID_RE = /\.(mp4|webm|mov)$/i;

  /* 与 scripts/gen_manifest.js 保持一致（改一处需同步另一处） */
  var PERSONALITY = {
    '洛神': 'qing', '甄宓': 'wen', '西施': 'mei', '王嫱': 'duan',
    '飞燕': 'huo', '玉环': 'mei', '师师': 'min', '小小': 'chou',
    '如是': 'min', '疏影': 'jue', '青黛': 'wen', '绛雪': 'jue',
    '朝云': 'chou', '清商': 'qing'
  };
  var FALLBACK_P = ['wen', 'huo', 'qing', 'mei', 'duan', 'jue', 'min', 'chou'];
  /* 与 scripts/gen_manifest.js 一致：1–3 图普通池，4–5 图稀有，6 图+绝色 */
  var UNCOMMON_MIN_POSES = 4;
  var RARE_MIN_POSES = 6;
  var SPECIAL_DIR = '特殊';
  var SPECIAL_MIN_POSES = RARE_MIN_POSES;
  /* 与 scripts/gen_manifest.js 保持一致：特殊妃子专用雅名池 */
  var SPECIAL_NAME_POOL = [
    '瑶光', '灵汐', '云绡', '月漪', '锦书', '青鸾', '素霓', '紫菱', '秋旻', '琼羽',
    '湘灵', '洛湄', '翠微', '芳甸', '春山', '晚照', '星渚', '烟萝', '玉笙', '红笺',
    '婉枫', '轻桡', '云鬟', '雪蘅', '碧梧', '绯烟', '露华', '银汉', '兰泽', '蕙茝',
    '子夜', '玄霜', '繁霜', '素秋', '明霞', '纤云', '寒漪', '浅黛', '妙音', '凝碧',
    '漱玉', '金荃', '月梳', '翠翘', '琼枝', '素翎', '青妩', '银筝'
  ];
  var VIDEO_META = [
    { name: '霓裳', personality: 'mei' },
    { name: '惊鸿', personality: 'qing' },
    { name: '云翘', personality: 'mei' },
    { name: '兰陵', personality: 'jue' },
    { name: '轻霞', personality: 'huo' },
    { name: '灵芸', personality: 'wen' },
    { name: '月华', personality: 'qing' },
    { name: '雪衣', personality: 'duan' }
  ];

  /* 占位/代号文件夹的雅名分配器（与 scripts/gen_manifest.js 共用同一模块）。
     若模块未加载（老页面缓存），降级为「文件夹名即名字」，不影响功能。 */
  var ASSET_NAMES = (window.QZD && window.QZD.assetNames) || null;

  function seededIdx(key, len) {
    var s = String(key || ''), h = 0;
    for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    return len ? h % len : 0;
  }

  function assignSpecialNames(keys, reserved) {
    var used = Object.create(null), out = Object.create(null);
    (reserved || []).forEach(function(n){ if(n) used[n] = true; });
    keys.slice().sort(function(a,b){ return String(a).localeCompare(String(b), 'zh-Hans-CN', { numeric:true }); })
      .forEach(function(key){
        var start = seededIdx('特殊/' + key, SPECIAL_NAME_POOL.length), picked = null;
        for(var k = 0; k < SPECIAL_NAME_POOL.length; k++){
          var cand = SPECIAL_NAME_POOL[(start + k) % SPECIAL_NAME_POOL.length];
          if(!used[cand]){ picked = cand; break; }
        }
        out[key] = picked || key;
        if(picked) used[picked] = true;
      });
    return out;
  }

  var isDesktop = !!(window.QZDNative && window.QZDNative.isDesktop);

  function applyManifest(m){
    if(!m || !m.rare || !m.pool) return false;
    window.QZD = window.QZD || {};
    window.QZD.ASSETS = m;
    return true;
  }
  function applyQueenManifest(m){
    if(!m || !Array.isArray(m.outfits)) return false;
    window.QZD = window.QZD || {};
    window.QZD.QUEEN_OUTFITS = m;
    return true;
  }

  /* 浏览器：从选中的 assets/images 里单独挑出皇后装扮，重建换装清单。
     目录结构：皇后/<装扮名>/01.jpg → 一个装扮。 */
  function buildQueenFromFiles(fileList){
    var map = {};
    for(var i = 0; i < fileList.length; i++){
      var rp = fileList[i].webkitRelativePath || '';
      var idx = rp.toLowerCase().indexOf('images/');
      if(idx < 0) continue;
      var parts = rp.slice(idx + 'images/'.length).split('/');
      if(parts.length < 3 || parts[0] !== '皇后' || !IMG_RE.test(parts[2])) continue;
      var name = parts[1];
      if(!map[name]) map[name] = { name: name, folder: name, images: [], cover: '' };
      map[name].images.push('assets/images/' + encodeURI(parts.slice(0, 3).join('/')));
    }
    var outfits = Object.keys(map).sort().map(function(k){
      var o = map[k];
      o.images.sort();
      o.cover = o.images[0];
      return o;
    }).filter(function(o){ return o.images.length; });
    return { root: 'assets/images/皇后', outfits: outfits };
  }

  /* 浏览器：从 FileList（webkitdirectory）重建清单，逻辑镜像 gen_manifest.js */
  function buildFromFiles(fileList){
    var emperor = [], rare = [], uncommon = [], pool = [];
    var pi = 0;
    var videoCount = 0;
    var relPaths = [];
    for(var i = 0; i < fileList.length; i++){
      var f = fileList[i];
      var rp = f.webkitRelativePath || '';
      if(!rp){
        // 目录模式（webkitdirectory）未生效：按文件名兜底。
        // 用户直接选了若干图片文件 -> 当作顶层 pool 处理，避免「未找到可用图片」。
        if(IMG_RE.test(f.name || '')) pool.push('assets/images/' + encodeURI(f.name));
        continue;
      }
      // 找到 "images" 段，取其后部分，例如 如是/1.jpg 或 001.jpg 或 king/2.jpg
      var idx = rp.toLowerCase().indexOf('images/');
      if(idx < 0) continue;
      relPaths.push(rp.slice(idx + 'images/'.length));
    }
    relPaths.sort();

    /* 先按图片张数分档：1–3 普通池 / 4–5 稀有 / 6+ 绝色；有视频仍走绝色。 */
    var normalStats = Object.create(null);
    relPaths.forEach(function(p){
      var parts = p.split('/');
      if(parts.length < 2) return;
      var folder = parts[0];
      if(folder.toLowerCase() === 'king' || folder === '皇后' || folder === SPECIAL_DIR) return;
      var last = parts[parts.length - 1];
      if(!IMG_RE.test(last) && !VID_RE.test(last)) return;
      if(!normalStats[folder]) normalStats[folder] = { folder:folder, poses:[], vids:[] };
      var full = 'assets/images/' + encodeURI(p);
      if(IMG_RE.test(last)) normalStats[folder].poses.push(full);
      else normalStats[folder].vids.push(full);
    });

    var rareFolders = Object.create(null), uncommonFolders = Object.create(null);
    Object.keys(normalStats).forEach(function(folder){
      var s = normalStats[folder];
      if(s.vids.length || s.poses.length >= RARE_MIN_POSES) rareFolders[folder] = true;
      else if(s.poses.length >= UNCOMMON_MIN_POSES) uncommonFolders[folder] = true;
      else pool.push.apply(pool, s.poses);
    });

    /* 特殊库：特殊/<子目录>/NN.jpg，沿用 6 张门槛；4–5 张降为稀有。 */
    var specialStats = Object.create(null), qualifiedSpecial = Object.create(null);
    relPaths.forEach(function(p){
      var parts = p.split('/');
      if(parts[0] !== SPECIAL_DIR || parts.length < 3) return;
      var last = parts[parts.length - 1];
      if(!IMG_RE.test(last) && !VID_RE.test(last)) return;
      var key = SPECIAL_DIR + '/' + parts[1];
      if(!specialStats[key]) specialStats[key] = { folder:key, sub:parts[1], poses:[], vids:[] };
      var full = 'assets/images/' + encodeURI(p);
      if(IMG_RE.test(last)) specialStats[key].poses.push(full);
      else specialStats[key].vids.push(full);
    });
    Object.keys(specialStats).forEach(function(key){
      var s = specialStats[key];
      if(s.vids.length || s.poses.length >= SPECIAL_MIN_POSES) qualifiedSpecial[key] = s;
      else if(s.poses.length >= UNCOMMON_MIN_POSES) uncommonFolders[key] = true;
      else pool.push.apply(pool, s.poses);
    });

    /* 有效目录（绝色 + 稀有）统一算雅名，保证桌面/浏览器两端一致。 */
    var nameMap = {};
    if(ASSET_NAMES){
      nameMap = ASSET_NAMES.assignNames(Object.keys(rareFolders).concat(Object.keys(uncommonFolders)));
    }

    var reservedNames = [];
    Object.keys(nameMap).forEach(function(k){ reservedNames.push(nameMap[k]); });
    VIDEO_META.forEach(function(v){ reservedNames.push(v.name); });
    var specialNameMap = assignSpecialNames(Object.keys(specialStats), reservedNames);

    var usedVideoNames = Object.create(null);
    rare.forEach(function(r){ usedVideoNames[r.name] = true; });

    relPaths.forEach(function(p){
      if(!p) return;
      var parts = p.split('/');
      if(parts.length === 1){
        // 顶层文件
        if(IMG_RE.test(parts[0])) pool.push('assets/images/' + encodeURI(parts[0]));
        else if(VID_RE.test(parts[0])){
          var idx = videoCount++;
          var meta = VIDEO_META[idx] || { name: '影姬' + (idx + 1), personality: 'mei' };
          var vname = meta.name;
          while(usedVideoNames[vname]) vname = meta.name + '·' + (idx + 1);
          usedVideoNames[vname] = true;
          rare.push({ folder: '__video__' + parts[0].replace(/\.[^.]+$/, ''), name: vname,
            personality: meta.personality, poses: [], video: 'assets/images/' + encodeURI(parts[0]), special: true });
        }
        return;
      }
      var folder = parts[0];
      if(folder.toLowerCase() === 'king'){
        if(IMG_RE.test(parts[parts.length - 1])) emperor.push('assets/images/' + encodeURI(p));
        return;
      }
      // 只有 6 图+ / 有视频的目录进绝色池；4–5 图进稀有池；其余已下放普通池
      if(folder === '皇后' || folder === SPECIAL_DIR || !rareFolders[folder]) return;
      var last = parts[parts.length - 1];
      var isImg = IMG_RE.test(last), isVid = VID_RE.test(last);
      if(!isImg && !isVid) return;
      var entry = findRare(rare, folder);
      if(!entry){
        entry = { folder: folder, name: nameMap[folder] || folder, personality: PERSONALITY[folder] || FALLBACK_P[pi++ % FALLBACK_P.length], poses: [] };
        rare.push(entry);
      }
      if(isImg) entry.poses.push('assets/images/' + encodeURI(p));
      else if(isVid) entry.video = 'assets/images/' + encodeURI(p);
    });

    /* 4–5 图目录：稀有妃池 */
    Object.keys(uncommonFolders).forEach(function(key){
      var s = normalStats[key] || specialStats[key];
      if(!s || !s.poses.length) return;
      var isSpecial = key.indexOf(SPECIAL_DIR + '/') === 0;
      uncommon.push({
        folder: key,
        name: (isSpecial ? specialNameMap[key] : nameMap[key]) || key,
        personality: PERSONALITY[s.sub || key] || FALLBACK_P[pi++ % FALLBACK_P.length],
        poses: s.poses.slice(),
        tier: 'uncommon'
      });
    });

    /* 特殊库里达到绝色门槛的条目 */
    Object.keys(qualifiedSpecial).forEach(function(key){
      var s = qualifiedSpecial[key];
      if(!s.poses.length && !s.vids.length) return;
      var entry = {
        folder: key,
        name: specialNameMap[key] || s.sub,
        personality: PERSONALITY[s.sub] || FALLBACK_P[pi++ % FALLBACK_P.length],
        poses: s.poses,
        special: s.poses.length >= SPECIAL_MIN_POSES
      };
      if(s.vids.length) entry.video = s.vids[0];
      rare.push(entry);
    });

    rare = rare.filter(function(r){ return r.poses.length || r.video; });
    return { emperor: emperor, rare: rare, uncommon: uncommon, pool: pool };
  }

  function findRare(arr, folder){
    for(var i = 0; i < arr.length; i++) if(arr[i].folder === folder) return arr[i];
    return null;
  }

  /* 主入口：刷新立绘素材 */
  function refresh(){
    var UI = (window.QZD && window.QZD.ui) || null;
    if(isDesktop && window.QZDNative && window.QZDNative.regenAssets){
      window.QZDNative.regenAssets().then(function(res){
        if(!res || res.ok === false){
          if(UI) UI.toast('刷新失败：' + ((res && res.error) || '未知错误'));
          return;
        }
        if(res.manifest) applyManifest(res.manifest); // 即时热更新当前画面
        if(res.queenManifest) applyQueenManifest(res.queenManifest);
        if(UI){
          UI.toast('立绘素材已刷新 · 帝王 ' + res.emperor + ' · 绝色 ' + res.rare +
            ' · 普通池 ' + res.pool + ' · 装扮 ' + (res.outfits != null ? res.outfits : '—'));
          if(UI.onStateChanged) UI.onStateChanged();
        }
      }).catch(function(err){
        if(UI) UI.toast('刷新异常：' + (err && err.message || err));
      });
      return;
    }

    // 浏览器兜底：让用户选 assets/images 文件夹
    pickFolder(function(m, q, status){
      if(status === 'cancel') return; // 用户取消选择，静默不提示
      if(!m && (!q || !q.outfits.length)){
        // 选了文件夹但里面没有可用的图片结构
        if(UI) UI.toast('所选文件夹内未找到可用图片，请选择 assets/images 文件夹');
        return;
      }
      var a = applyManifest(m), b = applyQueenManifest(q);
      if(a || b){
        if(UI){
          UI.toast('素材已刷新（浏览器） · 绝色 ' + (m ? m.rare.length : 0) +
            ' · 普通池 ' + (m ? m.pool.length : 0) + ' · 装扮 ' + (q ? q.outfits.length : 0));
          if(UI.onStateChanged) UI.onStateChanged();
        }
      }
    });
  }

  /* 浏览器：用隐藏 file input 选目录（webkitdirectory）
     注意坑：
     1) display:none 的文件 input 在部分 Chromium 下 .click() 不弹对话框，
        改用离屏定位（left/top 负值 + opacity:0）既能 click 又可靠打开。
     2) webkitdirectory 用 setAttribute 双保险，避免属性赋值被忽略。
     3) 取消选择时部分浏览器会触发一次 change 且 files 为空，需与
        「选了但无可用图片」区分：取消 -> 静默；空结构 -> 明确提示。 */
  var folderInput = null;
  function ensureInput(){
    if(folderInput) return folderInput;
    folderInput = document.createElement('input');
    folderInput.type = 'file';
    // 双保险：属性 + 属性赋值
    folderInput.setAttribute('webkitdirectory', '');
    folderInput.setAttribute('mozdirectory', '');
    folderInput.multiple = true;
    // 离屏隐藏：可点击、可激活，避免 display:none 弹不出对话框
    folderInput.style.cssText = 'position:absolute;left:-9999px;top:-9999px;width:1px;height:1px;opacity:0;pointer-events:none';
    document.body.appendChild(folderInput);
    return folderInput;
  }

  /* cb(manifest, queenManifest, status)  status: 'ok' | 'cancel' | 'empty' */
  function pickFolder(cb){
    var input = ensureInput();
    var onPick = function(){
      input.removeEventListener('change', onPick); // 一次性，避免重复触发
      var files = input.files;
      var had = files && files.length;
      input.value = ''; // 重置，便于下次重新触发 change
      if(!had){ cb(null, 'cancel'); return; }
      var m = buildFromFiles(files);
      var q = buildQueenFromFiles(files);
      if((m && (m.rare.length || m.pool.length || m.emperor.length)) || q.outfits.length){
        cb(m, q, 'ok');
      }
      else cb(null, null, 'empty'); // 选了文件夹但里面没有 images 结构
    };
    input.addEventListener('change', onPick);
    // 离屏元素需等一帧再 click，部分浏览器同步 click 不弹窗
    if(window.requestAnimationFrame) requestAnimationFrame(function(){ input.click(); });
    else setTimeout(function(){ input.click(); }, 0);
  }

  /* 清单来源：
     - 桌面版：主进程扫描目录并重写 js/assets-manifest.js（权威来源）
     - 浏览器版：js/assets-manifest.js 为权威来源（已加 no-cache）；
       游戏内「刷新」只做本次会话内的临时覆盖，不写 localStorage，
       以免旧覆盖遮盖 gen_assets.bat 重新生成的清单（曾导致「加图不刷新」）。 */

  window.QZD = window.QZD || {};
  window.QZD.assetsRefresh = {
    refresh: refresh,
    buildFromFiles: buildFromFiles,
    buildQueenFromFiles: buildQueenFromFiles,
    applyQueenManifest: applyQueenManifest,
    isDesktop: isDesktop,
    UNCOMMON_MIN_POSES: UNCOMMON_MIN_POSES,
    RARE_MIN_POSES: RARE_MIN_POSES,
    SPECIAL_DIR: SPECIAL_DIR,
    SPECIAL_MIN_POSES: SPECIAL_MIN_POSES,
    SPECIAL_NAME_POOL: SPECIAL_NAME_POOL
  };
})();
