const puppeteer = require('puppeteer');
import {Page} from 'puppeteer';
import { uploadToS3 } from "./s3_upload";

interface IPageResult {
  items: any[];
  hasNext: boolean;
}

async function fetchPageAndGoToNext(page: Page): Promise<IPageResult> {
  console.log(`Loading page '${page.url()}'...`);
  await page.waitForSelector('.resultspage__content');
  console.log(`Done.`);

  const items = await page.$$eval('.listing', listingElements => {
    return listingElements.map(el => ({
      id: el.getAttribute('data-id'),
      clusterId: el.getAttribute('data-cluster-id'),
      address: el.querySelector('.listing__address')?.textContent,
      price: el.querySelector('.price')?.textContent,
      size: el.querySelector('.listing__data--area-size')?.textContent,
      roomCount: el.querySelector('.listing__data--room-count')?.textContent,
      balconySize: el.querySelector('.listing__data--balcony-size')?.textContent,
      timeStamp: new Date().toISOString(),
    }));
  });
  console.table(items);

  const [nextPageAnchor] = await page.$x("//a[contains(., 'Következő oldal')]");
  if (nextPageAnchor) {
    console.log('Navigating to next page...');
    await nextPageAnchor.click();
    console.time();
    await page.waitForNavigation({ waitUntil: 'domcontentloaded' })
    console.timeEnd();
  }
  return {
    items,
    hasNext: !!nextPageAnchor,
  }
}

async function fetchAllContentAsJson(firstPageUrl: string): Promise<string> {
  const browser = await puppeteer.launch({headless: true, args:['--no-sandbox']});
  const page = await browser.newPage();

  await page.setRequestInterception(true);
  page.on('request', (request) => {
    if (['image', 'stylesheet', 'font'].indexOf(request.resourceType()) !== -1) {
      request.abort();
    } else {
      request.continue();
    }
  });

  await page.setViewport({ width: 1280, height: 720 });
  await page.goto(firstPageUrl);

  const items = [];
  while (true) {
    try {
      const result = await fetchPageAndGoToNext(page);
      items.push(...result.items);
      if (!result.hasNext) break;
    } catch (ex) {
      console.trace(ex);
      break;
    }
  }

  console.table(items);
  await browser.close();
  return JSON.stringify(items, null, 2);
}

async function processBatch(region: string) {
  const timeStamp = new Date().toISOString();
  const url = `https://ingatlan.com/szukites/elado+lakas+${region}`;
  const result = await fetchAllContentAsJson(url);
  await uploadToS3('ingatlan-com-scrapes', `scrape-${region}-${timeStamp}.json`, result);
}

async function main() {
  const regions = [
    'i', 'ii', 'iii', 'iv', 'v', 'vi', 'vii', 'viii', 'ix', 'x',
    'xi', 'xii', 'xiii', 'xiv', 'xv', 'xvi', 'xvii', 'xviii', 'xix', 'xx',
    'xi', 'xii', 'xiii',
  ];
  for (const region of regions) {
    try {
      await processBatch(`${region}-ker`);
    }
    catch (ex) {
      console.trace(ex.toString());
    }
  }
}

main().catch(console.trace);


