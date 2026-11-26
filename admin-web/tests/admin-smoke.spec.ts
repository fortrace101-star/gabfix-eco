import { expect, test, type Page } from '@playwright/test';

const ADMIN_EMAIL = 'admin@gabfix.ug';
const ADMIN_PASSWORD = 'gabfix2026';

/** Signs in through the real form; the seed user comes from the local Supabase. */
async function signIn(page: Page): Promise<void> {
  await page.goto('/');

  for (let attempt = 0; attempt < 3; attempt += 1) {
    if (await page.locator('.sidebar').isVisible()) return;
    const email = page.locator('#admin-email');
    if (!(await email.isVisible())) {
      // The auth-restore screen can win the first paint; reload into the form.
      await page.reload();
      await email.waitFor({ state: 'visible', timeout: 15_000 });
    }
    await email.fill(ADMIN_EMAIL);
    await page.locator('#admin-password').fill(ADMIN_PASSWORD);
    await page.locator('form button[type="submit"]').click();
    await page.locator('.sidebar').waitFor({ state: 'visible', timeout: 15_000 });
    return;
  }

  throw new Error('Could not reach the admin shell');
}

const pages = [
  { id: 'bookings', title: 'Bookings' },
  { id: 'payments', title: 'Payments' },
  { id: 'cash', title: 'Cash collections' },
  { id: 'customers', title: 'Customers' },
  { id: 'costs', title: 'Job costs' },
  { id: 'catalogue', title: 'Service catalogue' },
];

test('signs in and lands on the overview', async ({ page }) => {
  await signIn(page);
  await expect(page.locator('#main-content h1')).toHaveText(/Good (morning|afternoon|evening)/);
  await expect(page.locator('.sidebar')).toBeVisible();
});

test('the side nav routes between sections', async ({ page }) => {
  await signIn(page);
  await page.locator('.sidebar').getByRole('button', { name: 'Bookings' }).click();
  await expect(page).toHaveURL(/#\/bookings$/);
  await expect(page.locator('#main-content h1')).toHaveText('Bookings');
});

test('every table scroll region is named and keyboard reachable', async ({ page }) => {
  await signIn(page);

  for (const target of pages) {
    await page.evaluate((id) => {
      window.location.hash = `#/${id}`;
    }, target.id);
    await expect(page.locator('#main-content h1')).toContainText(target.title.split(' ')[0]);

    const scrollers = page.locator('.table-scroll');
    for (let index = 0; index < (await scrollers.count()); index += 1) {
      const scroller = scrollers.nth(index);
      await expect(scroller).toHaveAttribute('role', 'region');
      await expect(scroller).toHaveAttribute('tabindex', '0');
      expect((await scroller.getAttribute('aria-label'))?.trim()).toBeTruthy();
    }
  }
});

test('tables fit their card at the 1440 design width', async ({ page }) => {
  await signIn(page);

  for (const target of pages) {
    await page.evaluate((id) => {
      window.location.hash = `#/${id}`;
    }, target.id);
    await page.locator('.table-scroll').first().waitFor();

    const overflow = await page.evaluate(() =>
      [...document.querySelectorAll<HTMLElement>('.table-scroll')]
        .map((el) => el.scrollWidth - el.clientWidth)
        .filter((gap) => gap > 1),
    );
    expect(overflow, `${target.id} has a clipped table`).toEqual([]);
  }
});

test('the skip link moves focus to the page without changing the route', async ({ page }) => {
  await signIn(page);
  // A fresh navigation puts focus on the document, which is where a keyboard
  // user starts; Tab then has to reach the skip link before anything else.
  await page.goto('/#/bookings');
  await expect(page.locator('#main-content h1')).toHaveText('Bookings');

  await page.keyboard.press('Tab');
  const skip = page.locator('.skip-link');
  await expect(skip).toBeFocused();
  await skip.press('Enter');

  await expect(page.locator('#main-content')).toBeFocused();
  await expect(page).toHaveURL(/#\/bookings$/);
});
