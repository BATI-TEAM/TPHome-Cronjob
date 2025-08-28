const { chromium } = require('playwright');
const H = require('./helpers');

let isRunning = false;

const keywords = [
  'giá gạch ốp lát tphome',
  'tphome giá gạch',
  'gia gach tphome',
  'giá gạch 40x40'
];

async function handleTphomevnPage(activePage, startUrl) {
  console.log(`🌐 Tới tphomevn: ${startUrl}`);

  if (!activePage.url().includes('tphomevn.com/gia-gach-op-lat')) {
    activePage = await H.clickLinkByUrl(activePage, startUrl);
  }
  console.log(`✅ Đang ở: ${activePage.url()}`);

  console.log('⏳ Đợi 20s trong trang tphomevn...');
  await activePage.waitForTimeout(20000);

  const internalLinks = await H.getInternalTphomevnLinks(activePage, startUrl);

  if (internalLinks.length > 0) {
    const clickCount = 3 + Math.floor(Math.random() * 2);
    console.log(`🎯 Sẽ click ${clickCount} link ngẫu nhiên trong site`);

    for (let i = 0; i < clickCount && internalLinks.length > 0; i++) {
      const randomIndex = Math.floor(Math.random() * internalLinks.length);
      const chosen = internalLinks.splice(randomIndex, 1)[0];

      console.log(`🔗 Click ${i + 1}/${clickCount}: ${chosen}`);
      const afterClickPage = await H.clickLinkByUrl(activePage, chosen, internalLinks);
      console.log(`🌍 Đã vào: ${afterClickPage.url()}`);

      const delay = 15000 + Math.floor(Math.random() * 5000);
      console.log(`⏳ Đợi ${Math.round(delay / 1000)}s trong trang con...`);
      await afterClickPage.waitForTimeout(delay);

      activePage = afterClickPage;
    }
  } else {
    console.log('⚠ Không tìm thấy link nội bộ hợp lệ sau filter.');
  }
}

async function runGoogleSearchAndNavigate() {
  if (isRunning) {
    console.log('Một tiến trình đang chạy, bỏ qua.');
    return;
  }
  isRunning = true;

  let browser;
  try {
    browser = await chromium.launch({ headless: false });
    const page = await browser.newPage();

    let keywordIndex = 0;

    while (true) {
      const keyword = keywords[keywordIndex];
      console.log(`\n🔍 Tìm với từ khoá: "${keyword}" (index ${keywordIndex})`);

      await page.goto('https://www.google.com', { waitUntil: 'domcontentloaded' });
      const filled = await H.fillGoogleSearchBox(page, keyword);
      if (!filled) {
        console.log('⚠ Không điền được ô tìm kiếm. Thử lại vòng sau.');
        continue;
      }
      await Promise.all([
        page.keyboard.press('Enter'),
        page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 10000 }).catch(() => {})
      ]);

      if (H.checkGoogleBlock(page)) {
        console.log('🚨 Google block (captcha / sorry page) -> đợi 30s rồi thử lại...');
        await page.waitForTimeout(30000);
        continue;
      }

      let found = false;

      while (!found) {
        const resultLink = page
          .locator('div#search a:has(h3)[href*="tphomevn.com"]:not([href*="aclk"]):not([href*="googleadservices"])')
          .first();

        if (await resultLink.count()) {
          const { page: sitePage, isPopup } = await H.safeClick(page, resultLink, 15000);
          console.log(`👉 Đã mở kết quả: ${sitePage.url()}`);
          await handleTphomevnPage(sitePage, sitePage.url());

          if (isPopup) await sitePage.close().catch(() => {});
          found = true;
          break;
        }

        const nextBtn = await page.$('#pnnext, a[aria-label="Next"], a[aria-label="Trang tiếp theo"]');
        if (nextBtn) {
          console.log('👉 Sang trang kết quả kế tiếp...');
          await Promise.all([
            nextBtn.click(),
            page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {})
          ]);
          await page.waitForTimeout(2000);

          if (H.checkGoogleBlock(page)) {
            console.log('🚨 Google block (captcha / sorry page) -> đợi 30s rồi thử lại...');
            await page.waitForTimeout(30000);
            break;
          }
        } else {
          console.log('⚠️ Hết trang tìm kiếm mà không thấy tphomevn.');
          break;
        }
      }

      keywordIndex = (keywordIndex + 1) % keywords.length;
      console.log('🔄 Chuyển sang từ khoá tiếp theo...');
      await page.waitForTimeout(2000);
    }
  } catch (err) {
    console.error('💥 Lỗi nghiêm trọng (ngoài vòng):', err);
  } finally {
    isRunning = false;
  }
}

runGoogleSearchAndNavigate();
