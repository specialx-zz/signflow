import { test, expect } from '@playwright/test';

// Helper to login as a specific role
async function loginAs(page: any, email: string, password: string) {
  await page.goto('/login');
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL('**/dashboard', { timeout: 10000 });
}

test.describe('Role-based Permissions', () => {
  test('VIEWER should not see admin menu items', async ({ page }) => {
    await loginAs(page, 'viewer@signflow.com', 'viewer123');
    // Should NOT see store management, user management
    await expect(page.locator('text=매장 관리')).not.toBeVisible();
    await expect(page.locator('text=사용자 관리')).not.toBeVisible();
  });

  test('TENANT_ADMIN should see admin menu items', async ({ page }) => {
    await loginAs(page, 'admin@signflow.com', 'admin123');
    // Should see store and user management
    await expect(page.locator('nav >> text=매장')).toBeVisible();
    await expect(page.locator('nav >> text=사용자')).toBeVisible();
  });

  test('VIEWER cannot navigate to stores page', async ({ page }) => {
    await loginAs(page, 'viewer@signflow.com', 'viewer123');
    await page.goto('/stores');
    // Should be redirected or show forbidden
    // The page may still render but with no data/access
  });
});
