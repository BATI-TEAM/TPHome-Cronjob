const { chromium } = require('playwright');

let isRunning = false; // Biến cờ để kiểm soát việc chỉ có một tiến trình chạy

async function runGoogleSearchAndNavigate() {
  if (isRunning) {
    console.log('Một tiến trình đang chạy, bỏ qua lần chạy này.');
    return;
  }

  isRunning = true;
  console.log('---'); // Dấu phân cách cho mỗi lần chạy
  console.log('Bắt đầu chạy tool tìm kiếm trên Google...');

  let browser;
  let context; // Khai báo biến context
  try {
    // Khởi chạy trình duyệt ở chế độ ẩn (headless: true)
    browser = await chromium.launch({ headless: false });
    
    // Tạo một ngữ cảnh trình duyệt mới từ browser
    context = await browser.newContext();
    
    // Tạo trang (tab) chính từ ngữ cảnh đã tạo
    const page = await context.newPage();

    let loopCount = 0;
    while (true) {
      loopCount++;
      console.log(`Bắt đầu lặp lần thứ ${loopCount}...`);

      // Bước 1: Truy cập Google
      console.log('Đang truy cập Google...');
      await page.goto('https://www.google.com');
      await page.waitForLoadState('networkidle');

      // Bước 2: Tìm kiếm từ khóa "tphome"
      console.log('Đang tìm kiếm "tphome"...');
      await page.fill('[name="q"]', 'tphome');
      await page.keyboard.press('Enter');
      await page.waitForLoadState('networkidle');

      // Bước 3: Tìm và truy cập liên kết của tphomevn.com
      console.log('Đang tìm kiếm liên kết tphome...');
      const tphomeLink = await page.locator('a[href*="tphomevn.com"]').first();

      if (tphomeLink) {
        console.log('Đã tìm thấy liên kết, đang truy cập...');
        await tphomeLink.click();
        await page.waitForLoadState('networkidle');
        console.log(`Đã truy cập thành công trang: ${page.url()}`);
        
        // --- Bắt đầu chu trình tạo các tab mới trong khi chờ 2 phút ---
        console.log('Đang chờ 30 giây trước khi bắt đầu tạo tab mới...');
        await page.waitForTimeout(30000); // Chờ 30 giây đầu tiên
        
        console.log('Bắt đầu chu trình tạo tab mới mỗi 30 giây...');
        
        const totalWaitTime = 90000; // Còn 90 giây = 120 - 30
        const interval = 30000; // 30 giây = 30000ms
        let tabsCreated = 0;

        // Vòng lặp để tạo tab mới và chờ đợi
        const startTime = Date.now();
        while (Date.now() - startTime < totalWaitTime) {
            tabsCreated++;
            console.log(`Đang tạo tab mới lần ${tabsCreated}...`);
            const newPage = await context.newPage();
            
            // Thực hiện các tác vụ trên tab mới
            await newPage.goto('https://www.google.com');
            await newPage.waitForLoadState('networkidle');
            await newPage.fill('[name="q"]', 'tphome');
            await newPage.keyboard.press('Enter');
            await newPage.waitForLoadState('networkidle');
            const nestedTphomeLink = await newPage.locator('a[href*="tphomevn.com"]').first();
            if (nestedTphomeLink) {
              await nestedTphomeLink.click();
              await newPage.waitForLoadState('networkidle');
              console.log(`Tab mới lần ${tabsCreated}: Đã truy cập thành công trang: ${newPage.url()}`);
            } else {
              console.log(`Tab mới lần ${tabsCreated}: Không tìm thấy liên kết của tphome.`);
            }

            // --- ĐÂY LÀ ĐIỂM BẮT ĐẦU ĐẾM THỜI GIAN 2 PHÚT TRÊN TRANG TPHOME ---
            // Thiết lập hẹn giờ để đóng tab này sau 2 phút
            const closeTime = 120000; // 2 phút = 120000ms
            setTimeout(async () => {
                await newPage.close();
                console.log(`Đã đóng tab mới lần ${tabsCreated} sau 2 phút.`);
            }, closeTime);

            // Chờ 30 giây trước khi tạo tab tiếp theo
            console.log('Đang chờ 30 giây...');
            await page.waitForTimeout(interval);
        }
        
        console.log('Đã hết 2 phút của vòng lặp chính. Tiếp tục vòng lặp chính...');
        // --- Kết thúc chu trình tạo tab mới ---
      } else {
        console.log('Không tìm thấy liên kết của tphome.');
      }
    }
    
    // Lưu ý: Đoạn mã này sẽ không bao giờ hoàn tất trừ khi bạn dừng nó thủ công
    // hoặc có lỗi xảy ra.
    console.log('Hoàn tất một lượt chạy!');

  } catch (error) {
    console.error('Đã xảy ra lỗi nghiêm trọng trong quá trình chạy:', error);
  } finally {
    if (browser) {
      await browser.close(); // Đảm bảo trình duyệt luôn được đóng
    }
    isRunning = false;
    console.log('---');
  }
}

// Chạy ngay lập tức và liên tục khi script được khởi động
console.log('Tool đã sẵn sàng, bắt đầu chạy...');
runGoogleSearchAndNavigate();
