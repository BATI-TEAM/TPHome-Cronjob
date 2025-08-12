const { chromium } = require('playwright');

const urlsToVisit = [
    'https://tphomevn.com/',
    'https://tphomevn.com/gia-gach-op-lat-moi-nhat-2025-gia-gach/'
];

async function visitPages() {
    console.log(`\n--- Bắt đầu lượt truy cập mới vào lúc: ${new Date().toLocaleTimeString()} ---`);
    
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();

    for (const url of urlsToVisit) {
        try {
            console.log(`Đang truy cập: ${url}`);
            await page.goto(url, { waitUntil: 'domcontentloaded' });
            await page.waitForTimeout(125000);
            console.log(`Đã truy cập thành công: ${url}`);
        } catch (error) {
            console.error(`Lỗi khi truy cập ${url}:`, error.message);
        }
    }

    await browser.close();
    console.log('--- Kết thúc lượt truy cập. Đang chờ 4 phút 20 giây cho lượt tiếp theo. ---\n');
}

// Run immediately
visitPages();

// Run after 260000 mili-seconds
setInterval(visitPages, 260000);

console.log('Tool đã được khởi động. Sau khi chạy xong lần đầu, nó sẽ tự động chạy mỗi 4 phút 20 giây.');
