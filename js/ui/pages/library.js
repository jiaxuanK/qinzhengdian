/* ============================================================
   ui/pages/library.js · 文渊阁
   - 文献统一由 Zotero 管理，本页不再重复录入，只做跳转
   - 今日精读：粘贴 Zotero 清单导入队列，每天抽一篇打勾
   ============================================================ */
(function(){
  var UI = QZD.ui;
  var ESC = function(t){ return UI.fmt.escape(t); };

  function zoteroCard(){
    return '<section class="card">' +
      '<div class="card-head"><span class="card-title">文 渊 阁</span>' +
        '<span class="card-note">文献统一由 Zotero 管理</span></div>' +
      '<p class="today-line">为避免重复录入，本阁不手写书目——文献一律在 <b>Zotero</b> 里管理，' +
        '这里只做一键跳转与「今日精读」打卡。</p>' +
      '<div class="btn-row">' +
        '<a class="btn primary" href="zotero://select/library">打开 Zotero 桌面端</a>' +
        '<a class="btn ghost" href="https://www.zotero.org/my/library" target="_blank" rel="noopener">Zotero 网页版 ↗</a>' +
        '<a class="btn ghost" href="https://www.zotero.org/download/" target="_blank" rel="noopener">下载 Zotero ↗</a>' +
      '</div>' +
    '</section>';
  }

  function readCard(){
    if(!QZD.reading) return '';
    var st = QZD.reading.stats();
    var pick = QZD.reading.todayPick();
    var q = QZD.reading.queued();

    var pickHtml;
    if(pick){
      var title = pick.url
        ? '<a href="' + ESC(pick.url) + '" target="_blank" rel="noopener">' + ESC(pick.title) + ' ↗</a>'
        : ESC(pick.title);
      pickHtml = '<div class="read-card">' +
        '<div class="read-title">' + title + '</div>' +
        '<div class="read-meta">今日精读 · 队列还剩 ' + q.length + ' 篇</div>' +
        '<div class="btn-row" style="margin-top:8px">' +
          '<button class="btn primary sm" data-read-done="' + pick.id + '">读完了</button>' +
          (q.length > 1 ? '<button class="btn ghost sm" data-read-next>换一篇</button>' : '') +
        '</div>' +
      '</div>';
    }else{
      pickHtml = '<div class="read-card">' +
        '<div class="read-title">队列是空的</div>' +
        '<div class="read-meta">把 Zotero 里想读的清单粘贴到下方导入</div>' +
      '</div>';
    }

    var rows = q.slice(0, 8).map(function(x){
      return '<div class="read-row">' +
        '<span class="read-name">' + ESC(x.title) + '</span>' +
        (x.id !== (pick && pick.id) ? '<button class="chip sm" data-read-pick="' + x.id + '">设为今日</button>' : '') +
        '<button class="chip sm danger" data-read-del="' + x.id + '">移除</button>' +
      '</div>';
    }).join('');

    return '<section class="card">' +
      '<div class="card-head"><span class="card-title">今 日 精 读</span>' +
        '<span class="card-note">队列 ' + st.queued + ' · 已读 ' + st.done + ' · 本周 ' + st.doneWeek + '</span></div>' +
      pickHtml +
      (rows ? '<div class="read-queue">' + rows + '</div>' : '') +
      '<div class="read-import">' +
        '<textarea id="read-import-text" placeholder="粘贴 Zotero 清单：每行「标题 + Tab + 链接」，或「标题 | 链接」；也可只贴标题"></textarea>' +
        '<div class="btn-row" style="margin-top:7px">' +
          '<button class="btn ghost sm" data-read-import>导入清单</button>' +
        '</div>' +
      '</div>' +
    '</section>';
  }

  UI.register('library', function(){
    return zoteroCard() + readCard();
  });

  /* 读完后顺手记一条灵感（可跳过） */
  function promptIdea(item){
    if(!QZD.idea || !item) return;
    UI.modal({
      title: '读完《' + item.title + '》',
      body: '<p class="card-note">顺手记一条灵感（可跳过），会进「灵感罐」。</p>' +
        '<div class="field"><textarea id="read-idea" rows="3" maxlength="200" ' +
          'placeholder="这篇最有用的点是什么？可以怎么用到我的课题上？"></textarea></div>',
      ok: true,
      okText: '记下',
      cancelText: '跳过',
      onOk: function(){
        var ta = document.getElementById('read-idea');
        var txt = ta ? String(ta.value || '').trim() : '';
        if(txt){
          QZD.idea.add(txt, '文献');
          UI.toast('已记入灵感罐');
        }
        UI.onStateChanged();
      }
    });
  }

  document.addEventListener('click', function(e){
    if(e.target.closest('[data-read-import]')){
      var ta = document.getElementById('read-import-text');
      var r = QZD.reading.importText(ta ? ta.value : '');
      if(!r.ok){ UI.toast(r.error); return; }
      UI.toast('已导入 ' + r.added + ' 篇（跳过重复）');
      UI.onStateChanged();
      return;
    }
    var done = e.target.closest('[data-read-done]');
    if(done){
      var d = QZD.reading.markDone(done.getAttribute('data-read-done'));
      if(!d.ok){ UI.toast(d.error); return; }
      UI.toast('已读完 · ' + d.item.title);
      UI.onStateChanged();
      promptIdea(d.item);
      return;
    }
    if(e.target.closest('[data-read-next]')){
      var n = QZD.reading.nextPick();
      if(!n.ok){ UI.toast(n.error); return; }
      UI.onStateChanged();
      return;
    }
    var pickBtn = e.target.closest('[data-read-pick]');
    if(pickBtn){
      var s = QZD.reading.setPick(pickBtn.getAttribute('data-read-pick'));
      if(!s.ok){ UI.toast(s.error); return; }
      UI.onStateChanged();
      return;
    }
    var del = e.target.closest('[data-read-del]');
    if(del){
      QZD.reading.remove(del.getAttribute('data-read-del'));
      UI.onStateChanged();
      return;
    }
  });
})();
