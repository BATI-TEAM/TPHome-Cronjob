// Helpers dùng chung cho các script Playwright
// Ngôn ngữ: Vietnamese comments

/**
 * Lấy toàn bộ hrefs theo selector một cách an toàn, có retry và giải mã redirect của Google.
 * @param {import('playwright').Page} page
 * @param {string} selector CSS selector, ví dụ 'a[href]'
 * @param {number} retries số lần thử lại khi lỗi tạm thời
 * @returns {Promise<string[]>}
 */
async function safeGetHrefs(page, selector = 'a[href]', retries = 3) {
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

/**
 * Click an toàn: hỗ trợ popup (target=_blank) và điều hướng trong cùng tab, có timeout.
 * Trả về { page: Page, isPopup: boolean }
 * @param {import('playwright').Page} page
 * @param {import('playwright').Locator} locator
 * @param {number} timeout
 */
async function safeClick(page, locator, timeout = 15000) {
  try {
    const popupPromise = page.waitForEvent('popup', { timeout }).catch(() => null);
    const navPromise = page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout }).catch(() => null);
    await locator.click({ timeout });
    const popup = await popupPromise;
    await navPromise; // không quan trọng kết quả, chỉ để chờ

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

/**
 * Tìm và click link theo URL trong trang hiện tại. Nếu không thấy, thử theo path/last segment rồi candidates.
 * Cuối cùng fallback goto(url).
 * Trả về Page (tab đang hoạt động sau click/goto)
 * @param {import('playwright').Page} page
 * @param {string} url URL mục tiêu
 * @param {string[]} candidates Danh sách URL dự phòng để thử click
 * @param {number} timeout
 * @returns {Promise<import('playwright').Page>}
 */
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

    for (const candidate of candidates) {
      try {
        let candLink = page.locator(`a[href="${candidate}"]:visible`).first();
        if (!(await candLink.count())) candLink = page.locator(`a[href*="${candidate}"]:visible`).first();
        if (await candLink.count()) {
          console.log(`👉 Không tìm thấy link ${url}, thử candidate: ${candidate}`);
          const res = await safeClick(page, candLink, timeout);
          return res.page;
        }
      } catch {}
    }

    console.log(`⚠ Không tìm thấy link hợp lệ, fallback goto: ${url}`);
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout }).catch(() => {});
    return page;
  } catch (e) {
    console.log('⚠ clickLinkByUrl error, fallback goto:', e?.message || e);
    await page.goto(url, { waitUntil: 'domcontentloaded' }).catch(() => {});
    return page;
  }
}

/**
 * Lấy toàn bộ link nội bộ theo host hiện tại, lọc bỏ mailto/tel/social và loại baseUrl nếu truyền vào.
 * @param {import('playwright').Page} page
 * @param {{ baseUrl?: string, includeHost?: string, excludeHosts?: string[] }} options
 * @returns {Promise<string[]>}
 */
async function getInternalLinks(page, options = {}) {
  const { baseUrl, includeHost, excludeHosts = ['facebook.com', 'instagram.com', 'whatsapp:'] } = options;
  const allHrefs = await safeGetHrefs(page, 'a[href]').catch(() => []);
  const result = [];
  const host = includeHost || (() => { try { return new URL(page.url()).hostname; } catch { return ''; } })();

  for (let href of allHrefs) {
    if (!href) continue;
    if (href.startsWith('/')) {
      try { href = new URL(href, page.url()).href; } catch {}
    }
    const isExcluded = href.startsWith('mailto:') || href.startsWith('tel:') || excludeHosts.some(x => href.includes(x));
    if (isExcluded) continue;
    if (host && href.includes(host) && href !== baseUrl) {
      result.push(href);
    }
  }
  return [...new Set(result)];
}

/**
 * Lấy link nội bộ cho domain tphomevn.com (giữ tương thích với các script hiện tại)
 * @param {import('playwright').Page} page
 * @param {string} baseUrl
 * @returns {Promise<string[]>}
 */
async function getInternalTphomevnLinks(page, baseUrl) {
  return getInternalLinks(page, { baseUrl, includeHost: 'tphomevn.com' });
}

/** Random integer [min, max] */
function getRandomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/** Random delay milliseconds from seconds range */
function randomDelayMs(minSeconds, maxSeconds) {
  return getRandomInt(minSeconds, maxSeconds) * 1000;
}

/** Sleep tiện lợi dựa trên page.waitForTimeout */
async function sleep(page, ms) {
  await page.waitForTimeout(ms);
}

/** Check Google block (captcha/sorry page) */
function checkGoogleBlock(page) {
  return page.url().includes('/sorry/index');
}

/**
 * Điền query vào ô tìm kiếm Google, hỗ trợ input và textarea.
 * @param {import('playwright').Page} page
 * @param {string} query
 * @returns {Promise<boolean>} true nếu điền thành công
 */
async function fillGoogleSearchBox(page, query) {
  try {
    await page.fill('[name="q"]', query);
    return true;
  } catch {
    try {
      await page.fill('textarea[name="q"]', query);
      return true;
    } catch {
      return false;
    }
  }
}

// --- Google handling helpers ---
/**
 * Xử lý màn hình consent/cookies của Google nếu xuất hiện.
 * @param {import('playwright').Page} page
 * @param {number} timeout
 * @returns {Promise<boolean>} true nếu đã bấm được consent
 */
async function handleGoogleConsent(page, timeout = 5000) {
  const selectors = [
    '#L2AGLb',
    'button:has-text("I agree")',
    'button:has-text("Accept all")',
    'button:has-text("Tôi đồng ý")',
    'button:has-text("Đồng ý tất cả")',
    'form[action*="consent"] button:has-text("Accept")',
  ];
  for (const sel of selectors) {
    try {
      const btn = page.locator(sel).first();
      if (await btn.count()) {
        await btn.click({ timeout }).catch(() => {});
        await page.waitForLoadState('domcontentloaded', { timeout: 3000 }).catch(() => {});
        return true;
      }
    } catch {}
  }
  return false;
}

/**
 * Kiểm tra bị Google block (captcha/sorry page) bằng URL và nội dung trang.
 * @param {import('playwright').Page} page
 */
async function isGoogleBlocked(page) {
  const url = page.url();
  if (url.includes('/sorry/') || url.includes('/sorry/index')) return true;
  try {
    const html = (await page.content())?.toLowerCase() || '';
    const signals = [
      'unusual traffic', 'đã phát hiện lưu lượng bất thường',
      'our systems have detected',
      'to continue, please type the characters',
      'enable javascript'
    ];
    return signals.some(s => html.includes(s));
  } catch {
    return false;
  }
}

/**
 * Tạo URL tìm kiếm Google ổn định theo ngôn ngữ/khu vực.
 */
function googleSearchUrl(query, { hl = 'vi', gl = 'VN', num = 10 } = {}) {
  const params = new URLSearchParams({ q: query, hl, gl, num: String(num), pws: '0', safe: 'off' });
  return `https://www.google.com/search?${params.toString()}`;
}

/**
 * Lấy locator kết quả organic đầu tiên (bỏ quảng cáo aclk/googleadservices).
 */
function getOrganicResultLocator(page) {
  return page.locator('div#search a:has(h3):not([href*="aclk"]):not([href*="googleadservices"])').first();
}

/**
 * Lấy locator nút Next (đa ngôn ngữ).
 */
function getNextButtonLocator(page) {
  return page.locator('#pnnext, a[aria-label="Next"], a[aria-label="Trang tiếp theo"]').first();
}

/**
 * Mô phỏng thao tác người dùng đơn giản để giảm dấu vết bot.
 */
async function humanize(page) {
  try {
    const y = Math.floor(Math.random() * 600) + 200;
    await page.mouse.wheel(0, y);
    await page.waitForTimeout(400 + Math.random() * 900);
  } catch {}
}

module.exports = {
  safeGetHrefs,
  safeClick,
  clickLinkByUrl,
  getInternalLinks,
  getInternalTphomevnLinks,
  getRandomInt,
  randomDelayMs,
  sleep,
  checkGoogleBlock,
  fillGoogleSearchBox,
  handleGoogleConsent,
  isGoogleBlocked,
  googleSearchUrl,
  getOrganicResultLocator,
  getNextButtonLocator,
  humanize,
};
