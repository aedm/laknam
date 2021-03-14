import * as fs from "fs";

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
    }));
  });
  console.table(items);

  const [nextPageAnchor] = await page.$x("//a[contains(., 'Következő oldal')]");
  if (nextPageAnchor) {
    await nextPageAnchor.click();
    await page.waitForNavigation({ waitUntil: 'domcontentloaded' })
  }
  return {
    items,
    hasNext: !!nextPageAnchor,
  }
}

async function fetchAllContentAsJson(): Promise<string> {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 720 });
  // await page.goto('https://ingatlan.com/lista/elado+budapest+lakas');
  await page.goto('https://ingatlan.com/szukites/elado+lakas+xii-ker+100-150-m2');

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

async function main() {
  const timeStamp = new Date().toISOString();
  const result = await fetchAllContentAsJson();
  await uploadToS3('ingatlan-com-scrapes', `scrape-${timeStamp}.json`, result);
}

main().catch(console.trace);


