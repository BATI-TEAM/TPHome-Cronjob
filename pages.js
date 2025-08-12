const { chromium } = require('playwright');

const urlsToVisit = [
    'https://tphomevn.com/gia-gach-op-lat-moi-nhat-2025-gia-gach',
    'https://tphomevn.com/chinh-sach-bao-mat',
    'https://tphomevn.com/refund_returns',
    'https://tphomevn.com/cua-hang',
    'https://tphomevn.com/flash-sale',
    'https://tphomevn.com/gach-op-lat-noi-that-cao-cap-tphome',
    'https://tphomevn.com/gio-hang',
    'https://tphomevn.com/lien-he',
    'https://tphomevn.com/tai-khoan',
    'https://tphomevn.com/thanh-toan',
    'https://tphomevn.com/ve-chung-toi',
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
    console.log('--- Kết thúc lượt truy cập. Đang chờ lượt tiếp theo. ---\n');
}

// Run immediately
visitPages();

setInterval(visitPages, intervalTime);

console.log('Tool đã được khởi động. Sau khi chạy xong lần đầu, nó sẽ tự động chạy khi mỗi page đều được ghé.');
