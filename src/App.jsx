import {useEffect,useState} from 'react';
import {onAuthStateChanged,signInWithEmailAndPassword,createUserWithEmailAndPassword,signInAnonymously,signOut} from 'firebase/auth';
import {collection,onSnapshot,addDoc,updateDoc,deleteDoc,doc,serverTimestamp} from 'firebase/firestore';
import {auth,db} from './firebase';

const LOCS=['fridge','freezer','pantry'];const ICON={fridge:'🧊',freezer:'❄️',pantry:'🥫'};
const days=d=>d?Math.ceil((new Date(d+'T00:00:00')-new Date().setHours(0,0,0,0))/864e5):null;
const badge=d=>{const n=days(d);return n===null?['No date','b-gray']:n<0?['Expired','b-red']:n===0?['Today','b-red']:n<=3?[n+'d left','b-amber']:[n+'d left','b-green']};
const UNITS=['pcs','kg','g','L','ml','packs','dozen','bottles','cans','boxes'];
const FR={kg:[.25,.5,.75,1,1.5,2],L:[.25,.5,.75,1,1.5,2],g:[100,250,500,1000],ml:[100,250,500,1000]};
const step=u=>u==='kg'||u==='L'?.25:1;
const fmt=q=>{q=Number(q)||0;const w=Math.floor(q),m={.25:'¼',.5:'½',.75:'¾'}[q-w];return m?(w||'')+m:String(+q.toFixed(2))};
const THEMES={light:'🌿 Green',dark:'🌙 Dark',ocean:'🌊 Ocean',sunset:'🌅 Sunset',berry:'🍇 Berry',midnight:'🌌 Midnight'};
const today=()=>new Date(Date.now()-new Date().getTimezoneOffset()*6e4).toISOString().slice(0,10);
const added=i=>i.addedOn||(i.createdAt?.seconds?new Date(i.createdAt.seconds*1000).toISOString().slice(0,10):today());
const WHEN={all:()=>true,expired:d=>d!==null&&d<0,today:d=>d===0,tomorrow:d=>d===1,d3:d=>d!==null&&d>=0&&d<=3,d7:d=>d!==null&&d>=0&&d<=7};
const WLABEL={all:'All dates',expired:'Expired',today:'Today',d3:'≤3 days',d7:'≤7 days'};
function parse(q){let t=q.toLowerCase().replace(/\?/g,''),when=null,loc=null;
  if(/expired/.test(t))when='expired';else if(/tomorrow/.test(t))when='tomorrow';else if(/today/.test(t))when='today';else if(/week|7 days/.test(t))when='d7';else if(/soon|3 days/.test(t))when='d3';
  if(/use first/.test(t))when='d7';
  if(/frozen|freezer/.test(t))loc='freezer';else if(/fridge/.test(t))loc='fridge';else if(/pantry/.test(t))loc='pantry';
  t=t.replace(/do i have|is there any|is there|which|what|expires?|expired|tomorrow|today|this week|soon|use first|should i|frozen|freezer|in the fridge|fridge|pantry|\bany\b|\bthe\b|\bi\b|\bhave\b|\bdo\b|\bfood\b|\bnext\b|\bdays?\b|\b[37]\b/g,' ').replace(/\s+/g,' ').trim().replace(/s$/,'');
  return {when,loc,term:t}}

function Auth(){
  const[email,setE]=useState('');const[pw,setP]=useState('');const[err,setErr]=useState('');const[busy,setB]=useState(false);
  const go=async fn=>{if(busy)return;setB(true);setErr('');try{await fn()}catch(e){setErr(e.message)}setB(false)};
  return <div className="auth"><h1>🧊 Smart Fridge AI</h1><p>Know what's in your fridge.</p>
    <input placeholder="Email" type="email" value={email} onChange={e=>setE(e.target.value)}/>
    <input placeholder="Password (6+ chars)" type="password" value={pw} onChange={e=>setP(e.target.value)}/>
    {err&&<p className="err">{err}</p>}
    <button className="btn" disabled={busy} onClick={()=>go(()=>signInWithEmailAndPassword(auth,email,pw))}>Log in</button>
    <button className="btn alt" disabled={busy} onClick={()=>go(()=>createUserWithEmailAndPassword(auth,email,pw))}>Create account</button>
    <button className="link" disabled={busy} onClick={()=>go(()=>signInAnonymously(auth))}>Continue as guest</button></div>;
}

function ItemForm({item,defaults,recents,onSave,onCancel}){
  const[f,setF]=useState(item||{name:'',quantity:1,unit:'pcs',location:'fridge',category:'',expiry:'',opened:false,notes:'',...defaults});
  const[busy,setB]=useState(false);const s=k=>e=>setF({...f,[k]:e.target.type==='checkbox'?e.target.checked:e.target.value});
  const save=async()=>{if(busy||!f.name.trim())return;setB(true);await onSave({...f,name:f.name.trim(),quantity:Number(f.quantity)||0});setB(false)};
  return <div className="sheet"><div className="card"><h3>{item?'Edit item':'Add item'}</h3>
    {!item&&!!recents.length&&<div className="chips" style={{flexWrap:'wrap'}}>{recents.map(r=><button key={r.name} className="chip" onClick={()=>setF({...f,name:r.name,unit:r.unit,location:r.location,category:r.category||''})}>{r.name}</button>)}</div>}
    <input placeholder="Name (e.g. Milk)" value={f.name} onChange={s('name')}/>
    <div className="row"><input type="number" min="0" step="any" inputMode="decimal" value={f.quantity} onChange={s('quantity')} placeholder="Quantity"/>
      <select value={f.unit} onChange={s('unit')}>{(UNITS.includes(f.unit)?UNITS:[...UNITS,f.unit]).map(u=><option key={u}>{u}</option>)}</select></div>
    {FR[f.unit]&&<div className="chips" style={{flexWrap:'wrap'}}>{FR[f.unit].map(v=><button key={v} className={'chip '+(Number(f.quantity)===v?'on':'')} onClick={()=>setF({...f,quantity:v})}>{fmt(v)} {f.unit}</button>)}</div>}
    <select value={f.location} onChange={s('location')}>{LOCS.map(l=><option key={l} value={l}>{ICON[l]} {l}</option>)}</select>
    <input placeholder="Category (dairy, meat, vegetable…)" value={f.category||''} onChange={s('category')}/>
    <label>Expiry date (blank = unknown)</label><input type="date" value={f.expiry||''} onChange={s('expiry')}/>
    <label><input type="checkbox" checked={!!f.opened} onChange={s('opened')}/> Opened</label>
    <input placeholder="Notes" value={f.notes||''} onChange={s('notes')}/>
    <button className="btn" disabled={busy} onClick={save}>Save</button><button className="link" onClick={onCancel}>Cancel</button></div></div>;
}

export default function App(){
  const[user,setUser]=useState(undefined);const[tab,setTab]=useState('home');
  const[items,setItems]=useState([]);const[shop,setShop]=useState([]);
  const[q,setQ]=useState('');const[loc,setLoc]=useState('all');const[when,setWhen]=useState('all');const[sort,setSort]=useState('expiry');
  const[form,setForm]=useState(null);const[sName,setSName]=useState('');const[sel,setSel]=useState(null);const[toast,setToast]=useState(null);
  const[theme,setTheme]=useState(()=>{try{const t=localStorage.getItem('theme');return THEMES[t]?t:matchMedia('(prefers-color-scheme:dark)').matches?'dark':'light'}catch{return 'light'}});
  useEffect(()=>{document.documentElement.dataset.theme=theme;try{localStorage.setItem('theme',theme)}catch{}},[theme]);
  useEffect(()=>onAuthStateChanged(auth,setUser),[]);
  useEffect(()=>{if(!toast)return;const t=setTimeout(()=>setToast(null),7000);return()=>clearTimeout(t)},[toast]);
  useEffect(()=>{if(!user)return;const b=`users/${user.uid}/`;
    const u1=onSnapshot(collection(db,b+'inventory'),s=>setItems(s.docs.map(d=>({id:d.id,...d.data()}))));
    const u2=onSnapshot(collection(db,b+'shoppingList'),s=>setShop(s.docs.map(d=>({id:d.id,...d.data()}))));
    return()=>{u1();u2()}},[user]);
  if(user===undefined)return <div className="auth">Loading…</div>;
  if(!user)return <Auth/>;
  const base=`users/${user.uid}/`;const stamp={updatedAt:serverTimestamp()};
  const addItem=d=>addDoc(collection(db,base+'inventory'),{addedOn:today(),...d,createdAt:serverTimestamp(),...stamp});
  const upd=(id,d)=>updateDoc(doc(db,base+'inventory',id),{...d,...stamp});
  const del=id=>deleteDoc(doc(db,base+'inventory',id));
  const addShop=(name,quantity=1,unit='pcs')=>addDoc(collection(db,base+'shoppingList'),{name,quantity,unit,done:false,...stamp});
  const strip=({id,createdAt,updatedAt,...r})=>r;
  const consume=async i=>{const data=strip(i);await del(i.id);setToast({msg:`${i.name} consumed`,undo:()=>addItem(data),shop:i.name})};
  const adjust=async(i,n)=>{n*=step(i.unit);const q=i.quantity+n;if(q<=0)return consume(i);await upd(i.id,{quantity:q});if(n<0)setToast({msg:`${i.name}: ${fmt(q)} ${i.unit} left`,undo:()=>upd(i.id,{quantity:i.quantity})})};
  const bulk=async()=>{const t=items.filter(i=>sel.has(i.id));const saved=t.map(strip);for(const i of t)await del(i.id);setSel(null);setToast({msg:`${t.length} items consumed`,undo:async()=>{for(const d of saved)await addItem(d)}})};
  const P=parse(q);const L=P.loc||loc,W=P.when||when;
  const cmp={expiry:(a,b)=>(a.expiry||'9999').localeCompare(b.expiry||'9999'),name:(a,b)=>a.name.localeCompare(b.name),recent:(a,b)=>(b.createdAt?.seconds||9e9)-(a.createdAt?.seconds||9e9)}[sort];
  const list=[...items].sort(cmp).filter(i=>(L==='all'||i.location===L)&&(WHEN[W]||WHEN.all)(days(i.expiry))&&(!P.term||(i.name+' '+(i.category||'')).toLowerCase().includes(P.term)));
  const groups=Object.values(list.reduce((a,i)=>{(a[i.name.toLowerCase()]??=[]).push(i);return a},{}));
  const cnt=f=>items.filter(i=>f(days(i.expiry))).length;
  const useFirst=items.filter(i=>days(i.expiry)!==null&&days(i.expiry)>=0).sort((a,b)=>a.expiry.localeCompare(b.expiry)).slice(0,5);
  const recent=[...items].sort((a,b)=>(b.createdAt?.seconds||9e9)-(a.createdAt?.seconds||9e9)).slice(0,5);
  const recents=[...new Map([...items].sort((a,b)=>(b.createdAt?.seconds||9e9)-(a.createdAt?.seconds||9e9)).map(i=>[i.name.toLowerCase(),i])).values()].slice(0,8);
  const go=(t,w='all')=>{setWhen(w);setLoc('all');setQ('');setTab(t)};
  const Row=({i})=>{const[t,c]=badge(i.expiry);return <div className="item">
    {sel&&<input type="checkbox" style={{width:22}} checked={sel.has(i.id)} onChange={()=>{const n=new Set(sel);n.has(i.id)?n.delete(i.id):n.add(i.id);setSel(n)}}/>}
    <div className="grow"><b>{i.name}</b><small>{ICON[i.location]} {fmt(i.quantity)} {i.unit}{i.opened?' · opened':''}{i.expiry?' · exp '+i.expiry:''} · added {added(i)}</small></div>
    <span className={'badge '+c}>{t}</span>
    {!sel&&<><button className="ic" onClick={()=>adjust(i,-1)}>−</button><button className="ic" onClick={()=>adjust(i,1)}>+</button><button className="ic" onClick={()=>setForm(i)}>✏️</button><button className="ic" title="Consumed" onClick={()=>consume(i)}>✅</button></>}</div>};
  const Stat=({n,l,w,cls})=><button className={'stat '+(cls||'')} onClick={()=>go('inventory',w)}><b>{n}</b>{l}</button>;
  const doneItems=shop.filter(s=>s.done);
  const moveDone=async()=>{if(!doneItems.length||!confirm(`Move ${doneItems.length} purchased items to your fridge inventory? You can edit location/expiry afterwards.`))return;
    for(const s of doneItems){await addItem({name:s.name,category:'',quantity:s.quantity,unit:s.unit,location:'fridge',expiry:'',opened:false,notes:'From shopping list'});await deleteDoc(doc(db,base+'shoppingList',s.id))}};
  return <div className="app"><main>
    {tab==='home'&&<><h2>Home</h2>
      <div className="stats"><Stat n={items.length} l="Items" w="all"/><Stat n={cnt(d=>d===0)} l="Today" w="today" cls="red"/><Stat n={cnt(WHEN.d3)} l="≤3 days" w="d3" cls="amber"/><Stat n={cnt(d=>d!==null&&d<0)} l="Expired" w="expired" cls="red"/></div>
      <input className="search" placeholder="🔍 Do I have milk? / What expires tomorrow?" onFocus={()=>go('inventory')}/>
      <div className="row">{LOCS.map(l=><button key={l} className="card grow" style={{border:0,color:'inherit'}} onClick={()=>{setLoc(l);setWhen('all');setQ('');setTab('inventory')}}>{ICON[l]}<br/><b>{items.filter(i=>i.location===l).length}</b><br/><small>{l}</small></button>)}</div>
      <div className="card" onClick={()=>setTab('shopping')}>🛒 Shopping list: <b>{shop.filter(s=>!s.done).length}</b> to buy</div>
      {!!useFirst.length&&<><h3>Use first</h3>{useFirst.map(i=><Row key={i.id} i={i}/>)}</>}
      <h3>Recently added</h3>{recent.length?recent.map(i=><Row key={i.id} i={i}/>):<p className="empty">Nothing yet. Tap + to add your first food item.</p>}</>}
    {tab==='inventory'&&<><h2>Inventory</h2>
      <input className="search" placeholder="Search or ask: “Do I have chicken?”, “expires tomorrow”" value={q} onChange={e=>setQ(e.target.value)}/>
      <div className="chips" style={{flexWrap:'wrap'}}>{['all',...LOCS].map(l=><button key={l} className={'chip '+(L===l?'on':'')} onClick={()=>setLoc(l)}>{l}</button>)}</div>
      <select className="sm" value={W} onChange={e=>setWhen(e.target.value)}>{Object.entries(WLABEL).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select>
      <select className="sm" value={sort} onChange={e=>setSort(e.target.value)}><option value="expiry">Sort: expiry</option><option value="name">Sort: name</option><option value="recent">Sort: recent</option></select>
      <button className="chip" onClick={()=>setSel(sel?null:new Set())}>{sel?'Cancel select':'Select'}</button>
      {sel&&<div className="bar"><span className="grow">{sel.size} selected</span><button onClick={()=>setSel(new Set(list.map(i=>i.id)))}>All</button><button disabled={!sel.size} onClick={bulk}>✅ Consume</button></div>}
      {q.trim()&&<p className="empty">{list.length?`Found ${list.length} recorded item${list.length>1?'s':''}.`:'This item is not currently recorded in your inventory. (It may still be in your fridge — the app only knows what you have logged.)'}</p>}
      {groups.map(g=><div key={g[0].name.toLowerCase()}>{g.length>1&&<div className="grp">{g[0].name} <small>· {g.length} batches · {fmt(g.reduce((a,i)=>a+i.quantity,0))} {g[0].unit} total</small></div>}{g.map(i=><Row key={i.id} i={i}/>)}</div>)}
      {!items.length&&<p className="empty">Your inventory is empty.</p>}</>}
    {tab==='shopping'&&<><h2>Shopping</h2><div className="row"><input placeholder="Add item…" value={sName} onChange={e=>setSName(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&sName.trim()){addShop(sName.trim());setSName('')}}}/>
      <button className="btn sm" onClick={()=>{if(!sName.trim())return;addShop(sName.trim());setSName('')}}>Add</button></div>
      {!shop.length&&<p className="empty">Your list is empty. Consumed items can be added here from the undo bar.</p>}
      {[...shop].sort((a,b)=>!!a.done-!!b.done).map(s=><div className="item" key={s.id}><input type="checkbox" style={{width:22}} checked={!!s.done} onChange={()=>updateDoc(doc(db,base+'shoppingList',s.id),{done:!s.done,...stamp})}/>
        <span className={'grow '+(s.done?'strike':'')}>{s.name}<small>{s.quantity} {s.unit}</small></span>
        <button className="ic" onClick={()=>updateDoc(doc(db,base+'shoppingList',s.id),{quantity:Math.max(1,s.quantity-1),...stamp})}>−</button><button className="ic" onClick={()=>updateDoc(doc(db,base+'shoppingList',s.id),{quantity:s.quantity+1,...stamp})}>+</button>
        {s.done&&<button className="ic" title="Move to inventory" onClick={()=>setForm({defaults:{name:s.name,unit:s.unit,quantity:s.quantity},moveShop:s.id})}>📥</button>}
        <button className="ic" onClick={()=>deleteDoc(doc(db,base+'shoppingList',s.id))}>🗑</button></div>)}
      {!!doneItems.length&&<><button className="btn" onClick={moveDone}>📥 Move all purchased ({doneItems.length}) to inventory</button><button className="link" onClick={async()=>{if(confirm('Remove all purchased items from the list?'))for(const s of doneItems)await deleteDoc(doc(db,base+'shoppingList',s.id))}}>Clear purchased</button></>}</>}
    {tab==='settings'&&<><h2>Settings</h2><div className="card"><p>Signed in as <b>{user.email||'Guest'}</b></p><p>Theme</p><div className="chips" style={{flexWrap:'wrap'}}>{Object.entries(THEMES).map(([k,v])=><button key={k} className={'chip '+(theme===k?'on':'')} onClick={()=>setTheme(k)}>{v}</button>)}</div></div>
      <div className="card"><button className="btn" onClick={()=>signOut(auth)}>Log out</button></div>
      <div className="card"><small>Privacy: your data is stored in your private Firestore area. No photos are uploaded.</small></div></>}
  </main>
  {toast&&<div className="toast"><span>{toast.msg}</span>{toast.undo&&<button onClick={()=>{toast.undo();setToast(null)}}>Undo</button>}{toast.shop&&<button onClick={()=>{addShop(toast.shop);setToast({msg:`${toast.shop} added to shopping`})}}>+ Shopping</button>}</div>}
  {form&&<ItemForm item={form.id?form:null} defaults={form.defaults} recents={recents} onCancel={()=>setForm(null)} onSave={async d=>{
    if(form.id){await upd(form.id,d)}else{await addItem(d);if(form.moveShop)await deleteDoc(doc(db,base+'shoppingList',form.moveShop))}setForm(null)}}/>}
  <nav>{[['home','🏠','Home'],['inventory','📦','Inventory'],['add','＋','Add'],['shopping','🛒','Shopping'],['settings','⚙️','Settings']].map(([k,e,l])=>
    <button key={k} className={(tab===k?'on ':'')+(k==='add'?'scan':'')} onClick={()=>k==='add'?setForm({}):setTab(k)}><span>{e}</span>{l}</button>)}</nav></div>;
}
