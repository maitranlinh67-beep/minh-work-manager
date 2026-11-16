# DAIRYCOW LOGISTICS · Hệ thống Quản lý Vận hành WMS & OMS

Hệ thống quản lý vận đơn ký gửi (WMS), yêu cầu mua hộ (OMS), tính lãi dịch vụ đóng gói, phân quyền người dùng, khách hàng và sổ thu chi. Không dùng thư viện ngoài, không cần bước build, tương thích ngược 100% với dữ liệu hiện tại.

## Điểm nâng cấp chính (DAIRYCOW LOGISTICS)

1. **Thương hiệu & Giao diện Admin Dashboard (CoreUI & Creative Tim):**
   - Đổi tên hệ thống thành **DAIRYCOW LOGISTICS**.
   - Bố cục Sidebar trái chuyên nghiệp (hỗ trợ thu gọn `☰` và nút `🎨 Đổi tone menu` chuyển nhanh giữa **CoreUI Dark Slate** và **Creative Tim Purple**).
   - 4 Thẻ Widget KPI rực rỡ ở đầu Dashboard tích hợp biểu đồ Sparkline SVG trực quan.
   - Bảng biểu đồ lớn **Traffic · Lưu lượng Dòng tiền & Lợi nhuận** với bộ chọn nhanh `Day | Month | Year | All` và 5 cột chỉ số thanh tiến độ ở chân bảng.
   - 4 Thẻ Kênh Vận Hành (`✈️ Line Xách Tay`, `💴 Thanh Toán Hộ`, `📦 Đơn Ký Gửi Kho`, `🪵 Dịch Vụ Đóng Gói`) kèm biểu đồ sóng SVG.
2. **Quản lý Dịch vụ Đóng gói & Lợi nhuận Đóng gói:**
   - Hỗ trợ chọn quy cách đóng gói (`Đóng gỗ / Khung gỗ`, `Quấn bọt khí / Chống sốc`, `Thùng carton 5 lớp gia cố`, `Chống ẩm / Hút chân không`, `Đóng palet / Kiện lớn`) trên cả **Note đơn** và **Đơn ký gửi kho**.
   - Tự động tính **Lãi đóng gói** (`Phí đóng gói thu khách − Chi phí vật tư gốc`) và tổng hợp vào cơ cấu lợi nhuận.
3. **Phân quyền Người dùng (RBAC):**
   - Chuyển đổi nhanh trên thanh Topbar hoặc trong cửa sổ **🛡 Phân quyền**:
     - `👑 Admin (Toàn quyền)`
     - `📦 Nhân viên Kho & Đóng gói (WMS)`
     - `💼 Nhân viên Sale & CSKH (OMS)`
4. **Bảo toàn 100% dữ liệu cũ:**
   - Đọc và lưu tương thích hoàn toàn với khóa `localStorage` hiện tại (`minh-work-manager-v1-data`, `linh-logistics-v1-data`).
