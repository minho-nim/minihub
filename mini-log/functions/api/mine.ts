import { json, type HubContext } from '../../../shared/server/d1';
import { requireSession } from '../../../shared/server/auth';

// '내 글' 한 화면: 원고 말고 내가 쓴 다른 것(게시한 블로그 글·보낸 메일·제안·SNS에 올린 기록)을 모아 준다.
// 원고는 화면이 이미 불러온 목록을 쓴다. 본인 것만, 종류마다 개수 제한
export const onRequestGet = async (ctx: HubContext) => {
  const auth = await requireSession(ctx, 'minilog');
  if (auth instanceof Response) return auth;
  const { db, session: { user } } = auth;
  const [posts, mails, shares] = await Promise.all([
    db.prepare('SELECT url, title, published_on, views FROM minilog_posts WHERE user = ? ORDER BY published_on DESC LIMIT 300').bind(user).all<{ url: string; title: string; published_on: string | null; views: number | null }>(),
    db.prepare("SELECT id, subject, kind, to_addr, from_addr, sent_at, campaign_id FROM minilog_mails WHERE user = ? AND sent_at IS NOT NULL AND (kind = 'outgoing' OR status = 'sent') ORDER BY sent_at DESC LIMIT 200").bind(user).all<{ id: string; subject: string; kind: string; to_addr: string | null; from_addr: string | null; sent_at: number; campaign_id: string | null }>(),
    db.prepare('SELECT draft_id, channel, shared_at, text FROM minilog_shares WHERE user = ? ORDER BY shared_at DESC LIMIT 300').bind(user).all<{ draft_id: string; channel: string; shared_at: number; text: string | null }>(),
  ]);
  return json({
    posts: posts.results.filter(p => /^https:\/\//.test(p.url)),
    // 받는 사람 주소는 앞 두 글자만(목록에는 누구에게 보냈는지 짐작할 정도만)
    mails: mails.results.map(m => ({ id: m.id, subject: m.subject, kind: m.kind, sent_at: m.sent_at, campaign_id: m.campaign_id, to: (m.kind === 'outgoing' ? m.to_addr : m.from_addr)?.replace(/^(.{2})[^@]*/, '$1***') ?? '' })),
    shares: shares.results,
  });
};
