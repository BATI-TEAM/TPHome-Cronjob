const { chromium } = require('playwright');
const H = require('./helpers');

let isRunning = false; // Cờ kiểm tra tác vụ đang chạy

// Thu thập dữ liệu trang tphomevn
async function handleTphomevnPage(page, url, visited) {
  console.log(`🌐 Truy cập trang: ${url}`);

  if (!page.url().includes('tphomevn.com')) {
    page = await H.clickLinkByUrl(page, url);
  }

  await page.waitForTimeout(10000); // Chờ trang tải

  const links = await H.getInternalTphomevnLinks(page, url);

  for (const link of links) {
    if (visited.has(link)) continue;
    visited.add(link);

    console.log(`🔗 Nhấn vào: ${link}`);
    page = await H.clickLinkByUrl(page, link);

    // Thu thập đệ quy các liên kết con
    await handleTphomevnPage(page, link, visited);

    // Quay lại trang chủ
    page = await H.clickLinkByUrl(page, 'https://tphomevn.com');
  }
}

// Hàm chính với xử lý lỗi HTTPS
async function crawlTphomevnTask() {
  if (isRunning) {
    console.log('⏳ Tác vụ đang chạy, bỏ qua lần này.');
    return;
  }

  isRunning = true;
  console.log('🚀 Bắt đầu thu thập tphomevn...');

  try {
    // Khởi chạy trình duyệt với tùy chọn bỏ qua lỗi HTTPS
    const browser = await chromium.launch({ 
      headless: true,
      ignoreHTTPSErrors: true // Bỏ qua lỗi chứng chỉ SSL
    });
    const context = await browser.newContext({
      ignoreHTTPSErrors: true // Cũng đặt ở cấp context
    });
    const page = await context.newPage();
    const startUrl = 'https://tphomevn.com/';
    const visited = new Set();

    await handleTphomevnPage(page, startUrl, visited);

    console.log('✅ Hoàn tất thu thập tất cả liên kết nội bộ tphomevn.');
    await browser.close();
  } catch (err) {
    console.error('❌ Lỗi thu thập:', err);
  } finally {
    isRunning = false; // Đặt lại cờ khi hoàn tất
  }
}

// Giả lập cron job với setInterval (30 phút)
setInterval(crawlTphomevnTask, 30 * 60 * 1000);

// Chạy ngay lần đầu
crawlTphomevnTask();
