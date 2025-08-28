const { chromium } = require('playwright');
const H = require('./helpers');

let isRunning = false;

const keywords = [
  'gạch ốp lát đồng nai',
  'gạch nội thất đồng nai',
  'gạch ốp viền',
  'gạch ốp lát giá rẻ',
  'gạch sale',
  'gạch ấn độ 60x120',
  'gạch 40x40',
  'gạch 100x100 trắng',
  'gạch 40x60',
  'gạch viền 7x60',
  'gạch trang trí 25x50',
  'gạch len',
  'gạch mosaic que đũa',
  'gạch terrazzo 30x60',
  'gạch ấn độ đồng nai',
  'gạch ốp rẻ đồng nai',
  'gạch ấn độ giá rẻ',
  'gạch rẻ đồng nai',
  'gạch rẻ trảng bom',
];

async function handleTphomevnPage(activePage, startUrl) {
  console.log(`🌐 Tới tphomevn: ${startUrl}`);

  if (!activePage.url().includes('tphomevn.com')) {
    try {
      activePage = await H.clickLinkByUrl(activePage, startUrl);
    } catch (err) {
      console.error(`⚠ Lỗi khi truy cập ${startUrl}:`, err.message);
      return activePage; // Tiếp tục với trang hiện tại nếu điều hướng thất bại
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
    const clickCount = 3 + Math.floor(Math.random() * 2); // 3 đến 4 nhấp
    console.log(`🎯 Sẽ nhấp ${clickCount} link ngẫu nhiên trong site`);

    for (let i = 0; i < clickCount && internalLinks.length > 0; i++) {
      const randomIndex = Math.floor(Math.random() * internalLinks.length);
      const chosen = internalLinks.splice(randomIndex, 1)[0];

      console.log(`🔗 Nhấp ${i + 1}/${clickCount}: ${chosen}`);
      try {
        const afterClickPage = await H.clickLinkByUrl(activePage, chosen, internalLinks);
        console.log(`🌍 Đã vào: ${afterClickPage.url()}`);

        const delay = 15000 + Math.floor(Math.random() * 5000); // 15–20s
        console.log(`⏳ Đợi ${Math.round(delay / 1000)}s trong trang con...`);
        await afterClickPage.waitForTimeout(delay);

        activePage = afterClickPage;
      } catch (err) {
        console.error(`⚠ Lỗi khi nhấp link ${chosen}:`, err.message);
      }
    }
  } else {
    console.log('⚠ Không tìm thấy link nội bộ hợp lệ sau khi lọc.');
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
            page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 10000 }).catch(() => { })
          ]);

          // Kiểm tra chặn của Google
          if (await H.checkGoogleBlock(page)) {
            console.log('🚨 Google chặn (captcha / sorry page) -> đợi 30s rồi thử lại...');
            await page.waitForTimeout(30000);
            attempt++;
            continue;
          }

          let pageNumber = 1;

          while (!found) {
            // Chờ kết quả tìm kiếm tải
            await page.waitForSelector('div#search', { timeout: 10000 }).catch(() => { });
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

                if (isPopup) await sitePage.close().catch(() => { });
                found = true;
                break;
              }
            }

            if (!found) {
              const nextBtn = await page.$('#pnnext, a[aria-label="Next"], a[aria-label="Trang tiếp theo"]');
              if (nextBtn) {
                console.log('👉 Sang trang kết quả kế tiếp...');
                pageNumber++;
                await Promise.all([
                  nextBtn.click(),
                  page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => { })
                ]);
                await page.waitForTimeout(2000);

                if (await H.checkGoogleBlock(page)) {
                  console.log('🚨 Google chặn (captcha / sorry page) -> đợi 30s rồi thử lại...');
                  await page.waitForTimeout(30000);
                  break;
                }
              } else {
                console.log(`⚠️ Hết trang tìm kiếm (đã kiểm tra ${pageNumber} trang) mà không thấy tphomevn.com.`);
                break;
              }
            }
          }
        } catch (err) {
          console.error(`⚠ Lỗi khi xử lý từ khóa "${keyword}" (lần ${attempt + 1}):`, err.message);
          attempt++;
          await page.waitForTimeout(5000);
        }
      }

      if (!found) {
        console.log(`⚠ Không tìm thấy tphomevn.com cho từ khóa "${keyword}" sau ${maxAttemptsPerKeyword} lần thử.`);
      }

      keywordIndex = (keywordIndex + 1) % keywords.length;
      console.log('🔄 Chuyển sang từ khóa tiếp theo...');
      await page.waitForTimeout(2000);
    }
  } catch (err) {
    console.error('💥 Lỗi nghiêm trọng (ngoài vòng):', err);
  } finally {
    if (browser) await browser.close().catch(() => { });
    isRunning = false;
  }
}

runGoogleSearchAndNavigate();
