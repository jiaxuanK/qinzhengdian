/* ============================================================
   systems/goals.js · 千秋大计（B 档升级）
   - 子目标可选绑定课题（subjectIds）→ 专注时自动加进度
   - deadline 倒计时：daysLeft() 正数剩几天 / 0=今天到期 / 负数逾期
   - effective() 优先用 autoProgress，有手动覆盖则取 max
   - 新增 setSubjects() / setManual() 手动覆盖标记
   - 统计：roots 数 / 逾期 / 即将到期（≤3天）/ 平均进度
   ============================================================ */
(function(){
  var IO = QZD.stateIO;

  function tree(){
    if(!Array.isArray(QZD.state.goalTree)) QZD.state.goalTree = [];
    return QZD.state.goalTree;
  }
  function uid(){ return 'g' + Date.now().toString(36) + Math.floor(Math.random() * 1000).toString(36); }

  function find(id){
    var list = tree();
    for(var i = 0; i < list.length; i++) if(list[i].id === id) return list[i];
    return null;
  }
  function children(id){
    return tree().filter(function(n){ return n.parentId === id; });
  }
  function roots(){ return tree().filter(function(n){ return !n.parentId; }); }

  function add(title, parentId){
    title = String(title || '').trim().slice(0, 60);
    if(!title) return { ok: false, error: '请填写目标' };
    if(parentId){
      var p = find(parentId);
      if(!p) return { ok: false, error: '父目标不存在' };
    }
    var node = {
      id: uid(),
      parentId: parentId || null,
      title: title,
      progress: 0,
      manual: false,          /* true = 用户手动设过进度，覆盖自动 */
      subjectIds: [],         /* 绑定的课题 ID 数组 */
      links: [],              /* 关联标签 [{ type, ref, label }] — 非子级，纯关联 */
      targetMinutes: 0,       /* 目标总专注分钟（自动进度的分母），0=不限 */
      deadline: '',
      done: false,
      createdAt: Date.now()
    };
    tree().push(node);
    IO.pushLog('goals', '立大计 · ' + title);
    IO.save();
    return { ok: true, node: node };
  }

  /* 级联删除 */
  function remove(id){
    var list = tree();
    var toDel = {};
    (function collect(nid){
      toDel[nid] = true;
      children(nid).forEach(function(c){ collect(c.id); });
    })(id);
    for(var i = list.length - 1; i >= 0; i--){
      if(toDel[list[i].id]) list.splice(i, 1);
    }
    IO.save();
    return { ok: true };
  }

  function setProgress(id, p){
    var n = find(id);
    if(!n) return { ok: false, error: '目标不存在' };
    n.progress = Math.max(0, Math.min(100, Math.round(p) || 0));
    n.manual = true;
    n.done = n.progress >= 100;
    IO.save();
    return { ok: true, node: n };
  }
  function setManual(id, bool){
    var n = find(id);
    if(!n) return { ok: false, error: '目标不存在' };
    n.manual = !!bool;
    if(!n.manual) n.progress = 0;  /* 取消手动 → 清空手动值，让自动接管 */
    IO.save();
    return { ok: true, node: n };
  }
  function setDeadline(id, d){
    var n = find(id);
    if(!n) return { ok: false, error: '目标不存在' };
    n.deadline = String(d || '').trim().slice(0, 20);
    IO.save();
    return { ok: true };
  }
  function updateTitle(id, t){
    var n = find(id);
    if(!n) return { ok: false, error: '目标不存在' };
    n.title = String(t || '').trim().slice(0, 60) || n.title;
    IO.save();
    return { ok: true };
  }
  function setSubjects(id, subjectIds){
    var n = find(id);
    if(!n) return { ok: false, error: '目标不存在' };
    n.subjectIds = Array.isArray(subjectIds) ? subjectIds.slice(0, 5) : [];
    IO.save();
    return { ok: true };
  }
  function setTargetMinutes(id, mins){
    var n = find(id);
    if(!n) return { ok: false, error: '目标不存在' };
    n.targetMinutes = Math.max(0, Math.round(mins) || 0);
    IO.save();
    return { ok: true };
  }

  /* ---- 关联标签（非子级，纯关联性）----
     type: memorial | thesis | meeting | checkin | reading | custom
     ref:  各模块自己的 id，custom 时 ref 可空
     label: 显示文本（自动从各模块查询也可以手动指定）
  */
  var LINK_ICONS = { memorial:'📋', thesis:'📖', meeting:'💬', checkin:'✅', reading:'📚', custom:'🏷️', idea:'🧠', subject:'📖' };
  var LINK_TYPES = ['memorial','thesis','meeting','checkin','reading','custom'];
  /* 按类型区分的主题色 —— 复用 CSS 变量里的色系 */
  var LINK_COLORS = {
    memorial: { dot:'#A8573F', text:'#A8573F', chipBg:'rgba(168,87,63,.10)',  chipText:'#A8573F' },  /* 奏折：朱铅 */
    thesis:   { dot:'#2F6B78', text:'#2F6B78', chipBg:'rgba(47,107,120,.10)',  chipText:'#2F6B78' },   /* 修书：石青（文渊阁）*/
    meeting:  { dot:'#7C6B94', text:'#7C6B94', chipBg:'rgba(124,107,148,.10)', chipText:'#7C6B94' },  /* 议事：轩紫 */
    checkin:  { dot:'#5E7A4A', text:'#5E7A4A', chipBg:'rgba(94,122,74,.10)',   chipText:'#5E7A4A' },   /* 常课：竹绿 */
    reading:  { dot:'#A8842C', text:'#A8842C', chipBg:'rgba(168,132,44,.10)',  chipText:'#8a7130' },   /* 阅读：藤黄 */
    custom:   { dot:'#4C6E8C', text:'#4C6E8C', chipBg:'rgba(76,110,140,.10)',  chipText:'#4C6E8C' }    /* 自定义：黛蓝（默认）*/
  };
  function linkColor(type){ return LINK_COLORS[type] || LINK_COLORS.custom; }

  function addLink(id, type, ref, label){
    var n = find(id);
    if(!n) return { ok: false, error: '目标不存在' };
    if(!n.links) n.links = [];
    if(LINK_TYPES.indexOf(type) < 0) return { ok: false, error: '未知关联类型：' + type };
    /* 去重：同一 type+ref 不重复 */
    var dup = n.links.some(function(l){ return l.type === type && l.ref === ref; });
    if(dup) return { ok: false, error: '已存在该关联' };
    var finalLabel = String(label || '').trim();
    if(!finalLabel){
      /* 尝试自动查 label */
      var auto = resolveLabel(type, ref);
      if(auto) finalLabel = auto;
    }
    if(!finalLabel && type !== 'custom') return { ok: false, error: '无法自动解析标题，请手动指定' };
    n.links.push({ type: type, ref: ref || '', label: finalLabel.slice(0, 24) });
    IO.save();
    return { ok: true };
  }

  function removeLink(id, type, ref){
    var n = find(id);
    if(!n || !n.links) return { ok: false, error: '目标不存在' };
    var before = n.links.length;
    n.links = n.links.filter(function(l){ return !(l.type === type && l.ref === ref); });
    if(n.links.length === before) return { ok: false, error: '关联不存在' };
    IO.save();
    return { ok: true };
  }

  function linkIcon(type){ return LINK_ICONS[type] || '🏷️'; }

  function resolveLabel(type, ref){
    try {
      if(type === 'memorial' && QZD.memorials){
        var m = QZD.memorials.find(ref);
        return m ? m.title : '';
      }
      if(type === 'thesis' && QZD.thesis){
        var t = QZD.thesis.find(ref);
        return t ? t.title : '';
      }
      if(type === 'meeting' && QZD.meetings){
        var mt2 = QZD.meetings.find(ref);
        return mt2 ? mt2.title : '';
      }
      if(type === 'checkin'){
        var ckGoals = (QZD.state.checkin && QZD.state.checkin.goals) || [];
        var ckg = ckGoals.find(function(x){ return x.id === ref; });
        return ckg ? ckg.title : '';
      }
      if(type === 'reading'){
        var rq = (QZD.state.reading && QZD.state.reading.queue) || [];
        var rqItem = rq.find(function(x){ return x.id === ref; });
        return rqItem ? rqItem.title : '';
      }
    } catch(e){}
    return '';
  }

  /* 自动进度：根据绑定课题的真实专注分钟 / 目标分钟 */
  function autoProgress(node){
    if(!node || !node.subjectIds || !node.subjectIds.length || !node.targetMinutes) return 0;
    var ss = QZD.study ? QZD.study.state.subjectStats : null;
    if(!ss) return 0;
    var totalMin = 0;
    node.subjectIds.forEach(function(sid){ totalMin += (ss[sid] || 0); });
    return Math.min(100, Math.round(totalMin / node.targetMinutes * 100));
  }

  /* 有效进度：手动优先（manual=true 用手动值），否则取自动 / 子节点均值 */
  function effective(node){
    if(node.manual){
      /* 手动但也有自动进度 → 取较大值，激励用户 */
      var ap = autoProgress(node);
      return Math.max(node.progress || 0, ap);
    }
    /* 有绑定课题 → 自动 */
    if(node.subjectIds && node.subjectIds.length && node.targetMinutes){
      return autoProgress(node);
    }
    /* 非叶节点 → 子节点均值 */
    var ch = children(node.id);
    if(ch.length){
      var sum = 0;
      ch.forEach(function(c){ sum += effective(c); });
      return Math.round(sum / ch.length);
    }
    return node.progress || 0;
  }

  /* 剩余天数：正数剩几天，0=今天，负数逾期几天。deadline 格式 YYYY-MM-DD */
  function daysLeft(node){
    if(!node || !node.deadline) return null;
    var dl = new Date(node.deadline + 'T23:59:59');
    if(isNaN(dl.getTime())) return null;
    var now = new Date();
    now.setHours(23, 59, 59, 999);
    return Math.ceil((dl.getTime() - now.getTime()) / (24 * 3600 * 1000));
  }

  /* 课题实际已专注分钟数（详情弹层展示用） */
  function subjectMinutes(node){
    if(!node || !node.subjectIds || !node.subjectIds.length) return 0;
    var ss = QZD.study ? QZD.study.state.subjectStats : null;
    if(!ss) return 0;
    var total = 0;
    node.subjectIds.forEach(function(sid){ total += (ss[sid] || 0); });
    return total;
  }

  function stats(){
    var list = tree();
    var roots2 = roots();
    var overdue = 0, soon = 0, done = 0;
    var totalEff = 0, count = 0;
    list.forEach(function(n){
      var dl = daysLeft(n);
      if(dl !== null && dl < 0) overdue++;
      if(dl !== null && dl >= 0 && dl <= 3) soon++;
      if(n.done || effective(n) >= 100) done++;
      totalEff += effective(n); count++;
    });
    return {
      roots: roots2.length,
      total: list.length,
      overdue: overdue,
      soon: soon,
      done: done,
      avgProgress: count ? Math.round(totalEff / count) : 0
    };
  }

  QZD.goals = {
    list: tree,
    roots: roots,
    children: children,
    find: find,
    add: add,
    remove: remove,
    setProgress: setProgress,
    setManual: setManual,
    setDeadline: setDeadline,
    updateTitle: updateTitle,
    setSubjects: setSubjects,
    setTargetMinutes: setTargetMinutes,
    addLink: addLink,
    removeLink: removeLink,
    linkIcon: linkIcon,
    linkTypes: LINK_TYPES,
    linkColor: linkColor,
    effective: effective,
    autoProgress: autoProgress,
    daysLeft: daysLeft,
    subjectMinutes: subjectMinutes,
    stats: stats
  };
})();
