/* ============================================================
   ui/hotkeys.js · 全局快捷键
   空格 暂停/继续专注 · F2 专注悬浮窗 · N 记灵感 · ? 快捷键说明
   输入框 / 文本域 / 下拉框内一律不拦截，避免影响打字
   ============================================================ */
(function(){
  var UI = QZD.ui;

  function inField(el){
    if(!el || !el.tagName) return false;
    var t = el.tagName;
    return t === 'INPUT' || t === 'TEXTAREA' || t === 'SELECT' || !!el.isContentEditable;
  }

  function focusIdea(){
    UI.show('idea');
    /* 页面刚渲染完，下一帧再聚焦 */
    setTimeout(function(){
      var el = document.getElementById('idea-text');
      if(el) el.focus();
    }, 40);
  }

  function toggleFocus(){
    var P = QZD.pomodoro;
    if(!P || !P.isActive()){
      UI.toast('当前没有专注 · 到「今日勤政」选一份奏折开始');
      return;
    }
    var p = QZD.state.pomodoro;
    if(p.status === 'paused'){
      var r = P.resume();
      if(r && r.abandoned){
        UI.toast('暂歇超时，已按五成结算');
        UI.onStateChanged();
        return;
      }
      if(r && r.ok === false){ UI.toast(r.error || '继续失败'); return; }
      UI.toast('专注继续');
    }else{
      var r2 = P.pause();
      if(r2 && r2.ok === false){ UI.toast(r2.error || '暂停失败'); return; }
      UI.toast('已暂歇 · 按空格继续');
    }
    UI.onStateChanged();
  }

  function hkRow(k, d){
    return '<div class="hk-row"><kbd>' + k + '</kbd><span>' + d + '</span></div>';
  }

  function help(){
    UI.modal({
      title: '快捷键',
      body: '<div class="hk-list">' +
        hkRow('空格', '暂停 / 继续当前专注') +
        hkRow('F2', '开 / 关专注悬浮窗') +
        hkRow('N', '记一条灵感（自动聚焦输入框）') +
        hkRow('?', '打开本说明') +
        hkRow('Esc', '关闭弹窗 / 收起浮层') +
      '</div>',
      ok: false, cancelText: '知道了'
    });
  }

  document.addEventListener('keydown', function(e){
    if(inField(e.target)) return;
    if(e.ctrlKey || e.metaKey || e.altKey) return;

    if(e.code === 'Space' || e.key === ' '){
      e.preventDefault();
      toggleFocus();
      return;
    }
    if(e.key === 'F2'){
      e.preventDefault();
      if(UI.pomo && UI.pomo.toggleFloat) UI.pomo.toggleFloat();
      return;
    }
    if(e.key === 'n' || e.key === 'N'){
      e.preventDefault();
      focusIdea();
      return;
    }
    if(e.key === '?'){
      e.preventDefault();
      help();
      return;
    }
  });

  UI.hotkeys = { help: help };
})();
