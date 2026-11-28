import { expect, test } from '@playwright/test';
import { CODE_C, CODE_D } from '../playwright.config';
import { login } from './helpers';
import { docFromText } from '../functions/_mailDoc';

test("'내 글': SNS에 올린 글 본문과 보낸 메일을 이 화면에서 바로 보고, 남의 글은 안 섞임", async ({ page, browser, request }) => {
  expect((await request.get('/api/mine')).status()).toBe(401);
  await login(page, CODE_C);
  const made = await page.evaluate(async (doc) => {
    const d = (await (await fetch('/api/drafts', { method: 'POST', body: '{}' })).json()).draft;
    await fetch(`/api/drafts/${d.id}`, { method: 'PUT', body: JSON.stringify({ title: '내 글 시험 원고', body: '본문입니다' }) });
    const bad = (await fetch(`/api/drafts/${d.id}/shares`, { method: 'PUT', body: JSON.stringify({ channel: 'threads', shared: true, text: '스레드에 올린 글\n두 번째 줄\u0007' }) })).status;
    const sent = await (await fetch('/api/mail/compose', { method: 'POST', body: JSON.stringify({ to: 'shop@example.com', subject: '내 글 시험 제안 메일', doc }) })).json();
    return { id: d.id, bad, mailId: sent.mail?.id as string | undefined };
  }, docFromText('안녕하세요, 체험 제안드려요.\n일정 알려 주세요.'));
  expect(made.bad).toBe(200);
  await page.reload(); // 화면 밖(API)으로 만든 원고를 목록에 다시 읽힌다
  await page.goto('/#mine');
  const table = page.getByRole('table', { name: '내 글' });
  // SNS 글: 표에서 누르면 다른 화면으로 가지 않고 날짜별 미리보기에 본문
  await table.getByRole('row').filter({ hasText: '내 글 시험 원고 · 스레드' }).getByRole('button').click();
  const preview = page.getByRole('complementary', { name: '미리보기' });
  await expect(preview).toContainText('스레드에 올린 글');
  await expect(preview).toContainText('두 번째 줄');
  await expect(page).toHaveURL(/#mine$/);
  // 보낸 메일: 미리보기에 내가 보낸 글
  await page.getByRole('group', { name: '보기' }).getByRole('button', { name: '표', exact: true }).click();
  await table.getByRole('button', { name: '내 글 시험 제안 메일' }).click();
  await expect(preview).toContainText('안녕하세요, 체험 제안드려요.');
  await expect(preview).toContainText('받는 사람 sh***@example.com');
  // D에게는 안 보임
  const other = await (await browser.newContext()).newPage();
  await login(other, CODE_D);
  const d = await other.evaluate(async () => (await (await fetch('/api/mine')).json()) as { mails: { subject: string }[]; shares: { text: string | null }[] });
  expect(d.mails.some(m => m.subject === '내 글 시험 제안 메일')).toBe(false);
  expect(d.shares.some(s => s.text?.includes('스레드에 올린 글'))).toBe(false);
  await other.context().close();
  await page.evaluate(async ({ id, mailId }) => { await fetch(`/api/drafts/${id}`, { method: 'DELETE' }); if (mailId) await fetch(`/api/mail/${mailId}`, { method: 'DELETE' }); }, made);
});
