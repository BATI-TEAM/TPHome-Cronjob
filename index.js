const { chromium } = require('playwright');

let isRunning = false; // biến cờ kiểm tra

// Click an toàn, bắt popup hoặc chờ URL thay đổi
async function safeClick(page, locator, timeout = 15000) {
  try {
    await locator.scrollIntoViewIfNeeded();

    const oldUrl = page.url();
    const [newPage] = await Promise.all([
      page.waitForEvent('popup').catch(() => null), // nếu link mở tab mới
      locator.click({ timeout })
    ]);

    await page.waitForTimeout(1000); // đợi trang load

    if (newPage) {
      await newPage.waitForLoadState('domcontentloaded');
      return { page: newPage };
    }

    // Chờ URL thay đổi (SPA)
    await page.waitForFunction(url => window.location.href !== url, {}, oldUrl).catch(() => {});

    return { page };
  } catch (e) {
    console.log('⚠ safeClick error:', e.message || e);
    return { page };
  }
}

// Click link theo URL, fallback nếu không tìm thấy
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
      if (await candLink.count()) {
        console.log(`👉 Không tìm thấy link ${url}, thử candidate: ${candidate}`);
        return await safeClick(page, candLink, timeout);
      }
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
    ) {
      internalLinks.push(href);
    }
  }

  return internalLinks;
}

// Crawl trang tphomevn
async function handleTphomevnPage(page, url, visited) {
  console.log(`🌐 Tới trang: ${url}`);

  if (!page.url().includes('tphomevn.com')) {
    page = (await clickLinkByUrl(page, url)).page;
  }

  await page.waitForTimeout(10000); // đợi trang load

  const links = await getInternalTphomevnLinks(page, url);

  for (const link of links) {
    if (visited.has(link)) continue;
    visited.add(link);

    console.log(`🔗 Click vào: ${link}`);
    page = (await clickLinkByUrl(page, link)).page;

    // Đệ quy crawl link con
    await handleTphomevnPage(page, link, visited);

    // Quay về trang chủ
    page = (await clickLinkByUrl(page, 'https://tphomevn.com')).page;
  }
}

// Main function sử dụng isRunning
async function crawlTphomevnTask() {
  if (isRunning) {
    console.log('⏳ Tác vụ đang chạy, bỏ qua lần này.');
    return;
  }

  isRunning = true;
  console.log('🚀 Bắt đầu crawl tphomevn...');

  try {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    const startUrl = 'https://tphomevn.com/';
    const visited = new Set();

    await handleTphomevnPage(page, startUrl, visited);

    console.log('✅ Hoàn tất crawl tất cả link nội bộ tphomevn.');
    await browser.close();
  } catch (err) {
    console.error('❌ Lỗi crawl:', err);
  } finally {
    isRunning = false; // reset cờ khi xong
  }
}

// --- Giả lập cron job bằng setInterval (30 phút) ---
setInterval(crawlTphomevnTask, 30 * 60 * 1000);

// Chạy ngay lần đầu
crawlTphomevnTask();
