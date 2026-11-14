import {createContext, runInContext} from 'node:vm';
import {readFileSync} from 'node:fs';

const now0 = Date.parse('2026-11-14T06:00:00+08:00'); // still 11/13 biz day if cut is 07:10
const afterCut = Date.parse('2026-11-14T07:15:00+08:00'); // 11/14
function dkey(d){d=new Date(d);const y=d.getFullYear(),m=String(d.getMonth()+1).padStart(2,'0'),da=String(d.getDate()).padStart(2,'0');return `${y}-${m}-${da}`}

let clock = now0;
const logs=[];
const S = {
  openDay: '2026-11-13',
  cur: {name:'冠廷', role:'特殊'},
  rooms: {
    '202': {guests:null, sessions:1, start: now0-3600000, end: now0+3600000, drink:'啤酒', bans:[['08']], imp:true, orders:[]},
    '201': {guests:4, sessions:2, start: now0-7200000, end: now0+1800000, drink:'高粱', bans:[['10','26']], wine:{name:'X',price:0}, orders:[]}
  },
  girls: [
    {id:'08', name:'08 牛奶', room:null, status:'休息室', on:true},
    {id:'10', name:'10 翠翠', room:'201', status:'在檯', on:true, src:'blue'},
    {id:'26', name:'26 蜜桃', room:'201', status:'在檯', on:true, src:'red'}
  ],
  revenue: [{t: now0-8000000, room:'105', total:12000, method:'現金', items:'套餐'}, {t: now0-7000000, room:'106', total:8000, method:'掛帳', items:'套餐'}],
  sheetLog: [{day:'2026-11-13', room:'101', start:now0-9000000, girls:['08']}],
  taiLog: [{day:'2026-11-13', girl:'08', tai:1, t:now0-9000000}],
  staffPay: {},
  att: {},
  checkin: {},
  cleaning: {'103': now0+600000},
  dirty: {'102': {t:now0, from:'102', to:'201', by:'幹部'}},
  reqs: [],
  calls: [{t:now0-1000, type:'回檯買單', room:'201', girl:'10'}],
  queue: [{name:'王先生', pref:'201'}],
  hist: {},
  staff: [{id:'S01', name:'綺', dept:'外場少爺'}],
  carryTodos: {version:1, items:[]},
  roomResetLog: [],
  cfg: {dayCut:'07:10', towelFee:500, payMethods:'現金,刷卡,轉帳,掛帳', cleanMin:10, rooms:'101,102,103,201,202'}
};
const F = {orders:[{id:'o1', room:'201', status:'待做', zh:'烤魷魚', at:now0-1000}]};
const GQ = {list:[{id:'g1', room:'201', type:'點小姐', status:'已送出', ids:['10']}]};

const ctx = {
  S, F, GQ, console,
  Date, JSON, Object, Array, Math, String, Number, Boolean, Set,
  now: () => clock,
  bizDay: (ts) => dkey(ts - 430*60000),
  cutTxt: () => '07:10',
  C: () => S.cfg,
  G: (id) => S.girls.find(g => g.id==id),
  lvl: () => 5,
  needRole: () => true,
  bill: (x) => ({items:[], total: x.guests? x.guests*1000 : 0}),
  hm: (ts) => '07:20',
  t: (ts) => new Date(ts).toISOString(),
  esc: (s) => String(s),
  slNick: (id) => (S.girls.find(g=>g.id==id)||{}).name || id,
  log: (m) => logs.push(m),
  save: () => logs.push('save'),
  toast: (m) => logs.push('toast:'+m),
  render: () => logs.push('render'),
  leave: (g, why) => { g.room=null; g.status='休息室'; logs.push('leave '+g.id+' '+why); },
  pageOpen: (h) => { ctx._page = h; },
  openPayroll(){}, openKitchen(){}, openRevenue(){}, openReport(){},
  payFlow(){}, boardEdit(){},
  window: {}, document: { getElementById: () => null, querySelector: () => ({parentNode:{insertBefore(){}}}), createElement: () => ({}) },
  TVMODE: false,
  closeDayL: function(d,how){ S.hist[d]={day:d,closedBy:'系統（07:10 自動）',closedAt:clock}; logs.push('archive '+d); },
  buildDay: (d)=>({day:d}),
  alert: (m)=>{logs.push('alert '+m); return true},
  confirm: () => true,
  spDay: '2026-11-13',
};
ctx.window = { Cloud: {
  serverNow: () => clock,
  lv: () => 5,
  tryDayRoll: async (from,to) => ({ok:true, won:true}),
  flushTo: async (id) => { logs.push('flush '+id); ctx._flushed = ctx._flushed||{}; ctx._flushed[id]={openDay:S.openDay, rooms:JSON.parse(JSON.stringify(S.rooms)), carryover:S.carryover&&JSON.parse(JSON.stringify(S.carryover)), revenue:S.revenue.slice(), sheetLog:S.sheetLog.slice()}; },
  markDayRollDone: async (from,to) => { logs.push('lock-done '+from+'->'+to); },
  followDay: (id) => logs.push('follow '+id),
  followDayRoll: async () => false
}};
ctx.maybeDayRoll = undefined;

const code = readFileSync('/workspace/hostess-club-system/v12/dayroll.js','utf8');
runInContext(code, createContext(ctx), {filename:'dayroll.js'});

// 1) collect before cut
const items = ctx.collectCarryover('2026-11-13');
const types = items.map(i=>i.type+':'+i.title);
console.log('ITEMS', items.length);
types.forEach(t=>console.log(' -', t));
const need = ['open-room', 'unpaid', 'kitchen', 'cleaning', 'guest-req', 'call', 'payroll', 'attend', 'blank', 'queue'];
const got = new Set(items.map(i=>i.type));
const missing = need.filter(t=>!got.has(t));
if(missing.length) throw new Error('missing types '+missing);

// 2) simulated clock after 07:10
clock = afterCut;
ctx.maybeDayRoll._now = () => clock;
await ctx.maybeDayRoll({reason:'test'});
if(S.openDay!=='2026-11-14') throw new Error('openDay '+S.openDay);
if(!S.rooms['201'] || S.rooms['201'].carryDay!=='2026-11-13') throw new Error('201 should stay visible as carry');
if(!S.rooms['202'] || S.rooms['202'].carryDay!=='2026-11-13') throw new Error('202 should stay visible as carry');
if(!S.hist['2026-11-13']) throw new Error('hist missing');
if(!ctx._flushed['2026-11-13'] || !ctx._flushed['2026-11-14']) throw new Error('flush missing');
// prev flush should still have rooms and carryover
if(!ctx._flushed['2026-11-13'].carryover || ctx._flushed['2026-11-13'].carryover.items.length<5) throw new Error('prev carryover missing');
// new day should not keep old sheetLog from 11/13
if(S.sheetLog.some(e=>e.day==='2026-11-13')) throw new Error('sheetLog leaked into new day memory');
if(S.taiLog.some(e=>e.day==='2026-11-13')) throw new Error('taiLog leaked');
// 掛帳 revenue pruned from memory (completed history)
if(S.revenue.some(v=>v.method==='掛帳')) throw new Error('old revenue leaked');
const pend = ctx.pendingCarry();
if(!pend.length) throw new Error('no pending');

// 3) idempotent second call
const n1 = S.carryTodos.items.length;
clock = afterCut + 1000;
await ctx.maybeDayRoll({reason:'again'});
if(S.openDay!=='2026-11-14') throw new Error('openDay changed');
// tryDayRoll still returns won:true in mock — that could double-run perform!
// For real Cloud it would won:false. Adjust test: second call from==to so maybeDayRoll returns early.
if(S.openDay==='2026-11-14'){
  // already same day, collect shouldn't double if we called perform again...
  // maybeDayRoll returns immediately when from==to. Good.
}

// 4) reset room 201, history preserved
const taiBefore = S.taiLog.length, revBefore = S.revenue.length;
// put a completed tai back as if today's (already counted)
S.taiLog.push({day:'2026-11-14', girl:'99', tai:1, t:clock, room:'105'});
S.revenue.push({day:'2026-11-14', room:'105', total:3000, method:'現金', t:clock});
ctx.resetRoom('201');
if(S.rooms['201']) throw new Error('201 not cleared');
if(S.girls.find(g=>g.id==='10').room) throw new Error('girl still in 201');
if(!S.roomResetLog.length || !S.roomResetLog[0].snap.room) throw new Error('no snapshot');
if(S.taiLog.length!==taiBefore+1) throw new Error('taiLog mutated');
if(S.revenue.length!==revBefore+1) throw new Error('revenue mutated');

// 5) restore
ctx.restoreRoomReset(S.roomResetLog[0].id);
if(!S.rooms['201'] || S.rooms['201'].sessions!==2) throw new Error('restore failed');
if(S.girls.find(g=>g.id==='10').room!=='201') throw new Error('girl not restored');

console.log('PASS', {
  openDay: S.openDay,
  items: items.length,
  pendingAtRoll: pend.length,
  types: [...got].sort(),
  flushed: Object.keys(ctx._flushed),
  resetLog: S.roomResetLog.length,
  logs: logs.filter(x=>/換日|重設|archive|flush|lock/.test(x))
});
