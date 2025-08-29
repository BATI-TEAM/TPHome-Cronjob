# Hướng dẫn chạy các script (Node.js + Playwright)

Tài liệu này hướng dẫn cài đặt và chạy các script trong thư mục dự án bằng nodemon. Lưu ý các file sau KHÔNG được hướng dẫn trong tài liệu này theo yêu cầu: `searchSiteTPHome.js`, `searchTPHome.js`, `temp.js`, `test.js`.

## 1) Yêu cầu
- Node.js 18+ và npm
- Hệ điều hành có thể chạy Playwright (Windows / macOS / Linux)

## 2) Cài đặt
```bash
npm install
```

(Quan trọng) Nếu lần đầu dùng Playwright trên máy, bạn nên cài browser cho Playwright:
```bash
npx playwright install chromium
```

## 3) Cách chạy bằng nodemon
- Nodemon đã được khai báo trong dependencies, bạn có thể chạy trực tiếp bằng:
```bash
npx nodemon <ten-file>.js
```

## 4) Danh sách các script có thể chạy
Dưới đây là các file có thể khởi chạy trực tiếp. Mỗi script đều tự quản lý vòng lặp/thời gian chờ bên trong, vì vậy khi chạy sẽ tiếp tục hoạt động cho tới khi bạn dừng bằng Ctrl+C.

- index.js – Thu thập toàn bộ liên kết nội bộ trên trang `tphomevn.com` theo chu kỳ (bỏ qua lỗi HTTPS)
  ```bash
  npx nodemon index.js
  ```

- homePage.js – Truy cập một số URL cố định và nhấp ngẫu nhiên các liên kết nội bộ (cron 30 phút)
  ```bash
  npx nodemon homePage.js
  ```

- blogs.js – Truy cập danh sách các bài blog rồi nhấp ngẫu nhiên các liên kết nội bộ (cron 30 phút)
  ```bash
  npx nodemon blogs.js
  ```

- pages.js – Truy cập danh sách các trang (pages) rồi nhấp ngẫu nhiên các liên kết nội bộ (cron 30 phút)
  ```bash
  npx nodemon pages.js
  ```

- searchEventTPHome.js – Tìm trên Google theo các từ khóa sự kiện/khuyến mãi, vào kết quả `tphomevn.com` và duyệt các liên kết nội bộ
  ```bash
  npx nodemon searchEventTPHome.js
  ```

- searchImproveCTR.js – Tìm Google theo các từ khóa thương hiệu/CTR, mở kết quả `tphomevn.com` và duyệt các liên kết nội bộ
  ```bash
  npx nodemon searchImproveCTR.js
  ```

- searchImproveIndex.js – Tìm Google theo bộ từ khóa để cải thiện index, mở `tphomevn.com` và duyệt liên kết nội bộ
  ```bash
  npx nodemon searchImproveIndex.js
  ```

- searchImproveKeyword.js – Tìm Google theo bộ từ khóa mục tiêu, mở `tphomevn.com` và duyệt liên kết nội bộ
  ```bash
  npx nodemon searchImproveKeyword.js
  ```

- searchPriceTPHome.js – Tìm Google theo các từ khóa giá, mở `tphomevn.com/gia-gach-op-lat` và duyệt liên kết nội bộ
  ```bash
  npx nodemon searchPriceTPHome.js
  ```

## 5) Lưu ý quan trọng
- Mỗi lần chỉ nên chạy 1–2 script để tránh tốn tài nguyên/chặn từ Google.
- Một số script chạy headless=false (mở cửa sổ trình duyệt), bạn có thể điều chỉnh nếu cần.
- Dừng script bằng tổ hợp phím Ctrl+C.

## 6) Thư mục/Module hỗ trợ (không chạy trực tiếp)
- helpers.js – Chứa các hàm hỗ trợ dùng chung cho các script Playwright.

Nếu cần thêm lệnh npm scripts (ví dụ `npm run ...`) cho tiện sử dụng, mình có thể bổ sung theo yêu cầu.
