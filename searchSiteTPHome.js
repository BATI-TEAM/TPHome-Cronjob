const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
  });

  try {
    await page.goto('https://www.google.com/search?q=site:tphomevn.com');
    await page.waitForSelector('h3');

    let pageNumber = 1;

    while (true) {
      console.log(`Started page ${pageNumber} at ${new Date().toISOString()}`);

      const links = await page.$$eval('a[href*="tphomevn.com"]', anchors =>
        anchors
          .map(a => a.href)
          .filter(href => href.includes('tphomevn.com') && !href.includes('google.com'))
      );

      console.log(`Found ${links.length} links on page ${pageNumber}`);

      for (const link of links) {
        try {
          await page.goto(link);
          console.log(`Visited: ${link}`);

          const internalLinks = await page.$$eval('a[href]', anchors =>
            anchors
              .map(a => a.href)
              .filter(href =>
                href.includes('tphomevn.com') &&
                !href.startsWith('mailto:') &&
                !href.startsWith('tel:') &&
                !href.includes('facebook.com') &&
                !href.includes('instagram.com')
              )
          );

          if (internalLinks.length > 0) {
            console.log('Waiting 5 seconds before clicking random internal link...');
            await page.waitForTimeout(5000);

            const randomLink = internalLinks[Math.floor(Math.random() * internalLinks.length)];
            console.log(`Click random internal link: ${randomLink}`);

            await page.goto(randomLink);
            await page.waitForTimeout(15000);
          }

          await page.goto(`https://www.google.com/search?q=site:tphomevn.com&start=${(pageNumber - 1) * 10}`);
          await page.waitForSelector('h3');

        } catch (error) {
          console.error(`Error visiting ${link}: ${error.message}`);
        }
      }

      const nextButton = await page.$('a#pnnext');
      if (!nextButton) {
        console.log('No more pages to process. Next button (a#pnnext) not found.');
        break;
      }

      await nextButton.click();
      await page.waitForSelector('h3');
      console.log(`Moved to page ${pageNumber + 1}`);
      pageNumber++;
    }

  } catch (error) {
    console.error(`Error during execution: ${error.message}`);
  } finally {
    await browser.close();
  }
})();
