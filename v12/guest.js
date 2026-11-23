// v12.28 快取版本號。v12.27.1 快取版本號。v12.27 沿用獨立登入；Google 解鎖仍走 popup。v12.26 包廂頁獨立登入（具名 Firebase app room）；v12.25 鎖頭面板：包廂密碼登出＋員工解鎖（含 Google）；職級含店長
// v12.21.2 可點規則：滿 bookedMax／他房私檯／暫停才灰；隨機只抽亮燈
import {firebaseConfig} from './firebase-config.js';
import {initializeApp,deleteApp} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js';
import {bootNamedApp} from './auth-scope.js?v=12.29';
import {getAuth,connectAuthEmulator,signInWithEmailAndPassword,signOut,onAuthStateChanged,setPersistence,browserLocalPersistence,EmailAuthProvider,reauthenticateWithCredential,GoogleAuthProvider,signInWithPopup} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
import {initializeFirestore,persistentLocalCache,connectFirestoreEmulator,doc,getDoc,setDoc,updateDoc,collection,onSnapshot,addDoc,query,where} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
const EMU=/[?&]emu=1/.test(location.search);
const {app,auth}=bootNamedApp('room');
const db=initializeFirestore(app,{localCache:persistentLocalCache()});
if(EMU){try{connectFirestoreEmulator(db,'127.0.0.1',8080)}catch(e){}}
const mail=id=>String(id).trim().toLowerCase()+'@paitai-system.local';
const RANK={'小姐':1,'少爺':1,'幹部':2,'經理':3,'店長':4,'老闆':5,'特殊':6};
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const $=id=>document.getElementById(id);
const TOKEN=new URLSearchParams(location.search).get('t')||'';
const G={user:null,prof:null,room:'',menu:[],avail:[],day:'',reqs:[],orders:[],view:'home',sel:new Set(),q:{},tab:'加點',randN:1,randResult:null,unsub:[],token:TOKEN,tokenMode:!!TOKEN,tok:null,renewSeen:0};
const IDLE=90000;let idleT=null;
function idle(){clearTimeout(idleT);idleT=setTimeout(()=>{if(G.view!='home'){G.view='home';G.sel.clear();G.q={};G.randResult=null;draw()}},IDLE)}
['pointerdown','keydown'].forEach(e=>addEventListener(e,idle,{passive:true}));
function flash(t){const m=$('msg');m.innerHTML=t;m.style.display='block';setTimeout(()=>m.style.display='none',2200)}
const day=()=>G.day||new Date(Date.now()-7.17*36e5).toLocaleDateString('sv-SE');
// ---- 設定（綁定包廂）：用房間平板帳號登入 ----
function roleLabel(p){const r=(p&&p.role)||'';if(r==='特殊')return'冠廷';if(r==='小姐')return'小姐';if(r==='kitchen')return'廚房';if(r==='tv')return'TV 看板';return r||'員工'}
function staffOnGuestUI(p){
  const o=$('ov');o.style.display='flex';
  const disabled=p&&p.disabled;
  const noRoom=p&&p.role==='room'&&!p.room;
  const title=disabled?'此帳號已停用':(noRoom?'此房間平板未綁定包廂':'這不是房間平板帳號');
  const titleVi=disabled?'Tài khoản đã bị khóa':(noRoom?'Máy tính bảng phòng chưa gắn phòng':'Đây không phải tài khoản máy tính bảng phòng');
  const who=p?esc((p.name||p.staffId||'')+(p.role&&p.role!=='room'?'（'+roleLabel(p)+'）':'')):'';
  o.innerHTML=`<div class=box><h2>${esc(title)}<span class="vi">${esc(titleVi)}</span></h2>
    ${who?`<p>目前帳號：<b>${who}</b></p>`:''}
    <p class=lock-hint>包廂客人頁只能用「房間平板」帳號。員工請到排檯主程式或小姐報班頁登入。三個頁面的登入已分開，這裡不會自動跳轉。<span class="vi">Trang khách phòng chỉ dùng tài khoản máy tính bảng phòng. Nhân viên hãy đăng nhập ở hệ thống chính hoặc trang điểm danh.</span></p>
    <p class="staff-link"><a href="index.html">開啟排檯主程式<span class="vi">Mở hệ thống xếp bàn chính</span></a></p>
    <p class="staff-link"><a href="girl/">開啟小姐報班頁<span class="vi">Mở trang điểm danh tiếp viên</span></a></p>
    <button id=sgOut type=button class=lock-x>登出此頁帳號<span class="vi">Đăng xuất tài khoản trang này</span></button>
    <button id=sgBack type=button class=lock-pri>改用房間平板登入<span class="vi">Đăng nhập bằng tài khoản phòng</span></button>
  </div>`;
  $('sgOut').onclick=async()=>{if(!confirm('確定登出此頁帳號？主程式或報班頁的登入不會一起被登出。'))return;await signOut(auth);setupUI()};
  $('sgBack').onclick=async()=>{await signOut(auth).catch(()=>{});setupUI()};
}
function staffAppLink(){return `<p class="staff-link"><a href="index.html">員工請到排檯主程式登入<span class="vi">Nhân viên đăng nhập hệ thống chính</span></a></p><p class="staff-link"><a href="girl/">小姐報班頁<span class="vi">Trang điểm danh tiếp viên</span></a></p>`}
function setupUI(err){const o=$('ov');o.style.display='flex';o.innerHTML=`<div class=box><h2>包廂平板設定<span class="vi">Cài đặt máy tính bảng phòng</span></h2><p style="color:#aab">請幹部用「房間平板」帳號登入（老闆在人員帳號管理建立，角色選「房間平板」並綁定包廂）。<span class="vi">Cán bộ đăng nhập tài khoản máy tính bảng phòng.</span></p>${err?`<p style="color:#f66">${esc(err)}</p>`:''}
 <input id=sId placeholder="平板帳號（例 room208）" autocapitalize=none autocomplete=username><input id=sPw type=password placeholder="密碼" autocomplete=current-password><button id=sGo style="background:#2fb47a;color:#fff;min-height:44px">登入並綁定<span class="vi">Đăng nhập và gắn phòng</span></button>${staffAppLink()}</div>`;
 $('sGo').onclick=async()=>{try{$('sGo').disabled=true;await signInWithEmailAndPassword(auth,mail($('sId').value),$('sPw').value)}catch(e){setupUI('登入失敗：'+(e.code||''))}}}
if(TOKEN){G.prof=G.prof||{name:'客人',role:'guest'};draw();startTokenMode()}
else onAuthStateChanged(auth,async u=>{G.unsub.forEach(f=>f());G.unsub=[];G.user=u;if(!u)return setupUI();
 let p=null;try{const s=await getDoc(doc(db,'users',u.uid));p=s.exists()?s.data():null}catch(e){}
 if(!p||p.disabled||p.role!='room'||!p.room){return staffOnGuestUI(p)}
 G.prof=p;G.room=p.room;$('ov').style.display='none';$('rm').textContent=p.room+' 包廂';subs();draw()});
function startTokenMode(){
  const f=e=>console.warn(e);
  G.unsub.push(onSnapshot(doc(db,'guestTokens',TOKEN),s=>{
    if(!s.exists())return showDead('這個 QR 無效或已過期。請請少爺／公主重新產生。');
    const t=s.data();G.tok=t;
    if(!t.valid||Date.now()>=(t.expiresAtMs||0))return showDead('此 QR 已失效（逾時或本房已買單）。請請少爺／公主重新產生。');
    G.room=t.room; if(t.day)G.day=t.day;
    G.prof=G.prof||{name:'客人',role:'guest',room:t.room};
    const rm=$('rm'); if(rm)rm.textContent=t.room+' 包廂';
    const ov=$('ov'); if(ov)ov.style.display='none';
    maybeRenewPrompt(t);
    if(!G._tokSub){G._tokSub=true;subTokenViews();subDay()}
    draw(true);
  },e=>showDead('無法讀取 QR，請檢查網路後再試。')));
}
function showDead(msg){const m=$('main');if(m)m.innerHTML=`<div id=dead><h2>無法使用點檯</h2><p class=hint>${esc(msg)}</p></div>`;const ov=$('ov');if(ov)ov.style.display='none'}
function subTokenViews(){const f=e=>console.warn(e);
 G.unsub.push(onSnapshot(doc(db,'guestTokens',TOKEN,'view','avail'),s=>{const d=s.exists()?s.data():{};if((d.list||[]).length||!G.avail.length){G.avail=d.list||[]}if(d.day&&d.day!=G.day){G.day=d.day;subDay()}draw(true)},f));
 G.unsub.push(onSnapshot(doc(db,'guestTokens',TOKEN,'view','menu'),s=>{const L=s.exists()?(s.data().list||[]):[];if(L.length){G.menu=L;draw(true)}},f));
 // QR 無房間平板登入：菜單／酒水改讀公開唯讀的 menu 集合（view/menu 僅作後備）
 G.unsub.push(onSnapshot(collection(db,'menu'),qs=>{const L=[];qs.forEach(d=>L.push({id:d.id,...d.data()}));L.sort((a,b)=>(a.ord||0)-(b.ord||0));const live=L.filter(m=>m.on!==false);if(live.length)G.menu=live;draw(true)},f));
}
function renewCopy(){
  const lang=(localStorage.getItem('guestLang')||(navigator.language||'zh')).slice(0,2);
  const M={
    zh:{t:'本房已續番',p:'請問要更換小姐，或維持原樣？',k:'維持原樣',c:'更換小姐'},
    vi:{t:'Phòng đã gia hạn',p:'Bạn muốn đổi tiếp viên hay giữ nguyên?',k:'Giữ nguyên',c:'Đổi tiếp viên'},
    en:{t:'The session was extended',p:'Would you like to change hostesses, or keep the same?',k:'Keep the same',c:'Change hostesses'},
    th:{t:'ต่อรอบแล้ว',p:'ต้องการเปลี่ยนพนักงานหรือคงเดิม?',k:'คงเดิม',c:'เปลี่ยนพนักงาน'}
  };
  return M[lang]||M.zh;
}
function maybeRenewPrompt(t){
  const ask=+(t.renewAsk||0); if(!ask||ask<=G.renewSeen)return;
  if(document.getElementById('renew')&&document.getElementById('renew').style.display==='flex')return;
  const c=renewCopy();
  const el=$('renew'); if(!el)return;
  el.style.display='flex';
  el.innerHTML=`<div class=box><h2>${c.t}</h2><p>${c.p}</p>
    <button type=button style="background:#2fb47a" id=rk>${c.k}</button>
    <button type=button style="background:#e0457b" id=rc>${c.c}</button></div>`;
  const done=async ch=>{el.style.display='none';G.renewSeen=ask;try{await addReq('續番選擇',[],ch==='keep'?'維持原樣':'更換小姐',{renewChoice:ch})}catch(e){flash('送出失敗，請呼叫 少爺/公主')}};
  $('rk').onclick=()=>done('keep'); $('rc').onclick=()=>done('change');
}
function subs(){const f=e=>console.warn(e);
 G.unsub.push(onSnapshot(collection(db,'menu'),qs=>{const L=[];qs.forEach(d=>L.push({id:d.id,...d.data()}));L.sort((a,b)=>(a.ord||0)-(b.ord||0));G.menu=L.filter(m=>m.on!==false);draw(true)},f));
 G.unsub.push(onSnapshot(doc(db,'public','avail'),s=>{const d=s.exists()?s.data():{};G.avail=d.list||[];if(d.day&&d.day!=G.day){G.day=d.day;subDay()}draw(true)},f));
 // 平板也聽本房 QR，續番時同樣跳出詢問
 G.unsub.push(onSnapshot(query(collection(db,'guestTokens'),where('room','==',G.room)),qs=>{
   G.roomTokens=[];qs.forEach(d=>G.roomTokens.push({id:d.id,...d.data()}));
   let latest=null;G.roomTokens.forEach(t=>{if(t.valid)latest=t});
   if(latest)maybeRenewPrompt(latest);
 },f));
 subDay()}
let dayUns=[];function subDay(){dayUns.forEach(f=>f());dayUns=[];const f=e=>console.warn(e);
 const qReq=G.tokenMode?query(collection(db,'guestReq'),where('guestToken','==',G.token)):query(collection(db,'guestReq'),where('room','==',G.room),where('businessDay','==',day()));
 const qOrd=G.tokenMode?query(collection(db,'orders'),where('guestToken','==',G.token)):query(collection(db,'orders'),where('room','==',G.room),where('businessDay','==',day()));
 dayUns.push(onSnapshot(qReq,qs=>{const L=[];qs.forEach(d=>L.push({id:d.id,...d.data()}));L.sort((a,b)=>b.createdAt-a.createdAt);G.reqs=L;draw(true)},f));
 dayUns.push(onSnapshot(qOrd,qs=>{const L=[];qs.forEach(d=>L.push({id:d.id,...d.data()}));L.sort((a,b)=>b.createdAt-a.createdAt);G.orders=L;draw(true)},f))}
// ---- 畫面 ----
const ST={'已送出':['已送出・請稍候','t0'],'已確認':['已確認','t1'],'已處理':['少爺/公主馬上到','t1'],'已拒絕':['抱歉，請重新選擇','t2']};
const OST={'待做':['已送出・準備中','t0'],'製作中':['製作中','t0'],'已出餐':['已送達','t1'],'取消':['已取消','t2']};
function statusHtml(){const R=G.reqs.slice(0,6),O=G.orders.slice(0,6);if(!R.length&&!O.length)return'';
 return`<div class=st><b>目前狀態</b>${R.map(q=>`<div>${new Date(q.createdAt).toLocaleTimeString('zh-TW',{hour12:false,hour:'2-digit',minute:'2-digit'})} ${q.type=='呼叫'?'呼叫 少爺/公主':q.type=='續番選擇'?('續番：'+(q.renewChoice=='keep'?'維持原樣':'更換小姐')):((q.random?'🎲 隨機點檯 ':'點小姐 ')+(q.girls||[]).map(esc).join('、'))}<span class="tag ${ST[q.status]?.[1]||'t0'}">${ST[q.status]?.[0]||esc(q.status)}</span></div>`).join('')}${O.map(o=>`<div>${new Date(o.createdAt).toLocaleTimeString('zh-TW',{hour12:false,hour:'2-digit',minute:'2-digit'})} ${o.items.map(i=>esc(i.name)+'×'+i.qty).join('、')}<span class="tag ${OST[o.status]?.[1]||'t0'}">${OST[o.status]?.[0]||esc(o.status)}</span></div>`).join('')}</div>`}
function draw(soft){if(!G.tokenMode&&!G.prof)return;const m=$('main');if(!m)return;if(soft&&document.activeElement&&document.activeElement.classList.contains('note'))return;const note=document.querySelector('.note');const nv=note?note.value:'';
 if(G.view=='home')m.innerHTML=`<div class=home><button class="big b1" onclick="GU.go('girls')">💃 點小姐<small>Chọn tiếp viên<br>Choose hostess<br>เลือกพนักงานต้อนรับ</small></button><button class="big b5" onclick="GU.go('random')">🎲 隨機點檯<small>Chọn ngẫu nhiên<br>Random Pick<br>เลือกแบบสุ่ม</small></button><button class="big b2" onclick="GU.go('food')">🍽 點菜<small>Gọi món<br>Order food<br>สั่งอาหาร</small></button><button class="big b3" onclick="GU.go('drink')">🍾 點酒<small>Gọi đồ uống<br>Order drinks<br>สั่งเครื่องดื่ม</small></button><button class="big b4" onclick="GU.call()">🛎 呼叫 少爺/公主<small>Gọi phục vụ<br>Call staff<br>เรียกพนักงาน</small></button></div>${G.tokenMode?'':`<p style="text-align:center;margin-top:12px"><button class=back type=button onclick="GU.showQr()">📱 出 QR 給客人掃描</button></p>`}${statusHtml()}`;
 else if(G.view=='girls'){const A=G.avail||[],free=A.filter(g=>!g.busy);m.innerHTML=`<h2><button class=back onclick="GU.go('home')">← 返回</button> 點小姐（可複選）</h2>${A.length?`<p class=hint>可點 ${free.length} 位${A.length>free.length?'・不可點 '+(A.length-free.length)+' 位':''}</p><div class=cards>${A.map(g=>`<div class="card ${G.sel.has(g.id)?'sel':''}${g.busy?' busy':''}" ${g.busy?'':'onclick="GU.pick(\''+esc(g.id)+'\')"'}">${g.photo?`<img src="${esc(g.photo)}" alt="">`:''}<div class=no>${esc(g.id)}</div><div class=nm>${esc(g.name||'')}</div>${g.busy?`<div class=bz>${esc(reasonLabel(g))}</div>`:''}</div>`).join('')}</div>`:'<p style="font-size:22px">目前沒有已報班的小姐，請按「呼叫 少爺/公主」。</p>'}
  <div class=bar><input class=note placeholder="備註（選填）" value="${esc(nv)}"><button class=go ${G.sel.size?'':'disabled'} onclick="GU.sendGirls()">送出（${G.sel.size} 位）</button></div>${statusHtml()}`}
 else if(G.view=='random'){const n=Math.max(1,Math.min(5,G.randN||1)),A=G.avail||[],free=A.filter(g=>!g.busy),max=free.length,busyN=A.length-max;
  m.innerHTML=`<h2><button class=back onclick="GU.go('home')">← 返回</button> 隨機點檯</h2>
<p class=hint>Chọn ngẫu nhiên · Random Pick · เลือกแบบสุ่ม<br>從今日已報班、目前可點的小姐中隨機抽出，送出後由幹部確認排檯。</p>
<p class=hint>目前可點 <b style="color:#ffcf5a;font-size:26px">${max}</b> 位${busyN?`　不可點 ${busyN} 位`:''}</p>
${A.length?`<div class=cards>${A.map(g=>`<div class="card${g.busy?' busy':''}"><div class=no>${esc(g.id)}</div><div class=nm>${esc(g.name||'')}</div>${g.busy?`<div class=bz>${esc(reasonLabel(g))}</div>`:''}</div>`).join('')}</div>`:''}
${max?`<div class=step><span class=lab>要幾位</span><button class=q onclick="GU.rand(-1)">−</button><span class=qn>${n}</span><button class=q onclick="GU.rand(1)">＋</button></div>
<button class=go style="width:100%;min-height:64px" onclick="GU.sendRandom()">抽出並送出</button>`:(A.length?'<p class=warn>目前沒有可點的小姐（已滿／私檯／暫停），請按「呼叫 少爺/公主」。</p>':'<p class=warn>目前沒有已報班的小姐，請按「呼叫 少爺/公主」。</p>')}
${statusHtml()}`}
 else if(G.view=='randomResult'){const R=G.randResult||{picked:[],want:0,short:false};
  m.innerHTML=`<h2>🎲 隨機點檯結果</h2>
${R.short?`<p class=warn>目前僅有 ${R.picked.length} 位可點（您要 ${R.want} 位），已為您抽出這 ${R.picked.length} 位。</p>`:`<p class=hint>已為您抽出 ${R.picked.length} 位，並送出給幹部確認。</p>`}
<div class="cards res">${R.picked.map(g=>`<div class=card>${g.photo?`<img src="${esc(g.photo)}" alt="">`:''}<div class=no>${esc(g.id)}</div><div class=nm>${esc(g.name)}</div></div>`).join('')}</div>
<p class=hint>請稍候，幹部確認中。</p>
<button class=go style="width:100%;min-height:56px;margin-top:12px" onclick="GU.go('home')">返回</button>
${statusHtml()}`}
 else{const cats=G.view=='drink'?['酒水']:['套餐內含','加點'];if(!cats.includes(G.tab))G.tab=cats[cats.length-1];const items=G.menu.filter(x=>x.cat==G.tab);
  const sum=Object.entries(G.q).reduce((a,[id,q])=>{const x=G.menu.find(z=>z.id==id);return a+(x&&x.cat!='套餐內含'?(+x.price||0)*q:0)},0),n=Object.values(G.q).reduce((a,b)=>a+b,0);
  m.innerHTML=`<h2><button class=back onclick="GU.go('home')">← 返回</button> ${G.view=='drink'?'點酒':'點菜'}</h2>${cats.length>1?`<div class=tabs>${cats.map(c=>`<button class="${c==G.tab?'on':''}" onclick="GU.tab('${c}')">${c=='套餐內含'?'套餐附餐（免費）<small>Free · ฟรี</small>':'加點<small>Extra · สั่งเพิ่ม</small>'}</button>`).join('')}</div>`:''}
  ${items.length?items.map(x=>{const q=G.q[x.id]||0;return`<div class=item><div class=n><b>${esc(x.zh)}</b><div class=tr>${[x.vn,x.en,x.th].filter(Boolean).map(esc).join('<br>')}</div></div><div class=p>${x.cat=='套餐內含'?'免費':'$'+(+x.price||0)}</div><button class=q onclick="GU.q('${x.id}',-1)">−</button><span class=qn>${q}</span><button class=q onclick="GU.q('${x.id}',1)">＋</button></div>`}).join(''):'<p style="font-size:22px">目前沒有品項</p>'}
  <div class=bar><input class=note placeholder="備註（例：不要辣）" value="${esc(nv)}"><button class=go ${n?'':'disabled'} onclick="GU.sendFood()">送出 ${n} 項${sum?`・$${sum}`:''}</button></div>${statusHtml()}`}}
async function addReq(type,girls,note,extra){return addDoc(collection(db,'guestReq'),Object.assign({room:G.room,type,girls:girls||[],note:note||'',status:'已送出',createdBy:G.tokenMode?'qr':G.user.uid,fromGuest:true,createdAt:Date.now(),businessDay:day()},G.tokenMode?{guestToken:G.token}:{},extra||{}))}
function shuffle(arr){const x=arr.slice();for(let i=x.length-1;i>0;i--){const buf=new Uint32Array(1);crypto.getRandomValues(buf);const j=buf[0]%(i+1);const t=x[i];x[i]=x[j];x[j]=t}return x}
window.GU={go:v=>{G.view=v;G.sel.clear();G.q={};if(v!='randomResult')G.randResult=null;draw()},tab:t=>{G.tab=t;draw()},pick:id=>{const g=(G.avail||[]).find(x=>x.id==id);if(g&&g.busy)return;G.sel.has(id)?G.sel.delete(id):G.sel.add(id);draw()},q:(id,d)=>{G.q[id]=Math.max(0,(G.q[id]||0)+d);if(!G.q[id])delete G.q[id];draw()},
 rand:d=>{G.randN=Math.max(1,Math.min(5,(G.randN||1)+d));draw()},
 sendRandom:async()=>{const want=Math.max(1,Math.min(5,G.randN||1)),pool=shuffle((G.avail||[]).filter(g=>!g.busy));if(!pool.length)return flash('目前沒有可點的小姐<br><small>請按「呼叫 少爺/公主」</small>');
  const picked=pool.slice(0,Math.min(want,pool.length)),short=picked.length<want;
  try{await addReq('點小姐',picked.map(g=>g.id),'',{random:true,want});G.randResult={picked,want,short};G.view='randomResult';draw()}catch(e){flash('送出失敗，請呼叫 少爺/公主')}},
 sendGirls:async()=>{const n=(document.querySelector('.note')||{}).value||'';try{await addReq('點小姐',[...G.sel],n.trim());flash('已送出 ✓<br><small>請稍候，幹部確認中</small>');G.view='home';G.sel.clear();draw()}catch(e){flash('送出失敗，請呼叫 少爺/公主')}},
 sendFood:async()=>{const n=((document.querySelector('.note')||{}).value||'').trim();const items=Object.entries(G.q).map(([id,qty])=>{const x=G.menu.find(z=>z.id==id);return x&&{id,name:x.zh,vn:x.vn||'',short:x.short||'',qty,price:x.cat!='套餐內含'?+x.price||0:0,cat:x.cat}}).filter(Boolean);if(!items.length)return;
  try{await addDoc(collection(db,'orders'),Object.assign({room:G.room,items,note:n,status:'待做',createdBy:G.tokenMode?'qr':G.user.uid,createdByName:G.room+' 客人'+(G.tokenMode?'(QR)':''),fromGuest:true,createdAt:Date.now(),businessDay:day()},G.tokenMode?{guestToken:G.token}:{}));flash('已送出 ✓<br><small>馬上為您準備</small>');G.view='home';G.q={};draw()}catch(e){flash('送出失敗，請呼叫 少爺/公主')}},
 call:async()=>{const last=G.reqs.find(q=>q.type=='呼叫'&&q.status=='已送出');if(last)return flash('已通知 少爺/公主<br><small>請稍候</small>');try{await addReq('呼叫',[],'');flash('已呼叫 少爺/公主 ✓')}catch(e){flash('呼叫失敗')}},
 showQr:async()=>{
  if(G.tokenMode)return;
  const now=Date.now();
  let tok=(G.roomTokens||[]).filter(t=>t.valid&&t.expiresAtMs>now).sort((a,b)=>(b.issuedAtMs||0)-(a.issuedAtMs||0))[0];
  if(!tok){
    const id=Array.from(crypto.getRandomValues(new Uint8Array(18)),x=>x.toString(16).padStart(2,'0')).join('');
    const rec={token:id,room:G.room,day:day(),sessionStart:now,sessions:1,issuedAtMs:now,expiresAtMs:now+2*3600*1000,valid:true,renewAsk:0,issuedBy:G.user&&G.user.uid,issuedByName:(G.prof&&G.prof.name)||G.room,issuedByRole:'房間平板'};
    try{await setDoc(doc(db,'guestTokens',id),rec);await setDoc(doc(db,'guestTokens',id,'view','avail'),{list:G.avail||[],day:day(),room:G.room,at:now});await setDoc(doc(db,'guestTokens',id,'view','menu'),{list:G.menu||[],at:now});tok={id,...rec}}catch(e){return flash('無法產生 QR（需本房已開番，或請幹部在主系統產生）')}
  }
  const url=location.origin+location.pathname.replace(/index\.html$/,'')+'?t='+encodeURIComponent(tok.id||tok.token);
  // pathname is guest.html already
  const u=location.origin+location.pathname.replace(/index\.html$/,'')+(location.pathname.endsWith('guest.html')?'':'guest.html')+'?t='+encodeURIComponent(tok.id||tok.token);
  const until=new Date(tok.expiresAtMs).toLocaleTimeString('zh-TW',{hour12:false});
  const box=$('qrbox');box.style.display='flex';
  box.innerHTML=`<div class=box><h2>${esc(G.room)} 客人點檯 QR</h2>
    <img alt=QR src="https://api.qrserver.com/v1/create-qr-code/?size=360x360&ecc=M&data=${encodeURIComponent(u)}">
    <p style="word-break:break-all;font-size:13px;color:#aab">${esc(u)}</p>
    <p>效期至 <b>${esc(until)}</b>（2 小時；買單立即失效；續番再延長 2 小時）</p>
    <button class=back type=button id=qrX>關閉</button></div>`;
  $('qrX').onclick=()=>{box.style.display='none'};
 }
};
// ---- 鎖頭：本包廂登出（需包廂密碼，走 Auth 再驗證）＋員工解鎖（幹部以上，編號密碼或 Google）----
async function verifyRoomPassword(pw){
  const u=auth.currentUser;
  if(!u||!u.email){const e=new Error('no-session');e.code='no-session';throw e}
  try{
    await reauthenticateWithCredential(u,EmailAuthProvider.credential(u.email,pw));
    return;
  }catch(e){
    const c=(e&&e.code)||'';
    if(c==='auth/wrong-password'||c==='auth/invalid-credential'||c==='auth/invalid-login-credentials'||c==='auth/user-mismatch'||c==='auth/too-many-requests'||c==='no-session')throw e;
    const sec=initializeApp(firebaseConfig,'chk'+Date.now()),sa=getAuth(sec);
    if(EMU)connectAuthEmulator(sa,'http://127.0.0.1:9099',{disableWarnings:true});
    try{
      const cred=await signInWithEmailAndPassword(sa,u.email,pw);
      if(!cred.user||cred.user.uid!==u.uid){const err=new Error('mismatch');err.code='auth/user-mismatch';throw err}
      await signOut(sa).catch(()=>{});
    }finally{await deleteApp(sec).catch(()=>{})}
  }
}
async function lookupStaffUser(sec,uid){
  const{getFirestore,connectFirestoreEmulator:cfe,doc:d2,getDoc:g2}=await import('https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js');
  const f2=getFirestore(sec);if(EMU)cfe(f2,'127.0.0.1',8080);
  const snap=await g2(d2(f2,'users',uid));
  return snap.exists()?snap.data():{};
}
function showUnlocked(p){
  const o=$('ov');
  o.style.display='flex';
  const who=esc((p.name||'')+(p.role==='特殊'?'':'（'+(p.role==='特殊'?'冠廷':p.role)+'）'));
  const label=p.role==='特殊'?'冠廷':(p.name||'');
  o.innerHTML=`<div class=box><h2>已解鎖（${esc(p.role==='特殊'?'冠廷':(p.name||''))}）<span class="vi">Đã mở khóa</span></h2>
    <button id=aRe style="background:#3a8fe0;color:#fff;min-height:44px">重新整理<span class="vi">Tải lại</span></button>
    <button id=aOut style="background:#c33;color:#fff;min-height:44px">解除綁定（登出平板）<span class="vi">Gỡ gắn (đăng xuất máy tính bảng)</span></button>
    <button id=aX style="background:#443;color:#fff;min-height:44px">返回客人畫面<span class="vi">Về trang khách</span></button></div>`;
  $('aRe').onclick=()=>location.reload();
  $('aX').onclick=()=>{o.style.display='none'};
  $('aOut').onclick=async()=>{await signOut(auth);setupUI()};
}
function openLockPanel(){
  const o=$('ov');
  const canRoomOut=!G.tokenMode&&!!(auth.currentUser&&auth.currentUser.email);
  o.style.display='flex';
  o.innerHTML=`<div class=box id=lockBox>
    <h2>員工選項<span class="vi">Tùy chọn nhân viên</span></h2>
    ${canRoomOut?`<div class=lock-sec>
      <h3>登出<span class="vi">Đăng xuất</span></h3>
      <p class=lock-hint>請輸入本包廂平板密碼後才會登出。密碼錯誤會留在客人畫面。<span class="vi">Nhập mật khẩu máy tính bảng phòng này để đăng xuất. Sai mật khẩu thì vẫn ở trang khách.</span></p>
      <input id=rPw type=password placeholder="包廂密碼" autocomplete="current-password">
      <p id=rErr class=lock-err></p>
      <button id=rGo type=button class=lock-danger>確認登出<span class="vi">Xác nhận đăng xuất</span></button>
    </div>`:''}
    <div class=lock-sec>
      <h3>員工解鎖<span class="vi">Mở khóa nhân viên</span></h3>
      <p class=lock-hint>需幹部以上。可用員工編號與密碼，或 Google 登入。<span class="vi">Cần cán bộ trở lên. Dùng mã nhân viên và mật khẩu, hoặc đăng nhập Google.</span></p>
      <input id=uId placeholder="員工編號" autocapitalize=none autocomplete=username>
      <input id=uPw type=password placeholder="密碼" autocomplete=current-password>
      <p id=uErr class=lock-err></p>
      <button id=uGo type=button class=lock-pri>解鎖<span class="vi">Mở khóa</span></button>
      <button id=uG type=button class=lock-g>使用 Google 解鎖<span class="vi">Mở khóa bằng Google</span></button>
    </div>
    <button id=uX type=button class=lock-x>取消<span class="vi">Hủy</span></button>
  </div>`;
  $('uX').onclick=()=>{o.style.display='none'};
  if(canRoomOut){
    const goOut=async()=>{
      const pw=($('rPw').value||'');
      const err=$('rErr');
      if(!pw){err.textContent='請輸入本包廂平板密碼';return}
      const btn=$('rGo');btn.disabled=true;
      try{
        await verifyRoomPassword(pw);
        $('rPw').value='';
        await signOut(auth);
        setupUI();
      }catch(e){
        const c=(e&&e.code)||'';
        $('rPw').value='';
        err.textContent=(c==='auth/too-many-requests')?'嘗試次數過多，請稍後再試':'包廂密碼錯誤，仍保持登入';
      }finally{btn.disabled=false}
    };
    $('rGo').onclick=goOut;
    $('rPw').onkeydown=e=>{if(e.key==='Enter')goOut()};
  }
  const afterStaff=async(p,errId)=>{
    if(p.disabled||(RANK[p.role]||0)<2){$(errId).textContent='需要幹部以上';return}
    showUnlocked(p);
  };
  $('uGo').onclick=async()=>{
    const id=($('uId').value||'').trim(),pw=$('uPw').value||'';
    if(!id||!pw){$('uErr').textContent='請填員工編號與密碼';return}
    const sec=initializeApp(firebaseConfig,'u'+Date.now()),sa=getAuth(sec);
    if(EMU)connectAuthEmulator(sa,'http://127.0.0.1:9099',{disableWarnings:true});
    $('uGo').disabled=true;
    try{
      const c=await signInWithEmailAndPassword(sa,mail(id),pw);
      const p=await lookupStaffUser(sec,c.user.uid);
      await signOut(sa).catch(()=>{});
      await afterStaff(p,'uErr');
    }catch(e){$('uErr').textContent='帳號或密碼錯誤'}
    finally{$('uGo').disabled=false;deleteApp(sec).catch(()=>{})}
  };
  $('uG').onclick=async()=>{
    const ua=navigator.userAgent||'';
    const inApp=/Line\//i.test(ua)||/FBAN|FBAV|FB_IAB|FBIOS/i.test(ua)||/Instagram/i.test(ua);
    if(inApp){$('uErr').textContent='Google 無法在 LINE 或其他 App 內建瀏覽器完成。請用系統的 Chrome 或 Safari，或改用員工編號密碼。';return}
    const sec=initializeApp(firebaseConfig,'ug'+Date.now()),sa=getAuth(sec);
    if(EMU)connectAuthEmulator(sa,'http://127.0.0.1:9099',{disableWarnings:true});
    $('uG').disabled=true;
    try{
      const c=await signInWithPopup(sa,new GoogleAuthProvider());
      const p=await lookupStaffUser(sec,c.user.uid);
      await signOut(sa).catch(()=>{});
      await afterStaff(p,'uErr');
    }catch(e){
      const c=(e&&e.code)||'';
      if(c==='auth/popup-closed-by-user'||c==='auth/cancelled-popup-request')return;
      if(c==='auth/operation-not-allowed')$('uErr').textContent='Google 登入尚未開啟，請改用員工編號密碼。';
      else if(c==='auth/popup-blocked')$('uErr').textContent='瀏覽器擋住彈窗。請允許彈窗，或改用員工編號密碼。';
      else $('uErr').textContent='Google 解鎖失敗，請改用員工編號密碼。';
    }finally{$('uG').disabled=false;deleteApp(sec).catch(()=>{})}
  };
}
$('lock').onclick=()=>openLockPanel();

history.pushState(null,'',location.href);addEventListener('popstate',()=>history.pushState(null,'',location.href));
idle();
function reasonLabel(g){const m={已滿:'已滿 / Đã đủ / Full',私檯:'私檯 / Riêng / Private',暫停:'暫停 / Tạm dừng / Paused'};return(m[g.reason]||g.reason||'不可點')+(g.room?' · '+g.room:'')}
