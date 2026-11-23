// v12.28 傳統排檯表照片：瀏覽器端 Firebase AI Logic（Gemini Developer API）辨識
// 僅幹部以上、已登入的具名 staff app 可呼叫。結果只回傳草稿，不寫入 days。
import {getAI,getGenerativeModel,GoogleAIBackend,Schema} from 'https://www.gstatic.com/firebasejs/12.6.0/firebase-ai.js';

export const SHEET_AI_MODEL='gemini-flash-latest';

export const SHEET_AI_PROMPT=`你是夜店／酒店傳統「排檯表」讀表專家。請只根據照片辨識，輸出純 JSON（不要 markdown 圍欄）。
規則：藍勾 V=藍；紅勾 V=紅；紅圈中間 4 或紅勾中間 4=私檯；紅圈勾=訂番。
「正」=人數5，「止」或未寫完的正=人數4，「一」=1。不確定請標 uncertain。
每個小姐格子請「先讀編號、再讀中文名字」，兩者分開輸出，不要合併成一個字串，也不要用名字去改編號。
- id：格子上的小姐編號（主鍵）。看不清就留空，並設 id_uncertain=true。不要猜編號。
- paper_name：照片上寫的中文名字原文（OCR 原樣，含潦草或錯字）。不要改成你認為的正確藝名，也不要因為名字不像而改 id。
- 編號清楚但名字看不清：id 照填，paper_name 留空。
請盡力從紙本讀出營業日（年月日，輸出 day 為 YYYY-MM-DD）。若只寫月日，年份用提示的營業日年份（沒有提示則不要亂猜，並設 day_uncertain=true）。看不清或沒寫日期：day 留空並設 day_uncertain=true，不要捏造日期。
包廂號碼照實抄（例如 101 不要改成別的房）。包廂只有 101,102,103,105,106,201,202,203。
只列出有記號的格子；若某一番只有包廂與時間、沒有小姐記號，仍要列出該番。
後端會用編號對名冊填正式名字，再用 paper_name 交叉核對；你不必對名冊、不必校正名字。
輸出：
{"day":"YYYY-MM-DD 或空","day_uncertain":false,"columns":[{"id":"93","paper_name":"依琳"}],
 "sessions":[{"seq":1,"room":"105","guests":1,"guests_raw":"一","time":"20:15","ended":false,
   "marks":[{"id":"57","paper_name":"冰冰","type":"藍","uncertain":false,"id_uncertain":false,"note":""}],"uncertain":[]}],
 "notes":[]}
`;

const markSchema=Schema.object({
  properties:{
    id:Schema.string(),
    paper_name:Schema.string(),
    type:Schema.enumString({enum:['紅','藍','私檯','訂番']}),
    uncertain:Schema.boolean(),
    id_uncertain:Schema.boolean(),
    note:Schema.string()
  },
  optionalProperties:['id','paper_name','uncertain','id_uncertain','note']
});
const sessionSchema=Schema.object({
  properties:{
    seq:Schema.integer(),
    room:Schema.string(),
    guests:Schema.integer(),
    guests_raw:Schema.string(),
    time:Schema.string(),
    ended:Schema.boolean(),
    marks:Schema.array({items:markSchema}),
    uncertain:Schema.array({items:Schema.string()}),
    guests_uncertain:Schema.boolean(),
    orderStaff:Schema.string()
  },
  optionalProperties:['guests','guests_raw','time','ended','marks','uncertain','guests_uncertain','orderStaff','room']
});
const sheetSchema=Schema.object({
  properties:{
    day:Schema.string(),
    day_uncertain:Schema.boolean(),
    columns:Schema.array({items:Schema.object({
      properties:{id:Schema.string(),paper_name:Schema.string()},
      optionalProperties:['paper_name']
    })}),
    sessions:Schema.array({items:sessionSchema}),
    notes:Schema.array({items:Schema.string()})
  },
  optionalProperties:['day','day_uncertain','columns','notes']
});

function dataUrlToParts(dataUrl){
  const s=String(dataUrl||'');
  const m=s.match(/^data:([^;]+);base64,(.*)$/s);
  if(m)return {mime:m[1]||'image/jpeg',b64:m[2]};
  if(s)return {mime:'image/jpeg',b64:s};
  return null;
}

function parseTime(s){
  s=String(s||'').trim().replace(/：/g,':').replace(/=/g,':').replace(/\./g,':');
  if(/^\d{3,4}$/.test(s)){
    s=s.padStart(4,'0');
    return [parseInt(s.slice(0,2),10),parseInt(s.slice(2),10)];
  }
  const m=s.match(/^(\d{1,2}):(\d{2})$/);
  if(m)return [parseInt(m[1],10),parseInt(m[2],10)];
  return null;
}

function normName(s){
  return String(s||'').trim().replace(/\s+/g,'').replace(/^\d+號?/,'');
}
function namesAgree(ocr,official){
  const a=normName(ocr),b=normName(official);
  if(!a||!b)return null;
  return a===b;
}
function rosterLookup(roster,gid){
  gid=String(gid||'').trim();
  if(!gid)return ['',''];
  const key=/^\d+$/.test(gid)?gid.padStart(2,'0'):gid;
  const official=roster[key]||roster[gid]||roster[gid.replace(/^0+/,'')||gid]||'';
  return [/^\d+$/.test(gid)?key:gid,official];
}
function nameIndex(roster){
  const idx={},seen=new Set();
  Object.keys(roster||{}).forEach(gid=>{
    if(!/^\d+$/.test(gid))return;
    const key=gid.padStart(2,'0');
    if(seen.has(key))return;
    seen.add(key);
    const nm=normName(roster[gid]);
    if(nm)(idx[nm]=idx[nm]||[]).push(key);
  });
  return idx;
}

export function applyRosterNames(draft,roster){
  roster=roster||{};
  const idx=nameIndex(roster);
  const tbd=Array.isArray(draft.tbd)?draft.tbd.slice():[];
  const unk=Array.isArray(draft.unk)?draft.unk.slice():[];
  (draft.marks||[]).forEach(m=>{
    while(m.length<7)m.push('');
    const rawId=String(m[1]||'').trim();
    const ocr=m[5]||'';
    let [gid,official]=rosterLookup(roster,rawId);
    const note=extra=>{m[4]=m[4]?(String(m[4])+'；'+extra):extra};
    const yellow=(extra,alsoUnk)=>{
      const cur=parseFloat(m[3]===''||m[3]==null?1:m[3]);
      m[3]=Math.min(isNaN(cur)?1:cur,0.45);
      note(extra);
      tbd.push('序'+m[0]+' '+extra);
      if(alsoUnk)unk.push(alsoUnk);
    };
    if(gid&&official){
      m[1]=gid;m[6]=official;
      if(namesAgree(ocr,official)===false)yellow(gid+' '+ocr+' → 名單:'+official);
    }else if(gid&&!official){
      m[1]=gid;m[6]='';
      yellow('號碼 '+gid+' 不在名冊'+(ocr?'（紙本寫「'+ocr+'」）':''),'序'+m[0]+' 小姐「'+gid+'」不在名冊（核對時可改）');
    }else{
      const key=normName(ocr);
      const cands=(idx[key]||[]).slice();
      if(cands.length===1){
        gid=cands[0];official=roster[gid]||roster[gid.replace(/^0+/,'')||gid]||'';
        m[1]=gid;m[6]=official;
        yellow('號碼看不清，依名字「'+ocr+'」對上 '+gid+' '+(official||'')+'，請核對');
      }else if(cands.length>1){
        yellow('號碼看不清，名字「'+(ocr||'?')+'」對到多個號碼 '+cands.join('、'));
      }else{
        yellow('號碼看不清'+(ocr?'，名字「'+ocr+'」對不上名冊':''),'序'+m[0]+' 號碼看不清'+(ocr?'（紙本寫「'+ocr+'」）':''));
      }
    }
  });
  draft.tbd=tbd;draft.unk=unk;
  return draft;
}

export function toDraft(rawText,dayHint){
  let text=String(rawText||'').trim().replace(/^```(?:json)?\s*|\s*```$/g,'');
  let obj={};
  try{obj=JSON.parse(text)}catch(e){
    const m=text.match(/\{[\s\S]*\}/);
    if(m){try{obj=JSON.parse(m[0])}catch(e2){obj={}}}
  }
  let day=obj.day||dayHint||'';
  if(day&&!/^\d{4}-\d{2}-\d{2}/.test(String(day)))day=dayHint||'';
  const rows={},marks=[],tbd=[],bad=[];
  (obj.sessions||[]).forEach(s=>{
    const seq=String(s.seq||'');
    if(!seq)return;
    const tm=parseTime(s.time);
    const room=String(s.room||'?');
    const guests=s.guests;
    const conf=(s.guests_uncertain||(s.uncertain&&s.uncertain.length)||!tm||room==='?')?0.4:1;
    let note=(s.uncertain||[]).join('；');
    if(s.guests_raw)note=(note+' 人數「'+s.guests_raw+'」').trim();
    rows[seq]={seq,room,tm,guests:typeof guests==='number'?guests:null,ended:!!s.ended,orderStaff:s.orderStaff||'',note,conf,src:'photo-ai'};
    if(conf<0.7)tbd.push('序'+seq+' 待確認 '+note);
    (s.marks||[]).forEach(mk=>{
      const rawId=String(mk.id||'').trim();
      const gid=/^\d+$/.test(rawId)?rawId.padStart(2,'0'):rawId;
      const typ=mk.type||'';
      if(['紅','藍','私檯','訂番'].indexOf(typ)<0){bad.push('序'+seq+' 記號 '+typ);return}
      const paper=mk.paper_name||mk.name||'';
      const idUnc=!!(mk.id_uncertain||!gid);
      const low=(mk.uncertain||idUnc)?0.45:1;
      marks.push([seq,gid,typ,low,mk.note||'',paper,'']);
      if(mk.uncertain)tbd.push('序'+seq+' 小姐 '+(gid||paper||'?')+' 記號待確認');
    });
  });
  const girl=marks.length,priv=marks.filter(m=>m[2]==='私檯').length,ordn=marks.filter(m=>m[2]==='訂番').length;
  const dayUnsure=!!(obj.day_uncertain||!day);
  return {draft:{day,dayUnsure,rows,marks,tbd,bad,unk:[],totals:{sessions:Object.keys(rows).length,girlTai:girl,priv,ordn}},raw:obj};
}

export async function recognizeSheetPhotos({app,photos,day,roster}){
  if(!app)throw new Error('缺少 Firebase app');
  const list=(photos||[]).filter(p=>p&&(p.dataUrl||p.b64));
  if(!list.length)throw new Error('沒有可辨識的照片');
  const ai=getAI(app,{backend:new GoogleAIBackend()});
  const model=getGenerativeModel(ai,{
    model:SHEET_AI_MODEL,
    generationConfig:{
      temperature:0.1,
      maxOutputTokens:65536,
      responseMimeType:'application/json',
      responseSchema:sheetSchema
    }
  });
  const parts=[{text:SHEET_AI_PROMPT+(day?'\n營業日提示：'+day:'')+'\n若有多張照片，請依序拼成同一張排檯表（由左到右、由上到下，或第 1、2、3… 張接續的番）。'}];
  for(const ph of list){
    const part=dataUrlToParts(ph.dataUrl||ph.b64);
    if(!part||!part.b64)continue;
    if(part.b64.length>4_000_000)throw new Error('照片太大，請改傳較近、較清楚的一張');
    parts.push({inlineData:{mimeType:part.mime||'image/jpeg',data:part.b64}});
  }
  if(parts.length<2)throw new Error('沒有可辨識的照片資料');
  async function run(m){
    const result=await m.generateContent(parts);
    const text=(result&&result.response&&typeof result.response.text==='function')?result.response.text():'';
    return text;
  }
  let text=await run(model);
  if(!String(text).trim())throw new Error('辨識沒有回傳內容，請改傳更清楚的近拍，或稍後再試');
  let {draft,raw}=toDraft(text,day);
  const n=Object.keys((draft&&draft.rows)||{}).length;
  // REST／結構化輸出偶發只回 1 筆空番；多頁紙本若結果過少就改不帶 schema 再試一次
  if(n<=2&&list.length>=2){
    try{
      const loose=getGenerativeModel(ai,{
        model:SHEET_AI_MODEL,
        generationConfig:{temperature:0.1,maxOutputTokens:65536,responseMimeType:'application/json'}
      });
      const text2=await run(loose);
      if(String(text2).trim()){
        const second=toDraft(text2,day);
        if(Object.keys((second.draft&&second.draft.rows)||{}).length>n){
          draft=second.draft;raw=second.raw;text=text2;
        }
      }
    }catch(e){}
  }
  applyRosterNames(draft,roster||{});
  return {draft,raw,model:SHEET_AI_MODEL,text};
}
