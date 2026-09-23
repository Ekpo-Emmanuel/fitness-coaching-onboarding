/* eslint-disable @typescript-eslint/no-require-imports -- Standalone Node capture script. */
const { chromium } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');

// Local, read-only visual review. Uses labeled design fixtures, never live client records.
async function main() {
  const folder = path.resolve('artifacts/redesign');
  fs.mkdirSync(folder, { recursive: true });
  const browser = await chromium.launch({ channel: 'msedge' });
  const results = [];
  const screens = ['landing', 'login', 'signup', 'setup', 'dashboard', 'forms', 'create', 'builder', 'preview', 'public', 'clients', 'client', 'submission', 'settings', 'profile', 'connections', 'states'];
  for (const [size, width, height] of [['desktop', 1440, 1000], ['mobile', 390, 844]]) {
    const page = await browser.newPage({ viewport: { width, height }, reducedMotion: 'reduce' });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    for (const screen of screens) {
      const url = screen === 'landing' ? '/' : ['login', 'signup'].includes(screen) ? '/' + screen : '/dev/design?screen=' + screen;
      await page.goto('http://localhost:3000' + url, { waitUntil: 'domcontentloaded', timeout: 120000 });
      await page.locator("h1").first().waitFor({timeout:120000});
      await page.evaluate(() => document.fonts.ready);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
      const file = `${screen}-${size}.png`;
      await page.screenshot({ path: path.join(folder, file), fullPage: true });
      results.push({ screen, size, width, overflow, errors: errors.splice(0), file });
      console.log(`${screen} ${size}: ${overflow ? 'OVERFLOW' : 'fits'}`);
    }
    // Capture a real question step and validation using the production renderer.
    await page.goto('http://localhost:3000/dev/design?screen=public', { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: 'Start', exact: true }).click();
    await page.screenshot({ path: path.join(folder, `onboarding-questions-${size}.png`), fullPage: true });
    await page.getByRole('button', { name: 'Continue', exact: true }).click();
    await page.screenshot({ path: path.join(folder, `onboarding-validation-${size}.png`), fullPage: true });
    await page.goto('http://localhost:3000/dev/design?screen=client', { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: 'Delete client data', exact: true }).click();
    await page.screenshot({ path: path.join(folder, `delete-confirmation-${size}.png`), fullPage: true });
    await page.keyboard.press('Escape');
    await page.close();
  }
  const wide = await browser.newPage({viewport:{width:1920,height:1080},reducedMotion:'reduce'});
  await wide.goto('http://localhost:3000/dev/design?screen=builder',{waitUntil:'domcontentloaded',timeout:120000});
  await wide.screenshot({path:path.join(folder,'builder-wide.png'),fullPage:true});
  await browser.close();
  fs.writeFileSync(path.join(folder, 'verification.json'), JSON.stringify(results, null, 2));
  const items = results.map(item => `<figure><a href="${item.file}"><img loading="lazy" src="${item.file}" alt="${item.screen} ${item.size}"></a><figcaption>${item.screen} · ${item.size} · ${item.width}px</figcaption></figure>`).join('');
  fs.writeFileSync(path.join(folder, 'index.html'), `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Coaching redesign review</title><style>body{margin:0;padding:32px;background:#f7f8f4;color:#243b32;font:15px/1.6 system-ui}h1{font-size:36px;font-weight:500}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:24px}figure{margin:0;background:white;border:1px solid #dce2d9;border-radius:14px;overflow:hidden}img{width:100%;height:400px;object-fit:contain;object-position:top}figcaption{padding:16px;border-top:1px solid #dce2d9}a{color:inherit}</style><h1>Coaching, redesigned.</h1><p>Desktop and mobile. Screens use production components with clearly labeled sample data. Open an image for the full-resolution capture.</p><main>${items}</main></html>`);
  if (results.some(result => result.overflow || result.errors.length)) process.exitCode = 1;
}
main().catch(error => { console.error(error); process.exit(1); });
