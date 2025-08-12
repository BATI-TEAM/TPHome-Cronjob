const { chromium } = require('playwright');

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

const timePerPage = 125000
const intervalTime = timePerPage * urlsToVisit.length + 5000

async function visitPages() {
  console.log(`\n--- Bắt đầu lượt truy cập mới vào lúc: ${new Date().toLocaleTimeString()} ---`);

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  for (const url of urlsToVisit) {
    try {
      console.log(`Đang truy cập: ${url}`);
      await page.goto(url, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(timePerPage);
      console.log(`Đã truy cập thành công: ${url}`);
    } catch (error) {
      console.error(`Lỗi khi truy cập ${url}:`, error.message);
    }
  }

  await browser.close();
  console.log('--- Kết thúc lượt truy cập. Đang chờ cho lượt tiếp theo. ---\n');
}

// Run immediately
visitPages();

setInterval(visitPages, intervalTime);

console.log('Tool đã được khởi động. Sau khi chạy xong lần đầu, nó sẽ tự động chạy sau khi các trang được ghé');
