/* ============================================================
   state.js · GameState 单例 + localStorage 存档 + 每日重置器
   三条铁律之一：所有系统只读写 QZD.state，UI 只读不写
   ============================================================ */
(function(){
  var CFG = QZD.config;
  var SAVE_KEY = CFG.SAVE_KEY;

  function pad(n){ return n < 10 ? '0' + n : '' + n; }

  /* 旧稀世妃子文件夹名 → 新名字（2026-11-02 重命名，旧档路径迁移用） */
  var RARE_RENAME = {
    '新建文件夹': '洛神', '新建文件夹 (2)': '甄宓', '新建文件夹 (3)': '西施',
    '新建文件夹 (4)': '王嫱', '新建文件夹 (5)': '飞燕', '新建文件夹 (6)': '玉环',
    '新建文件夹 (7)': '师师', '新建文件夹 (8)': '小小', '新建文件夹 (9)': '如是',
    '新建文件夹 (10)': '疏影', '新建文件夹 (11)': '青黛', '新建文件夹 (12)': '绛雪',
    '新建文件夹 (13)': '朝云', '新建文件夹 (14)': '清商',
    /* 二次改名（诗意名 → 更好听的名字） */
    '横波': '疏影', '绿珠': '青黛', '红拂': '绛雪', '琴操': '清商'
  };

  /* 由字符串稳定取模：旧档补人设时用，保证每次读档结果一致（不随机漂移） */
  function seededIdx(key, len){
    var s = String(key || ''), h = 0;
    for(var i = 0; i < s.length; i++){ h = (h * 31 + s.charCodeAt(i)) >>> 0; }
    return len ? h % len : 0;
  }

  /* 本地日期 YYYY-MM-DD（跨天判定只用日期字符串，不用 UTC） */
  function todayStr(d){
    d = d || new Date();
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }

  function createState(){
    var now = Date.now();
    return {
      meta: {
        schemaVersion: CFG.SCHEMA_VERSION,
        createdAt: now,
        lastSavedAt: now,
        lastDailyReset: todayStr(),
        emperorName: '朕'
      },
      emperor: { ningShen: 0, yuLue: 0, mingDe: 0, renXin: 0 },
      emperorPortrait: (QZD.ASSETS && QZD.ASSETS.emperor && QZD.ASSETS.emperor[0]) || '',
      /* 皇帝立绘路径（king 文件夹中任选） */
      resources: { qinZheng: 0, jinQian: 0, guoJin: 0, shengWang: 0 },
      memorials: [],
      pomodoro: {
        status: 'idle',        /* idle | running | paused | finished | abandoned */
        mode: 'open',          /* 统一正计时；mode 字段保留兼容 */
        boundMemorialId: null, /* 绑定奏折（奏折即专注任务） */
        boundSubtaskId: null,  /* 绑定的具体小目标，可空 */
        companionId: null,     /* 本次专注陪伴的妃嫔 id；null 表示独自 */
        title: '',             /* 本次专注的显示名 */
        durationMin: 0,        /* 正计时不用；保留字段兼容旧档 */
        startedAt: null,
        endsAt: null,
        lastTickAt: null,      /* 离线补算宽限参照 */
        pauseCount: 0,
        pausedTotalSec: 0,
        pauseStartedAt: null,
        gained: { qinZheng: 0, jinQian: 0, guoJin: 0 }
      },
      /* 每日打卡：goals 为今日自建小目标，history 为历史得分（热力图数据源） */
      checkin: { date: todayStr(), goals: [], history: {}, buff: null },
      logs: [],
      /* M2+ 预留空壳：先建好，保证存档结构从第一版就稳定 */
      cities: [], territories: [],
      /* M3 名臣与科举：待录人才跨刷新保留，直到钦点 */
      ministers: [], keju: { candidates: [] },
      /* M4 后宫：待选秀女同样跨刷新保留 */
      consorts: [], xuanxiu: { candidates: [] }, princes: [], sleep: {},
      items: {},              /* 珍宝阁背包：itemId -> 数量 */
      /* 学习目标与偏好：把游戏节奏绑回真实专注 */
      settings: { focusQuiet: true, zen: false },
      study: {
        date: todayStr(),
        targetMin: (CFG.STUDY ? CFG.STUDY.DAILY_TARGET_MIN : 120),
        doneMin: 0,
        met: false,
        streak: 0,
        lastMetDate: null,
        sessionCount: 0,
        subject: '',
        history: {},
        hourStats: {},       /* 专注分钟按「小时(0–23)」累计，供热力图式时段分析 */
        subjects: [],        /* 课题（科研项目）列表：{ id, name } */
        subjectStats: {},    /* 专注分钟按课题累计：{ subjectId | 'none': minutes } */
        subjectDaily: {},    /* 按日期×课题：{ 'YYYY-MM-DD': { subjectId: min } } */
        abandonLog: [],      /* 中断记录：{ at, reason, minutes, title } */
        imperialDate: ''     /* 最近一次「御批」日期，保证每天只批一次 */
      },
      /* M5 内政营造：levels 为各工程等级，lastAt 为产出补算时间戳 */
      works: { levels: {}, lastAt: now },

      /* M6 直博生科研辅助：灵感 / 论文(修书) / 长期目标树 */
      ideas: [],
      theses: [],
      goalTree: [],

      /* M8 科研办公：本周三事 + 专注进展流水 / 组会纪要 / 精读队列 */
      plan: { weekKey: '', goals: [], progress: [] },
      meetings: [],
      reading: { queue: [], pickDate: '', pickId: null }
    };
  }

  /* 旧档补齐 M2/M3/M4/M5 字段，避免读档后某些模块拿到 undefined */
  function normalize(obj){
    if(!Array.isArray(obj.cities)) obj.cities = [];
    if(!Array.isArray(obj.territories)) obj.territories = [];
    if(!Array.isArray(obj.ministers)) obj.ministers = [];
    obj.ministers.forEach(function(m){
      if(m && typeof m === 'object') m.fielded = !!m.fielded;
    });
    if(!obj.keju || !Array.isArray(obj.keju.candidates)) obj.keju = { candidates: [] };
    if(!Array.isArray(obj.consorts)) obj.consorts = [];

    /* 番茄状态兜底：存档缺失时补一份空闲态，避免 restore() 读到 undefined */
    if(!obj.pomodoro || typeof obj.pomodoro !== 'object'){
      obj.pomodoro = {
        status: 'idle', boundMemorialId: null, companionId: null, durationMin: 0,
        startedAt: null, endsAt: null, pauseCount: 0, pausedTotalSec: 0,
        pauseStartedAt: null, gained: { qinZheng: 0, jinQian: 0, guoJin: 0 }
      };
    }

    /* 一次性迁移：妃嫔三维上限由 90 提升至 120。
       旧档三维均 ≤90，故只要存在任一 >90 即视为已迁移，避免重复缩放。 */
    var attrMigrated = obj.consorts.some(function(c){
      return c && typeof c === 'object' && (c.yan > 90 || c.ti > 90 || c.cai > 90);
    });
    if(obj.consorts.length && !attrMigrated){
      obj.consorts.forEach(function(c){
        if(!c || typeof c !== 'object') return;
        ['yan', 'ti', 'cai'].forEach(function(k){
          if(typeof c[k] === 'number'){
            c[k] = Math.max(30, Math.min(120, Math.round(c[k] * 4 / 3)));
          }
        });
      });
    }

    obj.consorts.forEach(function(c){
      if(c && typeof c === 'object'){
        if(!('pregnant' in c)) c.pregnant = null;
        if(!('personality' in c)) c.personality = 'wen';
        if(!('favor' in c)){
          var FV = QZD.config.FAVOR || {};
          var lo = (typeof FV.INIT_MIN === 'number') ? FV.INIT_MIN : 8;
          var hi = (typeof FV.INIT_MAX === 'number') ? FV.INIT_MAX : 30;
          c.favor = lo + Math.floor(Math.random() * (hi - lo + 1));
        }
        if(!('dote' in c)) c.dote = (QZD.config.DOTE ? QZD.config.DOTE.INIT : 0);
        if(typeof c.rank !== 'number') c.rank = 0;   /* 位份：0 = 才人 */

        /* 文件夹重命名迁移：旧档 rareKey 与姿态路径改到新目录 */
        if(c.rareKey && RARE_RENAME[c.rareKey]) c.rareKey = RARE_RENAME[c.rareKey];
        if(Array.isArray(c.poses) && c.poses.length){
          c.poses = c.poses.map(function(p){
            try{
              var dec = decodeURIComponent(String(p));
              var m = dec.match(/^assets\/images\/([^/]+)\//);
              if(m && RARE_RENAME[m[1]]){
                dec = dec.replace('assets/images/' + m[1] + '/',
                                  'assets/images/' + RARE_RENAME[m[1]] + '/');
              }
              return encodeURI(dec);
            }catch(e){ return p; }
          });
          var pidx = (typeof c.poseIndex === 'number') ? c.poseIndex : 0;
          pidx = Math.max(0, Math.min(pidx, c.poses.length - 1));  /* 越界钳制 */
          c.poseIndex = pidx;
          if(c.poses[pidx]) c.img = c.poses[pidx];
        }

        /* 人设字段补齐（旧档按 id 稳定生成，读档不漂移） */
        var XX = QZD.config.XUANXIU || {};
        if(typeof c.age !== 'number'){
          var am = XX.AGE_MIN || 16, ax = XX.AGE_MAX || 22;
          c.age = am + seededIdx(c.id + 'age', ax - am + 1);
        }
        var HT = XX.HOMETOWNS || ['江南'];
        var OR = XX.ORIGINS || ['书香门第'];
        var TR = XX.TRAITS || ['善琴'];
        if(!c.hometown) c.hometown = HT[seededIdx(c.id + 'h', HT.length)];
        if(!c.origin) c.origin = OR[seededIdx(c.id + 'o', OR.length)];
        if(!c.trait) c.trait = TR[seededIdx(c.id + 't', TR.length)];

        /* 多姿态：补齐当前立绘与索引 */
        if(Array.isArray(c.poses) && c.poses.length){
          if(!c.img) c.img = c.poses[0];
          if(typeof c.poseIndex !== 'number') c.poseIndex = 0;
        }
      }
    });
    if('haremExtraSlots' in obj) delete obj.haremExtraSlots;   /* 席位机制已移除 */
    if(!obj.items || typeof obj.items !== 'object' || Array.isArray(obj.items)){
      obj.items = {};
    }
    if(!obj.emperorPortrait){
      var EMP = (QZD.ASSETS && QZD.ASSETS.emperor) || [];
      obj.emperorPortrait = EMP[0] || '';
    }
    if(!obj.settings || typeof obj.settings !== 'object') obj.settings = {};
    if(typeof obj.settings.focusQuiet !== 'boolean') obj.settings.focusQuiet = true;

    if(!obj.study || typeof obj.study !== 'object') obj.study = {};
    var ST = obj.study;
    var STCFG = CFG.STUDY || {};
    if(typeof ST.targetMin !== 'number') ST.targetMin = STCFG.DAILY_TARGET_MIN || 120;
    if(typeof ST.doneMin !== 'number') ST.doneMin = 0;
    if(typeof ST.streak !== 'number') ST.streak = 0;
    if(typeof ST.sessionCount !== 'number') ST.sessionCount = 0;
    if(typeof ST.met !== 'boolean') ST.met = false;
    if(typeof ST.subject !== 'string') ST.subject = '';
    if(!ST.history || typeof ST.history !== 'object' || Array.isArray(ST.history)) ST.history = {};
    if(!ST.date) ST.date = todayStr();
    if(!Array.isArray(obj.princes)) obj.princes = [];
    obj.princes.forEach(function(p){
      if(p && typeof p === 'object' && typeof p.trainCount !== 'number') p.trainCount = 0;
    });
    if(!obj.xuanxiu || !Array.isArray(obj.xuanxiu.candidates)) obj.xuanxiu = { candidates: [] };
    if(!obj.sleep || typeof obj.sleep !== 'object') obj.sleep = {};
    /* 朝堂议政模块已移除：旧档里的 court 字段直接丢弃，避免残留数据 */
    if('court' in obj) delete obj.court;
    if(!obj.works || typeof obj.works !== 'object') obj.works = {};
    if(!obj.works.levels || typeof obj.works.levels !== 'object') obj.works.levels = {};
    if(!obj.works.lastAt) obj.works.lastAt = Date.now();

    /* M6 直博生科研辅助模块字段补齐（旧档无这些结构时新建） */
    if(!Array.isArray(obj.ideas)) obj.ideas = [];
    if(!Array.isArray(obj.theses)) obj.theses = [];
    if(!Array.isArray(obj.goalTree)) obj.goalTree = [];
    if(!obj.study.hourStats || typeof obj.study.hourStats !== 'object') obj.study.hourStats = {};
    if(!Array.isArray(obj.study.subjects)) obj.study.subjects = [];
    if(!obj.study.subjectStats || typeof obj.study.subjectStats !== 'object') obj.study.subjectStats = {};
    if(!obj.study.subjectDaily || typeof obj.study.subjectDaily !== 'object') obj.study.subjectDaily = {};
    if(!Array.isArray(obj.study.abandonLog)) obj.study.abandonLog = [];
    if(typeof obj.study.imperialDate !== 'string') obj.study.imperialDate = '';
    if(!obj.settings || typeof obj.settings !== 'object') obj.settings = { focusQuiet: true, zen: false };
    if(obj.settings.zen === undefined) obj.settings.zen = false;

    /* M8 科研办公：本周三事 / 进展流水 / 组会 / 精读 */
    if(!obj.plan || typeof obj.plan !== 'object') obj.plan = {};
    if(typeof obj.plan.weekKey !== 'string') obj.plan.weekKey = '';
    if(!Array.isArray(obj.plan.goals)) obj.plan.goals = [];
    if(!Array.isArray(obj.plan.progress)) obj.plan.progress = [];
    if(!Array.isArray(obj.plan.nextGoals)) obj.plan.nextGoals = [];
    if(!Array.isArray(obj.meetings)) obj.meetings = [];
    if(!obj.reading || typeof obj.reading !== 'object') obj.reading = {};
    if(!Array.isArray(obj.reading.queue)) obj.reading.queue = [];
    if(typeof obj.reading.pickDate !== 'string') obj.reading.pickDate = '';
    if(obj.reading.pickId === undefined) obj.reading.pickId = null;

    /* 每日打卡：旧档没有该结构则新建；有 goals 时补齐字段 */
    if(!obj.checkin || typeof obj.checkin !== 'object') obj.checkin = {};
    var CK = obj.checkin;
    if(!CK.date) CK.date = todayStr();
    if(!Array.isArray(CK.goals)) CK.goals = [];
    CK.goals = CK.goals.filter(function(g){ return g && typeof g === 'object'; });
    CK.goals.forEach(function(g, i){
      if(!g.id) g.id = 'g' + i + '-' + Date.now().toString(36);
      if(typeof g.title !== 'string') g.title = '未命名目标';
      g.level = (g.level === 1 || g.level === 2) ? g.level : 0;
      if(typeof g.granted !== 'number') g.granted = 0;
    });
    if(!CK.history || typeof CK.history !== 'object' || Array.isArray(CK.history)) CK.history = {};
    if(!('buff' in CK)) CK.buff = null;

    /* 奏折＝专注任务：补齐小目标、累计分钟、专注次数 */
    if(!Array.isArray(obj.memorials)) obj.memorials = [];
    obj.memorials = obj.memorials.filter(function(m){ return m && typeof m === 'object'; });
    obj.memorials.forEach(function(m, i){
      if(typeof m.focusMin !== 'number') m.focusMin = 0;
      /* 旧档只有 doneMin（按目标时长累计），迁移为累计专注分钟 */
      if(!m.focusMin && typeof m.doneMin === 'number' && m.doneMin > 0) m.focusMin = m.doneMin;
      if(typeof m.sessions !== 'number') m.sessions = 0;
      if(m.dueAt === undefined) m.dueAt = null;
      if(typeof m.updatedAt !== 'number') m.updatedAt = m.createdAt || Date.now();
      if(!Array.isArray(m.subtasks)) m.subtasks = [];
      m.subtasks = m.subtasks.filter(function(sb){ return sb && typeof sb === 'object'; });
      m.subtasks.forEach(function(sb, j){
        if(!sb.id) sb.id = 's' + i + j + '-' + Date.now().toString(36);
        if(typeof sb.title !== 'string') sb.title = '未命名小目标';
        sb.done = !!sb.done;
        if(!('doneAt' in sb)) sb.doneAt = null;
        if(typeof sb.focusMin !== 'number') sb.focusMin = 0;
      });
    });

    /* 旧的独立「专注任务」并入奏折：每条转成一折，避免数据丢失 */
    if(Array.isArray(obj.focusTasks) && obj.focusTasks.length){
      obj.focusTasks.forEach(function(t){
        if(!t || typeof t !== 'object' || !t.title) return;
        var subs = (Array.isArray(t.subtasks) ? t.subtasks : []).map(function(sb, j){
          return {
            id: sb.id || ('s' + j + '-' + Date.now().toString(36)),
            title: String(sb.title || '未命名小目标'),
            done: !!sb.done,
            doneAt: sb.doneAt || null,
            focusMin: (typeof sb.focusMin === 'number') ? sb.focusMin : 0
          };
        });
        var focus = subs.reduce(function(a, sb){ return a + (sb.focusMin || 0); }, 0);
        obj.memorials.push({
          id: 'mem_mig_' + Math.random().toString(36).slice(2, 8),
          title: String(t.title),
          note: '',
          tag: 'hanlin',
          priority: 'changzou',
          status: t.archived ? 'banjie' : 'daipi',
          createdAt: t.createdAt || Date.now(),
          updatedAt: Date.now(),
          finishedAt: t.archived ? Date.now() : null,
          subtasks: subs,
          focusMin: focus,
          sessions: 0
        });
      });
    }
    if('focusTasks' in obj) delete obj.focusTasks;

    /* 专注计时：统一正计时，清掉旧倒计时残留 */
    var PO = obj.pomodoro;
    if(PO && typeof PO === 'object'){
      PO.mode = 'open';
      if(!('boundSubtaskId' in PO)) PO.boundSubtaskId = null;
      if(typeof PO.title !== 'string') PO.title = '';
      if(!('lastTickAt' in PO)) PO.lastTickAt = null;
      PO.endsAt = null;       /* 正计时没有结束时刻 */
      PO.durationMin = 0;
      if('boundTaskId' in PO) delete PO.boundTaskId;
    }

    /* 旧「每日勤政任务」字段已废弃 */
    if('dailyTasks' in obj) delete obj.dailyTasks;
    return obj;
  }

  /* ---------- 存储适配：localStorage 不可用时退回内存 ---------- */
  var memory = {};
  var backend = 'memory';

  function readRaw(){
    try{
      return backend === 'local' ? localStorage.getItem(SAVE_KEY) : (memory[SAVE_KEY] || null);
    }catch(e){
      return null;
    }
  }

  function writeRaw(str){
    try{
      if(backend === 'local') localStorage.setItem(SAVE_KEY, str);
      else memory[SAVE_KEY] = str;
      return true;
    }catch(e){
      return false;
    }
  }

  /* ---------- 每日打卡跨日归档 ----------
     昨日目标折算得分写入 history（热力图数据源），随后清空今日目标 */
  function rolloverCheckin(state){
    var c = state.checkin;
    if(!c || typeof c !== 'object') return;
    var t = todayStr();
    if(!c.date) c.date = t;
    if(!c.history || typeof c.history !== 'object') c.history = {};
    if(c.date === t) return;

    if(QZD.checkin && QZD.checkin.archiveDay){
      QZD.checkin.archiveDay(c.date, c.goals, c.history);
    }
    c.date = t;
    c.goals = [];
    c.buff = null;
  }

  function pushLog(type, text){
    var s = QZD.state;
    s.logs.push({ ts: Date.now(), type: type, text: text });
    if(s.logs.length > 300) s.logs = s.logs.slice(-300);
  }

  function save(){
    QZD.state.meta.lastSavedAt = Date.now();
    return writeRaw(JSON.stringify(QZD.state));
  }

  function load(){
    var raw = readRaw();
    if(!raw){
      QZD.state = createState();
      rolloverCheckin(QZD.state);
      pushLog('system', '初登大宝，勤政殿开殿');
      save();
      return false;
    }
    try{
      var obj = JSON.parse(raw);
      if(!obj || !obj.meta || obj.meta.schemaVersion !== CFG.SCHEMA_VERSION){
        throw new Error('schema mismatch');
      }
      normalize(obj);
      QZD.state = obj;
      return true;
    }catch(e){
      QZD.state = createState();
      rolloverCheckin(QZD.state);
      pushLog('system', '旧档无法读取，已重新开殿');
      save();
      return false;
    }
  }

  function checkDailyReset(){
    var s = QZD.state;
    var today = todayStr();
    if(s.meta.lastDailyReset === today) return false;
    rolloverCheckin(s);
    s.meta.lastDailyReset = today;
    pushLog('daily', '新的一日，江山待兴');
    save();
    return true;
  }

  function exportFile(){
    save();
    var text = JSON.stringify(QZD.state, null, 2);
    var blob = new Blob([text], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = '勤政殿存档-' + todayStr() + '.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function(){ URL.revokeObjectURL(url); }, 0);
  }

  function importFile(file, done){
    var reader = new FileReader();
    reader.onload = function(){
      try{
        var obj = JSON.parse(String(reader.result));
        if(!obj || !obj.meta || obj.meta.schemaVersion !== CFG.SCHEMA_VERSION){
          throw new Error('存档版本不匹配（需要 schemaVersion ' + CFG.SCHEMA_VERSION + '）');
        }
        normalize(obj);
        QZD.state = obj;
        save();
        done(true, '存档已导入');
      }catch(err){
        done(false, err && err.message ? err.message : '存档解析失败');
      }
    };
    reader.onerror = function(){ done(false, '文件读取失败'); };
    reader.readAsText(file);
  }

  function wipe(){
    QZD.state = createState();
    rolloverCheckin(QZD.state);
    pushLog('system', '山河重开，旧档尽焚');
    save();
  }

  QZD.state = createState();
  QZD.stateIO = {
    probe: function(){
      try{
        localStorage.setItem('__qz_probe__', '1');
        localStorage.removeItem('__qz_probe__');
        backend = 'local';
      }catch(e){
        backend = 'memory';
      }
      return backend === 'local';
    },
    backend: function(){ return backend; },
    createState: createState,
    todayStr: todayStr,
    load: load,
    save: save,
    pushLog: pushLog,
    checkDailyReset: checkDailyReset,
    rolloverCheckin: function(){ rolloverCheckin(QZD.state); },
    exportFile: exportFile,
    importFile: importFile,
    wipe: wipe
  };
})();
