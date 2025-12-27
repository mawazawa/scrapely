import { test, expect } from '@playwright/test';

/**
 * E2E tests for the briefs pages
 */
test.describe('Briefs List', () => {
  test('should load the briefs list page', async ({ page }) => {
    await page.goto('/briefs');
    await expect(page).toHaveTitle(/Briefs|Meridian/i);
  });

  test('should display a list of briefs', async ({ page }) => {
    await page.goto('/briefs');

    // Wait for content to load
    await page.waitForLoadState('networkidle');

    // Check for brief items (links or articles)
    const briefItems = page.locator('article, [class*="brief"], a[href*="/briefs/"]');
    const count = await briefItems.count();

    // Either there are briefs or a "no briefs" message
    if (count === 0) {
      const emptyMessage = page.getByText(/no.*briefs|empty/i);
      await expect(emptyMessage).toBeVisible();
    } else {
      await expect(briefItems.first()).toBeVisible();
    }
  });
});

test.describe('Brief Detail', () => {
  test('should navigate to latest brief', async ({ page }) => {
    await page.goto('/briefs/latest');

    // Should either redirect to a specific brief or show latest
    await page.waitForLoadState('networkidle');

    // Check that we're on a brief page
    const content = page.locator('main, article, [class*="content"]');
    await expect(content.first()).toBeVisible();
  });

  test('should display brief content', async ({ page }) => {
    // Go to briefs list first
    await page.goto('/briefs');
    await page.waitForLoadState('networkidle');

    // Click on first brief if available
    const firstBrief = page.locator('a[href*="/briefs/"]').first();
    if (await firstBrief.isVisible()) {
      await firstBrief.click();

      // Should display brief content
      await page.waitForLoadState('networkidle');

      // Check for title or heading
      const heading = page.locator('h1, h2').first();
      await expect(heading).toBeVisible();
    }
  });

  test('should handle non-existent brief gracefully', async ({ page }) => {
    const response = await page.goto('/briefs/non-existent-brief-12345');

    // Should either 404 or redirect
    if (response) {
      const status = response.status();
      expect([200, 404, 301, 302]).toContain(status);
    }
  });
});
