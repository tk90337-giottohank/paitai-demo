// v12.30 幹部薪資：底薪 + 當月總番數 × 職位每番抽成（依目前分店）
(function(global){
const POSTS=['店長','主要幹部','現場經理','儲備幹部'];
const RATE0={店長:100,'主要幹部':90,'現場經理':80,'儲備幹部':70};
const BASE0=30000;

function lvNow(){
  try{if(global.Cloud&&typeof Cloud.lv==='function'){const n=Cloud.lv();if(n||n===0)return n}}catch(e){}
  try{return typeof lvl==='function'?lvl():0}catch(e){return 0}
}
function canSee(){return lvNow()>=3}
function canEditRates(){return lvNow()>=4}
function yen(n){return Math.round(+n||0).toLocaleString('zh-Hant')}
function bidNow(){return typeof currentBranch==='function'?currentBranch():(global.S&&S.branchId)||'xindian'}
function defBranch(){return (typeof DEFAULT_BRANCH!=='undefined'&&DEFAULT_BRANCH)||'xindian'}
function userBranch(u){return(u&&u.branchId)||defBranch()}
function dispPerson(u){
  if(!u)return '';
  const nm=String(u.name||u.staffId||'');
  if(nm==='特殊'||(u.role==='特殊'&&(nm==='特殊'||!nm)))return '冠廷';
  return nm==='特殊'?'冠廷':nm;
}
function dispRole(r){
  if(typeof RL==='function')return RL(r);
  return r==='特殊'?'冠廷':(r||'');
}
function taipeiNow(){
  if(global.Cloud&&typeof Cloud.taipeiNow==='function')return Cloud.taipeiNow();
  return new Date().toLocaleString('zh-TW',{timeZone:'Asia/Taipei',hour12:false});
}
function ensureCadrePay(){
  const S=global.S;if(!S)return{base:BASE0,rates:Object.assign({},RATE0),log:[],posts:{},overrides:{}};
  const cur=(S.cadrePay&&typeof S.cadrePay==='object')?S.cadrePay:{};
  const rates=Object.assign({},RATE0,cur.rates&&typeof cur.rates==='object'?cur.rates:{});
  POSTS.forEach(p=>{const n=+rates[p];rates[p]=Number.isFinite(n)&&n>=0?n:RATE0[p]});
  const base=Number.isFinite(+cur.base)&&+cur.base>=0?Math.round(+cur.base):BASE0;
  S.cadrePay={base,rates,log:Array.isArray(cur.log)?cur.log.slice():[],posts:(cur.posts&&typeof cur.posts==='object')?cur.posts:{},overrides:(cur.overrides&&typeof cur.overrides==='object')?cur.overrides:{}};
  return S.cadrePay;
}
function rateOf(post){const c=ensureCadrePay();return POSTS.includes(post)?(+c.rates[post]||0):0}
function postOf(uid){
  const c=ensureCadrePay(),rec=c.posts&&c.posts[uid];
  if(!rec)return '';
  if(typeof rec==='string')return POSTS.includes(rec)?rec:'';
  return POSTS.includes(rec.post)?rec.post:'';
}
function postRec(uid){
  const c=ensureCadrePay(),rec=c.posts&&c.posts[uid];
  if(!rec)return null;
  if(typeof rec==='string')return{post:rec};
  return rec;
}

function girlBranch(id,hint){
  const bid=defBranch();
  if(hint&&hint.branchId)return hint.branchId;
  try{
    if(typeof G==='function'){
      const g=G(id);
      if(g)return typeof branchOf==='function'?branchOf(g):(g.branchId||bid);
    }
  }catch(e){}
  const list=(global.S&&S.girls)||[];
  const hits=list.filter(g=>String(g.id)===String(id));
  if(hits.length===1)return hits[0].branchId||bid;
  const here=hits.find(g=>(g.branchId||bid)===bidNow());
  if(here)return here.branchId||bid;
  return bid;
}
function rowBelongs(row,bid,girlsMap){
  if(!row)return false;
  if(row.branchId)return row.branchId===bid;
  const ids=Array.isArray(row.girls)?row.girls:[];
  if(!ids.length)return (row.branchId||defBranch())===bid;
  return ids.some(id=>{
    const hint=girlsMap&&(girlsMap[id]||girlsMap[String(id)]);
    return girlBranch(id,hint)===bid;
  });
}
function rowsFromSnap(day,snap){
  if(!snap||!snap.exists)return[];
  const log=Array.isArray(snap.sheetLog)?snap.sheetLog:[];
  const rooms=snap.rooms&&typeof snap.rooms==='object'?snap.rooms:{};
  let a=log.filter(e=>e&&e.day===day).map(e=>Object.assign({},e));
  const sessionMin=(typeof C==='function'&&C()&&C().sessionMin)||60;
  const biz=typeof bizDay==='function'?bizDay:null;
  for(const r in rooms){
    const x=rooms[r];if(!x)continue;
    const bs=x.bans||[[]];
    bs.forEach((b,i)=>{
      const st=(x.banStart||[])[i]||(i==0?x.start:x.start+i*sessionMin*60000);
      const d=x.start&&biz?biz(x.start):day;
      if(d===day)a.push({day:d,room:r,ban:i+1,start:st,girls:Array.isArray(b)?b.slice():[]});
    });
  }
  return a;
}
function daySessionRows(day,bid){
  bid=bid||bidNow();
  const today=typeof bizDay==='function'?bizDay(typeof now==='function'?now():Date.now()):'';
  const girlsMap={};
  const hist=(global.S&&S.hist&&S.hist[day])||null;
  if(hist&&hist.girls)Object.keys(hist.girls).forEach(id=>{girlsMap[id]=hist.girls[id]});
  if(hist&&Array.isArray(hist.rows))return hist.rows.filter(e=>rowBelongs(e,bid,girlsMap));
  if(day===today||(global.S&&S.openDay===day)){
    const rows=typeof sheetRows==='function'?sheetRows(day):(typeof sheetRowsA==='function'?sheetRowsA(day):[]);
    return (rows||[]).filter(e=>rowBelongs(e,bid,girlsMap));
  }
  const snap=global.__cadreDaySnaps&&__cadreDaySnaps[day];
  if(snap&&snap.exists){
    if(snap.girls&&typeof snap.girls==='object'&&!Array.isArray(snap.girls)){
      Object.keys(snap.girls).forEach(id=>{girlsMap[id]=snap.girls[id]});
    }else if(Array.isArray(snap.girls)){
      snap.girls.forEach(g=>{if(g&&g.id)girlsMap[g.id]=g});
    }
    return rowsFromSnap(day,snap).filter(e=>rowBelongs(e,bid,girlsMap));
  }
  return[];
}
function monthSessionInfo(month,bid){
  bid=bid||bidNow();
  const N=typeof daysIn==='function'?daysIn(month):31;
  const days=[];let total=0;
  for(let i=1;i<=N;i++){
    const d=month+'-'+String(i).padStart(2,'0');
    const n=daySessionRows(d,bid).length;
    if(n)days.push({d,n});
    total+=n;
  }
  return{month,branchId:bid,total,days};
}
function calcPay(post,sessions,base){
  const c=ensureCadrePay();
  const b=base==null?c.base:Math.round(+base||0);
  const rate=rateOf(post);
  const n=Math.max(0,Math.round(+sessions||0));
  const commission=n*rate;
  return{base:b,sessions:n,rate,commission,total:b+commission,post};
}
function overrideOf(month,uid){
  const c=ensureCadrePay();
  const rec=(c.overrides[month]||{})[uid];
  if(rec==null)return null;
  if(typeof rec==='number')return{n:rec};
  if(typeof rec==='object'&&rec.n!=null)return rec;
  return null;
}

let cpMonth=null,cpShowLog=false,cpShowDays=false,cpUsers=[];

function collectPeople(bid){
  bid=bid||bidNow();
  const map={};
  const c=ensureCadrePay();
  Object.keys(c.posts||{}).forEach(uid=>{
    const rec=postRec(uid);if(!rec||!rec.post)return;
    const b=rec.branchId||defBranch();
    if(b!==bid)return;
    map[uid]={uid,staffId:rec.staffId||'',name:rec.name||rec.staffId||uid,branchId:b,post:rec.post,disabled:!!rec.disabled};
  });
  const list=(global.USERS&&Array.isArray(USERS)?USERS:cpUsers)||[];
  list.forEach(u=>{
    if(!u||!u.uid)return;
    if(userBranch(u)!==bid)return;
    const post=u.cadrePost&&POSTS.includes(u.cadrePost)?u.cadrePost:postOf(u.uid);
    if(!post)return;
    const prev=map[u.uid]||{};
    map[u.uid]={uid:u.uid,staffId:u.staffId||prev.staffId||'',name:dispPerson(u)||prev.name,branchId:userBranch(u),post,disabled:!!u.disabled,role:u.role};
  });
  return Object.values(map).filter(p=>!p.disabled).sort((a,b)=>{
    const ia=POSTS.indexOf(a.post),ib=POSTS.indexOf(b.post);
    return(ia<0?9:ia)-(ib<0?9:ib)||String(a.staffId).localeCompare(String(b.staffId),'zh-Hant');
  });
}

async function ensureUsersLoaded(){
  if(global.USERS&&USERS.length){cpUsers=USERS;return}
  if(!(global.Cloud&&Cloud.db&&typeof Cloud.getUsers==='function'))return;
  try{cpUsers=await Cloud.getUsers()||[]}catch(e){cpUsers=[]}
}

async function refreshDaySnaps(month){
  if(!(global.Cloud&&typeof Cloud.loadMonthDaySnaps==='function'))return;
  const today=typeof bizDay==='function'?bizDay(typeof now==='function'?now():Date.now()):'';
  const have=new Set();
  const N=typeof daysIn==='function'?daysIn(month):31;
  for(let i=1;i<=N;i++){
    const d=month+'-'+String(i).padStart(2,'0');
    if((global.S&&S.hist&&S.hist[d]&&Array.isArray(S.hist[d].rows))||d===today||(global.S&&S.openDay===d))have.add(d);
  }
  try{
    const snaps=await Cloud.loadMonthDaySnaps(month,{skip:have});
    global.__cadreDaySnaps=Object.assign(global.__cadreDaySnaps||{},snaps||{});
  }catch(e){}
}

function saveCadre(){
  ensureCadrePay();
  if(typeof save==='function')save();
}

function openCadrePay(month){
  if(!canSee()){
    if(typeof needRole==='function')return needRole(3,'幹部薪資');
    return alert('需經理以上才能查看幹部薪資');
  }
  ensureCadrePay();
  const biz=typeof bizDay==='function'?bizDay(typeof now==='function'?now():Date.now()):new Date().toISOString().slice(0,10);
  cpMonth=month||cpMonth||biz.slice(0,7);
  const bid=bidNow();
  const bname=typeof branchHTML==='function'?branchHTML(bid):(typeof branchText==='function'?branchText(bid):bid);
  const info=monthSessionInfo(cpMonth,bid);
  const autoN=info.total;
  const people=collectPeople(bid);
  const c=ensureCadrePay();
  const edit=canEditRates();
  const mid=cpMonth;
  const ratesEdit=edit?POSTS.map(p=>`<label class=cprow><span>${p}</span><span class=cprate>每番 ${yen(c.rates[p])} 元</span><input type=number inputmode=numeric min=0 step=1 value="${c.rates[p]}" data-cprate="${p}" style="width:5.5em;min-height:44px;font-size:16px"></label>`).join(''):POSTS.map(p=>`<div class=cprow><span>${p}</span><b>每番 ${yen(c.rates[p])} 元</b></div>`).join('');
  const peopleRows=people.length?people.map(p=>{
    const ov=overrideOf(mid,p.uid);
    const used=ov&&ov.n!=null?Math.round(+ov.n):autoN;
    const pay=calcPay(p.post,used);
    const ovOn=ov&&ov.n!=null;
    return`<tr>
      <td>${esc(dispPerson(p))}<br><small>${esc(p.staffId||'')}${p.role?' · '+esc(dispRole(p.role)):''}</small></td>
      <td>${esc(p.post)}</td>
      <td class=num>${yen(pay.base)}</td>
      <td class=num>${yen(pay.rate)}</td>
      <td>${ovOn?'<b>'+yen(used)+'</b> <small>（手動）</small>':yen(autoN)}
        ${edit||canSee()?`<div class=cpov><label><input type=checkbox ${ovOn?'checked':''} onchange="cadreToggleOverride('${p.uid}',this.checked)">手動覆寫</label>
        <input type=number inputmode=numeric min=0 step=1 value="${used}" data-cpov="${p.uid}" ${ovOn?'':'disabled'} style="width:5.5em;min-height:44px;font-size:16px" aria-label="總番數覆寫"></div>`:''}
      </td>
      <td class=num>${yen(pay.commission)}</td>
      <td class=num><b>${yen(pay.total)}</b></td>
    </tr>`}).join(''):`<tr><td colspan=7>此分店尚無指定「幹部職位」的帳號。請到人員帳號管理為幹部選擇職位（店長／主要幹部／現場經理／儲備幹部）。</td></tr>`;
  const dayBreak=info.days.length?`<details ${cpShowDays?'open':''} ontoggle="window._cpShowDays=this.open"><summary>系統計算的當月總番數細目（${yen(autoN)} 番）</summary>
    <div class=tw><table class=sch><tr><th>營業日</th><th>番數</th></tr>${info.days.map(x=>`<tr><td>${esc(x.d)}</td><td class=num>${x.n}</td></tr>`).join('')}<tr><th>合計</th><th class=num>${autoN}</th></tr></table></div></details>`:'<p style="font-size:13px;color:#9ab">這個月目前分店還沒有番數資料（與當月報表的「番數」同一套算法：排檯表每一列算 1 番）。</p>';
  const log=c.log.slice().sort((a,b)=>(b.at||0)-(a.at||0)).slice(0,30);
  const logHtml=edit?`<details ${cpShowLog?'open':''} ontoggle="window._cpShowLog=this.open"><summary>費率變更紀錄</summary>
    ${log.length?`<div class=tw><table class=sch><tr><th>時間（台北）</th><th>誰</th><th>變更</th></tr>${log.map(x=>`<tr><td>${esc(x.atTaipei||'')}</td><td>${esc((x.byName||'')==='特殊'?'冠廷':(x.byName||''))}${x.byRole?'（'+esc(dispRole(x.byRole))+'）':''}</td><td>${esc(x.detail||'')}</td></tr>`).join('')}</table></div>`:'<p style="font-size:13px;color:#aaa">尚無變更紀錄</p>'}</details>`:'';
  const ex=calcPay('店長',500);
  pageOpen(`<h2>幹部薪資</h2>
<p style="font-size:14px">月薪 ＝ 底薪 ＋ 當月總番數 × 職位每番抽成。預設總番數＝目前分店這個月開出的番數（排檯表每一列為 1 番，與當月報表「番數」相同），也可依手寫紀錄為每人覆寫。</p>
<p><b>分店</b> ${bname}　<label>月份 <input type=month value="${esc(mid)}" onchange="openCadrePay(this.value)" style="min-height:44px;font-size:16px"></label></p>
<div class=cpbox>
  <h3>費率</h3>
  <label class=cprow><span>底薪</span><b>${edit?'':'<span>'+yen(c.base)+' 元</span>'}</b>${edit?`<input type=number inputmode=numeric min=0 step=1000 value="${c.base}" id=cpBase style="width:7em;min-height:44px;font-size:16px"> 元`:''}</label>
  ${ratesEdit}
  ${edit?`<p><button type=button onclick="saveCadreRates()">儲存底薪與抽成</button></p>`:'<p style="font-size:13px;color:#9ab">底薪與抽成由店長以上修改。</p>'}
  <p style="font-size:13px;color:#9ab">例：店長、500 番 ＝ ${yen(ex.base)} ＋ 500 × ${yen(ex.rate)} ＝ <b>${yen(ex.total)}</b> 元。</p>
</div>
${dayBreak}
<div class=tw><table class="sch cptbl"><tr><th>人員</th><th>職位</th><th>底薪</th><th>抽成單價</th><th>總番數</th><th>抽成金額</th><th>合計</th></tr>${peopleRows}</table></div>
<p style="display:flex;flex-wrap:wrap;gap:8px"><button type=button onclick="saveCadreOverrides()">儲存覆寫的總番數</button> <button class=s type=button onclick="cadrePayCSV()">匯出 CSV</button> <button class=s type=button onclick="openCadrePay()">重新整理</button></p>
${logHtml}
<style>
.cpbox{background:var(--card,#222);border:1px solid var(--line,#333);border-radius:12px;padding:12px;margin:12px 0}
.cprow{display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin:8px 0;min-height:44px}
.cprow>span:first-child{min-width:7em}
.cptbl td.num,.cptbl th.num{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}
.cpov{display:flex;flex-wrap:wrap;align-items:center;gap:6px;margin-top:6px}
@media (max-width:700px){
  .cptbl th,.cptbl td{font-size:13px;padding:8px 6px}
}
</style>`);
  cpShowDays=!!global._cpShowDays;cpShowLog=!!global._cpShowLog;
  if(global._cpReady!==mid+'@'+bid+'@'+autoN+'@'+people.length){
    Promise.resolve().then(async()=>{
      await ensureUsersLoaded();
      await refreshDaySnaps(mid);
      const again=monthSessionInfo(mid,bid);
      const people2=collectPeople(bid);
      global._cpReady=mid+'@'+bid+'@'+again.total+'@'+people2.length;
      if(again.total!==autoN||people2.length!==people.length)openCadrePay(mid);
    });
  }
}

function cadreToggleOverride(uid,on){
  const inp=document.querySelector('[data-cpov="'+uid+'"]');
  if(inp)inp.disabled=!on;
  if(!on){
    const c=ensureCadrePay();
    c.overrides[cpMonth]=c.overrides[cpMonth]||{};
    delete c.overrides[cpMonth][uid];
    saveCadre();
  }
}
function saveCadreOverrides(){
  if(!canSee())return;
  const c=ensureCadrePay();
  c.overrides[cpMonth]=c.overrides[cpMonth]||{};
  document.querySelectorAll('[data-cpov]').forEach(inp=>{
    const uid=inp.getAttribute('data-cpov');
    const box=inp.parentElement&&inp.parentElement.querySelector('input[type=checkbox]');
    if(!box||!box.checked){delete c.overrides[cpMonth][uid];return}
    const n=Math.max(0,Math.round(+inp.value||0));
    c.overrides[cpMonth][uid]={n,at:Date.now(),byName:dispPerson((global.S&&S.cur)||{})||'',byRole:(global.S&&S.cur&&S.cur.role)||''};
  });
  saveCadre();
  if(typeof toast==='function')toast('已儲存 '+cpMonth+' 總番數覆寫');
  else alert('已儲存');
  openCadrePay(cpMonth);
}
function saveCadreRates(){
  if(!canEditRates())return alert('需店長以上才能改底薪與抽成');
  const c=ensureCadrePay();
  const baseEl=document.getElementById('cpBase');
  const nextBase=baseEl?Math.max(0,Math.round(+baseEl.value||0)):c.base;
  const nextRates=Object.assign({},c.rates);
  document.querySelectorAll('[data-cprate]').forEach(inp=>{
    const p=inp.getAttribute('data-cprate');
    nextRates[p]=Math.max(0,Math.round(+inp.value||0));
  });
  const changes=[];
  if(nextBase!==c.base)changes.push('底薪 '+c.base+' → '+nextBase);
  POSTS.forEach(p=>{if(nextRates[p]!==c.rates[p])changes.push(p+' 每番 '+c.rates[p]+' → '+nextRates[p])});
  if(!changes.length)return alert('沒有變更');
  if(!confirm('確定儲存？\n'+changes.join('\n')))return;
  c.base=nextBase;c.rates=nextRates;
  const who=(global.S&&S.cur)||{};
  c.log.push({at:Date.now(),atTaipei:taipeiNow(),byName:dispPerson(who),byRole:who.role||'',detail:changes.join('；')});
  c.log=c.log.slice(-80);
  saveCadre();
  if(typeof log==='function')log('幹部薪資費率：'+changes.join('；'));
  if(typeof toast==='function')toast('已儲存底薪與抽成');
  openCadrePay(cpMonth);
}
function cadrePayCSV(){
  if(!canSee())return;
  const bid=bidNow();
  const info=monthSessionInfo(cpMonth,bid);
  const c=ensureCadrePay();
  const bname=typeof branchText==='function'?branchText(bid):bid;
  const people=collectPeople(bid);
  const rows=[['幹部薪資',cpMonth,bname],[],['底薪',c.base],...POSTS.map(p=>[p+' 每番抽成',c.rates[p]]),[],['系統計算當月總番數',info.total],[],['人員','編號','職位','底薪','抽成單價','總番數','來源','抽成金額','合計']];
  people.forEach(p=>{
    const ov=overrideOf(cpMonth,p.uid);
    const used=ov&&ov.n!=null?Math.round(+ov.n):info.total;
    const pay=calcPay(p.post,used);
    rows.push([dispPerson(p),p.staffId,p.post,pay.base,pay.rate,pay.sessions,ov&&ov.n!=null?'手動覆寫':'系統',pay.commission,pay.total]);
  });
  rows.push([],['每日番數'],['營業日','番數'],...info.days.map(x=>[x.d,x.n]));
  if(typeof dl==='function')dl('幹部薪資-'+cpMonth+'-'+bid+'.csv',rows);
}

function setCadrePostLocal(uid,post,meta){
  const c=ensureCadrePay();
  post=POSTS.includes(post)?post:'';
  const prev=postOf(uid);
  if(post)c.posts[uid]=Object.assign({},postRec(uid)||{},{post,staffId:(meta&&meta.staffId)||'',name:(meta&&meta.name)||'',branchId:(meta&&meta.branchId)||defBranch(),disabled:!!(meta&&meta.disabled)});
  else delete c.posts[uid];
  if(prev!==post){
    const who=(global.S&&S.cur)||{};
    c.log.push({at:Date.now(),atTaipei:taipeiNow(),byName:dispPerson(who),byRole:who.role||'',detail:'幹部職位 '+(dispPerson(meta||{})||uid)+' '+(prev||'（未指定）')+' → '+(post||'（未指定）')});
    c.log=c.log.slice(-80);
  }
  saveCadre();
  return prev;
}

global.CADRE_POSTS=POSTS;
global.ensureCadrePay=ensureCadrePay;
global.openCadrePay=openCadrePay;
global.saveCadreRates=saveCadreRates;
global.saveCadreOverrides=saveCadreOverrides;
global.cadreToggleOverride=cadreToggleOverride;
global.cadrePayCSV=cadrePayCSV;
global.cadrePostOf=postOf;
global.setCadrePostLocal=setCadrePostLocal;
global.monthSessionInfo=monthSessionInfo;
global.calcCadrePay=calcPay;
})(typeof window!=='undefined'?window:globalThis);
