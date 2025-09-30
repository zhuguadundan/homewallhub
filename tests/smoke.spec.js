// @ts-check
const { test, expect } = require('@playwright/test');

test('smoke: login page loads', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByRole('button', { name: '登录' })).toBeVisible();
});
