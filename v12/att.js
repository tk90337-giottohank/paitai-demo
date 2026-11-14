// v12.15 打卡地圖／預設 5 公尺範圍＋GPS 精確度；超出不擋（誤差內不強制待審）
(function(){
const ACC_LOW=100;
const $id=id=>document.getElementById(id);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const hm=ts=>new Date(ts).toLocaleTimeString('zh-TW',{hour12:false,hour:'2-digit',minute:'2-digit'});
function storeGeo(){
  const c=(typeof C==='function'&&C())||{};
  const lat=parseFloat(c.storeLat),lng=parseFloat(c.storeLng),r=parseFloat(c.storeRadiusM);
  return {lat:isFinite(lat)?lat:null,lng:isFinite(lng)?lng:null,radius:isFinite(r)&&r>0?r:5,set:isFinite(lat)&&isFinite(lng)};
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
function mapLink(lat,lng,label){return `<a href="https://www.google.com/maps?q=${lat},${lng}" target="_blank" rel="noopener">${label||(Number(lat).toFixed(5)+', '+Number(lng).toFixed(5))}</a>`}
function fmtCoord(lat,lng){return (Number(lat).toFixed(7)+', '+Number(lng).toFixed(7))}
let _leafletP=null;
function loadLeaflet(){
  if(window.L&&window.L.map)return Promise.resolve(window.L);
  if(_leafletP)return _leafletP;
  _leafletP=new Promise((resolve,reject)=>{
    if(!document.querySelector('link[data-att-leaflet]')){
      const l=document.createElement('link');l.rel='stylesheet';l.dataset.attLeaflet=1;
      l.href='https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';document.head.appendChild(l);
    }
    const s=document.createElement('script');s.src='https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';s.async=true;
    s.onload=()=>resolve(window.L);s.onerror=()=>reject(new Error('地圖套件載入失敗'));document.head.appendChild(s);
  });
  return _leafletP;
}
const _maps={};
function drawMiniMap(elId, lat, lng, opt){
  opt=opt||{};
  const el=document.getElementById(elId); if(!el||lat==null||lng==null)return;
  loadLeaflet().then(L=>{
    if(_maps[elId]){try{_maps[elId].remove()}catch(_){ } delete _maps[elId]}
    el.innerHTML='';
    const z=opt.zoom||19;
    const map=L.map(el,{zoomControl:true,attributionControl:true,scrollWheelZoom:false});
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:20,attribution:'© OpenStreetMap'}).addTo(map);
    map.setView([lat,lng],z);
    L.marker([lat,lng]).addTo(map);
    if(opt.radius>0){
      L.circle([lat,lng],{radius:opt.radius,color:'#2a8',weight:2,fillColor:'#2a8',fillOpacity:0.18}).addTo(map);
    }
    if(opt.acc>0){
      L.circle([lat,lng],{radius:opt.acc,color:'#c80',weight:1,dashArray:'4,4',fill:false}).addTo(map);
    }
    if(opt.store&&opt.store.lat!=null){
      L.circleMarker([opt.store.lat,opt.store.lng],{radius:6,color:'#36f',fillColor:'#36f',fillOpacity:1}).addTo(map);
      if(opt.store.radius>0)L.circle([opt.store.lat,opt.store.lng],{radius:opt.store.radius,color:'#36f',weight:1,fillColor:'#36f',fillOpacity:0.08}).addTo(map);
    }
    setTimeout(()=>map.invalidateSize(),50);
    _maps[elId]=map;
  }).catch(()=>{
    const pad=0.00045;
    el.innerHTML=`<iframe title="map" style="width:100%;height:100%;border:0;border-radius:12px" src="https://www.openstreetmap.org/export/embed.html?bbox=${lng-pad}%2C${lat-pad}%2C${lng+pad}%2C${lat+pad}&layer=mapnik&marker=${lat}%2C${lng}"></iframe>`;
  });
}
function punchViewHtml(p,id){
  const has=p.lat!=null&&p.lng!=null;
  const dist=p.distM!=null?p.distM:null;
  const acc=p.accuracy!=null?p.accuracy:null;
  const g=storeGeo();
  const mid='pm_'+id;
  return `<div class=punchgeo>
    <div>${has?`經緯度 ${esc(fmtCoord(p.lat,p.lng))}`:'無定位'}${dist!=null?`　距店 ${Math.round(dist)} 公尺`:''}${acc!=null?`　GPS 精確度 ±${acc} 公尺`:''}</div>
    ${p.address?`<div style="color:#aaa;font-size:13px">${esc(p.address)}</div>`:''}
    ${has?`<div id="${mid}" class=punchmap data-lat="${p.lat}" data-lng="${p.lng}" data-acc="${acc||''}"></div><div style="font-size:13px">${mapLink(p.lat,p.lng,'開啟地圖')}</div>`:''}
  </div>`;
}
function mountPunchMaps(){
  const g=storeGeo();
  document.querySelectorAll('.punchmap[data-lat]').forEach(el=>{
    drawMiniMap(el.id,+el.dataset.lat,+el.dataset.lng,{zoom:19,acc:+el.dataset.acc||0,store:g.set?g:null});
  });
}
function renderStoreMap(){
  const f=document.getElementById('dform'); if(!f)return;
  const latI=f.querySelector('input[name=storeLat]'),lngI=f.querySelector('input[name=storeLng]'),rI=f.querySelector('input[name=storeRadiusM]');
  if(latI&&(latI.value==='undefined'||latI.value==='null'))latI.value='';
  if(lngI&&(lngI.value==='undefined'||lngI.value==='null'))lngI.value='';
  if(rI&&(!rI.value||rI.value==='undefined'||rI.value==='null'||rI.value==='0'))rI.value='5';
  if(!f.querySelector('#storeMap')){
    const box=document.createElement('div');
    box.innerHTML=`<div id=storeMapBox style="margin:10px 0 16px">
      <p style="color:#aaa;font-size:13px;line-height:1.45">地圖預覽（OpenStreetMap，不必 API 金鑰）：藍點與圓圈＝店家打卡範圍（預設 5 公尺）。手機 GPS 精確度常常大於 5 公尺，打卡會一併記錄並顯示精確度；明顯超出範圍才標記給幹部審核，不會擋打卡。若位置仍在 GPS 誤差內，只註記「可能超出（GPS 誤差內）」，不強制待審。</p>
      <div id=storeMap class=storemap></div>
      <p id=storeMapMeta style="font-size:13px;color:#cfe"></p>
    </div>`;
    const after=rI&&rI.closest('label')||f.querySelector('#attPin')||f;
    if(after&&after.parentNode&&after!==f)after.insertAdjacentElement('afterend',box.firstElementChild);
    else f.insertAdjacentHTML('beforeend',box.innerHTML);
    const redraw=()=>Att.drawStoreMap();
    [latI,lngI,rI].forEach(i=>{if(i){i.addEventListener('change',redraw);i.addEventListener('input',redraw)}});
  }
  setTimeout(()=>Att.drawStoreMap(),0);
}
function canPunch(){
  const p=window.Cloud&&Cloud.status&&Cloud.status();
  const role=(S.cur&&S.cur.role)||(window.Cloud&&Cloud.prof&&Cloud.prof().role);
  // 實際以 Cloud.canPunch 為準
  return typeof Cloud!=='undefined'&&typeof Cloud.canPunch==='function'?Cloud.canPunch():(S.cur&&S.cur.role!=='小姐');
}
function geoHint(){
  const g=storeGeo();
  if(!g.set)return `<p style="background:#5a2030;color:#fcc;padding:10px 12px;border-radius:12px">店家打卡座標尚未設定。請經理以上到「店家設定」填寫緯度、經度與範圍（或按「用目前位置設為店家座標」）。未設定前仍可打卡，但會標記「範圍未設定」給幹部看。</p>`;
  return `<p style="color:#aaa;font-size:13px">店家範圍：半徑 ${g.radius} 公尺（座標 ${fmtCoord(g.lat,g.lng)}）。明顯超出仍可打卡，會標記給幹部審核。手機 GPS 精確度常常大於 5 公尺，每次都會記錄並顯示。</p>`;
}

window.openPunch=function(){
  if(typeof needRole==='function'&&!needRole(1,'打卡'))return;
  if(S.cur&&S.cur.role==='小姐')return alert('小姐請使用獨立報班頁');
  const day=(typeof bizDay==='function'?bizDay(now()):'');
  const punches=(window.HR&&HR.punches||[]).filter(x=>x.day===day);
  const mine=punches.filter(x=>x.uid===(S.cur&&S.cur.uid));
  const flags=punches.filter(x=>(typeof lvl==='function'?lvl()>=2:false)&&(x.review==='待審'||(x.flags||[]).some(f=>f==='超出範圍'||f==='範圍未設定'||f==='定位精確度低')));
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
    ${mine.length?mine.slice().reverse().map(p=>`<div class=punchcard><div><b>${hm(p.clientAt||p.at)}</b>　${p.type==='in'?'上班':'下班'}　${esc((p.flags||[]).join('、')||'正常')}${p.review==='待審'?' · 待審':p.review==='已核'?' · 已核':p.review==='異常'?' · 異常':''}</div>${punchViewHtml(p,p.id||('m'+p.at))}</div>`).join(''):'<p style="color:#888">尚無紀錄</p>'}
    ${typeof lvl==='function'&&lvl()>=2?`<h3>幹部審核（明顯超出範圍／精確度低／範圍未設定）</h3>
      ${flags.length?flags.map(p=>`<div class=punchcard><div><b>${esc(p.name||'')} ${esc(p.staffId||'')}</b>　${hm(p.clientAt||p.at)}　${p.type==='in'?'上班':'下班'}　${esc((p.flags||[]).join('、'))}
        <button class=s type=button onclick="Att.review('${p.id}','已核')">通過</button> <button class=s type=button onclick="Att.review('${p.id}','異常')">異常</button></div>${punchViewHtml(p,p.id)}</div>`).join(''):'<p style="color:#888">目前沒有待審打卡</p>'}
      <h3>幹部：今日全部打卡紀錄</h3>
      ${punches.length?punches.slice().reverse().map(p=>`<div class=punchcard><div><b>${esc(p.name||'')} ${esc(p.staffId||'')}</b>　${hm(p.clientAt||p.at)}　${p.type==='in'?'上班':'下班'}　${esc((p.flags||[]).join('、')||'正常')}${p.review?(' · '+esc(p.review)):''}</div>${punchViewHtml(p,'all_'+(p.id||p.at))}</div>`).join(''):'<p style="color:#888">今日尚無打卡</p>'}
      ${ (S.girlCancelReq||[]).length?`<h3>小姐取消報班（已有番，需人工處理）</h3><ul>${(S.girlCancelReq||[]).map((x,i)=>`<li>${esc(x.day||'')} ${esc(x.girlId)} ${esc(x.name||'')} ${x.at?hm(x.at):''} <button class=s type=button onclick="Att.ackCancel(${i})">已處理</button></li>`).join('')}</ul>`:''}
    `:''}
    <p style="margin-top:16px"><button class=s type=button onclick="openLeave()">請假</button> <button class=s type=button onclick="openWeekSched()">本週排班</button> ${typeof lvl==='function'&&lvl()>=2?'<button class=s type=button onclick="openSched()">月排班表</button>':''}</p>
  </div>`);
  tick();
  mountPunchMaps();
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
  storeGeo,distanceM,getPosition,reverseAddress,mapLink,fmtCoord,renderStoreMap,drawMiniMap,
  drawStoreMap(){
    const f=document.getElementById('dform'); if(!f)return;
    const lat=parseFloat(f.querySelector('input[name=storeLat]')&&f.querySelector('input[name=storeLat]').value);
    const lng=parseFloat(f.querySelector('input[name=storeLng]')&&f.querySelector('input[name=storeLng]').value);
    const rad=parseFloat(f.querySelector('input[name=storeRadiusM]')&&f.querySelector('input[name=storeRadiusM]').value);
    const r=isFinite(rad)&&rad>0?rad:5;
    const meta=document.getElementById('storeMapMeta'), el=document.getElementById('storeMap');
    if(!isFinite(lat)||!isFinite(lng)){
      if(meta)meta.textContent='尚未填寫店家經緯度。可手動輸入，或按「用目前位置設為店家打卡座標」。';
      if(el)el.innerHTML='<p style="color:#aaa;padding:20px;text-align:center">填入座標後會顯示地圖與 5 公尺範圍圓圈</p>';
      return;
    }
    if(meta)meta.textContent='店家座標 '+fmtCoord(lat,lng)+'　範圍半徑 '+r+' 公尺';
    if(el)drawMiniMap('storeMap',lat,lng,{zoom:19,radius:r});
  },

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
      let dist=null,inRange=null,needsReview=false;
      if(!g.set){flags.push('範圍未設定');needsReview=true}
      else{
        dist=distanceM(pos.lat,pos.lng,g.lat,g.lng);
        inRange=dist!=null&&dist<=g.radius;
        if(inRange===false){
          const acc=pos.accuracy||0;
          if((dist-acc)>g.radius){flags.push('超出範圍');needsReview=true}
          else flags.push('可能超出（GPS 誤差內）');
        }
      }
      if(pos.accuracy>ACC_LOW){flags.push('定位精確度低');needsReview=true}
      const rec={
        type,lat:+pos.lat.toFixed(7),lng:+pos.lng.toFixed(7),accuracy:pos.accuracy,
        posTs:pos.posTs||Date.now(),address,distM:dist==null?null:Math.round(dist),
        inRange,flags,needsReview,ua:(navigator.userAgent||'').slice(0,240)
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
    if(!C().storeRadiusM)C().storeRadiusM=5;
    if(typeof log==='function')log('店家打卡座標已設為目前位置（±'+pos.accuracy+'m）');
    if(typeof save==='function')save();
    alert('已把目前位置設為店家座標（半徑 '+(C().storeRadiusM||5)+' 公尺）。請再按一次「儲存」確認店家設定。');
    if(typeof openSettings==='function')openSettings();
  }
};

window.HR=window.HR||{punches:[],leaves:[]};
})();
