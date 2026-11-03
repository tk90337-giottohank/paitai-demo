// v12.4.1 傳統排檯表模式（橘線＝已買單）（紙本格式勾選；與系統共用同一份資料）
(function(){
const GR={on:false,day:null,pal:null};
const nm=g=>String(g.name||'').replace(/^\s*\d+\s*號?\s*/,'')||g.id;
const tally=n=>{n=+n||0;if(!n)return'';const t=['','一','丅','下','止'];return'正'.repeat(Math.floor(n/5))+t[n%5]};
const rocDate=d=>{const[Y,M,D]=d.split('-').map(Number);return`${Y-1911}年${M}月${D}日`};
const canEdit=()=>lvl()>=2;
// ---- 讓 rowsOf 帶入排檯表手動記號／手動結束 ----
const rowsOf0=window.rowsOf;
window.rowsOf=function(x,r,closed){const rows=rowsOf0(x,r,closed);rows.forEach((e,i)=>{const gm=(x.gridMarks||[])[i];if(gm&&Object.keys(gm).length){const m={};e.girls.forEach(id=>{m[id]=gm[id]||markType(e,id)});e.marks=m}});return rows};
function findRow(ref){if(ref.startsWith('L'))return{kind:'L',e:S.sheetLog[+ref.slice(1)]};const[,r,i]=ref.split('|'),x=S.rooms[r];return x?{kind:'R',r,i:+i,x,last:+i==x.bans.length-1}:null}
function rowCur(ref){return sheetRows(GR.day).find(e=>e._ref==ref)}
function delOB(room,id,from){S.orderBonus=S.orderBonus.filter(o=>!(o.room==room&&o.girl==id&&o.t>=from-60000))}
// 設定某格記號：type = 紅 / 藍 / 訂番 / 私檯 / 清除
function setMark(ref,id,type){if(!needRole(2,'傳統排檯表勾選'))return;const f=findRow(ref),e=rowCur(ref),g=G(id);if(!f||!e)return;
 const st=e.start,had=e.girls.includes(id);
 if(f.kind=='R'){const x=f.x,i=f.i,r=f.r;x.bans[i]=x.bans[i]||[];x.privBans=x.privBans||[];x.privBans[i]=x.privBans[i]||[];x.gridMarks=x.gridMarks||[];x.gridMarks[i]=x.gridMarks[i]||{};
  // 先清掉舊記號
  x.privBans[i]=x.privBans[i].filter(z=>z!=id);if(f.last){x.order=(x.order||[]).filter(z=>z!=id)}delOB(r,id,st);S.redLog=S.redLog.filter(z=>!(z.girl==id&&z.room==r&&z.t>=st-60000));
  if(type=='清除'){x.bans[i]=x.bans[i].filter(z=>z!=id);delete x.gridMarks[i][id];if(x.btype&&x.btype[i])delete x.btype[i][id];if(f.last&&g&&g.room==r)leave(g,'排檯表清除');log(`排檯表：${r} 第${i+1}番 清除 ${id}`);return done()}
  if(f.last&&g&&g.room!=r){if(g.room&&!confirm(`${nm(g)}（${id}）目前在 ${g.room}，改到 ${r}？`))return;seat(g,r,type=='紅'?'red':'blue')}else if(!x.bans[i].includes(id))x.bans[i].push(id);
  if(type=='紅')S.redLog.unshift({t:Math.max(now()-1,st),girl:id,room:r});
  if(type=='訂番'){if(x.orderStaff&&!confirm(`這番已有訂番幹部「${x.orderStaff}」。一番只能一位訂番，改由 ${id} 小姐領？`))return;
   if(x.orderStaff){const bs=x.sesStart||x.start;S.orderBonus=S.orderBonus.filter(b=>!(b.codeOnly&&b.room==r&&b.t==bs));x.orderStaff=''}
   Object.keys(x.gridMarks[i]).forEach(k=>{if(k!=id&&x.gridMarks[i][k].includes('訂番')){x.gridMarks[i][k]=['紅'];delOB(r,k,st)}});if(f.last)x.order=[id];
   S.orderBonus.push({t:Math.max(now(),st),room:r,girl:id,girlAmt:C().orderGirlBonus,staffAmt:0,staff:''})}
  if(type=='私檯'){x.privBans[i].push(id);x.btype=x.btype||[];x.btype[i]=x.btype[i]||{};x.btype[i][id]='私檯'}
  else if(x.btype&&x.btype[i]&&x.btype[i][id]=='私檯')x.btype[i][id]=null;
  x.gridMarks[i][id]=[type];log(`排檯表：${r} 第${i+1}番 ${id} → ${type}`);return done()}
 // 已結帳的番（sheetLog）
 const L=f.e;if(!L.marks){L.marks={};L.girls.forEach(z=>{L.marks[z]=markType(Object.assign({},L,{marks:undefined}),z)})}
 L.privs=(L.privs||[]).filter(z=>z!=id);L.order=(L.order||[]).filter(z=>z!=id);delOB(L.room,id,st);
 S.taiLog=S.taiLog.filter(t=>!(t.girl==id&&t.room==L.room&&t.day==L.day&&t.ban==L.ban));
 if(type=='清除'){L.girls=L.girls.filter(z=>z!=id);delete L.marks[id];log(`排檯表：${L.room} 第${L.ban}番（已結）清除 ${id}`);return done()}
 if(!L.girls.includes(id))L.girls.push(id);L.marks[id]=[type];
 if(type=='訂番'){if(L.orderStaff&&!confirm(`這番已有訂番幹部「${L.orderStaff}」，改由 ${id} 小姐領？`))return;if(L.orderStaff){S.orderBonus=S.orderBonus.filter(b=>!(b.codeOnly&&b.room==L.room&&b.t>=st-60000&&b.t<=st+60000));L.orderStaff=''}
  Object.keys(L.marks).forEach(k=>{if(k!=id&&L.marks[k].includes('訂番')){L.marks[k]=['紅'];delOB(L.room,k,st)}});L.order=[id];S.orderBonus.push({t:st,room:L.room,girl:id,girlAmt:C().orderGirlBonus,staffAmt:0,staff:''})}
 if(type=='私檯')L.privs.push(id);
 S.taiLog.push({day:L.day,room:L.room,ban:L.ban,girl:id,tai:type=='私檯'?C().privTai:1,priv:type=='私檯',t:st});
 log(`排檯表：${L.room} 第${L.ban}番（已結）${id} → ${type}`);done()}
function cleanOld(){let ch=false;for(const r in S.rooms||{})if(S.rooms[r].endedBans){delete S.rooms[r].endedBans;ch=true}return ch}
function done(){GR.pal=null;save();render();draw()}
// ---- 列（番）操作 ----
function rowMenu(ref){const f=findRow(ref),e=rowCur(ref);if(!f||!e)return;if(!canEdit())return alert(`${e.room} 第${e.ban}番 ${hm(e.start)}（只能檢視）`);
 const fm=document.getElementById('dform'),live=f.kind=='R';
 fm.innerHTML=`<h3>${esc(e.room)} 第 ${e.ban} 番・${hm(e.start)}${String(ref).startsWith('L')?'（已買單）':''}</h3>
 <label>進場時間 <input id=grT value="${hm(e.start)}" style="width:70px"></label> <label>人數 <input id=grN type=number min=1 value="${e.guests??''}" style="width:60px"></label>
 <label>訂番幹部（莉／冠／文…）<input id=grS value="${esc((live?f.x.orderStaff:f.e.orderStaff)||'')}" style="width:60px"></label>
 <p>${live&&f.last?`<button type=button onclick="dlg.close();boardEdit('${f.r}')">白板資料</button> <button type=button onclick="dlg.close();renew('${f.r}')">續番</button> <button type=button onclick="dlg.close();payFlow('${f.r}')">買單</button> `:''}
 ${live?'<small style="color:#aaa">橘線會在買單完成後自動畫上</small>':'<small style="color:#fc6">已買單（橘線）</small>'}</p>
 <button value=ok>儲存</button> <button class=s value="">取消</button>`;
 const d=document.getElementById('dlg');d.returnValue='';d.onclose=()=>{if(d.returnValue!='ok')return;const m=grT.value.match(/(\d{1,2}):?(\d{2})/);let t=e.start;if(m){const b=new Date(e.start);b.setHours(+m[1],+m[2],0,0);t=b.getTime();if(bizDay(t)!=GR.day)t+=864e5*(bizDay(t)<GR.day?1:-1)}
  const n=grN.value?Math.max(1,+grN.value):null,sv=grS.value.trim();
  if(live){const x=f.x;if(f.i==0)x.start=t;x.banStart=x.banStart||[x.start];x.banStart[f.i]=t;if(n)x.guests=n;
   if(sv!=(x.orderStaff||'')){const bs=x.sesStart||x.start;S.orderBonus=S.orderBonus.filter(b=>!(b.codeOnly&&b.room==f.r&&b.t==bs));
    if(sv){const hasG=(x.order||[]).length||Object.values((x.gridMarks||[])[f.i]||{}).some(v=>v.includes('訂番'));if(hasG&&!confirm('一番只能有一位訂番：改由訂番幹部領，取消小姐訂番？'))return;
     x.order=[];const gm=(x.gridMarks||[])[f.i]||{};Object.keys(gm).forEach(k=>{if(gm[k].includes('訂番')){gm[k]=['紅'];delOB(f.r,k,e.start)}});
     const ci=codeInfo(sv);S.orderBonus.push({t:bs,room:f.r,girl:'',girlAmt:0,staff:ci.cat=='特殊'?ci.who:`${ci.who}（${ci.cat}${ci.unmapped?'・代號未設定':''}）`,staffCat:ci.cat,staffAmt:catAmt(ci.cat),code:ci.code,codeOnly:true})}x.orderStaff=sv}}
  else{const L=f.e;L.start=t;if(n)L.guests=n;if(sv!=(L.orderStaff||'')){S.orderBonus=S.orderBonus.filter(b=>!(b.codeOnly&&b.room==L.room&&Math.abs(b.t-e.start)<=60000));
    if(sv){if(L.marks)Object.keys(L.marks).forEach(k=>{if(L.marks[k].includes('訂番')){L.marks[k]=['紅'];delOB(L.room,k,e.start)}});L.order=[];const ci=codeInfo(sv);S.orderBonus.push({t:L.start,room:L.room,girl:'',girlAmt:0,staff:ci.cat=='特殊'?ci.who:`${ci.who}（${ci.cat}）`,staffCat:ci.cat,staffAmt:catAmt(ci.cat),code:ci.code,codeOnly:true})}L.orderStaff=sv}}
  log(`排檯表：${e.room} 第${e.ban}番 時間 ${hm(t)} 人數 ${n??'—'} 訂番幹部 ${sv||'—'}`);done()};d.showModal()}
function newRow(){if(!needRole(2,'新增番'))return;const free=roomList().filter(r=>!S.rooms[r]&&!(S.cleaning||{})[r]);if(!free.length)return alert('沒有空包廂');
 const fm=document.getElementById('dform');fm.innerHTML=`<h3>新增一番：選包廂</h3>${free.map(r=>`<button value="${esc(r)}" style="min-width:64px;height:44px;margin:3px">${esc(r)}</button>`).join('')}<p><button class=s value="">取消</button></p>`;
 const d=document.getElementById('dlg');d.returnValue='';d.onclose=()=>{const r=d.returnValue;if(r)setTimeout(()=>checkIn(r),50)};d.showModal()}
// ---- 小姐欄操作（紅線＝已領錢回家＋時間）----
function girlMenu(id){const d=GR.day,X=DX(d),g=G(id);if(!canEdit())return alert(`${id} ${g?nm(g):''}${X.early[id]?'・'+X.early[id]+' 離開':''}`);
 const v=prompt(`${id} ${g?nm(g):''}：已領錢回家／提早離開時間（例 2130 或 21:30）\n會畫紅線；空白＝取消`,X.early[id]||'');if(v===null)return;
 let t=v.trim();const m=t.match(/^(\d{1,2}):?(\d{2})/);if(m)t=`${m[1].padStart(2,'0')}:${m[2]}`+t.slice(m[0].length);
 if(t){X.early[id]=t;if(g&&g.room&&d==bizDay(now())&&confirm(`${nm(g)} 目前在 ${g.room}，同時從包廂離開？`))leave(g,'已領錢回家')}else delete X.early[id];
 log(`排檯表：${id} ${t?t+' 離開（紅線）':'取消紅線'}`);done()}
// ---- 調色盤 ----
function cell(ref,id){if(!canEdit())return;GR.pal={ref,id};draw()}
const PAL=[['紅','<b style="color:#e22">✓</b> 紅勾 點選'],['藍','<b style="color:#27f">✓</b> 藍勾 指派'],['訂番','<span class=gmo>✓</span> 訂番'],['私檯','<span class=gm4>4</span> 私檯'],['清除','✕ 清除']];
// ---- 繪製 ----
function cols(d){const X=S.dayExt[d]||{colOrder:[],others:[]},rows=sheetRows(d),inRows=new Set(rows.flatMap(e=>e.girls)),ck=(S.checkin||{})[d]||[];
 const offAt=g=>((S.clockOut||{})[d]||{})[g.id]||(g.offAt&&bizDay(g.offAt)==d?g.offAt:0);
 let L=S.girls.filter(g=>(g.on&&d==bizDay(now()))||inRows.has(g.id)||offAt(g)||ck.some(c=>c.id==g.id)||(X.others||[]).includes(g.id)||(X.colOrder||[]).includes(g.id));
 const ord=X.colOrder||[];L.sort((a,b)=>{const ia=ord.indexOf(a.id),ib=ord.indexOf(b.id);if(ia!=ib)return(ia<0?999:ia)-(ib<0?999:ib);const ca=ck.findIndex(c=>c.id==a.id),cb=ck.findIndex(c=>c.id==b.id);if(ca!=cb)return(ca<0?999:ca)-(cb<0?999:cb);return(a.clockAt||9e15)-(b.clockAt||9e15)||a.id.localeCompare(b.id)});
 const oth=new Set(X.others||[]);L.forEach(g=>{if(/^\d+$/.test(g.id)&&catOf(g.id)!='小姐')oth.add(g.id)});
 return{main:L.filter(g=>!oth.has(g.id)),other:[...oth].map(id=>G(id)||{id,name:id}),rows,X,offAt}}
function draw(){const p=document.getElementById('gridPg');if(!p)return;const d=GR.day,{main,other,rows,X,offAt}=cols(d),all=[...main,...other];
 const bandsCfg=(X.bands||String(C().arrivalBands||'').split(',')).map(s=>s.trim()).filter(Boolean);let lastBand=null;
 const sx=p.querySelector('.gwrap');const sc=sx?[sx.scrollLeft,sx.scrollTop]:null;
 const early=id=>X.early&&X.early[id];
 const head=all.map((g,j)=>{const a=arriveOf(d,g.id),b=a?bandOf(a,bandsCfg):null,showB=b&&b!=lastBand&&j<main.length;if(b)lastBand=b;const sep=j==main.length?' gsep2':((j+1)%5==0?' gsep':'');
  return`<th class="gh${sep}${early(g.id)||offAt(g)?' goff':''}" onclick="Grid.girl('${g.id}')"><div class=gband>${showB?esc(String(b).split(/[–~-]/)[0].replace(':','')):''}</div><div class=gno>${esc(g.id)}</div><div class=gnm>${esc(j>=main.length&&catOf(g.id)!='小姐'?DISP(catOf(g.id)):nm(g)).slice(0,3)}</div></th>`}).join('');
 const body=rows.map((e,k)=>{const cl=String(e._ref).startsWith('L')?' gend':'';const os=e.orderStaff||(e._ref.startsWith('R|')?(S.rooms[e.room]||{}).orderStaff:'');
  return`<tr class="${cl}"><td class="gs gs0" onclick="Grid.row('${e._ref}')">${esc(os||'')}</td><td class="gs gs1" onclick="Grid.row('${e._ref}')"><b>${esc(e.room)}</b></td><td class="gs gs2" onclick="Grid.row('${e._ref}')">${tally(e.guests)}</td><td class="gs gs3" onclick="Grid.row('${e._ref}')">${k+1}</td><td class="gs gs4" onclick="Grid.row('${e._ref}')">${hm(e.start).replace(':','')}</td>
  ${all.map((g,j)=>{const sep=j==main.length?' gsep2':((j+1)%5==0?' gsep':''),pal=GR.pal&&GR.pal.ref==e._ref&&GR.pal.id==g.id;const m=e.girls.includes(g.id)?markType(e,g.id):[];
   const h=m.includes('私檯')?'<span class=gm4>4</span>':m.includes('訂番')?'<span class=gmo>✓</span>':m.includes('紅')?'<b style="color:#e22">✓</b>':m.length?'<b style="color:#27f">✓</b>':'';
   return`<td class="gc${sep}${early(g.id)||offAt(g)?' goff':''}${pal?' gpal':''}" onclick="Grid.cell('${e._ref}','${g.id}')">${h}</td>`}).join('')}</tr>`}).join('');
 const tot=all.map((g,j)=>{const r=girlDay(g.id,d),sep=j==main.length?' gsep2':((j+1)%5==0?' gsep':'');const led=(S.ledger||[]).filter(z=>z.girl==g.id&&z.day==d);const lt=led.map(z=>`${z.type=='寄放'||z.type=='歸還'?'+':'-'}${z.amt}`).join(' ');
  return`<td class="gt${sep}${early(g.id)||offAt(g)?' goff':''}">${r.tai?`<b>${r.tai}</b>`:''}${early(g.id)?`<div class=gel>${esc(String(early(g.id)).replace(':',''))}<br>離開</div>`:''}${lt?`<div class=gled>${esc(lt)}</div>`:''}</td>`}).join('');
 const pal=GR.pal?`<div class=gpalbox>${(()=>{const g=G(GR.pal.id),e=rowCur(GR.pal.ref);return`<b>${esc(e?e.room+' 第'+e.ban+'番':'')}・${esc(GR.pal.id)} ${g?esc(nm(g)):''}</b>`})()} ${PAL.map(([k,l])=>`<button type=button onclick="Grid.set('${GR.pal.ref}','${GR.pal.id}','${k}')">${l}</button>`).join('')}<button type=button class=s onclick="Grid.cell(null)">取消</button></div>`:'';
 p.innerHTML=`<div class=gtop><span class=gdate>${rocDate(d)}</span> <span class=gstore>${esc(S.cfg.storeName||document.getElementById('store').textContent||'')}</span> <input type=date value="${d}" onchange="Grid.day(this.value)"> ${canEdit()?'<button type=button onclick="Grid.add()">＋ 新增一番</button>':'<span style="color:#888">（只能檢視）</span>'} <button type=button class=s onclick="Grid.zoom(1)">＋字</button><button type=button class=s onclick="Grid.zoom(-1)">－字</button> <button type=button class=s onclick="Grid.print()">🖨 列印 A3</button> <button type=button class=s onclick="Grid.off();openSheet()">↔ 一般排檯表</button></div>
 <div class=gleg><b style="color:#e22">✓</b> 紅勾＝客人點選　<b style="color:#27f">✓</b> 藍勾＝幹部指派　<span class=gmo>✓</span> 訂番　<span class=gm4>4</span> 私檯　<span style="background:#ffb347;padding:0 6px">橘線</span> 已買單　<span style="border-left:3px solid #e22;padding-left:4px">紅線</span> 已領錢回家　・點格子勾選，點左側改包廂／時間／人數，點小姐編號畫紅線</div>${pal}
 <div class=gwrap style="--gz:${GR.z||1}"><table class=grid><thead><tr><th class="gs gs0">訂番</th><th class="gs gs1">包廂</th><th class="gs gs2">備註</th><th class="gs gs3">番</th><th class="gs gs4">時間</th>${head}</tr></thead><tbody>${body||`<tr><td class=gs colspan=5>今天還沒有番</td></tr>`}</tbody><tfoot><tr><td class="gs gs0"></td><td class="gs gs1" colspan=1>合計</td><td class="gs gs2"></td><td class="gs gs3">${rows.length}</td><td class="gs gs4"></td>${tot}</tr></tfoot></table></div>
 <p style="font-size:12px;color:#888">與系統同一份資料：勾選＝把小姐排進該番（紅勾＝點檯、藍勾＝店家派、訂番＝小姐 ${C().orderGirlBonus} 元、私檯＝${C().privTai} 台）；台數、訂番獎金、買單、白板都即時更新。合計列＝當日台數（待確認）；下方紅字＝寄放(+)／預支(-)。右側隔開的欄＝非上班／其他。</p>`;
 const nx=p.querySelector('.gwrap');if(sc&&nx){nx.scrollLeft=sc[0];nx.scrollTop=sc[1]}}
const CSS=`.gtop{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin-bottom:4px}.gdate{font-size:20px;font-weight:bold}.gstore{font-size:18px;color:#c00;font-weight:bold}
.gleg{font-size:12px;color:#ccc;margin:2px 0 6px}.gwrap{overflow:auto;max-height:calc(100vh - 150px);background:#fff;color:#000;-webkit-overflow-scrolling:touch;border:1px solid #6a8fd8}
table.grid{border-collapse:separate;border-spacing:0;font-size:calc(14px*var(--gz));background:#fff}
.grid th,.grid td{border-right:1px solid #8fb0ea;border-bottom:1px solid #8fb0ea;padding:0;text-align:center;background:#fff;color:#000}
.grid td.gc{width:calc(30px*var(--gz));min-width:calc(30px*var(--gz));height:calc(32px*var(--gz));cursor:pointer;font-size:calc(18px*var(--gz))}
.grid thead th{position:sticky;top:0;z-index:3}.grid tfoot td{position:sticky;bottom:0;z-index:3;background:#f7f7ff}
.grid .gs{position:sticky;z-index:2;background:#fff;cursor:pointer;white-space:nowrap}.grid thead .gs,.grid tfoot .gs{z-index:4}
.gs0{left:0;width:24px;min-width:24px;color:#c00;font-weight:bold}.gs1{left:24px;width:44px;min-width:44px}.gs2{left:68px;width:40px;min-width:40px;font-size:12px}.gs3{left:108px;width:24px;min-width:24px;color:#555}.gs4{left:132px;width:42px;min-width:42px;border-right:2px solid #000!important}
.gh{cursor:pointer;vertical-align:bottom;min-width:calc(30px*var(--gz))}.gband{color:#e22;font-size:11px;height:13px;font-weight:bold}.gno{color:#e22;font-weight:bold;font-size:calc(15px*var(--gz))}.gnm{font-size:calc(11px*var(--gz));writing-mode:vertical-rl;margin:0 auto;min-height:26px;letter-spacing:-1px}
.gsep{border-right:2px solid #000!important}.gsep2{border-left:6px double #444!important}
.grid tr.gend td{background:linear-gradient(transparent 38%,#ffb347 38%,#ffb347 62%,transparent 62%)}.grid tr.gend td.gs{background:linear-gradient(#fff 38%,#ffb347 38%,#ffb347 62%,#fff 62%)}
.grid td.goff,.grid th.goff{background-image:linear-gradient(90deg,transparent 45%,#e22 45%,#e22 55%,transparent 55%)!important}
.gpal{outline:3px solid #fc3;outline-offset:-3px}.gm4{color:#e22;font-weight:bold;border:1.5px solid #e22;border-radius:3px;padding:0 2px}.gmo{color:#e22;font-weight:bold;border:1.5px solid #e22;border-radius:50%;padding:0 3px}
.gel{color:#e22;font-size:10px;font-weight:bold;line-height:1.1;background:#fff}.gled{color:#e22;font-size:10px;font-weight:bold}.gt{font-size:13px;vertical-align:top}
.gpalbox{position:fixed;left:6px;right:6px;bottom:8px;z-index:9000;box-shadow:0 2px 12px #000;background:#222;padding:6px;border-radius:8px;display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin:4px 0}.gpalbox button{font-size:16px;padding:8px 10px;min-height:42px}
@media (min-width:1600px){.gwrap{--gz:1.25}}@media (max-width:600px){.gs2{font-size:11px}.gs3{color:#999}}
@media print{@page{size:A3 landscape;margin:6mm}.gtop button,.gtop input,.gpalbox,.ph{display:none!important}.gwrap{max-height:none;overflow:visible;border:0}.grid .gs,.grid thead th,.grid tfoot td{position:static}body *{visibility:hidden}#page,#page *{visibility:visible}#page{position:absolute;left:0;top:0}}`;
const st=document.createElement('style');st.textContent=CSS;document.head.appendChild(st);
function open(d){if(lvl()>=2&&cleanOld())save();GR.on=true;GR.day=d||GR.day||(typeof shDay!='undefined'&&shDay)||bizDay(now());GR.pal=null;pageOpen('<div id=gridPg></div>');draw()}
window.Grid={open,draw,cell:(r,i)=>{if(r===null){GR.pal=null;return draw()}cell(r,i)},set:setMark,row:rowMenu,girl:girlMenu,add:newRow,day:d=>{GR.day=d;draw()},off:()=>{GR.on=false},zoom:k=>{GR.z=Math.max(.7,Math.min(2,(GR.z||1)+k*.15));draw()},print:()=>{GR.pal=null;draw();setTimeout(()=>print(),100)},state:GR};
window.openGrid=()=>open();
// 一般排檯表加切換鈕；遠端更新時重畫
const os0=window.openSheet;window.openSheet=function(){GR.on=false;os0.apply(this,arguments);const h=document.querySelector('#page h2');if(h&&!h.querySelector('.gtog')){const b=document.createElement('button');b.className='s gtog';b.textContent='📋 傳統排檯表';b.onclick=()=>open(typeof shDay!='undefined'?shDay:null);h.appendChild(b)}};
const r0=window.render;window.render=function(){r0.apply(this,arguments);if(GR.on&&document.getElementById('gridPg')&&!document.getElementById('dlg').open)draw()};
const pc0=window.pageClose;if(pc0)window.pageClose=function(){GR.on=false;return pc0.apply(this,arguments)};
})();
