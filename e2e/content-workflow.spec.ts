import { test, expect } from '@playwright/test';

async function loginAs(page: any, email: string, password: string) {
  await page.goto('/login');
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL('**/dashboard', { timeout: 10000 });
}

test.describe('Content Workflow', () => {
  test('USER can access content page', async ({ page }) => {
    await loginAs(page, 'user@signflow.com', 'user123');
    await page.goto('/content');
    await expect(page).toHaveURL(/content/);
  });

  test('USER can access playlists page', async ({ page }) => {
    await loginAs(page, 'user@signflow.com', 'user123');
    await page.goto('/playlists');
    await expect(page).toHaveURL(/playlists/);
  });

  test('STORE_MANAGER can access schedules page', async ({ page }) => {
    await loginAs(page, 'manager@signflow.com', 'manager123');
    await page.goto('/schedules');
    await expect(page).toHaveURL(/schedules/);
  });

  test('STORE_MANAGER can access devices page', async ({ page }) => {
    await loginAs(page, 'manager@signflow.com', 'manager123');
    await page.goto('/devices');
    await expect(page).toHaveURL(/devices/);
  });
});
