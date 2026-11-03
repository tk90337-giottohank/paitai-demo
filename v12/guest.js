// v12.6 客人點檯平板（包廂平板專用頁；不含任何員工畫面）
import {firebaseConfig} from './firebase-config.js';
import {initializeApp,deleteApp} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js';
import {getAuth,connectAuthEmulator,signInWithEmailAndPassword,signOut,onAuthStateChanged,setPersistence,browserLocalPersistence} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
import {initializeFirestore,persistentLocalCache,connectFirestoreEmulator,doc,getDoc,collection,onSnapshot,addDoc,query,where} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
const EMU=/[?&]emu=1/.test(location.search);
const app=initializeApp(firebaseConfig),auth=getAuth(app),db=initializeFirestore(app,{localCache:persistentLocalCache()});
if(EMU){connectAuthEmulator(auth,'http://127.0.0.1:9099',{disableWarnings:true});connectFirestoreEmulator(db,'127.0.0.1',8080)}
setPersistence(auth,browserLocalPersistence).catch(()=>{});
const mail=id=>String(id).trim().toLowerCase()+'@paitai-system.local';
const RANK={'小姐':1,'少爺':1,'幹部':2,'經理':3,'老闆':4,'特殊':5};
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const $=id=>document.getElementById(id);
const G={user:null,prof:null,room:'',menu:[],avail:[],day:'',reqs:[],orders:[],view:'home',sel:new Set(),q:{},tab:'加點',unsub:[]};
const IDLE=90000;let idleT=null;
function idle(){clearTimeout(idleT);idleT=setTimeout(()=>{if(G.view!='home'){G.view='home';G.sel.clear();G.q={};draw()}},IDLE)}
['pointerdown','keydown'].forEach(e=>addEventListener(e,idle,{passive:true}));
function flash(t){const m=$('msg');m.innerHTML=t;m.style.display='block';setTimeout(()=>m.style.display='none',2200)}
const day=()=>G.day||new Date(Date.now()-7.17*36e5).toLocaleDateString('sv-SE');
// ---- 設定（綁定包廂）：用房間平板帳號登入 ----
function setupUI(err){const o=$('ov');o.style.display='flex';o.innerHTML=`<div class=box><h2>包廂平板設定</h2><p style="color:#aab">請幹部用「房間平板」帳號登入（老闆在人員帳號管理建立，角色選「房間平板」並綁定包廂）。</p>${err?`<p style="color:#f66">${esc(err)}</p>`:''}
 <input id=sId placeholder="平板帳號（例 room208）" autocapitalize=none><input id=sPw type=password placeholder="密碼"><button id=sGo style="background:#2fb47a;color:#fff">登入並綁定</button></div>`;
 $('sGo').onclick=async()=>{try{$('sGo').disabled=true;await signInWithEmailAndPassword(auth,mail($('sId').value),$('sPw').value)}catch(e){setupUI('登入失敗：'+(e.code||''))}}}
onAuthStateChanged(auth,async u=>{G.unsub.forEach(f=>f());G.unsub=[];G.user=u;if(!u)return setupUI();
 let p=null;try{const s=await getDoc(doc(db,'users',u.uid));p=s.exists()?s.data():null}catch(e){}
 if(!p||p.disabled||p.role!='room'||!p.room){await signOut(auth);return setupUI(p&&p.role!='room'?'這不是房間平板帳號（員工請用一般排檯系統）':'此帳號未綁定包廂或已停用')}
 G.prof=p;G.room=p.room;$('ov').style.display='none';$('rm').textContent=p.room+' 包廂';subs();draw()});
function subs(){const f=e=>console.warn(e);
 G.unsub.push(onSnapshot(collection(db,'menu'),qs=>{const L=[];qs.forEach(d=>L.push({id:d.id,...d.data()}));L.sort((a,b)=>(a.ord||0)-(b.ord||0));G.menu=L.filter(m=>m.on!==false);draw(true)},f));
 G.unsub.push(onSnapshot(doc(db,'public','avail'),s=>{const d=s.exists()?s.data():{};G.avail=d.list||[];if(d.day&&d.day!=G.day){G.day=d.day;subDay()}draw(true)},f));
 subDay()}
let dayUns=[];function subDay(){dayUns.forEach(f=>f());dayUns=[];const f=e=>console.warn(e);
 dayUns.push(onSnapshot(query(collection(db,'guestReq'),where('room','==',G.room),where('businessDay','==',day())),qs=>{const L=[];qs.forEach(d=>L.push({id:d.id,...d.data()}));L.sort((a,b)=>b.createdAt-a.createdAt);G.reqs=L;draw(true)},f));
 dayUns.push(onSnapshot(query(collection(db,'orders'),where('room','==',G.room),where('businessDay','==',day())),qs=>{const L=[];qs.forEach(d=>L.push({id:d.id,...d.data()}));L.sort((a,b)=>b.createdAt-a.createdAt);G.orders=L;draw(true)},f))}
// ---- 畫面 ----
const ST={'已送出':['已送出・請稍候','t0'],'已確認':['已確認','t1'],'已處理':['少爺/公主馬上到','t1'],'已拒絕':['抱歉，請重新選擇','t2']};
const OST={'待做':['已送出・準備中','t0'],'製作中':['製作中','t0'],'已出餐':['已送達','t1'],'取消':['已取消','t2']};
function statusHtml(){const R=G.reqs.slice(0,6),O=G.orders.slice(0,6);if(!R.length&&!O.length)return'';
 return`<div class=st><b>目前狀態</b>${R.map(q=>`<div>${new Date(q.createdAt).toLocaleTimeString('zh-TW',{hour12:false,hour:'2-digit',minute:'2-digit'})} ${q.type=='呼叫'?'呼叫 少爺/公主':'點小姐 '+(q.girls||[]).map(esc).join('、')}<span class="tag ${ST[q.status]?.[1]||'t0'}">${ST[q.status]?.[0]||esc(q.status)}</span></div>`).join('')}${O.map(o=>`<div>${new Date(o.createdAt).toLocaleTimeString('zh-TW',{hour12:false,hour:'2-digit',minute:'2-digit'})} ${o.items.map(i=>esc(i.name)+'×'+i.qty).join('、')}<span class="tag ${OST[o.status]?.[1]||'t0'}">${OST[o.status]?.[0]||esc(o.status)}</span></div>`).join('')}</div>`}
function draw(soft){if(!G.prof)return;const m=$('main');if(soft&&document.activeElement&&document.activeElement.classList.contains('note'))return;const note=document.querySelector('.note');const nv=note?note.value:'';
 if(G.view=='home')m.innerHTML=`<div class=home><button class="big b1" onclick="GU.go('girls')">💃 點小姐<small>Chọn tiếp viên</small></button><button class="big b2" onclick="GU.go('food')">🍽 點菜<small>Gọi món</small></button><button class="big b3" onclick="GU.go('drink')">🍾 點酒<small>Gọi đồ uống</small></button><button class="big b4" onclick="GU.call()">🛎 呼叫 少爺/公主<small>Gọi phục vụ</small></button></div>${statusHtml()}`;
 else if(G.view=='girls'){const A=G.avail;m.innerHTML=`<h2><button class=back onclick="GU.go('home')">← 返回</button> 點小姐（可複選）</h2>${A.length?`<div class=cards>${A.map(g=>`<div class="card ${G.sel.has(g.id)?'sel':''}" onclick="GU.pick('${esc(g.id)}')">${g.photo?`<img src="${esc(g.photo)}" alt="">`:''}<div class=no>${esc(g.id)}</div><div class=nm>${esc(g.name)}</div></div>`).join('')}</div>`:'<p style="font-size:22px">目前沒有可點的小姐，請按「呼叫 少爺/公主」。</p>'}
  <div class=bar><input class=note placeholder="備註（選填）" value="${esc(nv)}"><button class=go ${G.sel.size?'':'disabled'} onclick="GU.sendGirls()">送出（${G.sel.size} 位）</button></div>${statusHtml()}`}
 else{const cats=G.view=='drink'?['酒水']:['套餐內含','加點'];if(!cats.includes(G.tab))G.tab=cats[cats.length-1];const items=G.menu.filter(x=>x.cat==G.tab);
  const sum=Object.entries(G.q).reduce((a,[id,q])=>{const x=G.menu.find(z=>z.id==id);return a+(x&&x.cat!='套餐內含'?(+x.price||0)*q:0)},0),n=Object.values(G.q).reduce((a,b)=>a+b,0);
  m.innerHTML=`<h2><button class=back onclick="GU.go('home')">← 返回</button> ${G.view=='drink'?'點酒':'點菜'}</h2>${cats.length>1?`<div class=tabs>${cats.map(c=>`<button class="${c==G.tab?'on':''}" onclick="GU.tab('${c}')">${c=='套餐內含'?'套餐附餐（免費）':'加點'}</button>`).join('')}</div>`:''}
  ${items.length?items.map(x=>{const q=G.q[x.id]||0;return`<div class=item><div class=n><b>${esc(x.zh)}</b><div>${esc(x.vn||'')}</div></div><div class=p>${x.cat=='套餐內含'?'免費':'$'+(+x.price||0)}</div><button class=q onclick="GU.q('${x.id}',-1)">−</button><span class=qn>${q}</span><button class=q onclick="GU.q('${x.id}',1)">＋</button></div>`}).join(''):'<p style="font-size:22px">目前沒有品項</p>'}
  <div class=bar><input class=note placeholder="備註（例：不要辣）" value="${esc(nv)}"><button class=go ${n?'':'disabled'} onclick="GU.sendFood()">送出 ${n} 項${sum?`・$${sum}`:''}</button></div>${statusHtml()}`}}
async function addReq(type,girls,note){return addDoc(collection(db,'guestReq'),{room:G.room,type,girls:girls||[],note:note||'',status:'已送出',createdBy:G.user.uid,createdAt:Date.now(),businessDay:day()})}
window.GU={go:v=>{G.view=v;G.sel.clear();G.q={};draw()},tab:t=>{G.tab=t;draw()},pick:id=>{G.sel.has(id)?G.sel.delete(id):G.sel.add(id);draw()},q:(id,d)=>{G.q[id]=Math.max(0,(G.q[id]||0)+d);if(!G.q[id])delete G.q[id];draw()},
 sendGirls:async()=>{const n=(document.querySelector('.note')||{}).value||'';try{await addReq('點小姐',[...G.sel],n.trim());flash('已送出 ✓<br><small>請稍候，幹部確認中</small>');G.view='home';G.sel.clear();draw()}catch(e){flash('送出失敗，請呼叫 少爺/公主')}},
 sendFood:async()=>{const n=((document.querySelector('.note')||{}).value||'').trim();const items=Object.entries(G.q).map(([id,qty])=>{const x=G.menu.find(z=>z.id==id);return x&&{id,name:x.zh,vn:x.vn||'',short:x.short||'',qty,price:x.cat!='套餐內含'?+x.price||0:0,cat:x.cat}}).filter(Boolean);if(!items.length)return;
  try{await addDoc(collection(db,'orders'),{room:G.room,items,note:n,status:'待做',createdBy:G.user.uid,createdByName:G.room+' 客人',fromGuest:true,createdAt:Date.now(),businessDay:day()});flash('已送出 ✓<br><small>馬上為您準備</small>');G.view='home';G.q={};draw()}catch(e){flash('送出失敗，請呼叫 少爺/公主')}},
 call:async()=>{const last=G.reqs.find(q=>q.type=='呼叫'&&q.status=='已送出');if(last)return flash('已通知 少爺/公主<br><small>請稍候</small>');try{await addReq('呼叫',[],'');flash('已呼叫 少爺/公主 ✓')}catch(e){flash('呼叫失敗')}}};
// ---- 員工解鎖（需幹部以上登入）----
$('lock').onclick=()=>{const o=$('ov');o.style.display='flex';o.innerHTML=`<div class=box><h2>員工解鎖</h2><p style="color:#aab">需幹部以上帳號</p><input id=uId placeholder="員工編號" autocapitalize=none><input id=uPw type=password placeholder="密碼"><p id=uErr style="color:#f66"></p><button id=uGo style="background:#3a8fe0;color:#fff">解鎖</button> <button id=uX style="background:#443;color:#fff">取消</button></div>`;
 $('uX').onclick=()=>{o.style.display='none'};$('uGo').onclick=async()=>{const sec=initializeApp(firebaseConfig,'u'+Date.now()),sa=getAuth(sec);if(EMU)connectAuthEmulator(sa,'http://127.0.0.1:9099',{disableWarnings:true});
  try{const c=await signInWithEmailAndPassword(sa,mail($('uId').value),$('uPw').value);const{getFirestore,connectFirestoreEmulator:cfe,doc:d2,getDoc:g2}=await import('https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js');const f2=getFirestore(sec);if(EMU)cfe(f2,'127.0.0.1',8080);
   const p=(await g2(d2(f2,'users',c.user.uid))).data()||{};await signOut(sa);if(p.disabled||(RANK[p.role]||0)<2){$('uErr').textContent='需要幹部以上';return}
   o.innerHTML=`<div class=box><h2>已解鎖（${esc(p.name)}）</h2><button id=aRe style="background:#3a8fe0;color:#fff">重新整理</button> <button id=aOut style="background:#c33;color:#fff">解除綁定（登出平板）</button> <button id=aX style="background:#443;color:#fff">返回客人畫面</button></div>`;
   $('aRe').onclick=()=>location.reload();$('aX').onclick=()=>{o.style.display='none'};$('aOut').onclick=async()=>{await signOut(auth);setupUI()}}
  catch(e){$('uErr').textContent='帳號或密碼錯誤'}finally{deleteApp(sec).catch(()=>{})}}};
history.pushState(null,'',location.href);addEventListener('popstate',()=>history.pushState(null,'',location.href));
idle();
