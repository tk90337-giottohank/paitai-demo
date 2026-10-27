// v12 雲端同步層：Firebase Auth（員工編號＋密碼）＋ Firestore 即時同步
import {firebaseConfig} from './firebase-config.js';
import {initializeApp,deleteApp} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js';
import {getAuth,connectAuthEmulator,signInWithEmailAndPassword,createUserWithEmailAndPassword,signOut,onAuthStateChanged,updatePassword,browserLocalPersistence,setPersistence} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
import {initializeFirestore,persistentLocalCache,persistentMultipleTabManager,connectFirestoreEmulator,doc,collection,onSnapshot,setDoc,deleteDoc,getDoc,writeBatch,addDoc,query,orderBy,limit,updateDoc,onSnapshotsInSync} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
const EMU=/[?&]emu=1/.test(location.search);
const app=initializeApp(firebaseConfig),auth=getAuth(app);
const db=initializeFirestore(app,{localCache:persistentLocalCache({tabManager:persistentMultipleTabManager()})});
if(EMU){connectAuthEmulator(auth,'http://127.0.0.1:9099',{disableWarnings:true});connectFirestoreEmulator(db,'127.0.0.1',8080)}
const DOMAIN='paitai-system.local',mail=id=>String(id).trim().toLowerCase()+'@'+DOMAIN;
const RANK={'小姐':1,'少爺':1,'幹部':2,'經理':3,'老闆':4,'tv':0};
const LOCAL=new Set(['cur','op','users','usersExample','impSnap','wsSeq']);
const SETTINGS=['cfg','wines','catalog','cb','attVer','cutVer','cleanVer','imp1026','beerVer'];
const isDayKey=k=>!LOCAL.has(k)&&!SETTINGS.includes(k)&&!['hist','wineStore','wsLog'].includes(k);
const J=v=>JSON.stringify(v===undefined?null:v);
const st={user:null,prof:null,inited:null,dayId:null,unsub:[],dayUnsub:null,last:{set:{},day:{},hist:{},wine:{},wlog:new Set()},timer:null,pending:0,err:'',online:navigator.onLine};
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
function startSync(){stopSync();
 st.unsub.push(onSnapshot(doc(db,'config','settings'),snap=>{if(snap.metadata.hasPendingWrites)return;st.inited=snap.exists();
  if(snap.exists()&&applyFields(snap.data(),st.last.set,SETTINGS))rerender();status();if(!st.inited&&lv()>=4)banner()},fail));
 subDay(S.openDay||bizDay(now()));
 if(lv()>=2){
  st.unsub.push(onSnapshot(collection(db,'hist'),qs=>{if(qs.metadata.hasPendingWrites)return;const h={};qs.forEach(d=>{h[d.id]=JSON.parse(d.data().json);st.last.hist[d.id]=d.data().json});S.hist=Object.assign(S.hist||{},h);for(const k of Object.keys(S.hist))if(!h[k]&&st.last.hist[k]){delete S.hist[k];delete st.last.hist[k]}rerender()},fail));
  st.unsub.push(onSnapshot(collection(db,'wine'),qs=>{if(qs.metadata.hasPendingWrites)return;const L=[];qs.forEach(d=>{L.push(JSON.parse(d.data().json));st.last.wine[d.id]=d.data().json});L.sort((a,b)=>a.id-b.id);S.wineStore=L;rerender()},fail));
  st.unsub.push(onSnapshot(query(collection(db,'wineLog'),orderBy('t','desc'),limit(200)),qs=>{if(qs.metadata.hasPendingWrites)return;const L=[];qs.forEach(d=>{st.last.wlog.add(d.id);L.push(JSON.parse(d.data().json))});S.wsLog=L;rerender()},fail))}
 status()}
function stopSync(){st.unsub.forEach(u=>u());st.unsub=[];if(st.dayUnsub)st.dayUnsub();st.dayUnsub=null}
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
  for(const e of S.wsLog||[]){const k=`${e.t}-${e.id}-${(e.act||'').length}`;if(st.last.wlog.has(k))continue;st.last.wlog.add(k);ok(setDoc(doc(db,'wineLog',k),{uid:st.user.uid,t:e.t,json:J(e)}))}}
 status()}
function audit(m){if(!st.user||TVMODE||lv()<1||st.inited!==true)return;addDoc(collection(db,'audit'),{uid:st.user.uid,name:st.prof.name,role:st.prof.role,t:Date.now(),msg:String(m).slice(0,500)}).catch(()=>{})}
// ---- 登入畫面 ----
const ov=document.createElement('div');ov.id='fbLogin';ov.style.cssText='position:fixed;inset:0;z-index:9999;background:#14161c;color:#eee;display:none;overflow:auto;padding:24px;font-size:17px';document.body.appendChild(ov);
function loginUI(msg){ov.style.display='block';ov.innerHTML=`<div style="max-width:380px;margin:6vh auto"><h2>🔐 排檯系統登入</h2>${msg?`<p style="color:#f88">${msg}</p>`:''}
 <label>員工編號<br><input id=fbId autocomplete=username autocapitalize=none style="width:100%;font-size:20px;padding:8px"></label><br><br>
 <label>密碼<br><input id=fbPw type=password autocomplete=current-password style="width:100%;font-size:20px;padding:8px"></label><br><br>
 <button id=fbGo style="width:100%;font-size:20px;padding:12px">登入</button>
 <p style="font-size:14px"><a href="#" id=fbBoot style="color:#9cf">首次啟用：建立老闆帳號</a>・<a href="#" id=fbHelp style="color:#9cf">登入教學</a>${EMU?'・<b style="color:#e90">模擬器</b>':''}</p></div>`;
 const go=async()=>{const id=fbId.value,pw=fbPw.value;if(!id||!pw)return;fbGo.disabled=true;fbGo.textContent='登入中…';try{await signInWithEmailAndPassword(auth,mail(id),pw)}catch(e){loginUI(e.code=='auth/network-request-failed'?'網路連不上，請稍後再試':'員工編號或密碼錯誤')}};
 fbGo.onclick=go;fbPw.onkeydown=e=>{if(e.key=='Enter')go()};fbHelp.onclick=e=>{e.preventDefault();helpOverlay()};fbBoot.onclick=e=>{e.preventDefault();bootUI()}}
function bootUI(msg){ov.innerHTML=`<div style="max-width:380px;margin:6vh auto"><h2>首次啟用：建立老闆帳號</h2><p style="font-size:14px">只能做一次。之後所有帳號都由老闆在系統內建立。</p>${msg?`<p style="color:#f88">${msg}</p>`:''}
 <label>老闆員工編號（英數）<br><input id=bId autocapitalize=none value="boss" style="width:100%;font-size:20px;padding:8px"></label><br><br><label>名字<br><input id=bNm value="老闆" style="width:100%;font-size:20px;padding:8px"></label><br><br>
 <label>密碼（至少 6 碼）<br><input id=bPw type=password autocomplete=new-password style="width:100%;font-size:20px;padding:8px"></label><br><br><button id=bGo style="width:100%;font-size:20px;padding:12px">建立並登入</button> <p><a href="#" id=bBack style="color:#9cf">← 返回登入</a></p></div>`;
 bBack.onclick=e=>{e.preventDefault();loginUI()};
 bGo.onclick=async()=>{const id=bId.value.trim(),pw=bPw.value;if(!/^[A-Za-z0-9._-]+$/.test(id))return bootUI('員工編號只能用英文、數字');if(pw.length<6)return bootUI('密碼至少 6 碼');bGo.disabled=true;
  let cred;try{cred=await createUserWithEmailAndPassword(auth,mail(id),pw)}catch(e){return bootUI(e.code=='auth/email-already-in-use'?'這個編號已存在，請直接登入':'建立失敗：'+e.code)}
  try{const b=writeBatch(db);b.set(doc(db,'users',cred.user.uid),{staffId:id.toLowerCase(),name:bNm.value.trim()||'老闆',role:'老闆',disabled:false,createdAt:Date.now()});b.set(doc(db,'config','boot'),{uid:cred.user.uid,at:Date.now()});await b.commit()}
  catch(e){try{await cred.user.delete()}catch(_){}await signOut(auth).catch(()=>{});return bootUI('系統已經啟用過，不能再建立老闆。請用老闆給你的帳號登入。')}}}
onAuthStateChanged(auth,async u=>{stopSync();st.user=u;st.prof=null;st.inited=null;
 if(!u){S.cur=null;status();loginUI();return}
 let p;try{const s=await getDoc(doc(db,'users',u.uid));p=s.exists()?s.data():null}catch(e){p=null}
 if(!p||p.disabled){await signOut(auth);loginUI(p&&p.disabled?'此帳號已停用，請找老闆':'此帳號沒有權限資料，請找老闆');return}
 st.prof=p;S.cur={name:p.name,role:p.role,uid:u.uid,staffId:p.staffId};S.op=p.name;const op=document.getElementById('op');if(op)op.value=p.name;
 ov.style.display='none';startSync();rerender();log(`登入：${p.name}（${p.role}）`)});
setPersistence(auth,browserLocalPersistence).catch(()=>{});
// ---- 帳號選單 / 人員管理 ----
function openAccount(){const f=document.getElementById('dform'),p=st.prof||{};
 f.innerHTML=`<h3>👤 ${esc(p.name||'')}（${esc(p.role||'')}）</h3><p style="font-size:13px">員工編號：${esc(p.staffId||'')}</p>
 <button type=button onclick="Cloud.changePw()">改密碼</button> ${lv()>=3?'<button type=button onclick="Cloud.openStaff()">人員帳號管理</button> ':''}${lv()>=4?'<button type=button class=s onclick="Cloud.migrate()">上傳本機資料到雲端（一次性）</button> ':''}<button type=button class=s onclick="openHelp()">登入教學</button>
 <p><button value=out>登出／切換人員</button> <button class=s value="">關閉</button></p>`;
 const d=document.getElementById('dlg');d.returnValue='';d.onclose=()=>{if(d.returnValue=='out'){log(`登出：${p.name}`);signOut(auth)}};if(d.open)d.close();d.showModal()}
async function changePw(){const pw=prompt('新密碼（至少 6 碼）');if(!pw)return;if(pw.length<6)return alert('至少 6 碼');try{await updatePassword(auth.currentUser,pw);alert('已更新密碼')}catch(e){alert(e.code=='auth/requires-recent-login'?'為了安全，請先登出再登入一次後再改密碼':'失敗：'+e.code)}}
let usersUnsub=null,USERS=[];
function openStaff(){if(lv()<3)return alert('需經理以上');document.getElementById('dlg').close();
 if(!usersUnsub)usersUnsub=onSnapshot(collection(db,'users'),qs=>{USERS=[];qs.forEach(d=>USERS.push({uid:d.id,...d.data()}));USERS.sort((a,b)=>(RANK[b.role]||0)-(RANK[a.role]||0)||a.staffId.localeCompare(b.staffId));const t=document.getElementById('stTbl');if(t)t.outerHTML=staffTbl()},fail);drawStaff()}
function staffTbl(){const roles=['小姐','少爺','幹部','經理','老闆','tv'].filter(r=>(RANK[r]||0)<=lv());return`<table class=sch id=stTbl><tr><th>編號</th><th>名字</th><th>角色</th><th>狀態</th><th></th></tr>${USERS.map(u=>{const mine=u.uid==st.user.uid,can=!mine&&(RANK[u.role]||0)<=lv();
  return`<tr><td>${esc(u.staffId)}</td><td>${esc(u.name)}</td><td>${can?`<select onchange="Cloud.setRole('${u.uid}',this.value)">${roles.map(r=>`<option ${r==u.role?'selected':''}>${r}</option>`).join('')}</select>`:esc(u.role)+(mine?'（自己）':'')}</td><td>${u.disabled?'<b style="color:#e44">停用</b>':'啟用'}</td><td>${can?`<button type=button class=s onclick="Cloud.setDisabled('${u.uid}',${!u.disabled})">${u.disabled?'啟用':'停用'}</button>`:''}</td></tr>`}).join('')}</table>`}
function drawStaff(){const roles=['小姐','少爺','幹部','經理','老闆','tv'].filter(r=>(RANK[r]||0)<=lv());
 pageOpen(`<h2>人員帳號管理</h2>${lv()>=4?`<details open><summary>新增帳號（老闆）</summary><label>員工編號（英數）<input id=nId autocapitalize=none></label> <label>名字<input id=nNm></label> <label>角色 <select id=nRole>${roles.map(r=>`<option ${r=='少爺'?'selected':''}>${r}</option>`).join('')}</select></label> <label>初始密碼（≥6）<input id=nPw></label> <button type=button onclick="Cloud.createStaff()">建立</button><p style="font-size:12px;color:#aaa">TV 看板請建立角色「tv」的帳號（只能看不能改）。</p></details>`:''}
 <div class=tw>${staffTbl()}</div>
 <p style="font-size:12px;color:#aaa">忘記密碼：先停用舊帳號，再建立新編號（網頁端無法替別人重設密碼）。</p>`)}
async function createStaff(){const id=nId.value.trim(),nm=nNm.value.trim()||id,role=nRole.value,pw=nPw.value;if(!/^[A-Za-z0-9._-]+$/.test(id))return alert('員工編號只能用英文、數字');if(pw.length<6)return alert('密碼至少 6 碼');
 const sec=initializeApp(firebaseConfig,'sec'+Date.now()),sa=getAuth(sec);if(EMU)connectAuthEmulator(sa,'http://127.0.0.1:9099',{disableWarnings:true});
 try{const c=await createUserWithEmailAndPassword(sa,mail(id),pw);await setDoc(doc(db,'users',c.user.uid),{staffId:id.toLowerCase(),name:nm,role,disabled:false,createdAt:Date.now(),by:st.user.uid});await signOut(sa);log(`建立帳號 ${id}（${nm}・${role}）`);alert(`已建立：${id}（${role}）`)}
 catch(e){alert(e.code=='auth/email-already-in-use'?'此編號已被使用':'建立失敗：'+(e.code||e.message))}finally{deleteApp(sec).catch(()=>{})}}
async function setRole(uid,role){const u=USERS.find(x=>x.uid==uid);await ok(updateDoc(doc(db,'users',uid),{role}));log(`變更角色 ${u&&u.staffId} → ${role}`)}
async function setDisabled(uid,v){const u=USERS.find(x=>x.uid==uid);if(!confirm(`${v?'停用':'啟用'} ${u&&u.name}？`))return;await ok(updateDoc(doc(db,'users',uid),{disabled:v}));log(`${v?'停用':'啟用'}帳號 ${u&&u.staffId}`)}
// ---- 一次性上傳本機資料 ----
function banner(){if(document.getElementById('fbBan'))return;const b=document.createElement('div');b.id='fbBan';b.style.cssText='position:fixed;left:0;right:0;bottom:0;z-index:9000;background:#e90;color:#000;padding:10px;font-size:16px;text-align:center';b.innerHTML='雲端還沒有資料。<button onclick="Cloud.migrate()">把這台裝置的資料上傳到雲端</button>';document.body.appendChild(b)}
async function migrate(){if(lv()<4)return alert('只有老闆可以上傳');if(!confirm('把「這台裝置」的資料上傳到雲端？\n（名冊、設定、訊息卡、當日營業、歷史、寄酒）\n雲端已有的同名資料會被覆蓋。'))return;
 const ops=[];const dd={};for(const k of Object.keys(S))if(isDayKey(k))dd[k]=J(S[k]);const ss={};for(const k of SETTINGS)ss[k]=J(S[k]);
 const id=S.openDay||bizDay(now());ops.push(['set','days/'+id,dd]);for(const [d,v] of Object.entries(S.hist||{}))ops.push(['set','hist/'+d,{json:J(v),by:st.user.uid,at:Date.now()}]);
 for(const w of S.wineStore||[])ops.push(['set','wine/'+w.id,{json:J(w)}]);for(const e of S.wsLog||[]){const k=`${e.t}-${e.id}-${(e.act||'').length}`;ops.push(['set','wineLog/'+k,{uid:st.user.uid,t:e.t,json:J(e)}])}
 ops.push(['set','config/settings',ss]);
 try{for(let i=0;i<ops.length;i+=400){const b=writeBatch(db);ops.slice(i,i+400).forEach(([,p,v])=>b.set(doc(db,...p.split('/')),v));await b.commit()}
  Object.assign(st.last.day,dd);Object.assign(st.last.set,ss);log(`上傳本機資料到雲端（${ops.length} 筆）`);document.getElementById('fbBan')?.remove();alert('上傳完成（'+ops.length+' 份文件）');startSync()}catch(e){alert('上傳失敗：'+(e.code||e.message))}}
// ---- 登入教學 ----
const HELP=`<h2>📖 登入教學</h2>
<h3>1. 每個人用「員工編號＋密碼」登入</h3><p>老闆會給你一組員工編號（例如 <b>sy01</b>）和初始密碼。打開排檯網址，輸入編號和密碼，按「登入」。不需要電子郵件。登入後會一直保持登入，直到按「登出」。</p>
<p>第一次登入後，點右上角 👤 →「改密碼」換成自己的密碼（至少 6 碼，可以用 6 位數字當 PIN）。</p>
<h3>2. 共用的手機或電腦（換人）</h3><p>點 👤 →「登出／切換人員」，再用自己的編號登入。每個操作都會記錄是誰做的，所以請不要用別人的帳號。</p>
<h3>3. 老闆：建立和停用帳號</h3><p>第一次使用：在登入畫面點「首次啟用：建立老闆帳號」（只能做一次）。之後點 👤 →「人員帳號管理」→ 填 員工編號、名字、角色、初始密碼 →「建立」。離職或手機遺失：按「停用」，那個帳號馬上不能看也不能改。忘記密碼：停用舊帳號，再建一個新編號。</p>
<p>角色：小姐／少爺（排檯操作）＜ 幹部（手動匯入、寄酒、歷史紀錄）＜ 經理（設定、看金額、改角色）＜ 老闆（建立帳號）。</p>
<h3>4. TV 看板帳號</h3><p>老闆建立一個角色選「tv」的帳號（例如 <b>tv1</b>）。在電視的瀏覽器打開「排檯網址 + <b>#tv</b>」，用 tv 帳號登入一次就好。TV 帳號只能看，不能改任何資料，畫面會即時更新。</p>
<h3>5. iPhone 加入主畫面</h3><p>用 <b>Safari</b> 打開排檯網址 → 點下方「分享」⬆️ →「加入主畫面」→「新增」。之後從主畫面的圖示打開，就像 App 一樣。登入一次後會記住。</p>
<h3>6. 右上角的同步燈號</h3><p>✓ 已同步＝所有裝置都看到一樣的資料；⟳ 同步中＝正在上傳；📴 離線＝網路斷了，資料先存在這台，恢復網路後會自動上傳；⚠＝權限不足或錯誤。</p>`;
function helpOverlay(){ov.innerHTML=`<div style="max-width:560px;margin:3vh auto">${HELP}<p><button id=hBack style="font-size:18px;padding:10px">← 返回登入</button></p></div>`;hBack.onclick=()=>loginUI()}
window.openHelp=()=>pageOpen(HELP);
window.openLogin=()=>st.user?openAccount():loginUI();
window.Cloud={push,audit,openAccount,openStaff,createStaff,setRole,setDisabled,migrate,changePw,status:()=>({...st,last:undefined}),auth,db,lv};
status();
