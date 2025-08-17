const { chromium } = require('playwright');

let isRunning = false;
let isFirstRun = true;

const keywords = ["giá gạch 40x40", "gạch stile", "gạch ốp viền"];

// Lấy hrefs an toàn
async function safeGetHrefs(page, selector, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await page.waitForSelector(selector, { timeout: 4000 }).catch(() => { });
      const locators = await page.locator(selector).all();
      const hrefs = [];
      for (const loc of locators) {
        try {
          let href = await loc.getAttribute('href');
          if (!href) continue;
          // Giải mã redirect của Google
          if (href.startsWith('/url?') || href.includes('/url?q=')) {
            try {
              const u = new URL(href, 'https://www.google.com');
              const q = u.searchParams.get('q');
              if (q) href = q;
            } catch { }
          }
          hrefs.push(href);
        } catch { }
      }
      return [...new Set(hrefs)];
    } catch (err) {
      console.warn(`safeGetHrefs: attempt ${attempt} failed: ${err?.message || err}`);
      if (attempt < retries) {
        await page.waitForTimeout(800);
        continue;
      } else {
        throw err;
      }
    }
  }
  return [];
}

// Click an toàn: hỗ trợ popup (target=_blank) hoặc điều hướng cùng tab
async function safeClick(page, locator, timeout = 15000) {
  try {
    const popupPromise = page.waitForEvent('popup', { timeout }).catch(() => null);
    const navPromise = page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout }).catch(() => null);
    await locator.click({ timeout });
    const popup = await popupPromise;
    const nav = await navPromise;

    if (popup) {
      await popup.waitForLoadState('domcontentloaded', { timeout }).catch(() => { });
      return { page: popup, isPopup: true };
    }

    // Nếu không có popup, vẫn đợi loadState (phòng SPA không fire navigation)
    await page.waitForLoadState('domcontentloaded', { timeout }).catch(() => { });
    return { page, isPopup: false };
  } catch (e) {
    console.log('⚠ safeClick error:', e?.message || e);
    return { page, isPopup: false, error: e };
  }
}

// Click link theo URL trong trang hiện tại; nếu fail thì thử link khác trong danh sách
async function clickLinkByUrl(page, url, candidates = [], timeout = 15000) {
  try {
    const u = new URL(url);
    const host = u.hostname;
    const path = u.pathname.replace(/\/+$/, "");
    const lastSeg = path.split('/').filter(Boolean).pop() || '';

    // Ưu tiên tìm chính xác link tới url
    let link = page.locator(`a[href="${url}"]:visible`).first();
    if (!(await link.count())) link = page.locator(`a[href$="${path}"]:visible`).first();
    if (!(await link.count())) {
      link = lastSeg
        ? page.locator(`a[href*="${host}"][href*="${lastSeg}"]:visible`).first()
        : page.locator(`a[href*="${host}"]:visible`).first();
    }

    if (await link.count()) {
      const res = await safeClick(page, link, timeout);
      return res.page;
    }

    // Nếu không tìm thấy link tới URL này → thử candidates khác
    for (const candidate of candidates) {
      try {
        let candLink = page.locator(`a[href="${candidate}"]:visible`).first();
        if (!(await candLink.count())) candLink = page.locator(`a[href*="${candidate}"]:visible`).first();

        if (await candLink.count()) {
          console.log(`👉 Không tìm thấy link ${url}, thử link khác: ${candidate}`);
          const res = await safeClick(page, candLink, timeout);
          return res.page;
        }
      } catch { }
    }

    // Nếu toàn bộ candidates đều không click được → fallback goto
    console.log(`⚠ Không tìm thấy link hợp lệ nào, fallback goto: ${url}`);
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout }).catch(() => { });
    return page;
  } catch (e) {
    console.log('⚠ clickLinkByUrl error, fallback goto:', e?.message || e);
    await page.goto(url, { waitUntil: 'domcontentloaded' }).catch(() => { });
    return page;
  }
}

// Xử lý khi đã vào (hoặc điều hướng vào) site tphomevn
async function handleTphomevnPage(activePage, startUrl) {
  console.log(`🌐 Tới tphomevn: ${startUrl}`);

  if (!activePage.url().includes('tphomevn.com')) {
    activePage = await clickLinkByUrl(activePage, startUrl);
  }
  console.log(`✅ Đang ở: ${activePage.url()}`);

  // Chờ 20s ở trang đầu tiên
  console.log('⏳ Đợi 20s trong trang tphomevn...');
  await activePage.waitForTimeout(20000);

  // Lấy các link nội bộ
  const allHrefs = await safeGetHrefs(activePage, 'a[href]').catch(() => []);
  let internalLinks = [];
  for (let href of allHrefs) {
    if (!href) continue;
    if (href.startsWith('/')) {
      try { href = new URL(href, activePage.url()).href; } catch { }
    }
    if (
      href.includes('tphomevn.com') &&
      !href.startsWith('mailto:') &&
      !href.startsWith('tel:') &&
      !href.includes('facebook.com') &&
      !href.includes('instagram.com') &&
      href !== startUrl
    ) {
      internalLinks.push(href);
    }
  }

  internalLinks = [...new Set(internalLinks)]; // loại trùng

  if (internalLinks.length > 0) {
    // Random số lần click: 3 hoặc 4
    const clickCount = 3 + Math.floor(Math.random() * 2);

    console.log(`🎯 Sẽ click ${clickCount} link ngẫu nhiên trong site`);

    for (let i = 0; i < clickCount && internalLinks.length > 0; i++) {
      const randomIndex = Math.floor(Math.random() * internalLinks.length);
      const chosen = internalLinks.splice(randomIndex, 1)[0]; // lấy ra và xoá khỏi danh sách

      console.log(`🔗 Click ${i + 1}/${clickCount}: ${chosen}`);

      const afterClickPage = await clickLinkByUrl(activePage, chosen, internalLinks);
      console.log(`🌍 Đã vào: ${afterClickPage.url()}`);

      // Dừng ngẫu nhiên 15–20s
      const delay = 15000 + Math.floor(Math.random() * 5000);
      console.log(`⏳ Đợi ${Math.round(delay / 1000)}s trong trang con...`);
      await afterClickPage.waitForTimeout(delay);

      activePage = afterClickPage; // tiếp tục click từ trang mới
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
      try {
        await page.fill('[name="q"]', keyword);
      } catch {
        try { await page.fill('textarea[name="q"]', keyword); } catch { }
      }
      await Promise.all([
        page.keyboard.press('Enter'),
        page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 10000 }).catch(() => { })
      ]);

      // Sau khi search keyword xong và load kết quả
      if (page.url().includes("/sorry/index")) {
        console.log("🚨 Google block (sorry/index) -> đợi 30s rồi retry...");
        await page.waitForTimeout(30000);
        continue; // bỏ qua vòng while này, thử lại keyword đó
      }

      if (isFirstRun) {
        console.log('⏳ Lần đầu: chờ 30s để kết quả ổn định...');
        await page.waitForTimeout(30000);
        isFirstRun = false;
      }

      let found = false;

      // --- Duyệt qua nhiều trang Google ---
      while (!found) {
        const resultLink = page.locator('div#search a[href*="tphomevn"]').first();

        if (await resultLink.count()) {
          const { page: sitePage, isPopup } = await safeClick(page, resultLink, 15000);
          console.log(`👉 Đã mở kết quả: ${sitePage.url()}`);
          await handleTphomevnPage(sitePage, sitePage.url());

          // Nếu mở popup, đóng nó để không rò rỉ tài nguyên
          if (isPopup) {
            await sitePage.close().catch(() => { });
          }
          found = true;
          break;
        }

        // Sang trang tiếp theo nếu chưa thấy
        const nextBtn = await page.$('#pnnext, a[aria-label="Next"], a[aria-label="Trang tiếp theo"]');
        if (nextBtn) {
          console.log('👉 Sang trang kết quả kế tiếp...');
          await Promise.all([
            nextBtn.click(),
            page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => { })
          ]);
          await page.waitForTimeout(2000);
        } else {
          console.log('⚠️ Hết trang tìm kiếm mà không thấy tphomevn.');
          break;
        }
      }

      // chuyển sang keyword tiếp theo
      keywordIndex = (keywordIndex + 1) % keywords.length;
      console.log('🔄 Chuyển sang từ khoá tiếp theo...');
      await page.waitForTimeout(2000);
    }
  } catch (err) {
    console.error('💥 Lỗi nghiêm trọng (ngoài vòng):', err);
  } finally {
    isRunning = false;
    // Để dễ debug, không auto-close browser. Khi chạy thật, mở dòng sau:
    // if (browser) await browser.close();
  }
}

runGoogleSearchAndNavigate();
