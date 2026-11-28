import { expect, test } from '@playwright/test';
import { vapidKeysFor } from '../functions/_brief';
import type { D1Database } from '../../shared/server/d1';

// 아주 작은 가짜 D1: minilog_keys 한 줄만 흉내 낸다
function fakeDb() {
  const rows = new Map<string, { pub: string; secret: string }>();
  const db = {
    prepare(sql: string) {
      let args: unknown[] = [];
      const st = {
        bind(...a: unknown[]) { args = a; return st; },
        async first() { return rows.get('vapid') ?? null; },
        async run() { if (/INSERT OR IGNORE/.test(sql) && !rows.has('vapid')) rows.set('vapid', { pub: String(args[0]), secret: String(args[1]) }); return {}; },
      };
      return st;
    },
  };
  return { db: db as unknown as D1Database, rows };
}

test('알림 키: 비밀값이 없으면 CRED_KEY로 한 번 만들어 비밀 키는 암호화해 두고, 다음에는 같은 키, CRED_KEY도 없으면 못 켬', async () => {
  const env = { CRED_KEY: Buffer.alloc(32, 5).toString('base64') };
  const { db, rows } = fakeDb();
  const a = await vapidKeysFor(env, db);
  expect(a).not.toBeNull();
  expect(Buffer.from(a!.pub.replace(/-/g, '+').replace(/_/g, '/'), 'base64').length).toBe(65);
  expect(rows.get('vapid')!.secret).toMatch(/^v1\./);
  expect(rows.get('vapid')!.secret).not.toContain(a!.priv); // 비밀 키 원문은 DB에 없음
  const b = await vapidKeysFor(env, db);
  expect(b).toEqual(a); // 같은 키를 다시 씀
  expect(await vapidKeysFor({}, fakeDb().db)).toBeNull();
  expect(await vapidKeysFor({ CRED_KEY: Buffer.alloc(32, 6).toString('base64') }, db)).toBeNull(); // 다른 키로는 안 풀림
  // CRED_KEY가 없어도 운영에 이미 있는 MAIL_CRON_TOKEN에서 키를 뽑아 바로 켤 수 있다(Cloudflare에 따로 넣지 않아도)
  const viaCron = { MAIL_CRON_TOKEN: 'cron-token-for-test-0123456789' };
  const c1 = fakeDb();
  const k1 = await vapidKeysFor(viaCron, c1.db);
  expect(k1).not.toBeNull();
  expect(await vapidKeysFor(viaCron, c1.db)).toEqual(k1);
  expect(await vapidKeysFor({ MAIL_CRON_TOKEN: 'short' }, fakeDb().db)).toBeNull(); // 너무 짧은 값은 쓰지 않음
});
