// v12.27 具名 Auth 正確處理 Google redirect（不另開 [DEFAULT]、不重設 persistence）
// v12.26 三個頁面各自獨立的 Firebase Auth 工作階段（staff／girl／room）
import {firebaseConfig} from './firebase-config.js';
import {initializeApp,getApp,getApps} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js';
import {initializeAuth,getAuth,onAuthStateChanged,signOut,connectAuthEmulator,getRedirectResult,
  indexedDBLocalPersistence,browserLocalPersistence,browserPopupRedirectResolver} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
import {getFirestore,doc,getDoc,connectFirestoreEmulator} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';

const EMU=typeof location!=='undefined'&&/[?&]emu=1/.test(location.search);

export function bootNamedApp(name){
  const app=getApps().some(a=>a.name===name)?getApp(name):initializeApp(firebaseConfig,name);
  let auth;
  try{
    // 具名 app 必須明確帶 popupRedirectResolver，否則 iOS redirect 回來對不到這個 auth。
    // 在這裡一次設好 persistence，之後不要再 setPersistence，以免跟 getRedirectResult 搶。
    auth=initializeAuth(app,{
      persistence:[indexedDBLocalPersistence,browserLocalPersistence],
      popupRedirectResolver:browserPopupRedirectResolver
    });
  }catch(e){
    auth=getAuth(app);
  }
  if(EMU){try{connectAuthEmulator(auth,'http://127.0.0.1:9099',{disableWarnings:true})}catch(e){}}
  return {app,auth};
}

// 等目前使用者與（若有）Google redirect 結果都就緒後，才決定要不要顯示登入頁。
export function authReady(auth){
  const ready=auth&&typeof auth.authStateReady==='function'?auth.authStateReady():Promise.resolve();
  const redir=auth?getRedirectResult(auth).catch(()=>null):Promise.resolve(null);
  return Promise.all([ready,redir]);
}

// 升級前共用的 [DEFAULT] 工作階段：主程式／報班頁若偵測到房間平板帳號就登出它。
// 若本機沒有 [DEFAULT] app，不要新建——新建會跟具名 app 搶走 iOS 的 signInWithRedirect 結果。
export async function clearLegacyDefaultSession(rolesToClear){
  const want=new Set(rolesToClear&&rolesToClear.length?rolesToClear:['room']);
  try{
    if(!getApps().some(a=>a.name==='[DEFAULT]'))return;
    const def=getApp();
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
