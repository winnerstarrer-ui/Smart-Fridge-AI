import {useEffect,useState} from 'react';
import {onAuthStateChanged,signInWithEmailAndPassword,createUserWithEmailAndPassword,signInAnonymously,signOut} from 'firebase/auth';
import {collection,onSnapshot,addDoc,updateDoc,deleteDoc,doc,serverTimestamp} from 'firebase/firestore';
import {auth,db} from './firebase';

const LOCS=['fridge','freezer','pantry'];
const ICON={fridge:'🧊',freezer:'❄️',pantry:'🥫'};
const days=d=>d?Math.ceil((new Date(d+'T00:00:00')-new Date().setHours(0,0,0,0))/864e5):null;
const badge=d=>{const n=days(d);return n===null?['No date','b-gray']:n<0?['Expired','b-red']:n===0?['Today','b-red']:n<=3?[n+'d left','b-amber']:[n+'d left','b-green']};

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

function ItemForm({item,onSave,onCancel,defaults}){
  const[f,setF]=useState(item||{name:'',quantity:1,unit:'pcs',location:'fridge',category:'',expiry:'',opened:false,notes:'',...defaults});
  const[busy,setB]=useState(false);const s=k=>e=>setF({...f,[k]:e.target.type==='checkbox'?e.target.checked:e.target.value});
  const save=async()=>{if(busy||!f.name.trim())return;setB(true);await onSave({...f,name:f.name.trim(),quantity:Number(f.quantity)||0});setB(false)};
  return <div className="sheet"><div className="card">
    <h3>{item?'Edit item':'Add item'}</h3>
    <input placeholder="Name (e.g. Milk)" value={f.name} onChange={s('name')}/>
    <div className="row"><input type="number" min="0" value={f.quantity} onChange={s('quantity')}/><input value={f.unit} onChange={s('unit')} placeholder="unit"/></div>
    <select value={f.location} onChange={s('location')}>{LOCS.map(l=><option key={l} value={l}>{l}</option>)}</select>
    <input placeholder="Category (dairy, meat…)" value={f.category} onChange={s('category')}/>
    {f.expiry!==undefined&&<><label>Expiry date (leave blank if unknown)</label><input type="date" value={f.expiry||''} onChange={s('expiry')}/></>}
    {onCancel&&f.opened!==undefined&&<label><input type="checkbox" checked={!!f.opened} onChange={s('opened')}/> Opened</label>}
    <input placeholder="Notes" value={f.notes||''} onChange={s('notes')}/>
    <button className="btn" disabled={busy} onClick={save}>Save</button><button className="link" onClick={onCancel}>Cancel</button></div></div>;
}

export default function App(){
  const[user,setUser]=useState(undefined);const[tab,setTab]=useState('home');
  const[items,setItems]=useState([]);const[shop,setShop]=useState([]);
  const[q,setQ]=useState('');const[loc,setLoc]=useState('all');const[form,setForm]=useState(null);const[sName,setSName]=useState('');
  useEffect(()=>onAuthStateChanged(auth,setUser),[]);
  useEffect(()=>{if(!user)return;const b=`users/${user.uid}/`;
    const u1=onSnapshot(collection(db,b+'inventory'),s=>setItems(s.docs.map(d=>({id:d.id,...d.data()}))));
    const u2=onSnapshot(collection(db,b+'shoppingList'),s=>setShop(s.docs.map(d=>({id:d.id,...d.data()}))));
    return()=>{u1();u2()}},[user]);
  if(user===undefined)return <div className="auth">Loading…</div>;
  if(!user)return <Auth/>;
  const base=`users/${user.uid}/`;
  const stamp={updatedAt:serverTimestamp()};
  const addItem=d=>addDoc(collection(db,base+'inventory'),{...d,createdAt:serverTimestamp(),...stamp});
  const upd=(id,d)=>updateDoc(doc(db,base+'inventory',id),{...d,...stamp});
  const del=id=>deleteDoc(doc(db,base+'inventory',id));
  const consumeOne=i=>i.quantity<=1?del(i.id):upd(i.id,{quantity:i.quantity-1});
  const sorted=[...items].sort((a,b)=>(a.expiry||'9999').localeCompare(b.expiry||'9999'));
  const list=sorted.filter(i=>(loc==='all'||i.location===loc)&&i.name.toLowerCase().includes(q.toLowerCase()));
  const exp=n=>items.filter(i=>i.expiry&&days(i.expiry)<=n&&days(i.expiry)>=0).length;
  const expired=items.filter(i=>i.expiry&&days(i.expiry)<0).length;
  const recent=[...items].sort((a,b)=>(b.createdAt?.seconds||9e9)-(a.createdAt?.seconds||9e9)).slice(0,5);
  const Row=({i})=>{const[t,c]=badge(i.expiry);return <div className="item"><div className="grow"><b>{i.name}</b><small>{ICON[i.location]} {i.quantity} {i.unit}{i.category?' · '+i.category:''}</small></div>
    <span className={'badge '+c}>{t}</span><button className="ic" title="Use one" onClick={()=>consumeOne(i)}>−1</button><button className="ic" title="Edit" onClick={()=>setForm(i)}>✏️</button>
    <button className="ic" title="Consumed" onClick={()=>del(i.id)}>✅</button></div>};
  const answer=q.trim()?(list.length?null:'This item is not currently recorded in your inventory. (It may still be in your fridge — the app only knows what you have logged.)'):null;
  return <div className="app"><main>
    {tab==='home'&&<><h2>Home</h2>
      <div className="stats"><div className="stat"><b>{items.length}</b>Items</div><div className="stat red"><b>{exp(0)}</b>Today</div><div className="stat amber"><b>{exp(3)}</b>≤3 days</div><div className="stat red"><b>{expired}</b>Expired</div></div>
      <input className="search" placeholder="🔍 Do I have milk?" value={q} onChange={e=>{setQ(e.target.value);}} onFocus={()=>setTab('inventory')}/>
      {LOCS.map(l=><div className="card" key={l}>{ICON[l]} {l}: <b>{items.filter(i=>i.location===l).length}</b> items</div>)}
      <div className="card">🛒 Shopping list: <b>{shop.filter(s=>!s.done).length}</b> to buy</div>
      <h3>Recently added</h3>{recent.length?recent.map(i=><Row key={i.id} i={i}/>):<p className="empty">Nothing yet. Tap + to add your first food item.</p>}</>}
    {tab==='inventory'&&<><h2>Inventory</h2><input className="search" placeholder="🔍 Search food…" value={q} onChange={e=>setQ(e.target.value)}/>
      <div className="chips">{['all',...LOCS].map(l=><button key={l} className={'chip '+(loc===l?'on':'')} onClick={()=>setLoc(l)}>{l}</button>)}</div>
      {answer&&<p className="empty">{answer}</p>}{list.map(i=><Row key={i.id} i={i}/>)}
      {!items.length&&<p className="empty">Your inventory is empty.</p>}
      <button className="fab" onClick={()=>setForm({})}>+</button></>}
    {tab==='scan'&&<><h2>Scan</h2><div className="card"><p>📷 AI photo scanning is not enabled yet — it needs a serverless function and an API key (planned next stage). Until then, add items quickly:</p>
      <button className="btn" onClick={()=>setForm({})}>Add item manually</button>
      {[...new Set(items.map(i=>i.name))].slice(0,6).map(n=><button key={n} className="chip" onClick={()=>{const o=items.find(i=>i.name===n);setForm({defaults:{name:n,unit:o.unit,location:o.location,category:o.category}})}}>{n}</button>)}</div></>}
    {tab==='shopping'&&<><h2>Shopping</h2><div className="row"><input placeholder="Add item…" value={sName} onChange={e=>setSName(e.target.value)}/>
      <button className="btn sm" onClick={async()=>{if(!sName.trim())return;const n=sName.trim();setSName('');await addDoc(collection(db,base+'shoppingList'),{name:n,quantity:1,unit:'pcs',done:false,...stamp})}}>Add</button></div>
      {!shop.length&&<p className="empty">Your list is empty.</p>}
      {shop.map(s=><div className="item" key={s.id}><input type="checkbox" checked={!!s.done} onChange={()=>updateDoc(doc(db,base+'shoppingList',s.id),{done:!s.done,...stamp})}/>
        <span className={'grow '+(s.done?'strike':'')}>{s.name}</span>
        {s.done&&<button className="ic" title="Move to inventory" onClick={()=>setForm({defaults:{name:s.name,unit:s.unit},moveShop:s.id})}>📥</button>}
        <button className="ic" onClick={()=>deleteDoc(doc(db,base+'shoppingList',s.id))}>🗑</button></div>)}</>}
    {tab==='settings'&&<><h2>Settings</h2><div className="card"><p>Signed in as <b>{user.email||'Guest'}</b></p><button className="btn" onClick={()=>signOut(auth)}>Log out</button></div>
      <div className="card"><small>Privacy: your data is stored in your private Firestore area. No photos are uploaded in this version.</small></div></>}
  </main>
  {form&&<ItemForm item={form.id?form:null} defaults={form.defaults} onCancel={()=>setForm(null)} onSave={async d=>{
    if(form.id){await upd(form.id,d)}else{await addItem(d);if(form.moveShop)await deleteDoc(doc(db,base+'shoppingList',form.moveShop))}setForm(null)}}/>}
  <nav>{[['home','🏠','Home'],['inventory','📦','Inventory'],['scan','📷','Scan'],['shopping','🛒','Shopping'],['settings','⚙️','Settings']].map(([k,e,l])=>
    <button key={k} className={(tab===k?'on ':'')+(k==='scan'?'scan':'')} onClick={()=>setTab(k)}><span>{e}</span>{l}</button>)}</nav></div>;
}
