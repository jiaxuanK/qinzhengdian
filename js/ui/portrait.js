/* ============================================================
   ui/portrait.js · 角色立绘
   男 / 皇子：确定性程序化 SVG（肤色 / 发色 / 袍色 / 冠式 / 髯式散列）
   妃嫔：静态图优先（consort.img），其次 Live2D 容器（consort.model），否则占位图
   呼吸动画在 CSS（.portrait-breathe），眨眼用 SMIL（仅 SVG）
   ============================================================ */
(function(){
  var UI = QZD.ui = QZD.ui || {};

  var SKIN = ['var(--skin-1)', 'var(--skin-2)', 'var(--skin-3)'];
  var HAIR = ['var(--hair-1)', 'var(--hair-2)', 'var(--hair-3)'];
  var ROBE = ['var(--daiqing)', 'var(--dailan)', 'var(--xuanzi)', 'var(--teng)', 'var(--zhuqian)'];

  function hash(str){
    var h = 2166136261;
    str = String(str == null ? '' : str);
    for(var i = 0; i < str.length; i++){
      h ^= str.charCodeAt(i);
      h = Math.imul ? Math.imul(h, 16777619) : (h * 16777619);
    }
    return h >>> 0;
  }

  function esc(str){
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function hatSvg(hat){
    if(hat === 0){
      /* 乌纱帽：圆顶 + 展脚 */
      return '<path d="M40 26 Q40 16 60 16 Q80 16 80 26 L80 33 L40 33 Z" fill="var(--ink)"/>' +
        '<rect x="33" y="31" width="54" height="5" rx="2.5" fill="var(--ink)"/>' +
        '<rect x="21" y="31" width="12" height="4" rx="2" fill="var(--ink)"/>' +
        '<rect x="87" y="31" width="12" height="4" rx="2" fill="var(--ink)"/>';
    }
    if(hat === 1){
      /* 幞头：圆顶 + 系带 */
      return '<path d="M38 35 Q38 17 60 17 Q82 17 82 35 Z" fill="var(--ink)"/>' +
        '<rect x="38" y="31" width="44" height="5" rx="2.5" fill="var(--ink)" opacity=".85"/>' +
        '<path d="M76 34 Q86 40 83 49" stroke="var(--ink)" stroke-width="3" fill="none" stroke-linecap="round"/>';
    }
    /* 纶巾：布冠 + 垂带 */
    return '<path d="M38 36 Q38 20 60 19 Q82 20 82 36 Z" fill="var(--dailan)"/>' +
      '<rect x="37" y="32" width="46" height="6" rx="3" fill="var(--dailan)" opacity=".78"/>' +
      '<path d="M77 36 Q87 42 83 51" stroke="var(--dailan)" stroke-width="3" fill="none" stroke-linecap="round"/>';
  }

  function beardSvg(beard, hair){
    if(beard === 1){
      /* 短须 */
      return '<path d="M50 83 Q60 94 70 83 Q60 88 50 83 Z" fill="' + hair + '"/>';
    }
    if(beard === 2){
      /* 长髯 */
      return '<path d="M52 83 Q45 99 55 108 Q60 111 65 108 Q75 99 68 83 Q60 90 52 83 Z" fill="' + hair + '" opacity=".92"/>';
    }
    return '';
  }

  /* ---------- 妃嫔立绘：静态图优先，Live2D 次之，占位兜底 ----------
     优先级：opts.img（AI 生图 / 用户上传的静态图）> opts.model（Live2D 模型）> 占位。
     - 静态图：<img class="portrait-img">，加载失败回退占位（onerror 调 imgError）。
     - Live2D：仅当 opts.model 存在时渲染容器，挂载后由名册页 mount 钩子调用 QZD.live2d.mount。
     - 占位：提示"暂无立绘"，并指引放置路径。 */
  function femaleImage(img, alt){
    /* loading=lazy 视口外不加载；decoding=async 避免图片解码阻塞主线程（手机端防卡） */
    return '<img class="portrait-img" src="' + esc(img) + '" alt="' + esc(alt || '') +
      '" loading="lazy" decoding="async" onerror="QZD.portrait.imgError(this)">';
  }

  function l2dContainer(model, alt){
    return '<div class="portrait-l2d" data-l2d="' + esc(model) + '" ' +
      'data-label="' + esc(alt || '') + '" role="img" aria-label="' + esc(alt || '') + '"></div>';
  }

  /* 无图 / 无模型时的程序化妃嫔立绘：按 id 散列生成「各不相同的脸」，
     让用户在没放真实立绘前也能一眼分辨谁好看（发型 / 服饰 / 花钿 / 表情均随机）。
     一旦配置了 consort.img 或 consort.model，则优先用真实立绘覆盖本图。 */
  function femaleProcedural(id, alt){
    var h = hash(id);
    var skin = SKIN[h % 3];
    var hairPalette = ['var(--ink)', '#2b2b35', '#3a2f2a', '#4a3b3b', '#1f2430', '#54402f'];
    var hair = hairPalette[Math.floor(h / 3) % hairPalette.length];
    var dressPalette = ['var(--zhuqian)', 'var(--dailan)', 'var(--xuanzi)', 'var(--teng)',
      '#c98aa6', '#e0b15a', '#7fa8a0', '#9a7fc2'];
    var dress = dressPalette[Math.floor(h / 9) % dressPalette.length];
    var dress2 = dressPalette[Math.floor(h / 27) % dressPalette.length];
    var ornColor = ['var(--zhuqian)', '#e8c45a', '#d56f9a', '#7aa6c2'][Math.floor(h / 81) % 4];
    var huaColor = ['var(--zhuqian)', '#e8c45a', '#7aa6c2', '#d56f9a'][Math.floor(h / 243) % 4];
    var style = Math.floor(h / 729) % 4;          /* 0 直发 1 双环 2 高髻 3 垂鬟步摇 */
    var faceRX = 19 + (h % 3) * 1.8;              /* 脸型微调 */
    var smile = Math.floor(h / 2187) % 3;         /* 0 浅笑 1 微笑 2 明艳 */
    var blushOp = 0.12 + (Math.floor(h / 6561) % 3) * 0.07;
    var eyeRX = 2.8 + (Math.floor(h / 19683) % 2) * 0.8;
    var dur = (4.4 + (Math.floor(h / 59049) % 5) * 0.4).toFixed(1) + 's';

    /* 发型（脑后发量，所有款式共用的底层） */
    var hairBack = '<path d="M28 56 Q24 28 60 24 Q96 28 92 56 Q96 102 86 122 L78 122 ' +
      'Q84 92 80 60 Q80 44 60 42 Q40 44 40 60 Q36 92 42 122 L34 122 Q24 102 28 56 Z" fill="' + hair + '"/>';

    /* 前发 / 发饰（按款式变化） */
    var hairFront, ornament;
    if(style === 1){
      /* 双环望仙髻：两团圆发 + 鬓发 */
      hairFront = '<circle cx="46" cy="22" r="11" fill="' + hair + '"/>' +
        '<circle cx="74" cy="22" r="11" fill="' + hair + '"/>' +
        '<path d="M40 40 Q38 32 50 32 Q52 40 50 46 Z" fill="' + hair + '"/>' +
        '<path d="M80 40 Q82 32 70 32 Q68 40 70 46 Z" fill="' + hair + '"/>';
      ornament = '<circle cx="46" cy="20" r="3" fill="' + ornColor + '"/>' +
        '<circle cx="74" cy="20" r="3" fill="' + ornColor + '"/>';
    }else if(style === 2){
      /* 高髻：顶部圆髻 + 垂鬟 */
      hairFront = '<path d="M52 24 Q60 8 68 24 Q66 18 60 18 Q54 18 52 24 Z" fill="' + hair + '"/>' +
        '<ellipse cx="60" cy="16" rx="9" ry="8" fill="' + hair + '"/>' +
        '<path d="M44 38 Q42 30 52 30 L52 44 Z" fill="' + hair + '"/>' +
        '<path d="M76 38 Q78 30 68 30 L68 44 Z" fill="' + hair + '"/>';
      ornament = '<circle cx="60" cy="11" r="3.4" fill="' + ornColor + '"/>' +
        '<path d="M57 11 L63 11 M60 8 L60 14" stroke="var(--card)" stroke-width="1"/>';
    }else if(style === 3){
      /* 垂鬟 + 步摇：侧分长发 + 步摇垂坠 */
      hairFront = '<path d="M40 44 Q34 30 60 26 Q86 30 80 44 Q72 34 60 34 Q48 34 40 44 Z" fill="' + hair + '"/>' +
        '<path d="M80 44 Q90 60 84 90" stroke="' + hair + '" stroke-width="6" fill="none" stroke-linecap="round"/>';
      ornament = '<g transform="translate(82,46)">' +
        '<circle cx="0" cy="0" r="4" fill="' + ornColor + '"/>' +
        '<circle cx="-3" cy="2" r="1.6" fill="' + ornColor + '" opacity=".8"/>' +
        '<circle cx="3" cy="2" r="1.6" fill="' + ornColor + '" opacity=".8"/>' +
        '<path d="M0 4 L0 14" stroke="' + ornColor + '" stroke-width="1" opacity=".7"/>' +
        '<circle cx="0" cy="15" r="1.6" fill="' + ornColor + '"/></g>';
    }else{
      /* 直发中分：两缕鬓发 + 中分刘海 */
      hairFront = '<path d="M40 46 Q34 30 60 28 Q86 30 80 46 Q72 36 60 36 Q48 36 40 46 Z" fill="' + hair + '"/>' +
        '<path d="M40 46 Q34 70 38 96" stroke="' + hair + '" stroke-width="5" fill="none" stroke-linecap="round"/>' +
        '<path d="M80 46 Q86 70 82 96" stroke="' + hair + '" stroke-width="5" fill="none" stroke-linecap="round"/>';
      ornament = '<circle cx="40" cy="44" r="2.6" fill="' + ornColor + '"/>' +
        '<circle cx="80" cy="44" r="2.6" fill="' + ornColor + '"/>';
    }

    /* 襦裙：上衣交领 + 长裙 + 腰封 */
    var dress = '<path d="M34 140 L44 98 L76 98 L86 140 Z" fill="' + dress2 + '"/>' +
      '<path d="M44 82 L60 100 L76 82 L80 100 L60 110 L40 100 Z" fill="' + dress + '"/>' +
      '<path d="M60 100 L60 110" stroke="var(--card)" stroke-width="1.4"/>' +
      '<rect x="42" y="97" width="36" height="6" rx="3" fill="' + dress + '" opacity=".85"/>';

    /* 面孔与五官 */
    var face = '<rect x="53" y="78" width="14" height="14" rx="5" fill="' + skin + '"/>' +
      '<ellipse cx="60" cy="62" rx="' + faceRX + '" ry="25" fill="' + skin + '" stroke="var(--line)" stroke-width="1"/>' +
      '<ellipse cx="49" cy="70" rx="5" ry="2.6" fill="var(--zhuqian)" opacity="' + blushOp + '"/>' +
      '<ellipse cx="71" cy="70" rx="5" ry="2.6" fill="var(--zhuqian)" opacity="' + blushOp + '"/>' +
      /* 眼（带眨眼） */
      '<ellipse cx="49" cy="61" rx="' + eyeRX + '" ry="2.8" fill="var(--ink)">' +
        '<animate attributeName="ry" values="2.8;2.8;0.7;2.8;2.8" keyTimes="0;0.88;0.9;0.92;1" dur="' + dur + '" repeatCount="indefinite"/></ellipse>' +
      '<ellipse cx="71" cy="61" rx="' + eyeRX + '" ry="2.8" fill="var(--ink)">' +
        '<animate attributeName="ry" values="2.8;2.8;0.7;2.8;2.8" keyTimes="0;0.88;0.9;0.92;1" dur="' + dur + '" begin="0.3s" repeatCount="indefinite"/></ellipse>' +
      '<path d="M44 57 Q49 53 54 56" stroke="' + hair + '" stroke-width="1.6" fill="none" stroke-linecap="round"/>' +
      '<path d="M66 56 Q71 53 76 57" stroke="' + hair + '" stroke-width="1.6" fill="none" stroke-linecap="round"/>' +
      /* 鼻 */
      '<path d="M60 63 L58 68 Q60 70 62 68" stroke="var(--ink2)" stroke-width="1" fill="none" stroke-linecap="round"/>' +
      /* 唇（笑意随 smile 加深） */
      '<path d="M53 77 Q60 ' + (78 + smile * 2) + ' 67 77" stroke="var(--zhuqian)" stroke-width="1.8" fill="none" stroke-linecap="round"/>' +
      /* 花钿 */
      '<path d="M60 49 l2 3 l-2 3 l-2 -3 Z" fill="' + huaColor + '"/>';

    return '<svg viewBox="0 0 120 140" class="portrait-svg portrait-fem" role="img" ' +
      'aria-label="' + esc(alt || '') + '" title="程序生成立绘（可在 assets/images/ 放入真实立绘覆盖）">' +
      '<rect width="120" height="140" fill="var(--paper)"/>' +
      '<circle cx="60" cy="60" r="46" fill="var(--soft)" opacity=".75"/>' +
      hairBack + dress + face + hairFront + ornament +
    '</svg>';
  }

  /* 静态图加载失败时的回退：改用按名称生成的程序化立绘 */
  function imgError(el){
    var wrap = el && el.parentNode;
    if(wrap) wrap.innerHTML = femaleProcedural(el.getAttribute('alt') || '', el.getAttribute('alt') || '妃');
  }

  function svg(id, alt, opts){
    opts = opts || {};
    var kind = opts.kind || 'male';        /* male | female | prince */
    if(kind === 'female'){
      if(opts.img) return femaleImage(opts.img, alt);
      if(opts.model) return l2dContainer(opts.model, alt);
      return femaleProcedural(id, alt);   /* 无真实立绘时按 id 生成各不相同的脸 */
    }
    var hs = hash(id);
    var skin = SKIN[hs % 3];
    var hair = HAIR[Math.floor(hs / 3) % 3];
    var robe = ROBE[Math.floor(hs / 9) % 5];
    var hat = Math.floor(hs / 45) % 3;
    var beard = Math.floor(hs / 135) % 3;
    var wide = Math.floor(hs / 405) % 2;
    var dur = (4.8 + (Math.floor(hs / 1215) % 5) * 0.4).toFixed(1) + 's';
    var rx = wide ? '5' : '4.2';

    var hairLayer, hatLayer, beardLayer, extraLayer;
    if(kind === 'prince'){
      hairLayer = '<path d="M36 58 Q34 34 60 30 Q86 34 84 58 Q78 44 60 42 Q42 44 36 58 Z" fill="' + hair + '"/>' +
        '<circle cx="60" cy="26" r="7" fill="' + hair + '"/>';
      hatLayer = '<rect x="53" y="20" width="14" height="5" rx="2.5" fill="var(--daiqing)"/>';
      beardLayer = '';
      extraLayer = '';
    }else{
      hairLayer = '<path d="M36 58 Q34 34 60 30 Q86 34 84 58 Q78 44 60 42 Q42 44 36 58 Z" fill="' + hair + '"/>' +
        '<path d="M36 58 L37 69" stroke="' + hair + '" stroke-width="4" stroke-linecap="round"/>' +
        '<path d="M84 58 L83 69" stroke="' + hair + '" stroke-width="4" stroke-linecap="round"/>';
      hatLayer = hatSvg(hat);
      beardLayer = beardSvg(beard, hair);
      extraLayer = '';
    }

    return '<svg viewBox="0 0 120 140" class="portrait-svg" role="img" aria-label="' + esc(alt || '') + '">' +
      '<rect width="120" height="140" fill="var(--paper)"/>' +
      '<circle cx="60" cy="62" r="46" fill="var(--soft)" opacity=".75"/>' +
      '<path d="M16 140 Q20 112 46 102 L60 119 L74 102 Q100 112 104 140 Z" fill="' + robe + '"/>' +
      '<path d="M30 140 Q34 119 50 108" stroke="var(--card)" stroke-width="2" fill="none" opacity=".16"/>' +
      '<path d="M90 140 Q86 119 70 108" stroke="var(--card)" stroke-width="2" fill="none" opacity=".16"/>' +
      '<rect x="20" y="128" width="80" height="5" rx="2.5" fill="var(--teng)" opacity=".75"/>' +
      '<path d="M46 102 L60 119 L74 102 L68 97 L60 109 L52 97 Z" fill="var(--card)" opacity=".85"/>' +
      '<path d="M52 82 L52 101 Q60 107 68 101 L68 82 Z" fill="' + skin + '"/>' +
      '<ellipse cx="36" cy="62" rx="4" ry="7" fill="' + skin + '"/>' +
      '<ellipse cx="84" cy="62" rx="4" ry="7" fill="' + skin + '"/>' +
      '<ellipse cx="60" cy="60" rx="23" ry="27" fill="' + skin + '" stroke="var(--line)" stroke-width="1"/>' +
      hairLayer +
      hatLayer +
      '<path d="M45 53 Q51 49 56 52" stroke="' + hair + '" stroke-width="2" fill="none" stroke-linecap="round"/>' +
      '<path d="M75 53 Q69 49 64 52" stroke="' + hair + '" stroke-width="2" fill="none" stroke-linecap="round"/>' +
      '<ellipse cx="49" cy="61" rx="' + rx + '" ry="2.8" fill="var(--ink)">' +
        '<animate attributeName="ry" values="2.8;2.8;0.8;2.8;2.8" keyTimes="0;0.88;0.9;0.92;1" dur="' + dur + '" repeatCount="indefinite"/>' +
      '</ellipse>' +
      '<ellipse cx="71" cy="61" rx="' + rx + '" ry="2.8" fill="var(--ink)">' +
        '<animate attributeName="ry" values="2.8;2.8;0.8;2.8;2.8" keyTimes="0;0.88;0.9;0.92;1" dur="' + dur + '" begin="0.35s" repeatCount="indefinite"/>' +
      '</ellipse>' +
      '<path d="M60 60 Q57 70 61 71" stroke="var(--ink2)" stroke-width="1.2" fill="none" stroke-linecap="round"/>' +
      '<path d="M53 79 Q60 82 67 79" stroke="var(--zhuqian)" stroke-width="1.6" fill="none" stroke-linecap="round"/>' +
      beardLayer +
      '<ellipse cx="43" cy="69" rx="5" ry="2.6" fill="var(--zhuqian)" opacity=".18"/>' +
      '<ellipse cx="77" cy="69" rx="5" ry="2.6" fill="var(--zhuqian)" opacity=".18"/>' +
      extraLayer +
    '</svg>';
  }

  /* 视频立绘：静音自动循环，用于特殊妃子 */
  function video(src, alt){
    return '<video class="portrait-video" src="' + esc(src) + '" autoplay loop muted ' +
      'playsinline preload="metadata" aria-label="' + esc(alt || '') + '"></video>';
  }

  QZD.portrait = { svg: svg, imgError: imgError, video: video };
})();
