import { expect, test } from '@playwright/test';

test.describe('Homepage', () => {
  test('should load successfully', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/VitNode/);
    await expect(page.getByText('Start Your Journey!')).toBeVisible();
  });
});
