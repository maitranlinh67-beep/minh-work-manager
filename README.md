# Quản lý công việc của Minh · V1

Ứng dụng quản lý vận đơn, yêu cầu mua hộ, khách hàng và sổ thu chi. Không dùng thư viện ngoài, không cần bước build.

## Chạy thử

Mở `index.html` trong trình duyệt. Dữ liệu lưu cục bộ trong trình duyệt đang dùng. Dùng **Sao lưu dữ liệu** để xuất tệp JSON và **Nhập bản sao** để chuyển dữ liệu sang trình duyệt/máy khác.

## Đưa lên web

Tải cả `index.html`, `styles.css`, `app.js` lên dịch vụ host website tĩnh.

## Chuyển cho người khác

Gửi thư mục ứng dụng và tệp sao lưu JSON cho người tiếp nhận. Bản này không đồng bộ trực tiếp giữa nhiều người hoặc thiết bị; muốn cùng sửa một bộ dữ liệu cần bổ sung đăng nhập và cơ sở dữ liệu trực tuyến.

## Phạm vi

Trạng thái vận chuyển, mua hộ và thu chi đều nhập thủ công. Chưa có API tracking, SMS, cổng thanh toán hoặc kết nối ngân hàng. Dữ liệu mẫu có thể xóa trước khi dùng thật.

## Cùng làm trên một source với Codex và Antigravity

1. Trong Antigravity, chọn **Add Folder** và mở thư mục này:
   `/Users/tranlinhtuoi20/Documents/Codex/2026-11-06/1-ph-ng-ph-p-t/minh-work-manager-v1`
2. Chọn **Local** khi bắt đầu phiên làm việc để Antigravity sửa trực tiếp đúng các tệp này. Codex trong workspace hiện tại cũng có thể sửa cùng thư mục.
3. Hai công cụ nên làm luân phiên, không cùng sửa một tệp đồng thời. Sau mỗi lượt, xem phần thay đổi trong Git rồi mới giao việc tiếp theo.
4. Commit các thay đổi có ý nghĩa để lưu mốc và quay lại được. Chỉ cần GitHub khi muốn chia sẻ source qua mạng hoặc làm trên máy khác; hiện chưa cấu hình remote.

Source chính gồm `index.html`, `styles.css` và `app.js`. Tệp HTML độc lập trong thư mục `outputs` là bản xem nhanh; source chính cần sửa nằm trong thư mục `minh-work-manager-v1`.
