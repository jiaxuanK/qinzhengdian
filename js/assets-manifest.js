window.QZD = window.QZD || {};
QZD.ASSETS = {
  "emperor": [
    "enc:YXNzZXRzL2E4Zi84NTQ2MWFmYzMzMmFkOTk1LmpwZw==",
    "enc:YXNzZXRzL2E4Zi83YjNlZjU0MzYwZmMzMThkLmpwZw==",
    "enc:YXNzZXRzL2E4Zi8wMTU4YmY2ZDdmNjc1NGYxLmpwZw==",
    "enc:YXNzZXRzL2E4Zi8yNGQzNWYwMzZlZDVlNjk3LmpwZw=="
  ],
  "rare": [],
  "uncommon": [],
  "pool": []
};

/* 部署版图片路径混淆：源码为明文，此文件运行时还原 QZD.ASSETS 路径。 */
(function(){function d(s){if(typeof s==='string'&&s.indexOf('enc:')===0){try{return atob(s.slice(4));}catch(e){return s;}}return s;}function w(o){if(typeof o==='string')return d(o);if(Array.isArray(o)){for(var i=0;i<o.length;i++)o[i]=w(o[i]);}else if(o&&typeof o==='object'){for(var k in o)o[k]=w(o[k]);}return o;}if(window.QZD&&window.QZD.ASSETS)w(window.QZD.ASSETS);if(window.QZD&&window.QZD.QUEEN_OUTFITS)w(window.QZD.QUEEN_OUTFITS);})();
