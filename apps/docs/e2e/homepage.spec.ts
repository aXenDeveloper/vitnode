import { expect, test } from '@playwright/test';

const vitNodeTitleRegex = /VitNode/;

test.describe('Homepage', () => {
  test('should load successfully', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(vitNodeTitleRegex);
    await expect(page.getByText('Start Your Journey!')).toBeVisible();
  });
});
