import { expect, test } from '../fixtures';

test.describe('E2E: Persistent Candidate Screening Workflow', () => {
  test('Candidate Repository tab navigation and component rendering', async ({
    adaContext,
  }) => {
    const { page } = adaContext;

    // Navigate to root screening page
    await page.goto('/screening');

    // Verify platform header is present
    await expect(page.getByText('DataPattern')).toBeVisible();

    // Verify exact Repository tab button exists in header navigation
    const repoTab = page.getByRole('button', { name: 'Repository', exact: true });
    await expect(repoTab).toBeVisible();

    // Click Repository tab
    await repoTab.click();

    // Verify Candidate Repository page header renders
    await expect(page.getByRole('heading', { name: 'Stored Candidates' })).toBeVisible();
    await expect(
      page.getByPlaceholder('Search by name, email, job role or skills…'),
    ).toBeVisible();

    // Verify Refresh button exists
    await expect(page.getByRole('button', { name: /Refresh/i })).toBeVisible();
  });

  test('Setup view contains Select from Repository button', async ({
    adaContext,
  }) => {
    const { page } = adaContext;

    await page.goto('/screening');

    // Click Setup tab
    const setupTab = page.getByRole('button', { name: 'Setup', exact: true });
    await setupTab.click();

    // Check for "Select from Repository" button in the Candidate Resumes card
    const selectRepoBtn = page.getByRole('button', { name: /Select from Repository/i });
    await expect(selectRepoBtn).toBeVisible();

    // Clicking "Select from Repository" should switch active view to Candidate Repository
    await selectRepoBtn.click();
    await expect(page.getByRole('heading', { name: 'Stored Candidates' })).toBeVisible();
  });
});
