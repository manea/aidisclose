import fs from 'node:fs';
import { expect, test, type Page } from '@playwright/test';

async function assertNoHorizontalOverflow(page: Page) {
  const dims = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
  }));
  expect(dims.scrollWidth).toBeLessThanOrEqual(dims.innerWidth);
}

test.describe('AIDisclose — EU AI Act (2024/1689 Art. 4 & 50) Studio E2E', () => {
  test('defaults to English LTR / Veridian Atelier, toggles Arabic RTL / Carbon Violet, and persists across reload', async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });

    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');

    await expect(page.getByTestId('storage-mode-badge')).toContainText('SQLite WAL + Node 22');
    await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'veridian');
    await expect(page.getByTestId('art50-snippet-pre')).toContainText('application/ld+json');
    await assertNoHorizontalOverflow(page);

    await page.screenshot({
      path: 'test-results/qa-screenshots/01-workspace-en-veridian.png',
      fullPage: true,
      animations: 'disabled',
    });

    await page.getByTestId('toggle-locale-btn').click();
    await page.getByTestId('toggle-theme-btn').click();

    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.locator('html')).toHaveAttribute('lang', 'ar');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'carbon-violet');
    await assertNoHorizontalOverflow(page);

    await page.screenshot({
      path: 'test-results/qa-screenshots/02-workspace-ar-carbon.png',
      fullPage: true,
      animations: 'disabled',
    });

    await page.reload();
    await expect(page.getByTestId('storage-mode-badge')).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.locator('html')).toHaveAttribute('lang', 'ar');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'carbon-violet');

    // Restore clean defaults
    await page.getByTestId('toggle-locale-btn').click();
    await page.getByTestId('toggle-theme-btn').click();
    await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'veridian');

    expect(errors).toEqual([]);
  });

  test('remediates newsroom deepfake & Art. 4 gaps, exports UTF-8 BOM CSV, seals AID-YYYY-0001 with SHA-256, and verifies public route', async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });

    const year = new Date().getUTCFullYear();
    const expectedNum = `AID-${year}-0001`;

    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');
    await expect(page.getByTestId('live-overall-score')).toBeVisible();

    // 1. Launch Newsroom Gaps preset
    await page.getByTestId('preset-btn-media-newsroom-gaps').click();
    await expect(page.getByTestId('org-legal-name')).toHaveValue('Nordic Pulse Media SAS');
    await expect(page.getByTestId('live-overall-score')).not.toHaveText('100/100');

    // 2. Remediate Feature 0 (deepfake_media) & Feature 1 (Art. 50(4) human editorial exemption)
    await page.getByTestId('feature-banner-checkbox-0').check();
    await page.getByTestId('feature-wcag-checkbox-0').check();
    await page.getByTestId('feature-marking-select-0').selectOption('c2pa_provenance');
    await page
      .getByTestId('feature-wording-en-0')
      .fill('AI-generated voice dubbing disclosed under EU AI Act Art. 50(4).');

    await page.getByTestId('editorial-exempt-checkbox-1').check();
    await page.getByTestId('editorial-owner-input-1').fill('Camille Laurent');

    await expect(page.getByTestId('art50-snippet-pre')).toContainText(
      'Editorial Review: Camille Laurent',
    );

    await page.screenshot({
      path: 'test-results/qa-screenshots/03-remediated-surfaces-desktop.png',
      fullPage: true,
      animations: 'disabled',
    });

    // 3. Switch to Tab 2 (Art. 4 Literacy & Inventory CSV), fix cohort coverage + topics, audit CSV, and pass all controls
    await page.getByTestId('tab-literacy').click();
    await expect(page.getByTestId('cohort-card-0')).toBeVisible();
    await page.getByTestId('cohort-mark-full-0').click();
    await page
      .getByTestId('cohort-topics-input-0')
      .fill('Generative Video Policy, Art. 4 AI Literacy, Human Oversight');

    await page.getByTestId('run-csv-audit-btn').click();
    await expect(page.getByTestId('csv-results-table')).toContainText('BOT-01');
    await expect(page.getByTestId('csv-results-table')).toContainText('IMG-02');
    await expect(page.getByTestId('csv-results-table')).toContainText('NEWS-03');

    const csvDlPromise = page.waitForEvent('download');
    await page.getByTestId('download-csv-audit-btn').click();
    const csvDownload = await csvDlPromise;
    expect(csvDownload.suggestedFilename()).toContain('.csv');
    const csvPath = await csvDownload.path();
    expect(csvPath).toBeTruthy();
    if (csvPath) {
      const bytes = fs.readFileSync(csvPath);
      expect(bytes[0]).toBe(0xef);
      expect(bytes[1]).toBe(0xbb);
      expect(bytes[2]).toBe(0xbf);
      expect(bytes.toString('utf8')).toContain('NEWS-03');
    }

    const controlIds = [
      'ai-art4-staff-curriculum',
      'ai-art4-oversight-pii',
      'ai-art4-completion-log',
      'ai-art50-1-chat-notice',
      'ai-art50-2-machine-marking',
      'ai-art50-3-biometric-emotion',
      'ai-art50-4-deepfake-label',
      'ai-art50-4-editorial-log',
      'ai-art50-5-accessibility',
      'ai-gov-procurement-bundle',
    ];
    for (const id of controlIds) {
      await page.getByTestId(`control-select-${id}`).selectOption('pass');
    }

    await expect(page.getByTestId('live-overall-score')).toHaveText('100/100');

    // 4. Switch to Tab 3 (Governance Dossier & Print), seal -> AID-YYYY-0001
    await page.getByTestId('tab-dossier').click();
    await page.getByTestId('finalize-dossier-btn').click();
    await expect(page.getByTestId('report-dossier-number')).toHaveText(expectedNum);
    await expect(page.getByTestId('report-digest-hex')).toHaveText(/^[0-9a-f]{64}$/);
    await expect(page.getByTestId('digest-status-badge')).toBeVisible();
    await expect(page.getByTestId('mandatory-legal-disclaimer')).toContainText('NOT legal counsel');
    await expect(page.getByTestId('finalize-dossier-btn')).toHaveCount(0);

    await page.screenshot({
      path: 'test-results/qa-screenshots/04-sealed-dossier-desktop.png',
      fullPage: true,
      animations: 'disabled',
    });

    // 5. Open public verification link & assert persistence across reload
    await page.getByTestId('open-public-brief-btn').click();
    await expect(page).toHaveURL(new RegExp(`/r/${expectedNum}$`));
    await expect(page.getByTestId('report-digest-hex')).toHaveText(/^[0-9a-f]{64}$/);
    await expect(page.getByTestId('public-view-count')).toBeVisible();

    await page.reload();
    await expect(page.getByTestId('report-digest-hex')).toHaveText(/^[0-9a-f]{64}$/);

    await page.getByTestId('back-to-workspace-btn').click();
    await expect(page).toHaveURL(/\/$/);

    expect(errors).toEqual([]);
  });

  test('verifies mobile 390x844 responsiveness across all tabs and Arabic RTL Carbon Violet with zero horizontal overflow', async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await expect(page.getByTestId('feature-card-0')).toBeVisible();
    await assertNoHorizontalOverflow(page);

    await page.screenshot({
      path: 'test-results/qa-screenshots/05-mobile-en-veridian.png',
      fullPage: true,
      animations: 'disabled',
    });

    await page.getByTestId('tab-literacy').click();
    await expect(page.getByTestId('cohort-card-0')).toBeVisible();
    await page.getByTestId('run-csv-audit-btn').click();
    await expect(page.getByTestId('csv-results-table')).toBeVisible();
    await assertNoHorizontalOverflow(page);

    await page.getByTestId('tab-dossier').click();
    await expect(page.getByTestId('mandatory-legal-disclaimer')).toBeVisible();
    await assertNoHorizontalOverflow(page);

    await page.getByTestId('tab-surfaces').click();
    await page.getByTestId('toggle-locale-btn').click();
    await page.getByTestId('toggle-theme-btn').click();
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'carbon-violet');
    await assertNoHorizontalOverflow(page);

    await page.screenshot({
      path: 'test-results/qa-screenshots/06-mobile-ar-carbon.png',
      fullPage: true,
      animations: 'disabled',
    });

    expect(errors).toEqual([]);
  });
});
