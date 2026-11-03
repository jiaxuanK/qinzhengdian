/* ============================================================
   systems/archive.js · 史馆档册（数据导出 / 备份）
   - 把各类数据导出为 CSV（含 BOM，Excel 中文不乱码）并触发下载
   - 覆盖：专注记录 / 打卡记录 / 文献 / 灵感 / 论文进度 / 目标树
   - 完整存档 JSON 备份复用 stateIO.exportFile()
   ============================================================ */
(function(){
  var IO = QZD.stateIO;
  var DATE = function(){ return IO.todayStr(); };

  /* CSV 单元格转义：含逗号/引号/换行则加引号并转义 */
  function cell(v){
    v = (v == null) ? '' : String(v);
    if(/[",\r\n]/.test(v)) v = '"' + v.replace(/"/g, '""') + '"';
    return v;
  }
  function toCSV(rows){
    return rows.map(function(r){ return r.map(cell).join(','); }).join('\r\n');
  }

  function download(filename, content){
    var blob = new Blob(['﻿' + content], { type: 'text/csv;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function(){ URL.revokeObjectURL(url); }, 0);
  }

  /* ---------- 专注记录（study.history：日期→分钟） ---------- */
  function focusCSV(){
    var st = QZD.state.study || {};
    var h = st.history || {};
    var rows = [['日期', '专注分钟']];
    Object.keys(h).sort().forEach(function(k){ rows.push([k, h[k]]); });
    return toCSV(rows);
  }

  /* ---------- 打卡记录（checkin.history：日期→得分明细） ---------- */
  function checkinCSV(){
    var c = QZD.state.checkin || {};
    var h = c.history || {};
    var rows = [['日期', '目标数', '完成数', '半完成', '得分']];
    Object.keys(h).sort().forEach(function(k){
      var r = h[k] || {};
      rows.push([k, r.total || 0, r.done || 0, r.half || 0, r.score || 0]);
    });
    return toCSV(rows);
  }

  /* ---------- 灵感 ---------- */
  function ideaCSV(){
    var rows = [['时间', '标签', '内容', '已孵化']];
    (QZD.idea.list() || []).forEach(function(it){
      rows.push([DATE(new Date(it.createdAt)), it.tag, it.text, it.hatched ? '是' : '否']);
    });
    return toCSV(rows);
  }

  /* ---------- 论文进度（按章节展开，含书名与整体进度） ---------- */
  function thesisCSV(){
    var rows = [['书名', '章节', '当前量', '目标量', '章节进度%', '整体进度%']];
    (QZD.thesis.list() || []).forEach(function(t){
      var overall = QZD.thesis.progress(t);
      if(!t.sections.length){
        rows.push([t.title, '（无章节）', 0, 0, 0, overall]);
      }else{
        t.sections.forEach(function(s){
          var pct = s.target > 0 ? Math.round((s.current || 0) / s.target * 100) : 0;
          rows.push([t.title, s.name, s.current || 0, s.target, pct, overall]);
        });
      }
    });
    return toCSV(rows);
  }

  /* ---------- 目标树（展平，含层级与有效进度） ---------- */
  function goalCSV(){
    var rows = [['层级', '父目标', '目标', '自身进度%', '有效进度%', '截止', '完成']];
    function depth(id){
      var n = QZD.goals.find(id), d = 0;
      while(n && n.parentId){ d++; n = QZD.goals.find(n.parentId); }
      return d;
    }
    QZD.goals.list().forEach(function(n){
      var p = n.parentId ? QZD.goals.find(n.parentId) : null;
      rows.push([
        depth(n.id),
        p ? p.title : '',
        n.title,
        n.progress || 0,
        QZD.goals.effective(n),
        n.deadline || '',
        n.done ? '是' : '否'
      ]);
    });
    return toCSV(rows);
  }

  QZD.archive = {
    download: download,
    focusCSV: focusCSV,
    checkinCSV: checkinCSV,
    ideaCSV: ideaCSV,
    thesisCSV: thesisCSV,
    goalCSV: goalCSV
  };
})();
