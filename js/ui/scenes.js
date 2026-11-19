/* ============================================================
   scenes.js · 三页顶部场景横幅（11-19）
   总览=金銮殿(唯一显示时辰) / 政务=御书房桌面 / 朝野=虚构舆图
   纯内联 SVG + CSS 变量换色，零图片、零常驻定时器。
   热区 data-scene-go 点击跳转对应页面，复用 UI.show。
   ============================================================ */
(function(){
  var UI = QZD.ui = QZD.ui || {};
  var S = UI.scenes = {};

  /* 手机专用取景：窄屏时改用更方的 viewBox，让场景本身放大填满 100px 横幅。
     只在这里读一次媒体查询；切屏后下次 renderPage 会重新生成横幅。 */
  function isMobile(){
    return typeof window !== 'undefined' && !!window.matchMedia &&
           window.matchMedia('(max-width:860px)').matches;
  }

  /* ---------- 总览 · 金銮殿（随时辰变化） ----------
     所有时辰相关元素带 class，由 css/scenes.css 按 body[data-ambient] 切换：
     .sc-sky-a/.sc-sky-b 渐变天色 · .sc-sun 日轮(位移) · .sc-moon 月 ·
     .sc-shadow 殿影(长短) · .sc-lantern 宫灯(夜亮) */
  function hall(mobile){
    return '' +
    '<svg class="scene-svg scene-hall" viewBox="' + (mobile ? '160 0 575 150' : '0 0 860 150') + '" preserveAspectRatio="' + (mobile ? 'xMidYMid meet' : 'xMidYMid slice') + '" role="img" aria-label="金銮殿时辰场景">' +
      '<defs>' +
        '<linearGradient id="scSky" x1="0" y1="0" x2="0" y2="1">' +
          '<stop class="sc-sky-a" offset="0"/><stop class="sc-sky-b" offset="1"/>' +
        '</linearGradient>' +
        '<linearGradient id="scRoof" x1="0" y1="0" x2="0" y2="1">' +
          '<stop offset="0" stop-color="#C98A2B"/><stop offset="1" stop-color="#8A5A18"/>' +
        '</linearGradient>' +
        '<linearGradient id="scWall" x1="0" y1="0" x2="0" y2="1">' +
          '<stop offset="0" stop-color="#9E4636"/><stop offset="1" stop-color="#7A3226"/>' +
        '</linearGradient>' +
      '</defs>' +
      '<rect class="sc-sky-fill" width="860" height="150" fill="url(#scSky)"/>' +
      /* 远山 */
      '<path d="M0 92 Q70 58 150 84 T320 80 T500 86 T680 78 T860 88 L860 150 L0 150 Z" fill="rgba(90,110,100,.18)"/>' +
      '<path d="M0 108 Q120 82 240 102 T480 98 T720 104 T860 100 L860 150 L0 150 Z" fill="rgba(70,90,82,.16)"/>' +
      /* 日/月 */
      '<circle class="sc-sun" cx="690" cy="42" r="19" fill="#F0B429"/>' +
      '<circle class="sc-sun-halo" cx="690" cy="42" r="30" fill="#F0B429" opacity=".18"/>' +
      '<path class="sc-moon" d="M712 30 A17 17 0 1 0 712 58 A13 13 0 1 1 712 30 Z" fill="#F3EFD8"/>' +
      /* 云 */
      '<g fill="rgba(255,255,255,.28)"><ellipse cx="180" cy="40" rx="52" ry="10"/><ellipse cx="230" cy="46" rx="38" ry="8"/>' +
      '<ellipse cx="560" cy="30" rx="44" ry="9"/></g>' +
      /* 殿影（随时辰长短） */
      '<ellipse class="sc-shadow" cx="470" cy="139" rx="250" ry="9" fill="rgba(40,30,20,.22)"/>' +
      /* 三层汉白玉台基 */
      '<rect x="300" y="126" width="360" height="10" rx="2" fill="#E6DFCE"/>' +
      '<rect x="316" y="117" width="328" height="9" rx="2" fill="#EFE9DA"/>' +
      '<rect x="332" y="109" width="296" height="8" rx="2" fill="#F6F1E4"/>' +
      /* 台阶 */
      '<path d="M396 126 L404 109 L456 109 L464 126 Z" fill="#DCD4BE"/>' +
      '<path d="M402 126 L408 109 M418 126 L421 109 M434 126 L434 109 M450 126 L447 109" stroke="#C4B99E" stroke-width="1"/>' +
      /* 栏杆 */
      '<g stroke="#D8CFB8" stroke-width="2">' +
        '<path d="M300 108 V98 M340 108 V98 M380 108 V98 M560 108 V98 M600 108 V98 M640 108 V98"/>' +
        '<path d="M298 99 H382 M558 99 H642"/></g>' +
      /* 殿身 */
      '<rect x="356" y="72" width="248" height="37" fill="url(#scWall)"/>' +
      '<g fill="#6E2A20"><rect x="368" y="78" width="10" height="31"/><rect x="410" y="78" width="10" height="31"/>' +
      '<rect x="452" y="78" width="10" height="31"/><rect x="494" y="78" width="10" height="31"/>' +
      '<rect x="536" y="78" width="10" height="31"/><rect x="578" y="78" width="10" height="31"/></g>' +
      /* 御座（热区 · 奏折） */
      '<g class="sc-hot" data-scene-go="memorials">' +
        '<rect x="452" y="70" width="56" height="48" fill="transparent" pointer-events="all"/>' +
        '<rect x="466" y="86" width="28" height="23" rx="2" fill="#B8862C" opacity=".9"/>' +
        '<path d="M470 86 V80 Q480 74 490 80 V86" fill="#C99A38" opacity=".9"/>' +
        '<title>御座 · 奏折</title>' +
      '</g>' +
      /* 重檐庑殿顶 */
      '<path d="M344 72 L480 40 L616 72 Z" fill="url(#scRoof)"/>' +
      '<path d="M334 72 L480 30 L626 72 Z" fill="#8A5A18" opacity=".0"/>' +
      '<path d="M356 60 L480 34 L604 60 Z" fill="url(#scRoof)"/>' +
      '<path d="M344 72 L480 42 L616 72" fill="none" stroke="#5E3C10" stroke-width="2"/>' +
      '<path d="M370 63 L480 40 L590 63" fill="none" stroke="#6E4815" stroke-width="1.5"/>' +
      /* 脊兽 */
      '<g fill="#5E3C10"><circle cx="466" cy="36" r="2"/><circle cx="480" cy="33" r="2"/><circle cx="494" cy="36" r="2"/></g>' +
      /* 宫灯（夜亮） */
      '<g class="sc-lantern"><circle cx="368" cy="82" r="4" fill="#E24B4A"/><circle cx="592" cy="82" r="4" fill="#E24B4A"/></g>' +
      /* 朝班名臣（热区 · 名册） */
      '<g class="sc-hot" data-scene-go="roster">' +
        '<rect x="238" y="108" width="52" height="40" fill="transparent" pointer-events="all"/>' +
        '<g fill="#4A4038"><circle cx="248" cy="122" r="5"/><path d="M241 128 h14 v12 h-14 Z"/>' +
        '<circle cx="272" cy="124" r="5"/><path d="M265 130 h14 v10 h-14 Z"/></g>' +
        '<title>朝班 · 名册</title>' +
      '</g>' +
      /* 帅旗（热区 · 征伐，新增意象替代"用人映射征伐"） */
      '<g class="sc-hot" data-scene-go="conquest">' +
        '<rect x="172" y="68" width="62" height="78" fill="transparent" pointer-events="all"/>' +
        '<path d="M188 138 V74" stroke="#5E3C10" stroke-width="2.5"/>' +
        '<path d="M188 76 L226 82 L188 92 Z" fill="#8C3B32"/>' +
        '<path d="M188 138 l-8 4 M188 138 l8 4" stroke="#5E3C10" stroke-width="2"/>' +
        '<title>帅旗 · 征伐</title>' +
      '</g>' +
      /* 纪年碑（热区 · 年表在设置页） */
      '<g class="sc-hot" data-scene-go="settings">' +
        '<rect x="614" y="94" width="50" height="52" fill="transparent" pointer-events="all"/>' +
        '<rect x="628" y="106" width="22" height="30" rx="2" fill="#9A9484"/>' +
        '<path d="M625 106 h28 l-4 -6 h-20 Z" fill="#B0AA98"/>' +
        '<path d="M634 114 h10 M634 120 h10 M634 126 h7" stroke="#6E6858" stroke-width="1"/>' +
        '<title>纪年碑 · 历代年表（设置页）</title>' +
      '</g>' +
      '<rect x="0" y="0" width="860" height="150" fill="none" stroke="rgba(90,80,60,.12)" stroke-width="3"/>' +
    '</svg>';
  }

  /* ---------- 金銮殿 · 手机紧凑版（495×150 填满 100px 横幅） ---------- */
  function hallCompact(){
    return '' +
    '<svg class="scene-svg scene-hall" viewBox="0 0 495 150" preserveAspectRatio="xMidYMid meet" role="img" aria-label="金銮殿时辰场景（手机）">' +
      '<defs>' +
        '<linearGradient id="scSkyM" x1="0" y1="0" x2="0" y2="1">' +
          '<stop class="sc-sky-a" offset="0"/><stop class="sc-sky-b" offset="1"/>' +
        '</linearGradient>' +
        '<linearGradient id="scRoofM" x1="0" y1="0" x2="0" y2="1">' +
          '<stop offset="0" stop-color="#C98A2B"/><stop offset="1" stop-color="#8A5A18"/>' +
        '</linearGradient>' +
        '<linearGradient id="scWallM" x1="0" y1="0" x2="0" y2="1">' +
          '<stop offset="0" stop-color="#9E4636"/><stop offset="1" stop-color="#7A3226"/>' +
        '</linearGradient>' +
      '</defs>' +
      '<rect class="sc-sky-fill" width="495" height="150" fill="url(#scSkyM)"/>' +
      '<path d="M0 92 Q60 60 120 84 T260 80 T400 86 L495 82 L495 150 L0 150 Z" fill="rgba(90,110,100,.18)"/>' +
      '<path d="M0 108 Q100 84 200 102 T400 98 L495 104 L495 150 L0 150 Z" fill="rgba(70,90,82,.16)"/>' +
      '<circle class="sc-sun" cx="450" cy="26" r="14" fill="#F0B429"/>' +
      '<circle class="sc-sun-halo" cx="450" cy="26" r="22" fill="#F0B429" opacity=".18"/>' +
      '<path class="sc-moon" d="M472 18 A14 14 0 1 0 472 42 A11 11 0 1 1 472 18 Z" fill="#F3EFD8"/>' +
      '<g fill="rgba(255,255,255,.28)"><ellipse cx="80" cy="34" rx="36" ry="7"/><ellipse cx="300" cy="28" rx="30" ry="6"/></g>' +
      '<ellipse class="sc-shadow" cx="255" cy="139" rx="150" ry="7" fill="rgba(40,30,20,.22)"/>' +
      '<rect x="135" y="126" width="240" height="8" rx="2" fill="#E6DFCE"/>' +
      '<rect x="148" y="117" width="214" height="8" rx="2" fill="#EFE9DA"/>' +
      '<rect x="162" y="109" width="186" height="7" rx="2" fill="#F6F1E4"/>' +
      '<path d="M225 126 L232 109 L270 109 L277 126 Z" fill="#DCD4BE"/>' +
      '<g stroke="#D8CFB8" stroke-width="1.5">' +
        '<path d="M140 108 V100 M175 108 V100 M210 108 V100 M320 108 V100 M355 108 V100 M390 108 V100"/>' +
        '<path d="M138 101 H212 M318 101 H392"/></g>' +
      '<rect x="186" y="72" width="160" height="30" fill="url(#scWallM)"/>' +
      '<g fill="#6E2A20"><rect x="196" y="77" width="7" height="25"/><rect x="226" y="77" width="7" height="25"/>' +
      '<rect x="256" y="77" width="7" height="25"/><rect x="286" y="77" width="7" height="25"/>' +
      '<rect x="316" y="77" width="7" height="25"/></g>' +
      '<g class="sc-hot" data-scene-go="memorials">' +
        '<rect x="242" y="70" width="42" height="36" fill="transparent" pointer-events="all"/>' +
        '<rect x="253" y="84" width="20" height="18" rx="2" fill="#B8862C" opacity=".9"/>' +
        '<path d="M256 84 V79 Q263 74 270 79 V84" fill="#C99A38" opacity=".9"/>' +
        '<title>御座 · 奏折</title>' +
      '</g>' +
      '<path d="M176 72 L266 42 L356 72 Z" fill="url(#scRoofM)"/>' +
      '<path d="M186 61 L266 36 L346 61 Z" fill="url(#scRoofM)"/>' +
      '<path d="M176 72 L266 44 L356 72" fill="none" stroke="#5E3C10" stroke-width="1.5"/>' +
      '<g fill="#5E3C10"><circle cx="258" cy="38" r="1.5"/><circle cx="266" cy="36" r="1.5"/><circle cx="274" cy="38" r="1.5"/></g>' +
      '<g class="sc-lantern"><circle cx="196" cy="80" r="3" fill="#E24B4A"/><circle cx="336" cy="80" r="3" fill="#E24B4A"/></g>' +
      '<g class="sc-hot" data-scene-go="conquest">' +
        '<rect x="28" y="65" width="44" height="76" fill="transparent" pointer-events="all"/>' +
        '<path d="M40 138 V80" stroke="#5E3C10" stroke-width="2"/>' +
        '<path d="M40 82 L70 87 L40 96 Z" fill="#8C3B32"/>' +
        '<title>帅旗 · 征伐</title>' +
      '</g>' +
      '<g class="sc-hot" data-scene-go="roster">' +
        '<rect x="88" y="108" width="44" height="38" fill="transparent" pointer-events="all"/>' +
        '<g fill="#4A4038"><circle cx="100" cy="122" r="4"/><path d="M95 127 h10 v11 h-10 Z"/>' +
        '<circle cx="120" cy="124" r="4"/><path d="M115 129 h10 v9 h-10 Z"/></g>' +
        '<title>朝班 · 名册</title>' +
      '</g>' +
      '<g class="sc-hot" data-scene-go="settings">' +
        '<rect x="452" y="94" width="38" height="44" fill="transparent" pointer-events="all"/>' +
        '<rect x="462" y="106" width="18" height="28" rx="2" fill="#9A9484"/>' +
        '<path d="M459 106 h24 l-3 -5 h-18 Z" fill="#B0AA98"/>' +
        '<path d="M467 113 h8 M467 119 h8 M467 125 h6" stroke="#6E6858" stroke-width="1"/>' +
        '<title>纪年碑 · 历代年表</title>' +
      '</g>' +
      '<rect x="0" y="0" width="495" height="150" fill="none" stroke="rgba(90,80,60,.18)" stroke-width="2"/>' +
    '</svg>';
  }

  /* ---------- 政务 · 御书房桌面（无时辰，纯入口） ---------- */
  function studyDesk(){
    return '' +
    '<svg class="scene-svg scene-desk" viewBox="0 0 860 150" preserveAspectRatio="xMidYMid meet" role="img" aria-label="御书房桌面">' +
      '<rect width="860" height="150" fill="#8E7557"/>' +
      '<rect x="6" y="6" width="848" height="138" rx="6" fill="none" stroke="#6F5638" stroke-width="2"/>' +
      '<rect x="12" y="12" width="836" height="126" rx="4" fill="none" stroke="#6F5638" stroke-width=".7" opacity=".5"/>' +
      /* 奏折堆（热区） */
      '<g class="sc-hot" data-scene-go="memorials">' +
        '<rect x="52" y="28" width="116" height="56" fill="transparent" pointer-events="all"/>' +
        '<g transform="rotate(-6 108 50)"><rect x="60" y="34" width="96" height="34" rx="2" fill="#E8DCC0" stroke="#A8573F" stroke-width="1.2"/>' +
        '<path d="M72 44 h72 M72 52 h60" stroke="#B9A98A" stroke-width="1"/></g>' +
        '<g transform="rotate(4 108 52)"><rect x="64" y="40" width="96" height="34" rx="2" fill="#F2E8CE" stroke="#A8573F" stroke-width="1.2"/>' +
        '<rect x="98" y="46" width="26" height="14" fill="#C0392B" opacity=".75"/>' +
        '<path d="M74 62 h72" stroke="#B9A98A" stroke-width="1"/></g>' +
        '<title>奏折堆 · 奏折页</title>' +
      '</g>' +
      /* 摊开文书（热区 · 修书） */
      '<g class="sc-hot" data-scene-go="thesis">' +
        '<rect x="220" y="22" width="196" height="72" fill="transparent" pointer-events="all"/>' +
        '<path d="M228 34 L318 28 L318 80 L228 86 Z" fill="#F2E8CE" stroke="#B9B2A0" stroke-width="1"/>' +
        '<path d="M318 28 L408 34 L408 86 L318 80 Z" fill="#E8DCC0" stroke="#B9B2A0" stroke-width="1"/>' +
        '<path d="M240 44 h66 M240 52 h58 M240 60 h66 M330 44 h66 M330 52 h60 M330 60 h66" stroke="#A89B7E" stroke-width="1"/>' +
        '<title>摊开文书 · 修书</title>' +
      '</g>' +
      /* 玉玺（热区 · 常课/御批） */
      '<g class="sc-hot" data-scene-go="checkin">' +
        '<rect x="468" y="12" width="68" height="78" fill="transparent" pointer-events="all"/>' +
        '<rect x="476" y="30" width="52" height="52" rx="6" fill="#6E5A7A" stroke="#C9A45C" stroke-width="2"/>' +
        '<path d="M494 30 V18 Q502 10 510 18 V30" fill="#8A7296" stroke="#C9A45C" stroke-width="1.5"/>' +
        '<rect x="486" y="54" width="32" height="20" fill="#A8573F" opacity=".85"/>' +
        '<title>玉玺 · 常课御批</title>' +
      '</g>' +
      /* 砚台 + 笔（热区 · 议事） */
      '<g class="sc-hot" data-scene-go="meetings">' +
        '<rect x="556" y="26" width="122" height="70" fill="transparent" pointer-events="all"/>' +
        '<rect x="566" y="46" width="56" height="34" rx="4" fill="#2E2C2A"/>' +
        '<ellipse cx="594" cy="60" rx="18" ry="9" fill="#1C1B1A"/>' +
        '<path d="M636 34 L672 78" stroke="#C9A45C" stroke-width="5" stroke-linecap="round"/>' +
        '<path d="M672 78 l6 9" stroke="#2E2C2A" stroke-width="4"/>' +
        '<title>砚笔 · 议事</title>' +
      '</g>' +
      /* 典籍（热区 · 文渊）——由原灵感笺位置改成叠放书册 */
      '<g class="sc-hot" data-scene-go="library">' +
        '<rect x="700" y="14" width="90" height="50" fill="transparent" pointer-events="all"/>' +
        '<g transform="rotate(-4 746 46)"><rect x="710" y="30" width="70" height="34" rx="2" fill="#8C6E4F" stroke="#6A5138" stroke-width="1"/>' +
        '<rect x="716" y="34" width="58" height="26" fill="#EFE6CE"/></g>' +
        '<g transform="rotate(5 744 42)"><rect x="708" y="22" width="72" height="34" rx="2" fill="#6E7A5A" stroke="#4E5A3E" stroke-width="1"/>' +
        '<rect x="714" y="26" width="60" height="26" fill="#F2E8CE"/>' +
        '<path d="M722 34 h44 M722 42 h38" stroke="#A89B7E" stroke-width="1"/></g>' +
        '<title>典籍 · 文渊</title>' +
      '</g>' +
      /* 宏图卷轴（热区 · 宏图）——左下空位 */
      '<g class="sc-hot" data-scene-go="goals">' +
        '<rect x="30" y="86" width="158" height="54" fill="transparent" pointer-events="all"/>' +
        '<rect x="42" y="96" width="132" height="34" rx="2" fill="#EFE6CE" stroke="#B09A6A" stroke-width="1"/>' +
        '<rect x="36" y="92" width="8" height="42" rx="3" fill="#9A7340"/>' +
        '<rect x="172" y="92" width="8" height="42" rx="3" fill="#9A7340"/>' +
        '<path d="M58 118 l14 -12 l12 12 l16 -16 l18 16 l20 -10 l14 10" fill="none" stroke="#8A9B72" stroke-width="1.5"/>' +
        '<circle cx="142" cy="108" r="3" fill="#A8573F"/>' +
        '<title>宏图卷轴 · 宏图</title>' +
      '</g>' +
      /* 宝匣（热区 · 灵感罐，替代原珍宝阁映射） */
      '<g class="sc-hot" data-scene-go="idea">' +
        '<rect x="690" y="84" width="128" height="54" fill="transparent" pointer-events="all"/>' +
        '<rect x="690" y="90" width="120" height="42" rx="4" fill="#4A3324" stroke="#C9A45C" stroke-width="1.5"/>' +
        '<path d="M690 104 h120" stroke="#C9A45C" stroke-width="1"/>' +
        '<rect x="736" y="98" width="28" height="12" rx="2" fill="#C9A45C"/>' +
        '<circle cx="750" cy="104" r="3" fill="#4A3324"/>' +
        '<g fill="#E7D98F"><circle cx="782" cy="99" r="2"/><circle cx="790" cy="112" r="1.5"/><circle cx="704" cy="122" r="1.5"/></g>' +
        '<title>宝匣 · 灵感罐</title>' +
      '</g>' +
      /* 烛台（装饰） */
      '<rect x="590" y="112" width="6" height="24" fill="#C9A45C"/>' +
      '<path d="M593 112 Q585 96 593 88 Q601 96 593 112" fill="#EF9F27" opacity=".85"/>' +
      '<ellipse cx="593" cy="136" rx="14" ry="4" fill="#C9A45C"/>' +
      '<rect x="0" y="0" width="860" height="150" fill="none" stroke="rgba(60,40,20,.25)" stroke-width="3"/>' +
    '</svg>';
  }

  /* ---------- 政务 · 手机两行版（7 个入口排进 495×150） ---------- */
  function studyDeskCompact(){
    return '' +
    '<svg class="scene-svg scene-desk" viewBox="0 0 495 150" preserveAspectRatio="xMidYMid meet" role="img" aria-label="御书房桌面（手机）">' +
      '<rect width="495" height="150" fill="#8E7557"/>' +
      '<rect x="4" y="4" width="487" height="142" rx="5" fill="none" stroke="#6F5638" stroke-width="2"/>' +
      /* 上排：奏折 / 文书 / 玉玺 / 典籍 */
      '<g class="sc-hot" data-scene-go="memorials">' +
        '<rect x="12" y="10" width="94" height="58" fill="transparent" pointer-events="all"/>' +
        '<g transform="rotate(-6 60 34)"><rect x="28" y="22" width="66" height="24" rx="2" fill="#E8DCC0" stroke="#A8573F" stroke-width="1.2"/></g>' +
        '<g transform="rotate(4 60 38)"><rect x="32" y="28" width="66" height="24" rx="2" fill="#F2E8CE" stroke="#A8573F" stroke-width="1.2"/>' +
        '<rect x="55" y="33" width="18" height="10" fill="#C0392B" opacity=".75"/></g>' +
        '<title>奏折堆 · 奏折</title>' +
      '</g>' +
      '<g class="sc-hot" data-scene-go="thesis">' +
        '<rect x="108" y="10" width="128" height="58" fill="transparent" pointer-events="all"/>' +
        '<path d="M112 22 L170 18 L170 58 L112 62 Z" fill="#F2E8CE" stroke="#B9B2A0" stroke-width="1"/>' +
        '<path d="M170 18 L228 22 L228 62 L170 58 Z" fill="#E8DCC0" stroke="#B9B2A0" stroke-width="1"/>' +
        '<path d="M120 30 h40 M120 38 h36 M180 30 h40 M180 38 h36" stroke="#A89B7E" stroke-width="1"/>' +
        '<title>摊开文书 · 修书</title>' +
      '</g>' +
      '<g class="sc-hot" data-scene-go="checkin">' +
        '<rect x="246" y="6" width="58" height="58" fill="transparent" pointer-events="all"/>' +
        '<rect x="254" y="22" width="42" height="42" rx="5" fill="#6E5A7A" stroke="#C9A45C" stroke-width="2"/>' +
        '<path d="M266 22 V14 Q275 8 284 14 V22" fill="#8A7296" stroke="#C9A45C" stroke-width="1.5"/>' +
        '<rect x="262" y="40" width="26" height="16" fill="#A8573F" opacity=".85"/>' +
        '<title>玉玺 · 常课御批</title>' +
      '</g>' +
      '<g class="sc-hot" data-scene-go="library">' +
        '<rect x="386" y="8" width="98" height="56" fill="transparent" pointer-events="all"/>' +
        '<g transform="rotate(-4 435 36)"><rect x="400" y="24" width="68" height="30" rx="2" fill="#8C6E4F" stroke="#6A5138" stroke-width="1"/><rect x="406" y="28" width="56" height="22" fill="#EFE6CE"/></g>' +
        '<g transform="rotate(5 433 30)"><rect x="398" y="16" width="70" height="30" rx="2" fill="#6E7A5A" stroke="#4E5A3E" stroke-width="1"/><rect x="404" y="20" width="58" height="22" fill="#F2E8CE"/>' +
        '<path d="M410 28 h44 M410 36 h38" stroke="#A89B7E" stroke-width="1"/></g>' +
        '<title>典籍 · 文渊</title>' +
      '</g>' +
      /* 下排：宏图卷轴 / 砚笔 / 宝匣 */
      '<g class="sc-hot" data-scene-go="goals">' +
        '<rect x="12" y="78" width="132" height="64" fill="transparent" pointer-events="all"/>' +
        '<rect x="22" y="90" width="114" height="34" rx="2" fill="#EFE6CE" stroke="#B09A6A" stroke-width="1"/>' +
        '<rect x="16" y="86" width="7" height="42" rx="3" fill="#9A7340"/>' +
        '<rect x="135" y="86" width="7" height="42" rx="3" fill="#9A7340"/>' +
        '<path d="M36 110 l12 -10 l10 10 l14 -14 l16 14 l18 -9 l12 9" fill="none" stroke="#8A9B72" stroke-width="1.5"/>' +
        '<circle cx="120" cy="100" r="3" fill="#A8573F"/>' +
        '<title>宏图卷轴 · 宏图</title>' +
      '</g>' +
      '<g class="sc-hot" data-scene-go="meetings">' +
        '<rect x="176" y="78" width="120" height="64" fill="transparent" pointer-events="all"/>' +
        '<rect x="186" y="96" width="48" height="30" rx="4" fill="#2E2C2A"/>' +
        '<ellipse cx="210" cy="108" rx="15" ry="8" fill="#1C1B1A"/>' +
        '<path d="M244 84 L276 122" stroke="#C9A45C" stroke-width="5" stroke-linecap="round"/>' +
        '<path d="M276 122 l5 8" stroke="#2E2C2A" stroke-width="4"/>' +
        '<title>砚笔 · 议事</title>' +
      '</g>' +
      '<g class="sc-hot" data-scene-go="idea">' +
        '<rect x="344" y="78" width="142" height="64" fill="transparent" pointer-events="all"/>' +
        '<rect x="352" y="90" width="128" height="46" rx="4" fill="#4A3324" stroke="#C9A45C" stroke-width="1.5"/>' +
        '<path d="M352 104 h128" stroke="#C9A45C" stroke-width="1"/>' +
        '<rect x="404" y="98" width="26" height="12" rx="2" fill="#C9A45C"/>' +
        '<circle cx="417" cy="104" r="3" fill="#4A3324"/>' +
        '<g fill="#E7D98F"><circle cx="460" cy="100" r="2"/><circle cx="468" cy="122" r="1.5"/></g>' +
        '<title>宝匣 · 灵感罐</title>' +
      '</g>' +
      /* 烛台（装饰） */
      '<rect x="312" y="108" width="5" height="24" fill="#C9A45C"/>' +
      '<path d="M314 108 Q307 96 314 88 Q321 96 314 108" fill="#EF9F27" opacity=".85"/>' +
      '<ellipse cx="314" cy="132" rx="12" ry="4" fill="#C9A45C"/>' +
      '<rect x="0" y="0" width="495" height="150" fill="none" stroke="rgba(60,40,20,.25)" stroke-width="3"/>' +
    '</svg>';
  }

  /* ---------- 朝野 · 虚构舆图（无时辰，疆域状态） ----------
     原创虚构大陆，非现实世界地图，不涉及真实国界/领土。 */
  function worldMap(mobile){
    var consorts = (QZD.state && QZD.state.consorts) || [];
    var territories = (QZD.state && QZD.state.territories) || [];
    var ownedN = territories.length;
    return '' +
    '<svg class="scene-svg scene-map" viewBox="' + (mobile ? '235 0 545 150' : '0 0 860 150') + '" preserveAspectRatio="' + (mobile ? 'xMidYMid meet' : 'xMidYMid slice') + '" role="img" aria-label="虚构疆域舆图">' +
      '<defs><linearGradient id="scSkyMap" x1="0" y1="0" x2="0" y2="1">' +
        '<stop class="sc-sky-a" offset="0"/><stop class="sc-sky-b" offset="1"/>' +
      '</linearGradient></defs>' +
      /* 天空 + 日月（与金銮殿共用时辰变量） */
      '<rect width="860" height="150" fill="url(#scSkyMap)"/>' +
      '<circle class="sc-sun" cx="700" cy="36" r="16" fill="#F0B429"/>' +
      '<circle class="sc-sun-halo" cx="700" cy="36" r="26" fill="#F0B429" opacity=".18"/>' +
      '<path class="sc-moon" d="M730 20 A20 20 0 1 0 730 56 A16 16 0 1 1 730 20 Z" fill="#F3EFD8"/>' +
      '<g fill="rgba(255,255,255,.3)"><ellipse cx="120" cy="32" rx="42" ry="8"/>' +
      '<ellipse cx="168" cy="38" rx="30" ry="6"/></g>' +
      /* 虚构大陆及元素整体放大 1.2 倍（绕大陆中心 385,80），天空/文字不放大 */
      '<g transform="translate(-77,-16) scale(1.2)">' +
      /* 虚构大陆（原创轮廓） */
      '<path d="M150 74 Q182 40 246 44 L300 30 L362 42 Q402 36 436 54 L500 48 L548 66 L596 60 Q636 74 620 104 L560 118 Q500 128 452 112 L392 120 Q330 128 286 108 L214 112 Q168 100 150 74 Z" fill="#C7BCA0" stroke="#9C8F6E" stroke-width="1.5"/>' +
      /* 山脉 */
      '<path d="M240 70 l16 -18 l16 18 M286 66 l14 -16 l14 16 M420 74 l16 -18 l16 18 M470 82 l14 -16 l14 16" fill="none" stroke="#8E8266" stroke-width="1.5"/>' +
      /* 内陆河（保留在大陆内，非外部海纹） */
      '<path d="M300 96 Q360 88 410 100 Q470 112 540 98" fill="none" stroke="#8FB6C4" stroke-width="2"/>' +
      /* 驿路（虚线） */
      '<path d="M214 96 L300 74 L410 82 L548 88" fill="none" stroke="#8A7A54" stroke-width="1.5" stroke-dasharray="4 3"/>' +
      /* 敌城标记（热区 · 征伐）——放大到可辨识尺寸 */
      '<g class="sc-hot" data-scene-go="conquest">' +
        '<rect x="532" y="48" width="76" height="70" fill="transparent" pointer-events="all"/>' +
        '<rect x="548" y="72" width="30" height="30" rx="2" fill="#8C3B32"/>' +
        '<path d="M548 72 v-9 l7 4 l8 -4 l7 4 l8 -4 v9" fill="#8C3B32"/>' +
        '<path d="M553 102 v-8 h6 v8 M567 102 v-8 h6 v8" fill="#7A3028"/>' +
        '<circle cx="563" cy="86" r="4" fill="#F6E7E3"/>' +
        '<title>敌城 · 征伐页</title>' +
      '</g>' +
      /* 宫殿/名册（热区）——黄顶红房，放大 */
      '<g class="sc-hot" data-scene-go="roster">' +
        '<rect x="272" y="32" width="80" height="70" fill="transparent" pointer-events="all"/>' +
        '<rect x="290" y="64" width="38" height="24" fill="#A64034" stroke="#7C2E26" stroke-width="1"/>' +
        '<rect x="304" y="72" width="10" height="16" fill="#6E2A24"/>' +
        '<path d="M282 64 L309 44 L336 64 Z" fill="#E5B23C" stroke="#A97816" stroke-width="1"/>' +
        '<path d="M286 64 h46" stroke="#F2CE6C" stroke-width="2"/>' +
        '<title>宫阙 · 名册</title>' +
      '</g>' +
      /* 驿站（热区 · 营造）——放大 */
      '<g class="sc-hot" data-scene-go="works">' +
        '<rect x="374" y="48" width="74" height="68" fill="transparent" pointer-events="all"/>' +
        '<rect x="398" y="72" width="24" height="24" fill="#4C6E8C"/>' +
        '<path d="M410 72 v-8 M398 84 h24" stroke="#4C6E8C" stroke-width="2"/>' +
        '<rect x="405" y="81" width="9" height="9" fill="#E2EBEF"/>' +
        '<title>驿站 · 营造</title>' +
      '</g>' +
      /* 烽烟（国破/边患时显示，由国运属性控制） */
      '<g class="sc-beacon"><path d="M563 62 q-8 -14 1 -24 q-4 -10 5 -18" fill="none" stroke="#8C3B32" stroke-width="2" opacity=".7"/>' +
      '<circle cx="569" cy="24" r="7" fill="#A8573F" opacity=".4"/></g>' +
      /* 旗帜（帝阶越高越多，静态 3 面代表当前） */
      '<g fill="#A8573F"><path d="M350 60 v-18 l14 4 l-14 5 Z"/><path d="M452 68 v-16 l12 4 l-12 5 Z"/><path d="M500 74 v-14 l10 3 l-10 4 Z"/></g>' +
      /* 已控城池点位：按属地数量点亮 */
      '<g class="sc-cities"></g>' +
      '</g>' +
      '<text x="' + (mobile ? 245 : 26) + '" y="' + (mobile ? 12 : 30) + '" fill="#6E6858" font-size="12" font-family="serif"> fiction · 寰宇舆图</text>' +
      '<text x="' + (mobile ? 245 : 26) + '" y="' + (mobile ? 145 : 130) + '" fill="#7C7869" font-size="11" font-family="serif">已控城池 ' + ownedN + ' · 后宫 ' + consorts.length + '</text>' +
      '<rect x="0" y="0" width="860" height="150" fill="none" stroke="rgba(90,80,60,.15)" stroke-width="3"/>' +
    '</svg>';
  }

  /* ---------- 舆图 · 手机紧凑版（495×150 填满 100px 横幅） ---------- */
  function worldMapCompact(){
    var consorts = (QZD.state && QZD.state.consorts) || [];
    var territories = (QZD.state && QZD.state.territories) || [];
    var ownedN = territories.length;
    return '' +
    '<svg class="scene-svg scene-map" viewBox="0 0 495 150" preserveAspectRatio="xMidYMid meet" role="img" aria-label="虚构疆域舆图（手机）">' +
      '<defs><linearGradient id="scSkyMapM" x1="0" y1="0" x2="0" y2="1">' +
        '<stop class="sc-sky-a" offset="0"/><stop class="sc-sky-b" offset="1"/>' +
      '</linearGradient></defs>' +
      '<rect width="495" height="150" fill="url(#scSkyMapM)"/>' +
      '<circle class="sc-sun" cx="435" cy="28" r="13" fill="#F0B429"/>' +
      '<circle class="sc-sun-halo" cx="435" cy="28" r="21" fill="#F0B429" opacity=".18"/>' +
      '<path class="sc-moon" d="M462 18 A14 14 0 1 0 462 42 A11 11 0 1 1 462 18 Z" fill="#F3EFD8"/>' +
      '<g fill="rgba(255,255,255,.3)"><ellipse cx="70" cy="26" rx="28" ry="5"/></g>' +
      '<path d="M55 78 Q82 50 132 52 L172 40 L222 50 Q252 44 278 58 L322 54 L352 68 L388 64 Q414 78 402 100 L360 112 Q316 120 280 110 L236 116 Q192 120 156 104 L108 108 Q70 98 55 78 Z" fill="#C7BCA0" stroke="#9C8F6E" stroke-width="1.2"/>' +
      '<path d="M150 68 l11 -13 l11 13 M190 64 l10 -12 l10 12 M270 72 l11 -13 l11 13 M305 78 l10 -12 l10 12" fill="none" stroke="#8E8266" stroke-width="1.2"/>' +
      '<path d="M185 94 Q240 88 285 98 Q330 106 370 94" fill="none" stroke="#8FB6C4" stroke-width="1.5"/>' +
      '<path d="M120 94 L185 76 L275 82 L360 86" fill="none" stroke="#8A7A54" stroke-width="1.2" stroke-dasharray="3 3"/>' +
      '<g class="sc-hot" data-scene-go="conquest">' +
        '<rect x="342" y="58" width="42" height="48" fill="transparent" pointer-events="all"/>' +
        '<rect x="350" y="70" width="26" height="26" rx="2" fill="#8C3B32"/>' +
        '<path d="M350 70 v-7 l6 3 l7 -3 l6 3 l7 -3 v7" fill="#8C3B32"/>' +
        '<circle cx="363" cy="83" r="3" fill="#F6E7E3"/>' +
        '<title>敌城 · 征伐</title>' +
      '</g>' +
      '<g class="sc-hot" data-scene-go="roster">' +
        '<rect x="118" y="46" width="52" height="50" fill="transparent" pointer-events="all"/>' +
        '<rect x="128" y="64" width="32" height="20" fill="#A64034" stroke="#7C2E26" stroke-width="1"/>' +
        '<rect x="139" y="70" width="9" height="14" fill="#6E2A24"/>' +
        '<path d="M123 64 L144 50 L165 64 Z" fill="#E5B23C" stroke="#A97816" stroke-width="1"/>' +
        '<title>宫阙 · 名册</title>' +
      '</g>' +
      '<g class="sc-hot" data-scene-go="works">' +
        '<rect x="225" y="62" width="40" height="42" fill="transparent" pointer-events="all"/>' +
        '<rect x="233" y="72" width="20" height="20" fill="#4C6E8C"/>' +
        '<path d="M243 72 v-6 M233 80 h20" stroke="#4C6E8C" stroke-width="1.5"/>' +
        '<title>驿站 · 营造</title>' +
      '</g>' +
      '<g class="sc-beacon"><path d="M363 62 q-6 -10 1 -17 q-3 -7 3 -12" fill="none" stroke="#8C3B32" stroke-width="1.5" opacity=".7"/></g>' +
      '<g fill="#A8573F"><path d="M205 58 v-14 l11 3 l-11 4 Z"/><path d="M292 62 v-12 l10 3 l-10 4 Z"/></g>' +
      '<text x="8" y="15" fill="#6E6858" font-size="10" font-family="serif"> fiction · 寰宇舆图</text>' +
      '<text x="8" y="143" fill="#7C7869" font-size="10" font-family="serif">已控城池 ' + ownedN + ' · 后宫 ' + consorts.length + '</text>' +
      '<rect x="0" y="0" width="495" height="150" fill="none" stroke="rgba(90,80,60,.18)" stroke-width="2"/>' +
    '</svg>';
  }

  /* 按当前页面 id 返回横幅 HTML；返回空串表示无横幅 */
  S.banner = function(pageId){
    var kind = (pageId === 'overview' || pageId === 'summary' || pageId === 'ov') ? 'hall'
             : (pageId === 'research' || pageId === 'tasks' || pageId === 'memorials' ||
                pageId === 'thesis' || pageId === 'library' || pageId === 'meetings' ||
                pageId === 'goals' || pageId === 'checkin') ? 'desk'
             : (pageId === 'court' || pageId === 'roster' || pageId === 'conquest' ||
                pageId === 'works' || pageId === 'treasure' || pageId === 'logs') ? 'map'
             : '';
    if(!kind) return '';
    var mob = isMobile();
    var svg = kind === 'hall' ? (mob ? hallCompact() : hall())
            : kind === 'desk' ? (mob ? studyDeskCompact() : studyDesk())
            : (mob ? worldMapCompact() : worldMap(false));
    return '<div class="scene-banner scene-banner-' + kind + '">' + svg + '</div>';
  };

  /* 入口点击委托：一次绑定，事件冒泡到 document */
  document.addEventListener('click', function(e){
    var t = e.target && e.target.closest ? e.target.closest('[data-scene-go]') : null;
    if(!t) return;
    var go = t.getAttribute('data-scene-go');
    if(!go || !UI.show) return;
    UI.show(go);
  });

  QZD.scenes = S;
})();
