const { chromium } = require('playwright');
const H = require('./helpers');

let isRunning = false;

// --- Danh sách URL ---
const urlsToVisit = [
  'https://tphomevn.com/nghi-le-quoc-khanh-2-9-nam-2025-lich-nghi-chi-tiet',
  'https://tphomevn.com/lich-nghi-le-quoc-khanh-2025-ke-hoach-chi-tiet',
  'https://tphomevn.com/ky-nghi-le-2-9-202',
  'https://tphomevn.com/5-mau-tranh-phong-thuy-dinh-da-dep-nhat-tai-tp-home',
  'https://tphomevn.com/tranh-phong-thuy-dep-sang-trong-y-nghia-theo-menh',
  'https://tphomevn.com/top-5-mau-voi-lavabo-dep-ben-gia-tot-dang-mua-nhat',
  'https://tphomevn.com/lavabo-la-gi-phan-loai-cach-chon-va-mau-lavabo-dep',
  'https://tphomevn.com/https-tphomevn-com-ca-phe-dep-o-quan-3',
  'https://tphomevn.com/honkai-star-rail-huong-dan-build-saber-phien-ban-v3-4',
  'https://tphomevn.com/may-xong-tinh-dau',
  'https://tphomevn.com/bon-rua-tay-bang-go',
  'https://tphomevn.com/top-y-tuong-giup-ban-thay-doi-phong-tam-voi-dien-mao-moi',
  'https://tphomevn.com/day-la-ly-do-ban-can-phai-co-mot-chiec-voi-sen-dung-trong-phong-tam-nha-ban',
];

// --- Main crawl function ---
async function crawlTphomevnTask() {
  if (isRunning) {
    console.log('⏳ Tác vụ đang chạy, bỏ qua lần này.');
    return;
  }
  isRunning = true;
  console.log('🚀 Bắt đầu crawl tphomevn...');

  try {
    const browser = await chromium.launch({ headless: true });
    let page = await browser.newPage(); // <-- dùng let để gán lại

    for (const startUrl of urlsToVisit) {
      console.log(`🌐 Tới trang: ${startUrl}`);
      page = await H.clickLinkByUrl(page, startUrl);

      // timePerPage ngẫu nhiên 15–20s
      const timePerPage = H.getRandomInt(15000, 20000);
      console.log(`⏱ Dừng trên trang chính: ${timePerPage/1000}s`);
      await page.waitForTimeout(timePerPage);

      // Lấy tất cả link nội bộ và random 2–3 link click
      const links = await H.getInternalTphomevnLinks(page, startUrl);
      const linksToClick = links.sort(() => 0.5 - Math.random()).slice(0, H.getRandomInt(2,3));

      for (const link of linksToClick) {
        console.log(`🔗 Click vào: ${link}`);
        page = await H.clickLinkByUrl(page, link);

        const waitTime = H.getRandomInt(10000, 20000);
        console.log(`⏱ Dừng sau click: ${waitTime/1000}s`);
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

// --- Giả lập cron job 30 phút ---
setInterval(crawlTphomevnTask, 30 * 60 * 1000);

// Chạy ngay lần đầu
crawlTphomevnTask();
