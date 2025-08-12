const { chromium } = require('playwright');
const cron = require('node-cron');

async function runCrawler() {
  console.log('Bắt đầu chạy tool tự động...');

  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  const baseUrl = 'https://tphomevn.com';
  await page.goto(baseUrl);
  console.log(`Đã truy cập trang chính: ${baseUrl}`);

  const allLinks = await page.evaluate(() => {
    const links = Array.from(document.querySelectorAll('a'));
    return links.map(link => link.href);
  });

  const internalLinks = [...new Set(allLinks.filter(href => href.startsWith(baseUrl)))];
  console.log(`Đã tìm thấy ${internalLinks.length} đường dẫn nội bộ.`);

  for (const link of internalLinks) {
    try {
      console.log(`Đang truy cập: ${link}`);
      await page.goto(link);
      await page.waitForTimeout(1000);
    } catch (error) {
      console.error(`Không thể truy cập ${link}: ${error.message}`);
    }
  }

  await browser.close();
  console.log('Hoàn tất một lượt chạy!');
}

// Run immediately
console.log('Bắt đầu chạy lượt đầu tiên...');
runCrawler();

// Run after 10 minutes
cron.schedule('*/10 * * * *', () => {
  console.log('Đã đến lịch hẹn, chuẩn bị chạy lượt tiếp theo.');
  runCrawler();
});

console.log('Tool đã được lên lịch. Sau khi chạy xong lần đầu, nó sẽ tự động chạy mỗi 10 phút.');
