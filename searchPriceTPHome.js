const { chromium } = require('playwright');
const H = require('./helpers');

let isRunning = false;

const keywords = [
  'gạch ốp lát giá rẻ',
  'giá gạch ốp lát tphome',
  'tphome giá gạch',
  'gia gach tphome',
  'giá gạch 40x40',
];

async function handleTphomevnPage(activePage, startUrl) {
  console.log(`🌐 Tới tphomevn: ${startUrl}`);

  if (!activePage.url().includes('tphomevn.com/gia-gach-op-lat')) {
    try {
      activePage = await H.clickLinkByUrl(activePage, startUrl, []);
    } catch (err) {
      console.error(`⚠ Lỗi khi truy cập ${startUrl}:`, err.message);
      return activePage; // Tiếp tục với trang hiện tại nếu điều hướng thất bại
    }
  }
  console.log(`✅ Đang ở: ${activePage.url()}`);

  console.log('⏳ Đợi 20s trong trang tphomevn...');
  await H.sleep(activePage, 20000);

  // Theo dõi các liên kết đã truy cập
  const visitedLinks = new Set([startUrl]);
  let currentPage = activePage;
  const maxClicks = 3 + Math.floor(Math.random() * 2); // Click ngẫu nhiên 3-5 liên kết

  try {
    // Thu thập các liên kết nội bộ từ trang hiện tại
    const internalLinks = await H.getInternalTphomevnLinks(currentPage, 'https://tphomevn.com');
    // Lọc ra các liên kết mới (chưa truy cập)
    const newLinks = internalLinks.filter(link => !visitedLinks.has(link));

    if (newLinks.length > 0) {
      console.log(`🎯 Sẽ click ${maxClicks} link ngẫu nhiên trong site`);

      for (let i = 0; i < maxClicks && newLinks.length > 0; i++) {
        try {
          // Chọn ngẫu nhiên một liên kết mới
          const randomIndex = Math.floor(Math.random() * newLinks.length);
          const chosenLink = newLinks[randomIndex];
          visitedLinks.add(chosenLink);
          newLinks.splice(randomIndex, 1); // Xóa liên kết đã chọn để tránh lặp

          console.log(`🔗 Click ${i + 1}/${maxClicks} (ngẫu nhiên): ${chosenLink}`);
          currentPage = await H.clickLinkByUrl(currentPage, chosenLink, [], 15000);
          console.log(`🌍 Đã vào: ${currentPage.url()}`);

          // Delay ngẫu nhiên để mô phỏng hành vi người dùng
          const delay = 15000 + Math.floor(Math.random() * 5000);
          console.log(`⏳ Đợi ${Math.round(delay / 1000)}s trong trang con...`);
          await H.sleep(currentPage, delay);
          await H.humanize(currentPage);
        } catch (err) {
          console.error(`⚠ Lỗi khi click liên kết ${i + 1}:`, err.message);
          continue;
        }
      }
    } else {
      console.log('⚠ Không tìm thấy link nội bộ hợp lệ sau khi lọc.');
    }
  } catch (err) {
    console.error('⚠ Lỗi khi lấy internal links:', err.message);
  }

  console.log(`✅ Đã hoàn tất crawl, tổng cộng ${visitedLinks.size} liên kết đã truy cập:`);
  visitedLinks.forEach((link, index) => {
    console.log(`  ${index + 1}. ${link}`);
  });

  return currentPage;
}

async function runGoogleSearchAndNavigate() {
  if (isRunning) {
    console.log('Một tiến trình đang chạy, bỏ qua.');
    return;
  }
  isRunning = true;

  let browser;
  try {
    // Khởi chạy trình duyệt với xử lý lỗi HTTPS
    browser = await chromium.launch({
      headless: false,
      ignoreHTTPSErrors: true // Bỏ qua lỗi chứng chỉ SSL
    });
    const context = await browser.newContext({
      ignoreHTTPSErrors: true,
      userAgent: H.getRandomUserAgent ? H.getRandomUserAgent() : 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/117.0.0.0 Safari/537.36'
    });
    let page = await context.newPage();

    let keywordIndex = 0;
    let backoff = 30000; // 30s khi bị block
    const maxAttemptsPerKeyword = 3; // Giới hạn số lần thử lại cho mỗi từ khóa

    while (true) {
      const keyword = keywords[keywordIndex];
      console.log(`\n🔍 Tìm với từ khóa: "${keyword}" (index ${keywordIndex})`);

      let attempt = 0;
      let found = false;

      while (attempt < maxAttemptsPerKeyword && !found) {
        try {
          // Điều hướng tới Google
          await page.goto('https://www.google.com', { waitUntil: 'domcontentloaded', timeout: 30000 });

          // Xử lý Google Consent nếu có
          await H.handleGoogleConsent(page).catch(() => {});

          // Điền ô tìm kiếm
          const filled = await H.fillGoogleSearchBox(page, keyword);
          if (!filled) {
            console.log('⚠ Không điền được ô tìm kiếm. Thử lại.');
            attempt++;
            await page.waitForTimeout(5000);
            continue;
          }

          // Gửi tìm kiếm
          await Promise.all([
            page.keyboard.press('Enter'),
            page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 10000 }).catch(() => {})
          ]);

          // Mô phỏng hành vi người dùng
          await H.humanize(page);

          // Kiểm tra chặn của Google
          if (await H.checkGoogleBlock(page)) {
            console.log(`🚨 Google block (captcha / sorry page) -> đợi ${backoff / 1000}s rồi thử lại...`);
            backoff = Math.min(backoff * 2, 120000); // Exponential backoff, max 2 phút
            await page.waitForTimeout(backoff);
            attempt++;
            continue;
          }

          let pageNumber = 1;

          while (!found) {
            // Chờ kết quả tìm kiếm tải
            await page.waitForSelector('div#search', { timeout: 10000 }).catch(() => {});
            const resultLinks = await page
              .locator('div#search a:has(h3):not([href*="aclk"]):not([href*="googleadservices"])')
              .all();

            for (let i = 0; i < resultLinks.length; i++) {
              const href = await resultLinks[i].getAttribute('href').catch(() => null);
              if (href && href.includes('tphomevn.com')) {
                const position = i + 1 + (pageNumber - 1) * 10;
                console.log(`🎉 Tìm thấy từ khóa: "${keyword}" của tphomevn.com ở vị trí thứ ${position} (trang ${pageNumber})`);
                const { page: sitePage, isPopup } = await H.safeClick(page, resultLinks[i], 15000);
                console.log(`👉 Đã mở kết quả: ${sitePage.url()}`);

                // Xử lý trang tphomevn.com
                page = await handleTphomevnPage(sitePage, sitePage.url());

                if (isPopup) await sitePage.close().catch(() => {});
                found = true;
                break;
              }
            }

            if (!found) {
              const nextBtn = H.getNextButtonLocator(page);
              if (await nextBtn.count()) {
                console.log('👉 Sang trang kết quả kế tiếp...');
                pageNumber++;
                await Promise.all([
                  nextBtn.click(),
                  page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {})
                ]);
                await page.waitForTimeout(2000);
                await H.humanize(page);

                if (await H.checkGoogleBlock(page)) {
                  console.log(`🚨 Google block (captcha / sorry page) -> đợi ${backoff / 1000}s rồi thử lại...`);
                  backoff = Math.min(backoff * 2, 120000);
                  await page.waitForTimeout(backoff);
                  break;
                }
              } else {
                console.log(`⚠️ Hết trang tìm kiếm (đã kiểm tra ${pageNumber} trang) mà không thấy tphomevn.com.`);
                break;
              }
            }
          }

          if (!found) {
            console.log(`⚠ Không tìm thấy tphomevn.com cho từ khóa "${keyword}" sau ${maxAttemptsPerKeyword} lần thử.`);
          }
        } catch (err) {
          console.error(`⚠ Lỗi khi xử lý từ khóa "${keyword}" (lần ${attempt + 1}):`, err.message);
          attempt++;
          backoff = Math.min(backoff * 2, 120000); // Tăng thời gian chờ nếu lỗi
          await page.waitForTimeout(5000);
        }
      }

      keywordIndex = (keywordIndex + 1) % keywords.length;
      console.log('🔄 Chuyển sang từ khóa tiếp theo...');
      backoff = 30000; // Đặt lại backoff cho từ khóa tiếp theo
      await page.waitForTimeout(2000);
    }
  } catch (err) {
    console.error('💥 Lỗi nghiêm trọng (ngoài vòng):', err);
  } finally {
    if (browser) await browser.close().catch(() => {});
    isRunning = false;
  }
}

runGoogleSearchAndNavigate();
