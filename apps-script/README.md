# Lưu file bằng chứng lên Google Drive

Nhân viên bấm **📎 Tải file lên** trong hộp Thêm / Sửa việc. File được lưu vào **Google Drive của người deploy script (Admin)**:

```
Sổ tay công việc – Bằng chứng / 2026-10 / MAU-01 – Trần Minh Khoa / <tên việc> – <tên file>
```

- Nhân viên **không cần tài khoản Google**. Mọi loại file, tối đa 25 MB mỗi file; ảnh lớn được tự nén trước khi gửi.
- Nhân viên tải lên / xoá (để tải lại) file của việc mình; Admin và Quản lý làm được với mọi việc. File xoá nằm trong Thùng rác của Drive 30 ngày.
- Script kiểm tra mã đăng nhập Firebase của người tải, người ngoài có địa chỉ script cũng không tải lên được.
- Mặc định file để chế độ “Bất kỳ ai có đường liên kết đều xem được” để nhân viên mở được bằng chứng của mình. Muốn riêng tư hơn: sửa `SHARE_BY_LINK = false` trong Code.gs, rồi chia sẻ thư mục gốc cho tài khoản Google của các quản lý.
- Dung lượng dùng chung với Gmail / Google Photos của tài khoản đó (15 GB miễn phí).

## Cài đặt (khoảng 5 phút, làm 1 lần)

1. Đăng nhập Google bằng tài khoản sẽ chứa file (ví dụ ahntuan13@gmail.com), mở <https://script.google.com> → **Dự án mới** (New project).
2. Đặt tên dự án, ví dụ `So tay cong viec - Bang chung`.
3. Xoá hết nội dung trong `Code.gs`, dán toàn bộ file [`Code.gs`](Code.gs) của thư mục này vào, bấm 💾 Lưu.
4. Bấm **Triển khai (Deploy) → Tùy chọn triển khai mới (New deployment)** → biểu tượng ⚙ chọn **Ứng dụng web (Web app)**:
   - Thực thi với tư cách (Execute as): **Tôi (Me)**
   - Người có quyền truy cập (Who has access): **Bất kỳ ai (Anyone)**
5. Bấm **Triển khai** → **Cấp quyền truy cập**, chọn tài khoản. Google báo “ứng dụng chưa được xác minh” là bình thường vì script do bạn tự viết: bấm **Nâng cao (Advanced)** → **Đi tới … (không an toàn)** → **Cho phép**. Script xin quyền Drive (tạo thư mục, lưu file) và gọi dịch vụ bên ngoài (kiểm tra đăng nhập Firebase).
6. Sao chép **URL ứng dụng web** (dạng `https://script.google.com/macros/s/…/exec`).
7. Mở app → **Settings → Nhóm & ngày lễ** → khung **Lưu file bằng chứng lên Google Drive** → dán URL → **Lưu** → **Kiểm tra kết nối**. Lần đầu kiểm tra sẽ tạo thư mục gốc trên Drive; bấm **📁 Mở thư mục trên Drive** để xem.

## Khi sửa Code.gs

Sửa xong phải **Triển khai → Quản lý các bản triển khai → ✏ → Phiên bản: Phiên bản mới → Triển khai** để giữ nguyên URL. Tạo “bản triển khai mới” sẽ ra URL khác, khi đó phải dán lại URL vào app.
