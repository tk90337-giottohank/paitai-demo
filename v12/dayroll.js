// v12.22 換日重設：歸檔未關帳包廂到待辦與重設紀錄後，看板清空（不刪歷史、不改帳單）；錯過換日橫幅在完成後消失
// v12.21.4 換日：錯過的每一日都補跑歸檔；交易鎖不把複製來的舊 dayRoll 當成已完成；任一登入端可觸發；手動換日有成敗訊息
// v12.16 換日：今日已開檔則跟隨、不把過期裝置的舊未關帳包廂寫進今日；已買單殘留不列入未完成
// v12.12 營業日 07:10 自動換日＋昨日未完成事項＋重設包廂
function rollNow(){return(typeof maybeDayRoll==='function'&&maybeDayRoll._now)?maybeDayRoll._now():(window.Cloud&&typeof window.Cloud.serverNow==='function'?window.Cloud.serverNow():now())}
function carryItemId(type,day,key){return type+':'+day+':'+key}
function collectCarryover(day){
 const items=[],who=()=>S.cur?S.cur.name:(S.op||'系統');
 const add=(type,key,title,detail,link,extra)=>{items.push(Object.assign({id:carryItemId(type,day,key),type,day,title,detail:detail||'',link:link||'',done:false,doneAt:null,doneBy:null},extra||{}))};
 // 未結束／未買單包廂
 Object.entries(S.rooms||{}).forEach(([r,x])=>{if(!x)return;if(x.carryDay&&x.carryDay!=day)return;if(typeof roomSessionBilled==='function'&&roomSessionBilled(r,x))return;const gs=(S.girls||[]).filter(g=>g.room==r).map(g=>g.id+' '+(typeof slNick==='function'?slNick(g.id):g.name));
  const tot=(typeof bill==='function'?bill(Object.assign({id:r},x)).total:0);
  add('open-room',r,r+' 番尚未結束／未買單',`${x.guests==null?'人數未填':'人數 '+x.guests}・第 ${x.sessions||1} 番${x.imp?'（匯入未結束）':''}${gs.length?'・小姐 '+gs.join('、'):'・房內無小姐'}・帳面 ${tot.toLocaleString()} 元`,'payFlow:'+r,{room:r,total:tot})});
 // 掛帳等已結但未入帳
 (S.revenue||[]).forEach((v,i)=>{const d=v.day||(v.t&&typeof bizDay==='function'?bizDay(v.t):'');if(d!=day)return;if(!/掛帳|未收|未付|待確認/.test(String(v.method||'')))return;
  add('unpaid',String(v.t||i),(v.room||'')+' 買單付款方式為「'+(v.method||'')+'」，待確認入帳','金額 '+(v.total||0).toLocaleString()+' 元・'+(v.items||''),'openRevenue',{room:v.room,total:v.total})});
 // 廚房未完成
 const ords=(typeof F!=='undefined'&&F&&F.orders)?F.orders:[];
 ords.forEach(o=>{if(!o||(o.status=='已出餐'||o.status=='取消'))return;const od=o.day||(o.at&&typeof bizDay==='function'?bizDay(o.at):(o.createdAt&&typeof bizDay==='function'?bizDay(o.createdAt):day));
  if(od&&od!=day)return;add('kitchen',o.id||String(o.at||Math.random()),'廚房訂單未完成（'+(o.room||'')+'・'+(o.status||'待做')+'）',(o.zh||o.name||o.items&&JSON.stringify(o.items)||'')+(o.note?'・'+o.note:''),'openKitchen',{room:o.room,status:o.status})});
 // 換包廂待清理、買單後清潔中
 Object.entries(S.dirty||{}).forEach(([r,d])=>{if(!d)return;add('cleaning',r,r+' 換包廂後尚未清理完成','客人已換到 '+(d.to||'?')+'・請確認打掃完畢','clean:'+r,{room:r})});
 Object.entries(S.cleaning||{}).forEach(([r,until])=>{if(!until)return;add('cleaning',r+'·clean',r+' 買單後清潔尚未完成','預計 '+((typeof hm==='function'?hm(until):''))+' 可用','clean:'+r,{room:r})});
 // 客人平板需求未處理
 const gq=(typeof GQ!=='undefined'&&GQ&&GQ.list)?GQ.list:[];
 gq.forEach(q=>{if(!q||q.status!='已送出')return;add('guest-req',q.id||String(q.at||q.t||Math.random()),'包廂客人需求未處理（'+(q.room||'')+'・'+(q.type||'需求')+'）',q.text||q.note||(q.ids?('點小姐 '+q.ids):''),'guestReq',{room:q.room})});
 (S.reqs||[]).forEach((q,i)=>{add('guest-req','req-'+i,(q.room||'')+' 點檯需求尚未處理',((typeof G==='function'&&G(q.girl))?G(q.girl).name:q.girl)||'','req',{room:q.room})});
 (S.calls||[]).forEach((c,i)=>{add('call',String(c.t||i),'叫號／回檯未處理（'+(c.type||'')+'・'+(c.room||'')+'）',(c.girl||c.id||'')+'','calls',{room:c.room})});
 // 少爺薪資待填
 const pay=(S.staffPay||{})[day];
 if(!pay||!pay.saved){const miss=[];if(!pay)miss.push('尚未儲存結算');else['tip','smoke','drink','gum','food'].forEach(k=>{if(pay[k]==null||pay[k]==='')miss.push({tip:'小費總額',smoke:'煙',drink:'飲料',gum:'口香糖',food:'菜'}[k]||k)});
  if(!pay||!pay.saved||miss.length)add('payroll','pay', '少爺薪資（日薪結算）需人工補齊', pay&&pay.saved?('請確認：'+miss.join('、')):'尚未儲存：小費總額／煙／飲料／口香糖／菜與出勤人數','openPayroll:'+day)}
 else if(pay.tip==null||pay.tip==='')add('payroll','tip','少爺薪資：小費總額尚未輸入','','openPayroll:'+day);
 // 出勤
 const att=(S.att||{})[day]||{},ck=(S.checkin||{})[day]||[];
 const attN=Object.keys(att).length,hadBiz=((S.sheetLog||[]).some(e=>e&&e.day==day)||(S.revenue||[]).some(v=>(v.day||(v.t&&bizDay(v.t)))==day)||Object.keys(S.rooms||{}).length);
 if(hadBiz&&!attN&&!ck.length)add('attend','att','昨日營業已有排檯／營收，但出勤尚未登錄','請確認小姐打卡／出勤','openReport');
 // 人數未填（開著的房）
 Object.entries(S.rooms||{}).forEach(([r,x])=>{if(x&&x.guests==null)add('blank',r,r+' 人數尚未填寫（白板）','請補客人數後才能買單','boardEdit:'+r,{room:r})});
 // 候位
 if((S.queue||[]).length)add('queue','q','尚有 '+S.queue.length+' 組候位未入房',S.queue.map(q=>q.name||q.room||'').join('、'),'queue');
 return items
}
function mergeCarryTodos(items,from){
 S.carryTodos=S.carryTodos||{version:1,items:[]};
 const have=new Set((S.carryTodos.items||[]).map(x=>x.id));
 (items||[]).forEach(it=>{if(!have.has(it.id))S.carryTodos.items.push(it)});
 S.carryTodos.updatedAt=rollNow();S.carryTodos.from=from||S.carryTodos.from
}
function pendingCarry(){return((S.carryTodos||{}).items||[]).filter(x=>!x.done)}
function markCarryDone(id,done){const it=((S.carryTodos||{}).items||[]).find(x=>x.id==id);if(!it)return;it.done=done!==false;it.doneAt=it.done?rollNow():null;it.doneBy=it.done?(S.cur?S.cur.name:'') :null;save();if(typeof openCarryover==='function'&&document.getElementById('page')&&document.getElementById('page').style.display=='block'&&/昨日未完成/.test(document.getElementById('page').innerHTML||''))openCarryover()}
function goCarryById(id){goCarry(((S.carryTodos||{}).items||[]).find(x=>x.id==id))}
function goCarry(it){
 if(!it)return;
 const L=it.link||'';
 if(L.startsWith('payFlow:')){const r=L.slice(8);if(S.rooms[r])return payFlow(r);if(!confirm(r+' 已在換日時重設、已離開今日看板。要還原快照後補買單嗎？\n已存帳單不會改，買單會記入原營業日。'))return;if(typeof restoreRolledRoom==='function'&&restoreRolledRoom(r))return payFlow(r);return alert('找不到 '+r+' 的重設快照，請到「包廂重設紀錄」。')}
 if(L.startsWith('openPayroll:')){spDay=L.slice(12);return openPayroll()}
 if(L.startsWith('boardEdit:')){const r=L.slice(10);return typeof boardEdit==='function'?boardEdit(r):null}
 if(L.startsWith('clean:')){const r=L.slice(6);if((S.dirty||{})[r]&&window.Xfer)return Xfer.cleaned(r);if(S.cleaning&&S.cleaning[r]){delete S.cleaning[r];log(r+' 清潔完成');save();render()}return}
 if(L=='openKitchen')return typeof openKitchen==='function'?openKitchen():null;
 if(L=='openRevenue')return typeof openRevenue==='function'?openRevenue():null;
 if(L=='openReport')return typeof openReport==='function'?openReport():null;
 if(L=='guestReq'||L=='calls'||L=='queue'){if(typeof pageClose==='function')pageClose();return}
}
function carryBannerHtml(){
 // 換日完成後不再用大橫幅佔看板；待辦改從「排檯」選單進入。錯過換日才用紅色 missedRollBanner。
 return''
}
function drawCarryBanner(){let el=document.getElementById('dayRollBanner');const html=carryBannerHtml();
 if(!html){if(el)el.remove();return}
 if(!el){el=document.createElement('div');el.id='dayRollBanner';const main=document.querySelector('main')||document.body;main.parentNode.insertBefore(el,main)}
 el.outerHTML=html
}
function openCarryover(){if(!needRole(2,'昨日未完成事項'))return;
 const all=(S.carryTodos||{}).items||[],pend=all.filter(x=>!x.done),done=all.filter(x=>x.done);
 const row=it=>`<li class="citem ${it.done?'cdone':''}"><div><b>${esc(it.title)}</b><div class=cdet>${esc(it.detail||'')}${it.day?'<br>營業日 '+esc(it.day):''}</div>
  <p class=cacts><button type=button class=s onclick="goCarryById('${esc(it.id)}')">前往處理</button>
  <label style="display:inline-flex;align-items:center;gap:6px;min-height:44px"><input type=checkbox ${it.done?'checked':''} onchange="markCarryDone('${esc(it.id)}',this.checked)"> 已處理</label></p></div></li>`;
 pageOpen(`<div class=spwrap><h2>昨日未完成事項</h2>
<p>系統在每日 ${typeof cutTxt==='function'?cutTxt():'07:10'} 自動換日時，會把未關帳包廂列入待辦並做「重設包廂」（快照保留、看板清空）。<b>已存帳單不會改</b>；若要補買單，可從待辦還原快照，買單記入原營業日。勾選「已處理」只是註記，不會刪除歷史台數或已完成買單。</p>
<p>未處理 <b>${pend.length}</b> 項${all.length?`　已處理 ${done.length} 項`:''}</p>
${pend.length?`<h3>待處理</h3><ol class=clist>${pend.map(row).join('')}</ol>`:'<p>目前沒有未處理項目。</p>'}
${done.length?`<details><summary>已處理 ${done.length} 項</summary><ol class=clist>${done.map(row).join('')}</ol></details>`:''}
<p style="color:#aaa;font-size:13px">權限：幹部以上。此清單由自動換日產生，不會改寫昨日已存檔的營業資料。</p></div>`)}

function nextBizDay(d){const dt=new Date(d+'T12:00:00');dt.setDate(dt.getDate()+1);return dt.getFullYear()+'-'+String(dt.getMonth()+1).padStart(2,'0')+'-'+String(dt.getDate()).padStart(2,'0')}
function prevBizDay(d){const dt=new Date(d+'T12:00:00');dt.setDate(dt.getDate()-1);return dt.getFullYear()+'-'+String(dt.getMonth()+1).padStart(2,'0')+'-'+String(dt.getDate()).padStart(2,'0')}
function rollSteps(from,to){const out=[];if(!from||!to||from>=to)return out;let d=from;let guard=0;while(d<to&&guard++<60){const n=nextBizDay(d);out.push([d,n]);d=n}return out}
function rollIsDone(cur,from,to){if(!cur||cur.status!=='done')return false;if(to&&cur.to!==to)return false;if(from&&cur.from&&cur.from!==from)return false;return true}
function missedRollBannerHtml(){
 if(typeof lvl==='function'&&lvl()<1)return'';
 const today=(typeof bizDay==='function'?bizDay(rollNow()):'');
 const open=S.openDay||today;
 if(!today||!open||open>=today)return'';
 const n=rollSteps(open,today).length;
 return`<div id=missedRollBanner class=rollban style="background:#5a2020;border:1px solid #c44;padding:10px 12px;margin:8px 0;border-radius:10px">
  <b>營業日尚未換日</b>
  <span>系統仍停在 <b>${esc(open)}</b>，現在應為 <b>${esc(today)}</b>（已錯過 ${n} 日）。點「立即換日」會歸檔錯過的營業日、把未關帳包廂列入待辦，並把看板換到今天。不會改已存帳單金額。</span>
  ${typeof lvl==='function'&&lvl()>=2?`<button type=button onclick="manualDayRoll()">立即換日</button>`:''}
 </div>`
}
function drawMissedRollBanner(){
 let el=document.getElementById('missedRollBanner');const html=missedRollBannerHtml();
 if(!html){if(el)el.remove();return}
 if(el){el.outerHTML=html;return}
 el=document.createElement('div');el.id='missedRollBanner';
 const main=document.querySelector('main')||document.body;
 main.parentNode.insertBefore(el,main);
 document.getElementById('missedRollBanner').outerHTML=html
}

async function maybeDayRoll(opts){
 opts=opts||{};
 if(maybeDayRoll._busy)return maybeDayRoll._pending||{ok:false,reason:'busy'};
 const today=bizDay(rollNow());
 const open=S.openDay||today;
 if(!open||!today)return{ok:false,reason:'no-day'};
 if(open>today)return{ok:false,reason:'open-after-today'};
 if(open==today){drawMissedRollBanner();drawCarryBanner();return{ok:true,reason:'already',from:open,to:today,steps:0}}
 maybeDayRoll._busy=true;
 const result={ok:false,reason:'',from:open,to:today,steps:0,archived:[],followed:[]};
 maybeDayRoll._pending=result;
 try{
  const steps=rollSteps(open,today);
  if(!steps.length){result.ok=true;result.reason='already';return result}
  const Cld=window.Cloud;
  for(const [from,to] of steps){
    const one=await rollOneDay(from,to,opts,Cld);
    result.steps++;
    if(one&&one.archived)result.archived.push(from);
    if(one&&one.followed)result.followed.push(to);
    if(one&&one.ok===false){result.reason=one.reason||'step-failed';result.ok=false;if(opts.manual)break;else break}
    result.ok=true;result.reason=one&&one.reason||'ok';
  }
  if(result.ok&&S.openDay==today){
    try{toast('已換日 '+today+(result.archived.length?'，已歸檔 '+result.archived.join('、'):'')+'，未關帳包廂已重設列入待辦 '+(pendingCarry().length)+' 項，看板已清空')}catch(e){}
  }else if(!result.ok){
    try{toast('換日未完成'+(result.reason?'（'+result.reason+'）':'')+'，將再試',true)}catch(e){}
  }
  render();drawCarryBanner();drawMissedRollBanner();
  return result;
 }catch(e){
  console.warn('maybeDayRoll',e);
  result.ok=false;result.reason=(e&&(e.message||e.code))||String(e);
  try{toast('自動換日未完成，將再試',true)}catch(err){}
  return result;
 }finally{maybeDayRoll._busy=false;maybeDayRoll._pending=null}
}

async function rollOneDay(from,to,opts,Cld){
 Cld=Cld||window.Cloud;
 if(Cld&&typeof Cld.peekDay==='function'){
  const peek=await Cld.peekDay(to);
  const done=peek&&peek.exists&&(rollIsDone(peek.dayRoll,from,to)||(peek.openDay===to&&peek.dayRoll&&peek.dayRoll.status==='done'&&peek.dayRoll.to===to));
  if(done){
   applyRolloverLocal(from,to,{follow:true});
   if(Cld.followDay)Cld.followDay(to);
   return{ok:true,followed:true,reason:'follow-done'}
  }
 }
 const canWrite=Cld&&typeof Cld.tryDayRoll==='function'&&(typeof Cld.canRoll==='function'?Cld.canRoll():(typeof Cld.isOps==='function'?Cld.isOps():true));
 if(!canWrite){
  if(Cld&&typeof Cld.followDayRoll==='function'){
   const ok=await Cld.followDayRoll(from,to);
   if(ok){applyRolloverLocal(from,to,{follow:true});if(Cld.followDay)Cld.followDay(to);return{ok:true,followed:true,reason:'follow'}}
  }
  return{ok:false,reason:'no-write'}
 }
 const r=await Cld.tryDayRoll(from,to);
 if(!r||!r.ok){
  if(Cld.followDayRoll){const ok=await Cld.followDayRoll(from,to);if(ok){applyRolloverLocal(from,to,{follow:true});if(Cld.followDay)Cld.followDay(to);return{ok:true,followed:true,reason:'follow-after-lock-fail'}}}
  return{ok:false,reason:(r&&r.reason)||'lock-failed'}
 }
 if(!r.won){
  // someone else is rolling or already done — wait then follow
  let ok=false;
  if(Cld.followDayRoll){
   for(let i=0;i<8&&!ok;i++){ok=await Cld.followDayRoll(from,to);if(!ok)await new Promise(res=>setTimeout(res,400))}
  }
  if(ok){applyRolloverLocal(from,to,{follow:true});if(Cld.followDay)Cld.followDay(to);return{ok:true,followed:true,reason:'follow-other'}}
  return{ok:false,reason:'waiting-other'}
 }
 await performDayRoll(from,to);
 return{ok:true,archived:true,reason:'archived'}
}

function resetRoomsForRollover(from){
 const t=rollNow();
 S.roomResetLog=S.roomResetLog||[];
 const rooms=S.rooms||{};
 Object.keys(rooms).forEach(r=>{
  const x=rooms[r];if(!x)return;
  const gs=(S.girls||[]).filter(g=>g.room==r);
  const snap={room:JSON.parse(JSON.stringify(x)),girls:gs.map(g=>JSON.parse(JSON.stringify({id:g.id,status:g.status,room:g.room,src:g.src,start:g.start,until:g.until,priv:g.priv||null,tables:g.tables}))),dirty:(S.dirty||{})[r]?JSON.parse(JSON.stringify(S.dirty[r])):null,cleaning:(S.cleaning||{})[r]||null};
  S.roomResetLog.unshift({id:'rr-'+t+'-'+r,t,day:from,room:r,by:'系統（換日重設）',byRole:'系統',reason:'換日重設',carryDay:x.carryDay||from,paperSeq:x.paperSeq||null,snap,restored:false});
  gs.forEach(g=>{g.room=null;g.status='休息室';g.src='';g.until=0;g.priv=null});
  if(S.reqs)S.reqs=S.reqs.filter(q=>q.room!=r);
  delete S.rooms[r];
  if(S.cleaning)delete S.cleaning[r];
  if(S.dirty)delete S.dirty[r];
 });
}
function restoreRolledRoom(r){
 if((S.rooms||{})[r])return true;
 const logs=(S.roomResetLog||[]).filter(e=>e&&e.room==r&&e.snap&&e.snap.room);
 const e=logs.find(x=>!x.restored)||logs[0];
 const fromCarry=((S.carryover||{}).rooms||{})[r];
 const room=e&&e.snap&&e.snap.room?JSON.parse(JSON.stringify(e.snap.room)):(fromCarry?JSON.parse(JSON.stringify(fromCarry)):null);
 if(!room)return false;
 S.rooms=S.rooms||{};
 S.rooms[r]=room;S.rooms[r].id=r;
 if(e&&e.snap&&e.snap.girls){(e.snap.girls||[]).forEach(s=>{const g=typeof G==='function'?G(s.id):null;if(!g)return;if(g.room&&g.room!=r)return;Object.assign(g,{room:r,status:s.status||'在檯',src:s.src||'',start:s.start,until:s.until,priv:s.priv||null})})}
 if(e&&e.snap&&e.snap.dirty){(S.dirty=S.dirty||{})[r]=e.snap.dirty}
 if(e&&e.snap&&e.snap.cleaning){(S.cleaning=S.cleaning||{})[r]=e.snap.cleaning}
 if(e&&!e.restored){e.restored=true;e.restoredAt=rollNow();e.restoredBy=S.cur?S.cur.name:'';}
 if(typeof log==='function')log('還原換日重設：'+r+'（準備補買單，記入原營業日）');
 if(typeof save==='function')save();
 if(typeof render==='function')render();
 return true
}
async function performDayRoll(from,to){
 const items=collectCarryover(from);
 const roomSnap={};Object.entries(S.rooms||{}).forEach(([r,x])=>{if(!x)return;x.carryDay=x.carryDay||from;roomSnap[r]=JSON.parse(JSON.stringify(x))});
 if(typeof closeDay==='function'){const h=S.hist&&S.hist[from];if(!h){const rec=buildDay(from);rec.closedAt=rollNow();rec.closedBy='系統（'+(typeof cutTxt==='function'?cutTxt():'07:10')+' 自動）';S.hist=S.hist||{};S.hist[from]=rec;log('日結 '+from+'（系統自動）')}}
 S.carryover={day:from,to,at:rollNow(),by:S.cur?S.cur.name:'系統',items,rooms:roomSnap,note:'換日快照；未關帳包廂已重設離看板並列入待辦，快照可還原補買單。已存帳單不會改。'};
 mergeCarryTodos(items,from);
 if(window.Cloud&&window.Cloud.flushTo)await window.Cloud.flushTo(from,{dayRoll:null});
 resetRoomsForRollover(from);
 const keep=x=>{if(!x)return false;const t=x.start||x.t;if(!t)return true;return bizDay(t)>=to};
 ['sheetLog','taiLog','revenue','visitLog','orderBonus','redLog','blueLog','finds','decisions'].forEach(k=>{if(Array.isArray(S[k]))S[k]=S[k].filter(e=>keep(e))});
 S.openDay=to;
 if(typeof pruneBilledGhostRooms==='function')pruneBilledGhostRooms();
 log('自動換日：'+from+' → '+to+'（未完成事項 '+(items.length)+' 項；未關帳包廂已重設列入待辦，看板已清空）');
 if(window.Cloud&&window.Cloud.flushTo)await window.Cloud.flushTo(to);
 else save();
 if(window.Cloud&&window.Cloud.markDayRollDone)await window.Cloud.markDayRollDone(from,to);
 render();if(typeof drawCarryBanner==='function')drawCarryBanner();if(typeof drawMissedRollBanner==='function')drawMissedRollBanner();
}

function applyRolloverLocal(from,to,opts){
 opts=opts||{};
 if(S.openDay==to){render();drawCarryBanner();drawMissedRollBanner();return}
 if(!opts.follow){
  Object.values(S.rooms||{}).forEach(x=>{if(x&&!x.carryDay)x.carryDay=from});
  mergeCarryTodos(collectCarryover(from),from);
 }
 S.openDay=to;
 if(window.Cloud&&window.Cloud.followDay)window.Cloud.followDay(to);
 render();drawCarryBanner();drawMissedRollBanner()
}

async function manualDayRoll(){
 if(typeof needRole==='function'&&!needRole(2,'換日'))return;
 const today=bizDay(rollNow()),open=S.openDay||today;
 if(open==today){alert('現在已是營業日 '+today+'，不需換日。');drawMissedRollBanner();return}
 if(open>today){alert('目前紀錄的營業日 '+open+' 比今天 '+today+' 還晚，未自動換日。請先核對系統時間。');return}
 const steps=rollSteps(open,today);
 if(!confirm('要補跑換日嗎？\n\n系統仍停在 '+open+'，現在應為 '+today+'（將依序歸檔 '+steps.map(s=>s[0]).join('、')+'）。\n未關帳包廂會列入待辦並重設離開看板（快照可還原補買單），已存帳單金額不會改。'))return;
 const r=await maybeDayRoll({manual:true,reason:'manual'});
 if(r&&r.ok&&(S.openDay==today)){
  alert('換日完成：'+open+' → '+today+'\n已歸檔：'+(r.archived&&r.archived.length?r.archived.join('、'):'（已存在的歸檔則跟隨）')+'\n未關帳包廂已重設列入待辦 '+(pendingCarry().length)+' 項，今日看板已清空。');
 }else{
  alert('換日失敗'+(r&&r.reason?'：'+r.reason:'')+'。請確認已登入雲端後再試，或把畫面留給幹部處理。\n目前營業日：'+(S.openDay||'未知')+'，應為 '+today);
 }
 if(typeof openHistory==='function')openHistory();
}

function roomNeedsReset(r){return!!((S.rooms||{})[r]||(S.cleaning||{})[r]||(S.dirty||{})[r])}
function resetRoomBtn(r){if(typeof lvl==='function'&&lvl()<2)return'';if(!roomNeedsReset(r))return'';return` <button class=s type=button onclick="event.stopPropagation();resetRoom('${r}')">重設包廂</button>`}
function resetRoom(r){
 if(!needRole(2,'重設包廂'))return;
 const x=(S.rooms||{})[r],dirty=(S.dirty||{})[r],cl=(S.cleaning||{})[r];
 if(!x&&!dirty&&!cl)return alert(r+' 已是空房，不需重設');
 const gs=x?(S.girls||[]).filter(g=>g.room==r):[];
 const tot=x&&typeof bill==='function'?bill(Object.assign({id:r},x)).total:0;
 const bits=[];
 if(x)bits.push(`進行中的番將被清空（${x.guests==null?'人數未填':x.guests+' 人'}・第 ${x.sessions||1} 番・帳面 ${tot.toLocaleString()} 元${gs.length?'・小姐 '+gs.map(g=>g.id).join('、'):''}）`);
 if(x)bits.push('進行中的番不會記入台數、也不會產生買單');
 if(cl)bits.push('將解除「清潔中」狀態');
 if(dirty)bits.push('將解除「換包廂待清理」狀態');
 bits.push('已完成的買單與已記入的台數不會刪除，並會留下可還原的快照');
 if(!confirm(`重設包廂 ${r}？\n\n${bits.join('\n')}\n\n確定重設？`))return;
 S.roomResetLog=S.roomResetLog||[];
 const snap={room:x?JSON.parse(JSON.stringify(x)):null,girls:gs.map(g=>JSON.parse(JSON.stringify({id:g.id,status:g.status,room:g.room,src:g.src,start:g.start,until:g.until,priv:g.priv||null,tables:g.tables}))),dirty:dirty?JSON.parse(JSON.stringify(dirty)):null,cleaning:cl||null};
 const rec={id:'rr-'+Date.now(),t:now(),day:S.openDay||bizDay(now()),room:r,by:S.cur?S.cur.name:(S.op||''),byRole:S.cur?S.cur.role:'',snap,restored:false};
 S.roomResetLog.unshift(rec);
 if(gs.length&&typeof leave==='function')gs.forEach(g=>leave(g,'重設包廂'));
 else gs.forEach(g=>{g.room=null;g.status='休息室';g.src='';g.until=0});
 if(S.reqs)S.reqs=S.reqs.filter(q=>q.room!=r);
 if(S.rooms)delete S.rooms[r];
 if(S.cleaning)delete S.cleaning[r];
 if(S.dirty)delete S.dirty[r];
 log(`重設包廂 ${r}（${rec.by||'未登入'}；快照已存，已完成買單／台數未刪）`);
 save();render();toast('已重設 '+r+'，可在「包廂重設紀錄」查看或還原')
}
function openRoomResetLog(){if(!needRole(2,'包廂重設紀錄'))return;
 const L=S.roomResetLog||[];
 const row=e=>`<li class=citem><div><b>${esc(e.room)}</b>　${e.t?((typeof t==='function'?t(e.t):new Date(e.t).toLocaleString('zh-TW'))):''}　${esc(e.by||'')}${e.restored?'　<span style=color:#8c8>已還原</span>':''}
  <div class=cdet>營業日 ${esc(e.day||'')}${e.snap&&e.snap.room?`・當時第 ${e.snap.room.sessions||1} 番・${e.snap.room.guests==null?'人數未填':e.snap.room.guests+' 人'}`:''}${e.snap&&e.snap.girls&&e.snap.girls.length?'・小姐 '+e.snap.girls.map(g=>g.id).join('、'):''}${e.snap&&e.snap.cleaning?'・當時清潔中':''}${e.snap&&e.snap.dirty?'・當時待清理':''}</div>
  <p class=cacts>${e.restored?'':`<button type=button class=s onclick="restoreRoomReset('${e.id}')">還原此包廂</button>`}</p></div></li>`;
 pageOpen(`<div class=spwrap><h2>包廂重設紀錄</h2>
<p>重設前會留下快照，已完成的買單與已記入台數不會刪除。若該房目前為空，可還原當時進行中的番。</p>
${L.length?`<ol class=clist>${L.map(row).join('')}</ol>`:'<p>尚無重設紀錄。</p>'}</div>`)}
function restoreRoomReset(id){
 if(!needRole(2,'還原包廂'))return;
 const e=(S.roomResetLog||[]).find(x=>x.id==id);if(!e||!e.snap)return alert('找不到這筆快照');
 if(e.restored)return alert('這筆已還原過');
 if((S.rooms||{})[e.room])return alert(e.room+' 目前使用中，請先處理後再還原');
 if(e.snap.room){S.rooms[e.room]=e.snap.room;S.rooms[e.room].id=e.room;
  (e.snap.girls||[]).forEach(s=>{const g=G(s.id);if(!g)return;if(g.room&&g.room!=e.room)return;Object.assign(g,{room:e.room,status:s.status||'在檯',src:s.src||'',start:s.start,until:s.until,priv:s.priv||null})})}
 if(e.snap.dirty){(S.dirty=S.dirty||{})[e.room]=e.snap.dirty}
 if(e.snap.cleaning){(S.cleaning=S.cleaning||{})[e.room]=e.snap.cleaning}
 e.restored=true;e.restoredAt=now();e.restoredBy=S.cur?S.cur.name:'';
 log('還原包廂重設：'+e.room+'（快照 '+id+'）');save();render();toast('已還原 '+e.room);openRoomResetLog()
}
function dayTick(){maybeDayRoll();if(typeof drawMissedRollBanner==="function")drawMissedRollBanner()}
