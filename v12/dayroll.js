// v12.12 營業日 07:10 自動換日＋昨日未完成事項＋重設包廂
function rollNow(){return(typeof maybeDayRoll==='function'&&maybeDayRoll._now)?maybeDayRoll._now():(window.Cloud&&typeof window.Cloud.serverNow==='function'?window.Cloud.serverNow():now())}
function carryItemId(type,day,key){return type+':'+day+':'+key}
function collectCarryover(day){
 const items=[],who=()=>S.cur?S.cur.name:(S.op||'系統');
 const add=(type,key,title,detail,link,extra)=>{items.push(Object.assign({id:carryItemId(type,day,key),type,day,title,detail:detail||'',link:link||'',done:false,doneAt:null,doneBy:null},extra||{}))};
 // 未結束／未買單包廂
 Object.entries(S.rooms||{}).forEach(([r,x])=>{if(!x)return;if(x.carryDay&&x.carryDay!=day)return;const gs=(S.girls||[]).filter(g=>g.room==r).map(g=>g.id+' '+(typeof slNick==='function'?slNick(g.id):g.name));
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
 if(L.startsWith('payFlow:')){const r=L.slice(8);if(S.rooms[r])return payFlow(r);return alert(r+' 已不在目前包廂列，請到歷史紀錄或待辦說明處理')}
 if(L.startsWith('openPayroll:')){spDay=L.slice(12);return openPayroll()}
 if(L.startsWith('boardEdit:')){const r=L.slice(10);return typeof boardEdit==='function'?boardEdit(r):null}
 if(L.startsWith('clean:')){const r=L.slice(6);if((S.dirty||{})[r]&&window.Xfer)return Xfer.cleaned(r);if(S.cleaning&&S.cleaning[r]){delete S.cleaning[r];log(r+' 清潔完成');save();render()}return}
 if(L=='openKitchen')return typeof openKitchen==='function'?openKitchen():null;
 if(L=='openRevenue')return typeof openRevenue==='function'?openRevenue():null;
 if(L=='openReport')return typeof openReport==='function'?openReport():null;
 if(L=='guestReq'||L=='calls'||L=='queue'){if(typeof pageClose==='function')pageClose();return}
}
function carryBannerHtml(){
 if(typeof lvl==='function'&&lvl()<2)return'';
 const n=pendingCarry().length;if(!n)return'';
 return`<div id=dayRollBanner class=rollban><b>昨日未完成事項 ${n} 項</b><span>請幹部確認未關帳包廂、清潔、廚房與需手填欄位。不會自動派檯。</span><button type=button onclick="openCarryover()">查看待辦</button></div>`
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
<p>系統在每日 ${typeof cutTxt==='function'?cutTxt():'07:10'} 自動換日時記錄。<b>昨日未關帳的包廂仍會顯示在看板上（標示「昨日未結束」），買單會記入原營業日</b>；其餘空房已是新的一天。勾選「已處理」僅作待辦註記，不會刪除歷史台數或已完成買單。</p>
<p>未處理 <b>${pend.length}</b> 項${all.length?`　已處理 ${done.length} 項`:''}</p>
${pend.length?`<h3>待處理</h3><ol class=clist>${pend.map(row).join('')}</ol>`:'<p>目前沒有未處理項目。</p>'}
${done.length?`<details><summary>已處理 ${done.length} 項</summary><ol class=clist>${done.map(row).join('')}</ol></details>`:''}
<p style="color:#aaa;font-size:13px">權限：幹部以上。此清單由自動換日產生，不會改寫昨日已存檔的營業資料。</p></div>`)}

async function maybeDayRoll(opts){
 opts=opts||{};
 if(maybeDayRoll._busy)return;
 const to=bizDay(rollNow()),from=S.openDay||to;
 if(!from||from==to)return;
 if(from>to)return;
 maybeDayRoll._busy=true;
 try{
  const Cld=window.Cloud;
  if(!Cld||typeof Cld.tryDayRoll!=='function'||(typeof Cld.lv==='function'&&Cld.lv()<1)||(typeof TVMODE!=='undefined'&&TVMODE)){
   if(Cld&&typeof Cld.followDayRoll==='function'){const ok=await Cld.followDayRoll(from,to);if(ok)applyRolloverLocal(from,to,{follow:true})}
   return
  }
  const r=await Cld.tryDayRoll(from,to);
  if(!r||!r.ok){if(Cld.followDayRoll){const ok=await Cld.followDayRoll(from,to);if(ok)applyRolloverLocal(from,to,{follow:true})}return}
  if(!r.won){applyRolloverLocal(from,to,{follow:true});if(Cld.followDay)Cld.followDay(to);return}
  await performDayRoll(from,to)
 }catch(e){console.warn('maybeDayRoll',e);try{toast('自動換日未完成，將再試',true)}catch(err){}}
 finally{maybeDayRoll._busy=false}
}
async function performDayRoll(from,to){
 const items=collectCarryover(from);
 const roomSnap={};Object.entries(S.rooms||{}).forEach(([r,x])=>{if(!x)return;x.carryDay=x.carryDay||from;roomSnap[r]=JSON.parse(JSON.stringify(x))});
 const rec=(typeof closeDayL==='function'?null:null);
 if(typeof closeDayL==='function')closeDayL(from,'自動');
 else if(typeof closeDay==='function'){const h=S.hist&&S.hist[from];if(!h){const rec=buildDay(from);rec.closedAt=rollNow();rec.closedBy='系統（'+(typeof cutTxt==='function'?cutTxt():'07:10')+' 自動）';S.hist=S.hist||{};S.hist[from]=rec;log('日結 '+from+'（系統自動）')}}
 S.carryover={day:from,to,at:rollNow(),by:S.cur?S.cur.name:'系統',items,rooms:roomSnap,note:'換日快照；未結束包廂保留在新一日看板並標示昨日未結束。'};
 mergeCarryTodos(items,from);
 if(window.Cloud&&window.Cloud.flushTo)await window.Cloud.flushTo(from);
 const keep=x=>{if(!x)return false;const t=x.start||x.t;if(!t)return true;return bizDay(t)>=to};
 ['sheetLog','taiLog','revenue','visitLog','orderBonus','redLog','blueLog','finds','decisions'].forEach(k=>{if(Array.isArray(S[k]))S[k]=S[k].filter(e=>keep(e))});
 S.openDay=to;
 log('自動換日：'+from+' → '+to+'（未完成事項 '+(items.length)+' 項；未關帳包廂仍顯示至買單）');
 if(window.Cloud&&window.Cloud.flushTo)await window.Cloud.flushTo(to);
 else save();
 if(window.Cloud&&window.Cloud.markDayRollDone)await window.Cloud.markDayRollDone(from,to);
 try{toast('已換日 '+to+'，昨日未完成 '+(pendingCarry().length)+' 項')}catch(e){}
 render();if(typeof drawCarryBanner==='function')drawCarryBanner();
}
function applyRolloverLocal(from,to,opts){
 opts=opts||{};
 if(S.openDay==to){render();drawCarryBanner();return}
 if(!opts.follow){
  Object.values(S.rooms||{}).forEach(x=>{if(x&&!x.carryDay)x.carryDay=from});
  mergeCarryTodos(collectCarryover(from),from);
 }
 S.openDay=to;
 if(window.Cloud&&window.Cloud.followDay)window.Cloud.followDay(to);
 render();drawCarryBanner()
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
function dayTick(){maybeDayRoll()}
