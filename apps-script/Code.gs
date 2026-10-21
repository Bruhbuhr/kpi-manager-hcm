/* =====================================================================
   Sổ tay công việc – Lưu file bằng chứng vào Google Drive
   ---------------------------------------------------------------------
   Script này chạy dưới tài khoản Google của người deploy (Admin). Nhân viên
   bấm "📎 Tải file" trong app → file được lưu vào Drive của Admin theo thư mục:
       Sổ tay công việc – Bằng chứng / 2026-10 / MÃ NV – Họ tên / <file>
   Nhân viên KHÔNG cần tài khoản Google.

   Bảo mật: mỗi yêu cầu phải kèm mã đăng nhập Firebase của người đang dùng app.
   Script kiểm tra mã này với Firebase và đọc vai trò (Admin / Quản lý / Nhân viên):
     - Nhân viên chỉ tải lên / xoá file của chính mình.
     - Admin và Quản lý tải lên / xoá file của mọi người.
   Cách cài: xem apps-script/README.md
   ===================================================================== */

/* Lấy từ config/firebase-config.js (hai giá trị này vốn công khai trong web app) */
const FIREBASE_API_KEY = 'AIzaSyBJ1KRziEP6--szS1qCr5TDXia56Fe9F8U';
const FIREBASE_PROJECT_ID = 'kpi-adhr-hcm';

const ROOT_NAME = 'Sổ tay công việc – Bằng chứng';  /* thư mục gốc, tự tạo ở lần tải đầu tiên */
const MAX_MB = 25;                                   /* dung lượng tối đa mỗi file */
/* true: ai có link mới xem được file (nhân viên không cần tài khoản Google vẫn mở được bằng chứng của mình).
   false: file riêng tư, chỉ người được chia sẻ thư mục gốc mới xem được. */
const SHARE_BY_LINK = true;

const PROPS = PropertiesService.getScriptProperties();

function doGet() { return out({ ok: true, app: 'kpi-evidence', ver: 1 }); }

function doPost(e) {
  try {
    const req = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    const who = checkUser(req.idToken);
    if (req.action === 'ping') return out({ ok: true, email: who.email, role: who.role, folder: rootFolder().getUrl() });
    if (req.action === 'upload') return out(upload(req, who));
    if (req.action === 'delete') return out(remove(req, who));
    throw new Error('Yêu cầu không hợp lệ.');
  } catch (err) {
    return out({ ok: false, error: String((err && err.message) || err) });
  }
}

function out(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }

/* Kiểm tra người gửi: mã đăng nhập Firebase hợp lệ + hồ sơ users/{uid} trên Firestore đang hoạt động */
function checkUser(idToken) {
  if (!idToken) throw new Error('Chưa đăng nhập.');
  const r = UrlFetchApp.fetch('https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=' + FIREBASE_API_KEY, {
    method: 'post', contentType: 'application/json', payload: JSON.stringify({ idToken: idToken }), muteHttpExceptions: true });
  if (r.getResponseCode() !== 200) throw new Error('Phiên đăng nhập đã hết hạn. Hãy tải lại trang rồi thử lại.');
  const u = (JSON.parse(r.getContentText()).users || [])[0];
  if (!u) throw new Error('Không xác định được người dùng.');
  /* đọc hồ sơ bằng chính mã đăng nhập của người dùng → Firestore Rules vẫn được áp dụng */
  const d = UrlFetchApp.fetch('https://firestore.googleapis.com/v1/projects/' + FIREBASE_PROJECT_ID + '/databases/(default)/documents/users/' + u.localId, {
    headers: { Authorization: 'Bearer ' + idToken }, muteHttpExceptions: true });
  if (d.getResponseCode() !== 200) throw new Error('Không đọc được hồ sơ người dùng.');
  const f = JSON.parse(d.getContentText()).fields || {};
  const val = k => f[k] ? (f[k].stringValue !== undefined ? f[k].stringValue : f[k].booleanValue) : undefined;
  const role = val('role');
  if (val('active') === false || val('deleted') === true || ['admin', 'member', 'staff'].indexOf(role) < 0) throw new Error('Tài khoản không có quyền tải file.');
  return { uid: u.localId, email: u.email || '', role: role, empId: val('empId') || '', name: val('name') || '' };
}

function mayTouch(who, empId) {
  if (who.role === 'admin' || who.role === 'member') return true;
  return !!who.empId && who.empId === empId;
}

function rootFolder() {
  const id = PROPS.getProperty('ROOT_FOLDER_ID');
  if (id) { try { const f = DriveApp.getFolderById(id); if (!f.isTrashed()) return f; } catch (e) {} }
  const f = DriveApp.createFolder(ROOT_NAME);
  PROPS.setProperty('ROOT_FOLDER_ID', f.getId());
  return f;
}
function sub(parent, name) {
  const it = parent.getFoldersByName(name);
  return it.hasNext() ? it.next() : parent.createFolder(name);
}
const clean = s => String(s || '').replace(/[\\/:*?"<>|\r\n\t]+/g, ' ').replace(/\s+/g, ' ').trim();

function upload(req, who) {
  if (!mayTouch(who, req.empId)) throw new Error('Bạn chỉ được tải file cho việc của chính mình.');
  if (!/^\d{4}-\d{2}$/.test(req.ym || '')) throw new Error('Thiếu tháng của công việc.');
  if (!req.data) throw new Error('File trống.');
  const bytes = Utilities.base64Decode(req.data);
  if (bytes.length > MAX_MB * 1024 * 1024) throw new Error('File lớn hơn ' + MAX_MB + ' MB.');
  const name = clean(req.name) || 'file';
  const title = clean(req.taskTitle).slice(0, 40);
  const lock = LockService.getScriptLock(); lock.waitLock(20000);   /* tránh tạo trùng thư mục khi nhiều người tải cùng lúc */
  let folder;
  try { folder = sub(sub(rootFolder(), req.ym), clean((req.empCode || '') + ' – ' + (req.empName || req.empId)) || req.empId); }
  finally { lock.releaseLock(); }
  const file = folder.createFile(Utilities.newBlob(bytes, req.mime || 'application/octet-stream', (title ? title + ' – ' : '') + name));
  file.setDescription(JSON.stringify({ app: 'kpi', empId: req.empId, taskId: req.taskId || '', by: who.email || who.uid, at: new Date().toISOString() }));
  if (SHARE_BY_LINK) { try { file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch (e) {} }
  return { ok: true, file: { id: file.getId(), name: name, size: bytes.length, mime: req.mime || '', url: file.getUrl() } };
}

function remove(req, who) {
  let file;
  try { file = DriveApp.getFileById(req.id); } catch (e) { return { ok: true, gone: true }; }   /* file đã bị xoá trên Drive */
  let meta = {};
  try { meta = JSON.parse(file.getDescription() || '{}'); } catch (e) {}
  if (meta.app !== 'kpi') throw new Error('File này không do app tải lên.');
  if (!mayTouch(who, meta.empId)) throw new Error('Bạn chỉ được xoá file của chính mình.');
  file.setTrashed(true);   /* vào Thùng rác của Drive, khôi phục được trong 30 ngày */
  return { ok: true };
}
