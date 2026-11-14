// v12.18 匯入傳統排檯表（照片立即壓縮上傳、分塊、辨識後填入核對表；不在客戶端放 AI 金鑰）
(function(global){
const MARKS=['紅','藍','私檯','訂番'];
const XLSX_SRC='https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';
let xlsxLoading=null;
const ST={day:'',files:[],photos:[],parsed:null,step:'pick',mode:'replace',livePol:'skip',queueId:'',busy:false,err:''};

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
  .pi{max-width:720px;margin:0 auto;padding:0 0 24px;font-size:16px}
  .pi h2{font-size:20px;margin:8px 0 12px}
  .pi .row{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:10px 0}
  .pi button,.pi label.pibtn{min-height:44px;min-width:44px;padding:10px 14px;font-size:16px;border-radius:10px;border:0;background:#3a6;color:#fff}
  .pi button.s,.pi label.pibtn.s{background:#3a4150}
  .pi button:disabled{opacity:.5}
  .pi input[type=date],.pi input[type=text],.pi input[type=number],.pi select{font-size:16px;min-height:44px;padding:8px;border-radius:8px;border:1px solid #445;background:#1c1f27;color:#eee}
  .pi .hint{font-size:14px;color:#bbb;line-height:1.5}
  .pi .warn{color:#fc6}
  .pi .err{color:#f66}
  .pi .files{font-size:14px}
  .pi .thumbs{display:flex;flex-wrap:wrap;gap:8px;margin:8px 0}
  .pi .thumbs img{width:120px;height:90px;object-fit:cover;border-radius:8px;border:1px solid #445;background:#111}
  .pi .thumbs img.big{width:100%;max-width:720px;height:auto;max-height:280px}
  .pi table{border-collapse:collapse;width:100%;font-size:14px}
  .pi td,.pi th{border:1px solid #445;padding:6px 4px;text-align:center}
  .pi td.low{background:#5a4a10;outline:2px solid #fc6}
  .pi .tot{font-size:16px;margin:8px 0}
  .pi textarea, .pi input.cell{width:100%;font-size:16px;min-height:36px;background:#1c1f27;color:#eee;border:0;text-align:center}
  .pi .photoCol{position:sticky;top:0;z-index:2;background:#1a1d24;padding:6px 0}
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
        ST.msg='已辨識，請核對黃框後再確認寫入。辨識結果尚未寫入當日排檯表。';
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
    選好照片後會先壓縮再上傳；辨識完成會自動填入核對表（黃框請改正）。<b>確認寫入前不會改到當日資料</b>。若相簿是 HEIC、預覽失敗，請在「照片」App 匯出 JPEG 再傳（選「相簿」時 iPhone 通常會自動轉 JPEG）。</p>
    ${ST.msg?`<p class=hint style="color:#8fd">${esc(ST.msg)}</p>`:''}
    ${ST.err?`<p class=err>${esc(ST.err)}</p>`:''}
    <div class=row>
      <button type=button id=piGo>開始核對</button>
      <button type=button class=s id=piTpl>下載 CSV 範本</button>
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
        marks.push([seq,id,ty,low?0.45:1,'','','']);
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
      const low=m[3]<0.7||(typeof G==='function'&&!G(m[1]));
      return`<td class="${low?'low':''}"><div>${esc(m[1])}${m[5]&&m[6]&&m[5]!==m[6]?`<br><small>${esc(m[5])}→${esc(m[6])}</small>`:''}</div>
        <select data-mark data-id="${esc(m[1])}">${markMenu(m[2])}</select></td>`
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
    tot.tbd?`<p class=warn>待確認／低信心 ${tot.tbd} 項（黃框），請點進去改。</p>`:'',
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
  const extra=qid?'\n照片已送進待辨識佇列。':'';
  const bits=stat&&typeof stat==='object'?Object.entries(stat).filter(([,v])=>v).map(([k,v])=>k+' '+v).join('、'):'';
  alert('已寫入 '+p.day+'：番數 '+totals(applyP).sessions+'、小姐台數合計 '+totals(applyP).girlTai+(bits?'（'+bits+'）':'')+extra);
  ST.step='pick';ST.parsed=null;ST.files=[];ST.photos=[];ST.queueId='';
  try{if(typeof shDay!=='undefined')shDay=p.day;if(typeof openSheet==='function')openSheet()}catch(e){}
}

function open(opt){
  if(typeof needRole==='function'&&!needRole(2,'匯入傳統排檯表'))return;
  ST.day=(opt&&opt.day)||(typeof shDay!=='undefined'&&shDay)||todayBiz();
  ST.files=[];ST.photos=[];ST.parsed=null;ST.step='pick';ST.mode='replace';ST.livePol='skip';ST.err='';ST.queueId='';
  renderPick();
}
function hookButtons(){
  const h=document.querySelector('#page h2')||document.querySelector('.gtop');
  if(h&&!h.querySelector('.gimp')&&(typeof lvl!=='function'||lvl()>=2)){
    const b=document.createElement('button');b.type='button';b.className='s gimp';b.textContent='匯入傳統排檯表';
    b.onclick=()=>open({day:typeof shDay!=='undefined'?shDay:(GR&&GR.day)||''});
    h.appendChild(b);
  }
  const gtop=document.querySelector('.gtop');
  if(gtop&&!gtop.querySelector('.gimp')&&(typeof canEdit!=='function'||typeof lvl!=='function'||lvl()>=2)){
    const b=document.createElement('button');b.type='button';b.className='s gimp';b.textContent='匯入傳統排檯表';
    b.onclick=()=>open({day:(typeof GR!=='undefined'&&GR.day)||todayBiz()});
    gtop.appendChild(b);
  }
}

const PaperImport={open,parseCsvText,parseWorkbook,mergeParsed,totals,emptyParsed,ingestFiles,ST,hookButtons};
global.PaperImport=PaperImport;
global.openPaperImport=open;
// wrap openSheet if present (grid.js may also wrap)
if(typeof global.openSheet==='function'&&!global.openSheet._piHook){
  const os=global.openSheet;
  global.openSheet=function(){os.apply(this,arguments);hookButtons()};
  global.openSheet._piHook=true;
}
})(typeof window!=='undefined'?window:globalThis);
