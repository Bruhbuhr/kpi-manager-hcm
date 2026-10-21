/* 22-evidence.js – File bằng chứng của từng việc: tải lên Google Drive của Admin qua Google Apps Script (apps-script/Code.gs).
   - Nhân viên / quản lý bấm "📎 Tải file lên" trong hộp Thêm / Sửa việc, chọn một hoặc nhiều file (mọi loại file).
   - Ảnh lớn được nén trước khi gửi (tối đa 2000 px, JPEG) để tiết kiệm dung lượng Drive.
   - File lưu ở Drive theo thư mục: Sổ tay công việc – Bằng chứng / yyyy-mm / MÃ NV – Họ tên.
   - Danh sách file lưu trong việc: t.files = [{id, name, size, mime, url, by, at}].
   - Người sửa được việc (nhân viên: việc của mình chưa được Duyệt; quản lý: mọi việc) được tải lên và xoá file để tải lại.
   Cần chế độ Firebase (để Apps Script kiểm tra người tải) và Admin dán địa chỉ Web app ở Settings → Nhóm & ngày lễ. */
'use strict';
(self.__mods=self.__mods||[]).push('22-evidence');

const EV_MAX_MB=25;
const evUrl=()=>String((db&&db.company&&db.company.evidenceUrl)||'').trim();
const filesOf=t=>t&&Array.isArray(t.files)?t.files:[];
const fmtSize=b=>!b?'':b<1024*1024?Math.max(1,Math.round(b/1024))+' KB':(b/1048576).toFixed(1).replace('.',',')+' MB';
const fIcon=f=>{const m=String(f.mime||''),n=String(f.name||'').toLowerCase();return m.startsWith('image/')?'🖼️':m.includes('pdf')||n.endsWith('.pdf')?'📕':/sheet|excel|csv/.test(m)||/\.(xlsx?|csv)$/.test(n)?'📗':/word|document/.test(m)||/\.docx?$/.test(n)?'📘':/zip|rar|7z/.test(m+n)?'🗜️':/video\//.test(m)?'🎬':'📎'};
const evChip=(f,del)=>`<span class="chip ev"><a href="${esc(f.url)}" target="_blank" rel="noopener noreferrer" title="${esc(f.name)}${f.by?' · tải bởi '+esc(f.by):''}${f.at?' · '+fmtDate(f.at):''}">${fIcon(f)} ${esc(f.name)}</a>${f.size?` <small>${fmtSize(f.size)}</small>`:''}${del?` <button type="button" class="x" data-act="ev-del" data-fid="${esc(f.id)}" aria-label="Xoá file ${esc(f.name)}" title="Xoá file (để tải lại)">✕</button>`:''}</span>`;
const evList=(t,del)=>filesOf(t).length?filesOf(t).map(f=>evChip(f,del)).join(''):'<span class="muted">Chưa có file nào.</span>';
/* khối "Bằng chứng (file)" trong hộp Thêm / Sửa việc */
function evBlock(t,{edit,assign}){
  const why=!CLOUD?'Tải file chỉ dùng được khi app chạy với Firebase.':!evUrl()?(can('admin')?'Chưa kết nối Google Drive: vào Settings → Nhóm & ngày lễ để dán địa chỉ Web app.':'Admin chưa kết nối Google Drive để lưu file.'):assign?'Giao việc xong, nhân viên tự tải file bằng chứng ở hộp Sửa việc.':'';
  return `<div class="f full evbox"><span>Bằng chứng (file) <small class="muted">ảnh, PDF, Excel, Word… tối đa ${EV_MAX_MB} MB mỗi file, lưu trên Google Drive</small></span>
    <div class="evl" id="ev-list">${evList(t,edit&&!why)}</div>
    ${edit&&!why?`<div class="bar" style="margin:6px 0 0"><label class="btn sm acc evup">📎 Tải file lên<input type="file" multiple data-ev-in hidden></label><small class="muted" id="ev-msg">${t&&t.id?'':'Việc mới sẽ được lưu trước khi tải file.'}</small></div>`:why?`<small class="muted">${why}</small>`:''}</div>`;
}
/* ảnh lớn: thu nhỏ còn tối đa 2000 px, JPEG 82%; không nhỏ hơn thì giữ nguyên file gốc */
async function evShrink(file){
  if(!/^image\/(jpeg|png|webp|bmp)$/.test(file.type)||file.size<700*1024||typeof createImageBitmap!=='function')return file;
  try{const bmp=await createImageBitmap(file),k=Math.min(1,2000/Math.max(bmp.width,bmp.height)),c=document.createElement('canvas');c.width=Math.round(bmp.width*k);c.height=Math.round(bmp.height*k);
    const g=c.getContext('2d');g.fillStyle='#fff';g.fillRect(0,0,c.width,c.height);g.drawImage(bmp,0,0,c.width,c.height);
    const blob=await new Promise(r=>c.toBlob(r,'image/jpeg',.82));if(!blob||blob.size>=file.size)return file;
    return new File([blob],file.name.replace(/\.(png|webp|bmp|jpe?g)$/i,'')+'.jpg',{type:'image/jpeg'});
  }catch(e){return file}
}
const b64=file=>new Promise((ok,no)=>{const r=new FileReader();r.onload=()=>ok(String(r.result).split(',')[1]||'');r.onerror=()=>no(new Error('Không đọc được file '+file.name));r.readAsDataURL(file)});
async function evCall(body){
  if(!CLOUD||!fbAuth||!fbAuth.currentUser)throw new Error('Cần đăng nhập Firebase để tải file.');
  const url=evUrl();if(!url)throw new Error('Admin chưa kết nối Google Drive.');
  const idToken=await fbAuth.currentUser.getIdToken();
  let res;try{res=await fetch(url,{method:'POST',body:JSON.stringify({...body,idToken})})}catch(e){throw new Error('Không kết nối được Google Drive (kiểm tra mạng hoặc địa chỉ Web app).')}
  let j;try{j=await res.json()}catch(e){throw new Error('Google Drive trả về dữ liệu lạ. Kiểm tra lại cách deploy Web app (Ai có quyền truy cập: Bất kỳ ai).')}
  if(!j.ok)throw new Error(j.error||'Lỗi không rõ từ Google Drive.');
  return j;
}
/* ghi danh sách file vào việc (không đổi trạng thái duyệt) */
function evPatch(e,y,mm,id,fn){return transact(()=>{const sh=sheetOf(e,y),t=sh&&by(sh.months[mm].tasks,id);if(!t)throw new Error('Việc này không còn tồn tại.');t.files=filesOf(t).slice();fn(t);if(!t.files.length)delete t.files;sh.updatedAt=todayStr()})}
const evTask=form=>{const {e,y,mm,id}=form.dataset,sh=id&&sheetOf(e,y);return sh?by(sh.months[mm].tasks,id):null};
const evShow=form=>{const t=evTask(form),l=$('#ev-list');if(l)l.innerHTML=evList(t,true);if(typeof refreshTbl==='function'&&$('#tbl'))refreshTbl()};
let evBusy=false;
document.addEventListener('change',async ev=>{
  const inp=ev.target;if(!inp.matches||!inp.matches('input[data-ev-in]'))return;
  const form=$('#mf'),files=[...inp.files];inp.value='';if(!form||!files.length)return;
  if(evBusy)return toast('Đang tải file, chờ một chút.','warn');
  const big=files.filter(f=>f.size>EV_MAX_MB*1048576);if(big.length)return toast(`File lớn hơn ${EV_MAX_MB} MB: ${big.map(f=>f.name).join(', ')}`,'error');
  /* việc mới: lưu việc trước để có chỗ gắn file */
  if(!form.dataset.id){const r=ktSave(form);if(!r)return;form.dataset.id=r.id;form.dataset.e=r.e;const h=$('.md .mh h3');if(h)h.textContent='Sửa việc';toast('Đã lưu việc, đang tải file…')}
  const t=evTask(form);if(!t)return;
  const {e,y,mm,id}=form.dataset,emp=empOf(e)||{},list=$('#ev-list'),msg=$('#ev-msg');
  evBusy=true;let ok=0;
  for(const f0 of files){
    const tmp=document.createElement('span');tmp.className='chip ev wait';tmp.textContent='⏳ Đang tải '+f0.name+'…';if(list){list.querySelector('.muted')?.remove();list.appendChild(tmp)}
    try{const f=await evShrink(f0),data=await b64(f);
      const r=await evCall({action:'upload',empId:e,empCode:emp.code||'',empName:emp.name||'',ym:`${y}-${mm}`,taskId:id,taskTitle:String(t.title||'').split('\n')[0],name:f.name,mime:f.type||'',data});
      if(evPatch(e,y,mm,id,x=>x.files.push({...r.file,by:session?.name||'',at:todayStr()})))ok++;
    }catch(err){toast(`${f0.name}: ${err.message}`,'error')}
    tmp.remove();
  }
  evBusy=false;if(msg)msg.textContent='';evShow(form);
  if(ok)toast(`Đã tải ${ok} file lên Google Drive`);
});
ACT['ev-del']=async el=>{
  const form=$('#mf');if(!form)return;const t=evTask(form),f=filesOf(t).find(x=>x.id===el.dataset.fid);if(!f)return;
  if(!confirm(`Xoá file "${f.name}"? File được chuyển vào Thùng rác của Google Drive.`))return;
  const {e,y,mm,id}=form.dataset;el.disabled=true;
  try{await evCall({action:'delete',id:f.id})}catch(err){el.disabled=false;return toast(err.message,'error')}
  if(evPatch(e,y,mm,id,x=>{x.files=x.files.filter(z=>z.id!==f.id)})){toast('Đã xoá file');evShow(form)}
};
/* Settings: địa chỉ Web app của Apps Script */
SUB['ev-url']=form=>{if(!can('admin'))return toast('Chỉ Admin cài đặt.','error');const u=String(fd(form).url||'').trim();
  if(u&&!/^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/.test(u))return toast('Địa chỉ phải có dạng https://script.google.com/macros/s/…/exec','error');
  if(transact(()=>{db.company.evidenceUrl=u})){rerender();toast(u?'Đã lưu địa chỉ Google Drive':'Đã tắt tải file lên Google Drive')}};
ACT['ev-test']=async el=>{el.disabled=true;try{const r=await evCall({action:'ping'});toast(`Kết nối tốt · tài khoản ${r.email} (${ROLES[r.role]||r.role})`);const a=$('#ev-folder');if(a&&r.folder){a.href=r.folder;a.hidden=false}}catch(err){toast(err.message,'error')}el.disabled=false};
const evSettingsCard=()=>{const adm=can('admin'),u=evUrl();
  return card('Lưu file bằng chứng lên Google Drive',`<form data-submit="ev-url"><label class="f"><span>Địa chỉ Web app (Google Apps Script)</span><input class="in" name="url" value="${esc(u)}" placeholder="https://script.google.com/macros/s/…/exec" ${adm?'':'readonly'}></label>
    <div class="bar" style="margin:8px 0 0"><button class="btn primary" ${adm?'':'disabled'}>Lưu</button><button type="button" class="btn" data-act="ev-test" ${u&&CLOUD?'':'disabled'}>Kiểm tra kết nối</button><a class="btn" id="ev-folder" target="_blank" rel="noopener" hidden>📁 Mở thư mục trên Drive</a></div></form>
    <p class="note">${u?'Đang bật: nhân viên và quản lý tải được file trong hộp Sửa việc.':'Chưa bật.'} Cách cài (khoảng 5 phút): mở <a href="apps-script/README.md" target="_blank" rel="noopener">apps-script/README.md</a>, dán file <a href="apps-script/Code.gs" target="_blank" rel="noopener">Code.gs</a> vào script.google.com, Deploy thành Web app (Thực thi với tư cách: Tôi · Ai có quyền truy cập: Bất kỳ ai) rồi dán địa chỉ vào ô trên.${CLOUD?'':' <b>Cần bật Firebase</b> thì mới tải file được.'}</p>`)};
