import { expect, test, type Page } from '@playwright/test';

async function createClass(page: Page, name: string) {
  await page.goto('/teacher?lang=en');
  await page.getByPlaceholder('e.g. 3B Robotics').fill(name);
  await page.getByRole('button', { name: 'Create class' }).click();
  await expect(page.getByText('Your class is ready!')).toBeVisible();
  const link = await page.locator('input[readonly]').inputValue();
  const kidUrl = (await page.locator('span.truncate').first().textContent())!;
  return { code: new URL(kidUrl).searchParams.get('class')!, teacherLink: link };
}

async function finishAndSend(kid: Page, nick: string) {
  await kid.getByRole('button', { name: 'Finish & 3D Print!' }).click();
  await kid.getByPlaceholder('e.g. Lukas, Maya, Max…').fill(nick);
  await kid.getByRole('button', { name: /Send to class/ }).click();
}

test('teacher creates class, kid sends, teacher downloads ZIP', async ({ page, context }) => {
  const { code, teacherLink } = await createClass(page, `E2E ${test.info().project.name}`);
  const kid = await context.newPage();
  await kid.goto(`/?class=${code}&lang=en`);
  await expect(kid.getByText(`Class: E2E ${test.info().project.name}`)).toBeVisible();
  await expect(kid).toHaveURL(/\/\?lang=en$/);
  await finishAndSend(kid, 'Łukasz');
  await expect(kid.getByText(/Awesome job, Łukasz!/)).toBeVisible();

  await page.goto(teacherLink);
  await expect(page.locator('[data-model]')).toHaveCount(1);
  await expect(page.getByText('By: Łukasz')).toBeVisible();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download unprinted (.ZIP)' }).click();
  expect((await download).suggestedFilename()).toMatch(new RegExp(`^toyforge_${code}_\\d{4}-\\d{2}-\\d{2}\\.zip$`));
});

test('offline send is queued and delivered after reconnect', async ({ page, context }) => {
  const { code, teacherLink } = await createClass(page, 'Offline');
  const kid = await context.newPage();
  await kid.goto(`/?class=${code}&lang=en`);
  await expect(kid.getByText('Class: Offline')).toBeVisible();
  await context.setOffline(true);
  await finishAndSend(kid, 'Maya');
  await expect(kid.getByText(/Your model is saved and will send automatically/)).toBeVisible();
  await expect(kid.getByText('Waiting to send: 1')).toBeVisible();
  await context.setOffline(false);
  await kid.evaluate(() => window.dispatchEvent(new Event('online')));
  await expect(kid.getByText('Waiting to send: 1')).toBeHidden({ timeout: 20_000 });
  await page.goto(teacherLink);
  await expect(page.getByText('By: Maya')).toBeVisible();
});

test('download works without a class code', async ({ page }) => {
  await page.goto('/?lang=en');
  await page.getByRole('button', { name: 'Finish & 3D Print!' }).click();
  await page.getByRole('button', { name: 'Download 3D file (.STL)' }).click();
  await expect(page.getByText('Please enter your nickname first!')).toBeVisible();
  await page.getByPlaceholder('e.g. Lukas, Maya, Max…').fill('Šimon');
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download 3D file (.STL)' }).click();
  expect((await download).suggestedFilename()).toMatch(/^simon_character_\d{8}\.stl$/);
});

test('unknown class code shows a friendly message', async ({ page }) => {
  await page.goto('/?lang=en');
  await page.getByRole('button', { name: 'Class code' }).click();
  await page.getByLabel('Join your class').fill('zzz zzz');
  await page.getByRole('button', { name: 'Join' }).click();
  await expect(page.getByText(/We can’t find class ZZZ ZZZ/)).toBeVisible();
});

test('Czech UI via ?lang=cs', async ({ page }) => {
  await page.goto('/?lang=cs');
  await expect(page.getByRole('button', { name: 'Hotovo – tisknout!' })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang', 'cs');
});
