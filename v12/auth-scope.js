// v12.26 三個頁面各自獨立的 Firebase Auth 工作階段（staff／girl／room）
// 具名 app 的 persistence key 含 app 名稱，同一個瀏覽器互不覆蓋。
import {firebaseConfig} from './firebase-config.js';
import {initializeApp,getApp,getApps} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js';
import {getAuth,onAuthStateChanged,signOut,connectAuthEmulator,setPersistence,browserLocalPersistence} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
import {getFirestore,doc,getDoc,connectFirestoreEmulator} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';

const EMU=typeof location!=='undefined'&&/[?&]emu=1/.test(location.search);

export function bootNamedApp(name){
  const app=getApps().some(a=>a.name===name)?getApp(name):initializeApp(firebaseConfig,name);
  const auth=getAuth(app);
  if(EMU){try{connectAuthEmulator(auth,'http://127.0.0.1:9099',{disableWarnings:true})}catch(e){}}
  setPersistence(auth,browserLocalPersistence).catch(()=>{});
  return {app,auth};
}

// 升級前共用的 [DEFAULT] 工作階段：主程式／報班頁若偵測到房間平板帳號就登出它，避免舊 session 把本頁當成包廂頁。
// 不把舊 session 搬到新的具名 app（升級後各頁需各登入一次）。
export async function clearLegacyDefaultSession(rolesToClear){
  const want=new Set(rolesToClear&&rolesToClear.length?rolesToClear:['room']);
  try{
    const existed=getApps().some(a=>a.name==='[DEFAULT]');
    const def=existed?getApp():initializeApp(firebaseConfig);
    const da=getAuth(def);
    if(EMU){try{connectAuthEmulator(da,'http://127.0.0.1:9099',{disableWarnings:true})}catch(e){}}
    const u=await new Promise(res=>{
      let done=false;
      const fin=x=>{if(done)return;done=true;try{unsub()}catch(e){}clearTimeout(tid);res(x)};
      const unsub=onAuthStateChanged(da,user=>fin(user||null),()=>fin(null));
      const tid=setTimeout(()=>fin(da.currentUser||null),2500);
    });
    if(!u)return;
    let role='';
    try{
      const ddb=getFirestore(def);
      if(EMU){try{connectFirestoreEmulator(ddb,'127.0.0.1',8080)}catch(e){}}
      const s=await getDoc(doc(ddb,'users',u.uid));
      role=s.exists()?String((s.data()||{}).role||''):'';
    }catch(e){return}
    if(want.has(role))await signOut(da).catch(()=>{});
  }catch(e){}
}
