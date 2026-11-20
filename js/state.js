/* ============================================================
   state.js · GameState 单例 + localStorage 存档 + 每日重置器
   三条铁律之一：所有系统只读写 QZD.state，UI 只读不写
   ============================================================ */
(function(){
  var CFG = QZD.config;
  var SAVE_KEY = CFG.SAVE_KEY;

  function pad(n){ return n < 10 ? '0' + n : '' + n; }

  /* 稀世妃子文件夹名 → 新文件夹名（旧档迁移用，读档时改写 rareKey 与 poses 路径）
     2026-11-04 起：assets/images 里的代号文件夹统一改为数字编号 01、02…
     下面 16 条把「新建文件夹 (N)」旧档接住，避免妃子失联。
     ⚠ 刻意覆盖 2026-11-02 那批同名映射（当时映射到 洛神/甄宓/…）——
        那批文件夹早已不存在，留着会把 11-04 新建的同名文件夹误认成旧档而串档。 */
  var RARE_RENAME = {
    '新建文件夹': '01', '新建文件夹 (2)': '02', '新建文件夹 (3)': '03',
    '新建文件夹 (4)': '04', '新建文件夹 (5)': '05', '新建文件夹 (6)': '06',
    '新建文件夹 (7)': '07', '新建文件夹 (8)': '08', '新建文件夹 (9)': '09',
    '新建文件夹 (10)': '10', '新建文件夹 (11)': '11', '新建文件夹 (12)': '12',
    '新建文件夹 (13)': '13', '新建文件夹 (14)': '14',
    '新建文件夹 (15)': '15', '新建文件夹 (16)': '16',
    /* 二次改名（诗意名 → 更好听的名字），与数字编号无关，保留 */
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
      /* 帝王四维成长日志：每次丹药真正生效记一点 { ts, key, v }，上限 200 条；旧档不追溯 */
      emperorGrowth: [],
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
        gained: { qinZheng: 0, jinQian: 0, guoJin: 0 },
        morningBoost: false,   /* 本场是否为晨课倍率场（金钱 ×1.5），结束即清 */
        signBonus: null        /* 本场晨课签约金（单独记账，不进 gained，避免污染分钟反推） */
      },
      /* 每日打卡：goals 为今日自建小目标，history 为历史得分（热力图数据源） */
      checkin: { date: todayStr(), goals: [], history: {}, buff: null },
      /* 11-19 登录打卡：精确记录每日上线；累计/连续天数 + 已领里程碑 */
      login: { lastDate: '', streak: 0, total: 0, claimed: [] },
      logs: [],
      /* M2+ 预留空壳：先建好，保证存档结构从第一版就稳定 */
      cities: [], territories: [],
      /* M3 名臣与科举：待录人才跨刷新保留，直到钦点 */
      ministers: [], keju: { candidates: [] },
      /* M4 后宫：待选秀女同样跨刷新保留 */
      consorts: [], xuanxiu: { candidates: [] }, princes: [], sleep: {},
      /* 皇后换装：outfit 存装扮文件夹名，空串表示用清单第一套；auto=false 表示用户手动选过 */
      queen: { outfit: '', poseIndex: 0, auto: true },
      bloodTalent: { dailyQinDate: '' },
      items: {},              /* 珍宝阁背包：itemId -> 数量 */
      /* 学习目标与偏好：把游戏节奏绑回真实专注 */
      settings: { focusQuiet: true, zen: false, chronosView: 'hour' },
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
        dayHour: {},         /* 专注分钟按「日期×小时」累计：{ 'YYYY-MM-DD': { h: min } }，供日程网格 */
        focusLog: [],        /* 专注流水：每场一条 { date,start,end,minutes,title,memorialId,subjectId,morning,full }，供时间轴显示任务名与连贯性 */
        subjects: [],        /* 课题（科研项目）列表：{ id, name } */
        subjectStats: {},    /* 专注分钟按课题累计：{ subjectId | 'none': minutes } */
        subjectDaily: {},    /* 按日期×课题：{ 'YYYY-MM-DD': { subjectId: min } } */
        abandonLog: [],      /* 中断记录：{ at, reason, minutes, title } */
        imperialDate: '',    /* 最近一次「御批」日期，保证每天只批一次 */
        morningDone: '',     /* 晨课日期戳：当日已收工领过奖励则为今天日期 */
        morningStarted: ''   /* 晨课开场日期戳：当日开始专注时已弹过剧情则为今天日期 */
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
      reading: { queue: [], pickDate: '', pickId: null },

      /* P0 开殿分配：内帑记账（主账户 resources.jinQian 即国库） */
      privy: {
        balance: 0, pendingDays: 0, tierId: (CFG.PRIVY && CFG.PRIVY.DEFAULT_TIER) || 'usual',
        totalCaptured: 0, totalAllocated: 0,
        lastSettledDate: '', lastShownDate: '', lastCountedDate: ''
      },
      /* L2：妃子自主生活的全局周结算 / 回归小结 */
      life: { lastSeenDate: '', lastSettledWeek: '', lastSummary: '' },
      /* S1/S2 剧情：已认领线 / 保底计数 / 旧档追认 / 片段冷却 / 起居注索引 */
      story: {
        version: 1, lines: {}, history: [], attempts: {}, retroDone: false,
        lastRollDate: '', lastNodeDate: '', lastSeenDate: '', lastReunionDate: '',
        forceUsedDate: '', recentFragments: [], fragmentOwner: {}, lastSummon: null
      },
      /* 11-19 国运：安定度槽 + 每日表现分档 + 各级惩罚叠加 + 周期资源罚 */
      dynasty: {
        stability: (CFG.DYNASTY && CFG.DYNASTY.INITIAL) || 80,
        level: 'calm', lastSettledDate: '', fired: [],
        crisisDays: 0, wasCrisis: false, restoredAt: 0,
        deepestLevel: 'calm',  /* 本次危机周期到达过的最深级别，用于 F3 奖励门槛 */
        lastLoginDate: '', lastDeedDate: '', lastPenaltyAt: 0,
        noDeedDays: 0, restoredGen: 0
      },
      /* 11-19 帝阶升级流：本代帝阶/累计专注/迎回名额/质子；亡国·传代归零 */
      regime: {
        generation: 1, rank: 1, focusMin: 0, hostageSlots: 0,
        fallCount: 0, hostages: [], bestRank: 1, restoreCount: 0,
        weekKey: '', generationStart: todayStr()
      },
      /* 历代年表：永久保存，传代时归档本代功过（P4 写入） */
      chronicle: [],
      /* 快捷栏：{ id, label, url, color, category, hideUrl }。
         点标签用系统浏览器/系统协议打开，不占游戏内存。category: ai/study/work/notes。 */
      quickLinks: (CFG.QUICK_LINKS || []).map(function(x, i){
        return { id: x.id || ('ql' + i), label: x.label, url: x.url,
                 color: x.color || '', category: x.category || 'study',
                 hideUrl: x.hideUrl !== false };
      }),
      /* 快捷栏分类：{ id, name, parentId }，parentId 为父分类 id、空串表示顶层。
         可无限层级嵌套；首项恒为 all（虚拟"全部"，不作归属）。 */
      quickCategories: (CFG.QUICK_CATEGORIES || [{id:'all',name:'全部'}]).map(function(c){
        return { id: c.id, name: c.name, parentId: c.parentId || '' };
      })
    };
  }

  /* 旧档补齐 M2/M3/M4/M5 字段，避免读档后某些模块拿到 undefined */
  function normalize(obj){
    /* meta 兜底：旧档可能缺字段 */
    if(!obj.meta || typeof obj.meta !== 'object') obj.meta = {};
    if(typeof obj.meta.schemaVersion !== 'number') obj.meta.schemaVersion = CFG.SCHEMA_VERSION;
    if(typeof obj.meta.createdAt !== 'number') obj.meta.createdAt = Date.now();
    if(typeof obj.meta.lastSavedAt !== 'number') obj.meta.lastSavedAt = obj.meta.createdAt;
    if(!obj.meta.lastDailyReset) obj.meta.lastDailyReset = todayStr();
    if(!obj.meta.emperorName) obj.meta.emperorName = '朕';

    if(!Array.isArray(obj.emperorGrowth)) obj.emperorGrowth = [];
    if(obj.emperorGrowth.length > 200) obj.emperorGrowth = obj.emperorGrowth.slice(-200);

    if(!Array.isArray(obj.cities)) obj.cities = [];
    if(!Array.isArray(obj.territories)) obj.territories = [];
    if(!Array.isArray(obj.ministers)) obj.ministers = [];
    obj.ministers.forEach(function(m){
      if(m && typeof m === 'object') m.fielded = !!m.fielded;
    });
    if(!obj.keju || !Array.isArray(obj.keju.candidates)) obj.keju = { candidates: [] };
    if(!Array.isArray(obj.consorts)) obj.consorts = [];

    /* 皇后：新档与旧档都补一位固定成员，置名册首位。
       她不参与选秀、不会被遣散；装扮状态单独存 obj.queen，立绘路径同步到 c.img/c.poses。 */
    if(!obj.queen || typeof obj.queen !== 'object' || Array.isArray(obj.queen)){
      obj.queen = { outfit: '', poseIndex: 0, auto: true };
    }
    if(typeof obj.queen.outfit !== 'string') obj.queen.outfit = '';
    if(typeof obj.queen.poseIndex !== 'number') obj.queen.poseIndex = 0;
    if(typeof obj.queen.auto !== 'boolean') obj.queen.auto = true;
    /* 血脉天赋账本：巫祝「每日首次专注 +1 勤政」按日期防重复 */
    if(!obj.bloodTalent || typeof obj.bloodTalent !== 'object' || Array.isArray(obj.bloodTalent)){
      obj.bloodTalent = {};
    }
    if(typeof obj.bloodTalent.dailyQinDate !== 'string') obj.bloodTalent.dailyQinDate = '';
    var QN = CFG.QUEEN || {};
    var qid = QN.ID || 'queen';
    var queen = null;
    for(var qi = 0; qi < obj.consorts.length; qi++){
      if(obj.consorts[qi] && obj.consorts[qi].id === qid){ queen = obj.consorts[qi]; break; }
    }
    if(!queen){
      queen = {
        id: qid, name: QN.NAME || '皇后', isQueen: true, rare: false,
        yan: (QN.ATTR && QN.ATTR.yan) || 78,
        ti:  (QN.ATTR && QN.ATTR.ti)  || 72,
        cai: (QN.ATTR && QN.ATTR.cai) || 76,
        personality: QN.PERSONALITY || 'duan',
        trait: QN.TRAIT || '通诗书',
        age: QN.AGE || 22, hometown: QN.HOMETOWN || '江南', origin: QN.ORIGIN || '名门嫡女',
        blood: QN.BLOOD || 'ren', veil: QN.VEIL === true,
        favor: QN.FAVOR != null ? QN.FAVOR : 40,
        dote:  QN.DOTE  != null ? QN.DOTE  : 20,
        rank: 5, joinedAt: Date.now(), pregnant: null,
        poses: [], poseIndex: 0, img: '', memory: [], milestones: 0, reunions: 0,
        address: '', phrase: '', storyPose: ''
      };
      obj.consorts.unshift(queen);
    }else{
      queen.isQueen = true;
    }

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
        if(!c || typeof c !== 'object' || c.isQueen) return; /* 皇后属性是配置值，不参与旧档缩放 */
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
    /* 皇后换装落盘：优先用存档里的装扮名，找不到就回退第一套。
       这里直接读清单，不依赖 systems/queen.js，所以测试/桌面老加载顺序也不会丢立绘。 */
    if(obj.queen && QZD.QUEEN_OUTFITS && Array.isArray(QZD.QUEEN_OUTFITS.outfits)){
      var O = QZD.QUEEN_OUTFITS.outfits, chosen = null;
      for(var oi = 0; oi < O.length; oi++){
        if(O[oi].name === obj.queen.outfit || O[oi].folder === obj.queen.outfit){ chosen = O[oi]; break; }
      }
      if(!chosen && O.length) chosen = O[0];
      if(chosen && queen){
        queen.poses = (chosen.images || []).slice();
        obj.queen.poseIndex = Math.max(0, Math.min(obj.queen.poseIndex || 0, Math.max(0, queen.poses.length - 1)));
        queen.poseIndex = obj.queen.poseIndex;
        queen.img = queen.poses[queen.poseIndex] || chosen.cover || '';
      }
    }
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
      if(!p || typeof p !== 'object') return;
      if(typeof p.trainCount !== 'number') p.trainCount = 0;
      /* M4 致仕：旧档皇子默认在册、未领过返还 */
      if(typeof p.retired !== 'boolean') p.retired = false;
      if(typeof p.retireRefunded !== 'number') p.retireRefunded = 0;
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
    /* 旧档 goal 可能缺 links 字段 */
    obj.goalTree.forEach(function(g){ if(!Array.isArray(g.links)) g.links = []; });
    if(!obj.study.hourStats || typeof obj.study.hourStats !== 'object') obj.study.hourStats = {};
    if(!obj.study.dayHour || typeof obj.study.dayHour !== 'object' || Array.isArray(obj.study.dayHour)) obj.study.dayHour = {};
    if(!Array.isArray(obj.study.focusLog)) obj.study.focusLog = [];
    if(!Array.isArray(obj.study.subjects)) obj.study.subjects = [];
    if(!obj.study.subjectStats || typeof obj.study.subjectStats !== 'object') obj.study.subjectStats = {};
    if(!obj.study.subjectDaily || typeof obj.study.subjectDaily !== 'object') obj.study.subjectDaily = {};
    if(!Array.isArray(obj.study.abandonLog)) obj.study.abandonLog = [];
    if(typeof obj.study.imperialDate !== 'string') obj.study.imperialDate = '';
    if(typeof obj.study.morningDone !== 'string') obj.study.morningDone = '';  /* 晨课旧档兼容 */
    if(typeof obj.study.morningStarted !== 'string') obj.study.morningStarted = '';  /* 晨课开场旧档兼容 */
    if(!obj.settings || typeof obj.settings !== 'object') obj.settings = { focusQuiet: true, zen: false };
    if(obj.settings.zen === undefined) obj.settings.zen = false;
    /* 钦天监记住上次看的视图（旧档补默认，切页不再回到「按时辰」） */
    if(typeof obj.settings.chronosView !== 'string') obj.settings.chronosView = 'hour';

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

    /* P0 开殿分配：旧档补齐小金库与妃子私房钱 */
    if(!obj.privy || typeof obj.privy !== 'object') obj.privy = {};
    var PV = obj.privy;
    if(typeof PV.balance !== 'number' || !isFinite(PV.balance)) PV.balance = 0;
    if(typeof PV.pendingDays !== 'number') PV.pendingDays = 0;
    /* 比例时代旧档兼容：splitRatio 字段废弃，改用固定金额档位 */
    if('splitRatio' in PV) delete PV.splitRatio;
    if(typeof PV.tierId !== 'string' || !PV.tierId){
      PV.tierId = (CFG.PRIVY && CFG.PRIVY.DEFAULT_TIER) || 'usual';
    }
    /* L2：妃子自主生活的全局状态补齐（个人 life 字段由 life.js 懒补齐） */
    if(!obj.life || typeof obj.life !== 'object') obj.life = {};
    if(typeof obj.life.lastSeenDate !== 'string') obj.life.lastSeenDate = '';
    if(typeof obj.life.lastSettledWeek !== 'string') obj.life.lastSettledWeek = '';
    if(typeof obj.life.lastSummary !== 'string') obj.life.lastSummary = '';
    if(typeof PV.totalCaptured !== 'number') PV.totalCaptured = 0;
    if(typeof PV.totalAllocated !== 'number') PV.totalAllocated = 0;
    if(typeof PV.lastSettledDate !== 'string') PV.lastSettledDate = '';
    if(typeof PV.lastShownDate !== 'string') PV.lastShownDate = '';
    if(typeof PV.lastCountedDate !== 'string') PV.lastCountedDate = '';
    obj.consorts.forEach(function(c){
      if(c && typeof c === 'object' && typeof c.purse !== 'number') c.purse = 0;
    });
    /* S1 剧情：旧档补齐全局状态与妃子的共同记忆 / 里程碑 / 专属称呼 */
    if(!obj.story || typeof obj.story !== 'object') obj.story = {};
    var SY = obj.story;
    if(typeof SY.version !== 'number') SY.version = 1;
    if(!SY.lines || typeof SY.lines !== 'object' || Array.isArray(SY.lines)) SY.lines = {};
    if(!Array.isArray(SY.history)) SY.history = [];
    if(!SY.attempts || typeof SY.attempts !== 'object' || Array.isArray(SY.attempts)) SY.attempts = {};
    if(typeof SY.retroDone !== 'boolean') SY.retroDone = false;
    if(typeof SY.lastRollDate !== 'string') SY.lastRollDate = '';
    if(typeof SY.lastNodeDate !== 'string') SY.lastNodeDate = '';
    if(typeof SY.lastSeenDate !== 'string') SY.lastSeenDate = '';
    if(typeof SY.lastReunionDate !== 'string') SY.lastReunionDate = '';
    if(typeof SY.forceUsedDate !== 'string') SY.forceUsedDate = '';
    if(!Array.isArray(SY.recentFragments)) SY.recentFragments = [];
    if(!SY.fragmentOwner || typeof SY.fragmentOwner !== 'object' || Array.isArray(SY.fragmentOwner)){
      SY.fragmentOwner = {};
    }
    if(!SY.lastSummon || typeof SY.lastSummon !== 'object') SY.lastSummon = null;
    /* F1/F2/F3 温和版国势：旧档补齐安定度状态（默认海晏河清，不追溯惩罚旧档） */
    if(!obj.dynasty || typeof obj.dynasty !== 'object') obj.dynasty = {};
    var DY = obj.dynasty;
    var DYI = (CFG.DYNASTY && CFG.DYNASTY.INITIAL) || 80;
    if(typeof DY.stability !== 'number' || !isFinite(DY.stability)) DY.stability = DYI;
    /* 11-19：取消上下限钳制，安定可为负、可 >80（dynasty.js clamp 只防 NaN） */
    if(typeof DY.level !== 'string' || !DY.level) DY.level = 'calm';
    if(typeof DY.lastSettledDate !== 'string') DY.lastSettledDate = '';
    if(!Array.isArray(DY.fired)) DY.fired = [];
    if(typeof DY.crisisDays !== 'number') DY.crisisDays = 0;
    if(typeof DY.wasCrisis !== 'boolean') DY.wasCrisis = false;
    if(typeof DY.restoredAt !== 'number') DY.restoredAt = 0;
    if(typeof DY.deepestLevel !== 'string' || !DY.deepestLevel) DY.deepestLevel = 'calm';
    /* 11-19 国运新字段 */
    if(typeof DY.lastLoginDate !== 'string') DY.lastLoginDate = '';
    if(typeof DY.lastDeedDate !== 'string') DY.lastDeedDate = '';
    if(typeof DY.lastPenaltyAt !== 'number') DY.lastPenaltyAt = 0;
    if(typeof DY.noDeedDays !== 'number') DY.noDeedDays = 0;
    if(typeof DY.restoredGen !== 'number') DY.restoredGen = 0;
    /* 11-19 帝阶升级流：旧档补默认；focusMin 首次 0（regime.S() 会按需从 history 补算） */
    if(!obj.regime || typeof obj.regime !== 'object') obj.regime = {};
    var RG = obj.regime;
    if(typeof RG.generation !== 'number' || RG.generation < 1) RG.generation = 1;
    if(typeof RG.rank !== 'number' || RG.rank < 1) RG.rank = 1;
    if(typeof RG.focusMin !== 'number' || !isFinite(RG.focusMin) || RG.focusMin < 0){
      /* 旧档：从 study.history 汇总最近 7 天专注，作为本代可追溯起点 */
      var hist = (obj.study && obj.study.history) || {}, _sum = 0, _now = Date.now();
      var _days = (CFG.REGIME && CFG.REGIME.CYCLE_DAYS) || 7;
      for(var _i = 0; _i < _days; _i++){
        var _d = new Date(_now - _i * 86400000);
        var _k = _d.getFullYear() + '-' + String(_d.getMonth()+1).padStart(2,'0') + '-' + String(_d.getDate()).padStart(2,'0');
        if(typeof hist[_k] === 'number' && isFinite(hist[_k])) _sum += hist[_k];
      }
      RG.focusMin = Math.max(0, Math.round(_sum));
      /* 补算专注后同步帝阶，避免旧档升级后首次专注连跳多阶、误弹多次晋升。
         用 config.RANKS 直接算（state.js 加载早于 regime.js，不能调其方法）。 */
      var _ranks = (CFG.REGIME && CFG.REGIME.RANKS) || [];
      var _rk = 1;
      for(var _ri = 0; _ri < _ranks.length; _ri++){
        if(RG.focusMin >= (_ranks[_ri].min || 0)) _rk = _ri + 1;
      }
      RG.rank = _rk;
      RG.bestRank = _rk;
      RG.hostageSlots = (_ranks[_rk - 1] && _ranks[_rk - 1].slots) || 0;
    }
    if(typeof RG.hostageSlots !== 'number' || RG.hostageSlots < 0) RG.hostageSlots = 0;
    if(typeof RG.fallCount !== 'number' || RG.fallCount < 0) RG.fallCount = 0;
    if(!Array.isArray(RG.hostages)) RG.hostages = [];
    if(typeof RG.bestRank !== 'number' || RG.bestRank < 1) RG.bestRank = RG.rank;
    if(typeof RG.restoreCount !== 'number' || RG.restoreCount < 0) RG.restoreCount = 0;
    if(typeof RG.weekKey !== 'string') RG.weekKey = '';
    if(typeof RG.generationStart !== 'string' || !RG.generationStart) RG.generationStart = todayStr();
    if(!Array.isArray(obj.chronicle)) obj.chronicle = [];
    /* 11-19 登录打卡：旧档补默认 */
    if(!obj.login || typeof obj.login !== 'object') obj.login = {};
    var LG = obj.login;
    if(typeof LG.lastDate !== 'string') LG.lastDate = '';
    if(typeof LG.streak !== 'number' || LG.streak < 0) LG.streak = 0;
    if(typeof LG.total !== 'number' || LG.total < 0) LG.total = 0;
    if(!Array.isArray(LG.claimed)) LG.claimed = [];
    /* 网页快捷栏：旧档没有则从预置补；有则清洗字段 */
    if(!Array.isArray(obj.quickLinks)){
      obj.quickLinks = (CFG.QUICK_LINKS || []).map(function(x, i){
        return { id: x.id || ('ql' + i), label: x.label, url: x.url,
                 color: x.color || '', category: x.category || 'study',
                 hideUrl: x.hideUrl !== false };
      });
    }else{
      obj.quickLinks = obj.quickLinks.filter(function(l){
        return l && typeof l === 'object' && typeof l.label === 'string' && typeof l.url === 'string';
      }).map(function(l, i){
        return { id: l.id || ('ql' + i), label: l.label.slice(0, 16), url: l.url,
                 color: typeof l.color === 'string' ? l.color : '',
                 category: ['ai','study','work','notes'].indexOf(l.category) >= 0 ? l.category : 'study',
                 hideUrl: l.hideUrl !== false };
      });
    }
    /* 快捷栏分类：旧档补预置；保证 all 存在且首位 */
    var PRESET_CATS = (CFG.QUICK_CATEGORIES || [{id:'all',name:'全部'}]);
    if(!Array.isArray(obj.quickCategories) || !obj.quickCategories.length){
      obj.quickCategories = PRESET_CATS.map(function(c){
        return { id:c.id, name:c.name, parentId:c.parentId || '' };
      });
    }else{
      obj.quickCategories = obj.quickCategories.filter(function(c){
        return c && typeof c === 'object' && typeof c.id === 'string' && typeof c.name === 'string';
      }).map(function(c){ return { id:c.id, name:c.name.slice(0, 10),
        parentId: typeof c.parentId === 'string' ? c.parentId : '' }; });
      if(!obj.quickCategories.some(function(c){ return c.id === 'all'; })){
        obj.quickCategories.unshift({ id:'all', name:'全部', parentId:'' });
      }
    }
    obj.consorts.forEach(function(c){
      if(!c || typeof c !== 'object') return;
      if(!Array.isArray(c.memory)) c.memory = [];
      if(typeof c.milestones !== 'number') c.milestones = 0;
      if(typeof c.reunions !== 'number') c.reunions = 0;
      if(typeof c.address !== 'string') c.address = '';
      if(typeof c.phrase !== 'string') c.phrase = '';
      if(typeof c.storyPose !== 'string') c.storyPose = '';
      /* 志怪血脉：旧档一律凡俗且未识破，不追溯、不凭空给旧妃子加身份 */
      var VALID_BLOOD = (CFG.BLOOD && CFG.BLOOD.LIST) || [];
      var bloodOK = false;
      for(var bi = 0; bi < VALID_BLOOD.length; bi++){
        if(VALID_BLOOD[bi].key === c.blood){ bloodOK = true; break; }
      }
      if(!bloodOK) c.blood = 'ren';
      if(typeof c.veil !== 'boolean') c.veil = false;
      if(c.blood === 'ren') c.veil = false;
    });
    /* 第十八轮：旧版独立「国库存银」一次性并回主账户，消除两个钱袋 */
    if(obj.treasury && typeof obj.treasury === 'object'){
      var legacyT = Number(obj.treasury.balance) || 0;
      if(legacyT > 0){
        if(!obj.resources || typeof obj.resources !== 'object') obj.resources = {};
        obj.resources.jinQian = (Number(obj.resources.jinQian) || 0) + legacyT;
      }
      delete obj.treasury;
    }

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
      /* 旧档官署/优先级 → 重要性/紧急性（一次性迁移，改存档） */
      var OLD_TAGS = { hanlin: 1, gongbu: 1, libu: 1, bingbu: 1 };
      var OLD_PRIO = { jizou: 'urgent', changzou: 'normal', huanzou: 'normal' };
      var NEW_TAGS = { important: 1, normal: 1 }, NEW_PRIO = { urgent: 1, normal: 1 };
      if(OLD_TAGS[m.tag] || !NEW_TAGS[m.tag]) m.tag = 'normal';
      if(OLD_PRIO[m.priority]) m.priority = OLD_PRIO[m.priority];
      else if(!NEW_PRIO[m.priority]) m.priority = 'normal';
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
      /* 晨课本场倍率/签约金旧档兼容：非进行中的场次不该带倍率 */
      if(typeof PO.morningBoost !== 'boolean') PO.morningBoost = false;
      if(PO.status !== 'running' && PO.status !== 'paused') PO.morningBoost = false;
      if(!('signBonus' in PO)) PO.signBonus = null;
    }

    /* 旧「每日勤政任务」字段已废弃 */
    if('dailyTasks' in obj) delete obj.dailyTasks;
    return obj;
  }

  /* ---------- 存储适配：IndexedDB 优先 → localStorage → memory ----------
     IndexedDB 在手机端无 5MB 限制，是 PWA 最优存档方案。
     但游戏启动是同步的，所以用 localStorage 做"快速首载"兜底，
     同时把存档异步镜像到 IndexedDB 做大数据量安全网。*/
  var memory = {};
  var backend = 'memory';         /* 'idb' | 'local' | 'memory' */
  var idbReady = false;
  var IDB_NAME = 'qzd-save';
  var IDB_STORE = 'saves';

  function openIDB(){
    return new Promise(function(resolve){
      if(!('indexedDB' in window)){ resolve(null); return; }
      var req = indexedDB.open(IDB_NAME, 1);
      req.onupgradeneeded = function(e){
        var db = e.target.result;
        if(!db.objectStoreNames.contains(IDB_STORE)){
          db.createObjectStore(IDB_STORE, { keyPath: 'key' });
        }
      };
      req.onsuccess = function(e){ resolve(e.target.result); };
      req.onerror = function(){ resolve(null); };
    });
  }

  function idbWrite(str){
    openIDB().then(function(db){
      if(!db) return;
      var tx = db.transaction(IDB_STORE, 'readwrite');
      tx.objectStore(IDB_STORE).put({ key: SAVE_KEY, val: str });
      idbReady = true;
    });
  }

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
      /* 同步写 localStorage，同时异步镜像到 IndexedDB（不阻塞主线程）*/
      idbWrite(str);
      return true;
    }catch(e){
      /* localStorage 爆 5MB 时的兜底 */
      memory[SAVE_KEY] = str;
      backend = 'memory';
      idbWrite(str);
      return true;
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
    /* 供回归测试精确验证旧档字段兼容（纯内存归一化，不写盘） */
    normalize: normalize,
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
