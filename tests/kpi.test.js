/* tests/kpi.test.js – kiểm tra Chỉ tiêu KPI (Khung 2): nhãn, id, gom nhóm, nhập lại danh mục, đọc sheet Excel, chuyển việc giữ chỉ tiêu.
   Chạy: node --test tests/kpi.test.js   (Node 22, không cần cài gì) */
'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
/* nạp các file js/ của app vào một vm, giả lập phần trình duyệt mà các file này cần lúc nạp */
const ctx=vm.createContext({FIREBASE_CONFIG:null,localStorage:{getItem:()=>null,setItem(){}},self:{},ACT:{},SUB:{},console});
for(const f of['01-core-utils.js','02-data-model.js','23-import.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'..','js',f),'utf8'),ctx,{filename:f});
const run=code=>{const v=vm.runInContext(code,ctx);return v&&typeof v==='object'?JSON.parse(JSON.stringify(v)):v};   /* đưa kết quả về realm của test để so sánh deepEqual */
run('db=defaultDB()');
/* sheet giả theo kiểu SheetJS: {A10:'I', G11:0.1, …} → {A10:{v:'I'}, …} */
const ws=cells=>Object.fromEntries(Object.entries(cells).map(([k,v])=>[k,{v}]));
const task=(id,w,kpi,extra={})=>({id,title:id,weight:w,deadline:'2026-10-10',submitted:'2026-10-10',approval:'Duyệt',note:'',...(kpi?{kpi}:{}),...extra});

test('kpiLabel: dòng đầu, bỏ nháy / gạch / số thứ tự của ô Excel',()=>{
  ctx.T=["'Tính lương ",'- Làm ngoài giờ',' 2.  Điều phối xe nhà\' ','1.  Đáp ứng đúng yêu cầu dịch vụ hành chánh:\n   - Namecard','Enhancement CPL with OHSAS 45000 and ISO 14001\n - Đánh giá chất lượng tài xế','x'.repeat(120)];
  assert.deepEqual(run('T.map(kpiLabel)'),['Tính lương','Làm ngoài giờ','Điều phối xe nhà','Đáp ứng đúng yêu cầu dịch vụ hành chánh','Enhancement CPL with OHSAS 45000 and ISO 14001','x'.repeat(89)+'…']);
});

test('kpiId: cố định theo nội dung, bỏ qua khác biệt khoảng trắng / xuống dòng, trùng thì thêm -2',()=>{
  assert.equal(run("kpiId('Các phòng họp,khu vực office')"),run("kpiId('  các phòng họp,khu vực\\noffice ')"));
  assert.match(run("kpiId('A')"),/^k[0-9a-z]+$/);
  assert.equal(run("(()=>{const t=new Set([kpiId('A')]);return kpiId('A',t)})()"),run("kpiId('A')")+'-2');
});

/* danh mục kiểu sheet Tuyen: 1 = một dòng có trọng số; 3 = nhóm tiêu đề có 2 chỉ tiêu con */
const KPI={sec:'KPI Công ty và hoạt động của phòng (KRI)',rows:[{id:'a',no:'1',text:'Corporate compliance',w:10},{id:'b',no:'3',text:'Vệ sinh văn phòng',w:null},{id:'c',no:'',text:'Các phòng họp',w:40},{id:'d',no:'',text:'Rác thải ESG',w:10}]};
test('kpiGroups: thứ tự giống Excel, tổng mục I bằng tổng Khung 2, việc lạ / chưa gắn vào Chưa phân loại',()=>{
  ctx.K=KPI;ctx.TS=[task('t1',9,'a'),task('t2',10,'c'),task('t3',6,'c',{approval:''}),task('t4',1,''),task('t5',2,'zzz'),task('t6',5,'c',{submitted:null,movedTo:{year:2026,month:'11',id:'x'}})];
  const g=run("kpiGroups(K,TS.map(t=>({t,sc:scoreTask(t,'2026-10-31')})))");
  assert.deepEqual(g.map(x=>x.lv==='task'?x.r.t.id:x.lv),['sec','cat','t1','cat','line','t2','t3','t6','line','none','t4','t5']);
  const sec=g[0];assert.deepEqual([sec.wUsed,sec.wStd,sec.pts],[28,60,22]);   /* 9+10+6+1+2 (t6 đã chuyển không tính) · 10+40+10 · việc đã Duyệt 9+10+1+2 */
  const c=g[4];assert.deepEqual([c.row.id,c.wUsed,c.wStd,c.pts],['c',16,40,10]);
  assert.deepEqual([g[3].wStd,g[3].wUsed],[50,16]);   /* nhóm 3 = tổng 2 chỉ tiêu con */
  assert.deepEqual(g.filter(x=>x.lv==='task').map(x=>x.r.i),[0,1,2,3,4,5]);   /* đánh số theo thứ tự trên màn hình */
  assert.equal(run("kpiGroups(K,[]).some(x=>x.lv==='none')"),false);
});

test('kpiMerge: file là chuẩn, giữ id khi trùng nội dung, báo dòng bị bỏ',()=>{
  ctx.OLD={rows:[{id:'k_old',no:'1',text:'Corporate  compliance',w:10},{id:'k_gone',no:'',text:'Chỉ tiêu cũ',w:5},{id:'k_h',no:'2',text:'Tiêu đề',w:null}]};
  ctx.NEW=[{id:'kx',no:'1',text:'corporate compliance',w:10},{id:'ky',no:'',text:'Chỉ tiêu mới',w:5}];
  const m=run('kpiMerge(OLD,NEW)');
  assert.deepEqual(m.rows.map(r=>r.id),['k_old','ky']);
  assert.deepEqual(m.dropped.map(r=>r.id),['k_gone']);   /* dòng tiêu đề bị bỏ không có việc nên không báo */
  assert.deepEqual(run('kpiMerge(null,NEW)').rows.map(r=>r.id),['kx','ky']);
});

test('kpiUse + moveTasks: đếm việc theo tháng; chuyển sang tháng sau giữ chỉ tiêu',()=>{
  run(`db=defaultDB();db.employees.push({id:'e1',code:'S1',name:'A',active:true});const s=sheetOf('e1',2026,true);
    s.months['10'].tasks.push({id:'m1',title:'x',weight:3,deadline:'2026-10-30',submitted:null,approval:'',note:'',kpi:'c'},{id:'m2',title:'y',weight:2,deadline:'2026-10-30',submitted:null,approval:'',note:'',kpi:'d'});
    s.months['11'].tasks.push({id:'m3',title:'z',weight:2,deadline:'2026-11-30',submitted:null,approval:'',note:'',kpi:'c'})`);
  assert.deepEqual(run("kpiUse('e1',2026,id=>id==='c')"),{n:2,by:'T10: 1, T11: 1'});
  assert.ok(run("moveTasks('e1',2026,'10',['m1'],null)"));
  assert.equal(run("sheetOf('e1',2026).months['11'].tasks.find(t=>t.carriedFrom&&t.carriedFrom.id==='m1').kpi"),'c');
});

test('parseKpiCatalog: đọc mục I các sheet Individual KPIs (Tuyen, Chau, An), bỏ sheet khác',()=>{
  const head={A1:'PERFORMANCE RATINGS / BIỂU ĐÁNH GIÁ KẾT QUẢ CÔNG VIỆC \nNăm 2026',A10:'I',B10:0.8,C10:'KPI Công ty và hoạt động của phòng (KRI)'};
  const tuyen=ws({...head,C3:'CHAU THI MONG TUYEN',F4:'S22501',A11:1,C11:'Corporate compliance : violation case',G11:0.1,H11:' - Tối đa 100%.',A12:2,C12:'Enhancement CPL with OHSAS 45000 and ISO 14001\n - Thuốc luôn sẵn có',G12:0.1,
    A13:3,C13:'Vệ sinh văn phòng - Mức độ sạch sẽ và gọn gàng của văn phòng',C14:'Các phòng họp,khu vực office, kho  luôn được giữ sạch sẽ',G14:0.4,C15:' Cập nhật rác thải, nhựa & giấy phục vụ ESG report',G15:0.1,A16:4,C16:'- Làm ngoài giờ',C17:'Số giờ làm thêm trong tháng không vượt quá 10 giờ',G17:0.1,
    A18:'II',C18:'Thái độ công việc & Tuân thủ nội quy và quy định',G18:0.2,C19:'Working time',G19:0.1});
  const chau=ws({...head,C3:'Dang Thi Huyen Chau',F4:'S20506',A11:1,C11:'Corporate compliance : violation case',G11:0.1,A12:2,C13:'Learning & Development',C14:'Tỷ lệ giữ chân nhân viên chủ chốt',G14:0.4,A15:3,C15:"'Tính lương ",C16:'Thanh toán lương đúng tiến độ',G16:0.1,A17:4,C17:'Báo cáo OT & AL hàng tháng',C18:'Monthly OT & Off day Monitoring',G18:0.2,A19:'II'});
  const an=ws({...head,C3:'Nguyen Thi Tan An',A11:1,C11:'Corporate compliance',G11:0.1,A12:2,C12:'Tuyển dụng',C13:'a',G13:0.2,C14:'b',G14:0.2,C15:'c',G15:0.2,C16:'Chứng chỉ hành nghề',G16:0.05,A17:3,C17:'- Làm ngoài giờ',C18:'OT',G18:0.1,A19:'II'});
  ctx.WB={SheetNames:['KPI RESULT','Individual KPIs -Tuyen ','Individual KPIs-Chau ','Individual KPIs-An '],Sheets:{'KPI RESULT':ws({A10:'I'}),'Individual KPIs -Tuyen ':tuyen,'Individual KPIs-Chau ':chau,'Individual KPIs-An ':an}};
  const [t,c,a]=run('parseKpiCatalog(WB)');
  assert.deepEqual([t.sheet,t.code,t.name,t.year,t.sec,t.secW],['Individual KPIs -Tuyen','S22501','CHAU THI MONG TUYEN',2026,'KPI Công ty và hoạt động của phòng (KRI)',80]);
  assert.deepEqual(t.rows.map(r=>[r.no,r.w]),[['1',10],['2',10],['3',null],['',40],['',10],['4',null],['',10]]);   /* dừng ở mục II */
  assert.equal(t.rows[0].rule,'- Tối đa 100%.');
  assert.equal(t.rows[3].id,run("kpiId('Các phòng họp,khu vực office, kho luôn được giữ sạch sẽ')"));
  assert.deepEqual(c.rows.map(r=>[r.no,r.text,r.w]).slice(0,4),[['1','Corporate compliance : violation case',10],['2','Learning & Development',null],['','Tỷ lệ giữ chân nhân viên chủ chốt',40],['3',"'Tính lương",null]]);
  assert.equal(a.code,'');   /* sheet không có Mã NV → màn hình nhập báo "Sheet không có Mã NV (ô F4)" */
  assert.equal(a.rows.filter(r=>r.w!=null).reduce((s,r)=>s+r.w,0),85);   /* sheet An cộng ra 85 (Excel tự trừ G16): nhập nguyên, màn hình báo khác chuẩn 80 */
});
