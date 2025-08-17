const { chromium } = require('playwright');

let isRunning = false;
let isFirstRun = true;

const keywords = [
  'giá gạch ốp lát tphome',
  'tphome giá gạch',
  'gia gach tphome',
];

// Lấy hrefs an toàn
async function safeGetHrefs(page, selector, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await page.waitForSelector(selector, { timeout: 4000 }).catch(() => {});
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
            } catch {}
          }
          hrefs.push(href);
        } catch {}
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

// Click an toàn
async function safeClick(page, locator, timeout = 15000) {
  try {
    const popupPromise = page.waitForEvent('popup', { timeout }).catch(() => null);
    const navPromise = page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout }).catch(() => null);
    await locator.click({ timeout });
    const popup = await popupPromise;
    const nav = await navPromise;

    if (popup) {
      await popup.waitForLoadState('domcontentloaded', { timeout }).catch(() => {});
      return { page: popup, isPopup: true };
    }

    await page.waitForLoadState('domcontentloaded', { timeout }).catch(() => {});
    return { page, isPopup: false };
  } catch (e) {
    console.log('⚠ safeClick error:', e?.message || e);
    return { page, isPopup: false, error: e };
  }
}

// Click link theo URL trong trang
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

    if (await link.count()) {
      const res = await safeClick(page, link, timeout);
      return res.page;
    }

    // fallback thử candidates
    for (const candidate of candidates) {
      try {
        let candLink = page.locator(`a[href="${candidate}"]:visible`).first();
        if (!(await candLink.count())) candLink = page.locator(`a[href*="${candidate}"]:visible`).first();

        if (await candLink.count()) {
          console.log(`👉 Không tìm thấy link ${url}, thử link khác: ${candidate}`);
          const res = await safeClick(page, candLink, timeout);
          return res.page;
        }
      } catch {}
    }

    // fallback goto
    console.log(`⚠ Không tìm thấy link hợp lệ nào, fallback goto: ${url}`);
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout }).catch(() => {});
    return page;
  } catch (e) {
    console.log('⚠ clickLinkByUrl error, fallback goto:', e?.message || e);
    await page.goto(url, { waitUntil: 'domcontentloaded' }).catch(() => {});
    return page;
  }
}

// Xử lý site tphomevn
async function handleTphomevnPage(activePage, startUrl) {
  console.log(`🌐 Tới tphomevn: ${startUrl}`);

  if (!activePage.url().includes('tphomevn.com/gia-gach-op-lat')) {
    activePage = await clickLinkByUrl(activePage, startUrl);
  }
  console.log(`✅ Đang ở: ${activePage.url()}`);

  console.log('⏳ Đợi 20s trong trang tphomevn...');
  await activePage.waitForTimeout(20000);

  const allHrefs = await safeGetHrefs(activePage, 'a[href]').catch(() => []);
  let internalLinks = [];
  for (let href of allHrefs) {
    if (!href) continue;
    if (href.startsWith('/')) {
      try { href = new URL(href, activePage.url()).href; } catch {}
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

  internalLinks = [...new Set(internalLinks)];

  if (internalLinks.length > 0) {
    const clickCount = 3 + Math.floor(Math.random() * 2);
    console.log(`🎯 Sẽ click ${clickCount} link ngẫu nhiên trong site`);

    for (let i = 0; i < clickCount && internalLinks.length > 0; i++) {
      const randomIndex = Math.floor(Math.random() * internalLinks.length);
      const chosen = internalLinks.splice(randomIndex, 1)[0];

      console.log(`🔗 Click ${i + 1}/${clickCount}: ${chosen}`);
      const afterClickPage = await clickLinkByUrl(activePage, chosen, internalLinks);
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
      try {
        await page.fill('[name="q"]', keyword);
      } catch {
        try { await page.fill('textarea[name="q"]', keyword); } catch {}
      }
      await Promise.all([
        page.keyboard.press('Enter'),
        page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 10000 }).catch(() => {})
      ]);

      // 🚨 Check nếu bị Google block (/sorry/index)
      if (page.url().includes("/sorry/index")) {
        console.log("🚨 Google block (captcha / sorry page) -> đợi 30s rồi thử lại...");
        await page.waitForTimeout(30000);
        continue; // thử lại vòng mới với cùng keyword
      }

      if (isFirstRun) {
        console.log('⏳ Lần đầu: chờ 30s để kết quả ổn định...');
        await page.waitForTimeout(30000);
        isFirstRun = false;
      }

      let found = false;

      while (!found) {
        const resultLink = page.locator('div#search a[href*="tphomevn"]').first();

        if (await resultLink.count()) {
          const { page: sitePage, isPopup } = await safeClick(page, resultLink, 15000);
          console.log(`👉 Đã mở kết quả: ${sitePage.url()}`);
          await handleTphomevnPage(sitePage, sitePage.url());

          if (isPopup) {
            await sitePage.close().catch(() => {});
          }
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

          // 🚨 Check lại sau khi sang trang mới
          if (page.url().includes("/sorry/index")) {
            console.log("🚨 Google block (captcha / sorry page) -> đợi 30s rồi thử lại...");
            await page.waitForTimeout(30000);
            break; // quay lại vòng keyword
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
