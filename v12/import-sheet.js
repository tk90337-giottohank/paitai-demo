// v12.25 匯入備份／校對；選單可達。v12.21 匯入傳統排檯表（先讀編號對名冊，中文名字只做交叉核對；不符黃框）
(function(global){
const MARKS=['紅','藍','私檯','訂番'];
const XLSX_SRC='https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';
let xlsxLoading=null;
const ST={day:'',files:[],photos:[],parsed:null,rawParsed:null,step:'pick',mode:'replace',livePol:'skip',queueId:'',busy:false,err:''};
const ARC={list:[],cur:null,photos:[],busy:false,err:''};

function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function todayBiz(){try{return (typeof shDay!=='undefined'&&shDay)||(typeof bizDay==='function'?bizDay(typeof now==='function'?now():Date.now()):'')}catch(e){return ''}
}
function nid(x){const m=String(x==null?'':x).trim().match(/(\d{1,4})/);if(!m)return'';const n=m[1];return n.length<2?n.padStart(2,'0'):n}
function parseHm(s){
  if(s==null||s==='')return null;
  if(typeof parseTime==='function'){try{const t=parseTime(s);if(t&&t.length>=2)return[+t[0],+t[1]]}catch(e){}}
  s=String(s).trim().replace(/[：﹒．]/g,':').replace(/\./g,':').replace(/\s+/g,'');
  if(/^\d{3,4}$/.test(s)){s=s.padStart(4,'0');const h=+s.slice(0,2),m=+s.slice(2);return (h<=23&&m<=59)?[h,m]:null}
  const m=s.match(/^(\d{1,2}):(\d{2})$/);if(!m)return null;
  const h=+m[1],mm=+m[2];return (h<=23&&mm<=59)?[h,mm]:null;
}
function endedOf(v){if(v==null||v==='')return false;const s=String(v).trim();return /^[YyＹ是1]|結束|已結束|已買單/.test(s)}
function yesOf(v){if(v==null||v==='')return false;return /^[YyＹ是1]/.test(String(v).trim())}
function markTypeOf(s){s=String(s||'').trim().replace(/筆$/,'').replace(/勾$/,'');if(MARKS.includes(s))return s;if(/私/.test(s))return'私檯';if(/訂/.test(s))return'訂番';if(/紅/.test(s))return'紅';if(/藍/.test(s))return'藍';if(/^[xX×✘不]/.test(s))return'x';return''}
function hmText(tm){return tm?String(tm[0]).padStart(2,'0')+':'+String(tm[1]).padStart(2,'0'):''}
function csvSplit(line){
  const a=[];let cur='',q=false;
  for(let i=0;i<line.length;i++){
    const c=line[i];
    if(c==='"'){if(q&&line[i+1]==='"'){cur+='"';i++}else q=!q;continue}
    if((c===','||c==='\t'||c==='，')&&!q){a.push(cur.trim());cur='';continue}
    cur+=c;
  }
  a.push(cur.trim());return a;
}
function linesOf(txt){return String(txt||'').replace(/^\ufeff/,'').split(/\r?\n/)}
function headerKey(h){return String(h||'').trim().toLowerCase().replace(/\s+/g,'')}
function mapHeader(cells){
  const idx={};
  cells.forEach((c,i)=>{
    const k=headerKey(c);
    if(/^(番|序|順序|seq)$/.test(k))idx.seq=i;
    else if(/^(包廂|房|房間|room)$/.test(k))idx.room=i;
    else if(/進場|時間|開始/.test(k)&&idx.tm==null)idx.tm=i;
    else if(/^(人數|來客|客數|guests?)$/.test(k))idx.guests=i;
    else if(/結束|買單|ended/.test(k))idx.ended=i;
    else if(/訂番幹部|幹部/.test(k))idx.staff=i;
    else if(/^(號碼|小姐|小姐編號|編號|id)$/.test(k))idx.girl=i;
    else if(/紙本名字|紙本/.test(k))idx.paper=i;
    else if(/系統名字|系統名/.test(k))idx.sys=i;
    else if(/^(記號|類型|種類|mark)$/.test(k))idx.mark=i;
    else if(/^(匯入|導入)$/.test(k))idx.imp=i;
    else if(/待確認|不確定|信心/.test(k))idx.tbd=i;
    else if(/備註|說明|note/.test(k))idx.note=i;
    else if(/^(日期|營業日|day)$/.test(k))idx.day=i;
  });
  return idx;
}
function emptyParsed(day){return{type:'排檯表',day:day||'',rows:{},marks:[],bad:[],unk:[],tbd:[],skipped:[],sources:[],photos:[],ext:{orderStaff:{},raw:{},colOrder:[],bands:null,arrive:{},early:{},others:[],otherMarks:[],xNotes:[]}}}
function girlOk(id){try{return id&&typeof G==='function'&&G(id)}catch(e){return false}}
function roomKnown(room){try{if(!room)return false;if(typeof officialRooms==='function'&&officialRooms().includes(room))return true;if(typeof roomList==='function'&&roomList().includes(room))return true;if(typeof inactiveRooms==='function'&&inactiveRooms().includes(room))return true;return false}catch(e){return false}}

function ingestSession(p,seq,room,tmRaw,guestsRaw,endedRaw,staff,note,src){
  if(!seq){p.bad.push((src||'')+' 缺序／番');return}
  const tm=parseHm(tmRaw);
  const g=guestsRaw==null||guestsRaw===''||guestsRaw==='待補'?null:(+guestsRaw>0?+guestsRaw:null);
  const row={seq:String(seq),room:room||'?',tm,guests:g,ended:endedOf(endedRaw),orderStaff:staff||'',note:note||'',conf:1,src:src||''};
  const flags=[];
  if(!room||room==='?'){flags.push('缺包廂');p.tbd.push(`序${seq} 包廂空白`)}
  else if(!roomKnown(room)){flags.push('非現行包廂');p.tbd.push(`序${seq} 包廂「${room}」不在現行清單（仍可匯入歷史）`)}
  if(!tm){flags.push('缺時間');p.tbd.push(`序${seq} 進場時間「${tmRaw||''}」`)}
  if(guestsRaw&&g==null&&String(guestsRaw)!=='待補'){flags.push('人數待確認');p.tbd.push(`序${seq} 人數「${guestsRaw}」`)}
  if(flags.length)row.conf=0.4;
  p.rows[String(seq)]=row;
  if(staff)p.ext.orderStaff[String(seq)]=staff;
  if(note)p.ext.raw[String(seq)]=Object.assign(p.ext.raw[String(seq)]||{},{note});
}
function ingestMark(p,seq,girlRaw,tyRaw,impRaw,tbdRaw,paper,sys,note,src){
  const id=nid(girlRaw),ty=markTypeOf(tyRaw);
  const line=`序${seq} ${girlRaw||''} ${tyRaw||''}`;
  if(!seq){p.bad.push((src||line)+' 缺序');return}
  if(ty==='x'||(impRaw!=null&&impRaw!==''&&!yesOf(impRaw)&&!/^[—\-]?$/.test(String(impRaw)))){
    p.skipped.push({seq:String(seq),id,ty:ty||tyRaw,note:note||'不匯入'});
    p.ext.xNotes.push(line+'（不匯入）');
    return;
  }
  if(!ty||!MARKS.includes(ty)){p.bad.push(line+' 記號無法辨識');return}
  if(!id){p.unk.push(`序${seq} 小姐「${girlRaw||''}」`);return}
  if(!girlOk(id))p.unk.push(`序${seq} 小姐「${id}」不在名冊（核對時可改）`);
  const low=yesOf(tbdRaw)||(paper&&sys&&paper!==sys)||!girlOk(id);
  p.marks.push([String(seq),id,ty,low?0.45:1,note||'',paper||'',sys||'']);
  if(low)p.tbd.push(`序${seq} 小姐 ${id}${paper&&sys&&paper!==sys?` 紙本「${paper}」／系統「${sys}」`:''}${note?' '+note:''}`);
}

function parseCsvText(txt,defDay,srcName){
  const p=emptyParsed(defDay);
  const lines=linesOf(txt).map(l=>l.trim()).filter(l=>l&&!l.startsWith('#'));
  if(!lines.length){p.bad.push((srcName||'檔案')+' 是空的');p.sources.push(srcName||'');return p}
  let mode='auto';
  let idx=null;
  lines.forEach(l=>{
    const c=csvSplit(l);
    if(c[0]==='日期'||headerKey(c[0])==='日期'||headerKey(c[0])==='營業日'){if(c[1]&&/\d{4}-\d{2}-\d{2}/.test(c[1]))p.day=c[1].match(/(\d{4}-\d{2}-\d{2})/)[1];return}
    const hk=c.map(headerKey);
    const looksHeader=hk.some(h=>/^(番|序|包廂|號碼|小姐|記號|進場時間|進場)$/.test(h));
    if(looksHeader&&(hk.includes('包廂')||hk.includes('room'))&&(hk.includes('番')||hk.includes('序'))){idx=mapHeader(c);mode='sessions';return}
    if(looksHeader&&(hk.includes('號碼')||hk.includes('小姐')||hk.includes('小姐編號')||hk.includes('記號'))){idx=mapHeader(c);mode='marks';return}
    if(c[0]==='序'||c[0]==='番'){idx=mapHeader(c);mode=c.includes('包廂')||c.includes('進場時間')?'sessions':'auto';return}
    if(mode==='sessions'&&idx){
      ingestSession(p,c[idx.seq]||c[0],idx.room!=null?c[idx.room]:'',idx.tm!=null?c[idx.tm]:'',idx.guests!=null?c[idx.guests]:'',idx.ended!=null?c[idx.ended]:'',idx.staff!=null?c[idx.staff]:'',idx.note!=null?c[idx.note]:'',srcName);
      return;
    }
    if(mode==='marks'&&idx){
      ingestMark(p,c[idx.seq]||c[0],idx.girl!=null?c[idx.girl]:c[1],idx.mark!=null?c[idx.mark]:c[2],idx.imp!=null?c[idx.imp]:'',idx.tbd!=null?c[idx.tbd]:'',idx.paper!=null?c[idx.paper]:'',idx.sys!=null?c[idx.sys]:'',idx.note!=null?c[idx.note]:'',srcName);
      return;
    }
    // TPL fallback: 5+ cols session, 3 cols mark
    if(c.length>=5)ingestSession(p,c[0],c[1],c[2],c[3],c[4],c[5]||'',c[6]||'',srcName);
    else if(c.length===3||c.length===4)ingestMark(p,c[0],c[1],c[2],'','','','',c[3]||'',srcName);
    else p.bad.push((srcName?srcName+': ':'')+l);
  });
  p.sources.push(srcName||'csv');
  p.marks=p.marks.filter(m=>p.rows[m[0]]||true);
  return p;
}
function mergeParsed(a,b){
  if(!a)return b;
  if(!b)return a;
  const p=emptyParsed(b.day||a.day);
  p.rows=Object.assign({},a.rows,b.rows);
  p.marks=a.marks.concat(b.marks);
  p.bad=a.bad.concat(b.bad);
  p.unk=a.unk.concat(b.unk);
  p.tbd=a.tbd.concat(b.tbd);
  p.skipped=a.skipped.concat(b.skipped);
  p.sources=a.sources.concat(b.sources);
  p.photos=a.photos.concat(b.photos||[]);
  p.ext.orderStaff=Object.assign({},a.ext.orderStaff,b.ext.orderStaff);
  p.ext.raw=Object.assign({},a.ext.raw,b.ext.raw);
  p.ext.xNotes=(a.ext.xNotes||[]).concat(b.ext.xNotes||[]);
  return p;
}
function loadXlsx(){
  if(global.XLSX)return Promise.resolve(global.XLSX);
  if(xlsxLoading)return xlsxLoading;
  xlsxLoading=new Promise((resolve,reject)=>{
    const s=document.createElement('script');s.src=XLSX_SRC;s.async=true;
    s.onload=()=>global.XLSX?resolve(global.XLSX):reject(new Error('XLSX 載入失敗'));
    s.onerror=()=>reject(new Error('無法載入 Excel 解析庫（請檢查網路或改匯出 CSV）'));
    document.head.appendChild(s);
  });
  return xlsxLoading;
}
function parseWorkbook(buf,defDay,srcName){
  const XLSX=global.XLSX;if(!XLSX)throw new Error('XLSX 尚未載入');
  const wb=XLSX.read(buf,{type:'array'});
  let p=emptyParsed(defDay);
  wb.SheetNames.forEach(name=>{
    const csv=XLSX.utils.sheet_to_csv(wb.Sheets[name]);
    p=mergeParsed(p,parseCsvText(csv,p.day||defDay,(srcName||'xlsx')+'／'+name));
  });
  return p;
}

function totals(p){
  const rows=Object.values(p.rows||{});
  let girl=0,priv=0,ord=0;
  (p.marks||[]).forEach(m=>{
    if(m[2]==='私檯')priv++;else if(m[2]==='訂番')ord++;
    girl++;
  });
  // 小姐台數合計：每位有記號的小姐一列計一次（私檯仍算台數；學習時才排除私檯／訂番）
  return{sessions:rows.length,girlTai:girl,priv,ord,low:rows.filter(r=>r.conf<0.7).length+(p.marks||[]).filter(m=>m[3]<0.7).length,skipped:(p.skipped||[]).length,bad:(p.bad||[]).length,unk:(p.unk||[]).length,tbd:(p.tbd||[]).length};
}

function existingImp(d){try{return (S.sheetLog||[]).filter(e=>e.imp&&e.day==d)}catch(e){return []}}
function fromExisting(d){
  const p=emptyParsed(d);
  existingImp(d).forEach((e,i)=>{
    const seq=String(e.seq||(i+1));
    const tm=e.start&&typeof hm==='function'?null:null;
    let hhmm=null;
    if(e.start&&typeof hm==='function'){const s=hm(e.start);const m=String(s).match(/(\d{1,2}):(\d{2})/);if(m)hhmm=[+m[1],+m[2]]}
    p.rows[seq]={seq,room:e.room,tm:hhmm,guests:e.guests,ended:!!e.ended,orderStaff:e.orderStaff||'',note:'',conf:1,src:'既有匯入'};
    const mk=e.marks||{};
    Object.keys(mk).forEach(id=>[].concat(mk[id]||[]).forEach(ty=>p.marks.push([seq,id,ty,1,'','',''])));
    if(e.orderStaff)p.ext.orderStaff[seq]=e.orderStaff;
  });
  return p;
}
function mergeKeepOld(oldP,newP){
  const p=mergeParsed({...oldP,rows:{} ,marks:[]},emptyParsed(newP.day||oldP.day));
  p.rows=Object.assign({},oldP.rows);
  p.marks=oldP.marks.slice();
  p.ext=JSON.parse(JSON.stringify(oldP.ext||emptyParsed().ext));
  p.day=newP.day||oldP.day;
  p.photos=(oldP.photos||[]).concat(newP.photos||[]);
  p.sources=(oldP.sources||[]).concat(newP.sources||[]);
  p.bad=(oldP.bad||[]).concat(newP.bad||[]);
  p.unk=(oldP.unk||[]).concat(newP.unk||[]);
  p.tbd=(oldP.tbd||[]).concat(newP.tbd||[]);
  p.skipped=(oldP.skipped||[]).concat(newP.skipped||[]);
  const oldKeys=new Set(Object.values(p.rows).map(r=>(r.room||'')+'@'+hmText(r.tm)));
  const oldSeq=new Set(Object.keys(p.rows));
  let skipped=0,added=0;
  Object.values(newP.rows||{}).forEach(r=>{
    const k=(r.room||'')+'@'+hmText(r.tm);
    let seq=String(r.seq);
    if(oldKeys.has(k)){skipped++;return}
    if(oldSeq.has(seq)){seq=String(Math.max(0,...Object.keys(p.rows).map(n=>+n||0))+1);r={...r,seq}}
    p.rows[seq]=r;oldSeq.add(seq);oldKeys.add(k);added++;
    (newP.marks||[]).filter(m=>String(m[0])===String(r.seq)||(seq!==String(r.seq)&&false)).forEach(m=>p.marks.push(m));
    // marks for this original seq → retarget
  });
  // add marks for newly added rows (by original seq present in newP.rows that got in)
  const newSeqKept=new Set();
  Object.values(newP.rows||{}).forEach(r=>{
    const k=(r.room||'')+'@'+hmText(r.tm);
    // if kept under maybe new seq, find it
    const hit=Object.values(p.rows).find(x=>(x.room||'')+'@'+hmText(x.tm)===k&&x.src!=='既有匯入');
    if(hit)newSeqKept.add(String(r.seq)+'→'+hit.seq);
  });
  (newP.marks||[]).forEach(m=>{
    const orig=Object.values(newP.rows||{}).find(r=>String(r.seq)===String(m[0]));
    if(!orig)return;
    const k=(orig.room||'')+'@'+hmText(orig.tm);
    const hit=Object.values(p.rows).find(x=>(x.room||'')+'@'+hmText(x.tm)===k);
    if(!hit||hit.src==='既有匯入')return;
    p.marks.push([String(hit.seq),m[1],m[2],m[3],m[4],m[5],m[6]]);
  });
  p._mergeStat={added,skipped};
  return p;
}

function applyMarksForSheet(p){
  // applySheet expects marks as [seq,id,ty]
  return (p.marks||[]).map(m=>[String(m[0]),m[1],m[2]]);
}

function ensureCss(){
  if(document.getElementById('paperImpCss'))return;
  const s=document.createElement('style');s.id='paperImpCss';
  s.textContent=`
  .pi,.arc{max-width:960px;margin:0 auto;padding:0 0 24px;font-size:16px;color:var(--text,#eee)}
  .pi h2,.arc h2{font-size:20px;margin:8px 0 12px}
  .pi .row,.arc .row{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:10px 0}
  .pi button,.pi label.pibtn,.arc button{min-height:44px;min-width:44px;padding:10px 14px;font-size:16px;border-radius:10px;border:0;background:var(--btn,#3a6);color:var(--on-btn,#fff)}
  .pi button.s,.pi label.pibtn.s,.arc button.s{background:var(--btn-s,#3a4150);color:var(--on-s,#eee)}
  .pi button:disabled,.arc button:disabled{opacity:.5}
  .pi input[type=date],.pi input[type=text],.pi input[type=number],.pi select,.arc input[type=date],.arc select{font-size:16px;min-height:44px;padding:8px;border-radius:8px;border:1px solid var(--line-strong,#445);background:var(--input,#1c1f27);color:var(--text,#eee)}
  .pi .hint,.arc .hint{font-size:14px;color:var(--muted,#bbb);line-height:1.5}
  .pi .warn,.arc .warn{color:var(--warn,#fc6)}
  .pi .err,.arc .err{color:var(--danger,#f66)}
  .pi .files,.arc .files{font-size:14px}
  .pi .thumbs,.arc .thumbs{display:flex;flex-wrap:wrap;gap:8px;margin:8px 0}
  .pi .thumbs img,.arc .thumbs img{width:120px;height:90px;object-fit:cover;border-radius:8px;border:1px solid var(--line-strong,#445);background:var(--surface-2,#111)}
  .pi .thumbs img.big,.arc .thumbs img.big{width:100%;max-width:720px;height:auto;max-height:280px}
  .pi table,.arc table{border-collapse:collapse;width:100%;font-size:14px;background:var(--surface,transparent)}
  .pi td,.pi th,.arc td,.arc th{border:1px solid var(--line-strong,#445);padding:6px 4px;text-align:center}
  .pi td.low,.arc td.low{background:var(--soon-bg,#5a4a10);outline:2px solid var(--warn,#fc6)}
  .pi .tot,.arc .tot{font-size:16px;margin:8px 0}
  .pi textarea,.pi input.cell{width:100%;font-size:16px;min-height:36px;background:var(--input,#1c1f27);color:var(--text,#eee);border:0;text-align:center}
  .pi .photoCol,.arc .photoCol{position:sticky;top:0;z-index:2;background:var(--bg,#1a1d24);padding:6px 0}
  .arc-split{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:12px;align-items:start}
  .arc-split .pane{background:var(--surface,#232833);border-radius:10px;padding:10px;border:1px solid var(--line,rgba(255,255,255,.08))}
  .arc-split .pane img{width:100%;height:auto;max-height:70vh;object-fit:contain;border-radius:8px;background:var(--surface-2,#111)}
  @media (max-width:700px){.arc-split{grid-template-columns:1fr}.arc-split .pane.photo{position:sticky;top:0;z-index:2}}
  .arc-list{display:flex;flex-direction:column;gap:8px}
  .arc-card{display:flex;flex-wrap:wrap;gap:8px 16px;align-items:center;justify-content:space-between;background:var(--surface-2,#2c3240);border-radius:10px;padding:12px;min-height:44px}
  .arc-st{font-size:13px;font-weight:700;padding:2px 8px;border-radius:999px;background:var(--soon-bg,rgba(196,163,106,.16));color:var(--soon,#c4a36a)}
  .arc-st.ok{background:var(--avail-bg,rgba(111,158,134,.16));color:var(--ok,#8fbfa8)}
  `;
  document.head.appendChild(s);
}

function page(html){
  ensureCss();
  if(typeof pageOpen==='function')pageOpen(`<div class=pi>${html}</div>`);
  else document.body.innerHTML=html;
}

function fileKind(f){
  const n=(f.name||'').toLowerCase();
  const t=(f.type||'').toLowerCase();
  if(t.startsWith('image/')||/\.(jpe?g|png|gif|webp|heic|heif|bmp)$/.test(n))return'photo';
  if(/\.xlsx?$/.test(n)||t.includes('spreadsheet')||t.includes('excel'))return'xlsx';
  if(/\.csv$|\.txt$|\.tsv$/.test(n)||t.includes('csv')||t.includes('text'))return'csv';
  if(/\.numbers$/.test(n))return'numbers';
  return t.startsWith('image/')?'photo':'unknown';
}

function isHeicFile(file){
  const n=(file&&file.name||'').toLowerCase(), typ=(file&&file.type||'').toLowerCase();
  return typ==='image/heic'||typ==='image/heif'||/\.heic$|\.heif$/.test(n);
}
function dataUrlSize(u){return u?u.length:0}
async function blobToJpegDataUrl(blob,maxW,qual,hard){
  const src=await new Promise((resolve,reject)=>{
    const url=URL.createObjectURL(blob);
    const img=new Image();
    let done=false;
    const fin=(ok,err)=>{if(done)return;done=true;clearTimeout(tm);try{URL.revokeObjectURL(url)}catch(e){};ok?resolve(img):reject(new Error(err))};
    const tm=setTimeout(()=>fin(false,'timeout'),15000);
    img.onload=()=>fin(true);img.onerror=()=>fin(false,'decode');
    img.src=url;
  });
  const iw=src.naturalWidth||src.width, ih=src.naturalHeight||src.height;
  if(!iw||!ih)throw new Error('decode');
  let max=maxW||1280, q=qual||0.72, data='', w=0, h=0;
  const limit=hard||500000;
  while(true){
    const scale=Math.min(1,max/Math.max(iw,ih));
    w=Math.max(1,Math.round(iw*scale));h=Math.max(1,Math.round(ih*scale));
    const c=document.createElement('canvas');c.width=w;c.height=h;
    c.getContext('2d').drawImage(src,0,0,w,h);
    data=c.toDataURL('image/jpeg',q);
    if(data.length<=limit)break;
    if(q>0.4){q=Math.max(0.4,q-0.1);continue}
    if(max>720){max=Math.round(max*0.75);q=0.62;continue}
    break;
  }
  return {name:'photo.jpg',mime:'image/jpeg',dataUrl:data,w,h,bytes:data.length};
}
function compressPhoto(file,maxW,qual){
  return new Promise(async(resolve,reject)=>{
    try{
      // iOS 在 accept=image/* 時通常會把 HEIC 轉成 JPEG；若仍是 HEIC 先嘗試解碼再壓縮
      const out=await blobToJpegDataUrl(file,maxW||1280,qual||0.72,500000);
      out.name=(file.name||'photo').replace(/\.(heic|heif)$/i,'.jpg');
      resolve(out);
    }catch(e){
      if(isHeicFile(file)){
        reject(new Error('這張照片無法在手機上讀取（可能是 HEIC）。請改用「相簿」選取，或在「照片」App 匯出為 JPEG 後再傳。'));
        return;
      }
      reject(new Error('照片無法預覽或壓縮。請改傳較清楚的近拍 JPEG／PNG（單張請小於約 8 MB）。'));
    }
  });
}


async function readOne(file,day){
  const kind=fileKind(file);
  if(kind==='photo'){const ph=await compressPhoto(file,1600,0.7);return{kind:'photo',photo:ph,parsed:null}}
  if(kind==='numbers')return{kind:'numbers',error:'Numbers 原檔請先匯出為 Excel 或 CSV 再上傳',parsed:null};
  if(kind==='unknown')return{kind:'unknown',error:`無法辨識檔案「${file.name}」，請用照片、CSV 或 Excel`,parsed:null};
  if(kind==='xlsx'){
    await loadXlsx();
    const buf=await file.arrayBuffer();
    return{kind:'xlsx',parsed:parseWorkbook(new Uint8Array(buf),day,file.name)};
  }
  const txt=await file.text();
  return{kind:'csv',parsed:parseCsvText(txt,day,file.name)};
}

async function ingestFiles(fileList){
  ST.err='';ST.msg='';
  const day=ST.day||todayBiz();
  let p=ST.parsed&&ST.parsed.rows&&Object.keys(ST.parsed.rows).length?ST.parsed:emptyParsed(day);
  p.day=day||p.day;
  const arr=[...fileList];
  const newPhotos=[];
  for(const f of arr){
    ST.files.push({name:f.name,size:f.size,type:f.type});
    ST.msg='正在處理「'+(f.name||'檔案')+'」…';
    try{
      const r=await readOne(f,p.day||day);
      if(r.error)ST.err=(ST.err?ST.err+'；':'')+r.error;
      if(r.photo){ST.photos.push(r.photo);p.photos.push(r.photo);newPhotos.push(r.photo);
        const kb=Math.round((r.photo.dataUrl||'').length/1024);
        if(kb>680)ST.err=(ST.err?ST.err+'；':'')+'壓縮後仍偏大（'+kb+' KB），已嘗試縮小。若上傳失敗請改傳較近的一張。';
      }
      if(r.parsed){if(r.parsed.day&&!day)p.day=r.parsed.day;p=mergeParsed(p,r.parsed);p.day=ST.day||p.day||r.parsed.day}
    }catch(e){ST.err=(ST.err?ST.err+'；':'')+(f.name?f.name+'：':'')+(e.message||e)}
  }
  p.day=ST.day||p.day;
  p.photos=ST.photos.slice();
  ST.parsed=p;
  snapRawIfNeeded();
  if(newPhotos.length){
    ST.msg='正在上傳照片…';
    await uploadAndWatch(newPhotos);
  }else{
    ST.msg='';
  }
}
function applyDraft(draft){
  if(!draft)return;
  const day=draft.day||ST.day||todayBiz();
  const p=ST.parsed&&Object.keys(ST.parsed.rows||{}).length?ST.parsed:emptyParsed(day);
  p.day=day;
  if(draft.rows)p.rows=draft.rows;
  if(draft.marks)p.marks=draft.marks;
  p.tbd=(p.tbd||[]).concat(draft.tbd||[]);
  p.bad=(p.bad||[]).concat(draft.bad||[]);
  p.unk=(p.unk||[]).concat(draft.unk||[]);
  if(draft.ext)p.ext=Object.assign(p.ext||{},draft.ext);
  ST.parsed=p;ST.day=day;
  snapRawIfNeeded();
}
async function uploadAndWatch(photos){
  if(!photos||!photos.length)return;
  if(!global.Cloud||typeof Cloud.queueSheetImport!=='function'){
    ST.err=(ST.err?ST.err+'；':'')+'雲端尚未就緒，照片先留在本機核對畫面。請確認已登入後再傳一次。';
    ST.msg='';return;
  }
  try{
    const id=await Cloud.queueSheetImport({
      day:ST.day||todayBiz(),status:'queued',note:'傳統排檯表照片，待辨識',
      files:ST.files,sessions:ST.parsed?Object.keys(ST.parsed.rows||{}).length:0,
      marks:ST.parsed?(ST.parsed.marks||[]).length:0
    },photos);
    ST.queueId=id||'';
    ST.msg='照片已上傳，正在辨識…（通常十多秒，完成後會自動填入核對表。確認寫入前不會改到當日資料。）';
    if(ST.queueId)watchImport(ST.queueId);
  }catch(e){
    const m=String(e&&e.message||e||'');
    let tip='照片上傳失敗：'+m;
    if(/permission|insufficient|PERMISSION/i.test(m))tip='沒有權限上傳（需幹部以上，並已登入）。';
    else if(/too.?large|exceeds|resource-exhausted|invalid-argument/i.test(m))tip='照片仍超過系統上限，請改傳較近、較清楚的一張（或先在相簿壓縮）。';
    else if(/offline|network|unavailable|Failed to fetch/i.test(m))tip='網路不穩，上傳失敗。請檢查網路後再傳一次。';
    ST.err=(ST.err?ST.err+'；':'')+tip;
    ST.msg='';
  }
}
function watchImport(id){
  if(ST._watch){clearInterval(ST._watch);ST._watch=null}
  let n=0;
  const tick=async()=>{
    n++;
    try{
      if(!Cloud.getSheetImport)return;
      const rec=await Cloud.getSheetImport(id);
      if(!rec)return;
      if(rec.status==='已辨識，待核對'&&(rec.draft||rec.draftJson)){
        let d=rec.draft||rec.draftJson;if(typeof d==='string'){try{d=JSON.parse(d)}catch(e){d=null}}
        if(d)applyDraft(d);
        ST.msg='已辨識，請核對黃框後再確認寫入（黃框＝號碼與名字不符，或號碼看不清）。辨識結果尚未寫入當日排檯表。';
        clearInterval(ST._watch);ST._watch=null;
        if(ST.step==='preview')renderPreview();else renderPick();
      }else if(rec.status==='辨識失敗'){
        ST.err=(ST.err?ST.err+'；':'')+(rec.error||'照片辨識失敗，請在核對畫面依照片手動填寫，或改傳更清楚的近拍。');
        ST.msg='';
        clearInterval(ST._watch);ST._watch=null;
        if(ST.step==='preview')renderPreview();else renderPick();
      }else if(n>40){
        ST.msg='辨識還在排隊中。你可以先對照照片手動填格子；完成後若仍開著此頁會自動填入。確認寫入前不會改到當日資料。';
        clearInterval(ST._watch);ST._watch=null;
        if(ST.step==='pick')renderPick();
      }
    }catch(e){}
  };
  ST._watch=setInterval(tick,3000);
  tick();
}


function markMenu(cur){return MARKS.map(m=>`<option value="${m}" ${m===cur?'selected':''}>${m}</option>`).join('')+'<option value="" '+(cur?'':'selected')+'>（無）</option>'}

function renderPick(){
  const day=ST.day||todayBiz();
  ST.day=day;
  const files=ST.files.map(f=>esc(f.name)).join('、')||'尚未選擇';
  const thumbs=ST.photos.map((p,i)=>`<img src="${p.dataUrl}" alt="紙本${i+1}">`).join('');
  page(`<h2>匯入傳統排檯表</h2>
    <p class=hint>幹部以上可把現在的紙本排檯表或試算表匯入系統。確認前會先給你核對；<b>不會默默蓋掉既有資料</b>。</p>
    <div class=row><label>營業日 <input type=date id=piDay value="${esc(day)}"></label></div>
    <div class=row>
      <label class=pibtn>拍照<input type=file accept="image/*" capture="environment" hidden id=piCam></label>
      <label class="pibtn s">相簿<input type=file accept="image/*" multiple hidden id=piAlbum></label>
      <label class="pibtn s">試算表／CSV<input type=file accept=".csv,.txt,.tsv,.xlsx,.xls,.numbers,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" multiple hidden id=piSheet></label>
    </div>
    <p class=files>已選：${files}</p>
    <div class=thumbs>${thumbs}</div>
    <p class=hint>試算表／CSV（含 Numbers 匯出的 Excel／CSV）會在手機上直接解析成格子。<br>
    選好照片後會先壓縮再上傳；辨識先讀編號對名冊填名字，再用紙本名字交叉核對。號碼與名字一致會直接帶入；不符或號碼看不清會黃框（例如「57 冰冰 → 名單:寶貝」）。<b>確認寫入前不會改到當日資料</b>。若相簿是 HEIC、預覽失敗，請在「照片」App 匯出 JPEG 再傳（選「相簿」時 iPhone 通常會自動轉 JPEG）。</p>
    ${ST.msg?`<p class=hint style="color:#8fd">${esc(ST.msg)}</p>`:''}
    ${ST.err?`<p class=err>${esc(ST.err)}</p>`:''}
    <div class=row>
      <button type=button id=piGo>開始核對</button>
      <button type=button class=s id=piTpl>下載 CSV 範本</button>
      <button type=button class=s id=piArc>匯入校對</button>
      <button type=button class=s id=piBack>返回排檯表</button>
    </div>`);
  const bind=(id,fn)=>{const el=document.getElementById(id);if(el)el.addEventListener(id==='piDay'?'change':'click',fn)};
  document.getElementById('piDay').onchange=e=>{ST.day=e.target.value;if(ST.parsed)ST.parsed.day=ST.day};
  const onFiles=async ev=>{
    const list=ev.target.files;if(!list||!list.length)return;
    ST.day=(document.getElementById('piDay')||{}).value||ST.day;
    ST.busy=true;ST.msg='正在壓縮照片…';ST.err='';renderPick();
    try{await ingestFiles(list)}finally{ST.busy=false;ev.target.value='';renderPick()}
  };
  document.getElementById('piCam').onchange=onFiles;
  document.getElementById('piAlbum').onchange=onFiles;
  document.getElementById('piSheet').onchange=onFiles;
  document.getElementById('piGo').onclick=()=>{ST.day=(document.getElementById('piDay')||{}).value||ST.day;if(ST.parsed)ST.parsed.day=ST.day;if(!ST.parsed)ST.parsed=emptyParsed(ST.day);ST.step='preview';renderPreview()};
  document.getElementById('piTpl').onclick=downloadTpl;
  const arc=document.getElementById('piArc');if(arc)arc.onclick=()=>openArchive();
  document.getElementById('piBack').onclick=backToSheet;
}
function downloadTpl(){
  const d=ST.day||todayBiz()||'2026-01-01';
  const a=`日期,${d}\n序,包廂,進場時間,人數,結束,訂番幹部,備註\n1,102,20:00,4,N,,\n`;
  const b=`番,號碼,紙本名字,系統名字,記號,匯入,待確認,備註\n1,01,,,紅,是,,\n`;
  const blob=new Blob(['\ufeff'+a+'\n'+b],{type:'text/csv;charset=utf-8'});
  const url=URL.createObjectURL(blob);const ael=document.createElement('a');ael.href=url;ael.download='排檯表匯入範本.csv';ael.click();setTimeout(()=>URL.revokeObjectURL(url),500);
}
function backToSheet(){
  ST.step='pick';
  try{if(typeof openSheet==='function')openSheet();else if(typeof openGrid==='function')openGrid()}catch(e){}
}

function collectEdits(p){
  const dayEl=document.getElementById('piDay');if(dayEl&&dayEl.value){ST.day=dayEl.value;p.day=dayEl.value}
  const mode=document.getElementById('piMode');if(mode)ST.mode=mode.value;
  const pol=document.getElementById('piPol');if(pol)ST.livePol=pol.value;
  const rows={};const marks=[];
  document.querySelectorAll('tr[data-seq]').forEach(tr=>{
    const seq=tr.getAttribute('data-seq');
    const room=tr.querySelector('[data-k=room]')?tr.querySelector('[data-k=room]').value.trim():'';
    const tm=parseHm(tr.querySelector('[data-k=tm]')?tr.querySelector('[data-k=tm]').value:'');
    const guestsRaw=tr.querySelector('[data-k=guests]')?tr.querySelector('[data-k=guests]').value:'';
    const guests=guestsRaw===''?null:(+guestsRaw>0?+guestsRaw:null);
    const ended=tr.querySelector('[data-k=ended]')?tr.querySelector('[data-k=ended]').checked:false;
    const staff=tr.querySelector('[data-k=staff]')?tr.querySelector('[data-k=staff]').value.trim():'';
    const old=p.rows[seq]||{seq,conf:1};
    rows[seq]={...old,seq,room:room||'?',tm,guests,ended,orderStaff:staff};
    if(staff)p.ext.orderStaff[seq]=staff;
    tr.querySelectorAll('[data-mark]').forEach(sel=>{
      const id=nid(sel.getAttribute('data-id')||sel.value);
      const ty=sel.value;
      if(id&&MARKS.includes(ty)){
        const low=sel.closest('td')&&sel.closest('td').classList.contains('low');
        const oldm=(p.marks||[]).find(x=>String(x[0])===String(seq)&&String(x[1])===String(id));
        const paper=sel.getAttribute('data-paper')||(oldm&&oldm[5])||'';
        const sys=sel.getAttribute('data-sys')||(oldm&&oldm[6])||'';
        const note=(oldm&&oldm[4])||'';
        marks.push([seq,id,ty,low?0.45:1,note,paper,sys]);
      }
    });
    // new mark row inputs
    const nidEl=tr.querySelector('[data-k=newid]');
    const ntyEl=tr.querySelector('[data-k=newty]');
    if(nidEl&&nidEl.value&&ntyEl&&MARKS.includes(ntyEl.value))marks.push([seq,nid(nidEl.value),ntyEl.value,1,'','','']);
  });
  p.rows=rows;p.marks=marks;p.day=ST.day||p.day;
  return p;
}
function renderPreview(){
  let p=ST.parsed||emptyParsed(ST.day);
  p.day=ST.day||p.day||todayBiz();
  const tot=totals(p);
  const prev=existingImp(p.day);
  const thumbs=ST.photos.map((ph,i)=>`<img class=big src="${ph.dataUrl}" alt="紙本${i+1}">`).join('');
  const seqs=Object.keys(p.rows).sort((a,b)=>((+a)||0)-((+b)||0));
  if(!seqs.length){
    // blank grid so 幹部 can transcribe from the photo
    p.rows['1']={seq:'1',room:'',tm:null,guests:null,ended:false,orderStaff:'',note:'',conf:0.4,src:'空白'};
  }
  const body=Object.keys(p.rows).sort((a,b)=>((+a)||0)-((+b)||0)).map(seq=>{
    const r=p.rows[seq];
    const ms=p.marks.filter(m=>String(m[0])===String(seq));
    const lowRow=r.conf<0.7;
    const marksHtml=ms.map((m,i)=>{
      const roster=(m[6]||((typeof G==='function'&&G(m[1])&&G(m[1]).name)?String(G(m[1]).name).replace(/^\s*\d+\s*號?\s*/,''):''))||'';
      const paper=m[5]||'';
      const np=String(paper).replace(/\s+/g,'').replace(/^\d+號?/,''), nr=String(roster).replace(/\s+/g,'').replace(/^\d+號?/,'');
      const disagree=!!(paper&&roster&&np!==nr);
      const noId=!String(m[1]||'').trim();
      const low=m[3]<0.7||disagree||noId||(typeof G==='function'&&m[1]&&!G(m[1]));
      let label;
      if(disagree) label=`${esc(m[1]||'？')} ${esc(paper)} → 名單:${esc(roster)}`;
      else if(noId) label=`？${paper?' '+esc(paper):''}${roster?' → 名單:'+esc(roster):''}`;
      else label=esc(m[1])+(roster?' '+esc(roster):(paper?' '+esc(paper):''));
      const hint=m[4]?`<br><small>${esc(m[4])}</small>`:(disagree?`<br><small>紙本寫「${esc(paper)}」，名冊是「${esc(roster)}」</small>`:'');
      return`<td class="${low?'low':''}"><div>${label}${hint}</div>
        <select data-mark data-id="${esc(m[1])}" data-paper="${esc(paper)}" data-sys="${esc(roster)}">${markMenu(m[2])}</select></td>`
    }).join('')+`<td><input data-k=newid placeholder="加號碼" style="width:64px"> <select data-k=newty>${markMenu('紅')}</select></td>`;
    return`<tr data-seq="${esc(seq)}">
      <th>${esc(seq)}</th>
      <td class="${lowRow&&(!r.room||r.room==='?')?'low':''}"><input data-k=room value="${esc(r.room==='?'?'':r.room)}" style="width:64px"></td>
      <td class="${lowRow&&!r.tm?'low':''}"><input data-k=tm value="${esc(hmText(r.tm))}" style="width:72px" inputmode=decimal></td>
      <td><input data-k=guests type=number min=1 value="${r.guests||''}" style="width:52px"></td>
      <td><input data-k=ended type=checkbox ${r.ended?'checked':''}></td>
      <td><input data-k=staff value="${esc(r.orderStaff||'')}" style="width:64px"></td>
      ${marksHtml}
    </tr>`}).join('');
  const warn=[
    tot.tbd?`<p class=warn>待確認／低信心 ${tot.tbd} 項（黃框：號碼與名字不符或號碼看不清），請改正。</p>`:'',
    tot.unk?`<p class=warn>不在名冊或號碼待確認：${esc((p.unk||[]).slice(0,8).join('；'))}${(p.unk||[]).length>8?'…':''}</p>`:'',
    tot.bad?`<p class=err>無法讀取 ${tot.bad} 行：${esc((p.bad||[]).slice(0,5).join('；'))}</p>`:'',
    tot.skipped?`<p class=hint>已排除不匯入 ${tot.skipped} 筆（含記號 x）。</p>`:'',
    prev.length?`<p class=warn>這一天已經有 ${prev.length} 列先前匯入的資料。確認時請選擇「取代」或「合併」，不會默默覆蓋。寫入前會先做本機備份，可到匯入紀錄還原。</p>`:'',
    ST.photos.length?`<p class=hint>已附 ${ST.photos.length} 張照片。確認寫入時會一併送進佇列（狀態：待辨識）。目前不會自動把照片變成格子，請先對照核對。</p>`:''
  ].join('');
  page(`<h2>核對傳統排檯表</h2>
    <div class=row><label>營業日 <input type=date id=piDay value="${esc(p.day||'')}"></label></div>
    <div class=photoCol><div class=thumbs>${thumbs}</div></div>
    <p class=tot><b>番數</b> ${tot.sessions}　<b>小姐台數合計</b> ${tot.girlTai}　<small>（私檯 ${tot.priv}・訂番 ${tot.ord}；寫入後會餵學習，學習時依既有規則排除私檯／訂番）</small></p>
    ${warn}
    <div class=tw style="overflow:auto"><table>
      <tr><th>序</th><th>包廂</th><th>進場</th><th>人數</th><th>結束</th><th>訂番幹部</th><th colspan=20>記號（號碼＋紅／藍／私檯／訂番）</th></tr>
      ${body}
    </table></div>
    <p><button type=button class=s id=piAddRow>＋ 新增一序</button></p>
    <div class=row>
      <label>已有匯入時 <select id=piMode>
        <option value=replace ${ST.mode==='replace'?'selected':''}>取代本日已匯入列（先備份）</option>
        <option value=merge ${ST.mode==='merge'?'selected':''}>合併（同包廂＋同時刻保留既有、略過新列）</option>
      </select></label>
      <label>與現場進行中包廂衝突時 <select id=piPol>
        <option value=skip ${ST.livePol==='skip'?'selected':''}>略過該列</option>
        <option value=merge ${ST.livePol==='merge'?'selected':''}>合併進現場</option>
        <option value=replace ${ST.livePol==='replace'?'selected':''}>取代現場該番</option>
      </select></label>
    </div>
    ${ST.msg?`<p class=hint style="color:#8fd">${esc(ST.msg)}</p>`:''}
    ${ST.err?`<p class=err>${esc(ST.err)}</p>`:''}
    <div class=row>
      <button type=button id=piCommit>確認寫入</button>
      <button type=button class=s id=piBackEdit>返回選檔</button>
      <button type=button class=s id=piCancel>取消</button>
    </div>`);
  document.getElementById('piDay').onchange=e=>{ST.day=e.target.value;p.day=e.target.value};
  document.getElementById('piAddRow').onclick=()=>{
    collectEdits(p);
    const n=String(Math.max(0,...Object.keys(p.rows).map(x=>+x||0))+1);
    p.rows[n]={seq:n,room:'',tm:null,guests:null,ended:false,orderStaff:'',note:'',conf:0.4,src:'手動'};
    ST.parsed=p;renderPreview();
  };
  document.getElementById('piCommit').onclick=()=>commit();
  document.getElementById('piBackEdit').onclick=()=>{collectEdits(p);ST.parsed=p;ST.step='pick';renderPick()};
  document.getElementById('piCancel').onclick=backToSheet;
}

async function queuePhotos(p){
  if(ST.queueId)return ST.queueId;
  if(!ST.photos.length)return'';
  await uploadAndWatch(ST.photos);
  return ST.queueId||'';
}

function toApplyShape(p){
  const out={type:'排檯表',day:p.day,rows:{},marks:applyMarksForSheet(p),bad:p.bad||[],unk:p.unk||[],tbd:p.tbd||[],ext:p.ext};
  Object.keys(p.rows).forEach(k=>{
    const r=p.rows[k];
    out.rows[k]={seq:r.seq,room:r.room||'?',tm:r.tm,guests:r.guests,ended:!!r.ended};
  });
  return out;
}

async function commit(){
  if(typeof needRole==='function'&&!needRole(2,'匯入傳統排檯表'))return;
  let p=collectEdits(ST.parsed||emptyParsed(ST.day));
  if(!p.day||!/^\d{4}-\d{2}-\d{2}$/.test(p.day)){alert('請先選擇營業日');return}
  if(!Object.keys(p.rows).length){alert('沒有可寫入的列');return}
  const prev=existingImp(p.day);
  const mode=ST.mode||'replace';
  if(prev.length){
    const msg=mode==='merge'
      ?`本日已有 ${prev.length} 列先前匯入資料。將合併寫入：同包廂且同時刻的新列會略過，既有列保留。確定？`
      :`本日已有 ${prev.length} 列先前匯入資料。將取代這些已匯入列（現場未匯入的進行中包廂不會默默蓋掉，衝突時依你選的政策）。寫入前會備份，可到匯入紀錄還原。確定取代？`;
    if(!confirm(msg))return;
  }else if(!confirm(`寫入 ${p.day} 的排檯表？\n番數 ${totals(p).sessions}、小姐台數合計 ${totals(p).girlTai}`))return;
  let applyP=p;
  if(mode==='merge'&&prev.length){
    applyP=mergeKeepOld(fromExisting(p.day),p);
  }
  const shaped=toApplyShape(applyP);
  let stat={};
  try{
    if(typeof snapState==='function')S.impSnap=snapState();
    const pol=ST.livePol||'skip';
    stat=typeof applySheet==='function'?applySheet(shaped,pol):{error:'找不到 applySheet'};
    if(S.impAudit)S.impAudit.unshift(Object.assign({t:typeof now==='function'?now():Date.now(),by:(S.cur&&S.cur.name)||'',role:(S.cur&&S.cur.role)||'',type:'排檯表',day:p.day,reason:'匯入傳統排檯表',policy:mode+'/'+pol,queueId:ST.queueId||''},stat||{}));
    if(typeof log==='function')log(`【匯入傳統排檯表】${p.day}（${(S.cur&&S.cur.name)||''}／${(S.cur&&S.cur.role)||''}）${mode==='merge'?'合併':'取代'} ${totals(applyP).sessions} 番`);
    if(typeof save==='function')save();
    if(typeof render==='function')render();
  }catch(e){alert('寫入失敗：'+(e.message||e));return}
  const qid=await queuePhotos(p);
  let archOk='';
  try{const aid=await saveArchive(p,applyP,stat,qid);if(aid)archOk='\n已存備份，可到「匯入校對」對照原圖。'}catch(e){archOk='\n寫入成功，但備份失敗：'+(e&&e.message||e)}
  const extra=(qid?'\n照片已送進待辨識佇列。':'')+archOk;
  const bits=stat&&typeof stat==='object'?Object.entries(stat).filter(([,v])=>v).map(([k,v])=>k+' '+v).join('、'):'';
  alert('已寫入 '+p.day+'：番數 '+totals(applyP).sessions+'、小姐台數合計 '+totals(applyP).girlTai+(bits?'（'+bits+'）':'')+extra);
  ST.step='pick';ST.parsed=null;ST.rawParsed=null;ST.files=[];ST.photos=[];ST.queueId='';
  try{if(typeof shDay!=='undefined')shDay=p.day;if(typeof openSheet==='function')openSheet()}catch(e){}
}

function open(opt){
  if(typeof needRole==='function'&&!needRole(2,'匯入傳統排檯表'))return;
  ST.day=(opt&&opt.day)||(typeof shDay!=='undefined'&&shDay)||todayBiz();
  ST.files=[];ST.photos=[];ST.parsed=null;ST.rawParsed=null;ST.step='pick';ST.mode='replace';ST.livePol='skip';ST.err='';ST.queueId='';
  renderPick();
}
function hookButtons(){
  const h=document.querySelector('#page h2')||document.querySelector('.gtop');
  if(h&&!h.querySelector('.gimp')&&(typeof lvl!=='function'||lvl()>=2)){
    const b=document.createElement('button');b.type='button';b.className='s gimp';b.textContent='匯入傳統排檯表';
    b.onclick=()=>open({day:typeof shDay!=='undefined'?shDay:(GR&&GR.day)||''});
    h.appendChild(b);
    if(!h.querySelector('.garc')){const a=document.createElement('button');a.type='button';a.className='s garc';a.textContent='匯入校對';a.onclick=()=>openArchive();h.appendChild(a)}
  }
  const gtop=document.querySelector('.gtop');
  if(gtop&&!gtop.querySelector('.gimp')&&(typeof canEdit!=='function'||typeof lvl!=='function'||lvl()>=2)){
    const b=document.createElement('button');b.type='button';b.className='s gimp';b.textContent='匯入傳統排檯表';
    b.onclick=()=>open({day:(typeof GR!=='undefined'&&GR.day)||todayBiz()});
    gtop.appendChild(b);
    if(!gtop.querySelector('.garc')){const a=document.createElement('button');a.type='button';a.className='s garc';a.textContent='匯入校對';a.onclick=()=>openArchive();gtop.appendChild(a)}
  }
}


function cloneParsed(p){
  try{return JSON.parse(JSON.stringify(p,function(k,v){return (k==='photos'||k==='dataUrl')?undefined:v}))}catch(e){return p}
}
function snapRawIfNeeded(){
  if(ST.rawParsed||!ST.parsed)return;
  if(!Object.keys(ST.parsed.rows||{}).length&&!(ST.parsed.marks||[]).length)return;
  ST.rawParsed=cloneParsed(ST.parsed);
}
function compactParsed(p){
  if(!p)return {};
  const rows={};
  Object.keys(p.rows||{}).forEach(k=>{
    const r=p.rows[k]||{};
    rows[k]={seq:r.seq||k,room:r.room||'',tm:r.tm||null,guests:r.guests==null?null:r.guests,ended:!!r.ended,orderStaff:r.orderStaff||'',note:r.note||'',conf:r.conf==null?null:r.conf,src:r.src||''};
  });
  const marks=(p.marks||[]).map(m=>[m[0],m[1],m[2],m[3]==null?null:m[3],m[4]||'',m[5]||'',m[6]||'']);
  return {day:p.day||'',rows,marks,tbd:p.tbd||[],bad:p.bad||[],unk:p.unk||[],skipped:p.skipped||[]};
}
function collectDiffs(saved,raw){
  const diffs=[];
  const add=(kind,text,extra)=>diffs.push(Object.assign({kind,text},extra||{}));
  (saved&&saved.tbd||[]).concat(raw&&raw.tbd||[]).forEach(t=>add('待審',String(t)));
  (saved&&saved.unk||[]).concat(raw&&raw.unk||[]).forEach(t=>add('不在名冊',String(t)));
  (saved&&saved.bad||[]).concat(raw&&raw.bad||[]).forEach(t=>add('無法讀取',String(t)));
  (saved&&saved.marks||[]).forEach(m=>{
    const paper=String(m[5]||'').replace(/\s+/g,'').replace(/^\d+號?/,'');
    const roster=String(m[6]||'').replace(/\s+/g,'').replace(/^\d+號?/,'');
    if(paper&&roster&&paper!==roster)add('名字不符','編號 '+(m[1]||'？')+' 紙本「'+(m[5]||'')+'」→ 名冊「'+(m[6]||'')+'」',{seq:String(m[0]),id:m[1],paper:m[5],sys:m[6]});
    if(!String(m[1]||'').trim())add('號碼不清','序'+m[0]+' 紙本名字「'+(m[5]||'')+'」',{seq:String(m[0]),paper:m[5]});
  });
  if(raw&&raw.rows){
    const rawKeys=new Set(Object.keys(raw.rows));
    const savKeys=new Set(Object.keys((saved&&saved.rows)||{}));
    savKeys.forEach(k=>{
      if(!rawKeys.has(k)){add('人工新增','序'+k,{seq:k});return}
      const a=raw.rows[k]||{},b=(saved.rows||{})[k]||{},ch=[];
      if((a.room||'')!==(b.room||''))ch.push('包廂 '+(a.room||'（空）')+'→'+(b.room||'（空）'));
      if(hmText(a.tm)!==hmText(b.tm))ch.push('時間 '+(hmText(a.tm)||'（空）')+'→'+(hmText(b.tm)||'（空）'));
      if(!!a.ended!==!!b.ended)ch.push('結束 '+(a.ended?'Y':'N')+'→'+(b.ended?'Y':'N'));
      if((a.orderStaff||'')!==(b.orderStaff||''))ch.push('訂番幹部變更');
      if(ch.length)add('人工修改','序'+k+' '+ch.join('、'),{seq:k});
    });
    rawKeys.forEach(k=>{if(!savKeys.has(k))add('人工刪除','序'+k+' 包廂'+((raw.rows[k]||{}).room||''),{seq:k})});
  }
  const seen=new Set();
  return diffs.filter(d=>{const k=d.kind+'|'+d.text;if(seen.has(k))return false;seen.add(k);return true});
}
async function saveArchive(orig,applied,stat,qid){
  if(!window.Cloud||typeof Cloud.saveImportArchive!=='function')return '';
  const raw=compactParsed(ST.rawParsed||orig);
  const saved=compactParsed(applied||orig);
  const tot=totals(applied||orig);
  return await Cloud.saveImportArchive({
    day:(applied||orig).day,
    queueId:qid||ST.queueId||'',
    files:(ST.files||[]).map(f=>({name:f.name||'',size:f.size||0,type:f.type||''})),
    photoCount:(ST.photos||[]).length,
    mode:ST.mode||'',
    livePol:ST.livePol||'',
    raw,saved,
    diffs:collectDiffs(saved,raw),
    stat:stat&&typeof stat==='object'?stat:{},
    sessions:tot.sessions,marks:(saved.marks||[]).length
  });
}
function taipeiText(ms,fallback){
  if(fallback)return fallback;
  if(!ms)return '';
  try{return new Date(ms).toLocaleString('zh-TW',{timeZone:'Asia/Taipei',hour12:false})+' 台北'}catch(e){return String(ms)}
}
function downloadBlob(name,mime,text){
  const a=document.createElement('a');
  a.href=URL.createObjectURL(new Blob([text],{type:mime}));
  a.download=name;a.click();
  setTimeout(()=>{try{URL.revokeObjectURL(a.href)}catch(e){}},2000);
}
function csvEsc(v){const s=String(v==null?'':v);return /[",\n]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s}
function archiveToCsv(rec){
  const p=(rec&&rec.saved)||{};
  const rows=p.rows||{};
  const reviewed=(rec&&rec.reviewedRows)||{};
  const head=['序','包廂','進場','人數','結束','訂番幹部','編號','記號','紙本名字','名冊名字','已校對'];
  const lines=[head.join(',')];
  Object.keys(rows).sort((a,b)=>((+a)||0)-((+b)||0)).forEach(seq=>{
    const r=rows[seq]||{};
    const ms=(p.marks||[]).filter(m=>String(m[0])===String(seq));
    if(!ms.length){
      lines.push([seq,r.room,hmText(r.tm),r.guests,r.ended?'Y':'',r.orderStaff,'','','','',reviewed[seq]?'是':''].map(csvEsc).join(','));
      return;
    }
    ms.forEach(m=>{
      lines.push([seq,r.room,hmText(r.tm),r.guests,r.ended?'Y':'',r.orderStaff,m[1]||'',m[2]||'',m[5]||'',m[6]||'',(reviewed[seq]||reviewed[seq+':'+m[1]])?'是':''].map(csvEsc).join(','));
    });
  });
  if(rec&&rec.diffs&&rec.diffs.length){
    lines.push('');
    lines.push(['差異種類','說明','序','編號'].map(csvEsc).join(','));
    rec.diffs.forEach(d=>lines.push([d.kind,d.text,d.seq||'',d.id||''].map(csvEsc).join(',')));
  }
  return lines.join('\n');
}
async function openArchive(){
  if(typeof needRole==='function'&&!needRole(2,'匯入校對'))return;
  ARC.busy=true;ARC.err='';ARC.cur=null;ARC.photos=[];
  renderArchiveList();
  try{
    if(!window.Cloud||typeof Cloud.listImportArchives!=='function'){ARC.err='雲端尚未就緒，請稍後再試。';ARC.busy=false;renderArchiveList();return}
    ARC.list=await Cloud.listImportArchives();
  }catch(e){ARC.err='讀取備份失敗：'+(e&&e.message||e)}
  ARC.busy=false;renderArchiveList();
}
function renderArchiveList(){
  const rows=(ARC.list||[]).map(r=>{
    const st=r.status||'待校對';
    const ok=st==='已校對';
    const nDiff=(r.diffs||[]).length;
    const who=esc(r.byName||'');
    return `<div class=arc-card>
      <div><b>${esc(r.day||'（無日期）')}</b><div class=hint>${esc(taipeiText(r.at,r.atTaipei))}　${who}　番數 ${r.sessions||0}${nDiff?'　差異 '+nDiff:''}</div></div>
      <div class=row>
        <span class="arc-st${ok?' ok':''}">${esc(st)}</span>
        <button type=button data-open="${esc(r.id)}">打開校對</button>
      </div>
    </div>`}).join('')||'<p class=hint>尚無匯入備份。幹部以上匯入傳統排檯表並確認寫入後，會自動存到這裡。</p>';
  pageArc(`<h2>匯入校對</h2>
    <p class=hint>幹部以上可打開過去的匯入，對照原圖與已存資料、把列標成已校對，並下載 JSON／CSV。備份不會覆蓋或刪除既有帳單，金額也不會改。</p>
    ${ARC.busy?'<p class=hint>讀取中…</p>':''}
    ${ARC.err?`<p class=err>${esc(ARC.err)}</p>`:''}
    <div class=arc-list>${rows}</div>
    <div class=row>
      <button type=button class=s id=arcReload>重新整理</button>
      <button type=button class=s id=arcImp>匯入傳統排檯表</button>
      <button type=button class=s id=arcBack>返回</button>
    </div>`);
  document.querySelectorAll('[data-open]').forEach(b=>b.onclick=()=>openArchiveDetail(b.getAttribute('data-open')));
  const rel=document.getElementById('arcReload');if(rel)rel.onclick=()=>openArchive();
  const imp=document.getElementById('arcImp');if(imp)imp.onclick=()=>open();
  const back=document.getElementById('arcBack');if(back)back.onclick=backToSheet;
}
function pageArc(html){
  ensureCss();
  if(typeof pageOpen==='function')pageOpen(`<div class="pi arc">${html}</div>`);
  else document.body.innerHTML=html;
}
async function openArchiveDetail(id){
  if(typeof needRole==='function'&&!needRole(2,'匯入校對'))return;
  ARC.busy=true;ARC.err='';ARC.cur=null;ARC.photos=[];
  renderArchiveDetail();
  try{
    const rec=await Cloud.getImportArchive(id);
    if(!rec){ARC.err='找不到這筆備份。';ARC.busy=false;renderArchiveList();return}
    ARC.cur=rec;
    if(rec.queueId&&typeof Cloud.getSheetImportPhotos==='function'){
      ARC.photos=await Cloud.getSheetImportPhotos(rec.queueId);
    }
  }catch(e){ARC.err='讀取失敗：'+(e&&e.message||e)}
  ARC.busy=false;renderArchiveDetail();
}
function renderArchiveDetail(){
  const rec=ARC.cur;
  if(!rec&&ARC.busy){pageArc('<h2>匯入校對</h2><p class=hint>讀取中…</p>');return}
  if(!rec){renderArchiveList();return}
  const saved=rec.saved||{};
  const raw=rec.raw||{};
  const reviewed=Object.assign({},rec.reviewedRows||{});
  const diffs=rec.diffs||[];
  const thumbs=(ARC.photos||[]).filter(p=>p.dataUrl).map((p,i)=>`<img class=big src="${p.dataUrl}" alt="${esc(p.name||('原圖'+(i+1)))}">`).join('')
    ||'<p class=hint>這筆沒有可顯示的原圖（可能是試算表／CSV，或照片還未上傳）。</p>';
  const seqs=Object.keys(saved.rows||{}).sort((a,b)=>((+a)||0)-((+b)||0));
  const body=seqs.map(seq=>{
    const r=saved.rows[seq]||{};
    const rr=(raw.rows||{})[seq];
    const changed=rr&&((rr.room||'')!==(r.room||'')||hmText(rr.tm)!==hmText(r.tm));
    const ms=(saved.marks||[]).filter(m=>String(m[0])===String(seq));
    const marksHtml=ms.map(m=>{
      const paper=m[5]||'',sys=m[6]||'';
      const np=String(paper).replace(/\s+/g,'').replace(/^\d+號?/,''),nr=String(sys).replace(/\s+/g,'').replace(/^\d+號?/,'');
      const disagree=!!(paper&&sys&&np!==nr);
      return `<td class="${disagree?'low':''}">${esc(m[1]||'？')} ${esc(m[2]||'')}${sys?' '+esc(sys):''}${disagree?`<br><small>紙本「${esc(paper)}」→ 名冊「${esc(sys)}」</small>`:paper&&!disagree?`<br><small>${esc(paper)}</small>`:''}</td>`;
    }).join('')||'<td></td>';
    const chk=reviewed[seq]?'checked':'';
    return `<tr class="${changed?'diff':''}" data-seq="${esc(seq)}">
      <th>${esc(seq)}</th>
      <td>${esc(r.room||'')}</td>
      <td>${esc(hmText(r.tm))}</td>
      <td>${r.guests==null?'':esc(r.guests)}</td>
      <td>${r.ended?'Y':''}</td>
      <td>${esc(r.orderStaff||'')}</td>
      ${marksHtml}
      <td><label style="display:inline-flex;align-items:center;gap:6px;min-height:44px"><input type=checkbox data-rev="${esc(seq)}" ${chk}> 已校對</label></td>
    </tr>`}).join('')||'<tr><td colspan=8>沒有已存列</td></tr>';
  const diffHtml=diffs.length?`<ul>${diffs.map(d=>`<li><b>${esc(d.kind)}</b> ${esc(d.text)}</li>`).join('')}</ul>`:'<p class=hint>沒有標出的差異或待審項目。</p>';
  const files=(rec.files||[]).map(f=>esc(f.name||'')).filter(Boolean).join('、');
  pageArc(`<h2>匯入校對　${esc(rec.day||'')}</h2>
    <p class=hint>${esc(taipeiText(rec.at,rec.atTaipei))}　${esc(rec.byName||'')}（${esc((typeof RL==='function'?RL(rec.byRole):rec.byRole)||rec.byRole||'')}）　狀態 <span class="arc-st${rec.status==='已校對'?' ok':''}">${esc(rec.status||'待校對')}</span></p>
    ${files?`<p class=files>原始檔：${files}</p>`:''}
    ${ARC.err?`<p class=err>${esc(ARC.err)}</p>`:''}
    <div class=arc-split>
      <div class="pane photo"><h3>原圖</h3><div class=thumbs>${thumbs}</div></div>
      <div class=pane>
        <h3>已存資料</h3>
        <p class=tot>番數 ${esc(rec.sessions||Object.keys(saved.rows||{}).length)}　記號 ${(saved.marks||[]).length}</p>
        <div class=tw style="overflow:auto"><table>
          <tr><th>序</th><th>包廂</th><th>進場</th><th>人數</th><th>結束</th><th>訂番幹部</th><th colspan=8>記號</th><th>校對</th></tr>
          ${body}
        </table></div>
        <h3>差異／待審</h3>
        ${diffHtml}
      </div>
    </div>
    <div class=row>
      <button type=button id=arcMarkAll>全部標為已校對</button>
      <button type=button id=arcSave>儲存校對標記</button>
      <button type=button class=s id=arcJson>下載 JSON</button>
      <button type=button class=s id=arcCsv>下載 CSV</button>
      <button type=button class=s id=arcBackList>返回清單</button>
    </div>`);
  const collectRev=()=>{
    const o={};
    document.querySelectorAll('[data-rev]').forEach(el=>{if(el.checked)o[el.getAttribute('data-rev')]={ok:true}});
    return o;
  };
  const all=document.getElementById('arcMarkAll');
  if(all)all.onclick=()=>{document.querySelectorAll('[data-rev]').forEach(el=>el.checked=true)};
  const sv=document.getElementById('arcSave');
  if(sv)sv.onclick=async()=>{
    const reviewedRows=collectRev();
    const keys=Object.keys(reviewedRows);
    const allDone=seqs.length>0&&seqs.every(s=>reviewedRows[s]);
    try{
      await Cloud.updateImportReview(rec.id,{reviewedRows,reviewed:allDone,status:allDone?'已校對':(keys.length?'校對中':'待校對')});
      rec.reviewedRows=reviewedRows;rec.reviewed=allDone;rec.status=allDone?'已校對':(keys.length?'校對中':'待校對');
      alert(allDone?'已全部標為已校對':'已儲存校對標記');
      renderArchiveDetail();
    }catch(e){alert('儲存失敗：'+(e&&e.message||e))}
  };
  const js=document.getElementById('arcJson');
  if(js)js.onclick=()=>{
    const out=Object.assign({},rec,{photos:(ARC.photos||[]).map(p=>({name:p.name,mime:p.mime,w:p.w,h:p.h,dataUrl:p.dataUrl||''}))});
    downloadBlob('import-'+ (rec.day||'archive')+'-'+(rec.id||'')+'.json','application/json;charset=utf-8',JSON.stringify(out,null,2));
  };
  const cs=document.getElementById('arcCsv');
  if(cs)cs.onclick=()=>downloadBlob('import-'+(rec.day||'archive')+'-'+(rec.id||'')+'.csv','text/csv;charset=utf-8','\ufeff'+archiveToCsv(rec));
  const back=document.getElementById('arcBackList');if(back)back.onclick=()=>openArchive();
}


const PaperImport={open,openArchive,parseCsvText,parseWorkbook,mergeParsed,totals,emptyParsed,ingestFiles,ST,hookButtons};
global.PaperImport=PaperImport;
global.openPaperImport=open;
global.openImportArchive=openArchive;
// wrap openSheet if present (grid.js may also wrap)
if(typeof global.openSheet==='function'&&!global.openSheet._piHook){
  const os=global.openSheet;
  global.openSheet=function(){os.apply(this,arguments);hookButtons()};
  global.openSheet._piHook=true;
}
})(typeof window!=='undefined'?window:globalThis);
