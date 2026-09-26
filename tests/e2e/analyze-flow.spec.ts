import path from "node:path";
import { expect, test, type Page } from "@playwright/test";

// Upload → live progress → results, through the production build with the
// mocked LLM layer (LLM_MOCK=1 in playwright.config.ts). No API calls.
const fixture = (name: string) => path.join("evals/fixtures", name);
const fileInput = (page: Page) => page.locator('input[type="file"]');
const analyse = (page: Page) => page.getByRole("button", { name: "Analyse resume" });
const landingHeading = (page: Page) => page.getByRole("heading", { name: /Get your resume ready/ });
// Scoped to the form: Next.js adds its own role="alert" route announcer.
const formAlert = (page: Page) => page.getByRole("form").getByRole("alert");
// The selected file row; its Remove button names the file for screen readers.
const selectedFile = (page: Page, name: string) =>
  page.getByRole("button", { name: `Remove ${name}` });

test.describe("analyse flow", () => {
  test("upload → progress → results dashboard, with a job description", async ({
    page,
    context,
  }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.goto("/");
    await expect(analyse(page)).toBeDisabled();

    await fileInput(page).setInputFiles(fixture("jd-match.pdf"));
    await expect(selectedFile(page, "jd-match.pdf")).toBeVisible();
    await page
      .getByLabel(/Job description/)
      .fill("Senior Data Analyst: SQL, Python, Tableau, dbt, BigQuery.");
    await analyse(page).click();

    await expect(page.getByRole("heading", { name: "Analysing your resume" })).toBeVisible();
    await expect(page.getByText("Matching job description")).toBeVisible();

    const verdict = page.getByRole("heading", { level: 1, name: /A few fixes from strong/ });
    await expect(verdict).toBeVisible({ timeout: 20_000 });
    await expect(verdict).toBeFocused();
    await expect(page.locator("html")).toHaveAttribute("data-view", "results");
    await expect(page.getByRole("img", { name: "58 out of 100" })).toBeVisible();

    await expect(page.getByRole("heading", { name: "Job match" })).toBeVisible();
    await expect(page.getByText("64%")).toBeVisible();
    await expect(page.getByRole("listitem").filter({ hasText: /^SQL$/ })).toBeVisible();

    // The lowest-scoring dimension starts open, with cited feedback.
    await expect(page.getByText("Describes duties, not results.")).toBeVisible();
    await expect(
      page.getByText("Experience · Data Analyst, Northwind Retail · bullet 1"),
    ).toBeVisible();

    await expect(page.getByRole("heading", { name: "Suggested rewrites" })).toBeVisible();
    const copy = page.getByRole("button", { name: "Copy suggested bullet" }).first();
    await copy.scrollIntoViewIfNeeded();
    await copy.click();
    await expect(
      page.getByRole("button", { name: "Copied suggested bullet" }).first(),
    ).toBeVisible();

    await page.getByRole("button", { name: "Analyse another", exact: true }).click();
    await expect(landingHeading(page)).toBeVisible();
    await expect(page.locator("html")).not.toHaveAttribute("data-view", "results");
  });

  test("shows the hidden-text warning during progress and on results", async ({ page }) => {
    await page.goto("/");
    await fileInput(page).setInputFiles(fixture("hidden-injection.pdf"));
    await analyse(page).click();
    await expect(page.getByText("Your PDF contains hidden text")).toBeVisible();
    await expect(page.getByRole("heading", { level: 1, name: /A few fixes/ })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByText("Your PDF contains hidden text")).toBeVisible();
    await expect(page.getByText(/Ignore all previous instructions/)).toBeVisible();
  });

  test("rejects a non-PDF in the browser", async ({ page }) => {
    await page.goto("/");
    await fileInput(page).setInputFiles({
      name: "resume.docx",
      mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      buffer: Buffer.from("PK\u0003\u0004"),
    });
    await expect(formAlert(page)).toContainText("That's a .docx file");
    await expect(analyse(page)).toBeDisabled();
  });

  test("rejects an oversize file in the browser", async ({ page }) => {
    await page.goto("/");
    await fileInput(page).setInputFiles({
      name: "big.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.concat([Buffer.from("%PDF-1.7\n"), Buffer.alloc(4 * 1024 * 1024 + 10)]),
    });
    await expect(formAlert(page)).toContainText("The limit is 4.0 MB");
    await expect(analyse(page)).toBeDisabled();
  });

  test("shows the server's rejection when a .pdf isn't really a PDF", async ({ page }) => {
    await page.goto("/");
    await fileInput(page).setInputFiles({
      name: "fake.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("hello"),
    });
    await analyse(page).click();
    await expect(formAlert(page)).toContainText("isn't a PDF");
    await expect(landingHeading(page)).toBeVisible();
  });

  test("explains the daily limit (429) and disables the form", async ({ page }) => {
    const resetAt = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
    await page.route("**/api/analyze", (route) =>
      route.fulfill({
        status: 429,
        contentType: "application/json",
        body: JSON.stringify({
          error: { code: "rate_limited", message: "You've used today's 5 free analyses.", resetAt },
        }),
      }),
    );
    await page.goto("/");
    await fileInput(page).setInputFiles(fixture("senior-strong.pdf"));
    await analyse(page).click();
    await expect(page.getByText("You've used today's 5 free analyses")).toBeVisible();
    await expect(page.getByText(/You can analyse again after .+\(in .+\)/)).toBeVisible();
    await expect(analyse(page)).toBeDisabled();
  });

  test("tells the user when the document isn't a resume", async ({ page }) => {
    await page.goto("/");
    await fileInput(page).setInputFiles(fixture("not-a-resume.pdf"));
    await analyse(page).click();
    await expect(
      page.getByRole("heading", { name: "This doesn't look like a resume" }),
    ).toBeVisible({
      timeout: 20_000,
    });
    await page.getByRole("button", { name: "Try another file" }).click();
    await expect(landingHeading(page)).toBeVisible();
  });

  test("cancel returns to the form with the file still selected", async ({ page }) => {
    await page.goto("/");
    await fileInput(page).setInputFiles(fixture("junior-weak.pdf"));
    await analyse(page).click();
    await page.getByRole("button", { name: "Cancel" }).click();
    await expect(landingHeading(page)).toBeVisible();
    await expect(selectedFile(page, "junior-weak.pdf")).toBeVisible();
    await expect(analyse(page)).toBeEnabled();
  });

  test("the drop zone works from the keyboard", async ({ page, isMobile }) => {
    test.skip(isMobile, "keyboard flow is desktop-only");
    await page.goto("/");
    const dropzone = page.getByRole("button", { name: /Drop your resume here/ });
    await dropzone.focus();
    const chooser = page.waitForEvent("filechooser");
    await page.keyboard.press("Enter");
    await (await chooser).setFiles(fixture("senior-strong.pdf"));
    await expect(selectedFile(page, "senior-strong.pdf")).toBeVisible();
    await expect(analyse(page)).toBeEnabled();
  });
});
