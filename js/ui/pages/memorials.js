/* ============================================================
   ui/pages/memorials.js · 御案奏折（唯一的专注入口）
   新建 / 筛选 / 拆小目标 / 开始专注 / 办结 / 搁置 / 删除
   奏折本身不计时，小目标才开正计时。
   ============================================================ */
(function(){
  var CFG = QZD.config;
  var C = CFG.MEMORIAL;
  var F = CFG.FOCUS || {};
  var UI = QZD.ui;
  var M = QZD.memorials;
  var POMO = QZD.pomodoro;

  var filter = 'all';

  function optionList(list, selected){
    return list.map(function(item){
      return '<option value="' + item.key + '"' + (item.key === selected ? ' selected' : '') + '>' +
        item.name + '</option>';
    }).join('');
  }

  function boundNow(m){
    return POMO.isActive() && POMO.boundId() === m.id;
  }

  function cardActions(m){
    if(m.status === 'banjie') return '<span class="badge ok">已办结</span>';

    if(boundNow(m)){
      return '<button class="btn ghost" disabled>专注中…</button>';
    }
    if(POMO.isActive()){
      return '<button class="btn ghost" disabled>另有专注进行中</button>';
    }

    var btns = '';
    if(m.status === 'daipi'){
      btns += '<button class="btn primary" data-pomo-start="' + m.id + '">开始专注</button>' +
        '<button class="btn danger" data-mem="delete" data-id="' + m.id + '">删除</button>';
    }else if(m.status === 'pizhong'){
      btns += '<button class="btn primary" data-pomo-start="' + m.id + '">继续专注</button>' +
        '<button class="btn ghost" data-mem="gezhi" data-id="' + m.id + '">搁置</button>' +
        '<button class="btn ghost" data-mem="finish" data-id="' + m.id + '">办结</button>';
    }else if(m.status === 'gezhi'){
      btns += '<button class="btn ghost" data-mem="restore" data-id="' + m.id + '">恢复</button>' +
        '<button class="btn ghost" data-mem="finish" data-id="' + m.id + '">办结</button>';
    }
    return btns;
  }

  function subRow(m, sb){
    var focusing = boundNow(m) && QZD.state.pomodoro.boundSubtaskId === sb.id;
    return '<div class="fs-sub' + (sb.done ? ' done' : '') + (focusing ? ' focusing' : '') + '">' +
      '<button class="fs-check' + (sb.done ? ' on' : '') + '" data-sub-toggle="' + m.id + '|' +
        sb.id + '" title="' + (sb.done ? '标记未完成' : '标记完成') + '">' +
        (sb.done ? '✓' : '') + '</button>' +
      '<span class="fs-sub-title">' + UI.fmt.escape(sb.title) + '</span>' +
      (sb.focusMin ? '<span class="fs-min">' + sb.focusMin + ' 分</span>' : '') +
      (sb.done
        ? '<span class="badge ok sm">已完成</span>'
        : (focusing
            ? '<span class="badge buff sm">专注中</span>'
            : (m.status === 'banjie' ? ''
                : '<button class="btn ghost sm" data-focus-sub="' + m.id + '|' + sb.id +
                  '">专注</button>'))) +
      '<button class="ci-del" data-sub-del="' + m.id + '|' + sb.id + '" title="删除">×</button>' +
    '</div>';
  }

  /* 课题下拉：还没有课题时只有「未分类」，并提示去钦天监建 */
  function subjectOptions(selected){
    var list = (QZD.study && QZD.study.subjects) ? QZD.study.subjects() : [];
    var opts = '<option value="">未分类</option>' + list.map(function(s){
      return '<option value="' + s.id + '"' + (s.id === selected ? ' selected' : '') + '>' +
        UI.fmt.escape(s.name) + '</option>';
    }).join('');
    var hint = list.length
      ? ''
      : '<p class="card-note" style="margin:4px 0 0">还没有课题 · 到「钦天监」页新建，专注分钟会按课题自动归类</p>';
    return '<select id="mem-subject">' + opts + '</select>' + hint;
  }

  function subjectName(id){
    var hit = '';
    ((QZD.study && QZD.study.subjects && QZD.study.subjects()) || []).forEach(function(s){
      if(s.id === id) hit = s.name;
    });
    return hit;
  }

  function card(m){
    var p = M.progress(m);
    var flashing = m.id === M.flash.id && Date.now() < M.flash.until;
    var subs = (m.subtasks || []).map(function(sb){ return subRow(m, sb); }).join('');
    var editable = (m.status !== 'banjie');
    var ddl = '';
    if(m.dueAt && m.status !== 'banjie'){
      var days = Math.ceil((m.dueAt - Date.now()) / 86400000);
      var dc = days < 0 ? 'over' : (days <= 3 ? 'soon' : '');
      var dl = days < 0 ? ('逾期 ' + Math.abs(days) + ' 天') : (days === 0 ? '今天截止' : ('剩 ' + days + ' 天'));
      ddl = '<span class="ddl-badge ' + dc + '">' + dl + '</span>';
    }

    return '<div class="mem-card' + (flashing ? ' flash' : '') + '">' +
      '<div class="mem-top">' +
        '<div class="mem-title">' + UI.fmt.escape(m.title) + '</div>' +
        '<div class="mem-actions">' + cardActions(m) + '</div>' +
      '</div>' +
      '<div class="mem-badges">' +
        '<span class="badge tag">' + M.tagName(m.tag) + '</span>' +
        (subjectName(m.subjectId) ? '<span class="badge">📚 ' + UI.fmt.escape(subjectName(m.subjectId)) + '</span>' : '') +
        '<span class="badge ' + M.priorityCls(m.priority) + '">' + M.priorityName(m.priority) + '</span>' +
        '<span class="badge status-' + m.status + '">' + M.statusName(m.status) + '</span>' +
        ddl +
        '<span class="badge">累计 ' + p.focusMin + ' 分 · ' + p.sessions + ' 次</span>' +
        (p.allDone ? '<span class="badge ok">小目标全完成</span>' : '') +
      '</div>' +
      (m.note ? '<p class="mem-note">' + UI.fmt.escape(m.note) + '</p>' : '') +
      (p.total
        ? '<div class="bar sm" style="margin:8px 0 6px"><i style="width:' + p.pct + '%"></i></div>' +
          '<p class="fs-empty">小目标 ' + p.done + ' / ' + p.total + '</p>'
        : '') +
      (subs || '<div class="fs-empty">还没有小目标，可先拆一条再开始专注</div>') +
      (editable
        ? '<div class="fs-add"><input class="fs-new" id="ms-new-' + m.id + '" maxlength="' +
            (F.SUB_TITLE_MAX || 24) + '" placeholder="拆一个小目标，如：看完 3.1 节">' +
          '<button class="btn ghost sm" data-sub-add="' + m.id + '">添加</button></div>'
        : '') +
    '</div>';
  }

  function openCreate(){
    UI.modal({
      title: '新建奏折',
      body:
        '<div class="field"><label for="mem-title">奏折标题（≤ ' + C.TITLE_MAX + ' 字）</label>' +
          '<input id="mem-title" maxlength="' + C.TITLE_MAX + '" placeholder="如：COMSOL 行波电极仿真"></div>' +
        '<div class="field"><label for="mem-tag">所属官署</label>' +
          '<select id="mem-tag">' + optionList(C.TAGS, C.TAGS[0].key) + '</select></div>' +
        '<div class="field"><label for="mem-subject">所属课题（可选）</label>' +
          subjectOptions() + '</div>' +
        '<div class="field"><label for="mem-priority">优先级</label>' +
          '<select id="mem-priority">' + optionList(C.PRIORITIES, C.PRIORITIES[0].key) + '</select></div>' +
        '<div class="field"><label for="mem-due">截止日（可选）</label>' +
          '<input id="mem-due" type="date"></div>' +
        '<div class="field"><label for="mem-note">备注（可选）</label>' +
          '<textarea id="mem-note" rows="3" maxlength="200" placeholder="文献 / 仿真内容 / 验收标准"></textarea></div>' +
        '<p class="card-note">不设目标时长：奏折不绑定番茄钟，随时开始、做完办结。填了截止日会在「今日勤政」显示倒计时。</p>',
      ok: true,
      okText: '落案',
      onOk: function(mask){
        var res = M.create({
          title: mask.querySelector('#mem-title').value,
          tag: mask.querySelector('#mem-tag').value,
          priority: mask.querySelector('#mem-priority').value,
          subjectId: mask.querySelector('#mem-subject').value,
          dueAt: (mask.querySelector('#mem-due') || {}).value || null,
          note: mask.querySelector('#mem-note').value
        });
        if(!res.ok){ UI.toast(res.error); return false; }
        UI.toast('奏折已落案');
        UI.onStateChanged();
      }
    });
  }

  function render(){
    var list = M.active(filter);
    var chips = [{ key: 'all', name: '全部' }].concat(C.TAGS);
    var chipHtml = chips.map(function(t){
      return '<button type="button" class="chip' + (filter === t.key ? ' active' : '') +
        '" data-mem-filter="' + t.key + '">' + t.name + '</button>';
    }).join('');

    var body = list.length
      ? '<div class="mem-list">' + list.map(card).join('') + '</div>'
      : '<div class="empty">御案空空，尚无奏折<span class="card-note">点右上角「新建奏折」落案</span></div>';

    return '<section class="card">' +
      '<div class="card-head"><span class="card-title">御案奏折</span>' +
        '<button class="btn primary" data-mem="new">+ 新建奏折</button></div>' +
      '<p class="today-line">奏折就是专注任务：本身不计时，拆出小目标后点「专注」开始正计时；' +
        '奖励严格按专注分钟累计，放弃按五成计入。</p>' +
      '<div class="chip-row" style="margin:10px 0 14px">' + chipHtml + '</div>' +
      body +
    '</section>' +
    '<p class="page-foot">办结的奏折移入归档起居注 · 累计分钟与专注次数会保留在奏折上</p>';
  }

  function pairOf(v){
    var a = String(v || '').split('|');
    return { mem: a[0], sub: a[1] };
  }

  /* 奏折页已并入「今日勤政」，这里只提供可嵌入区块 + 全局事件委托 */
  document.addEventListener('click', function(e){
      var chip = e.target.closest('[data-mem-filter]');
      if(chip){
        filter = chip.getAttribute('data-mem-filter');
        UI.renderPage();
        return;
      }

      /* 小目标增删改 */
      var subAdd = e.target.closest('[data-sub-add]');
      if(subAdd){
        var mid = subAdd.getAttribute('data-sub-add');
        var input = document.getElementById('ms-new-' + mid);
        var rAdd = M.addSub(mid, input ? input.value : '');
        if(!rAdd.ok){ UI.toast(rAdd.error); return; }
        UI.onStateChanged();
        return;
      }

      var subToggle = e.target.closest('[data-sub-toggle]');
      if(subToggle){
        var p1 = pairOf(subToggle.getAttribute('data-sub-toggle'));
        var cur = M.findSubById(p1.sub);
        var next = cur ? !cur.sub.done : true;
        var rT = M.setSubDone(p1.mem, p1.sub, next);
        if(!rT.ok){ UI.toast(rT.error); return; }
        if(next) UI.toast('小目标达成 · ' + rT.sub.title);
        UI.onStateChanged();
        return;
      }

      var subDel = e.target.closest('[data-sub-del]');
      if(subDel){
        var p2 = pairOf(subDel.getAttribute('data-sub-del'));
        M.removeSub(p2.mem, p2.sub);
        UI.onStateChanged();
        return;
      }

      var btn = e.target.closest('[data-mem]');
      if(!btn) return;
      var act = btn.getAttribute('data-mem');
      var id = btn.getAttribute('data-id');

      if(act === 'new'){ openCreate(); return; }

      if(act === 'delete'){
        var m = M.find(id);
        UI.confirm('确定撤下奏折「' + (m ? UI.fmt.escape(m.title) : '') + '」吗？其小目标与专注记录一并删除。', function(){
          var r = M.remove(id);
          if(!r.ok) UI.toast(r.error);
          else UI.toast('奏折已撤下');
          UI.onStateChanged();
        });
        return;
      }

      if(act === 'finish'){
        var mf = M.find(id);
        var pp = mf ? M.progress(mf) : { total: 0, done: 0 };
        var warn = (pp.total && pp.done < pp.total)
          ? '<p class="card-note">还有 ' + (pp.total - pp.done) + ' 个小目标未完成，仍要办结吗？</p>' : '';
        UI.confirm('<p>办结「' + (mf ? UI.fmt.escape(mf.title) : '') + '」？</p>' + warn, function(){
          var r = M.finish(id);
          if(!r.ok) UI.toast(r.error);
          else UI.toast('奏折已办结');
          UI.onStateChanged();
        }, { okText: '办结' });
        return;
      }

      if(act === 'gezhi'){
        var r2 = M.setStatus(id, 'gezhi');
        if(!r2.ok) UI.toast(r2.error);
        else{
          QZD.stateIO.pushLog('memorial', '奏折搁置：' + r2.memorial.title);
          UI.toast('奏折已搁置');
          UI.onStateChanged();
        }
        return;
      }

      if(act === 'restore'){
        var r3 = M.setStatus(id, 'pizhong');
        if(!r3.ok) UI.toast(r3.error);
        else UI.toast('奏折已恢复');
        UI.onStateChanged();
      }
  });

  UI.memorialBlock = { render: render };

  /* 小目标输入框回车提交 */
  document.addEventListener('keydown', function(e){
    if(e.key !== 'Enter') return;
    var id = e.target && e.target.id;
    if(!id || id.indexOf('ms-new-') !== 0) return;
    e.preventDefault();
    var mid = id.slice('ms-new-'.length);
    var b = document.querySelector('[data-sub-add="' + mid + '"]');
    if(b) b.click();
  });
})();
