import { expect, test } from '@playwright/test';
import { CODE_D } from '../playwright.config';
import { login } from './helpers';

test('시작하기 체크리스트: 남은 일에 바로가기 버튼, 그만 보기는 이 기기에 기억', async ({ page }) => {
  await login(page, CODE_D);
  const card = page.getByRole('region', { name: /시작하기/ });
  await expect(card).toBeVisible();
  await expect(card.getByRole('button', { name: '이름 정하기' })).toBeVisible(); // 기본 이름(사용자 D)이면 남은 일
  await card.getByRole('button', { name: '이름 정하기' }).click();
  await expect(page).toHaveURL(/#settings$/);
  await page.goto('/#drafts');
  await page.getByRole('region', { name: /시작하기/ }).getByRole('button', { name: '그만 보기' }).click();
  await expect(page.getByRole('region', { name: /시작하기/ })).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole('heading', { name: /좋은 하루예요/ })).toBeVisible();
  await expect(page.getByRole('region', { name: /시작하기/ })).toHaveCount(0);
  await page.evaluate(() => localStorage.removeItem('minilog.firstcheck.hidden'));
});

test('다음 할 일 알림: 원고를 승인하면 이어서 할 일과 그 칸으로 가는 버튼', async ({ page }) => {
  await login(page, CODE_D);
  await page.getByRole('button', { name: '새 원고' }).click();
  await page.getByLabel('제목').fill('다음 할 일 시험');
  await expect(page.getByText('저장됨')).toBeVisible();
  await page.getByRole('button', { name: '원고 승인' }).click();
  const toast = page.locator('.next-toast');
  await expect(toast).toContainText('승인했어요');
  await toast.getByRole('button', { name: /올리기 칸으로/ }).click();
  await expect(toast).toHaveCount(0);
  const id = await page.evaluate(() => location.hash.split('/')[1]);
  await page.evaluate(async id => { await fetch(`/api/drafts/${id}`, { method: 'DELETE' }); }, id);
});
