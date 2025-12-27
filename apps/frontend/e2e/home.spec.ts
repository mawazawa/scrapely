import { test, expect } from '@playwright/test';

/**
 * E2E tests for the home page
 */
test.describe('Home Page', () => {
  test('should load the home page', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/Meridian/i);
  });

  test('should display navigation elements', async ({ page }) => {
    await page.goto('/');

    // Check for header/navigation
    const header = page.locator('header').first();
    await expect(header).toBeVisible();
  });

  test('should navigate to briefs list', async ({ page }) => {
    await page.goto('/');

    // Look for briefs link and click
    const briefsLink = page.getByRole('link', { name: /briefs|reports/i }).first();
    if (await briefsLink.isVisible()) {
      await briefsLink.click();
      await expect(page).toHaveURL(/\/briefs/);
    }
  });

  test('should be responsive on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');

    // Page should still be functional
    await expect(page.locator('body')).toBeVisible();
  });
});
