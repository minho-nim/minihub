import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { api } from '../../shared/client/api';
import { NavIcon } from './NavIcon';
import { usePostTypes } from './PostTypes';

// '내 글': 원고·게시한 블로그 글·보낸 메일·제안·SNS에 올린 기록을 한곳에.
// 보기는 '표'(종류마다 왼쪽 색 띠·색 칩)와 '날짜별'(시간 순서 + 오른쪽 미리보기). 고른 보기는 이 기기에 기억.
// 옆 메뉴의 원고 목록·빈 원고 안내는 여기로 옮겼다(원고가 많아도 메뉴가 길어지지 않게).
export interface MineDraft { id: string; title: string; body: string; status: 'draft' | 'approved' | 'published'; post_type: string; planned_on: string | null; published_at: number | null; updated_at: number; photo_count?: number }
interface Extra {
  posts: { url: string; title: string; published_on: string | null; views: number | null }[];
  mails: { id: string; subject: string; kind: string; sent_at: number; campaign_id: string | null; to: string }[];
  shares: { draft_id: string; channel: string; shared_at: number; text: string | null }[];
}
type Kind = 'd' | 'b' | 'm' | 's';
const KIND: Record<Kind, { label: string; icon: string }> = { d: { label: '원고', icon: 'drafts' }, b: { label: '블로그 글', icon: 'blog' }, m: { label: '보낸 메일·제안', icon: 'mail' }, s: { label: 'SNS 글', icon: 'report' } };
const CHANNEL: Record<string, string> = { instagram: '인스타그램', threads: '스레드', x: 'X' };
const STATUS: Record<MineDraft['status'], string> = { draft: '작성 중', approved: '승인됨', published: '게시됨' };
interface Item { key: string; kind: Kind; title: string; sub: string; status: string; tone: '' | 'ok' | 'pub'; at: number; when: string; extra: string; draftId?: string; url?: string; preview?: string; mailId?: string }
interface MailView { subject: string; snippet: string; reply_body: string; kind: string; from_name: string; from_addr: string; to_addr: string; sent_at: number | null }

const md = (ms: number) => { const d = new Date(ms + 9 * 3600000); return `${d.getUTCMonth() + 1}/${d.getUTCDate()}`; };
const dayMs = (s: string) => Date.parse(`${s}T00:00:00+09:00`);
const weekStart = (now: number) => { const d = new Date(now + 9 * 3600000); const dow = (d.getUTCDay() + 6) % 7; return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - dow) - 9 * 3600000; };
function sectionOf(at: number, now: number) {
  const w = weekStart(now);
  if (at >= w) return '이번 주';
  if (at >= w - 7 * 86400000) return '지난주';
  if (at >= w - 35 * 86400000) return '한 달 안';
  return '그 전';
}
const VIEW_KEY = 'minilog.mine.view';

export function MineView({ drafts, onRefresh, onOpenDraft, onCreate, creating, onMail, pickBar, picking, picked, onPick, olderButton, rhythm }: {
  drafts: MineDraft[] | null; onRefresh: () => void; onOpenDraft: (id: string) => void; onCreate: () => void; creating: boolean; onMail: () => void;
  pickBar: ReactNode; picking: boolean; picked: Set<string>; onPick: (id: string) => void; olderButton: ReactNode; rhythm: ReactNode;
}) {
  const [extra, setExtra] = useState<Extra | null>(null);
  const [kind, setKind] = useState<Kind | 'all'>('all');
  const [q, setQ] = useState('');
  const [view, setViewS] = useState<'table' | 'time'>(() => { try { return localStorage.getItem(VIEW_KEY) === 'time' ? 'time' : 'table'; } catch { return 'table'; } });
  const [sel, setSel] = useState<string | null>(null);
  const types = usePostTypes();
  const setView = (v: 'table' | 'time') => { setViewS(v); try { localStorage.setItem(VIEW_KEY, v); } catch { /* 기억 못 해도 됨 */ } };
  // 열 때마다 원고 목록도 새로(다른 기기에서 만든 원고까지)
  useEffect(() => { onRefresh(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { api<Extra>('/api/mine').then(setExtra).catch(() => setExtra({ posts: [], mails: [], shares: [] })); }, []);

  const now = Date.now();
  const items = useMemo<Item[]>(() => {
    const label = (k: string) => types.types.find(t => t.key === k)?.label ?? '';
    const byId = new Map((drafts ?? []).map(d => [d.id, d]));
    const out: Item[] = (drafts ?? []).map(d => ({
      key: `d-${d.id}`, kind: 'd', title: d.title.trim() || '제목 없는 원고', sub: label(d.post_type) || '글 종류 없음',
      status: STATUS[d.status], tone: d.status === 'published' ? 'pub' : d.status === 'approved' ? 'ok' : '',
      at: d.published_at ?? (d.planned_on ? dayMs(d.planned_on) : d.updated_at),
      when: d.planned_on && d.status !== 'published' ? `${md(dayMs(d.planned_on))} 게시 예정` : d.published_at ? `${md(d.published_at)} 게시` : `${md(d.updated_at)} 고침`,
      extra: d.photo_count ? `사진 ${d.photo_count}` : '', draftId: d.id, preview: d.body.slice(0, 220),
    }));
    for (const p of extra?.posts ?? []) {
      const at = p.published_on ? dayMs(p.published_on) : 0;
      out.push({ key: `b-${p.url}`, kind: 'b', title: p.title || '(제목 없음)', sub: '블로그', status: '게시 완료', tone: 'pub', at, when: at ? md(at) : '', extra: p.views != null ? `조회 ${p.views.toLocaleString('ko-KR')}` : '', url: p.url });
    }
    for (const m of extra?.mails ?? []) out.push({ key: `m-${m.id}`, kind: 'm', title: m.subject || '(제목 없음)', sub: m.kind === 'outgoing' ? '새 메일·제안' : '답장', status: '보냄', tone: 'ok', at: m.sent_at, when: md(m.sent_at), extra: m.to ? `받는 사람 ${m.to}` : '', mailId: m.id });
    for (const s of extra?.shares ?? []) {
      const d = byId.get(s.draft_id);
      out.push({ key: `s-${s.draft_id}-${s.channel}`, kind: 's', title: `${d?.title.trim() || '원고'} · ${CHANNEL[s.channel] ?? s.channel}`, sub: CHANNEL[s.channel] ?? s.channel, status: '올림', tone: 'ok', at: s.shared_at, when: md(s.shared_at), extra: d ? `← ${d.title.trim() || '원고'}` : '', draftId: s.draft_id, preview: s.text ?? '' });
    }
    return out.sort((a, b) => b.at - a.at);
  }, [drafts, extra, types]);

  const count = (k: Kind) => items.filter(i => i.kind === k).length;
  const needle = q.trim().toLowerCase();
  const shown = items.filter(i => (kind === 'all' || i.kind === kind) && (!needle || `${i.title} ${i.sub} ${i.preview ?? ''}`.toLowerCase().includes(needle)));
  const sections: [string, Item[]][] = [];
  for (const it of shown) { const s = sectionOf(it.at, now); const last = sections[sections.length - 1]; if (last && last[0] === s) last[1].push(it); else sections.push([s, [it]]); }
  // 메일·SNS 글은 다른 화면으로 가지 않고 이 화면 오른쪽 미리보기에서 본다(원고만 원고 화면으로)
  const open = (it: Item) => { if (it.kind === 'd' && it.draftId) onOpenDraft(it.draftId); else { setSel(it.key); setView('time'); } };
  const selItem = shown.find(i => i.key === sel) ?? shown[0] ?? null;
  const related = selItem?.draftId ? items.filter(i => i.kind === 's' && i.draftId === selItem.draftId && i.key !== selItem.key) : [];
  // 보낸 메일은 고르면 그 메일 한 통을 읽어 와 이 화면에서 보여 준다(글자로만, HTML은 넣지 않음)
  const [mailView, setMailView] = useState<{ id: string; mail: MailView | null; error?: string } | null>(null);
  useEffect(() => {
    const id = selItem?.mailId;
    if (!id || mailView?.id === id) return;
    setMailView({ id, mail: null });
    api<{ mail: MailView }>(`/api/mail/${id}`).then(r => setMailView({ id, mail: r.mail })).catch(e => setMailView({ id, mail: null, error: e instanceof Error ? e.message : '메일을 불러오지 못했어요.' }));
  }, [selItem?.mailId]); // eslint-disable-line react-hooks/exhaustive-deps
  const mv = mailView && selItem?.mailId === mailView.id ? mailView : null;

  const TitleCell = ({ it }: { it: Item }) => it.url
    ? <a className="mine-title" href={it.url} target="_blank" rel="noopener noreferrer">{it.title}</a>
    : <button type="button" className="mine-title" onClick={() => open(it)}>{it.title}</button>;
  const Tag = ({ k }: { k: Kind }) => <span className={`mine-tag k-${k}`}><NavIcon name={KIND[k].icon} size={13} />{k === 'm' ? '보낸 메일' : KIND[k].label}</span>;

  return (
    <article className="stack mine" aria-labelledby="mine-title">
      <div className="mine-head">
        <h1 id="mine-title">내 글 <span className="muted small">{items.length}개</span></h1>
        <div className="seg" role="group" aria-label="보기">
          <button type="button" aria-pressed={view === 'table'} onClick={() => setView('table')}>표</button>
          <button type="button" aria-pressed={view === 'time'} onClick={() => setView('time')}>날짜별</button>
        </div>
        <input className="input mine-search" type="search" aria-label="내 글 찾기" placeholder="제목·내용 찾기" value={q} onChange={e => setQ(e.target.value)} />
        <button type="button" className="btn primary" disabled={creating} onClick={onCreate}>+ 원고 쓰기</button>
      </div>
      <div className="mine-chips" role="group" aria-label="종류">
        <button type="button" className="chip-btn" aria-pressed={kind === 'all'} onClick={() => setKind('all')}>전체 {items.length}</button>
        {(Object.keys(KIND) as Kind[]).map(k => <button key={k} type="button" className={`chip-btn k-${k}`} aria-pressed={kind === k} onClick={() => setKind(k)}><i className="mine-dot" aria-hidden="true" />{KIND[k].label} {count(k)}</button>)}
      </div>
      {rhythm}
      {(kind === 'all' || kind === 'd') && (drafts?.length ?? 0) > 0 && pickBar}
      {drafts?.length === 0 && (
        <div className="card mine-empty"><p style={{ margin: 0 }}>아직 원고가 없어요. <b>+ 원고 쓰기</b>로 시작하세요.</p><p className="muted small" style={{ margin: 0 }}>게시한 블로그 글·보낸 메일·SNS에 올린 기록도 여기에 함께 모여요.</p></div>
      )}
      {shown.length === 0 && items.length > 0 && <p className="muted small" style={{ margin: 0 }}>찾는 글이 없어요.</p>}

      {view === 'table' && shown.length > 0 && (
        <table className="mine-table" aria-label="내 글">
          <thead><tr><th>종류</th><th>제목</th><th>글 종류·내용</th><th>상태</th><th>날짜</th><th>이어진 것·숫자</th></tr></thead>
          <tbody>
            {sections.map(([name, rows]) => [
              <tr key={`h-${name}`} className="mine-sec"><td colSpan={6}>{name}</td></tr>,
              ...rows.map(it => (
                <tr key={it.key} className={`k-${it.kind}`}>
                  <td>{picking && it.kind === 'd' ? <label className="mine-pick"><input type="checkbox" checked={picked.has(it.draftId!)} onChange={() => onPick(it.draftId!)} aria-label={`${it.title} 고르기`} /><Tag k={it.kind} /></label> : <Tag k={it.kind} />}</td>
                  <td><TitleCell it={it} /></td>
                  <td className="muted">{it.sub}</td>
                  <td><span className={`mine-st${it.tone ? ` ${it.tone}` : ''}`}>{it.status}</span></td>
                  <td className="muted">{it.when}</td>
                  <td className="muted small">{it.extra}</td>
                </tr>
              )),
            ])}
          </tbody>
        </table>
      )}

      {view === 'time' && shown.length > 0 && (
        <div className="mine-time">
          <div className="mine-line">
            {sections.map(([name, rows]) => (
              <section key={name} aria-label={name}>
                <h2 className="mine-sec-h">{name}</h2>
                <ol>
                  {rows.map(it => (
                    <li key={it.key} className={`k-${it.kind}`}>
                      <button type="button" className={`mine-row${selItem?.key === it.key ? ' on' : ''}`} aria-current={selItem?.key === it.key} onClick={() => setSel(it.key)}>
                        <Tag k={it.kind} /><b>{it.title}</b><span className={`mine-st${it.tone ? ` ${it.tone}` : ''}`}>{it.status}</span><span className="muted small">{it.when}</span>
                      </button>
                    </li>
                  ))}
                </ol>
              </section>
            ))}
          </div>
          {selItem && (
            <aside className="card mine-preview" aria-label="미리보기">
              <div className="row-between"><span className="mine-meta"><Tag k={selItem.kind} /><span className={`mine-st${selItem.tone ? ` ${selItem.tone}` : ''}`}>{selItem.status}</span><span className="muted small">{selItem.sub} · {selItem.when}</span></span>
                {selItem.url ? <a className="btn small" href={selItem.url} target="_blank" rel="noopener noreferrer">블로그에서 보기 ↗</a>
                  : selItem.kind === 'm' ? <button type="button" className="btn small" onClick={onMail}>메일함에서 열기</button>
                  : selItem.draftId ? <button type="button" className="btn small" onClick={() => onOpenDraft(selItem.draftId!)}>{selItem.kind === 's' ? '원고 열기' : '열기'}</button> : null}</div>
              <h2>{selItem.title}</h2>
              {selItem.kind === 's' && (selItem.preview ? <p className="mine-text mine-full">{selItem.preview}</p> : <p className="muted small" style={{ margin: 0 }}>이 기록은 글을 저장하기 전에 체크한 거라 본문이 없어요. 앞으로 '올렸어요'를 누르면 그때 글이 함께 저장돼요.</p>)}
              {selItem.kind === 'd' && (selItem.preview ? <p className="mine-text">{selItem.preview}{selItem.preview.length >= 220 ? '…' : ''}</p> : <p className="muted small" style={{ margin: 0 }}>아직 본문이 없어요.</p>)}
              {selItem.kind === 'b' && selItem.extra && <p className="muted small" style={{ margin: 0 }}>{selItem.extra}</p>}
              {selItem.kind === 'm' && (!mv || (!mv.mail && !mv.error) ? <p className="muted small" role="status" style={{ margin: 0 }}>메일을 불러오는 중…</p>
                : mv.error ? <p className="error small" role="alert" style={{ margin: 0 }}>{mv.error}</p>
                : mv.mail && (
                  <div className="mine-mail">
                    <p className="muted small" style={{ margin: 0 }}>{selItem.extra}</p>
                    <b className="small">내가 보낸 글</b>
                    <p className="mine-text mine-full">{mv.mail.reply_body || '(본문 없음)'}</p>
                    {mv.mail.kind !== 'outgoing' && mv.mail.snippet && <><b className="small">받은 메일({mv.mail.from_name || mv.mail.from_addr})</b><p className="mine-text">{mv.mail.snippet}</p></>}
                  </div>
                ))}
              {selItem.kind === 'd' && (
                <div className="mine-rel"><b className="small">이 원고에서 나온 것</b>
                  {related.length ? related.map(r => <div key={r.key} className="small mine-meta"><Tag k={r.kind} />{r.sub} <span className="muted">{r.when}</span></div>) : <span className="muted small">아직 없어요(SNS에 올렸다고 표시하면 여기 모여요).</span>}
                </div>
              )}
            </aside>
          )}
        </div>
      )}
      {olderButton}
    </article>
  );
}
