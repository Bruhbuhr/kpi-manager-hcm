/* 12-theme.js – Giao diện "sổ tay": 3 mẫu + Cổ điển. Mỗi người chọn ở nút 🎨, lưu theo trình duyệt. */
'use strict';
(self.__mods=self.__mods||[]).push('12-theme');

/* sw: [bìa, giấy, mực, điểm nhấn] – dùng vẽ ảnh xem trước. cc: màu biểu đồ của mẫu. */
const THEMES={
  note:{name:'Sổ kẻ ô',desc:'Bìa xanh than có lỗ gáy, giấy kẻ ô, mực xanh, đường lề đỏ ở bảng việc.',nb:1,sw:['#1f2e52','#f3f6fb','#2f57a6','#e19aa5'],
    cc:{bar:'#2f57a6',low:'#c33f50',line:'#1e8a6e',prev:'#a7b1c8',xs:'#1e8a6e',tot:'#2f57a6',dat:'#a7b1c8',cct:'#c33f50',band:'#b9c3d8',lbl:'#6c7795',ink:'#1c2742',grid:'#e3e9f3',fill:'rgba(47,87,166,.10)',prov:'#b8c7e6'}},
  bujo:{name:'Bullet journal',desc:'Bìa giấy sáng, lưới chấm, xanh lá xô thơm. Nhẹ và thoáng.',nb:1,sw:['#eceee8','#f9f9f6','#3d7360','#cfd5cc'],
    cc:{bar:'#3d7360',low:'#b9453b',line:'#3d6a8a',prev:'#b3bcb6',xs:'#3d7360',tot:'#3d6a8a',dat:'#b3bcb6',cct:'#b9453b',band:'#c4cbc5',lbl:'#6f7a73',ink:'#26302b',grid:'#e7eae4',fill:'rgba(61,115,96,.10)',prov:'#bcd4c9'}},
  planner:{name:'Sổ kế hoạch',desc:'Bìa than chì, giấy dòng kẻ ngang, thẻ chỉ mục màu nghệ, tiêu đề viết tay.',nb:1,sw:['#2a2e35','#f6f6f3','#a65f0b','#e4e6ea'],
    cc:{bar:'#3b5f8a',low:'#b83e3e',line:'#a65f0b',prev:'#b4b8c0',xs:'#2f7d5b',tot:'#3b5f8a',dat:'#b4b8c0',cct:'#b83e3e',band:'#c3c6cc',lbl:'#727782',ink:'#24272c',grid:'#e6e7ea',fill:'rgba(59,95,138,.10)',prov:'#bccbdc'}},
  classic:{name:'Cổ điển',desc:'Giao diện ban đầu: menu xanh thép, nền xám xanh.',nb:0,sw:['#143f63','#eef1f8','#1f6fd0','#16b3a2'],
    cc:{bar:'#2f7de1',low:'#dc4f47',line:'#0e9f8b',prev:'#a3abc4',xs:'#0e9f8b',tot:'#2f7de1',dat:'#a3abc4',cct:'#dc4f47',band:'#b4bdd2',lbl:'#6b7394',ink:'#1f2544',grid:'#e6e9f2',fill:'rgba(47,125,225,.10)',prov:'#b7cdec'}}
};
const TH_KEY='kpihcm_theme';
const curTheme=()=>{const t=document.documentElement.dataset.theme;return THEMES[t]?t:'note'};
function applyTheme(t,persist=true){
  if(!THEMES[t])t='note';const h=document.documentElement;h.dataset.theme=t;
  if(THEMES[t].nb)h.dataset.nb='1';else delete h.dataset.nb;
  Object.assign(CC,THEMES[t].cc);
  if(persist){try{localStorage.setItem(TH_KEY,t)}catch(e){}}
}
applyTheme(curTheme(),false);
const thPreview=(k,sw)=>`<span class="thp ${k}" aria-hidden="true"><i style="background:${sw[0]}"></i><span class="thpg" style="background-color:${sw[1]}"><span class="a" style="background:${sw[2]}"></span><span style="width:80%;background:${sw[3]}"></span><span style="width:64%"></span><span class="c" style="background:${sw[2]}"></span></span></span>`;
ACT.theme=()=>{
  const cur=curTheme();
  modal('Giao diện',`<p class="note" style="padding-top:0">Chọn kiểu trang cho máy này. Dữ liệu và cách tính KPI không đổi.</p>
    <div class="thg" role="group" aria-label="Chọn giao diện">${Object.entries(THEMES).map(([k,t])=>`<button type="button" class="tho" data-act="theme-set" data-t="${k}" aria-pressed="${k===cur}">${thPreview(k,t.sw)}<b>${esc(t.name)}${k==='note'?' <small>(mặc định)</small>':''}</b><small>${esc(t.desc)}</small></button>`).join('')}</div>`,
    {footer:'<button class="btn primary" data-act="close">Xong</button>',size:'mid'});
};
ACT['theme-set']=el=>{
  applyTheme(el.dataset.t);
  $$('.tho').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.t===el.dataset.t)));
  if(typeof refreshTbl==='function'&&$('#content'))refreshTbl();   /* vẽ lại biểu đồ theo màu mới */
  toast('Đã đổi giao diện: '+THEMES[curTheme()].name);
};
