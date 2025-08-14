const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
  });

  try {
    // Truy cập Google với truy vấn tìm kiếm
    await page.goto('https://www.google.com/search?q=site:tphomevn.com');
    await page.waitForSelector('h3'); // Chờ kết quả tải

    let pageNumber = 1;
    while (true) {
      console.log(`Started page ${pageNumber} at ${new Date().toISOString()}`);

      // Lấy danh sách các liên kết trên trang hiện tại
      const links = await page.$$eval('a[href*="tphomevn.com"]', anchors =>
        anchors
          .map(anchor => anchor.href)
          .filter(href => href.includes('tphomevn.com') && !href.includes('google.com'))
      );

      console.log(`Found ${links.length} links on page ${pageNumber}`);

      // Duyệt qua từng liên kết
      for (const link of links) {
        try {
          // Vào trang
          await page.goto(link);
          console.log(`Visited: ${link}`);
          await page.waitForTimeout(20000); // Chờ 20 giây để tải trang

          // Quay lại trang kết quả tìm kiếm
          await page.goBack();
          await page.waitForSelector('h3'); // Chờ trang kết quả tải lại
        } catch (error) {
          console.error(`Error visiting ${link}: ${error.message}`);
        }
      }

      // Kiểm tra nút "Next" với selector a#pnnext
      const nextButton = await page.$('a#pnnext');
      if (!nextButton) {
        console.log('No more pages to process. Next button (a#pnnext) not found.');
        break; // Thoát khi không còn trang
      }

      // Nhấp vào nút Next
      await nextButton.click();
      await page.waitForSelector('h3'); // Chờ trang tiếp theo tải
      console.log(`Moved to page ${pageNumber + 1}`);
      pageNumber++;
    }

  } catch (error) {
    console.error(`Error during execution: ${error.message}`);
  } finally {
    await browser.close();
  }
})();
