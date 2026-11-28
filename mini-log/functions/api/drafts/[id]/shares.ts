import { json, readJson, type HubContext } from '../../../../../shared/server/d1';
import { requireSession } from '../../../../../shared/server/auth';
import { getDraft } from '../../../_drafts';

// 다른 곳에도 올리기 기록: 사람이 인스타·스레드·X에 직접 올린 뒤 '올렸어요'로 체크한 것만 남긴다(앱은 대신 올리지 않음).
// GET → { channels: { instagram?: ms, threads?: ms, x?: ms } }, PUT { channel, shared: boolean, text? } → 같은 모양
// text: 그때 그 채널에 올린 글(3,000자까지, 글자만). '내 글' 화면에서 다시 본다
export const SHARE_CHANNELS = ['instagram', 'threads', 'x'] as const;
type Channel = typeof SHARE_CHANNELS[number];

async function draftOf(ctx: HubContext) {
  const auth = await requireSession(ctx, 'minilog');
  if (auth instanceof Response) return { error: auth } as const;
  const id = typeof ctx.params?.id === 'string' && /^[0-9a-f-]{36}$/.test(ctx.params.id) ? ctx.params.id : '';
  if (!id || !(await getDraft(auth.db, auth.session.user, id))) return { error: json({ error: '원고를 찾을 수 없어요.' }, 404) } as const;
  return { auth, id } as const;
}
async function list(db: HubContext['env']['DB'], user: string, id: string) {
  const rows = await db!.prepare('SELECT channel, shared_at FROM minilog_shares WHERE user = ? AND draft_id = ?').bind(user, id).all<{ channel: string; shared_at: number }>();
  return Object.fromEntries(rows.results.map(r => [r.channel, r.shared_at]));
}

export const onRequestGet = async (ctx: HubContext) => {
  const r = await draftOf(ctx);
  if ('error' in r) return r.error;
  return json({ channels: await list(r.auth.db, r.auth.session.user, r.id) });
};

export const onRequestPut = async (ctx: HubContext) => {
  const r = await draftOf(ctx);
  if ('error' in r) return r.error;
  const body = await readJson(ctx.request);
  const channel = body?.channel as Channel;
  if (!SHARE_CHANNELS.includes(channel) || typeof body?.shared !== 'boolean') return json({ error: '올린 곳을 다시 골라 주세요.' }, 400);
  const { db, session: { user } } = r.auth;
  const text = typeof body.text === 'string' ? body.text.replace(/[\u0000-\u0008\u000b-\u001f]/g, '').slice(0, 3000) : null;
  if (body.shared) await db.prepare('INSERT INTO minilog_shares (user, draft_id, channel, shared_at, text) VALUES (?, ?, ?, ?, ?) ON CONFLICT(user, draft_id, channel) DO UPDATE SET text = COALESCE(excluded.text, minilog_shares.text)').bind(user, r.id, channel, Date.now(), text).run();
  else await db.prepare('DELETE FROM minilog_shares WHERE user = ? AND draft_id = ? AND channel = ?').bind(user, r.id, channel).run();
  return json({ channels: await list(db, user, r.id) });
};
