// v12.13（新店 7 包廂清單；停用舊房不刪歷史）＋v12.12（07:10 自動換日＋昨日未完成＋重設包廂）＋v12.11（自動排台計分：偏藍勾＋今日台數＋無資料補台）＋v12.10（自動排台學習）＋v12.9（客人隨機點檯）＋v12.6（客人點檯平板）＋v12.5（換包廂・時間調整）＋v12.4（傳統排檯表）＋v12.3（登入紀錄）＋v12.2.1（餐點系統＋廚房收單）
// v12 雲端同步層：Firebase Auth（員工編號＋密碼）＋ Firestore 即時同步
import {firebaseConfig} from './firebase-config.js';
import {initializeApp,deleteApp} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js';
import {getAuth,connectAuthEmulator,signInWithEmailAndPassword,createUserWithEmailAndPassword,signOut,onAuthStateChanged,updatePassword,browserLocalPersistence,setPersistence} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
import {where,initializeFirestore,persistentLocalCache,persistentMultipleTabManager,connectFirestoreEmulator,doc,collection,onSnapshot,setDoc,deleteDoc,getDoc,writeBatch,addDoc,query,orderBy,limit,updateDoc,onSnapshotsInSync,serverTimestamp,getDocs,runTransaction} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
const EMU=/[?&]emu=1/.test(location.search);
const app=initializeApp(firebaseConfig),auth=getAuth(app);
const db=initializeFirestore(app,{localCache:persistentLocalCache({tabManager:persistentMultipleTabManager()})});
if(EMU){connectAuthEmulator(auth,'http://127.0.0.1:9099',{disableWarnings:true});connectFirestoreEmulator(db,'127.0.0.1',8080)}
const DOMAIN='paitai-system.local',mail=id=>String(id).trim().toLowerCase()+'@'+DOMAIN;
const RANK={'小姐':1,'少爺':1,'幹部':2,'經理':3,'老闆':4,'特殊':5,'tv':0,'kitchen':0,'room':0};const RL=r=>r=='特殊'?'冠廷':r=='kitchen'?'廚房':r=='room'?'房間平板':r;const ROLE_ALL=['小姐','少爺','幹部','經理','老闆','特殊','tv','kitchen','room'];
const LOCAL=new Set(['cur','op','users','usersExample','impSnap','wsSeq']);
const SETTINGS=['cfg','wines','catalog','cb','attVer','cutVer','cleanVer','imp1026','beerVer','sheetLearn'];
const isDayKey=k=>!LOCAL.has(k)&&!SETTINGS.includes(k)&&!['hist','wineStore','wsLog','ledger'].includes(k);
const J=v=>JSON.stringify(v===undefined?null:v);
const st={user:null,prof:null,inited:null,dayId:null,unsub:[],dayUnsub:null,last:{set:{},day:{},hist:{},wine:{},led:{},wlog:new Set()},timer:null,pending:0,err:'',online:navigator.onLine};
const lv=()=>st.prof&&!st.prof.disabled?RANK[st.prof.role]||0:0;
// ---- 狀態指示 ----
function status(){const el=document.getElementById('sync');if(!el)return;let t,c;
 if(!st.user){t='☁ 未登入';c='#888'}else if(st.err){t='⚠ '+st.err;c='#e44'}else if(st.inited===false){t='☁ 雲端尚未初始化';c='#e90'}
 else if(!st.online){t=`📴 離線（本機暫存${st.pending?'・待上傳':''}）`;c='#e90'}else if(st.pending){t='⟳ 同步中…';c='#4af'}else{t='✓ 已同步';c='#2b8'}
 el.textContent=t;el.style.color=c;el.title=EMU?'模擬器模式':'Firebase paitai-system'}
addEventListener('online',()=>{st.online=true;status()});addEventListener('offline',()=>{st.online=false;status()});
onSnapshotsInSync(db,()=>status());
const ok=p=>{st.pending++;st.writes=(st.writes||0)+1;status();return p.then(()=>{st.pending=Math.max(0,st.pending-1);st.err='';status()}).catch(e=>{st.pending=Math.max(0,st.pending-1);st.err=e.code=='permission-denied'?'權限不足（未寫入）':'同步錯誤';console.warn(e);status();setTimeout(()=>{st.err='';status()},4000)})};
// ---- 由雲端套用到 S ----
function rerender(){try{render();if(typeof renderTV=='function'&&TVMODE)renderTV()}catch(e){console.warn(e)}}
function applyFields(data,bucket,keys){let ch=false;for(const k of keys){if(!(k in data))continue;if(bucket[k]===data[k])continue;bucket[k]=data[k];try{S[k]=JSON.parse(data[k])}catch(e){}ch=true}return ch}
function subDay(id){if(st.dayUnsub)st.dayUnsub();st.dayId=id;st.last.day={};
 st.dayUnsub=onSnapshot(doc(db,'days',id),snap=>{if(snap.metadata.hasPendingWrites)return;
  if(!snap.exists()){if(st.inited&&lv()>=1)push(true);return}
  const d=snap.data();if(applyFields(d,st.last.day,Object.keys(d)))rerender()},e=>fail(e))}
function fail(e){console.warn(e);st.err=e.code=='permission-denied'?'權限不足':'連線錯誤';status()}
function startSync(){stopSync();foodSub();
 if(isKit()){openKitchen();status();return}
 st.unsub.push(onSnapshot(doc(db,'config','settings'),snap=>{if(snap.metadata.hasPendingWrites)return;st.inited=snap.exists();
  if(snap.exists()&&applyFields(snap.data(),st.last.set,SETTINGS))rerender();status();if(!st.inited&&lv()>=4)banner();if(st.inited){syncServerTime();if(typeof maybeDayRoll==='function')setTimeout(()=>maybeDayRoll({reason:'sync'}),600)}},fail));
 subDay(S.openDay||bizDay(now()));
 if(lv()>=2){
  st.unsub.push(onSnapshot(collection(db,'hist'),qs=>{if(qs.metadata.hasPendingWrites)return;const h={};qs.forEach(d=>{h[d.id]=JSON.parse(d.data().json);st.last.hist[d.id]=d.data().json});S.hist=Object.assign(S.hist||{},h);for(const k of Object.keys(S.hist))if(!h[k]&&st.last.hist[k]){delete S.hist[k];delete st.last.hist[k]}rerender()},fail));
  st.unsub.push(onSnapshot(collection(db,'wine'),qs=>{if(qs.metadata.hasPendingWrites)return;const L=[];qs.forEach(d=>{L.push(JSON.parse(d.data().json));st.last.wine[d.id]=d.data().json});L.sort((a,b)=>a.id-b.id);S.wineStore=L;rerender()},fail));
  st.unsub.push(onSnapshot(collection(db,'ledger'),qs=>{if(qs.metadata.hasPendingWrites)return;const L=[];qs.forEach(d=>{L.push(JSON.parse(d.data().json));st.last.led[d.id]=d.data().json});S.ledger=L;rerender()},fail));
  st.unsub.push(onSnapshot(query(collection(db,'wineLog'),orderBy('t','desc'),limit(200)),qs=>{if(qs.metadata.hasPendingWrites)return;const L=[];qs.forEach(d=>{st.last.wlog.add(d.id);L.push(JSON.parse(d.data().json))});S.wsLog=L;rerender()},fail))}
 status()}
function stopSync(){F.unsub.forEach(u=>u());F.unsub=[];st.unsub.forEach(u=>u());st.unsub=[];if(st.dayUnsub)st.dayUnsub();st.dayUnsub=null}
// ---- 由 S 寫回雲端（只寫有變動的欄位）----
function push(now_){if(!st.user||TVMODE||lv()<1)return;clearTimeout(st.timer);st.timer=null;if(now_)return flush();st.timer=setTimeout(flush,600);status()}
function flush(){st.timer=null;if(!st.user||st.inited!==true||lv()<1){status();return}
 const id=S.openDay||bizDay(now());if(id!=st.dayId)subDay(id);
 // 當日
 const dch={};for(const k of Object.keys(S))if(isDayKey(k)){const j=J(S[k]);if(st.last.day[k]!==j){dch[k]=j}}
 if(Object.keys(dch).length){const size=Object.values(dch).reduce((a,v)=>a+v.length,0);if(size>900000){st.err='當日資料過大';status()}Object.assign(st.last.day,dch);ok(setDoc(doc(db,'days',id),dch,{merge:true}))}
 // 設定（經理以上）
 if(lv()>=3){const sch={};for(const k of SETTINGS){const j=J(S[k]);if(st.last.set[k]!==j)sch[k]=j}if(Object.keys(sch).length){Object.assign(st.last.set,sch);ok(setDoc(doc(db,'config','settings'),sch,{merge:true}))}}
 // 歷史
 for(const [d,v] of Object.entries(S.hist||{})){const j=J(v);if(st.last.hist[d]===j)continue;if(lv()<2&&st.last.hist[d]!==undefined)continue;st.last.hist[d]=j;ok(setDoc(doc(db,'hist',d),{json:j,by:st.user.uid,at:Date.now()}))}
 if(lv()>=3)for(const d of Object.keys(st.last.hist))if(!(S.hist||{})[d]){delete st.last.hist[d];ok(deleteDoc(doc(db,'hist',d)))}
 // 寄酒
 if(lv()>=2){for(const w of S.wineStore||[]){const j=J(w);if(st.last.wine[w.id]===j)continue;st.last.wine[w.id]=j;ok(setDoc(doc(db,'wine',String(w.id)),{json:j}))}
  if(lv()>=3)for(const wid of Object.keys(st.last.wine))if(!(S.wineStore||[]).some(w=>String(w.id)==wid)){delete st.last.wine[wid];ok(deleteDoc(doc(db,'wine',wid)))}
  for(const e of S.ledger||[]){const j=J(e);if(st.last.led[e.id]===j)continue;if(st.last.led[e.id]!==undefined&&lv()<3)continue;st.last.led[e.id]=j;ok(setDoc(doc(db,'ledger',String(e.id)),{json:j,uid:st.user.uid,at:Date.now()}))}
  if(lv()>=3)for(const k of Object.keys(st.last.led))if(!(S.ledger||[]).some(e=>String(e.id)==k)){delete st.last.led[k];ok(deleteDoc(doc(db,'ledger',k)))}
  for(const e of S.wsLog||[]){const k=`${e.t}-${e.id}-${(e.act||'').length}`;if(st.last.wlog.has(k))continue;st.last.wlog.add(k);ok(setDoc(doc(db,'wineLog',k),{uid:st.user.uid,t:e.t,json:J(e)}))}}
 status()}
function audit(m){if(!st.user||TVMODE||lv()<1||st.inited!==true)return;addDoc(collection(db,'audit'),{uid:st.user.uid,name:st.prof.name,role:RL(st.prof.role),t:Date.now(),msg:String(m).slice(0,500)}).catch(()=>{})}
// ---- 登入畫面 ----
const ov=document.createElement('div');ov.id='fbLogin';ov.style.cssText='position:fixed;inset:0;z-index:9999;background:#14161c;color:#eee;display:none;overflow:auto;padding:24px;font-size:17px';document.body.appendChild(ov);
function loginUI(msg){ov.style.display='block';ov.innerHTML=`<div style="max-width:380px;margin:6vh auto"><h2>🔐 排檯系統登入</h2>${msg?`<p style="color:#f88">${msg}</p>`:''}
 <label>員工編號<br><input id=fbId autocomplete=username autocapitalize=none style="width:100%;font-size:20px;padding:8px"></label><br><br>
 <label>密碼<br><input id=fbPw type=password autocomplete=current-password style="width:100%;font-size:20px;padding:8px"></label><br><br>
 <button id=fbGo style="width:100%;font-size:20px;padding:12px">登入</button>
 <p style="font-size:14px"><a href="#" id=fbBoot style="color:#9cf">首次啟用：建立最高權限帳號</a>・<a href="#" id=fbHelp style="color:#9cf">登入教學</a>${EMU?'・<b style="color:#e90">模擬器</b>':''}</p></div>`;
 const go=async()=>{const id=fbId.value,pw=fbPw.value;if(!id||!pw)return;st.manual=true;fbGo.disabled=true;fbGo.textContent='登入中…';try{await signInWithEmailAndPassword(auth,mail(id),pw)}catch(e){loginUI(e.code=='auth/network-request-failed'?'網路連不上，請稍後再試':'員工編號或密碼錯誤')}};
 fbGo.onclick=go;fbPw.onkeydown=e=>{if(e.key=='Enter')go()};fbHelp.onclick=e=>{e.preventDefault();helpOverlay()};fbBoot.onclick=e=>{e.preventDefault();bootUI()}}
function bootUI(msg){ov.innerHTML=`<div style="max-width:380px;margin:6vh auto"><h2>首次啟用：建立最高權限帳號</h2><p style="font-size:14px">只能做一次。之後所有帳號都在系統內建立。</p><label>帳號類型<br><select id=bRole style="width:100%;font-size:20px;padding:8px"><option value="特殊" selected>冠廷（最高權限）</option><option value="老闆">老闆</option></select></label><br><br>${msg?`<p style="color:#f88">${msg}</p>`:''}
 <label>員工編號（英數）<br><input id=bId autocapitalize=none value="guanting" style="width:100%;font-size:20px;padding:8px"></label><br><br><label>名字<br><input id=bNm value="冠廷" style="width:100%;font-size:20px;padding:8px"></label><br><br>
 <label>密碼（至少 6 碼）<br><input id=bPw type=password autocomplete=new-password style="width:100%;font-size:20px;padding:8px"></label><br><br><button id=bGo style="width:100%;font-size:20px;padding:12px">建立並登入</button> <p><a href="#" id=bBack style="color:#9cf">← 返回登入</a></p></div>`;
 bBack.onclick=e=>{e.preventDefault();loginUI()};
 bGo.onclick=async()=>{st.manual=true;const id=bId.value.trim(),pw=bPw.value;if(!/^[A-Za-z0-9._-]+$/.test(id))return bootUI('員工編號只能用英文、數字');if(pw.length<6)return bootUI('密碼至少 6 碼');bGo.disabled=true;
  let cred;try{cred=await createUserWithEmailAndPassword(auth,mail(id),pw)}catch(e){return bootUI(e.code=='auth/email-already-in-use'?'這個編號已存在，請直接登入':'建立失敗：'+e.code)}
  try{const b=writeBatch(db);const br=bRole.value=='老闆'?'老闆':'特殊';b.set(doc(db,'users',cred.user.uid),{staffId:id.toLowerCase(),name:bNm.value.trim()||RL(br),role:br,rank:RANK[br],disabled:false,createdAt:Date.now()});b.set(doc(db,'config','boot'),{uid:cred.user.uid,at:Date.now()});await b.commit();await savePw(cred.user.uid,pw).catch(()=>{})}
  catch(e){try{await cred.user.delete()}catch(_){}await signOut(auth).catch(()=>{});return bootUI('系統已經啟用過，不能再建立。請用老闆給你的帳號登入。')}}}
onAuthStateChanged(auth,async u=>{stopSync();st.user=u;st.prof=null;st.inited=null;
 if(!u){S.cur=null;status();loginUI();return}
 let p;try{const s=await getDoc(doc(db,'users',u.uid));p=s.exists()?s.data():null}catch(e){p=null}
 if(!p||p.disabled){await signOut(auth);loginUI(p&&p.disabled?'此帳號已停用，請找老闆':'此帳號沒有權限資料，請找老闆');return}
 if(p.role=='room'){location.replace('guest.html'+location.search);return}
 st.prof=p;S.cur={name:p.name,role:p.role,uid:u.uid,staffId:p.staffId};S.op=p.name;const op=document.getElementById('op');if(op)op.value=p.name;
 ov.style.display='none';startSync();if(location.hash=='#kitchen')openKitchen();rerender();log(`登入：${p.name}${p.role=='特殊'?'':'（'+RL(p.role)+'）'}`);const ty=st.manual?'登入':'自動登入';st.manual=false;loginLog(ty)});
setPersistence(auth,browserLocalPersistence).catch(()=>{});
// ---- 帳號選單 / 人員管理 ----
function openAccount(){const f=document.getElementById('dform'),p=st.prof||{};
 f.innerHTML=`<h3>👤 ${esc(p.name||'')}${p.role=='特殊'?'':'（'+esc(p.role||'')+'）'}</h3><p style="font-size:13px">員工編號：${esc(p.staffId||'')}</p>
 <button type=button onclick="Cloud.changePw()">改密碼</button> ${lv()>=3?'<button type=button onclick="Cloud.openStaff()">人員帳號管理</button> ':''}${lv()>=4?'<button type=button class=s onclick="Cloud.migrate()">上傳本機資料到雲端（一次性）</button> ':''}<button type=button class=s onclick="openHelp()">登入教學</button>
 <p><button value=out>登出／切換人員</button> <button class=s value="">關閉</button></p>`;
 const d=document.getElementById('dlg');d.returnValue='';d.onclose=()=>{if(d.returnValue=='out'){log(`登出：${p.name}`);signOut(auth)}};if(d.open)d.close();d.showModal()}
async function changePw(){const pw=prompt('新密碼（至少 6 碼）');if(!pw)return;if(pw.length<6)return alert('至少 6 碼');try{await updatePassword(auth.currentUser,pw);await savePw(auth.currentUser.uid,pw).catch(()=>{});alert('已更新密碼')}catch(e){alert(e.code=='auth/requires-recent-login'?'為了安全，請先登出再登入一次後再改密碼':'失敗：'+e.code)}}
let usersUnsub=null,USERS=[];const PW={},PWshow={};
const canPw=u=>u&&(lv()>=5||(lv()==4&&(RANK[u.role]||0)<4));
const savePw=(uid,pw)=>setDoc(doc(db,'secrets',uid),{pw,updatedAt:Date.now(),updatedBy:st.user?st.user.uid:uid});
async function loadPw(uid){if(PW[uid]!==undefined)return PW[uid];try{const d=await getDoc(doc(db,'secrets',uid));PW[uid]=d.exists()?d.data().pw:null}catch(e){PW[uid]=null}return PW[uid]}
async function togglePw(uid){PWshow[uid]=!PWshow[uid];if(PWshow[uid])await loadPw(uid);redrawTbl()}
async function copyPw(uid){const pw=await loadPw(uid);if(!pw)return alert('未記錄');try{await navigator.clipboard.writeText(pw);alert('已複製')}catch(e){prompt('複製這個密碼',pw)}}
function redrawTbl(){const t=document.getElementById('stTbl');if(t)t.outerHTML=staffTbl()}
async function resetPw(uid){const u=USERS.find(x=>x.uid==uid);if(!canPw(u))return;const old=await loadPw(uid);if(!old)return alert('這個帳號沒有記錄密碼，無法在網頁上重設。\n請先停用舊帳號，再建立新編號。');
 const np=prompt(`替 ${u.name} 設定新密碼（至少 6 碼）`);if(!np)return;if(np.length<6)return alert('至少 6 碼');
 const sec=initializeApp(firebaseConfig,'rs'+Date.now()),sa=getAuth(sec);if(EMU)connectAuthEmulator(sa,'http://127.0.0.1:9099',{disableWarnings:true});
 try{const c=await signInWithEmailAndPassword(sa,mail(u.staffId),old);await updatePassword(c.user,np);await signOut(sa);await savePw(uid,np);PW[uid]=np;log(`重設密碼：${u.staffId}`);alert('已重設密碼');redrawTbl()}
 catch(e){alert(e.code=='auth/invalid-credential'||e.code=='auth/wrong-password'?'記錄的密碼已不正確（可能本人在別處改過），無法重設。請停用後重建。':'重設失敗：'+(e.code||e.message))}finally{deleteApp(sec).catch(()=>{})}}
function openStaff(){if(lv()<3)return alert('需經理以上');document.getElementById('dlg').close();
 if(!usersUnsub)usersUnsub=onSnapshot(query(collection(db,'users'),where('rank','<=',lv())),qs=>{USERS=[];qs.forEach(d=>USERS.push({uid:d.id,...d.data()}));USERS.sort((a,b)=>(RANK[b.role]||0)-(RANK[a.role]||0)||a.staffId.localeCompare(b.staffId));redrawTbl()},fail);drawStaff()}
function staffTbl(){const roles=ROLE_ALL.filter(r=>(RANK[r]||0)<=lv());return`<table class=sch id=stTbl><tr><th>編號</th><th>名字</th><th>角色</th><th>狀態</th>${lv()>=4?'<th>密碼</th>':''}<th></th></tr>${USERS.map(u=>{const mine=u.uid==st.user.uid,can=!mine&&(RANK[u.role]||0)<=lv();
  return`<tr><td>${esc(u.staffId)}${u.room?`<br><small>包廂 ${esc(u.room)}</small>`:''}</td><td>${esc(u.name)}</td><td>${can?`<select onchange="Cloud.setRole('${u.uid}',this.value)">${roles.map(r=>`<option value="${r}" ${r==u.role?'selected':''}>${r=='特殊'?'冠廷（最高）':RL(r)}</option>`).join('')}</select>`:esc(RL(u.role))+(mine?'（自己）':'')}</td><td>${u.disabled?'<b style="color:#e44">停用</b>':'啟用'}</td>${lv()>=4?`<td>${canPw(u)?(PWshow[u.uid]?(PW[u.uid]?`<code>${esc(PW[u.uid])}</code>`:'<span style="color:#aaa">未記錄</span>'):'••••')+` <button type=button class=s onclick="Cloud.togglePw('${u.uid}')">${PWshow[u.uid]?'隱藏':'👁 顯示'}</button> <button type=button class=s onclick="Cloud.copyPw('${u.uid}')">複製</button> <button type=button class=s onclick="Cloud.resetPw('${u.uid}')">重設密碼</button>`:'—'}</td>`:''}<td>${can?`<button type=button class=s onclick="Cloud.setDisabled('${u.uid}',${!u.disabled})">${u.disabled?'啟用':'停用'}</button>`:''}</td></tr>`}).join('')}</table>`}
function drawStaff(){const roles=ROLE_ALL.filter(r=>(RANK[r]||0)<=lv());
 pageOpen(`<h2>人員帳號管理</h2>${lv()>=4?`<details open><summary>新增帳號（老闆以上）</summary><label>員工編號（英數）<input id=nId autocapitalize=none></label> <label>名字<input id=nNm></label> <label>角色 <select id=nRole>${roles.map(r=>`<option value="${r}" ${r=='少爺'?'selected':''}>${r=='特殊'?'冠廷（最高）':RL(r)}</option>`).join('')}</select></label> <label>初始密碼（≥6）<input id=nPw></label> <button type=button onclick="Cloud.createStaff()">建立</button><p><button type=button onclick="Cloud.createRoomTabs()">🔑 一鍵建立每個包廂的房間平板帳號</button></p><p style="font-size:12px;color:#aaa">TV 看板請建立角色「tv」的帳號（只能看不能改）。</p></details>`:''}
 <div class=tw>${staffTbl()}</div>
 <p style="font-size:12px;color:#aaa">密碼：老闆可看老闆以下的人；冠廷可看全部。有記錄密碼的帳號可按「重設密碼」；顯示「未記錄」的舊帳號忘記密碼時，請先停用再建立新編號。</p>`)}
async function createStaff(){const id=nId.value.trim(),nm=nNm.value.trim()||id,role=nRole.value,pw=nPw.value;let room='';if(role=='room'){room=(prompt('這台房間平板綁定哪個包廂？（例 208）')||'').trim();if(!room)return}if(!/^[A-Za-z0-9._-]+$/.test(id))return alert('員工編號只能用英文、數字');if(pw.length<6)return alert('密碼至少 6 碼');
 const sec=initializeApp(firebaseConfig,'sec'+Date.now()),sa=getAuth(sec);if(EMU)connectAuthEmulator(sa,'http://127.0.0.1:9099',{disableWarnings:true});
 try{const c=await createUserWithEmailAndPassword(sa,mail(id),pw);await setDoc(doc(db,'users',c.user.uid),{staffId:id.toLowerCase(),name:nm,role,rank:RANK[role]||0,disabled:false,createdAt:Date.now(),by:st.user.uid,...(room?{room}:{})});await signOut(sa);await savePw(c.user.uid,pw).catch(()=>{});log(`建立帳號 ${id}（${nm}・${RL(role)}）`);alert(`已建立：${id}（${RL(role)}）`)}
 catch(e){alert(e.code=='auth/email-already-in-use'?'此編號已被使用':'建立失敗：'+(e.code||e.message))}finally{deleteApp(sec).catch(()=>{})}}
// v12.6.1 一鍵建立房間平板帳號（老闆以上；走同一個建立流程，密碼存 secrets）
async function mkUser(id,nm,role,pw,room){const sec=initializeApp(firebaseConfig,'sec'+Date.now()+Math.random()),sa=getAuth(sec);if(EMU)connectAuthEmulator(sa,'http://127.0.0.1:9099',{disableWarnings:true});
 try{const c=await createUserWithEmailAndPassword(sa,mail(id),pw);await setDoc(doc(db,'users',c.user.uid),{staffId:id.toLowerCase(),name:nm,role,rank:RANK[role]||0,disabled:false,createdAt:Date.now(),by:st.user.uid,...(room?{room}:{})});await signOut(sa);await savePw(c.user.uid,pw).catch(()=>{});log(`建立帳號 ${id}（${nm}・${RL(role)}${room?'・'+room:''}）`);return c.user.uid}finally{deleteApp(sec).catch(()=>{})}}
function rndPw(){const A='ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789',b=new Uint32Array(16);crypto.getRandomValues(b);return [...b].map(x=>A[x%A.length]).join('')}
async function createRoomTabs(){if(lv()<4)return alert('只有老闆以上可以建立');const have=new Set(USERS.filter(u=>u.role=='room'&&u.room).map(u=>u.room));const todo=(typeof officialRooms==='function'?officialRooms():roomList()).filter(r=>!have.has(r));
 if(!todo.length)return alert('每個包廂都已經有房間平板帳號');if(!confirm(`建立 ${todo.length} 個房間平板帳號？\n${todo.map(r=>'room-'+r.toLowerCase()+' → '+r).join('\n')}\n（密碼隨機產生，可在本頁「查看密碼」）`))return;
 const done=[],bad=[];for(const r of todo){const id='room-'+r.toLowerCase();try{await mkUser(id,r+' 平板','room',rndPw(),r);done.push(id+'→'+r)}catch(e){bad.push(id+'：'+(e.code=='auth/email-already-in-use'?'編號已被使用':(e.code||e.message)))}}
 alert(`已建立 ${done.length} 個：\n${done.join('\n')}${bad.length?'\n\n失敗：\n'+bad.join('\n'):''}`);openStaff()}
async function setRole(uid,role){const u=USERS.find(x=>x.uid==uid);await ok(updateDoc(doc(db,'users',uid),{role,rank:RANK[role]||0}));log(`變更角色 ${u&&u.staffId} → ${RL(role)}`)}
async function setDisabled(uid,v){const u=USERS.find(x=>x.uid==uid);if(!confirm(`${v?'停用':'啟用'} ${u&&u.name}？`))return;await ok(updateDoc(doc(db,'users',uid),{disabled:v}));log(`${v?'停用':'啟用'}帳號 ${u&&u.staffId}`)}
// ---- 一次性上傳本機資料 ----
function banner(){if(document.getElementById('fbBan'))return;const b=document.createElement('div');b.id='fbBan';b.style.cssText='position:fixed;left:0;right:0;bottom:0;z-index:9000;background:#e90;color:#000;padding:10px;font-size:16px;text-align:center';b.innerHTML='雲端還沒有資料。<button onclick="Cloud.migrate()">把這台裝置的資料上傳到雲端</button>';document.body.appendChild(b)}
async function migrate(){if(lv()<4)return alert('只有老闆可以上傳');if(!confirm('把「這台裝置」的資料上傳到雲端？\n（名冊、設定、訊息卡、當日營業、歷史、寄酒）\n雲端已有的同名資料會被覆蓋。'))return;
 const ops=[];const dd={};for(const k of Object.keys(S))if(isDayKey(k))dd[k]=J(S[k]);const ss={};for(const k of SETTINGS)ss[k]=J(S[k]);
 const id=S.openDay||bizDay(now());ops.push(['set','days/'+id,dd]);for(const [d,v] of Object.entries(S.hist||{}))ops.push(['set','hist/'+d,{json:J(v),by:st.user.uid,at:Date.now()}]);
 for(const w of S.wineStore||[])ops.push(['set','wine/'+w.id,{json:J(w)}]);for(const e of S.ledger||[])ops.push(['set','ledger/'+e.id,{json:J(e),uid:st.user.uid,at:Date.now()}]);for(const e of S.wsLog||[]){const k=`${e.t}-${e.id}-${(e.act||'').length}`;ops.push(['set','wineLog/'+k,{uid:st.user.uid,t:e.t,json:J(e)}])}
 ops.push(['set','config/settings',ss]);
 try{for(let i=0;i<ops.length;i+=400){const b=writeBatch(db);ops.slice(i,i+400).forEach(([,p,v])=>b.set(doc(db,...p.split('/')),v));await b.commit()}
  Object.assign(st.last.day,dd);Object.assign(st.last.set,ss);log(`上傳本機資料到雲端（${ops.length} 筆）`);document.getElementById('fbBan')?.remove();alert('上傳完成（'+ops.length+' 份文件）');startSync()}catch(e){alert('上傳失敗：'+(e.code||e.message))}}
// ---- 登入教學 ----
const HELP=`<h2>📖 登入教學</h2>
<h3>1. 每個人用「員工編號＋密碼」登入</h3><p>老闆會給你一組員工編號（例如 <b>sy01</b>）和初始密碼。打開排檯網址，輸入編號和密碼，按「登入」。不需要電子郵件。登入後會一直保持登入，直到按「登出」。</p>
<p>第一次登入後，點右上角 👤 →「改密碼」換成自己的密碼（至少 6 碼，可以用 6 位數字當 PIN）。</p>
<h3>2. 共用的手機或電腦（換人）</h3><p>點 👤 →「登出／切換人員」，再用自己的編號登入。每個操作都會記錄是誰做的，所以請不要用別人的帳號。</p>
<h3>3. 冠廷／老闆：建立和停用帳號</h3><p>第一次使用：冠廷在登入畫面點「首次啟用：建立最高權限帳號」（只能做一次），帳號類型選「冠廷（最高權限）」，編號建議 <b>guanting</b>，密碼自己設定。之後點 👤 →「人員帳號管理」→ 填 員工編號、名字、角色、初始密碼 →「建立」。離職或手機遺失：按「停用」，那個帳號馬上不能看也不能改。忘記密碼：停用舊帳號，再建一個新編號。</p>
<p>權限：小姐／少爺（排檯操作）＜ 幹部（手動匯入、寄酒、歷史紀錄、帳本新增）＜ 經理（設定、看金額、改角色）＜ 老闆（建立帳號）＜ 冠廷（最高，可管理老闆帳號）。老闆看不到也改不了冠廷的帳號；只有冠廷能建立同等權限的帳號；任何人都不能改自己的權限。</p>
<h3>4. TV 看板帳號</h3><p>老闆建立一個角色選「tv」的帳號（例如 <b>tv1</b>）。在電視的瀏覽器打開「排檯網址 + <b>#tv</b>」，用 tv 帳號登入一次就好。TV 帳號只能看，不能改任何資料，畫面會即時更新。</p>
<h3>5. iPhone 加入主畫面</h3><p>用 <b>Safari</b> 打開排檯網址 → 點下方「分享」⬆️ →「加入主畫面」→「新增」。之後從主畫面的圖示打開，就像 App 一樣。登入一次後會記住。</p>
<h3>6. 右上角的同步燈號</h3><p>✓ 已同步＝所有裝置都看到一樣的資料；⟳ 同步中＝正在上傳；📴 離線＝網路斷了，資料先存在這台，恢復網路後會自動上傳；⚠＝權限不足或錯誤。</p>`;
function helpOverlay(){ov.innerHTML=`<div style="max-width:560px;margin:3vh auto">${HELP}<p><button id=hBack style="font-size:18px;padding:10px">← 返回登入</button></p></div>`;hBack.onclick=()=>loginUI()}
// ===== v12.2 餐點系統＋廚房收單 =====
const FOOD_ROOMS=['102','103','105','106','201','202','203'];
const KIT_ST=['待做','製作中','已出餐'];
const MENU_SEED=[
 ['炒泡麵','Mì xào',0,'套餐內含'],['炒飯','Cơm chiên',0,'套餐內含'],['水餃','Sủi cảo',0,'套餐內含'],['蛋湯','Canh trứng',0,'套餐內含'],['桌面','Đồ ăn bàn（待確認）',0,'套餐內含'],
 ['鹹豬肉','Thịt heo muối',300,'加點'],['乾煎虱目魚肚','Cá đối phi lê chiên',300,'加點','肚'],['炸物拼盤','Món chiên tổng hợp',500,'加點','炸'],['炸斑鳩','Chim cút chiên',300,'加點'],
 ['香腸','Lạp sườn chiên',300,'加點'],['烤魷魚','Mực nướng',300,'加點','魷'],['炸魚下巴','Mang cá chiên',300,'加點'],['虱目魚肚湯','Bụng cá đối nấu canh',300,'加點'],
 ['烤扁魚','Nướng cá chỉ vàng',300,'加點','烏'],['和風洋蔥','Nộm hành tây',300,'加點'],['炸雞翅（待確認）','Cánh gà rán',300,'加點'],['烤五花（待確認）','Thịt ba chỉ quay',300,'加點']];
// v12.6.1 英文／泰文（客人平板）；第三欄 1＝待確認
const TR={'炒泡麵':['Fried instant noodles','บะหมี่กึ่งสำเร็จรูปผัด'],'炒飯':['Fried rice','ข้าวผัด'],'水餃':['Boiled dumplings','เกี๊ยวต้ม'],'蛋湯':['Egg drop soup','ซุปไข่'],'桌面':['Table snacks','ของว่างบนโต๊ะ',1],
 '鹹豬肉':['Salted pork','หมูเค็ม'],'乾煎虱目魚肚':['Pan-fried milkfish belly','ท้องปลานวลจันทร์ทอด'],'炸物拼盤':['Fried platter','ของทอดรวม'],'炸斑鳩':['Fried turtledove','นกเขาทอด',1],
 '香腸':['Taiwanese sausage','ไส้กรอกไต้หวัน'],'烤魷魚':['Grilled squid','ปลาหมึกย่าง'],'炸魚下巴':['Fried fish collar','คางปลาทอด'],'虱目魚肚湯':['Milkfish belly soup','ซุปท้องปลานวลจันทร์'],
 '烤扁魚':['Grilled flatfish','ปลาตัวแบนย่าง',1],'和風洋蔥':['Japanese-style onion salad','สลัดหอมใหญ่สไตล์ญี่ปุ่น'],'炸雞翅（待確認）':['Fried chicken wings','ปีกไก่ทอด',1],'烤五花（待確認）':['Grilled pork belly','หมูสามชั้นย่าง',1],
 '百威（一手）':['Budweiser (1 pack)','บัดไวเซอร์ (1 แพ็ค)'],'金牌（一手）':['Taiwan Gold Medal beer (1 pack)','เบียร์ไต้หวันโกลด์เมดัล (1 แพ็ค)'],'海尼根（一手）':['Heineken (1 pack)','ไฮเนเก้น (1 แพ็ค)']};
const BR=[['皇家禮炮','Royal Salute','รอยัลซาลูท'],['約翰走路','Johnnie Walker','จอห์นนี่ วอล์กเกอร์'],['麥卡倫','Macallan','แมคคาลแลน'],['軒尼詩','Hennessy','เฮนเนสซี่'],['人頭馬','Rémy Martin','เรมี่ มาร์แตง'],['馬爹利','Martell','มาร์เทล'],['起瓦士','Chivas Regal','ชีวาส รีกัล'],['格蘭菲迪','Glenfiddich','เกลนฟิดดิช'],['百齡罈','Ballantine\'s','บัลแลนไทน์'],['高粱','Kaoliang liquor','เหล้าเกาเหลียง'],['蘇格登','The Singleton','เดอะ ซิงเกิลตัน'],['大摩','The Dalmore','เดอะ ดัลมอร์'],['白蘭地','Brandy','บรั่นดี'],['金門','Kinmen Kaoliang','เหล้าเกาเหลียงจินเหมิน'],['格蘭','Glen','เกลน'],['紅酒','Red wine','ไวน์แดง'],['香檳','Champagne','แชมเปญ'],['啤酒','Beer','เบียร์']];
function trOf(zh){if(TR[zh])return{en:TR[zh][0],th:TR[zh][1],trTodo:!!TR[zh][2]};const b=BR.find(x=>zh.includes(x[0]));if(b){const y=(zh.match(/(\d+)\s*年/)||[])[1],z=y?'':((zh.replace(b[0],'').match(/^\s*(\d+)\s*$/)||[])[1]||'');return{en:b[1]+(y?' '+y+' Year':z?' '+z:''),th:b[2]+(y?' '+y+' ปี':z?' '+z:''),trTodo:zh.replace(b[0],'').replace(/\d+\s*年/,'').replace(/[（）()\s]/g,'')!=''}}return{en:'',th:'',trTodo:true}}
const OLD_D={m06:'D 炸（待確認）',m07:'D 肚（待確認）',m08:'D 烏（待確認）',m09:'D 魷（待確認）'};
const F={dFix:false,menu:[],orders:[],seen:new Set(),first:true,day:null,unsub:[],sound:false,fo:{room:'',q:{},note:''}};
const isKit=()=>st.prof&&!st.prof.disabled&&st.prof.role=='kitchen';
function foodSub(){F.unsub.forEach(u=>u());F.unsub=[];F.first=true;F.day=bizDay(now());if(!isKit())gqSub();
 F.unsub.push(onSnapshot(collection(db,'menu'),qs=>{const L=[];qs.forEach(d=>L.push({id:d.id,...d.data()}));L.sort((a,b)=>(a.ord||0)-(b.ord||0));F.menu=L;
  if(!L.length&&lv()>=3&&!qs.metadata.fromCache)seedMenu();if(L.length&&lv()>=3&&!qs.metadata.fromCache&&S.cfg&&!S.cfg.drinkSeed){S.cfg.drinkSeed=1;save();seedDrinks(L)}
  if(L.length&&lv()>=3&&!F.dFix){F.dFix=true;const bad=L.filter(m=>OLD_D[m.id]&&m.zh==OLD_D[m.id]&&!m.vn&&!m.price&&m.cat=='套餐內含');if(bad.length){bad.forEach(m=>ok(deleteDoc(doc(db,'menu',m.id))));log('餐點：移除白板 D 區預設品項（冠廷確認非套餐內含）')}
   const SH={'炸物拼盤':'炸','乾煎虱目魚肚':'肚','烤扁魚':'烏','烤魷魚':'魷'};L.forEach(m=>{if(SH[m.zh]&&m.short===undefined)ok(setDoc(doc(db,'menu',m.id),{short:SH[m.zh]},{merge:true}))})}if(L.length&&lv()>=3&&!qs.metadata.fromCache&&true){F.trDone=F.trDone||new Set();let n=0;L.forEach(m=>{if(m.en===undefined&&!F.trDone.has(m.id)){F.trDone.add(m.id);ok(setDoc(doc(db,'menu',m.id),trOf(m.zh||''),{merge:true}));n++}});if(n)log(`餐點：補上英文／泰文名 ${n} 項（待確認者有標記）`)}
  foodDraw()},fail));
 F.unsub.push(onSnapshot(query(collection(db,'orders'),where('businessDay','==',F.day)),qs=>{const L=[];qs.forEach(d=>L.push({id:d.id,...d.data()}));L.sort((a,b)=>a.createdAt-b.createdAt);
  const fresh=L.filter(o=>!F.seen.has(o.id)&&o.status=='待做');if(!F.first&&!isKit())fresh.filter(o=>o.fromGuest).forEach(o=>{try{toast(`🛎 ${o.room} 客人點${o.items.some(i=>i.cat=='酒水')?'酒／餐':'餐'}：${o.items.map(i=>i.name+'×'+i.qty).join('、')}`);beep()}catch(e){}});L.forEach(o=>F.seen.add(o.id));
  F.orders=L;if(!F.first&&fresh.length)ding(fresh);F.first=false;foodDraw();try{render()}catch(e){}},fail))}
setInterval(()=>{if(st.user&&F.day&&bizDay(now())!=F.day)foodSub();kitDraw()},30000);
async function seedMenu(){const b=writeBatch(db);MENU_SEED.forEach((m,i)=>{const n=i<5?i+1:i+5;b.set(doc(db,'menu','m'+String(n).padStart(2,'0')),{zh:m[0],vn:m[1],price:m[2],cat:m[3],short:m[4]||'',on:true,ord:n})});await ok(b.commit());log('餐點：載入預設菜單（待確認）')}
// 帳單：本番已點的「加點」餐點
function foodBill(r,x){const L=[];for(const o of F.orders)if(o.room==r&&o.status!='取消'&&o.createdAt>=(x.start||0))for(const it of o.items||[])if((it.cat=='加點'||it.cat=='酒水')&&it.price>0)L.push([`餐點 ${it.name} × ${it.qty}`,it.price*it.qty]);return L}
// ---- 點餐 ----
function openOrder(room){if(lv()<1)return alert('需要少爺以上');if(room!==undefined){F.fo={room,q:{},note:''}}pageOpen('<div id=foodPg></div>');F.pg='order';foodDraw()}
function foQ(id,d){const q=F.fo.q;q[id]=Math.max(0,(q[id]||0)+d);if(!q[id])delete q[id];foodDraw()}
async function foSend(){const fo=F.fo;if(!fo.room)return alert('請先選包廂');const nt=document.getElementById('foNote');fo.note=nt?nt.value.trim():'';
 const items=Object.entries(fo.q).map(([id,qty])=>{const m=F.menu.find(z=>z.id==id);return m&&{id,name:m.zh,vn:m.vn||'',short:m.short||'',qty,price:m.cat!='套餐內含'?+m.price||0:0,cat:m.cat}}).filter(Boolean);
 if(!items.length)return alert('請點選餐點');
 const o={room:fo.room,items,note:fo.note,status:'待做',createdBy:st.user.uid,createdByName:st.prof.name,createdAt:Date.now(),businessDay:bizDay(now())};
 ok(addDoc(collection(db,'orders'),o));log(`點餐 ${fo.room}：${items.map(i=>i.name+'×'+i.qty).join('、')}${fo.note?'（'+fo.note+'）':''}`);if(nt)nt.value='';F.fo={room:fo.room,q:{},note:''};foodDraw();toastF('已送出到廚房')}
function toastF(t){const d=document.createElement('div');d.textContent=t;d.style.cssText='position:fixed;left:50%;top:20%;transform:translateX(-50%);background:#2b8;color:#fff;padding:14px 22px;border-radius:10px;font-size:20px;z-index:9999';document.body.appendChild(d);setTimeout(()=>d.remove(),1400)}
async function foCancel(id){const o=F.orders.find(z=>z.id==id);if(!o||!confirm(`取消 ${o.room} 這張單？`))return;ok(updateDoc(doc(db,'orders',id),{status:'取消',statusAt:Date.now(),statusBy:st.user.uid}));log(`取消點餐 ${o.room}：${o.items.map(i=>i.name+'×'+i.qty).join('、')}`)}
const ago=t=>{const m=Math.floor((Date.now()-t)/60000);return m<1?'剛剛':m+' 分'};
const stC={'待做':'#e44','製作中':'#e90','已出餐':'#2b8','取消':'#777'};
function orderHtml(){const fo=F.fo,rooms=[...new Set([...roomList(),...FOOD_ROOMS])];
 const grp=c=>F.menu.filter(m=>m.on!==false&&m.cat==c).map(m=>{const n=fo.q[m.id]||0;return`<div class=foIt style="display:flex;align-items:center;gap:6px;padding:8px;border-bottom:1px solid #333${n?';background:#234':''}"><div style="flex:1"><b style="font-size:17px">${m.short?`<span style="color:#fc6">[${esc(m.short)}]</span> `:''}${esc(m.zh)}</b>${m.price&&c=='加點'?` <span style="color:#fc6">$${m.price}</span>`:''}<div style="font-size:12px;color:#9ab">${esc(m.vn||'')}</div></div><button type=button style="width:44px;height:44px;font-size:22px" onclick="Food.q('${m.id}',-1)">−</button><b style="min-width:28px;text-align:center;font-size:20px">${n}</b><button type=button style="width:44px;height:44px;font-size:22px" onclick="Food.q('${m.id}',1)">＋</button></div>`}).join('');
 const sum=Object.entries(fo.q).reduce((a,[id,q])=>{const m=F.menu.find(z=>z.id==id);return a+(m&&m.cat!='套餐內含'?(+m.price||0)*q:0)},0);
 const mine=F.orders.filter(o=>o.room==fo.room).slice().reverse();
 return`<h2>🍽 點餐</h2><p>包廂：${rooms.map(r=>`<button type=button class=s style="min-width:56px;height:40px;${r==fo.room?'background:#4af;color:#000':''}" onclick="Food.room('${r}')">${esc(r)}${S.rooms&&S.rooms[r]?'●':''}</button>`).join(' ')}</p>
 ${!F.menu.length?'<p>菜單尚未建立（經理以上開啟後會自動載入預設菜單）</p>':''}
 <h3>套餐內含（$0）</h3>${grp('套餐內含')}<h3>加點（計價，會加進買單）</h3>${grp('加點')}${F.menu.some(m=>m.cat=='酒水'&&m.on!==false)?`<h3>酒水（計價）</h3>${grp('酒水')}`:''}
 <p><label>備註 <input id=foNote value="${esc(fo.note||'')}" placeholder="例：不要辣、先上" style="width:70%"></label></p>
 <p style="position:sticky;bottom:0;background:#111;padding:8px 0"><button type=button style="font-size:20px;padding:12px 28px;background:#2b8;color:#fff" onclick="Food.send()">送出 ${fo.room||'（未選包廂）'}${sum?` ・加點 $${sum}`:''}</button> ${lv()>=3?'<button type=button class=s onclick="Food.menuPg()">⚙ 餐點設定</button>':''} <button type=button class=s onclick="Food.kitchen()">🍳 廚房畫面</button></p>
 ${fo.room?`<h3>${esc(fo.room)} 今日點單</h3>${mine.map(o=>`<div style="padding:6px;border-left:4px solid ${stC[o.status]};margin:4px 0">${new Date(o.createdAt).toLocaleTimeString('zh-TW',{hour12:false,hour:'2-digit',minute:'2-digit'})} <b style="color:${stC[o.status]}">${o.status}</b> ${o.items.map(i=>esc(i.name)+'×'+i.qty).join('、')}${o.note?' 📝'+esc(o.note):''} <small>${esc(o.createdByName||'')}</small> ${o.status=='待做'||lv()>=2&&o.status!='取消'?`<button type=button class=s onclick="Food.cancel('${o.id}')">取消</button>`:''}</div>`).join('')||'<p>尚無</p>'}`:''}`}
// ---- 餐點設定（經理以上）----
function menuHtml(){return`<h2>⚙ 餐點設定</h2><p style="font-size:12px;color:#aaa">「套餐內含」＝免費（$0），「加點」＝計價並加進該包廂買單。品名、越南文、價格、分類都可改（待冠廷確認）。</p>
 <div class=tw><table><tr><th>序</th><th>中文名</th><th>白板簡寫</th><th>越南文</th><th>英文名</th><th>泰文名</th><th>價格</th><th>分類</th><th>啟用</th><th></th></tr>${F.menu.map(m=>`<tr><td><input id=mo_${m.id} value="${m.ord||0}" style="width:40px"></td><td><input id=mz_${m.id} value="${esc(m.zh)}"></td><td><input id=ms_${m.id} value="${esc(m.short||'')}" style="width:40px"></td><td><input id=mv_${m.id} value="${esc(m.vn||'')}"></td><td><input id=mn_${m.id} value="${esc(m.en||'')}"></td><td><input id=mt_${m.id} value="${esc(m.th||'')}">${m.trTodo?'<div style="color:#fc6;font-size:12px">⚠ 待確認</div>':''}</td><td><input id=mp_${m.id} value="${m.price||0}" inputmode=numeric style="width:60px"></td><td><select id=mc_${m.id}>${['套餐內含','加點','酒水'].map(c=>`<option ${c==m.cat?'selected':''}>${c}</option>`).join('')}</select></td><td><input type=checkbox id=me_${m.id} ${m.on!==false?'checked':''}></td><td><button type=button class=s onclick="Food.mSave('${m.id}')">儲存</button> <button type=button class=s onclick="Food.mDel('${m.id}')">刪除</button></td></tr>`).join('')}</table></div>
 <p><button type=button onclick="Food.mAdd()">＋ 新增品項</button> <button type=button class=s onclick="Food.order()">← 回點餐</button></p>`}
function mSave(id){if(lv()<3)return;const g=k=>document.getElementById(k+'_'+id);const d0={zh:g('mz').value.trim(),short:g('ms').value.trim(),vn:g('mv').value.trim(),en:g('mn').value.trim(),th:g('mt').value.trim(),trTodo:(()=>{const m=F.menu.find(z=>z.id==id)||{};return !!m.trTodo&&g('mn').value.trim()==(m.en||'')&&g('mt').value.trim()==(m.th||'')})(),price:Math.max(0,+g('mp').value||0),cat:g('mc').value,on:g('me').checked,ord:+g('mo').value||0};const d=d0;if(!d.zh)return alert('請填中文名');ok(setDoc(doc(db,'menu',id),d));log(`餐點設定：${d.zh} ${d.cat} $${d.price}${d.on?'':'（停用）'}`);toastF('已儲存')}
function mDel(id){const m=F.menu.find(z=>z.id==id);if(lv()<3||!m||!confirm(`刪除 ${m.zh}？`))return;ok(deleteDoc(doc(db,'menu',id)));log(`餐點設定：刪除 ${m.zh}`)}
function mAdd(){if(lv()<3)return;const zh=prompt('中文名');if(!zh)return;const id='m'+Date.now().toString(36);ok(setDoc(doc(db,'menu',id),{zh,vn:'',price:300,cat:'加點',on:true,ord:(F.menu.length?Math.max(...F.menu.map(m=>m.ord||0)):0)+1}));log(`餐點設定：新增 ${zh}`)}
function foodDraw(){const p=document.getElementById('foodPg');if(p){const a=document.activeElement&&document.activeElement.id;const nt=document.getElementById('foNote');if(nt)F.fo.note=nt.value;if(a&&a.startsWith('m')&&a.includes('_')&&F.pg=='menu')return;p.innerHTML=F.pg=='menu'?menuHtml():orderHtml()}kitDraw()}
// ---- 廚房收單 ----
let kitEl=null;
function openKitchen(){if(!kitEl){kitEl=document.createElement('div');kitEl.id='kitchen';kitEl.style.cssText='position:fixed;inset:0;background:#0b0d12;color:#eee;z-index:900;overflow:auto;padding:8px;font-family:system-ui,sans-serif';document.body.appendChild(kitEl)}kitEl.style.display='block';kitDraw()}
function closeKitchen(){if(kitEl)kitEl.style.display='none';if(location.hash=='#kitchen')history.replaceState(null,'',location.pathname+location.search)}
function kitDraw(){if(!kitEl||kitEl.style.display=='none')return;const open=F.orders.filter(o=>o.status=='待做'||o.status=='製作中'),done=F.orders.filter(o=>o.status=='已出餐'&&Date.now()-(o.statusAt||0)<20*60000);
 const rooms=[...FOOD_ROOMS,...[...new Set(F.orders.map(o=>o.room))].filter(r=>!FOOD_ROOMS.includes(r))];
 kitEl.innerHTML=`<div style="display:flex;align-items:center;gap:10px;margin-bottom:6px"><b style="font-size:22px">🍳 廚房收單 Bếp</b><span>待做 ${open.filter(o=>o.status=='待做').length}・製作中 ${open.filter(o=>o.status=='製作中').length}</span><span style="flex:1"></span>${F.sound?'🔔':`<button onclick="Food.snd()" style="font-size:16px">🔔 啟用聲音 Bật âm thanh</button>`} <span id=kclk>${new Date().toLocaleTimeString('zh-TW',{hour12:false,hour:'2-digit',minute:'2-digit'})}</span>${isKit()?' <button onclick="Cloud.logout&&Cloud.logout()" style="font-size:12px">登出</button>':' <button onclick="Food.closeK()">✕ 關閉</button>'}</div>
 <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:8px">${rooms.map(r=>{const os=open.filter(o=>o.room==r),ds=done.filter(o=>o.room==r);return`<div class=kcard data-room="${esc(r)}" style="border:3px solid ${os.some(o=>o.status=='待做')?'#e44':os.length?'#e90':'#333'};border-radius:10px;padding:8px;min-height:150px;background:#151923${os.some(o=>F.flash&&F.flash.has(o.id))?';animation:kfl 1s 4':''}"><div style="font-size:26px;font-weight:bold">${esc(r)}${S.rooms&&S.rooms[r]?' <small style="font-size:13px;color:#2b8">●在番</small>':''}</div>
  ${os.map(o=>`<div onclick="Food.next('${o.id}')" style="cursor:pointer;margin:6px 0;padding:6px;border-radius:8px;background:${o.status=='待做'?'#3a1518':'#3a2a10'}"><div style="display:flex;justify-content:space-between"><b style="color:${stC[o.status]}">${o.status=='待做'?'待做 Chờ':'製作中 Đang làm'}</b><span>${ago(o.createdAt)}</span></div>${o.movedFrom?`<div style="color:#fc6;font-size:13px">🔀 由 ${esc(o.movedFrom)} 換來</div>`:''}${o.items.map(i=>`<div style="font-size:20px">${i.short?`<b style="background:#fc6;color:#000;border-radius:4px;padding:0 5px;margin-right:4px">${esc(i.short)}</b>`:''}${esc(i.name)} <b style="color:#fc6">×${i.qty}</b><div style="font-size:13px;color:#9ab;margin-top:-2px">${esc(i.vn||'')}</div></div>`).join('')}${o.note?`<div style="color:#fc6">📝 ${esc(o.note)}</div>`:''}<div style="font-size:12px;color:#aaa;text-align:right">點一下 → ${o.status=='待做'?'製作中':'已出餐 Xong'}</div></div>`).join('')}
  ${ds.map(o=>`<div style="opacity:.45;font-size:13px">✓ ${o.items.map(i=>esc(i.name)+'×'+i.qty).join('、')}</div>`).join('')}</div>`}).join('')}</div><style>@keyframes kfl{50%{background:#7a1d22}}</style>`}
function kitNext(id){const o=F.orders.find(z=>z.id==id);if(!o)return;const n=o.status=='待做'?'製作中':'已出餐';ok(updateDoc(doc(db,'orders',id),{status:n,statusAt:Date.now(),statusBy:st.user.uid}));o.status=n;o.statusAt=Date.now();kitDraw()}
function ding(fresh){F.flash=new Set(fresh.map(o=>o.id));setTimeout(()=>{F.flash=null;kitDraw()},4500);if(!F.sound||!kitEl||kitEl.style.display=='none')return;try{const a=F.ac||(F.ac=new AudioContext());[0,.25,.5].forEach(t=>{const o=a.createOscillator(),g=a.createGain();o.frequency.value=880;o.connect(g);g.connect(a.destination);g.gain.setValueAtTime(.3,a.currentTime+t);g.gain.exponentialRampToValueAtTime(.001,a.currentTime+t+.2);o.start(a.currentTime+t);o.stop(a.currentTime+t+.22)})}catch(e){}}

// ===== v12.6 客人點檯平板：員工端 =====
const GQ={list:[],seen:new Set(),first:true};
function gqSub(){F.unsub.push(onSnapshot(query(collection(db,'guestReq'),where('businessDay','==',F.day)),qs=>{const L=[];qs.forEach(d=>L.push({id:d.id,...d.data()}));L.sort((a,b)=>a.createdAt-b.createdAt);
 const fresh=L.filter(q=>!GQ.seen.has(q.id)&&q.status=='已送出');L.forEach(q=>GQ.seen.add(q.id));if(!GQ.first&&fresh.length){try{beep()}catch(e){}}GQ.first=false;GQ.list=L;gqDraw()},fail))}
let gqEl=null;
function gqDraw(){if(!gqEl){gqEl=document.createElement('div');gqEl.id='guestQ';gqEl.style.cssText='position:fixed;right:8px;bottom:8px;z-index:940;max-width:min(460px,96vw);display:flex;flex-direction:column;gap:6px';document.body.appendChild(gqEl)}
 const P=GQ.list.filter(q=>q.status=='已送出');if(!P.length){gqEl.innerHTML='';return}const ro=TVMODE||lv()<1;
 gqEl.innerHTML=`<div style="background:#123;border:2px solid #fc3;border-radius:10px;padding:6px 8px;color:#fff;box-shadow:0 2px 10px #000"><b>🛎 包廂客人需求（${P.length}）</b>${P.map(q=>`<div style="border-top:1px solid #345;padding:5px 0;font-size:17px"><b style="color:#fc3">${esc(q.room)}</b> ${q.type=='呼叫'?'<b>呼叫 少爺/公主</b>':`${q.random?'🎲 隨機點檯：':'點小姐：'}<b>${(q.girls||[]).map(id=>{const g=G(id);return esc(id)+(g?' '+esc(String(g.name).replace(/^\s*\d+\s*/,'')):'')}).join('、')}</b>`} <small>${ago(q.createdAt)}</small>${q.note?`<div style="font-size:13px">📝 ${esc(q.note)}</div>`:''}${ro?'':`<div style="margin-top:3px">${q.type=='呼叫'?`<button onclick="Food.gq('${q.id}','已處理')" style="background:#2b8;color:#fff">✓ 知道了，馬上去</button>`:`<button onclick="Food.gq('${q.id}','已確認')" style="background:#2b8;color:#fff">✓ 確認（紅勾${q.random?'・隨機':''}）</button> <button onclick="Food.gq('${q.id}','已拒絕')" class=s>✕ 婉拒</button>`}</div>`}</div>`).join('')}</div>`}
async function gqAct(id,stt){const q=GQ.list.find(z=>z.id==id);if(!q)return;if(lv()<1)return alert('請先登入');
 if(stt=='已確認'){if(lv()<1)return;const x=S.rooms[q.room];if(!x)return alert(`${q.room} 目前沒有開番，請先開番再確認`);const bad=[];
  for(const gid of q.girls||[]){const g=G(gid);if(!g){bad.push(gid);continue}if(g.room&&g.room!=q.room&&!confirm(`${g.id} 目前在 ${g.room}，改到 ${q.room}？`)){bad.push(gid);continue}if(g.room!=q.room)seat(g,q.room,'red');else S.redLog.unshift({t:now(),girl:g.id,room:q.room})}
  log(`🛎 ${q.room} 客人${q.random?'隨機點檯':'點小姐'}確認：${(q.girls||[]).filter(z=>!bad.includes(z)).join('、')||'無'}${bad.length?'（未排：'+bad.join('、')+'）':''}`);save();render()}
 else log(`🛎 ${q.room} ${q.type=='呼叫'?'呼叫 少爺/公主 已處理':(q.random?'客人隨機點檯 婉拒':'客人點小姐 婉拒')}`);
 ok(updateDoc(doc(db,'guestReq',id),{status:stt,handledBy:st.user.uid,handledByName:st.prof.name,handledAt:Date.now()}))}
// 可點小姐清單（給包廂平板，只有編號、名字、照片）
let availLast='';
setInterval(()=>{if(!st.user||lv()<1||TVMODE||st.inited!==true||!S.girls)return;const d=bizDay(now()),X=(S.dayExt||{})[d]||{},early=X.early||{};
 const list=S.girls.filter(g=>g.on&&!g.gone&&!g.room&&!g.leave&&!early[g.id]&&g.status!='下班'&&!(X.others||[]).includes(g.id)&&!(g.priv)).map(g=>({id:g.id,name:String(g.name||'').replace(/^\s*\d+\s*號?\s*/,''),...(g.photo?{photo:g.photo}:{})}));
 const j=JSON.stringify({list,d});if(j==availLast)return;availLast=j;ok(setDoc(doc(db,'public','avail'),{list,day:d,at:Date.now()}))},5000);
async function seedDrinks(L){if(L.some(m=>m.cat=='酒水'))return;const b=writeBatch(db);let n=100;(S.wines||[]).forEach((w,i)=>{if(!w||!w.name)return;b.set(doc(db,'menu','w'+String(i+1).padStart(2,'0')),{zh:w.name,vn:'',price:+w.price||0,cat:'酒水',on:true,ord:n++})});
 [['百威','beerAdd_百威'],['金牌','beerAdd_金牌'],['海尼根','beerAdd_海尼根']].forEach(([k,c],i)=>b.set(doc(db,'menu','b'+(i+1)),{zh:k+'（一手）',vn:'',price:+((S.cfg||{})[c])||0,cat:'酒水',on:true,ord:n++}));await ok(b.commit());log('餐點：由酒單建立「酒水」分類（待確認）')}

window.Food={gq:gqAct,q:foQ,send:foSend,cancel:foCancel,room:r=>{const nt=document.getElementById('foNote');if(nt)nt.value='';F.fo={room:r,q:{},note:''};foodDraw()},order:()=>{F.pg='order';foodDraw()},menuPg:()=>{if(lv()<3)return;F.pg='menu';foodDraw()},mSave,mDel,mAdd,kitchen:openKitchen,closeK:closeKitchen,next:kitNext,snd:()=>{F.sound=true;try{(F.ac||(F.ac=new AudioContext())).resume()}catch(e){}kitDraw()},bill:foodBill,state:F,moveRoom:(from,to,since)=>{F.orders.filter(o=>o.room==from&&o.createdAt>=since-60000&&o.status!='取消').forEach(o=>{o.room=to;ok(updateDoc(doc(db,'orders',o.id),{room:to,movedFrom:from}))});foodDraw()},open:openOrder};
window.openOrder=()=>openOrder();window.openKitchen=openKitchen;
addEventListener('hashchange',()=>{if(location.hash=='#kitchen'&&st.user)openKitchen()});

// ===== v12.3 登入紀錄 =====
function devSum(){const u=navigator.userAgent;const os=/iPhone/.test(u)?'iPhone':/iPad/.test(u)||(/Macintosh/.test(u)&&navigator.maxTouchPoints>1)?'iPad':/Android/.test(u)?'Android':/Windows/.test(u)?'Windows 電腦':/Macintosh/.test(u)?'Mac 電腦':/Linux/.test(u)?'Linux 電腦':'其他裝置';
 const br=/Edg\//.test(u)?'Edge':/Line\//.test(u)?'LINE 內建瀏覽器':/CriOS|Chrome\//.test(u)?'Chrome':/FxiOS|Firefox\//.test(u)?'Firefox':/Safari\//.test(u)?'Safari':'瀏覽器';return os+' '+br+(matchMedia('(display-mode: standalone)').matches||navigator.standalone?'（主畫面 App）':'')}
const tmo=(u,ms)=>Promise.race([fetch(u,{cache:'no-store'}).then(r=>r.ok?r.json():Promise.reject(r.status)),new Promise((_,j)=>setTimeout(()=>j('timeout'),ms))]);
async function ipInfo(){let ip='未知',city='',country='';
 try{const j=await tmo('https://ipapi.co/json/',3500);if(j&&j.ip){ip=j.ip;city=j.city||'';country=j.country_name||''}}catch(e){}
 if(ip=='未知')try{const j=await tmo('https://api.ipify.org?format=json',3500);if(j&&j.ip)ip=j.ip}catch(e){}
 return {ip,city,country}}
async function loginLog(type){try{const u=st.user,p=st.prof;if(!u||!p)return;const k='ll_'+u.uid;if(type=='自動登入'&&sessionStorage.getItem(k))return;sessionStorage.setItem(k,'1');
 const g=await ipInfo();await addDoc(collection(db,'loginLogs'),{uid:u.uid,staffId:p.staffId||'',name:p.name||'',role:p.role,rank:RANK[p.role]||0,at:serverTimestamp(),atMs:Date.now(),ip:g.ip,city:g.city,country:g.country,userAgent:navigator.userAgent.slice(0,300),device:devSum(),type})}catch(e){console.warn('loginLog',e)}}
const LL={rows:[],who:'',d1:'',d2:''};
const tpe=ms=>new Date(ms).toLocaleString('zh-TW',{timeZone:'Asia/Taipei',hour12:false,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit'});
const tpeDay=ms=>new Date(ms).toLocaleDateString('sv-SE',{timeZone:'Asia/Taipei'});
async function openLoginLogs(){if(lv()<4)return alert('只有老闆以上可以看登入紀錄');
 pageOpen('<h2>🔐 登入紀錄</h2><div id=llPg>載入中…</div>');
 try{const q=lv()>=5?query(collection(db,'loginLogs'),orderBy('atMs','desc'),limit(1000)):query(collection(db,'loginLogs'),where('rank','<',4),limit(3000));
  const qs=await getDocs(q);LL.rows=[];qs.forEach(d=>LL.rows.push({id:d.id,...d.data()}));LL.rows.sort((a,b)=>b.atMs-a.atMs);llDraw()}
 catch(e){const el=document.getElementById('llPg');if(el)el.innerHTML='讀取失敗：'+(e.code=='permission-denied'?'權限不足（規則可能尚未發布）':e.code||e.message)}}
function llDraw(){const el=document.getElementById('llPg');if(!el)return;const ppl=[...new Map(LL.rows.map(r=>[r.uid,r.name+'（'+r.staffId+'）'])).entries()];
 const R=LL.rows.filter(r=>(!LL.who||r.uid==LL.who)&&(!LL.d1||tpeDay(r.atMs)>=LL.d1)&&(!LL.d2||tpeDay(r.atMs)<=LL.d2));
 el.innerHTML=`<p>人員 <select onchange="Cloud.llF('who',this.value)"><option value="">全部</option>${ppl.map(([u,n])=>`<option value="${u}" ${u==LL.who?'selected':''}>${esc(n)}</option>`).join('')}</select>
 日期 <input type=date value="${LL.d1}" onchange="Cloud.llF('d1',this.value)"> ～ <input type=date value="${LL.d2}" onchange="Cloud.llF('d2',this.value)"> <span style="color:#aaa">共 ${R.length} 筆（台北時間）</span></p>
 <div class=tw><table><tr><th>時間</th><th>人員</th><th>角色</th><th>方式</th><th>裝置</th><th>IP</th><th>地點</th>${lv()>=5?'<th></th>':''}</tr>${R.map(r=>`<tr><td>${tpe(r.atMs)}</td><td>${esc(r.name)}<br><small>${esc(r.staffId)}</small></td><td>${esc(RL(r.role))}</td><td>${esc(r.type)}</td><td title="${esc(r.userAgent||'')}">${esc(r.device||'')}</td><td>${esc(r.ip||'未知')}</td><td>${esc([r.city,r.country].filter(Boolean).join('，'))||'—'}</td>${lv()>=5?`<td><button type=button class=s onclick="Cloud.llDel('${r.id}')">刪除</button></td>`:''}</tr>`).join('')}</table></div>
 <p style="font-size:12px;color:#aaa">冠廷可看全部；老闆只看得到老闆以下的人。IP／地點由免費服務查詢，僅供參考（手機網路的地點常不準）。</p>`}
function llF(k,v){LL[k]=v;llDraw()}
async function llDel(id){if(lv()<5||!confirm('刪除這筆登入紀錄？'))return;try{await deleteDoc(doc(db,'loginLogs',id));LL.rows=LL.rows.filter(r=>r.id!=id);llDraw()}catch(e){alert('刪除失敗：'+e.code)}}
window.openLoginLogs=openLoginLogs;

window.openHelp=()=>pageOpen(HELP);
window.openLogin=()=>st.user?openAccount():loginUI();

// ---- v12.12 伺服器時間＋換日鎖（Spark 無排程，由任一職員裝置觸發）----
st.timeOffset=0;st.pongAt=0;
async function syncServerTime(){
 const id=S.openDay||((typeof bizDay==='function')?bizDay(Date.now()):null);if(!id)return;
 try{
  if(lv()>=1&&!TVMODE){
   const ref=doc(db,'days',id);
   await setDoc(ref,{_pong:serverTimestamp()},{merge:true});
   const snap=await getDoc(ref);const ts=snap.exists()&&snap.data()._pong;
   if(ts&&ts.toMillis){st.timeOffset=ts.toMillis()-Date.now();st.pongAt=Date.now()}
  }else{
   const snap=await getDoc(doc(db,'days',id));const ts=snap.exists()&&snap.data()._pong;
   if(ts&&ts.toMillis){st.timeOffset=ts.toMillis()-Date.now();st.pongAt=Date.now()}
  }
 }catch(e){console.warn('syncServerTime',e)}
}
function serverNow(){if(!st.pongAt||Date.now()-st.pongAt>15*60000)syncServerTime();return Date.now()+(st.timeOffset||0)}
function parseRoll(v){if(!v)return null;if(typeof v==='object')return v;try{return JSON.parse(v)}catch(e){return null}}
async function tryDayRoll(from,to){
 if(!st.user||TVMODE||lv()<1||st.inited!==true)return{ok:false,reason:'no-write'};
 if(!from||!to||from==to)return{ok:false,reason:'same'};
 const ref=doc(db,'days',to);
 try{
  const won=await runTransaction(db,async tx=>{
   const snap=await tx.get(ref);
   const cur=parseRoll(snap.exists()?snap.data().dayRoll:null);
   const age=cur&&cur.at?Date.now()-cur.at:9e99;
   if(cur&&cur.status==='done'&&cur.from===from)return false;
   if(cur&&cur.status==='done')return false;
   if(cur&&cur.status==='pending'&&age<120000&&cur.uid!==st.user.uid)return false;
   tx.set(ref,{dayRoll:J({status:'pending',from,to,at:Date.now(),by:(st.prof&&st.prof.name)||'',uid:st.user.uid})},{merge:true});
   return true
  });
  return{ok:true,won:!!won}
 }catch(e){console.warn('tryDayRoll',e);return{ok:false,reason:e.code||String(e)}}
}
async function markDayRollDone(from,to){
 if(lv()<1||TVMODE)return;
 const rec=J({status:'done',from,to,at:Date.now(),by:(st.prof&&st.prof.name)||'',uid:st.user.uid});
 try{await setDoc(doc(db,'days',to),{dayRoll:rec},{merge:true});st.last.day.dayRoll=rec}catch(e){console.warn(e)}
}
async function followDayRoll(from,to){
 try{const snap=await getDoc(doc(db,'days',to));const cur=parseRoll(snap.exists()?snap.data().dayRoll:null);return!!(cur&&cur.status==='done'&&(!from||cur.from===from||cur.to===to))}catch(e){return false}
}
function followDay(id){if(!id)return;if(st.dayId!=id)subDay(id)}
async function flushTo(id){
 if(!st.user||TVMODE||lv()<1||st.inited!==true)throw new Error('cannot-flush');
 if(id!=st.dayId)subDay(id);
 const dch={};for(const k of Object.keys(S))if(isDayKey(k))dch[k]=J(S[k]);
 if(S.carryover)dch.carryover=J(S.carryover);
 Object.assign(st.last.day,dch);
 st.pending++;status();
 try{await setDoc(doc(db,'days',id),dch,{merge:true})}finally{st.pending=Math.max(0,st.pending-1);status()}
 if(S.hist){for(const [d,v] of Object.entries(S.hist)){const j=J(v);if(st.last.hist[d]===j)continue;if(lv()<2&&st.last.hist[d]!==undefined)continue;st.last.hist[d]=j;try{await setDoc(doc(db,'hist',d),{json:j,by:st.user.uid,at:Date.now()})}catch(e){console.warn(e)}}}
}

window.Cloud={ver:"v12.13",llF,llDel,openLoginLogs,logout:()=>signOut(auth),togglePw,copyPw,resetPw,push,audit,openAccount,openStaff,createStaff,createRoomTabs,setRole,setDisabled,migrate,changePw,status:()=>({...st,last:undefined}),auth,db,lv,serverNow,syncServerTime,tryDayRoll,markDayRollDone,followDayRoll,followDay,flushTo};
status();
