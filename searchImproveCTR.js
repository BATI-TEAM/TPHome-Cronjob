const { chromium } = require('playwright');

const keywords = [
  'tphome',
  'nội thất tphome',
  'gạch ốp lát tphome',
  'showroom tphome'
];

// Random delay trong khoảng giây
function randomDelay(min, max) {
  return (Math.floor(Math.random() * (max - min + 1)) + min) * 1000;
}

// Hàm check block Google (sorry page)
async function checkGoogleBlock(page) {
  if (page.url().includes("/sorry/index")) {
    console.log("🚨 Google block -> đợi 30s...");
    await page.waitForTimeout(30000);
    return true;
  }
  return false;
}

// Hàm click theo URL nội bộ
async function clickLinkByUrl(page, url) {
  const linkHandle = await page.$(`a[href='${url}']`);
  if (linkHandle) {
    await Promise.all([
      page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 10000 }).catch(() => {}),
      linkHandle.click().catch(() => {})
    ]);
    if (await checkGoogleBlock(page)) return null; // nếu bị block thì thoát sớm
    return page;
  } else {
    console.log(`⚠️ Không tìm thấy thẻ <a> với href="${url}" -> bỏ qua`);
    return page;
  }
}

async function run() {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  let isFirstRun = true;

  while (true) {
    // 1. Chọn keyword random
    const keyword = keywords[Math.floor(Math.random() * keywords.length)];
    console.log(`🔍 Search từ khóa: "${keyword}"`);
    await page.goto(`https://www.google.com/search?q=${encodeURIComponent(keyword)}`, { waitUntil: "domcontentloaded" });

    // Kiểm tra Google block
    if (await checkGoogleBlock(page)) continue;

    if (isFirstRun) {
      console.log("⏳ Lần đầu -> đợi 30s...");
      await page.waitForTimeout(30000);
      isFirstRun = false;
    } else {
      console.log("⏳ Đợi 5s trước khi click...");
      await page.waitForTimeout(5000);
    }

    // 2. Click kết quả đầu tiên
    const firstResult = await page.$("a h3");
    if (!firstResult) {
      console.log("❌ Không tìm thấy kết quả nào, bỏ qua vòng này.");
      continue;
    }
    await Promise.all([
      page.waitForNavigation({ waitUntil: "domcontentloaded" }).catch(() => {}),
      firstResult.click()
    ]);
    if (await checkGoogleBlock(page)) continue;

    console.log(`🌐 Vào site: ${page.url()}`);

    let waitTime = randomDelay(15, 20);
    console.log(`⏳ Đợi ${waitTime / 1000}s...`);
    await page.waitForTimeout(waitTime);

    // 3. Lấy toàn bộ internal links
    const hrefs = await page.$$eval("a[href]", els =>
      els.map(a => a.getAttribute("href")).filter(Boolean)
    );

    let internalLinks = [];
    for (let href of hrefs) {
      if (href.startsWith("/")) href = new URL(href, page.url()).href;
      if (
        href.includes(new URL(page.url()).hostname) &&
        !href.startsWith("mailto:") &&
        !href.startsWith("tel:") &&
        !href.includes("facebook.com") &&
        !href.includes("instagram.com")
      ) {
        internalLinks.push(href);
      }
    }

    console.log(`🔗 Tìm thấy ${internalLinks.length} link nội bộ`);

    // 4. Click random 5-8 link nội bộ
    const numClicks = Math.floor(Math.random() * (8 - 5 + 1)) + 5; // random 5-8
    const maxClicks = Math.min(numClicks, internalLinks.length);

    for (let i = 0; i < maxClicks; i++) {
      const idx = Math.floor(Math.random() * internalLinks.length);
      const chosen = internalLinks.splice(idx, 1)[0];

      console.log(`➡️ (${i + 1}/${maxClicks}) Click: ${chosen}`);
      const newPage = await clickLinkByUrl(page, chosen);
      if (!newPage) {
        console.log("🚨 Bị block khi click internal -> quay lại Google...\n");
        break;
      }

      console.log(`🌍 Đang ở: ${page.url()}`);
      let waitTime = randomDelay(15, 20);
      console.log(`⏳ Đợi ${waitTime / 1000}s...`);
      await page.waitForTimeout(waitTime);
    }

    console.log("🔁 Quay lại Google, bắt đầu vòng mới...\n");
  }
}

run();
