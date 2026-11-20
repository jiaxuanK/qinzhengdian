/* ============================================================
   ui/breath.js · 歇一歇（节拍呼吸放松层）
   ------------------------------------------------------------
   节奏：吸 4s → 屏息 2s → 呼 6s，一个周期 12 秒。
   零常驻开销：只有打开休息层才起 1 秒定时器，关闭即清。
   不碰专注计时、不记收益、不写存档 —— 纯粹放松。
   ============================================================ */
(function(){
  var UI = QZD.ui = QZD.ui || {};
  var PHASES = [
    { key:'inhale', name:'吸 气', dur:4 },
    { key:'hold',   name:'屏 息', dur:2 },
    { key:'exhale', name:'呼 气', dur:6 }
  ];
  var CYCLE = 12;
  var timer = null, startAt = 0, minutes = 3, lastWord = '', lastCount = '';

  function overlay(){ return document.getElementById('rest-overlay'); }

  function ensure(){
    var o = overlay();
    if(o) return o;
    o = document.createElement('div');
    o.id = 'rest-overlay';
    o.className = 'rest-overlay';
    o.style.display = 'none';
    o.innerHTML =
      '<div class="rest-inner">' +
        '<div class="rest-head"><b>歇 一 歇</b>' +
          '<button type="button" class="rest-x" data-rest-close title="关闭（Esc）">×</button></div>' +
        '<div class="rest-stage">' +
          '<div class="rest-ring" id="rest-ring">' +
            '<div class="rest-core"></div>' +
            '<div class="rest-word" id="rest-word">跟着圈，慢慢来</div>' +
          '</div>' +
        '</div>' +
        '<div class="rest-beats"><span>吸 4 秒</span><i></i><span>停 2 秒</span><i></i><span>呼 6 秒</span></div>' +
        '<div class="rest-mins">' +
          '<button type="button" class="rest-min" data-rest-min="1">1 分钟</button>' +
          '<button type="button" class="rest-min active" data-rest-min="3">3 分钟</button>' +
          '<button type="button" class="rest-min" data-rest-min="5">5 分钟</button>' +
          '<button type="button" class="rest-min" data-rest-min="0">不限时</button>' +
        '</div>' +
        '<div class="rest-foot"><span id="rest-count">3:00</span> · 不记收益，只管放松 · Esc 退出</div>' +
      '</div>';
    document.body.appendChild(o);
    o.addEventListener('click', function(e){
      if(e.target.closest('[data-rest-close]')){ close(); return; }
      var m = e.target.closest('[data-rest-min]');
      if(m){
        minutes = parseInt(m.getAttribute('data-rest-min'), 10) || 0;
        var all = o.querySelectorAll('.rest-min');
        for(var i=0; i<all.length; i++) all[i].classList.remove('active');
        m.classList.add('active');
        startAt = Date.now();
        lastWord = ''; lastCount = '';
        tick();
        return;
      }
      /* 点空白圈面也可切换下一阶段提示（不打断节奏，仅即时反馈） */
    });
    return o;
  }

  function fmt(sec){
    var m = Math.floor(sec / 60), s = sec % 60;
    return m + ':' + (s < 10 ? '0' + s : s);
  }

  function phaseAt(sec){
    var p = sec % CYCLE, acc = 0;
    for(var i=0; i<PHASES.length; i++){
      acc += PHASES[i].dur;
      if(p < acc) return { phase: PHASES[i], left: Math.ceil(acc - p) };
    }
    return { phase: PHASES[PHASES.length-1], left: 1 };
  }

  function setText(sel, txt){
    var el = document.querySelector(sel);
    if(el && el.textContent !== txt) el.textContent = txt;
  }

  function tick(){
    var o = overlay();
    if(!o || o.style.display === 'none'){ close(); return; }
    var elapsed = (Date.now() - startAt) / 1000;
    if(minutes > 0 && elapsed >= minutes * 60){ close(true); return; }
    var st = phaseAt(elapsed);
    var word = st.phase.name + ' · ' + st.left;
    if(word !== lastWord){ setText('#rest-word', word); lastWord = word; }
    var cnt = minutes > 0 ? fmt(Math.max(0, minutes*60 - Math.floor(elapsed))) : fmt(Math.floor(elapsed));
    if(cnt !== lastCount){ setText('#rest-count', cnt); lastCount = cnt; }
  }

  function open(){
    var o = ensure();
    startAt = Date.now();
    lastWord = ''; lastCount = '';
    o.style.display = 'flex';
    /* 重置呼吸动画，让每次进入都从「吸气」起步 */
    var ring = document.getElementById('rest-ring');
    if(ring){ ring.style.animation = 'none'; void ring.offsetWidth; ring.style.animation = ''; }
    tick();
    if(timer) clearInterval(timer);
    timer = setInterval(tick, 1000);
  }

  function close(done){
    var o = overlay();
    if(o) o.style.display = 'none';
    if(timer){ clearInterval(timer); timer = null; }
    if(done && UI.toast) UI.toast('歇好了 · 回来继续');
  }

  document.addEventListener('click', function(e){
    if(e.target.closest('[data-rest-open]')){ open(); return; }
    if(e.target.closest('[data-rest-close]')){ close(); }
  });
  document.addEventListener('keydown', function(e){
    if(e.key === 'Escape' && overlay() && overlay().style.display !== 'none') close();
  });

  UI.rest = {
    open: open, close: close,
    phases: function(){ return PHASES.slice(); },
    cycle: CYCLE,
    isOpen: function(){ var o = overlay(); return !!o && o.style.display !== 'none'; }
  };
})();
