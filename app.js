/* browserquark io · client-side browser fingerprint viewer. Reads standard web APIs locally;
   nothing is uploaded. Labels come from window.FPL (set per page). */
(function(){
  var L = window.FPL || {};
  function h32(str){ // tiny FNV-1a 32-bit hash -> hex
    var h = 0x811c9dc5;
    for (var i=0;i<str.length;i++){ h ^= str.charCodeAt(i); h = (h + ((h<<1)+(h<<4)+(h<<7)+(h<<8)+(h<<24)))>>>0; }
    return ("0000000"+h.toString(16)).slice(-8);
  }
  function canvasFP(){
    try{
      var c=document.createElement("canvas"); c.width=240; c.height=60;
      var x=c.getContext("2d"); x.textBaseline="top"; x.font="16px 'Arial'";
      x.fillStyle="#069"; x.fillRect(2,2,200,30);
      x.fillStyle="#a02"; x.fillText("Quark fingerprint ⚡ 什么 124",4,4);
      x.strokeStyle="rgba(0,120,200,0.6)"; x.beginPath(); x.arc(60,30,18,0,Math.PI*2); x.stroke();
      return h32(c.toDataURL());
    }catch(e){ return null; }
  }
  function webgl(){
    var out={vendor:null,renderer:null,fp:null};
    try{
      var c=document.createElement("canvas");
      var gl=c.getContext("webgl")||c.getContext("experimental-webgl");
      if(!gl) return out;
      var dbg=gl.getExtension("WEBGL_debug_renderer_info");
      if(dbg){ out.vendor=gl.getParameter(dbg.UNMASKED_VENDOR_WEBGL);
               out.renderer=gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL); }
      var parts=[gl.getParameter(gl.VERSION),gl.getParameter(gl.SHADING_LANGUAGE_VERSION),
                 gl.getParameter(gl.MAX_TEXTURE_SIZE),(gl.getSupportedExtensions()||[]).join(",")];
      out.fp=h32(parts.join("~")+"|"+(out.renderer||""));
      return out;
    }catch(e){ return out; }
  }
  function audioFP(){
    try{
      var OC=window.OfflineAudioContext||window.webkitOfflineAudioContext;
      if(!OC) return null;
      var ctx=new OC(1,4410,44100), osc=ctx.createOscillator(), comp=ctx.createDynamicsCompressor();
      osc.type="triangle"; osc.frequency.value=10000; osc.connect(comp); comp.connect(ctx.destination); osc.start(0);
      // synchronous-ish: hash compressor params (stable per engine) - avoids async render flakiness
      return h32([comp.threshold.value,comp.knee.value,comp.ratio.value,comp.attack.value,ctx.sampleRate].join(","));
    }catch(e){ return null; }
  }
  function detectFonts(){
    try{
      var base=["monospace","sans-serif","serif"], test="mmmmmmmmmmlli中文AbC1",
          cands=["Arial","Courier New","Times New Roman","Georgia","Verdana","Tahoma","Segoe UI",
                 "Microsoft YaHei","SimSun","Helvetica","Roboto","Consolas","Comic Sans MS"];
      var span=document.createElement("span"); span.style.cssText="position:absolute;left:-9999px;font-size:48px";
      span.textContent=test; document.body.appendChild(span);
      var def={};
      base.forEach(function(b){ span.style.fontFamily=b; def[b]={w:span.offsetWidth,h:span.offsetHeight}; });
      var found=[];
      cands.forEach(function(f){
        var hit=false;
        base.forEach(function(b){ span.style.fontFamily="'"+f+"',"+b;
          if(span.offsetWidth!==def[b].w||span.offsetHeight!==def[b].h) hit=true; });
        if(hit) found.push(f);
      });
      document.body.removeChild(span);
      return found;
    }catch(e){ return []; }
  }
  function scan(){
    var n=navigator, s=screen, na=L.na||"n/a";
    var tz=na, tzoff=na;
    try{ tz=Intl.DateTimeFormat().resolvedOptions().timeZone||na; }catch(e){}
    try{ tzoff=(new Date()).getTimezoneOffset(); }catch(e){}
    var wg=webgl(), cfp=canvasFP(), afp=audioFP(), fonts=detectFonts();
    var storage=na; try{ localStorage.setItem("_t","1"); localStorage.removeItem("_t"); storage="OK"; }catch(e){ storage=na; }
    // illustrative entropy estimate (NOT a server measurement)
    var bits=0; [n.userAgent,(n.languages||[]).join(","),s.width+"x"+s.height+"x"+(s.colorDepth||""),
                 tz,cfp,wg.fp,wg.renderer,afp,fonts.join(",")].forEach(function(v){ if(v) bits+=2.0; });
    bits=Math.round(Math.min(bits,18.1)*10)/10;
    var rows=[
      [L.ua, n.userAgent],
      [L.platform, n.platform||na],
      [L.vendor, n.vendor||na],
      [L.langs, (n.languages||[n.language]).join(", ")||na],
      [L.tz, tz],
      [L.tzoff, tzoff],
      [L.screen, s.width+" x "+s.height],
      [L.viewport, window.innerWidth+" x "+window.innerHeight],
      [L.depth, (s.colorDepth||na)+"-bit"],
      [L.dpr, window.devicePixelRatio||na],
      [L.cores, n.hardwareConcurrency||na],
      [L.mem, n.deviceMemory||na],
      [L.touch, (n.maxTouchPoints!=null?n.maxTouchPoints:na)],
      [L.canvas, cfp||na],
      [L.webglv, wg.vendor||na],
      [L.webglr, wg.renderer||na],
      [L.webglf, wg.fp||na],
      [L.audio, afp||na],
      [L.cookies, n.cookieEnabled?"true":"false"],
      [L.dnt, (n.doNotTrack||window.doNotTrack||na)],
      [L.storage, storage],
      [L.fonts, fonts.join(", ")||na],
      [L.uniqueness, "~"+bits+" bits"]
    ];
    return rows;
  }
  function esc(s){ return (""+s).replace(/&/g,"&amp;").replace(/</g,"&lt;"); }
  function render(){
    var rows=scan(), tb=document.getElementById("fp");
    if(!tb) return;
    var th="<tr><th>"+esc(L.field||"Signal")+"</th><th>"+esc(L.value||"Value")+"</th></tr>";
    tb.innerHTML=th+rows.map(function(r){ return "<tr><td>"+esc(r[0])+"</td><td>"+esc(r[1])+"</td></tr>"; }).join("");
    window.__fp=rows;
  }
  function copyJSON(){
    var o={}; (window.__fp||[]).forEach(function(r){ o[r[0]]=r[1]; });
    var txt=JSON.stringify(o,null,2);
    if(navigator.clipboard&&navigator.clipboard.writeText){ navigator.clipboard.writeText(txt); }
    else { var t=document.createElement("textarea"); t.value=txt; document.body.appendChild(t); t.select();
           try{document.execCommand("copy");}catch(e){} document.body.removeChild(t); }
  }
  function init(){
    var tb=document.getElementById("fp");
    if(tb){ tb.innerHTML="<tr><td>"+esc(L.computing||"...")+"</td></tr>"; }
    setTimeout(render,30);
    var rb=document.getElementById("rescan"); if(rb) rb.addEventListener("click",render);
    var cb=document.getElementById("copyjson"); if(cb) cb.addEventListener("click",copyJSON);
  }
  if(document.readyState!=="loading") init(); else document.addEventListener("DOMContentLoaded",init);
})();
