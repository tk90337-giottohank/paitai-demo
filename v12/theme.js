// v12.24 外觀：深色／淺色／跟隨系統（記在本機）
(function(){
  const KEY='paitai-theme';
  function mode(){try{return localStorage.getItem(KEY)||'system'}catch(e){return 'system'}}
  function systemLight(){try{return !!(window.matchMedia&&matchMedia('(prefers-color-scheme:light)').matches)}catch(e){return false}}
  function resolved(m){m=m||mode();return (m==='light'||(m!=='dark'&&systemLight()))?'light':'dark'}
  function paintChoices(m){
    document.querySelectorAll('[data-theme-choice]').forEach(b=>b.classList.toggle('on',b.getAttribute('data-theme-choice')===(m||mode())));
  }
  function apply(m){
    m=m||mode();
    const r=resolved(m);
    const root=document.documentElement;
    root.setAttribute('data-theme',r);
    root.setAttribute('data-theme-pref',m);
    root.style.colorScheme=r;
    let meta=document.querySelector('meta[name="theme-color"]');
    if(!meta){meta=document.createElement('meta');meta.name='theme-color';document.head.appendChild(meta)}
    meta.content=r==='light'?'#f3efe6':'#1a1e26';
    paintChoices(m);
  }
  function setMode(m){try{localStorage.setItem(KEY,m)}catch(e){}apply(m)}
  window.PaitaiTheme={mode,resolved,apply,setMode,KEY};
  apply(mode());
  try{matchMedia('(prefers-color-scheme:light)').addEventListener('change',()=>{if(mode()==='system')apply('system')})}catch(e){}
})();
