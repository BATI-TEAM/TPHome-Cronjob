const { chromium } = require('playwright');
const H = require('./helpers');

let isRunning = false;

// Danh sách URL
const urlsToVisit = [
  'https://tphomevn.com/',
  'https://tphomevn.com/gia-gach-op-lat/',
  'https://tphomevn.com/chuong-trinh-khuyen-mai-dai-le-quoc-khanh-2025/'
];

// Main crawl function
async function crawlTphomevnTask() {
  if (isRunning) {
    console.log('⏳ Tác vụ đang chạy, bỏ qua lần này.');
    return;
  }
  isRunning = true;
  console.log('🚀 Bắt đầu crawl tphomevn...');

  try {
    // Khởi chạy trình duyệt với tùy chọn bỏ qua lỗi HTTPS
    const browser = await chromium.launch({ 
      headless: true,
      ignoreHTTPSErrors: true // Bỏ qua lỗi chứng chỉ SSL
    });
    const context = await browser.newContext({
      ignoreHTTPSErrors: true // Cũng đặt ở cấp context
    });
    let page = await context.newPage(); // Sử dụng context để tạo page

    for (const startUrl of urlsToVisit) {
      console.log(`🌐 Tới trang: ${startUrl}`);
      page = await H.clickLinkByUrl(page, startUrl);

      // Thời gian dừng ngẫu nhiên 15–20s
      const timePerPage = H.getRandomInt(15000, 20000);
      console.log(`⏱ Dừng trên trang chính: ${timePerPage / 1000}s`);
      await page.waitForTimeout(timePerPage);

      // Lấy tất cả link nội bộ và random 2–3 link để click
      const links = await H.getInternalTphomevnLinks(page, startUrl);
      const linksToClick = links.sort(() => 0.5 - Math.random()).slice(0, H.getRandomInt(2, 3));

      for (const link of linksToClick) {
        console.log(`🔗 Click vào: ${link}`);
        page = await H.clickLinkByUrl(page, link);

        const waitTime = H.getRandomInt(10000, 20000);
        console.log(`⏱ Dừng sau click: ${waitTime / 1000}s`);
        await page.waitForTimeout(waitTime);
      }
    }

    console.log('✅ Hoàn tất lượt crawl tất cả URLs.');
    await browser.close();
  } catch (err) {
    console.error('❌ Lỗi crawl:', err);
  } finally {
    isRunning = false;
  }
}

// Giả lập cron job 5 phút
setInterval(crawlTphomevnTask, 5 * 60 * 1000);

// Chạy ngay lần đầu
crawlTphomevnTask();
