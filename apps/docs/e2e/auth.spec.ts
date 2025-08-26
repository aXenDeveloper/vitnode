import { expect, test } from "@playwright/test";

// Generate random user data for test isolation
function generateTestUser() {
  const randomId = Math.floor(Math.random() * 1000000);

  return {
    name: `test_user_${randomId}`,
    email: `test_user_${randomId}@example.com`,
    password: `Password123!${randomId}`,
  };
}

test.describe("Authentication", () => {
  const testUser = generateTestUser();

  test("should allow user registration", async ({ page }) => {
    // Navigate to registration page
    await page.goto("/register");

    // Wait for the form to be visible
    await expect(
      page.getByRole("heading", { name: /register/i }),
    ).toBeVisible();

    // Fill out registration form
    await page.getByLabel(/name/i).fill(testUser.name);
    await page.getByLabel(/email/i).fill(testUser.email);
    await page.getByLabel(/^password$/i).fill(testUser.password);

    // Submit form
    await page.locator('button[type="submit"]').click();

    // Verify successful registration (redirect or success message)
    // This might vary based on your app flow, adjust as needed
    await expect(page).toHaveURL(/\/verify-email|\/dashboard/);
  });

  test("should allow user login", async ({ page }) => {
    // Navigate to login page
    await page.goto("/login");

    // Wait for the form to be visible
    await expect(page.getByRole("heading", { name: /login/i })).toBeVisible();

    // Fill out login form with previously registered credentials
    await page.getByLabel(/email/i).fill(testUser.email);
    await page.getByLabel(/password/i).fill(testUser.password);

    // Submit form
    await page.locator('button[type="submit"]').click();

    await expect(page.getByText("Start Your Journey!")).toBeVisible();
  });
});
