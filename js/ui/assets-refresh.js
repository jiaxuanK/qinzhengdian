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
  var VIDEO_META = [{ name: '霓裳', personality: 'mei' }];

  /* 占位/代号文件夹的雅名分配器（与 scripts/gen_manifest.js 共用同一模块）。
     若模块未加载（老页面缓存），降级为「文件夹名即名字」，不影响功能。 */
  var ASSET_NAMES = (window.QZD && window.QZD.assetNames) || null;

  var isDesktop = !!(window.QZDNative && window.QZDNative.isDesktop);

  function applyManifest(m){
    if(!m || !m.rare || !m.pool) return false;
    window.QZD = window.QZD || {};
    window.QZD.ASSETS = m;
    return true;
  }

  /* 浏览器：从 FileList（webkitdirectory）重建清单，逻辑镜像 gen_manifest.js */
  function buildFromFiles(fileList){
    var emperor = [], rare = [], pool = [];
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

    /* 先收集所有「有效子文件夹」，统一算显示名映射。
       与 gen_manifest.js 的 built 集合口径一致（只含有图片/视频的目录），
       保证桌面端与浏览器端给同一文件夹分配同一个名字。
       映射表由 index.html 预先加载为 window.QZD.nameMap（表优先，缺省哈希兜底）。 */
    var nameMap = {};
    if(ASSET_NAMES){
      var folders = [], seenF = {};
      relPaths.forEach(function(p){
        var parts = p.split('/');
        if(parts.length > 1 && parts[0] && parts[0].toLowerCase() !== 'king' && !seenF[parts[0]]){
          seenF[parts[0]] = true; folders.push(parts[0]);
        }
      });
      nameMap = ASSET_NAMES.assignNames(folders);
    }

    relPaths.forEach(function(p){
      if(!p) return;
      var parts = p.split('/');
      if(parts.length === 1){
        // 顶层文件
        if(IMG_RE.test(parts[0])) pool.push('assets/images/' + encodeURI(parts[0]));
        else if(VID_RE.test(parts[0])){
          var meta = VIDEO_META[videoCount++] || { name: '惊鸿', personality: 'mei' };
          rare.push({ folder: '__video__' + parts[0].replace(/\.[^.]+$/, ''), name: meta.name, personality: meta.personality, poses: [], video: 'assets/images/' + encodeURI(parts[0]) });
        }
        return;
      }
      var folder = parts[0];
      if(folder.toLowerCase() === 'king'){
        if(IMG_RE.test(parts[parts.length - 1])) emperor.push('assets/images/' + encodeURI(p));
        return;
      }
      // 子文件夹 = 一位妃嫔（绝色），多图 = 多姿态
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
    rare = rare.filter(function(r){ return r.poses.length || r.video; });
    return { emperor: emperor, rare: rare, pool: pool };
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
        if(UI){
          UI.toast('立绘素材已刷新 · 帝王 ' + res.emperor + ' · 绝色 ' + res.rare + ' · 普通池 ' + res.pool);
          if(UI.onStateChanged) UI.onStateChanged();
        }
      }).catch(function(err){
        if(UI) UI.toast('刷新异常：' + (err && err.message || err));
      });
      return;
    }

    // 浏览器兜底：让用户选 assets/images 文件夹
    pickFolder(function(m, status){
      if(status === 'cancel') return; // 用户取消选择，静默不提示
      if(!m){
        // 选了文件夹但里面没有可用的图片结构
        if(UI) UI.toast('所选文件夹内未找到可用图片，请选择 assets/images 文件夹');
        return;
      }
      if(applyManifest(m)){
        if(UI){
          UI.toast('立绘素材已刷新（浏览器） · 绝色 ' + m.rare.length + ' · 普通池 ' + m.pool.length);
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

  /* cb(manifest, status)  status: 'ok' | 'cancel' | 'empty' */
  function pickFolder(cb){
    var input = ensureInput();
    var onPick = function(){
      input.removeEventListener('change', onPick); // 一次性，避免重复触发
      var files = input.files;
      var had = files && files.length;
      input.value = ''; // 重置，便于下次重新触发 change
      if(!had){ cb(null, 'cancel'); return; }
      var m = buildFromFiles(files);
      if(m && (m.rare.length || m.pool.length || m.emperor.length)) cb(m, 'ok');
      else cb(null, 'empty'); // 选了文件夹但里面没有 images 结构
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
    isDesktop: isDesktop
  };
})();
