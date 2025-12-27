import { test, expect } from '@playwright/test';

/**
 * E2E tests for the admin dashboard
 */
test.describe('Admin Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/admin');
  });

  test('should load the admin dashboard', async ({ page }) => {
    await expect(page).toHaveTitle(/Admin.*Meridian/i);
  });

  test('should display stats cards', async ({ page }) => {
    // Wait for stats to load
    await page.waitForSelector('[class*="grid"]', { timeout: 10000 });

    // Check for stat cards
    const statsGrid = page.locator('[class*="grid"]').first();
    await expect(statsGrid).toBeVisible();
  });

  test('should have a refresh button', async ({ page }) => {
    const refreshButton = page.getByRole('button', { name: /refresh/i });
    await expect(refreshButton).toBeVisible();
  });

  test('should display AI models section', async ({ page }) => {
    // Wait for content to load
    await page.waitForLoadState('networkidle');

    // Look for AI models section
    const aiSection = page.getByText(/AI Models/i);
    await expect(aiSection).toBeVisible();
  });

  test('should navigate to latest brief', async ({ page }) => {
    const latestBriefLink = page.getByRole('link', { name: /Latest Brief/i });
    await expect(latestBriefLink).toBeVisible();

    await latestBriefLink.click();
    await expect(page).toHaveURL(/\/briefs\//);
  });

  test('should display source breakdown', async ({ page }) => {
    // Wait for content to load
    await page.waitForLoadState('networkidle');

    const sourcesSection = page.getByText(/Top Sources/i);
    await expect(sourcesSection).toBeVisible();
  });

  test('should show system status in footer', async ({ page }) => {
    const footer = page.locator('footer');
    await expect(footer).toBeVisible();
    await expect(footer).toContainText(/Operational|System/i);
  });
});
