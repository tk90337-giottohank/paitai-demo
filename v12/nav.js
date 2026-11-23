// v12.25 匯入傳統排檯表與校對入口；v12.24 齒輪可切外觀；人員帳號管理改幹部以上
// v12.22 主選單：五組功能，設定放齒輪；權限仍由原功能檢查
(function(){
 const GROUPS=[
  {id:'floor',label:'排檯',items:[
    {label:'今日看板',fn:'navHome',min:0},
    {label:'今日排檯表',fn:'openSheet',min:0},
    {label:'傳統排檯表',fn:'openGrid',min:0},
    {label:'自動排台',fn:'openSheetLearn',min:0},
    {label:'匯入傳統排檯表',fn:'openPaperImport',min:2,id:'pimpBtn'},
    {label:'手動匯入',fn:'openManualImport',min:2,id:'mimpBtn'},
    {label:'匯入校對',fn:'openImportArchive',min:2,id:'iarcBtn'},
    {label:'客人點檯／QR',fn:'openGuest',min:0},
    {label:'控台大螢幕',fn:'openBoard',min:0},
    {label:'叫檯看板',fn:'openCallBoard',min:0},
    {label:'昨日待辦',fn:'openCarryover',min:2,badge:'pendingCarry'},
    {label:'包廂重設紀錄',fn:'openRoomResetLog',min:2},
    {label:'外找',fn:'openFind',min:0}
  ]},
  {id:'hostess',label:'小姐報班／排班',items:[
    {label:'小姐報班頁',fn:'navGirlPage',min:0},
    {label:'小姐名冊',fn:'navGirlRoster',min:0},
    {label:'改名紀錄',fn:'openRenameLog',min:2},
    {label:'請假',fn:'openLeave',min:0},
    {label:'排班（本週）',fn:'openWeekSched',min:0}
  ]},
  {id:'staff',label:'少爺公主・酒水',items:[
    {label:'少爺／公主排班',fn:'openSched',min:0},
    {label:'本週排班',fn:'openWeekSched',min:0},
    {label:'打卡（定位）',fn:'openPunch',min:0},
    {label:'少爺薪資',fn:'openPayroll',min:2},
    {label:'寄酒',fn:'openWine',min:0},
    {label:'寄放／預支',fn:'openLedger',min:0}
  ]},
  {id:'food',label:'點餐、廚房',items:[
    {label:'點餐／酒水',fn:'openOrder',min:1},
    {label:'廚房',fn:'openKitchen',min:0}
  ]},
  {id:'reports',label:'報表',items:[
    {label:'歷史紀錄／日結／換日',fn:'openHistory',min:0},
    {label:'匯入校對',fn:'openImportArchive',min:2},
    {label:'當月報表',fn:'openMonthReport',min:0},
    {label:'今日營收',fn:'openRevenue',min:0},
    {label:'小姐台數',fn:'openGirlPay',min:0},
    {label:'訂番獎金',fn:'navBonus',min:0},
    {label:'月出勤報表',fn:'openReport',min:0}
  ]}
 ];

 function lvNow(){try{if(window.Cloud&&typeof Cloud.lv==='function'){const n=Cloud.lv();if(n)return n}}catch(e){}try{return typeof lvl==='function'?lvl():0}catch(e){return 0}}
 function badgeVal(kind){
  if(kind==='pendingCarry'&&typeof pendingCarry==='function')return pendingCarry().length;
  return 0;
 }
 window.navHome=function(){try{if(typeof pageClose==='function')pageClose()}catch(e){} closeNav();window.scrollTo({top:0,behavior:'smooth'})};
 window.navGirlPage=function(){
  const u=(window.Cloud&&typeof window.Cloud.girlPageUrl==='function')?window.Cloud.girlPageUrl():((location.pathname.replace(/index\.html$/,'').replace(/\/?$/,'/'))+'girl/');
  window.open(u,'_blank','noopener');
 };
 window.navGirlRoster=function(){
  try{if(typeof pageClose==='function')pageClose()}catch(e){}
  closeNav();
  const el=document.getElementById('girls');
  const sec=el&&el.closest('section');
  if(sec){sec.scrollIntoView({behavior:'smooth',block:'start'});sec.style.outline='2px solid #3d6df2';setTimeout(()=>{sec.style.outline=''},1600)}
 };
 window.navBonus=function(){if(typeof openBonus==='function')openBonus(typeof bizDay==='function'?bizDay(typeof now==='function'?now():Date.now()).slice(0,7):undefined)};

 window.openGearMenu=function(){
  const L=lvNow();
  const items=[
    {label:'店家設定',fn:'openSettings',min:0},
    {label:'登入／切換人員',fn:'openLogin',min:0},
    {label:'我的帳號',fn:'navAccount',min:0},
    {label:'人員帳號管理',fn:'navStaff',min:2},
    {label:'登入教學',fn:'openHelp',min:0},
    {label:'分店管理',fn:'openBranches',min:5},
    {label:'登入紀錄',fn:'navLoginLogs',min:4}
  ];
  if(L>=4) items.push({label:'重設示範資料',fn:'navResetDemo',min:4,danger:true});
  showPanel('gear','設定',items);
  const p=document.getElementById('navPanel');
  if(p&&window.PaitaiTheme){
    const cur=PaitaiTheme.mode();
    const row=document.createElement('div');
    row.className='theme-row';
    const btns=[['system','跟隨系統'],['dark','深色'],['light','淺色']].map(([k,l])=>`<button type=button class="s theme-btn${cur===k?' on':''}" data-theme-choice="${k}" onclick="PaitaiTheme.setMode('${k}')">${l}</button>`).join('');
    row.innerHTML=`<div class="theme-label">外觀<span class=vi>Giao diện</span></div><div class="theme-choices">${btns}</div>`;
    p.appendChild(row);
  }
 };
 window.navAccount=function(){if(window.Cloud&&typeof window.Cloud.openAccount==='function')window.Cloud.openAccount();else if(typeof openLogin==='function')openLogin()};
 window.navStaff=function(){if(window.Cloud&&typeof window.Cloud.openStaff==='function')window.Cloud.openStaff();else if(typeof openUsers==='function')openUsers()};
 window.navLoginLogs=function(){if(window.Cloud&&typeof window.Cloud.openLoginLogs==='function')window.Cloud.openLoginLogs()};
 window.navResetDemo=function(){if(!confirm('重設示範資料？這會清掉本機暫存，不會自動改雲端帳單。'))return;if(window.Store)Store.clear();location.reload()};

 let _open=null;
 function closeNav(){
  _open=null;
  document.querySelectorAll('.mainnav [data-nav],#gearBtn').forEach(b=>b.classList.remove('on'));
  const p=document.getElementById('navPanel');
  if(p){p.classList.remove('on');p.hidden=true;p.innerHTML=''}
 }
 function showPanel(id,title,items){
  const p=document.getElementById('navPanel'); if(!p)return;
  if(_open===id){closeNav();return}
  _open=id;
  document.querySelectorAll('.mainnav [data-nav],#gearBtn').forEach(b=>b.classList.toggle('on',b.getAttribute('data-nav')===id||(id==='gear'&&b.id==='gearBtn')));
  const L=lvNow();
  const btns=items.filter(it=>L>=(it.min||0)||it.min===0).map(it=>{
    const n=it.badge?badgeVal(it.badge):0;
    const badge=n?`<span class=navbadge>${n}</span>`:'';
    const danger=it.danger?' style="background:#933"':'';
    const fid=it.id?` id="${it.id}"`:'';
    return `<button type=button class="s navitem"${fid}${danger} onclick="navRun('${it.fn}')">${escapeHtml(it.label)}${badge}</button>`;
  }).join('');
  p.innerHTML=`<div class=navpanel-head><b>${escapeHtml(title)}</b><button type=button class=s onclick="closeNavMenu()">關閉</button></div><div class=navpanel-items>${btns}</div>`;
  p.hidden=false; p.classList.add('on');
 }
 function escapeHtml(s){return String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
 window.closeNavMenu=closeNav;
 window.toggleNav=function(id){
  const g=GROUPS.find(x=>x.id===id); if(!g)return;
  showPanel(g.id,g.label,g.items);
 };
 window.navRun=function(fn){
  closeNav();
  const f=window[fn];
  if(typeof f==='function')return f();
 };
 window.refreshNavBadges=function(){
  // 排檯按鈕上的待辦角標
  const b=document.querySelector('.mainnav [data-nav="floor"] .navbadge');
  const n=(typeof pendingCarry==='function')?pendingCarry().length:0;
  const host=document.querySelector('.mainnav [data-nav="floor"]');
  if(!host)return;
  let el=host.querySelector('.navbadge');
  if(!n){if(el)el.remove();return}
  if(!el){el=document.createElement('span');el.className='navbadge';host.appendChild(el)}
  el.textContent=n;
 };
 window.buildMainNav=function(){
  const nav=document.getElementById('mainnav'); if(!nav)return;
  nav.innerHTML=GROUPS.map(g=>`<button type=button data-nav="${g.id}" onclick="toggleNav('${g.id}')">${g.label}</button>`).join('');
  refreshNavBadges();
 };
 document.addEventListener('click',e=>{
  const p=document.getElementById('navPanel');
  const bar=document.querySelector('header.appbar');
  if(!_open||!p||!bar)return;
  if(bar.contains(e.target))return;
  closeNav();
 });
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',buildMainNav);
 else buildMainNav();
 const _render=window.render;
 if(typeof _render==='function'){/* wrap later */}
 const hook=()=>{try{buildMainNav()}catch(e){}};
 setTimeout(hook,0);
})();
