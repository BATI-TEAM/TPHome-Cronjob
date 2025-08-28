const { chromium } = require('playwright');
const H = require('./helpers');

const keywords = [
  'nội thất tphome',
  'tphome',
  'gạch ốp lát tphome',
  'showroom tphome'
];

async function run() {
  const browser = await chromium.launch({ headless: false });
  let page = await browser.newPage();

  while (true) {
    const keyword = keywords[Math.floor(Math.random() * keywords.length)];
    console.log(`🔍 Search từ khóa: "${keyword}"`);
    await page.goto(`https://www.google.com/search?q=${encodeURIComponent(keyword)}`, { waitUntil: 'domcontentloaded' });

    if (H.checkGoogleBlock(page)) {
      console.log('🚨 Google block -> đợi 30s...');
      await page.waitForTimeout(30000);
      continue;
    }

    console.log('⏳ Đợi 5s trước khi click...');
    await page.waitForTimeout(5000);

    // Chỉ click kết quả organic của tphomevn.com
    const resultLink = page
      .locator('div#search a:has(h3)[href*="tphomevn.com"]:not([href*="aclk"]):not([href*="googleadservices"])')
      .first();
    if (!(await resultLink.count())) {
      console.log('❌ Không tìm thấy kết quả tphomevn.com, bỏ qua vòng này.');
      continue;
    }
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'domcontentloaded' }).catch(() => { }),
      resultLink.click(),
    ]);

    if (H.checkGoogleBlock(page)) {
      console.log('🚨 Google block -> đợi 30s...');
      await page.waitForTimeout(30000);
      continue;
    }

    console.log(`🌐 Vào site: ${page.url()}`);

    let waitTime = H.randomDelayMs(15, 20);
    console.log(`⏳ Đợi ${waitTime / 1000}s...`);
    await page.waitForTimeout(waitTime);

    const internalLinks = await H.getInternalLinks(page);
    console.log(`🔗 Tìm thấy ${internalLinks.length} link nội bộ`);

    const numClicks = Math.floor(Math.random() * (8 - 5 + 1)) + 5;
    const maxClicks = Math.min(numClicks, internalLinks.length);

    for (let i = 0; i < maxClicks; i++) {
      const idx = Math.floor(Math.random() * internalLinks.length);
      const chosen = internalLinks.splice(idx, 1)[0];

      console.log(`➡️ (${i + 1}/${maxClicks}) Click: ${chosen}`);
      page = await H.clickLinkByUrl(page, chosen);
      if (H.checkGoogleBlock(page)) {
        console.log('🚨 Bị block khi click internal -> quay lại Google...\n');
        break;
      }

      console.log(`🌍 Đang ở: ${page.url()}`);
      let waitTime = H.randomDelayMs(15, 20);
      console.log(`⏳ Đợi ${waitTime / 1000}s...`);
      await page.waitForTimeout(waitTime);
    }

    console.log('🔁 Quay lại Google, bắt đầu vòng mới...\n');
  }
}

run();
