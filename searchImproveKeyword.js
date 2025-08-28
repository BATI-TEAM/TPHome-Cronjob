const { chromium } = require('playwright');
const H = require('./helpers');

let isRunning = false;

const keywords = [
  'gạch 40x40',
  'gạch stile',
  'gạch ốp viền',
  'khánh vàng mã đáo thành công',
  'gạch ốp lát giá rẻ',
  'gạch sale',
  'gạch ấn độ đồng nai',
  'gạch ốp rẻ đồng nai',
  'gạch ấn độ giá rẻ',
  'gạch rẻ đồng nai',
  'gạch rẻ trảng bom'
];

async function handleTphomevnPage(activePage, startUrl) {
  console.log(`🌐 Tới tphomevn: ${startUrl}`);

  if (!activePage.url().includes('tphomevn.com')) {
    try {
      activePage = await H.clickLinkByUrl(activePage, startUrl);
    } catch (err) {
      console.error(`⚠ Lỗi khi truy cập ${startUrl}:`, err.message);
      return activePage;
    }
  }
  console.log(`✅ Đang ở: ${activePage.url()}`);

  console.log('⏳ Đợi 20s trong trang tphomevn...');
  await activePage.waitForTimeout(20000);

  let internalLinks = [];
  try {
    internalLinks = await H.getInternalTphomevnLinks(activePage, startUrl);
  } catch (err) {
    console.error('⚠ Lỗi khi lấy internal links:', err.message);
  }

  if (internalLinks.length > 0) {
    const clickCount = 3 + Math.floor(Math.random() * 2);
    console.log(`🎯 Sẽ click ${clickCount} link ngẫu nhiên trong site`);

    for (let i = 0; i < clickCount && internalLinks.length > 0; i++) {
      const randomIndex = Math.floor(Math.random() * internalLinks.length);
      const chosen = internalLinks.splice(randomIndex, 1)[0];

      console.log(`🔗 Click ${i + 1}/${clickCount}: ${chosen}`);
      try {
        const afterClickPage = await H.clickLinkByUrl(activePage, chosen, internalLinks);
        console.log(`🌍 Đã vào: ${afterClickPage.url()}`);

        const delay = 15000 + Math.floor(Math.random() * 5000);
        console.log(`⏳ Đợi ${Math.round(delay / 1000)}s trong trang con...`);
        await afterClickPage.waitForTimeout(delay);

        activePage = afterClickPage;
      } catch (err) {
        console.error(`⚠ Lỗi khi click link ${chosen}:`, err.message);
      }
    }
  } else {
    console.log('⚠ Không tìm thấy link nội bộ hợp lệ sau filter.');
  }

  return activePage;
}

async function runGoogleSearchAndNavigate() {
  if (isRunning) {
    console.log('Một tiến trình đang chạy, bỏ qua.');
    return;
  }
  isRunning = true;

  let browser;
  try {
    // Khởi chạy trình duyệt với tùy chọn bỏ qua lỗi HTTPS
    browser = await chromium.launch({
      headless: false,
      ignoreHTTPSErrors: true // Bỏ qua lỗi chứng chỉ SSL
    });
    const context = await browser.newContext({
      ignoreHTTPSErrors: true,
      userAgent: H.getRandomUserAgent ? H.getRandomUserAgent() : 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/117.0.0.0 Safari/537.36'
    });
    const page = await context.newPage();

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
          await page.goto(H.googleSearchUrl(keyword, { hl: 'vi', gl: 'VN', num: 10 }), { waitUntil: 'domcontentloaded', timeout: 30000 });
          await H.handleGoogleConsent(page).catch(() => {});
          await H.humanize(page);

          if (await H.isGoogleBlocked(page)) {
            console.log(`🚨 Google block -> đợi ${backoff / 1000}s rồi thử lại...`);
            backoff = Math.min(backoff * 2, 120000); // Exponential backoff, max 2 phút
            await page.waitForTimeout(backoff);
            attempt++;
            continue;
          }

          let pageNumber = 1;
          let position = 0;

          while (!found) {
            // Chờ kết quả tìm kiếm tải
            await page.waitForSelector('div#search', { timeout: 10000 }).catch(() => {});
            const resultLinks = await page
              .locator('div#search a:has(h3):not([href*="aclk"]):not([href*="googleadservices"])')
              .all();

            // Đếm vị trí của liên kết tphomevn.com
            for (let i = 0; i < resultLinks.length; i++) {
              const href = await resultLinks[i].getAttribute('href').catch(() => null);
              if (href && href.includes('tphomevn.com')) {
                position = i + 1 + (pageNumber - 1) * 10; // Giả sử mỗi trang có ~10 kết quả
                console.log(`🎉 Tìm thấy từ khóa: "${keyword}" của tphomevn.com ở vị trí thứ ${position} (trang ${pageNumber})`);
                const { page: sitePage, isPopup } = await H.safeClick(page, resultLinks[i], 15000);
                console.log(`👉 Đã mở kết quả: ${sitePage.url()}`);
                await handleTphomevnPage(sitePage, sitePage.url());

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

                if (await H.isGoogleBlocked(page)) {
                  console.log(`🚨 Google block -> đợi ${backoff / 1000}s rồi thử lại...`);
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
