/* ============================================================
   ui/gate.js · 进殿口令门（仅网页版；桌面版自动跳过）
   - 全屏遮挡层：输入口令前游戏不渲染、不可交互
   - 口令正确后「记住 30 天」（localStorage），期间免输
   - 说明：静态站点没有真正的服务端鉴权，此门用于防窥/防误入，
     挡得住好奇，挡不住有心人（源码本身可被下载）
   ============================================================ */
(function(){
  var G = window.QZD_GATE || {};
  var HASH = String(G.HASH || '');
  var SALT = String(G.SALT || 'qzd');
  var DAYS = 30;
  var UNTIL_KEY = 'qzd_gate_until';

  function isDesktop(){
    return !!(window.QZDNative && window.QZDNative.isDesktop);
  }

  /* ---------- 纯 JS SHA-256（局域网 http 环境没有 crypto.subtle，自带实现最稳） ---------- */
  function sha256(ascii){
    function rightRotate(value, amount){ return (value >>> amount) | (value << (32 - amount)); }
    var mathPow = Math.pow, maxWord = mathPow(2, 32), result = '';
    var words = [], asciiBitLength = ascii.length * 8;
    var hash = sha256.h = sha256.h || [];
    var k = sha256.k = sha256.k || [];
    var primeCounter = k.length, isComposite = {};
    for(var candidate = 2; primeCounter < 64; candidate++){
      if(!isComposite[candidate]){
        for(var i = 0; i < 313; i += candidate) isComposite[i] = candidate;
        hash[primeCounter] = (mathPow(candidate, .5) * maxWord) | 0;
        k[primeCounter++] = (mathPow(candidate, 1 / 3) * maxWord) | 0;
      }
    }
    ascii += '\x80';
    while(ascii.length % 64 - 56) ascii += '\x00';
    for(i = 0; i < ascii.length; i++){
      var j = ascii.charCodeAt(i);
      if(j >> 8) return '';
      words[i >> 2] |= j << ((3 - i) % 4) * 8;
    }
    words[words.length] = (asciiBitLength / maxWord) | 0;
    words[words.length] = asciiBitLength;
    for(j = 0; j < words.length;){
      var w = words.slice(j, j += 16), oldHash = hash;
      hash = hash.slice(0, 8);
      for(i = 0; i < 64; i++){
        var w15 = w[i - 15], w2 = w[i - 2];
        var a = hash[0], e = hash[4];
        var temp1 = hash[7]
          + (rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25))
          + ((e & hash[5]) ^ ((~e) & hash[6]))
          + k[i]
          + (w[i] = (i < 16) ? w[i] : (w[i - 16]
              + (rightRotate(w15, 7) ^ rightRotate(w15, 18) ^ (w15 >>> 3))
              + w[i - 7]
              + (rightRotate(w2, 17) ^ rightRotate(w2, 19) ^ (w2 >>> 10))) | 0);
        var temp2 = (rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22))
          + ((a & hash[1]) ^ (a & hash[2]) ^ (hash[1] & hash[2]));
        hash = [(temp1 + temp2) | 0].concat(hash);
        hash[4] = (hash[4] + temp1) | 0;
      }
      for(i = 0; i < 8; i++) hash[i] = (hash[i] + oldHash[i]) | 0;
    }
    for(i = 0; i < 8; i++){
      for(j = 3; j + 1; j--){
        var b = (hash[i] >> (j * 8)) & 255;
        result += ((b < 16) ? 0 : '') + b.toString(16);
      }
    }
    return result;
  }

  function check(pin){ return !!HASH && sha256(SALT + ':' + String(pin)) === HASH; }

  function untilOk(){
    try { return Number(localStorage.getItem(UNTIL_KEY) || 0) > Date.now(); }
    catch(e){ return false; }
  }
  function remember(){
    try { localStorage.setItem(UNTIL_KEY, String(Date.now() + DAYS * 86400000)); } catch(e){}
  }

  function showGate(){
    var wrap = document.createElement('div');
    wrap.id = 'qzd-gate';
    wrap.style.cssText = 'position:fixed;left:0;right:0;top:0;bottom:0;z-index:99999;' +
      'display:flex;align-items:center;justify-content:center;background:var(--soft,#f5f1e6)';
    wrap.innerHTML =
      '<div style="width:280px;text-align:center">' +
        '<div style="font-size:22px;font-weight:700;letter-spacing:6px;color:var(--ink,#333)">勤 政 殿</div>' +
        '<div style="font-size:12px;color:var(--ink2,#8a8578);margin:6px 0 18px">请输入进殿口令</div>' +
        '<input id="qzd-gate-input" type="password" inputmode="numeric" maxlength="12" autocomplete="off" ' +
          'style="width:100%;box-sizing:border-box;height:46px;text-align:center;font-size:20px;letter-spacing:8px;' +
          'border:1px solid var(--line,#d8d3c4);border-radius:10px;outline:none;background:var(--card,#fff);color:var(--ink,#333)">' +
        '<div id="qzd-gate-err" style="height:18px;font-size:12px;color:var(--zhuqian,#b03a2e);margin-top:8px"></div>' +
        '<button id="qzd-gate-btn" style="width:100%;height:42px;border:0;border-radius:999px;' +
          'background:var(--daiqing,#3e6b5c);color:var(--card,#fff);font-size:14px;cursor:pointer">进 殿</button>' +
      '</div>';
    document.body.appendChild(wrap);
    try { document.body.style.overflow = 'hidden'; } catch(e){}

    function tryPass(){
      var input = wrap.querySelector('#qzd-gate-input');
      var err = wrap.querySelector('#qzd-gate-err');
      var v = input ? input.value : '';
      if(check(v)){
        remember();
        if(wrap.parentNode) wrap.parentNode.removeChild(wrap);
        try { document.body.style.overflow = ''; } catch(e){}
      }else{
        if(err) err.textContent = '口令不对，再想想';
        if(input){ input.value = ''; input.focus(); }
      }
    }
    wrap.querySelector('#qzd-gate-btn').addEventListener('click', tryPass);
    wrap.querySelector('#qzd-gate-input').addEventListener('keydown', function(e){
      if(e.key === 'Enter') tryPass();
    });
    setTimeout(function(){
      var input = wrap.querySelector('#qzd-gate-input');
      if(input) input.focus();
    }, 60);
  }

  /* 桌面版不拦；未配置口令不拦；30 天内已验证过不拦 */
  if(isDesktop()) return;
  if(!HASH) return;
  if(untilOk()) return;
  showGate();

  window.QZD = window.QZD || {};
  window.QZD.gate = { sha256: sha256, check: check };
})();
