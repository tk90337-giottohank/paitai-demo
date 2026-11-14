// v12.19 繁中＋Tiếng Việt 並列（中央 t() + DOM 掃描；名字／房號／金額／冠廷不翻譯）
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
  const slots=(src.match(/\$\{[^}]+\}/g)||[]).length;
  return {src,tgt,re,slots,len:src.length};
}).filter(Boolean).sort((a,b)=>b.len-a.len);
const MIX=Object.keys(STRINGS).filter(k=>{
  const n=(k.match(/\p{Script=Han}/gu)||[]).length;
  return n>=2 && !SKIP.has(k);
}).sort((a,b)=>b.length-a.length);

function hasHan(s){return HAN.test(s||'')}
function alreadyBi(s){return hasHan(s)&&VI.test(s)}
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
function pair(zh,vi,short){
  if(!vi||vi===zh)return zh;
  if(short)return zh+' / '+vi;
  return zh;
}
function hanCount(s){return (String(s).match(/\p{Script=Han}/gu)||[]).length}
function boxText(m){
  const s=String(m==null?'':m);
  if(!hasHan(s)||alreadyBi(s)||isSkipText(s))return s;
  const vi=tTpl(s);
  if(!vi||vi===s)return s;
  return s+'\n'+vi;
}

function css(){
  if(document.getElementById('i18nCss'))return;
  const s=document.createElement('style');s.id='i18nCss';
  s.textContent=`
  .vi{display:block;font-size:11px;font-weight:400;opacity:.85;line-height:1.25;
      font-family:system-ui,-apple-system,"Noto Sans","PingFang TC","Noto Sans TC",sans-serif}
  button .vi,.s .vi,a .vi{font-size:10px;margin-top:1px}
  th .vi,.badge .vi,header button .vi{font-size:9px}
  header button{line-height:1.15}
  @media (max-width:430px){
    header button{line-height:1.15;padding:6px 8px;min-height:44px}
    header button .vi{font-size:9px}
  }
  @media (min-width:900px){
    .tv .vi,.board .vi,#tv .vi{font-size:14px}
  }
  input::placeholder{font-size:14px}
  dialog, #page, #ov, .box{overflow:auto}
  .ph button{min-height:44px}
  `;
  document.head.appendChild(s);
}

const SKIP_SEL='script,style,textarea,svg,canvas,code,pre,[data-no-i18n],.name,.nick,.vi';
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
  if(parent.tagName==='INPUT'||parent.tagName==='TEXTAREA')return;
  // already has a following .vi
  if(node.nextSibling&&node.nextSibling.classList&&node.nextSibling.classList.contains('vi'))return;
  const raw=node.textContent, zh=raw.trim();
  if(!zh||isSkipText(zh)||alreadyBi(zh))return;
  // kitchen / existing "中文 Bếp" style
  if(hasHan(zh)&&/[A-Za-zÀ-ỹ]/.test(zh)&&VI.test(zh))return;
  const vi=STRINGS[zh]||STRINGS[zh.replace(/\s+/g,' ')]||tMix(zh);
  if(!vi||vi===zh)return;
  const short=hanCount(zh)<=8 && (parent.matches('button,a,th,label,summary,option,.s,.pibtn')||parent.closest('button,header,.ph,.bar,.gtop'));
  if(parent.tagName==='OPTION'||short){
    node.textContent=raw.replace(zh,zh+' / '+vi);
    parent.setAttribute('data-i18n-done','1');
  }else{
    const sm=document.createElement('small');
    sm.className='vi';sm.textContent=vi;sm.setAttribute('data-i18n-done','1');
    node.after(sm);
  }
}
function attrPair(el,attr,fmt){
  if(!el.hasAttribute(attr))return;
  const zh=el.getAttribute(attr);
  if(!zh||isSkipText(zh)||alreadyBi(zh)||el.getAttribute('data-i18n-'+attr))return;
  const vi=STRINGS[zh.trim()]||tMix(zh);
  if(!vi||vi===zh)return;
  el.setAttribute(attr, fmt==='ph'? (zh+'（'+vi+'）') : (zh+' / '+vi));
  el.setAttribute('data-i18n-'+attr,'1');
}
function walk(root){
  if(isGuestPage()||!root)return;
  const w=document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(n){
      const p=n.parentElement;
      if(!p||skipEl(p)||p.tagName==='NOSCRIPT')return NodeFilter.FILTER_REJECT;
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
  if(global.Cloud&&typeof Cloud.toastF==='function'){/* no-op */}
}

function observe(){
  if(isGuestPage())return;
  const mo=new MutationObserver(()=>{schedule()});
  mo.observe(document.documentElement,{childList:true,subtree:true});
}

function init(){
  css();hook();observe();schedule();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);
else init();
setTimeout(hook,0);setTimeout(hook,800);setTimeout(hook,2000);

global.I18N={t,tTpl,schedule,fixCallBoard,pair,boxText,ver:'12.19'};
global.t=t;
})(typeof window!=='undefined'?window:globalThis);
