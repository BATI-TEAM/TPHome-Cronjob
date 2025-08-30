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
 * Lấy toàn bộ link nội bộ theo host hiện tại, lọc bỏ mailto/tel/social/hình ảnh/bình luận/tài khoản và loại baseUrl nếu truyền vào.
 * @param {import('playwright').Page} page
 * @param {{ baseUrl?: string, includeHost?: string, excludeHosts?: string[], excludePaths?: string[], excludeExtensions?: string[] }} options
 * @returns {Promise<string[]>}
 */
async function getInternalLinks(page, options = {}) {
  const {
    baseUrl,
    includeHost,
    excludeHosts = [
      'facebook.com',
      'instagram.com',
      'whatsapp://',
      'twitter.com',
      'pinterest.com',
      'linkedin.com'
    ],
    excludePaths = ['#respond', 'lost-password', 'wp-content/uploads'],
    excludeExtensions = ['.jpg', '.png', '.jpeg', '.gif', '.pdf']
  } = options;
  const allHrefs = await safeGetHrefs(page, 'a[href]').catch(() => []);
  const result = [];
  const host = includeHost || (() => { try { return new URL(page.url()).hostname; } catch { return ''; } })();

  for (let href of allHrefs) {
    if (!href) continue;

    // Bỏ các liên kết chứa ký tự không hợp lệ
    if (href.includes('\n') || !href.match(/^https?:\/\//)) continue;

    // Chuẩn hóa liên kết tương đối
    if (href.startsWith('/')) {
      try { href = new URL(href, page.url()).href; } catch { continue; }
    }

    // Kiểm tra các điều kiện loại trừ
    const isExcluded = 
      href.startsWith('mailto:') ||
      href.startsWith('tel:') ||
      excludeHosts.some(x => href.includes(x)) ||
      excludePaths.some(p => href.includes(p)) ||
      excludeExtensions.some(ext => href.toLowerCase().endsWith(ext));

    if (isExcluded) continue;

    // Chỉ giữ liên kết thuộc host và không phải baseUrl
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

/**
 * Click vào liên kết và lấy lại danh sách liên kết mới từ trang đích, chỉ click vào liên kết chưa được xử lý.
 * @param {import('playwright').Page} page - Trang Playwright hiện tại
 * @param {string} url - URL mục tiêu để click
 * @param {Set<string>} visitedLinks - Set chứa các liên kết đã click
 * @param {string[]} candidates - Danh sách URL dự phòng
 * @param {Object} options - Tùy chọn cho getInternalLinks
 * @param {number} timeout - Thời gian chờ
 * @param {number} maxDepth - Độ sâu tối đa của việc crawl
 * @returns {Promise<{ page: import('playwright').Page, newLinks: string[] }>} - Trang đích và danh sách liên kết mới
 */
async function clickAndCrawlNewLinks(page, url, visitedLinks = new Set(), candidates = [], options = {}, timeout = 15000, maxDepth = 5) {
  try {
    // Kiểm tra nếu đã đạt độ sâu tối đa
    if (visitedLinks.size >= maxDepth) {
      console.log('⚠ Đạt độ sâu tối đa, dừng crawl.');
      return { page, newLinks: [] };
    }

    // Thêm URL hiện tại vào danh sách đã truy cập
    visitedLinks.add(url);

    // Click vào liên kết và chuyển đến trang đích
    const targetPage = await clickLinkByUrl(page, url, candidates, timeout);

    // Chờ trang tải xong
    await targetPage.waitForLoadState('domcontentloaded', { timeout }).catch(() => {});

    // Kiểm tra nếu bị Google block
    if (await isGoogleBlocked(targetPage)) {
      console.log('⚠ Trang bị Google block, không thể lấy liên kết.');
      return { page: targetPage, newLinks: [] };
    }

    // Mô phỏng thao tác người dùng để giảm dấu vết bot
    await humanize(targetPage);

    // Lấy danh sách liên kết khả dụng từ trang đích
    const links = await getInternalLinks(targetPage, {
      ...options,
      includeHost: options.includeHost || new URL(targetPage.url()).hostname,
    });

    // Lọc ra các liên kết mới (chưa được truy cập)
    const newLinks = links.filter(link => !visitedLinks.has(link));

    console.log(`✅ Thu thập được ${newLinks.length} liên kết mới từ ${targetPage.url()}`);
    return { page: targetPage, newLinks };
  } catch (e) {
    console.log('⚠ Lỗi khi click và crawl liên kết:', e?.message || e);
    return { page, newLinks: [] };
  }
}

/**
 * Crawl liên kết đệ quy, chỉ click vào các liên kết mới.
 * @param {import('playwright').Page} page - Trang Playwright hiện tại
 * @param {string} startUrl - URL bắt đầu
 * @param {Object} options - Tùy chọn cho getInternalLinks
 * @param {number} timeout - Thời gian chờ
 * @param {number} maxDepth - Độ sâu tối đa của việc crawl
 * @returns {Promise<string[]>} - Danh sách tất cả các liên kết đã truy cập
 */
async function recursiveCrawlNewLinks(page, startUrl, options = {}, timeout = 15000, maxDepth = 5) {
  const visitedLinks = new Set();
  const queue = [startUrl];

  while (queue.length > 0 && visitedLinks.size < maxDepth) {
    const url = queue.shift();
    if (visitedLinks.has(url)) continue;

    console.log(`👉 Đang xử lý: ${url}`);
    const { page: targetPage, newLinks } = await clickAndCrawlNewLinks(page, url, visitedLinks, [], options, timeout, maxDepth);

    // Thêm các liên kết mới vào hàng đợi
    for (const link of newLinks) {
      if (!visitedLinks.has(link)) {
        queue.push(link);
      }
    }

    // Delay ngẫu nhiên để mô phỏng hành vi người dùng
    await sleep(targetPage, randomDelayMs(1, 3));
    page = targetPage; // Cập nhật trang hiện tại
  }

  console.log(`✅ Hoàn tất crawl, tổng cộng ${visitedLinks.size} liên kết đã truy cập.`);
  return [...visitedLinks];
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
  clickAndCrawlNewLinks,
  recursiveCrawlNewLinks,
};
