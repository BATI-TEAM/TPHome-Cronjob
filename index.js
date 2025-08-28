const { chromium } = require('playwright');
const H = require('./helpers');

let isRunning = false; // biến cờ kiểm tra

// Crawl trang tphomevn
async function handleTphomevnPage(page, url, visited) {
  console.log(`🌐 Tới trang: ${url}`);

  if (!page.url().includes('tphomevn.com')) {
    page = await H.clickLinkByUrl(page, url);
  }

  await page.waitForTimeout(10000); // đợi trang load

  const links = await H.getInternalTphomevnLinks(page, url);

  for (const link of links) {
    if (visited.has(link)) continue;
    visited.add(link);

    console.log(`🔗 Click vào: ${link}`);
    page = await H.clickLinkByUrl(page, link);

    // Đệ quy crawl link con
    await handleTphomevnPage(page, link, visited);

    // Quay về trang chủ
    page = await H.clickLinkByUrl(page, 'https://tphomevn.com');
  }
}

// Main function sử dụng isRunning
async function crawlTphomevnTask() {
  if (isRunning) {
    console.log('⏳ Tác vụ đang chạy, bỏ qua lần này.');
    return;
  }

  isRunning = true;
  console.log('🚀 Bắt đầu crawl tphomevn...');

  try {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    const startUrl = 'https://tphomevn.com/';
    const visited = new Set();

    await handleTphomevnPage(page, startUrl, visited);

    console.log('✅ Hoàn tất crawl tất cả link nội bộ tphomevn.');
    await browser.close();
  } catch (err) {
    console.error('❌ Lỗi crawl:', err);
  } finally {
    isRunning = false; // reset cờ khi xong
  }
}

// --- Giả lập cron job bằng setInterval (30 phút) ---
setInterval(crawlTphomevnTask, 30 * 60 * 1000);

// Chạy ngay lần đầu
crawlTphomevnTask();
