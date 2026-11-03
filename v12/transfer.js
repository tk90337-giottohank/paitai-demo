// v12.5 換包廂＋時間調整
(function(){
S.dirty=S.dirty||{};S.notices=S.notices||[];
const who=()=>S.cur?S.cur.name:(S.op||'未填');
const nm=g=>String(g.name||'').replace(/^\s*\d+\s*號?\s*/,'')||g.id;
function notice(text,kind,min){S.notices=(S.notices||[]).filter(n=>n.until>now());S.notices.push({id:now().toString(36)+Math.random().toString(36).slice(2,5),t:now(),text,kind,until:now()+(min||20)*60000})}
// ---- 換包廂 ----
function openXfer(r){if(!needRole(2,'換包廂'))return;const x=S.rooms[r];if(!x)return alert('這間沒有進行中的番');
 const rooms=roomList().filter(z=>z!=r);const fm=document.getElementById('dform');
 fm.innerHTML=`<h3>🔀 換包廂：${esc(r)} → ？</h3><p style="font-size:13px;color:#aaa">整番搬過去（小姐、點餐、帳、時間、訂番），番號與進場時間不變；${esc(r)} 會變成「待清理」。</p>
 ${rooms.map(z=>{const busy=!!S.rooms[z],dirty=!!(S.dirty||{})[z],cl=!!(S.cleaning||{})[z];return`<button type=button ${busy?'disabled':''} onclick="Xfer.go('${r}','${z}')" style="min-width:70px;height:48px;margin:3px;${busy?'opacity:.35':dirty||cl?'background:#a70':''}">${esc(z)}${busy?'<br><small>使用中</small>':dirty?'<br><small>待清理</small>':cl?'<br><small>清潔中</small>':''}</button>`}).join('')}
 <p><button class=s value="">取消</button></p>`;const d=document.getElementById('dlg');d.returnValue='';d.onclose=null;d.showModal()}
function go(from,to){const x=S.rooms[from];if(!x||!needRole(2,'換包廂'))return;if(S.rooms[to])return alert(`${to} 使用中，不能換過去`);
 if(((S.dirty||{})[to]||(S.cleaning||{})[to])&&!confirm(`${to} 還沒清理完成，確定要換過去？`))return;
 if(!confirm(`確定 ${from} → ${to}？`))return;const st=x.start,t=now();
 S.rooms[to]=x;delete S.rooms[from];x.id=to;delete S.dirty[to];if(S.cleaning)delete S.cleaning[to];
 (x.transfers=x.transfers||[]).push({t,from,to,by:who()});
 const gs=S.girls.filter(g=>g.room==from);
 gs.forEach(g=>{g.room=to;g.holds=(g.holds||[]).map(z=>z==from?to:z);clearCalls(g,from);g.inRoom=false;g.loc='換包廂中';g.outSince=t;addCall('報到',g,to)});
 S.girls.forEach(g=>{g.holds=(g.holds||[]).map(z=>z==from?to:z);if(g.priv&&g.priv.room==from)g.priv.room=to});
 ['redLog','blueLog'].forEach(k=>(S[k]||[]).forEach(z=>{if(z.room==from&&z.t>=st-60000)z.room=to}));
 (S.orderBonus||[]).forEach(o=>{if(o.room==from&&o.t>=st-60000)o.room=to});
 (S.autos||[]).forEach(a=>{a.rooms=(a.rooms||[]).map(z=>z==from?to:z)});(S.reqs||[]).forEach(q=>{if(q.room==from)q.room=to});
 (S.calls||[]).forEach(c=>{if(c.room==from)c.room=to});
 S.dirty[from]={t,from,to,by:who()};
 notice(`🧹 請少爺清理 ${from} 包廂`,'clean',60);notice(`🔀 ${from} → ${to}，小姐請移到 ${to} 包廂${gs.length?'（'+gs.map(g=>g.id).join('、')+'）':''}`,'move',20);
 if(window.Food&&Food.moveRoom)Food.moveRoom(from,to,st);
 log(`🔀 換包廂 ${from} → ${to}（${who()}）小姐 ${gs.map(g=>g.id).join(',')||'無'}`);beep&&beep();
 document.getElementById('dlg').close();save();render();if(window.Grid&&Grid.state.on)Grid.draw()}
function cleaned(r){if(!S.cur)return alert('請先登入');const d=S.dirty[r];if(!d)return;delete S.dirty[r];S.notices=(S.notices||[]).filter(n=>!(n.kind=='clean'&&n.text.includes(` ${r} `)));log(`🧹 ${r} 已清理（${who()}）`);save();render()}
// ---- 時間調整 ----
function openAdj(r){if(!needRole(2,'時間調整'))return;const x=S.rooms[r];if(!x)return;const gs=S.girls.filter(g=>g.room==r);const fm=document.getElementById('dform');
 const hist=(x.timeAdj||[]).map(a=>`<li>${hm(a.t)} ${a.girl?esc(a.girl)+'號 ':'整番 '}<b style="color:${a.min>0?'#4c4':'#f66'}">${a.min>0?'+':''}${a.min} 分</b>${a.reason?'・'+esc(a.reason):''}・${esc(a.by)}</li>`).join('');
 fm.innerHTML=`<h3>⏱ 時間調整：${esc(r)}（第 ${x.sessions} 節）</h3><p>目前：${timeInfo(x)}</p>
 <label>對象 <select id=taW><option value="">整個番（包廂時間）</option>${gs.map(g=>`<option value="${g.id}">${g.id} ${esc(nm(g))}（小姐個人時間）</option>`).join('')}</select></label>
 <p>${[-30,-15,-10,-5,5,10,15,30].map(v=>`<button type=button style="min-width:54px;height:44px" onclick="taM.value=(+taM.value||0)+(${v})">${v>0?'+':''}${v}</button>`).join(' ')}</p>
 <label>增減分鐘（可自由填，負數＝減少）<input id=taM type=number inputmode=numeric value=0 style="width:90px;font-size:20px"></label>
 <label>原因（選填）<input id=taR placeholder="例：客人要求延長、包廂故障補時間"></label>
 ${hist?`<p><b>調整紀錄</b></p><ul style="font-size:13px">${hist}</ul>`:''}
 <button value=ok>確定</button> <button class=s value="">取消</button>`;
 const d=document.getElementById('dlg');d.returnValue='';d.onclose=()=>{if(d.returnValue!='ok')return;const m=Math.round(+taM.value||0);if(!m)return;const w=taW.value,rs=taR.value.trim();
  if(w){const g=G(w);if(g){g.until=(g.until||now())+m*60000;g.warned=false}}else{x.end+=m*60000;x.warned=false}
  (x.timeAdj=x.timeAdj||[]).push({t:now(),min:m,girl:w||'',reason:rs,by:who()});
  log(`⏱ ${r} ${w?w+'號 ':'整番 '}${m>0?'+':''}${m} 分${rs?'（'+rs+'）':''}（${who()}）`);save();render();if(window.Grid&&Grid.state.on)Grid.draw()};d.showModal()}
// ---- 提示列（所有裝置與白板大螢幕）----
const bar=document.createElement('div');bar.id='xferBar';bar.style.cssText='position:fixed;left:0;right:0;top:0;z-index:950;display:none;font-size:20px';document.body.appendChild(bar);
const hid=new Set(JSON.parse(sessionStorage.getItem('xfHide')||'[]'));
function drawBar(){const n=now(),N=(S.notices||[]).filter(z=>z.until>n&&!hid.has(z.id)&&z.kind=='move'),D=Object.entries(S.dirty||{});
 if(!N.length&&!D.length){bar.style.display='none';document.body.style.paddingTop='';return}bar.style.display='block';
 bar.innerHTML=N.map(z=>`<div style="background:#c60;color:#fff;padding:8px 12px;font-weight:bold;display:flex;gap:8px;align-items:center"><span style="flex:1">${esc(z.text)}</span><button onclick="Xfer.hide('${z.id}')" style="font-size:14px">知道了</button></div>`).join('')+
 D.map(([r,v])=>`<div style="background:#b22;color:#fff;padding:8px 12px;font-weight:bold;display:flex;gap:8px;align-items:center;animation:xfl 1.2s infinite alternate"><span style="flex:1">🧹 請少爺清理 ${esc(r)} 包廂 <small style="font-weight:normal">（${hm(v.t)} 客人換到 ${esc(v.to)}）</small></span>${TVMODE?'':`<button onclick="Xfer.cleaned('${r}')" style="font-size:16px;background:#2b8;color:#fff">✓ 已清理</button>`}</div>`).join('')+'<style>@keyframes xfl{to{background:#e33}}</style>';document.body.style.paddingTop=bar.offsetHeight+'px'}
// ---- 掛到既有畫面 ----
const r0=window.render;window.render=function(){r0.apply(this,arguments);drawBar();document.querySelectorAll('#rooms .room').forEach((el,i)=>{const r=roomList()[i];if(S.rooms[r]&&!el.querySelector('.xfb')&&lvl()>=2){const d=document.createElement('div');d.className='xfb';d.innerHTML=`<button class=s onclick="event.stopPropagation();Xfer.open('${r}')">🔀 換包廂</button> <button class=s onclick="event.stopPropagation();Xfer.adj('${r}')">⏱ 時間</button>`;el.appendChild(d)}})};
const ec0=window.emptyCard;window.emptyCard=function(r){const d=(S.dirty||{})[r];if(d)return`<div style="color:#f66;font-weight:bold">🧹 待清理（客人已換到 ${esc(d.to)}）</div><button onclick="Xfer.cleaned('${r}')">✓ 已清理</button>`;return ec0.apply(this,arguments)};
const ci0=window.checkIn;window.checkIn=function(r){if((S.dirty||{})[r]&&!confirm(`${r} 還在待清理，確定要開番？`))return;if(S.dirty)delete S.dirty[r];return ci0.apply(this,arguments)};
const rd0=window.roomDetail;window.roomDetail=function(r){rd0.apply(this,arguments);const x=S.rooms[r],f=document.getElementById('dform');if(!x||!f)return;const h=document.createElement('div');
 h.innerHTML=`${(x.transfers||[]).length?`<p style="font-size:13px">換包廂紀錄：${x.transfers.map(z=>`${hm(z.t)} ${esc(z.from)}→${esc(z.to)}（${esc(z.by)}）`).join('；')}</p>`:''}${(x.timeAdj||[]).length?`<p style="font-size:13px">時間調整：${x.timeAdj.map(a=>`${hm(a.t)} ${a.girl?a.girl+'號':'整番'} ${a.min>0?'+':''}${a.min}分${a.reason?'（'+esc(a.reason)+'）':''}・${esc(a.by)}`).join('；')}</p>`:''}${lvl()>=2?`<p><button type=button onclick="dlg.close();Xfer.open('${r}')">🔀 換包廂</button> <button type=button onclick="dlg.close();Xfer.adj('${r}')">⏱ 時間調整</button></p>`:''}`;f.insertBefore(h,f.lastElementChild)};
// rowsOf 帶入換包廂紀錄（買單後也留在排檯紀錄）
const ro0=window.rowsOf;window.rowsOf=function(x,r,closed){const a=ro0(x,r,closed);if(x.transfers&&x.transfers.length)a.forEach(e=>{e.xfer=x.transfers.map(z=>({t:z.t,from:z.from,to:z.to,by:z.by}))});if(x.timeAdj&&x.timeAdj.length)a.forEach(e=>{e.timeAdj=x.timeAdj.slice()});return a};
// 一般排檯表：進行中的番加操作列
const os0=window.openSheet;window.openSheet=function(){os0.apply(this,arguments);const h=document.querySelector('#page h2');if(!h||lvl()<2||document.getElementById('xfSheet'))return;const live=Object.keys(S.rooms||{});if(!live.length)return;
 const p=document.createElement('p');p.id='xfSheet';p.style.fontSize='13px';p.innerHTML='進行中的番：'+live.map(r=>`<span style="display:inline-block;margin:2px 6px 2px 0;padding:2px 6px;border:1px solid #555;border-radius:6px"><b>${esc(r)}</b> <button class=s onclick="Xfer.open('${r}')">🔀 換包廂</button><button class=s onclick="Xfer.adj('${r}')">⏱ 時間</button></span>`).join('');h.after(p)};
window.Xfer={open:openXfer,go,cleaned,adj:openAdj,hide:id=>{hid.add(id);sessionStorage.setItem('xfHide',JSON.stringify([...hid]));drawBar()},draw:drawBar};
setInterval(drawBar,30000);
})();
