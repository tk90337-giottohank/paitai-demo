// v12.14 少爺／公主打卡（參照鴻昇：每次重取 GPS、反查地址、紀錄裝置）＋請假＋週排班
(function(){
const ACC_LOW=100;
const $id=id=>document.getElementById(id);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const hm=ts=>new Date(ts).toLocaleTimeString('zh-TW',{hour12:false,hour:'2-digit',minute:'2-digit'});
function storeGeo(){
  const c=(typeof C==='function'&&C())||{};
  const lat=parseFloat(c.storeLat),lng=parseFloat(c.storeLng),r=parseFloat(c.storeRadiusM);
  return {lat:isFinite(lat)?lat:null,lng:isFinite(lng)?lng:null,radius:isFinite(r)&&r>0?r:200,set:isFinite(lat)&&isFinite(lng)};
}
function distanceM(a,b,c,d){
  if([a,b,c,d].some(v=>typeof v!=='number'||!isFinite(v)))return null;
  const R=6371008.8,r=x=>x*Math.PI/180,dLat=r(c-a),dLng=r(d-b);
  const x=Math.sin(dLat/2)**2+Math.cos(r(a))*Math.cos(r(c))*Math.sin(dLng/2)**2;
  return 2*R*Math.asin(Math.min(1,Math.sqrt(x)));
}
function getPosition(){
  return new Promise(resolve=>{
    if(!navigator.geolocation)return resolve({error:'此瀏覽器不支援定位，請改用 iPhone 的 Safari 或 Chrome。'});
    navigator.geolocation.getCurrentPosition(
      p=>resolve({lat:p.coords.latitude,lng:p.coords.longitude,accuracy:Math.round(p.coords.accuracy||0),posTs:Math.round(p.timestamp||0)}),
      e=>resolve({error:e.code===1?'未允許定位。請到「設定 › 隱私權 › 定位服務」開啟，並允許此網站使用位置後再打卡。':(e.code===3?'定位逾時，請移到收訊較好處再試。':'無法取得位置，請確認手機定位已開啟。')}),
      {enableHighAccuracy:true,timeout:20000,maximumAge:0});
  });
}
async function reverseAddress(lat,lng){
  try{
    const ctl=new AbortController(),t=setTimeout(()=>ctl.abort(),3000);
    const r=await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=18&accept-language=zh-TW&lat=${lat}&lon=${lng}`,{signal:ctl.signal,headers:{Accept:'application/json'}});
    clearTimeout(t);if(!r.ok)return '';
    const j=await r.json(),a=j.address||{};
    const parts=[a.city||a.county||a.state||'',a.city_district||a.suburb||a.town||'',a.road||'',a.house_number?a.house_number+'號':''].filter(Boolean);
    return (parts.join('')||j.display_name||'').slice(0,120);
  }catch(_){return ''}
}
function mapLink(lat,lng,label){return `<a href="https://www.google.com/maps?q=${lat},${lng}" target="_blank" rel="noopener">${label||(lat.toFixed(5)+', '+lng.toFixed(5))}</a>`}
function canPunch(){
  const p=window.Cloud&&Cloud.status&&Cloud.status();
  const role=(S.cur&&S.cur.role)||(window.Cloud&&Cloud.prof&&Cloud.prof().role);
  // 實際以 Cloud.canPunch 為準
  return typeof Cloud!=='undefined'&&typeof Cloud.canPunch==='function'?Cloud.canPunch():(S.cur&&S.cur.role!=='小姐');
}
function geoHint(){
  const g=storeGeo();
  if(!g.set)return `<p style="background:#5a2030;color:#fcc;padding:10px 12px;border-radius:12px">店家打卡座標尚未設定。請經理以上到「店家設定」填寫緯度、經度與範圍（或按「用目前位置設為店家座標」）。未設定前仍可打卡，但會標記「範圍未設定」給幹部看。</p>`;
  return `<p style="color:#aaa;font-size:13px">店家範圍：半徑 ${g.radius} 公尺。超出範圍仍可打卡，會標記給幹部審核。</p>`;
}

window.openPunch=function(){
  if(typeof needRole==='function'&&!needRole(1,'打卡'))return;
  if(S.cur&&S.cur.role==='小姐')return alert('小姐請使用獨立報班頁');
  const day=(typeof bizDay==='function'?bizDay(now()):'');
  const punches=(window.HR&&HR.punches||[]).filter(x=>x.day===day);
  const mine=punches.filter(x=>x.uid===(S.cur&&S.cur.uid));
  const flags=punches.filter(x=>((x.flags||[]).length||x.review==='待審')&&(typeof lvl==='function'?lvl()>=2:false));
  const lastIn=[...mine].reverse().find(x=>x.type==='in');
  const lastOut=[...mine].reverse().find(x=>x.type==='out');
  const state=lastIn&&(!lastOut||lastOut.at>=lastIn.at||(lastOut.clientAt||0)<(lastIn.clientAt||0))?'已上班':'未上班';
  pageOpen(`<div class=attw><h2>上下班打卡</h2>
    <p class=attclk id=attClock></p>
    <p>今日營業日 <b>${esc(day)}</b>（07:10 分界）· 目前：<b>${state}</b></p>
    ${geoHint()}
    <p id=attStatus style="min-height:1.4em;color:#9cf"></p>
    <div class=attbtns>
      <button type=button class=attin onclick="Att.punch('in')">上班打卡</button>
      <button type=button class=attout onclick="Att.punch('out')">下班打卡</button>
    </div>
    <h3>我的今日紀錄</h3>
    ${mine.length?`<div class=tw><table class=sch><tr><th>時間</th><th>進／出</th><th>位置</th><th>狀態</th></tr>${mine.slice().reverse().map(p=>`<tr><td>${hm(p.clientAt||p.at)}</td><td>${p.type==='in'?'上班':'下班'}</td><td>${p.lat!=null?mapLink(p.lat,p.lng,(p.address||'地圖')+' ±'+(p.accuracy||'?')+'m'):'—'}</td><td>${esc((p.flags||[]).join('、')||'正常')}${p.review==='待審'?' · 待審':p.review==='已核'?' · 已核':''}</td></tr>`).join('')}</table></div>`:'<p style="color:#888">尚無紀錄</p>'}
    ${typeof lvl==='function'&&lvl()>=2?`<h3>幹部審核（超出範圍／精確度低／範圍未設定）</h3>
      ${flags.length?`<div class=tw><table class=sch><tr><th>人員</th><th>時間</th><th>位置</th><th>標記</th><th></th></tr>${flags.map(p=>`<tr><td>${esc(p.name||'')} ${esc(p.staffId||'')}</td><td>${hm(p.clientAt||p.at)}</td><td>${p.lat!=null?mapLink(p.lat,p.lng,(p.address||'')+(p.distM!=null?' · '+Math.round(p.distM)+'m':'')):''}</td><td>${esc((p.flags||[]).join('、'))}</td><td><button class=s type=button onclick="Att.review('${p.id}','已核')">通過</button> <button class=s type=button onclick="Att.review('${p.id}','異常')">異常</button></td></tr>`).join('')}</table></div>`:'<p style="color:#888">目前沒有待審打卡</p>'}
      ${ (S.girlCancelReq||[]).length?`<h3>小姐取消報班（已有番，需人工處理）</h3><ul>${(S.girlCancelReq||[]).map((x,i)=>`<li>${esc(x.day||'')} ${esc(x.girlId)} ${esc(x.name||'')} ${x.at?hm(x.at):''} <button class=s type=button onclick="Att.ackCancel(${i})">已處理</button></li>`).join('')}</ul>`:''}
    `:''}
    <p style="margin-top:16px"><button class=s type=button onclick="openLeave()">請假</button> <button class=s type=button onclick="openWeekSched()">本週排班</button> ${typeof lvl==='function'&&lvl()>=2?'<button class=s type=button onclick="openSched()">月排班表</button>':''}</p>
  </div>`);
  tick();
};
function tick(){const el=$id('attClock');if(el)el.textContent=new Date().toLocaleTimeString('zh-TW',{hour12:false,timeZone:'Asia/Taipei'})+'（台北時間）'}
setInterval(tick,1000);

window.openLeave=function(){
  if(typeof needRole==='function'&&!needRole(1,'請假'))return;
  const mine=(window.HR&&HR.leaves||[]).filter(x=>x.uid===(S.cur&&S.cur.uid));
  const pend=(window.HR&&HR.leaves||[]).filter(x=>x.status==='待核准');
  const today=(typeof bizDay==='function'?bizDay(now()):'');
  pageOpen(`<div class=attw><h2>請假</h2>
    <form onsubmit="Att.askLeave(event)" class=lvform>
      <label>假別 <select name=kind><option>事假</option><option>病假</option><option>特休</option><option>其他</option></select></label>
      <label>開始 <input name=start type=date required value="${today}"></label>
      <label>結束 <input name=end type=date required value="${today}"></label>
      <label>說明 <input name=note maxlength=80 placeholder="選填"></label>
      <button type=submit>送出請假（待幹部核准）</button>
    </form>
    <h3>我的假單</h3>
    ${mine.length?`<div class=tw><table class=sch><tr><th>期間</th><th>假別</th><th>狀態</th><th></th></tr>${mine.map(l=>`<tr><td>${esc(l.start)}～${esc(l.end)}</td><td>${esc(l.kind||'')}</td><td>${esc(l.status)}</td><td>${l.status==='待核准'?`<button class=s type=button onclick="Att.cancelLeave('${l.id}')">撤回</button>`:''}</td></tr>`).join('')}</table></div>`:'<p style="color:#888">尚無假單</p>'}
    ${typeof lvl==='function'&&lvl()>=2?`<h3>待核准（幹部以上）</h3>
      ${pend.length?`<div class=tw><table class=sch><tr><th>人員</th><th>期間</th><th>假別</th><th>說明</th><th></th></tr>${pend.map(l=>`<tr><td>${esc(l.name||'')} ${esc(l.staffId||'')}</td><td>${esc(l.start)}～${esc(l.end)}</td><td>${esc(l.kind||'')}</td><td>${esc(l.note||'')}</td><td><button type=button onclick="Att.decideLeave('${l.id}',true)">核准</button> <button class=s type=button onclick="Att.decideLeave('${l.id}',false)">駁回</button></td></tr>`).join('')}</table></div>`:'<p style="color:#888">沒有待核准假單</p>'}`:''}
    <p><button class=s type=button onclick="openPunch()">← 打卡</button> <button class=s type=button onclick="openWeekSched()">本週排班</button></p>
  </div>`);
};

function weekStart(ts){
  const d=new Date(ts);const dow=d.getDay();const mon=new Date(d);mon.setDate(d.getDate()-(dow===0?6:dow-1));mon.setHours(12,0,0,0);return mon;
}
let wkAnchor=null;
window.openWeekSched=function(shift){
  if(typeof needRole==='function'&&!needRole(1,'排班'))return;
  if(shift) {wkAnchor=new Date(wkAnchor||Date.now());wkAnchor.setDate(wkAnchor.getDate()+shift*7)}
  if(!wkAnchor)wkAnchor=weekStart(now());
  const start=weekStart(+wkAnchor);
  const days=[...Array(7)].map((_,i)=>{const x=new Date(start);x.setDate(start.getDate()+i);return x});
  const canEdit=typeof lvl==='function'&&lvl()>=2;
  const staff=S.staff||[];
  const wk='一二三四五六日';
  const SC0=['','上班','休','請假','曠職'];
  const SCC={上班:'#1a4a32',休:'#333',請假:'#5a4030',曠職:'#5a2030'};
  pageOpen(`<div class=attw><h2>本週排班</h2>
    <p><button class=s type=button onclick="openWeekSched(-1)">← 上週</button>
      <b>${dkey(days[0])}～${dkey(days[6])}</b>
      <button class=s type=button onclick="openWeekSched(1)">下週 →</button>
      ${canEdit?'<button class=s type=button onclick="openSched()">完整月表</button>':''}</p>
    <p style="font-size:13px;color:#aaa">${canEdit?'點格子循環：上班→休→請假→曠職→空白（與月排班同一份資料）。':'只看自己的班表。'}</p>
    <div class=tw><table class=sch><tr><th>編號</th><th>姓名</th>${days.map(d=>`<th>${d.getMonth()+1}/${d.getDate()}<br>${wk[d.getDay()===0?6:d.getDay()-1]}</th>`).join('')}</tr>
    ${staff.filter(s=>canEdit||s.id===(S.cur&&(S.cur.staffId||''))||(S.cur&&S.cur.name&&s.name===S.cur.name)).map(s=>{
      return `<tr><td>${esc(s.id)}</td><td>${esc(s.name)}</td>${days.map(d=>{
        const month=dkey(d).slice(0,7),day=d.getDate();
        const c=((S.sched[month]||{})[s.id]||{})[day]||{};
        const label=(c.st||'')+(c.sh?'/'+c.sh:'');
        return `<td style="${c.st?'background:'+SCC[c.st]:''}" ${canEdit?`onclick="Att.tapSched('${s.id}','${month}',${day})"`:''}>${esc(label?label[0]+(c.sh||''):'')}</td>`;
      }).join('')}</tr>`;
    }).join('')||'<tr><td colspan="9">尚無少爺名冊</td></tr>'}
    </table></div>
    <p><button class=s type=button onclick="openPunch()">← 打卡</button> <button class=s type=button onclick="openLeave()">請假</button></p>
  </div>`);
};

window.Att={
  storeGeo,distanceM,getPosition,reverseAddress,mapLink,
  async punch(type){
    const st=$id('attStatus');
    if(st)st.textContent='正在取得目前位置（GPS）…';
    document.querySelectorAll('.attbtns button').forEach(b=>b.disabled=true);
    try{
      const pos=await getPosition();
      if(pos.error){if(st)st.innerHTML='<span style="color:#f88">無法打卡：'+esc(pos.error)+'</span>';return}
      if(st)st.textContent='已定位（±'+pos.accuracy+' 公尺），查詢大概地址…';
      const address=await reverseAddress(pos.lat,pos.lng);
      const g=storeGeo(),flags=[];
      let dist=null,inRange=null;
      if(!g.set)flags.push('範圍未設定');
      else{
        dist=distanceM(pos.lat,pos.lng,g.lat,g.lng);
        inRange=dist!=null&&dist<=g.radius;
        if(inRange===false)flags.push('超出範圍');
      }
      if(pos.accuracy>ACC_LOW)flags.push('定位精確度低');
      const rec={
        type,lat:+pos.lat.toFixed(7),lng:+pos.lng.toFixed(7),accuracy:pos.accuracy,
        posTs:pos.posTs||Date.now(),address,distM:dist==null?null:Math.round(dist),
        inRange,flags,ua:(navigator.userAgent||'').slice(0,240)
      };
      await Cloud.writePunch(rec);
      if(st)st.innerHTML=`${type==='in'?'上班':'下班'}打卡完成 · ${new Date().toLocaleTimeString('zh-TW',{hour12:false})}${flags.length?' · <b style="color:#fc6">'+esc(flags.join('、'))+'</b>（已送幹部審核）':''}${address?' · '+esc(address):''}`;
      openPunch();
    }catch(e){if(st)st.textContent='打卡失敗：'+(e.message||e.code||e)}
    finally{document.querySelectorAll('.attbtns button').forEach(b=>b.disabled=false)}
  },
  async review(id,v){
    const note=prompt(v==='已核'?'備註（可空白）':'說明', '') ; if(note===null)return;
    await Cloud.reviewPunch(id,v,note||''); openPunch();
  },
  ackCancel(i){S.girlCancelReq=(S.girlCancelReq||[]).filter((_,j)=>j!==i);if(typeof save==='function')save();openPunch()},
  tapSched(sid,month,day){
    const SC=['','上班','休','請假','曠職'];
    const m=(S.sched[month]=S.sched[month]||{}),row=(m[sid]=m[sid]||{}),c=row[day]||{st:''};
    c.st=SC[(SC.indexOf(c.st)+1)%SC.length];
    if(!c.st&&!c.sh)delete row[day];else row[day]=c;
    if(typeof save==='function')save();
    openWeekSched(0);
  },
  async askLeave(ev){
    ev.preventDefault();
    const f=ev.target,kind=f.kind.value,start=f.start.value,end=f.end.value,note=f.note.value.trim();
    if(end<start)return alert('結束日不能早於開始日');
    await Cloud.askLeave({kind,start,end,note});
    openLeave();
  },
  async cancelLeave(id){if(!confirm('撤回這張假單？'))return;await Cloud.cancelLeave(id);openLeave()},
  async decideLeave(id,ok){
    const note=prompt(ok?'核准意見（可空白）':'駁回原因（必填）','');
    if(note===null)return; if(!ok&&!note.trim())return alert('駁回請填原因');
    await Cloud.decideLeave(id,ok,note||''); openLeave();
  },
  async pinStore(){
    if(typeof needRole==='function'&&!needRole(3,'設定店家座標'))return;
    const st=document.getElementById('attPinSt');
    if(st)st.textContent='正在取位置…';
    const pos=await getPosition();
    if(pos.error)return alert(pos.error);
    C().storeLat=+pos.lat.toFixed(7); C().storeLng=+pos.lng.toFixed(7);
    if(!C().storeRadiusM)C().storeRadiusM=200;
    if(typeof log==='function')log('店家打卡座標已設為目前位置（±'+pos.accuracy+'m）');
    if(typeof save==='function')save();
    alert('已把目前位置設為店家座標（半徑 '+(C().storeRadiusM||200)+' 公尺）。請再按一次「儲存」確認店家設定。');
    if(typeof openSettings==='function')openSettings();
  }
};

window.HR=window.HR||{punches:[],leaves:[]};
})();
