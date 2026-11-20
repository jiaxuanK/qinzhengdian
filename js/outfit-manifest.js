/* 自动生成：皇后装扮清单（部署版路径已混淆） */
window.QZD = window.QZD || {};
QZD.QUEEN_OUTFITS = {
  "root": "assets/images/皇后",
  "outfits": [
    {
      "name": "常服",
      "folder": "常服",
      "images": [
        "enc:YXNzZXRzL2E4Zi9jZTVkZDRiNjRmYmU3YzYyLmpwZw=="
      ],
      "cover": "enc:YXNzZXRzL2E4Zi9jZTVkZDRiNjRmYmU3YzYyLmpwZw=="
    },
    {
      "name": "swim",
      "folder": "swim",
      "images": [
        "enc:YXNzZXRzL2E4Zi9jN2IyYzk0N2U4OTVmYzhhLmpwZw==",
        "enc:YXNzZXRzL2E4Zi9jMjc3MmQ1NDRjZjEwMmY0LmpwZw==",
        "enc:YXNzZXRzL2E4Zi85ODg2MmI4NGQ0MGEzNmIxLmpwZw==",
        "enc:YXNzZXRzL2E4Zi9iMjA3Yjg4YjM4MGUwMmRjLmpwZw==",
        "enc:YXNzZXRzL2E4Zi80NWZjNWYwZWZhMjE3NGVlLmpwZw==",
        "enc:YXNzZXRzL2E4Zi9iOTAyMTE2YTc0OWJjMDRmLmpwZw==",
        "enc:YXNzZXRzL2E4Zi81MGI5Y2NjYzg5OGRiZjA4LmpwZw==",
        "enc:YXNzZXRzL2E4Zi9hMjA1ZWE3OGY0MmJlOGFiLmpwZw==",
        "enc:YXNzZXRzL2E4Zi8zMmEwNTVkMzE4YTE4NmRiLmpwZw=="
      ],
      "cover": "enc:YXNzZXRzL2E4Zi9jN2IyYzk0N2U4OTVmYzhhLmpwZw=="
    }
  ]
};

/* 部署版图片路径混淆：源码为明文，此文件运行时还原 QZD.ASSETS 路径。 */
(function(){function d(s){if(typeof s==='string'&&s.indexOf('enc:')===0){try{return atob(s.slice(4));}catch(e){return s;}}return s;}function w(o){if(typeof o==='string')return d(o);if(Array.isArray(o)){for(var i=0;i<o.length;i++)o[i]=w(o[i]);}else if(o&&typeof o==='object'){for(var k in o)o[k]=w(o[k]);}return o;}if(window.QZD&&window.QZD.ASSETS)w(window.QZD.ASSETS);if(window.QZD&&window.QZD.QUEEN_OUTFITS)w(window.QZD.QUEEN_OUTFITS);})();
