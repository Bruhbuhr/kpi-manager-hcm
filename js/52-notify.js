/* 52-notify.js – Thông báo: quản lý giao việc / duyệt / Re-check / comment / nhận xét / đi trễ / lỗi NC → nhân viên;
   nhân viên cập nhật lại việc Re-check → quản lý; lời mời làm chung → người được mời.
   Hiện: chuông 🔔 có số chưa đọc, khung thông báo nhảy ra ở góc phải trên, và thông báo của Chrome / Windows
   (khi người dùng bật). Chế độ Firebase: lưu ở collection notifs; chế độ dùng thử: lưu trong trình duyệt. */
'use strict';
(self.__mods=self.__mods||[]).push('52-notify');

let NOTIFS=[],nSeen=null,nUnsub=null;
const nKeyEmp=eid=>'emp:'+eid;
const myNotifKeys=()=>!session?[]:[...(can('manage')?['mgr']:[]),...(session.empId?[nKeyEmp(session.empId)]:[])];
const nUnread=n=>!(n.readBy||[]).includes(session&&session.id);
/* Gửi một thông báo. to = 'mgr' (mọi Admin / Quản lý) hoặc 'emp:<id nhân viên>'. Không báo cho chính người thao tác. */
function notify(to,o){
  if(!session||!to)return;
  if(to===nKeyEmp(session.empId))return;
  if(to==='mgr'&&can('manage'))return;
  const n={id:uid('n'),to,ic:o.ic||'🔔',title:String(o.title||'').slice(0,140),body:String(o.body||'').slice(0,300),e:o.e||'',y:o.y?String(o.y):'',mm:o.mm||'',
    from:session.name||'',fromUid:session.id,at:Date.now(),readBy:[]};
  if(CLOUD){fbStore.doc('notifs/'+n.id).set(n).catch(e=>console.warn('notify',e))}
  else{(db.notifs||(db.notifs=[])).push(n);if(db.notifs.length>500)db.notifs=db.notifs.slice(-500);try{localStorage.setItem(LS_KEY,JSON.stringify(db))}catch(e){}}
}
const notifyEmp=(eid,o)=>eid&&notify(nKeyEmp(eid),o);
const tShort=t=>String((t&&t.title)||'').split('\n')[0].slice(0,80);

/* ---------- nhận thông báo ---------- */
function notifStart(){
  notifStop();nSeen=null;
  if(!session)return;
  if(!CLOUD){NOTIFS=(db.notifs||[]).filter(n=>myNotifKeys().includes(n.to));notifUpdate();return}
  const keys=myNotifKeys();if(!keys.length)return;
  const q=keys.length===1?fbStore.collection('notifs').where('to','==',keys[0]):fbStore.collection('notifs').where('to','in',keys);
  nUnsub=q.onSnapshot(s=>{NOTIFS=s.docs.map(d=>({...d.data(),id:d.id}));notifUpdate()},e=>{console.warn('notifs',e);if(e&&e.code==='permission-denied'&&typeof rulesOld!=='undefined'&&!rulesOld){rulesOld=true;scheduleRender()}});
  if(session.role==='admin')setTimeout(notifPrune,5000);
}
function notifStop(){if(nUnsub){try{nUnsub()}catch(e){}nUnsub=null}NOTIFS=[]}
/* Admin dọn thông báo cũ hơn 60 ngày */
async function notifPrune(){try{const s=await fbStore.collection('notifs').where('at','<',Date.now()-60*864e5).get();const b=fbStore.batch();s.docs.slice(0,400).forEach(d=>b.delete(d.ref));if(s.size)await b.commit()}catch(e){}}
function notifUpdate(){
  NOTIFS.sort((a,b)=>b.at-a.at);
  const unread=NOTIFS.filter(nUnread),badge=$('#nbadge');
  if(badge){badge.hidden=!unread.length;badge.textContent=unread.length>99?'99+':String(unread.length)}
  if(nSeen===null){   /* lần đầu sau khi đăng nhập: chỉ báo tổng số chưa đọc */
    nSeen=new Set(NOTIFS.map(n=>n.id));
    if(unread.length)nPop({id:'sum',ic:'🔔',title:`Bạn có ${unread.length} thông báo chưa đọc`,body:unread.slice(0,3).map(n=>n.title).join(' · '),sum:true});
  }else{
    const fresh=NOTIFS.filter(n=>!nSeen.has(n.id));fresh.forEach(n=>nSeen.add(n.id));
    fresh.filter(nUnread).slice(0,3).reverse().forEach(n=>{nPop(n);nSystem(n)});
  }
  if($('#npanel'))nPanelRender();
}
/* ---------- khung thông báo nhảy ra ở góc phải trên ---------- */
function nPop(n){
  let box=$('#npop');if(!box){box=document.createElement('div');box.id='npop';box.setAttribute('aria-live','polite');document.body.appendChild(box)}
  const el=document.createElement('div');el.className='npop';el.setAttribute('role','status');
  el.innerHTML=`<span class="ni">${esc(n.ic||'🔔')}</span><div class="nb"><b>${esc(n.title)}</b>${n.body?`<span>${esc(n.body)}</span>`:''}<small>${n.sum?'Bấm để xem':esc((n.from?n.from+' · ':'')+nAgo(n.at))}</small></div><button type="button" class="x" aria-label="Đóng thông báo">✕</button>`;
  el.addEventListener('click',ev=>{if(ev.target.closest('.x')){el.remove();return}el.remove();n.sum?nPanelOpen():nOpen(n.id)});
  box.prepend(el);while(box.children.length>4)box.lastChild.remove();
  setTimeout(()=>{el.classList.add('out');setTimeout(()=>el.remove(),400)},9000);
}
/* thông báo của hệ điều hành (giống thông báo của Chrome): chỉ khi người dùng đã cho phép */
function nSystem(n){
  try{
    if(!('Notification' in window)||Notification.permission!=='granted')return;
    const sn=new Notification(n.title,{body:n.body||'',tag:n.id,icon:document.querySelector('link[rel=icon]')?.href});
    sn.onclick=()=>{window.focus();nOpen(n.id);sn.close()};
  }catch(e){}
}
const nAgo=t=>{const m=Math.round((Date.now()-t)/60000);return m<1?'vừa xong':m<60?m+' phút trước':m<1440?Math.round(m/60)+' giờ trước':fmtDate(new Date(t).toISOString().slice(0,10))};
/* ---------- chuông + danh sách ---------- */
function nPanelRender(){
  const p=$('#npanel');if(!p)return;const sys='Notification' in window?Notification.permission:'unsupported';
  p.innerHTML=`<div class="nph"><b>Thông báo</b>${NOTIFS.some(nUnread)?'<button type="button" class="lnk" data-act="notif-readall">Đánh dấu đã đọc hết</button>':''}</div>
    ${sys==='default'?'<div class="npsys"><span>Bật thông báo trên máy tính để thấy cả khi đang mở tab khác.</span><button type="button" class="btn sm acc" data-act="notif-perm">Bật thông báo</button></div>':sys==='denied'?'<div class="npsys muted">Trình duyệt đang chặn thông báo của trang này. Mở biểu tượng ổ khoá cạnh địa chỉ trang → Thông báo → Cho phép.</div>':''}
    <div class="npl">${NOTIFS.length?NOTIFS.slice(0,40).map(n=>`<button type="button" class="npi ${nUnread(n)?'un':''}" data-act="notif-open" data-id="${n.id}"><span class="ni">${esc(n.ic||'🔔')}</span><span class="nb"><b>${esc(n.title)}</b>${n.body?`<span>${esc(n.body)}</span>`:''}<small>${esc((n.from?n.from+' · ':'')+nAgo(n.at))}</small></span></button>`).join(''):'<div class="note" style="padding:16px">Chưa có thông báo nào.</div>'}</div>`;
}
function nPanelOpen(){
  let p=$('#npanel');if(p){p.remove();return}
  const pb=$('#npop');if(pb)pb.innerHTML='';   /* mở danh sách thì dẹp các khung đang nhảy ra */
  p=document.createElement('div');p.id='npanel';p.setAttribute('role','dialog');p.setAttribute('aria-label','Thông báo');document.body.appendChild(p);nPanelRender();
  setTimeout(()=>document.addEventListener('click',nOutside,true),0);
}
function nOutside(ev){const p=$('#npanel');if(!p){document.removeEventListener('click',nOutside,true);return}if(!p.contains(ev.target)&&!ev.target.closest('[data-act="notif"]')){p.remove();document.removeEventListener('click',nOutside,true)}}
async function nMarkRead(ids){
  const me=session&&session.id;if(!me)return;
  const list=NOTIFS.filter(n=>ids.includes(n.id)&&nUnread(n));if(!list.length)return;
  list.forEach(n=>n.readBy=[...(n.readBy||[]),me]);
  if(CLOUD){for(const n of list){try{await fbStore.doc('notifs/'+n.id).update({readBy:n.readBy})}catch(e){console.warn(e)}}}
  else{(db.notifs||[]).forEach(x=>{const n=list.find(y=>y.id===x.id);if(n)x.readBy=n.readBy});try{localStorage.setItem(LS_KEY,JSON.stringify(db))}catch(e){}}
  notifUpdate();
}
function nOpen(id){
  const n=NOTIFS.find(x=>x.id===id);if(!n)return;nMarkRead([id]);$('#npanel')?.remove();
  if(n.e&&n.y&&n.mm){const k=session.empId===n.e?'dash/me':'emp/'+n.e;
    if(!allowedHash(k))return;(ui.f[k]??={}).year=String(n.y);ui.f[k].mm=n.mm;if(location.hash==='#/'+k)render(false);else location.hash='#/'+k}
}
ACT.notif=()=>nPanelOpen();
ACT['notif-open']=el=>nOpen(el.dataset.id);
ACT['notif-readall']=()=>nMarkRead(NOTIFS.map(n=>n.id));
ACT['notif-perm']=async()=>{try{const r=await Notification.requestPermission();toast(r==='granted'?'Đã bật thông báo trên máy tính':'Chưa bật được thông báo',r==='granted'?'ok':'warn')}catch(e){}nPanelRender()};
