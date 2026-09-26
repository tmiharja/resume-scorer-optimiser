import { expect, test } from "@playwright/test";

test("landing page renders the shell", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "Get your resume ready for Singapore recruiters.",
    }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Resume Optimiser" })).toBeVisible();
  await expect(page.getByText("Built by")).toContainText("toninmotion");
});

test("privacy link opens the privacy page", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Privacy" }).first().click();
  await expect(page).toHaveURL(/\/privacy$/);
  await expect(page.getByRole("heading", { level: 1, name: "Privacy" })).toBeVisible();
});

test("theme toggle switches to dark mode and remembers it", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/");
  await page.getByRole("button", { name: "Switch to dark mode" }).click();
  await expect(page.locator("html")).toHaveClass(/dark/);
  await page.reload();
  await expect(page.locator("html")).toHaveClass(/dark/);
});
