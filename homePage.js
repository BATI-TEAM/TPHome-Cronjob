const { chromium } = require('playwright');

let isRunning = false;

// --- Danh sách URL ---
const urlsToVisit = [
    'https://tphomevn.com/',
    'https://tphomevn.com/gia-gach-op-lat/'
];

// --- Hàm hỗ trợ ---
function getRandomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Click an toàn
async function safeClick(page, locator, timeout = 15000) {
  try {
    await locator.scrollIntoViewIfNeeded();

    const oldUrl = page.url();
    const [newPage] = await Promise.all([
      page.waitForEvent('popup').catch(() => null),
      locator.click({ timeout })
    ]);

    await page.waitForTimeout(1000);

    if (newPage) {
      await newPage.waitForLoadState('domcontentloaded');
      return { page: newPage };
    }

    await page.waitForFunction(url => window.location.href !== url, {}, oldUrl).catch(() => {});
    return { page };
  } catch (e) {
    console.log('⚠ safeClick error:', e.message || e);
    return { page };
  }
}

// Click link theo URL, fallback
async function clickLinkByUrl(page, url, candidates = [], timeout = 15000) {
  try {
    const u = new URL(url);
    const host = u.hostname;
    const path = u.pathname.replace(/\/+$/, "");
    const lastSeg = path.split('/').filter(Boolean).pop() || '';

    let link = page.locator(`a[href="${url}"]:visible`).first();
    if (!(await link.count())) link = page.locator(`a[href$="${path}"]:visible`).first();
    if (!(await link.count())) {
      link = lastSeg
        ? page.locator(`a[href*="${host}"][href*="${lastSeg}"]:visible`).first()
        : page.locator(`a[href*="${host}"]:visible`).first();
    }

    if (await link.count()) return await safeClick(page, link, timeout);

    for (const candidate of candidates) {
      let candLink = page.locator(`a[href="${candidate}"]:visible`).first();
      if (!(await candLink.count())) candLink = page.locator(`a[href*="${candidate}"]:visible`).first();
      if (await candLink.count()) return await safeClick(page, candLink, timeout);
    }

    console.log(`⚠ Không tìm thấy link hợp lệ, fallback goto: ${url}`);
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout }).catch(() => {});
    return { page };
  } catch (e) {
    console.log('⚠ clickLinkByUrl error, fallback goto:', e?.message || e);
    await page.goto(url, { waitUntil: 'domcontentloaded' }).catch(() => {});
    return { page };
  }
}

// Lấy tất cả link nội bộ tphomevn
async function getInternalTphomevnLinks(page, baseUrl) {
  const allHrefs = await page.$$eval('a[href]', anchors => anchors.map(a => a.getAttribute('href')));
  const internalLinks = [];

  for (let href of allHrefs) {
    if (!href) continue;
    if (href.startsWith('/')) {
      try { href = new URL(href, page.url()).href; } catch {}
    }
    if (
      href.includes('tphomevn.com') &&
      !href.startsWith('mailto:') &&
      !href.startsWith('tel:') &&
      !href.includes('facebook.com') &&
      !href.includes('instagram.com') &&
      href !== baseUrl
    ) internalLinks.push(href);
  }

  return internalLinks;
}

// --- Main crawl function ---
async function crawlTphomevnTask() {
  if (isRunning) {
    console.log('⏳ Tác vụ đang chạy, bỏ qua lần này.');
    return;
  }
  isRunning = true;
  console.log('🚀 Bắt đầu crawl tphomevn...');

  try {
    const browser = await chromium.launch({ headless: true });
    let page = await browser.newPage(); // <-- dùng let để gán lại

    for (const startUrl of urlsToVisit) {
      console.log(`🌐 Tới trang: ${startUrl}`);
      page = (await clickLinkByUrl(page, startUrl)).page;

      // timePerPage ngẫu nhiên 15–20s
      const timePerPage = getRandomInt(15000, 20000);
      console.log(`⏱ Dừng trên trang chính: ${timePerPage/1000}s`);
      await page.waitForTimeout(timePerPage);

      // Lấy tất cả link nội bộ và random 2–3 link click
      const links = await getInternalTphomevnLinks(page, startUrl);
      const linksToClick = links.sort(() => 0.5 - Math.random()).slice(0, getRandomInt(2,3));

      for (const link of linksToClick) {
        console.log(`🔗 Click vào: ${link}`);
        page = (await clickLinkByUrl(page, link)).page;

        const waitTime = getRandomInt(10000, 20000);
        console.log(`⏱ Dừng sau click: ${waitTime/1000}s`);
        await page.waitForTimeout(waitTime);
      }
    }

    console.log('✅ Hoàn tất lượt crawl tất cả URLs.');
    await browser.close();
  } catch (err) {
    console.error('❌ Lỗi crawl:', err);
  } finally {
    isRunning = false;
  }
}

// --- Giả lập cron job 30 phút ---
setInterval(crawlTphomevnTask, 30 * 60 * 1000);

// Chạy ngay lần đầu
crawlTphomevnTask();
