// v12.19 報班頁改中＋越並列（不再切換語言）
// v12.15 小姐報班（Google＋編號密碼；已取消 Apple）
import {firebaseConfig} from '../firebase-config.js';
import {initializeApp} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js';
import {getAuth,connectAuthEmulator,signInWithEmailAndPassword,signOut,onAuthStateChanged,setPersistence,browserLocalPersistence,
  GoogleAuthProvider,signInWithPopup,signInWithRedirect,getRedirectResult,updateProfile} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
import {initializeFirestore,persistentLocalCache,connectFirestoreEmulator,doc,getDoc,setDoc,updateDoc,collection,onSnapshot,query,where} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';

const EMU=/[?&]emu=1/.test(location.search);
const app=initializeApp(firebaseConfig),auth=getAuth(app);
const db=initializeFirestore(app,{localCache:persistentLocalCache()});
if(EMU){connectAuthEmulator(auth,'http://127.0.0.1:9099',{disableWarnings:true});connectFirestoreEmulator(db,'127.0.0.1',8080)}
setPersistence(auth,browserLocalPersistence).catch(()=>{});
const mail=id=>String(id).trim().toLowerCase()+'@paitai-system.local';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const $=id=>document.getElementById(id);
const isiOS=/iPad|iPhone|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
const useRedirect=()=>isiOS||window.matchMedia('(display-mode: standalone)').matches;

const I18N={
 zh:{brand:'小姐報班',login:'登入報班',id:'員工編號或小姐編號',pw:'密碼',go:'登入',google:'使用 Google 登入',apple:'使用 Apple 登入',or:'或用編號與密碼',
  wait:'帳號已建立，等候主管核准後即可報班。',editName:'修改顯示名稱',namePh:'顯示名稱',saveName:'儲存名稱',saved:'已更新名字',
  out:'登出',hello:'你好，',today:'今日營業日',clock:'現在',on:'我要報班',off:'取消報班',
  onOk:'已報班。系統會自動把你加入今天的排檯、隨機點檯與自動排台。',
  offOk:'已取消報班。',
  offHold:'你今天已有上台紀錄，無法自行取消。已通知幹部處理。',
  noLink:'此帳號尚未綁定小姐編號，請等主管核准／綁定後再報班。',
  pending:'等候核准',disabled:'此帳號已停用，請找幹部。',
  notGirl:'這不是小姐報班帳號。職員請走排檯系統。',
  staffMode:'幹部代為報班',
  staffHint:'這是小姐報班頁。你是職員帳號，不會被帶到主系統。可在這裡幫小姐報班或取消報班，或開啟排檯系統。',
  pickGirl:'選擇小姐',
  pickFirst:'請先選擇小姐',
  forHer:'代為',
  openMain:'開啟排檯系統',
  todayList:'今日報班名單',
  testSelf:'以測試小姐身分報班',
  testSelfHint:'這是測試身分，報班紀錄會標記為測試，不會匯入正式排檯或台數。',
  needLogin:'請先登入',statOn:'今日已報班',statOff:'尚未報班',
  myTai:'我的台數',noTai:'今天還沒有台數（上台後會顯示）。',hist:'歷史台數',
  tai:'台數',priv:'私檯',order:'訂番',when:'時間',empty:'沒有紀錄',
  fail:'失敗：',net:'網路連不上，請稍後再試',bad:'編號或密碼錯誤',
  lang:'語言'},
 vi:{brand:'Điểm danh',login:'Đăng nhập điểm danh',id:'Mã nhân viên',pw:'Mật khẩu',go:'Đăng nhập',google:'Đăng nhập bằng Google',apple:'Đăng nhập bằng Apple',or:'Hoặc dùng mã và mật khẩu',
  wait:'Tài khoản đã tạo, vui lòng chờ quản lý duyệt.',editName:'Đổi tên hiển thị',namePh:'Tên hiển thị',saveName:'Lưu tên',saved:'Đã cập nhật tên',
  out:'Đăng xuất',hello:'Xin chào, ',today:'Ngày làm việc',clock:'Bây giờ',on:'Điểm danh',off:'Hủy điểm danh',
  onOk:'Đã điểm danh. Hệ thống sẽ tự thêm bạn vào danh sách hôm nay.',
  offOk:'Đã hủy điểm danh.',
  offHold:'Bạn đã có ca hôm nay, không tự hủy được. Đã báo quản lý.',
  noLink:'Tài khoản chưa gắn số tiếp viên. Vui lòng chờ quản lý.',
  pending:'Đang chờ duyệt',disabled:'Tài khoản đã khóa.',
  notGirl:'Đây không phải tài khoản tiếp viên.',
  staffMode:'Quản lý điểm danh hộ',
  staffHint:'Đây là trang điểm danh. Tài khoản nhân viên không bị chuyển sang hệ thống chính. Bạn có thể điểm danh hộ, hoặc mở hệ thống chính.',
  pickGirl:'Chọn tiếp viên',
  pickFirst:'Hãy chọn tiếp viên',
  forHer:'Điểm danh hộ',
  openMain:'Mở hệ thống chính',
  todayList:'Danh sách hôm nay',
  testSelf:'Điểm danh với tư cách tiếp viên thử',
  testSelfHint:'Bản ghi thử, không vào danh sách chính.',
  needLogin:'Vui lòng đăng nhập',statOn:'Đã điểm danh hôm nay',statOff:'Chưa điểm danh',
  myTai:'Số bàn của tôi',noTai:'Hôm nay chưa có bàn.',hist:'Lịch sử',
  tai:'Bàn',priv:'Bàn riêng',order:'Đặt',when:'Thời gian',empty:'Không có dữ liệu',
  fail:'Lỗi: ',net:'Mất mạng, thử lại sau',bad:'Sai mã hoặc mật khẩu',
  lang:'Ngôn ngữ'},
 en:{brand:'Hostess check-in',login:'Sign in to check in',id:'Staff or hostess number',pw:'Password',go:'Sign in',google:'Continue with Google',apple:'Continue with Apple',or:'Or use ID and password',
  wait:'Your account is waiting for a manager to approve.',editName:'Edit display name',namePh:'Display name',saveName:'Save name',saved:'Name updated',
  out:'Sign out',hello:'Hi, ',today:'Business day',clock:'Now',on:'Check in',off:'Cancel check-in',
  onOk:'You’re checked in. The floor list, random pick and auto-assign will include you automatically.',
  offOk:'Check-in cancelled.',
  offHold:'You already have sessions today, so you can’t cancel by yourself. A supervisor has been notified.',
  noLink:'This account is not linked to a hostess number yet.',
  pending:'Pending approval',disabled:'This account is disabled.',
  notGirl:'This is not a hostess account. Staff should use the main system.',
  staffMode:'Check in for a hostess',
  staffHint:'This is the hostess check-in page. Staff accounts stay here (no auto-redirect). You can check a hostess in or out, or open the main system.',
  pickGirl:'Choose hostess',
  pickFirst:'Please choose a hostess first',
  forHer:'For her: ',
  openMain:'Open main system',
  todayList:'Checked in today',
  testSelf:'Check in as test hostess',
  testSelfHint:'Marked as a test record and not added to the live floor list or 台數.',
  needLogin:'Please sign in',statOn:'Checked in today',statOff:'Not checked in yet',
  myTai:'My tables',noTai:'No tables yet today.',hist:'History',
  tai:'Tables',priv:'Private',order:'Booked',when:'Time',empty:'No records',
  fail:'Failed: ',net:'Network error, please try again',bad:'Wrong ID or password',
  lang:'Language'},
 th:{brand:'เช็กอินพนักงาน',login:'เข้าสู่ระบบเพื่อเช็กอิน',id:'รหัสพนักงาน',pw:'รหัสผ่าน',go:'เข้าสู่ระบบ',google:'เข้าสู่ระบบด้วย Google',apple:'เข้าสู่ระบบด้วย Apple',or:'หรือใช้รหัสและรหัสผ่าน',
  wait:'บัญชีถูกสร้างแล้ว รอผู้จัดการอนุมัติ',editName:'แก้ชื่อที่แสดง',namePh:'ชื่อที่แสดง',saveName:'บันทึกชื่อ',saved:'อัปเดตชื่อแล้ว',
  out:'ออกจากระบบ',hello:'สวัสดี ',today:'วันทำการ',clock:'ตอนนี้',on:'เช็กอิน',off:'ยกเลิกเช็กอิน',
  onOk:'เช็กอินแล้ว ระบบจะใส่คุณในรายการวันนี้โดยอัตโนมัติ',
  offOk:'ยกเลิกเช็กอินแล้ว',
  offHold:'วันนี้มีรอบงานแล้ว ยกเลิกเองไม่ได้ ได้แจ้งหัวหน้าแล้ว',
  noLink:'บัญชียังไม่ได้ผูกหมายเลขพนักงาน',
  pending:'รออนุมัติ',disabled:'บัญชีถูกปิด',
  notGirl:'นี่ไม่ใช่บัญชีพนักงานต้อนรับ',
  staffMode:'เช็กอินให้พนักงาน',
  staffHint:'นี่คือหน้าเช็กอิน จะไม่พาบัญชีพนักงานไประบบหลัก คุณเช็กอินให้ได้ หรือเปิดระบบหลัก',
  pickGirl:'เลือกพนักงาน',
  pickFirst:'กรุณาเลือกพนักงานก่อน',
  forHer:'ทำแทน ',
  openMain:'เปิดระบบหลัก',
  todayList:'รายชื่อวันนี้',
  testSelf:'เช็กอินด้วย身分ทดสอบ',
  testSelfHint:'บันทึกทดสอบ จะไม่เข้าสู่รายการจริง',
  needLogin:'กรุณาเข้าสู่ระบบ',statOn:'เช็กอินวันนี้แล้ว',statOff:'ยังไม่ได้เช็กอิน',
  myTai:'จำนวนโต๊ะของฉัน',noTai:'วันนี้ยังไม่มีโต๊ะ',hist:'ประวัติ',
  tai:'โต๊ะ',priv:'ส่วนตัว',order:'จอง',when:'เวลา',empty:'ไม่มีข้อมูล',
  fail:'ล้มเหลว: ',net:'เน็ตมีปัญหา ลองใหม่',bad:'รหัสหรือรหัสผ่านผิด',
  lang:'ภาษา'}
};
const LANGS=[['zh','中文'],['vi','Tiếng Việt'],['en','English'],['th','ไทย']];
function detectLang(){return 'zh'}
let lang='zh';
const T=k=>(I18N[lang]&&I18N[lang][k])||I18N.zh[k]||k;

const G={user:null,prof:null,cfg:{},checkin:null,hist:[],day:'',unsub:[],msg:''};
const dkey=d=>{d=new Date(d);return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')};
const cutM=()=>{const m=String((G.cfg.dayCut||'07:10')).match(/^(\d{1,2})(?::(\d{2}))?$/);return m?+m[1]*60+(+(m[2]||0)):430};
const bizDay=ts=>dkey((ts??Date.now())-cutM()*60000);
const hm=ts=>new Date(ts).toLocaleTimeString('zh-TW',{hour12:false,hour:'2-digit',minute:'2-digit'});

function girlIdOf(p){return String((p&&(p.girlId||(/^\d{1,3}$/.test(String(p.staffId||''))?p.staffId:'')))||'').trim()}
function isStaff(p){const r=p&&p.role;return r&&r!=='小姐'&&r!=='pending'&&r!=='room'}

function langsBar(){
  const el=$('langs'); if(!el)return;
  el.innerHTML='<span class="bi">中文 / Tiếng Việt</span>';
  el.onclick=null;
}

function loginUI(msg){
  $('ov').style.display='flex';
  $('who').textContent='';
  $('brand').textContent=T('brand');
  $('ov').innerHTML=`<div class=box><h2>${T('login')}</h2>
    ${msg?`<p class=err>${esc(msg)}</p>`:''}
    <button class="btn g" id=gGo type=button>${T('google')}</button>
    <p style="text-align:center;color:#887;font-size:13px;margin:10px 0">${T('or')}</p>
    <input id=sId placeholder="${T('id')}" autocapitalize=none autocomplete=username>
    <input id=sPw type=password placeholder="${T('pw')}" autocomplete=current-password>
    <button class=btn id=sGo type=button>${T('go')}</button>
  </div>`;
  const go=async()=>{try{$('sGo').disabled=true;await signInWithEmailAndPassword(auth,mail($('sId').value),$('sPw').value)}catch(e){loginUI(e.code=='auth/network-request-failed'?T('net'):T('bad'))}};
  $('sGo').onclick=go;$('sPw').onkeydown=e=>{if(e.key==='Enter')go()};
  $('gGo').onclick=()=>social('google');
}

async function social(kind){
  if(kind==='apple')return loginUI('目前僅提供 Google 與編號密碼登入。');
  try{
    const p=new GoogleAuthProvider();
    if(useRedirect())await signInWithRedirect(auth,p);
    else await signInWithPopup(auth,p);
  }catch(e){
    const c=e.code||'';
    if(c==='auth/popup-closed-by-user'||c==='auth/cancelled-popup-request')return;
    if(c==='auth/operation-not-allowed')loginUI(T('fail')+'Google 登入尚未開啟');
    else loginUI(T('fail')+(c||e.message||''));
  }
}

async function ensurePending(u){
  const s=await getDoc(doc(db,'users',u.uid));
  if(s.exists())return s.data();
  const name=(u.displayName||(u.email||'').split('@')[0]||'新朋友').slice(0,40);
  const staffId=('g-'+u.uid.slice(0,10)).toLowerCase();
  const rec={staffId,name,role:'pending',rank:0,disabled:false,createdAt:Date.now(),provider:u.providerData.map(p=>p.providerId).join(','),email:u.email||''};
  await setDoc(doc(db,'users',u.uid),rec);
  return rec;
}

function stop(){G.unsub.forEach(f=>f());G.unsub=[]}

onAuthStateChanged(auth,async u=>{
  stop();G.user=u;G.prof=null;G.checkin=null;G.hist=[];
  if(!u){loginUI();draw();return}
  let p=null;
  try{p=await ensurePending(u)}catch(e){await signOut(auth);loginUI(T('fail')+(e.code||e.message||''));return}
  if(!p||p.disabled){await signOut(auth);loginUI(p&&p.disabled?T('disabled'):T('needLogin'));return}
  if(p.role==='room'){location.replace('../guest.html'+location.search);return}
  G.prof=p;G.staffMode=isStaff(p);
  $('ov').style.display=p.role==='pending'?'flex':'none';
  subs();draw();
});

function subs(){
  const f=e=>console.warn(e);
  G.unsub.push(onSnapshot(doc(db,'config','settings'),s=>{
    try{G.cfg=s.exists()?JSON.parse(s.data().cfg||'{}'):{}}catch(_){G.cfg={}}
    G.day=bizDay(Date.now());
    subMine();draw();
  },f));
  G.unsub.push(onSnapshot(doc(db,'config','roster'),s=>{
    try{let n=s.exists()?s.data().names:null;if(typeof n==='string')n=JSON.parse(n);G.rosterNames=n&&typeof n==='object'?n:{}}catch(_){G.rosterNames=G.rosterNames||{}}
    draw(true);
  },f));
  if(G.staffMode){
    const day=()=>G.day||bizDay(Date.now());
    G.unsub.push(onSnapshot(doc(db,'days',day()),s=>{
      try{let raw=s.exists()?s.data().girls:null;if(typeof raw==='string')raw=JSON.parse(raw);if(typeof raw==='string')raw=JSON.parse(raw);G.roster=Array.isArray(raw)?raw:[]}catch(_){G.roster=G.roster||[]}
      if(!Array.isArray(G.roster))G.roster=[];
      draw(true);
    },f));
    G.unsub.push(onSnapshot(query(collection(db,'girlCheckin'),where('day','==',day())),qs=>{
      const L=[];qs.forEach(d=>L.push({id:d.id,...d.data()}));
      L.sort((a,b)=>(b.at||0)-(a.at||0));G.todayList=L;draw(true);
    },f));
  }
}
let mineUnsub=[];
function subMine(){
  mineUnsub.forEach(f=>f());mineUnsub=[];
  const id=girlIdOf(G.prof),day=G.day||bizDay(Date.now());
  if(!id||!G.prof||G.prof.role==='pending')return;
  const f=e=>console.warn(e);
  mineUnsub.push(onSnapshot(doc(db,'girlCheckin',day+'_'+id),s=>{G.checkin=s.exists()?s.data():null;draw(true)},f));
  mineUnsub.push(onSnapshot(query(collection(db,'girlHist'),where('girlId','==',id)),qs=>{
    const L=[];qs.forEach(d=>L.push({id:d.id,...d.data()}));
    L.sort((a,b)=>String(b.day||'').localeCompare(String(a.day||'')));
    G.hist=L;draw(true);
  },f));
}

async function setName(){
  const n=prompt(T('namePh'),G.prof&&G.prof.name||'');
  if(n==null)return;
  const name=n.trim().slice(0,40);
  if(!name)return;
  try{
    await updateDoc(doc(db,'users',G.user.uid),{name});
    if(auth.currentUser)updateProfile(auth.currentUser,{displayName:name}).catch(()=>{});
    G.prof={...G.prof,name};G.msg=T('saved');draw();
  }catch(e){G.msg=T('fail')+(e.code||e.message);draw()}
}

async function punch(on,forId){
  const staff=isStaff(G.prof);
  const g=staff?(G.roster||[]).find(x=>String(x.id)===String(forId||G.pickId)) : G.prof;
  const id=staff?String(forId||G.pickId||'').trim():girlIdOf(G.prof);
  if(!id){G.msg=staff?T('pickFirst'):T('noLink');draw();return}
  const day=bizDay(Date.now());
  G.day=day;
  const rec={
    uid:G.user.uid,girlId:id,name:staff?((g&&(g.name||g.nm))||id):(G.prof.name||id),day,on,at:Date.now(),
    src:staff?'staff':'self',by:staff?(G.prof.name||G.prof.staffId||''):'',tz:'Asia/Taipei'
  };
  if(staff&&(G.prof.girlId||G.prof.test)&&String(id)===String(G.prof.girlId||'T57')){rec.test=true;rec.src='test'}

  if(!on){rec.cancelAt=Date.now();rec.cancelReq=true}
  try{
    await setDoc(doc(db,'girlCheckin',day+'_'+id),rec,{merge:true});
    G.msg=on?T('onOk'):T('offOk');
    // 實際能不能取消（已有番）由排檯端自動判斷；若被標成需幹部，snapshot 會回來顯示
  }catch(e){G.msg=T('fail')+(e.code||e.message)}
  draw();
}

function draw(){
  langsBar();
  $('brand').textContent=T('brand');
  const p=G.prof;
  if(!p){$('main').innerHTML='';$('who').textContent='';return}
  $('who').textContent=(p.name||'')+(p.role==='pending'?' · '+T('pending'):(girlIdOf(p)?' · '+girlIdOf(p):''));
  if(p.role==='pending'){
    $('ov').style.display='flex';
    $('ov').innerHTML=`<div class=box><h2>${T('pending')}</h2><p class=hint>${T('wait')}</p>
      <input id=nNm value="${esc(p.name||'')}" placeholder="${T('namePh')}">
      <button class=btn id=nSv type=button>${T('saveName')}</button>
      <button class="btn s" id=nOut type=button>${T('out')}</button></div>`;
    $('nSv').onclick=async()=>{const name=$('nNm').value.trim().slice(0,40);if(!name)return;try{await updateDoc(doc(db,'users',G.user.uid),{name});G.prof={...G.prof,name};G.msg=T('saved');draw()}catch(e){alert(T('fail')+(e.code||''))}};
    $('nOut').onclick=()=>signOut(auth);
    return;
  }
  $('ov').style.display='none';
  if(isStaff(G.prof)){drawStaff();return}
  const day=G.day||bizDay(Date.now());
  const on=!!(G.checkin&&G.checkin.on);
  const hold=!!(G.checkin&&G.checkin.review==='需幹部處理'&&G.checkin.cancelReq&&!G.checkin.on===false?false:G.checkin&&G.checkin.review==='需幹部處理');
  // hold if review flag set after cancel attempt
  const blocked=!!(G.checkin&&G.checkin.review==='需幹部處理');
  const todayH=G.hist.find(h=>h.day===day);
  const past=G.hist.filter(h=>h.day!==day).slice(0,14);
  $('main').innerHTML=`
    <div class=clock>${T('today')} <b>${esc(day)}</b> · ${T('clock')} ${hm(Date.now())}（07:10 ${lang==='zh'?'營業日分界':'cut'}）</div>
    <div class=card>
      <h2>${T('hello')}${esc(p.name||'')}</h2>
      <div class="${on?'ok':'hint'}">${on?T('statOn'):T('statOff')}${G.checkin&&G.checkin.at?' · '+hm(G.checkin.at):''}</div>
      ${blocked?`<div class=warn>${T('offHold')}</div>`:''}
      ${G.msg?`<div class="${G.msg===T('offHold')||G.msg.startsWith(T('fail'))?'warn':'ok'}">${esc(G.msg)}</div>`:''}
      ${girlIdOf(p)?'':`<div class=warn>${T('noLink')}</div>`}
      <button class="big ${on?'b-off':'b-on'}" type=button id=bGo ${girlIdOf(p)?'':'disabled'}>${on?T('off'):T('on')}</button>
    </div>
    <div class=card>
      <h2>${T('myTai')}（${esc(day)}）</h2>
      ${todayH?`<div class=row><span>${T('tai')}</span><b>${+todayH.tai||0}</b></div>
        <div class=row><span>${T('priv')}</span><b>${+todayH.priv||0}</b></div>
        <div class=row><span>${T('order')}</span><b>${+todayH.order||0}</b></div>`:`<p class=hint>${T('noTai')}</p>`}
    </div>
    <div class=card>
      <h2>${T('hist')}</h2>
      ${past.length?past.map(h=>`<div class=row><span>${esc(h.day)}</span><span>${T('tai')} ${+h.tai||0} · ${T('priv')} ${+h.priv||0}</span></div>`).join(''):`<p class=hint>${T('empty')}</p>`}
    </div>
    <div class=bar>
      <button type=button id=bName>${T('editName')}</button>
      <button type=button id=bOut>${T('out')}</button>
    </div>`;
  $('bGo').onclick=()=>punch(!on);
  $('bName').onclick=setName;
  $('bOut').onclick=()=>signOut(auth);
}

function drawStaff(){
  const day=G.day||bizDay(Date.now());
  const roster=(G.roster||[]).filter(g=>g&&g.id&&!g.off);
  const list=G.todayList||[];
  const onIds=new Set(list.filter(x=>x.on).map(x=>String(x.girlId)));
  const pick=G.pickId||'';
  const picked=roster.find(g=>String(g.id)===String(pick));
  const nm=g=>{const id=String((g&&g.id)||'');const off=(G.rosterNames||{})[id]||(G.rosterNames||{})[id.padStart(2,'0')];return String(off||(g&&(g.name||g.nm))||'').replace(/^\s*\d+\s*號?\s*/,'')};
  $('who').textContent=(G.prof.name||'')+' · '+(G.prof.role==='特殊'?'冠廷':G.prof.role);
  $('main').innerHTML=`
    <div class=clock>${T('today')} <b>${esc(day)}</b> · ${T('clock')} ${hm(Date.now())}（07:10）</div>
    <div class=card>
      <h2>${T('staffMode')}</h2>
      <p class=hint>${T('staffHint')}</p>
      <p><a class="btn" href="../" style="display:inline-block;text-align:center;text-decoration:none;background:#3a8fe0">${T('openMain')}</a></p>
      <label style="display:block;margin:12px 0 6px">${T('pickGirl')}</label>
      <select id=gPick style="width:100%;min-height:48px;font-size:18px;border-radius:12px;border:0;padding:8px">
        <option value="">—</option>
        ${roster.map(g=>`<option value="${esc(g.id)}" ${String(g.id)===String(pick)?'selected':''}>${esc(g.id)} ${esc(nm(g))}${onIds.has(String(g.id))?' · '+T('statOn'):''}</option>`).join('')}
      </select>
      ${G.msg?`<div class=ok style="margin-top:8px">${esc(G.msg)}</div>`:''}
      <button class="big b-on" type=button id=bOn ${pick?'':'disabled'}>${T('forHer')}${T('on')}</button>
      <button class="big b-off" type=button id=bOff ${pick?'':'disabled'}>${T('forHer')}${T('off')}</button>
    </div>
    ${G.prof.girlId||G.prof.test?`<div class=card><h2>${T('testSelf')}（${esc(G.prof.girlId||'T57')}）</h2>
      <p class=hint>${T('testSelfHint')}</p>
      <button class="big b-on" type=button id=tOn>${T('on')}</button>
      <button class="big b-off" type=button id=tOff>${T('off')}</button>
    </div>`:''}
    <div class=card>
      <h2>${T('todayList')}</h2>
      ${list.filter(x=>x.on).length?list.filter(x=>x.on).map(x=>`<div class=row><span>${esc(x.girlId)} ${esc(x.name||'')}</span><span>${x.at?hm(x.at):''}${x.src==='staff'?' · '+esc(x.by||''):''}</span></div>`).join(''):`<p class=hint>${T('empty')}</p>`}
    </div>
    <div class=bar>
      <button type=button id=bName>${T('editName')}</button>
      <button type=button id=bOut>${T('out')}</button>
    </div>`;
  $('gPick').onchange=e=>{G.pickId=e.target.value;draw()};
  $('bOn').onclick=()=>punch(true,G.pickId);
  $('bOff').onclick=()=>punch(false,G.pickId);
  const tOn=$('tOn'),tOff=$('tOff');
  if(tOn)tOn.onclick=()=>punch(true,G.prof.girlId||'T57');
  if(tOff)tOff.onclick=()=>punch(false,G.prof.girlId||'T57');
  $('bName').onclick=setName;
  $('bOut').onclick=()=>signOut(auth);
}

getRedirectResult(auth).catch(e=>{if(e&&e.code&&e.code!=='auth/popup-closed-by-user')console.warn(e)});
langsBar();$('brand').textContent=T('brand');
setInterval(()=>{if(G.prof&&(G.prof.role==='小姐'||isStaff(G.prof))){const d=bizDay(Date.now());if(d!==G.day){G.day=d;if(G.staffMode){stop();subs()}else subMine();draw()}}},30000);

try{window.draw=draw;window.loginUI=loginUI}catch(e){}
