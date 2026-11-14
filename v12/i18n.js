// v12.20 繁中＋Tiếng Việt：一律上下兩行（中文正常、越文較小且無 emoji）；選單間距加大
(function(global){
const HAN=/\p{Script=Han}/u;
const VI=/[àáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđÀÁẢÃẠĂẰẮẲẴẶÂẦẤẨẪẬÈÉẺẼẸÊỀẾỂỄỆÌÍỈĨỊÒÓỎÕỌÔỒỐỔỖỘƠỜỚỞỠỢÙÚỦŨỤƯỪỨỬỮỰỲÝỶỸỴĐ]/;
const DATA=global.__I18N_DATA__||{strings:{},templates:[],skip:[],corrections:[]};
const STRINGS=Object.assign({
  '列印':'In','關閉':'Đóng','登入中':'Đang đăng nhập'
}, DATA.strings||{});
const SKIP=new Set(DATA.skip||['冠廷']);
SKIP.add('冠廷');
const CORR=DATA.corrections||[];
const TPL=(DATA.templates||[]).map(t=>{
  const src=String(t.s||t.source||'');
  const tgt=String(t.t||t.target||'');
  if(!src||!tgt)return null;
  const parts=src.split(/\$\{[^}]+\}/);
  const re=new RegExp('^'+parts.map(p=>p.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('([\\s\\S]*?)')+'$');
  return {src,tgt,re,len:src.length};
}).filter(Boolean).sort((a,b)=>b.len-a.len);
const MIX=Object.keys(STRINGS).filter(k=>{
  const n=(k.match(/\p{Script=Han}/gu)||[]).length;
  return n>=2 && !SKIP.has(k);
}).sort((a,b)=>b.length-a.length);

function hasHan(s){return HAN.test(s||'')}
function alreadyBi(s){return hasHan(s)&&VI.test(s)}
function stripEmoji(s){
  return String(s)
    .replace(/(?:\p{Extended_Pictographic}\uFE0F?(?:\u200D\p{Extended_Pictographic}\uFE0F?)*|[\u2600-\u27BF\u2300-\u23FF\u2B00-\u2BFF]\uFE0F?|\uFE0F)/gu,'')
    .replace(/^[\s/／·•\-–✕✖]+|[\s/／·•]+$/g,'')
    .replace(/\s{2,}/g,' ')
    .trim();
}
function viFor(zh){
  if(!zh)return '';
  let vi=STRINGS[zh]||STRINGS[zh.replace(/\s+/g,' ')]||tMix(zh);
  if(!vi||vi===zh)return '';
  vi=stripEmoji(vi);
  const zhPlain=stripEmoji(zh);
  if(!vi||vi===zh||vi===zhPlain)return '';
  return vi;
}
function isSkipText(s){
  const t=String(s||'').trim();
  if(!t)return true;
  if(t==='冠廷'||t.includes('冠廷')&&t.replace(/\s/g,'')==='冠廷')return true;
  if(SKIP.has(t))return true;
  if(/^room-\d+/i.test(t)||/^(sy|g-)?\d{1,3}$/i.test(t))return true;
  if(/^\d+([.,]\d+)?(元)?$/.test(t))return true;
  if(/^(102|103|105|106|201|202|203|101|205|111|206|207|208|VIP)$/.test(t))return true;
  if(!hasHan(t))return true;
  return false;
}
function t(zh){
  if(zh==null||zh==='')return zh;
  const s=String(zh);
  if(SKIP.has(s.trim())||s.trim()==='冠廷')return s;
  if(STRINGS[s]!=null)return STRINGS[s];
  const tr=s.trim();
  if(tr!==s&&STRINGS[tr]!=null)return STRINGS[tr];
  return s;
}
function tTpl(s){
  const hit=STRINGS[s]; if(hit)return hit;
  for(const p of TPL){
    const m=String(s).match(p.re);
    if(!m)continue;
    let out=p.tgt, i=1;
    out=out.replace(/\$\{[^}]+\}/g,()=>m[i++]??'');
    return out;
  }
  return tMix(s)||s;
}
function tMix(s){
  if(!s||STRINGS[s])return STRINGS[s]||null;
  let out=s, changed=false;
  for(const zh of MIX){
    if(zh.length<2)continue;
    if(out.indexOf(zh)!==-1){out=out.split(zh).join(STRINGS[zh]);changed=true}
  }
  return (changed&&out!==s)?out:null;
}
function pair(zh,vi){
  // 不再使用「中文 / Việt」單行
  return zh;
}
function boxText(m){
  const s=String(m==null?'':m);
  if(!hasHan(s)||alreadyBi(s)||isSkipText(s))return s;
  const vi=stripEmoji(tTpl(s));
  if(!vi||vi===s||vi===stripEmoji(s))return s;
  return s+'\n'+vi;
}

function css(){
  if(document.getElementById('i18nCss'))return;
  const s=document.createElement('style');s.id='i18nCss';
  s.textContent=`
  .vi{display:block;font-size:75%;font-weight:400;opacity:.72;line-height:1.3;color:inherit;
      font-family:system-ui,-apple-system,"Noto Sans","PingFang TC","Noto Sans TC",sans-serif}
  button, a.s, .s, .pibtn{
    display:inline-flex;flex-direction:column;align-items:center;justify-content:center;
    text-align:center;line-height:1.25;padding:10px 12px;gap:2px;
  }
  button .vi, a .vi, .s .vi, .pibtn .vi{font-size:72%;opacity:.7;margin:0;font-weight:400}
  h1,h2,h3{line-height:1.25}
  h1 .vi,h2 .vi,h3 .vi{font-size:72%;font-weight:400;opacity:.7;margin-top:3px}
  th .vi,label .vi,.badge .vi{font-size:72%;opacity:.7}
  header{gap:14px;align-items:stretch}
  header button{
    display:flex;flex-direction:column;align-items:center;justify-content:center;
    text-align:center;min-height:64px;padding:10px 10px;line-height:1.25;gap:2px;
  }
  header input[type=hidden]{display:none!important}
  @media (max-width:700px){
    header{display:grid;grid-template-columns:1fr 1fr;gap:14px;padding:12px;align-items:stretch}
    header h1,header #clock,header #sync{grid-column:1/-1;width:auto;margin:0!important}
    header button,header label{min-height:64px;padding:10px 8px;width:auto;min-width:0;max-width:none;flex:none}
    header #userBtn{min-height:64px}
  }
  #page .ph{display:flex;flex-wrap:wrap;gap:12px;margin:0 0 14px}
  #page .ph button{min-height:52px;padding:10px 14px}
  #toasts div, .toast{white-space:pre-line;line-height:1.4}
  dialog button, #ov button, .box button{min-height:52px}
  /* 控台／叫檯看板保持可讀，不套選單的大按鈕高度 */
  #board button,.cbx button,.btc,.call button{
    display:inline-block;min-height:0;padding:6px 10px;gap:0
  }
  @media (min-width:900px){
    #board .vi,.tv .vi,.board .vi{font-size:16px;opacity:.85}
  }
  input::placeholder{font-size:14px}
  dialog, #page, #ov, .box{overflow:auto}
  `;
  document.head.appendChild(s);
}

const SKIP_SEL='script,style,textarea,svg,canvas,code,pre,[data-no-i18n],.name,.nick,.vi,.cbvi,.cbzh,.cbm,.cbr,.cbsub,.cbnote';
function skipEl(el){
  if(!el||el.nodeType!==1)return true;
  if(el.closest&&el.closest(SKIP_SEL))return true;
  if(el.hasAttribute&&el.hasAttribute('data-i18n-done'))return true;
  if(el.isContentEditable)return true;
  return false;
}
function isGuestPage(){try{return /guest\.html/i.test((typeof location!=='undefined'&&location.pathname)||'')}catch(e){return false}}
function decorateNode(node){
  if(!node||node.nodeType!==3)return;
  const parent=node.parentElement;
  if(!parent||skipEl(parent))return;
  if(parent.tagName==='INPUT'||parent.tagName==='TEXTAREA'||parent.tagName==='OPTION')return;
  if(node.nextSibling&&node.nextSibling.classList&&node.nextSibling.classList.contains('vi'))return;
  const raw=node.textContent, zh=raw.trim();
  if(!zh||isSkipText(zh)||alreadyBi(zh))return;
  // 已並列且含越文聲調（如廚房「🍳 廚房收單 Bếp」）不再疊行
  if(hasHan(zh)&&VI.test(zh))return;
  const vi=viFor(zh);
  if(!vi)return;
  const sm=document.createElement('small');
  sm.className='vi';sm.textContent=vi;sm.setAttribute('data-i18n-done','1');
  node.after(sm);
}
function attrPair(el,attr,fmt){
  if(!el.hasAttribute(attr))return;
  const zh=el.getAttribute(attr);
  if(!zh||isSkipText(zh)||alreadyBi(zh)||el.getAttribute('data-i18n-'+attr))return;
  const vi=viFor(zh.trim());
  if(!vi)return;
  if(fmt==='ph') el.setAttribute(attr, zh+'（'+vi+'）');
  else el.setAttribute(attr, zh+'\\n'+vi);
  el.setAttribute('data-i18n-'+attr,'1');
}
function walk(root){
  if(isGuestPage()||!root)return;
  const w=document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(n){
      const p=n.parentElement;
      if(!p||skipEl(p)||p.tagName==='NOSCRIPT'||p.tagName==='OPTION')return NodeFilter.FILTER_REJECT;
      if(!n.textContent||!HAN.test(n.textContent))return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    }
  });
  const nodes=[];
  while(w.nextNode())nodes.push(w.currentNode);
  nodes.forEach(decorateNode);
  root.querySelectorAll&&root.querySelectorAll('[placeholder],[title]').forEach(el=>{
    if(skipEl(el))return;
    attrPair(el,'placeholder','ph');
    attrPair(el,'title','title');
  });
}
let _tm=null;
function schedule(root){
  css();fixCallBoard();
  if(_tm)cancelAnimationFrame(_tm);
  _tm=requestAnimationFrame(()=>{
    _tm=null;
    try{walk(root||document.body)}catch(e){}
  });
}

function fixCallBoard(){
  try{
    if(!global.S||!S.cb||!Array.isArray(S.cb.msgs))return;
    S.cb.msgs.forEach(m=>{
      if(!m)return;
      const c=CORR.find(x=>x.zh===m.zh);
      if(!c)return;
      const was=c.was||'';
      if(!m.vi||m.vi===was||/THÃi|Hũy|HUỹ|GiỜ/.test(m.vi))m.vi=c.vi;
    });
  }catch(e){}
}

function hookFn(name,after){
  const fn=global[name];
  if(typeof fn!=='function'||fn._i18n)return;
  const wrap=function(){const r=fn.apply(this,arguments);try{after&&after()}catch(e){}return r};
  wrap._i18n=true;global[name]=wrap;
}

function hook(){
  if(global.alert&&!global.alert._i18n){
    const a=global.alert.bind(global);
    global.alert=function(m){return a(boxText(m))};global.alert._i18n=true;
  }
  if(global.confirm&&!global.confirm._i18n){
    const c=global.confirm.bind(global);
    global.confirm=function(m){return c(boxText(m))};global.confirm._i18n=true;
  }
  hookFn('toast',()=>{});
  if(typeof global.toast==='function'&&!global.toast._i18nMsg){
    const t0=global.toast;
    global.toast=function(m,warn){const r=t0.call(this,hasHan(String(m||''))?boxText(m):m,warn);schedule();return r};
    global.toast._i18n=global.toast._i18nMsg=true;
  }
  hookFn('pageOpen',()=>schedule(document.getElementById('page')||document.body));
  hookFn('render',()=>schedule());
  hookFn('openLogin',()=>schedule());
  hookFn('renderTV',()=>schedule());
  hookFn('drawCarryBanner',()=>schedule());
  hookFn('renderCalls',()=>schedule());
  hookFn('loginUI',()=>schedule());
  if(global.Grid&&typeof Grid.draw==='function'&&!Grid.draw._i18n){
    const d=Grid.draw.bind(Grid);
    Grid.draw=function(){const r=d.apply(this,arguments);schedule(document.getElementById('gridPg')||document.body);return r};
    Grid.draw._i18n=true;
  }
}

function observe(){
  if(isGuestPage())return;
  const mo=new MutationObserver(()=>{schedule()});
  mo.observe(document.documentElement,{childList:true,subtree:true});
}

function init(){
  css();hook();observe();schedule();
}
if(typeof document!=='undefined'){
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);
  else init();
  setTimeout(hook,0);setTimeout(hook,800);setTimeout(hook,2000);
}

global.I18N={t,tTpl,schedule,fixCallBoard,pair,boxText,stripEmoji,viFor,ver:'12.20'};
global.t=t;
})(typeof window!=='undefined'?window:globalThis);
