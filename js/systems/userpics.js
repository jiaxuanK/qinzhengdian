/* ============================================================
   systems/userpics.js · 11-22 用户自带图包（隐私：图不随游戏发布）
   - 独立 IndexedDB 库 qzd-userpics，存图片 Blob（与 qzd-save 存档完全隔离）
   - 图按「妃子文件夹 / 姿态」组织，与 assets-manifest 的 rare/special 结构对齐
   - importFiles(FileList) 从「选文件夹」或「多选图片」导入，按 webkitRelativePath 分组
   - 图片导入/导出时本机压缩（长边1200、WebP优先、JPEG兜底），只采纳明显更小的结果
   - toManifest() 生成覆盖 QZD.ASSETS 的清单（src 为 blob: 本机链接）
   - exportPack() 导出备份（JSON 清单 + 图 base64 + MIME），换设备可再导入
   - 全部异步（IDB），blobUrl 缓存本次会话，revoke 避免内存泄漏
   ============================================================ */
(function(){
  var DB_NAME = 'qzd-userpics';
  var DB_VER = 1;
  var STORE = 'pics';       /* {key, group, name, blob, order} */
  var META = 'meta';        /* 可选：导入时间等 */
  var IMG_RE = /\.(jpe?g|png|webp|gif|bmp)$/i;
  var VID_RE = /\.(mp4|webm)$/i;
  /* 浏览器端图包压缩：游戏卡片不需要原图级分辨率，长边 1200 足够清晰。 */
  var MAX_IMG_EDGE = 1200;
  var IMG_QUALITY = 0.82;
  var MIN_COMPRESS_BYTES = 40 * 1024;
  var KEEP_RATIO = 0.95;
  var urlCache = {};
  /* 记住页面最初加载到的公开素材清单，供清档后「解除绑定但保留图包」还原。 */
  var baseAssets = null;
  try{ baseAssets = (window.QZD && QZD.ASSETS) ? JSON.parse(JSON.stringify(QZD.ASSETS)) : null; }catch(e){}

  function openDB(){
    return new Promise(function(resolve){
      if(!('indexedDB' in window)){ resolve(null); return; }
      var req = indexedDB.open(DB_NAME, DB_VER);
      req.onupgradeneeded = function(e){
        var db = e.target.result;
        if(!db.objectStoreNames.contains(STORE)){
          var os = db.createObjectStore(STORE, { keyPath:'key' });
          os.createIndex('group', 'group', { unique:false });
        }
      };
      req.onsuccess = function(e){ resolve(e.target.result); };
      req.onerror = function(){ resolve(null); };
    });
  }
  function tx(db, mode){
    return db.transaction(STORE, mode).objectStore(STORE);
  }
  function reqP(req){
    return new Promise(function(res, rej){
      req.onsuccess = function(){ res(req.result); };
      req.onerror = function(){ rej(req.error); };
    });
  }

  /* 取相对路径：找 images/ 之后的段；没有则用文件名 */
  function relOf(file){
    var rp = file.webkitRelativePath || '';
    var idx = rp.toLowerCase().indexOf('images/');
    if(idx >= 0) return rp.slice(idx + 'images/'.length);
    if(rp) return rp;
    return file.name || '';
  }

  /* 分组：特殊/<子>/NN.jpg 或 <妃子folder>/NN.jpg 或顶层散图 */
  function groupOf(rel){
    var parts = rel.split('/').filter(Boolean);
    if(parts.length >= 2){
      if(parts[0] === '特殊') return '特殊/' + parts[1];
      return parts[0];                       /* 妃子文件夹 */
    }
    return '__pool__';                        /* 顶层散图 → 普通池 */
  }

  /* 从 FileList 导入：图片先在本机压缩，再存 IDB（不读文本，省内存） */
  function importFiles(fileList){
    var files = Array.prototype.slice.call(fileList || []).filter(function(f){
      return IMG_RE.test(f.name || '') || VID_RE.test(f.name || '');
    });
    if(!files.length) return Promise.resolve({ ok:false, error:'没有可用的图片/视频', added:0 });
    var at = Date.now();
    return Promise.all(files.map(function(f, i){
      var rel = relOf(f);
      var group = groupOf(rel);
      var isImg = IMG_RE.test(f.name || '');
      return normalizeBlob(f, f.name, isImg).then(function(out){
        return {
          key: group + '|' + (f.name || '') + '|' + i + '|' + at,
          group: group,
          name: f.name || ('img'+i),
          isImg: isImg,
          blob: out.blob,
          type: out.type,
          order: i,
          at: at,
          compressed: !!out.compressed,
          saved: out.saved || 0
        };
      });
    })).then(function(rows){
      var compressedImages = rows.filter(function(r){ return r.compressed; }).length;
      var savedBytes = rows.reduce(function(n, r){ return n + (r.saved || 0); }, 0);
      return openDB().then(function(db){
        if(!db) return { ok:false, error:'浏览器不支持本地存储，无法导入图包', added:0 };
        var store = tx(db, 'readwrite');
        var tasks = rows.map(function(rec){ return reqP(store.put(rec)); });
        return Promise.all(tasks).then(function(){
          clearUrls();
          return {
            ok:true, added:rows.length, groups:uniqueGroups(rows),
            compressedImages:compressedImages, savedBytes:savedBytes
          };
        });
      });
    });
  }

  function uniqueGroups(items){
    var set = {};
    (items || []).forEach(function(x){
      var g = x.group || groupOf(relOf(x));
      set[g] = 1;
    });
    return Object.keys(set).filter(function(g){ return g !== '__pool__'; });
  }

  /* 列出全部记录（按 group / order 排） */
  function list(){
    return openDB().then(function(db){
      if(!db) return [];
      return reqP(tx(db, 'readonly').getAll()).then(function(rows){
        return (rows || []).sort(function(a, b){
          if(a.group !== b.group) return a.group.localeCompare(b.group);
          return (a.order || 0) - (b.order || 0);
        });
      });
    });
  }

  /* blob → 本次会话的 object URL（缓存复用） */
  function urlOf(rec){
    if(urlCache[rec.key]) return urlCache[rec.key];
    var u = URL.createObjectURL(rec.blob);
    urlCache[rec.key] = u;
    return u;
  }
  function clearUrls(){
    Object.keys(urlCache).forEach(function(k){ try{ URL.revokeObjectURL(urlCache[k]); }catch(e){} });
    urlCache = {};
  }

  /* 生成覆盖 QZD.ASSETS 的清单：与 assets-manifest 同构，src 换 blob。
     分档沿用现有门槛：6+ 绝色 rare / 4-5 稀有 uncommon / 1-3 普通池 pool。
     special 目录按 pose 数：6+ 打 special，不足降为普通绝色。 */
  function toManifest(){
    var RARE_MIN = 6, UNCOMMON_MIN = 4;
    return list().then(function(rows){
      var grouped = {};
      var pool = [];
      rows.forEach(function(r){
        var u = urlOf(r);
        if(r.group === '__pool__'){ pool.push(u); return; }
        (grouped[r.group] = grouped[r.group] || { folder:r.group, name:r.group, poses:[], vids:[] })
          [r.isImg ? 'poses' : 'vids'].push(u);
      });
      var rare = [], uncommon = [], special = [];
      Object.keys(grouped).forEach(function(k){
        var g = grouped[k], n = g.poses.length;
        var entry = { folder:k, name:k, poses:g.poses.slice(), video:g.vids[0] || null };
        if(k.indexOf('特殊/') === 0){
          entry.name = k.slice(3);
          entry.special = n >= RARE_MIN;
          special.push(entry);
        }else if(g.vids.length || n >= RARE_MIN){
          rare.push(entry);
        }else if(n >= UNCOMMON_MIN){
          uncommon.push(entry);
        }else{
          pool.push.apply(pool, g.poses);
        }
      });
      return {
        emperor: [], rare: rare, uncommon: uncommon, pool: pool, special: special
      };
    });
  }

  function count(){
    return list().then(function(rows){ return rows.length; });
  }

  function clear(){
    clearUrls();
    return openDB().then(function(db){
      if(!db) return { ok:false, error:'无法打开本地存储' };
      return reqP(tx(db, 'readwrite').clear()).then(function(){ return { ok:true }; });
    });
  }

  /* 给已经导入过的老图包补一次压缩：不改分组、不删图，只把 Blob 换成更小的版本。 */
  function recompress(){
    return list().then(function(rows){
      return Promise.all(rows.map(function(r){
        var known = r.type || (r.isImg ? guessType(r.name) : 'video/mp4');
        return normalizeBlob(r.blob, r.name, !!r.isImg, known).then(function(out){
          return { row:r, out:out };
        });
      }));
    }).then(function(jobs){
      var changed = 0, savedBytes = 0;
      return openDB().then(function(db){
        if(!db) return { ok:false, error:'无法打开本地存储' };
        var store = tx(db, 'readwrite');
        var tasks = jobs.filter(function(j){ return j.out.compressed; }).map(function(j){
          j.row.blob = j.out.blob;
          j.row.type = j.out.type;
          return reqP(store.put(j.row)).then(function(){
            changed++;
            savedBytes += j.out.saved || 0;
          });
        });
        return Promise.all(tasks).then(function(){
          clearUrls();
          return { ok:true, changed:changed, savedBytes:savedBytes };
        });
      });
    });
  }

  /* 导出备份：{v,at,pics:[{group,name,isImg,type,data(base64)}]} */
  function exportPack(){
    return list().then(function(rows){
      var tasks = rows.map(function(r){
        var known = r.type || (r.isImg ? guessType(r.name) : 'video/mp4');
        return normalizeBlob(r.blob, r.name, !!r.isImg, known).then(function(out){
          return blobToB64(out.blob).then(function(b64){
            return { group:r.group, name:r.name, isImg:r.isImg, type:out.type, order:r.order, data:b64 };
          });
        });
      });
      return Promise.all(tasks).then(function(pics){
        return { v:1, at:Date.now(), pics:pics };
      });
    });
  }
  function blobToB64(blob){
    return new Promise(function(res, rej){
      var fr = new FileReader();
      fr.onload = function(){
        var s = String(fr.result || '');
        var i = s.indexOf(',');
        res(i >= 0 ? s.slice(i+1) : s);
      };
      fr.onerror = function(){ rej(fr.error); };
      fr.readAsDataURL(blob);
    });
  }
  function b64ToBlob(b64, type){
    var bin = atob(b64), len = bin.length, arr = new Uint8Array(len);
    for(var i=0;i<len;i++) arr[i] = bin.charCodeAt(i);
    return new Blob([arr], { type: type || 'application/octet-stream' });
  }

  /* 从备份包（对象或 JSON 文本）恢复 */
  function importPack(pack){
    var obj = (typeof pack === 'string') ? JSON.parse(pack) : pack;
    if(!obj || !Array.isArray(obj.pics)) return Promise.resolve({ ok:false, error:'备份包格式不对' });
    return openDB().then(function(db){
      if(!db) return { ok:false, error:'浏览器不支持本地存储' };
      var store = tx(db, 'readwrite');
      var n = 0;
      var tasks = obj.pics.map(function(p, i){
        var type = p.type || (p.isImg ? guessType(p.name) : 'video/mp4');
        var blob = b64ToBlob(p.data, type);
        var rec = { key:'backup|'+p.group+'|'+(p.name||i)+'|'+Date.now(),
          group:p.group, name:p.name||('img'+i), isImg:!!p.isImg, blob:blob, type:type,
          order:p.order||i, at:Date.now() };
        return reqP(store.put(rec)).then(function(){ n++; });
      });
      return Promise.all(tasks).then(function(){ clearUrls(); return { ok:true, added:n }; });
    });
  }
  function guessType(name){
    if(/\.png$/i.test(name)) return 'image/png';
    if(/\.webp$/i.test(name)) return 'image/webp';
    if(/\.gif$/i.test(name)) return 'image/gif';
    return 'image/jpeg';
  }

  /* 图片导入/导出统一走这里：视频原样，图片尽力本机压缩 */
  function normalizeBlob(blob, name, isImg, knownType){
    var type = knownType || (blob && blob.type) || (isImg ? guessType(name) : 'video/mp4');
    if(!isImg) return Promise.resolve({ blob:blob, type:type, compressed:false, saved:0 });
    return compressImageBlob(blob, name, type);
  }

  function canCompressInBrowser(){
    var hasDecoder = typeof createImageBitmap === 'function' ||
      (typeof Image === 'function' && typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function');
    return hasDecoder && typeof document !== 'undefined' && !!document.createElement;
  }

  function loadBitmap(blob){
    if(typeof createImageBitmap === 'function') return createImageBitmap(blob);
    return new Promise(function(res, rej){
      var u = URL.createObjectURL(blob);
      var im = new Image();
      im.onload = function(){ try{ URL.revokeObjectURL(u); }catch(e){} res(im); };
      im.onerror = function(e){ try{ URL.revokeObjectURL(u); }catch(e){} rej(e || new Error('decode failed')); };
      im.src = u;
    });
  }

  function canvasToBlob(canvas, type){
    return new Promise(function(res){
      try{
        if(canvas.toBlob){
          canvas.toBlob(function(b){ res(b || null); }, type, IMG_QUALITY);
          return;
        }
      }catch(e){}
      try{
        var data = canvas.toDataURL(type, IMG_QUALITY);
        if(!data || data.indexOf('data:' + type) !== 0){ res(null); return; }
        var comma = data.indexOf(',');
        res(b64ToBlob(comma >= 0 ? data.slice(comma + 1) : data, type));
      }catch(e){ res(null); }
    });
  }

  function isWorth(candidate, originalSize){
    if(!candidate || typeof candidate.size !== 'number') return false;
    if(!originalSize) return true;
    return candidate.size < originalSize * KEEP_RATIO;
  }

  function tryCanvasTypes(canvas, originalType, name){
    return canvasToBlob(canvas, 'image/webp').then(function(webp){
      if(webp && webp.type === 'image/webp') return { blob:webp, type:'image/webp' };
      /* 不支持 WebP 编码时，只把原本就是 JPEG 的图降级为 JPEG；PNG 保持原样以免丢透明。 */
      if(originalType === 'image/jpeg' || /\.jpe?g$/i.test(name || '')){
        return canvasToBlob(canvas, 'image/jpeg').then(function(jpg){
          return jpg && jpg.type === 'image/jpeg' ? { blob:jpg, type:'image/jpeg' } : null;
        });
      }
      return null;
    });
  }

  /* 只采纳明显更小（至少省 5%）的结果；失败一律原样返回，绝不丢图。 */
  function compressImageBlob(blob, name, type){
    var original = {
      blob:blob, type:type || (blob && blob.type) || guessType(name),
      compressed:false, saved:0
    };
    if(!blob || /\.gif$/i.test(name || '') || original.type === 'image/gif') return Promise.resolve(original);
    if(blob.size && blob.size < MIN_COMPRESS_BYTES) return Promise.resolve(original);
    if(!canCompressInBrowser()) return Promise.resolve(original);

    return loadBitmap(blob).then(function(img){
      var w = img.width || img.naturalWidth;
      var h = img.height || img.naturalHeight;
      if(!w || !h) throw new Error('空图');
      var scale = Math.min(1, MAX_IMG_EDGE / Math.max(w, h));
      var nw = Math.max(1, Math.round(w * scale));
      var nh = Math.max(1, Math.round(h * scale));
      var canvas = document.createElement('canvas');
      canvas.width = nw;
      canvas.height = nh;
      var ctx = canvas.getContext && canvas.getContext('2d');
      if(!ctx || !ctx.drawImage) throw new Error('canvas 不可用');
      ctx.drawImage(img, 0, 0, nw, nh);
      if(img.close){ try{ img.close(); }catch(e){} }
      return tryCanvasTypes(canvas, original.type, name);
    }).then(function(out){
      if(out && isWorth(out.blob, blob.size)){
        return {
          blob:out.blob, type:out.type, compressed:true,
          saved:Math.max(0, blob.size - out.blob.size)
        };
      }
      return original;
    }).catch(function(){ return original; });
  }

  /* 只解除当前会话绑定，不删 IndexedDB 里的图。 */
  function unbindFromGame(){
    QZD.ASSETS = baseAssets
      ? JSON.parse(JSON.stringify(baseAssets))
      : { emperor:[], rare:[], uncommon:[], pool:[], special:[] };
    if(QZD.state && QZD.state.settings) QZD.state.settings.userpicsEnabled = false;
    clearUrls();
    return Promise.resolve({ ok:true });
  }

  /* 把本机图包应用到游戏：
     1) 生成清单覆盖 QZD.ASSETS（新选秀/新抽卡自动用本机图）
     2) 已存在妃子按 rareKey 重新绑定 poses/img（刷新旧妃子的图）
     返回统计供 UI 提示。 */
  function applyToGame(){
    return toManifest().then(function(m){
      window.QZD = window.QZD || {};
      QZD.ASSETS = m;
      if(QZD.state && QZD.state.settings) QZD.state.settings.userpicsEnabled = true;
      var rebound = 0;
      var consorts = (QZD.state && QZD.state.consorts) || [];
      function entryFor(c){
        var key = c.rareKey;
        if(!key) return null;
        if(c.tier === 'uncommon'){
          var u = (m.uncommon || []).filter(function(e){ return e.folder === key; })[0];
          if(u) return u;
        }
        var r = (m.rare || []).filter(function(e){ return e.folder === key; })[0];
        if(r) return r;
        var s = (m.special || []).filter(function(e){ return e.folder === key || e.name === key; })[0];
        return s || null;
      }
      consorts.forEach(function(c){
        var e = entryFor(c);
        if(!e || !e.poses || !e.poses.length) return;
        c.poses = e.poses.slice();
        c.img = e.poses[0];
        if(e.video) c.video = e.video;
        if(c.poseIndex >= c.poses.length) c.poseIndex = 0;
        rebound++;
      });
      /* 皇帝立绘：若有导入的 emperor 组则替换 */
      if(QZD.state && m.emperor && m.emperor.length) QZD.state.emperorPortrait = m.emperor[0];
      /* 不落盘 blob: 地址：它只在本次页面有效，state.js 保存时也会剥离。 */
      return { ok:true, rare:(m.rare||[]).length, special:(m.special||[]).length,
               pool:(m.pool||[]).length, rebound:rebound };
    });
  }

  QZD.userpics = {
    importFiles: importFiles, importPack: importPack, exportPack: exportPack,
    list: list, count: count, clear: clear, recompress: recompress, toManifest: toManifest,
    applyToGame: applyToGame, unbindFromGame: unbindFromGame,
    urlOf: urlOf, clearUrls: clearUrls, relOf: relOf, groupOf: groupOf,
    IMG_RE: IMG_RE, VID_RE: VID_RE,
    MAX_IMG_EDGE: MAX_IMG_EDGE, IMG_QUALITY: IMG_QUALITY,
    compressImageBlob: compressImageBlob
  };
})();
